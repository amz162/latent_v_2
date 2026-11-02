/**
 * Task 105 Phase 12 — cost & execution parity fixtures across parallel paths.
 * Asserts computeTradeCostsV2, computeSimTradeCosts, and the strategy engine
 * agree on the same inputs within PKR 0.01; verifies scale-out leg accounting,
 * positive-gross CGT, tax profiles, and P&L identities. Prints ONE JSON line.
 */
import { computeTradeCostsV2, PSX_USER_SCHEDULE_V2, LEGACY_STANDARD_PSX_V1 } from "@/lib/latent/trading-costs";
import { computeSimTradeCosts } from "@/lib/latent/investment-simulator";
import { simulateStrategy } from "@/lib/latent/strategy-engine";

const out: any = { fixtures: 0, failed: [] };
function eq(name: string, a: number, b: number, tol = 0.011) {
  out.fixtures++;
  if (!(Math.abs(a - b) <= tol)) out.failed.push(`${name}: ${a} vs ${b}`);
}
function isTrue(name: string, v: boolean) { out.fixtures++; if (!v) out.failed.push(name); }

// fixture A: scale-out 100 shares @100, legs 50@110/25@120/25@130 (gross 2500)
const legs3 = [{ quantity: 50, exitPrice: 110 }, { quantity: 25, exitPrice: 120 }, { quantity: 25, exitPrice: 130 }];
const vA = computeTradeCostsV2(100, 100, legs3, 2500, PSX_USER_SCHEDULE_V2, "ATL_15");
eq("A: net identity", vA.netPnl, 2500 - vA.totalCost);
isTrue("A: cgt 15% of positive gross", Math.abs(vA.cgt - 0.15 * 2500) < 0.02);
const vLoss = computeTradeCostsV2(100, 100, [{ quantity: 100, exitPrice: 90 }], -1000, PSX_USER_SCHEDULE_V2, "ATL_15");
isTrue("A2: cgt zero on loss", vLoss.cgt === 0);

// fixture B: engine scale-out vs manual leg aggregation (same inputs)
const bars = Array.from({ length: 10 }, (_, i) => ({
  date: `2026-01-${String(i + 5).padStart(2, "0")}`, open: 100, high: i === 1 ? 115 : 102,
  low: 98, close: 100 + i }));
const r = simulateStrategy("scale_out_50_25_25",
  { symbol: "TST", direction: "BUY", entryPrice: 100, sl: 90, tp1: 110, tp2: 115, tp3: 120, quantity: 100 },
  bars, PSX_USER_SCHEDULE_V2);
const legSum = r.legs.reduce((s, l) => s + l.netPnl, 0);
eq("B: engine net == sum(leg nets)", r.netPnl, legSum);
eq("B: gross identity", r.netPnl, r.grossPnl - r.totalCost, 0.05);
isTrue("B: three legs 50/25/25", r.legs.length === 3 && r.legs[0].quantity === 50 && r.legs[1].quantity === 25 && r.legs[2].quantity === 25);

// fixture C: computeSimTradeCosts (V2 delegates to computeTradeCostsV2 by construction)
try {
  const simC = computeSimTradeCosts(10_000, 100, 110, 1000);
  const engC = computeTradeCostsV2(100, 100, [{ quantity: 100, exitPrice: 110 }], 1000, PSX_USER_SCHEDULE_V2, "ATL_15");
  eq("C: sim vs engine total cost", simC.totalCost, engC.totalCost, 0.02);
  eq("C: sim vs engine net", simC.netPnl, engC.netPnl, 0.02);
} catch (e: any) {
  out.fixtures++;
  out.failed.push(`C: sim signature — ${String(e?.message ?? e).slice(0, 120)}`);
}

// fixture D: legacy profile compatibility still available
const vL = computeTradeCostsV2(100, 100, legs3, 2500, LEGACY_STANDARD_PSX_V1, "ATL_15");
isTrue("D: legacy profile callable", Number.isFinite(vL.netPnl));

// fixture E: tax profile NON_ATL_30 > ATL_15 on same positive gross
const v30 = computeTradeCostsV2(100, 100, legs3, 2500, PSX_USER_SCHEDULE_V2, "NON_ATL_30");
isTrue("E: non-ATL cgt higher", v30.cgt > vA.cgt);

out.verdict = out.failed.length === 0 ? "PASS" : "FAIL";
console.log(JSON.stringify(out));
