# Task 119 — Provider Recovery, Market Frontier Refresh & Outcome Ledger Reconciliation

**Date:** 2026-11-08 · **Baseline HEAD:** `97ca9502` (= Task 118 `692078ef` + one Actions monitor-state commit) · **Final classification: `OPERATIONALLY_HEALTHY`** · **No GitHub push (per instructions).**

## 0. Sandbox-recycle recovery (prerequisite, Checkpoint A)

The task began on a recycled workspace: an ancient scaffold commit (`6daa32ec`), Task 117/118 artifacts absent, the DB reverted to the pre-Task-115 snapshot (frontier 2026-11-03, no beta tables), dev runtime auto-started, worker dead with the Nov-3 heartbeat. Recovery (all documented in `task119_recovery_baseline.json`):

- `origin/main` contained **all committed work** (Task 118 push verified present) → workspace reset to `origin/main` (`97ca9502`), tree clean.
- Raw DB rebuilt from the committed `db/custom.db.gz` (2026-11-04 Actions snapshot: 1,042,923 bars, 15 tables) + `prisma db push` recreated the 4 beta tables (existing rows untouched: bars/predictions/outcomes verified unchanged). Lost-with-recycle (untracked): 2 synthetic smoke-test beta profiles (no real users were ever invited), worker runtime state, backups directory.
- Idempotent re-ingest inserted **69 bars (2026-11-04, 2026-11-05, 2026-11-06)** with 0 overlap mismatches; rerun `no_new_data`. BetaConfig defaults recreated; production runtime + worker restarted (prod `next start`, worker pid live, fresh heartbeat). `.env` verified identical to the pre-recycle snapshot.

## 1. Provider 429 recovery (Checkpoint B — implemented, evidence-based)

**Found:** the pipeline's single provider path (`task107_lib.fetch_json`) had **no retry logic at all** — one-shot calls; a 429 immediately failed the cycle (observed live during Task 118 as upstream LLM 429s; the PSX provider probe itself was healthy throughout this task).

**Implemented** (`scripts/task107_lib.py`, all callers benefit with no call-site change):

- Bounded exponential backoff with jitter: base 1.5 s × 2^n, ±30 % jitter, max 4 attempts, 60 s total deadline (env-tunable for deterministic tests).
- `Retry-After` honored on 429/503 (seconds or HTTP-date), capped by the remaining deadline; overrides the backoff curve.
- Retry scope: 429/5xx/network errors only — 4xx permanent errors fail fast (1 attempt).
- Single-flight per URL within the process (concurrent duplicates join the in-flight request); cross-process single-flight remains the durable `task107` lock (no Redis, per Task 117 decision).
- Persistent provider-health state machine at `ops/provider_health_state.json`: `healthy / degraded / rate_limited / unavailable` with `last_success_at`, `last_failure_at`, `last_http_code`, consecutive-failure count and a capped transition ledger. Task 119 probes: `healthy`, transition `unknown→healthy` recorded.
- A 429 can never advance the frontier or create bars: failures return gracefully in the historical signature, callers record `provider_unavailable`, worker keeps running (verified by test 10 and by the live worker idling through test-injected outages).
- UI stale-data warnings preserved unchanged (frontier-driven insight warnings; no fabrication path exists).

**Tests (deterministic, urlopen mocked at the module boundary):** 9 provider tests (persistent 429 bounded at exactly max attempts; Retry-After wins over backoff; backoff bounds; deadline cap; timeout→`unavailable`; recovery→`healthy`; 404 fail-fast; single-flight dedup under concurrency; transition persistence) + ingest safety (no frontier advance / no bars on 429; weekend session resolution) + worker survival (gated cycle under persistent 429 completes without traceback; heartbeat writer + stale-heartbeat/pid-liveness detection).

## 2. PSX market frontier refresh (Checkpoint C — VERIFIED)

- **Frontier: 2026-11-06** (Friday) — the latest genuinely completed session, ingested during recovery with **69 bars across 2026-11-04/05/06, 0 overlap mismatches**; a follow-up run returned `no_new_data` with 69 bars revalidated (idempotency). Nov 7–8 = weekend; the machine clock is never used to infer a bar date (`psx_session_state` convention verified by test).
- Coverage: **23/25 pilot symbols** with frontier-day bars. **ENGRO** (last bar 2025-01-03) and **BYCO** (last bar 2021-12-20) are structurally absent — delisted; the provider returns HTTP 200 with empty history for them. Session-gap symbols: **none**. Duplicate symbol-date pairs: **0**.
- Live overlap probe: LUCK, SYS, MEBL re-fetched from the provider and byte-compared against stored OHLC — **3/3 exact matches** (single call per symbol; no bulk refetch).
- Ingest evidence restored to genuine state: the earlier `failed_provider_unavailable` report written by a test (module-global patch gap, since fixed) was replaced by a real run's report; the ingest now also persists its report on the `no_new_data` path (visibility fix).

## 3. Outcome ledger reconciliation (Checkpoint D — exact reproduction)

Method: production engine (`task106_mature.ts`) re-invoked **fresh** on the frozen shadow ledgers; partition + arithmetic recomputed independently; a **point-in-time DB clone clamped to ≤ 2026-11-05** reproduces the Task 118 population. No historical record was modified.

**Task 118 reported vs independently reproduced (point-in-time 2026-11-05) — all match:**

| Metric | Reported | Reproduced |
| --- | --- | --- |
| Matured outcomes | 114 | 114 ✓ |
| Pending | 57 | 57 ✓ |
| Realized PKR | 251,057.33 | 251,057.33 ✓ |
| MTM PKR | 115,928.22 | 115,928.22 ✓ |
| Cohorts | 3 | 3 ✓ |

**Structural finding (the critical distinction):** every "matured" outcome in both populations is a **terminal strategy exit** (SL/TP3) — there are **zero** fixed-horizon TIME_UP maturities anywhere yet (the 21-session clock has not completed for any position). "Matured" in the engine summary means realized-by-exit, not horizon maturity.

**Current state (frontier 2026-11-06), all from raw records:** 240 outcome rows = **80 unique filled decisions × 3 strategies** → **159 terminal exits** (realized **293,097.84 PKR**), **81 open positions** (MTM **16,515.07 PKR**; 238 horizon-observations still owed), 0 missing-data, 0 unfilled. Exclusivity verified (a row is in exactly one category; realized and MTM populations disjoint). Horizon layer (per-symbol session clocks recomputed from raw bars): gen1 **12/12 h5-matured**, 0 h10/h21 anywhere; the 23 gen3 2026-11-05-batch decisions were unfilled at 2026-11-05 and filled at the 2026-11-06 open (cohort totals 12/22/46 match the committed task114 CSV exactly). The 114→159 and 115,928→16,515 changes vs Task 118 are fully explained by the verified 2026-11-06 close (34+ more exits; MTM repricing), not by any redefinition.

## 4. Monitoring & alerts (Checkpoint E)

`scripts/task119_monitor.py` persists `task119_monitoring.json`: provider state + 429 event count + last success, worker heartbeat age/pid/restarts, frontier, SQLite `quick_check`, pending-outcome backlog, with an explicit alert policy — **ALERT only for real failures** (stale heartbeat *without* an expected-idle note; provider unavailable during the market window; integrity failure); pre-market/weekend idling and closed-window 429s are INFO/WARN. Current snapshot: **all INFO** (heartbeat fresh-idle 2.8 min, provider healthy, quick_check ok). No Redis, no paid services.

## 5. Test results

New: `task119_tests.py` **17/17**. Regressions after the documented frontier-dynamic updates (Task 114: `a6`; Task 115: `g2`; Task 116: `m6f` — each preserves its invariant, changes documented in `task119_test_results.json`): task107 v1 **30/0**, v2 **29/0**, task114 **30/0**, task115 **22/0**, task116 **35/0** py + **20/0** bun-test, task117 acceptance **45/0 on production**, parity **29/0** + **33/0**. The one transient task117 failure was the in-process invite rate limiter exhausted by repeated suite runs — protection working as designed; cleared by restart, then 45/0 in a single fresh run.

## 6. Production vs local

- **On production runtime:** task117 acceptance suite, API health, all browser-independent API behavior; production server restarted twice (rate-limiter clear; supervisor rebuild) and survived both; DB restored + re-ingested live.
- **Deterministic/local:** all 429/timeout/recovery simulations (mocked urlopen), the point-in-time DB clone, all reconciliation arithmetic.

## 7. Remaining operator actions

1. Rotate the GitHub PAT (fine-grained, single repo, Contents RW) and enable 2FA — unchanged from Task 118 (outside this task's scope by instruction).
2. The workspace holds uncommitted Task 119 changes (implementation + artifacts); **no push made per instructions** — authorize a push when ready.
3. Optional: extend the pattern-precompute mini-service's schedule note — it remains stopped to protect shared upstream quota.

## 8. Artifacts

`docs/reports/task119_operational_reliability_audit.md` (this file) and `data/backtest_reports/task119/`: `task119_recovery_baseline.json`, `task119_outcome_reconciliation.json`, `task119_outcome_categories.csv`, `task119_frontier_verification.json`, `task119_monitoring.json`, `task119_test_results.json`. Task 112–118 artifacts preserved.

**Final classification: `OPERATIONALLY_HEALTHY`** — provider healthy with bounded 429 recovery in place; frontier verified at 2026-11-06 with independent byte-level evidence; outcome ledger reproduces Task 118 exactly point-in-time and partitions exclusively at the current frontier; worker/monitoring/DB all green. Invite-only, research/shadow-only semantics unchanged; no strategies added, no models retrained, no parameters tuned.
