#!/usr/bin/env python3
"""Task 104 — deterministic QA suite."""
from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "data/backtest_reports/task104"
PASS, FAIL = 0, []
def check(name, cond, detail=""):
    global PASS
    if cond: PASS += 1; print(f"  ok  {name}")
    else: FAIL.append(name); print(f"FAIL  {name} {detail}")

def art(name):
    p = B / name
    return json.loads(p.read_text()) if p.exists() else None

STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]

# ── phase 1/2 ─────────────────────────────────────────────────────────────────
inv = art("task104_source_inventory.json")
check("source_inventory_complete", inv and inv["status"] == "completed"
       and len(inv["historical_artifacts"]) == 5)
rec = art("task104_reconciliation.json")
check("reconstruction_identical_all_strategies",
      rec and all(v["verdict"] == "IDENTICAL" for v in rec["per_strategy"].values()),
       str(rec and {k: v["verdict"] for k, v in rec["per_strategy"].items()}))
check("reconstruction_covers_11521",
      all(v["compared"] == 11521 for v in rec["per_strategy"].values()))
check("prob_threshold_matches_task101",
      abs(rec["probabilities_reproduction"]["thr_q70_max_tp_step_trailing"]
           - rec["probabilities_reproduction"]["reported_task101_thr"]) < 1e-9)
# ── probabilities ─────────────────────────────────────────────────────────────
probs = art("task104_probabilities.json")
check("probabilities_3x11521", len(probs["rows"]) == 34563 and probs["n_samples"] == 11521)
check("probabilities_partitions",
      probs["partition_counts"] == {"train": 5935, "validation": 1608, "final_test": 3978},
       str(probs["partition_counts"]))
check("probabilities_in_unit_interval",
      all(0.0 <= r["p_cal"] <= 1.0 for r in probs["rows"]))
# ── portfolio sim ─────────────────────────────────────────────────────────────
res = art("task104_portfolio_results.json")["results"]
meta = res.pop("__meta")
check("portfolio_60_scenarios", len(res) == 60, str(len(res)))
check("no_leverage_ending_cash_non_negative",
      all(v["ending_cash"] >= -0.01 for v in res.values()))
check("ledger_identity_holds", all(
    abs(v["initial_cash"] + v["realized_pnl"] + v["unrealized_pnl"] - v["final_equity"]) <= 1.0
    for v in res.values()),
    str([k for k, v in res.items()
          if abs(v["initial_cash"] + v["realized_pnl"] + v["unrealized_pnl"] - v["final_equity"]) > 1][:3]))
check("all_configurations_lose_money", all(v["final_equity"] < 100000 for v in res.values()))
check("costs_recorded", all(v["total_fees_excl_cgt"] >= 0 and v["total_cgt"] >= 0
                             for v in res.values()))
check("equity_curves_present", all(len(v["equity_curve_5d"]) > 100 for v in res.values()))
check("max_concurrent_respected", all(
    v["max_concurrent_positions"] <= {"A_eq3": 3, "A_eq5": 5, "A_eq10": 10,
                                       "B_5": 100, "B_10": 100, "B_20": 100, "B_25": 100,
                                       "C_r0_5": 10, "C_r1": 10, "C_r2": 10}[v["sizing"]]
    for v in res.values()))
# ── analysis artifacts ────────────────────────────────────────────────────────
acc = art("task104_model_accuracy_audit.json")
check("accuracy_audit_has_task100_grid", acc and len(acc["task100_classical"]) == 54)
cal = art("task104_calibration_analysis.json")
check("calibration_bins_and_spearman",
      all("spearman_conf_vs_outcome" in v for v in cal["by_strategy_partition"].values()))
fv = art("task104_filtered_vs_unfiltered.json")
check("filtered_vs_unfiltered_complete",
      len(fv["label_level"]) == 6 and len(fv["portfolio_level"]["rows"]) == 30)
check("filter_stays_negative_label_level", all(
    v["expectancy_selected_pct"] < 0 for v in fv["label_level"].values()))
attr = art("task104_loss_attribution.json")
check("attribution_gross_negative", attr["signal_quality"]["mean_gross_pnl_per_trade"] < 0)
check("attribution_costs_material", attr["costs"]["total_cost_all_trades_pkr"] > 1e6)
scan = art("task104_positive_net_scan.json")
check("positive_scan_none_positive", scan["n_positive_after_costs"] == 0
       and scan["best_configuration"]["roi_pct"] < 0)
check("ledger_identity_no_violations", not scan["ledger_identity_violations"])
summ = art("task104_final_summary.json")
check("final_summary_9_answers", len(summ["answers"]) == 9)
# ── historical immutability ───────────────────────────────────────────────────
check("prior_task_dirs_unmodified", subprocess.run(
    ["git", "status", "--porcelain", "data/backtest_reports/task100",
     "data/backtest_reports/task101", "data/backtest_reports/task102",
     "data/backtest_reports/task103"], cwd=ROOT, capture_output=True,
    text=True).stdout.strip() == "")
# ── required outputs ──────────────────────────────────────────────────────────
REQUIRED = ["task104_source_inventory.json", "task104_reconciliation.json",
             "task104_probabilities.json", "task104_engine_recon.json",
             "task104_portfolio_results.json", "task104_model_accuracy_audit.json",
             "task104_calibration_analysis.json", "task104_filtered_vs_unfiltered.json",
             "task104_loss_attribution.json", "task104_positive_net_scan.json",
             "task104_final_summary.json"]
check("required_artifacts_present", all((B / a).exists() for a in REQUIRED),
       str([a for a in REQUIRED if not (B / a).exists()]))
check("report_doc_present", (ROOT / "docs/task104-final-report.md").exists())

print(f"\ntask104 tests: {PASS} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED:", FAIL); sys.exit(1)
