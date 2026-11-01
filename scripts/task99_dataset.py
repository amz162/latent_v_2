#!/usr/bin/env python3
"""Task 99 — leakage-free pooled PSX dataset for the reference RNN-LSTM models.

Pipeline (all primitives from scripts/ml_integrity.py):
  1. Load real OhlcvBar history per symbol (no synthetic bars, no fills).
  2. Per-stock feature matrix via task99_features.build_features (39 columns,
     close/volume MAs distinct, market context excluded — documented).
  3. Pooled per-stock forward-return targets (5d/10d/21d; or 1d for the
     original-style reproduction experiment) — never crossing symbols.
  4. Chronological split dates (60/20/20) from ml_integrity.chronological_split.
  5. Feature selection (missing-ratio, variance, |corr|>0.95) computed on the
     TRAIN partition ONLY.
  6. StandardScaler fit on TRAIN partition ONLY (frozen for val/test).
  7. Per-stock 30-step sequences; STRICT per-partition maturity purge: train
     sequences whose 21-session target window crosses the train/val boundary
     are dropped (same at val/test boundary).

Outputs (under data/backtest_reports/task99/models/):
  dataset_<tag>.npz   — X/y per partition + symbol/date indexes
  dataset_<tag>.json  — split dates, kept features, scaler params, counts, hashes
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ml_integrity import (add_forward_returns, chronological_split,  # noqa: E402
                          fit_scaler_on_train)
from task99_features import (FEATURE_SCHEMA_VERSION, MARKET_CONTEXT_INCLUDED,  # noqa: E402
                             MARKET_CONTEXT_REASON, build_features)
from task99_jw_models import SEQ  # noqa: E402

CANONICAL8 = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL"]
PILOT25 = ["ANL", "BOP", "BYCO", "CNERGY", "ENGRO", "FCCL", "HASCOL", "HUBC",
           "HUMNL", "KEL", "LOTCHEM", "LUCK", "MEBL", "MLCF", "OGDC", "PAEL",
           "PIBTL", "PPL", "PRL", "PSO", "SYS", "TELE", "TRG", "UNITY", "WTL"]
UNIVERSES = {"canonical8": CANONICAL8, "pilot25": PILOT25}
DB_PATH = Path("db/custom.db")
OUT_DIR = Path("data/backtest_reports/task99/models")
MIN_BARS = 250
MAX_H = 21
SEED = 42


def load_bars(symbols: list[str]) -> dict[str, pd.DataFrame]:
    con = sqlite3.connect(DB_PATH)
    out = {}
    for sym in symbols:
        rows = con.execute(
            "SELECT date, open, high, low, close, volume FROM OhlcvBar "
            "WHERE symbol=? ORDER BY date ASC", (sym,)).fetchall()
        if len(rows) < MIN_BARS:
            out[sym] = pd.DataFrame()
            continue
        df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume"])
        df = df.dropna().drop_duplicates(subset="date", keep="last")
        out[sym] = df.reset_index(drop=True)
    con.close()
    return out


def select_features_train_only(train_feats: pd.DataFrame, all_feats: pd.DataFrame) -> tuple[list[str], dict]:
    """Training-fold-only feature selection (missing/variance/correlation).
    Returns (kept_columns, report)."""
    rep: dict = {"method": "train_only_missing>40pct_or_zero_var_or_corr>0.95", "dropped": {}}
    miss = train_feats.isna().mean()
    drop_miss = [c for c in train_feats.columns if miss[c] > 0.40]
    rep["dropped"]["missing_gt_40pct"] = drop_miss
    cols = [c for c in train_feats.columns if c not in drop_miss]
    var = train_feats[cols].var(skipna=True)
    drop_var = [c for c in cols if not np.isfinite(var.get(c, np.nan)) or var[c] < 1e-12]
    rep["dropped"]["zero_variance"] = drop_var
    cols = [c for c in cols if c not in drop_var]
    corr = train_feats[cols].corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape, dtype=bool), k=1))
    drop_corr = sorted({c for c in upper.columns for r in [upper[c].dropna()]
                        if (r > 0.95).any()})
    rep["dropped"]["corr_gt_095"] = drop_corr
    kept = [c for c in cols if c not in drop_corr]
    return kept, rep


def build_dataset(universe: str, horizons: list[int], tag: str | None = None) -> Path:
    rng = np.random.default_rng(SEED)
    symbols = UNIVERSES[universe]
    tag = tag or f"{universe}_h{'_'.join(map(str, horizons))}"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bars = load_bars(symbols)
    eligible: list[str] = []
    excluded: dict[str, str] = {}
    per_stock_rows: dict[str, pd.DataFrame] = {}
    for sym in symbols:
        df = bars.get(sym, pd.DataFrame())
        if df.empty or len(df) < MIN_BARS:
            excluded[sym] = f"insufficient history ({0 if df.empty else len(df)} bars < {MIN_BARS})"
            continue
        feats = build_features(df)
        sdf = df[["date", "close", "volume"]].copy()
        sdf = pd.concat([sdf, feats.reset_index(drop=True)], axis=1)
        sdf["symbol"] = sym
        per_stock_rows[sym] = sdf
        eligible.append(sym)
    if not eligible:
        raise SystemExit("no eligible symbols")
    pooled = pd.concat([per_stock_rows[s] for s in eligible], ignore_index=True)
    pooled = add_forward_returns(pooled, horizons=horizons)
    # rebuild per-stock frames so each carries its target columns
    per_stock_rows = {sym: g.reset_index(drop=True) for sym, g in pooled.groupby("symbol", sort=False)}
    tgt_cols = [f"target_{h}d" for h in horizons]
    feat_cols_all = [c for c in pooled.columns if c not in
                     {"date", "close", "volume", "symbol", *tgt_cols}]

    train, val, test = chronological_split(pooled, purge_h=MAX_H)
    train_end_date, val_end_date = val["date"].min(), test["date"].min()
    # last date per partition (for purge arithmetic)
    train_last, val_last = train["date"].max(), val["date"].max()

    kept, sel_rep = select_features_train_only(train[feat_cols_all], pooled[feat_cols_all])
    # fit the scaler on TRAIN rows whose features are ALL finite (indicator
    # warmup rows carry NaN and are excluded — never imputed/fabricated)
    tr_feats = train[kept].values.astype(np.float64)
    finite_mask = np.isfinite(tr_feats).all(axis=1)
    scaler = fit_scaler_on_train(tr_feats[finite_mask])

    def seq_for(sym: str, part: str) -> tuple[list, list, list, list]:
        sdf = per_stock_rows[sym]
        fv = scaler.transform(sdf[kept].values.astype(np.float64)).astype(np.float32)
        tgt = sdf[tgt_cols].values.astype(np.float64)
        dates = sdf["date"].values
        Xs, ys, ds, ss = [], [], [], []
        n = len(sdf)
        for i in range(0, n - SEQ):
            d_idx = i + SEQ
            row_t = tgt[d_idx]
            if not np.isfinite(row_t).all():
                continue
            if not np.isfinite(fv[i:d_idx]).all():
                continue  # warmup NaN window — skipped, never imputed
            d = dates[d_idx]
            if part == "train":
                if d > train_end_date:
                    continue
                # strict maturity purge: 21-session window must end before boundary
                pos = np.searchsorted(dates, train_end_date)
                if d_idx + max(horizons) > pos:
                    continue
                if d > train_last:
                    continue
            elif part == "val":
                if not (train_end_date < d <= val_end_date):
                    continue
                pos = np.searchsorted(dates, val_end_date)
                if d_idx + max(horizons) > pos:
                    continue
            else:  # test
                if d <= val_end_date:
                    continue
            Xs.append(fv[i:d_idx])
            ys.append(row_t)
            ds.append(str(d))
            ss.append(sym)
        return Xs, ys, ds, ss

    parts = {"train": [], "val": [], "test": []}
    for sym in eligible:
        for part in parts:
            Xs, ys, ds, ss = seq_for(sym, part)
            parts[part].append((np.array(Xs, np.float32) if Xs else np.zeros((0, SEQ, len(kept)), np.float32),
                                np.array(ys, np.float32) if ys else np.zeros((0, len(horizons)), np.float32),
                                ds, ss))
    Xtr = np.concatenate([p[0] for p in parts["train"]])
    ytr = np.concatenate([p[1] for p in parts["train"]])
    dtr_s = [x for p in parts["train"] for x in p[2]]
    str_s = [x for p in parts["train"] for x in p[3]]
    Xva = np.concatenate([p[0] for p in parts["val"]])
    yva = np.concatenate([p[1] for p in parts["val"]])
    dva_s = [x for p in parts["val"] for x in p[2]]
    sva_s = [x for p in parts["val"] for x in p[3]]
    Xte = np.concatenate([p[0] for p in parts["test"]])
    yte = np.concatenate([p[1] for p in parts["test"]])
    dte_s = [x for p in parts["test"] for x in p[2]]
    ste_s = [x for p in parts["test"] for x in p[3]]

    npz_path = OUT_DIR / f"dataset_{tag}.npz"
    np.savez_compressed(npz_path, Xtr=Xtr, ytr=ytr, Xva=Xva, yva=yva, Xte=Xte, yte=yte,
                        dtr=np.array(dtr_s), str_=np.array(str_s),
                        dva=np.array(dva_s), sva=np.array(sva_s),
                        dte=np.array(dte_s), ste=np.array(ste_s))
    scaler_params = {"mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist()}
    meta = {
        "tag": tag, "universe": universe, "symbols_eligible": eligible,
        "symbols_excluded": excluded, "min_bars": MIN_BARS,
        "horizons": horizons, "seq_len": SEQ,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "n_features": len(kept), "kept_features": kept,
        "feature_selection": sel_rep,
        "market_context_included": MARKET_CONTEXT_INCLUDED,
        "market_context_reason": MARKET_CONTEXT_REASON,
        "split_dates": {"train_end": str(train_end_date), "val_end": str(val_end_date),
                        "train_last": str(train_last), "val_last": str(val_last)},
        "purge_sessions": MAX_H, "scaler": "StandardScaler fit on TRAIN partition only",
        "scaler_params": scaler_params, "seed": SEED,
        "counts": {"train": int(len(ytr)), "val": int(len(yva)), "test": int(len(yte))},
        "date_ranges": {
            "train": [str(dtr_s[0]), str(dtr_s[-1])] if dtr_s else None,
            "val": [str(dva_s[0]), str(dva_s[-1])] if dva_s else None,
            "test": [str(dte_s[0]), str(dte_s[-1])] if dte_s else None},
        "no_symbol_boundary_crossing": True,
        "no_fabricated_bars": True,
    }
    meta_path = OUT_DIR / f"dataset_{tag}.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    print(f"dataset {tag}: train={len(ytr)} val={len(yva)} test={len(yte)} "
          f"features={len(kept)} eligible={len(eligible)} excluded={len(excluded)}")
    print(npz_path)
    return npz_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--universe", choices=list(UNIVERSES), default="pilot25")
    ap.add_argument("--horizons", default="5,10,21")
    ap.add_argument("--tag", default=None)
    a = ap.parse_args()
    build_dataset(a.universe, [int(x) for x in a.horizons.split(",")], a.tag)
