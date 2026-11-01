/**
 * Task 100 — cost-aware PSX backtest over ARBITRARY OOS signal sets.
 * Reuses Latent.pk's existing execution system EXACTLY (no reimplementation),
 * identical to scripts/task99_backtest.ts:
 *   - src/lib/latent/strategy-engine.ts  (SL-first, gap-aware, TP1/TP2/TP3,
 *     Fixed First Hit / Max TP Step Trailing / Scale Out 50/25/25)
 *   - src/lib/latent/trading-costs.ts    (psx_user_schedule_v2, ATL_15 /
 *     NON_ATL_30, both-side costs, zero slippage)
 *   - src/lib/latent/risk-levels.ts      (baseline + variant_a/variant_b)
 * Parametrised by env:
 *   TASK100_SIGNALS — input JSON {modelId: {candidates:[{symbol, decisionDate:
 *                     "YYYY-MM-DD", horizon, period, predictedReturn}]}}
 *   TASK100_OUT     — output JSON path
 * Adds a compact per-row ledger (per strategy cell) for cost reconciliation:
 * gross - totalCost == net; CGT zero on losses; leg counts recorded.
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import {
  simulateStrategy, STRATEGIES,
  type StrategyId, type StrategyBar, type StrategySignal,
} from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2, computeTradeCostsV2, type TaxProfile } from "@/lib/latent/trading-costs";
import {
  computeRiskLevels, computeRiskLevelsVariantA, computeVariantBEligibility,
  RISK_LEVEL_POLICY_ID, VARIANT_A_POLICY_ID, VARIANT_B_POLICY_ID,
} from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });
const SIGNALS = process.env.TASK100_SIGNALS || "data/backtest_reports/task100/predictions/task100_signals.json";
const OUT = process.env.TASK100_OUT || "data/backtest_reports/task100/task100_strategy_cells.json";
const ALLOCATION = 100_000;
type RiskVariant = "baseline" | "variant_a" | "variant_b";

function summarize(rows: any[]) {
  const completed = rows.filter((r) => r.skipped === false && r.exitReason);
  const n = completed.length;
  const win = completed.filter((r) => r.netPnl > 0);
  const lose = completed.filter((r) => r.netPnl <= 0);
  const grossPnl = completed.reduce((s, r) => s + r.grossPnl, 0);
  const grossProfit = completed.reduce((s, r) => s + Math.max(0, r.grossPnl), 0);
  const grossLoss = completed.reduce((s, r) => s + Math.max(0, -r.grossPnl), 0);
  const netPnl = completed.reduce((s, r) => s + r.netPnl, 0);
  let peak = 0, cum = 0, maxDD = 0;
  const sortedByDate = [...completed].sort((a, b) => a.entryDate < b.entryDate ? -1 : 1);
  for (const r of sortedByDate) { cum += r.netPnl; peak = Math.max(peak, cum); maxDD = Math.min(maxDD, cum - peak); }
  const holdDays = completed.map((r) => r.holdSessions).filter((h: any) => Number.isFinite(h));
  return {
    nCandidates: rows.length, nCompleted: n,
    nSkipped: rows.filter((r) => r.skipped).length,
    nWinning: win.length, nLosing: lose.length,
    winRate: n > 0 ? +((win.length / n) * 100).toFixed(2) : null,
    grossPnl: +grossPnl.toFixed(2),
    grossProfit: +grossProfit.toFixed(2), grossLoss: +grossLoss.toFixed(2),
    brokerage: +completed.reduce((s, r) => s + r.brokerage, 0).toFixed(2),
    psxFee: +completed.reduce((s, r) => s + r.psxFee, 0).toFixed(2),
    nccplFee: +completed.reduce((s, r) => s + r.nccplFee, 0).toFixed(2),
    cdcFee: +completed.reduce((s, r) => s + r.cdcFee, 0).toFixed(2),
    cgt: +completed.reduce((s, r) => s + r.cgt, 0).toFixed(2),
    slippage: +completed.reduce((s, r) => s + (r.slippage ?? 0), 0).toFixed(2),
    totalCost: +completed.reduce((s, r) => s + r.totalCost, 0).toFixed(2),
    netPnl: +netPnl.toFixed(2),
    avgWin: win.length ? +(win.reduce((s, r) => s + r.netPnl, 0) / win.length).toFixed(2) : null,
    avgLoss: lose.length ? +(lose.reduce((s, r) => s + r.netPnl, 0) / lose.length).toFixed(2) : null,
    avgNetPerTrade: n > 0 ? +(netPnl / n).toFixed(2) : null,
    profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(3) : (grossProfit > 0 ? 99 : null),
    maxDrawdown_net: +maxDD.toFixed(2),
    avgHoldSessions: holdDays.length ? +(holdDays.reduce((a: number, b: number) => a + b, 0) / holdDays.length).toFixed(2) : null,
    exitReasons: completed.reduce((m: Record<string, number>, r) => { m[r.exitReason] = (m[r.exitReason] ?? 0) + 1; return m; }, {}),
  };
}

async function main() {
  if (!fs.existsSync(SIGNALS)) { console.error("signals file missing: " + SIGNALS); process.exit(1); }
  const sig = JSON.parse(fs.readFileSync(SIGNALS, "utf-8"));
  const taxProfiles: TaxProfile[] = ["ATL_15", "NON_ATL_30"];
  const variants: RiskVariant[] = ["baseline", "variant_a", "variant_b"];
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

  const report: any = { costProfile: "psx_user_schedule_v2", taxProfiles, riskVariants: {
    baseline: RISK_LEVEL_POLICY_ID, variant_a: VARIANT_A_POLICY_ID, variant_b: VARIANT_B_POLICY_ID,
  }, strategies: STRATEGIES.map((s) => s.id), models: {}, generatedAt: new Date().toISOString() };
  const ledger: any[] = [];

  for (const [model, blk] of Object.entries<any>(sig)) {
    const rows: any[] = [];
    const bySym = new Map<string, any[]>();
    for (const c of blk.candidates) bySym.set(c.symbol, [...(bySym.get(c.symbol) ?? []), c]);
    for (const [sym, cands] of bySym) {
      const bars = await barsFor(sym);
      for (const c of cands) {
        const cutoffIdx = bars.findIndex((b) => b.date === c.decisionDate);
        if (cutoffIdx < 0) continue;
        const entryIdx = cutoffIdx + 1;
        if (entryIdx >= bars.length) continue;
        const entryBar = bars[entryIdx];
        const entryPrice = entryBar.open;
        if (!entryPrice || entryPrice <= 0) continue;
        const quantity = Math.max(1, Math.floor(ALLOCATION / entryPrice));
        const barList = bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close }));
        const baselineLevels = computeRiskLevels(barList, c.decisionDate, "BUY");
        if (!baselineLevels) continue;
        const variantALevels = computeRiskLevelsVariantA(barList, c.decisionDate, entryPrice, "BUY");
        const scanEnd = Math.min(bars.length, entryIdx + c.horizon);
        const scanBars: StrategyBar[] = bars.slice(entryIdx, scanEnd).map((b) => ({
          date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
        for (const variant of variants) {
          for (const tax of taxProfiles) {
            let levels = baselineLevels;
            let skipped = false, skipReason: string | null = null;
            if (variant === "variant_a") { levels = variantALevels ?? baselineLevels; }
            else if (variant === "variant_b") {
              const elig = computeVariantBEligibility(entryPrice, baselineLevels.sl, baselineLevels.tp3, quantity, PSX_USER_SCHEDULE_V2, tax);
              if (!elig.eligible) { skipped = true; skipReason = "skipped_rr_below_minimum"; }
            }
            for (const strat of STRATEGIES) {
              if (skipped) {
                rows.push({ model, period: c.period, symbol: sym, decisionDate: c.decisionDate, variant, strategy: strat.id, taxProfile: tax, skipped: true, skipReason, exitReason: null, grossPnl: 0, brokerage: 0, psxFee: 0, nccplFee: 0, cdcFee: 0, cgt: 0, slippage: 0, totalCost: 0, netPnl: 0, entryDate: entryBar.date, holdSessions: null, legs: 0 });
                continue;
              }
              const signal: StrategySignal = { symbol: sym, direction: "BUY", entryPrice, sl: levels.sl, tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3, quantity };
              const r = simulateStrategy(strat.id as StrategyId, signal, scanBars, PSX_USER_SCHEDULE_V2);
              const exitLegs = r.legs.map((l) => ({ quantity: l.quantity, exitPrice: l.exitPrice }));
              const v2 = computeTradeCostsV2(quantity, entryPrice, exitLegs, r.grossPnl, PSX_USER_SCHEDULE_V2, tax);
              const firstEntry = r.entryDate || entryBar.date;
              const exitLast = r.legs.length ? r.legs[r.legs.length - 1].exitDate : null;
              const hold = exitLast ? Math.max(1, bars.findIndex((b) => b.date >= exitLast) - bars.findIndex((b) => b.date >= firstEntry)) : null;
              rows.push({ model, period: c.period, symbol: sym, decisionDate: c.decisionDate, variant, strategy: strat.id, taxProfile: tax, skipped: false, skipReason: null, entryDate: firstEntry, exitReason: r.exitReason, grossPnl: +r.grossPnl.toFixed(2), brokerage: +v2.totalBrokerage.toFixed(4), psxFee: +v2.totalPSX.toFixed(6), nccplFee: +v2.totalNCCPL.toFixed(6), cdcFee: +v2.totalCDC.toFixed(6), cgt: +v2.cgt.toFixed(2), slippage: 0, totalCost: +v2.totalCost.toFixed(2), netPnl: +v2.netPnl.toFixed(2), legs: r.legs.length, holdSessions: hold });
            }
          }
        }
      }
    }
    const per = (period: string) => {
      const out: any = {};
      for (const v of variants) for (const tax of taxProfiles) {
        const key = `${v}__${tax}`;
        const rowsVP = rows.filter((r) => r.period === period && r.variant === v && r.taxProfile === tax);
        out[key] = {};
        for (const strat of STRATEGIES) out[key][strat.id] = summarize(rowsVP.filter((r) => r.strategy === strat.id));
      }
      return out;
    };
    report.models[model] = { totalCandidates: blk.candidates.length, threshold: blk.threshold ?? null, validation: per("validation"), finalTest: per("final-test") };
    for (const r of rows) ledger.push({ model, ...r });
    console.log(`${model}: candidates=${blk.candidates.length} rows=${rows.length}`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  fs.writeFileSync(OUT.replace(/\.json$/, "_ledger.json"), JSON.stringify(ledger));
  console.log("wrote", OUT);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
