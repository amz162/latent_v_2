# Scheduler Architecture — Task 129 Post-Market EOD Pipeline

Status: **IMPLEMENTED AND TESTED — production scheduling NOT yet independently
verified on a live host** (host cron not installed in this sandbox; CI green
run pending). Everything below describes the implemented system.

## 1. Components

| Component | File | Role |
|---|---|---|
| Orchestrator | `scripts/task129_eod_scheduler.py` | fetch → validate → persist → integrity → downstream stages; run/recover/backfill/status/daemon modes |
| Config | `config/eod_scheduler.json` | schedule time, retry policy, universe, holidays, stage toggles |
| Host wrapper | `scripts/task129_eod_pipeline.sh` | cron entry: scheduler run + bounded retry window + host-only GLM generation + status snapshot |
| Crontab | `scripts/crontab.txt` | ONE authoritative 17:30 PKT Mon–Fri entry (UTC 12:30) |
| Run ledger | `SchedulerRun` table (Prisma model, raw-SQL writes) | idempotency key `runKey = jobName:session`, statuses, per-symbol counters, stage rc list |
| CI automation | `.github/workflows/daily-psx-pipeline.yml` | 16:30 PKT Mon–Fri: ingest → shadow → maturity → **lifecycle (new)** → reports |
| In-process fallback | `src/instrumentation*.ts` | 17:00–17:04 PKT insert-only OHLCV refresh (tertiary; never runs lifecycle) |

## 2. Exact schedule and timezone

- **Authoritative:** 17:30 PKT (Asia/Karachi, UTC+5) Mon–Fri = `30 12 * * 1-5` UTC.
- Configurable without code changes via `config/eod_scheduler.json`
  (`post_market_time_pkt`, `retry_interval_min` 15, `max_retry_window_min` 120).
- Daemon mode sleeps until the configured PKT time, skips weekends, retries a
  not-yet-published EOD every `retry_interval_min` within the window, then
  records FAILED `eod_not_published_or_provider_unavailable` (exit 2 =
  retryable for cron).
- **Holidays are never assumed**: weekends by calendar, holidays by the
  configured `holidays` list, and — decisive — by provider data: a weekday
  where the provider publishes no new session while the frontier is behind is
  classified `eod_not_published` (retry), while a frontier already at/after
  the candidate session is `NO_SESSION` (honest no-op success).

## 3. Data provider

Approved provider only: `https://psxdata-api.fastapicloud.dev` (the same
"psxdata" REST API used by `src/lib/latent/psxClient.ts` and
`scripts/task107_lib.py`), accessed through `task107_lib.fetch_history` with
retry/backoff + jitter, Retry-After honoring, single-flight dedup and
persistent provider-health tracking. No new source introduced.

## 4. Symbols covered

- `universe: "pilot25"` (default) — the 25-symbol shadow universe.
- `universe: "all"` — every symbol present in `OhlcvBar` (~909), enabling the
  repair of the 887 symbols frozen at 2026-10-29.
- `--symbols A,B,C` — individual-symbol recovery; `backfill --start --end`
  for date-range repair (idempotent via the run ledger).

## 5. Per-run flow (strict ordering, gated)

1. **fetch** — per symbol, incremental from `max(lastStored − overlap, session)`
   with a 7-day overlap window for reconciliation; provider empty ≠ success.
2. **validate** — OHLC envelope, positivity, volume sanity, date format,
   future-date rejection (reuses `task107_lib.validate_bar` + new checks).
3. **persist** — pre-run DB backup → single transaction per batch of
   `INSERT OR IGNORE` (composite PK `symbol+date` is the final guard).
   Conflicts with stored history are quarantined to `price_revisions.jsonl`.
4. **integrity** — duplicate-pair count, `PRAGMA quick_check`, frontier
   advance check. Failure → downstream BLOCKED (rc 4 recorded).
5. **downstream (only when new rows persisted)** — in order:
   `indicators` (precompute_price_patterns.ts) → `results_patterns`
   (task129_warm_result_patterns.ts, only when financials changed) →
   `maturity` (task107_maturity.py) → `lifecycle`
   (prospective_paper_trading.ts) → `modelm_cache`
   (task129_model_m_cache.ts) → optional `glm` (host only) → `monitoring`
   (task112 + task127 + task123_health).
6. **ledger** — run row finalized: COMPLETED (all stages ok, zero symbol
   failures) / PARTIAL (any failure, with failed symbols + reasons) /
   FAILED (retryable) / NO_SESSION.

## 6. Reliability mechanisms

- **Locking**: task107 `Lock` file + `SchedulerRun` state (fresh RUNNING row
  refuses overlap; stale heartbeat >30 min is adopted = crash recovery).
- **Idempotency**: `runKey` skip for COMPLETED/PARTIAL/NO_SESSION sessions;
  INSERT OR IGNORE; leg/trade/outcome idempotency downstream (unique
  constraints); `--force` override for deliberate re-runs.
- **Retry**: per-request backoff (provider lib) + post-market EOD retry loop
  (config-driven) + cron re-invocation semantics (exit 2 = retryable).
- **Timeouts**: per-stage subprocess timeouts (560–1800 s by stage).
- **Logs**: structured JSONL (`run_log.jsonl`), per-run stage rc list in the
  ledger, per-run console JSON summary, `status` command + snapshot JSON.
- **No secrets**: no tokens involved; provider is key-free; DB is a file path.

## 7. Monitoring interface

- `python3 scripts/task129_eod_scheduler.py status` — config, frontier,
  candidate session, next run, provider health, last 8 runs.
- `/api/cron/scheduler-status` (existing) + `/api/model-m` data-quality
  section surfacing the last run + per-symbol freshness to the UI.
- Failure notifications flow through the existing task127 alerting
  (10-alert taxonomy incl. `duplicate_fill_attempts`, `db_integrity_failure`).

## 8. Manual commands

```
python3 scripts/task129_eod_scheduler.py run                     # standard EOD
python3 scripts/task129_eod_scheduler.py run --symbols ENGRO     # single symbol
python3 scripts/task129_eod_scheduler.py recover --symbols ABL,SYS --session 2026-11-23
python3 scripts/task129_eod_scheduler.py backfill --start 2026-10-30 --end 2026-11-23
python3 scripts/task129_eod_scheduler.py run --dry-run           # fetch+validate only
python3 scripts/task129_eod_scheduler.py status
python3 scripts/task129_eod_scheduler.py daemon                  # self-scheduling loop
```

## 9. Known limitations

1. Production host scheduling is NOT verified (no cron installed in the
   sandbox; install with `crontab scripts/crontab.txt`).
2. CI green run pending (GitHub scheduler delay/drop evidence in
   `data_pipeline_audit.md` §F11).
3. Holiday list is manual (PSX publishes no machine-readable calendar used
   here); provider-absence logic covers undeclared holidays at the cost of
   retry cycles.
4. The 887-symbol backfill is supported but not yet executed end-to-end; the
   ABL live recovery (+16 real bars) is the verification proof.
