/**
 * Task 58 — Canonical progressive TP/SL state machine (SHARED HELPER).
 *
 * A PURE, direction-aware, chronological candle-by-candle TP/SL engine shared
 * by all three trade-simulation paths in the codebase:
 *   - src/lib/latent/investment-simulator.ts (genuine dated investment sim)
 *   - src/app/api/backtest/signal-stats/route.ts (current-signal replay)
 *   - src/lib/latent/backtest.ts (technical-rule strategy simulation)
 *
 * Behavior (canonical, established in Task 57):
 *   For each eligible candle AFTER entry (chronological order):
 *     1. Check the active SL FIRST. If SL is touched on this candle, exit at
 *        the realistic gap-aware stop-fill price (gap beyond SL → fill at the
 *        gap-open; else fill at SL). SL takes PRIORITY over any new TP on the
 *        SAME candle — do NOT award a new TP from a candle that already closed
 *        the trade at SL. Preserve the highest TP reached on earlier candles.
 *     2. If SL is not touched, check TP3 > TP2 > TP1 (descending — highest first).
 *        - TP3 is the FINAL target: if reached (and not already), CLOSE the
 *          position at TP3. Stop processing.
 *        - TP1 or TP2: UPGRADE bestTargetReached but do NOT close — continue
 *          scanning later candles.
 *     3. If multiple TPs are touched on one candle (without SL), award the
 *        highest legitimately reachable (TP3 if touched, else TP2, else TP1).
 *     4. If no SL and no TP3 by the end of the scan window: TIME_UP (unresolved),
 *        exit at the last candle's close, bestTargetReached preserved.
 *
 *   The active stop is FIXED = sl (no trailing stop invented).
 *   No partial-exit allocation or profit-locking behavior is invented.
 *
 * This helper does NOT compute costs (commission/slippage/CGT) — each caller
 * computes costs in its own units (PKR vs %). The helper only produces the
 * exit price + exit reason + best-target milestone + bar indices, so the
 * caller can compute realized gross/net P&L from the ACTUAL exit price.
 */
export interface TpSlBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TpSlInput {
  direction: "BUY" | "SELL";
  entryPrice: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  /** Bars AFTER entry, in chronological order (the scan window). */
  bars: TpSlBar[];
}

export type TpSlExitReason =
  | "TP3_HIT"
  | "SL_HIT"
  | "SL_AFTER_TP1"
  | "SL_AFTER_TP2"
  | "TIME_UP";

export interface TpSlResult {
  /** Index into the input `bars` array of the exit candle (0-based from scan start). -1 only if bars is empty. */
  exitBarIdx: number;
  /** Actual execution price (sl / tp3 / gap-open / last close — NOT the best-target price). */
  exitPrice: number;
  /** Canonical exit reason (distinguishes SL_AFTER_TP1/TP2 from plain SL_HIT). */
  exitReason: TpSlExitReason;
  /** Exit TYPE (backward-compat shorthand): TP3 for TP3 exit, SL for any SL exit, — for time-up. */
  hit: "TP3" | "SL" | "—";
  /** Highest TP touched during the trade (preserved even if later SL exits). "—" if no TP touched. */
  bestTargetReached: "TP3" | "TP2" | "TP1" | "—";
  /** Index into bars[] where TP1 was first reached, or -1. */
  tp1HitIdx: number;
  /** Index into bars[] where TP2 was first reached, or -1. */
  tp2HitIdx: number;
  /** Index into bars[] where TP3 was first reached, or -1. */
  tp3HitIdx: number;
  /** True if no SL/TP3 exit by scan-window end (TIME_UP). */
  unresolved: boolean;
  /** Number of candles examined after entry. */
  nBarsExamined: number;
  /** The currently-active stop level (FIXED = sl; no trailing stop invented). */
  activeStop: number;
}

/**
 * Run the canonical progressive TP/SL state machine on the given post-entry
 * bars. Returns a TpSlResult. If `bars` is empty, returns a TIME_UP result
 * with exitPrice = NaN (caller should handle — means no scan window).
 */
export function simulateProgressiveTpSl(input: TpSlInput): TpSlResult {
  const { direction, entryPrice, sl, tp1, tp2, tp3, bars } = input;
  const activeStop = sl; // FIXED — no trailing stop invented

  // Default: TIME_UP (resolved only if SL or TP3 is hit).
  let exitBarIdx = -1;
  let exitPrice = NaN;
  let exitReason: TpSlExitReason = "TIME_UP";
  let hit: "TP3" | "SL" | "—" = "—";
  let bestTargetReached = 0; // 0=none, 1=TP1, 2=TP2, 3=TP3
  let tp1HitIdx = -1, tp2HitIdx = -1, tp3HitIdx = -1;
  let nBarsExamined = 0;

  // Gap-aware stop-fill: if the candle opens beyond the SL (gap), fill at the
  // open (realistic — a gap beyond SL fills at the gap price, not the SL level).
  const stopFillFor = (bar: TpSlBar): number => {
    if (direction === "BUY") {
      // SL is below entry. Gap-down beyond SL → fill at open; else fill at SL.
      return bar.open < sl ? bar.open : sl;
    } else {
      // SL is above entry (short). Gap-up beyond SL → fill at open; else at SL.
      return bar.open > sl ? bar.open : sl;
    }
  };

  for (let i = 0; i < bars.length; i++) {
    nBarsExamined++;
    const b = bars[i];
    const slTouched = direction === "BUY" ? b.low <= sl : b.high >= sl;

    if (slTouched) {
      // SL FIRST: exit at the realistic stop-fill. Do NOT award a new TP from
      // this candle even if it also touched a new TP level (same-bar rule).
      exitBarIdx = i;
      exitPrice = stopFillFor(b);
      hit = "SL";
      exitReason = bestTargetReached === 0 ? "SL_HIT"
        : bestTargetReached === 1 ? "SL_AFTER_TP1"
        : "SL_AFTER_TP2"; // bestTargetReached===2; bestTargetReached===3 is impossible (TP3 closes)
      break;
    }

    // SL not touched — check TP3 > TP2 > TP1 (descending: highest first).
    const tp3Touched = direction === "BUY" ? b.high >= tp3 : b.low <= tp3;
    const tp2Touched = direction === "BUY" ? b.high >= tp2 : b.low <= tp2;
    const tp1Touched = direction === "BUY" ? b.high >= tp1 : b.low <= tp1;

    // TP3 is FINAL — if touched (and not already reached), close the trade.
    if (tp3Touched && bestTargetReached < 3) {
      bestTargetReached = 3;
      tp3HitIdx = i;
      exitBarIdx = i;
      exitPrice = tp3;
      hit = "TP3";
      exitReason = "TP3_HIT";
      break;
    }
    // TP2 — upgrade bestTargetReached (do NOT close; continue scanning).
    if (tp2Touched && bestTargetReached < 2) {
      bestTargetReached = 2;
      tp2HitIdx = i;
      continue;
    }
    // TP1 — upgrade bestTargetReached (do NOT close; continue scanning).
    if (tp1Touched && bestTargetReached < 1) {
      bestTargetReached = 1;
      tp1HitIdx = i;
      continue;
    }
  }

  // If we exited the loop without an SL/TP3 exit → TIME_UP (unresolved).
  if (exitBarIdx < 0) {
    if (bars.length > 0) {
      exitBarIdx = bars.length - 1;
      exitPrice = bars[bars.length - 1].close; // mark-to-market at last candle
    }
    exitReason = "TIME_UP";
    hit = "—";
  }

  const bestTargetStr: "TP3" | "TP2" | "TP1" | "—" =
    bestTargetReached === 3 ? "TP3"
    : bestTargetReached === 2 ? "TP2"
    : bestTargetReached === 1 ? "TP1"
    : "—";

  return {
    exitBarIdx,
    exitPrice,
    exitReason,
    hit,
    bestTargetReached: bestTargetStr,
    tp1HitIdx,
    tp2HitIdx,
    tp3HitIdx,
    unresolved: exitReason === "TIME_UP",
    nBarsExamined,
    activeStop,
  };
}

/**
 * Map a canonical TpSlResult.exitReason to the OLD backtest.ts exitReason values
 * ("TP3" | "TP2" | "TP1" | "SL" | "TIME" | "NO_DATA") for backward compatibility.
 * Existing API consumers that read `exitReason === "TP3"` etc. continue to work.
 * The full detail is preserved in the NEW `exitReasonDetailed` field.
 */
export function mapExitReasonToLegacy(r: TpSlResult): "TP3" | "TP2" | "TP1" | "SL" | "TIME" {
  switch (r.exitReason) {
    case "TP3_HIT": return "TP3";
    case "SL_HIT":
    case "SL_AFTER_TP1":
    case "SL_AFTER_TP2": return "SL";
    case "TIME_UP": return "TIME";
  }
}

/**
 * Map a canonical TpSlResult.bestTargetReached to the OLD backtest.ts `bestTp`
 * values ("TP3" | "TP2" | "TP1" | null) for backward compatibility.
 */
export function mapBestTargetToLegacy(r: TpSlResult): "TP3" | "TP2" | "TP1" | null {
  if (r.bestTargetReached === "—") return null;
  return r.bestTargetReached;
}
