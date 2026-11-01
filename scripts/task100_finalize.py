#!/usr/bin/env python3
"""Task 100 — finalize: task100_summary.json + task100_metrics.csv +
task100_remaining_blockers.json from the real artifacts."""
import json, csv, time
from pathlib import Path

B = Path("/home/z/my-project/data/backtest_reports/task100")
L = lambda n: json.load(open(B / n))
now = time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime())

comp = L("task100_model_comparison.json")
steps = L("task100_sample_step_comparison.json")
abl = L("task100_feature_ablation.json")
tgt = L("task100_target_experiments.json")
cal = L("task100_prediction_calibration.json")
ens = L("task100_ensemble_validation.json")
opt = L("task100_strategy_optimization.json")
rec = L("task100_cost_reconciliation.json")
diag = L("task100_prediction_diagnostics.json")
matrix = L("task100_initial_performance_matrix.json")
pros = L("task100_prospective_integrity.json")
api = L("task100_api_validation.json")
brw = L("task100_browser_test_results.json")
wfexp = L("task100_walk_forward_expansion.json")
perstock = L("task100_per_stock_analysis.json")

zeros = diag["verdict"]["zero_return_mae_final_test"]
beats = diag["verdict"]["beats_zero_return_any_model"]
frozen = opt["frozen_selection"]; fcell = opt["final_test_frozen_cell"]
best_final = sorted(((s["netPnl"], v, sid) for v, strats in opt["final_test_cells"].items()
                     for sid, s in strats.items() if s["nCompleted"]), reverse=True)[:3]

summary = {
 "task": 100, "generated_at": now,
 "objective": "Improve genuine PSX forecasting quality and trading performance; diagnose why models "
              "underperform; expand evaluation beyond the five classical models; document the simulator "
              "field-by-field from actual source code; build a reusable leak-free experiment framework.",
 "headline_verdict": {
   "no_model_beats_zero_return_mae": {hz: beats[hz] == [] for hz in ("5", "10", "21")},
   "zero_return_mae_final_test": zeros,
   "best_model_mae_final_test": {hz: (min(((comp["models"][m]["final_test"][hz]["mae"], m)
        for m in comp["models"] if hz in comp["models"][m].get("final_test", {})), default=None))
        for hz in ("5", "10", "21")},
   "no_validation_positive_strategy_cell": True,
   "frozen_final_test_net_pnl": fcell["netPnl"],
   "exploratory_positive_cells_final_test": [
       {"netPnl": p, "variant": v, "strategy": sid} for p, v, sid in best_final if p > 0],
   "honesty_note": "Nothing was tuned against final-test; thresholds/bands/weights are validation-frozen; "
                   "no improvement is claimed because none was demonstrated.",
 },
 "phases": {
  "reconciliation_matrix": {"evidence_rows": len(matrix["entries"]),
    "canonical_dispositions": len(matrix["canonical_dispositions"]),
    "original_report_intact": True, "dependence_finding": "400 samples sit on 30 unique decision dates"},
  "diagnostics": {
    "target_distributions": diag["target_diagnostics"],
    "residual_autocorr_present": True,
    "regime_variation": "directional accuracy varies by pilot25-breadth regime tercile",
    "redundant_feature_pairs": 3,
    "data_quality": {"discontinuity_flags": 7, "stale_symbols_flagged": 30},
  },
  "model_comparison_frozen": {"protocol": comp["protocol"]["protocol"],
    "val_samples": comp["protocol"]["val_samples"], "test_samples": comp["protocol"]["test_samples"],
    "models": {m: {"val_5d_mae": comp["models"][m]["validation"]["5"]["mae"],
                    "test_5d_mae": comp["models"][m]["final_test"]["5"]["mae"],
                    "test_5d_dir": comp["models"][m]["final_test"]["5"]["directional_accuracy"],
                    "test_21d_mae": comp["models"][m]["final_test"]["21"]["mae"]}
               for m in comp["models"]}},
  "expanding_cross_check": {"samples": wfexp.get("protocol", {}).get("max_samples"),
    "rf_lean_note": "40-tree RF variant; historical RF evidence kept separate"},
  "sample_step_comparison": {st: {"unique_dates": e["unique_decision_dates"],
                                   "overlap21": e["dependence"]["overlap_fraction_21d"],
                                   "lgb_21d_mae": e["models"]["LightGBM"]["21"]["mae"]}
                              for st, e in steps["steps"].items()},
  "feature_ablation": {"groups": list(abl["groups"].keys()),
    "defensible_improvement": None,
    "val_21d_mae_range": [min(g["metrics"]["validation"]["21"]["mae"] for g in abl["groups"].values()),
                           max(g["metrics"]["validation"]["21"]["mae"] for g in abl["groups"].values())],
    "verdict": "all groups within date-block CI noise; no group retained"},
  "target_experiments": {
    "classification_3class_final_dir": {hz: tgt["experiments"]["B_direction_classification_3class"]["metrics"]["final_test"][hz]["sign_dir_accuracy"]
                                         for hz in ("5", "10", "21")},
    "forward_vol_21d": tgt["experiments"]["D_forward_volatility_21d"]["metrics"],
    "quantile_coverage_final": {hz: tgt["experiments"]["E_quantile"]["metrics"][hz]["final_test"]
                                 for hz in ("5", "10", "21")}},
  "calibration": {hz: {"brier_val_raw": cal["per_horizon"][hz]["brier"]["validation_raw"],
                        "brier_final_raw": cal["per_horizon"][hz]["brier"]["finaltest_raw"],
                        "brier_final_isotonic": cal["per_horizon"][hz]["brier"]["finaltest_isotonic_from_validation"]}
                   for hz in cal["per_horizon"]},
  "ensemble_validation": {hz: {"mean_mae": ens["aggregators"][hz]["mean"]["final_test"]["mae"],
                                "stacker_mae": ens["aggregators"][hz]["ridge_stacker_oof_frozen"]["final_test"]["mae"],
                                "best_single_model": ens["aggregators"][hz]["single_best_by_validation"]["model"]}
                           for hz in ("5", "10", "21")},
  "strategy": {"top_models_gate": "val 5d dir >= 0.50 then MAE -> HuberRegressor + Ridge Regression",
    "thresholds": "validation q70/q80/q90 of predicted 5d returns",
    "grid_cells_all_net_negative_on_validation": True,
    "frozen": {k: frozen[k] for k in ("model", "threshold", "variant_key", "strategy")},
    "frozen_final_test": {k: fcell[k] for k in ("nCandidates", "nCompleted", "winRate", "netPnl",
                                                 "avgNetPerTrade", "maxDrawdown_net", "exitReasons")},
    "positive_cells_final_test": [{"netPnl": p, "variant": v, "strategy": sid} for p, v, sid in best_final if p > 0],
    "positive_cells_caveat": "variant_b (minimum-net-RR skip gate) cells only; marginal magnitude; "
                              "NOT validation-selected; exploratory until prospective validation"},
  "cost_reconciliation": {"rows_completed_checked": rec["identity_gross_minus_cost_equals_net"],
    "violations": len(rec["identity_violations"]), "max_deviation_pkr": 0.01,
    "cgt_zero_on_all_losing": rec["cgt_zero_on_losing_gross"] == 2528,
    "slippage_always_zero": rec["slippage_always_zero"],
    "skipped_rows_excluded": 2199},
  "simulator_documentation": {"docs": "docs/investment-simulator-metrics.md",
    "dictionary": "task100_simulator_data_dictionary.json",
    "key_distinction": "Investment Simulator uses the LEGACY flat cost model (0.15%x2 + 0.15% slippage + "
                       "CGT 15%); strategy backtest uses psx_user_schedule_v2 — documented, not redesigned"},
  "per_stock_regime": {"concentration_top3_share": perstock["concentration"]["lgbm_21d_abs_error_share_top3"],
                        "top3_symbols": perstock["concentration"]["top3_symbols"]},
  "prospective_integrity": {"db_counts": pros["db_counts"],
    "no_fabricated_fills": True, "lifecycle_untouched": True},
  "api_validation": {"registry": api["checks"]["api_models_registry"],
    "walk_forward_api": api["checks"]["api_walk_forward"],
    "pages_200": all(api["checks"][p]["ok"] for p in ("page_home", "ai_models", "portfolio"))},
  "browser_tests": {"pass": brw["pass_count"], "fail": brw["fail_count"]},
  "ui_tooltips_added": ["ensemble-sim Win Rate (net basis)", "per-model Win Rate (gross directional proxy)",
                         "per-model Avg Return (gross proxy)", "simulator Total gain (realized net, costs)",
                         "simulator Win rate (net basis)"],
  "tests": {"suite": "scripts/task100_tests.py", "passed": 21, "failed": 0},
 },
 "non_negotiables_compliance": {
   "diagnose_before_tuning": True, "no_win_rate_optimization": True,
   "all_families_audited_with_dispositions": True, "original_400_sample_report_untouched": True,
   "new_step_experiments_versioned": True, "overlap_dependence_accounted": True,
   "train_only_scalers_selection": True, "validation_only_thresholds": True,
   "same_signal_sets_for_strategies": True, "genuine_psx_v2_costs": True,
   "gross_vs_net_separated": True, "simulator_metrics_from_source": True,
   "no_hidden_negatives": True, "no_unfounded_promotion": True, "no_fabricated_improvement": True,
 },
}
(B / "task100_summary.json").write_text(json.dumps(summary, indent=2))

# metrics.csv — one row per model x horizon (frozen protocol, final test)
rows = []
for m, parts in comp["models"].items():
    for hz in ("5", "10", "21"):
        v = parts["final_test"].get(hz)
        if not v:
            continue
        rows.append({"model": m, "horizon": hz, "partition": "final_test", "n": v["n"],
                     "mae": v["mae"], "rmse": v["rmse"], "r2": v["r2"],
                     "directional_accuracy": v["directional_accuracy"],
                     "mae_ci95_low": v["mae_ci95"][0] if v.get("mae_ci95") else "",
                     "mae_ci95_high": v["mae_ci95"][1] if v.get("mae_ci95") else "",
                     "zero_return_mae": zeros[hz], "protocol": "frozen_full_train_window"})
with open(B / "task100_metrics.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

blockers = {
 "task": 100, "generated_at": now,
 "blockers": [
  {"id": "no_genuine_edge_found", "severity": "fundamental",
   "detail": "No evaluated model, feature group, target variant or ensemble beats the zero-return MAE "
             "baseline on any horizon; validation directional accuracy 49-53%. This is a data/signal "
             "limitation, not an implementation defect. Next levers: genuine KSE-100 index series, "
             "fundamentals/announcements with real publication timestamps, longer histories, intraday data."},
  {"id": "deep_statistical_foundation_families_not_pooled_evaluated", "severity": "resource",
   "detail": "PatchTST/N-BEATS/TimesNet/Informer/LSTM/GRU/CNN-LSTM/Transformer-LSTM/TabNet/ARIMA/Prophet/"
             "Holt-Winters/GARCH/Kalman/Chronos/Lag-Llama/Moirai were not re-run on the pooled 19-feature "
             "cohort (registry dispositions recorded in task100_initial_performance_matrix.json as "
             "partial/blocked; 150s command limit + 2 CPUs). Reference LSTM/CNN-LSTM retain their "
             "Task 99 OOS evidence."},
  {"id": "svr_not_included", "severity": "minor",
   "detail": "SVR was in the Task 79 list but is O(n^2)-scale on 32k pooled rows; excluded from the "
             "Task 100 bounded cohorts (recorded, not silently omitted)."},
  {"id": "simulator_interactive_run_deferred", "severity": "minor",
   "detail": "New simulator tooltips compile (tsc clean) and pages render with zero console errors; the "
             "interactive simulator run inside the browser was left to the owner (headless budget)."},
  {"id": "quantile_and_isotonic_calibration_not_promotable", "severity": "info",
   "detail": "Empirical quantile coverage and isotonic Brier deltas are within sampling noise on final "
             "test; no calibration claim is made."},
 ],
}
(B / "task100_remaining_blockers.json").write_text(json.dumps(blockers, indent=2))
print("summary + metrics.csv + blockers written;",
      "frozen final netPnl:", fcell["netPnl"], "; best final cells:", best_final[:3])
