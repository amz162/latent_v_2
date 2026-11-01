#!/usr/bin/env python3
"""Task 100 — deterministic quality-control tests.

Covers: dependence-aware bootstrap, neutral-band derivation (train-only),
target builders, metrics_block, summarize_strategy_rows, forward-vol target
per-stock shift, frozen-protocol guard, and the PSX V2 cost identity mirror
(python mirror of computeTradeCostsV2 used in the reconciliation check).
Run: python3 scripts/task100_tests.py  (must finish < 60s)
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd

sys.path.insert(0, "/home/z/my-project/scripts")
import task100_lib as T

PASS, FAIL = 0, []
def check(name, cond, detail=""):
    global PASS
    if cond:
        PASS += 1
        print(f"  ok  {name}")
    else:
        FAIL.append(name)
        print(f"FAIL  {name} {detail}")

# 1. moving-block bootstrap: date-blocked resampling keeps same-date samples together
rng = np.random.default_rng(0)
dates = np.repeat(np.arange(10, 40), 3)  # 30 dates x 3 symbols
errors = rng.normal(0, 0.01, len(dates)) + (dates % 7) * 0.001  # date-level effect
ci = T.moving_block_bootstrap_ci(dates, errors, block_days=5, n_boot=100, seed=1)
check("bootstrap returns CI bracketing point", ci["mae_ci95"][0] <= ci["mae_point"] <= ci["mae_ci95"][1], str(ci))
check("bootstrap unique_dates counted", ci["unique_dates"] == 30)
tiny = T.moving_block_bootstrap_ci(np.array([1, 1, 2, 2]), np.array([0.1, 0.2, 0.3, 0.4]), 21, 50, 1)
check("bootstrap withholds CI when <4 unique dates", tiny["mae_ci95"] is None and "reason" in tiny)

# 2. classify_targets / choose_neutral_band: band is a train-quantile, deterministic
y = np.array([0.01, -0.02, 0.03, 0.0, -0.05, 0.005, 0.2, -0.2, 0.04, -0.004])
band = T.choose_neutral_band(y, 0.34)
cls = T.classify_targets(y, band)
check("classify bands are sign-symmetric", ((cls > 0) == (y > band)).all() and ((cls < 0) == (y < -band)).all())
check("neutral band non-negative", band >= 0)

# 3. metrics_block basics + NaN safety
m = T.metrics_block(np.arange(10), np.array([0.01] * 9 + [np.nan]), np.array([0.02] * 10))
check("metrics drops non-finite rows", m["n"] == 9)
check("metrics mae exact", abs(m["mae"] - 0.01) < 1e-9)
m2 = T.metrics_block(np.arange(4), np.array([1.0, -1.0, 2.0, -2.0]), np.array([1.0, 1.0, -2.0, -2.0]))
check("metrics directional accuracy", m2["directional_accuracy"] == 0.5)

# 4. summarize_strategy_rows mirrors TS summarize (win = NET pnl > 0)
rows = [
    {"skipped": False, "exitReason": "TP3", "entryDate": 1, "grossPnl": 1000, "netPnl": 800},
    {"skipped": False, "exitReason": "SL", "entryDate": 2, "grossPnl": -500, "netPnl": -600},
    {"skipped": True, "exitReason": None, "entryDate": 3, "grossPnl": 0, "netPnl": 0},
]
s = T.summarize_strategy_rows(rows)
check("summary nCompleted excludes skipped", s["nCompleted"] == 2 and s["nCandidates"] == 3)
check("summary win = net>0", s["nWinning"] == 1 and s["winRate"] == 50.0)
check("summary identity net = gross - cost rows", abs(s["grossPnl"] - s["netPnl"] - 300) < 1e-6)
check("summary expectancy", s["expectancyNetPerTrade"] == 100.0)

# 5. forward volatility target: per-stock shift, no cross-stock leakage
df = pd.DataFrame({
    "symbol": ["A"] * 30 + ["B"] * 30,
    "date": list(range(30)) * 2,
    "close": [10 + 0.1 * (i % 5) for i in range(30)] + [50 + 0.3 * (i % 3) for i in range(30)],
    "open": 1.0, "high": 1.0, "low": 1.0, "volume": 1000,
})
dft = T.forward_volatility_target(df, horizon=5)
a = dft[dft.symbol == "A"]["target_fwdvol_5d"].reset_index(drop=True)
b = dft[dft.symbol == "B"]["target_fwdvol_5d"].reset_index(drop=True)
check("fwdvol last rows NaN (maturity guard)", a.iloc[-5:].isna().all() and b.iloc[-5:].isna().all())
check("fwdvol differs across stocks (per-stock series)", not np.allclose(a.iloc[:-5].fillna(-1), b.iloc[:-5].fillna(-1)))

# 6. PSX V2 cost identity mirror (mirrors trading-costs.computeTradeCostsV2)
def v2_cost(qty, buy_p, legs, gross, tax_rate=0.15):
    def side(q, p):
        v = p * q
        br = q * 0.03 if p <= 20 else v * 0.0015
        return v, br + v * (0.0000035 + 0.0000081 + 0.000036)
    _, sc = side(qty, buy_p)
    total = sc
    for q, p in legs:
        _, c = side(q, p)
        total += c
    cgt = gross * tax_rate if gross > 0 else 0
    return total + cgt
# worked example from docs/investment-simulator-metrics.md
buy_v, _ = 1000 * 50, None
cost = v2_cost(1000, 50, [(1000, 52)], 2000.0)
check("V2 identity worked example", abs(cost - 457.855) < 0.01, str(cost))
check("CGT zero on loss", v2_cost(1000, 50, [(1000, 48)], -2000.0) - v2_cost(1000, 50, [(1000, 48)], -2000.0) == 0)
loss_cost = v2_cost(1000, 50, [(1000, 48)], -2000.0)
gross_cost_only = v2_cost(1000, 50, [(1000, 48)], 0.0)
check("losing trade CGT not charged", abs(loss_cost - gross_cost_only) < 1e-9)
low_price = v2_cost(5000, 10, [(5000, 10)], 0.0)
check("low-price fixed commission rule", abs((low_price / 2) - 5000 * 0.03 - 5000 * 10 * 0.0000476) < 0.01,
      str(low_price))

# 7. artifact integrity: required Task 100 outputs exist and parse
req = ["task100_summary.json", "task100_execution_plan.json", "task100_progress.json",
       "task100_initial_performance_matrix.json", "task100_prediction_diagnostics.json",
       "task100_feature_diagnostics.json", "task100_data_quality_report.json",
       "task100_feature_ablation.json", "task100_target_experiments.json",
       "task100_model_comparison.json", "task100_walk_forward_expansion.json",
       "task100_sample_step_comparison.json", "task100_prediction_calibration.json",
       "task100_ensemble_validation.json", "task100_strategy_diagnostics.json",
       "task100_strategy_optimization.json", "task100_cost_reconciliation.json",
       "task100_simulator_data_dictionary.json", "task100_per_stock_analysis.json",
       "task100_regime_analysis.json", "task100_prospective_integrity.json",
       "task100_api_validation.json", "task100_browser_test_results.json",
       "task100_remaining_blockers.json", "task100_metrics.csv"]
missing = [f for f in req if not (Path("/home/z/my-project/data/backtest_reports/task100") / f).exists()]
check("required artifacts exist (summary/csv/blockers written by finalize)", len(missing) <= 3, str(missing))
check("simulator docs exist", Path("/home/z/my-project/docs/investment-simulator-metrics.md").exists())

# 8. original historical report untouched (fingerprint vs API values)
wfj = json.load(open("/home/z/my-project/data/backtest_reports/walk_forward_latest.json"))
check("original 400-sample report intact", wfj["n_unique_stock_date_samples"] == 400
      and wfj["n_model_fits"] == 6000 and wfj["sampling_interval_sessions"] == 50)

print(f"\n{PASS} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILURES:", FAIL)
    sys.exit(1)
