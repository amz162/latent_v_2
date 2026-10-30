/**
 * Task 78 — Phase 3: Multi-sample historical strategy comparison.
 *
 * Runs the THREE Task 76 exit strategies over the genuine historical walk-forward
 * sample records (data/backtest_reports/runs/pilot25_step50_20261028/samples/,
 * 400 samples × 5 models × 3 horizons) using the Task 77 ATR(14) risk-level
 * overlay applied POINT-IN-TIME at each historical decision date.
 *
 * For each eligible candidate (sample × model × horizon):
 *   - Decision cutoff = the sample's exact decision date.
 *   - Risk levels = ATR(14) from OHLCV bars ≤ decision date (no look-ahead).
 *   - Entry = next symbol-specific trading-session open after the cutoff.
 *   - Scan window = entry session through t+horizon (inclusive, h bars).
 *   - Exit via fixed_first_hit / max_tp_step_trailing / scale_out_50_25_25.
 *   - STANDARD_PSX costs.
 *
 * Validation (samples 0-199) and final-test (200-399) reported separately.
 *
 * This is a RETROSPECTIVE EXPLORATORY comparison: the Task 76 exit policies +
 * ATR overlay were introduced AFTER the historical results were inspected.
 * Do NOT claim independent validation, statistical significance, or an unbiased
 * strategy win.
 *
 * Output: data/backtest_reports/task78_strategy_results_v1.json
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import {
  simulateStrategy,
  STRATEGIES,
  STRATEGY_POLICY_VERSION,
  type StrategyId,
  type StrategyBar,
  type StrategySignal,
} from "@/lib/latent/strategy-engine";
import { STANDARD_PSX } from "@/lib/latent/trading-costs";
import {
  computeRiskLevels,
  RISK_LEVEL_POLICY_ID,
  RISK_LEVEL_POLICY_VERSION,
} from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });

const SAMPLES_DIR = "data/backtest_reports/runs/pilot25_step50_20261028/samples";
const MANIFEST_PATH = "data/backtest_reports/runs/pilot25_step50_20261028/manifest.json";
const OUTPUT_PATH = "data/backtest_reports/task78_strategy_results_v1.json";
const SIGNAL_THRESHOLD = 0.01; // +1% BUY (long-only) — NOT tuned
const VAL_END_IDX = 200; // samples 0-199 = validation, 200-399 = final-test

interface SampleModelHorizon {
  sampleIdx: number;
  symbol: string;
  decisionDate: string; // YYYY-MM-DD
  decisionClose: number;
  horizon: number;
  model: string;
  predictedReturn: number;
  actualReturn: number;
  evalSkipped: boolean;
  period: "validation" | "final-test";
}

interface StrategyResultRow {
  strategyId: StrategyId;
  policyVersion: string;
  period: "validation" | "final-test";
  model: string;
  horizon: number;
  symbol: string;
  decisionDate: string;
  entryDate: string | null;
  entryPrice: number | null;
  exitReason: string | null;
  exitDate: string | null;
  grossPnl: number;
  totalCost: number;
  netPnl: number;
  isWin: boolean;
  nBarsExamined: number;
  unresolved: boolean;
  legs: number;
  omissionReason: string | null;
}

function epochMsToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function summarize(rows: StrategyResultRow[]) {
  const completed = rows.filter((r) => r.omissionReason === null && r.exitReason !== null);
  const nTrades = completed.length;
  const nWinning = completed.filter((r) => r.isWin).length;
  const grossPnl = completed.reduce((s, r) => s + r.grossPnl, 0);
  const grossProfit = completed.reduce((s, r) => s + Math.max(0, r.grossPnl), 0);
  const grossLoss = completed.reduce((s, r) => s + Math.max(0, -r.grossPnl), 0);
  const totalCosts = completed.reduce((s, r) => s + r.totalCost, 0);
  const netPnl = completed.reduce((s, r) => s + r.netPnl, 0);
  const exitReasons: Record<string, number> = {};
  for (const r of completed) { exitReasons[r.exitReason ?? "UNKNOWN"] = (exitReasons[r.exitReason ?? "UNKNOWN"] ?? 0) + 1; }
  const partialLegs = completed.reduce((s, r) => s + r.legs, 0);
  const nUnresolved = completed.filter((r) => r.unresolved).length;
  const omitted = rows.filter((r) => r.omissionReason !== null).length;
  return {
    nEligible: rows.length,
    nCompleted: nTrades,
    nOmitted: omitted,
    nWinning,
    nLosing: nTrades - nWinning,
    winRate: nTrades > 0 ? (nWinning / nTrades) * 100 : null,
    grossPnl: +grossPnl.toFixed(2),
    totalCosts: +totalCosts.toFixed(2),
    netPnl: +netPnl.toFixed(2),
    avgNetPerTrade: nTrades > 0 ? +(netPnl / nTrades).toFixed(2) : null,
    profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(3) : grossProfit > 0 ? 99 : null,
    exitReasons,
    partialLegs,
    nUnresolved,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Task 78 Phase 3 — Multi-Sample Historical Strategy Comparison");
  console.log("=".repeat(60));

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const universe = manifest.universe.symbols as string[];
  console.log(`universe: ${universe.length} symbols`);

  // Load all samples
  const sampleFiles = fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".json")).sort();
  console.log(`samples: ${sampleFiles.length}`);
  const samples = sampleFiles.map((f) => JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, f), "utf-8")));

  // Pre-load OHLCV bars per symbol (ascending by date)
  const barsBySymbol = new Map<string, { date: string; open: number; high: number; low: number; close: number }[]>();
  for (const sym of universe) {
    const bars = await db.ohlcvBar.findMany({
      where: { symbol: sym },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true },
    });
    barsBySymbol.set(sym, bars);
  }
  console.log(`OHLCV loaded for ${barsBySymbol.size} symbols`);

  // Build candidate list: sample × model × horizon
  const candidates: SampleModelHorizon[] = [];
  for (const s of samples) {
    if (s.status !== "evaluated") continue;
    const decisionDate = epochMsToDate(s.date);
    const period: "validation" | "final-test" = s.sample_idx < VAL_END_IDX ? "validation" : "final-test";
    for (const model of Object.keys(s.models || {})) {
      const mp = s.models[model];
      if (!mp || !mp.horizon_preds) continue;
      for (const h of ["5", "10", "21"]) {
        const hp = mp.horizon_preds[h];
        if (!hp) continue;
        candidates.push({
          sampleIdx: s.sample_idx,
          symbol: s.stock,
          decisionDate,
          decisionClose: s.close,
          horizon: parseInt(h),
          model,
          predictedReturn: hp.predicted,
          actualReturn: hp.actual,
          evalSkipped: hp.eval_skipped === true,
          period,
        });
      }
    }
  }
  console.log(`candidates: ${candidates.length} (sample × model × horizon)`);

  // Filter to BUY signals (predicted > +1%) + not eval_skipped + finite predicted
  const buyCandidates = candidates.filter(
    (c) => !c.evalSkipped && Number.isFinite(c.predictedReturn) && c.predictedReturn > SIGNAL_THRESHOLD
  );
  console.log(`BUY candidates (predicted > ${SIGNAL_THRESHOLD}): ${buyCandidates.length}`);

  // Run the 3 strategies over each BUY candidate
  const allRows: StrategyResultRow[] = [];
  let nOmittedNoData = 0, nOmittedNoEntry = 0, nOmittedNoLevels = 0;

  for (const c of buyCandidates) {
    const bars = barsBySymbol.get(c.symbol);
    if (!bars || bars.length === 0) {
      nOmittedNoData++;
      for (const strat of STRATEGIES) {
        allRows.push({ strategyId: strat.id, policyVersion: STRATEGY_POLICY_VERSION, period: c.period, model: c.model, horizon: c.horizon, symbol: c.symbol, decisionDate: c.decisionDate, entryDate: null, entryPrice: null, exitReason: null, exitDate: null, grossPnl: 0, totalCost: 0, netPnl: 0, isWin: false, nBarsExamined: 0, unresolved: true, legs: 0, omissionReason: "no-ohlcv-data" });
      }
      continue;
    }

    // Compute ATR risk levels at the decision date (point-in-time)
    const levels = computeRiskLevels(
      bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close })),
      c.decisionDate,
      "BUY"
    );
    if (!levels) {
      nOmittedNoLevels++;
      for (const strat of STRATEGIES) {
        allRows.push({ strategyId: strat.id, policyVersion: STRATEGY_POLICY_VERSION, period: c.period, model: c.model, horizon: c.horizon, symbol: c.symbol, decisionDate: c.decisionDate, entryDate: null, entryPrice: null, exitReason: null, exitDate: null, grossPnl: 0, totalCost: 0, netPnl: 0, isWin: false, nBarsExamined: 0, unresolved: true, legs: 0, omissionReason: "no-risk-levels (cutoff bar missing)" });
      }
      continue;
    }

    // Find entry = next session after decision date
    const cutoffIdx = bars.findIndex((b) => b.date === c.decisionDate);
    if (cutoffIdx < 0) {
      nOmittedNoLevels++;
      for (const strat of STRATEGIES) {
        allRows.push({ strategyId: strat.id, policyVersion: STRATEGY_POLICY_VERSION, period: c.period, model: c.model, horizon: c.horizon, symbol: c.symbol, decisionDate: c.decisionDate, entryDate: null, entryPrice: null, exitReason: null, exitDate: null, grossPnl: 0, totalCost: 0, netPnl: 0, isWin: false, nBarsExamined: 0, unresolved: true, legs: 0, omissionReason: "cutoff-bar-not-found" });
      }
      continue;
    }
    const entryIdx = cutoffIdx + 1;
    if (entryIdx >= bars.length) {
      nOmittedNoEntry++;
      for (const strat of STRATEGIES) {
        allRows.push({ strategyId: strat.id, policyVersion: STRATEGY_POLICY_VERSION, period: c.period, model: c.model, horizon: c.horizon, symbol: c.symbol, decisionDate: c.decisionDate, entryDate: null, entryPrice: null, exitReason: null, exitDate: null, grossPnl: 0, totalCost: 0, netPnl: 0, isWin: false, nBarsExamined: 0, unresolved: true, legs: 0, omissionReason: "no-next-session (incomplete future data)" });
      }
      continue;
    }
    const entryBar = bars[entryIdx];
    const entryPrice = entryBar.open;
    if (!entryPrice || entryPrice <= 0) {
      nOmittedNoEntry++;
      for (const strat of STRATEGIES) {
        allRows.push({ strategyId: strat.id, policyVersion: STRATEGY_POLICY_VERSION, period: c.period, model: c.model, horizon: c.horizon, symbol: c.symbol, decisionDate: c.decisionDate, entryDate: null, entryPrice: null, exitReason: null, exitDate: null, grossPnl: 0, totalCost: 0, netPnl: 0, isWin: false, nBarsExamined: 0, unresolved: true, legs: 0, omissionReason: "invalid-entry-open" });
      }
      continue;
    }

    // Scan window: entry session through t+horizon (inclusive, h bars)
    const scanEnd = Math.min(bars.length, entryIdx + c.horizon);
    const scanBars: StrategyBar[] = bars.slice(entryIdx, scanEnd).map((b) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close,
    }));

    // Quantity: 10% of PKR 1M = 100,000 allocation (trade-level, not portfolio)
    const allocation = 100_000;
    const quantity = Math.max(1, Math.floor(allocation / entryPrice));

    const signal: StrategySignal = {
      symbol: c.symbol,
      direction: "BUY",
      entryPrice,
      sl: levels.sl,
      tp1: levels.tp1,
      tp2: levels.tp2,
      tp3: levels.tp3,
      quantity,
    };

    for (const strat of STRATEGIES) {
      const result = simulateStrategy(strat.id as StrategyId, signal, scanBars, STANDARD_PSX);
      allRows.push({
        strategyId: strat.id,
        policyVersion: STRATEGY_POLICY_VERSION,
        period: c.period,
        model: c.model,
        horizon: c.horizon,
        symbol: c.symbol,
        decisionDate: c.decisionDate,
        entryDate: entryBar.date,
        entryPrice,
        exitReason: result.exitReason,
        exitDate: result.legs.length > 0 ? result.legs[result.legs.length - 1].exitDate : null,
        grossPnl: +result.grossPnl.toFixed(2),
        totalCost: +result.totalCost.toFixed(2),
        netPnl: +result.netPnl.toFixed(2),
        isWin: result.isWin,
        nBarsExamined: result.nBarsExamined,
        unresolved: result.unresolved,
        legs: result.legs.length,
        omissionReason: null,
      });
    }
  }

  console.log(`omitted: noData=${nOmittedNoData} noEntry=${nOmittedNoEntry} noLevels=${nOmittedNoLevels}`);
  console.log(`result rows: ${allRows.length}`);

  // Aggregate: per period × model × horizon × strategy
  const summary: any[] = [];
  for (const period of ["validation", "final-test"] as const) {
    for (const model of ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"]) {
      for (const horizon of [5, 10, 21]) {
        for (const strat of STRATEGIES) {
          const rows = allRows.filter(
            (r) => r.period === period && r.model === model && r.horizon === horizon && r.strategyId === strat.id
          );
          if (rows.length === 0) continue;
          summary.push({
            period, model, horizon, strategyId: strat.id,
            riskPolicyId: RISK_LEVEL_POLICY_ID,
            riskPolicyVersion: RISK_LEVEL_POLICY_VERSION,
            strategyPolicyVersion: STRATEGY_POLICY_VERSION,
            costProfile: STANDARD_PSX.id,
            ...summarize(rows),
          });
        }
      }
    }
  }

  // Overall per-strategy (all models/horizons, per period)
  const overallByStrategy: any[] = [];
  for (const period of ["validation", "final-test"] as const) {
    for (const strat of STRATEGIES) {
      const rows = allRows.filter((r) => r.period === period && r.strategyId === strat.id);
      overallByStrategy.push({ period, strategyId: strat.id, ...summarize(rows) });
    }
  }

  // Unique decision dates + symbols covered
  const decisionDates = [...new Set(buyCandidates.map((c) => c.decisionDate))];
  const symbolsCovered = [...new Set(buyCandidates.map((c) => c.symbol))];

  const report = {
    task: "task78_historical_strategy_comparison",
    runId: `task78_hist_${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceRunId: manifest.run_id,
    sourceManifestHash: null as any,
    sourceSamples: samples.length,
    valEndIdx: VAL_END_IDX,
    signalThreshold: SIGNAL_THRESHOLD,
    riskLevelPolicy: { id: RISK_LEVEL_POLICY_ID, version: RISK_LEVEL_POLICY_VERSION, formula: "ATR(14): sl=1.5×, tp1=1×, tp2=2×, tp3=3×" },
    strategyPolicy: { version: STRATEGY_POLICY_VERSION, effectiveStart: "2026-10-30" },
    costProfile: STANDARD_PSX.id,
    candidatesTotal: candidates.length,
    buyCandidates: buyCandidates.length,
    resultRows: allRows.length,
    omissionBreakdown: { noOhlcvData: nOmittedNoData, noNextSession: nOmittedNoEntry, noRiskLevels: nOmittedNoLevels },
    uniqueDecisionDates: decisionDates.length,
    symbolsCovered: symbolsCovered.length,
    perCell: summary,
    overallByStrategy,
    limitations: [
      "RETROSPECTIVE EXPLORATORY comparison — the Task 76 exit policies + ATR overlay were introduced AFTER historical results were inspected.",
      "Do NOT claim independent validation, statistical significance, or an unbiased strategy win.",
      "ATR risk levels are risk-management overlays, NOT ML-predicted targets.",
      "The +1% BUY threshold is the existing fixed criterion — NOT tuned for this comparison.",
      "Trade-level results (fixed PKR 100K notional per position) — NOT a funded portfolio.",
      "Exit legs are NOT counted as independent trades (scale-out = 1 position with ≤3 legs).",
      "The three strategies use the SAME eligible paired BUY cohort (same candidates, same entry/levels/bars).",
    ],
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report written: ${OUTPUT_PATH}`);
  console.log(`  buyCandidates: ${buyCandidates.length}, result rows: ${allRows.length}`);
  console.log(`  perCell summaries: ${summary.length}`);
  console.log("\n── Overall by strategy (validation) ──");
  for (const s of overallByStrategy.filter((s) => s.period === "validation")) {
    console.log(`  ${s.strategyId}: n=${s.nCompleted} winRate=${s.winRate?.toFixed(1) ?? "—"}% netPnl=${s.netPnl?.toFixed(0) ?? "—"} pf=${s.profitFactor ?? "—"}`);
  }
  console.log("── Overall by strategy (final-test) ──");
  for (const s of overallByStrategy.filter((s) => s.period === "final-test")) {
    console.log(`  ${s.strategyId}: n=${s.nCompleted} winRate=${s.winRate?.toFixed(1) ?? "—"}% netPnl=${s.netPnl?.toFixed(0) ?? "—"} pf=${s.profitFactor ?? "—"}`);
  }

  await db.$disconnect();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
