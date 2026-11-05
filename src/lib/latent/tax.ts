// Latent.pk — Tax calculation helpers
//
// Task 116 (C6): the applicable schedule is now VERSIONED and its claims are
// separated by verification status. Verified against sources current at
// verification time; rates that could not be independently confirmed are
// flagged UNVERIFIED rather than silently applied as fact. All outputs are
// ILLUSTRATIVE ESTIMATES, not professional tax advice.
//
// Schedule "pk-cgt-v2026-11" (verified 2026-11-05):
//   - CGT on PSX listed securities acquired on/after 2024-07-01, seller on the
//     Active Taxpayer List (filer): 15% — VERIFIED
//     (PwC Worldwide Tax Summaries, Pakistan — corporate income determination,
//     updated Aug 2026: filer on ATL at acquisition AND disposal → 15%;
//     https://taxsummaries.pwc.com/pakistan/corporate/income-determination)
//   - Non-filer CGT rate: UNVERIFIED — public sources disagree (30% commonly
//     cited; holding-period-graded schedules also reported). Displayed only
//     with an explicit unverified warning.
//   - Dividend WHT: filer 15% — VERIFIED (same PwC source: dividends generally
//     final tax at 15%; exceptions exist, e.g. 25% where the paying company
//     had no tax payable). Non-filer 30% — UNVERIFIED (commonly cited).
//   - Loss offset: capital losses may offset capital gains within the same
//     tax year (July 1 – June 30) — carry-forward beyond that NOT modelled.
//
// CGT is only on REALIZED gains (when you actually sell). Unrealized/paper gains are not taxable.

export type FilerStatus = "filer" | "non-filer";

export const TAX_SCHEDULE = {
  scheduleId: "pk-cgt-v2026-11",
  effectiveFrom: "2024-07-01", // acquisition-date regime for listed securities
  verifiedAt: "2026-11-05",
  verification: {
    filerCgtRate: "VERIFIED",
    nonFilerCgtRate: "UNVERIFIED",
    filerDividendRate: "VERIFIED",
    nonFilerDividendRate: "UNVERIFIED",
  } as Record<string, string>,
  sources: [
    "PwC Worldwide Tax Summaries — Pakistan, corporate income determination (updated Aug 2026): https://taxsummaries.pwc.com/pakistan/corporate/income-determination",
    "FBR Withholding Tax Rates index (Tax Year cards): https://www.fbr.gov.pk/withholding-tax-rates/51147/81155",
  ],
  disclaimer:
    "Illustrative estimate only — not professional tax advice. Verify current rates with a licensed tax practitioner or FBR before relying on any figure.",
} as const;

/** True when the given rate's verification status is UNVERIFIED. */
export function isRateUnverified(kind: "cgt" | "dividend", status: FilerStatus): boolean {
  const v: Record<string, string> = TAX_SCHEDULE.verification;
  const key = `${kind === "cgt" ? "nonFilerCgtRate" : "nonFilerDividendRate"}`;
  if (status === "non-filer") return v[key] === "UNVERIFIED";
  return v[kind === "cgt" ? "filerCgtRate" : "filerDividendRate"] === "UNVERIFIED";
}

export const CGT_RATE: Record<FilerStatus, number> = {
  filer: 0.15,
  "non-filer": 0.30,
};

export const DIVIDEND_TAX_RATE: Record<FilerStatus, number> = {
  filer: 0.15,
  "non-filer": 0.30,
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
