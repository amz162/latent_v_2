/**
 * Task 81 — Historical multi-sample strategy comparison with corrected PSX v2 costs.
 *
 * Runs the THREE exit strategies × THREE risk variants (baseline + A + B) × TWO tax
 * profiles (ATL_15 + NON_ATL_30) over the 400 genuine walk-forward samples × 5 models
 * × 3 horizons, using the canonical PSX_USER_SCHEDULE_V2 cost model.
 *
 * Cost recomputation: the strategy engine produces the exit structure (entry, exit
 * prices, quantities, legs). Costs are recomputed using computeTradeCostsV2 (per-side
 * brokerage + PSX/NCCPL/CDC + zero slippage + position-level CGT).
 *
 * Variant A: levels anchored to the actual next-session entry open (TP1 R:R 1:1).
 * Variant B: baseline levels + net R:R ≥ 2.0 entry gate (per tax profile).
 *
 * Output: data/backtest_reports/task81_cost_rr_results_v1.json
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import {
  simulateStrategy, STRATEGIES, STRATEGY_POLICY_VERSION,
  type StrategyId, type StrategyBar, type StrategySignal,
} from "@/lib/latent/strategy-engine";
import {
  PSX_USER_SCHEDULE_V2, computeTradeCostsV2,
  type TaxProfile, TAX_RATES,
} from "@/lib/latent/trading-costs";
import {
  computeRiskLevels, computeRiskLevelsVariantA, computeVariantBEligibility,
  RISK_LEVEL_POLICY_ID, VARIANT_A_POLICY_ID, VARIANT_B_POLICY_ID,
} from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });
const SAMPLES_DIR = "data/backtest_reports/runs/pilot25_step50_20261028/samples";
const MANIFEST_PATH = "data/backtest_reports/runs/pilot25_step50_20261028/manifest.json";
const OUTPUT_PATH = "data/backtest_reports/task81_cost_rr_results_v1.json";
const SIGNAL_THRESHOLD = 0.01;
const VAL_END_IDX = 200;
const ALLOCATION = 100_000;

type RiskVariant = "baseline" | "variant_a" | "variant_b";

function epochMsToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function summarize(rows: any[]) {
  const completed = rows.filter((r) => r.skipped === false && r.exitReason);
  const n = completed.length;
  const win = completed.filter((r) => r.netPnl > 0);
  const lose = completed.filter((r) => r.netPnl <= 0);
  const grossPnl = completed.reduce((s, r) => s + r.grossPnl, 0);
  const grossProfit = completed.reduce((s, r) => s + Math.max(0, r.grossPnl), 0);
  const grossLoss = completed.reduce((s, r) => s + Math.max(0, -r.grossPnl), 0);
  const brokerage = completed.reduce((s, r) => s + r.brokerage, 0);
  const psxFee = completed.reduce((s, r) => s + r.psxFee, 0);
  const nccplFee = completed.reduce((s, r) => s + r.nccplFee, 0);
  const cdcFee = completed.reduce((s, r) => s + r.cdcFee, 0);
  const cgt = completed.reduce((s, r) => s + r.cgt, 0);
  const totalCost = completed.reduce((s, r) => s + r.totalCost, 0);
  const netPnl = completed.reduce((s, r) => s + r.netPnl, 0);
  const exitReasons: Record<string, number> = {};
  for (const r of completed) exitReasons[r.exitReason] = (exitReasons[r.exitReason] ?? 0) + 1;
  const partialLegs = completed.reduce((s, r) => s + (r.legs ?? 0), 0);
  const skipped = rows.filter((r) => r.skipped).length;
  return {
    nCandidates: rows.length, nCompleted: n, nSkipped: skipped,
    nWinning: win.length, nLosing: lose.length,
    winRate: n > 0 ? +((win.length / n) * 100).toFixed(2) : null,
    grossPnl: +grossPnl.toFixed(2), grossProfit: +grossProfit.toFixed(2), grossLoss: +grossLoss.toFixed(2),
    brokerage: +brokerage.toFixed(2), psxFee: +psxFee.toFixed(4), nccplFee: +nccplFee.toFixed(4),
    cdcFee: +cdcFee.toFixed(4), cgt: +cgt.toFixed(2), slippage: 0,
    totalCost: +totalCost.toFixed(2), netPnl: +netPnl.toFixed(2),
    avgWin: win.length > 0 ? +(win.reduce((s, r) => s + r.netPnl, 0) / win.length).toFixed(2) : null,
    avgLoss: lose.length > 0 ? +(lose.reduce((s, r) => s + r.netPnl, 0) / lose.length).toFixed(2) : null,
    avgNetPerTrade: n > 0 ? +(netPnl / n).toFixed(2) : null,
    profitFactor_gross: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(3) : grossProfit > 0 ? 99 : null,
    profitFactor_net: null as any, // computed below
    exitReasons, partialLegs,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Task 81 — Historical Strategy Comparison (v2 costs + ATR variants)");
  console.log("=".repeat(60));

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const universe = manifest.universe.symbols as string[];
  const sampleFiles = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".json")).sort();
  const samples = sampleFiles.map((f) => JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, f), "utf-8")));
  console.log(`samples: ${samples.length}, universe: ${universe.length}`);

  // Load OHLCV per symbol
  const barsBySymbol = new Map<string, { date: string; open: number; high: number; low: number; close: number }[]>();
  for (const sym of universe) {
    const bars = await db.ohlcvBar.findMany({
      where: { symbol: sym }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true },
    });
    barsBySymbol.set(sym, bars);
  }

  // Build BUY candidates
  const candidates: any[] = [];
  for (const s of samples) {
    if (s.status !== "evaluated") continue;
    const decisionDate = epochMsToDate(s.date);
    const period = s.sample_idx < VAL_END_IDX ? "validation" : "final-test";
    for (const model of Object.keys(s.models || {})) {
      const mp = s.models[model];
      if (!mp?.horizon_preds) continue;
      for (const h of ["5", "10", "21"]) {
        const hp = mp.horizon_preds[h];
        if (!hp || hp.eval_skipped) continue;
        if (!Number.isFinite(hp.predicted)) continue;
        if (hp.predicted > SIGNAL_THRESHOLD) {
          candidates.push({ sampleIdx: s.sample_idx, symbol: s.stock, decisionDate, decisionClose: s.close, horizon: parseInt(h), model, predictedReturn: hp.predicted, period });
        }
      }
    }
  }
  console.log(`BUY candidates: ${candidates.length}`);

  // Run all combinations
  const allRows: any[] = [];
  const taxProfiles: TaxProfile[] = ["ATL_15", "NON_ATL_30"];
  const variants: RiskVariant[] = ["baseline", "variant_a", "variant_b"];

  for (const c of candidates) {
    const bars = barsBySymbol.get(c.symbol);
    if (!bars || bars.length === 0) continue;
    const cutoffIdx = bars.findIndex((b) => b.date === c.decisionDate);
    if (cutoffIdx < 0) continue;
    const entryIdx = cutoffIdx + 1;
    if (entryIdx >= bars.length) continue; // no next session
    const entryBar = bars[entryIdx];
    const entryPrice = entryBar.open;
    if (!entryPrice || entryPrice <= 0) continue;
    const quantity = Math.max(1, Math.floor(ALLOCATION / entryPrice));

    // Baseline risk levels (cutoff-close-anchored)
    const baselineLevels = computeRiskLevels(
      bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close })),
      c.decisionDate, "BUY"
    );
    if (!baselineLevels) continue;

    // Variant A levels (entry-open-anchored)
    const variantALevels = computeRiskLevelsVariantA(
      bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close })),
      c.decisionDate, entryPrice, "BUY"
    );

    // Scan window: entry through t+horizon (inclusive, h bars)
    const scanEnd = Math.min(bars.length, entryIdx + c.horizon);
    const scanBars: StrategyBar[] = bars.slice(entryIdx, scanEnd).map((b) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close,
    }));

    for (const variant of variants) {
      // Determine levels + eligibility for this variant
      let levels = baselineLevels;
      let skipped = false;
      let skipReason: string | null = null;
      let variantBRR: number | null = null;

      if (variant === "variant_a") {
        levels = variantALevels ?? baselineLevels;
      } else if (variant === "variant_b") {
        // Variant B: check eligibility PER TAX PROFILE (different CGT → different netRR)
        // We'll handle the per-tax eligibility inside the tax loop below.
        // For now, mark that Variant B needs per-tax eligibility.
      }

      for (const tax of taxProfiles) {
        // Variant B: check eligibility for this tax profile
        if (variant === "variant_b") {
          const elig = computeVariantBEligibility(entryPrice, baselineLevels.sl, baselineLevels.tp3, quantity, PSX_USER_SCHEDULE_V2, tax);
          variantBRR = elig.netRR;
          if (!elig.eligible) {
            for (const strat of STRATEGIES) {
              allRows.push({
                model: c.model, horizon: c.horizon, period: c.period, symbol: c.symbol,
                decisionDate: c.decisionDate, variant, strategy: strat.id, taxProfile: tax,
                skipped: true, skipReason: "skipped_rr_below_minimum", netRR: +elig.netRR.toFixed(4),
                entryPrice, exitReason: null, grossPnl: 0, brokerage: 0, psxFee: 0, nccplFee: 0, cdcFee: 0, cgt: 0, slippage: 0, totalCost: 0, netPnl: 0, legs: 0,
              });
            }
            continue; // skip this tax profile for variant B
          }
        }

        // Run the 3 strategies
        for (const strat of STRATEGIES) {
          const signal: StrategySignal = {
            symbol: c.symbol, direction: "BUY",
            entryPrice, sl: levels.sl, tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3, quantity,
          };
          const result = simulateStrategy(strat.id as StrategyId, signal, scanBars, PSX_USER_SCHEDULE_V2);

          // Recompute costs with v2 model
          const exitLegs = result.legs.map((l) => ({ quantity: l.quantity, exitPrice: l.exitPrice }));
          const v2 = computeTradeCostsV2(quantity, entryPrice, exitLegs, result.grossPnl, PSX_USER_SCHEDULE_V2, tax);

          allRows.push({
            model: c.model, horizon: c.horizon, period: c.period, symbol: c.symbol,
            decisionDate: c.decisionDate, variant, strategy: strat.id, taxProfile: tax,
            skipped: false, skipReason: null, netRR: variantBRR,
            entryPrice, exitReason: result.exitReason,
            grossPnl: +result.grossPnl.toFixed(2),
            brokerage: +v2.totalBrokerage.toFixed(4), psxFee: +v2.totalPSX.toFixed(6),
            nccplFee: +v2.totalNCCPL.toFixed(6), cdcFee: +v2.totalCDC.toFixed(6),
            cgt: +v2.cgt.toFixed(2), slippage: 0, totalCost: +v2.totalCost.toFixed(2),
            netPnl: +v2.netPnl.toFixed(2), legs: result.legs.length,
          });
        }
      }
    }
  }

  console.log(`result rows: ${allRows.length}`);

  // Aggregate: per model × horizon × period × variant × strategy × tax
  const cells: any[] = [];
  for (const model of ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"]) {
    for (const horizon of [5, 10, 21]) {
      for (const period of ["validation", "final-test"]) {
        for (const variant of variants) {
          for (const strat of STRATEGIES) {
            for (const tax of taxProfiles) {
              const rows = allRows.filter((r) => r.model === model && r.horizon === horizon && r.period === period && r.variant === variant && r.strategy === strat.id && r.taxProfile === tax);
              if (rows.length === 0) continue;
              const s = summarize(rows);
              // Net profit factor: sum(net profit of winners) / sum(abs(net loss of losers))
              const completed = rows.filter((r) => !r.skipped && r.exitReason);
              const netProfit = completed.filter((r) => r.netPnl > 0).reduce((s, r) => s + r.netPnl, 0);
              const netLoss = completed.filter((r) => r.netPnl <= 0).reduce((s, r) => s + Math.abs(r.netPnl), 0);
              s.profitFactor_net = netLoss > 0 ? +(netProfit / netLoss).toFixed(3) : netProfit > 0 ? 99 : null;
              cells.push({ model, horizon, period, variant, strategy: strat.id, taxProfile: tax, costProfile: "psx_user_schedule_v2", ...s });
            }
          }
        }
      }
    }
  }

  // Overall per variant × strategy × tax (all models/horizons)
  const overall: any[] = [];
  for (const variant of variants) {
    for (const strat of STRATEGIES) {
      for (const tax of taxProfiles) {
        const rows = allRows.filter((r) => r.variant === variant && r.strategy === strat.id && r.taxProfile === tax);
        if (rows.length === 0) continue;
        const s = summarize(rows);
        const completed = rows.filter((r) => !r.skipped && r.exitReason);
        const netProfit = completed.filter((r) => r.netPnl > 0).reduce((s, r) => s + r.netPnl, 0);
        const netLoss = completed.filter((r) => r.netPnl <= 0).reduce((s, r) => s + Math.abs(r.netPnl), 0);
        s.profitFactor_net = netLoss > 0 ? +(netProfit / netLoss).toFixed(3) : netProfit > 0 ? 99 : null;
        overall.push({ variant, strategy: strat.id, taxProfile: tax, ...s });
      }
    }
  }

  const report = {
    task: "task81_cost_rr_historical",
    createdAt: new Date().toISOString(),
    sourceRunId: manifest.run_id,
    costProfile: PSX_USER_SCHEDULE_V2.id,
    riskVariants: { baseline: RISK_LEVEL_POLICY_ID, variant_a: VARIANT_A_POLICY_ID, variant_b: VARIANT_B_POLICY_ID },
    strategyPolicy: STRATEGY_POLICY_VERSION,
    taxProfiles,
    signalThreshold: SIGNAL_THRESHOLD,
    candidatesTotal: candidates.length,
    resultRows: allRows.length,
    cells: cells.length,
    perCell: cells,
    overall,
    limitations: [
      "RETROSPECTIVE EXPLORATORY comparison — exit policies + ATR overlay introduced after historical results were inspected.",
      "Costs use PSX_USER_SCHEDULE_V2 (zero slippage, per-side brokerage, ancillary fees, position-level CGT).",
      "Variant B eligibility calculated separately per tax profile (CGT affects net R:R).",
      "Do NOT claim significance or profitability. Slippage = 0 confirmed.",
    ],
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report: ${OUTPUT_PATH}`);
  console.log(`  cells: ${cells.length}, result rows: ${allRows.length}`);
  console.log("\n── Overall (final-test, ATL_15) ──");
  for (const o of overall.filter((o) => o.taxProfile === "ATL_15")) {
    console.log(`  ${o.variant}/${o.strategy}: n=${o.nCompleted} win=${o.winRate}% net=${o.netPnl} PF_gross=${o.profitFactor_gross} PF_net=${o.profitFactor_net}`);
  }
  console.log("\n── Variant B eligible counts ──");
  for (const tax of taxProfiles) {
    const eligible = allRows.filter((r) => r.variant === "variant_b" && r.taxProfile === tax && !r.skipped).length;
    const skipped = allRows.filter((r) => r.variant === "variant_b" && r.taxProfile === tax && r.skipped).length;
    console.log(`  ${tax}: eligible=${eligible} skipped=${skipped}`);
  }
  await db.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
