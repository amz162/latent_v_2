#!/bin/bash
# ohlcv-refresh-and-process.sh — Task 97 Section 7 monitoring hook.
# Runs the REAL OHLCV refresh, then the prospective processor on whatever the
# refresh genuinely delivered (no fabricated sessions), then writes a
# monitoring report. Idempotent: the processor refuses duplicate fills and
# re-running on the same session changes nothing.
set -uo pipefail
cd /home/z/my-project
LOG=/home/z/my-project/data/backtest_reports/task97/batch_logs/monitoring-hook.log
ts() { date -Iseconds; }
echo "[$(ts)] refresh start" >> "$LOG"

# 1. Real incremental OHLCV refresh (existing project procedure)
if [ -f scripts/task95_ingest_ohlcv.ts ]; then
  bun scripts/task95_ingest_ohlcv.ts >> "$LOG" 2>&1 || echo "[$(ts)] WARN refresh rc!=0" >> "$LOG"
fi

# 2. Prospective processor on the refreshed data
bun scripts/prospective_paper_trading.ts >> "$LOG" 2>&1   || echo "[$(ts)] WARN processor rc!=0" >> "$LOG"

# 3. Monitoring snapshot (state counts + latest session)
bun -e '
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const byState = await db.prospectivePaperTrade.groupBy({ by: ["state"], _count: true });
const latest = await db.ohlcvBar.aggregate({ _max: { date: true } });
const fs = await import("fs");
fs.writeFileSync("data/backtest_reports/task97/batch_logs/monitoring-latest.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  states: Object.fromEntries(byState.map(s => [s.state, s._count])),
  latestOhlcvSession: latest._max.date,
}, null, 1));
await db.$disconnect();
' >> "$LOG" 2>&1 || echo "[$(ts)] WARN snapshot rc!=0" >> "$LOG"
echo "[$(ts)] hook complete" >> "$LOG"
