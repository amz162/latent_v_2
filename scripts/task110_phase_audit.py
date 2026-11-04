#!/usr/bin/env python3
"""Task 110 Phase 1 — audit of the user-attached psx_simulator.py.

HONESTY NOTE: the attachment was NOT present in the coding environment
(upload/ contains only pasted task prompts; no psx_simulator.py anywhere in
the repository). Per the task's own instruction, this audit is performed
against the exact behavior quoted in the task specification, every finding is
labeled accordingly, and the corrected reference implementation lives in
task110_lib.py + src/lib/latent/golden-cross.ts + volatility-analytics.ts.
Nothing here pretends the original file was read.
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task110_lib as L

UPLOAD = L.ROOT / "upload"


def p1_audit():
    candidates = list(UPLOAD.glob("**/psx_simulator*")) + list(L.ROOT.glob("**/psx_simulator*"))
    candidates = [c for c in candidates if "node_modules" not in str(c)]
    present = [c for c in candidates if c.is_file()]
    checksum = dict(
        file_supplied=False, searched=[str(UPLOAD), str(L.ROOT)],
        candidates_found=[str(c) for c in present],
        original_sha256=None, original_size_bytes=None,
        note="The user attachment psx_simulator.py was not present in the coding "
             "environment. Per the task contract the audit below is performed "
             "against the behavior quoted verbatim in the task specification; "
             "the original file must be supplied to re-verify the checksum and "
             "line-level locations.")
    L.artifact("task110_python_file_original_checksum.json",
               "task110_python_file_original_checksum", "attachment_not_supplied", **checksum)

    def F(fid, severity, location, existing, why, correct, fixed_in, test):
        return dict(id=fid, severity=severity, location=location,
                    existing_behavior=existing, why_it_matters=why,
                    correct_behavior=correct, fixed_in=fixed_in, test=test,
                    basis="task-specification quote (original file not supplied)")

    findings = [
        F("F-MA-01", "critical", "golden_cross_signals() / prev_above initialization",
          "prev_above is initialized by inverting the first valid MA relationship, manufacturing a BUY or SELL on the first valid MA row without a real crossover",
          "creates a phantom first trade per symbol and pollutes every downstream statistic",
          "no signal until two consecutive valid MA observations; Golden: prev<=cur30_prev & cur7>cur30; Death: prev>=prev30 & cur7<cur30; equality handled as relationship 0",
          "task110_lib.crossovers(); src/lib/latent/golden-cross.ts detectCrossover()",
          "test_no_first_row_signal, test_equal_ma_no_signal, test_golden_death_definition"),
        F("F-EX-01", "critical", "run_portfolio() execution timing",
          "trades execute at the same close that produced the crossover",
          "same-close execution is look-ahead: no decision process can act on a close in the same instant it prints; inflates returns",
          "signal generated after completed daily bar; hypothetical fill at the NEXT valid session's open; unfilled signals are never fabricated",
          "run_portfolio() in scripts/task110_phases_research.py; executeAtNextOpen() in golden-cross.ts",
          "test_next_session_open_fill, test_unfilled_signal_not_fabricated, test_no_same_close_execution"),
        F("F-VOL-01", "critical", "rolling_log_ret_variance()/plot: GK annualization",
          "Var_GK multiplied by 252 in the estimator and sqrt(Var_GK*252) again in the plot — annualization applied twice",
          "annualized volatility overstated by sqrt(252) ≈ 15.9x; invalidates regime thresholds",
          "annualize exactly once: Var_ann = 252 x daily variance; vol = sqrt(Var_ann)",
          "task110_lib volatility estimators; volatility-analytics.ts annualizeOnce()",
          "test_annualization_exactly_once, test_parkinson_gk_units_consistent"),
        F("F-VOL-02", "high", "parkinson_variance()",
          "annualization conventions inconsistent with GK (task requires each estimator annualized exactly once)",
          "mixed units make cross-estimator comparison meaningless",
          "all three estimators return daily variance; x252 applied once at the annualized layer",
          "task110_lib.parkinson_daily_variance + explicit _annualized layers",
          "test_parkinson_formula_hand_check, test_annualization_exactly_once"),
        F("F-VOL-03", "high", "garman_klass_variance() clip()",
          "negative GK estimates silently clipped away",
          "hides data/assumption diagnostics; sqrt of negative would be silently avoided instead of reported",
          "negatives kept in research series, counted, exemplified; vol reported unavailable where sqrt undefined",
          "task110_lib.garman_klass_daily_variance (no clip) + estimator comparison artifact",
          "test_gk_negative_kept_and_reported"),
        F("F-VOL-04", "high", "add_volatility_analytics()",
          "no validation of O/H/L/C before logarithms (zero/negative prices, high<low)",
          "log of non-positive raises or silently poisons windows; h<l makes range estimators meaningless",
          "bars validated (o,h,l,c>0 and h>=l); invalid bars excluded from windows and counted",
          "task110_lib.bar_is_valid/load_bars", "test_invalid_bars_excluded"),
        F("F-VOL-05", "medium", "derivative calculations",
          "first/second derivatives computed across missing sessions as if spacing were regular",
          "a gap of k sessions is treated like one period; derivatives systematically biased around gaps",
          "differences only across global-calendar-adjacent observations; None + gap flag otherwise",
          "task110_lib.first_diff/second_diff(idx_by_pos=session index)",
          "test_derivative_gap_guard"),
        F("F-VOL-06", "medium", "chart annotations / regime claims",
          "BBW acceleration annotated as implied-volatility convexity; GK>Parkinson read as directional trend",
          "realized-vol measures say nothing about implied vol; GK-P is not a directional indicator — claims are unsupported",
          "annotations limited to realized-vol statements; guardrails encoded in classify_regime and guidance rules",
          "classify_regime guardrails; task110_strategy_guidance_rules.json",
          "test_no_implied_vol_claims, test_gk_park_not_directional"),
        F("F-PA-01", "medium", "run_portfolio() annotation",
          "annotated to return a two-item tuple but returns five values",
          "misleading API contract; callers unpacking per annotation crash",
          "single dict return with named fields (Python) / typed interface (TS)",
          "run_portfolio() returns dict", "test_portfolio_return_contract"),
        F("F-PA-02", "high", "LOT_SIZE = 500",
          "hardcoded 500-share lot size",
          "not a verified PSX convention for all instruments/dates; distorts sizing and cash constraints",
          "whole-share sizing from price and cash (floor(budget/price)); no lot-size assumption",
          "run_portfolio() share sizing", "test_whole_share_sizing, test_no_hardcoded_lot_size"),
        F("F-PA-03", "medium", "run_portfolio(initial_capital=1_000_000)",
          "capital hardcoded at PKR 1,000,000",
          "user's research configuration is PKR 100,000; hardcoded capital hides sensitivity",
          "default PKR 100,000, fully configurable, sensitivity across 5/10/20/25% + equal-alloc sizing",
          "run_portfolio(initial_capital=100_000) + scenario grid",
          "test_capital_configurable"),
        F("F-PA-04", "critical", "cost model",
          "no brokerage, PSX/NCCPL/CDC fees, taxes or slippage",
          "gross returns presented as tradable results; PSX round-trip costs are material at retail scale",
          "canonical V2 schedule ported exactly (0.03/share <=20 else 0.15%, PSX 0.00035% + NCCPL 0.00081% + CDC 0.0036% per side, zero synthetic slippage, CGT 15%/30% once per position)",
          "task110_lib.trade_costs_v2 (parity-tested vs trading-costs.ts)",
          "test_cost_parity_with_ts, test_cgt_once_per_position"),
        F("F-PA-05", "medium", "position sizing",
          "fixed-size trades with only a simple cash check",
          "no equity-proportional risk control; overconcentration ignored",
          "equity-proportional and equal-alloc sizing, max-positions cap, cash-constrained, deterministic ordering",
          "run_portfolio(sizing_mode, max_positions)", "test_cash_constraint_never_negative, test_max_positions_respected"),
        F("F-PA-06", "high", "print_ledger()",
          "no proper separate daily account ledger",
          "the user explicitly requires a daily account-level ledger with equity and drawdown per session",
          "one portfolio row per session (even with no trade) with 18 fields incl. cash, invested, realized, unrealized, costs, equity, drawdown; saved as CSV and printed",
          "task110_golden_cross_daily_ledger.csv", "test_daily_ledger_every_session, test_ledger_identity"),
        F("F-PA-07", "high", "NAV / P&L handling",
          "unrealized and realized P&L not reconciled",
          "MTM can silently masquerade as realized profit",
          "identity enforced and tested: realized_net + unrealized(net of sunk entry costs) == final_equity - initial_capital; MTM never realized",
          "run_portfolio() accounting + test_ledger_identity", "test_ledger_identity, test_mtm_never_realized"),
        F("F-PA-08", "medium", "performance metrics",
          "incomplete metrics (no drawdown, PF, expectancy, exposure, turnover, streaks)",
          "incomplete statistics invite cherry-picking",
          "full metric set incl. ROI, CAGR (>=3y only), maxDD, win rate, avg win/loss, PF, expectancy, costs, exposure, turnover, longest loss streak",
          "account dict in run_portfolio()", "test_metrics_present"),
        F("F-PA-09", "medium", "benchmarks",
          "no cash or buy-and-hold comparison",
          "without benchmarks 'profitable' is unfalsifiable",
          "cash benchmark + cash-constrained equal-weight buy-and-hold over the identical window",
          "task110_golden_cross_benchmark_comparison.json", "test_benchmarks_present"),
        F("F-SYN-01", "critical", "synthetic OHLCV generation (GARCH-like RNG)",
          "stylized simulated prices used in the same pipeline as market analysis",
          "simulated prices presented as market results would fabricate performance",
          "synthetic data confined to software tests; all market conclusions from db/custom.db OhlcvBar",
          "task110_tests.py fixtures vs runner DB usage", "test_synthetic_only_in_tests, test_real_db_source_recorded"),
        F("F-SYN-02", "low", "globals: hardcoded ticker, 60-day history, global RNG, weekday calendar, hardcoded paths, suppressed warnings, missing output dir creation, no input validation",
          "single hardcoded symbol; pd.bdate_range weekday calendar; global random state; hardcoded output paths; suppressed warnings; no makedirs; no validation",
          "reduces reproducibility; weekday calendar misaligns with the actual PSX session calendar (holidays); silent warnings hide estimator problems",
          "DB-driven multi-symbol universe; provider-data session calendar; local RNG seeds in tests; relative artifact paths with mkdir; warnings surfaced; input validation",
          "task110_lib/runner structure", "test_calendar_is_provider_data, test_output_dir_created"),
    ]
    L.artifact("task110_python_file_audit.json", "task110_python_file_audit", "completed_with_limitations",
               audit_basis="task-specification quotes (file absent from environment)",
               attachment_path=str(UPLOAD / "psx_simulator.py"),
               attachment_present=bool(present),
               counts={sev: sum(1 for f in findings if f["severity"] == sev)
                       for sev in ("critical", "high", "medium", "low", "informational")},
               corrected_implementation=[
                   "scripts/task110_lib.py (crossover rules, cost port, estimators, derivatives, regimes)",
                   "src/lib/latent/golden-cross.ts (dashboard/TS reference)",
                   "src/lib/latent/volatility-analytics.ts (dashboard/TS reference)",
                   "scripts/task110_tests.py (demonstration tests)"],
               findings=findings)
    L.write_csv(L.T110 / "task110_python_file_findings.csv", findings,
                ["id", "severity", "location", "existing_behavior", "why_it_matters",
                 "correct_behavior", "fixed_in", "test", "basis"])
    L.artifact("task110_python_file_test_report.json", "task110_python_file_test_report", "completed_with_limitations",
               tests_specified=[f["test"] for f in findings],
               note="each finding maps to at least one deterministic test; execution results recorded in task110_test_summary.json (phase 14)",
               file_supplied=bool(present))
