# Task 107 — Scheduler Deployment

**Status: DEPLOYMENT-READY, NOT verified in production scheduling.**
`.github/workflows/daily-psx-pipeline.yml` runs weekdays 11:30 UTC (after 15:30 PKT close) with
`workflow_dispatch` (dry-run input), a 15-minute timeout, a concurrency group, artifact upload,
and visible failure when configuration is absent. Holidays are handled by DATA (no provider bars
→ no-op success), never by calendar assumptions.

## Why this design

The database is the repository (`db/custom.db.gz`), and the provider is key-free — so Actions can
checkout → restore DB → run the pipeline → commit the advanced snapshot. **No secrets are
required** (`permissions: contents: write` + `github.token`). No credentials appear in workflow
source; no DB backups or credential files are placed in artifacts.

## Owner activation checklist

1. Push this branch to `main` and confirm Actions are enabled.
2. Run `workflow_dispatch` once with dry_run=true, once with false.
3. Wait for the first scheduled run; verify the run ID and committed frontier.
4. Only then may scheduling be reported as **active**.

## Failure handling

Provider down → exit 4, checkpointed, rerunnable · Import validation failure → bars rejected
explicitly, fix + rerun · Push conflicts → pipeline reports are still uploaded as artifacts.
