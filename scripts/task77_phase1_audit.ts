/**
 * Task 77 — Phase 1 DB audit. Reports actual counts BEFORE any editing.
 * Run: bun scripts/task77_phase1_audit.ts
 */
import { PrismaClient } from "@prisma/client";
// Use a QUIET client (db.ts has log:['query'] which would flood output).
const db = new PrismaClient({ log: ["error"] });

async function main() {
  console.log("=" .repeat(70));
  console.log("Task 77 — Phase 1 Database Audit");
  console.log("=" .repeat(70));

  // ─── PredictionHistory ───────────────────────────────────────────────────
  const phTotal = await db.predictionHistory.count();
  const phPending = await db.predictionHistory.count({ where: { outcomeStatus: "pending" } });
  const phMatured = await db.predictionHistory.count({ where: { outcomeStatus: "matured" } });
  const phUnavail = await db.predictionHistory.count({ where: { outcomeStatus: "unavailable" } });
  const phByKind = await db.predictionHistory.groupBy({ by: ["kind"], _count: { _all: true } });
  const phBySignal = await db.predictionHistory.groupBy({ by: ["signal"], _count: { _all: true } });
  const phByModel = await db.predictionHistory.groupBy({ by: ["modelId"], _count: { _all: true } });
  const phByHorizon = await db.predictionHistory.groupBy({ by: ["horizon"], _count: { _all: true } });
  const phLatest = await db.predictionHistory.findFirst({ orderBy: { createdAt: "desc" } });
  const phEarliest = await db.predictionHistory.findFirst({ orderBy: { createdAt: "asc" } });
  const phCutoffs = await db.predictionHistory.findMany({ distinct: ["dataCutoff"], select: { dataCutoff: true }, orderBy: { dataCutoff: "asc" } });
  const phSymbols = await db.predictionHistory.groupBy({ by: ["symbol"], _count: { _all: true } });

  console.log("\n── PredictionHistory ──");
  console.log(`  total: ${phTotal}`);
  console.log(`  outcomeStatus: pending=${phPending} matured=${phMatured} unavailable=${phUnavail}`);
  console.log(`  by kind: ${JSON.stringify(phByKind.map(k => ({kind:k.kind,n:k._count._all})))}`);
  console.log(`  by signal: ${JSON.stringify(phBySignal.map(s => ({signal:s.signal,n:s._count._all})))}`);
  console.log(`  by model: ${JSON.stringify(phByModel.map(m => ({model:m.modelId,n:m._count._all})))}`);
  console.log(`  by horizon: ${JSON.stringify(phByHorizon.map(h => ({horizon:h.horizon,n:h._count._all})))}`);
  console.log(`  distinct dataCutoffs (${phCutoffs.length}): ${JSON.stringify(phCutoffs.map(c=>c.dataCutoff))}`);
  console.log(`  distinct symbols: ${phSymbols.length}`);
  console.log(`  earliest: ${phEarliest ? `${phEarliest.symbol} ${phEarliest.modelId} h=${phEarliest.horizon} cutoff=${phEarliest.dataCutoff} signal=${phEarliest.signal} created=${phEarliest.createdAt?.toISOString()}` : "none"}`);
  console.log(`  latest:   ${phLatest ? `${phLatest.symbol} ${phLatest.modelId} h=${phLatest.horizon} cutoff=${phLatest.dataCutoff} signal=${phLatest.signal} created=${phLatest.createdAt?.toISOString()}` : "none"}`);
  // Check: does PredictionHistory store SL/TP? (schema says NO — confirm)
  if (phLatest) {
    const raw: any = phLatest;
    console.log(`  latest fields has sl/tp1/tp2/tp3? sl=${raw.sl ?? "N/A"} tp1=${raw.tp1 ?? "N/A"} (expected: NOT on this model)`);
  }

  // ─── PredictionOutcome (Task 76) ────────────────────────────────────────
  console.log("\n── PredictionOutcome (Task 76) ──");
  try {
    const poTotal = await db.predictionOutcome.count();
    const poPending = await db.predictionOutcome.count({ where: { outcomeStatus: "pending" } });
    const poMatured = await db.predictionOutcome.count({ where: { outcomeStatus: "matured" } });
    const poUnavail = await db.predictionOutcome.count({ where: { outcomeStatus: "unavailable" } });
    console.log(`  total: ${poTotal}  pending=${poPending} matured=${poMatured} unavailable=${poUnavail}`);
  } catch (e: any) {
    console.log(`  TABLE ERROR: ${e.message.slice(0, 120)}`);
  }

  // ─── ProspectivePaperTrade (Task 76) ───────────────────────────────────
  console.log("\n── ProspectivePaperTrade (Task 76) ──");
  try {
    const pptTotal = await db.prospectivePaperTrade.count();
    const pptByState = await db.prospectivePaperTrade.groupBy({ by: ["state"], _count: { _all: true } });
    const pptByStrategy = await db.prospectivePaperTrade.groupBy({ by: ["strategyId"], _count: { _all: true } });
    const pptDemo = await db.prospectivePaperTrade.count({ where: { isDemo: true } });
    const pptGenuine = pptTotal - pptDemo;
    console.log(`  total: ${pptTotal}  genuine=${pptGenuine} demo=${pptDemo}`);
    console.log(`  by state: ${JSON.stringify(pptByState.map(s => ({state:s.state,n:s._count._all})))}`);
    console.log(`  by strategy: ${JSON.stringify(pptByStrategy.map(s => ({strategy:s.strategyId,n:s._count._all})))}`);
  } catch (e: any) {
    console.log(`  TABLE ERROR: ${e.message.slice(0, 120)}`);
  }

  // ─── PaperTradeLeg (Task 76) ───────────────────────────────────────────
  console.log("\n── PaperTradeLeg (Task 76) ──");
  try {
    const ptlTotal = await db.paperTradeLeg.count();
    console.log(`  total: ${ptlTotal}`);
  } catch (e: any) {
    console.log(`  TABLE ERROR: ${e.message.slice(0, 120)}`);
  }

  // ─── OhlcvBar freshness ─────────────────────────────────────────────────
  console.log("\n── OhlcvBar freshness ──");
  const latestBar = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" } });
  const ohlcvTotal = await db.ohlcvBar.count();
  const ohlcvSymbols = await db.ohlcvBar.groupBy({ by: ["symbol"], _count: { _all: true } });
  console.log(`  total bars: ${ohlcvTotal}  symbols: ${ohlcvSymbols.length}`);
  console.log(`  latest date: ${latestBar?.date}`);
  // per-symbol latest date — find stale ones
  let staleCount = 0;
  const perSymbolLatest: {symbol:string, latest:string}[] = [];
  for (const s of ohlcvSymbols) {
    const lb = await db.ohlcvBar.findFirst({ where: { symbol: s.symbol }, orderBy: { date: "desc" }, select: { date: true } });
    perSymbolLatest.push({ symbol: s.symbol, latest: lb?.date ?? "?" });
    if (lb?.date !== latestBar?.date) staleCount++;
  }
  console.log(`  symbols NOT at latest (${latestBar?.date}): ${staleCount}`);
  if (staleCount > 0 && staleCount <= 30) {
    const off = perSymbolLatest.filter(x => x.latest !== latestBar?.date);
    console.log(`  stale list: ${JSON.stringify(off.slice(0,30))}`);
  } else if (staleCount > 30) {
    const off = perSymbolLatest.filter(x => x.latest !== latestBar?.date);
    console.log(`  stale (first 15): ${JSON.stringify(off.slice(0,15))} ... (+${staleCount-15} more)`);
  }

  // ─── Prospective run artifacts ──────────────────────────────────────────
  console.log("\n── Prospective artifacts ──");
  try {
    const fs = await import("fs");
    const latestPath = "data/backtest_reports/prospective_runs/latest.json";
    if (fs.existsSync(latestPath)) {
      const lat = JSON.parse(fs.readFileSync(latestPath, "utf8"));
      console.log(`  latest.json: runId=${lat.runId} generatedAt=${lat.generatedAt} dataCutoff=${lat.dataCutoff} status=${lat.status}`);
    }
    const rptPath = "data/backtest_reports/prospective_paper_trading_latest.json";
    if (fs.existsSync(rptPath)) {
      const rpt = JSON.parse(fs.readFileSync(rptPath, "utf8"));
      console.log(`  prospective_paper_trading_latest.json: status=${rpt.status} generated_at=${rpt.generated_at} total=${rpt.prediction_counts?.total}`);
    } else {
      console.log(`  prospective_paper_trading_latest.json: NOT FOUND`);
    }
  } catch (e: any) {
    console.log(`  artifact read error: ${e.message.slice(0,120)}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("Phase 1 audit complete.");
  await db.$disconnect();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
