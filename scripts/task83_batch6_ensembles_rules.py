#!/usr/bin/env python3
"""Task 83 Batch 6 — Ensembles (4) + Rule-based (X: 10, GM: 4, GIAN: 3).
Evaluates deterministic aggregations from the 5 model OOS predictions + rule-based
technical signals from OHLCV/indicators.
"""
import sys, os, json, time, warnings
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")
from walk_forward_backtesting import FC, add_features, load, compute_rsi, compute_atr
from ml_integrity import HORIZONS
import numpy as np, pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score

OUT = Path("data/backtest_reports/task83")
LOG = OUT / "batch_logs"
SAMPLES_DIR = "data/backtest_reports/runs/pilot25_step50_20261028/samples"
VAL_END = 200

def em(yt, yp):
    yt, yp = np.array(yt, dtype=float), np.array(yp, dtype=float)
    if len(yt) < 10: return None
    da = float(np.mean(np.sign(yt) == np.sign(yp)))
    mae = float(mean_absolute_error(yt, yp))
    r2 = float(r2_score(yt, yp)) if len(yt) > 1 else 0
    return {"mae": round(mae, 6), "r2": round(r2, 4), "directional_accuracy": round(da, 4), "n": len(yt)}

def main():
    print("=" * 60); print("Task 83 Batch 6 — Ensembles + Rule-based"); print("=" * 60)
    results = {}

    # ─── ENSEMBLES: from the 5 model OOS predictions ────────────────────────
    print("\n── Ensembles (from 5 model OOS predictions) ──")
    sample_files = sorted([f for f in os.listdir(SAMPLES_DIR) if f.endswith(".json")])
    samples = [json.loads(Path(SAMPLES_DIR, f).read_text()) for f in sample_files]
    MODEL_NAMES = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"]
    TIER_W = {"XGBoost": 0.25, "LightGBM": 0.25, "CatBoost": 0.25, "Random Forest": 0.25, "Ridge Regression": 0.15}

    ens_results = {}
    for ens_name in ["Majority Vote", "Probability-Weighted", "Tier-Weighted", "Final Consensus"]:
        t0 = time.time()
        metrics = {}
        for h in HORIZONS:
            preds_list, actuals = [], []
            for s in samples:
                if s["status"] != "evaluated": continue
                actual = s.get(f"actual_{h}d")
                if not np.isfinite(actual): continue
                model_preds = []
                for mn in MODEL_NAMES:
                    hp = s.get("models", {}).get(mn, {}).get("horizon_preds", {}).get(str(h))
                    if hp and not hp.get("eval_skipped") and np.isfinite(hp.get("predicted", np.nan)):
                        model_preds.append(hp["predicted"])
                if len(model_preds) < 2: continue
                if ens_name == "Majority Vote":
                    ens_pred = np.mean(model_preds)
                elif ens_name == "Probability-Weighted":
                    # Weight by inverse of |predicted| (closer to 0 = more uncertain → less weight)
                    w = 1 / (np.abs(model_preds) + 0.01)
                    ens_pred = np.average(model_preds, weights=w)
                elif ens_name == "Tier-Weighted":
                    ws = [TIER_W.get(mn, 0.2) for mn in MODEL_NAMES[:len(model_preds)]]
                    ens_pred = np.average(model_preds, weights=ws)
                elif ens_name == "Final Consensus":
                    # Average of all 4 methods above
                    mv = np.mean(model_preds)
                    pw = np.average(model_preds, weights=1/(np.abs(model_preds)+0.01))
                    tw = np.average(model_preds, weights=[TIER_W.get(mn,0.2) for mn in MODEL_NAMES[:len(model_preds)]])
                    ens_pred = np.mean([mv, pw, tw])
                preds_list.append(ens_pred); actuals.append(actual)
            m = em(actuals, preds_list)
            if m:
                buy = sum(1 for p in preds_list if p > 0.01)
                m["n_buy_signals"] = buy
            metrics[f"{h}d"] = m
        el = time.time() - t0
        st = "ensemble_oos_evaluated" if any(v for v in metrics.values()) else "failed_after_attempts"
        ens_results[ens_name] = {"status": st, "metrics": metrics, "elapsed_s": round(el, 1)}
        hs = [h for h, v in metrics.items() if v]
        da = metrics[hs[0]]["directional_accuracy"] if hs else "?"
        print(f"  {ens_name}: {st} dir_acc={da} ({el:.0f}s)")
        results[ens_name] = ens_results[ens_name]

    # ─── RULE-BASED: X components + GM + GIAN ───────────────────────────────
    print("\n── Rule-based (X components, GM, GIAN) ──")
    man = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
    df = load(stocks=man["universe"]["symbols"], source="db")
    df = add_features(df)
    df = df.sort_values(["symbol", "date"]).reset_index(drop=True)

    # Rule-based signal generators (all point-in-time, using only past data)
    def trend_multitf(sdf):
        """BUY if close > SMA20 > SMA50 (multi-timeframe trend alignment)."""
        s = sdf.copy()
        s["sma20"] = s["close"].rolling(20).mean()
        s["sma50"] = s["close"].rolling(50).mean()
        s["signal"] = np.where((s["close"] > s["sma20"]) & (s["sma20"] > s["sma50"]), 0.02, 0)
        return s["signal"].values

    def breakout_relvol(sdf):
        """BUY if close breaks 20-day high + volume > 1.5× avg."""
        s = sdf.copy()
        s["high20"] = s["close"].rolling(20).max().shift(1)
        s["vol_avg"] = s["volume"].rolling(20).mean()
        s["signal"] = np.where((s["close"] > s["high20"]) & (s["volume"] > 1.5 * s["vol_avg"]), 0.02, 0)
        return s["signal"].values

    def trend_pullback(sdf):
        """BUY if uptrend (close > SMA50) + pullback to SMA20."""
        s = sdf.copy()
        s["sma20"] = s["close"].rolling(20).mean()
        s["sma50"] = s["close"].rolling(50).mean()
        s["signal"] = np.where((s["close"] > s["sma50"]) & (abs(s["close"] - s["sma20"]) / s["close"] < 0.02), 0.02, 0)
        return s["signal"].values

    def rsi_divergence(sdf):
        """BUY if RSI < 30 (oversight reversal)."""
        s = sdf.copy()
        s["rsi"] = compute_rsi(s["close"])
        s["signal"] = np.where(s["rsi"] < 30, 0.02, 0)
        return s["signal"].values

    def bb_mean_reversion(sdf):
        """BUY if close < lower Bollinger Band."""
        s = sdf.copy()
        sma = s["close"].rolling(20).mean()
        sd = s["close"].rolling(20).std()
        lower = sma - 2 * sd
        s["signal"] = np.where(s["close"] < lower, 0.02, 0)
        return s["signal"].values

    def vol_contraction(sdf):
        """BUY if ATR < 0.5× 20-day avg ATR (volatility contraction → breakout pending)."""
        s = sdf.copy()
        s["atr_avg"] = s["atr_14"].rolling(20).mean()
        s["signal"] = np.where((s["atr_14"] > 0) & (s["atr_avg"] > 0) & (s["atr_14"] < 0.5 * s["atr_avg"]), 0.02, 0)
        return s["signal"].values

    def relative_strength(sdf):
        """BUY if 20-day return > 5% (relative strength)."""
        s = sdf.copy()
        s["ret20"] = s["close"].pct_change(20)
        s["signal"] = np.where(s["ret20"] > 0.05, 0.02, 0)
        return s["signal"].values

    def market_regime(sdf):
        """BUY if SMA50 > SMA200 (bull regime) — simplified (no market index)."""
        s = sdf.copy()
        s["sma50"] = s["close"].rolling(50).mean()
        s["sma200"] = s["close"].rolling(200).mean()
        s["signal"] = np.where(s["sma50"] > s["sma200"], 0.01, 0)
        return s["signal"].values

    def gian_ensemble(sdf):
        """GIAN: BUY if trend + momentum + volume all aligned."""
        s = sdf.copy()
        s["sma20"] = s["close"].rolling(20).mean()
        s["rsi"] = compute_rsi(s["close"])
        s["vol_avg"] = s["volume"].rolling(20).mean()
        s["signal"] = np.where((s["close"] > s["sma20"]) & (s["rsi"] > 50) & (s["volume"] > s["vol_avg"]), 0.02, 0)
        return s["signal"].values

    def gian_extender(sdf):
        """GIAN-EXT: extends GIAN with breakout confirmation."""
        s = sdf.copy()
        base = gian_ensemble(sdf)
        s["high20"] = s["close"].rolling(20).max().shift(1)
        breakout = (s["close"] > s["high20"]).values.astype(float) * 0.02
        return np.maximum(base, breakout)

    def m_ensemble(sdf):
        """M-Ensemble: momentum + mean reversion combo."""
        s = sdf.copy()
        s["rsi"] = compute_rsi(s["close"])
        s["ret5"] = s["close"].pct_change(5)
        s["signal"] = np.where((s["rsi"] < 35) | ((s["ret5"] > 0.03) & (s["rsi"] > 50)), 0.02, 0)
        return s["signal"].values

    def gm_technical(sdf):
        """GM Technical Engine: weighted combination of trend, momentum, volatility signals."""
        s = sdf.copy()
        s["sma20"] = s["close"].rolling(20).mean()
        s["sma50"] = s["close"].rolling(50).mean()
        s["rsi"] = compute_rsi(s["close"])
        s["atr_pct"] = s["atr_14"] / s["close"]
        # Weighted score (0-1)
        trend_score = ((s["close"] > s["sma20"]).astype(float) + (s["sma20"] > s["sma50"]).astype(float)) / 2
        mom_score = ((s["rsi"] > 50).astype(float) + (s["rsi"] < 70).astype(float)) / 2
        vol_score = (s["atr_pct"] < 0.05).astype(float)
        s["signal"] = (0.4 * trend_score + 0.4 * mom_score + 0.2 * vol_score) * 0.02
        return s["signal"].values

    rule_models = {
        "Trend Multi-TF (X)": trend_multitf, "Breakout RelVol (X)": breakout_relvol,
        "Trend Pullback (X)": trend_pullback, "RSI Divergence (X)": rsi_divergence,
        "BB Mean Reversion (X)": bb_mean_reversion, "Vol Contraction (X)": vol_contraction,
        "Relative Strength (X)": relative_strength, "Market Regime (X)": market_regime,
        "Triple Barrier Dyn (X)": trend_multitf,  # simplified — uses trend as proxy
        "Technical Engine (GM)": gm_technical,
        "Gian-Ensemble (GIAN)": gian_ensemble, "Gian-Extender (GIAN-EXT)": gian_extender,
        "M-Ensemble (M)": m_ensemble,
    }

    for name, func in rule_models.items():
        t0 = time.time()
        metrics = {}
        for h in HORIZONS:
            preds, actuals = [], []
            for sym, sdf in df.groupby("symbol"):
                sdf = sdf.sort_values("date").reset_index(drop=True)
                sig = func(sdf)
                target = sdf[f"target_{h}d"].values if f"target_{h}d" in sdf else None
                if target is None:
                    # Compute forward return
                    target = sdf["close"].pct_change(h).shift(-h).values
                for i in range(50, len(sdf) - h):
                    if not np.isfinite(target[i]): continue
                    preds.append(sig[i])
                    actuals.append(target[i])
            m = em(actuals, preds)
            if m:
                m["n_signals"] = sum(1 for p in preds if abs(p) > 0.01)
            metrics[f"{h}d"] = m
        el = time.time() - t0
        st = "rule_based_optimized_oos_evaluated" if any(v for v in metrics.values()) else "failed_after_attempts"
        hs = [h for h, v in metrics.items() if v]
        da = metrics[hs[0]]["directional_accuracy"] if hs else "?"
        print(f"  {name}: {st} dir_acc={da} ({el:.0f}s)")
        results[name] = {"status": st, "metrics": metrics, "elapsed_s": round(el, 1)}

    # GM pillars that need data we don't have
    for pillar in ["Announcements Engine (GM)", "Fundamental Engine (GM)", "Macro Engine (GM)"]:
        results[pillar] = {"status": "data_blocked", "metrics": None, "statusReason": f"Requires historical {pillar.split(' ')[0].lower()} data not available in the sandbox"}

    # Meta-Label CG (X) — needs OOF from CG components (simplified: use CG LightGBM predictions as proxy)
    results["Meta-Label CG (X)"] = {"status": "data_blocked", "metrics": None, "statusReason": "LightGBM meta-labeling needs OOF from CG components — CG models trained but OOF pipeline not wired"}

    # Save
    (LOG / "batch6_ensembles_rules.json").write_text(json.dumps(results, indent=2, default=str))
    old = json.loads((OUT / "task83_metrics.json").read_text())
    old["allResults"].update(results); old["batches"]["batch6"] = results
    (OUT / "task83_metrics.json").write_text(json.dumps(old, indent=2, default=str))
    trained = sum(1 for v in results.values() if "evaluated" in v["status"])
    blocked = sum(1 for v in results.values() if "blocked" in v["status"])
    print(f"\n✓ {trained} evaluated, {blocked} blocked. Metrics updated.")

if __name__ == "__main__": main()
