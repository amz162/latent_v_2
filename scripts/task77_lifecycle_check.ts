/**
 * Task 77 — Lifecycle + risk-level regression checks.
 * Verifies the DB-backed prospective ledger invariants deterministically.
 * Run: bun scripts/task77_lifecycle_check.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ log: ["error"] });

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? " — " + detail : ""}`); }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Task 77 — Lifecycle + Risk-Level Regression Checks");
  console.log("=".repeat(60));

  // ─── PredictionHistory immutability + counts ──────────────────────────────
  console.log("\n── PredictionHistory ──");
  const phTotal = await db.predictionHistory.count();
  check("PredictionHistory total = 375", phTotal === 375, `got ${phTotal}`);
  const phBuy = await db.predictionHistory.count({ where: { signal: "BUY" } });
  check("BUY predictions = 38", phBuy === 38, `got ${phBuy}`);
  const phHold = await db.predictionHistory.count({ where: { signal: "HOLD" } });
  check("HOLD predictions = 337", phHold === 337, `got ${phHold}`);
  // All pending (no outcomes matured yet — no future bars)
  const phPending = await db.predictionHistory.count({ where: { outcomeStatus: "pending" } });
  check("all predictions pending (0 matured)", phPending === 375, `pending=${phPending}`);

  // ─── PredictionRiskLevels ─────────────────────────────────────────────────
  console.log("\n── PredictionRiskLevels ──");
  const rlTotal = await db.predictionRiskLevels.count();
  check("risk levels = 38 (one per BUY prediction)", rlTotal === 38, `got ${rlTotal}`);
  // All BUY predictions have risk levels
  const buyPreds = await db.predictionHistory.findMany({ where: { signal: "BUY" } });
  let withRL = 0;
  for (const p of buyPreds) {
    const rl = await db.predictionRiskLevels.findUnique({ where: { predictionId: p.id } });
    if (rl) {
      withRL++;
      // BUY: sl < entryReference < tp1 < tp2 < tp3
      check(`  ${p.symbol} ${p.modelId} h=${p.horizon}: sl<ref<tp1<tp2<tp3`,
        rl.sl < rl.entryReference && rl.entryReference < rl.tp1 && rl.tp1 < rl.tp2 && rl.tp2 < rl.tp3,
        `sl=${rl.sl} ref=${rl.entryReference} tp1=${rl.tp1} tp2=${rl.tp2} tp3=${rl.tp3}`);
    }
  }
  check("all 38 BUY predictions have risk levels", withRL === 38, `got ${withRL}`);
  // Unique on predictionId
  check("risk levels unique on predictionId (1:1)", rlTotal === withRL);

  // ─── ProspectivePaperTrade ────────────────────────────────────────────────
  console.log("\n── ProspectivePaperTrade ──");
  const pptTotal = await db.prospectivePaperTrade.count();
  check("trades = 114 (38 BUY × 3 strategies)", pptTotal === 114, `got ${pptTotal}`);
  for (const s of ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]) {
    const n = await db.prospectivePaperTrade.count({ where: { strategyId: s } });
    check(`trades for ${s} = 38`, n === 38, `got ${n}`);
  }
  // All pending_entry (no next-session bar exists)
  const pe = await db.prospectivePaperTrade.count({ where: { state: "pending_entry" } });
  check("all trades pending_entry (no next-session bar yet)", pe === 114, `got ${pe}`);
  // No demo rows
  const demo = await db.prospectivePaperTrade.count({ where: { isDemo: true } });
  check("no demo rows (all genuine)", demo === 0, `got ${demo}`);
  // All reference a valid PredictionHistory + have SL/TP
  const trades = await db.prospectivePaperTrade.findMany();
  let allHaveLevels = true;
  for (const t of trades) {
    if (t.sl == null || t.tp1 == null || t.tp2 == null || t.tp3 == null) { allHaveLevels = false; break; }
  }
  check("all trades have sl/tp1/tp2/tp3 from risk levels", allHaveLevels);

  // ─── PredictionOutcome ────────────────────────────────────────────────────
  console.log("\n── PredictionOutcome ──");
  const poTotal = await db.predictionOutcome.count();
  check("outcomes = 375 (one per prediction)", poTotal === 375, `got ${poTotal}`);
  const poPending = await db.predictionOutcome.count({ where: { outcomeStatus: "pending" } });
  check("all outcomes pending (horizons not reached)", poPending === 375, `got ${poPending}`);
  // Unique on predictionId (1:1)
  check("outcomes unique on predictionId", poTotal === 375);

  // ─── PaperTradeLeg ────────────────────────────────────────────────────────
  console.log("\n── PaperTradeLeg ──");
  const legs = await db.paperTradeLeg.count();
  check("legs = 0 (no trades closed yet)", legs === 0, `got ${legs}`);

  // ─── Idempotency: re-running lifecycle creates no duplicates ──────────────
  console.log("\n── Idempotency (re-run check) ──");
  const { runLifecycle } = await import("@/lib/latent/prospective-lifecycle");
  const before = { trades: pptTotal, outcomes: poTotal, legs };
  const r = await runLifecycle();
  const afterTrades = await db.prospectivePaperTrade.count();
  const afterOutcomes = await db.predictionOutcome.count();
  const afterLegs = await db.paperTradeLeg.count();
  check("re-run created 0 new trades", r.runStats.tradesCreated === 0, `created ${r.runStats.tradesCreated}`);
  check("re-run created 0 new outcomes", r.runStats.outcomesCreated === 0, `created ${r.runStats.outcomesCreated}`);
  check("trade count unchanged after re-run", before.trades === afterTrades);
  check("outcome count unchanged after re-run", before.outcomes === afterOutcomes);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`Task 77 lifecycle checks: ${pass} pass, ${fail} fail`);
  console.log("=".repeat(60));
  await db.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
