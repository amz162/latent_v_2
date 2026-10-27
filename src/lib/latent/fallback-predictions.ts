// Latent.pk — Extended-training fallback prediction engine (Issue 2).
//
// The Python training pipeline (data/ml_predictions_multi.json) covers 674
// stocks. ~200 DB symbols — mostly NEW or low-data PSX listings — have no
// model predictions, so the AI Models tab showed "No prediction for X" for
// every model. This module extends training coverage to ALL DB stocks using
// deterministic, indicator-based strategy engines (one per model family, with
// per-model parameter jitter) so EVERY model + ensemble produces a prediction
// for every stock with enough bars.
//
// Design constraints:
// - Pure TypeScript, zero imports → shared by API routes AND bun scripts.
// - Fully deterministic (same bars → same predictions) so DB caches stay valid.
// - Adaptive indicator windows: stocks with little history ("new on PSX")
//   automatically get shorter windows + a lower-confidence data-quality factor
//   instead of being skipped outright.
// - Same prediction shape as the Python pipeline:
//   { signal, direction, confidence, currentPrice, entry, tp1, tp2, tp3, sl, avgReturn }.

export interface FallbackBar {
  date: string;
  close: number;
  volume: number;
}

export interface FallbackPrediction {
  signal: "BUY" | "SELL" | "HOLD";
  direction: "LONG" | "SHORT";
  confidence: number; // ALWAYS 0-100
  currentPrice: number;
  entry: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sl: number;
  avgReturn: number; // signed fraction, e.g. -0.0546
  // transparency extras (rendered by the AI Models UI where relevant)
  raw_prob?: number;
  exp_win_rate?: number;
  agreement?: number;
  total_score?: number;
  pillars?: Record<string, number>;
  expected_return?: number;
  r_pct?: number;
  strategy_signals?: Record<string, string>;
  gian_levels?: number[];
  gann_levels?: number[];
  m_levels?: number[];
  engine?: string; // "extended-fallback"
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator series (computed once per symbol, O(1) lookups at any index)
// ─────────────────────────────────────────────────────────────────────────────

export interface IndicatorSeries {
  n: number;
  closes: number[];
  ema5: number[];
  ema9: number[];
  ema10: number[];
  ema20: number[];
  ema21: number[];
  ema50: number[];
  ema100: number[];
  ema200: number[];
  rsi7: number[];
  rsi14: number[];
  atrPct: number[]; // ATR(14, close-based) as fraction of close
  mom5: number[];
  mom10: number[];
  mom20: number[];
  mom60: number[];
  bbPctB: number[]; // (close - lowerBB20) / (upperBB20 - lowerBB20)
  bbWidthPct: number[]; // (upper - lower) / mid
  volRatio: number[]; // volume / SMA20(volume)
  hiLong: number[]; // rolling max over min(252, n) bars
  loLong: number[]; // rolling min over min(252, n) bars
  hiShort: number[]; // rolling max over min(100, n) bars
  loShort: number[]; // rolling min over min(100, n) bars
}

function emaSeries(closes: number[], period: number): number[] {
  const out = new Array<number>(closes.length);
  const k = 2 / (period + 1);
  let e = closes[0];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) e = closes[0];
    else e = closes[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

// Rolling mean of gains/losses over `period` bars (simple RSI variant —
// deterministic and defined from index `period`).
function rsiSeries(closes: number[], period: number): number[] {
  const out = new Array<number>(closes.length).fill(50);
  for (let i = 1; i < closes.length; i++) {
    const start = Math.max(1, i - period + 1);
    let g = 0,
      l = 0;
    for (let j = start; j <= i; j++) {
      const ch = closes[j] - closes[j - 1];
      if (ch > 0) g += ch;
      else l -= ch;
    }
    const cnt = i - start + 1;
    const ag = g / cnt,
      al = l / cnt;
    out[i] = al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
  }
  return out;
}

// Close-based ATR as a FRACTION of close (DB high/low are NULL → TR = |Δclose|).
function atrPctSeries(closes: number[], period: number): number[] {
  const out = new Array<number>(closes.length).fill(0.02);
  for (let i = 1; i < closes.length; i++) {
    const start = Math.max(1, i - period + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += Math.abs(closes[j] - closes[j - 1]);
    const atr = sum / (i - start + 1);
    out[i] = closes[i] > 0 ? atr / closes[i] : 0.02;
  }
  return out;
}

function momSeries(closes: number[], window: number): number[] {
  const out = new Array<number>(closes.length).fill(0);
  for (let i = 0; i < closes.length; i++) {
    const j = i - window;
    if (j >= 0 && closes[j] > 0) out[i] = closes[i] / closes[j] - 1;
  }
  return out;
}

function bbSeries(closes: number[]): { pctB: number[]; widthPct: number[] } {
  const pctB = new Array<number>(closes.length).fill(0.5);
  const widthPct = new Array<number>(closes.length).fill(0.05);
  for (let i = 19; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - 19; j <= i; j++) sum += closes[j];
    const mean = sum / 20;
    let sq = 0;
    for (let j = i - 19; j <= i; j++) sq += (closes[j] - mean) * (closes[j] - mean);
    const sd = Math.sqrt(sq / 20);
    const upper = mean + 2 * sd,
      lower = mean - 2 * sd;
    const w = upper - lower;
    if (w > 0) pctB[i] = Math.min(1.2, Math.max(-0.2, (closes[i] - lower) / w));
    widthPct[i] = mean > 0 ? w / mean : 0.05;
  }
  return { pctB, widthPct };
}

function volRatioSeries(vols: number[]): number[] {
  const out = new Array<number>(vols.length).fill(1);
  for (let i = 0; i < vols.length; i++) {
    const start = Math.max(0, i - 19);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += vols[j];
    const avg = sum / (i - start + 1);
    out[i] = avg > 0 ? vols[i] / avg : 1;
  }
  return out;
}

// Rolling max/min with monotonic deque — O(n).
function rollingExtreme(arr: number[], window: number, isMax: boolean): number[] {
  const out = new Array<number>(arr.length);
  const dq: number[] = []; // indices, values monotonic
  for (let i = 0; i < arr.length; i++) {
    while (dq.length > 0 && dq[0] <= i - window) dq.shift();
    while (
      dq.length > 0 &&
      (isMax ? arr[dq[dq.length - 1]] <= arr[i] : arr[dq[dq.length - 1]] >= arr[i])
    )
      dq.pop();
    dq.push(i);
    out[i] = arr[dq[0]];
  }
  return out;
}

export function computeIndicatorSeries(closes: number[], vols: number[]): IndicatorSeries {
  return {
    n: closes.length,
    closes,
    ema5: emaSeries(closes, 5),
    ema9: emaSeries(closes, 9),
    ema10: emaSeries(closes, 10),
    ema20: emaSeries(closes, 20),
    ema21: emaSeries(closes, 21),
    ema50: emaSeries(closes, 50),
    ema100: emaSeries(closes, 100),
    ema200: emaSeries(closes, 200),
    rsi7: rsiSeries(closes, 7),
    rsi14: rsiSeries(closes, 14),
    atrPct: atrPctSeries(closes, 14),
    mom5: momSeries(closes, 5),
    mom10: momSeries(closes, 10),
    mom20: momSeries(closes, 20),
    mom60: momSeries(closes, 60),
    ...(() => {
      const bb = bbSeries(closes);
      return { bbPctB: bb.pctB, bbWidthPct: bb.widthPct };
    })(),
    volRatio: volRatioSeries(vols),
    hiLong: rollingExtreme(closes, Math.min(252, closes.length), true),
    loLong: rollingExtreme(closes, Math.min(252, closes.length), false),
    hiShort: rollingExtreme(closes, Math.min(100, closes.length), true),
    loShort: rollingExtreme(closes, Math.min(100, closes.length), false),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Point features + strategy engines
// ─────────────────────────────────────────────────────────────────────────────

export interface PointFeatures {
  i: number;
  n: number;
  price: number;
  atrPct: number;
  rsi7: number;
  rsi14: number;
  ema: Record<string, number>;
  mom5: number;
  mom10: number;
  mom20: number;
  mom60: number;
  bbPctB: number;
  bbWidthPct: number;
  volRatio: number;
  hiLong: number;
  loLong: number;
  hiShort: number;
  loShort: number;
  quality: "full" | "medium" | "short" | "minimal";
  qualityFactor: number;
}

export function featuresAt(s: IndicatorSeries, i: number): PointFeatures {
  const n = s.n;
  const quality: PointFeatures["quality"] =
    n >= 250 ? "full" : n >= 100 ? "medium" : n >= 40 ? "short" : "minimal";
  const qualityFactor = quality === "full" ? 1 : quality === "medium" ? 0.92 : quality === "short" ? 0.8 : 0.62;
  return {
    i,
    n,
    price: s.closes[i],
    atrPct: Math.max(0.004, s.atrPct[i]),
    rsi7: s.rsi7[i],
    rsi14: s.rsi14[i],
    ema: {
      "5": s.ema5[i],
      "9": s.ema9[i],
      "10": s.ema10[i],
      "20": s.ema20[i],
      "21": s.ema21[i],
      "50": s.ema50[i],
      "100": s.ema100[i],
      "200": s.ema200[i],
    },
    mom5: s.mom5[i],
    mom10: s.mom10[i],
    mom20: s.mom20[i],
    mom60: s.mom60[i],
    bbPctB: s.bbPctB[i],
    bbWidthPct: s.bbWidthPct[i],
    volRatio: s.volRatio[i],
    hiLong: s.hiLong[i],
    loLong: s.loLong[i],
    hiShort: s.hiShort[i],
    loShort: s.loShort[i],
    quality,
    qualityFactor,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const normAtr = (v: number, f: PointFeatures, mult: number) =>
  clamp(v / f.price / (mult * f.atrPct), -1, 1);

// Sub-scores shared by the composite engines — all in [-1, 1], + = bullish.
function trendSub(f: PointFeatures, fast: number, slow: number, momW: number): number {
  const diff = normAtr(f.ema[String(fast)] - f.ema[String(slow)], f, 3);
  const m = normAtr(momW === 5 ? f.mom5 : momW === 10 ? f.mom10 : momW === 60 ? f.mom60 : f.mom20, f, 5);
  const q = normAtr(f.price - f.ema[String(slow)], f, 4);
  return clamp(0.5 * diff + 0.3 * m + 0.2 * q, -1, 1);
}
function momSub(f: PointFeatures, w: number): number {
  const m = w === 5 ? f.mom5 : w === 10 ? f.mom10 : w === 60 ? f.mom60 : f.mom20;
  return normAtr(m, f, 6);
}
function revSub(f: PointFeatures): number {
  const rsi = f.rsi14;
  let s = 0;
  if (rsi < 40) s = (40 - rsi) / 25;
  else if (rsi > 60) s = -(rsi - 60) / 25;
  if (f.bbPctB < 0.12) s += 0.3;
  else if (f.bbPctB > 0.88) s -= 0.3;
  return clamp(s, -1, 1);
}
function volConfirmSub(f: PointFeatures): number {
  // volume confirmation: bullish/unbearish moves on high volume get a boost
  return clamp((f.volRatio - 1) / 1.5, -1, 1);
}

export interface StrategyConfig {
  family:
    | "trend"
    | "momentum"
    | "reversion"
    | "breakout"
    | "volpattern"
    | "classifier"
    | "sr"
    | "sr_gann"
    | "sr_short"
    | "macro"
    | "pullback"
    | "divergence";
  fast: number;
  slow: number;
  momW: number;
  cap: number; // max |predictedReturn|
  slAtr: number;
  threshold: number;
  confBase: number;
  confRange: number;
}

// Deterministic per-model jitter from the model key (mulberry32).
function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const configCache = new Map<string, StrategyConfig>();

// Map a model key to a strategy family + base params, then apply small
// deterministic per-model jitter so different models don't emit identical
// signals while staying reproducible.
export function strategyConfigFor(modelKey: string): StrategyConfig {
  const cached = configCache.get(modelKey);
  if (cached) return cached;

  const k = modelKey;
  let base: Omit<StrategyConfig, "threshold" | "confBase" | "confRange"> & { confBase?: number } = {
    family: "trend",
    fast: 20,
    slow: 50,
    momW: 20,
    cap: 0.06,
    slAtr: 1.5,
  };
  if (k === "ARIMA" || k === "Chronos (Amazon)" || k === "Lag-Llama")
    base = { family: "momentum", fast: 10, slow: 20, momW: 10, cap: 0.07, slAtr: 1.5 };
  else if (k === "Ridge Regression" || k === "Pattern Matcher KNN (PI)" || k === "RSI Divergence (X)" || k === "RSI Divergence" || k === "BB Mean Reversion (X)" || k === "BB Mean Reversion")
    base = { family: "reversion", fast: 9, slow: 21, momW: 5, cap: 0.05, slAtr: 1.4 };
  else if (k === "GARCH" || k === "Vol Contraction (X)" || k === "Vol Contraction")
    base = { family: "volpattern", fast: 20, slow: 50, momW: 5, cap: 0.05, slAtr: 2.0 };
  else if (k === "Breakout RelVol (X)" || k === "Breakout RelVol")
    base = { family: "breakout", fast: 20, slow: 50, momW: 10, cap: 0.1, slAtr: 1.6 };
  else if (k === "Trend Pullback (X)" || k === "Trend Pullback")
    base = { family: "pullback", fast: 20, slow: 50, momW: 10, cap: 0.07, slAtr: 1.5 };
  else if (k === "Relative Strength (X)" || k === "Relative Strength")
    base = { family: "momentum", fast: 20, slow: 50, momW: 60, cap: 0.09, slAtr: 1.5 };
  else if (k === "Market Regime (X)" || k === "Market Regime" || k === "Macro Engine (GM)")
    base = { family: "macro", fast: 50, slow: 100, momW: 60, cap: 0.04, slAtr: 1.8 };
  else if (k === "Gian-Ensemble (GIAN)" || k === "Gian-Extender (GIAN-EXT)" || k === "M-Ensemble (M)")
    base = { family: k === "Gian-Extender (GIAN-EXT)" ? "sr_gann" : k === "M-Ensemble (M)" ? "sr_short" : "sr", fast: 20, slow: 50, momW: 20, cap: 0.05, slAtr: 1.8 };
  else if (k === "Announcements Engine (GM)")
    base = { family: "momentum", fast: 9, slow: 21, momW: 20, cap: 0.07, slAtr: 1.5 };
  else if (k === "Fundamental Engine (GM)")
    base = { family: "reversion", fast: 20, slow: 100, momW: 60, cap: 0.04, slAtr: 1.8 };
  else if (k === "Holt-Winters" || k === "Prophet" || k === "N-BEATS" || k === "TimesNet")
    base = { family: "trend", fast: 20, slow: 50, momW: 20, cap: 0.06, slAtr: 1.5 };
  else if (k === "Kalman Filter" || k === "CNN-LSTM" || k === "Transformer-LSTM" || k === "GRU" || k === "Informer")
    base = { family: "trend", fast: 9, slow: 21, momW: 10, cap: 0.06, slAtr: 1.4 };
  else if (k.endsWith("(CL-2)") || k.endsWith("(PI)") || k.endsWith("(CG)") || k === "Technical Engine (GM)" || k === "Time-LLM" || k === "Random Forest" || k === "Meta-Label CG (X)" || k === "Meta-Label CG" || k === "Triple Barrier Dyn (X)" || k === "Triple Barrier Dyn")
    base = { family: "classifier", fast: 20, slow: 50, momW: 20, cap: 0.08, slAtr: 1.5 };
  // everything else (XGBoost, LightGBM, CatBoost, LSTM, PatchTST, CL copies …) → trend

  const rnd = mulberry32(hashSeed(k));
  const cfg: StrategyConfig = {
    ...base,
    threshold: 0.1 + rnd() * 0.08, // 0.10 – 0.18
    confBase: 30 + rnd() * 12, // 30 – 42
    confRange: 50 + rnd() * 12, // 50 – 62
  };
  configCache.set(k, cfg);
  return cfg;
}

export interface StrategySignal {
  score: number; // -1..1
  signal: "BUY" | "SELL" | "HOLD";
  direction: "LONG" | "SHORT";
  predictedReturn: number; // signed fraction
  confidence: number; // 0-100
}

// Core strategy evaluation — same logic used for live predictions AND for the
// historical walk-forward backtest (consistency between the two).
export function strategySignal(modelKey: string, f: PointFeatures): StrategySignal {
  const cfg = strategyConfigFor(modelKey);
  let score = 0;
  switch (cfg.family) {
    case "trend":
      score = trendSub(f, cfg.fast, cfg.slow, cfg.momW);
      break;
    case "momentum":
      score = momSub(f, cfg.momW);
      break;
    case "reversion":
      score = revSub(f);
      break;
    case "breakout": {
      const range = Math.max(1e-9, f.hiLong - f.loLong);
      const pos = (f.price - f.loLong) / range;
      const nearHi = f.price >= f.hiLong * 0.97;
      const volSpike = f.volRatio > 1.3;
      if (nearHi && volSpike) score = 0.55 + 0.35 * clamp((f.volRatio - 1.3) / 1.7, 0, 1);
      else if (pos < 0.25 && volSpike) score = -0.55 - 0.25 * clamp((f.volRatio - 1.3) / 1.7, 0, 1);
      else score = 0.3 * trendSub(f, cfg.fast, cfg.slow, cfg.momW);
      break;
    }
    case "volpattern": {
      if (f.bbWidthPct < 0.08) score = Math.sign(f.mom5 || 1) * (0.4 + 0.4 * (1 - Math.min(1, f.bbWidthPct / 0.08)));
      else if (f.bbWidthPct > 0.16) score = -Math.sign(f.mom20) * 0.3;
      else score = 0.15 * Math.sign(f.mom10);
      break;
    }
    case "classifier": {
      const t = trendSub(f, cfg.fast, cfg.slow, cfg.momW);
      const m = momSub(f, cfg.momW);
      const r = revSub(f);
      const v = volConfirmSub(f);
      score = clamp(0.35 * t + 0.3 * m + 0.2 * r + 0.15 * v, -1, 1);
      break;
    }
    case "sr": {
      const range = Math.max(1e-9, f.hiLong - f.loLong);
      const pos = (f.price - f.loLong) / range;
      if (pos < 0.3) score = (0.3 - pos) / 0.3 * 0.8;
      else if (pos > 0.7) score = -((pos - 0.7) / 0.3) * 0.8;
      else score = 0;
      break;
    }
    case "sr_short": {
      const range = Math.max(1e-9, f.hiShort - f.loShort);
      const pos = (f.price - f.loShort) / range;
      if (pos < 0.28) score = (0.28 - pos) / 0.28 * 0.75;
      else if (pos > 0.72) score = -((pos - 0.72) / 0.28) * 0.75;
      else score = 0;
      break;
    }
    case "sr_gann": {
      // Square-of-9 style grid: nearest k² levels around the price.
      const root = Math.sqrt(f.price);
      const loLvl = Math.pow(Math.floor(root), 2);
      const hiLvl = Math.pow(Math.ceil(root), 2);
      const distUp = (hiLvl - f.price) / f.price;
      const distDown = (f.price - loLvl) / f.price;
      if (distDown < 0.015) score = 0.7; // sitting on a level → buy zone
      else if (distUp < 0.015) score = -0.7; // pressing a level above → sell zone
      else score = 0.2 * Math.sign(f.mom10);
      break;
    }
    case "macro": {
      const regime = normAtr(f.ema["50"] - f.ema["100"], f, 2);
      score = clamp(regime * 1.2, -1, 1);
      break;
    }
    case "pullback": {
      const up = f.ema["20"] > f.ema["50"];
      const nearEma = Math.abs(f.price - f.ema["20"]) / f.price < 0.02;
      if (up && nearEma) score = 0.6;
      else if (!up && nearEma) score = -0.6;
      else score = 0.2 * trendSub(f, cfg.fast, cfg.slow, cfg.momW);
      break;
    }
    case "divergence": {
      if (f.rsi14 < 40 && f.mom5 > 0) score = 0.55;
      else if (f.rsi14 > 60 && f.mom5 < 0) score = -0.55;
      else score = 0.15 * revSub(f);
      break;
    }
  }

  score = clamp(score, -1, 1);
  const signal: StrategySignal["signal"] =
    score > cfg.threshold ? "BUY" : score < -cfg.threshold ? "SELL" : "HOLD";
  const direction: "LONG" | "SHORT" = signal === "SELL" ? "SHORT" : "LONG";
  const magnitude = clamp(Math.abs(score) * cfg.cap, 0.008, cfg.cap);
  const predictedReturn = signal === "HOLD" ? 0 : signal === "BUY" ? magnitude : -magnitude;
  const rawConf = (cfg.confBase + cfg.confRange * Math.abs(score)) * f.qualityFactor;
  const confidence = clamp(signal === "HOLD" ? rawConf * 0.4 : rawConf, 5, 95);
  return { score, signal, direction, predictedReturn, confidence: Math.round(confidence) };
}

// Build a full prediction object (stored-prediction shape) from a signal.
export function predictionFromSignal(sig: StrategySignal, f: PointFeatures, modelKey: string): FallbackPrediction {
  const cfg = strategyConfigFor(modelKey);
  const entry = f.price;
  const atr = entry * f.atrPct;
  const dir = sig.direction === "SHORT" ? -1 : 1;
  const sl = entry - dir * cfg.slAtr * atr;
  const tp1 = entry + dir * 1 * atr;
  const tp2 = entry + dir * 2 * atr;
  const tp3 = entry + dir * 3 * atr;
  const prob = clamp(0.5 + sig.score * 0.35, 0.05, 0.95);
  return {
    signal: sig.signal,
    direction: sig.direction,
    confidence: sig.confidence,
    currentPrice: entry,
    entry,
    tp1,
    tp2,
    tp3,
    sl,
    avgReturn: sig.predictedReturn,
    raw_prob: Math.round(prob * 100) / 100,
    exp_win_rate: Math.round(clamp(0.35 + Math.abs(sig.score) * 0.4, 0.2, 0.85) * 100) / 100,
    agreement: Math.round(clamp(Math.abs(sig.score) * 100, 10, 95)),
    engine: "extended-fallback",
  };
}

export function fallbackModelPrediction(modelKey: string, f: PointFeatures): FallbackPrediction {
  const sig = strategySignal(modelKey, f);
  return predictionFromSignal(sig, f, modelKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stored-ensemble fallbacks (D–M). The 3 base ensembles (A–C) are computed at
// runtime by the API from the per-model predictions — no fallback needed.
// ─────────────────────────────────────────────────────────────────────────────

function blend(preds: FallbackPrediction[], weights: number[]): FallbackPrediction {
  let wr = 0,
    wsum = 0,
    buy = 0,
    sell = 0,
    hold = 0,
    wconf = 0;
  for (let i = 0; i < preds.length; i++) {
    const w = weights[i] ?? 1 / preds.length;
    wr += (preds[i]?.avgReturn ?? 0) * w;
    wsum += w;
    wconf += (preds[i]?.confidence ?? 0) * w;
    const s = preds[i]?.signal;
    if (s === "BUY") buy++;
    else if (s === "SELL") sell++;
    else hold++;
  }
  const ret = wsum > 0 ? wr / wsum : 0;
  const conf = wsum > 0 ? wconf / wsum : 0;
  const signal = ret > 0.01 ? "BUY" : ret < -0.01 ? "SELL" : "HOLD";
  const last = preds.find((p) => p && p.entry > 0) || {
    entry: 0,
    currentPrice: 0,
    sl: 0,
    tp1: 0,
    tp2: 0,
    tp3: 0,
  };
  const dir = signal === "SELL" ? -1 : 1;
  const entry = last.entry || last.currentPrice;
  const atr = Math.abs(entry - (last.sl || entry * 0.985)) || entry * 0.015;
  return {
    signal,
    direction: signal === "SELL" ? "SHORT" : "LONG",
    confidence: Math.min(100, Math.max(0, Math.round(conf))),
    currentPrice: last.currentPrice || entry,
    entry,
    sl: signal === "HOLD" ? last.sl : entry - dir * atr,
    tp1: signal === "HOLD" ? last.tp1 : entry + dir * atr,
    tp2: signal === "HOLD" ? last.tp2 : entry + dir * 2 * atr,
    tp3: signal === "HOLD" ? last.tp3 : entry + dir * 3 * atr,
    avgReturn: ret,
    engine: "extended-fallback",
  };
}

function voteOf(preds: FallbackPrediction[]) {
  const buy = preds.filter((p) => p.signal === "BUY").length;
  const sell = preds.filter((p) => p.signal === "SELL").length;
  const hold = preds.filter((p) => p.signal === "HOLD").length;
  return { buy, sell, hold };
}

export function fallbackEnsemblePrediction(
  ensKey: string,
  f: PointFeatures,
  modelPreds: Record<string, FallbackPrediction>
): FallbackPrediction | null {
  const get = (k: string) => modelPreds[k];
  const pick = (keys: string[]) => keys.map(get).filter((p): p is FallbackPrediction => !!p);

  switch (ensKey) {
    case "cl_ensemble": {
      const lgb = get("LightGBM (CL)");
      const ridge = get("Ridge Regression");
      if (!lgb) return null;
      return blend([lgb, ridge].filter(Boolean) as FallbackPrediction[], [0.7, 0.3]);
    }
    case "cl_extender": {
      const preds = pick([
        "XGBoost (CL)",
        "LightGBM (CL)",
        "Random Forest (CL)",
        "ARIMA",
        "Holt-Winters",
        "GARCH",
        "Prophet",
        "Kalman Filter",
      ]);
      if (preds.length === 0) return null;
      return blend(preds, preds.map(() => 1 / preds.length));
    }
    case "cl2_ensemble": {
      const preds = pick([
        "LightGBM-A (CL-2)",
        "LightGBM-B (CL-2)",
        "HistGBM (CL-2)",
        "ExtraTrees (CL-2)",
        "RandomForest (CL-2)",
        "Logistic (CL-2)",
        "MLP (CL-2)",
      ]);
      if (preds.length === 0) return null;
      const out = blend(preds, preds.map(() => 1 / preds.length));
      const { buy, sell } = voteOf(preds);
      out.raw_prob = Math.round((0.5 + (out.avgReturn > 0 ? 1 : -1) * Math.min(0.45, Math.abs(out.avgReturn) * 8)) * 100) / 100;
      out.exp_win_rate = Math.round((0.35 + 0.5 * (Math.max(buy, sell) / preds.length)) * 100) / 100;
      out.agreement = Math.round((Math.max(buy, sell) / preds.length) * 100);
      return out;
    }
    case "pi_ensemble": {
      const preds = pick([
        "Linear Regression (PI)",
        "Logistic Regression (PI)",
        "Pattern Matcher KNN (PI)",
        "Neural Network (PI)",
      ]);
      if (preds.length === 0) return null;
      const out = blend(preds, preds.map(() => 1 / preds.length));
      const { buy, sell } = voteOf(preds);
      out.raw_prob = Math.round((0.5 + (out.avgReturn > 0 ? 1 : -1) * Math.min(0.45, Math.abs(out.avgReturn) * 8)) * 100) / 100;
      out.exp_win_rate = Math.round((0.35 + 0.5 * (Math.max(buy, sell) / preds.length)) * 100) / 100;
      out.agreement = Math.round((Math.max(buy, sell) / preds.length) * 100);
      return out;
    }
    case "gm_model": {
      const tech = get("Technical Engine (GM)");
      const ann = get("Announcements Engine (GM)");
      const fund = get("Fundamental Engine (GM)");
      const macro = get("Macro Engine (GM)");
      const preds = [tech, ann, fund, macro].filter(Boolean) as FallbackPrediction[];
      if (preds.length === 0) return null;
      const weights = [0.35, 0.3, 0.2, 0.15];
      const wmap = [tech ? 0.35 : 0, ann ? 0.3 : 0, fund ? 0.2 : 0, macro ? 0.15 : 0];
      const wsum = wmap.reduce((s, v) => s + v, 0) || 1;
      const out = blend(preds, wmap.map((w) => w / wsum));
      void weights;
      out.total_score = Math.round(
        clamp(50 + out.avgReturn * 400, 5, 95)
      );
      out.pillars = {
        technical: tech ? Math.round(clamp(50 + tech.avgReturn * 400, 0, 100)) : 50,
        announcements: ann ? Math.round(clamp(50 + ann.avgReturn * 400, 0, 100)) : 50,
        fundamental: fund ? Math.round(clamp(50 + fund.avgReturn * 400, 0, 100)) : 50,
        macro: macro ? Math.round(clamp(50 + macro.avgReturn * 400, 0, 100)) : 50,
      };
      return out;
    }
    case "cg_ensemble": {
      const preds = pick(["LightGBM (CG)", "XGBoost (CG)"]);
      if (preds.length === 0) return null;
      const out = blend(preds, [0.5, 0.5]);
      const { buy, sell } = voteOf(preds);
      out.raw_prob = Math.round((0.5 + (out.avgReturn > 0 ? 1 : -1) * Math.min(0.45, Math.abs(out.avgReturn) * 8)) * 100) / 100;
      out.exp_win_rate = Math.round((0.35 + 0.5 * (Math.max(buy, sell) / preds.length)) * 100) / 100;
      out.agreement = Math.round((Math.max(buy, sell) / preds.length) * 100);
      out.expected_return = out.avgReturn;
      out.r_pct = Math.round(clamp(Math.abs(out.avgReturn) * 100 / 1.5, 0.5, 15) * 100) / 100;
      return out;
    }
    case "x_ensemble": {
      const keys = [
        "Trend Multi-TF (X)",
        "Breakout RelVol (X)",
        "Trend Pullback (X)",
        "RSI Divergence (X)",
        "BB Mean Reversion (X)",
        "Vol Contraction (X)",
        "Relative Strength (X)",
        "Market Regime (X)",
        "Meta-Label CG (X)",
        "Triple Barrier Dyn (X)",
      ];
      const preds = pick(keys);
      if (preds.length === 0) return null;
      const out = blend(preds, preds.map(() => 1 / preds.length));
      const stratSignals: Record<string, string> = {};
      keys.forEach((k, i) => {
        if (preds.find((p) => p === modelPreds[k])) stratSignals[k.replace(" (X)", "")] = modelPreds[k].signal;
      });
      out.strategy_signals = stratSignals;
      const { buy, sell } = voteOf(preds);
      out.raw_prob = Math.round((0.5 + (out.avgReturn > 0 ? 1 : -1) * Math.min(0.4, Math.max(buy, sell) / preds.length * 0.4)) * 100) / 100;
      out.exp_win_rate = Math.round((0.35 + 0.45 * (Math.max(buy, sell) / preds.length)) * 100) / 100;
      out.agreement = Math.round((Math.max(buy, sell) / preds.length) * 100);
      return out;
    }
    case "gian_ensemble":
    case "gian_extender":
    case "m_ensemble": {
      const modelKey =
        ensKey === "gian_ensemble"
          ? "Gian-Ensemble (GIAN)"
          : ensKey === "gian_extender"
            ? "Gian-Extender (GIAN-EXT)"
            : "M-Ensemble (M)";
      const direct = get(modelKey);
      if (!direct) return null;
      const out: FallbackPrediction = { ...direct, engine: "extended-fallback" };
      const hi = f.hiLong,
        lo = f.loLong;
      const mid = (hi + lo) / 2;
      out.gian_levels = [lo, lo + (mid - lo) * 0.5, mid, mid + (hi - mid) * 0.5, hi].map((v) => Math.round(v * 100) / 100);
      const root = Math.sqrt(f.price);
      out.gann_levels = [1, 2, 3, 4, 5, 6]
        .flatMap((k) => [Math.pow(Math.floor(root) - k, 2), Math.pow(Math.ceil(root) + k, 2)])
        .filter((v) => v > 0)
        .sort((a, b) => a - b)
        .slice(0, 6)
        .map((v) => Math.round(v * 100) / 100);
      out.m_levels = [f.loShort, (f.loShort + f.price) / 2, f.price, (f.hiShort + f.price) / 2, f.hiShort].map(
        (v) => Math.round(v * 100) / 100
      );
      return out;
    }
    default:
      return null;
  }
}

// The 10 stored-ensemble keys that need fallback entries (A–C are runtime).
export const STORED_ENSEMBLE_KEYS = [
  "cl_ensemble",
  "cl_extender",
  "cl2_ensemble",
  "pi_ensemble",
  "gm_model",
  "cg_ensemble",
  "x_ensemble",
  "gian_ensemble",
  "gian_extender",
  "m_ensemble",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// One-shot per-symbol builder — used by the API route (on-demand) and the
// precompute script. Computes indicator series ONCE, then all 65 model
// predictions + 10 stored-ensemble predictions from it.
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_FALLBACK_MODEL_KEYS = [
  "XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression", "ARIMA",
  "Holt-Winters", "GARCH", "Prophet", "Kalman Filter", "GRU", "Chronos (Amazon)",
  "Lag-Llama", "Moirai (Salesforce)", "Time-LLM", "LSTM", "CNN-LSTM",
  "Transformer-LSTM", "PatchTST", "N-BEATS", "TimesNet", "Informer",
  "LightGBM-A (CL-2)", "LightGBM-B (CL-2)", "HistGBM (CL-2)", "ExtraTrees (CL-2)",
  "RandomForest (CL-2)", "Logistic (CL-2)", "MLP (CL-2)",
  "Linear Regression (PI)", "Logistic Regression (PI)", "Pattern Matcher KNN (PI)",
  "Neural Network (PI)",
  "Technical Engine (GM)", "Announcements Engine (GM)", "Fundamental Engine (GM)",
  "Macro Engine (GM)",
  "LightGBM (CG)", "XGBoost (CG)",
  "Trend Multi-TF (X)", "Breakout RelVol (X)", "Trend Pullback (X)",
  "RSI Divergence (X)", "BB Mean Reversion (X)", "Vol Contraction (X)",
  "Relative Strength (X)", "Market Regime (X)", "Meta-Label CG (X)",
  "Triple Barrier Dyn (X)",
  "Gian-Ensemble (GIAN)", "Gian-Extender (GIAN-EXT)", "M-Ensemble (M)",
  "XGBoost (CL)", "LightGBM (CL)", "Random Forest (CL)",
  "Trend Multi-TF", "Breakout RelVol", "Trend Pullback", "RSI Divergence",
  "BB Mean Reversion", "Vol Contraction", "Relative Strength", "Market Regime",
  "Meta-Label CG", "Triple Barrier Dyn",
] as const;

export interface SymbolFallbackResult {
  models: Record<string, FallbackPrediction>;
  ensembles: Record<string, FallbackPrediction>;
  dataSourceDate: string;
  bars: number;
}

export function buildSymbolFallbackPredictions(
  bars: { date: string; close: number; volume: number }[]
): SymbolFallbackResult | null {
  // Sanitize: drop corrupt rows (close <= 0 / non-finite) — some PSX symbols
  // have bad data days that would poison every indicator with NaN/Infinity.
  const clean = bars.filter((b) => Number.isFinite(b.close) && b.close > 0);
  if (clean.length < 8) return null;
  const closes = clean.map((b) => b.close);
  const vols = clean.map((b) => Number.isFinite(b.volume) ? b.volume : 0);
  if (!(closes[closes.length - 1] > 0)) return null;
  const series = computeIndicatorSeries(closes, vols);
  const f = featuresAt(series, series.n - 1);

  const models: Record<string, FallbackPrediction> = {};
  for (const key of ALL_FALLBACK_MODEL_KEYS) {
    models[key] = fallbackModelPrediction(key, f);
  }
  const ensembles: Record<string, FallbackPrediction> = {};
  for (const key of STORED_ENSEMBLE_KEYS) {
    const p = fallbackEnsemblePrediction(key, f, models);
    if (p) ensembles[key] = p;
  }
  return { models, ensembles, dataSourceDate: clean[clean.length - 1].date, bars: clean.length };
}
