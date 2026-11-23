# Task 124 — Operator Commands (read-only) & Deployment Checklist

Every command below is **read-only** unless explicitly marked `[WRITE]`. Run them on the application host as the user that owns `/home/z/my-project/repo_latent_v_2`. Nothing here restarts services or changes production state. For each check: **expected output**, then **how to interpret failure**.

## 1. Host crontab (S4) — is the Task 123 contract installed?

```bash
crontab -l | sed -n '20,35p'
```
**Expected:** five entries, all with `cd /home/z/my-project/repo_latent_v_2 &&`, i.e. `0 12 * * 1-5 ... update_daily_ohlcv.py`, `10 12 * * 1-5 ... task107_daily_ingest.py >> .../data/task107_ingest_cron.log 2>&1`, `30 12 * * 1-5 ... bash scripts/task123_daily_pipeline.sh >> .../data/task123_pipeline_cron.log 2>&1`, the 04:00 UTC KSE100 warm-up, and the Sunday full refresh.
**Failure:** `no crontab for <user>` → S4 not installed; the 17:30 PKT lifecycle/GLM contract is unexecuted (matches today's verified state). Old paths `/home/z/my-project &&` without `repo_latent_v_2` → the **stale** pre-Task-123 crontab is installed; replace with `crontab scripts/crontab.txt` `[WRITE]` from the repo root.

## 2. Host repo version & runtimes

```bash
git -C /home/z/my-project/repo_latent_v_2 log --oneline -1
python3 --version; command -v bun && bun --version || echo "BUN MISSING"
```
**Expected:** commit ≥ the Task 124 changeset (contains `7a2ba8c2` + prisma-generate workflow fix); python3 ≥ 3.10; bun present.
**Failure:** commit behind `7a2ba8c2` → host never pulled the Task 123 repairs (`git -C ... pull --ff-only` `[WRITE]`). `BUN MISSING` → pipeline steps 2–3 are skipped by design (`task123_daily_pipeline.sh` logs "SKIPPED: bun not available") — install bun or rely on the Actions S1 path.

## 3. Cron execution evidence (actual start/end, exit codes)

```bash
tail -20 /home/z/my-project/repo_latent_v_2/data/task107_ingest_cron.log
tail -30 /home/z/my-project/repo_latent_v_2/data/task123_pipeline_cron.log
ls -lt /home/z/my-project/repo_latent_v_2/data/backtest_reports/task123/ops/ | head -5
```
**Expected:** ingest log lines ending `rc=0` or `rc=2` (2 = nothing-to-do, normal on holidays); pipeline log lines `[task123_pipeline] start ...` / `done ...` with `step1 ingest rc=…`, `step2 lifecycle rc=…`, `step3 glm rc=…`, `step4 outcomes rc=…`, `step5 health rc=…`; the newest `pipeline_<stamp>.log` less than 24 h old on weekdays.
**Interpretation:** missing files → S4 never ran. `step2/3 SKIPPED: bun not available` → runtime gap (§2). `rc=4` → provider/validation failure; rerun is safe (all steps idempotent). `rc=3` → lock contention (another process held the DB).

## 4. In-process scheduler (S3) — did the 5 PM PKT hook ever fire?

```bash
cat /home/z/my-project/repo_latent_v_2/data/scheduler_last_run.txt 2>/dev/null
tail -20 /home/z/my-project/repo_latent_v_2/data/scheduler_log.txt 2>/dev/null
ps aux | grep -E "next start|next-server" | grep -v grep
```
**Expected:** a marker line with a recent weekday 17:0x PKT timestamp; scheduler log lines `[latent-scheduler] ... starting → python3 .../daily_5pm_update.py` and `done`; a long-running `next start` process whose start time is **after** 2026-11-23T00:47Z (commit `b307e34e` — Next.js loads instrumentation only at boot).
**Failure:** marker absent → server predates the fix (restart required `[WRITE]`, owner decision) or OPEN_RUNTIME is edge. Process older than the fix → instrumentation never loaded in this process.

## 5. GitHub Actions (S1/S2) — verifiable from anywhere

```bash
gh run list --repo amz162/latent_v_2 --workflow daily-psx-pipeline.yml --limit 3
gh run view --repo amz162/latent_v_2 --job <job-id> --log | grep -E "rc=|error"
gh run list --repo amz162/latent_v_2 --workflow intraday-poll.yml --limit 3
```
**Expected (after this changeset is pushed + one `workflow_dispatch` dry_run=false run):** `completed success`, and stage lines `[shadow] rc=0`, `[maturity] rc=0`, then a commit "Daily PSX pipeline: frontier <date>".
**Interpretation:** `Cannot find module '.prisma/client/default'` again → the fix step didn't run (workflow not updated on the default branch). Failure only in commit/push step → concurrent writer race (concurrency group serializes; rerun). **This is the single command that converts Task 124's S1 fix from `NOT VERIFIED` to `VERIFIED`.**

### Optional S1 extension (owner decision) — adds the 17:30 PKT Task 123 contract to Actions

Insert after the "Run pipeline" step in `daily-psx-pipeline.yml` (`[WRITE]`, consumes GLM API credits on each run):

```yaml
      - name: Task 123 lifecycle + GLM research (research-only)
        run: |
          bash scripts/task123_daily_pipeline.sh
```

`task123_daily_pipeline.sh` is idempotent and records provider failures honestly (`llm_unavailable`); the commit step already stages `data/backtest_reports/task107`, `db/custom.db.gz` — extend its `git add` with `data/backtest_reports/task112 data/backtest_reports/task123 reports/operations` when enabling.

## 6. Data & heartbeat sanity (read-only)

```bash
sqlite3 /home/z/my-project/repo_latent_v_2/db/custom.db "SELECT MAX(date), COUNT(*) FROM OhlcvBar;"
python3 /home/z/my-project/repo_latent_v_2/scripts/task123_health.py
```
**Expected:** frontier = last completed PSX session (2026-11-24 after the next trading day once S1 is fixed); health JSON shows `worker.provider_health: healthy`, lifecycle states summing to the cohort, GLM `research_only_enforced: true`.
**Failure:** frontier > 2 sessions behind → S1/S4 both failing; see §3.

## 7. Deployment checklist (order matters)

1. `[WRITE]` Push the Task 124 changeset (owner authorization), then `gh workflow run daily-psx-pipeline.yml -f dry_run=false` once; verify §5 shows `[shadow] rc=0`, `[maturity] rc=0` and a frontier commit.
2. `[WRITE]` `crontab scripts/crontab.txt` from `/home/z/my-project/repo_latent_v_2` (S4). Verify §1 shows the corrected root; verify §3 logs appear after the next 17:10/17:30 PKT window.
3. `[WRITE]` Restart the production `next start` process so S3 (fixed 2026-11-23) is loaded; verify §4 marker after the next 17:00 PKT window.
4. Decide §5 extension (lifecycle+GLM in Actions) — needed until step 2 is proven.
5. Reconcile S2 cadence (`*/5` configured vs 1/day observed): check whether the cron was recently changed; if daily is intended, set the cron to `20 12 * * 1-5` so monitoring thresholds match reality.
