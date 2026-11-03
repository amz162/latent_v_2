# Task 108 — Production Scheduler

## What runs where

| Layer | Mechanism | Cadence | Status |
|---|---|---|---|
| **Primary polling** | always-on host worker `scripts/task108_worker.py` | 120 s (env `TASK108_POLL_INTERVAL_SECONDS`) | **active** (heartbeat `ops/worker_health.json`) |
| **Fallback polling** | `intraday-poll.yml` (GitHub Actions) | */5 min inside 04:00–10:59 UTC | **verified** — first success run 41678403599 |
| **Daily pipeline** | `daily-psx-pipeline.yml` | 11:30 UTC weekdays | scheduled; code path shared with the verified engine |

## Key properties

- The worker polls **only** inside the delayed-feed window (09:45–15:45 PKT); pre-window idles to 09:45, post-window runs one EOD reconciliation then idles; weekends/holidays are data-decided (unchanged quotes ⇒ no-op; **no invented holiday calendar**).
- Each new observation is processed **immediately on arrival** — the application adds **no extra 15-minute wait** on top of the provider delay. Poll interval and provider delay are separate, clearly distinct concepts.
- Duplicate workers are refused via `ops/task108_worker.lock` (heartbeat-stale guarded); SIGTERM/SIGINT finish the current cycle and release the lock.
- Actual spacing between poll attempts is recorded per cycle (`cycle_latency`) because **Actions cron is not exact**; the job summary displays it.
- The 15-minute Actions cadence of Task 107 was **retired** — a 15-minute workflow is not equivalent to 120-second continuous polling.

## Verification (real, not claimed)

Six real `workflow_dispatch` runs were executed on 2026-11-03. Five failed for genuine
first-run defects (missing runner Python deps, pip-cache pattern, hardcoded ROOT paths,
missing bun for the V2 cost engine, dirty-tree rebase) — every failure was **visible**
(exit 4, red run, summary refused to fake success) and was root-caused and fixed.
Run **41678403599** then completed **success** end-to-end on HEAD `ffaab3f8`: monitor cycle
(`success_no_change`, structural HASCOL gap excluded), job summary, snapshot-store artifact
upload, and a state commit (`019fd992`) pushed by the workflow itself.

## Operations runbook

```bash
# health
cat data/backtest_reports/task107/ops/worker_health.json
python3 scripts/task108_worker.py --status

# start / restart
nohup python3 scripts/task108_worker.py > logs/task108_worker.log 2>&1 &

# single gated cycle (CI/tests)
python3 scripts/task108_worker.py --once

# manual fallback trigger
gh workflow run intraday-poll.yml --ref main   # (or Actions UI → Run workflow)
```

Exit semantics of the engine (Phase 4): `0` success (updates or no-op) · `2` degraded_provider
(green run + `::warning::` + degraded summary — retryable, never a fake refresh) · `3`
configuration · `4` internal · `5` data-integrity (quarantined) — the latter three fail red.
