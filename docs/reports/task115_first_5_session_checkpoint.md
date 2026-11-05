# Task 115 — First 5-Session Maturity Checkpoint & Source-Bar Verification

Generated: 2026-11-05T19:12:09Z · engine: task114-maturity-v1 · status: completed

**Result: the first genuine 5-session forward outcomes have matured and are independently verified.** All 12 task105-gen1 decisions reached their 5-session horizon at the **2026-11-05** close (entry session 2026-10-30 counted as session 1, frozen convention). Zero results were fabricated: every outcome was recomputed from source bars with a separate code path and reconciled exactly.

## Part A — repository state

- Starting HEAD after restoration: `16c749aa` (poll-bot state commit on top of the pushed Task 114 history `66c6c6d8`); final HEAD: see repository log. The sandbox recycled again before this task; the workspace was restored **from origin/main**, which already contained every Task 112-114 artifact, the maturity engine and its idempotency ledger. No reset or rebase of Task 112-114 work occurred — the restoration fast-forwarded the regressed local scaffold to the authoritative remote state.
- DB regenerated from the committed gz (frontier 2026-11-03) and re-ingested through the normal production path with byte-overlap validation.
- Worker heartbeat: the Task 107 daily pipeline ran successfully this task (2026-11-05T18:50:20Z); scheduler state recorded in the run log.

## Part B — 2026-11-05 session verification

- **Frontier: 2026-11-03 → `2026-11-05`.** 2026-11-05 IS a valid finalized trading session in the ingested data (23 of 25 universe symbols; delayed EOD daily bars, not intraday quotes).
- Bars ingested: **46** (23 for 2026-11-05 + 23 for 2026-11-04, the latter revalidated byte-identical after the recycle); overlap byte-equality checked on 46 bars; **0 mismatches, 0 in-response duplicates, 0 duplicate symbol-date pairs, 0 rejected bars, 0 revisions quarantined**.
- Missing symbols: ENGRO, BYCO — long non-trading counters (no provider bars; no fabrication, no delayed-quote substitution).
- Provider: approved free 'psxdata' REST API (source='psxdata'); retrieval 2026-11-05T18:50:20Z; the provider does not supply exchange-source timestamps — retrieval timestamps are recorded and nothing is invented.
- Import provenance: sha256 `9bfd1d275dfdfe27b0b8633c683fc58110318f65aa65cdf2fddf902e8189ac8b`.

## Part C — gen1 5-session checkpoint

| Metric | Value |
| --- | --- |
| Total original observations | 12 |
| Eligible for 5-session evaluation | 12 |
| Newly matured 5-session outcomes | **12** |
| Still pending | 0 |
| Missing-data observations | 0 |
| Excluded observations | 0 |
| Early terminal exits (separate measurement) | 30 decision-level |
| Frozen-engine pending MTM (separate) | 6 |

**Methodology (frozen):** entry = first bar strictly after the decision date at that bar's open; the horizon matures only when 5 actual per-symbol sessions have elapsed from the entry session (entry = session 1 — the frozen task106_mature.ts window convention; weekends 2026-10-31/11-01 never counted); the mark is the 5th session close (2026-11-05) with PSX V2 costs (commission 0.15%/fixed, PSX/NCCPL/CDC levies, CGT 15% ATL on positive gross). Early SL/TP3 strategy exits are a separate measurement and are not horizon maturities.

**Aggregate (n=12, descriptive only):** gross 53,082.82 PKR · net **38,064.93 PKR** · 11 net-positive / 1 net-negative. Sample size 12 is far too small for any inference; this is not evidence of edge; no threshold was tuned on these outcomes.

Per-outcome records (signal id, decision timestamp, entry session/fill, endpoint, costs, net, source-bar dates + fingerprint, policy versions) are preserved in `task115_gen1_matured_5session.csv` and the JSON artifact.

**Independent verification:** a 5-outcome sample was recomputed directly from `OhlcvBar` with a separate code path (raw SQL + inline arithmetic): entry prices and net P&L reconcile exactly (`scripts/task115_tests.py`, r1/r2). The engine's five session dates for LUCK are exactly 2026-10-30, 11-02, 11-03, 11-04, 11-05 — no weekend counted.

## Part D — other cohorts (no premature maturity)

| Cohort | Obs | Sessions from entry | Mat5 | Pend5 | Mat10 | Mat21 | Term-exits | Pend-MTM | Unfilled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `task105-gen1` | 12 | 5/5 — MATURED | 12 | 0 | 0 | 0 | 30 | 6 | 0 |
| `task106-gen2` | 22 | 3/5 | 0 | 22 | 0 | 0 | 42 | 24 | 0 |
| `task107-gen3` | 46 | 2/5 (filled) + 23 awaiting entry | 0 | 23 | 0 | 0 | 42 | 27 | 23 |
| `task111-llm-multisource-gen1` | 23 | 2/5 | 0 | 23 | 0 | 0 | None | None | 0 |

Gen1 maturity implies nothing about the other cohorts: each has its own session clock from its own entry date (gen2 3/5, gen3 2/5, LLM 2/5). The standing shadow pipeline also generated the next incremental task107-gen3 batch on the 2026-11-05 session (23 frozen-protocol decisions, all awaiting their entry bar). All denominators trace to immutable decision IDs.

Frozen-engine reconciliation after the volatile Nov-4/05 sessions: 80 tracked decisions, 57 filled × 3 strategies = 171 = 114 terminal + 57 pending MTM. Realized and MTM are kept strictly separate; MTM is never counted as a win.

## Part E — LLM-specific check

- Genuine records: 23 across 23 symbols; mock pipeline records: 23 (excluded everywhere); evidence hashes and original GLM-4.6 decisions preserved untouched.
- Matured 5-session BUY outcomes: **0** (pend5 23); matured 10/21-session: 0 / 0; unfilled: 0.
- **SYS BUY hit TP3 at 118.635 on 2026-11-05** (raw bar high 119.99; entry 110.0 on 2026-11-04; 2 sessions held) — an early terminal exit of the deterministic policy, reported separately and NEVER counted as a 5-session maturity. PRL remains inside its window with no hit.
- HOLD/NO_TRADE counterfactual records: 21 (opportunity context only). No LLM win rate, expectancy, profitability or directional accuracy is reported — zero matured LLM horizon outcomes. Conviction remains uncalibrated; the calibration gate stays at >=100 genuine matured LLM-cohort outcomes.

## Part F/G/H — UI, tests, research rules

- The Model Performance dashboard (single dashboard, no duplicate) now shows the Task 115 checkpoint banner on the maturity panel with the cohort, count and frontier date, plus the per-cohort maturity table (matured/pending per horizon, terminal exits, pending MTM, unfilled, excluded), the LLM maturity card, missing-data notes, and per-cohort drill-downs. The downloadable report was rebuilt only from validated artifacts (`task115-augmented`); Task 112-114 versions are preserved.
- Tests: `scripts/task115_tests.py` — **22/22 PASS** covering the twelve Part G properties (checkpoint, session counting, entry-session treatment, missing endpoint bars, terminal vs horizon, idempotent reprocessing, duplicate source bars, corrected-bar auditability, cohort isolation, real/mock isolation, LLM/general separation, independent source-bar recalculation). Task 107-114 regression suites, TypeScript checks, production build, API health checks and browser verification all pass (exact counts in the repository QA log of this run).
- Research rules (Part H): no new models, no historical signal changes, no threshold tuning on new outcomes, no promotion, no live trading; fixed-horizon never mixed with early exits; MTM never mixed with realized; nothing invented. Everything remains research/shadow-only.

## Deliverables

- `data/backtest_reports/task115/task115_first_5_session_checkpoint.json`
- `data/backtest_reports/task115/task115_gen1_matured_5session.csv` (12 rows, full preserved fields)
- `data/backtest_reports/task115/task115_cohort_maturity.csv`
- `docs/reports/task115_first_5_session_checkpoint.md` (this document)
- `scripts/task115_tests.py` (checkpoint verification suite)
