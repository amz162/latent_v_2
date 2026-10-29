import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import {
  simulateAllStrategies,
  summarizeStrategy,
  STRATEGY_POLICY_VERSION,
  STRATEGY_EFFECTIVE_START,
  STRATEGIES,
  type StrategySignal,
  type StrategyBar,
  type StrategyId,
} from "@/lib/latent/strategy-engine";
import { STANDARD_PSX } from "@/lib/latent/trading-costs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/backtest/strategy-comparison?symbol=LUCK&horizon=5
//
// Task 76/77 — SINGLE-SIGNAL STRATEGY ENGINE PREVIEW (n=1).
//
// Runs the THREE exit strategies over ONE eligible entry signal + its OHLCV
// horizon window for a paired trade-level comparison. This is an EXPLORATORY
// PREVIEW, NOT a multi-sample historical backtest:
//   - The signal (entry/SL/TP1/TP2/TP3) comes from the current static
//     ml_predictions_multi.json snapshot — it is NOT a point-in-time signal
//     that was genuinely knowable at the historical entry date.
//   - n=1 per symbol — do NOT claim statistical significance or that one
//     strategy is better from this single small-sample result.
//
// For a valid multi-sample historical comparison, use the prospective ledger
// (/api/backtest/walk-forward/prospective) or a dedicated point-in-time
// historical comparison source. This endpoint is retained as a labelled
// preview of the strategy engine's behaviour on a concrete signal.

const HORIZON_MAP: Record<string, number> = { "5": 5, "10": 10, "21": 21 };
const SUPPORTED_HORIZONS = Object.keys(HORIZON_MAP);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const horizonStr = url.searchParams.get("horizon") || "5";
    // Task 77: reject unsupported horizons with 400 (previously silently defaulted to 5).
    const horizon = HORIZON_MAP[horizonStr];
    if (!horizon) {
      return NextResponse.json(
        { available: false, error: `Invalid horizon '${horizonStr}'. Supported values: ${SUPPORTED_HORIZONS.join(", ")}.` },
        { status: 400 }
      );
    }
    if (!symbol) {
      return NextResponse.json({ available: false, error: "Missing symbol" }, { status: 400 });
    }

    // Load the per-symbol prediction signal from ml_predictions_multi.json.
    let multi: any = null;
    try {
      multi = JSON.parse(
        await fs.readFile(path.join(process.cwd(), "data", "ml_predictions_multi.json"), "utf-8")
      );
    } catch {
      return NextResponse.json(
        { available: false, error: "ml_predictions_multi.json not found" },
        { status: 503 }
      );
    }

    // Find an eligible BUY signal for the symbol across the per-MODEL
    // predictions (multi.models[modelName].predictions[symbol]). Prefer a
    // signal with sensible levels (tp3 > entry for BUY); fall back to any
    // BUY signal with full entry/SL/TP1/TP2/TP3 > 0.
    type Sig = { source: string; entry: number; sl: number; tp1: number; tp2: number; tp3: number };
    let chosen: Sig | null = null;
    let fallback: Sig | null = null;
    const models = multi?.models ?? {};
    for (const modelName of Object.keys(models)) {
      const preds = models[modelName]?.predictions;
      if (!preds) continue;
      const p = preds[symbol];
      if (!p || p.signal !== "BUY") continue;
      if (
        typeof p.entry === "number" && p.entry > 0 &&
        typeof p.sl === "number" && p.sl > 0 &&
        typeof p.tp1 === "number" && p.tp1 > 0 &&
        typeof p.tp2 === "number" && p.tp2 > 0 &&
        typeof p.tp3 === "number" && p.tp3 > 0
      ) {
        const cand = { source: `models.${modelName}`, entry: p.entry, sl: p.sl, tp1: p.tp1, tp2: p.tp2, tp3: p.tp3 };
        if (!fallback) fallback = cand;
        // prefer tp3 above entry (sensible BUY targets)
        if (p.tp3 > p.entry && !chosen) chosen = cand;
      }
    }
    chosen = chosen || fallback;
    if (!chosen) {
      return NextResponse.json({
        available: true,
        status: "no-eligible-signal",
        symbol, horizon,
        message: `No eligible BUY signal (with entry+SL+TP1/TP2/TP3) for ${symbol} in ml_predictions_multi.json.`,
        strategies: STRATEGIES.map((s) => ({ id: s.id, label: s.label, summary: null })),
      });
    }

    // Load chronological OHLCV bars for the symbol (post-entry scan window).
    const dbBars = await db.ohlcvBar.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true },
    });
    if (dbBars.length < 2) {
      return NextResponse.json({
        available: true, status: "insufficient-bars", symbol, horizon,
        message: `Only ${dbBars.length} OHLCV bars for ${symbol} — need >= 2 to simulate.`,
        strategies: STRATEGIES.map((s) => ({ id: s.id, label: s.label, summary: null })),
      });
    }

    // Entry at the decision-session close (horizon bars back from the latest);
    // scan the final `horizon` bars as the hold window. n=1 paired comparison.
    const entryIdx = dbBars.length - 1 - horizon;
    if (entryIdx < 0) {
      return NextResponse.json({
        available: true, status: "insufficient-bars-for-horizon", symbol, horizon,
        message: `Need >= ${horizon + 1} bars for a ${horizon}-session hold; only ${dbBars.length} available.`,
        strategies: STRATEGIES.map((s) => ({ id: s.id, label: s.label, summary: null })),
      });
    }
    const entryBar = dbBars[entryIdx];
    const scanBars: StrategyBar[] = dbBars
      .slice(entryIdx + 1, entryIdx + 1 + horizon)
      .map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));

    // Shared signal. Quantity: integer shares for a 10% allocation of PKR 1M.
    const allocation = 100_000;
    const quantity = Math.max(1, Math.floor(allocation / chosen.entry));
    const signal: StrategySignal = {
      symbol, direction: "BUY",
      entryPrice: entryBar.close,
      sl: chosen.sl, tp1: chosen.tp1, tp2: chosen.tp2, tp3: chosen.tp3,
      quantity,
    };

    const results = simulateAllStrategies(signal, scanBars, STANDARD_PSX);
    const out = STRATEGIES.map((s) => {
      const r = results[s.id as StrategyId];
      return {
        id: s.id, label: s.label, description: s.description,
        trade: {
          entryDate: entryBar.date, entryPrice: signal.entryPrice, quantity,
          sl: signal.sl, tp1: signal.tp1, tp2: signal.tp2, tp3: signal.tp3,
          exitReason: r.exitReason, bestTargetReached: r.bestTargetReached,
          activeStopFinal: r.activeStopFinal, trailingStopHistory: r.trailingStopHistory,
          legs: r.legs, grossPnl: r.grossPnl, totalCost: r.totalCost, netPnl: r.netPnl,
          isWin: r.isWin, nBarsExamined: r.nBarsExamined, unresolved: r.unresolved,
          tp1Hits: r.tp1Hits, tp2Hits: r.tp2Hits, tp3Hits: r.tp3Hits, slHits: r.slHits,
        },
        summary: summarizeStrategy([r]),
      };
    });

    return NextResponse.json({
      available: true, status: "ok",
      mode: "single-signal-preview",
      policyVersion: STRATEGY_POLICY_VERSION, effectiveStart: STRATEGY_EFFECTIVE_START,
      symbol, horizon,
      signalSource: `ml_predictions_multi.json [${chosen.source}]`,
      costProfile: STANDARD_PSX.id,
      entryDate: entryBar.date, entryPrice: signal.entryPrice, quantity,
      scanWindow: { start: scanBars[0]?.date, end: scanBars[scanBars.length - 1]?.date, nBars: scanBars.length },
      exploratory: true, nTrades: 1,
      strategies: out,
      methodology:
        "SINGLE-SIGNAL STRATEGY ENGINE PREVIEW (n=1). One eligible BUY signal (entry/SL/TP1/TP2/TP3 " +
        "from the current ml_predictions_multi.json static snapshot) evaluated by all three exit policies " +
        "over the SAME horizon-window OHLCV bars + standard_psx costs. Only the exit/position-management " +
        "policy differs. This is NOT a multi-sample historical backtest — the signal is from a current " +
        "static file, not a point-in-time signal known at the historical entry date.",
      limitations: [
        "MODE: single-signal preview (n=1) — NOT a multi-sample historical backtest.",
        "The signal source is the current static ml_predictions_multi.json snapshot — NOT a point-in-time signal known at the entry date.",
        "Single paired signal per symbol (n=1) — exploratory comparison, NOT statistically significant.",
        "Historical ensemble-signal source (strategySignal/indicator engine) — NOT trained-ML walk-forward.",
        "Do NOT claim one strategy is better from a single small-sample result.",
        "The three strategies are NEW Task 76 research variants (policyVersion " + STRATEGY_POLICY_VERSION + "), NOT Task 71 predeclared.",
        "For a valid multi-sample comparison, use the prospective ledger (/api/backtest/walk-forward/prospective) or a dedicated point-in-time historical source.",
      ],
    });
  } catch (e: any) {
    return NextResponse.json(
      { available: false, error: e?.message || "Strategy comparison failed" },
      { status: 500 }
    );
  }
}
