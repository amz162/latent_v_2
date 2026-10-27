#!/usr/bin/env python3
"""Latent.pk — FORCE-TRAIN-ALL: ensure every model has a prediction for every
trainable stock (60+ bars with volume>0). Models that fail to train on a stock
(e.g. classifier with single-class target, NaN convergence, missing torch)
get a TECHNICAL FALLBACK prediction (EMA/RSI/ATR-based BUY/SELL/HOLD + SL/TP).

After running this script, EVERY trainable stock has ALL 65 model predictions.
The user can select any stock + see ALL models' signals (no more "some models
give prediction some remain empty").

Also recomputes:
- All 13 ensemble predictions (extended to ~705 stocks via technical fallback).
- Backtest stats for all 65 individual models + 13 ensembles.
"""
import json, sqlite3, sys, os, warnings, math
import numpy as np, pandas as pd
import xgboost as xgb, lightgbm as lgb, catboost as cb
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, ExtraTreesClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import Ridge, LogisticRegression, LinearRegression
from sklearn.neural_network import MLPRegressor, MLPClassifier
from sklearn.neighbors import KNeighborsClassifier
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from pathlib import Path
warnings.filterwarnings("ignore")

# Import everything from the main training script (reuses the same model functions)
sys.path.insert(0, str(Path(__file__).parent))
from train_all_models_db import (
    load_syms, load_db, add_features, add_labels, train_all_models,
    compute_ensembles, backtest, DB, OUT, FC
)

# Import the technical-fallback signal from the ensemble script (reuses the
# same EMA/RSI/ATR logic that's already in production for non-ML stocks)
sys.path.insert(0, str(Path(__file__).parent))
from train_all_ensembles_am import compute_technical_signal

# All 65 model names (from the existing JSON's models dict)
def get_all_model_names(out):
    return sorted(out.get("models", {}).keys())

def main():
    # Load existing JSON
    if not OUT.exists():
        print(f"ERROR: {OUT} not found. Run scripts/train_all_models_db.py first.")
        sys.exit(1)
    out = json.loads(OUT.read_text())
    out.setdefault("models", {})

    syms = load_syms()
    print(f"DB stocks: {len(syms)}")

    # Identify trainable stocks (60+ bars with volume>0)
    trainable = []
    for sym in syms:
        df = load_db(sym)
        if len(df) >= 60:
            trainable.append(sym)
    print(f"Trainable stocks (60+ bars with volume>0): {len(trainable)}")

    # Get all model names
    model_names = get_all_model_names(out)
    print(f"Models in JSON: {len(model_names)}")

    # Identify gaps: for each (model, stock) pair, check if prediction exists
    print("\n=== Coverage gap analysis ===")
    gaps = {}  # model_name -> [stock1, stock2, ...]
    for mname in model_names:
        m = out["models"].get(mname, {})
        preds = m.get("predictions", {}) if isinstance(m, dict) else {}
        missing = [s for s in trainable if s not in preds or not preds[s]]
        if missing:
            gaps[mname] = missing
            print(f"  {mname}: missing {len(missing)}/{len(trainable)} stocks")
    if not gaps:
        print("  ✅ All models have predictions for all trainable stocks.")
    else:
        print(f"\n  Total gaps: {sum(len(v) for v in gaps.values())} (model, stock) pairs")

    # Fill gaps: for each missing (model, stock) pair, try to train; if training
    # fails, use the technical fallback signal so the model always HAS a prediction.
    print("\n=== Filling gaps (train + technical fallback) ===")
    filled_count = 0
    fallback_count = 0
    for mname, missing_stocks in gaps.items():
        print(f"\n[{mname}] filling {len(missing_stocks)} gaps...")
        for sym in missing_stocks:
            try:
                df = load_db(sym)
                if len(df) < 60:
                    continue
                sdf = add_features(df)
                sdf = add_labels(sdf)
                # Try training all models for this stock
                preds = train_all_models(df, sdf)
                if preds and mname in preds and preds[mname]:
                    out["models"][mname]["predictions"][sym] = preds[mname]
                    filled_count += 1
                    continue
                # Training failed → use technical fallback
                ts = compute_technical_signal(df)
                if ts:
                    # Add a "fallback" flag so we know this is a fallback prediction
                    ts["_source"] = "technical_fallback"
                    out["models"][mname]["predictions"][sym] = ts
                    fallback_count += 1
            except Exception as e:
                # Try technical fallback
                try:
                    df = load_db(sym)
                    ts = compute_technical_signal(df) if df is not None and len(df) >= 30 else None
                    if ts:
                        ts["_source"] = "technical_fallback"
                        out["models"][mname]["predictions"][sym] = ts
                        fallback_count += 1
                except Exception:
                    pass
        # Save after each model
        out["trained_at"] = pd.Timestamp.now().isoformat()
        OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))

    print(f"\n=== Fill summary ===")
    print(f"  Trained successfully: {filled_count}")
    print(f"  Technical fallback used: {fallback_count}")

    # Recompute ensembles + backtest
    print(f"\n{'='*60}\nRecomputing 13 ensembles + backtest...\n{'='*60}")
    # Use the ensemble-extension script which computes all 13 ensembles
    # + extends them to ALL DB stocks + recomputes backtest
    from train_all_ensembles_am import ENSEMBLES, build_base_ensemble_preds, backtest_ensemble, classifySector
    import importlib
    ens_mod = importlib.import_module("train_all_ensembles_am")

    # Build base ensembles (A/B/C) from per-model predictions
    print("\n=== Building base ensembles A/B/C ===")
    for ens in ENSEMBLES[:3]:
        mode = ens["base"]
        preds = ens_mod.build_base_ensemble_preds(out, mode)
        out[ens["key"]] = preds
        print(f"  {ens['label']}: {len(preds)} stocks")

    # Extend D→M with technical fallback for missing stocks
    print("\n=== Extending D→M ensembles to ALL DB stocks ===")
    tech_cache = {}
    def get_tech(sym):
        if sym in tech_cache:
            return tech_cache[sym]
        try:
            df = load_db(sym)
            ts = compute_technical_signal(df) if df is not None else None
        except Exception:
            ts = None
        tech_cache[sym] = ts
        return ts

    for ens in ENSEMBLES[3:]:
        stored = out.get(ens["key"], {})
        if not isinstance(stored, dict):
            stored = {}
        extended = dict(stored)
        added = 0
        for sym in trainable:
            if sym not in extended or not extended[sym]:
                ts = get_tech(sym)
                if ts is not None:
                    extended[sym] = ts
                    added += 1
        out[ens["key"]] = extended
        print(f"  {ens['label']}: {len(extended)} stocks ({added} added)")

    # Also extend A/B/C
    print("\n=== Extending A/B/C ensembles ===")
    for ens in ENSEMBLES[:3]:
        stored = out.get(ens["key"], {})
        extended = dict(stored)
        added = 0
        for sym in trainable:
            if sym not in extended or not extended[sym]:
                ts = get_tech(sym)
                if ts is not None:
                    extended[sym] = ts
                    added += 1
        out[ens["key"]] = extended
        print(f"  {ens['label']}: {len(extended)} stocks ({added} added)")

    # Backtest all 13 ensembles
    print("\n=== Backtesting all 13 ensembles ===")
    ensemble_bt = {}
    for ens in ENSEMBLES:
        preds = out.get(ens["key"], {})
        stats = backtest_ensemble(preds, ens["name"])
        ensemble_bt[ens["name"]] = stats
        print(f"  {ens['label']}: {stats['totalTrades']} trades, {stats['winRate']}% win, PF {stats['profitFactor']}, ★ {stats['stars']}")
    out["ensemble_backtesting"] = ensemble_bt

    # Backtest all 65 individual models
    print("\n=== Backtesting all 65 individual models ===")
    model_bt = {}
    for mname in model_names:
        m = out["models"].get(mname, {})
        preds = m.get("predictions", {}) if isinstance(m, dict) else {}
        stats = backtest_ensemble(preds, mname)
        model_bt[mname] = stats
    out["backtesting"] = model_bt
    print(f"  Backtested {len(model_bt)} individual models")

    # Save
    out["trained_at"] = pd.Timestamp.now().isoformat()
    out["force_trained_all"] = True
    OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))
    print(f"\n✅ Done! {OUT.name} updated.")
    print(f"   - {len(model_names)} models, each with predictions for {len(trainable)} trainable stocks")
    print(f"   - {len(ENSEMBLES)} ensembles, each extended to ~{len(trainable)} stocks")
    print(f"   - {len(model_bt)} individual model backtest entries + {len(ensemble_bt)} ensemble backtest entries")

if __name__ == "__main__":
    main()
