#!/bin/bash
# ============================================================================
# Task 129 — host post-market pipeline wrapper (the AUTHORITATIVE production
# executor for the daily EOD pipeline).
#
# One entry, one schedule, no duplicate executors:
#   - internally: fetch → validate → persist → integrity → indicators →
#     results patterns → maturity → lifecycle → Model M cache → monitoring
#     (scripts/task129_eod_scheduler.py)
#   - then (host-only, needs z-ai SDK credentials): GLM-4.6 research
#     generation for the 24-symbol research universe
#
# Replaces BOTH the old 17:10 task107_daily_ingest cron entry (subsumed — the
# scheduler performs the authoritative DB ingest) and the old 17:30
# task123_daily_pipeline.sh entry (subsumed — its steps are scheduler stages).
# The GitHub Actions daily pipeline keeps running as the CI-level automation;
# double execution across CI + host is prevented by the SchedulerRun runKey
# idempotency (jobName:session) and INSERT OR IGNORE persistence.
#
# Schedule: 17:30 PKT Mon-Fri (see scripts/crontab.txt). Holidays are decided
# by provider data at run time, never assumed.
# ============================================================================
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPS="data/backtest_reports/task129/scheduler/ops"
mkdir -p "$OPS"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$OPS/pipeline_$STAMP.log"
GLM_SYMBOLS="ANL,BOP,CNERGY,ENGRO,FCCL,HASCOL,HUBC,HUMNL,KEL,LOTCHEM,LUCK,MEBL,MLCF,OGDC,PAEL,PIBTL,PPL,PRL,PSO,SYS,TELE,TRG,UNITY,WTL"

echo "[task129_pipeline] start $STAMP root=$ROOT" >> "$LOG"

echo "── step 1: EOD scheduler (fetch/persist/integrity/downstream)" >> "$LOG"
python3 scripts/task129_eod_scheduler.py run --trigger cron >> "$LOG" 2>&1
EOD_RC=$?
echo "step1 eod_scheduler rc=$EOD_RC (0=ok 2=retryable-eod-not-published 3=lock 1=partial)" >> "$LOG"

if [ "$EOD_RC" = "2" ]; then
  # EOD not published yet — bounded in-place retry window (config-driven)
  RETRY_INTERVAL="${EOD_RETRY_INTERVAL_MIN:-15}"
  MAX_WINDOW="${EOD_MAX_RETRY_WINDOW_MIN:-120}"
  DEADLINE=$(( $(date +%s) + MAX_WINDOW * 60 ))
  while [ "$(date +%s)" -lt "$DEADLINE" ]; do
    sleep "$(( RETRY_INTERVAL * 60 ))"
    echo "── retry: eod scheduler" >> "$LOG"
    python3 scripts/task129_eod_scheduler.py run --trigger retry >> "$LOG" 2>&1
    EOD_RC=$?
    echo "retry rc=$EOD_RC" >> "$LOG"
    [ "$EOD_RC" != "2" ] && break
  done
fi

echo "── step 2: GLM-4.6 research generation (host-only, research-only)" >> "$LOG"
if command -v bun >/dev/null 2>&1; then
  LLM_SIGNAL_HISTORY_DIR="${LLM_SIGNAL_HISTORY_DIR:-$ROOT/data/backtest_reports/task112/llm_signal_history}" \
  LLM_EVIDENCE_DIR="${LLM_EVIDENCE_DIR:-$ROOT/data/backtest_reports/task112/llm_evidence_packages}" \
  bun scripts/task111_llm_runner.ts --symbols "$GLM_SYMBOLS" >> "$LOG" 2>&1
  echo "step2 glm rc=$?" >> "$LOG"
else
  echo "step2 SKIPPED: bun not available" >> "$LOG"
fi

echo "── step 3: scheduler status snapshot" >> "$LOG"
python3 scripts/task129_eod_scheduler.py status > data/backtest_reports/task129/scheduler/ops/status_latest.json 2>&1

echo "[task129_pipeline] done $(date -u +%Y-%m-%dT%H:%M:%SZ) final_eod_rc=$EOD_RC" >> "$LOG"
tail -5 "$LOG"
# Exit honestly: 0 only when the EOD pipeline itself completed/partially completed.
if [ "$EOD_RC" = "0" ] || [ "$EOD_RC" = "1" ]; then exit 0; else exit "$EOD_RC"; fi
