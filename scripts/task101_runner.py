#!/usr/bin/env python3
"""Task 101 — phase runner (150s sandbox limit; resumable phases).

Usage: python3 scripts/task101_runner.py --phase <name> [--budget-seconds 130]
Phases are implemented in task101_phases.py; progress in task101_progress.json.
"""
from __future__ import annotations
import argparse, json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def phase_scaffold(args):
    import task101_lib as T
    for d in (T.BASE, T.BATCH_LOGS, T.CHECKPOINTS, T.MODELS_DIR, T.PREDICTIONS_DIR,
              T.LABELS_DIR, T.BASE / "experiments"):
        d.mkdir(parents=True, exist_ok=True)
    plan = {
        "task": 101,
        "objective": "Build and validate a cost-aware PSX prediction and trade-selection system; "
                     "unify simulator/backtest cost models on psx_user_schedule_v2; close the "
                     "resource-limited model-coverage gap; prove improvements on untouched data; "
                     "confidently output NO TRADE when evidence is insufficient.",
        "constraints": {"sandbox": "4GB RAM / 2 CPUs / 150s per command",
                         "protected": "Tasks 54-100 reports, sector_overrides.json, user cost schedule",
                         "integrity": "chronological splits, horizon purge, validation-only selection, "
                                       "frozen final-test, no fabricated labels"},
        "phases": [
            {"id": "scaffold", "outputs": ["task101_execution_plan.json", "task101_progress.json"]},
            {"id": "matrix", "outputs": ["task101_initial_performance_matrix.json"]},
            {"id": "cost_parity", "outputs": ["src/lib/latent/investment-simulator.ts V2 default",
                                               "task101_cost_parity_report.json",
                                               "task101_cost_reconciliation.json"]},
            {"id": "labels", "outputs": ["trade_outcome_labels/", "task101_trade_outcome_labels.json"]},
            {"id": "cost_aware", "outputs": ["task101_cost_aware_training.json",
                                              "task101_trade_probability_results.json",
                                              "task101_trade_expectancy_results.json"]},
            {"id": "strategy", "outputs": ["task101_strategy_diagnostics.json",
                                            "task101_strategy_optimization.json"]},
            {"id": "campaign", "outputs": ["task101_model_comparison.json",
                                            "task101_model_coverage.json",
                                            "task101_walk_forward_expansion.json",
                                            "task101_sample_step_comparison.json"]},
            {"id": "diagnostics", "outputs": ["task101_prediction_diagnostics.json",
                                               "task101_feature_diagnostics.json",
                                               "task101_data_quality_report.json",
                                               "task101_feature_ablation.json"]},
            {"id": "ensemble", "outputs": ["task101_ensemble_validation.json"]},
            {"id": "simulator", "outputs": ["task101_simulator_validation.json",
                                             "task101_per_stock_analysis.json",
                                             "task101_regime_analysis.json"]},
            {"id": "prospective", "outputs": ["task101_prospective_integrity.json"]},
            {"id": "api_browser", "outputs": ["task101_api_validation.json",
                                               "task101_browser_test_results.json"]},
            {"id": "finalize", "outputs": ["task101_summary.json", "task101_metrics.csv",
                                            "task101_remaining_blockers.json"]},
            {"id": "deliver", "outputs": ["commit 'Task 101: build cost-aware PSX prediction and trading engine' + push"]},
        ],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime()),
    }
    T.write_artifact("task101_execution_plan.json", plan)
    T.update_progress("scaffold", "done", "plan + dirs created", "task101_execution_plan.json")
    print("scaffold done")


PHASES = {"scaffold": phase_scaffold}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", required=True)
    ap.add_argument("--budget-seconds", type=int, default=130)
    args = ap.parse_args()
    if args.phase in PHASES:
        PHASES[args.phase](args)
    else:
        import task101_phases as P
        fn = getattr(P, f"phase_{args.phase}", None)
        if fn is None:
            print(f"phase {args.phase} not implemented"); sys.exit(2)
        fn(args)


if __name__ == "__main__":
    main()
