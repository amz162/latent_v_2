#!/bin/bash
# ============================================================================
# Task 123 — daily production pipeline (idempotent, resumable, honest failures)
#
# Chains, in order (each step is safe to re-run — no duplicate bars, fills or
# GLM decisions can be produced):
#   1. EOD OHLCV ingest (task107_daily_ingest.py — pilot-25, (symbol,date) dedup,
#      validation + revision quarantine + automatic pre-promotion backup)
#   2. Prospective paper-trading lifecycle (fills at next-session open, SL/TP/
#      timeout exits, forecast-outcome maturation, book reconciliation)
#   3. GLM-4.6 research generation (append-only store, evidence packages with
#      per-source refs, research_only by construction; provider failure is
#      recorded as llm_unavailable — never fabricated)
#   4. Pending-outcome tracker refresh
#   5. Pipeline health snapshot (reports/operations/task123_pipeline_health.json)
#
# Schedule contract (see scripts/crontab.txt): 17:30 PKT Mon-Fri, after the
# 17:00 PKT market-data refresh. Install with: crontab scripts/crontab.txt
# ============================================================================
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# GLM-4.6 research universe (pilot-25 shadow universe; ENGRO/SYS may be
# stale-skipped by the freshness gate when the provider has no recent bars).
GLM_SYMBOLS="ANL,BOP,CNERGY,ENGRO,FCCL,HASCOL,HUBC,HUMNL,KEL,LOTCHEM,LUCK,MEBL,MLCF,OGDC,PAEL,PIBTL,PPL,PRL,PSO,SYS,TELE,TRG,UNITY,WTL"

OPS="data/backtest_reports/task123/ops"
mkdir -p "$OPS"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="$OPS/pipeline_$STAMP.log"

echo "[task123_pipeline] start $STAMP root=$ROOT" >> "$LOG"

echo "── step 1: EOD ingest" >> "$LOG"
python3 scripts/task107_daily_ingest.py >> "$LOG" 2>&1
INGEST_RC=$?
echo "step1 ingest rc=$INGEST_RC (0=ok 2=nothing-to-do 3=lock 4=provider/validation)" >> "$LOG"

echo "── step 2: prospective lifecycle" >> "$LOG"
if command -v bun >/dev/null 2>&1; then
  bun scripts/prospective_paper_trading.ts >> "$LOG" 2>&1
  echo "step2 lifecycle rc=$?" >> "$LOG"
  echo "── step 3: GLM-4.6 research generation" >> "$LOG"
  LLM_SIGNAL_HISTORY_DIR="${LLM_SIGNAL_HISTORY_DIR:-$ROOT/data/backtest_reports/task112/llm_signal_history}" \
  LLM_EVIDENCE_DIR="${LLM_EVIDENCE_DIR:-$ROOT/data/backtest_reports/task112/llm_evidence_packages}" \
  bun scripts/task111_llm_runner.ts --symbols "$GLM_SYMBOLS" >> "$LOG" 2>&1
  echo "step3 glm rc=$?" >> "$LOG"
else
  echo "step2/3 SKIPPED: bun not available on this host" >> "$LOG"
fi

echo "── step 4: pending-outcome tracker refresh" >> "$LOG"
python3 scripts/task112_build_report.py >> "$LOG" 2>&1
echo "step4 outcomes rc=$?" >> "$LOG"

echo "── step 5: pipeline health snapshot" >> "$LOG"
python3 scripts/task123_health.py >> "$LOG" 2>&1
echo "step5 health rc=$?" >> "$LOG"

echo "[task123_pipeline] done $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"
tail -5 "$LOG"
