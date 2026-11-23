# GLM-4.6 Multi-Source Analyst — Deep Analysis (Task 124 Audit)

> **Recovery note (Task 123):** this report was lost with the audit workspace and rebuilt verbatim.
> One finding is corrected by Task 123 and marked inline: §5's "available=0" measured the STORE
> records (`evidenceRef=null`); the runner-side evidence packages did contain real multi-source
> data (`task111_evidence_coverage.csv`). See `reports/operations/task123_glm_evidence_report.md`.

**Scope:** complete pipeline inspection of the GLM-4.6 analyst, using the append-only store
`data/backtest_reports/task112/llm_signal_history/` (71 records), the Task 112 audit artifacts,
`src/lib/latent/llm/*` (prompt/schema/provider), and `scripts/task111_llm_runner.ts`.
**Extraction:** see `audit_data_manifest.json` (git HEAD at extraction, UTC/PKT timestamps).
**Companion per-record table:** `glm_records_table.csv`.

---

## 1. Pipeline trace (what actually runs)

| Stage | Implementation | Evidence |
|---|---|---|
| Evidence assembly | `latent_psx_llm_evidence_v1` schema; views for technical, financial fundamental, price pattern, company/national/international news | `src/lib/latent/llm/evidence-builder.ts` |
| Prompt | `task111-prompt-v1` — fixed JSON-output contract: BUY/HOLD/SELL_TO_CLOSE/BEARISH_RESEARCH_ONLY/NO_TRADE, `signal_status` forced to `research_only`, bullish/bearish/conflicting/missing evidence lists, conviction 0–100, calibrated probability, entry/SL/TP1-3, invalidation conditions | `schemas.ts` (all 71 records carry this prompt version) |
| Provider | `zai` / `glm-4.6`, one call per symbol per cutoff | every record (`provider`, `model` fields) |
| Risk overlay | `atr14-1.5-1-2-3` (task77-v1): SL = entry − 1.5×ATR14, TP1/2/3 = +1/2/3×ATR14; execution assumption `next_session_open_reference`; costs `psx_user_schedule_v2` | `riskReward` block of each BUY/HOLD record |
| Storage | append-only JSON store + `history_index.json`; policy "no records deleted" | `task112_llm_decision_reconciliation.json` |
| Outcome tracking | Task 114 maturity engine: outcomes mature only after the required number of ACTUAL market sessions per symbol from the entry bar | `task112_llm_pending_outcomes.json` |
| Generation trigger | **manual one-shot runner `scripts/task111_llm_runner.ts`** — no cron route, no scheduler entry exists for GLM | repo grep (`src/app/api/cron/*` has no LLM route) |

## 2. Record inventory and the exact duplicate accounting

- **71 files = 48 `REAL_LLM_DECISION` + 23 `MOCK_PIPELINE_CHECK`.**
- The 23 mock records are pipeline QA probes (`mockRecord: true`), all `NO_TRADE`; they are excluded from every performance statistic (attribution rule: `REAL_LLM_DECISION AND provider=zai AND model=glm-4.6`).
- Real records collapse to **24 unique (symbol, dataCutoff) combos**: 22 combos have exactly 2 records, 1 combo has 3 (HUBC), 1 combo has 1 (ENGRO). Hence **"23 duplicate-generation pairs"** (23 combos with >1 record, 24 extra records in total). Provenance split: 24 `current_record` + 24 `generation_cache` — the store-creation step ingested both the signals directory and the idempotency cache. Duplicate handling now enforced in the runner (Task 123: one decision per symbol per session cutoff).
- All generation happened in a **single 19-minute window: 2026-11-04T13:52:34Z → 14:11:40Z**. Two data cutoffs appear: `2026-11-03` (live cohort) and `2025-01-03` (historical replay check embedded in the pairs).

## 3. Decision distribution (unique combos)

| Decision | Records | Unique decisions |
|---|---|---|
| BUY | 3 (PRL ×1, SYS ×2) | **2** (PRL, SYS) |
| HOLD | 5 (ANL, BOP ×2, LUCK, OGDC) | 4 |
| NO_TRADE | 40 | 18 |

- **Why so few BUYs (2 unique):** the analyst is conservative by contract, and company news was largely unavailable at generation time; 18/24 combos ended in NO_TRADE. This is extreme conservatism, not selectivity.
- **Validation:** 46 real records `valid`; 2 rejected — ENGRO `stale_evidence`, PSO `invalid_view:financial_pattern_view`. (The remaining 25 "rejected" statuses are the 23 mock pipeline checks + the 2 real rejections; mock records are never counted.)
- **Conviction:** 20–65, mean 39.1 (n=46). `calibratedNetPositiveProbability` is `null` in every record — the calibration channel was never populated.
- **Evidence-quality score:** 70–85, mean 83.3 — a **deterministic runner-side score** (not set by the LLM); its source-category composition is documented in `task111_evidence_coverage.csv`.
- **BUY risk plans:** PRL entry 84.34 / SL 74.74 / TP 90.74–97.14–103.53; SYS entry 109.47 / SL 104.89 / TP 112.53–115.58–118.63 (ATR14 policy, next-session-open reference).

## 4. Why nothing has matured, and why generation stopped

- `task112_llm_pending_outcomes.json` (generated 2026-11-05T20:21Z): status `awaiting_future_observations`, 48 decisions, 24 unique symbols, **matured 0, pending 23** (5/10/21-session horizons).
- Maturity requires **actual market sessions after the entry bar**. The system's data frontier stopped at **2026-11-03** (OhlcvBar MAX(date); worker heartbeat last seen 2026-11-03T19:17Z). With no forward bars ingested since, the Task 114 tracker had nothing to mature on. This is an **infrastructure stall, not a tracker bug** — the tracker's unit logic is covered by the Task 112/114 QA suites (66/66 green at audit time).
- **Scheduled generation was NOT operating.** The only generation path was the manual `task111_llm_runner.ts`; there was no cron/scheduler hook for GLM. The 2026-11-04 batch was a one-time run. *(Task 123 added scheduled generation to the daily pipeline.)*

## 5. Evidence availability — the decisive finding *(corrected by Task 123)*

`task112_llm_evidence_contribution_audit.json` + per-record CSV (48 real records) measured **store-side** traceability: every category `available=0, cited=0`, `evidenceRef=null` in all records — the audit's honest conclusion "no valid ablation possible from the store" stands for the Nov-4 cohort as stored.

**Task 123 correction:** the runner-side evidence packages DID contain real multi-source data at generation time — `task111_evidence_coverage.csv` shows `technical / price_patterns / volatility: verified` for all 24 symbols, `fundamental / financial_patterns / national / international / company_news: partially_verified` (company news `unavailable` for ANL), and `task111_news_coverage.json` records 24 company-news rows + 8 national + 8 international items with sentiment splits. The pipeline therefore *built and sent* real evidence; what failed was **persisting the per-source evidence reference into the store record** (`evidenceRef=null`), which broke downstream traceability and made the store-side audit read as zero. Both findings are true and now reconciled; the persistence gap is fixed (Task 123), and the honesty rule still applies: **no accuracy-improvement claim is made for any evidence category without a valid controlled comparison, and no historical news archive with verified publication times exists for point-in-time ablation** (`task111_news_coverage.json` note).

**Consequences (unchanged by the correction):**
1. **No valid historical ablation can be performed** for the Nov-4 cohort (no point-in-time news archive; per-store citations absent). Any claim that "fundamentals improve accuracy" or "news adds value" would be fabricated — none is made.
2. The **combined analyst cannot be shown to add value over individual sources** — there is no outcome sample (0 matured) and no controlled source contrast. Verdict: **UNRANKED**.
3. Requested ablation dimensions: technical-only / fundamentals-only / patterns-only / news — **not measurable** for the stored cohort; combined decision distribution measured (§3); evidence-quality distribution = runner-side deterministic scores 70–85; combined-vs-sources — **no measurable value demonstrated**.

## 6. Is GLM blocked from paper trading? — Yes, by design, at three layers

1. **Schema layer:** `signal_status` must be `"research_only"` — the validator rejects anything else (`signal_status_must_be_research_only`); the prompt repeats "your signal is NEVER an order".
2. **Cohort layer:** `paperMonitor.ts` and `prospective-lifecycle.ts` contain no LLM/GLM references; the DB attribution probe finds **0 GLM-attributed rows** in any model-attributed table (paper trades are all classical-ML).
3. **Status layer:** all 71 records carry `researchStatus: "research_only"`; reports at `reports/glm/` (commit f1a0f8fe) export the cohort read-only.

So the 48 real records exist as research artifacts; none can reach the paper ledger by construction.

## 7. What the GLM cohort proves and does not prove

**Proven (pipeline correctness):** deterministic JSON contract, append-only store, duplicate reconciliation, risk-overlay math on BUY records, mock/real separation, 66/66 Task 112 QA checks at audit time; evidence packages with real multi-source content (Task 123 correction).

**Not proven (decision value):** any predictive or trading edge. With 2 unique BUY decisions, 0 matured outcomes, untraceable store-side evidence (now fixed for future cohorts), and no re-generation since 2026-11-04, GLM-4.6 is **UNRANKED**. The honest next step is operational: scheduled generation with persisted evidence packages (Task 123 wiring), then let the Task 114 tracker mature a real forward cohort before any comparison with classical models.

---
*Traceability: every number above is recomputable from `glm_records_table.csv`, the Task 112/111 artifacts (SHA-256 in `audit_data_manifest.json`), and `scripts/audit_glm_paper.py`. No model or strategy logic was modified during this audit.*
