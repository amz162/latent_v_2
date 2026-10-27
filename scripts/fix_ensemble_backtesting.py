#!/usr/bin/env python3
"""Latent.pk — Fix Majority Vote backtesting + add CL-Ensemble/CL-Extender to backtesting modal.

The ensemble_backtesting dict in ml_predictions_multi.json has these entries:
  - MAJORITY_VOTE: 0 trades (BUG: was producing all-HOLD signals)
  - PROBABILITY_WEIGHTED, TIER_WEIGHTED, FINAL_CONSENSUS, WIN_RATE_WEIGHTED

Missing entries:
  - CL_ENSEMBLE
  - CL_EXTENDER

This script:
1. Re-backtests MAJORITY_VOTE with per-stock split + adaptive window (so it gets proper trades)
2. Adds CL_ENSEMBLE and CL_EXTENDER entries to ensemble_backtesting dict
3. Re-backtests all 3 base ensembles + final consensus + CL-Ensemble + CL-Extender
"""
import json, sys, warnings, numpy as np, pandas as pd
from pathlib import Path
warnings.filterwarnings("ignore")

PRED_FILE = Path("data/ml_predictions_multi.json")
STOCKS = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL"]


def compute_rsi(p, n=14):
    d = p.diff(); g = d.where(d > 0, 0); l = -d.where(d < 0, 0)
    ag = g.ewm(alpha=1/n, min_periods=n).mean(); al = l.ewm(alpha=1/n, min_periods=n).mean()
    return (100 - 100 / (1 + ag / al.replace(0, np.nan))).fillna(50)


def compute_macd(p):
    e12 = p.ewm(span=12, adjust=False).mean(); e26 = p.ewm(span=26, adjust=False).mean()
    m = e12 - e26; s = m.ewm(span=9, adjust=False).mean(); return m, s, m - s


def compute_bb(p, w=20):
    sma = p.rolling(w).mean(); sd = p.rolling(w).std()
    return ((sma + 2*sd - (sma - 2*sd)) / sma).fillna(0), \
           ((p - (sma - 2*sd)) / (4*sd).replace(0, np.nan)).fillna(0.5)


def compute_atr(h, l, c, n=14):
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean().fillna(0)


def compute_obv(c, v):
    s = c.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
    return (s * v).cumsum()


def add_features(df):
    df = df.copy().sort_values("date").reset_index(drop=True)
    c = df["close"]; h = df["high"]; l = df["low"]; v = df["volume"]
    df["rsi_14"] = compute_rsi(c); m, s, hh = compute_macd(c)
    df["macd"] = m; df["macd_signal"] = s; df["macd_hist"] = hh
    bw, pb = compute_bb(c); df["bb_width"] = bw; df["bb_pct_b"] = pb
    df["atr_14"] = compute_atr(h, l, c)
    obv = compute_obv(c, v)
    df["obv_change_pct"] = obv.pct_change(periods=14).replace([np.inf, -np.inf], 0).fillna(0)
    for w in [20, 50, 200]:
        df[f"price_sma_{w}_ratio"] = c / c.rolling(w, min_periods=1).mean()
    df["volume_sma_20_ratio"] = v / v.rolling(20, min_periods=1).mean().replace(0, 1)
    for p in [1, 5, 7, 14, 30]:
        df[f"return_{p}d"] = c.pct_change(periods=p).replace([np.inf, -np.inf], 0).fillna(0)
    df["hl_range_pct"] = ((h - l) / c.replace(0, np.nan)).fillna(0)
    df["body_size_pct"] = ((df["close"] - df["open"]).abs() / c.replace(0, np.nan)).fillna(0)
    df["volatility_14d"] = c.pct_change().rolling(14).std().fillna(0)
    return df


def load():
    frames = []
    for s in STOCKS:
        p = Path(f"data/ohlcv/{s}.csv")
        if not p.exists():
            continue
        df = pd.read_csv(p, usecols=range(6))
        df = df[df["volume"] > 0].reset_index(drop=True)
        if len(df) < 50:
            continue
        df = add_features(df); df["symbol"] = s
        frames.append(df)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def get_atr_per_stock(df):
    result = {}
    for s in STOCKS:
        sdf = df[df["symbol"] == s].sort_values("date").reset_index(drop=True)
        if len(sdf) < 14:
            continue
        atr = float(sdf.iloc[-1]["atr_14"])
        result[s] = {
            "current_price": float(sdf.iloc[-1]["close"]),
            "atr_14": atr if atr > 0 else float(sdf.iloc[-1]["close"]) * 0.02,
        }
    return result


def signal_from_preds(preds, method="majority"):
    """Combine individual model predictions into an ensemble signal.

    method:
      - majority: simple vote (most common signal wins, ties = HOLD)
      - prob_weighted: weight by avgReturn
      - tier_weighted: weight by tier importance (TIER_1=0.35, etc.)
      - final_consensus: 2+ methods agree → BUY/SELL
      - win_rate_weighted: weight by backtested win rate
    """
    if not preds:
        return "HOLD"
    buys = sum(1 for p in preds if p == "BUY")
    sells = sum(1 for p in preds if p == "SELL")
    holds = sum(1 for p in preds if p == "HOLD")
    if method == "majority":
        if buys > sells and buys > holds:
            return "BUY"
        if sells > buys and sells > holds:
            return "SELL"
        return "HOLD"
    return "HOLD"


def backtest_ensemble(df, all_models, ensemble_fn, name):
    """Backtest an ensemble function — DISABLED (Phase 4 B-AUDIT Pattern #10 leak).

    Original implementation: per-stock 80/20 chronological test slice + adaptive
    window (the slice itself was leak-free), but the SIGNAL applied to every
    historical test row came from `md["predictions"][s].get("signal", "HOLD")` —
    the model's STORED LATEST per-stock signal, constant per stock across all
    historical test rows. This is leakage Pattern #10 (latest-signal replay):
    today's signal applied to historical test dates, which misrepresents the
    historical out-of-sample performance of the ensemble.

    For the leak-free chronological walk-forward evaluation, see
    scripts/walk_forward_backtesting.py (the genuine walk-forward engine that
    Phase A fixed). Do NOT duplicate a new walk-forward engine here.

    External interface preserved: same signature (df, all_models, ensemble_fn,
    name) and same top-level return keys (totalTrades / buySignals /
    sellSignals / correctBuys / correctSells / winRate / avgReturnPct /
    maxReturnPct / minReturnPct / stars). Values signal unavailability.
    Callers that already handle 0-trade / null-winRate results continue to work.
    """
    print(f"  {name}: UNAVAILABLE — Pattern #10 leak (latest-signal replay). "
          f"Use scripts/walk_forward_backtesting.py for leak-free eval.")
    return {
        "status": "unavailable",
        "reason": ("Pattern #10 LEAKY_BACKTEST: original implementation applied "
                   "the model's stored LATEST per-stock signal to every historical "
                   "test row (sig = ensemble_fn(stock_signals, stock_returns) where "
                   "stock_signals came from md['predictions'][s].get('signal', 'HOLD')). "
                   "This misrepresents historical OOS performance. Use "
                   "scripts/walk_forward_backtesting.py for leak-free chronological "
                   "walk-forward evaluation (per-sample re-training + per-bar re-inference)."),
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


def apply_atr_rules(signal, current_price, atr):
    if signal == "BUY":
        return current_price, current_price - 1.5 * atr, current_price + 1 * atr, current_price + 2 * atr, current_price + 3 * atr
    elif signal == "SELL":
        return current_price, current_price + 1.5 * atr, current_price - 1 * atr, current_price - 2 * atr, current_price - 3 * atr
    else:
        return current_price, current_price, current_price, current_price, current_price


def majority_vote_fn(signals, returns):
    return signal_from_preds(signals, "majority")


def probability_weighted_fn(signals, returns):
    if not returns:
        return "HOLD"
    avg_ret = sum(returns) / len(returns)
    if avg_ret > 0.005:
        return "BUY"
    if avg_ret < -0.005:
        return "SELL"
    return "HOLD"


TIER_W = {"TIER_1": 0.30, "TIER_2": 0.20, "TIER_3": 0.25, "TIER_4": 0.10, "TIER_CL": 0.15}


def tier_weighted_fn(signals, returns):
    if not returns:
        return "HOLD"
    # Without tier info, just use weighted return
    avg_ret = sum(returns) / len(returns)
    if avg_ret > 0.005:
        return "BUY"
    if avg_ret < -0.005:
        return "SELL"
    return "HOLD"


def final_consensus_fn(signals, returns):
    # 2+ ensemble methods agree
    votes = [majority_vote_fn(signals, returns),
             probability_weighted_fn(signals, returns),
             tier_weighted_fn(signals, returns)]
    buys = sum(1 for v in votes if v == "BUY")
    sells = sum(1 for v in votes if v == "SELL")
    if buys >= 2:
        return "BUY"
    if sells >= 2:
        return "SELL"
    return "HOLD"


def main():
    print("=" * 60)
    print("Fix Majority Vote + Add CL ensembles to backtesting modal")
    print("=" * 60)

    with open(PRED_FILE) as f:
        data = json.load(f)

    df = load()
    print(f"Loaded OHLCV: {len(df)} rows from {df['symbol'].nunique()} stocks")
    all_models = data.get("models", {})

    # Re-backtest all 4 base ensemble methods + final consensus
    print("\n[ENSEMBLE BACKTEST] Re-backtesting all ensemble methods...")
    ens_bt = {}
    ens_bt["MAJORITY_VOTE"] = backtest_ensemble(df, all_models, majority_vote_fn, "Majority Vote")
    ens_bt["PROBABILITY_WEIGHTED"] = backtest_ensemble(df, all_models, probability_weighted_fn, "Probability-Weighted")
    ens_bt["TIER_WEIGHTED"] = backtest_ensemble(df, all_models, tier_weighted_fn, "Tier-Weighted")
    ens_bt["FINAL_CONSENSUS"] = backtest_ensemble(df, all_models, final_consensus_fn, "Final Consensus")
    ens_bt["WIN_RATE_WEIGHTED"] = ens_bt["PROBABILITY_WEIGHTED"]  # alias

    # NEW: Add CL-Ensemble and CL-Extender backtesting entries
    # CL-Ensemble: 70% LightGBM + 30% Ridge
    def cl_ensemble_fn(signals, returns, _all=all_models):
        # Custom: 70% LGB + 30% Ridge signal (the CL-Ensemble methodology)
        # We can't access individual models here — just use the majority vote as fallback
        # Actually, let's compute it from the model's actual predictions per stock
        return "HOLD"  # placeholder

    # For CL-Ensemble, use the existing cl_ensemble_backtest result
    cl_ens_bt = data.get("cl_ensemble_backtest", {})
    cl_ext_bt = data.get("cl_extender_backtest", {}).get("results", {}).get("CL-Extender (8 models)", {})

    # Convert CL ensemble backtest (uses snake_case keys) to camelCase (matching ensemble_backtesting format)
    def convert_cl_to_ensemble_format(cl_bt, name):
        if not cl_bt:
            return None
        return {
            "totalTrades": cl_bt.get("total_trades", 0),
            "buySignals": 0,  # not split by direction in CL backtest
            "sellSignals": 0,
            "correctBuys": cl_bt.get("wins", 0),
            "correctSells": 0,
            "winRate": cl_bt.get("win_rate", 0),
            "avgReturnPct": cl_bt.get("avg_return_pct", 0),
            "maxReturnPct": cl_bt.get("avg_win_pct", 0),
            "minReturnPct": cl_bt.get("avg_loss_pct", 0),
            "stars": cl_bt.get("stars", 0),
        }

    cl_ens_entry = convert_cl_to_ensemble_format(cl_ens_bt, "CL-Ensemble")
    if cl_ens_entry:
        ens_bt["CL_ENSEMBLE"] = cl_ens_entry
        print(f"  CL-Ensemble: trades={cl_ens_entry['totalTrades']} WR={cl_ens_entry['winRate']}%")

    cl_ext_entry = convert_cl_to_ensemble_format(cl_ext_bt, "CL-Extender")
    if cl_ext_entry:
        ens_bt["CL_EXTENDER"] = cl_ext_entry
        print(f"  CL-Extender: trades={cl_ext_entry['totalTrades']} WR={cl_ext_entry['winRate']}%")

    data["ensemble_backtesting"] = ens_bt

    # Phase 4 B-AUDIT: ml_integrity documentation. The four base ensemble
    # methods (MAJORITY_VOTE / PROBABILITY_WEIGHTED / TIER_WEIGHTED /
    # FINAL_CONSENSUS / WIN_RATE_WEIGHTED) had their backtest_ensemble
    # implementation replaced with an unavailable stub because the original
    # applied the model's STORED LATEST per-stock signal to every historical
    # test row (Pattern #10 leak). The per-stock 80/20 chronological test
    # slice itself is fine; only the signal source was leaky. For the leak-free
    # chronological walk-forward evaluation, see walk_forward_backtesting.py.
    # The CL_ENSEMBLE / CL_EXTENDER entries are converted from previously-stored
    # backtest results (cl_ensemble_backtest / cl_extender_backtest) and are
    # NOT recomputed here; their own leakage status is documented in the script
    # that produced them (cl_extender.py Phase 4 LEAKY_ENSEMBLE fix).
    data["ml_integrity"] = {
        "backtest_methodology": (
            "Phase 4 B-AUDIT: backtest_ensemble replaced with unavailable stub. "
            "Original implementation applied the model's stored LATEST per-stock "
            "signal (md['predictions'][s].get('signal', 'HOLD')) to every "
            "historical test row — Pattern #10 LEAKY_BACKTEST (latest-signal "
            "replay). The per-stock 80/20 chronological test slice is fine; the "
            "signal source was the leak."
        ),
        "pattern": "Pattern #10 LEAKY_BACKTEST (latest-signal replay)",
        "status": "unavailable",
        "reason": (
            "Stored latest per-stock signal applied to every historical test row; "
            "misrepresents historical OOS performance."
        ),
        "pointer": "scripts/walk_forward_backtesting.py",
        "scope_note": (
            "Phase 4 scope is backtesting/metric correctness. Training-pipeline "
            "leakage (LEAKY_SPLIT / LEAKY_SCALER / LEAKY_TARGET / LEAKY_SEQUENCE) "
            "is Phase A scope and documented separately."
        ),
        "cl_ensemble_note": (
            "CL_ENSEMBLE / CL_EXTENDER entries are format-converted from "
            "previously-stored backtest results (cl_ensemble_backtest / "
            "cl_extender_backtest), NOT recomputed here. cl_extender.py has its "
            "own Phase 4 LEAKY_ENSEMBLE fix (win_rates update restricted to "
            "trades whose realization date <= cd_i, i.e., entered at iter <= "
            "i - MAX_HOLD)."
        ),
    }

    # Save
    PRED_FILE.write_text(json.dumps(data, indent=2,
                                     default=lambda o: int(o) if isinstance(o, (np.integer,)) else
                                     float(o) if isinstance(o, (np.floating,)) else str(o)))

    print("\n" + "=" * 60)
    print("VERIFICATION — ensemble_backtesting")
    print("=" * 60)
    for name, b in data.get("ensemble_backtesting", {}).items():
        print(f"  {name}: trades={b.get('totalTrades')} WR={b.get('winRate')}%")
    print(f"\nSaved: {PRED_FILE}")


if __name__ == "__main__":
    main()
