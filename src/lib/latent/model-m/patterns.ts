/**
 * Task 129 / Phase 7.1 — Market-price monthly pattern analysis for Model M.
 *
 * Analyzes the historical calendar-month behavior of a single stock from the
 * VERIFIED OhlcvBar history: month-wise average/median returns, positive-month
 * frequency, dispersion and volatility by month, plus a small-sample guard —
 * a month with fewer than MIN_MONTHLY_SAMPLES observations is reported as
 * `insufficient_history` and NEVER presented as a seasonality claim.
 *
 * Returns are close-to-close over each CALENDAR month (last close of the
 * month vs last close of the previous month), so no future data is used and
 * every finding carries its sample size, date range and dispersion.
 */

import type { AnalysisBar } from "./technical";

export const MIN_MONTHLY_SAMPLES = 3;

export interface MonthlyBucket {
  month: number;              // 1 = January … 12 = December
  samples: number;
  firstYear: number | null;
  lastYear: number | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  stdevReturnPct: number | null;
  positiveFreq: number | null; // 0..1
  avgVolRatio: number | null;  // month's avg volume / 12-month avg volume
  avgVolatilityPct: number | null; // mean of monthly daily-return σ
  sufficient: boolean;         // samples >= MIN_MONTHLY_SAMPLES
}

export interface MarketPatternSummary {
  months: MonthlyBucket[];
  historyYears: number;
  firstDate: string | null;
  lastDate: string | null;
  bestMonth: { month: number; avgReturnPct: number; samples: number } | null;
  worstMonth: { month: number; avgReturnPct: number; samples: number } | null;
  caveat: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function analyzeMonthlyPatterns(bars: AnalysisBar[]): MarketPatternSummary {
  const overallVol = stdev(
    bars.slice(1).map((b, i) => (bars[i].close > 0 ? (b.close - bars[i].close) / bars[i].close : 0))
  );
  const overallAvgVol = bars.length ? bars.reduce((a, b) => a + b.volume, 0) / bars.length : 0;

  // group bars by calendar month
  const byMonth = new Map<number, AnalysisBar[]>();
  for (const b of bars) {
    const m = Number(b.date.slice(5, 7));
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m)!.push(b);
  }

  // monthly close-to-close returns: last close of each month vs last close of
  // the PREVIOUS calendar month (any month boundary actually present in data)
  const monthLastClose = new Map<string, number>(); // "YYYY-MM" -> close
  for (const b of bars) monthLastClose.set(b.date.slice(0, 7), b.close);
  const monthReturn = new Map<number, number[]>(); // month -> returns
  const monthVol = new Map<number, number[]>();    // month -> daily σ per year
  const monthVolRatio = new Map<number, number[]>();
  const keys = [...monthLastClose.keys()].sort();
  for (let i = 1; i < keys.length; i++) {
    const [y0, m0] = keys[i - 1].split("-").map(Number);
    const [y1, m1] = keys[i].split("-").map(Number);
    // only consecutive calendar months count as a monthly return
    const expectedNext = m0 === 12 ? `${y0 + 1}-01` : `${y0}-${String(m0 + 1).padStart(2, "0")}`;
    if (keys[i] !== expectedNext) continue;
    const prev = monthLastClose.get(keys[i - 1])!;
    const cur = monthLastClose.get(keys[i])!;
    if (!(prev > 0)) continue;
    const r = ((cur - prev) / prev) * 100;
    if (!monthReturn.has(m1)) monthReturn.set(m1, []);
    monthReturn.get(m1)!.push(r);
  }
  // per-month daily volatility + volume ratio (per calendar-month bucket)
  for (const [m, mbars] of byMonth) {
    const rets: number[] = [];
    for (let i = 1; i < mbars.length; i++) {
      if (mbars[i - 1].close > 0) rets.push((mbars[i].close - mbars[i - 1].close) / mbars[i - 1].close);
    }
    const sd = rets.length >= 2 ? stdev(rets) * 100 : NaN;
    if (!monthVol.has(m)) monthVol.set(m, []);
    if (Number.isFinite(sd)) monthVol.get(m)!.push(sd);
    const avgVol = mbars.reduce((a, b) => a + b.volume, 0) / Math.max(1, mbars.length);
    if (!monthVolRatio.has(m)) monthVolRatio.set(m, []);
    if (overallAvgVol > 0) monthVolRatio.get(m)!.push(avgVol / overallAvgVol);
  }

  const years = new Set(bars.map((b) => b.date.slice(0, 4)));
  const months: MonthlyBucket[] = [];
  for (let m = 1; m <= 12; m++) {
    const rs = monthReturn.get(m) ?? [];
    const mbars = byMonth.get(m) ?? [];
    const yrs = mbars.map((b) => Number(b.date.slice(0, 4)));
    const sufficient = rs.length >= MIN_MONTHLY_SAMPLES;
    months.push({
      month: m,
      samples: rs.length,
      firstYear: yrs.length ? Math.min(...yrs) : null,
      lastYear: yrs.length ? Math.max(...yrs) : null,
      avgReturnPct: sufficient ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      medianReturnPct: sufficient ? median(rs) : null,
      stdevReturnPct: sufficient && rs.length >= 2 ? stdev(rs) : null,
      positiveFreq: sufficient ? rs.filter((r) => r > 0).length / rs.length : null,
      avgVolRatio: (monthVolRatio.get(m) ?? []).length ? (monthVolRatio.get(m)!).reduce((a, b) => a + b, 0) / (monthVolRatio.get(m)!).length : null,
      avgVolatilityPct: (monthVol.get(m) ?? []).length ? (monthVol.get(m)!).reduce((a, b) => a + b, 0) / (monthVol.get(m)!).length : null,
      sufficient,
    });
  }
  const sufficientMonths = months.filter((m) => m.sufficient && m.avgReturnPct != null);
  const best = sufficientMonths.length ? sufficientMonths.reduce((a, b) => (b.avgReturnPct! > a.avgReturnPct! ? b : a)) : null;
  const worst = sufficientMonths.length ? sufficientMonths.reduce((a, b) => (b.avgReturnPct! < a.avgReturnPct! ? b : a)) : null;

  return {
    months,
    historyYears: years.size,
    firstDate: bars.length ? bars[0].date : null,
    lastDate: bars.length ? bars[bars.length - 1].date : null,
    bestMonth: best ? { month: best.month, avgReturnPct: best.avgReturnPct!, samples: best.samples } : null,
    worstMonth: worst ? { month: worst.month, avgReturnPct: worst.avgReturnPct!, samples: worst.samples } : null,
    caveat:
      `Monthly statistics use ${bars.length} bars over ${years.size} years; a month needs at least ` +
      `${MIN_MONTHLY_SAMPLES} observed month-transitions before any average is shown. ` +
      (overallVol > 0 ? `Whole-history daily σ ≈ ${(overallVol * 100).toFixed(2)}%. ` : "") +
      "Small samples and single-stock history make these OBSERVATIONS, not seasonality claims; " +
      "no out-of-sample validation of calendar effects is implied.",
  };
}
