/**
 * Task 80 — Canonical PSX transaction-cost model.
 *
 * Implements the user-specified PSX cost schedule (Part A):
 *   - Broker commission: PKR 0.03/share (fixed) if price ≤ 20, else 0.15% of
 *     transaction value. Charged per side (buy + each sell leg separately).
 *   - PSX trading fee: 0.00035% (0.0000035 decimal)
 *   - NCCPL clearing fee: 0.00081% (0.0000081 decimal)
 *   - CDC fee: 0.0036% (0.000036 decimal)
 *   - Combined ancillary: 0.00476% per side
 *   - Slippage: ZERO (no synthetic slippage — real gap-aware fills only)
 *   - CGT: 15% (ATL filer) or 30% (non-ATL/non-filer) on positive gains
 *
 * The old standard_psx profile (with 0.15% slippage + percentage-only commission)
 * is preserved as legacy_standard_psx_v1 for historical reproducibility.
 *
 * netPnL = grossPnL − totalBrokerage − totalPSX − totalNCCPL − totalCDC − CGT
 * (slippage = 0 in the new profile; no charge deducted twice)
 */

// ─── Tax profiles ────────────────────────────────────────────────────────────

export type TaxProfile = "ATL_15" | "NON_ATL_30";

export const TAX_RATES: Record<TaxProfile, number> = {
  ATL_15: 0.15,
  NON_ATL_30: 0.30,
};

// ─── Cost profile ────────────────────────────────────────────────────────────

export interface CostProfile {
  id: string;
  label: string;
  commissionRate: number; // per side (percentage, for price > threshold)
  slippageRate: number;   // per round-trip (0 for v2)
  cgtRate: number;        // default CGT (overridden by tax profile)
  description: string;
  // PSX fixed minimum commission for low-priced shares
  fixedCommissionPerShare?: number;
  fixedCommissionPriceThreshold?: number;
  // Ancillary transaction fees (per side, on transaction value)
  psxFeeRate?: number;    // 0.00035% = 0.0000035
  nccplFeeRate?: number;  // 0.00081% = 0.0000081
  cdcFeeRate?: number;    // 0.0036% = 0.000036
}

/**
 * Legacy cost profile — the old standard_psx used in Task 78/79 results.
 * Has 0.15% slippage + percentage-only commission + 15% CGT. No PSX/NCCPL/CDC
 * fees. Preserved for historical reproducibility. Do NOT use for new experiments.
 */
export const LEGACY_STANDARD_PSX_V1: CostProfile = {
  id: "legacy_standard_psx_v1",
  label: "Legacy Standard PSX v1 (commission 0.15%×2, slippage 0.15% RT, CGT 15%, no PSX/NCCPL/CDC fees)",
  commissionRate: 0.0015,
  slippageRate: 0.0015,
  cgtRate: 0.15,
  description:
    "Legacy profile used in Task 78/79 results. Commission 0.15% per side (percentage only, no fixed minimum). Slippage 0.15% round-trip. CGT 15%. No PSX/NCCPL/CDC ancillary fees. Kept for historical reproducibility — do NOT use for new experiments.",
};

// Backward-compatible alias (existing code imports STANDARD_PSX)
export const STANDARD_PSX: CostProfile = LEGACY_STANDARD_PSX_V1;

/**
 * NEW user-specified PSX cost schedule v2 (Part A).
 * The canonical cost profile for all new Task 80+ experiments.
 */
export const PSX_USER_SCHEDULE_V2: CostProfile = {
  id: "psx_user_schedule_v2",
  label: "PSX User Schedule v2 (commission PKR 0.03/share ≤20 OR 0.15% >20, PSX 0.00035% + NCCPL 0.00081% + CDC 0.0036%, zero slippage, CGT 15%/30%)",
  commissionRate: 0.0015,
  slippageRate: 0, // ZERO slippage — user-specified
  cgtRate: 0.15,   // default ATL_15; overridden by tax profile selector
  fixedCommissionPerShare: 0.03,
  fixedCommissionPriceThreshold: 20,
  psxFeeRate: 0.0000035,   // 0.00035%
  nccplFeeRate: 0.0000081, // 0.00081%
  cdcFeeRate: 0.000036,    // 0.0036%
  description:
    "User-specified PSX cost schedule. Broker commission: PKR 0.03/share (fixed) if execution price ≤ PKR 20, else 0.15% of transaction value. Charged per side (buy + each sell leg). PSX fee 0.00035%, NCCPL 0.00081%, CDC 0.0036% per side on transaction value. Slippage: ZERO (real gap-aware fills only, no synthetic penalty). CGT: 15% (ATL filer) or 30% (non-ATL) on positive realized gains, applied once per completed position.",
};

export const HIGH_SLIPPAGE_PSX: CostProfile = {
  id: "high_slippage_psx",
  label: "High-slippage PSX (legacy sensitivity — commission 0.15%×2, slippage 0.50% RT, CGT 15%)",
  commissionRate: 0.0015,
  slippageRate: 0.005,
  cgtRate: 0.15,
  description: "Legacy sensitivity profile (slippage 0.50%). Not used for new Task 80+ experiments.",
};

export const COST_PROFILES: Record<string, CostProfile> = {
  legacy_standard_psx_v1: LEGACY_STANDARD_PSX_V1,
  standard_psx: STANDARD_PSX, // alias
  psx_user_schedule_v2: PSX_USER_SCHEDULE_V2,
  high_slippage_psx: HIGH_SLIPPAGE_PSX,
};

// ─── Per-side cost computation (canonical) ───────────────────────────────────

export interface SideCosts {
  transactionValue: number;
  brokerage: number;
  psxFee: number;
  nccplFee: number;
  cdcFee: number;
  slippage: number;
  sideTotal: number;
}

/**
 * Compute the costs for ONE transaction side (a buy or a single sell/partial-sell leg).
 * Broker commission: fixed PKR 0.03/share if fillPrice ≤ threshold, else 0.15% of value.
 * PSX/NCCPL/CDC fees: percentage of transaction value (only if the profile has them).
 * Slippage: transactionValue × slippageRate (0 for v2).
 */
export function computeSideCosts(
  quantity: number,
  fillPrice: number,
  profile: CostProfile
): SideCosts {
  const transactionValue = fillPrice * quantity;
  let brokerage: number;
  if (
    profile.fixedCommissionPerShare != null &&
    profile.fixedCommissionPriceThreshold != null &&
    fillPrice > 0 && fillPrice <= profile.fixedCommissionPriceThreshold
  ) {
    brokerage = quantity * profile.fixedCommissionPerShare;
  } else {
    brokerage = transactionValue * profile.commissionRate;
  }
  const psxFee = transactionValue * (profile.psxFeeRate ?? 0);
  const nccplFee = transactionValue * (profile.nccplFeeRate ?? 0);
  const cdcFee = transactionValue * (profile.cdcFeeRate ?? 0);
  const slippage = transactionValue * profile.slippageRate;
  return { transactionValue, brokerage, psxFee, nccplFee, cdcFee, slippage, sideTotal: brokerage + psxFee + nccplFee + cdcFee + slippage };
}

// ─── Full trade cost (buy + sell legs + position-level CGT) ───────────────────

export interface ExitLegInput {
  quantity: number;
  exitPrice: number;
}

export interface TradeCostsV2 {
  buy: SideCosts;
  totalBrokerage: number;
  totalPSX: number;
  totalNCCPL: number;
  totalCDC: number;
  cgt: number;
  slippage: number;
  totalCost: number;
  grossPnl: number;
  netPnl: number;
  taxProfile: TaxProfile;
  cgtRate: number;
}

/**
 * Compute the full position-level costs: buy-side costs (once) + per-leg sell-side
 * costs + position-level CGT (on aggregate positive gross P&L).
 *
 * CGT is applied ONCE per completed position (not per leg) on the aggregate
 * positive gross P&L, at the selected tax rate (15% ATL or 30% non-ATL).
 * Losing positions have zero CGT. Scale-out legs are aggregated before CGT.
 */
export function computeTradeCostsV2(
  buyQuantity: number,
  buyPrice: number,
  exitLegs: ExitLegInput[],
  grossPnl: number,
  profile: CostProfile,
  taxProfile: TaxProfile = "ATL_15"
): TradeCostsV2 {
  const buy = computeSideCosts(buyQuantity, buyPrice, profile);
  let totalBrokerage = buy.brokerage;
  let totalPSX = buy.psxFee;
  let totalNCCPL = buy.nccplFee;
  let totalCDC = buy.cdcFee;
  let totalSlippage = buy.slippage;
  for (const leg of exitLegs) {
    const sell = computeSideCosts(leg.quantity, leg.exitPrice, profile);
    totalBrokerage += sell.brokerage;
    totalPSX += sell.psxFee;
    totalNCCPL += sell.nccplFee;
    totalCDC += sell.cdcFee;
    totalSlippage += sell.slippage;
  }
  const cgtRate = TAX_RATES[taxProfile] ?? profile.cgtRate;
  const cgt = grossPnl > 0 ? grossPnl * cgtRate : 0;
  const totalCost = totalBrokerage + totalPSX + totalNCCPL + totalCDC + totalSlippage + cgt;
  const netPnl = grossPnl - totalCost;
  const grossPnlOut = grossPnl;
  return {
    buy: buy,
    totalBrokerage: totalBrokerage,
    totalPSX: totalPSX,
    totalNCCPL: totalNCCPL,
    totalCDC: totalCDC,
    cgt: cgt,
    slippage: totalSlippage,
    totalCost: totalCost,
    grossPnl: grossPnlOut,
    netPnl: netPnl,
    taxProfile: taxProfile,
    cgtRate: cgtRate,
  };
}

// ─── Legacy computeTradeCosts (backward compat for the existing strategy engine) ─

/**
 * Legacy cost function (kept for the existing strategy engine + old results).
 * Computes commission × 2 (both sides) + slippage + CGT based on notional.
 * New experiments should use computeTradeCostsV2 instead.
 */
export function computeTradeCosts(
  notional: number,
  grossPnl: number,
  profile: CostProfile,
  quantity?: number,
  sharePrice?: number
): {
  commission: number;
  slippage: number;
  cgt: number;
  totalCost: number;
  netPnl: number;
} {
  let commission: number;
  if (
    quantity != null && sharePrice != null &&
    profile.fixedCommissionPerShare != null &&
    profile.fixedCommissionPriceThreshold != null &&
    sharePrice > 0 && sharePrice <= profile.fixedCommissionPriceThreshold
  ) {
    commission = quantity * profile.fixedCommissionPerShare * 2;
  } else {
    commission = notional * profile.commissionRate * 2;
  }
  const slippage = notional * profile.slippageRate;
  const cgt = grossPnl > 0 ? grossPnl * profile.cgtRate : 0;
  const totalCost = commission + slippage + cgt;
  const netPnl = grossPnl - totalCost;
  return { commission, slippage, cgt, totalCost, netPnl };
}
