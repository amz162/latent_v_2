/**
 * Task 75 — Pure, deterministic core for the historical ensemble simulator's
 * ranking, Backtest Score, and min-win-rate filter.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before Task 75 the ranking logic was inline in AiModelSignals.tsx and could
 * not be unit-tested. Worse, the old "Prediction" ranking option sent
 * `rankBy=winRate` to the API but then re-sorted the displayed results by the
 * streak counter (`predictScores`) — which did NOT represent the empirical
 * Backtest Score shown on the cards. Task 75 extracts the ranking/score/filter/
 * reconcile logic into pure functions that accept plain result objects (no
 * React, no fetch) so deterministic fixtures can prove the behaviour.
 *
 * WHAT IT GUARANTEES
 * ------------------
 *  - Backtest Score = empirical winRate / 100, derived ONLY from a result's
 *    completed trades. NOT a streak count. NOT a calibrated probability. NOT a
 *    function of how many times the user clicked Simulate.
 *  - Ranking sorts by the SELECTED empirical metric (winRate for winRate &
 *    backtestScore — they are monotonic transforms of the same win-rate; netPnL
 *    for netPnL). The streak counter is NEVER used for ranking.
 *  - The min-win-rate slider FILTERS by actual returned metrics: totalTrades > 0
 *    is required (zero-trade results never qualify, even at 0%); at 100% only
 *    results with observed winRate == 100% and >= 1 completed trade qualify.
 *  - "Showing X of Y" agrees with the visible filtered set.
 *  - Card metrics reconcile with the trade-by-trade drilldown (totalTrades =
 *    trades.length; winTrades = count(netPnl>0); netPnL = sum(netPnl)).
 *  - Repeated ranking/filtering of the same result set is idempotent — the
 *    empirical score and sample size never change on re-runs.
 *
 * This module contains NO signal generation, NO trade simulation, NO cost
 * tuning. It only consumes metrics + trades that the existing engine already
 * produced.
 */

export type RankBy = "winRate" | "netPnl" | "backtestScore";

/** The metrics shape consumed by ranking (subset of the engine output). */
export interface SimMetrics {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number; // percent (0..100)
  netPnL: number;
  startingCapital: number;
  finalValue: number;
  amountPerTrade: number;
}

/** A trade row in the drilldown (subset). */
export interface SimTrade {
  netPnl: number;
  isWin: boolean;
}

/** An ensemble result — what the /api/backtest/ensembles endpoint returns. */
export interface EnsResult {
  ensembleName: string;
  ensembleLabel: string;
  metrics: SimMetrics | null;
  trades: SimTrade[];
}

/**
 * Backtest Score = empirical winRate / 100.
 * Returns null (unavailable) when there are no completed trades.
 *
 * 100% win rate → 1.00; 75% → 0.75; 50% → 0.50.
 * This is a transformation of historical win rate. It is NOT a calibrated
 * probability of a future trade winning and does NOT establish statistical
 * significance.
 */
export function computeBacktestScore(
  metrics: { totalTrades: number; winRate: number } | null
): number | null {
  if (!metrics || metrics.totalTrades <= 0) return null;
  return metrics.winRate / 100;
}

/**
 * Sort ensembles by the SELECTED empirical metric — never by streak count.
 * winRate and backtestScore both sort by winRate (backtestScore = winRate/100
 * is monotonic); netPnl sorts by netPnL. Ensembles without metrics sink to the
 * bottom. Sort is stable on input order for equal keys.
 */
export function rankEnsembles(results: EnsResult[], rankBy: RankBy): EnsResult[] {
  return [...results].sort((a, b) => {
    if (!a.metrics && !b.metrics) return 0;
    if (!a.metrics) return 1;
    if (!b.metrics) return -1;
    if (rankBy === "netPnl") return b.metrics.netPnL - a.metrics.netPnL;
    // winRate & backtestScore → both by winRate (monotonic transform)
    return b.metrics.winRate - a.metrics.winRate;
  });
}

/**
 * Filter by minimum win rate (0..100 percent).
 * Requires totalTrades > 0 — zero-trade results NEVER qualify, even at 0%.
 * At 100%, only results with observed winRate >= 100 AND >= 1 completed trade.
 */
export function filterByWinRate(
  results: EnsResult[],
  minWinRatePct: number
): EnsResult[] {
  const threshold = Math.max(0, Math.min(100, minWinRatePct));
  return results.filter(
    (r) =>
      !!r.metrics &&
      r.metrics.totalTrades > 0 &&
      r.metrics.winRate >= threshold
  );
}

export interface RankAndFilterResult {
  /** Ranked (all, including no-metrics at the bottom). */
  ranked: EnsResult[];
  /** Filtered (ranked + min-win-rate applied, zero-trade excluded). */
  filtered: EnsResult[];
  /** Count of results shown (filtered length). */
  showingX: number;
  /** Count of results WITH metrics (the denominator for "of Y"). */
  totalY: number;
}

/**
 * Combined rank + filter. Returns the ranked list, the filtered (visible) list,
 * and the Showing X of Y counts. The counts always agree with the visible set.
 */
export function rankAndFilter(
  results: EnsResult[],
  rankBy: RankBy,
  minWinRatePct: number
): RankAndFilterResult {
  const ranked = rankEnsembles(results, rankBy);
  const filtered = filterByWinRate(ranked, minWinRatePct);
  return {
    ranked,
    filtered,
    showingX: filtered.length,
    totalY: results.filter((r) => !!r.metrics).length,
  };
}

/**
 * Reconcile a card's aggregate metrics against its trade-by-trade drilldown.
 * Verifies:
 *   totalTrades === trades.length
 *   winTrades === count(trades with netPnl > 0)
 *   lossTrades === count(trades with netPnl <= 0)
 *   netPnL === sum(trades.netPnl)   (within an absolute tolerance — the engine
 *                                    computes netPnL = grossBeforeCosts - totalCosts
 *                                    which equals the sum of per-trade net P&L;
 *                                    the tolerance absorbs float rounding only)
 *
 * Returns { ok, mismatches[] }.
 */
export function reconcileMetricsWithTrades(
  metrics: SimMetrics | null,
  trades: SimTrade[],
  tolerance = 0.01
): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (!metrics) {
    if (trades.length !== 0) mismatches.push("metrics null but trades non-empty");
    return { ok: mismatches.length === 0, mismatches };
  }
  if (metrics.totalTrades !== trades.length) {
    mismatches.push(
      `totalTrades ${metrics.totalTrades} !== trades.length ${trades.length}`
    );
  }
  const winsByTrades = trades.filter((t) => t.netPnl > 0).length;
  if (metrics.winTrades !== winsByTrades) {
    mismatches.push(`winTrades ${metrics.winTrades} !== ${winsByTrades} (by netPnl>0)`);
  }
  const lossesByTrades = trades.filter((t) => t.netPnl <= 0).length;
  if (metrics.lossTrades !== lossesByTrades) {
    mismatches.push(`lossTrades ${metrics.lossTrades} !== ${lossesByTrades}`);
  }
  const netPnlByTrades = trades.reduce((s, t) => s + t.netPnl, 0);
  if (Math.abs(metrics.netPnL - netPnlByTrades) > tolerance) {
    mismatches.push(`netPnL ${metrics.netPnL} !== sum(trades.netPnl) ${netPnlByTrades}`);
  }
  // winRate denominator = totalTrades (the engine uses trades.length).
  if (metrics.totalTrades > 0) {
    const winRateByTrades = (winsByTrades / metrics.totalTrades) * 100;
    if (Math.abs(metrics.winRate - winRateByTrades) > tolerance) {
      mismatches.push(
        `winRate ${metrics.winRate} !== ${winRateByTrades} (wins/totalTrades*100)`
      );
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * The requested trade count (numTrades, from the user input / API echo) is
 * DISTINCT from the actual executed count (totalTrades = trades.length). With
 * the engine's with-replacement sampling they are equal when signals exist,
 * but when an ensemble has no signals, totalTrades = 0 while numTrades > 0.
 * This helper returns both so the UI/test can assert they are reported
 * separately and never conflated.
 */
export function requestedVsActualTrades(
  requestedNumTrades: number,
  metrics: SimMetrics | null
): { requested: number; actual: number } {
  return {
    requested: requestedNumTrades,
    actual: metrics ? metrics.totalTrades : 0,
  };
}
