#!/bin/bash
# Task 28-A — LLM enrichment retry loop.
# Keeps re-running the pattern-cache LLM enrichment until every row has a
# summary. Each run resumes where the last one stopped (rows that already
# have summaries are skipped). When the ZAI endpoint rate-limits the run into
# exhaustion the script exits non-zero and this loop waits 20 minutes before
# retrying — quota windows recover, and progress is never lost.
cd /home/z/my-project
while true; do
  bun run scripts/precompute_all_pattern_caches.ts --phase llm --concurrency 1 --delay 4 >> .zscripts/llm-enrich.log 2>&1
  code=$?
  if [ "$code" -eq 0 ]; then
    echo "[loop] enrichment finished cleanly — $(date)" >> .zscripts/llm-enrich.log
    exit 0
  fi
  echo "[loop] enrichment exited $code — sleeping 20min before retry — $(date)" >> .zscripts/llm-enrich.log
  sleep 1200
done
