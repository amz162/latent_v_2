/**
 * Task 110 — Volatility & Convexity Analytics (TS engine).
 *
 * Dashboard reference implementation mirroring scripts/task110_lib.py:
 *  - Close-to-close:   Var_CC  = 252 × sampleVar(ln(C_t/C_{t-1}), window)
 *  - Parkinson:        Var_P   = 252 × mean[ln(H/L)²] / (4 ln2)
 *  - Garman-Klass:     Var_GK  = 252 × mean[0.5·ln(H/L)² − (2ln2−1)·ln(C/O)²]
 *  Each estimator is annualized EXACTLY ONCE; volatility = sqrt(annualized
 *  variance) × 100 (no double 252 — the classic psx_simulator.py bug).
 *  - GK negatives are kept (never clipped) and reported; sqrt of a negative
 *    yields null (volatility unavailable for that observation).
 *  - BBW = (Upper−Lower)/Middle with Middle = SMA_w(close), Upper/Lower =
 *    Middle ± k·stdev_w (sample stdev, ddof=1).
 *  - Derivatives are first/second DIFFERENCES between global-calendar-
 *    adjacent observations only; across a gap they are null (a k-session gap
 *    is never treated as one period).
 *  - Regimes are descriptive research watches over REALIZED volatility. They
 *    are NOT implied volatility and MUST NOT be read as option signals.
 */
import type { Bar } from "./golden-cross";

export const ANNUALIZATION = 252;
const LN2 = Math.LN2;

export type Regime =
  | "long_vol_watch"
  | "volatility_expansion"
  | "volatility_compression"
  | "short_vol_watch"
  | "mean_reversion_watch"
  | "transition"
  | "wait"
  | "insufficient_data";

export function rollingSampleVariance(xs: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let t = 0; t < xs.length; t++) {
    if (t < n - 1) {
      out.push(null);
      continue;
    }
    const seg: number[] = [];
    let ok = true;
    for (let j = t - n + 1; j <= t; j++) {
      const v = xs[j];
      if (v == null) {
        ok = false;
        break;
      }
      seg.push(v);
    }
    if (!ok || seg.length !== n) {
      out.push(null);
      continue;
    }
    const m = seg.reduce((a, b) => a + b, 0) / n;
    const ss = seg.reduce((a, b) => a + (b - m) * (b - m), 0);
    out.push(ss / (n - 1));
  }
  return out;
}

export function ccDailyVariance(closes: (number | null)[], n: number): (number | null)[] {
  const rets: (number | null)[] = [null];
  for (let t = 1; t < closes.length; t++) {
    const a = closes[t - 1];
    const b = closes[t];
    rets.push(a == null || b == null || a <= 0 || b <= 0 ? null : Math.log(b / a));
  }
  return rollingSampleVariance(rets, n);
}

export function parkinsonDailyVariance(
  highs: (number | null)[],
  lows: (number | null)[],
  n: number
): (number | null)[] {
  const terms: (number | null)[] = [];
  for (let t = 0; t < highs.length; t++) {
    const h = highs[t];
    const l = lows[t];
    terms.push(h == null || l == null || l <= 0 || h < l ? null : Math.log(h / l) ** 2);
  }
  const means: (number | null)[] = terms.map(() => null);
  // rolling MEAN (not variance) of the terms
  for (let t = n - 1; t < terms.length; t++) {
    const seg: number[] = [];
    let ok = true;
    for (let j = t - n + 1; j <= t; j++) {
      const v = terms[j];
      if (v == null) {
        ok = false;
        break;
      }
      seg.push(v);
    }
    means[t] = ok ? seg.reduce((a, b) => a + b, 0) / n / (4 * LN2) : null;
  }
  return means;
}

export function garmanKlassDailyVariance(
  opens: (number | null)[],
  highs: (number | null)[],
  lows: (number | null)[],
  closes: (number | null)[],
  n: number
): { series: (number | null)[]; negatives: number } {
  const terms: (number | null)[] = [];
  for (let t = 0; t < closes.length; t++) {
    const o = opens[t];
    const h = highs[t];
    const l = lows[t];
    const c = closes[t];
    if (o == null || h == null || l == null || c == null || Math.min(o, h, l, c) <= 0 || h < l) {
      terms.push(null);
      continue;
    }
    terms.push(0.5 * Math.log(h / l) ** 2 - (2 * LN2 - 1) * Math.log(c / o) ** 2);
  }
  const series: (number | null)[] = terms.map(() => null);
  let negatives = 0;
  for (let t = n - 1; t < terms.length; t++) {
    const seg: number[] = [];
    let ok = true;
    for (let j = t - n + 1; j <= t; j++) {
      const v = terms[j];
      if (v == null) {
        ok = false;
        break;
      }
      seg.push(v);
    }
    if (!ok) continue;
    const m = seg.reduce((a, b) => a + b, 0) / n;
    if (m < 0) negatives++;
    series[t] = m;
  }
  return { series, negatives };
}

export interface BbwResult {
  bbw: (number | null)[];
  mid: (number | null)[];
  d1: (number | null)[];
  d2: (number | null)[];
}

export function bollingerBandWidth(
  closes: (number | null)[],
  n: number,
  k: number,
  sessionIdx: number[]
): BbwResult {
  const bbw: (number | null)[] = [];
  const mid: (number | null)[] = [];
  for (let t = 0; t < closes.length; t++) {
    if (t < n - 1) {
      bbw.push(null);
      mid.push(null);
      continue;
    }
    const seg: number[] = [];
    let ok = true;
    for (let j = t - n + 1; j <= t; j++) {
      const v = closes[j];
      if (v == null) {
        ok = false;
        break;
      }
      seg.push(v);
    }
    if (!ok) {
      bbw.push(null);
      mid.push(null);
      continue;
    }
    const m = seg.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(seg.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1));
    mid.push(m);
    bbw.push(m > 0 ? (2 * k * sd) / m : null);
  }
  const d1 = firstDiff(bbw, sessionIdx);
  const d2 = secondDiff(d1, sessionIdx);
  return { bbw, mid, d1, d2 };
}

export function firstDiff(xs: (number | null)[], sessionIdx: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let t = 0; t < xs.length; t++) {
    if (t === 0 || xs[t] == null || xs[t - 1] == null || sessionIdx[t] - sessionIdx[t - 1] !== 1) {
      out.push(null);
      continue;
    }
    out.push((xs[t] as number) - (xs[t - 1] as number));
  }
  return out;
}

export function secondDiff(d1: (number | null)[], sessionIdx: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let t = 0; t < d1.length; t++) {
    const ok =
      t >= 2 &&
      d1[t] != null &&
      d1[t - 1] != null &&
      d1[t - 2] != null &&
      sessionIdx[t] - sessionIdx[t - 1] === 1 &&
      sessionIdx[t - 1] - sessionIdx[t - 2] === 1;
    out.push(ok ? (d1[t] as number) - (d1[t - 1] as number) : null);
  }
  return out;
}

export interface RegimeVerdict {
  regime: Regime;
  reason: string;
}

export function classifyRegime(input: {
  bbw: number | null;
  bbwD1: number | null;
  bbwD2: number | null;
  parkAnn: number | null;
  gkAnn: number | null;
  parkD1: number | null;
  ccD1: number | null;
}): RegimeVerdict {
  const { bbw, bbwD1, bbwD2, parkD1, ccD1 } = input;
  if (bbw == null || bbwD1 == null || bbwD2 == null) {
    return { regime: "insufficient_data", reason: "BBW or derivatives missing (warmup/gap)" };
  }
  const up = bbwD1 > 0 && bbwD2 > 0;
  const dn = bbwD1 < 0 && bbwD2 < 0;
  const confirmUp = (parkD1 != null && parkD1 > 0) || (ccD1 != null && ccD1 > 0);
  const confirmDn = (parkD1 != null && parkD1 < 0) || (ccD1 != null && ccD1 < 0);
  if (up && confirmUp) {
    return {
      regime: "long_vol_watch",
      reason:
        "BBW d1>0 and d2>0 with realized-variance expansion confirmation (research watch; NOT implied volatility, NOT an option signal)",
    };
  }
  if (dn && confirmDn) {
    return {
      regime: "volatility_compression",
      reason:
        "BBW d1<0 and d2<0 with realized-variance contraction confirmation (research watch; distinct from short-option premium selling)",
    };
  }
  if (bbwD1 > 0) {
    return {
      regime: "volatility_expansion",
      reason: "BBW first derivative positive (single-observation; persistence not yet confirmed)",
    };
  }
  if (bbwD1 < 0) {
    return {
      regime: "mean_reversion_watch",
      reason:
        "BBW contracting (d1<0); price-based mean reversion is a separate hypothesis requiring return evidence",
    };
  }
  return { regime: "wait", reason: "no expansion/compression condition met" };
}

export interface VolSeriesPoint {
  date: string;
  close: number;
  ccVarAnn: number | null;
  parkVarAnn: number | null;
  gkVarAnn: number | null;
  ccVolPct: number | null;
  parkVolPct: number | null;
  gkVolPct: number | null;
  bbw: number | null;
  bbwD1: number | null;
  bbwD2: number | null;
  ccVarAnnD1: number | null;
  ccVarAnnD2: number | null;
  parkVarAnnD1: number | null;
  parkVarAnnD2: number | null;
  gkVarAnnD1: number | null;
  gkVarAnnD2: number | null;
}

export function computeVolatilityAnalytics(
  bars: Bar[],
  sessionIdxOf: (date: string) => number,
  varWindow = 10,
  bbwWindow = 20,
  bbwK = 2.0
): { series: VolSeriesPoint[]; gkNegatives: number; latest: VolSeriesPoint; regime: RegimeVerdict } {
  const closes = bars.map((b) => (b.valid ? b.close : null));
  const opens = bars.map((b) => (b.valid ? b.open : null));
  const highs = bars.map((b) => (b.valid ? b.high : null));
  const lows = bars.map((b) => (b.valid ? b.low : null));
  const sidx = bars.map((b) => sessionIdxOf(b.date));
  const ccD = ccDailyVariance(closes, varWindow);
  const pkD = parkinsonDailyVariance(highs, lows, varWindow);
  const gk = garmanKlassDailyVariance(opens, highs, lows, closes, varWindow);
  const ann = (xs: (number | null)[]) => xs.map((v) => (v == null ? null : v * ANNUALIZATION));
  const ccA = ann(ccD);
  const pkA = ann(pkD);
  const gkA = ann(gk.series);
  const bbwRes = bollingerBandWidth(closes, bbwWindow, bbwK, sidx);
  const ccD1 = firstDiff(ccA, sidx);
  const ccD2 = secondDiff(ccD1, sidx);
  const pkD1 = firstDiff(pkA, sidx);
  const pkD2 = secondDiff(pkD1, sidx);
  const gkD1 = firstDiff(gkA, sidx);
  const gkD2 = secondDiff(gkD1, sidx);
  const vol = (v: number | null) => (v != null && v > 0 ? Math.round(Math.sqrt(v) * 100 * 10000) / 10000 : null);
  const r4 = (x: number | null) => (x == null ? null : Math.round(x * 10000) / 10000);
  const series: VolSeriesPoint[] = bars.map((b, t) => ({
    date: b.date,
    close: b.close,
    ccVarAnn: r4(ccA[t]),
    parkVarAnn: r4(pkA[t]),
    gkVarAnn: r4(gkA[t]),
    ccVolPct: vol(ccA[t]),
    parkVolPct: vol(pkA[t]),
    gkVolPct: vol(gkA[t]),
    bbw: r4(bbwRes.bbw[t]),
    bbwD1: r4(bbwRes.d1[t]),
    bbwD2: r4(bbwRes.d2[t]),
    ccVarAnnD1: r4(ccD1[t]),
    ccVarAnnD2: r4(ccD2[t]),
    parkVarAnnD1: r4(pkD1[t]),
    parkVarAnnD2: r4(pkD2[t]),
    gkVarAnnD1: r4(gkD1[t]),
    gkVarAnnD2: r4(gkD2[t]),
  }));
  const last = series.length - 1;
  const regime = classifyRegime({
    bbw: bbwRes.bbw[last],
    bbwD1: bbwRes.d1[last],
    bbwD2: bbwRes.d2[last],
    parkAnn: pkA[last],
    gkAnn: gkA[last],
    parkD1: pkD1[last],
    ccD1: ccD1[last],
  });
  return { series, gkNegatives: gk.negatives, latest: series[last], regime };
}
