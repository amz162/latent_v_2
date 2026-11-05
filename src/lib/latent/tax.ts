// Latent.pk — Tax calculation helpers
//
// Task 116 (C6): the applicable schedule is VERSIONED with per-rate
// verification status. Task 117 (Part H) re-verified against sources current
// at execution time and RESOLVED the previously unverified non-filer rules.
// All outputs are ILLUSTRATIVE ESTIMATES, not professional tax advice.
//
// Schedule "pk-tax-v2026-11-r2" (verified 2026-11-05 against PwC Worldwide
// Tax Summaries, Pakistan — individual income determination, last reviewed
// 24 Aug 2026, i.e. current for tax year 2027 / post-Finance-Act-2026 law):
//
//   CGT on PSX-listed securities acquired on/after 2024-07-01
//   (tax year 2025 onward):
//     - Seller on the Active Taxpayer List (ATL) at BOTH acquisition and
//       disposal: flat 15% — VERIFIED.
//     - Seller NOT on ATL (non-filer): normal personal slab rates apply,
//       with a statutory floor of 15% — VERIFIED as a rule. The actual rate
//       depends on the individual's total taxable income (slabs), which this
//       calculator does not collect, so the calculator applies the 15% FLOOR
//       and labels the non-filer result PROVISIONAL (true liability may be
//       higher).
//   CGT for older acquisition vintages (VERIFIED reference table; the
//   calculator models the ≥ 2024-07-01 regime only):
//     - acquired 2022-07-01 .. 2024-06-30, graded by holding period:
//       <1y 15%, 1-2y 12.5%, 2-3y 10%, 3-4y 7.5%, 4-5y 5%, 5-6y 2.5%, >6y 0%
//     - acquired on/before 2022-06-30: 12.5% flat
//     - acquired before 2013-07-01: 0%
//   Dividend WHT (final tax):
//     - Filer: 15% — VERIFIED.
//     - Resident but INACTIVE taxpayer (non-filer): rates increased by 100%
//       → 30% — VERIFIED (PwC individual summary: "The WHT rates shall
//       increase by 100% in case recipient of dividend is a resident but
//       inactive taxpayer").
//   Losses on listed securities: carry-forward against future securities
//   gains for up to 3 tax years — VERIFIED (from tax year 2019 onward).
//
// CGT is only on REALIZED gains (when you actually sell). Unrealized/paper gains are not taxable.

export type FilerStatus = "filer" | "non-filer";

export const TAX_SCHEDULE = {
  scheduleId: "pk-tax-v2026-11-r2",
  effectiveFrom: "2024-07-01", // acquisition-date regime modelled by the calculator
  verifiedAt: "2026-11-05",
  verification: {
    filerCgtRate: "VERIFIED_STATUTORY_RATE",
    // the RULE (slab rates, 15% floor) is verified; the calculator's flat
    // floor-only application is provisional because slabs need total income
    nonFilerCgtRate: "VERIFIED_RULE_PROVISIONAL_IMPLEMENTATION",
    filerDividendRate: "VERIFIED_STATUTORY_RATE",
    nonFilerDividendRate: "VERIFIED_STATUTORY_RATE",
  } as Record<string, string>,
  // VERIFIED graded table for pre-2024-07-01 acquisitions (reference only)
  gradedCgtReference: [
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "< 1 year", rate: 0.15 },
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "1-2 years", rate: 0.125 },
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "2-3 years", rate: 0.10 },
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "3-4 years", rate: 0.075 },
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "4-5 years", rate: 0.05 },
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "5-6 years", rate: 0.025 },
    { acquired: "2022-07-01 .. 2024-06-30", holdingPeriod: "> 6 years", rate: 0.0 },
    { acquired: "on/before 2022-06-30", holdingPeriod: "any", rate: 0.125 },
    { acquired: "before 2013-07-01", holdingPeriod: "any", rate: 0.0 },
  ],
  sources: [
    "PwC Worldwide Tax Summaries — Pakistan, individual income determination (last reviewed 24 Aug 2026): https://taxsummaries.pwc.com/pakistan/individual/income-determination",
    "PwC Worldwide Tax Summaries — Pakistan, corporate income determination (last reviewed 24 Aug 2026): https://taxsummaries.pwc.com/pakistan/corporate/income-determination",
    "FBR Withholding Tax Rates index (Tax Year cards): https://www.fbr.gov.pk/withholding-tax-rates/51147/81155",
  ],
  disclaimer:
    "Illustrative estimate only — not professional tax advice. Non-filer CGT uses the verified 15% statutory floor; actual liability follows your personal income-tax slab and may be higher. Verify current rates with a licensed tax practitioner or FBR before relying on any figure.",
} as const;

/** True when the given rate's application should carry a provisional/unverified warning. */
export function isRateUnverified(kind: "cgt" | "dividend", status: FilerStatus): boolean {
  const v: Record<string, string> = TAX_SCHEDULE.verification;
  const key = `${kind === "cgt" ? "nonFilerCgtRate" : "nonFilerDividendRate"}`;
  const value = status === "non-filer" ? v[key] : v[kind === "cgt" ? "filerCgtRate" : "filerDividendRate"];
  return value !== "VERIFIED";
}

export const CGT_RATE: Record<FilerStatus, number> = {
  filer: 0.15,
  // statutory FLOOR for non-ATL sellers (slab rates apply above it — see
  // TAX_SCHEDULE.verification.nonFilerCgtRate; result is labelled provisional)
  "non-filer": 0.15,
};

export const DIVIDEND_TAX_RATE: Record<FilerStatus, number> = {
  filer: 0.15,
  "non-filer": 0.30, // resident inactive taxpayer: 15% × (100% uplift) — VERIFIED
};

export interface CgtInput {
  buyPrice: number;
  sellPrice: number;
  shares: number;
  commissionPct?: number; // broker commission as % of trade value (default 0.12%)
  filerStatus: FilerStatus;
}

export interface CgtResult {
  buyValue: number;
  sellValue: number;
  grossGain: number;            // sell - buy (before costs)
  commissionBuy: number;
  commissionSell: number;
  totalCommission: number;
  transactionCosts: number;     // total commission paid
  netGain: number;              // grossGain - transactionCosts
  cgtRate: number;              // 0.15 or 0.30
  cgtAmount: number;            // tax owed
  profitAfterTax: number;      // netGain - cgtAmount
  lossOffsetEligible: boolean; // losses can offset other gains within fiscal year
  effectiveTaxRate: number;     // cgtAmount / grossGain (can exceed CGT_RATE if transaction costs eat gains)
}

export function calculateCGT(input: CgtInput): CgtResult {
  const commissionPct = input.commissionPct ?? 0.0012; // 0.12% default
  const buyValue = input.buyPrice * input.shares;
  const sellValue = input.sellPrice * input.shares;
  const grossGain = sellValue - buyValue;
  const commissionBuy = buyValue * commissionPct;
  const commissionSell = sellValue * commissionPct;
  const totalCommission = commissionBuy + commissionSell;
  const transactionCosts = totalCommission;
  const netGain = grossGain - transactionCosts;

  // CGT only applies to POSITIVE net gains. Losses → no tax owed, but can offset other gains.
  const cgtRate = CGT_RATE[input.filerStatus];
  const cgtAmount = netGain > 0 ? netGain * cgtRate : 0;
  const profitAfterTax = netGain - cgtAmount;
  const effectiveTaxRate = grossGain > 0 ? cgtAmount / grossGain : 0;

  return {
    buyValue,
    sellValue,
    grossGain,
    commissionBuy,
    commissionSell,
    totalCommission,
    transactionCosts,
    netGain,
    cgtRate,
    cgtAmount,
    profitAfterTax,
    lossOffsetEligible: netGain < 0,
    effectiveTaxRate,
  };
}

// Aggregate CGT for multiple realized trades within the same fiscal year.
// Losses offset gains before applying the tax rate.
export interface RealizedTrade {
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  shares: number;
  realizedAt: string; // ISO date
}

export interface AggregatedCgtResult {
  totalGrossGain: number;       // sum of all positive gains
  totalGrossLoss: number;       // sum of all negative gains (absolute value)
  netGain: number;              // totalGrossGain - totalGrossLoss
  totalCommission: number;
  taxableGain: number;          // netGain - totalCommission (if > 0)
  cgtAmount: number;
  profitAfterTax: number;
  lossCarriedForward: number;   // if net loss > total commission, the loss carries forward (Pakistan rule)
  filerStatus: FilerStatus;
  tradeCount: number;
  winningTrades: number;
  losingTrades: number;
}

export function calculateAggregatedCGT(trades: RealizedTrade[], filerStatus: FilerStatus): AggregatedCgtResult {
  let totalGrossGain = 0;
  let totalGrossLoss = 0;
  let totalCommission = 0;
  let winningTrades = 0;
  let losingTrades = 0;

  for (const trade of trades) {
    const result = calculateCGT({ ...trade, filerStatus });
    if (result.netGain > 0) {
      totalGrossGain += result.netGain;
      winningTrades += 1;
    } else if (result.netGain < 0) {
      totalGrossLoss += Math.abs(result.netGain);
      losingTrades += 1;
    }
    totalCommission += result.totalCommission;
  }

  const netGain = totalGrossGain - totalGrossLoss;
  const taxableGain = Math.max(0, netGain);
  const cgtRate = CGT_RATE[filerStatus];
  const cgtAmount = taxableGain * cgtRate;
  const profitAfterTax = netGain - cgtAmount;
  const lossCarriedForward = netGain < 0 ? Math.abs(netGain) : 0;

  return {
    totalGrossGain,
    totalGrossLoss,
    netGain,
    totalCommission,
    taxableGain,
    cgtAmount,
    profitAfterTax,
    lossCarriedForward,
    filerStatus,
    tradeCount: trades.length,
    winningTrades,
    losingTrades,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dividend tax
// ────────────────────────────────────────────────────────────────────────────

export interface DividendTaxInput {
  shares: number;
  dividendPerShare: number;
  filerStatus: FilerStatus;
}

export interface DividendTaxResult {
  grossDividend: number;
  taxRate: number;
  taxAmount: number;
  netDividend: number;
}

export function calculateDividendTax(input: DividendTaxInput): DividendTaxResult {
  const grossDividend = input.shares * input.dividendPerShare;
  const taxRate = DIVIDEND_TAX_RATE[input.filerStatus];
  const taxAmount = grossDividend * taxRate;
  const netDividend = grossDividend - taxAmount;
  return {
    grossDividend,
    taxRate,
    taxAmount,
    netDividend,
  };
}
