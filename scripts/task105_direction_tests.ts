/**
 * Task 105 Phase 2 — direction-mapping and execution-logic fixture tests run
 * against the PRODUCTION modules. Every assertion is software behavior, not a
 * market claim. Output: task105_direction_mapping_tests.json (merged by
 * task105_phase2.py).
 */
import * as fs from "fs";
import { computeRiskLevels } from "@/lib/latent/risk-levels";
import { simulateStrategy, type StrategyBar } from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2, computeTradeCostsV2 } from "@/lib/latent/trading-costs";

const out: any = { suites: [] };
function suite(name: string, cases: [string, boolean, string?][]) {
  out.suites.push({ suite: name, passed: cases.every((c) => c[1]), failed: cases.filter((c) => !c[1]).map((c) => c[0]), cases });
}

// synthetic OHLC path — software fixture only
const mkBars = (n: number, base: number, drift: number): StrategyBar[] =>
  Array.from({ length: n }, (_, i) => {
    const c = base * (1 + drift * (i + 1));
    return { date: `2026-01-${String(5 + i).padStart(2, "0")}`, open: c * 0.999, high: c * 1.01, low: c * 0.99, close: c };
  });

// 1) BUY geometry from computeRiskLevels
const barsBuy = mkBars(120, 100, 0.002);
const lvBuy = computeRiskLevels(barsBuy.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close })), barsBuy[100].date, "BUY");
suite("risk_levels_buy_geometry", [
  ["BUY sl below entry", !!lvBuy && lvBuy.sl < barsBuy[101].open],
  ["BUY tp1>tp2>tp3 above entry", !!lvBuy && lvBuy.tp1 < lvBuy.tp2 && lvBuy.tp2 < lvBuy.tp3 && lvBuy.tp1 > barsBuy[101].open],
]);
const lvSell = computeRiskLevels(barsBuy.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close })), barsBuy[100].date, "SELL");
suite("risk_levels_sell_geometry", [
  ["SELL sl above entry", !!lvSell && lvSell.sl > barsBuy[101].open],
  ["SELL tp1<tp2<tp3 below entry", !!lvSell && lvSell.tp1 > lvSell.tp2 && lvSell.tp2 > lvSell.tp3 && lvSell.tp1 < barsBuy[101].open],
]);

// 2) engine: BUY TP3 hit and SL-first with gap
const up = mkBars(30, 100, 0.02);
const sigBuy = { symbol: "TST", direction: "BUY" as const, entryPrice: up[0].open, sl: up[0].open * 0.9, tp1: up[0].open * 1.1, tp2: up[0].open * 1.2, tp3: up[0].open * 1.3, quantity: 100 };
const rUp = simulateStrategy("fixed_first_hit", sigBuy, up, PSX_USER_SCHEDULE_V2);
suite("engine_buy_outcomes", [
  ["BUY TP3 exit on uptrend", rUp.exitReason === "TP3" && rUp.legs[0].exitPrice === sigBuy.tp3],
  ["exit leg net = gross - costs", Math.abs(rUp.legs[0].netPnl - (rUp.legs[0].grossPnl - rUp.legs[0].totalCost)) < 0.01],
]);
const down = mkBars(30, 100, -0.02);
const rDn = simulateStrategy("fixed_first_hit", sigBuy, down, PSX_USER_SCHEDULE_V2);
suite("engine_buy_sl_gap_aware", [
  ["BUY SL on downtrend", rDn.exitReason.startsWith("SL")],
  ["gap fill at open when open beyond SL", rDn.legs[0].exitPrice <= down[1].open + 1e-9],
]);

// 3) SELL trade through the same engine (geometry correctness only)
const sigSell = { ...sigBuy, direction: "SELL" as const, sl: sigBuy.entryPrice * 1.1, tp1: sigBuy.entryPrice * 0.9, tp2: sigBuy.entryPrice * 0.8, tp3: sigBuy.entryPrice * 0.7 };
const rSell = simulateStrategy("fixed_first_hit", sigSell, down, PSX_USER_SCHEDULE_V2);
suite("engine_sell_symmetry", [
  ["SELL profits on downtrend", rSell.exitReason === "TP3" && rSell.grossPnl > 0],
  ["SELL entry-notional basis used", Math.abs(rSell.legs[0].grossPnl - (sigSell.entryPrice - rSell.legs[0].exitPrice) * 100) < 0.01],
]);

// 4) costs: V2 schedule monotone in notional; CGT only on positive gross; scale-out legs summed once
const legs3 = [{ quantity: 50, exitPrice: 110 }, { quantity: 25, exitPrice: 120 }, { quantity: 25, exitPrice: 130 }];
const cA = computeTradeCostsV2(100, 100, legs3, 2500, PSX_USER_SCHEDULE_V2, "ATL_15");
const cB = computeTradeCostsV2(50, 100, legs3.slice(0, 1), 500, PSX_USER_SCHEDULE_V2, "ATL_15");
const cLoss = computeTradeCostsV2(100, 100, [{ quantity: 100, exitPrice: 90 }], -1000, PSX_USER_SCHEDULE_V2, "ATL_15");
suite("costs_v2", [
  ["scale-out cost identity net=gross-cost", Math.abs(cA.netPnl - (2500 - cA.totalCost)) < 0.01],
  ["CGT zero on losing trade", cLoss.cgt === 0],
  ["costs scale with size (not linear-fixture, sanity only)", cA.totalBrokerage > cB.totalBrokerage],
  ["non-ATL profile supported", computeTradeCostsV2(100, 100, legs3, 2500, PSX_USER_SCHEDULE_V2, "NON_ATL_30").cgt > 0],
]);

fs.writeFileSync("data/backtest_reports/task105/_direction_tests_raw.json", JSON.stringify(out, null, 1));
const totalFailed = out.suites.reduce((s, x) => s + x.failed.length, 0);
console.log(`direction tests: ${out.suites.length} suites, ${totalFailed} failed`);
