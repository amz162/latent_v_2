#!/usr/bin/env python3
"""
Task 79 Phase 2 — Model research audit. Analyzes the existing data, features,
targets, + model weaknesses to guide new model selection.

Output: data/backtest_reports/task79_model_research_audit.json
"""
import sys, os, json, sqlite3
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, pandas as pd
from walk_forward_backtesting import FC, add_features, load
from ml_integrity import add_forward_returns, HORIZONS

DB_PATH = Path("db/custom.db")
MANIFEST = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
OUTPUT = Path("data/backtest_reports/task79_model_research_audit.json")

def to_date(s):
    """Robust date conversion — handles both int64 epoch-ms and string dates."""
    if pd.api.types.is_integer_dtype(s):
        return pd.to_datetime(s, unit="ms", utc=True)
    return pd.to_datetime(s, utc=True, errors="coerce")

def main():
    print("Task 79 Phase 2 — Model Research Audit")
    universe = MANIFEST["universe"]["symbols"]
    df = load(stocks=universe, source="db")
    df = add_features(df)
    df = add_forward_returns(df)

    audit = {
        "task": "task79_model_research_audit",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "universe": universe,
        "feature_schema": FC,
    }

    # 1. OHLCV coverage (query DB directly for dates — avoids pandas type issues)
    print("  OHLCV coverage...")
    conn = sqlite3.connect(str(DB_PATH))
    coverage = {}
    all_dates = []
    for sym in universe:
        rows = conn.execute("SELECT date FROM OhlcvBar WHERE symbol=? ORDER BY date", (sym,)).fetchall()
        if not rows:
            coverage[sym] = {"bars": 0, "first": None, "last": None}
            continue
        dates_sym = [r[0] for r in rows]
        all_dates.extend(dates_sym)
        coverage[sym] = {"bars": len(rows), "first": dates_sym[0], "last": dates_sym[-1]}
    conn.close()
    audit["ohlcv_coverage"] = coverage
    audit["total_bars"] = int(len(df))
    all_dates_sorted = sorted(all_dates)
    audit["date_range"] = {"min": all_dates_sorted[0], "max": all_dates_sorted[-1]}

    # 2. Target distributions + class balance
    print("  Target distributions...")
    targets = {}
    for h in HORIZONS:
        col = f"target_{h}d"
        t = df[col].dropna()
        pos = (t > 0).sum()
        neg = (t < 0).sum()
        buy_thresh = (t > 0.01).sum()
        targets[f"{h}d"] = {
            "n": int(len(t)),
            "mean": round(float(t.mean()), 6),
            "std": round(float(t.std()), 6),
            "median": round(float(t.median()), 6),
            "pct_positive": round(float(pos / len(t) * 100), 2),
            "pct_negative": round(float(neg / len(t) * 100), 2),
            "pct_above_buy_threshold_1pct": round(float(buy_thresh / len(t) * 100), 2),
            "min": round(float(t.min()), 4),
            "max": round(float(t.max()), 4),
        }
    audit["target_distributions"] = targets

    # 3. Feature correlations (top redundant pairs)
    print("  Feature correlations...")
    fcorr = df[FC].corr().abs()
    # Upper triangle, sorted by correlation descending
    pairs = []
    for i in range(len(FC)):
        for j in range(i + 1, len(FC)):
            pairs.append({"a": FC[i], "b": FC[j], "corr": round(float(fcorr.iloc[i, j]), 3)})
    pairs.sort(key=lambda x: -x["corr"])
    audit["top_feature_correlations"] = pairs[:10]

    # 4. Existing model weaknesses (from Task 78 results)
    print("  Existing model weaknesses...")
    t78 = json.loads(Path("data/backtest_reports/task78_strategy_results_v1.json").read_text())
    weaknesses = []
    # Per-model final-test performance
    for cell in t78.get("perCell", []):
        if cell["period"] == "final-test" and cell["strategyId"] == "fixed_first_hit":
            if cell.get("nCompleted", 0) > 0:
                weaknesses.append({
                    "model": cell["model"], "horizon": cell["horizon"],
                    "n": cell["nCompleted"], "winRate": cell.get("winRate"),
                    "netPnl": cell.get("netPnl"), "profitFactor": cell.get("profitFactor"),
                    "directional_note": "winRate vs netPnl divergence indicates position-sizing or exit-policy sensitivity",
                })
    audit["existing_model_final_test"] = weaknesses
    audit["existing_model_weaknesses_summary"] = [
        "All 5 existing models have profit factors 1.3-1.5 on final-test — modest, not strongly predictive.",
        "High win rate does NOT imply high net P&L (trailing/scale-out have 60%+ win rate but negative net P&L — they cut winners short).",
        "fixed_first_hit (lowest win rate ~48%) has the BEST net P&L — suggests the target structure (TP3) matters more than exit policy complexity.",
        "The +1% BUY threshold produces ~27% of predictions as BUY (1089/4000 in Task 78) — a reasonable candidate rate but not highly selective.",
        "Model predictions have weak ranking power (profit factors barely above 1.0) — the edge is small + uncertain.",
        "25 decision dates × 24 stocks is a small sample — results are exploratory, not significant.",
    ]

    # 5. Stale symbols (DB dates are strings YYYY-MM-DD — no unit conversion needed)
    print("  Stale symbols...")
    conn = sqlite3.connect(str(DB_PATH))
    stale = []
    for sym in universe:
        row = conn.execute("SELECT MAX(date) FROM OhlcvBar WHERE symbol=?", (sym,)).fetchone()
        max_date = row[0] if row else None
        if max_date and max_date < "2026-10-29":
            stale.append({"symbol": sym, "latest_date": max_date})
    conn.close()
    audit["stale_symbols"] = stale

    # 6. New model rationale
    audit["new_model_rationale"] = {
        "ExtraTrees": "Ensemble of randomized trees — less correlated with the existing Random Forest (different split randomness). May capture different patterns.",
        "HistGradientBoosting": "Modern sklearn GBR — faster + better-regularized than the existing LightGBM/CatBoost configs. Distinct implementation.",
        "ElasticNet": "L1+L2 regularized linear — a strong, simple baseline. If it matches the existing Ridge, the feature schema has linear signal; if not, the signal is non-linear.",
        "HuberRegressor": "Robust to outliers — PSX returns have heavy tails. May outperform OLS/Ridge on extreme moves.",
        "SVR": "Non-linear kernel (RBF) — captures non-linear patterns the tree/linear models miss. Slow but distinct.",
        "sequence_models_deferred": "GRU/LSTM/TCN NOT trained — the sandbox compute constraints + the modest independent-date count (25 clusters) make sequence models prone to overfitting. Documented as deferred.",
    }

    audit["limitations"] = [
        "This audit uses the pilot25 universe (25 stocks) — a small, liquidity-selected sample. Results may not generalize to the broader PSX.",
        "Feature correlations are computed on the full dataset (not point-in-time) — they indicate redundancy, not predictive power.",
        "The existing model weaknesses are inferred from the retrospective Task 78 comparison — NOT from independent prospective evidence.",
        "Do NOT conclude that any model is good or bad from these observations alone — prospective evaluation is required.",
    ]

    OUTPUT.write_text(json.dumps(audit, indent=2, default=str))
    print(f"✓ Audit written: {OUTPUT}")
    print(f"  total_bars: {audit['total_bars']}, date_range: {audit['date_range']['min']} → {audit['date_range']['max']}")
    print(f"  stale_symbols: {len(stale)}")

if __name__ == "__main__":
    main()
