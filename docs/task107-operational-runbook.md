# Task 107 — Operational Runbook

## Processes

| Job | Command | Cadence |
|---|---|---|
| Snapshot poll + monitor + EOD | `python3 scripts/task107_monitor.py` | ≤120s inside 09:45–15:45 PKT (manual/CI now) |
| Daily pipeline | `python3 scripts/task107_runner.py pipeline` | after session close (workflow ready) |
| Maturity recompute | `python3 scripts/task107_maturity.py` | after new daily bars |
| Delay verification | `python3 scripts/task107_delay_verify.py` | on demand |

## Scheduler (deployment-ready, NOT verified active)

- `.github/workflows/daily-psx-pipeline.yml` — weekdays 11:30 UTC.
- `.github/workflows/intraday-poll.yml` — `*/15` during 04:45–10:45 UTC (feed window), idempotent price-change polling, concurrency lock, 6-min timeout.
- Owner steps: push to `main` → enable Actions → one `workflow_dispatch` run → verify the run ID. Only then call scheduling **active**.
- Note: GitHub Actions' minimum practical cron is 5–15 min; true 60–120s polling needs an always-on host (documented as a deployment option, not claimed).

## Failure recovery

| Symptom | Action |
|---|---|
| Provider 404/timeout for a symbol | recorded per-symbol; positions show `pending_data`; next cycle retries automatically |
| Lock refused (exit 3) | wait for the holder or clear stale `ops/*.lock` (>1 h) |
| No new snapshots for hours in-window | check `task107_provider_health.json`; probe `/quote` manually |
| Env lost (recycle) | `.env` → `DATABASE_URL="file:/home/z/my-project/db/custom.db"`; `bun install` |
| EOD marked `eod_partial`/`eod_missing` | rerun the monitor after 15:45 PKT; check `task107_final_delayed_update.json` |

## Health

`task107_operational_health.json` (provider, snapshot store, engines, DB, API, UI, policy) + `/api/data-readiness` for data freshness.
