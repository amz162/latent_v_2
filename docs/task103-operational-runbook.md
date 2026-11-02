# Task 103 — Operational Runbook

Operations, monitoring and recovery for the Latent.pk data pipeline.

## 1. Environment bring-up (fresh sandbox / new host)

```bash
git clone https://github.com/amz162/latent_v_2.git && cd latent_v_2
printf 'DATABASE_URL="file:%s/db/custom.db"\n' "$PWD" > .env   # .env is gitignored
bash db/restore-db.sh          # gunzip 48MB backup → 193MB SQLite
bun install && bunx prisma generate
bun run dev                    # dev server on :3000 (dev.log)
python3 scripts/task103_runner.py --phase all --resume
```

## 2. Scheduled ingestion on a deployment host

The Task 103 sandbox has **no deployment credentials**, so no recurring service is claimed to run here — the implementation and exact configuration are what ship:

- **Cron (VPS):** run `python3 scripts/task103_runner.py --phase market_audit --resume && python3 scripts/task103_runner.py --phase ops --resume` after each EOD feed import, e.g. `30 18 * * 1-5` Asia/Karachi. Every run appends a job record (run_id, start/finish, source, row counters, failure reason, checkpoint, duration, last successful run) to `data/backtest_reports/task103/task103_pipeline_runs.json`; idempotent checkpoints make re-runs safe.
- **In-app cron endpoints:** `/api/cron/*` routes are guarded by `CRON_SECRET` (set in `.env`); `/api/data-readiness` is the health surface.
- **Vercel/ hosted cron:** point the scheduler at `/api/cron` with the `Authorization: Bearer $CRON_SECRET` header after each PSX session.

## 3. Health checks (per the Task 103 spec)

`GET /api/data-readiness` reports: last successful market-data refresh, latest verified trading date, KSE-100 / fundamentals / filings / corporate-actions / intraday freshness, source failures, and feature availability. `unknown` and `unavailable` are explicit states. Additionally check:

- DB availability — `sqlite3 db/custom.db 'SELECT MAX(date) FROM OhlcvBar'`
- Cost-parity drift — `bun scripts/task103_parity.ts` (33 fixtures must pass)
- Full QA — `python3 scripts/task103_tests.py`
- Paper-trading duplicates — count of `ProspectivePaperTrade` must equal the frozen fingerprint in `task103_paper_trading_integrity.json`

## 4. Recovery procedures

| Symptom | Action |
| --- | --- |
| Dev server down / OOM | `pkill -f "next dev"`; `NODE_OPTIONS=--max-old-space-size=1024 bun run dev` |
| DB corrupted | re-clone or restore `gunzip -kf db/custom.db.gz`; re-run import promotion from staging manifests |
| Import rejected | read `rejected_sample` reasons in the CLI output / manifest; fix the CSV; re-run `--validate` |
| Partial phase run | `--resume` skips completed phases, retries the failed one (no repeated expensive work) |
| Provider outage | statuses stay explicit in `/api/data-readiness`; never fall back silently to proxy/synthetic data |

## 5. Security posture

- `.env` gitignored and never staged; credentials only via environment variables.
- Historical `.env` exposure in git history: treated as exposed; **owner must rotate** any credential that ever appeared (sandbox cannot verify rotation). Never rewrite history or force-push to hide it.
- Licensed/sourced data files stay out of the public repo (drop them under `data/external_imports/` locally only).
- Auth-gated endpoints: cron (`CRON_SECRET`), precompute (`PRECOMPUTE_KEY`), prediction ingest (`PREDICTION_INGEST_TOKEN`). No raw exception details are returned to clients.

## 6. Audit trail

- Phase status: `data/backtest_reports/task103/task103_progress.json`
- Job records: `task103_pipeline_runs.json`
- Import lineage: `task103/import_manifests/*.json` + staging `imports` table
- Change discipline: Task 100/101/102 artifacts are frozen; `git status` on those directories must stay empty (checked by `task103_tests.py`).
