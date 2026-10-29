/**
 * Task 77 — Prospective Paper-Trading Workflow (Phases 3+4 wired).
 *
 * Previously (Task 66/76) this wrote a static report with paper_trades:{open:0,
 * closed:0,skipped:0} + zero P&L — no real lifecycle. Now it delegates to the
 * real lifecycle service (src/lib/latent/prospective-lifecycle.ts) which:
 *   - creates idempotent trade records for eligible BUY predictions × 3 strategies
 *   - enters at the next-session open (or stays pending_entry if it hasn't occurred)
 *   - advances open positions through new OHLCV bars via the strategy engine
 *   - closes on SL/TP3/scale-out/timeout + records exit legs
 *   - matures forecast outcomes once the horizon target session close exists
 *   - reconciles counts/cash/P&L from the AUTHORITATIVE database
 *
 * Run: bun scripts/prospective_paper_trading.ts
 * Output: data/backtest_reports/prospective_paper_trading_latest.json
 */
import { runLifecycle } from "@/lib/latent/prospective-lifecycle";
import * as fs from "fs";

const OUTPUT_PATH = "data/backtest_reports/prospective_paper_trading_latest.json";

async function main() {
  console.log("=".repeat(60));
  console.log("Task 77 — Prospective Paper-Trading Lifecycle");
  console.log("=".repeat(60));

  const result = await runLifecycle();

  console.log(`\nstatus: ${result.status}`);
  console.log(`blockReason: ${result.blockReason ?? "none"}`);
  console.log(`latestOhlcv: ${result.latestOhlcv}`);
  console.log(`freshness.fresh: ${result.freshness.fresh} (latest=${result.freshness.latestDbDate})`);
  console.log(`inference.available: ${result.inference.available}`);
  console.log(`\ncounts:`);
  console.log(`  predictions: ${result.counts.predictionsTotal} (BUY=${result.counts.buyPredictions}, withRiskLevels=${result.counts.buyPredictionsWithRiskLevels})`);
  console.log(`  trades: ${result.counts.tradesTotal} (pending_entry=${result.counts.tradesByState.pending_entry} open=${result.counts.tradesByState.open} closed=${result.counts.tradesByState.closed} skipped=${result.counts.tradesByState.skipped})`);
  console.log(`  trades by strategy: ${JSON.stringify(result.counts.tradesByStrategy)}`);
  console.log(`  outcomes: ${result.counts.outcomesTotal} (pending=${result.counts.outcomesByStatus.pending} matured=${result.counts.outcomesByStatus.matured} unavailable=${result.counts.outcomesByStatus.unavailable})`);
  console.log(`  legs: ${result.counts.legsTotal}`);
  console.log(`\nrunStats: tradesCreated=${result.runStats.tradesCreated} entered=${result.runStats.tradesEntered} closed=${result.runStats.tradesClosed} outcomesCreated=${result.runStats.outcomesCreated} outcomesMatured=${result.runStats.outcomesMatured}`);
  console.log(`\nbooks: ${result.books.length}`);
  for (const b of result.books.slice(0, 12)) {
    console.log(`  ${b.bookId}: open=${b.positions} closed=${b.closed} cash=${b.cash.toFixed(0)} realized=${b.realizedNetPnl.toFixed(0)}`);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\n✓ Report written: ${OUTPUT_PATH}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
