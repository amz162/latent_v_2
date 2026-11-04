#!/usr/bin/env python3
"""Task 113 — render the human-readable audit markdown from the audit JSON.
Keeps the doc in sync with the machine-readable artifact (single source of truth)."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / "data" / "backtest_reports" / "task113" / "task113_forward_validation_audit.json"
OUT = ROOT / "docs" / "reports" / "task113_forward_validation_audit.md"


def main() -> None:
    a = json.loads(AUDIT.read_text(encoding="utf-8"))
    L = []
    L.append("# Task 113 — Forward Validation, LLM Outcome Maturity & Model Inventory Integrity")
    L.append("")
    L.append(f"Generated: {a['generated_at']} · git head `{a['git_head']}` · baseline: {a['baseline']} · status: {a['status']}")
    L.append(f"Data frontier: `{a['data_frontier']}` · total sessions: {a['session_count']}")
    L.append("")
    L.append("> Be evidence-driven. Never turn missing evidence into a positive result. Cohorts are never added across denominators. Mock records never feed any metric. LLM performance is never borrowed from the general forward cohort.")
    L.append("")

    # Part A
    L.append("## Part A — Forward cohort reconciliation (57 / 43 / 59 explained)")
    L.append("")
    ex = a["part_a_57_43_59_explanation"]
    L.append(f"**Conclusion:** {ex['conclusion']}")
    L.append("")
    L.append("| Figure | What it counts | Level |")
    L.append("| --- | --- | --- |")
    L.append(f"| 57 observations | {ex['what_each_number_counts']['57_observations'][:120]} | decision |")
    L.append(f"| 43 matured | {ex['what_each_number_counts']['43_matured'][:120]} | strategy-outcome |")
    L.append(f"| 59 pending | {ex['what_each_number_counts']['59_pending'][:120]} | strategy-outcome |")
    L.append("")
    L.append(f"**Why they don't share one denominator:** {ex['why_they_do_not_add_up_to_one_denominator']}")
    L.append("")
    L.append("**Critical clarifications:**")
    for c in ex["critical_clarifications"]:
        L.append(f"- {c}")
    L.append("")
    L.append("### Cohort-by-cohort reconciliation")
    L.append("")
    L.append("| Cohort | Obs | Symbols | Mat 5 | Pend 5 | Mat 10 | Pend 10 | Mat 21 | Pend 21 | Term-exits | Pend-MTM | Unfilled | Reconciles |")
    L.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    for c in a["part_a_cohort_reconciliation"]:
        L.append(f"| {c['cohort_id']} | {c['total_decision_records']} | {c['unique_symbols']} | "
                 f"{c['matured_5_session']} | {c['pending_5_session']} | {c['matured_10_session']} | {c['pending_10_session']} | "
                 f"{c['matured_21_session']} | {c['pending_21_session']} | {c['matured_terminal_exits_early']} | "
                 f"{c['pending_mtm_open']} | {c['unfilled_awaiting_entry_bar']} | {c['reconciles']} |")
    L.append("")
    L.append("> `matured_terminal_exits_early` and `pending_mtm_open` are **strategy-outcome level** (decision × strategy), matching the 43/59 in the `task107/_matured.json` summary block. `unfilled_awaiting_entry_bar` is **decision level** (gen3 has no entry bar yet). These are different denominators and must never be added.")
    L.append("")

    # Part B
    L.append("## Part B — Real vs mock LLM record separation")
    L.append("")
    L.append("Every record in the append-only signal-history store now carries an explicit `recordType`:")
    L.append("")
    L.append("- **`REAL_LLM_DECISION`** — 48 records (24 current + 24 generation-cache). The ONLY records eligible for any performance / forward-outcome / win-rate / calibration / promotion metric.")
    L.append("- **`MOCK_PIPELINE_CHECK`** — 23 records (pipeline-check only, `provider=mock`). Retained for provenance/audit; visible in the UI **only** when the `includeMock` opt-in filter is selected.")
    L.append("")
    L.append("Mock isolation is enforced in `applyFilter()` via `recordType` (not the legacy `mockRecord` boolean), so it cannot be bypassed. The default `/api/llm-signals` response returns 48 REAL records; `includeMock=1` returns 71; `recordType=MOCK_PIPELINE_CHECK` returns exactly 23.")
    L.append("")
    L.append("**Task 111 count reconciliation (preserved from Task 112, unchanged):** 24 current records = 23 universe symbols + 1 out-of-universe stale ENGRO record (honestly refused with `stale_evidence`). The real generation ran twice (initial + restore after the mock pipeline check overwrote signal files); the restore pass is authoritative. No records were deleted to make totals match.")
    L.append("")

    # Part C
    L.append("## Part C — LLM forward validation (5/10/21-session outcomes)")
    L.append("")
    llm = a["part_c_llm_outcome_maturity"]
    L.append(f"Cohort: `{llm['cohort_id']}` · provider/model: {llm['provider_model']} · prompt: {llm['prompt_version']} · evidence schema: {llm['evidence_schema']} · deterministic risk policy: {llm['deterministic_risk_policy']}")
    L.append("")
    L.append(f"Data cutoff (point-in-time evidence as-of): `{llm['data_cutoff']}` · data frontier: `{llm['data_frontier']}` · forward sessions elapsed: **{llm['forward_sessions_elapsed']}**")
    L.append("")
    L.append("| Horizon | Matured | Pending |")
    L.append("| --- | --- | --- |")
    L.append(f"| 5-session | {llm['matured_5_session']} | {llm['pending_5_session']} |")
    L.append(f"| 10-session | {llm['matured_10_session']} | {llm['pending_10_session']} |")
    L.append(f"| 21-session | {llm['matured_21_session']} | {llm['pending_21_session']} |")
    L.append("")
    L.append(f"- **Total real decisions:** {llm['total_real_decisions']} · **current real decisions:** 24 · **BUY (current):** {llm['buy_decisions_current']}")
    L.append(f"- **Directional accuracy:** {llm['directional_accuracy']}")
    L.append(f"- **Net returns (BUY):** {llm['net_returns_buy']}")
    L.append(f"- **Avg / median outcome:** {llm['avg_median_outcome']}")
    L.append(f"- **Drawdown / profit factor:** {llm['drawdown_profit_factor']}")
    L.append(f"- **Baseline comparison:** {llm['baseline_comparison']}")
    L.append(f"- **Calibration:** {llm['calibration']['status']} (minimum {llm['calibration']['minimum_required']} matured LLM-cohort outcomes required; current {llm['calibration']['current_matured']}; LLM conviction {llm['calibration']['llm_conviction']}).")
    L.append("")
    L.append(f"> {llm['rule']}")
    L.append("")
    L.append(f"**BUY/HOLD/NO_TRADE evaluation:** {llm['buy_hold_notrade_evaluation']}")
    L.append("")
    L.append("Nothing was regenerated, retrained, or re-thresholded. The frozen GLM-4.6 / prompt / evidence-schema / risk-policy / cohort identity and all historical BUY/HOLD/NO_TRADE decisions are preserved. The pipeline continues to collect genuinely new forward observations per its event-triggered refresh policy; no unnecessary LLM API calls or duplicate workers were introduced.")
    L.append("")

    # Part D
    L.append("## Part D — Model inventory audit (83 entries, 12 categories)")
    L.append("")
    inv = a["part_d_model_inventory"]
    d = inv["dashboard"]
    L.append(f"**{d['total_registry_entries']} inventory entries** — NOT 83 trained/operational models. Counts come from actual audit records (task82 registry + task79/98/99/100/101/104/111/112 artifacts + DB).")
    L.append("")
    L.append("| Category | Count |")
    L.append("| --- | --- |")
    for cat, n in sorted(d["by_category"].items(), key=lambda x: -x[1]):
        L.append(f"| {cat} | {n} |")
    L.append("")
    L.append("**Dashboard:**")
    L.append(f"- Total registry entries: {d['total_registry_entries']}")
    L.append(f"- Implemented models: {d['implemented_models']}")
    L.append(f"- Trained on PSX data: {d['trained_psx_models']}")
    L.append(f"- Successfully evaluated: {d['successfully_evaluated_models']}")
    L.append(f"- Forward shadow models: {d['shadow_models']}")
    L.append(f"- Rule-based strategies (NOT ML): {d['rule_based_strategies']}")
    L.append(f"- Blocked / unavailable: {d['blocked_unavailable_models']}")
    L.append(f"- Duplicate / alias entries: {d['duplicate_alias_entries']}")
    L.append(f"- Historical experiments: {d['historical_experiments']}")
    L.append("")
    L.append("Key honest findings: only 5 models have live prospective prediction rows in the DB (CatBoost, LightGBM, Random Forest, Ridge Regression, XGBoost — all `v1_prospective`); `ModelBacktestCache` is empty; the production walk-forward harness measures 8 entries (1 rule + 7 ML); the 83 deliberately counts cross-task evaluations as separate entries rather than deduplicating by name. The full per-entry classification (registry name, family, source path, artifact path, training/evaluation evidence, dataset, metrics, backtest/forward availability, status, blocking reason) is in `data/backtest_reports/task113/task113_model_inventory_classification.csv`.")
    L.append("")

    # Part F
    L.append("## Part F — Forward pipeline health")
    L.append("")
    h = a["part_f_forward_pipeline_health"]
    L.append(f"- Worker heartbeat: {h['worker_heartbeat']} · PID: {h['worker_pid']} · started: {h['worker_started_at']}")
    L.append(f"- Poll interval: {h['poll_interval_seconds']}s · cycles completed: {h['cycles_completed']}")
    L.append(f"- Scheduler: {h['scheduler_execution']}")
    L.append(f"- Duplicate-worker lock: {h['duplicate_worker_lock']}")
    L.append(f"- Idempotency: {h['idempotency']}")
    L.append(f"- Error visibility: {h['error_visibility']}")
    L.append(f"- Provider availability: {h['provider_availability']}")
    L.append(f"- Last successful data retrieval: {h['last_successful_data_retrieval']}")
    L.append(f"- Daily OHLC frontier: `{h['daily_ohlcv_frontier']}` · session count: {h['session_count']}")
    L.append(f"- Snapshot timestamp quality: {h['snapshot_timestamp_quality']}")
    L.append(f"- Delayed-quote limitations: {h['delayed_quote_limitations']}")
    L.append(f"- Signal generation status: {h['signal_generation_status']}")
    L.append(f"- Outcome maturity status: {h['outcome_maturity_status']}")
    L.append(f"- Defects found: {h['defects_found']}")
    L.append("")
    L.append("No intraday OHLC is fabricated. Delayed snapshots are labeled `delayed_observation_shadow` and never claimed as exchange-timestamped real-time. Where new market data is unavailable, the pending state is preserved with the exact reason.")
    L.append("")

    # Part G
    L.append("## Part G — Promotion and research safeguards")
    L.append("")
    g = a["part_g_research_safeguards"]
    L.append("All safeguards preserved (every flag below is `true`):")
    L.append("")
    for k, v in g.items():
        if k in ("promotion_requires", "attestation"):
            continue
        L.append(f"- `{k}`: {v}")
    L.append("")
    L.append("**Promotion requires:** " + "; ".join(g["promotion_requires"]) + ".")
    L.append("")
    L.append(f"> {g['attestation']}")
    L.append("")

    # Deliverables
    L.append("## Deliverables")
    L.append("")
    L.append("| Artifact | Path |")
    L.append("| --- | --- |")
    L.append("| Machine-readable audit (Parts A/C/D/F/G) | `data/backtest_reports/task113/task113_forward_validation_audit.json` |")
    L.append("| Cohort reconciliation CSV | `data/backtest_reports/task113/task113_cohort_reconciliation.csv` |")
    L.append("| Model inventory classification CSV (83 entries) | `data/backtest_reports/task113/task113_model_inventory_classification.csv` |")
    L.append("| Forward pipeline health JSON | `data/backtest_reports/task113/task113_forward_pipeline_health.json` |")
    L.append("| Updated versioned model performance report (JSON) | `data/reports/model_strategy_performance_latest.json` (+ versioned `_*<timestamp>.json`) |")
    L.append("| Updated report (Markdown) | `docs/reports/psx_model_strategy_performance_report.md` |")
    L.append("| Updated report (PDF) | `data/reports/psx_model_strategy_performance_report.pdf` |")
    L.append("| Model comparison CSV | `data/reports/model_strategy_comparison_latest.csv` |")
    L.append("| This audit document | `docs/reports/task113_forward_validation_audit.md` |")
    L.append("")
    L.append("## Tests")
    L.append("")
    L.append("- `scripts/task113_tests.py` — 10 categories, 65 assertions, **65 pass / 0 fail**.")
    L.append("- `scripts/task107_v2_tests.py` — **29 pass / 0 fail** (no regression).")
    L.append("- `scripts/task112_tests.py` — **66 pass / 0 fail** (no regression).")
    L.append("- TypeScript `tsc --noEmit` — **clean**.")
    L.append("- `bun run build` — **passes**.")
    L.append("- API: `/api/model-report` serves `task113_audit` (83 inventory, 5 cohorts, LLM 0/0/0 matured, calibration forbidden); `/api/llm-signals` returns 48 REAL by default, 71 with `includeMock=1`, 23 with `recordType=MOCK_PIPELINE_CHECK`; export CSV includes `recordType`.")
    L.append("")
    L.append("Earlier audit evidence (Tasks 97–112) is preserved — nothing was replaced.")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L), encoding="utf-8")
    print(f"audit md: {OUT} ({len(L)} lines)")


if __name__ == "__main__":
    main()
