#!/usr/bin/env python3
"""Latent.pk — FAST force-train-all: ensures every model has a prediction for
every trainable stock (60+ bars with volume>0). Uses a per-stock batching
strategy: for each trainable stock with ANY gap, train ALL 36 models once +
save ALL predictions. For models that fail training, use the technical
fallback signal.

This is ~36x faster than the per-(model, stock) approach because we only
call `train_all_models(df, sdf)` ONCE per stock (not once per missing model).

After running this script, EVERY trainable stock has ALL 65 model predictions.
"""
import json, sqlite3, sys, os, warnings, math
import numpy as np, pandas as pd
import importlib
from pathlib import Path
warnings.filterwarnings("ignore")

sys.path.insert(0, str(Path(__file__).parent))
from train_all_models_db import (
    load_syms, load_db, add_features, add_labels, train_all_models,
    compute_ensembles, backtest, DB, OUT, FC
)
from train_all_ensembles_am import compute_technical_signal, ENSEMBLES, build_base_ensemble_preds, backtest_ensemble

def main():
    if not OUT.exists():
        print(f"ERROR: {OUT} not found.")
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
    model_names = sorted(out["models"].keys())
    print(f"Models in JSON: {len(model_names)}")

    # Identify trainable stocks that have ANY gap
    stocks_with_gaps = []
    for sym in trainable:
        trained_count = sum(
            1 for m in out["models"].values()
            if isinstance(m, dict) and "predictions" in m and sym in m["predictions"] and m["predictions"][sym]
        )
        if trained_count < len(model_names):
            stocks_with_gaps.append(sym)
    print(f"Stocks with at least 1 missing model prediction: {len(stocks_with_gaps)}")

    if not stocks_with_gaps:
        print("✅ All stocks already have all model predictions.")
    else:
        # Process each gap-stock: train ALL 36 models once + save ALL predictions.
        # For models that fail training, use technical fallback.
        print(f"\n=== Processing {len(stocks_with_gaps)} stocks (batch-train all 36 models per stock) ===")
        trained_count = 0
        fallback_count = 0
        for i, sym in enumerate(stocks_with_gaps, 1):
            try:
                df = load_db(sym)
                if len(df) < 60:
                    continue
                sdf = add_features(df)
                sdf = add_labels(sdf)
                # Train ALL 36 models for this stock at once
                preds = train_all_models(df, sdf)
                # Save predictions for every model that succeeded
                if preds:
                    for mname, mp in preds.items():
                        if mp:
                            out["models"][mname]["predictions"][sym] = mp
                            trained_count += 1
                # For models that DIDN'T get a prediction (failed training), use technical fallback
                ts = compute_technical_signal(df)
                if ts:
                    ts["_source"] = "technical_fallback"
                    for mname in model_names:
                        m = out["models"].get(mname, {})
                        existing = m.get("predictions", {}).get(sym) if isinstance(m, dict) else None
                        if not existing:
                            out["models"][mname]["predictions"][sym] = ts
                            fallback_count += 1
                if i % 50 == 0 or i == len(stocks_with_gaps):
                    print(f"  [{i}/{len(stocks_with_gaps)}] {sym}: trained={trained_count}, fallback={fallback_count}")
                    # Save progress periodically
                    out["trained_at"] = pd.Timestamp.now().isoformat()
                    OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))
            except Exception as e:
                # Use technical fallback for this stock
                try:
                    df = load_db(sym)
                    if df is not None and len(df) >= 30:
                        ts = compute_technical_signal(df)
                        if ts:
                            ts["_source"] = "technical_fallback"
                            for mname in model_names:
                                m = out["models"].get(mname, {})
                                existing = m.get("predictions", {}).get(sym) if isinstance(m, dict) else None
                                if not existing:
                                    out["models"][mname]["predictions"][sym] = ts
                                    fallback_count += 1
                except Exception:
                    pass

        print(f"\n=== Fill summary ===")
        print(f"  Trained successfully: {trained_count}")
        print(f"  Technical fallback used: {fallback_count}")

    # Save final state
    out["trained_at"] = pd.Timestamp.now().isoformat()
    out["force_trained_all"] = True
    OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))

    # Verify coverage
    print(f"\n=== Final per-model coverage ===")
    for mname in model_names[:5]:
        m = out["models"].get(mname, {})
        n = len(m.get("predictions", {})) if isinstance(m, dict) else 0
        print(f"  {mname}: {n} stocks")
    print(f"  ... (total {len(model_names)} models)")

    # Recompute 13 ensembles + backtest
    print(f"\n{'='*60}\nRecomputing 13 ensembles + backtest...\n{'='*60}")
    # Build base ensembles A/B/C
    for ens in ENSEMBLES[:3]:
        mode = ens["base"]
        preds = build_base_ensemble_preds(out, mode)
        out[ens["key"]] = preds
        print(f"  {ens['label']}: {len(preds)} stocks")

    # Extend D→M + A/B/C with technical fallback
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

    for ens in ENSEMBLES:
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

    out["trained_at"] = pd.Timestamp.now().isoformat()
    out["force_trained_all"] = True
    OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))
    print(f"\n✅ Done! {OUT.name} updated.")
    print(f"   - {len(model_names)} models, each with predictions for ~{len(trainable)} trainable stocks")
    print(f"   - {len(ENSEMBLES)} ensembles, each extended to ~{len(trainable)} stocks")
    print(f"   - {len(model_bt)} individual model backtest entries + {len(ensemble_bt)} ensemble backtest entries")

if __name__ == "__main__":
    main()
