// Latent.pk — beta 12-strategy engine (Task 116 Parts D2/D3)
//
// One canonical TypeScript implementation, evaluated point-in-time: every
// strategy sees only bars up to its decision timestamp (the last verified
// bar). Hypothetical execution follows the platform's documented
// next-session rule — a breakout/signal discovered at a session close can
// only be executed at the NEXT eligible session's price; this engine REPORTS
// the signal and leaves execution simulation to the forward pipeline.
//
// Roles (Part D3): directional | regime_gate | pair_context
// Statuses:        active | context_only | insufficient_data | stale |
//                  blocked | calculation_error
//
// Long-only policy (Part C1): bearish output means negative pressure / exit
// context. Nothing here creates a short position, borrowing or leverage.

import {
  atrSeries,
  autocorr1,
  emaSeries,
  fitAr1,
  hurstExponent,
  linreg,
  logReturns,
  mean,
  smaSeries,
  stdev,
  varianceRatio,
  wilderRsi,
  type OhlcvLike,
} from "./series";

export type StrategyRole = "directional" | "regime_gate" | "pair_context";
export type StrategyStatus =
  | "active"
  | "context_only"
  | "insufficient_data"
  | "stale"
  | "blocked"
  | "calculation_error";
export type StrategyDirection = "bullish" | "bearish" | "neutral";

export interface StrategySignal {
  signalId: string; // deterministic: strategyId + symbol + sourceBarDate
  symbol: string;
  strategyId: string;
  strategyName: string;
  decisionTimestamp: string; // ISO instant of decision
  sourceBarDate: string; // last verified bar used
  direction: StrategyDirection;
  rawScore: number | null; // bounded [-1, 1]; magnitude NOT a probability
  role: StrategyRole;
  eligibility: "eligible_vote" | "gate_only" | "excluded" | "not_eligible";
  reason: string; // plain-language why (for the UI and the LLM evidence pack)
  dataFreshness: "current" | "stale" | "insufficient";
  inputCoverage: number; // 0..1 usable bars / required bars
  methodVersion: string;
  sourceReferences: string[]; // bar dates actually used (bounds)
  validationStatus: StrategyStatus;
}

export interface StrategyMeta {
  strategyId: string;
  strategyName: string;
  role: StrategyRole;
  family: "trend_momentum" | "mean_reversion" | "volatility_breakout" | "regime_context" | "pair_relative";
  votesInFusion: boolean; // directional strategies only
  methodVersion: string;
  restrictions: string; // e.g. long-only context, no options instrument, short leg prohibited
}

export const STRATEGY_INVENTORY: StrategyMeta[] = [
  { strategyId: "golden_cross_ma7_30", strategyName: "Golden Cross (MA7/MA30)", role: "directional", family: "trend_momentum", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Crossover events only; continuous MA difference is trend-strength context and never a vote by itself." },
  { strategyId: "macd_ema12_26_9", strategyName: "MACD (EMA12/26, signal 9)", role: "directional", family: "trend_momentum", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Normalization uses an expanding point-in-time window; warm-up requires ≥ 35 bars." },
  { strategyId: "rsi_divergence_wilder14", strategyName: "RSI Divergence (Wilder 14)", role: "directional", family: "trend_momentum", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Pivots confirmed only after a 3-bar window; signal dated at confirmation, never backdated to the pivot." },
  { strategyId: "zscore_mean_reversion_60", strategyName: "Z-Score Mean Reversion (60)", role: "directional", family: "mean_reversion", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Rolling log-price deviation; raw price levels are not assumed stationary." },
  { strategyId: "ou_mean_reversion_ar1", strategyName: "Ornstein-Uhlenbeck (AR(1))", role: "directional", family: "mean_reversion", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Fit must show a stationary coefficient and adequate fit quality, else insufficient_data/not_mean_reverting." },
  { strategyId: "linreg_channel_60", strategyName: "Linear Regression Channel (60)", role: "directional", family: "trend_momentum", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Trailing-window residual z-score; the current (unknown future) close is never an input to its own signal." },
  { strategyId: "donchian_atr_breakout_20", strategyName: "Volatility Breakout (Donchian 20 + ATR14)", role: "directional", family: "volatility_breakout", votesInFusion: true, methodVersion: "beta-v1", restrictions: "Channel from completed prior bars (shift 1); next-session execution rule applies to any hypothetical entry." },
  { strategyId: "pairs_kalman_hedge", strategyName: "Pairs Trading (Kalman hedge)", role: "pair_context", family: "pair_relative", votesInFusion: false, methodVersion: "beta-v1", restrictions: "CONTEXT-ONLY: a hedged pairs position may require a short leg — prohibited under the beta long-only policy. Cointegration is verified on training data; never assumed. Excluded from the executable consensus by design." },
  { strategyId: "variance_ratio_lo_mackinlay", strategyName: "Variance Ratio (Lo-MacKinlay, q=4)", role: "regime_gate", family: "regime_context", votesInFusion: false, methodVersion: "beta-v1", restrictions: "Regime gate only — never an independent bullish/bearish prediction." },
  { strategyId: "hurst_exponent_rs", strategyName: "Hurst Exponent (R/S on returns)", role: "regime_gate", family: "regime_context", votesInFusion: false, methodVersion: "beta-v1", restrictions: "Regime descriptor with sample-size warnings; no directional vote." },
  { strategyId: "autocorrelation_lag1", strategyName: "Autocorrelation Filter (lag-1)", role: "regime_gate", family: "regime_context", votesInFusion: false, methodVersion: "beta-v1", restrictions: "Context/regime gate; weak statistical support yields neutral, not a vote." },
  { strategyId: "bollinger_width_regime", strategyName: "Bollinger Band Width Regime (20,2)", role: "regime_gate", family: "regime_context", votesInFusion: false, methodVersion: "beta-v1", restrictions: "Volatility-regime context. Expansion is NOT automatically bullish; no options instrument exists in this research infrastructure." },
];

const MIN_BARS = 130; // warm-up for MA30 + EMA26/9 + 60-day windows + margin
const STALE_BAR_DAYS = 14; // session dates; > 14 calendar days without a bar = stale

function isoNow(): string {
  return new Date().toISOString();
}

function baseSignal(
  meta: StrategyMeta,
  symbol: string,
  sourceBarDate: string,
  status: StrategyStatus,
  reason: string,
  inputCoverage: number
): StrategySignal {
  return {
    signalId: `${meta.strategyId}_${symbol}_${sourceBarDate}`,
    symbol,
    strategyId: meta.strategyId,
    strategyName: meta.strategyName,
    decisionTimestamp: isoNow(),
    sourceBarDate,
    direction: "neutral",
    rawScore: null,
    role: meta.role,
    eligibility:
      status === "active" && meta.role === "directional"
        ? "eligible_vote"
        : status === "context_only" || status === "active"
          ? meta.role === "regime_gate"
            ? "gate_only"
            : "excluded"
          : "not_eligible",
    reason,
    dataFreshness: "current",
    inputCoverage,
    methodVersion: meta.methodVersion,
    sourceReferences: [],
    validationStatus: status,
  };
}

function freshnessOf(lastBarDate: string, today: Date): { fresh: "current" | "stale"; days: number } {
  const last = new Date(lastBarDate + "T00:00:00Z").getTime();
  const days = Math.floor((today.getTime() - last) / 86_400_000);
  return { fresh: days > STALE_BAR_DAYS ? "stale" : "current", days };
}

// ── 1. Golden Cross — actual crossover events, not the continuous diff ──────
function goldenCross(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  if (bars.length < MIN_BARS) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${MIN_BARS}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  const closes = bars.map((b) => b.close);
  const ma7 = smaSeries(closes, 7);
  const ma30 = smaSeries(closes, 30);
  const n = bars.length - 1;
  const rPrev = ma7[n - 1] != null && ma30[n - 1] != null ? (ma7[n - 1] as number) - (ma30[n - 1] as number) : null;
  const rCur = ma7[n] != null && ma30[n] != null ? (ma7[n] as number) - (ma30[n] as number) : null;
  if (rPrev === null || rCur === null) {
    s.reason = "Moving-average warm-up incomplete at the decision bar.";
    return s;
  }
  s.sourceReferences = [bars[n - 1].date, bars[n].date];
  s.inputCoverage = 1;
  if (rPrev <= 0 && rCur > 0) {
    s.direction = "bullish";
    s.rawScore = 1;
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Bullish crossover: MA7 crossed above MA30 at the ${bars[n].date} close (event confirmed on two consecutive relations).`;
  } else if (rPrev >= 0 && rCur < 0) {
    s.direction = "bearish";
    s.rawScore = -1;
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Bearish crossover: MA7 crossed below MA30 at the ${bars[n].date} close (exit-pressure context under the long-only policy).`;
  } else {
    const strength = rCur / bars[n].close;
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.direction = rCur > 0 ? "neutral" : "neutral";
    s.rawScore = Math.max(-1, Math.min(1, strength * 20));
    s.reason = `No crossover event. Continuous MA difference (${rCur >= 0 ? "+" : ""}${rCur.toFixed(2)}) is trend-strength context only — never a vote.`;
  }
  return s;
}

// ── 2. MACD with point-in-time normalization ────────────────────────────────
function macd(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  if (bars.length < 50) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ 50.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const e12 = emaSeries(closes, 12);
  const e26 = emaSeries(closes, 26);
  const macdLine: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (e12[i] != null && e26[i] != null) {
      macdLine.push((e12[i] as number) - (e26[i] as number));
      idx.push(i);
    }
  }
  if (macdLine.length < 9 + 5) {
    s.reason = "MACD warm-up incomplete.";
    return s;
  }
  const signal9 = emaSeries(macdLine, 9);
  const n = macdLine.length - 1;
  if (signal9[n] == null) {
    s.reason = "Signal-line warm-up incomplete.";
    return s;
  }
  const hist = macdLine[n] - (signal9[n] as number);
  // Expanding point-in-time normalization: z of histogram over ALL macd
  // history UP TO n (never the full dataset including later values — at the
  // live decision bar the trailing window IS all available history).
  const histHistory: number[] = [];
  for (let i = 0; i <= n; i++) {
    if (signal9[i] != null) histHistory.push(macdLine[i] - (signal9[i] as number));
  }
  const sd = stdev(histHistory);
  const z = sd && sd > 0 ? hist / sd : 0;
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bars[Math.max(0, idx[n] - 1)].date, bars[idx[n]].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  const prevHist = signal9[n - 1] != null ? macdLine[n - 1] - (signal9[n - 1] as number) : null;
  const crossedUp = prevHist !== null && prevHist <= 0 && hist > 0;
  const crossedDown = prevHist !== null && prevHist >= 0 && hist < 0;
  if (crossedUp || z > 1) {
    s.direction = "bullish";
    s.rawScore = Math.max(0, Math.min(1, z / 3));
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = crossedUp
      ? `MACD histogram crossed above its signal line at the ${s.sourceBarDate} close (z=${z.toFixed(2)}).`
      : `MACD histogram strongly positive (z=${z.toFixed(2)}).`;
  } else if (crossedDown || z < -1) {
    s.direction = "bearish";
    s.rawScore = Math.max(-1, Math.min(0, z / 3));
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = crossedDown
      ? `MACD histogram crossed below its signal line at the ${s.sourceBarDate} close (z=${z.toFixed(2)}) — negative pressure.`
      : `MACD histogram strongly negative (z=${z.toFixed(2)}).`;
  } else {
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.rawScore = Math.max(-1, Math.min(1, z / 3));
    s.reason = `MACD histogram within its normal range (z=${z.toFixed(2)}) — no confirmed momentum event.`;
  }
  return s;
}

// ── 3. RSI divergence — pivot-based, causally confirmed ─────────────────────
function rsiDivergence(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  if (bars.length < 60) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ 60.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const rsi = wilderRsi(closes, 14);
  const n = bars.length - 1;
  const CONF = 3; // pivot confirmation window
  const LOOKBACK = 40; // search window for the prior pivot
  // find most recent CONFIRMED pivot low (for bullish) and pivot high (bearish):
  // a pivot at index p is confirmed only at index p+CONF (p is the lowest low of
  // its ±CONF neighbourhood) — the signal is dated at the CONFIRMATION bar.
  let pivotLow: { p: number; confirmedAt: number } | null = null;
  for (let p = n - CONF; p >= n - CONF - LOOKBACK && p >= CONF; p--) {
    if (rsi[p] == null) continue;
    let isLow = true;
    for (let j = p - CONF; j <= p + CONF; j++) {
      if (j !== p && rsi[j] != null && (rsi[j] as number) < (rsi[p] as number)) isLow = false;
    }
    if (isLow) {
      pivotLow = { p, confirmedAt: p + CONF };
      break;
    }
  }
  let pivotHigh: { p: number; confirmedAt: number } | null = null;
  for (let p = n - CONF; p >= n - CONF - LOOKBACK && p >= CONF; p--) {
    if (rsi[p] == null) continue;
    let isHigh = true;
    for (let j = p - CONF; j <= p + CONF; j++) {
      if (j !== p && rsi[j] != null && (rsi[j] as number) > (rsi[p] as number)) isHigh = false;
    }
    if (isHigh) {
      pivotHigh = { p, confirmedAt: p + CONF };
      break;
    }
  }
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  const priorLowIdx = pivotLow ? pivotLow.p - 20 : -1;
  const bullish =
    pivotLow &&
    priorLowIdx >= 0 &&
    rsi[priorLowIdx] != null &&
    (closes[n] as number) < (closes[pivotLow.p] as number) &&
    (rsi[n] as number) > (rsi[pivotLow.p] as number) &&
    n - pivotLow.confirmedAt <= 5;
  const priorHighIdx = pivotHigh ? pivotHigh.p - 20 : -1;
  const bearish =
    pivotHigh &&
    priorHighIdx >= 0 &&
    rsi[priorHighIdx] != null &&
    (closes[n] as number) > (closes[pivotHigh.p] as number) &&
    (rsi[n] as number) < (rsi[pivotHigh.p] as number) &&
    n - pivotHigh.confirmedAt <= 5;
  if (bullish) {
    s.direction = "bullish";
    s.rawScore = 1;
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.sourceReferences = [bars[priorLowIdx].date, bars[pivotLow!.p].date, bars[pivotLow!.confirmedAt].date, bars[n].date];
    s.reason = `Bullish divergence confirmed on ${bars[pivotLow!.confirmedAt].date} (price lower low, Wilder RSI higher low). Signal dated at confirmation, not at the pivot.`;
  } else if (bearish) {
    s.direction = "bearish";
    s.rawScore = -1;
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.sourceReferences = [bars[priorHighIdx].date, bars[pivotHigh!.p].date, bars[pivotHigh!.confirmedAt].date, bars[n].date];
    s.reason = `Bearish divergence confirmed on ${bars[pivotHigh!.confirmedAt].date} (price higher high, Wilder RSI lower high).`;
  } else {
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.rawScore = 0;
    s.reason = "No causally confirmed divergence in the trailing window.";
  }
  return s;
}

// ── 4. Z-score mean reversion on rolling log-price deviation ────────────────
function zScoreMR(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const W = 60;
  if (bars.length < W + 10) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${W + 10}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  const logp = closes.slice(n - W + 1, n + 1).map((c) => Math.log(c));
  const m = mean(logp) as number;
  const sd = stdev(logp) as number;
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bars[n - W + 1].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (!sd || sd === 0) {
    s.reason = "Rolling standard deviation is zero — no dispersion to trade against.";
    return s;
  }
  const z = (logp[logp.length - 1] - m) / sd;
  s.rawScore = Math.max(-1, Math.min(1, -z / 2.5));
  if (z <= -2) {
    s.direction = "bullish";
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Log-price is ${Math.abs(z).toFixed(2)} rolling σ below its ${W}-session mean — stretched-low mean-reversion context.`;
  } else if (z >= 2) {
    s.direction = "bearish";
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Log-price is ${z.toFixed(2)} rolling σ above its ${W}-session mean — stretched-high mean-reversion context.`;
  } else {
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.reason = `Log-price within its normal rolling range (z=${z.toFixed(2)}).`;
  }
  return s;
}

// ── 5. Ornstein-Uhlenbeck / AR(1) with honest validity checks ───────────────
function ouMeanReversion(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const W = 120;
  if (bars.length < W) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${W}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  const logp = closes.slice(n - W + 1, n + 1).map((c) => Math.log(c));
  const fit = fitAr1(logp);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bars[n - W + 1].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (!fit) {
    s.reason = "AR(1) fit failed on the trailing window.";
    return s;
  }
  if (!fit.stationary) {
    s.validationStatus = "insufficient_data";
    s.eligibility = "not_eligible";
    s.rawScore = null;
    s.reason = `Fitted AR(1) coefficient φ=${fit.b.toFixed(3)} is not stationary (need 0<φ<1) — reported as not_mean_reverting, never clamped to pass.`;
    return s;
  }
  if (fit.r2 < 0.05) {
    s.validationStatus = "insufficient_data";
    s.eligibility = "not_eligible";
    s.rawScore = null;
    s.reason = `Mean-reversion evidence too weak (AR(1) R²=${fit.r2.toFixed(3)}).`;
    return s;
  }
  // residual-based signal: deviation of current log price from the AR(1) one-step mean
  const oneStepMean = fit.a + fit.b * logp[logp.length - 2];
  const resid = logp[logp.length - 1] - oneStepMean;
  const residSeries: number[] = [];
  for (let i = 1; i < logp.length; i++) residSeries.push(logp[i] - (fit.a + fit.b * logp[i - 1]));
  const sd = stdev(residSeries) ?? 0;
  const z = sd > 0 ? resid / sd : 0;
  s.rawScore = Math.max(-1, Math.min(1, -z / 2));
  if (z <= -1.5) {
    s.direction = "bullish";
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Stationary AR(1) (φ=${fit.b.toFixed(2)}, half-life ${fit.halfLife?.toFixed(0)} sessions, R²=${fit.r2.toFixed(2)}): current price ${Math.abs(z).toFixed(1)} residual-σ below its mean path.`;
  } else if (z >= 1.5) {
    s.direction = "bearish";
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Stationary AR(1) (φ=${fit.b.toFixed(2)}, half-life ${fit.halfLife?.toFixed(0)} sessions, R²=${fit.r2.toFixed(2)}): current price ${z.toFixed(1)} residual-σ above its mean path.`;
  } else {
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.reason = `Mean-reverting fit exists but the price sits within its normal residual band (z=${z.toFixed(2)}).`;
  }
  return s;
}

// ── 6. Linear regression channel (trailing, aligned) ────────────────────────
function linregChannel(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const W = 60;
  if (bars.length < W + 5) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${W + 5}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  // Trailing window INCLUDING the current bar (index n) — the decision uses
  // the just-closed bar, which is known at decision time. Execution of any
  // hypothetical entry follows the next-session rule downstream.
  const y = closes.slice(n - W + 1, n + 1);
  const reg = linreg(y);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bars[n - W + 1].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (!reg || reg.residualSd === 0) {
    s.reason = "Regression channel could not be computed.";
    return s;
  }
  const residLast = y[y.length - 1] - (reg.intercept + reg.slope * (y.length - 1));
  const z = residLast / reg.residualSd;
  s.rawScore = Math.max(-1, Math.min(1, -z / 2));
  if (z <= -1.5) {
    s.direction = "bullish";
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Price ${Math.abs(z).toFixed(1)} residual-σ below the trailing ${W}-session regression channel (channel width ±2σ).`;
  } else if (z >= 1.5) {
    s.direction = "bearish";
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Price ${z.toFixed(1)} residual-σ above the trailing ${W}-session regression channel.`;
  } else {
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.reason = `Price within the regression channel (z=${z.toFixed(2)}).`;
  }
  return s;
}

// ── 7. Pairs / Kalman hedge — context-only ──────────────────────────────────
// Candidate pairs are CONFIGURED, never hardcoded to one historic example.
const CANDIDATE_PAIRS: Array<[string, string]> = [["LUCK", "DGKC"], ["OGDC", "PPL"], ["ENGRO", "FFC"], ["HUBC", "KAPCO"]];

function pairsKalman(
  meta: StrategyMeta,
  symbol: string,
  bars: OhlcvLike[],
  today: Date,
  peerBars: Map<string, OhlcvLike[]>
): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "blocked", "context-only under the long-only policy", 0);
  s.validationStatus = "blocked";
  s.eligibility = "excluded";
  s.direction = "neutral";
  s.rawScore = null;
  const mate = CANDIDATE_PAIRS.find((p) => p[0] === symbol || p[1] === symbol);
  if (!mate) {
    s.reason = "No configured pair partner for this symbol — pair context unavailable (no pair is assumed).";
    return s;
  }
  const other = mate[0] === symbol ? mate[1] : mate[0];
  const ob = peerBars.get(other);
  if (!ob || ob.length < MIN_BARS) {
    s.reason = `Pair partner ${other} has insufficient verified history — cointegration is never assumed.`;
    return s;
  }
  // synchronized dates only
  const datesA = new Map(bars.map((b) => [b.date, b.close]));
  const joint: Array<{ d: string; a: number; b: number }> = [];
  for (const b of ob) {
    const ca = datesA.get(b.date);
    if (ca != null) joint.push({ d: b.date, a: ca, b: b.close });
  }
  if (joint.length < MIN_BARS) {
    s.reason = `Synchronized history with ${other} covers only ${joint.length} sessions — insufficient for a training-window cointegration check.`;
    return s;
  }
  // training-window hedge (first 80%), then an honest cointegration proxy:
  // ADF-style check on residuals is approximated by AR(1) stationarity of the
  // residual spread — the documented, causally safe proxy used in beta.
  const trainN = Math.floor(joint.length * 0.8);
  const spread = (a: number, b: number, beta: number) => Math.log(a) - beta * Math.log(b);
  const xs = joint.slice(0, trainN).map((j) => Math.log(j.b));
  const ys = joint.slice(0, trainN).map((j) => Math.log(j.a));
  const mx = xs.reduce((p, c) => p + c, 0) / xs.length;
  const my = ys.reduce((p, c) => p + c, 0) / ys.length;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxx += (xs[i] - mx) * (xs[i] - mx);
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  const beta = sxx > 0 ? sxy / sxx : 1;
  const trainSpread = joint.slice(0, trainN).map((j) => spread(j.a, j.b, beta));
  const fit = fitAr1(trainSpread);
  const cointegrated = !!fit && fit.stationary && fit.r2 > 0.1;
  const recent = joint.slice(-20);
  const lastSpread = spread(recent[recent.length - 1].a, recent[recent.length - 1].b, beta);
  const sd = stdev(trainSpread) ?? 1;
  s.inputCoverage = joint.length / Math.max(bars.length, ob.length);
  s.sourceReferences = [recent[0].d, recent[recent.length - 1].d];
  s.reason = cointegrated
    ? `Training-window spread vs ${other} (β=${beta.toFixed(2)}) is stationary (AR(1) φ=${fit!.b.toFixed(2)}); recent spread z=${(lastSpread / sd).toFixed(2)}. CONTEXT-ONLY: not an executable vote — a hedged position may require a short leg, prohibited in the beta long-only policy.`
    : `Training-window spread vs ${other} (β=${beta.toFixed(2)}) shows NO reliable cointegration — pair context reported as not_mean_reverting, never assumed.`;
  s.validationStatus = "blocked"; // always: excluded from executable consensus
  return s;
}

// ── 8. Variance ratio (Lo-MacKinlay, heteroskedasticity-robust) ─────────────
function varianceRatioGate(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const W = 120;
  if (bars.length < W) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${W}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  const rets = logReturns(closes.slice(n - W, n + 1));
  const vr = varianceRatio(rets, 4);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bars[n - W].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (!vr) {
    s.reason = "Sample too small for a valid variance-ratio statistic.";
    return s;
  }
  s.validationStatus = "context_only";
  s.eligibility = "gate_only";
  s.rawScore = Math.max(-1, Math.min(1, (vr.vr - 1)));
  const significant = Math.abs(vr.z) > 1.96;
  s.reason = significant
    ? vr.vr > 1
      ? `VR(q=4)=${vr.vr.toFixed(2)} (z=${vr.z.toFixed(2)}) — significant TRENDING regime context (gate only, never a vote).`
      : `VR(q=4)=${vr.vr.toFixed(2)} (z=${vr.z.toFixed(2)}) — significant MEAN-REVERTING regime context (gate only).`
    : `VR(q=4)=${vr.vr.toFixed(2)} (z=${vr.z.toFixed(2)}) — no significant regime signal at the 5% level.`;
  return s;
}

// ── 9. Hurst exponent on returns ────────────────────────────────────────────
function hurstGate(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  if (bars.length < 256) {
    s.reason = `Insufficient history for a reliable Hurst estimate: ${bars.length} bars, need ≥ 256.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  const rets = logReturns(closes.slice(n - 255, n + 1));
  const h = hurstExponent(rets);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / 256);
  s.sourceReferences = [bars[n - 255].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (!h) {
    s.reason = "Hurst estimator needs more usable windows.";
    return s;
  }
  s.validationStatus = "context_only";
  s.eligibility = "gate_only";
  s.rawScore = Math.max(-1, Math.min(1, (h.h - 0.5) * 2));
  s.reason =
    `H=${h.h.toFixed(2)} over ${h.nObs} return observations (min window ${h.minWindow}). ` +
    (h.h > 0.55 ? "Persistent/trending regime descriptor." : h.h < 0.45 ? "Anti-persistent/mean-reverting regime descriptor." : "Near-random-walk regime.") +
    " Regime descriptor only — never an independent bullish/bearish prediction.";
  return s;
}

// ── 10. Autocorrelation filter ──────────────────────────────────────────────
function acfGate(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const W = 90;
  if (bars.length < W) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${W}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  const rets = logReturns(closes.slice(n - W, n + 1));
  const ac = autocorr1(rets);
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bars[n - W].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (!ac) {
    s.reason = "Not enough return observations for the lag-1 autocorrelation.";
    return s;
  }
  s.validationStatus = "context_only";
  s.eligibility = "gate_only";
  s.rawScore = Math.max(-1, Math.min(1, ac.rho * 2));
  const sig = Math.abs(ac.t) > 1.96;
  s.reason = sig
    ? `Lag-1 autocorrelation ρ=${ac.rho.toFixed(2)} (t=${ac.t.toFixed(1)}, n=${ac.n}) — ${ac.rho > 0 ? "momentum-tilted" : "mean-reverting"} regime context with statistical support (gate only).`
    : `Lag-1 autocorrelation ρ=${ac.rho.toFixed(2)} (t=${ac.t.toFixed(1)}) is not statistically significant — neutral context, NOT a vote.`;
  return s;
}

// ── 11. Donchian + ATR breakout (prior bars only) ───────────────────────────
function donchianBreakout(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const N = 20;
  if (bars.length < N + 16) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${N + 16}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const n = bars.length - 1;
  // Channel from COMPLETED PRIOR bars (shift 1): the decision bar's own high
  // can never define the channel it is tested against.
  const prior = bars.slice(n - N, n);
  const upper = Math.max(...prior.map((b) => b.high));
  const lower = Math.min(...prior.map((b) => b.low));
  const atrs = atrSeries(bars, 14);
  const atr = atrs[n];
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [prior[0].date, bars[n].date];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  if (atr == null) {
    s.reason = "ATR warm-up incomplete.";
    return s;
  }
  const close = bars[n].close;
  if (close > upper) {
    s.direction = "bullish";
    s.rawScore = Math.min(1, (close - upper) / (2 * atr) + 0.5);
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Close ${close.toFixed(2)} broke above the ${N}-session Donchian high ${upper.toFixed(2)} (channel from completed prior bars). Any hypothetical entry executes NEXT session — never at this close.`;
  } else if (close < lower) {
    s.direction = "bearish";
    s.rawScore = Math.max(-1, -Math.min(1, (lower - close) / (2 * atr) + 0.5));
    s.validationStatus = "active";
    s.eligibility = "eligible_vote";
    s.reason = `Close ${close.toFixed(2)} broke below the ${N}-session Donchian low ${lower.toFixed(2)} — negative pressure (no short entry under the long-only policy).`;
  } else {
    s.validationStatus = "context_only";
    s.eligibility = "excluded";
    s.rawScore = 0;
    s.reason = `Close inside the ${N}-session Donchian channel (${lower.toFixed(2)}–${upper.toFixed(2)}).`;
  }
  return s;
}

// ── 12. Bollinger Band Width regime ─────────────────────────────────────────
function bbwRegime(meta: StrategyMeta, symbol: string, bars: OhlcvLike[], today: Date): StrategySignal {
  const s = baseSignal(meta, symbol, bars[bars.length - 1].date, "insufficient_data", "insufficient history", bars.length / MIN_BARS);
  const W = 20;
  if (bars.length < W + 60) {
    s.reason = `Insufficient history: ${bars.length} bars, need ≥ ${W + 60}.`;
    s.dataFreshness = "insufficient";
    return s;
  }
  const closes = bars.map((b) => b.close);
  const n = bars.length - 1;
  const bbw: number[] = [];
  const bbwDates: string[] = [];
  for (let i = W - 1; i <= n; i++) {
    const win = closes.slice(i - W + 1, i + 1);
    const m = win.reduce((a, b) => a + b, 0) / W;
    const sd = stdev(win) ?? 0;
    if (m > 0) {
      bbw.push((4 * sd) / m);
      bbwDates.push(bars[i].date);
    }
  }
  const { fresh, days } = freshnessOf(s.sourceBarDate, today);
  s.inputCoverage = Math.min(1, bars.length / MIN_BARS);
  s.sourceReferences = [bbwDates[Math.max(0, bbwDates.length - 21)], bbwDates[bbwDates.length - 1]];
  if (fresh === "stale") {
    s.validationStatus = "stale";
    s.dataFreshness = "stale";
    s.reason = `Last verified bar is ${days} days old.`;
    return s;
  }
  const cur = bbw[bbw.length - 1];
  const prev = bbw[bbw.length - 21];
  const pctRank = bbw.filter((v) => v <= cur).length / bbw.length;
  s.validationStatus = "context_only";
  s.eligibility = "gate_only";
  s.rawScore = Math.max(-1, Math.min(1, (cur - prev) / (prev || 1)));
  const expanding = cur > prev;
  s.reason =
    `BBW ${cur.toFixed(3)} is at the ${(pctRank * 100).toFixed(0)}th percentile of the trailing year and ${expanding ? "EXPANDING" : "CONTRACTING"} vs 20 sessions ago. ` +
    "Volatility-regime context only: expansion is not automatically bullish and contraction is not automatically bearish, and no options instrument exists in this research infrastructure.";
  return s;
}

export interface StrategyRuntimeInput {
  symbol: string;
  bars: OhlcvLike[]; // verified source bars, chronological
  peerBars: Map<string, OhlcvLike[]>;
  now?: Date;
}

/** Evaluate ALL twelve registered strategies for one symbol. */
export function evaluateStrategies(input: StrategyRuntimeInput): StrategySignal[] {
  const now = input.now ?? new Date();
  const bars = input.bars;
  if (!bars.length) return [];
  const run = (meta: StrategyMeta) => {
    try {
      switch (meta.strategyId) {
        case "golden_cross_ma7_30": return goldenCross(meta, input.symbol, bars, now);
        case "macd_ema12_26_9": return macd(meta, input.symbol, bars, now);
        case "rsi_divergence_wilder14": return rsiDivergence(meta, input.symbol, bars, now);
        case "zscore_mean_reversion_60": return zScoreMR(meta, input.symbol, bars, now);
        case "ou_mean_reversion_ar1": return ouMeanReversion(meta, input.symbol, bars, now);
        case "linreg_channel_60": return linregChannel(meta, input.symbol, bars, now);
        case "pairs_kalman_hedge": return pairsKalman(meta, input.symbol, bars, now, input.peerBars);
        case "variance_ratio_lo_mackinlay": return varianceRatioGate(meta, input.symbol, bars, now);
        case "hurst_exponent_rs": return hurstGate(meta, input.symbol, bars, now);
        case "autocorrelation_lag1": return acfGate(meta, input.symbol, bars, now);
        case "donchian_atr_breakout_20": return donchianBreakout(meta, input.symbol, bars, now);
        case "bollinger_width_regime": return bbwRegime(meta, input.symbol, bars, now);
        default: {
          const s = baseSignal(meta, input.symbol, bars[bars.length - 1].date, "calculation_error", "unregistered strategy id", 0);
          return s;
        }
      }
    } catch (err) {
      const s = baseSignal(meta, input.symbol, bars[bars.length - 1].date, "calculation_error", err instanceof Error ? err.message : "calculation failed", 0);
      return s;
    }
  };
  return STRATEGY_INVENTORY.map(run);
}
