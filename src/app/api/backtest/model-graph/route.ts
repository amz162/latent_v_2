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

// GET /api/backtest/model-graph?models=XGBoost,LightGBM&symbol=LUCK&horizon=21&step=21
//
// Per-model "actual vs predicted" graph data (the user spec: "in back testing
// give me option to check the each model graph view — actual price vs
// predicted price").
//
// NEW (this round):
//   - `models` (comma-separated) — MULTI-MODEL: returns a per-model predicted
//     series + a shared actual series so the chart can overlay several models
//     at once. Backward compatible: `model=X` (single) still works.
//   - `step` — the decision-point cadence (bars between decisions). Default
//     21 (monthly). User can set 5 (weekly) / 10 (bi-weekly) / 21 (monthly) /
//     63 (quarterly) for more/fewer points. (User spec: "add user field in
//     which user give decision points and use that in graph".)
//
// Method (matches runAllBacktests' decision cadence, but step is now tunable):
//   - Load OhlcvBar for `symbol` (closes + vols, ascending).
//   - computeIndicatorSeries once.
//   - At each decision point (every `step` bars over the last ~3 years), for
//     EACH requested model run strategySignal(model, featuresAt) →
//     predictedReturn + signal. predictedPrice[i] = closes[i]×(1+predictedReturn).
//   - actualRealized[i] = closes[i+horizon] (the ground-truth close horizon bars
//     later).
//   - Returns: dates[] + actual[] + entry[] + per-model {key,label,predicted[],signals[]}.
//
// Works for any of the 65 model keys OR the 13 ensemble keys (ensembles blend
// per-model signals inline, mirroring model-backtest.ts ensembleAt).

interface EnsembleBlended { signal: "BUY" | "SELL" | "HOLD"; ret: number; }
const ENSEMBLE_MEMBERS: Record<string, string[]> = {
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
};
function ensembleAt(ensKey: string, modelRets: Record<string, number>, modelSignals: Record<string, string>): EnsembleBlended {
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
  if (ensKey === "tier_weighted") {
    // Approx: average of all (good enough for a graph preview).
    let sum = 0;
    for (const k of ALL_MODEL_KEYS) sum += modelRets[k] || 0;
    const avg = sum / ALL_MODEL_KEYS.length;
    return { signal: avg > 0.01 ? "BUY" : avg < -0.01 ? "SELL" : "HOLD", ret: avg };
  }
  const mem = ENSEMBLE_MEMBERS[ensKey] || [];
  if (mem.length === 0) return { signal: "HOLD", ret: 0 };
  let sum = 0;
  for (const k of mem) sum += modelRets[k] || 0;
  const r = sum / mem.length;
  return { signal: r > 0.01 ? "BUY" : r < -0.01 ? "SELL" : "HOLD", ret: r };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // models: comma-separated (multi-model). Backward compat: single `model=X`.
  const modelsParam = (url.searchParams.get("models") || "").trim();
  const modelParam = (url.searchParams.get("model") || "").trim();
  const modelKeys = (modelsParam || modelParam)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (modelKeys.length === 0) modelKeys.push("XGBoost");
  // Cap to 8 models to keep the chart legible + the request under maxDuration.
  const requestedModels = modelKeys.slice(0, 8);

  const symbol = (url.searchParams.get("symbol") || "LUCK").trim().toUpperCase();
  const horizon = Math.max(3, Math.min(63, parseInt(url.searchParams.get("horizon") || "21", 10) || 21));
  // step = decision-point cadence (bars between decisions). User-tunable.
  const step = Math.max(2, Math.min(252, parseInt(url.searchParams.get("step") || "21", 10) || 21));

  // Load the symbol's bars.
  let bars: { date: string; close: number; volume: number }[] = [];
  let dataSourceDate: string | null = null;
  try {
    const rows = await db.ohlcvBar.findMany({ where: { symbol }, orderBy: { date: "asc" } });
    bars = rows.filter((r) => Number.isFinite(r.close) && r.close > 0).map((r) => ({ date: r.date, close: r.close, volume: r.volume }));
    const latest = await db.ohlcvBar.findMany({ select: { date: true }, orderBy: { date: "desc" }, take: 1 });
    dataSourceDate = latest[0]?.date ?? null;
  } catch {}
  if (bars.length < 40) {
    return NextResponse.json(
      { error: `Not enough OHLCV history for ${symbol} (${bars.length} bars — need ≥40).`, dates: [], actual: [], entry: [], models: [], symbol, horizon, step, points: 0, dataSourceDate },
      { status: 200 },
    );
  }

  const closes = bars.map((b) => b.close);
  const vols = bars.map((b) => b.volume);
  const series: IndicatorSeries = computeIndicatorSeries(closes, vols);

  const n = bars.length;
  const start = Math.max(40, n - 756); // last ~3 years
  const anyEnsemble = requestedModels.some((k) => ALL_ENSEMBLE_KEYS.includes(k));

  const dates: string[] = [];
  const actual: (number | null)[] = [];
  const entry: number[] = [];
  // per-model parallel arrays (index-aligned with dates[])
  const perModel: Record<string, { label: string; predicted: (number | null)[]; signals: ("BUY" | "SELL" | "HOLD")[]; rets: number[] }> = {};
  for (const mk of requestedModels) {
    const isEns = ALL_ENSEMBLE_KEYS.includes(mk);
    perModel[mk] = { label: isEns ? (ENSEMBLE_LABELS[mk] || mk) : mk, predicted: [], signals: [], rets: [] };
  }

  for (let i = start; i <= n - 2; i += step) {
    const horizonEnd = Math.min(n - 1, i + horizon);
    if (horizonEnd <= i) continue;
    const f = featuresAt(series, i);
    // Per-model signals at this point (compute once; ensembles blend these).
    let modelRets: Record<string, number> = {};
    let modelSignals: Record<string, string> = {};
    if (anyEnsemble) {
      modelRets = {}; modelSignals = {};
      for (const k of ALL_MODEL_KEYS) {
        const sg = strategySignal(k, f);
        modelRets[k] = sg.predictedReturn;
        modelSignals[k] = sg.signal;
      }
    }
    dates.push(bars[i].date);
    entry.push(closes[i]);
    actual.push(closes[horizonEnd]);
    for (const mk of requestedModels) {
      let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
      let predictedReturn = 0;
      if (ALL_ENSEMBLE_KEYS.includes(mk)) {
        const e = ensembleAt(mk, modelRets, modelSignals);
        signal = e.signal; predictedReturn = e.ret;
      } else {
        const sg = strategySignal(mk, f);
        signal = sg.signal; predictedReturn = sg.predictedReturn;
      }
      // Only plot actionable (BUY/SELL) points; HOLD → null (gap in the line).
      perModel[mk].predicted.push(signal === "HOLD" ? null : closes[i] * (1 + predictedReturn));
      perModel[mk].signals.push(signal);
      perModel[mk].rets.push(predictedReturn);
    }
  }

  const models = requestedModels.map((mk) => ({ key: mk, label: perModel[mk].label, predicted: perModel[mk].predicted, signals: perModel[mk].signals }));

  return NextResponse.json({
    symbol,
    horizon,
    step,
    points: dates.length,
    dates,
    actual,
    entry,
    models,
    dataSourceDate,
    computedAt: new Date().toISOString(),
    cached: false,
  });
}
