#!/usr/bin/env python3
"""
Task 79 — Train new ML model candidates + generate live prospective predictions.

Trains 5 NEW candidate models (distinct from the existing 5 baselines):
  - Extra Trees Regressor
  - HistGradientBoosting Regressor
  - ElasticNet
  - Huber Regressor
  - Support Vector Regression (with train-fold feature scaling)

For each model × horizon (5/10/21):
  1. LIVE: train on ALL eligible matured data ≤ latest cutoff → predict latest bar
     → record in PredictionHistory (new model IDs, modelVersion="task79-v1",
     kind="prospective", experiment="task79").
  2. EVAL: chronological split (train ≤ split_date, test > split_date) → quality
     metrics (MAE, RMSE, R², directional accuracy, mean bias).
  3. Save model artifact (joblib) + SHA-256.

Reuses the EXACT feature computation (FC, add_features) + target construction
(add_forward_returns, filter_by_target_maturity) from the existing walk-forward
framework so the new models are directly comparable to the 5 baselines.

Does NOT modify existing PredictionHistory records (new IDs only).
Does NOT touch ml_predictions_multi.json or any protected artifact.

Output:
  data/backtest_reports/task79_model_results.json
  data/backtest_reports/task79_models/<model>_<horizon>d.joblib
  PredictionHistory records (new model IDs)
"""
import sys, os, json, sqlite3, hashlib, time, warnings, joblib
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")

from walk_forward_backtesting import FC, MODEL_NAMES, add_features, load
from ml_integrity import add_forward_returns, add_target_maturity_dates, filter_by_target_maturity, HORIZONS

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import ElasticNet, HuberRegressor
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

DB_PATH = Path("db/custom.db")
MANIFEST_PATH = Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json")
OUTPUT_PATH = Path("data/backtest_reports/task79_model_results.json")
MODEL_DIR = Path("data/backtest_reports/task79_models")
SIGNAL_THRESHOLD = 0.01

NEW_MODELS = {
    "ExtraTrees": lambda: ExtraTreesRegressor(n_estimators=100, max_depth=8, min_samples_leaf=10, random_state=42, n_jobs=-1),
    "HistGradientBoosting": lambda: HistGradientBoostingRegressor(max_iter=100, max_depth=4, learning_rate=0.05, min_samples_leaf=15, random_state=42),
    "ElasticNet": lambda: ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42, max_iter=5000),
    "HuberRegressor": lambda: HuberRegressor(epsilon=1.35, max_iter=5000, alpha=0.001),
    "SVR": lambda: SVR(kernel="rbf", C=1.0, gamma="scale"),
}

# Models that need feature scaling (train-fold only)
NEEDS_SCALING = {"ElasticNet", "HuberRegressor", "SVR"}

# Chronological split date for evaluation (val vs final-test boundary ~ 2024-mid)
# The existing manifest's val_end_idx=200; samples 0-199 are ~2023-04 to ~2024-mid.
SPLIT_DATE = "2024-06-01"

def create_model(name):
    if name not in NEW_MODELS:
        raise ValueError(f"Unknown new model: {name}")
    return NEW_MODELS[name]()

def get_latest_cutoff(db_path):
    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()
        return row[0] if row else None
    finally:
        conn.close()

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def record_prediction(db_path, symbol, model_id, horizon, prediction_ts,
                      predicted_return, signal, reference_price, data_cutoff,
                      model_version="task79-v1", experiment="task79"):
    dedup_key = f"{symbol}|{model_id}|{horizon}d|{data_cutoff}|{experiment}"
    conn = sqlite3.connect(str(db_path))
    try:
        existing = conn.execute("SELECT id FROM PredictionHistory WHERE dedupKey=?", (dedup_key,)).fetchone()
        if existing:
            return {"id": existing[0], "dedupKey": dedup_key, "idempotent": True}
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
             datetime.now(timezone.utc).isoformat()))
        conn.commit()
        return {"id": rec_id, "dedupKey": dedup_key, "idempotent": False}
    finally:
        conn.close()

def main():
    print("=" * 60)
    print("Task 79 — New Model Training + Live Predictions")
    print("=" * 60)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text())
    universe = manifest["universe"]["symbols"]
    print(f"universe: {len(universe)} symbols")

    latest_date_str = get_latest_cutoff(DB_PATH)
    if not latest_date_str:
        print("ERROR: No OHLCV data"); sys.exit(2)
    print(f"latest OHLCV (data cutoff): {latest_date_str}")

    latest_cutoff_ms = int(pd.Timestamp(latest_date_str, tz="UTC").value // 10**6)
    prediction_ts = int(time.time() * 1000)

    # Load data + features + targets
    print(f"\nLoading OHLCV for {len(universe)} stocks...")
    df = load(stocks=universe, source="db")
    if df.empty:
        print("ERROR: no data loaded"); sys.exit(2)
    print(f"Loaded {len(df)} rows from {df['symbol'].nunique()} stocks")

    df = add_forward_returns(df)
    df = add_target_maturity_dates(df)
    print(f"Features: {len(FC)}, targets added for horizons {HORIZONS}")

    results = {"models": {}, "artifacts": {}, "live_predictions": 0, "new_records": 0}
    split_ms = int(pd.Timestamp(SPLIT_DATE, tz="UTC").value // 10**6)

    for model_name in NEW_MODELS:
        print(f"\n── {model_name} ──")
        results["models"][model_name] = {}

        for h in HORIZONS:
            target_col = f"target_{h}d"
            print(f"  h={h}d: ", end="", flush=True)

            # --- LIVE: train on ALL eligible matured data ≤ latest cutoff ---
            eligible_live = filter_by_target_maturity(df, latest_cutoff_ms, h)
            eligible_live = eligible_live.dropna(subset=[target_col] + FC)
            eligible_live = eligible_live[np.isfinite(eligible_live[target_col])]

            if len(eligible_live) < 200:
                print(f"SKIP (only {len(eligible_live)} eligible rows)")
                results["models"][model_name][h] = {"status": "skipped", "reason": f"insufficient_rows ({len(eligible_live)})"}
                continue

            X_train_live = eligible_live[FC].values
            y_train_live = eligible_live[target_col].values

            try:
                model = create_model(model_name)
                scaler = None
                if model_name in NEEDS_SCALING:
                    scaler = StandardScaler()
                    X_train_live = scaler.fit_transform(X_train_live)
                model.fit(X_train_live, y_train_live)
            except Exception as e:
                print(f"FAIL (training: {str(e)[:80]})")
                results["models"][model_name][h] = {"status": "failed", "reason": str(e)[:100]}
                continue

            # Save artifact
            artifact_path = MODEL_DIR / f"{model_name}_{h}d.joblib"
            joblib.dump({"model": model, "scaler": scaler, "fc": FC, "horizon": h,
                         "model_name": model_name, "model_version": "task79-v1"}, artifact_path)
            artifact_sha = sha256_file(artifact_path)
            results["artifacts"][f"{model_name}_{h}d"] = {
                "path": str(artifact_path), "sha256": artifact_sha,
                "model_version": "task79-v1", "feature_schema_hash": hashlib.sha256(",".join(FC).encode()).hexdigest()[:16],
                "training_cutoff": latest_date_str, "train_rows": len(eligible_live),
            }

            # Predict for latest bars
            latest_bars = df.loc[df.groupby("symbol")["date"].idxmax()]
            latest_bars = latest_bars.dropna(subset=FC)
            X_pred = latest_bars[FC].values
            if model_name in NEEDS_SCALING and scaler:
                X_pred = scaler.transform(X_pred)
            preds = model.predict(X_pred)

            n_buy = 0
            for i, (_, row) in enumerate(latest_bars.iterrows()):
                pred_return = float(preds[i])
                signal = "BUY" if pred_return > SIGNAL_THRESHOLD else "HOLD"
                if signal == "BUY": n_buy += 1
                rec = record_prediction(DB_PATH, row["symbol"], model_name, h, prediction_ts,
                                        pred_return, signal, row["close"], latest_date_str)
                results["live_predictions"] += 1
                if not rec["idempotent"]:
                    results["new_records"] += 1

            # --- EVAL: chronological split (train ≤ split_date, test > split_date) ---
            # The "date" column is epoch MILLISECONDS (int64) — compare directly.
            split_ms_eval = int(pd.Timestamp(SPLIT_DATE, tz="UTC").value // 10**6)
            train_mask = eligible_live["date"] <= split_ms_eval
            test_mask = eligible_live["date"] > split_ms_eval
            X_eval_train = eligible_live[train_mask][FC].values
            y_eval_train = eligible_live[train_mask][target_col].values
            X_eval_test = eligible_live[test_mask][FC].values
            y_eval_test = eligible_live[test_mask][target_col].values

            eval_metrics = None
            if len(X_eval_test) > 20 and len(X_eval_train) > 100:
                eval_model = create_model(model_name)
                eval_scaler = None
                X_et, X_ev = X_eval_train, X_eval_test
                if model_name in NEEDS_SCALING:
                    eval_scaler = StandardScaler()
                    X_et = eval_scaler.fit_transform(X_eval_train)
                    X_ev = eval_scaler.transform(X_eval_test)
                eval_model.fit(X_et, y_eval_train)
                eval_preds = eval_model.predict(X_ev)
                mae = float(mean_absolute_error(y_eval_test, eval_preds))
                rmse = float(np.sqrt(mean_squared_error(y_eval_test, eval_preds)))
                r2 = float(r2_score(y_eval_test, eval_preds)) if len(y_eval_test) > 1 else None
                # Directional accuracy: predicted sign matches actual sign
                actual_dir = np.sign(y_eval_test)
                pred_dir = np.sign(eval_preds)
                dir_acc = float(np.mean(actual_dir == pred_dir)) if len(y_eval_test) > 0 else None
                mean_bias = float(np.mean(eval_preds - y_eval_test))
                eval_metrics = {
                    "train_rows": len(X_eval_train), "test_rows": len(X_eval_test),
                    "split_date": SPLIT_DATE,
                    "mae": round(mae, 6), "rmse": round(rmse, 6),
                    "r2": round(r2, 4) if r2 is not None else None,
                    "directional_accuracy": round(dir_acc, 4) if dir_acc is not None else None,
                    "mean_bias": round(mean_bias, 6),
                }

            results["models"][model_name][h] = {
                "status": "trained",
                "train_rows_live": len(eligible_live),
                "n_buy_signals": n_buy,
                "n_predicted": len(latest_bars),
                "artifact_sha256": artifact_sha,
                "eval": eval_metrics,
            }
            ea = eval_metrics["directional_accuracy"] if eval_metrics else "?"
            print(f"trained on {len(eligible_live)}, {n_buy} BUY, eval dir_acc={ea}")

    # Build report
    report = {
        "task": "task79_new_models",
        "experiment_id": "task79",
        "model_version": "task79-v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data_cutoff": latest_date_str,
        "universe": universe,
        "feature_schema": FC,
        "horizons": HORIZONS,
        "new_models": list(NEW_MODELS.keys()),
        "signal_threshold": SIGNAL_THRESHOLD,
        "existing_baseline_models": MODEL_NAMES,
        "split_date": SPLIT_DATE,
        "models": results["models"],
        "artifacts": results["artifacts"],
        "live_predictions_total": results["live_predictions"],
        "new_records_created": results["new_records"],
        "honest_disclosure": [
            "New models are trained on the same feature schema + walk-forward framework as the 5 existing baselines for apples-to-apples comparison.",
            "Evaluation uses a single chronological split (train ≤ 2024-06-01, test > 2024-06-01) — NOT a full 400-sample walk-forward due to compute constraints. Metrics are approximate.",
            "Live predictions are recorded in PredictionHistory with new model IDs (ExtraTrees, HistGradientBoosting, ElasticNet, HuberRegressor, SVR) + modelVersion task79-v1.",
            "Existing 5-model baseline predictions are NOT modified.",
            "Prospective superiority has NOT been proven — 0 matured outcomes for the new models yet.",
            "Do NOT claim statistical significance or future profitability.",
            "Sequence models (GRU/LSTM/TCN) were NOT trained — documented as deferred due to compute/data constraints in the sandbox.",
        ],
        "limitations": [
            "Single-split evaluation (not full walk-forward) — metrics are a rough guide, not a rigorous evaluation.",
            "SVR is slow to train on large datasets; may have fewer eligible rows if filtered.",
            "No sequence models (GRU/LSTM) — the tabular data + sandbox compute constraints make them impractical here.",
            "No new feature engineering beyond the existing 19 features — the focus is on new model families.",
        ],
    }
    OUTPUT_PATH.write_text(json.dumps(report, indent=2, default=str))
    print(f"\n✓ Report: {OUTPUT_PATH}")
    print(f"  live predictions: {results['live_predictions']}, new records: {results['new_records']}")
    print(f"  artifacts: {len(results['artifacts'])}")

if __name__ == "__main__":
    main()
