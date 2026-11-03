# Task 109 — Production Operations

## Topology

Single host: Caddy → localhost:3000 (Next.js) + `scripts/task108_worker.py`
(always-on monitor) → shared WAL SQLite (`db/custom.db` + `task107_snapshots.db`).
GitHub Actions runs the 5-minute intraday fallback, the daily consolidated
pipeline, Production Build and Browser Tests. Local workspace == `origin/main`.

## Verified this task (real evidence, not claims)

| Area | Evidence |
|---|---|
| Worker liveness | heartbeat `ops/worker_health.json`; process alive; pre-window idling correct |
| Duplicate-worker lock | **bug found & fixed**: age-based staleness admitted a second worker after 5 idle minutes; now refuses while the lock-holding **pid is alive**, steals locks left by dead pids |
| Graceful restart | SIGTERM → exit → lock released → new worker re-acquires; snapshot count unchanged (no duplicates) |
| Error injection | 8/8 cases (provider timeout, malformed response, DB busy, missing symbol, auth/config, network, quarantined observation) — all classified correctly, never masked as success |
| Monitor API | **store-first fix**: the API now serves the worker's durable snapshot prices (live provider fetch is fallback only — previously a provider rate-limit emptied the UI while the store held fresh prices); **hardcoded realized −102,348.02 removed** and recomputed from ledger outcomes at request time |
| Workflows | Intraday: 7 runs (2 success at final heads, 5 real visible failures). Daily: **0 runs** (first scheduled fire pending — reported honestly, YAML existence ≠ execution) |
| Concurrency | unified `task107-state-writers` group; no overlapping intraday runs; git-safety audit 0 violations (rebase replaced by ff-only sync + merge recovery) |
| QA suites | v2 29/29 · v1 rc 0 · tsc clean · YAML 4/4 · production build exit 0 · WAL interleaved writes ok · backup restore ok |
| Browser | 10/10 checks (desktop + mobile 390×844, delay banner, realized separation, legacy label, MTM card, generation badge in detail view, no console errors, no horizontal overflow) |

## Data flow (after this task's fix)

```
provider (delayed snapshots) ──► worker (120 s, window-gated)
                                   │ writes
                                   ▼
                    task107_snapshots.db (WAL) + ops/monitor_state.json
                                   │ reads                      │ reads
                                   ▼                            ▼
                     /api/paper-trading/monitor ◄── maturity ledger (_matured/_pending_ledger)
                                   │
                                   ▼
                        Paper Trade Monitor UI
```

The API prefers the worker's durable prices so the UI matches the durable state
even during provider degradation; per-request `generatedAt` and per-row
`dataSource` disclose which path served each price.

## Known limitations

- Single-host durability: daily consolidated git commit + artifact handoff is the
  floor; a managed volume remains optional and requires owner approval.
- The site currently runs `next dev` on the host; the production build is
  verified separately (exit 0). Switching to `next start` is a deployment
  hardening step for the owner.
- The daily pipeline has not fired yet; its first scheduled run is pending.
