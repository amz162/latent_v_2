# Task 126 — GLM Evidence, Scheduled Generation & Research-Only Validation

**Date:** 2026-11-23 · **Scope:** the append-only GLM-4.6 decision store (`data/backtest_reports/task112/llm_signal_history/`, 71 records), the 24 per-decision evidence packages (`data/backtest_reports/task111/signals/*.evidence.json`, git-tracked), the generator code (`scripts/task111_llm_runner.ts`, `src/lib/latent/llm/llm-provider.ts`), and the pipeline wiring. Audit method: independent recomputation (`scripts/task126_audit.py`) that replicates the exact `evidenceHash` algorithm (FNV-1a over stable-sorted JSON) and re-verifies every persisted per-source status against package content and the DB.

---

## 1. Store inventory and per-decision completeness

**71 records = 48 real + 23 mock.** Every real decision exists in two provenance classes by store design — 24 `current_record` + 24 `generation_cache` (the pre-dedup-guard two-pass run of 2026-11-04, first pass 13:52–13:54Z cached, second pass 14:02–14:11Z current) — plus 23 `mock_pipeline_check`. All 71 are `researchStatus=research_only` (verified field-by-field, not sampled).

Per-decision fields required by the audit contract and their state on all real records:

| Field | State |
|---|---|
| Decision ID (`signalId` = symbol−timestamp−hash8) | present, unique |
| Symbol | 24 symbols (23 at cutoff 2026-11-03; ENGRO honestly recorded at its true data cutoff 2025-01-03) |
| Evidence cutoff timestamp | `dataCutoff` present on all; the ENGRO record's cutoff is the provider's real last-bar date, not a fabricated current date |
| Provider / model | `zai/glm-4.6` on all real records (mocks: `mock/glm-4.6`, explicitly typed) |
| Source category / availability / refs / timestamps / missing reasons / quality flags | persisted **inside the evidence packages** (9 categories, per-source status, `sourceRefs` with retrievedAt/publishedAt/url, `missingSources`, `dataQualityFlags`) |
| Evidence content hash | `evidenceHash` present on all 71; all 71 unique |
| Generation timestamp | `decisionTimestamp` present, range 2026-11-04T13:52:34Z → 14:11:40Z (no generation since — see §4) |
| Validation result | `validationStatus` valid 46 / rejected 2 (both real rejections audited in §3) |

**Mock hygiene:** all 23 mock records carry `recordType=MOCK_PIPELINE_CHECK`, `provenance=mock_pipeline_check`, `mockRecord=true`, provider `mock` — excluded from metrics paths by construction (code-verified in the Task 123 suite).

## 2. Source coverage — verified against content, not field presence

Aggregate per-source status over the 24 packages (216 audited rows, **0 verification flags**):

| Source category | Status distribution | Independent verification performed |
|---|---|---|
| Technical (OHLCV/indicators) | **verified ×24** | cross-checked against DB bar counts through each symbol's cutoff |
| Chart patterns | **verified ×24** | point-in-time pattern bundle (`pitPatterns`) embedded per package |
| Volatility / risk | **verified ×24** | metrics + DB cross-check |
| Market context | **verified ×24** | metrics + DB cross-check |
| Company financials (fundamental) | **partially_verified ×24** | honest: data-quality flag `financial_publication_timestamps_not_pit_verified` recorded |
| Financial patterns | **partially_verified ×24** | same flag |
| Company-specific news | **partially_verified ×13, unavailable ×11** | the 11 unavailable symbols say so explicitly ("No news found is NOT equivalent to positive news") with count 0 |
| National news | **partially_verified ×24** (192 rows total) | counts consistent with package `newsCounts` |
| International news | **partially_verified ×24** (192 rows total) | counts consistent |

Aggregate news rows across the 24 packages: **54 company + 192 national + 192 international**. The Task 123 prose figures ("24/8/8") were per-store excerpts, not totals; these are the verified aggregates. Nothing was upgraded to "available" without content: unavailable sources are recorded as unavailable, and partially-verified sources carry their reasons.

## 3. Failure honesty and validator strictness (real, recorded cases)

- **ENGRO (current_record):** rejected with `stale_evidence` — the store refused to present a decision built on 2025-01-03 data as current. Its `dataCutoff` is the true provider frontier. `staleSkipped` on the record is false because the rejection came from validation, not the early gate; the newer 10-day stale gate (code-verified) would now skip before calling.
- **PSO (generation_cache):** rejected with `invalid_view:financial_pattern_view` — the strict validator rejected a decision carrying an invalid citation/view. The re-generated PSO current_record is valid. This is the "fabricated citations are rejected" mechanism observed working on real data.
- **Real llm_unavailable:** exactly 2 of 48 real records; both are the two above; **no fabricated decisions, no invented evidence, no invented timestamps** anywhere in the store.
- **Zero duplicate evidence hashes** across all 71 records.

## 4. Hashing and dedup — verified in code, one historical gap documented

- **Content-only hashing: VERIFIED in code.** `evidenceHash()` deletes `decisionTimestamp` before FNV-1a over the stable-sorted JSON (`llm-provider.ts:93-103`, Task 123 fix), so unchanged evidence no longer re-fires the provider.
- **One leftover duplicate-generation pair:** HUBC 2026-11-03 carries **two** `generation_cache` records (13:52:34 and 13:54:13, different hashes) — a genuine duplicate generation from the pre-guard era, retained append-only. The `current_record` class has **zero** (symbol, cutoff) duplicates, and `appendHistory` now skips any duplicate `(symbol, dataCutoff)` with an explicit `duplicate_decision_skipped` log event (code-verified). Store-level uniqueness therefore no longer depends on the hash at all.
- **Hash-reproducibility gap (found and fixed forward):** the 24 legacy package hashes cannot be recomputed from the persisted packages — the runner hashed the in-memory bundle, then the record pipeline mutated the embedded copy (`asOfSession` stamp, decision-timestamp metric stamps inside `runStockSignal`). This does **not** indicate fabrication (all per-source content is intact and independently audited above), but it made the hash non-verifiable. **Fixed in this changeset:** the runner now snapshots the evidence exactly as hashed and persists it as `hashedEvidenceSnapshot` in every new package, making future packages byte-verifiable.

## 5. Scheduled generation

- **Wiring VERIFIED in code:** step 3 of `scripts/task123_daily_pipeline.sh` invokes `scripts/task111_llm_runner.ts` with the 24-symbol research universe; the corrected `crontab.txt` schedules that script at 17:30 PKT Mon–Fri; every call's outcome (including failures with reasons, provider/model, prompt version, evidence hash) is journalled to `task111/ops/provider_calls.jsonl` + `runner_log.jsonl`.
- **Production execution: NOT VERIFIED.** The newest store decision is 2026-11-04T14:11Z — no scheduled generation has run since (consistent with Task 124: the 17:30 PKT contract has no installed production executor yet). The new-format evidence directory (`task112/llm_evidence_packages/`) does not exist yet precisely because the new writer has never run — its first real run will populate it.

## 6. Research-only enforcement (every layer)

1. **Store:** 71/71 records `researchStatus=research_only`.
2. **Paper ledger:** `ProspectivePaperTrade.modelId` ∈ {CatBoost, LightGBM, Random Forest, Ridge Regression, XGBoost} — **zero GLM models**; `PredictionHistory.modelId` likewise contains no GLM rows.
3. **Decisions:** GLM's own signals (14 BUY / 27 NO_TRADE / 5 HOLD / 2 unavailable) never produce fills; the lifecycle consumes classical predictions only.
4. **No GLM win-rate or profitability claim is made anywhere** — GLM has no matured, comparable cohort. **GLM predictive performance: NOT YET RANKABLE** (also carried into Task 128).

## 7. News-cache caveat

The `task111/news` caches were refreshed during the Task 123 pipeline tests (2026-11-23, e.g. ANL now empty). They are working caches, **not** the evidence the Nov-4 decisions saw; this audit verifies the **embedded** package evidence, which is the material actually presented to GLM on 2026-11-04.

## 8. Conclusion

The GLM evidence pipeline is **code-correct and honestly recorded**: per-source evidence with real statuses and refs persisted per decision, strict validation demonstrably rejecting stale/invalid output, mocks quarantined, research-only enforced at store + ledger + decision layers, and content-only hashing verified. What is **not yet proven** is scheduled production execution (blocked by the Task 124 contract gap) and hash-verifiable packages (fixed forward, first verifiable package appears at the next real run).
