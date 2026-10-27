#!/usr/bin/env python3
"""Latent.pk — INCREMENTAL trainer: only train stocks MISSING from the existing
ml_predictions_multi.json. Re-runs are fast (skips already-trained stocks).

This solves the "why do I need to train again and again" problem: the script
preserves all existing predictions and only trains NEW stocks (or stocks that
were skipped on a previous run due to timeout/OOM).
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

# Expected model count per stock (from train_all_models())
EXPECTED_MODEL_COUNT = 36

def main():
    # Load existing JSON
    if not OUT.exists():
        print(f"ERROR: {OUT} not found. Run scripts/train_all_models_db.py first.")
        sys.exit(1)
    out = json.loads(OUT.read_text())
    out.setdefault("models", {})
    
    # All DB symbols
    syms = load_syms()
    print(f"DB stocks: {len(syms)}")
    
    # Identify which stocks NEED training (missing from JSON OR trained on fewer than EXPECTED_MODEL_COUNT models)
    already_trained = 0
    need_training = []
    for sym in syms:
        # Check how many models have predictions for this symbol
        trained_count = sum(
            1 for m in out["models"].values()
            if isinstance(m, dict) and "predictions" in m and sym in m["predictions"]
        )
        if trained_count >= EXPECTED_MODEL_COUNT:
            already_trained += 1
        else:
            need_training.append(sym)
    
    print(f"Already trained (skipped): {already_trained}")
    print(f"Need training: {len(need_training)}")
    
    if not need_training:
        print("✅ All stocks already trained. Skipping to ensemble computation.")
    else:
        # Process in chunks of 50
        CHUNK = 50
        total_chunks = (len(need_training) + CHUNK - 1) // CHUNK
        for ci in range(0, len(need_training), CHUNK):
            chunk = need_training[ci:ci + CHUNK]
            cn = ci // CHUNK + 1
            print(f"\n{'='*60}\nChunk {cn}/{total_chunks}: {chunk[0]}..{chunk[-1]}\n{'='*60}")
            for sym in chunk:
                try:
                    df = load_db(sym)
                    if len(df) < 60:
                        print(f"  skip {sym} ({len(df)} bars)")
                        continue
                    sdf = add_features(df)
                    sdf = add_labels(sdf)
                    preds = train_all_models(df, sdf)
                    if preds:
                        for mn, mp in preds.items():
                            out["models"].setdefault(mn, {"trained": True, "predictions": {}})
                            out["models"][mn]["predictions"][sym] = mp
                        print(f"  ✓ {sym}: {len(preds)} models")
                    else:
                        print(f"  ✗ {sym}: no preds")
                except Exception as e:
                    print(f"  ✗ {sym}: {str(e)[:80]}")
            # Save after each chunk
            out["trained_at"] = pd.Timestamp.now().isoformat()
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))
            tp = sum(len(m.get("predictions", {})) for m in out["models"].values())
            print(f"\n  Saved: {tp} total predictions across {len(out['models'])} models")
    
    # Compute ensembles (always — to update with new stocks)
    print(f"\n{'='*60}\nComputing ensembles...\n{'='*60}")
    ens = compute_ensembles(out["models"])
    for en, enp in ens.items():
        out[f"{en}_predictions"] = enp
        print(f"  {en}: {len(enp)} stocks")
    
    # Backtest
    print(f"\nBacktesting individual models...")
    model_preds = {k: v["predictions"] for k, v in out["models"].items() if isinstance(v, dict) and "predictions" in v}
    out["backtesting"] = backtest(model_preds)
    ens_preds = {k: v for k, v in ens.items()}
    out["ensemble_backtesting"] = backtest(ens_preds)
    for name, stats in {**out["backtesting"], **out["ensemble_backtesting"]}.items():
        print(f"  {name}: {stats['winRate']}% win, {stats['totalTrades']} trades, avg {stats['avgReturnPct']}%")
    
    out["trained_at"] = pd.Timestamp.now().isoformat()
    OUT.write_text(json.dumps(out, indent=2, default=lambda o: int(o) if isinstance(o, (np.integer,)) else float(o) if isinstance(o, (np.floating,)) else str(o)))
    print(f"\n✅ Done! {OUT.name} updated. {len(syms)} DB stocks, {len(out['models'])} models, {len(ens)} ensembles.")

if __name__ == "__main__":
    main()
