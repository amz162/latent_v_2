/**
 * Task 107 v2 — estimated exit-cost helper (authoritative cost path).
 * Reads [{key, buyQuantity, buyPrice, exitLegs:[{quantity, exitPrice}], grossPnl}],
 * writes computeTradeCostsV2 results (PSX_USER_SCHEDULE_V2, ATL_15) per key.
 * Usage: bun scripts/task107_cost_quote.ts <in.json> <out.json>
 */
import { readFileSync, writeFileSync } from "fs";
import { computeTradeCostsV2, PSX_USER_SCHEDULE_V2 } from "../src/lib/latent/trading-costs";

interface Item {
  key: string;
  buyQuantity: number;
  buyPrice: number;
  exitLegs: { quantity: number; exitPrice: number }[];
  grossPnl: number;
}
const [inPath, outPath] = process.argv.slice(2);
const items: Item[] = JSON.parse(readFileSync(inPath, "utf8"));
const out: Record<string, unknown> = {};
for (const it of items) {
  const c = computeTradeCostsV2(it.buyQuantity, it.buyPrice, it.exitLegs, it.grossPnl, PSX_USER_SCHEDULE_V2, "ATL_15");
  const buySide = c.buy.sideTotal;
  out[it.key] = {
    // exit-side costs only (buy costs are already sunk at entry)
    exitSideCosts: Math.round((c.totalCost - c.cgt - buySide) * 100) / 100,
    cgt: Math.round(c.cgt * 100) / 100,
    totalCostAllLegs: c.totalCost,
    netPnlIfExitedNow: Math.round(c.netPnl * 100) / 100,
  };
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ n: Object.keys(out).length }));
