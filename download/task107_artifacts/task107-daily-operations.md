# Task 107 — Daily Operations

## The pipeline

`python3 scripts/task107_runner.py pipeline` runs four idempotent stages in order:
**ingest** (fetch → validate → Task 103 controlled drop → promote with dedup → frontier refresh)
→ **shadow** (frozen-protocol decisions at the current frontier, one per symbol/session)
→ **maturity** (production engine resolution of pending observations; MTM kept separate)
→ **reports** (evidence, health, alerts).

Each stage is safe to run alone (`task107_runner.py ingest|shadow|maturity|reports`), skips itself
when there is nothing new (exit code 2), uses a lockfile against duplicate runs, and appends to
`data/backtest_reports/task107/ops/checkpoints.json` + `run_log.jsonl`.

## Data frontier

Verified 2026-11-03 (pilot-25 universe — NOT full-market coverage). Freshness per symbol:
`task107_symbol_freshness.csv`. Provider: the app's approved free `psxdata` API (no key).

## Recovery

| Symptom | Action |
| --- | --- |
| `failed_provider_unavailable` | check network; rerun later (checkpointed) |
| lock refused (exit 3) | another run holds the lock; wait 1 h or clear `ops/*.lock` if stale |
| .env lost | recreate `DATABASE_URL="file:/home/z/my-project/db/custom.db"` |
| node_modules missing | `bun install` |
