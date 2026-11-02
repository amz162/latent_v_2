/**
 * Task 104 — Phase 2: reconstruct the three production strategies through the
 * GENUINE production engine (strategy-engine.ts + computeTradeCostsV2) with
 * FULL leg-level detail (entry/exit dates, quantities, per-leg costs) so a
 * capital-constrained portfolio simulation can replay cash flows exactly.
 * Engine and protocol are byte-identical to Task 101/102 (ALLOCATION=100,000,
 * psx_user_schedule_v2, ATL_15, 21-session horizon, SL-first gap-aware).
 * Env: TASK104_OUT (default data/backtest_reports/task104/task104_engine_recon.json)
 */
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { simulateStrategy, STRATEGIES, type StrategyId, type StrategyBar } from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2, computeTradeCostsV2 } from "@/lib/latent/trading-costs";
import { computeRiskLevels } from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });
const GRID = "data/backtest_reports/task101/trade_outcome_labels/samples.json";
const OUT = process.env.TASK104_OUT || "data/backtest_reports/task104/task104_engine_recon.json";
const TAX: "ATL_15" | "NON_ATL_30" = "ATL_15";
const ALLOCATION = 100_000;

async function main() {
  const grid = JSON.parse(fs.readFileSync(GRID, "utf-8")) as {
    samples: { sample_id: string; symbol: string; date: string }[];
  };
  const barsCache = new Map<string, { date: string; open: number; high: number; low: number; close: number }[]>();
  async function barsFor(sym: string) {
    if (!barsCache.has(sym)) {
      const rows = await db.ohlcvBar.findMany({
        where: { symbol: sym }, orderBy: { date: "asc" },
        select: { date: true, open: true, high: true, low: true, close: true },
      });
      barsCache.set(sym, rows as any);
    }
    return barsCache.get(sym)!;
  }
  const out: any[] = [];
  let n = 0;
  for (const s of grid.samples) {
    const bars = await barsFor(s.symbol);
    const cutoffIdx = bars.findIndex((b) => b.date === s.date);
    if (cutoffIdx < 0 || cutoffIdx + 1 >= bars.length) { continue; }
    const entryIdx = cutoffIdx + 1;
    const entryBar = bars[entryIdx];
    const entryPrice = entryBar.open;
    if (!entryPrice || entryPrice <= 0) continue;
    const quantity = Math.max(1, Math.floor(ALLOCATION / entryPrice));
    const barList = bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close }));
    const levels = computeRiskLevels(barList, s.date, "BUY");
    if (!levels) continue;
    const scanEnd = Math.min(bars.length, entryIdx + 21);
    const scanBars: StrategyBar[] = bars.slice(entryIdx, scanEnd).map((b) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
    const row: any = { sample_id: s.sample_id, symbol: s.symbol, decision_date: s.date,
      entry_date: entryBar.date, entry_price: entryPrice, quantity,
      sl: levels.sl, tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3,
      strategies: {} };
    for (const strat of STRATEGIES) {
      const r = simulateStrategy(strat.id as StrategyId,
        { symbol: s.symbol, direction: "BUY", entryPrice, sl: levels.sl,
          tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3, quantity },
        scanBars, PSX_USER_SCHEDULE_V2);
      const legs = r.legs.map((l) => ({ quantity: l.quantity, exitPrice: l.exitPrice }));
      const v2 = computeTradeCostsV2(quantity, entryPrice, legs, r.grossPnl, PSX_USER_SCHEDULE_V2, TAX);
      row.strategies[strat.id] = {
        exit_reason: r.exitReason,
        best_target: r.bestTargetReached,
        active_stop_final: r.activeStopFinal,
        unresolved: r.unresolved,
        gross_pnl: +r.grossPnl.toFixed(4),
        total_cost: +v2.totalCost.toFixed(4),
        net_pnl: +v2.netPnl.toFixed(4),
        net_return_pct: +((v2.netPnl / (quantity * entryPrice)) * 100).toFixed(4),
        cgt: +v2.cgt.toFixed(4),
        slippage: +v2.slippage.toFixed(6),
        brokerage: +v2.totalBrokerage.toFixed(4),
        psx_fee: +v2.totalPSX.toFixed(6),
        nccpl_fee: +v2.totalNCCPL.toFixed(6),
        cdc_fee: +v2.totalCDC.toFixed(6),
        legs_detail: r.legs.map((l) => ({
          exit_date: l.exitDate, exit_price: l.exitPrice, exit_reason: l.exitReason,
          quantity: l.quantity })),
        hold_sessions: r.legs.length
          ? scanBars.findIndex((b) => b.date === r.legs[r.legs.length - 1].exitDate) + 1 : null,
        exit_date: r.legs.length ? r.legs[r.legs.length - 1].exitDate : null,
      };
    }
    out.push(row);
    n++;
    if (n % 2000 === 0) console.log(`reconstructed ${n}/${grid.samples.length}`);
  }
  fs.mkdirSync(OUT.substring(0, OUT.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    engine: "strategy-engine.ts (production, unchanged)",
    cost_profile: "psx_user_schedule_v2", tax_profile: TAX,
    allocation_reference: ALLOCATION,
    n_trades: out.length, reconstructed_at: new Date().toISOString(), trades: out }, null, 1));
  console.log(`DONE recon=${out.length} -> ${OUT}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
