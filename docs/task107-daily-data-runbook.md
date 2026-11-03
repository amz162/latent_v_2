# Task 107 — Daily Data Runbook

## Automatic (once the workflow is activated)

GitHub Actions runs `scripts/task107_runner.py pipeline` after each session. It decides whether a
session exists from provider data, validates overlap byte-equality against verified history,
quarantines any provider revision of a verified bar (never auto-applies), imports via the Task 103
controlled drop (SHA-256 manifest), promotes with `(symbol,date)` dedup after a DB backup
(local-only), and refreshes `/api/data-readiness` freshness.

## Manual

```
python3 scripts/task107_daily_ingest.py            # full run
python3 scripts/task107_daily_ingest.py --dry-run  # fetch/validate only
python3 scripts/task107_daily_ingest.py --end 2026-11-03
```

## Invariants enforced

- OHLC envelope, positivity, zero-volume flags; duplicate (symbol,date) rejected.
- Overlap mismatch ⇒ quarantine + review file in `ops/revisions/`, frontier NOT advanced by that bar.
- Coverage is pilot-25 only; full-market claims are forbidden.
- Provider errors recorded per symbol; no fabricated sessions ever.
