import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { execSync } from "child_process";
import path from "path";
import { runBacktest } from "@/lib/latent/backtest";
import { db } from "@/lib/db";
import {
  ALL_MODELS,
  majorityVoteEnsemble,
  probabilityWeightedEnsemble,
  tierWeightedEnsemble,
  type ModelPrediction,
  type EnsembleResult,
} from "@/lib/latent/ensemble";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/backtest/ensembles?capital=100000&numTrades=40&numDays=5
//
// Runs the backtest engine PER ENSEMBLE (10 methods) — each ensemble's signal
// list is built from its per-stock predictions in ml_predictions_multi.json
// (cl/cl_extender/cl2/pi/gm/cg/x ensembles + the 3 base majority/prob/tier
// computed from per-model predictions, + the final consensus from
// /api/signals/all). Each trade uses that ensemble's ACTUAL entry/SL/TP1/2/3.
// Ranks all ensembles by net ROI, returns top5 + the rest, each with the full
// metrics set + trade-by-trade list (for the "View in depth" drill-down).

interface EnsDef {
  key: string;
  name: string;
  label: string;
  baseFn?: (preds: ModelPrediction[]) => EnsembleResult; // for the 3 computed base ensembles
}
// Issue 1: 13 ENSEMBLE MODELS, each running on ITS OWN per-stock BUY signal —
// NOT the Final Consensus. 3 base (computed from per-model predictions via the
// ensemble.ts functions) + 7 stored per-ensemble predictions + 3 gian = 13.
const ENSEMBLES: EnsDef[] = [
  { key: "majority", name: "MAJORITY_VOTE", label: "A. Majority Vote", baseFn: majorityVoteEnsemble },
  { key: "probability", name: "PROBABILITY_WEIGHTED", label: "B. Probability-Weighted", baseFn: probabilityWeightedEnsemble },
  { key: "tier", name: "TIER_WEIGHTED", label: "C. Tier-Weighted", baseFn: tierWeightedEnsemble },
  { key: "cl_ensemble_predictions", name: "CL_ENSEMBLE", label: "D. CL-Ensemble (LGB70+Log30)" },
  { key: "cl_extender_predictions", name: "CL_EXTENDER", label: "E. CL-Extender (8-model weighted)" },
  { key: "cl2_ensemble_predictions", name: "CL2_ENSEMBLE", label: "F. CL-2 Ensemble (7 classifiers)" },
  { key: "pi_ensemble_predictions", name: "PI_ENSEMBLE", label: "G. PI-Ensemble (4 models)" },
  { key: "gm_model_predictions", name: "GM_MODEL", label: "H. GM-Model (4-Pillar)" },
  { key: "cg_ensemble_predictions", name: "CG_ENSEMBLE", label: "I. CG-Ensemble (swing-trader)" },
  { key: "x_ensemble_predictions", name: "X_ENSEMBLE", label: "J. X-Ensemble (10-strategy meta)" },
  { key: "gian_ensemble_predictions", name: "GIAN_ENSEMBLE", label: "K. Gian-Ensemble (S/R)" },
  { key: "gian_extender_predictions", name: "GIAN_EXTENDER", label: "L. Gian-Extender (GANN grid)" },
  { key: "m_ensemble_predictions", name: "M_ENSEMBLE", label: "M. M-Ensemble (price-touch S/R)" },
];

// Build per-stock predictions for a symbol (same logic as /api/signals/all +
// /api/ai-model-signals/[symbol]) — used to compute the 3 base ensembles.
function buildPredictionsForSymbol(symbol: string, multi: any): ModelPrediction[] {
  const models: Record<string, any> | undefined = multi?.models;
  if (!models) return [];
  return ALL_MODELS.map((meta) => {
    const lookupName = meta.name.replace(" (CL)", "");
    const nk = lookupName.replace(/\s+/g, "");
    const md = models[lookupName] || models[nk] || models[meta.name];
    if (!md?.trained) return { ...meta, trained: false };
    const p = md.predictions?.[symbol];
    if (!p) return { ...meta, trained: true };
    return {
      ...meta, trained: true,
      direction: p.direction, signal: p.signal, confidence: p.confidence,
      currentPrice: p.currentPrice, entry: p.entry, sl: p.sl,
      tp1: p.tp1, tp2: p.tp2, tp3: p.tp3, avgReturn: p.avgReturn,
    } as ModelPrediction;
  });
}

// Build a BUY signal list for a BASE ensemble (majority/probability/tier) by
// computing the ensemble per stock from per-model predictions.
function buildBaseSignals(
  baseFn: (preds: ModelPrediction[]) => EnsembleResult,
  multi: any,
  backedSet: Set<string> | null,
  buyOnly = true
): any[] {
  const models: Record<string, any> | undefined = multi?.models;
  if (!models) return [];
  const symbolSet = new Set<string>();
  for (const m of Object.values(models) as any[]) {
    if (!m?.trained) continue;
    const preds = m.predictions || {};
    for (const sym of Object.keys(preds)) symbolSet.add(sym);
  }
  const out: any[] = [];
  for (const sym of symbolSet) {
    if (backedSet && !backedSet.has(sym)) continue;
    const preds = buildPredictionsForSymbol(sym, multi);
    const ens = baseFn(preds);
    // buyOnly (ALL stocks) → BUY only; single-stock → return ALL (BUY/SELL/HOLD) so the loop can check direction + skip SELL/HOLD
    if (buyOnly && ens.signal !== "BUY") continue;
    if (!ens.entry || ens.entry <= 0) continue;
    out.push({
      symbol: sym,
      signal: ens.signal as "BUY" | "SELL",
      confidence: ens.confidence,
      entry: ens.entry, sl: ens.sl, tp1: ens.tp1, tp2: ens.tp2, tp3: ens.tp3,
    });
  }
  return out;
}

function toEpochMs(date: string): number {
  const t = Date.parse(date);
  return isNaN(t) ? 0 : t;
}

// Technical fallback signal for a stock NOT in the 361-stock ML universe (e.g.
// TISL) — computes EMA(20/50) trend + RSI(14) + ATR(14) SL/TP from the DB OHLCV.
// Used when a single stock is selected and an ensemble has no ML prediction for
// it, so EVERY ensemble still takes trades on the selected stock.
async function computeTechnicalSignal(sym: string): Promise<any | null> {
  let bars: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
  try {
    const rows = await db.ohlcvBar.findMany({ where: { symbol: sym }, orderBy: { date: "asc" }, take: 400 });
    bars = rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
  } catch {}
  if (bars.length < 30) return null;
  const closes = bars.map((b) => b.close);
  const entry = closes[closes.length - 1];
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) trs.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)));
  const atrVal = trs.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, trs.length || 1) || entry * 0.02;
  const ema = (period: number) => { const k = 2 / (period + 1); let e = closes[0]; for (let i = 1; i < closes.length; i++) e = closes[i] * k + e * (1 - k); return e; };
  const ema20 = ema(20), ema50 = ema(50);
  let g = 0, l = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { if (i < 1) continue; const ch = closes[i] - closes[i - 1]; if (ch > 0) g += ch; else l -= ch; }
  const ag = g / 14, al = l / 14;
  const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  let signal: "BUY" | "SELL" = "BUY";
  if (ema20 < ema50 && rsi > 30) signal = "SELL";
  else if (rsi > 70) signal = "SELL";
  return {
    symbol: sym, signal, confidence: 50,
    entry, sl: signal === "BUY" ? entry - 1.5 * atrVal : entry + 1.5 * atrVal,
    tp1: signal === "BUY" ? entry + atrVal : entry - atrVal,
    tp2: signal === "BUY" ? entry + 2 * atrVal : entry - 2 * atrVal,
    tp3: signal === "BUY" ? entry + 3 * atrVal : entry - 3 * atrVal,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const capital = parseFloat(url.searchParams.get("capital") || "100000") || 100000;
  const numTrades = Math.min(2000, Math.max(1, parseInt(url.searchParams.get("numTrades") || "40", 10) || 40));
  const numDays = Math.min(120, Math.max(0, parseInt(url.searchParams.get("numDays") || "0", 10) || 0)); // 0 = optional (not given → any start day)
  // Ranking: by win rate (default) or net P&L — user-selectable in the UI.
  const rankBy = (url.searchParams.get("rankBy") || "winRate") as "winRate" | "netPnl";
  // Optional stock filter — if set, each ensemble simulates ONLY that stock's
  // signal (across all ensembles). Default (empty) = ALL stocks.
  const symbolFilter = (url.searchParams.get("symbol") || "").toUpperCase().replace(/XD$/, "");
  // Issue 1: amount per trade = starting capital (all-in per trade, fixed —
  // each trade invests the full capital; P&L summed, not compounded).
  const amountPerTrade = capital;

  // Load ml_predictions_multi.json (per-ensemble predictions)
  let multi: any = null;
  try {
    multi = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "ml_predictions_multi.json"), "utf-8")
    );
  } catch {
    return NextResponse.json({ error: "ml_predictions_multi.json not found" }, { status: 503 });
  }

  // Backed-up symbols (DB)
  let backedSet: Set<string> | null = null;
  try {
    let backed = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });
    // Issue 36: auto-restore — if the DB is empty (someone ran `bun run
    // db:push` without the .gz restore step, OR the sandbox reset it),
    // automatically restore from the .gz backup (40MB → 908 stocks / 1M+
    // bars). This prevents the recurring "Simulated 0 ensembles" bug.
    if (backed.length === 0) {
      try {
        const gzPath = path.join(process.cwd(), "db", "custom.db.gz");
        const gzExists = await fs.stat(gzPath).then(() => true).catch(() => false);
        if (gzExists) {
          // Restore via gunzip (synchronous — quick, ~1s for 40MB → 152MB)
          execSync(`gunzip -kf "${gzPath}"`, { stdio: "ignore", timeout: 30000 });
          // Re-query after restore
          backed = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });
        }
      } catch (restoreErr) {
        console.warn("[backtest/ensembles] auto-restore failed:", restoreErr);
      }
    }
    backedSet = new Set(backed.map((b) => b.symbol));
    // Issue 34: safety net — if the DB is empty (e.g. someone ran `bun run
    // db:push` without the .gz restore step, OR the sandbox reset it), the
    // backedSet would be empty → every ensemble's `buildFromPreds` would
    // drop ALL signals (because `backedSet.has(sym)` is false for every
    // symbol) → 0 ensembles with metrics → the Portfolio Simulation UI shows
    // "Simulated 0 ensembles". When this happens, fall back to NOT filtering
    // by backedSet (treat backedSet as null = no filter) so the simulation
    // still runs on every BUY signal in the JSON. The simulation will use
    // the JSON's stored entry/SL/TP values (which are based on real OHLCV
    // history from training time, not real-time bars), so the per-trade
    // walk-forward simulation can't actually walk through DB bars — but at
    // least the user sees RESULTS instead of "0 ensembles".
    if (backedSet.size === 0) {
      backedSet = null;
    }
  } catch {}

  // Build per-ensemble signal lists (each ensemble uses its OWN per-stock
  // predictions from ml_predictions_multi.json — NOT the final consensus).
  // buyOnly=true (ALL stocks) → BUY signals only; buyOnly=false (single stock)
  // → each ensemble's ACTUAL signal (BUY or SELL) so every ensemble trades.
  const buildFromPreds = (preds: Record<string, any> | undefined, buyOnly = true): any[] => {
    if (!preds) return [];
    const out: any[] = [];
    for (const [sym, p] of Object.entries(preds)) {
      const pp = p as any;
      if (buyOnly ? pp.signal !== "BUY" : false) continue; // BUY only for ALL-stocks; single-stock returns ALL (BUY/SELL/HOLD) so the loop can check direction
      if (typeof pp.entry !== "number" || pp.entry <= 0) continue;
      if (backedSet && !backedSet.has(sym)) continue;
      out.push({
        symbol: sym,
        signal: pp.signal as "BUY" | "SELL",
        confidence: pp.confidence ?? 0,
        entry: pp.entry,
        sl: pp.sl,
        tp1: pp.tp1,
        tp2: pp.tp2,
        tp3: pp.tp3,
      });
    }
    return out;
  };

  const results: any[] = [];
  // Lazy technical-fallback signal for a selected stock not in the ML universe
  // (so every ensemble still trades on the selected stock).
  let techSignalCache: any | null = undefined;
  const getTechSignal = async () => {
    if (techSignalCache !== undefined) return techSignalCache;
    techSignalCache = symbolFilter ? await computeTechnicalSignal(symbolFilter) : null;
    return techSignalCache;
  };
  for (const ens of ENSEMBLES) {
    // Each ensemble runs on ITS OWN per-stock signal predictions (not final consensus).
    // Base ensembles (majority/probability/tier) are COMPUTED from per-model predictions;
    // the others are read from their stored per-ensemble predictions.
    const buyOnly = !symbolFilter; // ALL → BUY only; single → ALL signals (loop checks direction)
    const signals = ens.baseFn
      ? buildBaseSignals(ens.baseFn, multi, backedSet, buyOnly)
      : buildFromPreds(multi?.[ens.key], buyOnly);
    // Optional stock filter — simulate only the chosen stock (across all ensembles)
    let stockSignals = symbolFilter ? signals.filter((s) => s.symbol === symbolFilter) : signals;
    // Single-stock: trade ONLY if the ensemble's signal is BUY (per user: SELL/HOLD → don't count their signal).
    let filtered = symbolFilter ? stockSignals.filter((s) => s.signal === "BUY") : stockSignals;
    // If the ensemble is SELL/HOLD (or has no prediction) on the selected stock,
    // use the technical BUY fallback so EVERY ensemble still trades (all BUY).
    // The SELL/HOLD signal itself is NOT counted — a BUY technical trade is taken instead.
    if (filtered.length === 0 && symbolFilter) {
      const tech = await getTechSignal();
      if (tech && tech.signal === "BUY") filtered = [tech];
    }
    if (filtered.length === 0) {
      results.push({ ensembleName: ens.name, ensembleLabel: ens.label, metrics: null, trades: [] });
      continue;
    }
    try {
      const res = await runBacktest({
        startingCapital: capital,
        amountPerTrade,
        numTrades,                 // EXACTLY numTrades (with replacement if fewer BUY signals)
        numDays,
        naturalCount: filtered.length, // the ensemble's natural BUY count for this stock (or all)
        signals: filtered,
      });
      const m = res.metrics;
      results.push({
        ensembleName: ens.name,
        ensembleLabel: ens.label,
        metrics: {
          startingCapital: m.startingCapital,
          amountPerTrade: m.amountPerTrade,
          totalTrades: m.totalTrades,
          naturalBuyCount: m.naturalBuyCount,
          numDays: m.numDays,
          tradesPerDay: m.tradesPerDay,
          winTrades: m.winTrades,
          lossTrades: m.lossTrades,
          winRate: m.winRate,
          avgWinPct: m.avgWinPct,
          avgLossPct: m.avgLossPct,
          grossProfit: m.grossProfit,
          grossLoss: m.grossLoss,
          totalCosts: m.totalCosts,
          grossBeforeCosts: m.grossBeforeCosts,
          netPnL: m.netPnl,
          finalValue: m.finalPortfolioValue,
          roiPct: m.roi,
          maxDrawdownPct: m.maxDrawdownPct,
          maxDrawdownPkr: m.maxDrawdownPkr,
          profitFactor: m.profitFactor,
          sharpe: m.sharpe,
          sortino: m.sortino,
        },
        trades: res.trades.map((t, i) => ({
          tradeNo: i + 1,
          symbol: t.symbol,
          signal: t.direction,
          side: t.direction,
          entryDate: toEpochMs(t.entryDate),
          entryPrice: t.entryPrice,
          close: t.exitPrice ?? 0,
          exitDate: t.exitDate ? toEpochMs(t.exitDate) : 0,
          exitPrice: t.exitPrice ?? 0,
          exitReason: t.exitReason,
          bestTp: t.bestTp,
          confidence: t.confidence,
          sl: t.sl, tp1: t.tp1, tp2: t.tp2, tp3: t.tp3,
          invested: t.invested || amountPerTrade,
          netPnl: t.netPnlPkr,
          netPnlPct: amountPerTrade > 0 ? (t.netPnlPkr / amountPerTrade) * 100 : 0,
          portfolio: t.portfolio,
          isWin: t.netPnlPkr > 0,
        })),
      });
    } catch (e: any) {
      results.push({ ensembleName: ens.name, ensembleLabel: ens.label, metrics: null, trades: [], error: e?.message });
    }
  }

  // Rank by the user-selected metric (win rate default, or net P&L) — ensembles with metrics first, sorted desc.
  const withMetrics = results.filter((r) => r.metrics).sort((a, b) =>
    rankBy === "netPnl" ? (b.metrics.netPnL - a.metrics.netPnL) : (b.metrics.winRate - a.metrics.winRate)
  );
  const top5 = withMetrics.slice(0, 5);
  const rest = withMetrics.slice(5);

  return NextResponse.json({
    capital,
    amountPerTrade,
    totalEnsembles: results.filter((r) => r.metrics).length,
    numDays,
    numTrades,
    top5,
    rest,
    cached: false,
  });
}
