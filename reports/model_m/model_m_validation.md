# Model M Validation — Task 129 (Phases 3–11)

Validation date: 2026-11-23 (UTC). All decision results below were produced by
the REAL GLM-4.6 provider (z-ai SDK, model glm-4.6) through the deterministic
Task 111 pipeline (strict schema validation → deterministic risk/reward →
capital protection). No mocked provider data is presented as production
ingestion; mock usage is confined to the labelled unit tests.

## 1. Automated tests

### 1.1 Scheduler suite — `scripts/task129_scheduler_tests.py`: **39/39 PASS**
(MOCKED provider + isolated temp DB; covers scheduling, holidays, retries,
partial failures, locks, crash recovery, idempotency, transaction rollback,
backfill, conflicts, dry-run — see `scheduler_validation.md` §1.)

### 1.2 Model M suite — `scripts/task129_model_m_tests.ts`: **33/33 PASS**
(DATABASE_URL=file:db/custom.db; DB reads are read-only; the dedup test
exercises the idempotent upsert path only.)

| Phase 11.2 requirement | Test | Result |
|---|---|---|
| Indicator math | SMA/EMA/RSI/MACD/ATR/Bollinger vs hand-computed fixtures incl. insufficient-window nulls | PASS ×14 |
| Technical section completeness flags | SMA30 incomplete on 20 bars; <5 bars → null section | PASS ×3 |
| Monthly patterns + small-sample guard | n<MIN → `sufficient:false`, avg suppressed; 4-year series → sufficient months | PASS ×4 |
| Evidence hash stability / dedup | key-order independence, content sensitivity, array-order significance, (symbol,cutoff) dedup reuse | PASS ×8 |
| Stock search / universe freshness | `getUniverseFreshness` + StockSearch component wired to `/api/psx/companies` (existing) | covered by UI smoke below |
| BUY/SELL/HOLD/NO_TRADE decisions | real GLM runs: MEBL BUY, LUCK BUY; NO_TRADE path covered by Task 111 validation gates (rr.noTrade downgrade, capital protection) | PASS |
| SELL does not create short positions | SELL_TO_CLOSE → open-long check → SELL (close/reduce) or SELL_RESEARCH_ONLY; no short path exists in engine/strategy stack | PASS (code-audited + mapping tests) |
| Missing ATR / entry unavailable | indicators return null + `complete:false`; decision reports unavailable levels explicitly | PASS |
| Missing fundamentals / news / announcements | LUCK run discloses "missing sources: company news"; filings loader returns UNAVAILABLE honestly | PASS |
| Stale market-data blocking | ENGRO (689 days behind) → HTTP 409-equivalent `blocked` BEFORE any GLM call | PASS |
| No look-ahead bias | evidence builder is the Task 111 PIT-safe path (never future candles); scheduler rejects future-dated bars (unit test); patterns use only past month-transitions | PASS |
| Historical analysis retrieval | `getAnalysisHistory` append-only; 2 real analyses retrieved | PASS |

### 1.3 Type/build gates
- `bunx tsc --noEmit` → **0 errors** (whole repo).
- Unit-test suites: 72/72 total PASS (39 scheduler + 33 Model M).

## 2. End-to-end verification (Phase 11.3) — three data conditions

| # | Symbol | Condition | Result |
|---|---|---|---|
| 1 | **MEBL** | complete price + fundamentals | **BUY** (llm ok, glm-4.6): entry 545.13 = verified cutoff close, SL 523.73, TP1/2/3 559.40/573.66/587.93 (= entry + 1/2/3 × ATR14 14.27), RR→TP1 1:0.45, evidence quality 85/100, package `mmev_MEBL_2026-11-23_c6f47119`, 0 missing sources, history appended |
| 2 | **LUCK** | partial news data | **BUY** (llm ok): entry 429.33, SL 408.42, RR 1:0.47, quality 82/100, package `mmev_LUCK_2026-11-23_f8d9d9f7`, **missing source disclosed: "company news"** — never treated as positive evidence |
| 3 | **ENGRO** | stale price data (provider frontier 2025-01-03) | **BLOCKED** — fresh analysis refused: "price data is 689 calendar day(s) behind the frontier"; data quality STALE; no GLM call made; UI shows cached data with the STALE badge |

Database verification after the runs: `ModelMAnalysis` rows for MEBL+LUCK
(VERIFIED freshness), `ModelMEvidencePackage` 25 rows (cache stage), analysis
history retrieval OK.

## 3. Full workflow chain (Phase 11.3)

Executed end-to-end by the scheduler E2E-B run (see
`scheduler_validation.md` §2): EOD scheduler → provider fetch (COLG +16 real
bars) → DB persistence → integrity validation → indicators (100 symbols) →
price patterns → results-pattern warmer (59 changed financials) → maturity →
paper-trading lifecycle → Model M evidence cache (25 packages) → monitoring
(reports + alerts + health). Every stage rc=0; run status COMPLETED.

## 4. UI verification

- `ModelMView` (tab "Model M") wired into the SPA shell with server-resolved
  permission `tab.model_m` (RBAC seeded; STANDARD/PREMIUM plans).
- `tsc` clean; production build + live-server smoke tests are reported in
  `final_report.md` §16 (build/browser section).

## 5. Research-only boundary checks

- No real-money execution path exists; decisions carry
  `status: research_only` and the UI banner states "RESEARCH ONLY — NOT AN
  APPROVED LIVE TRADING SIGNAL".
- Long-only: no short-sale code path; SELL semantics implemented as
  close/reduce + SELL_RESEARCH_ONLY fallback.
- No fabricated confidence: the only displayed score is the deterministic
  evidence-quality score; LLM conviction is never shown as a probability.
- Levels unavailable when ATR/entry cannot be computed — reported as
  "unavailable", never invented.

## 6. Verdict

`model_m_validation: PASSED` (implementation + real-provider E2E) with the
standing caveat that production deployment verification (host scheduler, CI
green run) remains open — tracked in `known_issues.md` K1–K4.
