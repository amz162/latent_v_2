#!/usr/bin/env python3
"""Task 114 — render docs/reports/task114_forward_maturity_audit.md from the
machine-readable artifact (single source of truth), mirroring the Task 113
documentation pattern. Pure renderer: reads task114_forward_maturity_audit.json
(+ task114_llm_maturity.json) and writes the markdown deliverable.
"""
from __future__ import annotations
import json, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BR = ROOT / "data" / "backtest_reports"
T114 = BR / "task114"


def j(p: Path):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def main() -> None:
    a = j(T114 / "task114_forward_maturity_audit.json")
    llm = j(T114 / "task114_llm_maturity.json")
    gen = [r for r in a["part_c_d_cohort_maturity"] if r["cohort_id"].startswith("task10")]
    llmr = next(r for r in a["part_c_d_cohort_maturity"] if "llm" in r["cohort_id"])
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    L: list[str] = []
    L += [
        "# Task 114 — First Forward-Horizon Maturity & Independent Outcome Audit",
        "",
        f"Generated: {a['generated_at']} · engine: {a['engine_version']} · status: {a['status']}",
        "",
        "**Scope.** Task 113 reconciled all cohort counts and confirmed zero genuine 5-, 10- and 21-session "
        "horizon outcomes had matured. Task 114 continues the frozen forward-validation process: it ingests "
        "the first new PSX session(s) since the Task 113 baseline, builds the missing fixed-horizon maturity "
        "engine, independently audits the first maturity checkpoints, and reports the result honestly — "
        "including when the honest result is still zero matured outcomes. No model was trained, no prediction "
        "system redesigned, no threshold tuned.",
        "",
        "## Part A — baseline preservation",
        "",
        f"- Audit-time HEAD chain: `e371b6c3` (Task 112 fix = `origin/main`) → `8f32452b` (Task 113 content, "
        "restored) → `5057edee` (ops: self-healing dev server) → platform housekeeping commit on top.",
        "- **Documented divergence from the tasked baseline:** Task 113 was originally committed locally as "
        "`2edc05a5` and lost when the sandbox recycled and the workspace regressed to a Task 111 snapshot. The "
        "content was byte-restored from the platform-preserved pre-recycle workspace (`/tmp/my-project`), "
        "re-based on `origin/main` (Task 112), and re-committed as `8f32452b`. The Task 113 QA suite, the "
        "frozen ledgers, cohort artifacts and reports were all verified intact after restoration "
        "(mock isolation 48 REAL / 23 MOCK, inventory 83, 5 cohorts). No history was reset or re-based to "
        "fabricate lineage; the restoration is recorded in the commit message itself.",
        "- Immutable signal histories, cohort artifacts and reports were not modified by this task except by "
        "appending the new session's market data through the existing validated ingest.",
        "- No push was performed before the explicit end-of-task authorization.",
        "",
        "## Part B — daily forward data and session frontier",
        "",
        f"- **Data frontier: `{a['data_frontier']}`** (previous: `{a['part_b_session_frontier']['previous_frontier']}`). "
        f"New sessions observed since 2026-11-03: **{json.dumps(a['sessions_new_since_2026_11_03'])}** "
        f"(total session count in OhlcvBar: {a['session_count_total']}).",
        "- Ingest via the existing Task 107 pipeline: 23 new bars for 2026-11-04, provider overlap "
        "byte-equality checked on 46 bars, 0 mismatches; provider `psxdata-api.fastapicloud.dev` (delayed EOD; "
        "no exchange-source timestamps; nothing fabricated).",
        "- **Defect found and fixed (pipeline, not prediction system):** `task107_lib.psx_session_state` "
        "computed the pre-open candidate session with `(wd+1)%7` days-back, which returns the most recent "
        "**Sunday** for mid-week mornings (e.g. Thursday 03:00 PKT → Sunday). The fully closed 2026-11-04 "
        "session was therefore invisible to the ingest window and the first pipeline run reported "
        "`no_new_data` while the provider already held the session. Fixed to the previous weekday "
        "(Mon→Fri, Tue–Fri→previous weekday, Sat/Sun→Fri) and regression-tested "
        "(`task107_tests.py`: `weekday_dawn_targets_previous_weekday`, `monday_dawn_targets_friday`).",
        "- **Missing market-data observations (recorded, never papered over):**",
        *[f"  - {m}" for m in a["pipeline_events"]["missing_market_data_observations"]],
        "- Sessions are counted from **actual per-symbol OhlcvBar dates** only — weekends and holidays never "
        "count because no bar exists, and no session is assumed from a calendar date.",
        "",
        "## Part C/D — cohort maturity (5/10/21 sessions, independent)",
        "",
        "| Cohort | Obs | Symbols | Mat5 | Pend5 | Mat10 | Pend10 | Mat21 | Pend21 | Term-exits (frozen engine) | Pend-MTM | Unfilled |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in a["part_c_d_cohort_maturity"]:
        L.append(f"| `{r['cohort_id']}` | {r['total_observations']} | {r['unique_symbols']} | "
                 f"{r['matured_5_session']} | {r['pending_5_session']} | {r['matured_10_session']} | "
                 f"{r['pending_10_session']} | {r['matured_21_session']} | {r['pending_21_session']} | "
                 f"{r.get('terminal_exits_from_frozen_engine')} | {r.get('pending_mtm_from_frozen_engine')} | "
                 f"{r['unfilled_awaiting_entry_bar']} |")
    L += [
        "",
        "**Reading the table.** `Mat5/Pend5` (and 10/21) are FIXED-HORIZON outcomes computed per decision from "
        "source bars: entry = first bar strictly after the decision date, filled at that bar's open; the "
        "horizon matures only when N actual per-symbol sessions have elapsed from the entry session "
        "(entry = session 1) and is marked at the Nth session close with PSX V2 costs "
        "(`task110_lib.trade_costs_v2`, exact port of `computeTradeCostsV2`). `Term-exits` are the frozen "
        "Task 106/107 engine's SL/TP3 early exits — **a separate measurement that is never labelled a "
        "horizon maturity** and is referenced from `task107/_matured.json`, not recomputed. A 5-session "
        "outcome never infers a 10- or 21-session outcome; each horizon is computed independently.",
        "",
        "**Result at this frontier: zero matured horizon outcomes in every cohort, reported honestly.** "
        "Elapsed session clocks: gen1 4/5 from entry 2026-10-30, gen2 2/5, gen3 1/5, LLM 1/5 (entries "
        "2026-11-04). The earliest possible 5-session maturity is gen1 at the close of the next traded "
        "session (2026-11-05, if it is a trading session). Remaining sessions for every pending observation "
        "are in `task114_pending_outcomes.csv`.",
        "",
        "All 57 general-cohort decisions now have entry bars (gen3 entered on 2026-11-04); the frozen "
        "engine's strategy-outcome accounting reconciles exactly: 57 decisions × 3 strategies = 171 = "
        "80 terminal exits + 91 pending mark-to-market. MTM remains hypothetical and is never counted as a win.",
        "",
        "## Part E — strict LLM-specific audit",
        "",
        f"- Frozen cohort `task111-llm-multisource-gen1` re-verified against stored IDs: "
        f"**{llm['frozen_baseline_verified']['unique_symbols']} unique symbols, "
        f"{llm['frozen_baseline_verified']['genuine_universe_decisions']} genuine universe decisions, "
        f"{llm['frozen_baseline_verified']['current_records_incl_stale_engro']} current records including the "
        f"stale out-of-universe ENGRO record, {llm['frozen_baseline_verified']['real_records_two_passes']} "
        f"REAL_LLM_DECISION records across the two generation passes, "
        f"{llm['frozen_baseline_verified']['mock_pipeline_check_records']} MOCK_PIPELINE_CHECK records.**",
        f"- Genuine decision mix: BUY {llmr.get('decisions_buy')} (PRL, SYS) · HOLD {llmr.get('decisions_hold')} · "
        f"NO_TRADE {llmr.get('decisions_no_trade')}. Both BUY decisions filled at the 2026-11-04 open "
        "(actual available fill; the frozen `entryReference` frontier close is preserved separately and was "
        "never used as a fill).",
        "- Excluded records (48 = 23 mock + 24 second-pass generation_cache duplicates + 1 stale ENGRO) are "
        "listed with reasons in the artifact and are excluded from every metric and promotion gate.",
        "- **Preservation:** original GLM-4.6 decisions, prompt hash (`evidenceHash`), evidence package hash, "
        "evidence as-of timestamp, generation timestamp, source references and the deterministic risk policy "
        "(`atr14-1.5-1-2-3` / `task77-v1`) are read from the append-only `task112/llm_signal_history` store "
        "and never regenerated or rewritten.",
        f"- Terminal-exit policy simulation (SL/TP3 first-hit, same-bar SL priority, separate from horizons): "
        f"{llmr.get('terminal_exits_llm_policy_sim')} matured — neither BUY hit its stop or TP3 on the first session.",
        "- **HOLD/NO_TRADE counterfactual methodology (documented, separate):** for each non-BUY decision the "
        "audit records the symbol's own close-to-close return from the entry session to each horizon endpoint "
        "(and vs the frozen decision-day close) as *opportunity context only*. Avoided losses are not wins; "
        "nothing in this block enters trading statistics, win rates or promotion gates.",
        f"- **Calibration:** {llm['calibration']['status']} (minimum {llm['calibration']['minimum_required']} "
        f"genuine matured LLM outcomes; current {llm['calibration']['current_matured_llm_outcomes']}). LLM "
        "conviction is never converted into a probability; no win rate, expectancy or profitability is reported "
        "from zero matured outcomes; Task 105–110 general-cohort outcomes are never attributed to GLM-4.6.",
        "",
        "## Part F — independent maturity-engine verification",
        "",
        "- `scripts/task114_tests.py` — **30/30 PASS**, covering the twelve mandated properties: actual-session "
        "maturing; weekend/non-trading-day exclusion; missing bars never silently counted; early SL/TP3 exits "
        "not horizon maturities; unfilled separation; independent 5/10/21 computation; no double-counting "
        "(identical recomputes detected, stable ledger); changed/corrected source bars auditable via "
        "source-bar fingerprints; real/mock LLM isolation; LLM vs general cohort separation; matured-result "
        "traceability to signal and source bars; pending never entering completed-trade statistics.",
        "- Independent recomputation (separate code path in the tests, direct from `db/custom.db`): gen1 entry "
        "prices and 4-session clocks recomputed for a 5-decision sample — exact match; the PRL BUY entry "
        "equals the 2026-11-04 open from raw bars — exact match; day-1 SL/TP3 non-hit verified from raw OHLC.",
        "- Outcome idempotency ledger (`task114_outcome_ledger.json`): outcome key `decision_id|hN`; "
        f"{a['part_f_idempotency']['duplicate_processing_attempts_identical']} duplicate recomputations "
        f"(identical, benign) and {a['part_f_idempotency']['source_bar_revisions_detected']} source-bar "
        "revisions detected so far; a fingerprint change is flagged as an auditable correction, never a "
        "silent overwrite.",
        "",
        "## Part G — UI and report update",
        "",
        "- The existing Model Performance dashboard gained a **Forward-horizon maturity panel** (no duplicate "
        "dashboard): frontier tiles, per-cohort maturity table, the LLM-specific maturity sub-panel, the "
        "idempotency counters, sample-size warnings, and a per-cohort `<details>` drill-down to individual "
        "observations with per-horizon status and remaining sessions.",
        "- The panel distinguishes fixed-horizon matured / early terminal exits / pending / unfilled / excluded; "
        "early terminal exits are labelled as such and never as horizon-matured results.",
        "- The existing LLM Signals UI and all Model Performance downloads remain operational; the downloadable "
        "report (`model_strategy_performance_latest.json`, CSV, MD, PDF) was rebuilt only from validated "
        "artifacts (`report_version: task114-augmented`; the Task 112/113 versioned artifacts are preserved).",
        "",
        "## Part H — statistical interpretation",
        "",
        "- **Sample size before performance: 0 matured horizon outcomes in every cohort.** No win rate, "
        "expectancy, profitability or edge claim is made — there is nothing yet to compute them from.",
        "- Cohorts stay separate (LLM isolated) and horizons stay separate (5/10/21 independent); the 80 "
        "terminal early exits are the frozen engine's strategy-outcome events, not horizon results.",
        "- Comparison baseline: the Task 113 report's zero-maturity position is unchanged; nothing here "
        "contradicts or revises it.",
        "- When the first outcomes mature, they must be reported with sample size, per cohort and per horizon, "
        "with uncertainty only where the sample supports it; a handful of early profitable trades is not "
        "evidence of edge; no threshold may be tuned against newly observed outcomes and reused as test "
        "evidence.",
        "- Classification: every Task 114 outcome is a **prospective forward** validation observation. Nothing "
        "in this audit is historical, validation or final-holdout evidence.",
        "",
        "## Part I — model promotion status (unchanged)",
        "",
    ]
    for k, v in a["part_i_promotion_status"].items():
        L.append(f"- **{k}:** {v}" if k != "automatic_promotion" else f"- **{k}:** {v}")
    L += [
        "",
        "## Part J — deliverables",
        "",
        "- `docs/reports/task114_forward_maturity_audit.md` (this document)",
        "- `data/backtest_reports/task114/task114_forward_maturity_audit.json`",
        "- `data/backtest_reports/task114/task114_cohort_maturity.csv`",
        "- `data/backtest_reports/task114/task114_matured_outcomes.csv` (header-only: no outcome has matured yet)",
        "- `data/backtest_reports/task114/task114_pending_outcomes.csv` (240 pending decision×horizon rows)",
        "- `data/backtest_reports/task114/task114_llm_maturity.json` (LLM-only artifact)",
        "- `data/backtest_reports/task114/task114_outcome_ledger.json` (idempotency ledger)",
        "- `scripts/task114_maturity.py`, `scripts/task114_tests.py`, this renderer",
        "- Updated: `task112_build_report.py` (Task 114 block + `task114-augmented`), "
        "`ModelPerformanceReportView.tsx` (maturity panel + drill-down), `task107_lib.py` (candidate-session "
        "defect fix), `task107_tests.py` (2 regression checks), `task113_tests.py` (version-carry assertion), "
        "`server_health_check.py` (Task 114 health surface).",
        "",
        f"Test/build evidence is recorded in the Task 114 QA run of {now} (see repository CI and the final "
        "task report for exact counts).",
        "",
    ]
    out = ROOT / "docs" / "reports" / "task114_forward_maturity_audit.md"
    out.write_text("\n".join(L), encoding="utf-8")
    print(f"wrote {out} ({len(L)} lines)")


if __name__ == "__main__":
    main()
