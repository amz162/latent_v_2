#!/usr/bin/env python3
"""Task 101 — deterministic QC tests (labels integrity, cost identity on
production-engine labels, parity artifact, protocol/leakage guards, artifacts).
Run: python3 scripts/task101_tests.py (<60s)"""
from __future__ import annotations
import json, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "data/backtest_reports/task101"
PASS, FAIL = 0, []
def check(name, cond, detail=""):
    global PASS
    if cond: PASS += 1; print(f"  ok  {name}")
    else: FAIL.append(name); print(f"FAIL  {name} {detail}")

labels = json.load(open(B / "trade_outcome_labels/labels.json"))["labels"]
check("labels n=11521", len(labels) == 11521, str(len(labels)))
ff = [r["strategies"]["fixed_first_hit"] for r in labels]
check("positiveNet binary", all(s["positiveNet"] in (0, 1) for s in ff))
check("costs positive on every trade", all(s["totalCost"] > 0 for s in ff))
check("zero slippage (V2 profile)", all(s["slippage"] == 0 for s in ff))
check("CGT zero on non-positive gross", all(s["cgt"] == 0 for s in ff if (s["netPnl"] + s["totalCost"]) <= 0))
check("CGT positive on winners", all(s["cgt"] > 0 for s in ff if (s["netPnl"] + s["totalCost"]) > 1))
identity_ok = sum(1 for r in labels for k, s in r["strategies"].items()
                  if r["entryPrice"] > 0 and abs(s["netPnl"]
                         - round((s["netReturnPct"] / 100) * ((100_000 // max(0.5, r["entryPrice"])) * r["entryPrice"]), 2)) <= 1.0)
total = sum(len(r["strategies"]) for r in labels)
check("net = netReturnPct x notional identity on labels", identity_ok / total > 0.999, f"{identity_ok}/{total}")
exp = json.loads((B / "task101_trade_expectancy_results.json").read_text())
fr = exp["expectancy_rule"]["frozen"]
check("frozen threshold present", fr is not None and 0 < fr["thr"] < 1)
ft = exp["expectancy_rule"].get("final_test", {})
check("final test shows filter improvement + honesty note", ft.get("final_expectancy_pct", 0) >
      ft.get("baseline_all_trades_expectancy_pct", -1) and "honesty_note" in ft)
parity = json.loads((B / "task101_cost_parity_report.json").read_text())
check("parity 29/29", parity["pass"] == 29 and parity["fail"] == 0)
req = ["task101_summary.json", "task101_execution_plan.json", "task101_progress.json",
       "task101_initial_performance_matrix.json", "task101_prediction_diagnostics.json",
       "task101_feature_diagnostics.json", "task101_data_quality_report.json",
       "task101_feature_ablation.json", "task101_cost_aware_training.json",
       "task101_trade_outcome_labels.json", "task101_trade_probability_results.json",
       "task101_trade_expectancy_results.json", "task101_model_comparison.json",
       "task101_model_coverage.json", "task101_sample_step_comparison.json",
       "task101_ensemble_validation.json", "task101_strategy_diagnostics.json",
       "task101_strategy_optimization.json", "task101_cost_parity_report.json",
       "task101_cost_reconciliation.json", "task101_simulator_validation.json",
       "task101_per_stock_analysis.json", "task101_regime_analysis.json",
       "task101_prospective_integrity.json", "task101_api_validation.json",
       "task101_browser_test_results.json", "task101_remaining_blockers.json",
       "task101_metrics.csv", "task101_model_registry.json",
       "task101_walk_forward_expansion.json"]
missing = [f for f in req if not (B / f).exists()]
check("all required artifacts exist", len(missing) == 0, str(missing))
check("docs updated", "psx_user_schedule_v2` (Task 101 default)" in
       (ROOT / "docs/investment-simulator-metrics.md").read_text())
api = json.loads((B / "task101_api_validation.json").read_text())
check("registry exposes cost-aware models", api["checks"]["registry"]["cost_aware_present"])
check("walk-forward original untouched", api["checks"]["walk_forward_untouched"]["samples_400"])
sys.path.insert(0, str(ROOT / "scripts"))
import task100_lib as T0
ci = T0.moving_block_bootstrap_ci(np.repeat(np.arange(30), 3), np.random.default_rng(0).normal(0, .01, 90), 5, 100, 1)
check("bootstrap CI intact", ci["mae_ci95"] is not None)
print(f"\n{PASS} passed, {len(FAIL)} failed")
sys.exit(1 if FAIL else 0)
