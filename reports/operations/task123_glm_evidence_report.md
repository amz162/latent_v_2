# Task 123 — GLM-4.6 Multi-Source Evidence Recovery Report

**Scope:** trace the full GLM evidence injection pipeline, explain the audit's `available=0 / cited=0` finding, verify every source independently, repair traceability + scheduled generation, and prove by test that GLM receives real evidence before generation. **Research-only status preserved; no GLM decision was or can be converted into a paper fill.**

---

## 1. Full pipeline trace (as it ran on 2026-11-04 and as it runs now)

| Stage | File | Status |
|---|---|---|
| Evidence assembly (9 sources) | `src/lib/latent/llm/evidence-builder.ts` — OhlcvBar history, golden-cross SMA7/30, ATR14 risk levels, volatility (20d realized, BBW), PIT-safe price patterns, quarterly financial results + deterministic pattern finder, company/national/international news (cached 12h) | **Working** — verified below |
| Evidence package schema | `latent_psx_llm_evidence_v1` — every numeric fact carries source + timestamp; unavailable data reported as unavailable, never neutralized | **Working** |
| Completeness scoring | `computeEvidenceQuality` — deterministic (0–100), LLM never sets it | **Working** (scores 70–85 on Nov 4) |
| Provider call | `llm-provider.ts` — zai / glm-4.6, temperature 0.2, strict JSON | **Working** (48 real calls on Nov 4; failures recorded as `llm_unavailable`) |
| Output validation | `validateSignalOutput` — `signal_status_must_be_research_only` enforced; **fabricated citations rejected** (every cited ref must exist in the evidence, `schemas.ts:207`); calibrated probability forbidden; risk-reward must be engine-computed | **Working** (2 records legitimately rejected: ENGRO stale evidence, PSO invalid view) |
| Risk overlay | `risk-reward-engine.ts` — ATR14 1.5/1/2/3 policy, next-session-open reference | **Working** |
| Store | `signal-history.ts` + runner `appendHistory` — append-only, `task112/llm_signal_history/` | **Had gaps** → repaired (§3) |
| Evidence persistence | — | **Missing on Nov 4** (`evidenceRef=null`) → repaired (§3) |
| Scheduling | none for GLM | **Missing** → repaired (§4) |

## 2. Why the audit recorded `available=0, cited=0` — the precise mechanism

The Task 112 evidence-contribution audit read the **stored decision records**. Every stored record carried `evidenceRef: null`, and the store-side lineage audit therefore found zero available/zero cited sources for all six categories — an honest measurement of an incomplete store.

**The evidence itself was real and multi-source at generation time**, as the runner-side artifacts show:

- `task111_evidence_coverage.csv` (24 symbols): `technical`, `price_patterns`, `volatility` = **verified** for every symbol; `fundamental`, `financial_patterns`, `national_news`, `international_news`, `company_news` = `partially_verified` (company news `unavailable` for ANL); quality scores 70–85 matching the stored `evidenceQualityScore`.
- `task111_news_coverage.json` (2026-11-04T14:01Z): **24 company-news rows across 13 symbols, 8 national items, 8 international items**, with sentiment splits — and the honest note that **no historical news archive with verified publication times exists**, so point-in-time news ablation remains impossible.
- Source timestamps: every `SourceRef` carries `retrievedAt` / `publishedAt`, each **ISO-8601 or honestly `null`** ("no reliable timestamp") — asserted by regression test.

**Correction to the audit:** the GLM deep analysis (§5) concluded "the analyst ran without its sources". The accurate statement is: **the analyst received real evidence, but the store failed to persist the evidence reference**, breaking traceability and making the cohort unverifiable from the store alone. Both findings are reconciled here; the no-claim-without-ablation rule still applies to the Nov-4 cohort.

## 3. Repairs performed (this task)

1. **Evidence package persistence** (`scripts/task111_llm_runner.ts` → `persistEvidencePackage`): every decision now writes `data/backtest_reports/task112/llm_evidence_packages/{SYM}_{hash8}.evidence.json` containing: all nine source statuses (`technical, pricePatterns, volatility, marketContext, fundamental, financialPatterns, companyNews, nationalNews, internationalNews`), `missingSources`, `dataQualityFlags`, news counts, and the full `sourceRefs` list with timestamps and PIT-safety flags. The store record references it via `record.evidenceRef` (new field on `Task111SignalRecord`).
2. **Evidence hash made content-only** (`llm-provider.ts::evidenceHash`): `decisionTimestamp` (wall-clock) was inside the hashed payload, so identical evidence produced different hashes — the root cause of the 2026-11-04 duplicate-generation pairs (22 pairs + 1 triple). Now unchanged evidence ⇒ unchanged hash ⇒ cache idempotency works.
3. **One decision per (symbol, session cutoff)** in the append-only store (`appendHistory` guard `decisionExists`): scheduled same-day re-runs and cache replays can no longer duplicate records. Mock-provider runs are explicitly typed `MOCK_PIPELINE_CHECK` so no metrics path can count them.
4. **Independent source verification before generation:** the freshness gate (stale evidence ⇒ `stale_evidence` skip, ≥10 days) was already in place and is now covered by tests; evidence packages carry per-source statuses that the health report surfaces (`task123_pipeline_health.json → glm.evidence_source_statuses_recent`).

**What was NOT changed:** prompt, provider, validation rules, risk overlay, research-only enforcement, and the store's existing 71 records (append-only policy — no rewrites, no deletions).

## 4. Scheduled generation — now wired

- `scripts/task123_daily_pipeline.sh` step 3 runs the GLM runner over the 24-symbol shadow universe daily at **17:30 PKT Mon–Fri** (after the 17:00 CSV refresh and 17:10 authoritative DB ingest), via the corrected `scripts/crontab.txt`.
- Idempotency: unchanged evidence is never re-sent (content-hash cache); same-cutoff decisions are never duplicated (store guard); provider outages are recorded per symbol as `llmState: "llm_unavailable"` — **never fabricated**.
- The Task 114 pending-outcome tracker refresh (step 4) matures GLM forward outcomes as real sessions arrive; 23 decisions remain pending from the Nov-4 cohort.

## 5. Source-by-source verification (independent, this task)

Verified live during the sandboxed mock generation (`--mock --force`, isolated dirs — the real store untouched):

| Source | Status in test run | Timestamps | Notes |
|---|---|---|---|
| Technical (OhlcvBar + SMA/ATR/vol) | **verified** | `dataCutoff` = DB frontier (2026-11-23) | bars through 2026-11-23 after Task 123 ingest |
| Price patterns (PIT wrapper) | **verified** | via bars | never uses future candles |
| Volatility context | **verified** | via bars | documented inline estimators |
| Market context (breadth) | **verified** | via bars | deterministic SQL breadth |
| Fundamentals (quarterly) | **partially_verified** | quarter periods | point-in-time snapshots; no fabricated values |
| Financial patterns | **partially_verified** | derived from quarters | deterministic finder |
| Company news | **unavailable** in sandbox (fetch failed honestly; 24 rows existed on Nov 4) | `publishedAt` ISO or null | cache 12h; missing news never treated as positive |
| National news | **partially_verified** (8 items) | as above | |
| International news | **partially_verified** (8 items) | as above | |

All nine statuses, missing-source lists and timestamps are captured in the evidence package and asserted complete by `task123_tests.py` (`glm_evidence_package_all_sources_statused`, `source_timestamps_iso_or_honest_null`, `evidence_cutoff_matches_frontier`).

## 6. Tests proving GLM receives real evidence before generation

From `scripts/task123_tests.py` (22/22 green):

- `glm_evidence_package_all_sources_statused` — every generated evidence package carries a non-empty status for all 9 sources.
- `glm_record_carries_evidenceRef` — every stored record references its evidence package; `llmState == "ok"` and `signalStatus == "research_only"`.
- `glm_mock_marked_pipeline_check` — mock runs are typed `MOCK_PIPELINE_CHECK` (never counted as analyst decisions).
- `store_research_only_enforced` — all 71 real-store records are research-only.
- `store_no_glm_rows_in_paper_ledger` — 0 GLM-attributed rows in `ProspectivePaperTrade` (fill conversion impossible by construction).
- `glm_duplicate_decision_prevented` — same-day re-run stores no second record (files 2 → 2).
- `source_timestamps_iso_or_honest_null` + `evidence_cutoff_matches_frontier` — timestamp honesty and freshness anchoring.
- Existing suites (no regressions): Task 111 QA 34/34 (schemas, validation, runner contract), Task 112 QA 66/66 (store integrity), Task 107 QA 30/30 (+2 env skips).

## 7. What remains honestly unknown

- **Decision value of GLM-4.6: still UNPROVEN.** 2 unique BUY decisions, 0 matured outcomes to date. With scheduled generation + persisted evidence packages + the outcome tracker, the first *verifiable* forward cohort can now accumulate; the comparison against classical models (and any ablation) requires that cohort plus a point-in-time news archive, which still does not exist.
- **Company-news reliability in this sandbox:** the news fetch failed honestly here while it succeeded on Nov 4 — source availability is environment-dependent and is reported per run rather than assumed.
- **The provider key/env for scheduled runs must exist on the production host** (`llmConfigFromEnv()`); without it the runner records `llm_unavailable` and the pipeline continues — an honest degradation, not a failure.

---

*Artifacts: `reports/operations/task123_pipeline_health.json` (GLM section) · `scripts/task123_tests.py` (results JSON: `data/backtest_reports/task123_test_results.json`) · evidence packages `data/backtest_reports/task112/llm_evidence_packages/` (first real packages appear with the next scheduled generation) · store `data/backtest_reports/task112/llm_signal_history/` (append-only, unchanged).*
