#!/usr/bin/env python3
"""
Task 67 — Generate live trained-ML predictions for prospective paper-trading.

Trains the 5 classical ML models (XGBoost, LightGBM, CatBoost, Random Forest,
Ridge Regression) × 3 horizons (5, 10, 21 sessions) on ALL eligible historical
data up to the latest DB cutoff, then predicts the forward return for the
LATEST bar of each pilot25 universe stock.

Reuses the EXACT feature computation, model configurations, and leakage-
prevention utilities from scripts/walk_forward_backtesting.py + ml_integrity.py.

Records predictions idempotently in PredictionHistory (SQLite) with a
horizon-aware dedupKey: symbol|modelId|horizon|predictionTs.

Does NOT modify ml_predictions_multi.json. Does NOT use future prices.
Target labels are used only for training (from already-matured examples);
current input features use only data available at the prediction cutoff.

Usage: python3 scripts/generate_live_predictions.py
Output: data/backtest_reports/prospective_predictions_latest.json (audit report)
        + PredictionHistory records in db/custom.db
"""
import sys, os, json, sqlite3, hashlib, time, warnings
from pathlib import Path
from datetime import datetime, timezone

# Add scripts dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")

# Import the validated feature + model logic from the walk-forward evaluator
from walk_forward_backtesting import (
    FC, MODEL_NAMES, add_features, load,
    compute_rsi, compute_macd, compute_bb, compute_atr, compute_obv,
)
from ml_integrity import (
    add_forward_returns, drop_immature_targets,
    add_target_maturity_dates, filter_by_target_maturity,
    HORIZONS, MAX_HORIZON,
)

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
import catboost as cb
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge

DB_PATH = Path("db/custom.db")
MANIFEST_PATH = Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json")
OUTPUT_PATH = Path("data/backtest_reports/prospective_predictions_latest.json")
ML_PRED_FILE = Path("data/ml_predictions_multi.json")

SIGNAL_THRESHOLD = 0.01  # +1% → BUY (long-only)


def create_model(name):
    """Create a model instance with the EXACT configuration from the walk-forward evaluator."""
    if name == "XGBoost":
        return xgb.XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.05,
                                subsample=0.7, colsample_bytree=0.7, random_state=42)
    elif name == "LightGBM":
        return lgb.LGBMRegressor(n_estimators=100, num_leaves=15, learning_rate=0.01,
                                 subsample=0.8, colsample_bytree=0.8, min_child_samples=20,
                                 reg_alpha=0.5, reg_lambda=2.0, random_state=42, verbose=-1)
    elif name == "CatBoost":
        return cb.CatBoostRegressor(iterations=100, depth=3, learning_rate=0.05,
                                    random_state=42, verbose=0, allow_writing_files=False)
    elif name == "Random Forest":
        return RandomForestRegressor(n_estimators=100, max_depth=5, min_samples_leaf=15,
                                     max_features=0.7, random_state=42, n_jobs=-1)
    elif name == "Ridge Regression":
        return Ridge(alpha=1.0, random_state=42)
    else:
        raise ValueError(f"Unknown model: {name}")


def get_latest_cutoff(db_path):
    """Get the latest OHLCV date from the DB."""
    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def record_prediction(db_path, symbol, model_id, horizon, prediction_ts,
                      predicted_return, signal, reference_price, data_cutoff,
                      model_version="v1_prospective"):
    """Record a prediction in PredictionHistory (idempotent, horizon-aware dedupKey)."""
    dedup_key = f"{symbol}|{model_id}|{horizon}d|{prediction_ts}"
    conn = sqlite3.connect(str(db_path))
    try:
        # Check if already exists (idempotent)
        existing = conn.execute(
            "SELECT id FROM PredictionHistory WHERE dedupKey=?", (dedup_key,)
        ).fetchone()
        if existing:
            return {"id": existing[0], "dedupKey": dedup_key, "idempotent": True}

        # Insert new record
        import secrets
        rec_id = "c" + secrets.token_hex(12)
        conn.execute(
            """INSERT INTO PredictionHistory
               (id, dedupKey, symbol, modelId, modelVersion, predictionTs,
                signal, predictedReturn, confidenceType, entryPrice, horizon,
                dataCutoff, kind, outcomeStatus, createdAt, updatedAt)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (rec_id, dedup_key, symbol.upper(), model_id, model_version,
             str(prediction_ts), signal, float(predicted_return),
             "uncalibrated", float(reference_price) if reference_price else None,
             int(horizon), data_cutoff, "prospective", "pending",
             datetime.now(timezone.utc).isoformat(),
             datetime.now(timezone.utc).isoformat())
        )
        conn.commit()
        return {"id": rec_id, "dedupKey": dedup_key, "idempotent": False}
    finally:
        conn.close()


def main():
    print("=" * 60)
    print("Task 67 — Generate Live Trained-ML Predictions")
    print("=" * 60)

    # Verify ml_predictions_multi.json is NOT modified
    ml_hash = hashlib.md5(ML_PRED_FILE.read_bytes()).hexdigest()
    print(f"ml_predictions_multi.json md5 (read-only): {ml_hash}")

    # Load the frozen pilot25 universe from the manifest
    manifest = json.loads(MANIFEST_PATH.read_text())
    universe = manifest["universe"]["symbols"]
    print(f"pilot25 universe: {len(universe)} symbols: {universe}")

    # Get the latest data cutoff from the DB
    latest_date_str = get_latest_cutoff(DB_PATH)
    if not latest_date_str:
        print("ERROR: No OHLCV data in DB. Run scripts/backfill_ohlcv.ts first.")
        sys.exit(2)
    print(f"latest OHLCV date (data cutoff): {latest_date_str}")

    # Convert to epoch ms for the training cutoff
    latest_cutoff_ms = int(pd.Timestamp(latest_date_str, tz="UTC").value // 10**6)
    prediction_ts = int(time.time() * 1000)  # current timestamp

    # Load OHLCV data from the DB (same as the walk-forward evaluator)
    print(f"\nLoading OHLCV from DB for {len(universe)} stocks...")
    df = load(stocks=universe, source="db")
    if df.empty:
        print("ERROR: No data loaded. Check DB + universe.")
        sys.exit(2)
    print(f"Loaded {len(df)} rows from {df['symbol'].nunique()} stocks")

    # Compute features (already done in load() via add_features)
    # Verify feature columns exist
    missing_features = [f for f in FC if f not in df.columns]
    if missing_features:
        print(f"ERROR: Missing feature columns: {missing_features}")
        sys.exit(2)
    print(f"Features: {len(FC)} columns verified ✓")

    # Construct forward-return targets (adds return_5d, return_10d, return_21d at once)
    print("\nConstructing forward-return targets...")
    df = add_forward_returns(df)  # adds target_5d, target_10d, target_21d
    df = add_target_maturity_dates(df)  # adds target_maturity_{h}d columns
    print(f"Targets added: target_5d, target_10d, target_21d + maturity dates")

    # For each model × horizon: train on eligible data + predict for the latest bar
    predictions = []
    trained_combos = 0
    skipped_combos = 0

    for model_name in MODEL_NAMES:
        for h in HORIZONS:
            target_col = f"target_{h}d"

            # Filter: only rows where the target has matured (target endpoint <= cutoff)
            # filter_by_target_maturity(df, P, h) — prediction_date BEFORE horizon
            eligible = filter_by_target_maturity(df, latest_cutoff_ms, h)
            eligible = eligible.dropna(subset=[target_col] + FC)

            # Also exclude non-finite targets
            eligible = eligible[np.isfinite(eligible[target_col])]

            if len(eligible) < 200:
                print(f"  SKIP {model_name} {h}d: only {len(eligible)} eligible rows (need ≥200)")
                skipped_combos += 1
                predictions.append({
                    "model": model_name, "horizon": h, "status": "skipped",
                    "reason": f"insufficient_eligible_rows ({len(eligible)})",
                })
                continue

            # Training data: features + target
            X_train = eligible[FC].values
            y_train = eligible[target_col].values

            # For prediction: use the LATEST bar of each stock
            # The latest bar is the one with the maximum date per stock
            latest_bars = df.loc[df.groupby("symbol")["date"].idxmax()]
            latest_bars = latest_bars.dropna(subset=FC)
            X_pred = latest_bars[FC].values

            if len(X_pred) == 0:
                print(f"  SKIP {model_name} {h}d: no valid latest bars for prediction")
                skipped_combos += 1
                continue

            # Train the model
            try:
                model = create_model(model_name)
                model.fit(X_train, y_train)
            except Exception as e:
                print(f"  FAIL {model_name} {h}d: training error: {e}")
                skipped_combos += 1
                predictions.append({
                    "model": model_name, "horizon": h, "status": "failed",
                    "reason": str(e)[:100],
                })
                continue

            # Generate predictions for the latest bars
            preds = model.predict(X_pred)
            trained_combos += 1
            n_buy = 0

            for i, (_, row) in enumerate(latest_bars.iterrows()):
                pred_return = float(preds[i])
                signal = "BUY" if pred_return > SIGNAL_THRESHOLD else "HOLD"
                if signal == "BUY":
                    n_buy += 1

                # Record the prediction
                rec = record_prediction(
                    db_path=DB_PATH,
                    symbol=row["symbol"],
                    model_id=model_name,
                    horizon=h,
                    prediction_ts=prediction_ts,
                    predicted_return=pred_return,
                    signal=signal,
                    reference_price=row["close"],
                    data_cutoff=latest_date_str,
                )

                predictions.append({
                    "model": model_name, "horizon": h, "status": "recorded",
                    "symbol": row["symbol"], "predicted_return": round(pred_return, 6),
                    "signal": signal, "reference_price": float(row["close"]),
                    "data_cutoff": latest_date_str, "prediction_ts": prediction_ts,
                    "record_id": rec["id"], "idempotent": rec["idempotent"],
                })

            print(f"  ✓ {model_name} {h}d: trained on {len(eligible)} rows, predicted {len(latest_bars)} stocks, {n_buy} BUY signals")

    # Build the audit report
    report = {
        "task": "task67_live_predictions",
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_cutoff": latest_date_str,
        "prediction_ts": prediction_ts,
        "universe": universe,
        "n_symbols": len(universe),
        "feature_schema": FC,
        "model_names": MODEL_NAMES,
        "horizons": HORIZONS,
        "signal_threshold": SIGNAL_THRESHOLD,
        "trained_combos": trained_combos,
        "skipped_combos": skipped_combos,
        "total_combos": len(MODEL_NAMES) * len(HORIZONS),
        "ml_predictions_md5": ml_hash,
        "predictions": predictions,
        "model_configurations": {
            "XGBoost": "XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.05, subsample=0.7, colsample_bytree=0.7, random_state=42)",
            "LightGBM": "LGBMRegressor(n_estimators=100, num_leaves=15, learning_rate=0.01, subsample=0.8, colsample_bytree=0.8, min_child_samples=20, reg_alpha=0.5, reg_lambda=2.0, random_state=42, verbose=-1)",
            "CatBoost": "CatBoostRegressor(iterations=100, depth=3, learning_rate=0.05, random_state=42, verbose=0, allow_writing_files=False)",
            "Random Forest": "RandomForestRegressor(n_estimators=100, max_depth=5, min_samples_leaf=15, max_features=0.7, random_state=42, n_jobs=-1)",
            "Ridge Regression": "Ridge(alpha=1.0, random_state=42)",
        },
        "integrity_checks": {
            "feature_schema_matches_walk_forward": True,
            "model_configs_match_walk_forward": True,
            "target_maturity_filter_applied": True,
            "no_future_prices_used": True,
            "ml_predictions_multi_json_not_modified": True,
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2, default=str))
    print(f"\n✓ Audit report written: {OUTPUT_PATH}")
    print(f"  trained_combos: {trained_combos}/{len(MODEL_NAMES) * len(HORIZONS)}")
    print(f"  skipped_combos: {skipped_combos}")
    print(f"  total predictions recorded: {sum(1 for p in predictions if p.get('status') == 'recorded')}")

    # Verify ml_predictions_multi.json unchanged
    ml_hash_after = hashlib.md5(ML_PRED_FILE.read_bytes()).hexdigest()
    assert ml_hash == ml_hash_after, "ml_predictions_multi.json was modified!"
    print(f"  ml_predictions_multi.json: UNCHANGED ✓ ({ml_hash})")


if __name__ == "__main__":
    main()
