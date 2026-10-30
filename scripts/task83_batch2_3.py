#!/usr/bin/env python3
"""Task 83 continuation — Batch 2 (Task 79 models, SVR reduced) + Batch 3 (LSTM/GRU)."""
import sys, os, json, time, gc, warnings
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")
from walk_forward_backtesting import FC, add_features, load
from ml_integrity import add_forward_returns, add_target_maturity_dates, filter_by_target_maturity, HORIZONS
import numpy as np, pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import ElasticNet, HuberRegressor
from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import torch, torch.nn as nn

OUT = Path("data/backtest_reports/task83")
LOG = OUT / "batch_logs"
SPLIT_MS = int(pd.Timestamp("2024-06-01", tz="UTC").value // 10**6)

def em(yt, yp):
    yt, yp = np.array(yt, dtype=float), np.array(yp, dtype=float)
    if len(yt) < 2: return None
    return {"mae": round(float(mean_absolute_error(yt, yp)), 6), "rmse": round(float(np.sqrt(mean_squared_error(yt, yp))), 6),
            "r2": round(float(r2_score(yt, yp)), 4), "directional_accuracy": round(float(np.mean(np.sign(yt) == np.sign(yp))), 4),
            "mean_bias": round(float(np.mean(yp - yt)), 6), "n": len(yt)}

MODELS = {"ExtraTrees": lambda: ExtraTreesRegressor(n_estimators=100, max_depth=8, min_samples_leaf=10, random_state=42, n_jobs=-1),
          "HistGradientBoosting": lambda: HistGradientBoostingRegressor(max_iter=100, max_depth=4, learning_rate=0.05, min_samples_leaf=15, random_state=42),
          "ElasticNet": lambda: ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42, max_iter=5000),
          "HuberRegressor": lambda: HuberRegressor(epsilon=1.35, max_iter=5000, alpha=0.001),
          "SVR": lambda: SVR(kernel="rbf", C=1.0, gamma="scale")}
SCALED = {"ElasticNet", "HuberRegressor", "SVR"}

def main():
    df = load(stocks=__import__("json").loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())["universe"]["symbols"], source="db")
    df = add_features(df); df = add_forward_returns(df)
    latest_ms = int(df["date"].max())
    results = {}

    # Batch 2: Task 79 models
    print("── Batch 2: Task 79 models ──")
    b2 = {}
    for name, ctor in MODELS.items():
        print(f"  {name}...", end="", flush=True); t0 = time.time()
        metrics = {}
        for h in HORIZONS:
            tc = f"target_{h}d"
            elig = filter_by_target_maturity(df, latest_ms, h).dropna(subset=[tc]+FC)
            elig = elig[np.isfinite(elig[tc])]
            if len(elig) < 200: metrics[f"{h}d"] = None; continue
            tr = elig["date"] <= SPLIT_MS; te = ~tr
            Xtr, ytr = elig[tr][FC].values, elig[tr][tc].values
            Xte, yte = elig[te][FC].values, elig[te][tc].values
            if len(Xte) < 20: metrics[f"{h}d"] = None; continue
            # SVR: subsample training to 3000 rows for speed
            if name == "SVR" and len(Xtr) > 3000:
                idx = np.random.RandomState(42).choice(len(Xtr), 3000, replace=False)
                Xtr, ytr = Xtr[idx], ytr[idx]
            try:
                m = ctor()
                if name in SCALED:
                    sc = StandardScaler(); Xtr = sc.fit_transform(Xtr); Xte = sc.transform(Xte)
                m.fit(Xtr, ytr)
                p = m.predict(Xte)
                mt = em(yte.tolist(), p.tolist())
                if mt:
                    mt["zero_baseline_mae"] = em(yte.tolist(), [0]*len(yte))["mae"]
                    mt["mean_baseline_mae"] = em(yte.tolist(), [ytr.mean()]*len(yte))["mae"]
                    mt["beats_mean_baseline"] = mt["mae"] < mt["mean_baseline_mae"]
                metrics[f"{h}d"] = mt
            except Exception as e: metrics[f"{h}d"] = {"error": str(e)[:80]}
        el = time.time() - t0
        st = "trained_oos_evaluated" if any(isinstance(v, dict) and "mae" in v for v in metrics.values()) else "failed_after_attempts"
        b2[name] = {"status": st, "metrics": metrics, "elapsed_s": round(el, 1)}
        results[f"{name} (Task79)"] = b2[name]
        print(f" {st} ({el:.0f}s)"); del m, Xtr, ytr, Xte, yte; gc.collect()
    (LOG / "batch2_task79.json").write_text(json.dumps(b2, indent=2, default=str))

    # Batch 3: LSTM + GRU
    print("\n── Batch 3: Neural (LSTM, GRU) ──")
    torch.set_num_threads(2)
    b3 = {}
    for name in ["LSTM", "GRU"]:
        print(f"  {name}...", end="", flush=True); t0 = time.time()
        metrics = {}
        for h in HORIZONS:
            tc = f"target_{h}d"
            elig = filter_by_target_maturity(df, latest_ms, h).dropna(subset=[tc]+FC)
            elig = elig[np.isfinite(elig[tc])]
            if len(elig) < 200: metrics[f"{h}d"] = None; continue
            tr = elig["date"] <= SPLIT_MS; te = ~tr
            Xtr = elig[tr][FC].values.astype(np.float32); ytr = elig[tr][tc].values.astype(np.float32)
            Xte = elig[te][FC].values.astype(np.float32); yte = elig[te][tc].values.astype(np.float32)
            if len(Xte) < 20: metrics[f"{h}d"] = None; continue
            sc = StandardScaler(); Xtr = sc.fit_transform(Xtr).astype(np.float32); Xte = sc.transform(Xte).astype(np.float32)
            Xtr_s, Xte_s = Xtr[:, None, :], Xte[:, None, :]
            hid = 16
            class Net(nn.Module):
                def __init__(s):
                    super().__init__()
                    s.rnn = (nn.LSTM if name == "LSTM" else nn.GRU)(len(FC), hid, batch_first=True)
                    s.fc = nn.Linear(hid, 1)
                def forward(s, x):
                    o = s.rnn(x); hn = o[1][0] if name == "LSTM" else o[1]
                    return s.fc(hn[-1]).squeeze(-1)
            try:
                net = Net(); opt = torch.optim.Adam(net.parameters(), lr=0.01); lf = nn.MSELoss()
                for ep in range(30):
                    perm = torch.randperm(len(Xtr_s))
                    for i in range(0, len(Xtr_s), 64):
                        idx = perm[i:i+64]
                        opt.zero_grad(); loss = lf(net(torch.from_numpy(Xtr_s[idx])), torch.from_numpy(ytr[idx])); loss.backward(); opt.step()
                with torch.no_grad(): p = net(torch.from_numpy(Xte_s)).numpy()
                mt = em(yte.tolist(), p.tolist())
                if mt: mt["params"] = sum(p.numel() for p in net.parameters()); mt["epochs"] = 30; mt["hidden"] = hid
                metrics[f"{h}d"] = mt
                torch.save(net.state_dict(), OUT / "models" / f"{name}_{h}d.pt")
            except Exception as e: metrics[f"{h}d"] = {"error": str(e)[:80]}
            del net, Xtr, ytr, Xte, yte; gc.collect()
        el = time.time() - t0
        st = "trained_oos_evaluated" if any(isinstance(v, dict) and "mae" in v for v in metrics.values()) else "failed_after_attempts"
        b3[name] = {"status": st, "metrics": metrics, "elapsed_s": round(el, 1)}
        results[name] = b3[name]
        print(f" {st} ({el:.0f}s)")
    (LOG / "batch3_nn.json").write_text(json.dumps(b3, indent=2, default=str))

    # Load batch 1 + combine
    b1 = json.loads((LOG / "batch1_stats.json").read_text()) if (LOG / "batch1_stats.json").exists() else {}
    for k, v in b1.items(): results[k] = v
    summary = {"task": "task83_feasible_training", "createdAt": datetime.now(timezone.utc).isoformat(),
               "batches": {"batch1_statistical": b1, "batch2_task79_eval": b2, "batch3_neural": b3},
               "allResults": results, "libraries": {"torch": torch.__version__}}
    (OUT / "task83_metrics.json").write_text(json.dumps(summary, indent=2, default=str))
    print(f"\n✓ Metrics: {OUT}/task83_metrics.json ({len(results)} models)")
    for n, r in results.items():
        hs = [h for h, v in (r.get("metrics") or {}).items() if isinstance(v, dict) and "mae" in v]
        if hs: print(f"  {n}: {r['status']} dir_acc={r['metrics'][hs[0]].get('directional_accuracy','?')} h={hs}")

if __name__ == "__main__": main()
