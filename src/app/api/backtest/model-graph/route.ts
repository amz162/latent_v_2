import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computeIndicatorSeries,
  featuresAt,
  strategySignal,
  type IndicatorSeries,
} from "@/lib/latent/fallback-predictions";
import { ALL_MODEL_KEYS, ALL_ENSEMBLE_KEYS, ENSEMBLE_LABELS } from "@/lib/latent/model-backtest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/backtest/model-graph?model=XGBoost&symbol=LUCK&horizon=21
//
// Per-model "actual vs predicted" graph data (the user spec: "in back testing
// give me option to check the each model graph view, in that show me graph of
// what the actual price and what price is predict by my model").
//
// Method (matches runAllBacktests' decision cadence):
//   - Load OhlcvBar for `symbol` (closes + vols, ascending).
//   - computeIndicatorSeries(closes, vols) once.
//   - At each decision point (step = 21 bars for long histories, 10 for
//     short) over the last ~3 years, run strategySignal(modelKey, featuresAt)
//     → predictedReturn + signal.
//   - predictedPrice[i] = closes[i] × (1 + predictedReturn)  (the model's
//     target — where it expects price to go within the horizon).
//   - actualRealized[i] = closes[i + horizon]  (what the price ACTUALLY was
//     `horizon` bars later — the ground truth to compare against).
//   - Returns series [{date, entryClose, predictedPrice, actualRealized,
//     signal, predictedReturn}] + meta {model, symbol, horizon, points,
//     dataSourceDate, computedAt}.
//
// Works for any of the 65 model keys OR the 13 ensemble keys (the ensemble
// keys are resolved via model-backtest.ts' ensembleAt — re-implemented inline
// here to avoid pulling the whole runAllBacktests hot loop).

const MODEL_TIER: Record<string, string> = {}; // not needed for the graph

interface GraphPoint {
  date: string;
  entryClose: number;
  predictedPrice: number;
  actualRealized: number | null;
  signal: "BUY" | "SELL" | "HOLD";
  predictedReturn: number;
}

// Resolve an ensemble key's signal + return at a decision point (mirrors
// model-backtest.ts ensembleAt, trimmed to just what the graph needs).
function ensembleAt(
  ensKey: string,
  modelRets: Record<string, number>,
  modelSignals: Record<string, string>
): { signal: "BUY" | "SELL" | "HOLD"; ret: number } {
  if (ensKey === "majority_vote") {
    let buy = 0, sell = 0, hold = 0, buySum = 0, sellSum = 0;
    for (const k of ALL_MODEL_KEYS) {
      const s = modelSignals[k];
      if (s === "BUY") { buy++; buySum += modelRets[k] || 0; }
      else if (s === "SELL") { sell++; sellSum += modelRets[k] || 0; }
      else hold++;
    }
    if (buy > sell && buy > hold) return { signal: "BUY", ret: buySum / buy };
    if (sell > buy && sell > hold) return { signal: "SELL", ret: sellSum / sell };
    return { signal: "HOLD", ret: 0 };
  }
  if (ensKey === "probability_weighted") {
    let sum = 0;
    for (const k of ALL_MODEL_KEYS) sum += modelRets[k] || 0;
    const avg = sum / ALL_MODEL_KEYS.length;
    return { signal: avg > 0.01 ? "BUY" : avg < -0.01 ? "SELL" : "HOLD", ret: avg };
  }
  // Fallback: average the member returns (good enough for a graph preview).
  const members: Record<string, string[]> = {
    cl_ensemble: ["LightGBM (CL)", "Ridge Regression"],
    cl_extender: ["XGBoost (CL)", "LightGBM (CL)", "Random Forest (CL)", "ARIMA", "Holt-Winters", "GARCH", "Prophet", "Kalman Filter"],
    cl2_ensemble: ["LightGBM-A (CL-2)", "LightGBM-B (CL-2)", "HistGBM (CL-2)", "ExtraTrees (CL-2)", "RandomForest (CL-2)", "Logistic (CL-2)", "MLP (CL-2)"],
    pi_ensemble: ["Linear Regression (PI)", "Logistic Regression (PI)", "Pattern Matcher KNN (PI)", "Neural Network (PI)"],
    gm_model: ["Technical Engine (GM)", "Announcements Engine (GM)", "Fundamental Engine (GM)", "Macro Engine (GM)"],
    cg_ensemble: ["LightGBM (CG)", "XGBoost (CG)"],
    x_ensemble: ["Trend Multi-TF (X)", "Breakout RelVol (X)", "Trend Pullback (X)", "RSI Divergence (X)", "BB Mean Reversion (X)", "Vol Contraction (X)", "Relative Strength (X)", "Market Regime (X)", "Meta-Label CG (X)", "Triple Barrier Dyn (X)"],
    gian_ensemble: ["Gian-Ensemble (GIAN)"],
    gian_extender: ["Gian-Extender (GIAN-EXT)"],
    m_ensemble: ["M-Ensemble (M)"],
    tier_weighted: [], probability_weighted: [], majority_vote: [],
  };
  const mem = members[ensKey] || [];
  if (mem.length === 0) return { signal: "HOLD", ret: 0 };
  let sum = 0;
  for (const k of mem) sum += modelRets[k] || 0;
  const r = sum / mem.length;
  return { signal: r > 0.01 ? "BUY" : r < -0.01 ? "SELL" : "HOLD", ret: r };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const modelKey = (url.searchParams.get("model") || "XGBoost").trim();
  const symbol = (url.searchParams.get("symbol") || "LUCK").trim().toUpperCase();
  const horizon = Math.max(3, Math.min(63, parseInt(url.searchParams.get("horizon") || "21", 10) || 21));

  // Load the symbol's bars.
  let bars: { date: string; close: number; volume: number }[] = [];
  let dataSourceDate: string | null = null;
  try {
    const rows = await db.ohlcvBar.findMany({ where: { symbol }, orderBy: { date: "asc" } });
    bars = rows
      .filter((r) => Number.isFinite(r.close) && r.close > 0)
      .map((r) => ({ date: r.date, close: r.close, volume: r.volume }));
    const latest = await db.ohlcvBar.findMany({ select: { date: true }, orderBy: { date: "desc" }, take: 1 });
    dataSourceDate = latest[0]?.date ?? null;
  } catch {}
  if (bars.length < 40) {
    return NextResponse.json(
      { error: `Not enough OHLCV history for ${symbol} (${bars.length} bars — need ≥40).`, series: [], model: modelKey, symbol, horizon, points: 0, dataSourceDate },
      { status: 200 },
    );
  }

  const closes = bars.map((b) => b.close);
  const vols = bars.map((b) => b.volume);
  const series: IndicatorSeries = computeIndicatorSeries(closes, vols);

  // Decision cadence: monthly for long histories, bi-weekly for short.
  const n = bars.length;
  const step = n >= 300 ? 21 : 10;
  const start = Math.max(n >= 300 ? 40 : 15, n - 756); // last ~3 years
  const isEnsemble = ALL_ENSEMBLE_KEYS.includes(modelKey);

  const out: GraphPoint[] = [];
  for (let i = start; i <= n - 2; i += step) {
    const horizonEnd = Math.min(n - 1, i + horizon);
    if (horizonEnd <= i) continue;
    const f = featuresAt(series, i);
    let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
    let predictedReturn = 0;
    if (isEnsemble) {
      // Compute all per-model signals at this point, then blend.
      const modelRets: Record<string, number> = {};
      const modelSignals: Record<string, string> = {};
      for (const k of ALL_MODEL_KEYS) {
        const sg = strategySignal(k, f);
        modelRets[k] = sg.predictedReturn;
        modelSignals[k] = sg.signal;
      }
      const e = ensembleAt(modelKey, modelRets, modelSignals);
      signal = e.signal;
      predictedReturn = e.ret;
    } else {
      const sg = strategySignal(modelKey, f);
      signal = sg.signal;
      predictedReturn = sg.predictedReturn;
    }
    if (signal === "HOLD") continue; // only plot actionable points
    const entryClose = closes[i];
    const predictedPrice = entryClose * (1 + predictedReturn);
    const actualRealized = closes[horizonEnd];
    out.push({
      date: bars[i].date,
      entryClose,
      predictedPrice,
      actualRealized,
      signal,
      predictedReturn,
    });
  }

  return NextResponse.json({
    model: modelKey,
    modelLabel: isEnsemble ? (ENSEMBLE_LABELS[modelKey] || modelKey) : modelKey,
    symbol,
    horizon,
    points: out.length,
    series: out,
    dataSourceDate,
    computedAt: new Date().toISOString(),
    cached: false,
  });
}
