#!/usr/bin/env python3
"""Add 8 missing ensembles to ml_predictions_multi.json by combining
the existing 22 trained models in different ways, then backtest each.

This is much faster than retraining — we just need to:
1. Load the existing predictions for all 22 models
2. For each new ensemble, combine selected models' predictions per stock
3. Backtest the combined signal on historical OHLCV data
4. Add to ensemble_backtesting section + save ensemble predictions

Ensembles to add:
  - CL2_ENSEMBLE     — LightGBM 50% + CatBoost 30% + Ridge 20% (CL variant)
  - PI_ENSEMBLE      — ARIMA 40% + Holt-Winters 30% + Prophet 30% (Pattern+Indicator)
  - GM_MODEL          — XGBoost 35% + LightGBM 30% + CatBoost 20% + RF 15% (4-pillar weighted)
  - CG_ENSEMBLE       — LightGBM 50% + XGBoost 50% (per CG script spec)
  - X_ENSEMBLE        — Equal-weight vote of 5 regressors (multi-strategy)
  - GIAN_ENSEMBLE     — Equal-weight of 3 deep models (LSTM, CNN-LSTM, Transformer-LSTM)
  - GIAN_EXTENDER     — Equal-weight of 4 SOTA models (PatchTST, N-BEATS, TimesNet, Informer)
  - M_ENSEMBLE        — Equal-weight of 4 foundation models (Chronos, Lag-Llama, Moirai, Time-LLM)
"""
import json, sys, warnings, time
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

OHLCV_DIR = Path("data/ohlcv_all")
PRED_FILE = Path("data/ml_predictions_multi.json")

# ATR/SL/TP rules — must match the retrain script
SL_MULT = 1.5
TP1_MULT = 1.0
TP2_MULT = 2.0
TP3_MULT = 3.0

# Ensemble definitions: name → list of (model_name, weight)
ENSEMBLES = {
    "CL2_ENSEMBLE": [
        ("LightGBM", 0.50),
        ("CatBoost", 0.30),
        ("Ridge Regression", 0.20),
    ],
    "PI_ENSEMBLE": [
        ("ARIMA", 0.40),
        ("Holt-Winters", 0.30),
        ("Prophet", 0.30),
    ],
    "GM_MODEL": [
        ("XGBoost", 0.35),
        ("LightGBM", 0.30),
        ("CatBoost", 0.20),
        ("Random Forest", 0.15),
    ],
    "CG_ENSEMBLE": [
        ("LightGBM", 0.50),
        ("XGBoost", 0.50),
    ],
    "X_ENSEMBLE": [
        ("XGBoost", 0.20),
        ("LightGBM", 0.20),
        ("CatBoost", 0.20),
        ("Random Forest", 0.20),
        ("Ridge Regression", 0.20),
    ],
    "GIAN_ENSEMBLE": [
        ("LSTM", 0.333),
        ("CNN-LSTM", 0.333),
        ("Transformer-LSTM", 0.334),
    ],
    "GIAN_EXTENDER": [
        ("PatchTST", 0.25),
        ("N-BEATS", 0.25),
        ("TimesNet", 0.25),
        ("Informer", 0.25),
    ],
    "M_ENSEMBLE": [
        ("Chronos (Amazon)", 0.25),
        ("Lag-Llama", 0.25),
        ("Moirai (Salesforce)", 0.25),
        ("Time-LLM", 0.25),
    ],
}


def load_ohlcv_data():
    """Load OHLCV data for all stocks with CSV files."""
    print("Loading OHLCV data...")
    stocks = sorted([f.stem for f in OHLCV_DIR.glob("*.csv")])
    frames = []
    for s in stocks:
        p = OHLCV_DIR / f"{s}.csv"
        try:
            df = pd.read_csv(p, usecols=range(6))
            df = df[df["volume"] > 0].reset_index(drop=True)
            if len(df) < 50:
                continue
            df["symbol"] = s
            frames.append(df)
        except Exception:
            pass
    if not frames:
        return pd.DataFrame(), []
    df = pd.concat(frames, ignore_index=True)
    print(f"  Loaded {len(df)} rows, {df['symbol'].nunique()} stocks")
    return df, stocks


def get_atr_per_stock(df):
    """Compute current price + ATR per stock."""
    print("Computing ATR per stock...")
    result = {}
    for s in df["symbol"].unique():
        sd = df[df["symbol"] == s].sort_values("date").reset_index(drop=True)
        if len(sd) < 14:
            continue
        # ATR (14-period)
        h, l, c = sd["high"], sd["low"], sd["close"].shift()
        tr = pd.concat([
            h - l,
            (h - c).abs(),
            (l - c).abs(),
        ], axis=1).max(axis=1)
        atr = tr.rolling(14).mean().iloc[-1]
        if pd.isna(atr) or atr <= 0:
            atr = float(sd.iloc[-1]["close"]) * 0.02
        result[s] = {
            "cp": float(sd.iloc[-1]["close"]),
            "atr": float(atr),
        }
    print(f"  ATR computed for {len(result)} stocks")
    return result


def combine_predictions(stock, model_preds, ensemble_def, atr_per):
    """Combine multiple models' predictions for a single stock into one ensemble signal.
    Uses WEIGHTED AVERAGE of avgReturn (not weighted vote) — this matches the
    existing CL_ENSEMBLE logic and produces meaningful BUY/SELL signals.
    Threshold: ±0.005 (0.5%) — BUY if avg > 0.005, SELL if avg < -0.005.
    """
    ar_weighted = 0.0
    cp = 0.0
    total_weight = 0.0
    for model_name, weight in ensemble_def:
        pred = model_preds.get(model_name, {}).get("predictions", {}).get(stock, {})
        if not pred:
            continue
        ar = pred.get("avgReturn", 0)
        ar_weighted += ar * weight
        cp = pred.get("currentPrice", cp)
        total_weight += weight

    if total_weight == 0:
        sig = "HOLD"
    else:
        ar_avg = ar_weighted / total_weight if total_weight > 0 else 0
        # Same threshold as existing CL_ENSEMBLE: ±0.005 (0.5%)
        if ar_avg > 0.005:
            sig = "BUY"
        elif ar_avg < -0.005:
            sig = "SELL"
        else:
            sig = "HOLD"

    direction = "SHORT" if sig == "SELL" else "LONG"
    confidence = min(100, int(abs(ar_weighted) * 1000))
    atr = atr_per.get(stock, {"atr": cp * 0.02})["atr"]

    # Compute SL/TP using ATR rule (same as retrain script)
    if sig == "BUY":
        entry = cp
        sl = cp - SL_MULT * atr
        tp1 = cp + TP1_MULT * atr
        tp2 = cp + TP2_MULT * atr
        tp3 = cp + TP3_MULT * atr
    elif sig == "SELL":
        entry = cp
        sl = cp + SL_MULT * atr
        tp1 = cp - TP1_MULT * atr
        tp2 = cp - TP2_MULT * atr
        tp3 = cp - TP3_MULT * atr
    else:
        entry = cp
        sl = cp
        tp1 = cp
        tp2 = cp
        tp3 = cp

    return {
        "signal": sig,
        "direction": direction,
        "confidence": confidence,
        "currentPrice": round(cp, 2),
        "entry": round(entry, 2),
        "tp1": round(tp1, 2),
        "tp2": round(tp2, 2),
        "tp3": round(tp3, 2),
        "sl": round(sl, 2),
        "avgReturn": round(float(ar_weighted) if not np.isnan(ar_weighted) else 0.0, 4),
    }


def atr_rules(sig, cp, atr):
    if sig == "BUY":
        return cp, cp - SL_MULT * atr, cp + TP1_MULT * atr, cp + TP2_MULT * atr, cp + TP3_MULT * atr
    if sig == "SELL":
        return cp, cp + SL_MULT * atr, cp - TP1_MULT * atr, cp - TP2_MULT * atr, cp - TP3_MULT * atr
    return cp, cp, cp, cp, cp


def backtest_ensemble(df, ensemble_preds, atr_per, name):
    """Backtest an ensemble's predictions on the historical OHLCV data —
    DISABLED (Phase 4 B-AUDIT Pattern #10 leak).

    Original implementation: per-stock 80/20 chronological test slice (the slice
    itself was leak-free), but the SIGNAL applied to every historical test row
    came from `ensemble_preds[sym].get("signal", "HOLD")` — the ensemble's
    STORED LATEST per-stock signal (built by combine_predictions from the
    underlying per-model predictions stored in ml_predictions_multi.json). This
    is leakage Pattern #10 (latest-signal replay): today's signal applied to
    historical test dates, which misrepresents the historical out-of-sample
    performance of the ensemble.

    For the leak-free chronological walk-forward evaluation, see
    scripts/walk_forward_backtesting.py. Do NOT duplicate a new walk-forward
    engine here.

    External interface preserved: same signature (df, ensemble_preds, atr_per,
    name) and same top-level return keys (totalTrades / buySignals /
    sellSignals / correctBuys / correctSells / winRate / avgReturnPct /
    maxReturnPct / minReturnPct / stars). Values signal unavailability.
    Callers that already handle 0-trade / null-winRate results continue to work.
    """
    print(f"  Backtest of {name}: UNAVAILABLE — Pattern #10 leak (latest-signal replay). "
          f"Use scripts/walk_forward_backtesting.py for leak-free eval.")
    return {
        "status": "unavailable",
        "reason": ("Pattern #10 LEAKY_BACKTEST: original implementation applied "
                   "the ensemble's stored LATEST per-stock signal "
                   "(ensemble_preds[sym].get('signal', 'HOLD')) to every historical "
                   "test row. This misrepresents historical OOS performance. Use "
                   "scripts/walk_forward_backtesting.py for leak-free chronological "
                   "walk-forward evaluation."),
        "pointer": "scripts/walk_forward_backtesting.py",
        "ml_integrity_note": "Phase 4 B-AUDIT: function disabled to prevent misleading metrics.",
        "totalTrades": 0,
        "buySignals": 0,
        "sellSignals": 0,
        "correctBuys": 0,
        "correctSells": 0,
        "winRate": None,
        "avgReturnPct": None,
        "maxReturnPct": None,
        "minReturnPct": None,
        "stars": 0,
    }


def main():
    start_time = time.time()
    print("=" * 60)
    print("Adding 8 missing ensembles to ml_predictions_multi.json")
    print("=" * 60)

    # Load existing predictions
    print("\n[1/4] Loading existing predictions...")
    with open(PRED_FILE) as f:
        data = json.load(f)
    model_preds = data.get("models", {})
    print(f"  Loaded {len(model_preds)} trained models")

    # Load OHLCV data + compute ATR
    df, stocks = load_ohlcv_data()
    atr_per = get_atr_per_stock(df)

    # Compute + backtest each new ensemble
    print(f"\n[2/4] Computing {len(ENSEMBLES)} new ensembles...")
    new_ensemble_bt = {}
    new_ensemble_preds = {}

    for ens_name, ens_def in ENSEMBLES.items():
        print(f"\n  [{ens_name}]")
        # Compute predictions for each stock
        preds = {}
        for sym in stocks:
            try:
                preds[sym] = combine_predictions(sym, model_preds, ens_def, atr_per)
            except Exception as e:
                pass
        new_ensemble_preds[ens_name.lower()] = preds
        print(f"    Predictions: {len(preds)} stocks")
        # Show sample signals
        buys = sum(1 for p in preds.values() if p.get("signal") == "BUY")
        sells = sum(1 for p in preds.values() if p.get("signal") == "SELL")
        holds = sum(1 for p in preds.values() if p.get("signal") == "HOLD")
        print(f"    Signals: {buys} BUY / {sells} SELL / {holds} HOLD")

        # Backtest
        bt = backtest_ensemble(df, preds, atr_per, ens_name)
        new_ensemble_bt[ens_name] = bt
        print(f"    Result: trades={bt['totalTrades']} WR={bt['winRate']}% avg={bt['avgReturnPct']}%")

    # Merge into existing data
    print("\n[3/4] Merging into ml_predictions_multi.json...")
    existing_ens_bt = data.get("ensemble_backtesting", {})
    existing_ens_bt.update(new_ensemble_bt)
    data["ensemble_backtesting"] = existing_ens_bt

    # Add ensemble predictions as new top-level keys
    for ens_name, preds in new_ensemble_preds.items():
        key = f"{ens_name}_predictions"
        data[key] = preds

    # Update timestamp
    data["trained_at"] = pd.Timestamp.now().isoformat()
    data["ensembles_count"] = len(existing_ens_bt)

    # Phase 4 B-AUDIT: ml_integrity documentation. The 8 new ensembles'
    # backtest_ensemble was replaced with an unavailable stub because the
    # original applied the ensemble's STORED LATEST per-stock signal to every
    # historical test row (Pattern #10 leak). The per-stock 80/20 chronological
    # test slice itself is fine; only the signal source was leaky. For the
    # leak-free chronological walk-forward evaluation, see
    # scripts/walk_forward_backtesting.py. Ensemble PREDICTIONS (the per-stock
    # combine_predictions output) are still computed and stored — only the
    # backtest of those predictions against historical OHLCV is disabled.
    data["ml_integrity"] = {
        "backtest_methodology": (
            "Phase 4 B-AUDIT: backtest_ensemble replaced with unavailable stub. "
            "Original implementation applied the ensemble's stored LATEST "
            "per-stock signal (ensemble_preds[sym].get('signal', 'HOLD')) to "
            "every historical test row — Pattern #10 LEAKY_BACKTEST (latest-"
            "signal replay). The per-stock 80/20 chronological test slice is "
            "fine; the signal source was the leak."
        ),
        "pattern": "Pattern #10 LEAKY_BACKTEST (latest-signal replay)",
        "status": "unavailable",
        "reason": (
            "Stored latest per-stock ensemble signal applied to every historical "
            "test row; misrepresents historical OOS performance."
        ),
        "pointer": "scripts/walk_forward_backtesting.py",
        "scope_note": (
            "Phase 4 scope is backtesting/metric correctness. Training-pipeline "
            "leakage (LEAKY_SPLIT / LEAKY_SCALER / LEAKY_TARGET / LEAKY_SEQUENCE) "
            "is Phase A scope and documented separately."
        ),
        "predictions_note": (
            "Ensemble PREDICTIONS (the per-stock combine_predictions output "
            "stored under {ensemble_name}_predictions keys) are still computed "
            "and stored — these are LIVE inference-time outputs and are not "
            "leaky in themselves. Only the historical backtest of those "
            "predictions against OHLCV is disabled here."
        ),
    }

    # Save
    print("\n[4/4] Saving updated file...")
    # Clean NaN/Inf values
    def clean(o):
        if isinstance(o, dict):
            return {k: clean(v) for k, v in o.items()}
        if isinstance(o, list):
            return [clean(v) for v in o]
        if isinstance(o, float):
            if np.isnan(o) or np.isinf(o):
                return 0
            return o
        return o
    data = clean(data)

    PRED_FILE.write_text(json.dumps(data, indent=2, allow_nan=False,
        default=lambda o: int(o) if isinstance(o, (np.integer,)) else
                          float(o) if isinstance(o, (np.floating,)) else str(o)))

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"COMPLETE — {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"{'=' * 60}")
    print(f"\nAll ensembles now in ensemble_backtesting:")
    for name, bt in existing_ens_bt.items():
        print(f"  {name}: WR={bt.get('winRate')}% trades={bt.get('totalTrades')}")
    print(f"\nFile size: {PRED_FILE.stat().st_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
