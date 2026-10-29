/**
 * Task 77 — Immutable risk-level overlay for prospective predictions.
 *
 * PredictionHistory stores the forecast (signal + predicted return + entryPrice
 * = cutoff close) but NOT SL/TP1/TP2/TP3 levels — adding them would violate
 * original-forecast immutability. This module computes point-in-time risk-
 * management levels using the canonical ATR(14)-based formula from
 * investment-simulator.ts (the established level generator), applied to the
 * OHLCV bars available at or before the prediction's dataCutoff.
 *
 * Formula (reused verbatim from investment-simulator.ts:264-275):
 *   atr14      = ATR(14) over the 15 bars ending at (and including) the cutoff bar
 *   slDistance = atr14 × 1.5
 *   tp1Distance= atr14 × 1.0
 *   tp2Distance= atr14 × 2.0
 *   tp3Distance= atr14 × 3.0
 *   For BUY:  sl = entryReference - slDistance, tp_n = entryReference + tp_n_Distance
 *   For SELL: sl = entryReference + slDistance, tp_n = entryReference - tp_n_Distance
 *
 * entryReference = the close at the cutoff bar (the decision reference known at
 * cutoff time). Levels are PRESET at cutoff and used as-is at entry (the trade
 * enters at the next-session open but manages with these cutoff-decided levels).
 * This is the honest point-in-time approach: the risk plan is fixed before entry.
 *
 * These levels are RISK-MANAGEMENT INPUTS, not ML-predicted target prices. They
 * are identical across the three exit strategies for a given source forecast
 * (the strategies share entry/SL/TP1/TP2/TP3; only the exit policy differs).
 *
 * The module is PURE: it takes bars + cutoff + direction and returns the levels.
 * The caller loads bars from the DB and persists the result in the immutable
 * PredictionRiskLevels table (1:1 with PredictionHistory).
 */

import { atr } from "./investment-simulator";

// ─── Policy identity ─────────────────────────────────────────────────────────

/** Stable policy ID encoding the formula so old records stay interpretable. */
export const RISK_LEVEL_POLICY_ID = "atr14-1.5-1-2-3";

/** Policy version — bump if the formula or multipliers change. */
export const RISK_LEVEL_POLICY_VERSION = "task77-v1";

// ATR multipliers (match investment-simulator.ts:267-270 exactly).
export const SL_MULT = 1.5;
export const TP1_MULT = 1.0;
export const TP2_MULT = 2.0;
export const TP3_MULT = 3.0;

export const ATR_PERIOD = 14;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiskLevelBar {
  date: string;
  high: number;
  low: number;
  close: number;
}

export interface RiskLevelResult {
  riskPolicyId: string;
  riskPolicyVersion: string;
  effectiveCutoff: string;
  direction: "BUY" | "SELL";
  entryReference: number; // close at cutoff
  atr14: number;
  slDistance: number;
  tp1Distance: number;
  tp2Distance: number;
  tp3Distance: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  barsUsed: number; // bars in the ATR slice (audit)
}

// ─── Computation ─────────────────────────────────────────────────────────────

/**
 * Compute point-in-time risk levels for a prediction given its OHLCV history
 * and cutoff date. Returns null if the cutoff bar is not found in `bars` or if
 * ATR cannot be computed (no usable bars). The caller must pass chronological
 * bars (ascending by date) for the symbol, including the cutoff bar.
 *
 * The ATR slice is the 15 bars ending at (and including) the cutoff bar — all
 * ≤ cutoff, so no look-ahead. If fewer than 15 bars are available before the
 * cutoff, the canonical atr() falls back to averaging true ranges over what
 * exists (see investment-simulator.ts:142-153).
 */
export function computeRiskLevels(
  bars: RiskLevelBar[],
  cutoffDate: string,
  direction: "BUY" | "SELL"
): RiskLevelResult | null {
  // Find the cutoff bar (the bar whose date === cutoffDate).
  const cutoffIdx = bars.findIndex((b) => b.date === cutoffDate);
  if (cutoffIdx < 0) return null;

  // ATR slice: bars ending at (and including) the cutoff bar.
  // atr() needs closes[i-1] for TR, so we include period+1 bars when available.
  const sliceStart = Math.max(0, cutoffIdx - ATR_PERIOD);
  const slice = bars.slice(sliceStart, cutoffIdx + 1);
  if (slice.length === 0) return null;

  const highs = slice.map((b) => b.high);
  const lows = slice.map((b) => b.low);
  const closes = slice.map((b) => b.close);
  const atr14 = atr(highs, lows, closes, ATR_PERIOD);

  const entryReference = bars[cutoffIdx].close;
  const slDistance = atr14 * SL_MULT;
  const tp1Distance = atr14 * TP1_MULT;
  const tp2Distance = atr14 * TP2_MULT;
  const tp3Distance = atr14 * TP3_MULT;

  const sign = direction === "BUY" ? 1 : -1;
  const sl = entryReference - sign * slDistance;
  const tp1 = entryReference + sign * tp1Distance;
  const tp2 = entryReference + sign * tp2Distance;
  const tp3 = entryReference + sign * tp3Distance;

  return {
    riskPolicyId: RISK_LEVEL_POLICY_ID,
    riskPolicyVersion: RISK_LEVEL_POLICY_VERSION,
    effectiveCutoff: cutoffDate,
    direction,
    entryReference,
    atr14,
    slDistance,
    tp1Distance,
    tp2Distance,
    tp3Distance,
    sl,
    tp1,
    tp2,
    tp3,
    barsUsed: slice.length,
  };
}
