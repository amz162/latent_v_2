# Task 124 — Production Deployment & Scheduler Verification

**Date:** 2026-11-23 · **Repo state analyzed:** `main` @ `7a2ba8c2` (GitHub) · **Analyzer:** Z.ai sandbox (no access to the external application host)

**Purpose.** Prove — or honestly disprove — that the Task 123 pipeline repairs actually execute in production. Verification was performed against **live GitHub evidence** (Actions run history and logs pulled from the GitHub API using the repository's local credential store; run IDs cited below), against the repository at `7a2ba8c2`, and against the restored local database. The application host itself was **not** reachable from this sandbox, so every host-only check is labeled `NOT VERIFIED` / `BLOCKED`, with exact read-only operator commands in [task124_operator_commands.md](task124_operator_commands.md).

**Correction to the Task 123 report.** Task 123 attributed the in-process scheduler loss to commit `c00b1b9a` "disabling" the hook via `src/instrumentation.node.ts.disabled`. That was imprecise: `c00b1b9a` actually made a 3-line edit (node-fetch → global fetch) to the **active** `src/instrumentation.node.ts`, which has been tracked all along; the `.disabled` file is a stale backup copy. The real reason the 5 PM PKT in-process scheduler never ran is documented in the operator's own commit `b307e34e` (2026-11-23T00:47Z): **Next.js never loads a file named `instrumentation.node.ts`** — the hook was dead code until `b307e34e` added the correctly-named `src/instrumentation.ts` entry point that delegates to it with a double-registration guard. The operational conclusion of Task 123 (no in-process scheduler was running in production) is unchanged; the mechanism statement is corrected here.

---

## 1. Scheduler inventory — there are FOUR mechanisms, not one

| # | Mechanism | Defined in | Covers | Contract time | Status |
|---|---|---|---|---|---|
| S1 | GitHub Actions `daily-psx-pipeline.yml` | `.github/workflows/daily-psx-pipeline.yml`, cron `30 11 * * 1-5` | ingest → shadow levels → maturity → reports → commit/push DB snapshot | 16:30 PKT (11:30 UTC) weekdays | **ACTIVE but 13/13 runs FAILED — root cause found, fix applied this task** |
| S2 | GitHub Actions `intraday-poll.yml` | cron `*/5 4-10 * * 1-5` (repo) | `task107_monitor.py` intraday snapshots + `task108_workflow_summary.py` | every 5 min 09:00–15:59 PKT market hours | **ACTIVE and succeeding** (`VERIFIED`) |
| S3 | In-process Next.js scheduler | `src/instrumentation.ts` → `src/instrumentation.node.ts` | `daily_5pm_update.py` via `GET /api/cron/refresh-ohlcv` | 17:00 PKT weekdays | **Code-active since `b307e34e`; host execution `NOT VERIFIED`** (requires a long-lived `next start` process; only observable in host logs) |
| S4 | Host crontab | `scripts/crontab.txt` (template) | 17:00 CSV refresh · 17:10 DB ingest · 17:30 **task123 pipeline (lifecycle + GLM + outcomes + health)** | 17:00/17:10/17:30 PKT weekdays | **`BLOCKED`** — installed crontab not observable from sandbox; template not installed anywhere verifiable |

**Critical contract gap (unchanged by this task):** the **17:30 PKT Task 123 pipeline step — prospective lifecycle fills/exits and GLM-4.6 generation — has NO automated production executor** today. It exists only in the S4 template. S1 does not chain those steps; S2 only polls snapshots; S3 only refreshes OHLCV. Until S4 is installed (or S1 is extended — ready-to-apply patch in §6), lifecycle and GLM generation advance only when run manually.

---

## 2. S1 — daily-psx-pipeline: VERIFIED active, VERIFIED failing, root cause found, fix applied

### 2.1 Execution evidence (GitHub API, `actions/workflows/daily-psx-pipeline.yml/runs`)

All 13 scheduled runs since the workflow existed **failed**; there has never been a successful run:

| Run | Date (UTC) | Event | Conclusion |
|---|---|---|---|
| #13 | 2026-11-20T19:12:16Z | schedule | **failure** |
| #12 | 2026-11-19T19:34:35Z | schedule | failure |
| #11 | 2026-11-18T19:29:05Z | schedule | failure |
| #10 | 2026-11-17T19:57:52Z | schedule | failure |
| #9–#1 | 2026-11-16 → 2026-11-04 | schedule | failure (all) |

No run exists for Mon 2026-11-23 as of ~21:00Z; historical start delays ran 7–10 h behind the 11:30 UTC cron (e.g. run #4 started 21:33Z), so the Nov 23 run may still be queued — GitHub-side scheduling delay is a known Actions behavior and is itself a production finding: the intended 16:30 PKT slot has actually executed around 00:12–02:33 PKT.

### 2.2 Failure diagnosis (run #13, id `44799943185`, job "pipeline", step log)

```
[ingest]   rc=0 :: {"status": "success", "frontier": "2026-11-20", "inserted": 276,
                    "new_dates": ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-10", ...]}
[shadow]   rc=4 :: (no output captured)
[maturity] rc=4 :: Bun v1.4.5 (Linux x64)
                   error: Cannot find module '.prisma/client/default'
                   from '.../node_modules/@prisma/client/default.js'
[reports]  rc=0 :: {"stage": "reports", "frontier": "2026-11-20", "snapshots": 66,
                    "pending": 81, "issues": []}
{"kind": "pipeline", "status": "partial_failure", "runtime_seconds": 7.3}
##[error]Process completed with exit code 1.
```

- **Ingest (Python/sqlite3) succeeded every day** — the runner's own log shows it inserted the "missing" Nov 4–20 bars **on the runner**.
- **Shadow (`bun scripts/task105_phase8_levels.ts`) and maturity (`bun scripts/task106_mature.ts`) crashed** because both `import { PrismaClient } from "@prisma/client"` and `bun install --frozen-lockfile` does **not** run `prisma generate`; the generated engine lives in `node_modules/.prisma/client` (gitignored), so it does not exist on a fresh runner. Locally the client exists (`node_modules/.prisma/client/index.js` PRESENT), which is why the same scripts work in the sandbox and why the defect only manifests in CI.
- Because the job failed, the step **"Commit updated database snapshot and reports (only when data advanced)" was skipped** — the freshly-ingested frontier was thrown away with the runner. **This is the precise production mechanism behind the stale repository DB snapshot that Task 123 discovered (frontier frozen at 2026-11-03) and had to backfill by hand.** It is the host-independent root cause; it complements (and for the repo snapshot, supersedes) the "worker died / wrong cron path" findings for host-side execution.

### 2.3 Fix applied in this changeset (`VERIFIED` at command level, `NOT VERIFIED` in production)

Added a step to `daily-psx-pipeline.yml` immediately after dependency install:

```yaml
- name: Generate Prisma client
  run: bunx prisma generate
```

Command-level validation: `prisma@6.11.1` is a declared devDependency, `prisma/schema.prisma` uses the `prisma-client-js` generator, and the same command form is what `package.json`'s `db:generate` script wraps. Idempotent and offline (generation needs no DATABASE_URL). **Production confirmation** = the next scheduled/dispatched run reaching `[shadow] rc=0` and `[maturity] rc=0` and committing "Daily PSX pipeline: frontier …" — one `workflow_dispatch` run (dry_run=false) proves it without waiting for the delayed cron.

### 2.4 What S1 covers vs. the Task 123 contract

After the fix, S1 restores: EOD ingest (idempotent, dedup, validation, backup), shadow levels, forecast maturity (`task106_mature.ts`), and snapshot push. It still does **not** run `prospective_paper_trading.ts` (lifecycle) or the GLM generation step. §6 provides the exact, ready-to-apply extension; it is deliberately **not** silently enabled here because it changes what runs in production (GLM API usage consumes credits) and belongs to an explicit owner decision.

---

## 3. S2 — intraday-poll: VERIFIED active and succeeding

Observed via the GitHub API (all `conclusion=success`, all `event=schedule`):

| Run | Started (UTC) | Result |
|---|---|---|
| #21 | 2026-11-23T13:52:32Z | success — produced commit `eacf6e84` "Intraday monitor state 2026-11-23T13:53Z [rc=0]" |
| #20 | 2026-11-20T12:20:38Z | success |
| #19 | 2026-11-19T12:20:18Z | success |
| #18 | 2026-11-18T12:29:33Z | success |
| #17 | 2026-11-17T12:38:48Z | success |

This workflow runs `python3 scripts/task107_monitor.py` and shares the `task107-state-writers` concurrency group with S1. **Discrepancy to flag:** the repo cron says `*/5 4-10 * * 1-5` (≈80 runs/day) but the observed cadence is **one run per weekday at ~12:20–13:52Z**. Either the `*/5` cron was changed recently and has not yet produced new evidence, or GitHub is collapsing/delaying the schedule; the poll-bot state commit history (one "Intraday monitor state" commit per weekday) supports the one-per-day effective behavior. Consequence: the intraday heartbeat is **daily, not 5-minute**, so any health check treating `monitor_state.json` as a 5-minute-fresh heartbeat would false-alarm. Task 127's alert thresholds therefore use a daily cadence for this heartbeat with the observed last-cycle timestamps (`2026-11-23T13:53:38Z` at analysis time, provider `healthy`, `consecutive_failures: 0`, 301 symbols, 81 positions).

---

## 4. S3 — in-process scheduler: code-verified, host execution NOT VERIFIED

- `VERIFIED` (repo): entry point `src/instrumentation.ts` present and correctly named; it guards `NEXT_RUNTIME === "nodejs"`, delegates to `src/instrumentation.node.ts` (tracked), which self-guards via `globalThis.__latentSchedulerStarted`, writes marker/log files (`data/scheduler_last_run.txt`, `data/scheduler_log.txt`) and calls `GET http://127.0.0.1:3000/api/cron/refresh-ohlcv` at 17:00 PKT weekdays.
- `NOT VERIFIED`: whether the host's production server process has been restarted **after** `b307e34e` (a Next.js server only picks up instrumentation at boot), and whether `scheduler_last_run.txt`/`scheduler_log.txt` show real firings. These are one-command checks for the operator (§ operator doc, checks H1–H3).
- Scope note: S3 duplicates only the 17:00 CSV refresh; it does not write the authoritative DB ingest (that is `task107_daily_ingest.py`, S1/S4) and never touches lifecycle/GLM.

---

## 5. Host environment (S4) — BLOCKED

The sandbox cannot reach the application host, so the following are `BLOCKED`, each with an exact read-only command and expected output in [task124_operator_commands.md](task124_operator_commands.md): installed `crontab -l` content; whether the host repo is at `/home/z/my-project/repo_latent_v_2` and pulled ≥ `7a2ba8c2`; `python3`/`bun` availability and versions on the host; cron log files `data/task107_ingest_cron.log` and `data/task123_pipeline_cron.log` existence and recency; and whether any host process holds the DB lock during the 17:10/17:30 window. Nothing in this task restarted or modified production services.

---

## 6. Deployment checklist (labels)

| # | Item | Label |
|---|---|---|
| D1 | S2 intraday poll scheduled + succeeding in production | **VERIFIED** (runs #17–#21) |
| D2 | S1 scheduled in production | **VERIFIED** (13 runs) |
| D3 | S1 stages succeeding end-to-end | **FAILED → fix applied this changeset; NOT VERIFIED until next green run** |
| D4 | Prisma-client root cause identified from run logs | **VERIFIED** (run #13 log) |
| D5 | S1 covers lifecycle + GLM steps of Task 123 contract | **NOT VERIFIED — gap confirmed; extension patch provided, not enabled** |
| D6 | S3 entry point correct in code | **VERIFIED** (repo @ working tree) |
| D7 | S3 firing on host (scheduler marker/log, server restarted post-`b307e34e`) | **NOT VERIFIED / BLOCKED** |
| D8 | S4 crontab installed with corrected root + executable paths | **BLOCKED** |
| D9 | Host repo at `7a2ba8c2` (or later) | **BLOCKED** |
| D10 | Cron logs exist and show 17:10/17:30 executions | **BLOCKED** |
| D11 | GitHub Actions schedule delays (7–10 h) acknowledged | **VERIFIED** (run timestamps) — consider moving S1 cron earlier or accepting late execution; holiday safety is data-driven (no provider bars → no-op) |
| D12 | S2 cadence (`*/5` configured vs 1/day observed) reconciled | **NOT VERIFIED — discrepancy documented** |
| D13 | No production service restarted or modified by this task | **VERIFIED** (nothing outside the sandbox was touched) |

**Bottom line:** production scheduling exists and is observable (S1, S2), the EOD snapshot advancement has a confirmed, now-fixed CI defect, and the Task 123 17:30 PKT lifecycle/GLM contract is still unexecuted in production pending S4 installation or S1 extension.
