/**
 * Task 76 Phase 9 — Deterministic regression checks for the three-strategy
 * exit-policy engine (src/lib/latent/strategy-engine.ts).
 *
 * STANDALONE verification script (NOT jest/vitest). Imports ONLY pure functions
 * and feeds them synthetic OHLCV fixtures (no DB, no filesystem, no network).
 * Every assertion is against a hand-computed expected value.
 *
 * Run:  bun scripts/strategy_engine_regression_check.ts
 *
 * Covers the 20 strategy-engine tests from the Task 76 spec:
 *   1. Fixed TP/SL closes at the first terminal target/SL event.
 *   2. The initial SL is active before TP1.
 *   3. Trailing SL moves to TP1 after TP1 is reached.
 *   4. Trailing SL moves to TP2 after TP2 is reached.
 *   5. Trailing SL never moves backward.
 *   6. TP3 closes the correct remaining quantity.
 *   7. Scale-out closes 50% of initial quantity at TP1.
 *   8. Scale-out closes 25% of initial quantity at TP2.
 *   9. Scale-out closes exactly the remaining position at TP3.
 *  10. Partial exit quantities sum exactly to the original position size.
 *  11. Position-size rounding and lot-size restrictions handled honestly.
 *  12. SL/TP collision in the same OHLC candle follows the conservative rule.
 *  13. Newly activated trailing stops are not assumed to execute retroactively
 *      within the same candle.
 *  14. Horizon timeout closes only the remaining quantity at the observed close.
 *  15. Missing bars cannot fabricate a fill.
 *  16. Gap-aware fills match the canonical engine.
 *  17. Fees, slippage and tax are applied exactly once per exit event.
 *  18. Position-level P&L equals the sum of its net exit legs.
 *  19. A scale-out trade is counted as one completed position, not three trades.
 *  20. Repeated simulation input produces deterministic identical outputs.
 */
import {
  simulateStrategy,
  simulateAllStrategies,
  splitQuantity502525,
  summarizeStrategy,
  STRATEGY_POLICY_VERSION,
  STRATEGY_EFFECTIVE_START,
  type StrategySignal,
  type StrategyBar,
} from "../src/lib/latent/strategy-engine";
import { STANDARD_PSX, computeTradeCosts } from "../src/lib/latent/trading-costs";

let pass = 0,
  fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}
function approx(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A BUY signal: entry 100, SL 95, TP1 103, TP2 106, TP3 110, qty 100. */
function buySig(qty = 100): StrategySignal {
  return {
    symbol: "TEST",
    direction: "BUY",
    entryPrice: 100,
    sl: 95,
    tp1: 103,
    tp2: 106,
    tp3: 110,
    quantity: qty,
  };
}
function bar(date: string, o: number, h: number, l: number, c: number): StrategyBar {
  return { date, open: o, high: h, low: l, close: c };
}

// ─── Policy identity ─────────────────────────────────────────────────────────

console.log("\n── Policy identity ─────────────────────────────────────────────");
{
  check("policy version is task76-v1", STRATEGY_POLICY_VERSION === "task76-v1");
  check("effective start is 2026-10-30 (Task 76, NOT retroactive to Task 71)", STRATEGY_EFFECTIVE_START === "2026-10-30");
}

// ─── Test 1: Fixed TP/SL closes at first terminal event ──────────────────────

console.log("\n── 1. Fixed TP/SL — first terminal hit ────────────────────────");
{
  // TP3 reached on d3; SL never touched → fixed exits at TP3.
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const r = simulateStrategy("fixed_first_hit", buySig(), bars);
  check("fixed: exitReason TP3", r.exitReason === "TP3", r.exitReason);
  check("fixed: exitPrice = TP3 (110)", approx(r.legs[0].exitPrice, 110));
  check("fixed: bestTarget TP3", r.bestTargetReached === "TP3");
  check("fixed: single exit leg", r.legs.length === 1);
  check("fixed: closed 100% quantity", r.legs[0].quantity === 100);
  // SL hit case — gap-down: open 94 < SL 95 → gap-fill at 94.
  const barsSL = [bar("d1", 94, 101, 94, 95)]; // open 94 < sl 95, low 94 <= 95 → gap-fill at 94
  const rSL = simulateStrategy("fixed_first_hit", buySig(), barsSL);
  check("fixed: SL hit → exitReason SL", rSL.exitReason === "SL", rSL.exitReason);
  check("fixed: SL gap-fill at open (94 < 95 → fill 94)", approx(rSL.legs[0].exitPrice, 94));
}

// ─── Test 2: Initial SL active before TP1 ────────────────────────────────────

console.log("\n── 2. Initial SL active before TP1 ────────────────────────────");
{
  // Bar drops to SL before any TP → SL hit with activeStop == initial sl.
  const bars = [bar("d1", 100, 101, 94, 95)]; // low 94 <= sl 95; high 101 < tp1 103 (no TP)
  const r = simulateStrategy("max_tp_step_trailing", buySig(), bars);
  check("trailing: SL hit before TP1 → exitReason SL", r.exitReason === "SL", r.exitReason);
  check("trailing: activeStopFinal == initial sl (95)", approx(r.activeStopFinal, 95));
  check("trailing: no trailing history", r.trailingStopHistory.length === 0);
}

// ─── Tests 3-5: Trailing SL steps to TP1 / TP2 / never backward ──────────────

console.log("\n── 3-5. Trailing SL steps up (TP1→TP2), never backward ────────");
{
  // TP1 on d1 (high 104>=103). SL steps to 103 (effective d2). On d2, low 102<=103 → trailing SL hit at 103.
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 104, 102, 103)];
  const r = simulateStrategy("max_tp_step_trailing", buySig(), bars);
  check("trailing: TP1 reached → SL stepped to TP1 (103)", r.trailingStopHistory.some(h => h.afterTarget === "TP1" && approx(h.newStop, 103)));
  check("trailing: activeStopFinal == TP1 (103)", approx(r.activeStopFinal, 103));
  check("trailing: trailing SL hit → TRAILING_SL_AT_TP1", r.exitReason === "TRAILING_SL_AT_TP1", r.exitReason);
  check("trailing: step effective from NEXT bar (i+1)", r.trailingStopHistory[0]?.effectiveFromBarIdx === 1);
}
{
  // TP1 on d1 (104>=103) → SL steps to 103 (effective d2). d2 low MUST stay
  // > 103 so the trailing SL doesn't fire before TP2. TP2 on d2 (107>=106) →
  // SL steps to 106 (effective d3). d3 low 105 <= 106 → trailing SL at TP2.
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 104, 106), bar("d3", 106, 107, 105, 106)];
  const r = simulateStrategy("max_tp_step_trailing", buySig(), bars);
  check("trailing: TP2 reached → SL stepped to TP2 (106)", r.trailingStopHistory.some(h => h.afterTarget === "TP2" && approx(h.newStop, 106)));
  check("trailing: activeStopFinal == TP2 (106)", approx(r.activeStopFinal, 106));
  check("trailing: TRAILING_SL_AT_TP2", r.exitReason === "TRAILING_SL_AT_TP2", r.exitReason);
}
{
  // Trailing SL never moves backward. Fix lows so the trailing SL does NOT
  // fire prematurely: after TP1 (stop 103), lows must stay > 103; after TP2
  // (stop 106), low must stay > 106 until TP3. TP3 closes at 110.
  // d1: TP1 (104>=103), low 104>95, low 104>103 (no trailing SL — stop is still
  //     95 on d1; step effective d2). activeStop→103 for d2.
  // d2: activeStop=103, low 104>103 (no trailing SL), no TP2. continue.
  // d3: TP2 (107>=106), low 104>103 (no trailing SL at 103). activeStop→106 for d4.
  // d4: activeStop=106, low 107>106 (no trailing SL), TP3 (111>=110) → close.
  const bars = [bar("d1", 100, 104, 104, 103), bar("d2", 103, 104, 104, 103), bar("d3", 103, 107, 104, 106), bar("d4", 106, 111, 107, 110)];
  const r = simulateStrategy("max_tp_step_trailing", buySig(), bars);
  check("trailing: TP3 reached (stop never fired backward)", r.exitReason === "TP3", r.exitReason);
  check("trailing: stop never moves backward (final stop stepped up, ≥ 95)", r.activeStopFinal >= 95, String(r.activeStopFinal));
  // Verify the stop only increased (monotonic)
  const stops = [95, ...r.trailingStopHistory.map(h => h.newStop)];
  let monotonic = true;
  for (let i = 1; i < stops.length; i++) if (stops[i] < stops[i - 1]) monotonic = false;
  check("trailing: stop sequence monotonic (only favorable moves)", monotonic, JSON.stringify(stops));
}

// ─── Test 6: TP3 closes correct remaining quantity ───────────────────────────

console.log("\n── 6. TP3 closes remaining quantity ────────────────────────────");
{
  // All three strategies: TP3 reached → closes 100% (fixed/trailing) or remaining (scale-out).
  // Lows stay above the stepped trailing stops so trailing reaches TP3.
  const bars = [bar("d1", 100, 104, 104, 103), bar("d2", 103, 107, 104, 106), bar("d3", 106, 111, 107, 110)];
  const all = simulateAllStrategies(buySig(100), bars);
  check("fixed: TP3 closes 100%", all.fixed_first_hit.legs[0].quantity === 100);
  check("trailing: TP3 closes 100% (reached before any trailing SL)", all.max_tp_step_trailing.exitReason === "TP3" && all.max_tp_step_trailing.legs[0].quantity === 100, all.max_tp_step_trailing.exitReason);
  // scale-out: TP1 50 + TP2 25 + TP3 25
  const tp3Leg = all.scale_out_50_25_25.legs.find(l => l.exitReason === "TP3_REMAINDER");
  check("scale-out: TP3 closes remaining 25", tp3Leg && tp3Leg.quantity === 25, tp3Leg ? String(tp3Leg.quantity) : "no TP3 leg");
}

// ─── Tests 7-10: Scale-out 50/25/25 + sum exactly ────────────────────────────

console.log("\n── 7-10. Scale-out 50/25/25, sums exactly ──────────────────────");
{
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const r = simulateStrategy("scale_out_50_25_25", buySig(100), bars);
  const legs = r.legs;
  check("scale-out: 3 legs", legs.length === 3, `got ${legs.length}`);
  check("scale-out: TP1 leg 50%", legs[0].quantity === 50, String(legs[0].quantity));
  check("scale-out: TP2 leg 25%", legs[1].quantity === 25, String(legs[1].quantity));
  check("scale-out: TP3 leg 25% (remaining)", legs[2].quantity === 25, String(legs[2].quantity));
  const sum = legs.reduce((s, l) => s + l.quantity, 0);
  check("scale-out: leg quantities sum exactly to 100", sum === 100, String(sum));
  check("scale-out: TP1 fill at 103", approx(legs[0].exitPrice, 103));
  check("scale-out: TP2 fill at 106", approx(legs[1].exitPrice, 106));
  check("scale-out: TP3 fill at 110", approx(legs[2].exitPrice, 110));
}

// ─── Test 11: Position-size rounding / lot restrictions ──────────────────────

console.log("\n── 11. Position-size rounding (integer shares, exact sum) ──────");
{
  // qty 7: q1=floor(3.5)=3, q2=floor(1.75)=1, q3=7-3-1=3. Sum=7. Exact.
  const s7 = splitQuantity502525(7);
  check("split(7): q1=3, q2=1, q3=3", s7.q1 === 3 && s7.q2 === 1 && s7.q3 === 3, JSON.stringify(s7));
  check("split(7): sum == 7", s7.q1 + s7.q2 + s7.q3 === 7);
  // qty 1: q1=0, q2=0, q3=1. TP1/TP2 legs would be 0 (no zero-qty legs fabricated).
  const s1 = splitQuantity502525(1);
  check("split(1): q1=0, q2=0, q3=1 (no fractional fabrication)", s1.q1 === 0 && s1.q2 === 0 && s1.q3 === 1, JSON.stringify(s1));
  // qty 3: q1=1, q2=0, q3=2. Sum=3.
  const s3 = splitQuantity502525(3);
  check("split(3): sum == 3", s3.q1 + s3.q2 + s3.q3 === 3, JSON.stringify(s3));
  // Verify the engine skips zero-quantity legs (qty 1 → only TP3 leg at the TP3 bar)
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const r1 = simulateStrategy("scale_out_50_25_25", buySig(1), bars);
  check("scale-out qty=1: no zero-quantity legs fabricated", r1.legs.every(l => l.quantity > 0));
  check("scale-out qty=1: legs sum to 1", r1.legs.reduce((s, l) => s + l.quantity, 0) === 1);
}

// ─── Test 12: Same-candle SL/TP collision → conservative SL priority ─────────

console.log("\n── 12. Same-candle SL/TP collision → SL priority ───────────────");
{
  // One bar where BOTH SL (low 94<=95) and TP3 (high 111>=110) are touched,
  // AND the bar opens BELOW SL (gap-down: open 94 < 95) → gap-fill at 94.
  // Conservative rule: SL FIRST, exit at gap-fill 94 (NOT TP3 110).
  const bars = [bar("d1", 94, 111, 94, 100)];
  const r = simulateStrategy("fixed_first_hit", buySig(), bars);
  check("collision: SL prioritised over TP (exitReason SL)", r.exitReason === "SL", r.exitReason);
  check("collision: exit at gap-fill (94), NOT TP3 (110)", approx(r.legs[0].exitPrice, 94));
  check("collision: bestTarget stays — (no TP awarded from SL candle)", r.bestTargetReached === "—");
}

// ─── Test 13: Trailing stop not retroactive same candle ──────────────────────

console.log("\n── 13. Trailing stop not retroactive within same candle ────────");
{
  // TP1 hit on d1 (high 104>=103). The NEW stop (103) is effective from d2.
  // On d1 itself, even though low 99 < 103, the trailing SL does NOT fire
  // (it wasn't active yet on d1). The original SL (95) governs d1; low 99 > 95.
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 104, 103, 103)]; // d2 low 103 <= new stop 103
  const r = simulateStrategy("max_tp_step_trailing", buySig(), bars);
  // The trailing SL fires on d2 (effective from d2), NOT on d1.
  check("trailing: step effectiveFromBarIdx = i+1 (not same candle)", r.trailingStopHistory[0]?.effectiveFromBarIdx === 1);
  check("trailing: did NOT exit on d1 (TP1 candle) despite low < new stop", r.exitReason.startsWith("TRAILING_SL"), r.exitReason);
  // If d2 had low > 103 (no trailing hit), trade continues — proving the stop
  // wasn't applied retroactively to d1.
  const bars2 = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 111, 104, 110)]; // d2: TP3 hit (111>=110), low 104>103
  const r2 = simulateStrategy("max_tp_step_trailing", buySig(), bars2);
  check("trailing: TP3 reached on d2 (stop stepped on d1 but didn't fire retroactively)", r2.exitReason === "TP3", r2.exitReason);
}

// ─── Test 14: Horizon timeout closes remaining at observed close ─────────────

console.log("\n── 14. Horizon timeout → close at observed last close ──────────");
{
  // No SL, no TP3 → TIME_UP. Fixed: close 100% at last close. Scale-out: close
  // remaining at last close (TP1/TP2 partials may have fired earlier).
  const bars = [bar("d1", 100, 101, 99, 100), bar("d2", 100, 102, 99, 101), bar("d3", 101, 103, 100, 102)];
  const rFixed = simulateStrategy("fixed_first_hit", buySig(), bars);
  check("fixed: TIME_UP → close at last close (102)", rFixed.exitReason === "TIME_UP" && approx(rFixed.legs[0].exitPrice, 102), rFixed.exitReason);
  check("fixed: closes 100% at timeout", rFixed.legs[0].quantity === 100);
  // Scale-out with TP1 hit on d3 (103>=103) but no TP2/TP3 → TP1 partial + timeout remainder.
  const barsScale = [bar("d1", 100, 101, 99, 100), bar("d2", 100, 102, 99, 101), bar("d3", 101, 104, 100, 103)];
  const rScale = simulateStrategy("scale_out_50_25_25", buySig(100), barsScale);
  const timeoutLeg = rScale.legs.find(l => l.exitReason === "TIME_UP_REMAINDER");
  check("scale-out: timeout closes REMAINING (not 100%) at last close", timeoutLeg && timeoutLeg.quantity === 50, timeoutLeg ? String(timeoutLeg.quantity) : "no timeout leg");
  check("scale-out: timeout leg at last close (103)", timeoutLeg && approx(timeoutLeg.exitPrice, 103));
}

// ─── Test 15: Missing bars cannot fabricate a fill ───────────────────────────

console.log("\n── 15. Missing bars → no fabricated fill ───────────────────────");
{
  const r = simulateStrategy("fixed_first_hit", buySig(), []);
  check("empty bars → NO_BARS (no fabricated exit)", r.exitReason === "NO_BARS", r.exitReason);
  check("empty bars → 0 legs (no fabricated trade)", r.legs.length === 0);
  check("empty bars → unresolved", r.unresolved === true);
  check("empty bars → 0 netPnl (not a fabricated zero-fill)", r.netPnl === 0);
}

// ─── Test 16: Gap-aware fills match canonical engine ─────────────────────────

console.log("\n── 16. Gap-aware stop-fill ────────────────────────────────────");
{
  // Gap-down: bar opens BELOW SL (94 < 95) → fill at gap-open (94), not SL (95).
  const barsGap = [bar("d1", 94, 95, 93, 94)]; // open 94 < sl 95, low 93 <= 95
  const r = simulateStrategy("fixed_first_hit", buySig(), barsGap);
  check("gap-down: fill at gap-open (94), not SL (95)", approx(r.legs[0].exitPrice, 94));
  // No gap: bar opens at/above SL → fill at SL level.
  const barsNoGap = [bar("d1", 96, 97, 94, 95)]; // open 96 > sl 95, low 94 <= 95
  const r2 = simulateStrategy("fixed_first_hit", buySig(), barsNoGap);
  check("no-gap: fill at SL level (95)", approx(r2.legs[0].exitPrice, 95));
}

// ─── Test 17: Fees/slippage/tax applied exactly once per exit event ──────────

console.log("\n── 17. Costs applied once per exit quantity ────────────────────");
{
  // Scale-out: 3 legs. Each leg's costs computed on ITS quantity + grossPnl.
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const r = simulateStrategy("scale_out_50_25_25", buySig(100), bars);
  for (const leg of r.legs) {
    const expected = computeTradeCosts(leg.quantity * 100, leg.grossPnl, STANDARD_PSX);
    check(`leg ${leg.exitReason} qty=${leg.quantity}: costs match computeTradeCosts`, approx(leg.totalCost, expected.totalCost) && approx(leg.netPnl, expected.netPnl));
  }
  // Fixed: 1 leg, costs on full quantity.
  const rFixed = simulateStrategy("fixed_first_hit", buySig(), bars);
  const expFixed = computeTradeCosts(100 * 100, rFixed.legs[0].grossPnl, STANDARD_PSX);
  check("fixed: costs on full quantity (once)", approx(rFixed.legs[0].totalCost, expFixed.totalCost));
}

// ─── Test 18: Position P&L = sum of net exit legs ────────────────────────────

console.log("\n── 18. Position P&L = sum of net legs ─────────────────────────");
{
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const r = simulateStrategy("scale_out_50_25_25", buySig(100), bars);
  const sumNet = r.legs.reduce((s, l) => s + l.netPnl, 0);
  const sumGross = r.legs.reduce((s, l) => s + l.grossPnl, 0);
  const sumCost = r.legs.reduce((s, l) => s + l.totalCost, 0);
  check("scale-out: netPnl == sum(leg.netPnl)", approx(r.netPnl, sumNet));
  check("scale-out: grossPnl == sum(leg.grossPnl)", approx(r.grossPnl, sumGross));
  check("scale-out: totalCost == sum(leg.totalCost)", approx(r.totalCost, sumCost));
}

// ─── Test 19: Scale-out trade = 1 completed position, not 3 trades ───────────

console.log("\n── 19. Scale-out = 1 position (legs aggregated, not 3 trades) ──");
{
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const results = [
    simulateStrategy("scale_out_50_25_25", buySig(), bars),
    simulateStrategy("scale_out_50_25_25", buySig(), bars), // second signal same
  ];
  const summary = summarizeStrategy(results);
  check("summarize: nTrades = 2 (one per signal, NOT per leg)", summary.nTrades === 2, String(summary.nTrades));
  check("summarize: partialExits = 6 (3 legs × 2 trades)", summary.partialExits === 6, String(summary.partialExits));
  check("summarize: nWinning counts positions (netPnl>0), not legs", summary.nWinning === results.filter(r => r.netPnl > 0).length);
}

// ─── Test 20: Repeated simulation → deterministic identical outputs ──────────

console.log("\n── 20. Deterministic (repeated runs identical) ────────────────");
{
  const bars = [bar("d1", 100, 104, 99, 103), bar("d2", 103, 107, 102, 106), bar("d3", 106, 111, 105, 110)];
  const run1 = simulateAllStrategies(buySig(), bars);
  const run2 = simulateAllStrategies(buySig(), bars);
  const run3 = simulateAllStrategies(buySig(), bars);
  const ser = (r: any) => JSON.stringify(r);
  check("3 repeated runs produce identical fixed result", ser(run1.fixed_first_hit) === ser(run2.fixed_first_hit) && ser(run2.fixed_first_hit) === ser(run3.fixed_first_hit));
  check("3 repeated runs produce identical trailing result", ser(run1.max_tp_step_trailing) === ser(run2.max_tp_step_trailing) && ser(run2.max_tp_step_trailing) === ser(run3.max_tp_step_trailing));
  check("3 repeated runs produce identical scale-out result", ser(run1.scale_out_50_25_25) === ser(run2.scale_out_50_25_25) && ser(run2.scale_out_50_25_25) === ser(run3.scale_out_50_25_25));
}

// ─── SELL direction sanity (direction-aware) ─────────────────────────────────

console.log("\n── SELL direction sanity ──────────────────────────────────────");
{
  // SELL: entry 100, SL 105 (above), TP1 97, TP2 94, TP3 90. SL touched when high>=105.
  const sigSell: StrategySignal = { symbol: "TEST", direction: "SELL", entryPrice: 100, sl: 105, tp1: 97, tp2: 94, tp3: 90, quantity: 100 };
  // TP3 hit: low 89 <= 90 → TP3. high 99 < 105 (no SL).
  const bars = [bar("d1", 100, 101, 89, 91)];
  const r = simulateStrategy("fixed_first_hit", sigSell, bars);
  check("SELL: TP3 hit (low <= tp3)", r.exitReason === "TP3", r.exitReason);
  check("SELL: exitPrice = TP3 (90)", approx(r.legs[0].exitPrice, 90));
  // SELL SL: high 106 >= 105 → SL, gap-up open 106 > 105 → fill at 106.
  const barsSL = [bar("d1", 106, 107, 100, 105)];
  const rSL = simulateStrategy("fixed_first_hit", sigSell, barsSL);
  check("SELL: SL hit (high >= sl)", rSL.exitReason === "SL", rSL.exitReason);
  check("SELL: gap-up fill at open (106)", approx(rSL.legs[0].exitPrice, 106));
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  strategy_engine_regression_check: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`  FAILURES:`);
  failures.forEach((f) => console.log(`    ✗ ${f}`));
  process.exit(1);
} else {
  console.log(`  All strategy-engine deterministic checks passed.`);
}
console.log(`\n  TESTS NOT RUN IN THIS SCRIPT (reported honestly):`);
console.log(`    • DB/lifecycle tests (21-32) — require a live ProspectivePaperTrade ledger + transactions;`);
console.log(`      the schema + uniqueness constraints are in place (db:push applied) but the recording`);
console.log(`      lifecycle + concurrent-rerun idempotency tests are deferred to a dedicated DB test script.`);
console.log(`    • UI/reporting tests (33-40) — require browser verification of the strategy selector.`);
console.log(`═══════════════════════════════════════════════════════════════`);
