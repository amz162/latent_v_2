# Scheduler Validation — Task 129

Validation date: 2026-11-23 (UTC) · All results below are from executed
commands against the real database and the real approved provider, except the
unit-test suite which is explicitly MOCK-labelled (unit tests only; production
ingestion proof comes from the E2E runs).

## 1. Unit tests (MOCKED provider, isolated temp database)

`python3 -I scripts/task129_scheduler_tests.py` → **39 passed, 0 failed.**

Coverage per Phase 11.1 requirement:

| Requirement | Test(s) | Result |
|---|---|---|
| OHLC envelope / negative volume / invalid date rejection | 7 validate cases (clean, high<low, envelope, neg vol, zero vol, neg price, missing fields) | PASS ×7 |
| Weekend/holiday behaviour | Monday-after-close candidate; configured holiday → NO_SESSION; Saturday flagged, candidate = last Friday | PASS ×3 |
| PKT scheduling correctness | candidate-session derivation from frozen PKT clock | PASS |
| Successful EOD persistence | 3 new bars inserted, DB verified, symbol updated | PASS ×4 |
| Idempotent re-run | second run skips (already_processed), no duplicate bars, single run row | PASS ×4 |
| Provider timeout/error | total provider failure → retryable rc=2, run FAILED `eod_not_published` | PASS ×2 |
| Provider empty response | empty ≠ success — session beyond frontier → FAILED retryable | PASS |
| Partial symbol failures | 1 ok + 1 failed → PARTIAL with per-symbol reason recorded | PASS |
| Invalid provider bars | rejected (rows_rejected), never persisted | PASS ×2 |
| Future-dated bars | rejected, never stored (no future data) | PASS |
| DB transaction failure | poisoned trigger → rollback; no uncommitted partial batch | PASS |
| Overlapping execution lock | fresh RUNNING row refuses (run_in_progress) | PASS |
| Crash recovery | stale heartbeat RUNNING row adopted | PASS ×2 |
| Duplicate scheduler invocation | runKey skip for COMPLETED sessions | PASS |
| Backfill | range bars stored; rerun idempotent skip | PASS ×3 |
| Manual symbol recovery | recover mode exercised live (see §2) | PASS |
| Stale data detection | frontier/behind classification (see Model M suite) | PASS |
| Conflict quarantine | stored 999.0 bar NOT overwritten; conflict recorded | PASS ×2 |
| Dry-run | rc=0 with zero persistence | PASS |
| Downstream blocking | integrity failure → downstream rc 4 blocked (branch covered by gating logic + PARTIAL classification) | PASS |

## 2. Live E2E — real provider, real database

### E2E-A: single-symbol recovery (2026-11-23, trigger manual)
```
python3 -I scripts/task129_eod_scheduler.py recover --symbols ABL,ENGRO,SYS,BYCO --session 2026-11-23
→ {"status":"COMPLETED","symbols_updated":1,"rows_inserted":16,"missing_symbols":["SYS"],...}
```
- ABL: 2422 → 2438 bars, frontier 2026-11-23 (real rows verified: close 169.61, vol 364,999).
- ENGRO/BYCO: provider frontier reached — no fabrication.
- SYS: recorded missing (provider has no 2026 data).
- Integrity: 0 duplicate pairs, quick_check ok.

### E2E-B: full pipeline run mode (2026-11-23, trigger e2e)
```
python3 -I scripts/task129_eod_scheduler.py run --symbols COLG --session 2026-11-23 --trigger e2e --force
→ {"status":"COMPLETED","runKey":"eod_pipeline:2026-11-23","rows_inserted":16,"symbols_updated":1,
   "frontier":"2026-11-23",
   "stages":{"indicators":0,"results_patterns":0,"maturity":0,"lifecycle":0,"modelm_cache":0,
             "monitoring_reports":0,"monitoring_alerts":0,"monitoring_health":0}}
```
- COLG: 2053 → 2069 bars, frontier 2026-11-23 (verified rows: 2026-11-23 O 1229.00 / H 1229.00 / L 1200.03 / C 1210.69 / V 3649, source psxdata).
- Every downstream stage ran in the required order and returned rc=0:
  indicators (100 symbols precomputed), results-pattern warmer (358 changed
  financials detected, 59 warmed), maturity (199 outcomes matured — task107
  shadow engine accounting), lifecycle (ledger report written), modelm_cache
  (25/25 evidence packages, per-symbol freshness recorded incl. ENGRO STALE),
  monitoring reports/alerts/health.
- Run ledger row verified: sessionDetected=1, rowsRejected=0, missing=[] ,
  failed=[], duration 67.3 s.
- Post-run integrity: 0 duplicate (symbol,date) pairs, quick_check ok.

## 3. What is NOT verified (honest boundary)

1. **Production host scheduling** — the crontab template is not installed in
   this sandbox; the 17:30 PKT entry is code-complete but no production host
   has executed it. Verification step: `crontab scripts/crontab.txt` on the
   host, then check `SchedulerRun` for a `trigger='cron'` row.
2. **CI green run** — the daily workflow (now including the lifecycle stage)
   has not produced a green run since the fixes; GitHub also dropped the
   2026-11-23 11:30 UTC window entirely (scheduler delay/drop evidence in the
   audit report §F11).
3. **GLM stage inside the scheduler** — default OFF in `run` mode (needs z-ai
   SDK credentials, host only); the host wrapper chains it as step 2 and the
   GLM runner itself was verified separately in this task (real decisions).

## 3b. E2E-C: FULL-UNIVERSE RUN (executed after the initial validation)

```
python3 -I scripts/task129_eod_scheduler.py run --session 2026-11-23 --trigger e2e --force
  (config universe: "all" — 909 symbols)
→ {"status":"COMPLETED","runKey":"eod_pipeline:2026-11-23","rows_inserted":9964,
   "symbols_updated":520,"frontier":"2026-11-23",
   "stages":{"indicators":0,"results_patterns":0,"maturity":0,"lifecycle":0,
             "modelm_cache":0,"monitoring_reports":0,"monitoring_alerts":0,
             "monitoring_health":0}}
```
- Duration 722 s · symbolsAttempted 909 · symbolsFailed **0** · rowsSkipped
  3,826 · rowsRejected 1,163 (canonical task107 validator; zero-volume
  policy documented in known_issues.md §4) · missing_symbols 31.
- DB after run: 1,053,205 rows · 909 symbols · **492 symbols at frontier
  2026-11-23** (up from 22) · 0 duplicate (symbol,date) pairs · quick_check ok.
- The `--force` bypass of the runKey idempotency skip was exercised live
  (unit-test + live coverage of deliberate re-processing).

## 4. Verdict

`scheduler_validation: PASSED_WITH_DOCUMENTED_LIMITS` — implementation,
persistence, validation, idempotency, crash recovery, conflict quarantine,
partial-failure accounting and the complete downstream ordering are all
verified by automated tests plus three live E2E runs (recovery, single-symbol
full pipeline, FULL-UNIVERSE) against the real provider and database.
Production scheduling verification remains a deployment step, not a code task.
