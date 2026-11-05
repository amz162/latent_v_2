// Latent.pk — strategy indicator primitives (Task 116 Part D)
//
// Point-in-time discipline: every function here is a pure trailing-window
// computation. Nothing looks ahead: rolling statistics at index i use only
// observations ≤ i; "confirmation" lags are respected by returning null until
// enough trailing history exists. These primitives are the single canonical
// TypeScript implementation for the beta 12-strategy engine.

export function sma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  let sum = 0;
  for (let i = values.length - n; i < values.length; i++) sum += values[i];
  return sum / n;
}

export function smaSeries(values: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  const win: number[] = [];
  for (const v of values) {
    if (v == null || Number.isNaN(v)) {
      out.push(null);
      continue;
    }
    win.push(v);
    if (win.length > n) win.shift();
    out.push(win.length === n ? win.reduce((a, b) => a + b, 0) / n : null);
  }
  return out;
}

export function emaSeries(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (n + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < n) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      // seed with SMA of the first n values (standard EMA warm-up)
      let sum = 0;
      for (let j = 0; j < n; j++) sum += values[j];
      prev = sum / n;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

/** Wilder-smoothed RSI (the platform-canonical method). */
export function wilderRsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gainSum += d;
    else lossSum -= d;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = Math.max(0, d);
    const loss = Math.max(0, -d);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface OhlcvLike {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** True range; first bar uses high-low (no previous close). */
export function trueRange(bars: OhlcvLike[]): (number | null)[] {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
}

/** Wilder ATR. */
export function atrSeries(bars: OhlcvLike[], period = 14): (number | null)[] {
  const tr = trueRange(bars);
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < period) return out;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i] ?? 0;
  let atr = sum / period;
  out[period] = atr;
  for (let i = period + 1; i < bars.length; i++) {
    atr = ((atr * (period - 1)) + (tr[i] ?? 0)) / period;
    out[i] = atr;
  }
  return out;
}

export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

/** OLS slope/intercept/residual-sd for y ~ x over trailing window (x = 0..n-1). */
export function linreg(y: number[]): { slope: number; intercept: number; residualSd: number; r2: number } | null {
  const n = y.length;
  if (n < 3) return null;
  const xm = (n - 1) / 2;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (i - xm) * (i - xm);
    sxy += (i - xm) * (y[i] - ym);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = ym - slope * xm;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const e = y[i] - (intercept + slope * i);
    ssRes += e * e;
  }
  const residualSd = Math.sqrt(ssRes / Math.max(1, n - 2));
  const ssTot = sxx * slope * slope; // = Syy - SSres by projection identity
  const ssY = ssRes + ssTot;
  const r2 = ssY > 0 ? ssTot / ssY : 0;
  return { slope, intercept, residualSd, r2 };
}

/** Lag-1 autocorrelation of a series + rough t-stat. */
export function autocorr1(values: number[]): { rho: number; t: number; n: number } | null {
  if (values.length < 10) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) den += (values[i] - m) * (values[i] - m);
  for (let i = 1; i < values.length; i++) num += (values[i] - m) * (values[i - 1] - m);
  if (den === 0) return null;
  const rho = num / den;
  const t = rho * Math.sqrt(values.length);
  return { rho, t, n: values.length };
}

/**
 * Lo–MacKinlay variance ratio with heteroskedasticity-robust z-stat,
 * computed on trailing log returns. q must be ≥ 2. Returns null when the
 * sample is too small — callers must treat that as insufficient_data.
 */
export function varianceRatio(
  logRet: number[],
  q: number
): { vr: number; z: number; nObs: number } | null {
  const n = logRet.length;
  if (q < 2 || n < 2 * q + 10) return null;
  const mu = logRet.reduce((a, b) => a + b, 0) / n;
  const demeaned = logRet.map((r) => r - mu);
  let sigma2 = 0;
  for (const d of demeaned) sigma2 += d * d;
  sigma2 /= n;
  // overlapping q-period variance
  let sigma2q = 0;
  let m = 0;
  for (let i = q; i < n; i++) {
    let s = 0;
    for (let j = i - q + 1; j <= i; j++) s += demeaned[j];
    sigma2q += s * s;
    m++;
  }
  if (m <= 0 || sigma2 === 0) return null;
  sigma2q /= m * q;
  const vr = sigma2q / sigma2;
  // heteroskedasticity-robust asymptotic variance (Lo-MacKinlay 1988)
  let theta = 0;
  for (let k = 1; k < q; k++) {
    let dk = 0;
    const denom = n;
    let num = 0;
    for (let t = k; t < n; t++) num += demeaned[t] * demeaned[t - k];
    dk = (num / denom) / sigma2;
    const c = ((2 * (q - k)) / q) ** 2; // (2(q-k)/q)^2
    theta += c * dk * dk;
  }
  const z = Math.sqrt(n) * (vr - 1) / Math.sqrt(Math.max(theta, 1e-12));
  return { vr, z, nObs: n };
}

/**
 * Rescaled-range Hurst exponent on a RETURN-like series (not price levels).
 * Aggregated over multiple sub-window sizes with sample-size diagnostics.
 */
export function hurstExponent(
  values: number[]
): { h: number; nObs: number; minWindow: number } | null {
  const n = values.length;
  if (n < 64) return null;
  const sizes = [8, 16, 32, 64].filter((s) => n >= 4 * s);
  if (sizes.length < 2) return null;
  const pts: Array<{ logS: number; logRS: number }> = [];
  for (const s of sizes) {
    const chunks = Math.floor(n / s);
    let rsSum = 0;
    let used = 0;
    for (let c = 0; c < chunks; c++) {
      const seg = values.slice(c * s, (c + 1) * s);
      const m = seg.reduce((a, b) => a + b, 0) / s;
      let cum = 0;
      let min = Infinity;
      let max = -Infinity;
      for (const x of seg) {
        cum += x - m;
        min = Math.min(min, cum);
        max = Math.max(max, cum);
      }
      const sd = stdev(seg);
      if (!sd || sd === 0) continue;
      const range = max - min;
      rsSum += range / sd;
      used++;
    }
    if (used > 0) pts.push({ logS: Math.log(s), logRS: Math.log(rsSum / used) });
  }
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.logS);
  const ys = pts.map((p) => p.logRS);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  if (den === 0) return null;
  return { h: num / den, nObs: n, minWindow: Math.min(...sizes) };
}

/**
 * OU / AR(1) fit on a trailing series: x_{t+1} = a + b·x_t.
 * Returns validity flags — a non-stationary fit is reported as such, never
 * clamped into a passing range.
 */
export function fitAr1(
  x: number[]
): { b: number; a: number; r2: number; n: number; halfLife: number | null; stationary: boolean } | null {
  if (x.length < 30) return null;
  const lhs = x.slice(1);
  const rhs = x.slice(0, -1);
  const reg = linregPair(rhs, lhs);
  if (!reg) return null;
  const stationary = reg.b > 0 && reg.b < 1;
  const halfLife = reg.b > 0 && reg.b < 1 ? Math.log(2) / -Math.log(reg.b) : null;
  return { b: reg.b, a: reg.a, r2: reg.r2, n: x.length, halfLife, stationary };
}

function linregPair(x: number[], y: number[]): { a: number; b: number; r2: number } | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) * (x[i] - mx);
    sxy += (x[i] - mx) * (y[i] - my);
    syy += (y[i] - my) * (y[i] - my);
  }
  if (sxx === 0 || syy === 0) return null;
  const b = sxy / sxx;
  const a = my - b * mx;
  return { a, b, r2: (sxy * sxy) / (sxx * syy) };
}
