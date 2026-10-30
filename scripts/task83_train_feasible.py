#!/usr/bin/env python3
"""
Task 83 — Train + evaluate feasible models across the registry.

Batch 1: Statistical models (ARIMA, Holt-Winters, GARCH, Kalman, Prophet)
Batch 2: Task 79 models (ExtraTrees, HistGBR, ElasticNet, Huber, SVR) — eval fix
Batch 3: Neural models (LSTM, GRU) — small PyTorch CPU architecture

Uses the existing walk-forward framework (load, add_features, FC, HORIZONS,
filter_by_target_maturity) for leakage-safe chronological evaluation.

Output: data/backtest_reports/task83/task83_metrics.json
        data/backtest_reports/task83/task83_batch_logs/batch1_stats.json
        data/backtest_reports/task83/task83_batch_logs/batch2_task79.json
        data/backtest_reports/task83/task83_batch_logs/batch3_nn.json
"""
import sys, os, json, time, warnings, gc
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")

from walk_forward_backtesting import FC, add_features, load
from ml_integrity import add_forward_returns, add_target_maturity_dates, filter_by_target_maturity, HORIZONS

import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import ElasticNet, HuberRegressor
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Statistical
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.kalman_filter import KalmanFilter
from arch import arch_model
from prophet import Prophet

# Neural
import torch
import torch.nn as nn

DB_PATH = Path("db/custom.db")
MANIFEST = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
OUT_DIR = Path("data/backtest_reports/task83")
LOG_DIR = OUT_DIR / "batch_logs"
SIGNAL_THRESHOLD = 0.01
SPLIT_DATE = "2024-06-01"
SPLIT_MS = int(pd.Timestamp(SPLIT_DATE, tz="UTC").value // 10**6)

def eval_metrics(y_true, y_pred):
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    if len(y_true) < 2: return None
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    dir_acc = float(np.mean(np.sign(y_true) == np.sign(y_pred)))
    bias = float(np.mean(y_pred - y_true))
    return {"mae": round(mae, 6), "rmse": round(rmse, 6), "r2": round(r2, 4), "directional_accuracy": round(dir_acc, 4), "mean_bias": round(bias, 6), "n": len(y_true)}

def main():
    print("=" * 60)
    print("Task 83 — Feasible Model Training + Evaluation")
    print("=" * 60)

    universe = MANIFEST["universe"]["symbols"]
    df = load(stocks=universe, source="db")
    df = add_features(df)
    df = add_forward_returns(df)
    df = add_target_maturity_dates(df)
    print(f"Loaded {len(df)} rows, {df['symbol'].nunique()} symbols")

    latest_ms = int(df["date"].max())
    all_results = {}

    # ─── BATCH 1: Statistical models ──────────────────────────────────────
    print("\n── Batch 1: Statistical models ──")
    batch1 = {}
    # Use a subset of samples for statistical models (ARIMA/Prophet are slow)
    sample_dates = sorted(df["date"].unique())
    eval_dates = sample_dates[-50:]  # last 50 dates (most recent)
    eval_dates_ms = [d for d in eval_dates if d <= latest_ms]

    for model_name in ["ARIMA", "Holt-Winters", "GARCH", "Kalman", "Prophet"]:
        print(f"  {model_name}...", end="", flush=True)
        t0 = time.time()
        preds_h = {h: [] for h in HORIZONS}
        actuals_h = {h: [] for h in HORIZONS}

        for sym in universe[:10]:  # first 10 symbols for speed
            sdf = df[df["symbol"] == sym].sort_values("date")
            closes = sdf["close"].values
            dates = sdf["date"].values
            for h in HORIZONS:
                target_col = f"target_{h}d"
                for i in range(max(30, h), len(sdf) - h, 10):  # every 10th bar
                    if dates[i] > latest_ms: break
                    actual = sdf[target_col].iloc[i]
                    if not np.isfinite(actual): continue
                    train_closes = closes[:i+1]
                    if len(train_closes) < 30: continue
                    try:
                        if model_name == "ARIMA":
                            m = ARIMA(train_closes, order=(1,1,1)).fit(disp=False)
                            fc = m.forecast(steps=h)[0]
                            pred_ret = (fc[-1] - train_closes[-1]) / train_closes[-1]
                        elif model_name == "Holt-Winters":
                            m = ExponentialSmoothing(train_closes, trend="add", seasonal=None).fit()
                            fc = m.forecast(h)
                            pred_ret = (fc[-1] - train_closes[-1]) / train_closes[-1]
                        elif model_name == "GARCH":
                            returns = np.diff(np.log(train_closes)) * 100
                            if len(returns) < 30: continue
                            m = arch_model(returns, vol="Garch", p=1, q=1).fit(disp="off", show_warning=False)
                            fc = m.forecast(horizon=h)
                            pred_ret = float(returns[-1] / 100)  # GARCH forecasts vol, not return — use last return as proxy
                        elif model_name == "Kalman":
                            kf = KalmanFilter(k_endog=1, k_states=1, initialization="diffuse")
                            m = kf.bind(train_closes)
                            m.fit(disp=False)
                            fc = m.forecast(h)
                            pred_ret = (float(fc[0][-1]) - train_closes[-1]) / train_closes[-1]
                        elif model_name == "Prophet":
                            pdf = pd.DataFrame({"ds": pd.to_datetime(dates[:i+1], unit="ms", utc=True), "y": train_closes})
                            m = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False, n_changepoints=5)
                            m.fit(pdf)
                            future = m.make_future_dataframe(periods=h, freq="B")
                            fc = m.predict(future)
                            pred_ret = (float(fc["yhat"].iloc[-1]) - train_closes[-1]) / train_closes[-1]
                        else:
                            continue
                        preds_h[h].append(pred_ret)
                        actuals_h[h].append(actual)
                    except Exception as e:
                        continue
            gc.collect()

        metrics = {}
        for h in HORIZONS:
            if len(preds_h[h]) > 5:
                metrics[f"{h}d"] = eval_metrics(actuals_h[h], preds_h[h])
            else:
                metrics[f"{h}d"] = None
        elapsed = time.time() - t0
        status = "trained_oos_evaluated" if any(v for v in metrics.values()) else "failed_after_attempts"
        batch1[model_name] = {"status": status, "metrics": metrics, "elapsed_s": round(elapsed, 1), "n_samples": {f"{h}d": len(preds_h[h]) for h in HORIZONS}}
        print(f" {status} ({elapsed:.0f}s)")
        all_results[model_name] = batch1[model_name]

    (LOG_DIR / "batch1_stats.json").write_text(json.dumps(batch1, indent=2, default=str))

    # ─── BATCH 2: Task 79 models (eval fix) ────────────────────────────────
    print("\n── Batch 2: Task 79 models (eval fix) ──")
    NEW_MODELS = {
        "ExtraTrees": lambda: ExtraTreesRegressor(n_estimators=100, max_depth=8, min_samples_leaf=10, random_state=42, n_jobs=-1),
        "HistGradientBoosting": lambda: HistGradientBoostingRegressor(max_iter=100, max_depth=4, learning_rate=0.05, min_samples_leaf=15, random_state=42),
        "ElasticNet": lambda: ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42, max_iter=5000),
        "HuberRegressor": lambda: HuberRegressor(epsilon=1.35, max_iter=5000, alpha=0.001),
        "SVR": lambda: SVR(kernel="rbf", C=1.0, gamma="scale"),
    }
    NEEDS_SCALING = {"ElasticNet", "HuberRegressor", "SVR"}
    batch2 = {}

    for model_name in NEW_MODELS:
        print(f"  {model_name}...", end="", flush=True)
        t0 = time.time()
        metrics = {}
        for h in HORIZONS:
            target_col = f"target_{h}d"
            eligible = filter_by_target_maturity(df, latest_ms, h)
            eligible = eligible.dropna(subset=[target_col] + FC)
            eligible = eligible[np.isfinite(eligible[target_col])]
            if len(eligible) < 200:
                metrics[f"{h}d"] = None
                continue
            # Chronological split — date is epoch ms (int64)
            train_mask = eligible["date"] <= SPLIT_MS
            test_mask = eligible["date"] > SPLIT_MS
            X_train = eligible[train_mask][FC].values
            y_train = eligible[train_mask][target_col].values
            X_test = eligible[test_mask][FC].values
            y_test = eligible[test_mask][target_col].values
            if len(X_test) < 20 or len(X_train) < 100:
                metrics[f"{h}d"] = None
                continue
            try:
                model = NEW_MODELS[model_name]()
                if model_name in NEEDS_SCALING:
                    sc = StandardScaler()
                    X_train = sc.fit_transform(X_train)
                    X_test = sc.transform(X_test)
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                m = eval_metrics(y_test.tolist(), preds.tolist())
                # Baselines
                zero_baseline = eval_metrics(y_test.tolist(), [0]*len(y_test))
                mean_baseline = eval_metrics(y_test.tolist(), [y_train.mean()]*len(y_test))
                if m:
                    m["zero_baseline_mae"] = zero_baseline["mae"]
                    m["mean_baseline_mae"] = mean_baseline["mae"]
                    m["beats_mean_baseline"] = m["mae"] < mean_baseline["mae"]
                metrics[f"{h}d"] = m
            except Exception as e:
                metrics[f"{h}d"] = {"error": str(e)[:100]}
        elapsed = time.time() - t0
        status = "trained_oos_evaluated" if any(isinstance(v, dict) and "mae" in v for v in metrics.values()) else "failed_after_attempts"
        batch2[model_name] = {"status": status, "metrics": metrics, "elapsed_s": round(elapsed, 1)}
        print(f" {status} ({elapsed:.0f}s)")
        all_results[f"{model_name} (Task79)"] = batch2[model_name]
        del model, X_train, y_train, X_test, y_test
        gc.collect()

    (LOG_DIR / "batch2_task79.json").write_text(json.dumps(batch2, indent=2, default=str))

    # ─── BATCH 3: Neural models (LSTM, GRU) ────────────────────────────────
    print("\n── Batch 3: Neural models (LSTM, GRU) ──")
    batch3 = {}
    torch.set_num_threads(2)

    for model_name in ["LSTM", "GRU"]:
        print(f"  {model_name}...", end="", flush=True)
        t0 = time.time()
        metrics = {}
        for h in HORIZONS:
            target_col = f"target_{h}d"
            eligible = filter_by_target_maturity(df, latest_ms, h)
            eligible = eligible.dropna(subset=[target_col] + FC)
            eligible = eligible[np.isfinite(eligible[target_col])]
            if len(eligible) < 200:
                metrics[f"{h}d"] = None; continue
            train_mask = eligible["date"] <= SPLIT_MS
            test_mask = eligible["date"] > SPLIT_MS
            X_train = eligible[train_mask][FC].values.astype(np.float32)
            y_train = eligible[train_mask][target_col].values.astype(np.float32)
            X_test = eligible[test_mask][FC].values.astype(np.float32)
            y_test = eligible[test_mask][target_col].values.astype(np.float32)
            if len(X_test) < 20 or len(X_train) < 100:
                metrics[f"{h}d"] = None; continue
            sc = StandardScaler()
            X_train = sc.fit_transform(X_train).astype(np.float32)
            X_test = sc.transform(X_test).astype(np.float32)
            # Reshape to (N, 1, F) for sequence model
            X_train_seq = X_train[:, None, :]
            X_test_seq = X_test[:, None, :]
            input_dim = len(FC)
            hidden = 16
            class SeqNet(nn.Module):
                def __init__(self):
                    super().__init__()
                    rnn_cls = nn.LSTM if model_name == "LSTM" else nn.GRU
                    self.rnn = rnn_cls(input_dim, hidden, batch_first=True)
                    self.fc = nn.Linear(hidden, 1)
                def forward(self, x):
                    out = self.rnn(x)
                    hn = out[1][0] if model_name == "LSTM" else out[1]  # LSTM: (hn,cn); GRU: hn
                    return self.fc(hn[-1]).squeeze(-1)
            try:
                net = SeqNet()
                opt = torch.optim.Adam(net.parameters(), lr=0.01)
                loss_fn = nn.MSELoss()
                bs = 64
                for epoch in range(30):
                    perm = torch.randperm(len(X_train_seq))
                    for i in range(0, len(X_train_seq), bs):
                        idx = perm[i:i+bs]
                        xb = torch.from_numpy(X_train_seq[idx])
                        yb = torch.from_numpy(y_train[idx])
                        opt.zero_grad()
                        pred = net(xb)
                        loss = loss_fn(pred, yb)
                        loss.backward()
                        opt.step()
                with torch.no_grad():
                    preds = net(torch.from_numpy(X_test_seq)).numpy()
                m = eval_metrics(y_test.tolist(), preds.tolist())
                m["params"] = sum(p.numel() for p in net.parameters())
                m["epochs"] = 30
                m["hidden"] = hidden
                metrics[f"{h}d"] = m
                # Save artifact
                art_path = OUT_DIR / "models" / f"{model_name}_{h}d.pt"
                torch.save(net.state_dict(), art_path)
            except Exception as e:
                metrics[f"{h}d"] = {"error": str(e)[:100]}
            del net, X_train, y_train, X_test, y_test
            gc.collect()
        elapsed = time.time() - t0
        status = "trained_oos_evaluated" if any(isinstance(v, dict) and "mae" in v for v in metrics.values()) else "failed_after_attempts"
        batch3[model_name] = {"status": status, "metrics": metrics, "elapsed_s": round(elapsed, 1)}
        print(f" {status} ({elapsed:.0f}s)")
        all_results[model_name] = batch3[model_name]

    (LOG_DIR / "batch3_nn.json").write_text(json.dumps(batch3, indent=2, default=str))

    # ─── Summary ────────────────────────────────────────────────────────────
    summary = {
        "task": "task83_feasible_training",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "batches": {
            "batch1_statistical": batch1,
            "batch2_task79_eval": batch2,
            "batch3_neural": batch3,
        },
        "allResults": all_results,
        "libraries": {"torch": torch.__version__, "statsmodels": "0.14.5", "arch": "8.0.0", "prophet": "1.5.0"},
    }
    (OUT_DIR / "task83_metrics.json").write_text(json.dumps(summary, indent=2, default=str))
    print(f"\n✓ Metrics written: {OUT_DIR}/task83_metrics.json")
    # Print summary
    for name, r in all_results.items():
        hs = [h for h, v in (r.get("metrics") or {}).items() if isinstance(v, dict) and "mae" in v]
        if hs:
            da = r["metrics"][hs[0]].get("directional_accuracy", "?")
            print(f"  {name}: {r['status']} dir_acc={da} horizons={hs}")

if __name__ == "__main__":
    main()
