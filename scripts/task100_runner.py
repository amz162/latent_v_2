#!/usr/bin/env python3
"""Task 100 — phase runner (sandbox-limit aware: every invocation <= 150s).

Usage: python3 scripts/task100_runner.py --phase <name> [--budget-seconds 130]

Phases (resumable; progress in task100_progress.json):
  scaffold   — dirs + execution plan + progress skeleton
  benchmark  — time one walk-forward sample with 9 classical models
  matrix     — initial performance matrix from real Task 54-99 artifacts
  diag_pred  — prediction/target diagnostics (distributions, residual stats)
  diag_feat  — feature diagnostics (missing, correlation, stability, redundancy)
  diag_data  — PSX data quality report (missing bars, stale symbols, gaps)
  compare    — bounded model comparison (9 classical models, same cohort)
  steps      — sample-step comparison (50/10/5/1, fast models)
  ablation   — feature-group ablation (LightGBM, validation-selected)
  targets    — target experiments (classification, quantile, volatility)
  calibration— reliability/Brier/log-loss (validation only)
  ensemble   — OOF ensemble validation (fixed aggregators + frozen weights)
  All heavy phases are chunked internally by --budget-seconds and resume.
"""
from __future__ import annotations
import argparse, json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import task100_lib as T  # noqa: E402


def phase_scaffold(args):
    for d in (T.BASE, T.RUNS, T.BATCH_LOGS, T.CHECKPOINTS, T.MODELS_DIR,
              T.PREDICTIONS_DIR, T.EXPERIMENTS_DIR):
        d.mkdir(parents=True, exist_ok=True)
    plan = {
        "task": 100,
        "objective": "Improve genuine PSX forecasting quality and trading performance; "
                     "diagnose why current models underperform; expand walk-forward evaluation "
                     "beyond the five classical models; document the investment simulator "
                     "field-by-field from actual source code.",
        "constraints": {
            "sandbox_limit_seconds": 150,
            "command_budget_seconds": args.budget_seconds,
            "protected": "Task 54-99 reports are never overwritten; original 400-sample "
                         "sample_step=50 pilot25 report stays untouched",
            "integrity": "chronological splits, horizon-specific maturity purge, train-only "
                         "preprocessing, validation-only selection, final-test touched once",
        },
        "phases": [
            {"id": "scaffold", "outputs": ["task100_execution_plan.json", "task100_progress.json"]},
            {"id": "benchmark", "outputs": ["batch_logs/benchmark.json"]},
            {"id": "matrix", "outputs": ["task100_initial_performance_matrix.json"]},
            {"id": "diag_pred", "outputs": ["task100_prediction_diagnostics.json"]},
            {"id": "diag_feat", "outputs": ["task100_feature_diagnostics.json"]},
            {"id": "diag_data", "outputs": ["task100_data_quality_report.json"]},
            {"id": "compare", "outputs": ["task100_model_comparison.json",
                                          "task100_walk_forward_expansion.json"]},
            {"id": "steps", "outputs": ["task100_sample_step_comparison.json"]},
            {"id": "ablation", "outputs": ["task100_feature_ablation.json"]},
            {"id": "targets", "outputs": ["task100_target_experiments.json"]},
            {"id": "calibration", "outputs": ["task100_prediction_calibration.json"]},
            {"id": "ensemble", "outputs": ["task100_ensemble_validation.json"]},
            {"id": "strategy", "outputs": ["task100_strategy_diagnostics.json",
                                           "task100_strategy_optimization.json",
                                           "task100_cost_reconciliation.json"]},
            {"id": "simulator", "outputs": ["task100_simulator_data_dictionary.json",
                                            "docs/investment-simulator-metrics.md"]},
            {"id": "perstock", "outputs": ["task100_per_stock_analysis.json",
                                           "task100_regime_analysis.json"]},
            {"id": "prospective", "outputs": ["task100_prospective_integrity.json"]},
            {"id": "api_browser", "outputs": ["task100_api_validation.json",
                                              "task100_browser_test_results.json"]},
            {"id": "finalize", "outputs": ["task100_summary.json", "task100_metrics.csv",
                                           "task100_remaining_blockers.json"]},
            {"id": "deliver", "outputs": ["commit + push + HEAD==origin/main verification"]},
        ],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime()),
    }
    T.write_artifact("task100_execution_plan.json", plan)
    T.update_progress("scaffold", "done", "dirs + plan created", "task100_execution_plan.json")
    print("scaffold done")


def phase_benchmark(args):
    """Time one walk-forward sample with the 5 original + 4 additional models."""
    syms, uni_meta = T.resolve_pilot25()
    df = T.load_dataset(syms)
    samples, total, bounded, tw = T.split_and_samples(df, syms, 10, 1)
    s = samples[0]
    t0 = time.time()
    rec = T.process_sample_ext(0, s, df, T.ORIGINAL_MODELS + T.EXTENDED_MODELS)
    dt = time.time() - t0
    out = {
        "purpose": "benchmark one walk-forward sample: 9 models x 3 horizons = 27 fits",
        "sample": s["sample_id"], "elapsed_seconds": round(dt, 2),
        "per_model_fits": {m: rec["preds"][m]["n_fits"] for m in rec["preds"]},
        "errors": {m: rec["preds"][m].get("error") for m in rec["preds"] if "error" in rec["preds"][m]},
        "universe_n": len(syms), "total_test_samples_at_step10": total,
        "implication": "budget 130s allows ~{n} samples/chunk at this cost".format(
            n=max(1, int((args.budget_seconds - 20) / max(dt, 0.1)))),
    }
    (T.BATCH_LOGS / "benchmark.json").write_text(json.dumps(out, indent=2))
    T.update_progress("benchmark", "done", f"1 sample in {dt:.1f}s", "batch_logs/benchmark.json")
    print(json.dumps(out, indent=2)[:800])


PHASES = {
    "scaffold": phase_scaffold,
    "benchmark": phase_benchmark,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", required=True, choices=sorted(PHASES) + ["compare_x", "matrix", "diag_pred", "diag_feat", "diag_data", "compare", "steps", "ablation", "targets", "calibration", "ensemble", "strategy", "simulator", "perstock", "prospective", "api_browser", "finalize", "deliver"])
    ap.add_argument("--budget-seconds", type=int, default=130)
    args = ap.parse_args()
    if args.phase in PHASES:
        PHASES[args.phase](args)
    else:
        # phases added by extension modules (imported lazily to keep startup fast)
        import task100_phases as P
        fn = getattr(P, f"phase_{args.phase}", None)
        if fn is None:
            print(f"phase {args.phase} not implemented yet"); sys.exit(2)
        fn(args)


if __name__ == "__main__":
    main()
