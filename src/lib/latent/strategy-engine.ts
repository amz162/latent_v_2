/**
 * Task 76 — Three-strategy exit-policy engine.
 *
 * A PURE, direction-aware, chronological candle-by-candle engine that runs
 * THREE distinctly-named exit strategies over the SAME eligible entry signal,
 * initial SL/TP levels, OHLCV bars, horizon and cost profile — so their exit
 * rules can be compared fairly.
 *
 *   1. fixed_first_hit       — Fixed TP/SL, first terminal hit closes 100%.
 *   2. max_tp_step_trailing  — SL steps up to TP1 then TP2 as each is reached;
 *                              TP3 closes the remainder; trailing SL never moves back.
 *   3. scale_out_50_25_25    — TP1 closes 50%, TP2 closes 25%, TP3 closes the
 *                              remaining 25%; initial SL covers the remainder.
 *
 * All three share: entry price, SL, TP1/TP2/TP3, bars, horizon, cost profile,
 * gap-aware fill logic, and the conservative same-candle SL-priority rule from
 * the canonical tp-sl-engine. The ONLY intentional difference is the exit /
 * position-management policy.
 *
 * Reuses src/lib/latent/trading-costs.ts (STANDARD_PSX / HIGH_SLIPPAGE_PSX) so
 * cost accounting is identical across strategies and consistent with the
 * existing walk-forward trading evaluator.
 *
 * Policy versioning: these strategies are NEW research variants introduced in
 * Task 76 — they were NOT part of the Task 71 predeclared policy. The policy
 * version + effective-start date are recorded with every result so reports stay
 * interpretable if the implementation changes later.
 *
 * Intrabar chronology (conservative — matches tp-sl-engine.ts):
 *   - If an active SL and one or more profit targets are both crossed within the
 *     same OHLC candle and exact intraday order cannot be established, the SL
 *     is prioritised. No optimistic TP fill from a same-candle SL collision.
 *   - A trailing-stop adjustment activated by a TP1/TP2 hit becomes effective
 *     from the NEXT candle (not the same candle).
 *   - Multiple profit targets crossed on the same candle without an SL
 *     collision are processed in ascending TP order (TP1 → TP2 → TP3) with
 *     gap-aware fills.
 *   - Fees/slippage/tax applied exactly once per actual exit quantity.
 */

import { computeTradeCosts, type CostProfile, STANDARD_PSX } from "./trading-costs";

// ─── Policy identity ─────────────────────────────────────────────────────────

export type StrategyId =
  | "fixed_first_hit"
  | "max_tp_step_trailing"
  | "scale_out_50_25_25";

/** Policy version — bump if the exit rules change so old reports stay interpretable. */
export const STRATEGY_POLICY_VERSION = "task76-v1";

/** Effective start date — Task 76 introduction (NOT retroactive to Task 71). */
export const STRATEGY_EFFECTIVE_START = "2026-10-30";

export const STRATEGIES: { id: StrategyId; label: string; description: string }[] = [
  {
    id: "fixed_first_hit",
    label: "Fixed TP/SL — First Hit",
    description:
      "Enter 100%. Close the entire position at the first terminal event: initial SL or TP3 (TP1/TP2 logged as milestones only, no partial close, no trailing). Horizon timeout closes at the observed horizon-end close.",
  },
  {
    id: "max_tp_step_trailing",
    label: "Max TP + Step-Trailing SL",
    description:
      "Enter 100% with original SL. After TP1 is reached, SL steps up to TP1 (effective next candle). After TP2, SL steps up to TP2 (effective next candle). TP3 closes the remainder. Trailing SL only moves favorably (never backward). If the trailing SL is hit before TP3, close the remainder at the gap-aware fill.",
  },
  {
    id: "scale_out_50_25_25",
    label: "Scale-Out 50/25/25",
    description:
      "Enter 100%. TP1 closes 50% of the initial quantity, TP2 closes a further 25%, TP3 closes the remaining 25%. Initial SL stays active for the remainder (no trailing). Each partial exit has its own fill, costs and realised P&L; the position is one trade with exit legs aggregated.",
  },
];

// ─── Input / output types ─────────────────────────────────────────────────────

export interface StrategyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface StrategySignal {
  symbol: string;
  direction: "BUY" | "SELL";
  /** Observed entry price (next-session open per portfolio-config entry_convention). */
  entryPrice: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  /** Integer share quantity (config.fractional_shares=false → whole shares). */
  quantity: number;
}

export interface TrailingStopStep {
  afterTarget: "TP1" | "TP2";
  newStop: number;
  /** Bar index (into the post-entry bars) from which the new stop is effective. */
  effectiveFromBarIdx: number;
}

export interface ExitLeg {
  exitDate: string;
  exitPrice: number;
  exitReason: string;
  /** Shares closed in this leg (integer). */
  quantity: number;
  grossPnl: number;
  commission: number;
  slippage: number;
  cgt: number;
  totalCost: number;
  netPnl: number;
}

export interface StrategyTradeResult {
  strategyId: StrategyId;
  policyVersion: string;
  symbol: string;
  direction: "BUY" | "SELL";
  entryDate: string;
  entryPrice: number;
  quantity: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  /** Final aggregate exit reason (e.g. SL, TP3, TRAILING_SL, SCALE_TP1_TP2_TP3, TIME_UP). */
  exitReason: string;
  /** Highest TP touched during the trade. */
  bestTargetReached: "TP3" | "TP2" | "TP1" | "—";
  /** Final active stop (for trailing — the last stepped stop; for others = sl). */
  activeStopFinal: number;
  trailingStopHistory: TrailingStopStep[];
  /** Exit legs — 1 for fixed/trailing (single exit); 1–3 for scale-out. */
  legs: ExitLeg[];
  // Aggregate (sum of legs)
  grossPnl: number;
  totalCost: number;
  netPnl: number;
  isWin: boolean;
  nBarsExamined: number;
  unresolved: boolean;
  /** Milestone counts (how many times each TP was reached — 0 or 1 per trade). */
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  slHits: number;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * SL touched on this bar? For BUY the SL is BELOW entry → touched when the bar
 * trades DOWN to/below the SL (bar.low <= sl). For SELL the SL is ABOVE entry →
 * touched when the bar trades UP to/above the SL (bar.high >= sl).
 * Matches the canonical tp-sl-engine.ts slTouched rule.
 */
function slTouched(
  bar: StrategyBar,
  sl: number,
  direction: "BUY" | "SELL"
): boolean {
  return direction === "BUY" ? bar.low <= sl : bar.high >= sl;
}

/**
 * TP touched on this bar? For BUY the TP is ABOVE entry → touched when the bar
 * trades UP to/above the TP (bar.high >= tp). For SELL the TP is BELOW entry →
 * touched when the bar trades DOWN to/below the TP (bar.low <= tp).
 * Matches the canonical tp-sl-engine.ts tp*Touched rule.
 */
function tpTouched(
  bar: StrategyBar,
  tp: number,
  direction: "BUY" | "SELL"
): boolean {
  return direction === "BUY" ? bar.high >= tp : bar.low <= tp;
}

/** Gap-aware stop-fill: if the bar opens beyond the SL, fill at the open; else at SL. */
function stopFill(bar: StrategyBar, sl: number, direction: "BUY" | "SELL"): number {
  if (direction === "BUY") return bar.open < sl ? bar.open : sl;
  return bar.open > sl ? bar.open : sl;
}

/** Per-leg cost accounting (costs applied once per actual exit quantity).
 *  grossPnl = quantity × signedPerSharePnl (sign handles BUY vs SELL).
 *  Entry notional = quantity × entryPrice (cost basis for commission/slippage).
 *  Passes quantity + sharePrice to computeTradeCosts so the PSX fixed minimum
 *  commission (PKR 0.03/share for price ≤ 20) is applied correctly. */
function legCostsSigned(
  quantity: number,
  entryNotional: number,
  signedPerSharePnl: number,
  profile: CostProfile
): Pick<ExitLeg, "grossPnl" | "commission" | "slippage" | "cgt" | "totalCost" | "netPnl"> {
  const grossPnl = quantity * signedPerSharePnl;
  const sharePrice = quantity > 0 ? entryNotional / quantity : 0;
  const c = computeTradeCosts(entryNotional, grossPnl, profile, quantity, sharePrice);
  return {
    grossPnl,
    commission: c.commission,
    slippage: c.slippage,
    cgt: c.cgt,
    totalCost: c.totalCost,
    netPnl: c.netPnl,
  };
}

// ─── Strategy 1: Fixed TP/SL — First Hit ──────────────────────────────────────

function simulateFixedFirstHit(
  signal: StrategySignal,
  bars: StrategyBar[],
  profile: CostProfile
): StrategyTradeResult {
  const { direction, entryPrice, sl, tp1, tp2, tp3, quantity, symbol } = signal;
  const sign = direction === "BUY" ? 1 : -1;
  let bestTarget = 0; // 0/1/2/3
  let tp1Hits = 0, tp2Hits = 0, tp3Hits = 0, slHits = 0;
  let exitReason = "TIME_UP";
  let exitPrice = bars.length ? bars[bars.length - 1].close : NaN;
  let exitBarIdx = bars.length - 1;
  let nBarsExamined = 0;

  for (let i = 0; i < bars.length; i++) {
    nBarsExamined++;
    const b = bars[i];
    // SL FIRST (same-bar priority)
    if (slTouched(b, sl, direction)) {
      exitPrice = stopFill(b, sl, direction);
      exitBarIdx = i;
      exitReason = bestTarget === 0 ? "SL" : bestTarget === 1 ? "SL_AFTER_TP1" : "SL_AFTER_TP2";
      slHits++;
      break;
    }
    // TP3 = terminal
    if (tpTouched(b, tp3, direction) && bestTarget < 3) {
      bestTarget = 3; tp3Hits++; exitPrice = tp3; exitBarIdx = i; exitReason = "TP3"; break;
    }
    if (tpTouched(b, tp2, direction) && bestTarget < 2) { bestTarget = 2; tp2Hits++; continue; }
    if (tpTouched(b, tp1, direction) && bestTarget < 1) { bestTarget = 1; tp1Hits++; continue; }
  }

  const exitDate = bars[exitBarIdx]?.date ?? "";
  const signedPerShare = sign * (exitPrice - entryPrice);
  const entryNotional = quantity * entryPrice;
  const legBody = legCostsSigned(quantity, entryNotional, signedPerShare, profile);
  const leg: ExitLeg = {
    exitDate, exitPrice, exitReason, quantity,
    ...legBody,
  };
  const grossPnl = legBody.grossPnl;
  const totalCost = legBody.totalCost;
  const netPnl = legBody.netPnl;
  return {
    strategyId: "fixed_first_hit",
    policyVersion: STRATEGY_POLICY_VERSION,
    symbol, direction,
    entryDate: bars[0]?.date ?? "", entryPrice, quantity, sl, tp1, tp2, tp3,
    exitReason,
    bestTargetReached: bestTarget === 3 ? "TP3" : bestTarget === 2 ? "TP2" : bestTarget === 1 ? "TP1" : "—",
    activeStopFinal: sl,
    trailingStopHistory: [],
    legs: [leg],
    grossPnl, totalCost, netPnl, isWin: netPnl > 0,
    nBarsExamined, unresolved: exitReason === "TIME_UP",
    tp1Hits, tp2Hits, tp3Hits, slHits,
  };
}

// ─── Strategy 2: Max TP + Step-Trailing SL ───────────────────────────────────

function simulateMaxTpStepTrailing(
  signal: StrategySignal,
  bars: StrategyBar[],
  profile: CostProfile
): StrategyTradeResult {
  const { direction, entryPrice, sl, tp1, tp2, tp3, quantity, symbol } = signal;
  const sign = direction === "BUY" ? 1 : -1;
  // Trailing stop only moves FAVORABLY. For BUY, stop increases (toward price).
  // For SELL, stop decreases. favorable(stop) = direction===BUY ? newStop>cur : newStop<cur.
  const moreProtective = (newStop: number, cur: number): boolean =>
    direction === "BUY" ? newStop > cur : newStop < cur;

  let activeStop = sl;
  const trailingStopHistory: TrailingStopStep[] = [];
  let bestTarget = 0;
  let tp1Hits = 0, tp2Hits = 0, tp3Hits = 0, slHits = 0;
  let exitReason = "TIME_UP";
  let exitPrice = bars.length ? bars[bars.length - 1].close : NaN;
  let exitBarIdx = bars.length - 1;
  let nBarsExamined = 0;

  for (let i = 0; i < bars.length; i++) {
    nBarsExamined++;
    const b = bars[i];
    // SL FIRST using the CURRENT active stop (which may have been stepped up
    // by a TP hit on a PREVIOUS candle — trailing stops activate next candle).
    if (slTouched(b, activeStop, direction)) {
      exitPrice = stopFill(b, activeStop, direction);
      exitBarIdx = i;
      exitReason =
        activeStop === sl ? "SL"
        : activeStop === tp1 ? "TRAILING_SL_AT_TP1"
        : activeStop === tp2 ? "TRAILING_SL_AT_TP2"
        : "TRAILING_SL";
      slHits++;
      break;
    }
    // TP3 = terminal close
    if (tpTouched(b, tp3, direction) && bestTarget < 3) {
      bestTarget = 3; tp3Hits++; exitPrice = tp3; exitBarIdx = i; exitReason = "TP3"; break;
    }
    // TP2 → step stop to tp2 (effective NEXT candle)
    if (tpTouched(b, tp2, direction) && bestTarget < 2) {
      bestTarget = 2; tp2Hits++;
      if (moreProtective(tp2, activeStop)) {
        trailingStopHistory.push({ afterTarget: "TP2", newStop: tp2, effectiveFromBarIdx: i + 1 });
        // The step is recorded but only applied from i+1; we set activeStop now
        // because the SL check at the top of the NEXT iteration uses it. If a
        // later candle (i+1) hits the new stop, that's valid (effective from i+1).
        // We do NOT allow the new stop to be hit on THIS candle (i).
        activeStop = tp2;
      }
      continue;
    }
    // TP1 → step stop to tp1 (effective NEXT candle)
    if (tpTouched(b, tp1, direction) && bestTarget < 1) {
      bestTarget = 1; tp1Hits++;
      if (moreProtective(tp1, activeStop)) {
        trailingStopHistory.push({ afterTarget: "TP1", newStop: tp1, effectiveFromBarIdx: i + 1 });
        activeStop = tp1;
      }
      continue;
    }
  }

  const exitDate = bars[exitBarIdx]?.date ?? "";
  const signedPerShare = sign * (exitPrice - entryPrice);
  const entryNotional = quantity * entryPrice;
  const legBody = legCostsSigned(quantity, entryNotional, signedPerShare, profile);
  const leg: ExitLeg = { exitDate, exitPrice, exitReason, quantity, ...legBody };
  return {
    strategyId: "max_tp_step_trailing",
    policyVersion: STRATEGY_POLICY_VERSION,
    symbol, direction,
    entryDate: bars[0]?.date ?? "", entryPrice, quantity, sl, tp1, tp2, tp3,
    exitReason,
    bestTargetReached: bestTarget === 3 ? "TP3" : bestTarget === 2 ? "TP2" : bestTarget === 1 ? "TP1" : "—",
    activeStopFinal: activeStop,
    trailingStopHistory,
    legs: [leg],
    grossPnl: legBody.grossPnl, totalCost: legBody.totalCost, netPnl: legBody.netPnl,
    isWin: legBody.netPnl > 0,
    nBarsExamined, unresolved: exitReason === "TIME_UP",
    tp1Hits, tp2Hits, tp3Hits, slHits,
  };
}

// ─── Strategy 3: Scale-Out 50/25/25 ──────────────────────────────────────────

/**
 * Deterministic integer split: q1 = floor(qty/2), q2 = floor(qty/4),
 * q3 = qty - q1 - q2. The three legs sum EXACTLY to qty. If qty < 2, q1=0 and
 * the split degrades gracefully (the TP1 leg is empty — recorded as zero
 * quantity, not fabricated). If qty < 4, q2 may be 0. The remainder always goes
 * to q3 so the sum is exact.
 */
export function splitQuantity502525(quantity: number): { q1: number; q2: number; q3: number } {
  const q1 = Math.floor(quantity / 2); // 50%
  const q2 = Math.floor(quantity / 4); // 25%
  const q3 = quantity - q1 - q2; // remainder (sums exactly to quantity)
  return { q1, q2, q3 };
}

function simulateScaleOut502525(
  signal: StrategySignal,
  bars: StrategyBar[],
  profile: CostProfile
): StrategyTradeResult {
  const { direction, entryPrice, sl, tp1, tp2, tp3, quantity, symbol } = signal;
  const sign = direction === "BUY" ? 1 : -1;
  const split = splitQuantity502525(quantity);
  // remaining quantity to close; which targets are still pending
  let remaining = quantity;
  let tp1Done = false, tp2Done = false, tp3Done = false;
  let bestTarget = 0;
  let tp1Hits = 0, tp2Hits = 0, tp3Hits = 0, slHits = 0;
  const legs: ExitLeg[] = [];
  let exitReason = "TIME_UP";
  let nBarsExamined = 0;
  let lastClose = bars.length ? bars[bars.length - 1].close : NaN;
  let lastDate = bars.length ? bars[bars.length - 1].date : "";

  const pushLeg = (date: string, price: number, reason: string, qty: number) => {
    if (qty <= 0) return; // no zero-quantity legs
    const signedPerShare = sign * (price - entryPrice);
    const entryNotional = qty * entryPrice;
    const body = legCostsSigned(qty, entryNotional, signedPerShare, profile);
    legs.push({ exitDate: date, exitPrice: price, exitReason: reason, quantity: qty, ...body });
  };

  for (let i = 0; i < bars.length; i++) {
    nBarsExamined++;
    const b = bars[i];
    lastClose = b.close; lastDate = b.date;
    // SL FIRST — closes the ENTIRE remaining position (initial SL, no trailing)
    if (slTouched(b, sl, direction)) {
      const fill = stopFill(b, sl, direction);
      pushLeg(b.date, fill, "SL_REMAINDER", remaining);
      slHits++;
      remaining = 0;
      exitReason = legs.length > 1 ? "SL_AFTER_PARTIALS" : "SL";
      break;
    }
    // TP1 → close 50% (q1)
    if (!tp1Done && tpTouched(b, tp1, direction)) {
      tp1Done = true; tp1Hits++; bestTarget = Math.max(bestTarget, 1);
      pushLeg(b.date, tp1, "TP1_PARTIAL", split.q1);
      remaining -= split.q1;
      // continue scanning same candle for TP2/TP3 (ascending order, no SL collision)
    }
    // TP2 → close 25% (q2)
    if (!tp2Done && tpTouched(b, tp2, direction)) {
      tp2Done = true; tp2Hits++; bestTarget = Math.max(bestTarget, 2);
      pushLeg(b.date, tp2, "TP2_PARTIAL", split.q2);
      remaining -= split.q2;
    }
    // TP3 → close remaining
    if (!tp3Done && tpTouched(b, tp3, direction)) {
      tp3Done = true; tp3Hits++; bestTarget = 3;
      pushLeg(b.date, tp3, "TP3_REMAINDER", remaining);
      remaining = 0;
      exitReason = "SCALE_TP1_TP2_TP3";
      break;
    }
    if (remaining <= 0) break;
  }

  // TIME_UP — close remaining at the last observed close
  if (remaining > 0) {
    pushLeg(lastDate, lastClose, "TIME_UP_REMAINDER", remaining);
    exitReason = legs.length > 1 ? "TIME_UP_AFTER_PARTIALS" : "TIME_UP";
    remaining = 0;
  }

  const grossPnl = legs.reduce((s, l) => s + l.grossPnl, 0);
  const totalCost = legs.reduce((s, l) => s + l.totalCost, 0);
  const netPnl = legs.reduce((s, l) => s + l.netPnl, 0);

  return {
    strategyId: "scale_out_50_25_25",
    policyVersion: STRATEGY_POLICY_VERSION,
    symbol, direction,
    entryDate: bars[0]?.date ?? "", entryPrice, quantity, sl, tp1, tp2, tp3,
    exitReason,
    bestTargetReached: bestTarget === 3 ? "TP3" : bestTarget === 2 ? "TP2" : bestTarget === 1 ? "TP1" : "—",
    activeStopFinal: sl,
    trailingStopHistory: [],
    legs,
    grossPnl, totalCost, netPnl, isWin: netPnl > 0,
    nBarsExamined, unresolved: exitReason.startsWith("TIME_UP"),
    tp1Hits, tp2Hits, tp3Hits, slHits,
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Run ONE strategy over a signal + post-entry bars. Pure + deterministic.
 * @param strategyId  Which exit policy to run.
 * @param signal      Entry + SL/TP1/TP2/TP3 + quantity (shared across strategies).
 * @param bars        Post-entry OHLCV bars (chronological). Entry bar NOT included.
 * @param profile     Cost profile (STANDARD_PSX default). Shared across strategies.
 */
export function simulateStrategy(
  strategyId: StrategyId,
  signal: StrategySignal,
  bars: StrategyBar[],
  profile: CostProfile = STANDARD_PSX
): StrategyTradeResult {
  if (!bars.length) {
    // No scan window — return an unavailable result (no fabricated fill).
    return {
      strategyId, policyVersion: STRATEGY_POLICY_VERSION,
      symbol: signal.symbol, direction: signal.direction,
      entryDate: "", entryPrice: signal.entryPrice, quantity: signal.quantity,
      sl: signal.sl, tp1: signal.tp1, tp2: signal.tp2, tp3: signal.tp3,
      exitReason: "NO_BARS", bestTargetReached: "—", activeStopFinal: signal.sl,
      trailingStopHistory: [], legs: [],
      grossPnl: 0, totalCost: 0, netPnl: 0, isWin: false,
      nBarsExamined: 0, unresolved: true,
      tp1Hits: 0, tp2Hits: 0, tp3Hits: 0, slHits: 0,
    };
  }
  switch (strategyId) {
    case "fixed_first_hit": return simulateFixedFirstHit(signal, bars, profile);
    case "max_tp_step_trailing": return simulateMaxTpStepTrailing(signal, bars, profile);
    case "scale_out_50_25_25": return simulateScaleOut502525(signal, bars, profile);
  }
}

/**
 * Run ALL THREE strategies over the SAME signal + bars + profile for a paired
 * trade-level comparison. Returns one result per strategy. The shared inputs
 * (entry, SL/TP, bars, costs, horizon) are identical; only the exit policy differs.
 */
export function simulateAllStrategies(
  signal: StrategySignal,
  bars: StrategyBar[],
  profile: CostProfile = STANDARD_PSX
): Record<StrategyId, StrategyTradeResult> {
  return {
    fixed_first_hit: simulateStrategy("fixed_first_hit", signal, bars, profile),
    max_tp_step_trailing: simulateStrategy("max_tp_step_trailing", signal, bars, profile),
    scale_out_50_25_25: simulateStrategy("scale_out_50_25_25", signal, bars, profile),
  };
}

/**
 * Aggregate a list of per-strategy trade results into summary metrics for the UI.
 * A scale-out trade counts as ONE completed position (its legs are aggregated),
 * NOT three separate trades.
 */
export interface StrategySummary {
  strategyId: StrategyId;
  policyVersion: string;
  nTrades: number; // completed positions (1 per signal, NOT per leg)
  nWinning: number;
  nLosing: number;
  winRate: number | null; // percent; null if nTrades===0
  grossPnl: number;
  totalCosts: number;
  netPnl: number;
  avgNetPerTrade: number | null;
  profitFactor: number | null; // grossProfit/grossLoss; null if grossLoss===0
  tp1Hits: number;
  tp2Hits: number;
  tp3Hits: number;
  slHits: number;
  trailingSlHits: number;
  timeoutExits: number;
  partialExits: number; // total partial legs across scale-out trades
  nUnresolved: number;
}

export function summarizeStrategy(results: StrategyTradeResult[]): StrategySummary {
  const id = results.length ? results[0].strategyId : "fixed_first_hit";
  const nTrades = results.length;
  const nWinning = results.filter((r) => r.isWin).length;
  const nLosing = nTrades - nWinning;
  const grossPnl = results.reduce((s, r) => s + r.grossPnl, 0);
  const grossProfit = results.reduce((s, r) => s + Math.max(0, r.grossPnl), 0);
  const grossLoss = results.reduce((s, r) => s + Math.max(0, -r.grossPnl), 0);
  const totalCosts = results.reduce((s, r) => s + r.totalCost, 0);
  const netPnl = results.reduce((s, r) => s + r.netPnl, 0);
  const partialExits = results.reduce((s, r) => s + r.legs.length, 0);
  const trailingSlHits = results.filter((r) =>
    r.exitReason.startsWith("TRAILING_SL")
  ).length;
  const timeoutExits = results.filter((r) => r.unresolved).length;
  return {
    strategyId: id,
    policyVersion: STRATEGY_POLICY_VERSION,
    nTrades,
    nWinning,
    nLosing,
    winRate: nTrades > 0 ? (nWinning / nTrades) * 100 : null,
    grossPnl,
    totalCosts,
    netPnl,
    avgNetPerTrade: nTrades > 0 ? netPnl / nTrades : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : null,
    tp1Hits: results.reduce((s, r) => s + r.tp1Hits, 0),
    tp2Hits: results.reduce((s, r) => s + r.tp2Hits, 0),
    tp3Hits: results.reduce((s, r) => s + r.tp3Hits, 0),
    slHits: results.reduce((s, r) => s + r.slHits, 0),
    trailingSlHits,
    timeoutExits,
    partialExits,
    nUnresolved: results.filter((r) => r.unresolved).length,
  };
}
