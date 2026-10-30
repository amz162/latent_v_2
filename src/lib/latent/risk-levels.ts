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
import { computeSideCosts, TAX_RATES, type CostProfile, type TaxProfile } from "./trading-costs";

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

// ─── Task 80 — Variant A: TP1 Risk/Reward 1:1 (entry-anchored) ────────────────

export const VARIANT_A_POLICY_ID = "atr_tp1_rr_1_1_v1";
export const VARIANT_A_POLICY_VERSION = "task80-v1";
// Variant A multipliers: SL = 1×ATR, TP1 = 1×ATR, TP2 = 2×ATR, TP3 = 3×ATR
// → TP1 gross R:R = 1:1, TP2 = 1:2, TP3 = 1:3
const VA_SL_MULT = 1.0;
const VA_TP1_MULT = 1.0;
const VA_TP2_MULT = 2.0;
const VA_TP3_MULT = 3.0;

/**
 * Variant A — compute risk levels anchored to the ACTUAL next-session entry open
 * (not the cutoff close). ATR(14) is still computed from bars ≤ cutoff (point-in-time).
 * Levels: SL = entryOpen − ATR, TP1 = entryOpen + ATR, TP2 = entryOpen + 2×ATR,
 * TP3 = entryOpen + 3×ATR. Produces TP1 gross R:R = 1:1.
 *
 * This is a NEW risk policy — the original Task 77 baseline (task77-v1) is unchanged.
 */
export function computeRiskLevelsVariantA(
  bars: RiskLevelBar[],
  cutoffDate: string,
  entryOpen: number,
  direction: "BUY" | "SELL" = "BUY"
): RiskLevelResult | null {
  const cutoffIdx = bars.findIndex((b) => b.date === cutoffDate);
  if (cutoffIdx < 0) return null;
  const sliceStart = Math.max(0, cutoffIdx - ATR_PERIOD);
  const slice = bars.slice(sliceStart, cutoffIdx + 1);
  if (slice.length === 0) return null;
  const atr14 = atr(slice.map((b) => b.high), slice.map((b) => b.low), slice.map((b) => b.close), ATR_PERIOD);
  const entryReference = entryOpen;
  const slDistance = atr14 * VA_SL_MULT;
  const tp1Distance = atr14 * VA_TP1_MULT;
  const tp2Distance = atr14 * VA_TP2_MULT;
  const tp3Distance = atr14 * VA_TP3_MULT;
  const sign = direction === "BUY" ? 1 : -1;
  return {
    riskPolicyId: VARIANT_A_POLICY_ID,
    riskPolicyVersion: VARIANT_A_POLICY_VERSION,
    effectiveCutoff: cutoffDate,
    direction,
    entryReference,
    atr14,
    slDistance, tp1Distance, tp2Distance, tp3Distance,
    sl: entryReference - sign * slDistance,
    tp1: entryReference + sign * tp1Distance,
    tp2: entryReference + sign * tp2Distance,
    tp3: entryReference + sign * tp3Distance,
    barsUsed: slice.length,
  };
}

// ─── Task 80 — Variant B: Minimum net Risk/Reward 1:2 filter ──────────────────

export const VARIANT_B_POLICY_ID = "atr_min_net_rr_2_v1";
export const VARIANT_B_POLICY_VERSION = "task80-v1";

export interface VariantBEligibility {
  eligible: boolean;
  netRR: number;
  netPotentialLossAtSL: number;
  netPotentialRewardAtTP3: number;
  buyCosts: number;
  sellCostsAtSL: number;
  sellCostsAtTP3: number;
  cgtAtTP3: number;
  reason: string;
}

/**
 * Variant B — uses the existing Task 77 baseline risk levels (unchanged), but
 * filters entries whose net R:R (after costs + CGT) is below 2.0.
 *
 * At the actual entry open:
 *   risk = |entryOpen − SL| × quantity + buyCosts + sellCostsAtSL
 *   reward = (TP3 − entryOpen) × quantity − buyCosts − sellCostsAtTP3 − CGT
 *   netRR = reward / risk
 * Qualifies only when netRR >= 2.0. Never changes levels or threshold.
 */
export function computeVariantBEligibility(
  entryOpen: number,
  sl: number,
  tp3: number,
  quantity: number,
  profile: CostProfile,
  taxProfile: TaxProfile,
  direction: "BUY" | "SELL" = "BUY"
): VariantBEligibility {
  const sign = direction === "BUY" ? 1 : -1;
  const buyCosts = computeSideCosts(quantity, entryOpen, profile).sideTotal;
  const sellCostsAtSL = computeSideCosts(quantity, sl, profile).sideTotal;
  const sellCostsAtTP3 = computeSideCosts(quantity, tp3, profile).sideTotal;
  const grossLossAtSL = sign * (sl - entryOpen) * quantity; // negative for a loss
  const grossRewardAtTP3 = sign * (tp3 - entryOpen) * quantity; // positive for a win
  const netPotentialLossAtSL = Math.abs(grossLossAtSL) + buyCosts + sellCostsAtSL;
  const cgtRate = TAX_RATES[taxProfile] ?? profile.cgtRate;
  const cgtAtTP3 = grossRewardAtTP3 > 0 ? grossRewardAtTP3 * cgtRate : 0;
  const netPotentialRewardAtTP3 = grossRewardAtTP3 - buyCosts - sellCostsAtTP3 - cgtAtTP3;
  const netRR = netPotentialLossAtSL > 0 ? netPotentialRewardAtTP3 / netPotentialLossAtSL : 0;
  const eligible = netRR >= 2.0;
  return {
    eligible, netRR, netPotentialLossAtSL, netPotentialRewardAtTP3,
    buyCosts, sellCostsAtSL, sellCostsAtTP3, cgtAtTP3,
    reason: eligible ? "qualified" : "skipped_rr_below_minimum",
  };
}
