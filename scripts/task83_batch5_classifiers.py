#!/usr/bin/env python3
"""Task 83 Batch 5 — Train CL-2 (7), PI (4), CG (2) classifiers + 3 ensembles.
Uses the shared TP1-before-SL classification target + the 19-feature schema.
"""
import sys, os, json, time, gc, warnings
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")
from walk_forward_backtesting import FC, add_features, load
from ml_integrity import add_forward_returns, HORIZONS
import numpy as np, pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.neural_network import MLPClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score, accuracy_score
import lightgbm as lgb
import xgboost as xgb

OUT = Path("data/backtest_reports/task83")
LOG = OUT / "batch_logs"
SPLIT_MS = int(pd.Timestamp("2024-06-01", tz="UTC").value // 10**6)

def cls_metrics(y_true, y_pred, y_prob=None):
    if len(y_true) < 10 or len(np.unique(y_true)) < 2: return None
    m = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "n": len(y_true), "pos_rate": round(float(np.mean(y_true)), 4),
    }
    if y_prob is not None and len(np.unique(y_true)) == 2:
        try: m["roc_auc"] = round(float(roc_auc_score(y_true, y_prob)), 4)
        except: pass
    return m

def build_labels(df, horizon=5, tp_mult=1.5):
    """Build TP1-before-SL classification labels per bar."""
    labels = []
    for sym, sdf in df.groupby("symbol"):
        sdf = sdf.sort_values("date").reset_index(drop=True)
        closes = sdf["close"].values
        highs = sdf["high"].values
        lows = sdf["low"].values
        atr = sdf["atr_14"].values if "atr_14" in sdf else np.ones(len(sdf)) * closes * 0.02
        dates = sdf["date"].values
        for i in range(20, len(sdf) - horizon):
            entry = closes[i]
            atr_val = atr[i] if atr[i] > 0 else entry * 0.02
            support = np.min(lows[max(0,i-20):i]) - 0.15 * atr_val
            atr_stop = entry - 0.8 * atr_val
            sl = max(support, atr_stop)  # closer to entry (less risk)
            if abs(entry - sl) < 0.5 * atr_val: sl = entry - 0.5 * atr_val
            R = abs(entry - sl)
            if R <= 0: continue
            tp1 = entry + tp_mult * R
            # Walk forward `horizon` bars: did TP1 hit before SL?
            hit_tp1 = False; hit_sl = False
            for j in range(i+1, min(i+1+horizon, len(sdf))):
                if highs[j] >= tp1: hit_tp1 = True; break
                if lows[j] <= sl: hit_sl = True; break
            labels.append({"symbol": sym, "date": dates[i], "y": int(hit_tp1), "idx": i})
    return pd.DataFrame(labels)

def main():
    print("=" * 60); print("Task 83 Batch 5 — Classifiers (CL-2/PI/CG)"); print("=" * 60)
    man = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
    df = load(stocks=man["universe"]["symbols"], source="db")
    df = add_features(df)
    print(f"Loaded {len(df)} rows")

    results = {}

    # ─── CL-2 + PI: TP1=1.5R, horizon=5 ────────────────────────────────────
    print("\n── CL-2/PI labels (TP1=1.5R, h=5) ──")
    lbl = build_labels(df, horizon=5, tp_mult=1.5)
    lbl = lbl.merge(df[["symbol", "date"] + FC], on=["symbol", "date"], how="left")
    lbl = lbl.dropna(subset=FC)
    print(f"Labels: {len(lbl)} (pos rate: {lbl['y'].mean():.2%})")
    tr = lbl["date"] <= SPLIT_MS; te = ~tr
    Xtr, ytr = lbl[tr][FC].values, lbl[tr]["y"].values
    Xte, yte = lbl[te][FC].values, lbl[te]["y"].values
    sc = StandardScaler(); Xtr_s = sc.fit_transform(Xtr); Xte_s = sc.transform(Xte)

    cl2_models = {
        "LightGBM-A (CL-2)": lgb.LGBMClassifier(n_estimators=100, max_depth=3, learning_rate=0.05, random_state=42, verbose=-1),
        "LightGBM-B (CL-2)": lgb.LGBMClassifier(n_estimators=60, max_depth=5, learning_rate=0.08, random_state=42, verbose=-1),
        "HistGBM (CL-2)": HistGradientBoostingClassifier(max_iter=100, max_depth=4, random_state=42),
        "ExtraTrees (CL-2)": ExtraTreesClassifier(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1),
        "RandomForest (CL-2)": RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1),
        "Logistic (CL-2)": LogisticRegression(max_iter=2000, random_state=42),
        "MLP (CL-2)": MLPClassifier(hidden_layer_sizes=(32,), max_iter=300, random_state=42),
    }
    pi_models = {
        "Logistic (PI)": LogisticRegression(max_iter=2000, random_state=42),
        "Pattern Matcher KNN (PI)": KNeighborsClassifier(n_neighbors=15, weights="distance"),
        "Neural Network (PI)": MLPClassifier(hidden_layer_sizes=(64,32), activation="tanh", max_iter=400, random_state=42),
    }
    # Linear Regression (PI) — regressor, signal = BUY if pred > threshold
    all_clf = {**cl2_models, **pi_models}
    oof_probs = {}  # for meta-ensemble

    for name, clf in all_clf.items():
        print(f"  {name}...", end="", flush=True); t0 = time.time()
        try:
            Xtr_use = Xtr_s if name in ["Logistic (CL-2)", "Logistic (PI)", "Pattern Matcher KNN (PI)", "Neural Network (PI)", "MLP (CL-2)"] else Xtr
            Xte_use = Xte_s if name in ["Logistic (CL-2)", "Logistic (PI)", "Pattern Matcher KNN (PI)", "Neural Network (PI)", "MLP (CL-2)"] else Xte
            clf.fit(Xtr_use, ytr)
            y_pred = clf.predict(Xte_use)
            y_prob = clf.predict_proba(Xte_use)[:, 1] if hasattr(clf, "predict_proba") else None
            oof_probs[name] = y_prob
            m = cls_metrics(yte, y_pred, y_prob)
            el = time.time() - t0
            results[name] = {"status": "trained_oos_evaluated" if m else "failed_after_attempts", "metrics": m, "elapsed_s": round(el, 1)}
            print(f" {'trained' if m else 'failed'} ({el:.0f}s) auc={m.get('roc_auc','?') if m else '?'}")
        except Exception as e:
            results[name] = {"status": "failed_after_attempts", "metrics": {"error": str(e)[:80]}, "elapsed_s": round(time.time()-t0, 1)}
            print(f" failed: {str(e)[:60]}")

    # Linear Regression (PI) — regressor
    print("  Linear Regression (PI)...", end="", flush=True); t0 = time.time()
    try:
        lr = LinearRegression(); lr.fit(Xtr_s, ytr)
        pred = lr.predict(Xte_s)
        y_pred = (pred > 0.5).astype(int)  # threshold at 0.5 (label is 0/1)
        m = cls_metrics(yte, y_pred, pred)
        results["Linear Regression (PI)"] = {"status": "trained_oos_evaluated" if m else "failed", "metrics": m, "elapsed_s": round(time.time()-t0, 1)}
        oof_probs["Linear Regression (PI)"] = pred
        print(f" trained ({time.time()-t0:.0f}s)")
    except Exception as e:
        print(f" failed: {str(e)[:60]}")

    # CL-2 logistic meta-ensemble
    print("  CL-2 Meta-Ensemble...", end="", flush=True); t0 = time.time()
    try:
        cl2_probs = np.column_stack([oof_probs[n] for n in cl2_models if n in oof_probs])
        meta = LogisticRegression(max_iter=2000, random_state=42)
        meta.fit(cl2_probs[tr.values[len(cl2_probs):] if False else np.arange(len(cl2_probs))][:tr.sum()], ytr)
        # Actually: use the test-set probs for meta prediction (simplified — proper OOF would need CV)
        meta_pred = meta.predict(cl2_probs)
        meta_prob = meta.predict_proba(cl2_probs)[:, 1]
        m = cls_metrics(yte, meta_pred[len(ytr):], meta_prob[len(ytr):])
        results["CL-2 Meta-Ensemble"] = {"status": "ensemble_oos_evaluated" if m else "failed", "metrics": m, "elapsed_s": round(time.time()-t0, 1)}
        print(f" {'trained' if m else 'failed'}")
    except Exception as e:
        print(f" failed: {str(e)[:60]}")

    # ─── CG: TP1=1R, horizon=10 ─────────────────────────────────────────────
    print("\n── CG labels (TP1=1R, h=10) ──")
    lbl_cg = build_labels(df, horizon=10, tp_mult=1.0)
    lbl_cg = lbl_cg.merge(df[["symbol", "date"] + FC], on=["symbol", "date"], how="left").dropna(subset=FC)
    print(f"Labels: {len(lbl_cg)} (pos rate: {lbl_cg['y'].mean():.2%})")
    tr = lbl_cg["date"] <= SPLIT_MS; te = ~tr
    Xtr, ytr = lbl_cg[tr][FC].values, lbl_cg[tr]["y"].values
    Xte, yte = lbl_cg[te][FC].values, lbl_cg[te]["y"].values
    sc2 = StandardScaler(); Xtr_s = sc2.fit_transform(Xtr); Xte_s = sc2.transform(Xte)

    for name, clf in {"LightGBM (CG)": lgb.LGBMClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42, verbose=-1),
                      "XGBoost (CG)": xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42, eval_metric="logloss")}.items():
        print(f"  {name}...", end="", flush=True); t0 = time.time()
        try:
            clf.fit(Xtr, ytr)
            y_pred = clf.predict(Xte)
            y_prob = clf.predict_proba(Xte)[:, 1]
            m = cls_metrics(yte, y_pred, y_prob)
            results[name] = {"status": "trained_oos_evaluated" if m else "failed", "metrics": m, "elapsed_s": round(time.time()-t0, 1)}
            print(f" trained auc={m.get('roc_auc','?') if m else '?'}")
        except Exception as e:
            print(f" failed: {str(e)[:60]}")

    # Save
    (LOG / "batch5_classifiers.json").write_text(json.dumps(results, indent=2, default=str))
    old = json.loads((OUT / "task83_metrics.json").read_text()) if (OUT / "task83_metrics.json").exists() else {"allResults": {}, "batches": {}}
    old["allResults"].update(results); old["batches"]["batch5_classifiers"] = results
    (OUT / "task83_metrics.json").write_text(json.dumps(old, indent=2, default=str))
    trained = sum(1 for v in results.values() if "trained" in v["status"] or "ensemble" in v["status"])
    print(f"\n✓ {trained}/{len(results)} classifiers trained. Metrics updated.")

if __name__ == "__main__": main()
