# Data Pipeline Audit — Task 129 (Phases 0–1)

Audit date: 2026-11-23 (UTC) · Repository: `latent_v_2` · Database: `db/custom.db` (201 MB SQLite)

## 1. Scope and method

Full inspection of every ingestion path, scheduler, lifecycle trigger and
integrity mechanism, followed by fixes and live verification. Nothing was
assumed fixed from a previous task: every prior fix was re-inspected in the
current code and, where possible, re-executed. All database reads during the
audit were performed read-only; writes were made only by the fix steps and the
verification runs documented below.

## 2. Database state at audit start

| Item | Value |
|---|---|
| Tables in live DB | **15** (schema declares 36) |
| `OhlcvBar` rows | 1,043,209 · 909 symbols · 2016-10-21 → 2026-11-23 |
| Duplicate (symbol,date) pairs | 0 |
| Symbols at global frontier (2026-11-23) | 22 (pilot-25 minus ENGRO/SYS/BYCO) |
| Symbols frozen | 887, all at **2026-10-29** |
| Provider-side gap symbols | ENGRO (newest bar 2025-01-03), BYCO (2021-12-20), SYS (no 2026 data) |
| `ModelPredictionCache` / `ModelBacktestCache` | 8 / 0 rows (wiped by a snapshot restore) |
| Paper-trading ledger | 114 trades (78 closed / 3 open / 33 pending), 86 legs, net −707,370.97 PKR |

Two classes of missing data were carefully separated (as required):

- **Ingestion gaps** — the provider HAS data, the DB does not (887 frozen
  symbols; confirmed live: ABL provider newest = 2026-11-23, DB = 2026-10-29).
- **Provider-side gaps** — the provider itself has no data (ENGRO, SYS, BYCO;
  re-probed live during this task, dates above). These are recorded as
  `missing_symbols` and never backfilled/interpolated.

## 3. Findings and fixes (F1–F12)

### F1 — Prisma client not generated in CI (root cause of 13 failed daily runs)
Status: **fix verified in code; production run still pending a green CI run.**
`bun install` does not run Prisma lifecycle scripts and the generated client
is gitignored, so every scheduled `daily-psx-pipeline` run 2026-11-04..11-20
died with `[shadow] rc=4` (`Cannot find module '.prisma/client/default'`). The
Task 124 `bunx prisma generate` step is present in the workflow (verified in
the current file). Verification of the fix itself was performed locally:
`bunx prisma generate` succeeds and the shadow/maturity scripts import cleanly.

### F2 — Schema/DB drift: 21 declared tables missing from the live DB (NEW finding)
`permissionRegistry`, `planPermission`, `profileAccess`, `betaProfile`,
`BetaInvite`, `BetaConfig`, admin/RBAC tables, `UserUsage` and more existed
only in `schema.prisma`. Any guarded API route would throw (Prisma
`P2021`-class) in this environment because `guardUser` re-throws non-AuthError
exceptions. Fix: `bunx prisma migrate diff` confirmed the diff is **purely
additive** (17 CREATE TABLE, zero DROP/ALTER), then `bunx prisma db push`
applied it → **15 → 36 tables**, followed by the idempotent RBAC seed
(`bun scripts/task121_seed_rbac.ts`, 29 registry entries incl. the new
`tab.model_m`). Three new Task 129 tables were added in the same push:
`SchedulerRun`, `ModelMEvidencePackage`, `ModelMAnalysis`.

### F3 — No automatic lifecycle executor (the Task 124 "critical contract gap")
The prospective paper-trading lifecycle had no reliable automatic trigger: the
CI pipeline stopped at `reports`, the host pipeline existed only as an
uninstalled crontab template, and the in-process scheduler's
`runDailyUpdate()` was dead code. Fixes:
1. `scripts/task107_runner.py` gained a **`lifecycle` stage** between
   `maturity` and `reports` (bun availability checked; graceful rc=2 skip on
   hosts without bun; ingest failure still blocks the chain).
2. New host wrapper `scripts/task129_eod_pipeline.sh` (17:30 PKT) runs the
   full scheduler then the host-only GLM generation.
Verification: `bun scripts/prospective_paper_trading.ts` executed against the
live ledger after the change — 39 books, all historical books intact, no
duplicates created.

### F4 — Stale absolute paths (the recurring "wrong project directory" class)
- `scripts/server_supervisor.sh:25` — `APP_DIR="/home/z/my-project"` (workspace
  root, app actually lives in `repo_latent_v_2`).
- `scripts/start_server.sh:10` — same stale value.
- `scripts/task118_db_integrity.py:15` — `ROOT = Path("/home/z/my-project")`.
All three now resolve from the script's own location. Verified by inspection
and by the fact that the supervisor is the file the final server start uses.

### F5 — Provider-side data gaps (re-verified live, not assumed)
Live probes against the approved provider (`psxdata-api.fastapicloud.dev`) on
2026-11-23: ENGRO newest bar **2025-01-03** (249 bars since 2024-01-01), BYCO
newest **2021-12-20**, SYS **0 bars for 2026**. The scheduler records these as
`missing_symbols` with reasons — they are never fabricated or interpolated.
Also confirmed live: `MEBL` returns bars newest-first (order-agnostic handling
verified).

### F6 — 887 symbols frozen at 2026-10-29 (ingestion coverage gap)
Root cause: since 2026-11-03 only the pilot-25 ingest fed the DB. The new
scheduler supports `universe: "all"` incremental ingestion; per-symbol
recovery was proven live: `recover --symbols ABL,ENGRO,SYS,BYCO --session
2026-11-23` inserted **16 real provider bars for ABL** (2422 → 2438 bars, new
frontier 2026-11-23, close 169.61 PKT), skipped ENGRO/BYCO (provider frontier
reached), recorded SYS as missing, integrity clean (0 duplicate pairs,
quick_check ok), run recorded `COMPLETED` in `SchedulerRun`.

### F7 — `/api/cron/refresh-ohlcv` had no validation and swallowed errors
Rewritten: every candidate bar passes OHLC-envelope/positivity/volume/date
validation before insert; invalid bars are counted with reasons (samples in
the response); insert errors are recorded (previously `catch {}`); empty
provider responses are counted as `providerEmptySymbols`, not success.
Insert-only semantics preserved (existing bars never overwritten).

### F8 — Lifecycle cost profile: V2 schedule now applies to new books
`STANDARD_PSX` (an alias of `legacy_standard_psx_v1` with 0.15% synthetic
slippage) was the only profile used by the lifecycle although the canonical
`psx_user_schedule_v2` (zero slippage, fixed commission floor, PSX/NCCPL/CDC
fees) is the platform's declared policy. Fix (prospective-lifecycle.ts):
new books are booked under `psx_user_schedule_v2`; existing trades keep the
profile encoded in their own bookId and are never re-costed; pending-entry
adoption is per-profile. Verified live: historical 39 books unchanged.

### F9 — Scheduler duality → one authoritative entry + idempotency ledger
Before: three overlapping post-market triggers did different things
(17:00 PKT in-process refresh, 17:10 PKT cron DB ingest, 17:30 PKT cron
pipeline). Now: `scripts/crontab.txt` has ONE authoritative post-market entry
(17:30 PKT `task129_eod_pipeline.sh`); the CI daily workflow is the documented
CI-level fallback; cross-executor double runs are prevented by the
`SchedulerRun.runKey` idempotency (`jobName:session`) plus INSERT OR IGNORE
persistence and the task107 lock. The in-process 17:00 refresh remains an
insert-only tertiary path (documented).

### F10 — No run ledger existed
`SchedulerRun` table created (runKey unique; statuses RUNNING/COMPLETED/
PARTIAL/FAILED/NO_SESSION; per-symbol counters; stage rc list; trigger;
duration). Crash recovery: a RUNNING row with a stale heartbeat (>30 min) is
adopted; a fresh one refuses overlap. Both behaviours are unit-tested.

### F11 — GitHub Actions scheduling delays/drops (documented, unfixable in-repo)
Evidence: cron `30 11 * * 1-5` but the five latest scheduled runs fired
19:12–21:10 UTC (7h42m–9h40m late), and the Mon 2026-11-23 11:30 UTC window
never produced a run at all (workflow state `active`). The 17:30 PKT window is
therefore ALSO covered by the host cron + daemon retry loop (retry every
15 min up to 120 min).

### F12 — Duplicate/overwrite protection verified
`OhlcvBar` PK `@@id([symbol,date])` + `INSERT OR IGNORE` everywhere; provider
disagreement with stored history is quarantined to
`data/backtest_reports/task129/scheduler/ops/price_revisions.jsonl` and
reported, never overwritten (unit-tested with a 999.0-vs-103.0 close conflict;
stored row preserved).

## 4. Verification commands (evidence)

```
python3 -I scripts/task129_eod_scheduler.py recover --symbols ABL,ENGRO,SYS,BYCO --session 2026-11-23
python3 -I scripts/task129_eod_scheduler.py status
bunx prisma migrate diff --from-schema-datasource … --to-schema-datamodel …   # additive-only
bunx prisma db push && bunx prisma generate && bun scripts/task121_seed_rbac.ts
bun scripts/prospective_paper_trading.ts          # 39 books, ledger intact
python3 -I scripts/task129_scheduler_tests.py     # 39/39 (mocked provider, labelled)
```

## 5. Remaining risks (honest)

1. The CI green run proving F1 end-to-end has not happened yet (no scheduled
   run since the push; GitHub scheduling dropped the 11-23 window).
2. The 887-symbol backfill is *supported* (universe=all) but not *executed*
   in this task beyond the ABL proof — a full-universe run is a long live job
   and should be scheduled deliberately (one command: `run` with
   `universe: "all"` in config).
3. ENGRO/SYS/BYCO remain provider-blocked; nothing can fix that in-repo.
4. Fundamentals/news snapshots are file-based with fetch timestamps but no
   point-in-time publication verification
   (`financial_publication_timestamps_not_pit_verified` is disclosed on every
   Model M package).
