/**
 * Task 59 — Shared trading-cost configuration for the walk-forward trading
 * evaluator. Resolves the slippage-rate discrepancy found in Phase 2:
 *   - investment-simulator.ts: SLIPPAGE_RATE = 0.0015
 *   - signal-stats/route.ts:   SLIPPAGE_RATE = 0.0015
 *   - backtest.ts:              SLIPPAGE_RATE = 0.005  ← DIFFERENT (3.33× higher)
 *
 * Rather than silently changing existing simulators, this module exposes
 * CLEARLY NAMED cost profiles. The new walk-forward trading evaluator uses
 * the "standard_psx" profile (slippage 0.0015 — the majority documented rate,
 * used by 2 of 3 simulators) as its primary, and reports a sensitivity result
 * with the "high_slippage_psx" profile (0.005, matching backtest.ts).
 *
 * Selection is based on DOCUMENTED CONVENTION (majority of simulators), NOT on
 * which profile produces the most profitable test (per Phase 2 rule).
 *
 * Cost formulas (consistent across all 3 existing simulators):
 *   commission = notional × COMMISSION_RATE × 2   (both sides — entry + exit)
 *   slippage   = notional × SLIPPAGE_RATE          (applied ONCE per round trip,
 *                NOT per fill — matches all 3 existing simulators)
 *   cgt        = gross_pnl × CGT_RATE  if gross_pnl > 0, else 0  (Pakistan CGT 15% on gains)
 *   total_cost = commission + slippage + cgt
 *   net_pnl    = gross_pnl − total_cost
 */

export interface CostProfile {
  id: string;
  label: string;
  commissionRate: number; // per side (×2 for round trip: entry + exit)
  slippageRate: number;   // per round trip (NOT per fill — matches existing simulators)
  cgtRate: number;        // on positive gross gains (Pakistan CGT)
  description: string;
  // PSX fixed minimum commission for low-priced shares.
  // When the share price ≤ fixedCommissionPriceThreshold, the commission is
  // fixedCommissionPerShare × quantity × 2 (both sides), NOT the percentage rate.
  // Real PSX rule: for shares priced ≤ PKR 20, commission = PKR 0.03/share.
  // This is HIGHER than the 0.15% percentage for low-priced stocks (e.g., a
  // PKR 5 share: percentage = 0.0075/share, fixed = 0.03/share — 4× higher).
  fixedCommissionPerShare?: number;    // PKR per share (per side)
  fixedCommissionPriceThreshold?: number; // shares priced ≤ this use the fixed commission
}

/** Standard PSX cost profile — matches 2 of 3 existing simulators + the real
 * PSX fixed minimum commission rule for low-priced shares. */
export const STANDARD_PSX: CostProfile = {
  id: "standard_psx",
  label: "Standard PSX (commission 0.15%×2 OR PKR 0.03/share for price ≤20, slippage 0.15% RT, CGT 15%)",
  commissionRate: 0.0015,
  slippageRate: 0.0015,
  cgtRate: 0.15,
  fixedCommissionPerShare: 0.03,   // PKR 0.03 per share (per side) — PSX rule
  fixedCommissionPriceThreshold: 20, // shares priced ≤ PKR 20 use the fixed commission
  description:
    "Commission: 0.15% per side (×2 for entry+exit) for shares > PKR 20, OR PKR 0.03/share (×2) for shares ≤ PKR 20 (the real PSX fixed minimum commission rule). Slippage 0.15% applied ONCE per round-trip. CGT 15% on positive gross gains (Pakistan Finance Act). Matches investment-simulator.ts + signal-stats/route.ts.",
};

/** High-slippage PSX cost profile — matches backtest.ts (SLIPPAGE_RATE = 0.005). */
export const HIGH_SLIPPAGE_PSX: CostProfile = {
  id: "high_slippage_psx",
  label: "High-slippage PSX (commission 0.15%×2, slippage 0.50% round-trip, CGT 15% on gains)",
  commissionRate: 0.0015,
  slippageRate: 0.005,
  cgtRate: 0.15,
  description:
    "Same as standard_psx but slippage 0.50% (3.33× higher). Matches backtest.ts. Used as a conservative-cost sensitivity result, NOT the primary.",
};

export const COST_PROFILES: Record<string, CostProfile> = {
  standard_psx: STANDARD_PSX,
  high_slippage_psx: HIGH_SLIPPAGE_PSX,
};

/**
 * Compute the per-trade costs for a given notional + gross P&L + cost profile.
 * Returns { commission, slippage, cgt, total, net }.
 * Formula matches all 3 existing simulators (commission ×2 both sides,
 * slippage once per round-trip, CGT on positive gross).
 */
/**
 * Compute the per-trade costs. When quantity + sharePrice are provided and the
 * profile has a fixedCommissionPerShare + threshold, applies the PSX fixed
 * minimum commission for low-priced shares (price ≤ threshold). Otherwise
 * falls back to the percentage commission (backward compatible).
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
    // PSX fixed minimum commission: PKR 0.03/share × quantity × 2 (both sides)
    commission = quantity * profile.fixedCommissionPerShare * 2;
  } else {
    // Percentage commission (both sides)
    commission = notional * profile.commissionRate * 2;
  }
  const slippage = notional * profile.slippageRate;           // once per round-trip
  const cgt = grossPnl > 0 ? grossPnl * profile.cgtRate : 0;  // on positive gross
  const totalCost = commission + slippage + cgt;
  const netPnl = grossPnl - totalCost;
  return { commission, slippage, cgt, totalCost, netPnl };
}
