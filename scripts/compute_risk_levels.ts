/**
 * Task 77 — Phase 2: Compute + persist immutable risk levels for eligible BUY
 * predictions. Uses the canonical ATR(14)-based formula (risk-levels.ts) on the
 * OHLCV bars ≤ the prediction's dataCutoff. Idempotent (unique on predictionId).
 *
 * Run: bun scripts/compute_risk_levels.ts
 */
import { PrismaClient } from "@prisma/client";
import { computeRiskLevels } from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });

async function main() {
  console.log("=".repeat(60));
  console.log("Task 77 Phase 2 — Compute Risk Levels");
  console.log("=".repeat(60));

  const buyPreds = await db.predictionHistory.findMany({ where: { signal: "BUY" } });
  console.log(`BUY predictions: ${buyPreds.length}`);

  // Group by symbol (all share cutoff 2026-10-29 — one level-set per symbol).
  const bySymbol = new Map<string, typeof buyPreds>();
  for (const p of buyPreds) {
    if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, []);
    bySymbol.get(p.symbol)!.push(p);
  }
  console.log(`distinct symbols with BUY: ${bySymbol.size}`);

  let created = 0, skipped = 0, failed = 0;
  for (const [symbol, preds] of bySymbol) {
    const declaredCutoff = preds[0].dataCutoff;
    if (!declaredCutoff) {
      console.log(`  FAIL ${symbol}: no dataCutoff on predictions`);
      failed += preds.length;
      continue;
    }
    const bars = await db.ohlcvBar.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
      select: { date: true, high: true, low: true, close: true },
    });
    // The prediction's dataCutoff is the GLOBAL latest OHLCV date (set by
    // generate_live_predictions.py). Some symbols are stale (their latest bar
    // is earlier than the global latest). For those, the prediction was
    // actually made on the symbol's OWN latest bar (entryPrice = that close).
    // Use the declared cutoff if its bar exists; otherwise fall back to the
    // symbol's actual latest bar — the real data the prediction used.
    let effectiveCutoff = declaredCutoff;
    let cutoffSource = "dataCutoff";
    const declaredBarExists = bars.some((b) => b.date === declaredCutoff);
    if (!declaredBarExists && bars.length > 0) {
      effectiveCutoff = bars[bars.length - 1].date; // symbol's latest bar
      cutoffSource = "symbol-latest-fallback";
    }
    const levels = computeRiskLevels(bars, effectiveCutoff, "BUY");
    if (!levels) {
      console.log(`  FAIL ${symbol}: no usable cutoff bar (declared=${declaredCutoff}, effective=${effectiveCutoff})`);
      failed += preds.length;
      continue;
    }
    for (const p of preds) {
      const existing = await db.predictionRiskLevels.findUnique({ where: { predictionId: p.id } });
      if (existing) { skipped++; continue; }
      await db.predictionRiskLevels.create({
        data: {
          predictionId: p.id,
          riskPolicyId: levels.riskPolicyId,
          riskPolicyVersion: levels.riskPolicyVersion,
          effectiveCutoff: levels.effectiveCutoff,
          entryReference: levels.entryReference,
          atr14: levels.atr14,
          slDistance: levels.slDistance,
          tp1Distance: levels.tp1Distance,
          tp2Distance: levels.tp2Distance,
          tp3Distance: levels.tp3Distance,
          sl: levels.sl,
          tp1: levels.tp1,
          tp2: levels.tp2,
          tp3: levels.tp3,
          direction: levels.direction,
          barsUsed: levels.barsUsed,
        },
      });
      created++;
    }
    console.log(
      `  ✓ ${symbol}: cutoff=${levels.effectiveCutoff} (${cutoffSource}) ref=${levels.entryReference.toFixed(2)} atr14=${levels.atr14.toFixed(2)} ` +
      `sl=${levels.sl.toFixed(2)} tp1=${levels.tp1.toFixed(2)} tp2=${levels.tp2.toFixed(2)} tp3=${levels.tp3.toFixed(2)} ` +
      `bars=${levels.barsUsed} (${preds.length} preds)`
    );
  }

  console.log(`\ncreated: ${created}  skipped(existing): ${skipped}  failed: ${failed}`);
  const total = await db.predictionRiskLevels.count();
  console.log(`PredictionRiskLevels total now: ${total}`);
  await db.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
