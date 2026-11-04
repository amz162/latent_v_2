# Task 113 — Forward Validation, LLM Outcome Maturity & Model Inventory Integrity

Generated: 2026-11-04T17:54:01Z · git head `e371b6c3` · baseline: Task 112 (commit 936654b6 / fix e371b6c3) · status: completed
Data frontier: `2026-11-03` · total sessions: 2488

> Be evidence-driven. Never turn missing evidence into a positive result. Cohorts are never added across denominators. Mock records never feed any metric. LLM performance is never borrowed from the general forward cohort.

## Part A — Forward cohort reconciliation (57 / 43 / 59 explained)

**Conclusion:** No software bug and no missing records. The three figures refer to different cohorts/denominators and reconcile exactly within each. Adding them across cohorts would be double-counting and is forbidden.

| Figure | What it counts | Level |
| --- | --- | --- |
| 57 observations | DECISION-level: unique forward decisions across 3 general-cohort generations (gen1=12 + gen2=22 + gen3=23). One per (sym | decision |
| 43 matured | STRATEGY-OUTCOME level: 43 strategy outcomes reached a terminal exit (SL or TP3) within the scan window. Counted over (f | strategy-outcome |
| 59 pending | STRATEGY-OUTCOME level: 59 strategy outcomes are still open (pending_mtm = marked-to-market, NEVER counted as a win). Co | strategy-outcome |

**Why they don't share one denominator:** They use three different denominators. 57 counts DECISIONS (symbol x date). 43 and 59 count STRATEGY OUTCOMES (decision x strategy). The 34 filled decisions x 3 strategies = 102 strategy outcomes = 43 matured-terminal + 59 pending-mtm. The remaining 23 decisions (gen3) have no entry bar yet (awaiting_entry_bar) so contribute 0 strategy outcomes. 102 + 23 unfilled-decisions does NOT equal 57 because the denominators differ (decisions vs strategy-outcomes).

**Critical clarifications:**
- 43 'matured' are TERMINAL EARLY EXITS (SL/TP3), NOT 5/10/21-session horizon maturities. Zero horizon outcomes have matured for any cohort (earliest 21-session ~2026-12-01).
- 59 'pending' are open positions marked-to-market; MTM is NEVER counted as a win and does not appear in win-rate/expectancy.
- The LLM cohort (task111-llm-multisource-gen1) is a SEPARATE cohort with 0 matured outcomes — it is never added to the 57/43/59.
- The DB prospective layer (375 predictions, 114 paper trades) is yet another SEPARATE layer with 0 matured outcomes — never added to any forward total.

### Cohort-by-cohort reconciliation

| Cohort | Obs | Symbols | Mat 5 | Pend 5 | Mat 10 | Pend 10 | Mat 21 | Pend 21 | Term-exits | Pend-MTM | Unfilled | Reconciles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| task105-gen1 | 12 | 12 | 0 | 12 | 0 | 12 | 0 | 12 | 21 | 15 | 0 | True |
| task106-gen2 | 22 | 22 | 0 | 22 | 0 | 22 | 0 | 22 | 22 | 44 | 0 | True |
| task107-gen3 | 23 | 23 | 0 | 23 | 0 | 23 | 0 | 23 | 0 | 0 | 23 | True |
| task111-llm-multisource-gen1 | 23 | 23 | 0 | 23 | 0 | 23 | 0 | 23 | 0 | 0 | 23 | True |
| task76-77-prospective-db-layer | 375 | 25 | 0 | 375 | 0 | 375 | 0 | 375 | 0 | 0 | 114 | True |

> `matured_terminal_exits_early` and `pending_mtm_open` are **strategy-outcome level** (decision × strategy), matching the 43/59 in the `task107/_matured.json` summary block. `unfilled_awaiting_entry_bar` is **decision level** (gen3 has no entry bar yet). These are different denominators and must never be added.

## Part B — Real vs mock LLM record separation

Every record in the append-only signal-history store now carries an explicit `recordType`:

- **`REAL_LLM_DECISION`** — 48 records (24 current + 24 generation-cache). The ONLY records eligible for any performance / forward-outcome / win-rate / calibration / promotion metric.
- **`MOCK_PIPELINE_CHECK`** — 23 records (pipeline-check only, `provider=mock`). Retained for provenance/audit; visible in the UI **only** when the `includeMock` opt-in filter is selected.

Mock isolation is enforced in `applyFilter()` via `recordType` (not the legacy `mockRecord` boolean), so it cannot be bypassed. The default `/api/llm-signals` response returns 48 REAL records; `includeMock=1` returns 71; `recordType=MOCK_PIPELINE_CHECK` returns exactly 23.

**Task 111 count reconciliation (preserved from Task 112, unchanged):** 24 current records = 23 universe symbols + 1 out-of-universe stale ENGRO record (honestly refused with `stale_evidence`). The real generation ran twice (initial + restore after the mock pipeline check overwrote signal files); the restore pass is authoritative. No records were deleted to make totals match.

## Part C — LLM forward validation (5/10/21-session outcomes)

Cohort: `task111-llm-multisource-gen1` · provider/model: zai / glm-4.6 (frozen) · prompt: task111-prompt-v1 (frozen) · evidence schema: latent_psx_llm_evidence_v1 (frozen) · deterministic risk policy: atr14-1.5-1-2-3 / task77-v1 (frozen)

Data cutoff (point-in-time evidence as-of): `2026-11-03` · data frontier: `2026-11-03` · forward sessions elapsed: **0**

| Horizon | Matured | Pending |
| --- | --- | --- |
| 5-session | 0 | 48 |
| 10-session | 0 | 48 |
| 21-session | 0 | 48 |

- **Total real decisions:** 48 · **current real decisions:** 24 · **BUY (current):** 2
- **Directional accuracy:** Not available — 0 matured LLM outcomes
- **Net returns (BUY):** Not available — 0 matured BUY outcomes
- **Avg / median outcome:** Not available — 0 matured outcomes
- **Drawdown / profit factor:** Not available — no valid trade series
- **Baseline comparison:** Not available — 0 matured outcomes
- **Calibration:** Not available — insufficient matured LLM outcomes (minimum 100 matured LLM-cohort outcomes required; current 0; LLM conviction uncalibrated (remains uncalibrated until >=100 genuine matured LLM-cohort outcomes)).

> Never report an LLM win rate when no valid outcomes are mature. Never use general forward-cohort performance as the LLM's performance.

**BUY/HOLD/NO_TRADE evaluation:** BUY outcomes use hypothetical long-only with V2 costs and existing execution rules. HOLD/NO_TRADE avoided-opportunity is evaluated separately against a defined benchmark; avoided losses are not auto-classified as wins. Signal-quality is separated from executable trading-strategy performance. All pending until forward sessions elapse.

Nothing was regenerated, retrained, or re-thresholded. The frozen GLM-4.6 / prompt / evidence-schema / risk-policy / cohort identity and all historical BUY/HOLD/NO_TRADE decisions are preserved. The pipeline continues to collect genuinely new forward observations per its event-triggered refresh policy; no unnecessary LLM API calls or duplicate workers were introduced.

## Part D — Model inventory audit (83 entries, 12 categories)

**83 inventory entries** — NOT 83 trained/operational models. Counts come from actual audit records (task82 registry + task79/98/99/100/101/104/111/112 artifacts + DB).

| Category | Count |
| --- | --- |
| rule_strategy | 20 |
| data_blocked | 18 |
| resource_blocked | 11 |
| trained_psx | 9 |
| historical_experiment | 7 |
| dependency_blocked | 5 |
| trained_artifact | 5 |
| duplicate_alias | 3 |
| forward_shadow | 3 |
| evaluated | 2 |

**Dashboard:**
- Total registry entries: 83
- Implemented models: 0
- Trained on PSX data: 9
- Successfully evaluated: 11
- Forward shadow models: 3
- Rule-based strategies (NOT ML): 20
- Blocked / unavailable: 34
- Duplicate / alias entries: 3
- Historical experiments: 7

Key honest findings: only 5 models have live prospective prediction rows in the DB (CatBoost, LightGBM, Random Forest, Ridge Regression, XGBoost — all `v1_prospective`); `ModelBacktestCache` is empty; the production walk-forward harness measures 8 entries (1 rule + 7 ML); the 83 deliberately counts cross-task evaluations as separate entries rather than deduplicating by name. The full per-entry classification (registry name, family, source path, artifact path, training/evaluation evidence, dataset, metrics, backtest/forward availability, status, blocking reason) is in `data/backtest_reports/task113/task113_model_inventory_classification.csv`.

## Part F — Forward pipeline health

- Worker heartbeat: 2026-11-03T19:48:20Z · PID: 5534 · started: 2026-11-03T19:18:20Z
- Poll interval: 120s · cycles completed: 0
- Scheduler: task108_worker.py (120s interval, 09:45-15:45 PKT window)
- Duplicate-worker lock: /home/z/my-project/data/backtest_reports/task107/ops/task108_worker.lock
- Idempotency: task107 suite asserts repeat_cycle_no_new_snapshots (29/29 green)
- Error visibility: ops/run_log.jsonl (13 lines) + ops/event_ledger.json
- Provider availability: psxdata daily bars; delayed snapshots; provider timestamps NOT exchange-stamped
- Last successful data retrieval: 2026-11-04T11:46:28+0000
- Daily OHLC frontier: `2026-11-03` · session count: 2488
- Snapshot timestamp quality: estimated_source_timestamp (provider supplies no source ts)
- Delayed-quote limitations: delayed snapshots labeled delayed_observation_shadow; NEVER claimed as exchange-timestamped real-time; NO intraday OHLC fabricated
- Signal generation status: general cohort frozen (57 decisions); LLM cohort frozen (23 current real decisions)
- Outcome maturity status: 0 horizon-matured outcomes across ALL cohorts; 43 terminal-early-exits only; LLM 0 matured; DB layer 0 matured
- Defects found: none requiring code change; existing safeguards (lock, idempotency, no-fabrication) preserved

No intraday OHLC is fabricated. Delayed snapshots are labeled `delayed_observation_shadow` and never claimed as exchange-timestamped real-time. Where new market data is unavailable, the pending state is preserved with the exact reason.

## Part G — Promotion and research safeguards

All safeguards preserved (every flag below is `true`):

- `no_new_training`: True
- `no_threshold_tuning_against_frozen_results`: True
- `no_past_signal_modification`: True
- `no_past_outcome_rewrite`: True
- `llm_conviction_remains_uncalibrated`: True
- `no_historical_backtest_mixed_with_prospective`: True
- `no_pending_mixed_with_realized`: True
- `no_live_broker_orders`: True
- `no_automatic_execution`: True
- `no_automatic_promotion`: True
- `no_unsupported_short_selling`: True
- `shadow_research_only`: True

**Promotion requires:** minimum matured outcome requirements; chronological evaluation; no leakage (purge/embargo); transaction costs (V2); baseline comparison; risk and concentration stability; adequate coverage across evaluation periods; evidence-quality checks.

> No model promoted merely for a large registry count, a successful build, or an attractive historical result. Everything remains research/shadow-only unless existing independent promotion gates are genuinely met — and none are met on current evidence.

## Deliverables

| Artifact | Path |
| --- | --- |
| Machine-readable audit (Parts A/C/D/F/G) | `data/backtest_reports/task113/task113_forward_validation_audit.json` |
| Cohort reconciliation CSV | `data/backtest_reports/task113/task113_cohort_reconciliation.csv` |
| Model inventory classification CSV (83 entries) | `data/backtest_reports/task113/task113_model_inventory_classification.csv` |
| Forward pipeline health JSON | `data/backtest_reports/task113/task113_forward_pipeline_health.json` |
| Updated versioned model performance report (JSON) | `data/reports/model_strategy_performance_latest.json` (+ versioned `_*<timestamp>.json`) |
| Updated report (Markdown) | `docs/reports/psx_model_strategy_performance_report.md` |
| Updated report (PDF) | `data/reports/psx_model_strategy_performance_report.pdf` |
| Model comparison CSV | `data/reports/model_strategy_comparison_latest.csv` |
| This audit document | `docs/reports/task113_forward_validation_audit.md` |

## Tests

- `scripts/task113_tests.py` — 10 categories, 65 assertions, **65 pass / 0 fail**.
- `scripts/task107_v2_tests.py` — **29 pass / 0 fail** (no regression).
- `scripts/task112_tests.py` — **66 pass / 0 fail** (no regression).
- TypeScript `tsc --noEmit` — **clean**.
- `bun run build` — **passes**.
- API: `/api/model-report` serves `task113_audit` (83 inventory, 5 cohorts, LLM 0/0/0 matured, calibration forbidden); `/api/llm-signals` returns 48 REAL by default, 71 with `includeMock=1`, 23 with `recordType=MOCK_PIPELINE_CHECK`; export CSV includes `recordType`.

Earlier audit evidence (Tasks 97–112) is preserved — nothing was replaced.