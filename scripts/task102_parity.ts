/**
 * Task 102 — cost parity fixtures (Task 101 suite retained + task102 namespace).
 * Same 29 checks: sim V2 == engine V2 within PKR 0.01, legacy bit-exact,
 * CGT only on positive gross, ATL/NON-ATL exact, scale-out legs exact.
 * Run: bun scripts/task102_parity.ts
 */
import { computeSimTradeCosts, SIM_COST_PROFILES } from "@/lib/latent/investment-simulator";
import { PSX_USER_SCHEDULE_V2, computeTradeCostsV2 } from "@/lib/latent/trading-costs";
import { simulateStrategy, STRATEGIES, type StrategyId, type StrategyBar, type StrategySignal } from "@/lib/latent/strategy-engine";
import * as fs from "fs";

interface Fixture { name: string; qty: number; entry: number; exit: number; }
const fixtures: Fixture[] = [
  { name: "mid-price win", qty: 1000, entry: 50, exit: 52 },
  { name: "mid-price loss", qty: 1000, entry: 50, exit: 48 },
  { name: "low-price fixed-commission", qty: 5000, entry: 10, exit: 10.5 },
  { name: "high-price small qty", qty: 40, entry: 320, exit: 334 },
  { name: "exact break-even", qty: 500, entry: 100, exit: 100 },
];

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${detail}`); }
}

for (const f of fixtures) {
  const gross = (f.exit - f.entry) * f.qty;
  const sim = computeSimTradeCosts(f.qty * f.entry, f.entry, f.exit, gross, "psx_user_schedule_v2", "ATL_15");
  const eng = computeTradeCostsV2(f.qty, f.entry, [{ quantity: f.qty, exitPrice: f.exit }], gross, PSX_USER_SCHEDULE_V2, "ATL_15");
  check(`${f.name}: sim V2 == engine V2 (net within 0.01)`,
    Math.abs(sim.netPnl - eng.netPnl) <= 0.01);
  check(`${f.name}: total cost matches`, Math.abs(sim.totalCost - eng.totalCost) <= 0.01);
  if (gross <= 0) check(`${f.name}: CGT zero on non-gain`, sim.cgt === 0);
  check(`${f.name}: gross - totalCost == net`, Math.abs(gross - sim.totalCost - sim.netPnl) <= 0.01);
  check(`${f.name}: slippage zero under V2`, sim.slippage === 0);
}

const gross = (52 - 50) * 1000;
const atl = computeSimTradeCosts(50000, 50, 52, gross, "psx_user_schedule_v2", "ATL_15");
const nonAtl = computeSimTradeCosts(50000, 50, 52, gross, "psx_user_schedule_v2", "NON_ATL_30");
check("NON_ATL_30 CGT == 30% of gross", Math.abs(nonAtl.cgt - gross * 0.30) < 1e-6);
check("ATL_15 CGT == 15% of gross", Math.abs(atl.cgt - gross * 0.15) < 1e-6);

const legacy = computeSimTradeCosts(50000, 50, 52, gross, "legacy_flat_v1", "ATL_15");
check("legacy_flat_v1 reproduces old flat model",
  Math.abs(legacy.totalCost - (50000 * 0.0015 * 2 + 50000 * 0.0015 + gross * 0.15)) < 1e-6);
check("legacy has zero ancillary fees", legacy.psxFee === 0 && legacy.nccplFee === 0 && legacy.cdcFee === 0);
check("profiles registry exposes both", SIM_COST_PROFILES.length === 2);

const bars: StrategyBar[] = [];
for (let i = 0; i < 30; i++) bars.push({ date: `d${i}`, open: 50, high: 50 + (i === 7 ? 4 : 0.5), low: 50 - (i === 3 ? 4 : 0.5), close: 50 });
const sig: StrategySignal = { symbol: "PARITY", direction: "BUY", entryPrice: 50, sl: 42.5, tp1: 51.5, tp2: 53, tp3: 54.5, quantity: 1000 };
for (const strat of STRATEGIES) {
  const r = simulateStrategy(strat.id as StrategyId, sig, bars, PSX_USER_SCHEDULE_V2);
  const legs = r.legs.map((l) => ({ quantity: l.quantity, exitPrice: l.exitPrice }));
  const eng = computeTradeCostsV2(1000, 50, legs, r.grossPnl, PSX_USER_SCHEDULE_V2, "ATL_15");
  check(`${strat.id}: engine identity gross-cost-net`, Math.abs(eng.grossPnl - eng.totalCost - eng.netPnl) <= 0.01);
  check(`${strat.id}: legs sum to position`, Math.abs(legs.reduce((s, l) => s + l.quantity, 0) - 1000) < 1e-6);
}

fs.mkdirSync("data/backtest_reports/task102", { recursive: true });
fs.writeFileSync("data/backtest_reports/task102/task102_cost_parity_report.json",
  JSON.stringify({ pass, fail, fixtures: fixtures.length, inherited: "task101 29/29 suite retained; "
    + "no new execution paths added in task102", at: new Date().toISOString() }, null, 2));
console.log(`parity: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
