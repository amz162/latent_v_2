#!/usr/bin/env python3
"""Task 100 — shared library: bounded, resumable, leakage-free experiment machinery.

Reuses the Task 54 walk-forward engine (scripts/walk_forward_backtesting.py) via
import: same data loading, same 19-feature schema, same per-horizon target
maturity purge, same chronological split boundaries. NEVER re-implements the
target/leakage logic — it calls the same functions.

Task 100 additions (all bounded, all versioned under data/backtest_reports/task100/):
  - EXTENDED_MODELS: ExtraTrees / HistGradientBoosting / ElasticNet / HuberRegressor
    trained with build_model(); the 5 original models delegate to
    wf.train_one_model so their hyperparameters are bit-identical to history.
  - Bounded walk-forward runner with JSONL sample records + resume
    (run_bounded_walkforward / resume_bounded_walkforward).
  - Date-block moving-block bootstrap (dependence-aware uncertainty for
    overlapping 5d/10d/21d forward-return windows).
  - Feature groups for ablation, target builders (classification/quantile/vol).
  - Progress tracking under task100_progress.json.

All commands must finish within 150s (sandbox limit): the runner chunks work.
"""
from __future__ import annotations
import json, os, sys, time, hashlib, warnings
from pathlib import Path
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
ROOT = Path("/home/z/my-project")
sys.path.insert(0, str(ROOT / "scripts"))

import walk_forward_backtesting as wf  # noqa: E402  (Task 54 engine — DO NOT MODIFY)
from ml_integrity import (  # noqa: E402
    add_forward_returns, add_target_maturity_dates, filter_by_target_maturity,
    chronological_split, HORIZONS, MAX_HORIZON,
)

BASE = ROOT / "data/backtest_reports/task100"
RUNS = BASE / "runs"
BATCH_LOGS = BASE / "batch_logs"
CHECKPOINTS = BASE / "checkpoints"
MODELS_DIR = BASE / "models"
PREDICTIONS_DIR = BASE / "predictions"
EXPERIMENTS_DIR = BASE / "experiments"
PROGRESS_FILE = BASE / "task100_progress.json"
PLAN_FILE = BASE / "task100_execution_plan.json"

# ── feature groups (subset indices of wf.FC, the 19-feature schema) ──────────
FC = list(wf.FC)
GROUPS = {
    "all_19": FC,
    "price_momentum": ["return_1d", "return_7d", "return_14d", "return_30d",
                        "price_sma_20_ratio", "price_sma_50_ratio", "price_sma_200_ratio",
                        "volatility_14d", "hl_range_pct", "body_size_pct"],
    "technical": ["rsi_14", "macd", "macd_signal", "macd_hist",
                   "bb_width", "bb_pct_b", "atr_14"],
    "volume_liquidity": ["obv_change_pct", "volume_sma_20_ratio"],
}

EXTENDED_MODELS = ["ExtraTrees", "HistGradientBoosting", "ElasticNet", "HuberRegressor"]
ORIGINAL_MODELS = list(wf.MODEL_NAMES)
COMPARISON_MODELS = ORIGINAL_MODELS + EXTENDED_MODELS

# Task 100 bounded-run model configs (recorded in every manifest):
#  - Random Forest uses n_jobs=2 (this sandbox has 2 CPUs; n_jobs does not
#    change seeded results, only wall time) and n_estimators=40 instead of the
#    historical 100 ("rf_lean") so bounded expanding-window cohorts fit the
#    150s command limit. Historical RF evidence stays in the Task 54-99
#    artifacts and is never mixed with bounded-cohort numbers.
#  - HuberRegressor is NEW in Task 100 (no historical benchmark): bounded
#    max_iter for the same reason.
RF_LEAN_ESTIMATORS = 40
HUBER_MAX_ITER = 100


def fit_model(name: str, Xtr: np.ndarray, ytr: np.ndarray):
    """Train one model. The 5 original models keep the historical
    hyperparameters (delegating to wf.train_one_model, which uses the
    historical 100-tree RF config); task100_* suffixed names are the bounded
    lean variants used in expanding-window cohorts."""
    if name in ORIGINAL_MODELS:
        return wf.train_one_model(name, Xtr, ytr)
    if name == "ExtraTrees":
        from sklearn.ensemble import ExtraTreesRegressor
        m = ExtraTreesRegressor(n_estimators=150, max_depth=6, min_samples_leaf=15,
                                max_features=0.7, random_state=42, n_jobs=2)
    elif name == "HistGradientBoosting":
        from sklearn.ensemble import HistGradientBoostingRegressor
        m = HistGradientBoostingRegressor(max_iter=150, max_depth=3, learning_rate=0.05,
                                          min_samples_leaf=20, l2_regularization=1.0,
                                          random_state=42)
    elif name == "ElasticNet":
        from sklearn.linear_model import ElasticNet
        m = ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42, max_iter=5000)
    elif name == "HuberRegressor":
        from sklearn.linear_model import HuberRegressor
        m = HuberRegressor(epsilon=1.35, alpha=0.01, max_iter=HUBER_MAX_ITER, tol=1e-3)
    elif name == "task100_rf_lean":
        from sklearn.ensemble import RandomForestRegressor
        m = RandomForestRegressor(n_estimators=RF_LEAN_ESTIMATORS, max_depth=5,
                                  min_samples_leaf=15, max_features=0.7,
                                  random_state=42, n_jobs=2)
    elif name == "LightGBM_quantile_q10":
        m = lgb_quantile(0.10)
    elif name == "LightGBM_quantile_q50":
        m = lgb_quantile(0.50)
    elif name == "LightGBM_quantile_q90":
        m = lgb_quantile(0.90)
    elif name == "LightGBM_classifier":
        import lightgbm as lgb
        m = lgb.LGBMClassifier(n_estimators=100, num_leaves=15, learning_rate=0.05,
                               min_child_samples=20, reg_alpha=0.5, reg_lambda=2.0,
                               random_state=42, verbose=-1)
    else:
        raise ValueError(f"unknown model {name}")
    m.fit(Xtr, ytr)
    return m


def lgb_quantile(q: float):
    import lightgbm as lgb
    return lgb.LGBMRegressor(objective="quantile", alpha=q, n_estimators=100,
                             num_leaves=15, learning_rate=0.05, min_child_samples=20,
                             reg_alpha=0.5, reg_lambda=2.0, random_state=42, verbose=-1)


def load_dataset(symbols: list[str] | None = None) -> pd.DataFrame:
    """Same loader as the historical benchmark (DB source, pilot25 symbols)."""
    return wf.load(stocks=symbols, source="db")


def resolve_pilot25() -> tuple[list[str], dict]:
    """Point-in-time pilot25 universe — the SAME selection as the original run."""
    syms, meta = wf.resolve_universe("pilot25")
    return syms, meta


def split_and_samples(df: pd.DataFrame, eval_stocks: list[str], sample_step: int,
                      max_samples: int | None):
    """Chronological split (50/15/35 + 21-session purge — identical boundaries to
    the historical run) → sample list from the TEST partition. Returns the LAST
    max_samples samples (latest dates) when bounded, with coverage recorded."""
    _tr, _va, te = wf.chronological_split(df, train_frac=0.50, val_frac=0.15, purge_h=MAX_HORIZON)
    all_samples = wf.build_sample_list(te, eval_stocks, sample_step)
    total = len(all_samples)
    if max_samples is not None and total > max_samples:
        samples = all_samples[-max_samples:]  # latest decision dates
        bounded = True
    else:
        samples = all_samples
        bounded = False
    # re-index the bounded slice deterministically
    for i, s in enumerate(samples):
        s["sample_idx"] = i
    test_window = {"start_epoch": int(te["date"].min()), "end_epoch": int(te["date"].max())}
    return samples, total, bounded, test_window


def run_id_for(tag: str) -> str:
    return f"task100_{tag}"


def records_path(tag: str) -> Path:
    return RUNS / run_id_for(tag) / "samples.jsonl"


def manifest_path(tag: str) -> Path:
    return RUNS / run_id_for(tag) / "manifest.json"


def process_sample_ext(idx, sample, df, model_names, fc=None, y_builder=None):
    """Task 100 extension of wf.process_sample: same protocol (pooled expanding
    window, per-horizon target-maturity filter, train>=50 rows gate), but takes
    an explicit model list + feature subset, and records predictions per model
    per horizon for downstream calibration/ensemble/strategy phases."""
    fc = fc or FC
    rec = {
        "sample_idx": idx,
        "sample_id": sample["sample_id"],
        "stock": sample["stock"],
        "date": int(sample["date"]),
        "close": float(sample["close"]),
        "actual_5d": float(sample["actual_5d"]),
        "actual_10d": float(sample["actual_10d"]),
        "actual_21d": float(sample["actual_21d"]),
        "status": "evaluated",
        "preds": {},
    }
    train_data = df[df["date"] < sample["date"]]
    if len(train_data) < 100:
        rec["status"] = "skipped"
        rec["skip_reason"] = f"insufficient pooled training rows ({len(train_data)} < 100)"
        return rec
    y_map = y_builder(train_data) if y_builder else None
    for name in model_names:
        entry = {"n_fits": 0, "horizon_preds": {}}
        try:
            for hz in (5, 10, 21):
                td = filter_by_target_maturity(train_data, sample["date"], horizon=hz)
                if len(td) < 50:
                    pred = 0.0
                    entry["horizon_preds"][str(hz)] = {"predicted": 0.0, "eval_skipped": True}
                    continue
                if y_map is not None:
                    Xtr, ytr, Xs = y_map(name, hz, td, fc, sample)
                else:
                    Xtr = td[fc].values.astype(np.float64)
                    ytr = td[f"target_{hz}d"].values.astype(np.float64)
                    Xs = sample["features"][[wf.FC.index(c) for c in fc]].reshape(1, -1) \
                        if fc != list(wf.FC) else sample["features"].reshape(1, -1)
                m = fit_model(name, Xtr, ytr)
                pred = float(m.predict(Xs)[0])
                entry["n_fits"] += 1
                entry["horizon_preds"][str(hz)] = {"predicted": float(pred), "eval_skipped": False}
        except Exception as e:
            entry["error"] = str(e)[:200]
        rec["preds"][name] = entry
    return rec


def run_bounded_walkforward(tag, model_names, sample_step=10, max_samples=100,
                            budget_seconds=130, fc=None, y_builder=None,
                            universe_symbols=None, df=None, log=True):
    """Resumable bounded walk-forward. Appends per-sample records to
    runs/task100_<tag>/samples.jsonl; resumes by skipping sample_ids already
    present. Stops when budget is exhausted or samples are done. Returns
    (records, manifest)."""
    run_dir = RUNS / run_id_for(tag)
    run_dir.mkdir(parents=True, exist_ok=True)
    rp = run_dir / "samples.jsonl"
    done = set()
    if rp.exists():
        for line in rp.read_text().splitlines():
            if line.strip():
                done.add(json.loads(line)["sample_id"])
    if df is None:
        df = load_dataset(universe_symbols)
    samples, total, bounded, test_window = split_and_samples(
        df, universe_symbols, sample_step, max_samples)
    manifest = {
        "run_id": run_id_for(tag), "tag": tag, "model_names": model_names,
        "feature_schema": list(fc or FC), "sample_step": sample_step,
        "max_samples": max_samples, "universe_symbols": universe_symbols,
        "test_window": test_window, "total_test_samples": total,
        "bounded": bounded, "horizons": [5, 10, 21],
        "data_fingerprint": wf.compute_data_fingerprint(df),
        "protocol": "chronological 50/15/35 split + 21-session purge; pooled expanding window; "
                    "per-horizon target-maturity filter; train>=50 rows gate",
    }
    manifest_path(tag).write_text(json.dumps(manifest, indent=2, default=_jd))
    t0 = time.time()
    n_new = 0
    for s in samples:
        if s["sample_id"] in done:
            continue
        if time.time() - t0 > budget_seconds:
            break
        rec = process_sample_ext(s["sample_idx"], s, df, model_names, fc=fc, y_builder=y_builder)
        with open(rp, "a") as f:
            f.write(json.dumps(rec, default=_jd) + "\n")
        n_new += 1
    elapsed = round(time.time() - t0, 1)
    records = load_records(tag)
    if log:
        print(f"[{tag}] new={n_new} total={len(records)}/{len(samples)} elapsed={elapsed}s")
    return records, {**manifest, "elapsed_seconds_last_chunk": elapsed}


def load_records(tag) -> list[dict]:
    rp = records_path(tag)
    if not rp.exists():
        return []
    out = []
    for line in rp.read_text().splitlines():
        if line.strip():
            out.append(json.loads(line))
    out.sort(key=lambda r: r["sample_idx"])
    return out


def _jd(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, float) and np.isnan(o):
        return None
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)


def write_artifact(name: str, obj) -> Path:
    p = BASE / name
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, default=_jd))
    tmp.replace(p)
    return p


def update_progress(phase: str, status: str, detail: str = "", artifact: str | None = None):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    prog = {}
    if PROGRESS_FILE.exists():
        try:
            prog = json.loads(PROGRESS_FILE.read_text())
        except Exception:
            prog = {}
    prog.setdefault("phases", {})
    prog["phases"][phase] = {
        "status": status, "detail": detail[:400],
        "artifact": artifact, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime()),
    }
    prog["last_phase"] = phase
    tmp = PROGRESS_FILE.with_name("tmp.json")
    tmp.write_text(json.dumps(prog, indent=2, default=_jd))
    tmp.replace(PROGRESS_FILE)


def moving_block_bootstrap_ci(dates: np.ndarray, errors: np.ndarray, block_days: int = 21,
                              n_boot: int = 200, seed: int = 42) -> dict:
    """Dependence-aware CI for overlapping-horizon samples: moving-block
    bootstrap over UNIQUE decision dates (all samples sharing a date move
    together, preserving market-wide common-date movements; block length
    >= horizon overlaps serial dependence). Returns percentile CIs for
    mean |error| and directional accuracy if correct flags given."""
    rng = np.random.default_rng(seed)
    ud = np.unique(dates)
    if len(ud) < 4:
        return {"mae_point": round(float(np.mean(np.abs(errors))), 6), "mae_ci95": None,
                "n_boot": 0, "block_days": None, "unique_dates": int(len(ud)),
                "n_samples": int(len(dates)),
                "reason": f"only {len(ud)} unique decision dates — too few for a "
                          "dependence-aware bootstrap; interval withheld rather than faked"}
    block = min(block_days, max(2, len(ud) // 3))
    date_to_rows = {d: np.where(dates == d)[0] for d in ud}
    n_blocks = max(1, len(ud) // block)
    maes_boot = []
    for _ in range(n_boot):
        starts = rng.integers(0, len(ud) - block + 1, size=n_blocks)
        rows = np.concatenate([date_to_rows[ud[s + i]]
                               for s in starts for i in range(block)])
        maes_boot.append(float(np.mean(np.abs(errors[rows]))))
    lo, hi = np.percentile(maes_boot, [2.5, 97.5])
    point = float(np.mean(np.abs(errors)))
    return {"mae_point": round(point, 6), "mae_ci95": [round(lo, 6), round(hi, 6)],
            "n_boot": n_boot, "block_days": int(block), "unique_dates": int(len(ud)),
            "n_samples": int(len(dates))}


def metrics_block(dates, y_true, y_pred) -> dict:
    """MAE/RMSE/R2/directional accuracy + dependence-aware CI (date-block bootstrap)."""
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    ok = np.isfinite(y_true) & np.isfinite(y_pred)
    y_true, y_pred, dates = y_true[ok], y_pred[ok], np.asarray(dates)[ok]
    n = len(y_true)
    if n == 0:
        return {"n": 0}
    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else None
    da = float(np.mean(np.sign(y_pred) == np.sign(y_true)))
    boot = moving_block_bootstrap_ci(dates, y_true - y_pred)
    return {"n": int(n), "mae": round(mae, 6), "rmse": round(rmse, 6),
            "r2": None if r2 is None else round(r2, 6),
            "directional_accuracy": round(da, 4), **boot}


def classify_targets(y: np.ndarray, neutral_band: float) -> np.ndarray:
    """3-class target: +1 up (y > band), -1 down (y < -band), 0 neutral.
    Band must be chosen on TRAINING/VALIDATION data only (caller's duty)."""
    return np.where(y > neutral_band, 1, np.where(y < -neutral_band, -1, 0))


def choose_neutral_band(y_train: np.ndarray, target_neutral_frac: float = 0.34) -> float:
    """Pick the band so ~target_neutral_frac of TRAINING targets fall inside
    the neutral zone (never touches final-test data)."""
    ay = np.abs(y_train)
    return float(np.quantile(ay, target_neutral_frac))


def summarize_strategy_rows(rows: list[dict]) -> dict:
    """Standard strategy summary — mirrors scripts/task99_backtest.ts summarize()
    semantics (completed = skipped==false && exitReason set; win = netPnl > 0)."""
    completed = [r for r in rows if r.get("skipped") is False and r.get("exitReason")]
    n = len(completed)
    if n == 0:
        return {"nCompleted": 0}
    wins = [r for r in completed if r["netPnl"] > 0]
    losses = [r for r in completed if r["netPnl"] <= 0]
    gross = sum(r["grossPnl"] for r in completed)
    net = sum(r["netPnl"] for r in completed)
    cost = sum(r.get("totalCost", r["grossPnl"] - r["netPnl"]) for r in completed)
    gp = sum(max(0.0, r["grossPnl"]) for r in completed)
    gl = sum(max(0.0, -r["grossPnl"]) for r in completed)
    npf = sum(max(0.0, r["netPnl"]) for r in completed)
    nl = sum(max(0.0, -r["netPnl"]) for r in completed)
    peak = cum = 0.0
    maxdd = 0.0
    for r in sorted(completed, key=lambda r: r["entryDate"]):
        cum += r["netPnl"]
        peak = max(peak, cum)
        maxdd = min(maxdd, cum - peak)
    return {
        "nCandidates": len(rows), "nCompleted": n,
        "nSkipped": len(rows) - n,
        "nWinning": len(wins), "nLosing": len(losses),
        "winRate": round(100 * len(wins) / n, 2),
        "grossPnl": round(gross, 2), "netPnl": round(net, 2), "totalCost": round(cost, 2),
        "grossProfitFactor": round(gp / gl, 3) if gl > 0 else None,
        "netProfitFactor": round(npf / nl, 3) if nl > 0 else None,
        "avgWinNet": round(sum(r["netPnl"] for r in wins) / len(wins), 2) if wins else None,
        "avgLossNet": round(sum(r["netPnl"] for r in losses) / len(losses), 2) if losses else None,
        "expectancyNetPerTrade": round(net / n, 2),
        "maxDrawdown": round(maxdd, 2),
    }


# ═════════════════════════════════════════════════════════════════════════════
# Task 100 — frozen full-train-window OOS protocol (high-coverage comparison)
#
# Trains each model ONCE per horizon on the chronological TRAIN partition
# (50% + 21-session purge — identical boundaries to the historical run), then
# predicts every sample of the validation and final-test partitions. This is
# NOT expanding-window walk-forward; it is recorded as such everywhere. It is
# leakage-free (train-only fitting) and gives every model an identical, high-
# coverage cohort at trivial cost, complementing the bounded expanding-window
# runs. Used for: model comparison, feature ablation, target experiments,
# calibration, and OOF ensemble validation (validation predictions are genuine
# OOF for the frozen model).
# ═════════════════════════════════════════════════════════════════════════════

def frozen_predict(tag: str, model_names: list[str], df: pd.DataFrame,
                   eval_stocks: list[str], sample_step: int, fc=None,
                   y_kind: str = "return", neutral_band: float | None = None,
                   quantile_mode: bool = False, extra_target=None) -> dict:
    """Returns {model: {partition: {horizon: {sample_id: pred}}}} plus the
    actuals per sample. y_kind: 'return' (target_{h}d), 'classify3'
    (sign-banded classes), 'quantile' (q10/q50/q90 — quantile_mode), or a
    custom callable extra_target(train_df)->(yname, yvals_fn)."""
    fc = fc or list(wf.FC)
    _tr, _va, _te = wf.chronological_split(df, train_frac=0.50, val_frac=0.15, purge_h=MAX_HORIZON)
    va_samples = wf.build_sample_list(_va, eval_stocks, sample_step)
    te_samples = wf.build_sample_list(_te, eval_stocks, sample_step)
    out: dict = {"meta": {
        "protocol": "frozen full-train-window (no expanding retraining), chronological 50/15/35 + 21-session purge",
        "sample_step": sample_step, "universe": eval_stocks,
        "feature_schema": list(fc), "y_kind": y_kind,
        "val_samples": len(va_samples), "test_samples": len(te_samples),
        "neutral_band": neutral_band, "quantile_mode": quantile_mode,
    }}
    preds = {m: {"validation": {}, "final_test": {}} for m in model_names}
    actuals = {"validation": {}, "final_test": {}}
    for s in va_samples:
        for hz in (5, 10, 21):
            actuals["validation"].setdefault(str(hz), {})[s["sample_id"]] = float(s[f"actual_{hz}d"])
    for s in te_samples:
        for hz in (5, 10, 21):
            actuals["final_test"].setdefault(str(hz), {})[s["sample_id"]] = float(s[f"actual_{hz}d"])
    for name in model_names:
        for hz in (5, 10, 21):
            cutoff = int(_va["date"].min())  # train strictly before the validation window
            td = filter_by_target_maturity(_tr, cutoff, horizon=hz)
            td = td[td["date"] < cutoff]  # hard guard: nothing at/after validation window
            if len(td) < 50:
                continue
            Xtr = td[fc].values.astype(np.float64)
            Xva = np.stack([s["features"][[wf.FC.index(c) for c in fc]] for s in va_samples])
            Xte = np.stack([s["features"][[wf.FC.index(c) for c in fc]] for s in te_samples])
            if y_kind == "return":
                ytr = td[f"target_{hz}d"].values.astype(np.float64)
                m = fit_model(name, Xtr, ytr)
                preds[name]["validation"][str(hz)] = dict(
                    zip([s["sample_id"] for s in va_samples], m.predict(Xva).astype(float)))
                preds[name]["final_test"][str(hz)] = dict(
                    zip([s["sample_id"] for s in te_samples], m.predict(Xte).astype(float)))
            elif y_kind == "quantile":
                for q, qname in ((0.10, "q10"), (0.50, "q50"), (0.90, "q90")):
                    ytr = td[f"target_{hz}d"].values.astype(np.float64)
                    m = fit_model(f"LightGBM_quantile_{qname}", Xtr, ytr)
                    if qname not in preds[name]["validation"]:
                        preds[name]["validation"][qname] = {}
                        preds[name]["final_test"][qname] = {}
                    preds[name]["validation"][qname][str(hz)] = dict(
                        zip([s["sample_id"] for s in va_samples], m.predict(Xva).astype(float)))
                    preds[name]["final_test"][qname][str(hz)] = dict(
                        zip([s["sample_id"] for s in te_samples], m.predict(Xte).astype(float)))
            elif y_kind == "classify3":
                band = neutral_band if neutral_band is not None else choose_neutral_band(td[f"target_{hz}d"].values)
                ytr = classify_targets(td[f"target_{hz}d"].values, band)
                if len(np.unique(ytr)) < 2:
                    continue
                m = fit_model("LightGBM_classifier", Xtr, ytr)
                cls = list(m.classes_)
                proba_va = m.predict_proba(Xva)
                proba_te = m.predict_proba(Xte)
                preds[name]["validation"][str(hz)] = dict(zip(
                    [s["sample_id"] for s in va_samples],
                    [{str(c): float(p) for c, p in zip(cls, row)} for row in proba_va]))
                preds[name]["final_test"][str(hz)] = dict(zip(
                    [s["sample_id"] for s in te_samples],
                    [{str(c): float(p) for c, p in zip(cls, row)} for row in proba_te]))
                out["meta"].setdefault("bands", {})[str(hz)] = round(band, 6)
    out["predictions"] = preds
    out["actuals"] = actuals
    out["samples"] = {
        "validation": [{"sample_id": s["sample_id"], "stock": s["stock"], "date": s["date"],
                        "close": s["close"]} for s in va_samples],
        "final_test": [{"sample_id": s["sample_id"], "stock": s["stock"], "date": s["date"],
                        "close": s["close"]} for s in te_samples],
    }
    return out


def forward_volatility_target(df: pd.DataFrame, horizon: int = 21) -> pd.DataFrame:
    """Per-stock forward realized volatility: std of the horizon daily returns
    starting the next session (genuine future outcome, per-stock shift — no
    cross-stock leakage). Adds target_fwdvol_{h}d + target_maturity-like guard
    (last horizon rows are NaN and never used)."""
    out = df.copy().sort_values(["symbol", "date"]).reset_index(drop=True)
    r1 = out.groupby("symbol")["close"].pct_change()
    out["_r1"] = r1
    def _fwdstd(g: pd.DataFrame) -> pd.Series:
        return g["_r1"].shift(-1).rolling(horizon, min_periods=horizon).std().shift(-horizon + 1)
    out[f"target_fwdvol_{horizon}d"] = (
        out.groupby("symbol", group_keys=False).apply(_fwdstd, include_groups=False)
    )
    # rows whose forward window extends past the stock's last bar are already
    # NaN via the shift; drop helper
    return out.drop(columns=["_r1"])


def market_regime_by_date(df: pd.DataFrame) -> dict:
    """Regime label per decision date from pilot25 breadth — explicitly an
    equal-weight pilot25 statistic, NOT a KSE-100 index (none exists in the DB;
    synthetic index proxies are forbidden). Regime: the 21-session trailing
    equal-weight mean 5d-return of the universe, split into
    bear(<-2%) / flat / bull(>+2%) terciles of the trailing series."""
    px = df.sort_values(["symbol", "date"])
    r5 = px.groupby("symbol")["close"].pct_change(5)
    tmp = pd.DataFrame({"date": px["date"], "symbol": px["symbol"], "r5": r5})
    daily = tmp.groupby("date")["r5"].mean()
    trail = daily.rolling(21, min_periods=10).mean()
    q_lo, q_hi = trail.quantile(0.33), trail.quantile(0.67)
    regime = pd.Series(index=trail.index, data="flat", dtype=object)
    regime[trail < q_lo] = "bear"
    regime[trail > q_hi] = "bull"
    return {int(d): str(v) for d, v in regime.items()}, {
        "definition": "equal-weight pilot25 mean 5d return, 21-session trailing mean; "
                      "bear < 33rd pct < bull of the trailing series",
        "q_lo": round(float(q_lo), 6), "q_hi": round(float(q_hi), 6),
        "note": "pilot25 breadth statistic; NOT a KSE-100 index (no genuine index series in DB)",
    }
