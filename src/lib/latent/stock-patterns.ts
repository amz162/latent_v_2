// ============================================================================
// Stock PRICE pattern detection engine — technical/chart patterns from OHLCV.
//
// Mirrors the fundamental pattern engine (mock-company-results.ts#DetectedPattern)
// shape so the UI can reuse the same PatternRow rendering: label, severity,
// strength tier, 0-100 confidence, detailed explanation, supporting data
// points, affected dates, and a plain-English layman summary.
//
// Detector families:
//   * Trend        — regression slope, price vs SMA200, golden/death cross
//   * Momentum     — RSI overbought/oversold, MACD crossovers
//   * Breakout     — 52-week high/low proximity, gap up/down
//   * Structure    — higher highs / lower lows, double top / double bottom
//   * Volatility   — Bollinger Band squeeze
//   * Volume       — volume spikes / dry-up
//   * Candlestick  — engulfing, hammer, shooting star, doji, morning/evening star
//   * Levels       — nearest support / resistance (informational)
// ============================================================================

export interface PriceBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type PatternStrength = "Strong" | "Moderate" | "Weak";
export interface SupportingDataPoint { label: string; value: string; }

export interface StockDetectedPattern {
  type: string;
  label: string;
  severity: "positive" | "negative" | "neutral";
  strength: PatternStrength;
  confidence: number; // 0-100
  category: "trend" | "momentum" | "breakout" | "structure" | "volatility" | "volume" | "candlestick";
  detail: string;
  supportingData: SupportingDataPoint[];
  affectedQuarters: string[]; // dates that triggered the pattern
  laymanSummary: string;
}

export interface StockPatternStats {
  currentPrice: number;
  changePct1D: number;
  changePct1M: number;
  changePct3M: number;
  changePct12M: number;
  trendLabel: "Uptrend" | "Downtrend" | "Sideways";
  trendSlopeAnnualPct: number;
  high52w: number;
  pctFrom52wHigh: number;
  low52w: number;
  pctFrom52wLow: number;
  rsi14: number;
  macdHistogram: number;
  macdStatus: "Bullish" | "Bearish" | "Neutral";
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  volatilityAnnualPct: number;
  avgVolume20: number;
  barCount: number;
  firstDate: string;
  lastDate: string;
  support: { price: number; touches: number; lastTouch: string } | null;
  resistance: { price: number; touches: number; lastTouch: string } | null;
  bullCount: number;
  bearCount: number;
  neutralCount: number;
}

export interface ChartPoint {
  date: string;
  close: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  volume: number;
}

// ────────────────────────── indicator helpers ───────────────────────────────

function smaSeries(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

function emaSeries(values: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsiSeries(closes: number[], n = 14): number[] {
  const out: number[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { out.push(50); continue; }
    const diff = closes[i] - closes[i - 1];
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    if (i <= n) {
      avgGain = (avgGain * (i - 1) + gain) / i;
      avgLoss = (avgLoss * (i - 1) + loss) / i;
    } else {
      avgGain = (avgGain * (n - 1) + gain) / n;
      avgLoss = (avgLoss * (n - 1) + loss) / n;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }
  return out;
}

function macdHistogramSeries(closes: number[]): number[] {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = emaSeries(macdLine, 9);
  return macdLine.map((m, i) => m - signal[i]);
}

interface Pivot { idx: number; price: number; date: string; kind: "high" | "low"; }

function findPivots(bars: PriceBar[], w = 3): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = w; i < bars.length - w; i++) {
    let isHigh = true, isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low <= bars[i].low) isLow = false;
    }
    if (isHigh) pivots.push({ idx: i, price: bars[i].high, date: bars[i].date, kind: "high" });
    if (isLow) pivots.push({ idx: i, price: bars[i].low, date: bars[i].date, kind: "low" });
  }
  return pivots;
}

// Least-squares regression on (index, value)
function linreg(values: number[]): { slope: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, r2: 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const r2 = ssTot === 0 ? 0 : num * num / (den * ssTot);
  return { slope, r2 };
}

function pct(a: number, b: number): number { return b === 0 ? 0 : ((a - b) / b) * 100; }
function fmtP(v: number, d = 1): string { return `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`; }
function fmtPrice(v: number): string { return `Rs. ${v.toFixed(2)}`; }
function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

// Confidence scaled to strength tier — same floors/caps as tab 1.
function conf(strength: PatternStrength, base = 0): number {
  const floor = strength === "Strong" ? 78 : strength === "Moderate" ? 58 : 40;
  const cap = strength === "Strong" ? 95 : strength === "Moderate" ? 78 : 58;
  return Math.max(floor, Math.min(cap, floor + base));
}

function pickStrength(magnitude: number, modTh: number, strongTh: number): PatternStrength {
  if (Math.abs(magnitude) >= strongTh) return "Strong";
  if (Math.abs(magnitude) >= modTh) return "Moderate";
  return "Weak";
}

// ───────────────────────────── main entry ───────────────────────────────────

export function detectStockPatterns(bars: PriceBar[]): { patterns: StockDetectedPattern[]; stats: StockPatternStats; chart: ChartPoint[] } {
  const closes = bars.map((b) => b.close);
  const vols = bars.map((b) => b.volume);
  const n = bars.length;
  const last = bars[n - 1];
  const price = last.close;

  // ── indicators ──
  const sma20S = smaSeries(closes, 20);
  const sma50S = smaSeries(closes, 50);
  const sma200S = smaSeries(closes, 200);
  const sma20 = sma20S[n - 1];
  const sma50 = sma50S[n - 1];
  const sma200 = sma200S[n - 1];
  const rsiS = rsiSeries(closes, 14);
  const rsi14 = rsiS[n - 1];
  const macdHistS = macdHistogramSeries(closes);
  const macdHist = macdHistS[n - 1];
  const vol20S = smaSeries(vols, 20);
  const avgVol20 = vol20S[n - 1] ?? 0;

  // 52-week range
  const lookback52w = Math.max(0, n - 252);
  const last52w = bars.slice(lookback52w);
  const high52w = Math.max(...last52w.map((b) => b.high));
  const low52w = Math.min(...last52w.map((b) => b.low));
  const pctFrom52wHigh = pct(price, high52w);
  const pctFrom52wLow = pct(price, low52w);

  // Returns over horizons
  const changePct1D = n >= 2 ? pct(price, bars[n - 2].close) : 0;
  const changePct1M = n >= 21 ? pct(price, bars[n - 21].close) : changePct1D;
  const changePct3M = n >= 63 ? pct(price, bars[n - 63].close) : changePct1M;
  const changePct12M = n >= 252 ? pct(price, bars[n - 252].close) : pct(price, closes[0]);

  // Trend — regression over last 180 sessions, annualised
  const trendBars = Math.min(180, n);
  const trendCloses = closes.slice(n - trendBars);
  const { slope, r2 } = linreg(trendCloses);
  // slope = PKR change per session → annualise to a % of the current price
  const trendSlopeAnnualPct = price > 0 ? ((slope * 252) / price) * 100 : 0;
  const trendLabel: StockPatternStats["trendLabel"] =
    Math.abs(trendSlopeAnnualPct) < 5 || r2 < 0.15 ? "Sideways" : trendSlopeAnnualPct > 0 ? "Uptrend" : "Downtrend";

  // Volatility — annualised std-dev of daily returns (last 90 sessions)
  const rets: number[] = [];
  for (let i = Math.max(1, n - 90); i < n; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  const meanRet = rets.reduce((s, v) => s + v, 0) / (rets.length || 1);
  const vol = Math.sqrt(rets.reduce((s, v) => s + (v - meanRet) ** 2, 0) / (rets.length || 1)) * Math.sqrt(252) * 100;

  // Pivots + support/resistance from last 250 bars
  const lb = Math.max(0, n - 250);
  const pivotsAll = findPivots(bars.slice(lb), 3).map((p) => ({ ...p, idx: p.idx + lb }));
  const lows = pivotsAll.filter((p) => p.kind === "low" && p.price <= price);
  const highs = pivotsAll.filter((p) => p.kind === "high" && p.price >= price);
  // nearest support = max pivot low below price; nearest resistance = min pivot high above price
  let support: StockPatternStats["support"] = null;
  for (const p of lows) {
    if (!support || p.price > support.price) support = { price: p.price, touches: 1, lastTouch: p.date };
  }
  if (support) {
    const cluster = lows.filter((p) => Math.abs(pct(p.price, support!.price)) < 2);
    support.touches = cluster.length;
    support.lastTouch = cluster[cluster.length - 1]?.date ?? support.lastTouch;
  }
  let resistance: StockPatternStats["resistance"] = null;
  for (const p of highs) {
    if (!resistance || p.price < resistance.price) resistance = { price: p.price, touches: 1, lastTouch: p.date };
  }
  if (resistance) {
    const cluster = highs.filter((p) => Math.abs(pct(p.price, resistance!.price)) < 2);
    resistance.touches = cluster.length;
    resistance.lastTouch = cluster[cluster.length - 1]?.date ?? resistance.lastTouch;
  }

  // ── pattern detectors ──
  const patterns: StockDetectedPattern[] = [];
  const push = (p: StockDetectedPattern) => patterns.push(p);

  // 1. Overall trend (regression slope)
  {
    const strength = pickStrength(trendSlopeAnnualPct, 10, 30);
    if (trendLabel === "Uptrend") {
      push({
        type: "TREND_UP",
        label: `Sustained ${strength.toLowerCase()} uptrend`,
        severity: "positive",
        strength,
        confidence: conf(strength, Math.round(r2 * 15)),
        category: "trend",
        detail: `Over the last ${trendBars} trading sessions (${bars[n - trendBars].date} → ${last.date}), the closing price has been climbing at an annualised rate of ${trendSlopeAnnualPct.toFixed(1)}% with a fit quality (R²) of ${r2.toFixed(2)} — ${r2 > 0.6 ? "a very consistent, orderly climb" : r2 > 0.35 ? "a reasonably steady climb" : "a noisy climb with plenty of wiggles"}. The price went from Rs. ${closes[n - trendBars].toFixed(2)} to Rs. ${price.toFixed(2)} over that span (${fmtP(pct(price, closes[n - trendBars]))}).`,
        supportingData: [
          { label: "Annualised slope", value: `${trendSlopeAnnualPct.toFixed(1)}%` },
          { label: "R² fit", value: r2.toFixed(2) },
          { label: "Period", value: `${trendBars} sessions` },
          { label: "Total move", value: fmtP(pct(price, closes[n - trendBars])) },
        ],
        affectedQuarters: [bars[n - trendBars].date, last.date],
        laymanSummary: `The stock has been steadily getting more expensive over the past ${trendBars} trading days — like climbing stairs rather than a bumpy rollercoaster. On average it has gained about ${trendSlopeAnnualPct.toFixed(0)}% per year at this pace.`,
      });
    } else if (trendLabel === "Downtrend") {
      push({
        type: "TREND_DOWN",
        label: `Sustained ${strength.toLowerCase()} downtrend`,
        severity: "negative",
        strength,
        confidence: conf(strength, Math.round(r2 * 15)),
        category: "trend",
        detail: `Over the last ${trendBars} trading sessions (${bars[n - trendBars].date} → ${last.date}), the closing price has been falling at an annualised rate of ${Math.abs(trendSlopeAnnualPct).toFixed(1)}% with a fit quality (R²) of ${r2.toFixed(2)} — ${r2 > 0.6 ? "a consistent, orderly decline" : "a noisy decline with sharp drops"}. The price went from Rs. ${closes[n - trendBars].toFixed(2)} to Rs. ${price.toFixed(2)} (${fmtP(pct(price, closes[n - trendBars]))}).`,
        supportingData: [
          { label: "Annualised slope", value: `${trendSlopeAnnualPct.toFixed(1)}%` },
          { label: "R² fit", value: r2.toFixed(2) },
          { label: "Period", value: `${trendBars} sessions` },
          { label: "Total move", value: fmtP(pct(price, closes[n - trendBars])) },
        ],
        affectedQuarters: [bars[n - trendBars].date, last.date],
        laymanSummary: `The stock has been steadily losing value over the past ${trendBars} trading days. On average it has lost about ${Math.abs(trendSlopeAnnualPct).toFixed(0)}% per year at this pace — buyers who jumped in earlier in this window are likely sitting on losses.`,
      });
    } else {
      push({
        type: "TREND_SIDEWAYS",
        label: "Sideways / range-bound price action",
        severity: "neutral",
        strength: "Moderate",
        confidence: conf("Moderate", 5),
        category: "trend",
        detail: `Over the last ${trendBars} trading sessions the price has moved sideways (annualised slope ${trendSlopeAnnualPct.toFixed(1)}%, R² ${r2.toFixed(2)} — too noisy to call a trend). The price oscillated between roughly Rs. ${Math.min(...trendCloses).toFixed(2)} and Rs. ${Math.max(...trendCloses).toFixed(2)} without committing to a direction.`,
        supportingData: [
          { label: "Annualised slope", value: `${trendSlopeAnnualPct.toFixed(1)}%` },
          { label: "R² fit", value: r2.toFixed(2) },
          { label: "Range low", value: fmtPrice(Math.min(...trendCloses)) },
          { label: "Range high", value: fmtPrice(Math.max(...trendCloses)) },
        ],
        affectedQuarters: [bars[n - trendBars].date, last.date],
        laymanSummary: `The price is stuck in a range — it goes up a bit, comes back down, and repeats. Neither buyers nor sellers are winning. Range-bound stocks often pick a direction after a breakout, so watch the range edges.`,
      });
    }
  }

  // 2. Price vs SMA200 (the "long-term line in the sand")
  if (sma200 !== null) {
    const dist = pct(price, sma200);
    const strength = pickStrength(dist, 5, 15);
    if (dist > 1) {
      push({
        type: "ABOVE_SMA200",
        label: "Price trading above 200-day average",
        severity: "positive",
        strength,
        confidence: conf(strength, Math.min(12, Math.abs(dist) / 2)),
        category: "trend",
        detail: `The current price (Rs. ${price.toFixed(2)}) is ${dist.toFixed(1)}% above the 200-day simple moving average (Rs. ${sma200.toFixed(2)}). The 200-day average is the most widely watched long-term trend line — trading above it is a classic sign the long-term trend favours buyers. ${dist > 20 ? "The wide gap suggests the stock is quite extended and may be due for a pullback toward the average." : "The gap is moderate, so the stock is extended but not extreme."}`,
        supportingData: [
          { label: "Current price", value: fmtPrice(price) },
          { label: "SMA200", value: fmtPrice(sma200) },
          { label: "Distance", value: `${dist.toFixed(1)}%` },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The stock costs more today than its average price over the last year — a sign the long-term direction is upward. The 200-day average is like the "fair value line" long-term investors watch.`,
      });
    } else if (dist < -1) {
      push({
        type: "BELOW_SMA200",
        label: "Price trading below 200-day average",
        severity: "negative",
        strength,
        confidence: conf(strength, Math.min(12, Math.abs(dist) / 2)),
        category: "trend",
        detail: `The current price (Rs. ${price.toFixed(2)}) is ${Math.abs(dist).toFixed(1)}% below the 200-day simple moving average (Rs. ${sma200.toFixed(2)}). Trading below the 200-day average is the classic definition of a long-term downtrend and warns that sellers control the bigger picture. ${Math.abs(dist) > 20 ? "The wide gap below suggests heavy selling pressure." : ""}`,
        supportingData: [
          { label: "Current price", value: fmtPrice(price) },
          { label: "SMA200", value: fmtPrice(sma200) },
          { label: "Distance", value: `${dist.toFixed(1)}%` },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The stock costs less today than its average price over the last year — a warning that the long-term direction is downward and sellers are in control.`,
      });
    }
  }

  // 3. Golden / death cross (SMA50 vs SMA200) — detect a cross in the last 30 sessions
  if (sma200 !== null && sma50 !== null && n >= 220) {
    let crossIdx = -1, crossDir: "golden" | "death" | null = null;
    for (let i = n - 30; i < n; i++) {
      if (i < 1 || sma50S[i] === null || sma200S[i] === null || sma50S[i - 1] === null || sma200S[i - 1] === null) continue;
      const wasAbove = (sma50S[i - 1] as number) > (sma200S[i - 1] as number);
      const isAbove = (sma50S[i] as number) > (sma200S[i] as number);
      if (isAbove && !wasAbove) { crossIdx = i; crossDir = "golden"; break; }
      if (!isAbove && wasAbove) { crossIdx = i; crossDir = "death"; break; }
    }
    const crossAge = crossIdx >= 0 ? n - 1 - crossIdx : -1;
    if (crossDir === "golden" && crossIdx >= 0) {
      const strength: PatternStrength = crossAge <= 10 ? "Strong" : "Moderate";
      push({
        type: "GOLDEN_CROSS",
        label: "Golden cross — 50-day average crossed above 200-day",
        severity: "positive",
        strength,
        confidence: conf(strength, 8),
        category: "trend",
        detail: `On ${bars[crossIdx].date} the 50-day moving average (Rs. ${(sma50S[crossIdx] as number).toFixed(2)}) crossed above the 200-day moving average (Rs. ${(sma200S[crossIdx] as number).toFixed(2)}) — a "golden cross". This is one of the most widely watched long-term BUY signals in technical analysis: it says the medium-term momentum has flipped upward relative to the long-term trend. Today the 50-day sits at Rs. ${sma50.toFixed(2)} vs the 200-day at Rs. ${sma200.toFixed(2)} (${fmtP(pct(sma50, sma200))}).`,
        supportingData: [
          { label: "Cross date", value: bars[crossIdx].date },
          { label: "SMA50 now", value: fmtPrice(sma50) },
          { label: "SMA200 now", value: fmtPrice(sma200) },
          { label: "Sessions since", value: `${crossAge}` },
        ],
        affectedQuarters: [bars[crossIdx].date],
        laymanSummary: `The recent average price just overtook the longer-term average price — nicknamed the "golden cross". Traders read it as the start of a longer climb, like a car finally shifting into a higher gear.`,
      });
    } else if (crossDir === "death" && crossIdx >= 0) {
      const strength: PatternStrength = crossAge <= 10 ? "Strong" : "Moderate";
      push({
        type: "DEATH_CROSS",
        label: "Death cross — 50-day average fell below 200-day",
        severity: "negative",
        strength,
        confidence: conf(strength, 8),
        category: "trend",
        detail: `On ${bars[crossIdx].date} the 50-day moving average (Rs. ${(sma50S[crossIdx] as number).toFixed(2)}) fell below the 200-day moving average (Rs. ${(sma200S[crossIdx] as number).toFixed(2)}) — a "death cross". This is the classic long-term SELL warning: medium-term momentum has rolled over relative to the long-term trend. Today the 50-day sits at Rs. ${sma50.toFixed(2)} vs the 200-day at Rs. ${sma200.toFixed(2)} (${fmtP(pct(sma50, sma200))}).`,
        supportingData: [
          { label: "Cross date", value: bars[crossIdx].date },
          { label: "SMA50 now", value: fmtPrice(sma50) },
          { label: "SMA200 now", value: fmtPrice(sma200) },
          { label: "Sessions since", value: `${crossAge}` },
        ],
        affectedQuarters: [bars[crossIdx].date],
        laymanSummary: `The recent average price just slipped below the longer-term average price — nicknamed the "death cross". Traders read it as a warning the climb has stalled and a slide may be starting.`,
      });
    }
  }

  // 4. Short-term momentum shift — SMA20 crossing SMA50 in last 10 sessions
  if (sma20 !== null && sma50 !== null && n >= 70) {
    for (let i = n - 10; i < n; i++) {
      if (i < 1 || sma20S[i] === null || sma50S[i] === null || sma20S[i - 1] === null || sma50S[i - 1] === null) continue;
      const wasAbove = (sma20S[i - 1] as number) > (sma50S[i - 1] as number);
      const isAbove = (sma20S[i] as number) > (sma50S[i] as number);
      if (isAbove && !wasAbove) {
        push({
          type: "SMA20_50_BULL",
          label: "Short-term momentum turned up (20-day crossed above 50-day)",
          severity: "positive",
          strength: "Moderate",
          confidence: conf("Moderate", 6),
          category: "trend",
          detail: `On ${bars[i].date} the 20-day moving average crossed above the 50-day moving average. This shorter-term "mini golden cross" often marks the start of a fresh multi-week rally — it fires much earlier than the classic 50/200 golden cross but is also less reliable. Today SMA20 = Rs. ${sma20.toFixed(2)} vs SMA50 = Rs. ${sma50.toFixed(2)}.`,
          supportingData: [
            { label: "Cross date", value: bars[i].date },
            { label: "SMA20", value: fmtPrice(sma20) },
            { label: "SMA50", value: fmtPrice(sma50) },
          ],
          affectedQuarters: [bars[i].date],
          laymanSummary: `The very-recent average price just overtook the medium average — a short-term sign the buyers are back. It's an early hint, not a guarantee.`,
        });
        break;
      }
      if (!isAbove && wasAbove) {
        push({
          type: "SMA20_50_BEAR",
          label: "Short-term momentum turned down (20-day fell below 50-day)",
          severity: "negative",
          strength: "Moderate",
          confidence: conf("Moderate", 6),
          category: "trend",
          detail: `On ${bars[i].date} the 20-day moving average fell below the 50-day moving average. This short-term "mini death cross" often marks the start of a multi-week pullback. Today SMA20 = Rs. ${sma20.toFixed(2)} vs SMA50 = Rs. ${sma50.toFixed(2)}.`,
          supportingData: [
            { label: "Cross date", value: bars[i].date },
            { label: "SMA20", value: fmtPrice(sma20) },
            { label: "SMA50", value: fmtPrice(sma50) },
          ],
          affectedQuarters: [bars[i].date],
          laymanSummary: `The very-recent average price just dropped below the medium average — an early warning the recent rally is losing steam.`,
        });
        break;
      }
    }
  }

  // 5. 52-week high breakout
  {
    const nearHigh = pctFrom52wHigh > -2; // within 2% of the high
    const recentIdx = bars.slice(-10).findIndex((b) => b.high >= high52w * 0.999);
    if (nearHigh || recentIdx >= 0) {
      const strength: PatternStrength = pctFrom52wHigh >= 0 ? "Strong" : pctFrom52wHigh > -1 ? "Moderate" : "Weak";
      push({
        type: "BREAKOUT_52W_HIGH",
        label: nearHigh ? "At / near 52-week high" : "New 52-week high",
        severity: "positive",
        strength,
        confidence: conf(strength, 10),
        category: "breakout",
        detail: `The current price (Rs. ${price.toFixed(2)}) is just ${Math.abs(pctFrom52wHigh).toFixed(1)}% ${pctFrom52wHigh >= 0 ? "above" : "below"} its 52-week high of Rs. ${high52w.toFixed(2)} (set ${last52w.reduce((best, b) => b.high >= best.high ? b : best, last52w[0]).date}). Stocks near their 52-week high have no trapped sellers overhead — everyone who bought in the past year is in profit, which removes selling pressure. Research shows breakouts to new highs often continue ("momentum") — but they can also fail and become a "double top" trap.`,
        supportingData: [
          { label: "52w high", value: fmtPrice(high52w) },
          { label: "Current price", value: fmtPrice(price) },
          { label: "Distance from high", value: `${pctFrom52wHigh.toFixed(1)}%` },
          { label: "12-month return", value: fmtP(changePct12M) },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The stock is trading at the highest price it has touched in a whole year. Everyone who bought during the past 12 months is now in profit — that removes the sellers who bought higher and are desperate to "get out even".`,
      });
    } else if (pctFrom52wLow > -2) {
      const strength: PatternStrength = pctFrom52wLow <= 0 ? "Strong" : "Moderate";
      push({
        type: "BREAKDOWN_52W_LOW",
        label: "At / near 52-week low",
        severity: "negative",
        strength,
        confidence: conf(strength, 10),
        category: "breakout",
        detail: `The current price (Rs. ${price.toFixed(2)}) is just ${Math.abs(pctFrom52wLow).toFixed(1)}% ${pctFrom52wLow <= 0 ? "below" : "above"} its 52-week low of Rs. ${low52w.toFixed(2)}. Trading at yearly lows means every buyer from the past 12 months is underwater and many are sitting on losses — trapped buyers often sell into any bounce, which acts as overhead pressure. Yearly lows can either be bargains (if fundamentals are intact) or the start of a deeper slide.`,
        supportingData: [
          { label: "52w low", value: fmtPrice(low52w) },
          { label: "Current price", value: fmtPrice(price) },
          { label: "Distance from low", value: `${pctFrom52wLow.toFixed(1)}%` },
          { label: "12-month return", value: fmtP(changePct12M) },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The stock is at its cheapest in a whole year. That can mean a bargain — or it can mean something is genuinely wrong with the business. The pattern alone can't tell you which; check the company result patterns too.`,
      });
    }
  }

  // 6. RSI overbought / oversold
  {
    if (rsi14 >= 70) {
      const strength: PatternStrength = rsi14 >= 80 ? "Strong" : "Moderate";
      push({
        type: "RSI_OVERBOUGHT",
        label: `Overbought — RSI(14) at ${rsi14.toFixed(0)}`,
        severity: "negative",
        strength,
        confidence: conf(strength, 8),
        category: "momentum",
        detail: `The 14-day Relative Strength Index is ${rsi14.toFixed(1)} — above the classic 70 "overbought" threshold${rsi14 >= 80 ? " and in extreme territory" : ""}. RSI measures how one-sided recent daily moves have been: readings above 70 mean buyers have dominated for weeks and the stock is technically "stretched". This does NOT mean it must fall — strong stocks can stay overbought for a long time — but the odds of a pause or pullback rise. ${changePct3M >= 0 ? `The stock gained ${fmtP(changePct3M)} over the last 3 months to reach this reading.` : ""}`,
        supportingData: [
          { label: "RSI(14)", value: rsi14.toFixed(1) },
          { label: "Threshold", value: "70 (overbought)" },
          { label: "3-month move", value: fmtP(changePct3M) },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The buying has been so strong and so one-sided that the stock is technically "overheated". Like a car engine revved to the red line — it may keep going, but a cooling-off pause becomes more likely.`,
      });
    } else if (rsi14 <= 30) {
      const strength: PatternStrength = rsi14 <= 20 ? "Strong" : "Moderate";
      push({
        type: "RSI_OVERSOLD",
        label: `Oversold — RSI(14) at ${rsi14.toFixed(0)}`,
        severity: "positive",
        strength,
        confidence: conf(strength, 8),
        category: "momentum",
        detail: `The 14-day Relative Strength Index is ${rsi14.toFixed(1)} — below the classic 30 "oversold" threshold${rsi14 <= 20 ? " and in extreme territory" : ""}. Readings below 30 mean sellers have dominated for weeks and the stock is technically "washed out". Oversold stocks often see a short bounce (mean reversion) — but in a genuine downtrend bounces can fail, so this is a counter-trend signal that needs confirmation.`,
        supportingData: [
          { label: "RSI(14)", value: rsi14.toFixed(1) },
          { label: "Threshold", value: "30 (oversold)" },
          { label: "3-month move", value: fmtP(changePct3M) },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The selling has been so heavy that the stock is technically "washed out". Like a squeezed sponge, conditions are set for a bounce — but if the business is genuinely deteriorating, bounces tend to be short-lived.`,
      });
    }
  }

  // 7. MACD crossover in the last 5 sessions
  {
    for (let i = n - 5; i < n; i++) {
      if (i < 1) continue;
      const prev = macdHistS[i - 1], cur = macdHistS[i];
      if (prev <= 0 && cur > 0) {
        push({
          type: "MACD_BULL_CROSS",
          label: "MACD bullish crossover",
          severity: "positive",
          strength: cur > 0 && bars[i].close > (sma50 ?? price) ? "Moderate" : "Weak",
          confidence: conf(cur > 0 ? "Moderate" : "Weak", 6),
          category: "momentum",
          detail: `On ${bars[i].date} the MACD line crossed above its signal line (the histogram flipped from ${prev.toFixed(3)} to ${cur.toFixed(3)}). MACD (Moving Average Convergence Divergence) compares short-term vs long-term momentum — a bullish cross says the short-term momentum just turned stronger than the long-term, often the first sign of a fresh up-leg. The histogram now reads ${macdHist.toFixed(3)}.`,
          supportingData: [
            { label: "Cross date", value: bars[i].date },
            { label: "Histogram now", value: macdHist.toFixed(3) },
            { label: "Histogram at cross", value: cur.toFixed(3) },
          ],
          affectedQuarters: [bars[i].date],
          laymanSummary: `A momentum gauge called MACD just flipped positive — the short-term buying pressure overtook the longer-term drift. It's an early hint the up-move is freshening up.`,
        });
        break;
      }
      if (prev >= 0 && cur < 0) {
        push({
          type: "MACD_BEAR_CROSS",
          label: "MACD bearish crossover",
          severity: "negative",
          strength: cur < 0 && bars[i].close < (sma50 ?? price) ? "Moderate" : "Weak",
          confidence: conf(cur < 0 ? "Moderate" : "Weak", 6),
          category: "momentum",
          detail: `On ${bars[i].date} the MACD line crossed below its signal line (the histogram flipped from ${prev.toFixed(3)} to ${cur.toFixed(3)}). A bearish MACD cross says short-term momentum just turned weaker than the long-term drift — often the first hint a rally is tiring or a slide is starting. The histogram now reads ${macdHist.toFixed(3)}.`,
          supportingData: [
            { label: "Cross date", value: bars[i].date },
            { label: "Histogram now", value: macdHist.toFixed(3) },
            { label: "Histogram at cross", value: cur.toFixed(3) },
          ],
          affectedQuarters: [bars[i].date],
          laymanSummary: `The MACD momentum gauge just flipped negative — short-term selling pressure overtook the longer-term drift. An early warning the recent strength is fading.`,
        });
        break;
      }
    }
  }

  // 8. Volume spike on the latest bar
  if (avgVol20 > 0 && last.volume >= avgVol20 * 2) {
    const ratio = last.volume / avgVol20;
    const up = last.close >= last.open;
    const strength: PatternStrength = ratio >= 4 ? "Strong" : ratio >= 2.5 ? "Moderate" : "Weak";
    push({
      type: "VOLUME_SPIKE",
      label: `Volume spike — ${ratio.toFixed(1)}× the 20-day average`,
      severity: up ? "positive" : "negative",
      strength,
      confidence: conf(strength, Math.min(10, ratio * 2)),
      category: "volume",
      detail: `On ${last.date} the stock traded ${fmtVol(last.volume)} shares — ${ratio.toFixed(1)}× its 20-day average of ${fmtVol(avgVol20)}. Volume spikes mean conviction: an unusual number of investors acted at once. ${up ? "A volume spike on an UP day suggests strong buying interest — " : "A volume spike on a DOWN day suggests heavy distribution (sellers rushing for the exit) — "} big-money participants are active.`,
      supportingData: [
        { label: "Volume", value: fmtVol(last.volume) },
        { label: "20-day avg", value: fmtVol(avgVol20) },
        { label: "Spike ratio", value: `${ratio.toFixed(1)}×` },
        { label: "Day direction", value: up ? "Up day (accumulation)" : "Down day (distribution)" },
      ],
      affectedQuarters: [last.date],
      laymanSummary: `An unusually large amount of the stock changed hands on the latest trading day${up ? " — and the price rose, hinting big buyers stepped in" : " — and the price fell, hinting big sellers were rushing out"}. Volume tells you whether a price move has real participation behind it.`,
    });
  } else if (avgVol20 > 0 && last.volume <= avgVol20 * 0.5) {
    push({
      type: "VOLUME_DRYUP",
      label: "Volume dry-up",
      severity: "neutral",
      strength: "Weak",
      confidence: conf("Weak", 5),
      category: "volume",
      detail: `The latest volume (${fmtVol(last.volume)}) is just ${(last.volume / avgVol20 * 100).toFixed(0)}% of the 20-day average (${fmtVol(avgVol20)}). Extremely quiet volume often precedes a big move — the market is "coiling", and whichever way price breaks out of this quiet zone tends to have follow-through.`,
      supportingData: [
        { label: "Volume", value: fmtVol(last.volume) },
        { label: "20-day avg", value: fmtVol(avgVol20) },
        { label: "Ratio", value: `${(last.volume / avgVol20).toFixed(2)}×` },
      ],
      affectedQuarters: [last.date],
      laymanSummary: `Trading has gone unusually quiet — few shares changing hands. Calm often comes before a storm: watch which way the price breaks out of this quiet patch.`,
    });
  }

  // 9. Bollinger Band squeeze (volatility at 6-month low)
  if (n >= 160) {
    const bw = (i: number) => {
      const win = closes.slice(i - 19, i + 1);
      const m = win.reduce((s, v) => s + v, 0) / win.length;
      const sd = Math.sqrt(win.reduce((s, v) => s + (v - m) ** 2, 0) / win.length);
      return m > 0 ? ((2 * sd * 2) / m) * 100 : 0;
    };
    const curBw = bw(n - 1);
    const pastBws: number[] = [];
    for (let i = n - 120; i < n - 1; i++) pastBws.push(bw(i));
    const minPast = Math.min(...pastBws);
    if (curBw <= minPast * 1.15 && curBw < 12) {
      push({
        type: "BB_SQUEEZE",
        label: "Bollinger Band squeeze — volatility at 6-month low",
        severity: "neutral",
        strength: "Moderate",
        confidence: conf("Moderate", 8),
        category: "volatility",
        detail: `The Bollinger Band width (20-day ±2σ envelope) is currently ${curBw.toFixed(1)}% of price — at or below its lowest level of the past 6 months (min was ${minPast.toFixed(1)}%). A "squeeze" means daily price swings have compressed to almost nothing. Historically, squeezes resolve into sharp breakouts — the longer the squeeze, the more explosive the release. The direction of the resolution is not predicted; watch the range edges (${low52w ? `Rs. ${(price * 0.95).toFixed(2)}` : ""}–${`Rs. ${(price * 1.05).toFixed(2)}`}) for the first clue.`,
        supportingData: [
          { label: "Band width now", value: `${curBw.toFixed(1)}%` },
          { label: "6-month min width", value: `${minPast.toFixed(1)}%` },
          { label: "90-day volatility", value: `${vol.toFixed(1)}% annualised` },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The daily price swings have become tiny — the smallest they have been in about six months. Like compressing a spring, quiet periods like this often end with a sudden, sharp move in one direction.`,
      });
    }
  }

  // 10. Market structure — higher highs & higher lows (or lower)
  {
    const pivHighs = pivotsAll.filter((p) => p.kind === "high").slice(-3);
    const pivLows = pivotsAll.filter((p) => p.kind === "low").slice(-3);
    if (pivHighs.length >= 2 && pivLows.length >= 2) {
      const hh = pivHighs.every((p, i, a) => i === 0 || p.price > a[i - 1].price);
      const hl = pivLows.every((p, i, a) => i === 0 || p.price > a[i - 1].price);
      const lh = pivHighs.every((p, i, a) => i === 0 || p.price < a[i - 1].price);
      const ll = pivLows.every((p, i, a) => i === 0 || p.price < a[i - 1].price);
      if (hh && hl) {
        push({
          type: "HIGHER_HIGHS",
          label: "Higher highs & higher lows — bullish market structure",
          severity: "positive",
          strength: pivHighs.length >= 3 ? "Strong" : "Moderate",
          confidence: conf(pivHighs.length >= 3 ? "Strong" : "Moderate", 6),
          category: "structure",
          detail: `The last ${pivHighs.length} swing highs (${pivHighs.map((p) => `Rs. ${p.price.toFixed(2)} on ${p.date}`).join(" → ")}) each sit ABOVE the previous one, and each swing low is also higher than the last (${pivLows.map((p) => `Rs. ${p.price.toFixed(2)}`).join(" → ")}). This "staircase" structure is the textbook definition of a healthy uptrend — each dip attracts buyers before the previous low breaks, so the floor keeps rising.`,
          supportingData: pivHighs.map((p, i) => ({ label: `Swing high ${i + 1}`, value: `${fmtPrice(p.price)} · ${p.date}` })),
          affectedQuarters: pivHighs.map((p) => p.date),
          laymanSummary: `Each recent peak is higher than the last, and each dip stops higher than the one before — like a staircase going up. That's the classic footprint of buyers steadily winning.`,
        });
      } else if (lh && ll) {
        push({
          type: "LOWER_LOWS",
          label: "Lower highs & lower lows — bearish market structure",
          severity: "negative",
          strength: pivHighs.length >= 3 ? "Strong" : "Moderate",
          confidence: conf(pivHighs.length >= 3 ? "Strong" : "Moderate", 6),
          category: "structure",
          detail: `The last ${pivHighs.length} swing highs (${pivHighs.map((p) => `Rs. ${p.price.toFixed(2)} on ${p.date}`).join(" → ")}) each sit BELOW the previous one, and each swing low is lower too (${pivLows.map((p) => `Rs. ${p.price.toFixed(2)}`).join(" → ")}). This "descending staircase" is the textbook definition of a downtrend — every bounce runs out of steam before the previous high, so the ceiling keeps falling.`,
          supportingData: pivHighs.map((p, i) => ({ label: `Swing high ${i + 1}`, value: `${fmtPrice(p.price)} · ${p.date}` })),
          affectedQuarters: pivHighs.map((p) => p.date),
          laymanSummary: `Each recent peak is lower than the last, and each dip sinks deeper — like a staircase going down. That's the classic footprint of sellers steadily winning.`,
        });
      }
    }
  }

  // 11. Double top / double bottom (two pivots within 2.5% tolerance)
  {
    const pivH = pivotsAll.filter((p) => p.kind === "high");
    const pivL = pivotsAll.filter((p) => p.kind === "low");
    // double top: last two highs within tolerance, 20-120 bars apart
    for (let i = pivH.length - 2; i >= Math.max(0, pivH.length - 4); i--) {
      const a = pivH[i], b = pivH[i + 1];
      if (!a || !b) continue;
      const gap = b.idx - a.idx;
      if (gap >= 20 && gap <= 150 && Math.abs(pct(b.price, a.price)) <= 2.5) {
        const interimLow = Math.min(...bars.slice(a.idx, b.idx + 1).map((x) => x.low));
        const depth = pct(price, a.price);
        if (price < interimLow) {
          push({
            type: "DOUBLE_TOP",
            label: "Double top — resistance rejected twice",
            severity: "negative",
            strength: depth < -5 ? "Strong" : "Moderate",
            confidence: conf(depth < -5 ? "Strong" : "Moderate", 7),
            category: "structure",
            detail: `The price twice failed at the same ceiling: Rs. ${a.price.toFixed(2)} on ${a.date} and Rs. ${b.price.toFixed(2)} on ${b.date} (within ${Math.abs(pct(b.price, a.price)).toFixed(1)}%). The neckline (the dip between the two tops) sits at Rs. ${interimLow.toFixed(2)}, and the price has now broken below it (currently Rs. ${price.toFixed(2)}, ${Math.abs(depth).toFixed(1)}% under the tops). A confirmed double top is a classic reversal pattern — the market tried twice to push higher, ran out of buyers, and sellers took over.`,
            supportingData: [
              { label: "1st top", value: `${fmtPrice(a.price)} · ${a.date}` },
              { label: "2nd top", value: `${fmtPrice(b.price)} · ${b.date}` },
              { label: "Neckline", value: fmtPrice(interimLow) },
              { label: "Now vs tops", value: `${depth.toFixed(1)}%` },
            ],
            affectedQuarters: [a.date, b.date],
            laymanSummary: `The stock bumped into the same ceiling twice and fell away both times — like a ball bouncing off a lid. Once it also broke below the "floor" between the two bounces, sellers gained control.`,
          });
          break;
        }
      }
    }
    for (let i = pivL.length - 2; i >= Math.max(0, pivL.length - 4); i--) {
      const a = pivL[i], b = pivL[i + 1];
      if (!a || !b) continue;
      const gap = b.idx - a.idx;
      if (gap >= 20 && gap <= 150 && Math.abs(pct(b.price, a.price)) <= 2.5) {
        const interimHigh = Math.max(...bars.slice(a.idx, b.idx + 1).map((x) => x.high));
        const rise = pct(price, a.price);
        if (price > interimHigh) {
          push({
            type: "DOUBLE_BOTTOM",
            label: "Double bottom — support held twice",
            severity: "positive",
            strength: rise > 5 ? "Strong" : "Moderate",
            confidence: conf(rise > 5 ? "Strong" : "Moderate", 7),
            category: "structure",
            detail: `The price twice bounced off the same floor: Rs. ${a.price.toFixed(2)} on ${a.date} and Rs. ${b.price.toFixed(2)} on ${b.date} (within ${Math.abs(pct(b.price, a.price)).toFixed(1)}%). The peak between the two lows sits at Rs. ${interimHigh.toFixed(2)}, and the price has now cleared it (currently Rs. ${price.toFixed(2)}, ${rise.toFixed(1)}% above the lows). A confirmed double bottom is a classic bullish reversal — the market tested the floor twice, found strong buyers both times, and turned up.`,
            supportingData: [
              { label: "1st bottom", value: `${fmtPrice(a.price)} · ${a.date}` },
              { label: "2nd bottom", value: `${fmtPrice(b.price)} · ${b.date}` },
              { label: "Neckline peak", value: fmtPrice(interimHigh) },
              { label: "Now vs bottoms", value: `${rise.toFixed(1)}%` },
            ],
            affectedQuarters: [a.date, b.date],
            laymanSummary: `The stock fell to the same floor twice and bounced both times — like a floor that refuses to break. Once it also rose above the bump between the two dips, buyers gained control.`,
          });
          break;
        }
      }
    }
  }

  // 12. Candlestick patterns on the last 3 bars
  if (n >= 4) {
    const c1 = bars[n - 1]; // latest
    const c2 = bars[n - 2];
    const c3 = bars[n - 3];
    const body1 = Math.abs(c1.close - c1.open);
    const range1 = c1.high - c1.low || 1e-9;
    const body2 = Math.abs(c2.close - c2.open);

    // Engulfing
    if (c1.close > c1.open && c2.close < c2.open && c1.close > c2.open && c1.open < c2.close && body1 > body2 * 1.2) {
      push({
        type: "BULLISH_ENGULFING",
        label: "Bullish engulfing candle",
        severity: "positive",
        strength: body1 > range1 * 0.6 ? "Strong" : "Moderate",
        confidence: conf(body1 > range1 * 0.6 ? "Strong" : "Moderate", 6),
        category: "candlestick",
        detail: `The latest candle (${c1.date}) is a big green (up) candle that completely "engulfs" the previous red (down) candle — it opened below yesterday's close (Rs. ${c1.open.toFixed(2)} vs Rs. ${c2.close.toFixed(2)}) but buyers pushed it to close above yesterday's open (Rs. ${c1.close.toFixed(2)} vs Rs. ${c2.open.toFixed(2)}). Engulfing candles show a decisive sentiment flip within just one session: sellers tried, and buyers overwhelmed them.`,
        supportingData: [
          { label: "Candle date", value: c1.date },
          { label: "Open → close", value: `${fmtPrice(c1.open)} → ${fmtPrice(c1.close)}` },
          { label: "Body vs range", value: `${((body1 / range1) * 100).toFixed(0)}%` },
        ],
        affectedQuarters: [c1.date],
        laymanSummary: `Yesterday's small price drop was completely swallowed by a bigger rise today — the candlestick version of buyers overpowering sellers in a single day.`,
      });
    } else if (c1.close < c1.open && c2.close > c2.open && c1.close < c2.open && c1.open > c2.close && body1 > body2 * 1.2) {
      push({
        type: "BEARISH_ENGULFING",
        label: "Bearish engulfing candle",
        severity: "negative",
        strength: body1 > range1 * 0.6 ? "Strong" : "Moderate",
        confidence: conf(body1 > range1 * 0.6 ? "Strong" : "Moderate", 6),
        category: "candlestick",
        detail: `The latest candle (${c1.date}) is a big red (down) candle that completely "engulfs" the previous green (up) candle — it opened above yesterday's close (Rs. ${c1.open.toFixed(2)} vs Rs. ${c2.close.toFixed(2)}) but sellers slammed it to close below yesterday's open (Rs. ${c1.close.toFixed(2)} vs Rs. ${c2.open.toFixed(2)}). Bearish engulfing shows sellers seized control within a single session.`,
        supportingData: [
          { label: "Candle date", value: c1.date },
          { label: "Open → close", value: `${fmtPrice(c1.open)} → ${fmtPrice(c1.close)}` },
          { label: "Body vs range", value: `${((body1 / range1) * 100).toFixed(0)}%` },
        ],
        affectedQuarters: [c1.date],
        laymanSummary: `Yesterday's small price rise was completely swallowed by a bigger fall today — the candlestick version of sellers overpowering buyers in a single day.`,
      });
    }

    // Hammer / shooting star (latest bar)
    const lowerWick = Math.min(c1.open, c1.close) - c1.low;
    const upperWick = c1.high - Math.max(c1.open, c1.close);
    if (lowerWick >= body1 * 2 && upperWick <= body1 && body1 > 0) {
      push({
        type: "HAMMER",
        label: "Hammer candle at the lows",
        severity: "positive",
        strength: lowerWick >= body1 * 3 ? "Moderate" : "Weak",
        confidence: conf(lowerWick >= body1 * 3 ? "Moderate" : "Weak", 5),
        category: "candlestick",
        detail: `On ${c1.date} the price fell hard intraday to Rs. ${c1.low.toFixed(2)} — ${(lowerWick / range1 * 100).toFixed(0)}% of the candle's total range sits below the body — but buyers dragged it back to close at Rs. ${c1.close.toFixed(2)}, near the top. This "hammer" shape means sellers tested the lows and were rejected: a sign the down-move is finding a floor.`,
        supportingData: [
          { label: "Candle date", value: c1.date },
          { label: "Intraday low", value: fmtPrice(c1.low) },
          { label: "Close", value: fmtPrice(c1.close) },
          { label: "Lower wick share", value: `${((lowerWick / range1) * 100).toFixed(0)}%` },
        ],
        affectedQuarters: [c1.date],
        laymanSummary: `During the day the price fell sharply but recovered by the close, leaving a "hammer" shape — as if buyers hammered out a floor. Often seen near the end of a decline.`,
      });
    } else if (upperWick >= body1 * 2 && lowerWick <= body1 && body1 > 0) {
      push({
        type: "SHOOTING_STAR",
        label: "Shooting star candle at the highs",
        severity: "negative",
        strength: upperWick >= body1 * 3 ? "Moderate" : "Weak",
        confidence: conf(upperWick >= body1 * 3 ? "Moderate" : "Weak", 5),
        category: "candlestick",
        detail: `On ${c1.date} the price spiked intraday to Rs. ${c1.high.toFixed(2)} — ${(upperWick / range1 * 100).toFixed(0)}% of the candle's total range sits above the body — but sellers dragged it back to close at Rs. ${c1.close.toFixed(2)}, near the bottom. This "shooting star" means buyers pushed the price up and were rejected: often a warning near the top of a rally.`,
        supportingData: [
          { label: "Candle date", value: c1.date },
          { label: "Intraday high", value: fmtPrice(c1.high) },
          { label: "Close", value: fmtPrice(c1.close) },
          { label: "Upper wick share", value: `${((upperWick / range1) * 100).toFixed(0)}%` },
        ],
        affectedQuarters: [c1.date],
        laymanSummary: `During the day the price shot up but gave it all back by the close, leaving a "shooting star" shape — buyers pushed higher and got pushed back. Often seen near the top.`,
      });
    }

    // Morning star / evening star (3-bar)
    const isMorning =
      c3.close < c3.open && // red
      body2 < Math.abs(c3.close - c3.open) * 0.4 && // small middle
      c1.close > c1.open && // green
      c1.close > (c3.open + c3.close) / 2;
    const isEvening =
      c3.close > c3.open && // green
      body2 < Math.abs(c3.close - c3.open) * 0.4 && // small middle
      c1.close < c1.open && // red
      c1.close < (c3.open + c3.close) / 2;
    if (isMorning) {
      push({
        type: "MORNING_STAR",
        label: "Morning star — 3-bar bullish reversal",
        severity: "positive",
        strength: "Moderate",
        confidence: conf("Moderate", 6),
        category: "candlestick",
        detail: `The last three candles form a "morning star": a strong red candle on ${c3.date} (close Rs. ${c3.close.toFixed(2)}), a small indecision candle on ${c2.date}, then a strong green candle on ${c1.date} closing at Rs. ${c1.close.toFixed(2)} — above the midpoint of the first candle's body. It's a 3-day story of "panic → hesitation → buyers take charge" and is considered one of the more reliable bullish reversal candlestick patterns.`,
        supportingData: [
          { label: "Day 1 close", value: `${fmtPrice(c3.close)} · ${c3.date}` },
          { label: "Day 2 (pause)", value: fmtPrice(c2.close) },
          { label: "Day 3 close", value: `${fmtPrice(c1.close)} · ${c1.date}` },
        ],
        affectedQuarters: [c3.date, c2.date, c1.date],
        laymanSummary: `Three days telling one story: sharp fall, then hesitation, then a strong recovery. The morning star is named for dawn breaking after darkness.`,
      });
    } else if (isEvening) {
      push({
        type: "EVENING_STAR",
        label: "Evening star — 3-bar bearish reversal",
        severity: "negative",
        strength: "Moderate",
        confidence: conf("Moderate", 6),
        category: "candlestick",
        detail: `The last three candles form an "evening star": a strong green candle on ${c3.date} (close Rs. ${c3.close.toFixed(2)}), a small indecision candle on ${c2.date}, then a strong red candle on ${c1.date} closing at Rs. ${c1.close.toFixed(2)} — below the midpoint of the first candle's body. It's a 3-day story of "euphoria → hesitation → sellers take charge" and is considered one of the more reliable bearish reversal candlestick patterns.`,
        supportingData: [
          { label: "Day 1 close", value: `${fmtPrice(c3.close)} · ${c3.date}` },
          { label: "Day 2 (pause)", value: fmtPrice(c2.close) },
          { label: "Day 3 close", value: `${fmtPrice(c1.close)} · ${c1.date}` },
        ],
        affectedQuarters: [c3.date, c2.date, c1.date],
        laymanSummary: `Three days telling one story: strong rally, then hesitation, then a sharp fall. The evening star is named for dusk falling after the day's peak.`,
      });
    }

    // Doji (indecision)
    if (body1 <= range1 * 0.1) {
      push({
        type: "DOJI",
        label: "Doji — indecision candle",
        severity: "neutral",
        strength: "Weak",
        confidence: conf("Weak", 3),
        category: "candlestick",
        detail: `On ${c1.date} the stock opened at Rs. ${c1.open.toFixed(2)} and closed almost exactly there (Rs. ${c1.close.toFixed(2)}) despite swinging between Rs. ${c1.low.toFixed(2)} and Rs. ${c1.high.toFixed(2)}. This "doji" (cross-shaped) candle means buyers and sellers fought to a draw. After a strong run, a doji can hint at exhaustion; after a slide, it can hint at a bottom — context matters.`,
        supportingData: [
          { label: "Candle date", value: c1.date },
          { label: "Open vs close", value: `${fmtPrice(c1.open)} / ${fmtPrice(c1.close)}` },
          { label: "Intraday range", value: `${fmtPrice(c1.low)} – ${fmtPrice(c1.high)}` },
        ],
        affectedQuarters: [c1.date],
        laymanSummary: `The price went up and down during the day but ended almost exactly where it started — a draw between buyers and sellers. It signals indecision: the market is thinking about its next move.`,
      });
    }
  }

  // 13. Gap up / gap down on the latest bar
  if (n >= 2) {
    const prev = bars[n - 2];
    const gap = pct(last.open, prev.close);
    if (gap >= 1) {
      push({
        type: "GAP_UP",
        label: `Gap up — opened ${gap.toFixed(1)}% above yesterday's close`,
        severity: "positive",
        strength: gap >= 3 ? "Strong" : gap >= 2 ? "Moderate" : "Weak",
        confidence: conf(gap >= 3 ? "Strong" : gap >= 2 ? "Moderate" : "Weak", 5),
        category: "breakout",
        detail: `On ${last.date} the stock opened at Rs. ${last.open.toFixed(2)} — ${gap.toFixed(1)}% above yesterday's close of Rs. ${prev.close.toFixed(2)} — leaving an unfilled "gap" in the price chart. Gaps mean news or orders hit overnight/at the open with such force that the market repriced instantly before the first session trade. Gap-ups often act as future support ("gap-and-go"), but if the price falls back to fill the gap the move is considered failed.`,
        supportingData: [
          { label: "Gap date", value: last.date },
          { label: "Yesterday close", value: fmtPrice(prev.close) },
          { label: "Today open", value: fmtPrice(last.open) },
          { label: "Gap size", value: `${gap.toFixed(1)}%` },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The stock opened noticeably higher than it closed yesterday — skipping an entire price band overnight. Such gaps usually mean fresh, urgent buying (often on news) arrived before the market opened.`,
      });
    } else if (gap <= -1) {
      push({
        type: "GAP_DOWN",
        label: `Gap down — opened ${Math.abs(gap).toFixed(1)}% below yesterday's close`,
        severity: "negative",
        strength: gap <= -3 ? "Strong" : gap <= -2 ? "Moderate" : "Weak",
        confidence: conf(gap <= -3 ? "Strong" : gap <= -2 ? "Moderate" : "Weak", 5),
        category: "breakout",
        detail: `On ${last.date} the stock opened at Rs. ${last.open.toFixed(2)} — ${Math.abs(gap).toFixed(1)}% below yesterday's close of Rs. ${prev.close.toFixed(2)} — leaving an unfilled "gap" down in the price chart. Gap-downs mean urgent selling repriced the stock instantly at the open. They often act as future resistance; if the price recovers to fill the gap the panic may have passed.`,
        supportingData: [
          { label: "Gap date", value: last.date },
          { label: "Yesterday close", value: fmtPrice(prev.close) },
          { label: "Today open", value: fmtPrice(last.open) },
          { label: "Gap size", value: `${gap.toFixed(1)}%` },
        ],
        affectedQuarters: [last.date],
        laymanSummary: `The stock opened noticeably lower than it closed yesterday — dropping an entire price band overnight. Such gaps usually mean urgent selling (often on bad news) arrived before the market opened.`,
      });
    }
  }

  // 14. Support / resistance levels (informational)
  if (support) {
    const dist = pct(price, support.price);
    push({
      type: "SUPPORT_LEVEL",
      label: `Key support at Rs. ${support.price.toFixed(2)}`,
      severity: "neutral",
      strength: support.touches >= 3 ? "Strong" : support.touches === 2 ? "Moderate" : "Weak",
      confidence: conf(support.touches >= 3 ? "Strong" : support.touches === 2 ? "Moderate" : "Weak", 4),
      category: "structure",
      detail: `Over the past 12 months the price has bounced off Rs. ${support.price.toFixed(2)} on ${support.touches} separate occasion${support.touches > 1 ? "s" : ""} (last touched ${support.lastTouch}). This is the nearest support — a price zone where buyers have repeatedly stepped in. If the price falls to it again, expect a fight; a decisive close below would flip it into resistance and signal deeper weakness. The price is currently ${Math.abs(dist).toFixed(1)}% ${dist >= 0 ? "above" : "below"} this level.`,
      supportingData: [
        { label: "Support level", value: fmtPrice(support.price) },
        { label: "Bounces (touches)", value: `${support.touches}` },
        { label: "Last touched", value: support.lastTouch },
        { label: "Current distance", value: `${dist.toFixed(1)}%` },
      ],
      affectedQuarters: [support.lastTouch],
      laymanSummary: `Think of Rs. ${support.price.toFixed(2)} as the stock's "floor" — the price has repeatedly stopped falling there. Floors can crack: if it breaks decisively, the drop often accelerates.`,
    });
  }
  if (resistance) {
    const dist = pct(price, resistance.price);
    push({
      type: "RESISTANCE_LEVEL",
      label: `Key resistance at Rs. ${resistance.price.toFixed(2)}`,
      severity: "neutral",
      strength: resistance.touches >= 3 ? "Strong" : resistance.touches === 2 ? "Moderate" : "Weak",
      confidence: conf(resistance.touches >= 3 ? "Strong" : resistance.touches === 2 ? "Moderate" : "Weak", 4),
      category: "structure",
      detail: `Over the past 12 months the price has been rejected at Rs. ${resistance.price.toFixed(2)} on ${resistance.touches} separate occasion${resistance.touches > 1 ? "s" : ""} (last tested ${resistance.lastTouch}). This is the nearest resistance — a price zone where sellers have repeatedly appeared. A decisive close above it would be a bullish breakout (the ceiling becomes a new floor). The price is currently ${Math.abs(dist).toFixed(1)}% ${dist >= 0 ? "above" : "below"} this level.`,
      supportingData: [
        { label: "Resistance level", value: fmtPrice(resistance.price) },
        { label: "Rejections (touches)", value: `${resistance.touches}` },
        { label: "Last tested", value: resistance.lastTouch },
        { label: "Current distance", value: `${dist.toFixed(1)}%` },
      ],
      affectedQuarters: [resistance.lastTouch],
      laymanSummary: `Think of Rs. ${resistance.price.toFixed(2)} as the stock's "ceiling" — the price has repeatedly stalled there. Ceilings can break: a decisive close above it often triggers a fresh rally.`,
    });
  }

  // ── sort: by confidence desc ──
  patterns.sort((a, b) => b.confidence - a.confidence);

  const stats: StockPatternStats = {
    currentPrice: price,
    changePct1D,
    changePct1M,
    changePct3M,
    changePct12M,
    trendLabel,
    trendSlopeAnnualPct,
    high52w,
    pctFrom52wHigh,
    low52w,
    pctFrom52wLow,
    rsi14,
    macdHistogram: macdHist,
    macdStatus: macdHist > 0.01 ? "Bullish" : macdHist < -0.01 ? "Bearish" : "Neutral",
    sma20,
    sma50,
    sma200,
    volatilityAnnualPct: vol,
    avgVolume20: avgVol20,
    barCount: n,
    firstDate: bars[0].date,
    lastDate: last.date,
    support,
    resistance,
    bullCount: patterns.filter((p) => p.severity === "positive").length,
    bearCount: patterns.filter((p) => p.severity === "negative").length,
    neutralCount: patterns.filter((p) => p.severity === "neutral").length,
  };

  // Chart series — last 260 bars
  const start = Math.max(0, n - 260);
  const chart: ChartPoint[] = [];
  for (let i = start; i < n; i++) {
    chart.push({
      date: bars[i].date,
      close: bars[i].close,
      sma20: sma20S[i],
      sma50: sma50S[i],
      sma200: sma200S[i],
      volume: bars[i].volume,
    });
  }

  return { patterns, stats, chart };
}
