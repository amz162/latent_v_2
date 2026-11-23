/**
 * Task 129 / Phase 5 — Technical analysis module for Model M.
 *
 * Pure functions over daily OHLCV bars. Every indicator returns its current
 * value, the data window it was computed on, the as-of date, an
 * interpretation, and whether the input window was complete. Nothing here
 * fabricates values: with insufficient history the value is null and
 * `complete: false`.
 *
 * All inputs are the VERIFIED platform OhlcvBar rows (same source as every
 * other research dashboard). No look-ahead: indicators at index i use only
 * bars[0..i]; the caller passes the full history and this module evaluates
 * the LAST bar only.
 */

export interface AnalysisBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult<T = number> {
  name: string;
  value: T | null;
  window: number | null; // bars used
  asOf: string | null;   // date of the last bar used
  complete: boolean;     // true when the full window was available
  interpretation: string;
}

export function sma(values: number[], n: number): number | null {
  if (values.length < n) return null;
  const slice = values.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

export function ema(values: number[], n: number): number | null {
  if (values.length < n) return null;
  const k = 2 / (n + 1);
  let e = values.slice(0, n).reduce((a, b) => a + b, 0) / n; // SMA seed
  for (let i = n; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

export function rsi(closes: number[], n = 14): number | null {
  if (closes.length < n + 1) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  const avgG = gain / n, avgL = loss / n;
  if (avgL === 0) return avgG === 0 ? 50 : 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[]): { macd: number | null; signal: number | null; histogram: number | null } {
  const fast = ema(closes, 12), slow = ema(closes, 26);
  if (fast == null || slow == null) return { macd: null, signal: null, histogram: null };
  const line = fast - slow;
  // signal = EMA9 of the MACD line — rebuild the line series (no look-ahead):
  const lineSeries: number[] = [];
  for (let i = 26; i <= closes.length; i++) {
    const f = ema(closes.slice(0, i), 12), s = ema(closes.slice(0, i), 26);
    if (f != null && s != null) lineSeries.push(f - s);
  }
  const sig = ema(lineSeries, 9);
  return { macd: line, signal: sig, histogram: sig == null ? null : line - sig };
}

export function atr14(bars: AnalysisBar[]): number | null {
  if (bars.length < 15) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], p = bars[i - 1];
    trs.push(Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close)));
  }
  return trs.slice(-14).reduce((a, b) => a + b, 0) / 14;
}

export function bollinger(closes: number[], n = 20, k = 2): { upper: number | null; lower: number | null; mid: number | null; bandwidthPct: number | null } {
  const mid = sma(closes, n);
  if (mid == null) return { upper: null, lower: null, mid: null, bandwidthPct: null };
  const slice = closes.slice(-n);
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mid) ** 2, 0) / n);
  const upper = mid + k * sd, lower = mid - k * sd;
  return { upper, lower, mid, bandwidthPct: mid > 0 ? ((upper - lower) / mid) * 100 : null };
}

function swingPoints(bars: AnalysisBar[], lookback: number, left = 2, right = 2): { highs: number[]; lows: number[] } {
  const highs: number[] = [], lows: number[] = [];
  const start = Math.max(left, bars.length - lookback);
  for (let i = start; i < bars.length - right; i++) {
    const b = bars[i];
    let isHigh = true, isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i || j < 0 || j >= bars.length) continue;
      if (bars[j].high >= b.high) isHigh = false;
      if (bars[j].low <= b.low) isLow = false;
    }
    if (isHigh) highs.push(b.high);
    if (isLow) lows.push(b.low);
  }
  return { highs, lows };
}

function cluster(levels: number[], tolPct: number): number[] {
  const sorted = [...levels].sort((a, b) => a - b);
  const out: number[] = [];
  let bucket: number[] = [];
  const flush = () => {
    if (bucket.length) {
      out.push(bucket.reduce((a, b) => a + b, 0) / bucket.length);
      bucket = [];
    }
  };
  for (const l of sorted) {
    if (!bucket.length || Math.abs(l - bucket[bucket.length - 1]) / bucket[bucket.length - 1] <= tolPct / 100) {
      bucket.push(l);
    } else { flush(); bucket = [l]; }
  }
  flush();
  return out;
}

export interface TechnicalSection {
  indicators: IndicatorResult[];
  supports: number[];
  resistances: number[];
  volume: IndicatorResult | null;
  trendStrength: IndicatorResult | null;
  volatility: IndicatorResult | null;
  recentPriceAction: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number; chgPct: number | null }>;
  asOf: string | null;
}

export function buildTechnicalSection(bars: AnalysisBar[]): TechnicalSection | null {
  if (bars.length < 5) return null;
  const last = bars[bars.length - 1];
  const closes = bars.map((b) => b.close);
  const asOf = last.date;
  const mk = <T,>(name: string, value: T | null, window: number | null, complete: boolean, interpretation: string): IndicatorResult<T> =>
    ({ name, value, window, asOf, complete, interpretation });

  const s7 = sma(closes, 7), s30 = sma(closes, 30);
  const e12 = ema(closes, 12), e26 = ema(closes, 26), e20 = ema(closes, 20), e50 = ema(closes, 50);
  const r14 = rsi(closes);
  const m = macd(closes);
  const a14 = atr14(bars);
  const bb = bollinger(closes);

  const indicators: IndicatorResult[] = [
    mk("SMA 7", s7, 7, s7 != null, s7 == null ? "insufficient history" :
      last.close > s7 ? "close above SMA7 — short-term uptrend" : "close below SMA7 — short-term weakness"),
    mk("SMA 30", s30, 30, s30 != null, s30 == null ? "insufficient history" :
      last.close > s30 ? "close above SMA30 — medium-term uptrend" : "close below SMA30 — medium-term weakness"),
    mk("EMA 12", e12, 12, e12 != null, e12 == null ? "insufficient history" : last.close > e12 ? "close above EMA12" : "close below EMA12"),
    mk("EMA 26", e26, 26, e26 != null, e26 == null ? "insufficient history" : last.close > e26 ? "close above EMA26" : "close below EMA26"),
    mk("RSI (14)", r14, 15, r14 != null, r14 == null ? "insufficient history" :
      r14 >= 70 ? "overbought zone" : r14 <= 30 ? "oversold zone" : "neutral momentum band"),
    mk("MACD (12,26,9)", m.macd, 26 + 9, m.macd != null, m.macd == null ? "insufficient history" :
      m.histogram != null && m.histogram > 0 ? "MACD above signal — bullish momentum" : "MACD at/below signal — bearish or flat momentum"),
    mk("MACD histogram", m.histogram, 26 + 9, m.histogram != null, m.histogram == null ? "insufficient history" : "MACD line minus signal line"),
    mk("ATR (14)", a14, 15, a14 != null, a14 == null ? "insufficient history" :
      last.close > 0 ? `average true range ≈ ${((a14 / last.close) * 100).toFixed(2)}% of price — used by the platform SL/TP policy (SL=1.5×ATR)` : "unavailable"),
    mk("Bollinger upper (20,2)", bb.upper, 20, bb.upper != null, bb.upper == null ? "insufficient history" : "upper band = SMA20 + 2σ"),
    mk("Bollinger lower (20,2)", bb.lower, 20, bb.lower != null, bb.lower == null ? "insufficient history" : "lower band = SMA20 − 2σ"),
    mk("Bollinger bandwidth %", bb.bandwidthPct, 20, bb.bandwidthPct != null, bb.bandwidthPct == null ? "insufficient history" : "(upper−lower)/mid — volatility width"),
    mk("SMA 7 vs SMA 30", s7 != null && s30 != null ? s7 - s30 : null, 30, s7 != null && s30 != null,
      s7 == null || s30 == null ? "insufficient history" :
        s7 > s30 ? "SMA7 above SMA30 — golden-cross regime (MA7/30)" : "SMA7 below SMA30 — dead-cross regime"),
  ];

  // volume analysis: latest vs 20-day average
  const vols = bars.map((b) => b.volume);
  const vAvg20 = vols.length >= 20 ? vols.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
  const volume = mk("Volume vs 20d avg", vAvg20 != null && vAvg20 > 0 ? last.volume / vAvg20 : null, 21,
    vAvg20 != null,
    vAvg20 == null ? "insufficient history" :
      (last.volume / vAvg20) > 1.5 ? "latest volume ≥1.5× 20d average — elevated activity" :
        (last.volume / vAvg20) < 0.5 ? "latest volume ≤0.5× 20d average — subdued activity" :
          "volume near normal");

  // trend strength: EMA20 slope over 5 bars + price position
  let trend: IndicatorResult | null = null;
  if (bars.length >= 25) {
    const e20Now = ema(closes, 20);
    const e20Prev = ema(closes.slice(0, -5), 20);
    const slope = e20Now != null && e20Prev != null && e20Prev > 0 ? ((e20Now - e20Prev) / e20Prev) * 100 : null;
    trend = mk("Trend strength (EMA20 5-bar slope %)", slope, 25, slope != null,
      slope == null ? "insufficient history" :
        slope > 1 ? "strong uptrend" : slope > 0.2 ? "mild uptrend" : slope < -1 ? "strong downtrend" : slope < -0.2 ? "mild downtrend" : "range-bound");
  }

  // volatility: 20d realized (std of daily log returns, annualization omitted — daily)
  let vol: IndicatorResult | null = null;
  if (closes.length >= 21) {
    const rets: number[] = [];
    for (let i = closes.length - 20; i < closes.length; i++) {
      if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mret = rets.reduce((a, b) => a + b, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mret) ** 2, 0) / rets.length);
    vol = mk("Realized volatility (20d daily σ)", sd, 21, true,
      sd > 0.03 ? "high daily volatility" : sd > 0.015 ? "moderate daily volatility" : "low daily volatility");
  }

  // support / resistance from swing points over the last 120 bars
  const sw = swingPoints(bars, 120);
  const supports = cluster(sw.lows, 1.5).sort((a, b) => b - a).slice(0, 3);
  const resistances = cluster(sw.highs, 1.5).sort((a, b) => a - b).slice(0, 3);

  const recent: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number; chgPct: number | null }> = [];
  for (let i = Math.max(1, bars.length - 10); i < bars.length; i++) {
    const prev = bars[i - 1].close;
    recent.push({ ...bars[i], chgPct: prev > 0 ? ((bars[i].close - prev) / prev) * 100 : null });
  }

  return { indicators, supports, resistances, volume, trendStrength: trend, volatility: vol, recentPriceAction: recent, asOf };
}
