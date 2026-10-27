#!/usr/bin/env python3
"""
backtest_all_models.py — THE single source of performance truth for Latent.pk
=============================================================================

Every performance number shown anywhere in the product (UI, reports, docs)
must come from the JSON this script writes: data/backtest_report.json.
If a model does not appear in that report's "results" dict, its performance
is UNMEASURED and the UI must not show numbers for it.

WHAT THIS HARNESS DOES (methodology — do not weaken):
  * Walk-forward evaluation with a strict purge: at each step date T every
    model is retrained ONLY on rows whose full 21-day label window ENDS
    BEFORE T (label_end < T), so no information from T or later can touch
    the training set. Acceptance test (a) below verifies this.
  * Signals at close t, entry at OPEN t+1, exit at OPEN t+1+21.
    Position return = open[t+1+21] / open[t+1] - 1 - round_trip_cost.
  * Point-in-time liquidity universe: at each step date, a stock is eligible
    iff it has >= 400 bars of history so far AND its trailing-60-day median
    traded value (close*volume) >= PKR 20m, using only data up to t.
  * ONE identical portfolio rule for every model: top-10 scores, equal
    weight, non-overlapping 21-day periods, 0.8% round-trip cost per
    position. If fewer than 10 eligible stocks, hold what exists; if none,
    the period is cash (0%).
  * Metrics from a REAL compounded equity curve: CAGR, Sharpe (from
    non-overlapping period returns, sqrt(252/21) annualisation), max
    drawdown, plus position-level win rate, profit factor, expectancy,
    avg win / avg loss.
  * Model registry (below): histgbm, lightgbm, xgboost, random_forest,
    extra_trees, ridge, logistic, momentum_rule. momentum_rule is the
    baseline every AI model must beat — it appears in every report.

ADAPTER INTERFACE — how to register a future model
--------------------------------------------------
Any sklearn-style model can join the registry in ~3 lines:

    REGISTRY["my_model"] = ModelSpec(
        kind="regressor",                  # or "classifier"
        make=lambda: MyModel(**params),    # must expose fit(X, y) / predict(X)
                                           # (or predict_proba for classifiers)
        role="challenger",
    )

Requirements for a model to be measurable (all enforced by this harness):
  1. fit(X, y) / predict(X) interface (predict_proba -> column 1 for
     classifiers). X is a float32 DataFrame of FEATURE_COLS, y is the
     21-day open-to-open forward return (float) or (fwd_ret > 0) flag.
  2. The model is RETRAINED INSIDE the walk-forward loop at every step
     date on the purged training set only. A model that cannot be
     retrained point-in-time (frozen weights, precomputed forecasts,
     foundation-model inference on future data) CANNOT be measured here.
  3. Deterministic given a fixed random_state.

DEEP-LEARNING / FOUNDATION MODELS (GRU, LSTM, Chronos, Lag-Llama, Moirai,
Time-LLM, PatchTST, N-BEATS, TimesNet, Informer, Prophet, ARIMA, ...):
they stay OUT of the registry until someone writes a point-in-time
adapter that retrains them inside the walk-forward loop under the same
purge rule. Until then their performance is "unmeasured" — the UI must
not show their old (leaky 20%-holdout) numbers.

Acceptance criteria wired into this file
----------------------------------------
(a) No lookahead: run with --leak-test — it re-runs a window of steps on
    the full dataset and on a dataset truncated AFTER the window; every
    step's picks and period returns must be identical (they only depend
    on rows dated before the step). Exits non-zero on mismatch.
(b) momentum_rule (baseline) is always evaluated and always present in
    the report and the printed ranking table.
(c) The legacy report generators (train_meta_ensemble.py et al.) are no
    longer invoked anywhere; data/backtest_report.json and the UI's
    Backtesting Report are produced/served from THIS harness only.

Usage
-----
    python3 scripts/backtest_all_models.py                  # full run: all stocks, from 2019
    python3 scripts/backtest_all_models.py --ci             # fast smoke: --max-stocks 200 --start 2022-01-01
    python3 scripts/backtest_all_models.py --leak-test      # acceptance criterion (a)

Env vars: LATENT_DB (default db/custom.db), LATENT_OUT (default data/backtest_report.json)
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
HORIZON = 21                     # trading days: entry at open t+1, exit at open t+1+21
STEP_DAYS = 21                   # non-overlapping evaluation periods
TOP_N = 10                       # equal-weight positions per period
ROUND_TRIP_COST = 0.008          # 0.8% round-trip cost per position
MIN_MED_VALUE = 20_000_000.0     # PKR, trailing-60d median traded value
MIN_HISTORY = 400                # bars of history required (point-in-time)
DEFAULT_START = "2019-01-01"
DEFAULT_TRAIN_CAP = 250_000      # most-recent-row cap per step (perf knob, disclosed)
CI_TRAIN_CAP = 50_000
N_JOBS = min(2, (os.cpu_count() or 2))
SEED = 42

FEATURE_COLS = [
    "ret_1d", "ret_5d", "ret_10d", "ret_21d", "ret_63d",
    "sma20_ratio", "sma50_ratio", "sma200_ratio",
    "vol_21d", "vol_63d", "volume_ratio_20d",
    "rsi_14", "hi_252_prox",
]

# Legacy (leaky 20%-holdout) display names -> registry entries they map to.
# Everything else stays "unmeasured" and the UI must show no numbers for it.
LEGACY_NAME_MAP = {
    "histgbm": "HistGBM (CL-2)",
    "lightgbm": "LightGBM",
    "xgboost": "XGBoost",
    "random_forest": "Random Forest",
    "extra_trees": "ExtraTrees (CL-2)",
    "ridge": "Ridge Regression",
    "logistic": "Logistic (CL-2)",
}
KNOWN_UNMEASURED_EXTRA = ["momentum_rule"]  # registry names without legacy entries


class ModelSpec:
    __slots__ = ("kind", "make", "role", "note")

    def __init__(self, kind, make, role="challenger", note=""):
        self.kind = kind      # "regressor" | "classifier" | "rule"
        self.make = make      # zero-arg factory -> object with fit/predict
        self.role = role
        self.note = note


def _lean() -> bool:
    """Lean hyper-parameters are used when --ci / --lean is passed."""
    return os.environ.get("LATENT_LEAN") == "1"


def build_registry(lean: bool) -> dict:
    from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    rf_kw = dict(n_estimators=60 if lean else 120, max_depth=8 if lean else 9,
                 min_samples_leaf=300 if lean else 250, max_features=0.5,
                 n_jobs=N_JOBS, random_state=SEED)
    reg_note = "lean (CI) hyper-params" if lean else "standard hyper-params"

    return {
        "momentum_rule": ModelSpec(
            "rule", None, role="baseline",
            note="21-day return cross-sectional momentum — no training; "
                 "the baseline every AI model must beat"),
        "ridge": ModelSpec(
            "regressor",
            lambda: Pipeline([("sc", StandardScaler()), ("m", Ridge(alpha=10.0))]),
            note=reg_note),
        "logistic": ModelSpec(
            "classifier",
            lambda: Pipeline([("sc", StandardScaler()),
                              ("m", LogisticRegression(C=0.1, max_iter=500, random_state=SEED))]),
            note="P(close>0 over the 21d window); score = P(up)"),
        "histgbm": ModelSpec(
            "regressor",
            lambda: __import__("sklearn.ensemble", fromlist=["HistGradientBoostingRegressor"])
            .HistGradientBoostingRegressor(
                max_iter=100 if lean else 250, learning_rate=0.08 if lean else 0.06,
                max_leaf_nodes=31, l2_regularization=1.0,
                early_stopping=False, random_state=SEED),
            note=reg_note),
        "lightgbm": ModelSpec(
            "regressor",
            lambda: __import__("lightgbm", fromlist=["LGBMRegressor"]).LGBMRegressor(
                n_estimators=120 if lean else 250, learning_rate=0.06 if lean else 0.05,
                num_leaves=31, min_child_samples=100, subsample=0.9, subsample_freq=1,
                colsample_bytree=0.9, n_jobs=N_JOBS, random_state=SEED, verbosity=-1),
            note=reg_note),
        "xgboost": ModelSpec(
            "regressor",
            lambda: __import__("xgboost", fromlist=["XGBRegressor"]).XGBRegressor(
                n_estimators=120 if lean else 250, learning_rate=0.06 if lean else 0.05,
                max_depth=5, subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
                tree_method="hist", n_jobs=N_JOBS, random_state=SEED, verbosity=0),
            note=reg_note),
        "random_forest": ModelSpec(
            "regressor",
            lambda: RandomForestRegressor(**rf_kw), note=reg_note),
        "extra_trees": ModelSpec(
            "regressor",
            lambda: ExtraTreesRegressor(**rf_kw), note=reg_note),
    }


# ----------------------------------------------------------------------------
# Data loading + features
# ----------------------------------------------------------------------------
def load_prices(db_path: Path, max_stocks: int, truncate_after: str | None) -> pd.DataFrame:
    """Load OhlcvBar (symbol,date,open,close,volume). open/close>0 enforced.

    truncate_after: if set, drop rows with date > this (leak-test only).
    max_stocks: keep the K most-liquid symbols by full-sample median traded
    value (speed knob for CI only; full run uses every symbol).
    """
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        df = pd.read_sql_query(
            "SELECT symbol, date, open, close, volume FROM OhlcvBar "
            "WHERE open > 0 AND close > 0 ORDER BY symbol, date", con)
    finally:
        con.close()
    df["tv"] = df["close"] * df["volume"]
    if max_stocks and max_stocks > 0:
        # Symbol selection uses the FULL sample (before any truncation) so that
        # the leak-test's truncated dataset keeps an identical symbol list.
        med = df.groupby("symbol")["tv"].median().sort_values(ascending=False)
        keep = set(med.head(max_stocks).index)
        df = df[df["symbol"].isin(keep)].copy()
    if truncate_after:
        df = df[df["date"] <= truncate_after].copy()
    return df.reset_index(drop=True)


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Per-symbol point-in-time features + the 21d open-to-open forward return.

    A row's label is usable only when its full window has ended, expressed by
    label_end_date (calendar date of the exit open) < step date T.
    """
    g = df.groupby("symbol", sort=False)
    c, o, v = df["close"], df["open"], df["volume"]
    r1 = c.groupby(df["symbol"]).pct_change().clip(-0.5, 0.5)

    df["ret_1d"] = r1
    for w in (5, 10, 21, 63):
        df[f"ret_{w}d"] = c.groupby(df["symbol"]).pct_change(w).clip(-0.95, 5.0)
    for w in (20, 50, 200):
        df[f"sma{w}_ratio"] = c / c.groupby(df["symbol"]).transform(
            lambda s: s.rolling(w, min_periods=w).mean()) - 1
    df["vol_21d"] = r1.groupby(df["symbol"]).transform(lambda s: s.rolling(21, min_periods=21).std())
    df["vol_63d"] = r1.groupby(df["symbol"]).transform(lambda s: s.rolling(63, min_periods=63).std())
    vsma = v.groupby(df["symbol"]).transform(lambda s: s.rolling(20, min_periods=20).mean())
    df["volume_ratio_20d"] = (v / vsma.replace(0, np.nan)).clip(0, 50)
    # RSI(14), Wilder
    up = r1.clip(lower=0)
    dn = (-r1).clip(lower=0)
    au = up.groupby(df["symbol"]).transform(lambda s: s.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean())
    ad = dn.groupby(df["symbol"]).transform(lambda s: s.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean())
    df["rsi_14"] = (100 - 100 / (1 + au / ad.replace(0, np.nan))).fillna(50.0)
    hi252 = c.groupby(df["symbol"]).transform(lambda s: s.rolling(252, min_periods=60).max())
    df["hi_252_prox"] = (c / hi252 - 1).clip(-0.95, 0)

    # Point-in-time liquidity: trailing-60d median traded value + history length
    df["med_tv_60"] = df["tv"].groupby(df["symbol"]).transform(
        lambda s: s.rolling(60, min_periods=40).median())
    df["hist_n"] = g.cumcount() + 1

    # Forward return: entry at open t+1, exit at open t+1+21 (per-symbol calendar)
    entry_open = df.groupby("symbol")["open"].shift(-1)
    exit_open = df.groupby("symbol")["open"].shift(-1 - HORIZON)
    df["fwd_ret"] = (exit_open / entry_open - 1).clip(-0.95, 3.0)
    df["label_end_date"] = df.groupby("symbol")["date"].shift(-1 - HORIZON)
    return df


# ----------------------------------------------------------------------------
# Backtest core
# ----------------------------------------------------------------------------
def step_snapshot(data: pd.DataFrame, t: str, min_med: float, min_hist: int) -> pd.DataFrame:
    rows = data[(data["date"] == t)
                & (data["med_tv_60"] >= min_med)
                & (data["hist_n"] >= min_hist)]
    return rows.dropna(subset=FEATURE_COLS)


def train_slice(data: pd.DataFrame, t: str, train_cap: int) -> pd.DataFrame:
    """Rows whose full 21-day label window ENDED strictly before T (purged)."""
    tr = data[(data["label_end_date"].notna()) & (data["label_end_date"] < t)
              & data["fwd_ret"].notna()].dropna(subset=FEATURE_COLS)
    if train_cap and len(tr) > train_cap:
        tr = tr.tail(train_cap)  # most recent rows only (data is sorted by date,symbol)
    return tr


def model_scores(spec: ModelSpec, Xtr: pd.DataFrame, ytr: pd.Series, Xun: pd.DataFrame) -> np.ndarray:
    if spec.kind == "rule":
        return Xun["ret_21d"].to_numpy(dtype=np.float64)
    m = spec.make()
    if spec.kind == "classifier":
        m.fit(Xtr, (ytr > 0).astype(int))
        proba = m.predict_proba(Xun)
        return np.asarray(proba)[:, 1]
    m.fit(Xtr, ytr)
    return np.asarray(m.predict(Xun), dtype=np.float64)


def rank_table(results: dict) -> str:
    rows = sorted(results.items(), key=lambda kv: kv[1]["profit_factor"], reverse=True)
    hdr = f"{'model':<16}{'PF':>6}{'expect%':>9}{'CAGR%':>8}{'Sharpe':>8}{'MaxDD%':>8}{'win%':>7}{'n_pos':>8}{'n_per':>7}  role"
    lines = [hdr, "-" * len(hdr)]
    for name, r in rows:
        lines.append(
            f"{name:<16}{r['profit_factor']:>6.2f}{r['expectancy_pct']:>9.2f}"
            f"{r['cagr_pct']:>8.2f}{r['sharpe']:>8.2f}{r['max_drawdown_pct']:>8.1f}"
            f"{r['position_win_rate_pct']:>7.1f}{r['n_positions']:>8}{r['n_periods']:>7}  "
            f"{'BASELINE' if r.get('role') == 'baseline' else r.get('role', '')}")
    return "\n".join(lines)


def run_backtest(data: pd.DataFrame, args, state: dict | None = None, persist=None) -> tuple[dict, dict]:
    """Core walk-forward loop. Returns (results, step_trace).

    state/persist: optional checkpoint-resume. `state` is a previously saved
    checkpoint dict (see main); `persist` is called with the updated state
    after every step so long runs can be resumed across invocations.
    """
    registry = build_registry(args.lean)
    all_dates = np.array(sorted(data["date"].unique()))
    # Steps: every STEP_DAYS-th trading day whose exit bar exists in the master calendar
    step_idx = list(range(0, len(all_dates) - 1 - HORIZON, STEP_DAYS))
    if args.start:
        step_idx = [k for k in step_idx if all_dates[k] >= args.start]
    if args.end:
        step_idx = [k for k in step_idx if all_dates[k] <= args.end]
    n_steps = len(step_idx)
    print(f"Universe: {data['symbol'].nunique()} symbols, {len(data):,} rows, "
          f"{all_dates[0]}..{all_dates[-1]}; {n_steps} steps from "
          f"{all_dates[step_idx[0]] if step_idx else '—'}")

    # state per model (optionally resumed from a checkpoint)
    if state:
        period_returns = {k: list(v) for k, v in state["period_returns"].items()}
        pos_returns = {k: list(v) for k, v in state["pos_returns"].items()}
        cash_periods = {k: int(v) for k, v in state["cash_periods"].items()}
        eligible_sizes = list(state["eligible_sizes"])
        start_i = int(state["next_i"])
        print(f"Resuming from checkpoint: {start_i}/{n_steps} steps already done")
    else:
        period_returns = {name: [] for name in registry}
        pos_returns = {name: [] for name in registry}
        cash_periods = {name: 0 for name in registry}
        eligible_sizes = []
        start_i = 0

    t_run = time.time()
    completed = True
    for si in range(start_i, n_steps):
        k = step_idx[si]
        t0 = time.time()
        T = str(all_dates[k])
        univ = step_snapshot(data, T, args.min_med_value, args.min_history)
        # selection requires a known outcome (exit bar) — applies identically
        # to every model incl. the baseline, and is disclosed in the report.
        univ = univ[univ["fwd_ret"].notna()]
        eligible_sizes.append(len(univ))
        if len(univ) == 0:
            for name in registry:
                period_returns[name].append(0.0)
                cash_periods[name] += 1
            print(f"  [{si+1}/{n_steps}] {T}  eligible=0 -> cash period")
            continue
        Xtr_df = train_slice(data, T, args.train_cap)
        Xun = univ[FEATURE_COLS].astype(np.float32)
        fwd = univ["fwd_ret"].to_numpy(dtype=np.float64)
        if len(Xtr_df) < 5_000:
            # not enough purged history yet — stay in cash (honest)
            for name in registry:
                period_returns[name].append(0.0)
                cash_periods[name] += 1
            print(f"  [{si+1}/{n_steps}] {T}  train={len(Xtr_df):,} (<5k) -> cash period")
            continue
        Xtr = Xtr_df[FEATURE_COLS].astype(np.float32)
        ytr = Xtr_df["fwd_ret"].astype(np.float64)

        picks_by_model = {}
        for name, spec in registry.items():
            scores = model_scores(spec, Xtr, ytr, Xun)
            ok = np.isfinite(scores)
            if ok.sum() == 0:
                picks_by_model[name] = np.array([], dtype=int)
                continue
            idx = np.flatnonzero(ok)
            order = idx[np.argsort(-scores[idx], kind="stable")][:args.top_n]
            picks_by_model[name] = order

        for name in registry:
            order = picks_by_model[name]
            if len(order) == 0:
                period_returns[name].append(0.0)
                cash_periods[name] += 1
                continue
            r = fwd[order] - args.cost  # per-position net return
            period_returns[name].append(float(np.mean(r)))
            pos_returns[name].extend(r.tolist())
        if args.trace:
            print(f"  [{si+1}/{n_steps}] {T}  eligible={len(univ)} train={len(Xtr_df):,} "
                  f"picks={ {n: len(p) for n, p in picks_by_model.items()} }  ({time.time()-t0:.1f}s)")
        elif (si - start_i + 1) % 10 == 0 or si == start_i:
            print(f"  [{si+1}/{n_steps}] {T}  eligible={len(univ)} train={len(Xtr_df):,} "
                  f"({time.time()-t0:.1f}s/step)")

        if persist is not None:
            persist({
                "next_i": si + 1,
                "period_returns": period_returns,
                "pos_returns": pos_returns,
                "cash_periods": cash_periods,
                "eligible_sizes": eligible_sizes,
                "elapsed_s": time.time() - t_run,
            })
        if getattr(args, "max_seconds", 0) and (time.time() - t_run) > args.max_seconds \
                and si + 1 < n_steps:
            print(f"Time budget ({args.max_seconds}s) reached at step {si+1}/{n_steps} — "
                  f"checkpoint saved; re-run the same command (or --resume) to continue.")
            completed = False
            break

    # ---- metrics from a real compounded equity curve -------------------------
    results = {}
    years_per_period = STEP_DAYS / 252.0
    for name in registry:
        pr = np.array(period_returns[name], dtype=float)
        pr_pos = pr[pr != 0.0]  # informational: periods actually invested
        posr = np.array(pos_returns[name], dtype=float)
        if len(pr) == 0 or len(posr) < 5:
            results[name] = {"status": "insufficient_data", "n_periods": int(len(pr)),
                             "n_positions": int(len(posr))}
            continue
        eq = np.cumprod(1.0 + pr)
        years = len(pr) * years_per_period
        cagr = (eq[-1] ** (1.0 / years) - 1.0) * 100 if years > 0 and eq[-1] > 0 else -100.0
        dd = float((eq / np.maximum.accumulate(eq) - 1.0).min()) * 100
        sharpe = float(pr.mean() / pr.std() * np.sqrt(252.0 / STEP_DAYS)) if pr.std() > 0 else 0.0
        wins, losses = posr[posr > 0], posr[posr <= 0]
        gp, gl = float(wins.sum()), float(-losses.sum())
        results[name] = {
            "status": "measured",
            "role": registry[name].role,
            "note": registry[name].note,
            "profit_factor": round(gp / gl, 3) if gl > 0 else (999.0 if gp > 0 else 0.0),
            "expectancy_pct": round(float(posr.mean()) * 100, 3),
            "cagr_pct": round(float(cagr), 2),
            "sharpe": round(sharpe, 2),
            "max_drawdown_pct": round(dd, 1),
            "position_win_rate_pct": round(float((posr > 0).mean()) * 100, 2),
            "avg_win_pct": round(float(wins.mean()) * 100, 3) if len(wins) else 0.0,
            "avg_loss_pct": round(float(losses.mean()) * 100, 3) if len(losses) else 0.0,
            "total_return_pct": round(float(eq[-1] - 1) * 100, 1),
            "n_positions": int(len(posr)),
            "n_periods": int(len(pr)),
            "periods_in_cash": int(cash_periods[name]),
        }
    trace = {
        "eligible_sizes": eligible_sizes,
        "step_dates": [str(all_dates[k]) for k in step_idx],
        "period_returns": {k: v for k, v in period_returns.items()},
        "picks": {},  # filled only by leak-test caller
    }
    return results, trace, bool(completed)


def args_signature(args) -> str:
    import hashlib
    fields = [str(args.db), str(args.start), str(args.end), str(args.max_stocks),
              str(args.top_n), str(args.cost), str(args.min_med_value),
              str(args.min_history), str(args.step_days), str(args.train_cap),
              str(bool(args.lean))]
    return hashlib.sha256("|".join(fields).encode()).hexdigest()[:16]


def build_report(results: dict, data: pd.DataFrame, args, trace: dict) -> dict:
    registry = build_registry(args.lean)
    measured = {k: v for k, v in results.items() if v.get("status") == "measured"}
    ranking = sorted(measured, key=lambda k: measured[k]["profit_factor"], reverse=True)
    elig = np.array(trace["eligible_sizes"])
    med = data.groupby("symbol")["tv"].median()
    report = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "generated_by": "scripts/backtest_all_models.py",
        "source_of_truth": True,
        "methodology": {
            "walk_forward_purged": "every model retrained at each step date only on rows "
                                   "whose full 21-day label window ended before that date",
            "entry_exit": "signal at close t, entry at open t+1, exit at open t+1+21",
            "universe": "point-in-time: trailing-60d median traded value >= PKR 20m, "
                        ">= 400 bars history, evaluated at each step date",
            "portfolio_rule": f"top-{args.top_n} scores, equal weight, non-overlapping "
                              f"{STEP_DAYS}-day periods, {args.cost*100:.1f}% round-trip cost per position",
            "metrics": "CAGR/Sharpe/MaxDD from a compounded equity curve of non-overlapping "
                       "period returns; Sharpe annualised with sqrt(252/21)",
        },
        "assumptions": {
            "horizon_days": HORIZON, "step_days": STEP_DAYS, "top_n": args.top_n,
            "round_trip_cost_pct": args.cost * 100,
            "min_median_traded_value_pkr": args.min_med_value,
            "min_history_bars": args.min_history,
            "start": args.start or DEFAULT_START, "end": args.end,
            "symbol_cap": args.max_stocks if args.max_stocks > 0 else "all (point-in-time eligibility applies)",
            "train_row_cap": args.train_cap or None,
            "lean_hyperparams": bool(args.lean),
            "seed": SEED,
        },
        "data": {
            "source": "db/custom.db (OhlcvBar)",
            "rows": int(len(data)), "symbols": int(data["symbol"].nunique()),
            "date_min": str(data["date"].min()), "date_max": str(data["date"].max()),
        },
        "universe": {
            "n_steps": len(trace["step_dates"]),
            "first_step": trace["step_dates"][0] if trace["step_dates"] else None,
            "last_step": trace["step_dates"][-1] if trace["step_dates"] else None,
            "eligible_min": int(elig.min()) if len(elig) else 0,
            "eligible_median": int(np.median(elig)) if len(elig) else 0,
            "eligible_max": int(elig.max()) if len(elig) else 0,
            "symbols_ever_eligible": int((med >= args.min_med_value).sum()),
        },
        "results": results,
        "ranking": ranking,
        "registry": {k: {"kind": s.kind, "role": s.role, "note": s.note}
                     for k, s in registry.items()},
        "notes": [
            "Positions whose 21-day outcome is unknown (row too close to dataset end) "
            "are excluded from selection for ALL models equally, including the baseline.",
            "train_row_cap keeps only the most recent rows per step when training history "
            "exceeds the cap — a disclosed speed knob, identical across models.",
            "Selection uses each symbol's own trading calendar: entry is the next "
            "available open after the step date.",
        ],
    }
    return report


# ----------------------------------------------------------------------------
# Leak test — acceptance criterion (a)
# ----------------------------------------------------------------------------
def leak_test(args) -> int:
    """Steps inside a window must be identical whether or not later data exists.

    Runs steps in [start, cutoff] on (A) the full dataset and (B) the dataset
    truncated after cutoff+60d. If any training row dated after a step could
    influence that step, (B) would differ from (A).
    """
    cutoff = args.leak_cutoff or "2022-12-31"
    trunc = (pd.Timestamp(cutoff) + pd.Timedelta(days=60)).strftime("%Y-%m-%d")
    common = dict(max_stocks=args.max_stocks or 60, start=args.start or "2022-01-01",
                  end=cutoff, train_cap=args.train_cap or CI_TRAIN_CAP, lean=True)
    print(f"LEAK TEST: window {common['start']}..{cutoff}, truncation at {trunc}, "
          f"max_stocks={common['max_stocks']}")
    a_args = argparse.Namespace(**{**vars(args), **common, "trace": False, "lean": True})
    data_a = add_features(load_prices(Path(args.db), common["max_stocks"], None))
    res_a, trace_a, _ = run_backtest(data_a, a_args)
    data_b = add_features(load_prices(Path(args.db), common["max_stocks"], trunc))
    res_b, trace_b, _ = run_backtest(data_b, a_args)

    ok = True
    for name in trace_a["period_returns"]:
        ra, rb = trace_a["period_returns"][name], trace_b["period_returns"][name]
        if len(ra) != len(rb):
            print(f"  FAIL {name}: {len(ra)} vs {len(rb)} periods"); ok = False; continue
        for i, (x, y) in enumerate(zip(ra, rb)):
            if abs(x - y) > 1e-9:
                print(f"  FAIL {name} step {i}: {x:.6f} vs {y:.6f}"); ok = False
    for name in res_a:
        pa, pb = res_a[name].get("profit_factor"), res_b[name].get("profit_factor")
        if pa != pb:
            print(f"  FAIL {name}: PF {pa} vs {pb}"); ok = False
    print("LEAK TEST:", "PASS — changing/dropping training rows dated after a step "
          "does not change any step's scores" if ok else "FAIL — LOOKAHEAD LEAK DETECTED")
    return 0 if ok else 1


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def parse_args(argv=None):
    ap = argparse.ArgumentParser(description="Walk-forward backtest of the full model registry")
    ap.add_argument("--db", default=os.environ.get("LATENT_DB", str(ROOT / "db" / "custom.db")))
    ap.add_argument("--out", default=os.environ.get("LATENT_OUT", str(ROOT / "data" / "backtest_report.json")))
    ap.add_argument("--start", default=DEFAULT_START, help="first step date (YYYY-MM-DD)")
    ap.add_argument("--end", default=None, help="last step date (YYYY-MM-DD)")
    ap.add_argument("--max-stocks", type=int, default=0, help="keep only K most-liquid symbols (0 = all)")
    ap.add_argument("--top-n", type=int, default=TOP_N)
    ap.add_argument("--cost", type=float, default=ROUND_TRIP_COST)
    ap.add_argument("--min-med-value", type=float, default=MIN_MED_VALUE)
    ap.add_argument("--min-history", type=int, default=MIN_HISTORY)
    ap.add_argument("--step-days", type=int, default=STEP_DAYS)
    ap.add_argument("--train-cap", type=int, default=DEFAULT_TRAIN_CAP,
                    help="most-recent-row training cap per step (0 = no cap)")
    ap.add_argument("--ci", action="store_true",
                    help="CI smoke mode: --max-stocks 200 --start 2022-01-01, lean params, small train cap")
    ap.add_argument("--lean", action="store_true", help="force lean hyper-parameters")
    ap.add_argument("--leak-test", action="store_true", help="run the purge/lookahead acceptance test")
    ap.add_argument("--leak-cutoff", default="2022-12-31")
    ap.add_argument("--trace", action="store_true", help="print every step")
    ap.add_argument("--max-seconds", type=int, default=0,
                    help="stop after N seconds, saving a checkpoint (0 = no budget)")
    ap.add_argument("--resume", action="store_true",
                    help="resume from the checkpoint saved by a --max-seconds run")
    ap.add_argument("--fresh", action="store_true", help="ignore and overwrite any existing checkpoint")
    ap.add_argument("--state", default=str(ROOT / "data" / ".backtest_state.json"))
    args = ap.parse_args(argv)
    if args.ci:
        args.max_stocks = args.max_stocks or 200
        args.start = "2022-01-01"
        args.train_cap = CI_TRAIN_CAP
        args.lean = True
        os.environ["LATENT_LEAN"] = "1"
    elif args.lean:
        os.environ["LATENT_LEAN"] = "1"
    return args


def main(argv=None) -> int:
    args = parse_args(argv)
    if args.step_days != STEP_DAYS:
        print(f"NOTE: --step-days {args.step_days} changes period spacing; "
              f"canonical methodology uses {STEP_DAYS}.")
    t0 = time.time()
    if args.leak_test:
        return leak_test(args)

    # ── checkpoint / resume -------------------------------------------------
    state_path = Path(args.state)
    sig = args_signature(args)
    state = None
    if state_path.exists() and not args.fresh:
        try:
            saved = json.loads(state_path.read_text())
            if saved.get("signature") == sig:
                state = saved
                print(f"Found matching checkpoint ({saved.get('next_i')} steps done) — "
                      f"resuming. Use --fresh to restart.")
            else:
                print("Checkpoint exists but was produced with different arguments — "
                      "ignoring it (use --fresh to discard).")
        except Exception:
            state = None

    data = load_prices(Path(args.db), args.max_stocks, None)
    print(f"Loaded {len(data):,} rows for {data['symbol'].nunique()} symbols "
          f"({data['date'].min()}..{data['date'].max()}) in {time.time()-t0:.0f}s")
    t0 = time.time()
    data = add_features(data)
    print(f"Features computed in {time.time()-t0:.0f}s")

    last_next_i = int(state["next_i"]) if state else 0

    def persist(s: dict) -> None:
        nonlocal last_next_i
        last_next_i = int(s["next_i"])
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps({**s, "signature": sig}))

    results, trace, completed = run_backtest(data, args, state=state, persist=persist)

    if not completed:
        print(f"\nPARTIAL RUN — {last_next_i} of {len(trace['step_dates'])} steps done. "
              f"Checkpoint saved to {state_path}. "
              f"Re-run the same command to continue; the report is only written "
              f"when ALL steps are complete.")
        return 0

    # complete run → remove the checkpoint
    if state_path.exists():
        state_path.unlink()
    report = build_report(results, data, args, trace)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(f"\n{'='*80}\nRANKING (sorted by profit factor) — written to {out}\n{'='*80}")
    print(rank_table(results))
    print(f"\nTotal wall time: {(time.time()-t0)/60:.1f} min")
    return 0


if __name__ == "__main__":
    sys.exit(main())
