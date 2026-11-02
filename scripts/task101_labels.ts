/**
 * Task 101 — cost-aware trade-outcome LABEL generation via the PRODUCTION engine.
 *
 * For every sample (symbol, decisionDate) in the input grid:
 *   1. computeRiskLevels at the decision date (canonical ATR14 policy),
 *   2. simulate all three Task 76 strategies with SL-first same-candle
 *      semantics and gap-aware fills (strategy-engine.ts — the real engine),
 *   3. apply genuine psx_user_schedule_v2 costs (trading-costs.ts),
 *   4. emit labels: net>0 (Target A), TP-before-SL (Target B), net return %
 *      (Target C), MFE/MAE and TP1/TP2/TP3-hit flags (Target D).
 * Future OHLCV is used ONLY to determine outcomes — features were frozen by
 * the Python grid builder at the decision date.
 *
 * Env: TASK101_SAMPLES (input grid JSON), TASK101_LABELS (output JSON)
 * Run: bun scripts/task101_labels.ts
 */
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { simulateStrategy, STRATEGIES, type StrategyId, type StrategyBar } from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2, computeTradeCostsV2 } from "@/lib/latent/trading-costs";
import { computeRiskLevels } from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });
const SAMPLES = process.env.TASK101_SAMPLES || "data/backtest_reports/task101/trade_outcome_labels/samples.json";
const OUT = process.env.TASK101_LABELS || "data/backtest_reports/task101/trade_outcome_labels/labels.json";
const TAX: "ATL_15" | "NON_ATL_30" = "ATL_15";
const ALLOCATION = 100_000;

async function main() {
  const grid = JSON.parse(fs.readFileSync(SAMPLES, "utf-8")) as {
    samples: { sample_id: string; symbol: string; date: string }[]
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
    const scanEnd = Math.min(bars.length, entryIdx + 21); // 21-session bound = MAX_HORIZON
    const scanBars: StrategyBar[] = bars.slice(entryIdx, scanEnd).map((b) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
    // Target D path statistics over the horizon window (genuine future bars,
    // used ONLY as labels — never as features):
    const mfe = Math.max(...scanBars.map((b) => (b.high - entryPrice) / entryPrice));
    const mae = Math.min(...scanBars.map((b) => (b.low - entryPrice) / entryPrice));
    const row: any = { sample_id: s.sample_id, symbol: s.symbol, date: s.date,
      entryPrice, sl: levels.sl, tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3,
      mfePct: +(mfe * 100).toFixed(4), maePct: +(mae * 100).toFixed(4),
      strategies: {} };
    for (const strat of STRATEGIES) {
      const r = simulateStrategy(strat.id as StrategyId,
        { symbol: s.symbol, direction: "BUY", entryPrice, sl: levels.sl,
          tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3, quantity },
        scanBars, PSX_USER_SCHEDULE_V2);
      const legs = r.legs.map((l) => ({ quantity: l.quantity, exitPrice: l.exitPrice }));
      const v2 = computeTradeCostsV2(quantity, entryPrice, legs, r.grossPnl, PSX_USER_SCHEDULE_V2, TAX);
      row.strategies[strat.id] = {
        netPnl: +v2.netPnl.toFixed(2),
        netReturnPct: +((v2.netPnl / (quantity * entryPrice)) * 100).toFixed(4),
        positiveNet: v2.netPnl > 0 ? 1 : 0,                       // Target A
        tpBeforeSl: (r.bestTargetReached === "TP3" || r.exitReason === "TP3") ? 1 : 0, // Target B
        tp1Hit: r.tp1Hits > 0 ? 1 : 0,                            // Target D probabilities
        tp2Hit: r.tp2Hits > 0 ? 1 : 0,
        tp3Hit: r.tp3Hits > 0 ? 1 : 0,
        slHit: r.slHits > 0 ? 1 : 0,
        exitReason: r.exitReason,
        totalCost: +v2.totalCost.toFixed(2),
        brokerage: +v2.totalBrokerage.toFixed(2),
        psxFee: +v2.totalPSX.toFixed(6),
        nccplFee: +v2.totalNCCPL.toFixed(6),
        cdcFee: +v2.totalCDC.toFixed(6),
        cgt: +v2.cgt.toFixed(2),
        slippage: +v2.slippage.toFixed(6),
        legs: legs.length,
        holdSessions: r.legs.length ? scanBars.findIndex((b) => b.date === r.legs[r.legs.length - 1].exitDate) + 1 : null,
      };
    }
    out.push(row);
    n++;
    if (n % 1000 === 0) console.log(`labeled ${n}/${grid.samples.length}`);
  }
  fs.mkdirSync(OUT.substring(0, OUT.lastIndexOf("/")), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ costProfile: "psx_user_schedule_v2", taxProfile: TAX,
    riskPolicy: "atr14-1-1.5-2-3 (baseline)", labelEngine: "strategy-engine.ts (SL-first, gap-aware)",
    nLabeled: out.length, labels: out }, null, 1));
  console.log(`DONE labeled=${out.length} -> ${OUT}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
