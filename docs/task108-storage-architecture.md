# Task 108 — Storage Architecture

## Principle

**Git is not the high-frequency runtime database.** The runtime store is SQLite on the
deployed host, shared by the monitoring worker (writer) and the website API (reader).

| Store | Path | Size | Mode | Backup |
|---|---|---|---|---|
| Delayed snapshots | `data/external_imports/psx_eod/task107_snapshots.db` | ~200 KB (grows with observations) | WAL, busy_timeout 5 s, integrity ok | Actions artifact per fallback run (30 d) + one consolidated commit per day |
| Daily OHLCV DB | `db/custom.db` | ~192 MB | readers readonly | `db/custom.db.gz` in git (daily pipeline, 40 MB) |
| Monitor state | `task107/ops/*.json` | KB-scale | rewritten per cycle | committed by fallback runs (small) |

## Writer/reader topology

```
PSX provider → host worker (120 s) ─┐
                                    ├→ task107_snapshots.db (WAL) → Next.js monitor API → UI
Actions fallback (*/5, artifact)  ──┘        ▲
Daily pipeline (11:30 UTC) ── one daily gz + snapshot commit → git
```

Worker and website access the **same durable state** — there are no disconnected stores.
Both Actions writers share one concurrency group (`task107-state-writers`), so git-backed
mutations are serialized; pushes are commit-then-push with no force and no discard.

## Growth & retention

Worst case ≈ 4,500 snapshot rows/day (25 symbols × 6-h window at 120 s); price-change
idempotency typically reduces this to hundreds. Git receives **no** intraday SQLite —
the Task 107 pattern of committing a growing SQLite every 15 minutes was removed; the
snapshot store travels between fallback runs as an Actions artifact and reaches git once
per day via the pipeline.

## Constraints (honest)

- The workspace filesystem is the production persistent layer. It survives sandbox
  recycles via the infra backup (proven during this task: the entire workspace was
  restored from `/tmp/my-project`), but it is not an SLA-backed volume. The daily git
  commit is the durability floor. Moving the runtime store to a managed volume/DB is an
  owner option, not required for correctness.
