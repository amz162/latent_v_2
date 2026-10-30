/**
 * Task 78 — Phase 5: Final audit package. Captures protected artifact hashes,
 * current DB counts, strategy results reference, + honest status/limitations.
 * Output: data/backtest_reports/task78_final_audit.json
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as crypto from "crypto";
const db = new PrismaClient({ log: ["error"] });

const PROTECTED = [
  "data/ml_predictions_multi.json",
  "data/backtest_reports/walk_forward_latest.json",
  "data/backtest_reports/pilot25_robustness.json",
  "data/backtest_reports/walk_forward_trading_latest.json",
  "data/backtest_reports/walk_forward_trading_robustness.json",
  "data/backtest_reports/walk_forward_portfolio_latest.json",
  "data/backtest_reports/prospective_runs/latest.json",
  "data/backtest_reports/runs/pilot25_step50_20261028/manifest.json",
];

async function main() {
  const md5 = (f: string) => {
    try { return crypto.createHash("md5").update(fs.readFileSync(f)).digest("hex"); }
    catch { return "MISSING"; }
  };
  const hashes: Record<string, string> = {};
  for (const f of PROTECTED) hashes[f] = md5(f);

  const ph = await db.predictionHistory.count();
  const rl = await db.predictionRiskLevels.count();
  const ppt = await db.prospectivePaperTrade.count();
  const po = await db.predictionOutcome.count();
  const ptl = await db.paperTradeLeg.count();
  const pe = await db.prospectivePaperTrade.count({ where: { state: "pending_entry" } });
  const op = await db.prospectivePaperTrade.count({ where: { state: "open" } });
  const cl = await db.prospectivePaperTrade.count({ where: { state: "closed" } });
  const sk = await db.prospectivePaperTrade.count({ where: { state: "skipped" } });
  const latestBar = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" }, select: { date: true } });

  // Load strategy results for reference
  let stratResults: any = null;
  try { stratResults = JSON.parse(fs.readFileSync("data/backtest_reports/task78_strategy_results_v1.json", "utf-8")); }
  catch {}

  const audit = {
    task: "task78_final_audit",
    runId: `task78_audit_${Date.now()}`,
    createdAt: new Date().toISOString(),
    gitHead: "8a61c0b3",
    status: "READY",
    statusReason: "0 open positions (all 114 trades pending_entry — next trading session after 2026-10-29 cutoff has not occurred). ACTIVE requires open positions being managed.",
    latestOhlcvSession: latestBar?.date ?? null,
    dbCounts: {
      predictionHistory: ph,
      predictionRiskLevels: rl,
      prospectivePaperTrade: ppt,
      paperTradeLeg: ptl,
      predictionOutcome: po,
      tradesByState: { pending_entry: pe, open: op, closed: cl, skipped: sk },
    },
    strategyResults: stratResults ? {
      file: "data/backtest_reports/task78_strategy_results_v1.json",
      runId: stratResults.runId,
      buyCandidates: stratResults.buyCandidates,
      resultRows: stratResults.resultRows,
      overallByStrategy: stratResults.overallByStrategy,
    } : null,
    protectedArtifacts: hashes,
    limitations: [
      "ALL 114 trades pending_entry + ALL 375 outcomes pending — prospective period just began (cutoff 2026-10-29); no future sessions exist yet.",
      "Historical strategy comparison is RETROSPECTIVE + EXPLORATORY — Task 76 exit policies + ATR overlay introduced after historical results were inspected. Do NOT claim significance.",
      "5 stale symbols (BYCO=2021, ENGRO=2025, PRL/WTL/ANL=2026-10-21) — trades stay pending_entry honestly until new data arrives.",
      "Trade-level results (fixed PKR 100K notional) — NOT a funded portfolio. Cash-constrained portfolio metrics marked unavailable (no open positions to reconcile).",
      "Do NOT claim predictive skill, statistical significance, or future profitability.",
    ],
    readiness: {
      nextPhase: "New ML model research + training, then separate strategy development/validation.",
      baseline: "Existing 5-model × 3-horizon walk-forward baseline preserved for fair comparison.",
      criteria: "New models must beat the existing baseline on genuinely matured prospective outcomes (not retrospective).",
    },
  };
  fs.writeFileSync("data/backtest_reports/task78_final_audit.json", JSON.stringify(audit, null, 2));
  console.log("✓ Final audit written: data/backtest_reports/task78_final_audit.json");
  console.log(`  DB: ph=${ph} rl=${rl} ppt=${ppt} po=${po} ptl=${ptl}`);
  console.log(`  trades: pe=${pe} open=${op} closed=${cl} skipped=${sk}`);
  console.log(`  status: ${audit.status}`);
  await db.$disconnect();
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
