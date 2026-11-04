// ============================================================================
// Task 111 / Phase 4 — Company financial-result PATTERN FINDER (deterministic).
//
// All math is deterministic TypeScript; the LLM may only SUMMARIZE the output.
// Data source: the platform's quarterly financial-results snapshots
// (data/financials/{sym}.json via financial-results.ts). Publication
// timestamps of the underlying filings are NOT point-in-time safe (Task 102:
// zero verified statement publication dates), so every pattern is tagged
// with that limitation and is disabled for historical as-of use.
// ============================================================================
import type { ParsedQuarter } from "../financial-results";

export interface FinancialPattern {
  pattern_id: string;
  symbol: string;
  pattern_type: string;
  period_start: string;
  period_end: string;
  observation_count: number;
  direction: "improving" | "deteriorating" | "stable" | "mixed";
  strength: number; // 0-1 deterministic strength
  source_filing_ids: string[];
  publication_timestamps: (string | null)[]; // null: not PIT verified
  data_quality: "verified" | "partially_verified" | "insufficient_history";
  as_of_timestamp: string;
  limitations: string[];
}

const MIN_QUARTERS = 4; // a single quarter can never establish a repeated pattern

function linSlope(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

function pct(newV: number, oldV: number): number | null {
  if (oldV === 0 || !isFinite(oldV) || !isFinite(newV)) return null;
  return ((newV - oldV) / Math.abs(oldV)) * 100;
}

export interface PatternFinderResult {
  symbol: string;
  as_of_timestamp: string;
  quarters_used: number;
  period_range: [string, string] | null;
  patterns: FinancialPattern[];
  insufficient_history: boolean;
  notes: string[];
}

/**
 * Detect recurring financial-result patterns from verified quarterly data.
 * `quarters` must be ordered oldest -> newest and only contain quarters from
 * the verified snapshot (no imputation).
 */
export function findCompanyFinancialPatterns(
  symbol: string,
  quarters: ParsedQuarter[],
  asOfTimestamp: string
): PatternFinderResult {
  const notes: string[] = [];
  const qs = quarters.filter((q) => q && q.periodEnd && isFinite(q.metrics?.revenue ?? NaN) === false ? false : Boolean(q));
  const clean = qs.filter(
    (q) => q.metrics && (q.metrics.revenue > 0 || q.metrics.profitAfterTax !== 0 || q.metrics.eps !== 0)
  );
  if (clean.length < MIN_QUARTERS) {
    return {
      symbol,
      as_of_timestamp: asOfTimestamp,
      quarters_used: clean.length,
      period_range: clean.length ? [clean[0].periodEnd, clean[clean.length - 1].periodEnd] : null,
      patterns: [],
      insufficient_history: true,
      notes: [
        `insufficient_history: ${clean.length} verified quarters available, ${MIN_QUARTERS} consecutive required`,
        "publication timestamps of underlying filings are not point-in-time verified (Task 102); patterns are research summaries, disabled for historical as-of use",
      ],
    };
  }
  const patterns: FinancialPattern[] = [];
  const revs = clean.map((q) => q.metrics.revenue);
  const pats = clean.map((q) => q.metrics.profitAfterTax);
  const eps = clean.map((q) => q.metrics.eps);
  const gm = clean.map((q) => q.metrics.grossMargin);
  const nm = clean.map((q) => q.metrics.netMargin);
  const periods = clean.map((q) => q.periodEnd);
  const srcIds = clean.map((_, i) => `${symbol}:FINRES:${periods[i]}`);
  const pubTs: (string | null)[] = clean.map(() => null); // never fabricate publication dates
  const baseLim = [
    "quarterly snapshot data; underlying filing publication dates are not point-in-time verified (Task 102/111)",
    `only ${clean.length} verified quarters; annual seasonality cannot be established from this window`,
  ];

  const push = (
    pattern_type: string,
    ys: number[],
    direction: FinancialPattern["direction"],
    strength: number,
    extraLim: string[] = []
  ) => {
    patterns.push({
      pattern_id: `${symbol}:${pattern_type}:${periods[0]}:${periods[periods.length - 1]}`,
      symbol,
      pattern_type,
      period_start: periods[0],
      period_end: periods[periods.length - 1],
      observation_count: clean.length,
      direction,
      strength: Math.max(0, Math.min(1, strength)),
      source_filing_ids: srcIds,
      publication_timestamps: pubTs,
      data_quality: "partially_verified",
      as_of_timestamp: asOfTimestamp,
      limitations: [...baseLim, ...extraLim],
    });
  };

  // 1. Revenue trend (level growth + acceleration)
  const revYoY: number[] = [];
  for (let i = 4; i < revs.length; i++) revYoY.push(pct(revs[i], revs[i - 4]) ?? NaN);
  const revSlope = linSlope(revs.map((_, i) => i), revs);
  if (revSlope != null) {
    const rel = revSlope / (revs.reduce((a, b) => a + b, 0) / revs.length);
    const dir: FinancialPattern["direction"] = rel > 0.01 ? "improving" : rel < -0.01 ? "deteriorating" : "stable";
    push("revenue_trend", revs, dir, Math.min(1, Math.abs(rel) * 4));
  }
  if (revYoY.length >= 3) {
    const acc = linSlope(revYoY.map((_, i) => i), revYoY);
    if (acc != null && isFinite(acc)) {
      const dir: FinancialPattern["direction"] = acc > 0 ? "improving" : acc < 0 ? "deteriorating" : "stable";
      push(
        acc > 0 ? "revenue_growth_accelerating" : "revenue_growth_decelerating",
        revYoY.map((v) => v),
        dir,
        Math.min(1, Math.abs(acc) / 10),
        ["YoY requires 4-quarter lookback; computed on " + revYoY.length + " YoY observations"]
      );
    }
  }

  // 2. Profitability: repeated profits/losses + margin trend
  const lossStreaks = pats.map((p) => p < 0);
  const lossCount = lossStreaks.filter(Boolean).length;
  if (lossCount === 0) push("repeated_profitability", pats, "improving", 0.6);
  else if (lossCount === pats.length) push("repeated_losses", pats, "deteriorating", 0.8);
  const nmSlope = linSlope(nm.map((_, i) => i), nm);
  if (nmSlope != null) {
    const dir: FinancialPattern["direction"] = nmSlope > 0.1 ? "improving" : nmSlope < -0.1 ? "deteriorating" : "stable";
    push("net_margin_trend", nm, dir, Math.min(1, Math.abs(nmSlope) / 2));
  }
  const gmSlope = linSlope(gm.map((_, i) => i), gm);
  if (gmSlope != null && Math.abs(gmSlope) > 0.1) {
    push(
      gmSlope > 0 ? "gross_margin_expansion" : "gross_margin_contraction",
      gm,
      gmSlope > 0 ? "improving" : "deteriorating",
      Math.min(1, Math.abs(gmSlope) / 2)
    );
  }

  // 3. EPS vs revenue divergence (EPS growth without revenue support)
  const epsSlope = linSlope(eps.map((_, i) => i), eps);
  if (epsSlope != null && revSlope != null && epsSlope > 0 && revSlope <= 0) {
    push("eps_growth_without_revenue_support", eps, "mixed", 0.5, [
      "EPS trending up while revenue flat/declining — verify one-off effects before interpreting",
    ]);
  }

  // 4. Volatility of earnings (stability)
  const pm = pats.map((p) => (p / (revs[pats.indexOf(p)] || 1)) * 100);
  const mean = pm.reduce((a, b) => a + b, 0) / pm.length;
  const sd = Math.sqrt(pm.reduce((a, b) => a + (b - mean) ** 2, 0) / pm.length);
  push(
    "earnings_stability",
    pm,
    sd < Math.max(2, Math.abs(mean) * 0.25) ? "stable" : "mixed",
    Math.max(0, Math.min(1, 1 - sd / Math.max(10, Math.abs(mean)))),
    ["margin volatility proxy; not a forecast"]
  );

  notes.push("All patterns are deterministic summaries of the verified snapshot; the LLM may only restate them.");
  notes.push("No operating cash flow / balance-sheet fields exist in the quarterly snapshot — cash-flow-quality and leverage patterns return insufficient_data.");
  return {
    symbol,
    as_of_timestamp: asOfTimestamp,
    quarters_used: clean.length,
    period_range: [periods[0], periods[periods.length - 1]],
    patterns,
    insufficient_history: false,
    notes,
  };
}
