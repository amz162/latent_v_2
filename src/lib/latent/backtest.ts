/**
 * backtest.ts — trade-by-trade simulation engine for the Latent.pk backtest.
 *
 * Issue 1 (AI Models Portfolio Simulation) spec:
 *  - BUY signals only (no SELL) — caller filters.
 *  - EXACTLY numTrades trades per ensemble (not less, not more). If the ensemble
 *    has fewer BUY signals, sample WITH REPLACEMENT to reach numTrades.
 *  - TP rule: check TP3 first, then TP2, then TP1. Hold for TP3 (the max target)
 *    or SL or time-up. Best TP = the highest TP reached before exit.
 *    • price >= tp3 → Best TP = TP3 (exit at TP3, win)
 *    • tp2 <= price < tp3 → Best TP = TP2 (label only; keep holding for TP3)
 *    • tp1 <= price < tp2 → Best TP = TP1 (label only)
 *    • SL hit (price <= sl) before TP3 → exit at SL (loss); Best TP = highest reached
 *    • else time-up → exit at last close; Best TP = highest reached
 *  - Per-trade: #, Symbol, Signal, Entry, Close, SL, Best TP, TP1, TP2, TP3,
 *    Invested, Result (✓W/✗L), P&L, Portfolio (running equity).
 *  - Per-ensemble metrics: Starting Capital, Amount Per Trade, Total Trades
 *    (BUY only) + natural count, Days (+trades/day), Win Rate, Win/Loss,
 *    Avg Win %, Avg Loss %, Gross Profit, Gross Loss, Total Costs (50bps+CGT),
 *    Gross Before Costs, Net P&L, Final Portfolio Value, ROI, Max Drawdown
 *    (PKR + %), Profit Factor, Sharpe/Sortino. All currency in PKR.
 *
 * Used by issue 1 (ensembles — each ensemble's OWN signals) and issue 2
 * (investment-simulator — final-consensus signals, BUY+SELL).
 */

import { db } from "@/lib/db";

export interface BacktestTrade {
  symbol: string;
  direction: "BUY" | "SELL";
  entryDate: string;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  exitReason: "TP3" | "TP2" | "TP1" | "SL" | "TIME" | "NO_DATA";
  bestTp: "TP3" | "TP2" | "TP1" | null; // highest TP reached (TP3>TP2>TP1), per the rule
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  holdingDays: number;
  grossPnlPct: number;
  netPnlPkr: number;
  costPkr: number;
  invested: number;   // amountPerTrade
  portfolio: number;  // running equity after this trade
  confidence: number; // the ensemble's confidence for this signal (0-100)
}

export interface BacktestMetrics {
  startingCapital: number;
  amountPerTrade: number;
  totalTrades: number;
  naturalBuyCount: number; // BUY signals available (before sampling to numTrades)
  numDays: number;
  tradesPerDay: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  grossProfit: number;
  grossLoss: number;
  totalCosts: number;
  grossBeforeCosts: number;
  netPnl: number;
  finalPortfolioValue: number;
  roi: number;
  maxDrawdownPct: number;
  maxDrawdownPkr: number;
  profitFactor: number;
  sharpe: number;
  sortino: number;
  monthlySip: number;
  periodUnit: string;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  equityCurve: { trade: number; equity: number }[];
  generatedAt: string;
}

export interface BacktestInput {
  startingCapital: number;
  amountPerTrade: number;
  numTrades: number;
  numDays: number;
  monthlySip?: number;
  periodUnit?: "day" | "month" | "year";
  naturalCount?: number; // caller-supplied natural signal count (for display)
  signals: Array<{
    symbol: string;
    signal: "BUY" | "SELL";
    confidence: number;
    entry?: number;
    sl?: number;
    tp1?: number;
    tp2?: number;
    tp3?: number;
  }>;
}

const COMMISSION_RATE = 0.0015;
const SLIPPAGE_RATE = 0.005;
const CGT_RATE = 0.15;

function atr(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) {
    const ranges = highs.map((h, i) => h - lows[i]).filter((x) => x >= 0);
    return ranges.length ? ranges.reduce((s, v) => s + v, 0) / ranges.length : 0;
  }
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function simulateOne(
  symbol: string,
  direction: "BUY" | "SELL",
  bars: { date: string; open: number; high: number; low: number; close: number }[],
  _startIdx: number,
  numDays: number,
  levels?: { entry?: number; sl?: number; tp1?: number; tp2?: number; tp3?: number; confidence?: number }
): BacktestTrade | null {
  if (bars.length < numDays + 5) return null;

  // METHODOLOGY (Issue 6 fix): the signal's entry/SL/TP are ABSOLUTE levels
  // (relative to the price at signal generation). To test them meaningfully,
  // we find a historical bar where close ≈ the signal's entry level (a real
  // moment price was at that level) and walk forward from THERE with the
  // ensemble's absolute SL/TP. This is why the prior version showed ~36%
  // (random entry bar + absolute levels = levels never reached). Now the
  // entry matches the price path, so SL/TP are meaningful.
  const entry = levels?.entry && levels.entry > 0 ? levels.entry : null;
  let entryIdx: number;
  let entryPrice: number;
  let sl: number, tp1: number, tp2: number, tp3: number;

  if (entry) {
    const band = entry * 0.015; // ±1.5% of the signal's entry level
    const candidates: number[] = [];
    for (let i = 2; i < bars.length - numDays - 2; i++) {
      if (Math.abs(bars[i].close - entry) <= band) candidates.push(i);
    }
    if (candidates.length === 0) {
      // Pattern #2 (per user): fall back to a random bar + re-derive SL/TP from
      // the ensemble's RELATIVE distances (sl_dist = |entry−sl|, tp_dist) applied
      // to that bar's close — so a BUY ensemble with no real entry bar (price
      // never visited the signal's level) STILL takes trades. Each BUY ensemble
      // runs exactly numTrades trades on the selected stock.
      const maxStart = bars.length - numDays - 2;
      if (maxStart < 2) return null;
      entryIdx = 2 + Math.floor(Math.random() * (maxStart - 1));
      entryPrice = bars[entryIdx].close;
      const atrSliceF = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
      const atrValF = atr(atrSliceF.map((b) => b.high), atrSliceF.map((b) => b.low), atrSliceF.map((b) => b.close)) || entryPrice * 0.02;
      const slDist = levels.sl && levels.sl > 0 ? Math.abs(entry - levels.sl) : atrValF * 1.5;
      const tp1Dist = levels.tp1 && levels.tp1 > 0 ? Math.abs(levels.tp1 - entry) : atrValF;
      const tp2Dist = levels.tp2 && levels.tp2 > 0 ? Math.abs(levels.tp2 - entry) : 2 * atrValF;
      const tp3Dist = levels.tp3 && levels.tp3 > 0 ? Math.abs(levels.tp3 - entry) : 3 * atrValF;
      sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
      tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
      tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
      tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;
    } else {
      entryIdx = candidates[Math.floor(Math.random() * candidates.length)];
      entryPrice = entry;
      // ATR at entry (only used to fill any missing SL/TP)
      const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
      const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entry * 0.02;
      const r = atrVal * 1.5;
      sl = levels.sl && levels.sl > 0 ? levels.sl : (direction === "BUY" ? entry - r : entry + r);
      tp1 = levels.tp1 && levels.tp1 > 0 ? levels.tp1 : (direction === "BUY" ? entry + 1 * atrVal : entry - 1 * atrVal);
      tp2 = levels.tp2 && levels.tp2 > 0 ? levels.tp2 : (direction === "BUY" ? entry + 2 * atrVal : entry - 2 * atrVal);
      tp3 = levels.tp3 && levels.tp3 > 0 ? levels.tp3 : (direction === "BUY" ? entry + 3 * atrVal : entry - 3 * atrVal);
    }
  } else {
    // No entry level provided — random start + ATR-derived levels (fallback)
    const maxStart = bars.length - numDays - 2;
    if (maxStart < 2) return null;
    entryIdx = 2 + Math.floor(Math.random() * (maxStart - 1));
    entryPrice = bars[entryIdx].close;
    const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
    const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entryPrice * 0.02;
    const r = atrVal * 1.5;
    sl = direction === "BUY" ? entryPrice - r : entryPrice + r;
    tp1 = direction === "BUY" ? entryPrice + 1 * atrVal : entryPrice - 1 * atrVal;
    tp2 = direction === "BUY" ? entryPrice + 2 * atrVal : entryPrice - 2 * atrVal;
    tp3 = direction === "BUY" ? entryPrice + 3 * atrVal : entryPrice - 3 * atrVal;
  }

  const entryBar = bars[entryIdx];
  const end = Math.min(bars.length - 1, entryIdx + numDays);
  // TP rule (check TP3 → TP2 → TP1): scan the hold window. Exit at TP3 (best)
  // if reached; else SL if hit; else time-up. Best TP = highest reached up to exit.
  let tp3Idx = -1, tp2Idx = -1, tp1Idx = -1, slIdx = -1;
  for (let i = entryIdx + 1; i <= end; i++) {
    const b = bars[i];
    if (direction === "BUY") {
      if (tp3Idx < 0 && b.high >= tp3) tp3Idx = i;
      if (tp2Idx < 0 && b.high >= tp2) tp2Idx = i;
      if (tp1Idx < 0 && b.high >= tp1) tp1Idx = i;
      if (slIdx < 0 && b.low <= sl) slIdx = i;
    } else {
      if (tp3Idx < 0 && b.low <= tp3) tp3Idx = i;
      if (tp2Idx < 0 && b.low <= tp2) tp2Idx = i;
      if (tp1Idx < 0 && b.low <= tp1) tp1Idx = i;
      if (slIdx < 0 && b.high >= sl) slIdx = i;
    }
  }

  // TP rule (Issue 2): check TP3 → TP2 → TP1 → SL → time. Exit at the HIGHEST
  // TP reached (TP3 if any bar hit it, else TP2, else TP1), at the first bar
  // where that TP was hit. If NO TP reached, exit at SL (if hit); else time-up.
  // "If price goes down (SL touched) then price goes up again → re-apply the TP
  // rule" → a TP reached at ANY point takes precedence over an SL touch
  // (checked in priority order TP3 > TP2 > TP1 before SL).
  let exitIdx: number, exitPrice: number, exitReason: BacktestTrade["exitReason"];
  if (tp3Idx >= 0) { exitIdx = tp3Idx; exitPrice = tp3; exitReason = "TP3"; }
  else if (tp2Idx >= 0) { exitIdx = tp2Idx; exitPrice = tp2; exitReason = "TP2"; }
  else if (tp1Idx >= 0) { exitIdx = tp1Idx; exitPrice = tp1; exitReason = "TP1"; }
  else if (slIdx >= 0) { exitIdx = slIdx; exitPrice = sl; exitReason = "SL"; }
  else { exitIdx = end; exitPrice = bars[end].close; exitReason = "TIME"; }

  // Best TP = the exit TP (for TP exits) or the highest TP reached up to the
  // SL/time exit bar (label only); null if no TP was ever reached.
  let bestTp: BacktestTrade["bestTp"] = null;
  if (exitReason === "TP3" || exitReason === "TP2" || exitReason === "TP1") {
    bestTp = exitReason;
  } else {
    if (tp3Idx >= 0 && tp3Idx <= exitIdx) bestTp = "TP3";
    else if (tp2Idx >= 0 && tp2Idx <= exitIdx) bestTp = "TP2";
    else if (tp1Idx >= 0 && tp1Idx <= exitIdx) bestTp = "TP1";
  }

  const exitDate = bars[exitIdx].date;
  const holdingDays = Math.max(1, Math.round((Date.parse(exitDate) - Date.parse(entryBar.date)) / 86400000));
  const grossPnlPct =
    direction === "BUY"
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;

  return {
    symbol, direction,
    entryDate: entryBar.date, entryPrice,
    exitDate, exitPrice, exitReason, bestTp,
    sl, tp1, tp2, tp3, holdingDays,
    grossPnlPct,
    netPnlPkr: 0, costPkr: 0, invested: 0, portfolio: 0, confidence: levels?.confidence ?? 0,
  };
}

function aggregate(
  trades: BacktestTrade[],
  startingCapital: number,
  amountPerTrade: number,
  numDays: number,
  monthlySip: number,
  periodUnit: string,
  sipTotal: number,
  naturalBuyCount: number
): BacktestMetrics {
  let equity = startingCapital + sipTotal;
  let peak = equity;
  let grossProfit = 0, grossLoss = 0, wins = 0, losses = 0, totalCosts = 0;
  const winAmounts: number[] = [], lossAmounts: number[] = [], retSeries: number[] = [];
  let maxDdPkr = 0;

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const grossPnl = (t.grossPnlPct / 100) * amountPerTrade;
    const commission = amountPerTrade * COMMISSION_RATE * 2;
    const slippage = amountPerTrade * SLIPPAGE_RATE;
    const cgt = grossPnl > 0 ? grossPnl * CGT_RATE : 0;
    const cost = commission + slippage + cgt;
    const netPnl = grossPnl - cost;
    t.costPkr = cost;
    t.netPnlPkr = netPnl;
    t.invested = amountPerTrade;
    equity += netPnl;
    t.portfolio = equity;
    if (equity > peak) peak = equity;
    const ddPkr = peak - equity;
    if (ddPkr > maxDdPkr) maxDdPkr = ddPkr;
    // Win/loss by NET P&L (consistent with isWin) — fixes the glitch where a
    // trade with a tiny gross gain but net loss (after costs) was counted as a
    // win in winRate but shown as a loss in the trade-by-trade view.
    if (netPnl > 0) { wins++; winAmounts.push(netPnl); }
    else { losses++; lossAmounts.push(netPnl); }
    // Gross profit/loss still use the GROSS P&L (before costs).
    if (grossPnl > 0) grossProfit += grossPnl;
    else grossLoss += Math.abs(grossPnl);
    totalCosts += cost;
    retSeries.push(netPnl / amountPerTrade);
  }

  const grossBeforeCosts = grossProfit - grossLoss;
  const netPnl = grossBeforeCosts - totalCosts;
  const finalPortfolioValue = startingCapital + sipTotal + netPnl;
  const roi = startingCapital > 0 ? (netPnl / startingCapital) * 100 : 0;
  // Max drawdown % (relative to peak)
  let maxDdPct = 0;
  let p2 = startingCapital + sipTotal;
  let runEquity = p2;
  for (const t of trades) {
    runEquity += t.netPnlPkr;
    if (runEquity > p2) p2 = runEquity;
    const dd = p2 > 0 ? ((p2 - runEquity) / p2) * 100 : 0;
    if (dd > maxDdPct) maxDdPct = dd;
  }
  const avgWin = winAmounts.length ? winAmounts.reduce((s, v) => s + v, 0) / winAmounts.length : 0;
  const avgLoss = lossAmounts.length ? lossAmounts.reduce((s, v) => s + v, 0) / lossAmounts.length : 0;
  const mean = retSeries.length ? retSeries.reduce((s, v) => s + v, 0) / retSeries.length : 0;
  const std = retSeries.length > 1 ? Math.sqrt(retSeries.reduce((s, v) => s + (v - mean) ** 2, 0) / (retSeries.length - 1)) : 0;
  const downside = retSeries.filter((v) => v < 0);
  const dstd = downside.length > 1 ? Math.sqrt(downside.reduce((s, v) => s + v * v, 0) / downside.length) : 0;

  return {
    startingCapital, amountPerTrade,
    totalTrades: trades.length,
    naturalBuyCount,
    numDays,
    tradesPerDay: numDays > 0 ? Math.round(trades.length / numDays) : trades.length,
    winTrades: wins, lossTrades: losses,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
    avgWinPct: amountPerTrade > 0 ? (avgWin / amountPerTrade) * 100 : 0,
    avgLossPct: amountPerTrade > 0 ? (avgLoss / amountPerTrade) * 100 : 0,
    grossProfit, grossLoss, totalCosts, grossBeforeCosts, netPnl,
    finalPortfolioValue, roi,
    maxDrawdownPct: maxDdPct,
    maxDrawdownPkr: maxDdPkr,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0),
    sharpe: std > 0 ? (mean / std) * Math.sqrt(252) : 0,
    sortino: dstd > 0 ? (mean / dstd) * Math.sqrt(252) : 0,
    monthlySip, periodUnit,
  };
}

// Single-stock window trade: enter at a given bar within a numDays-day window
// [W, W+numDays], use the signal's RELATIVE distances (sl_dist, tp_dist) applied
// to that bar's close (#2 pattern), hold until TP3/TP2/TP1/SL or the window end.
// This matches the user's reinterpretation: numDays = the period over which
// numTrades trades are taken (e.g. 10 trades in 5 days), NOT the per-trade hold.
function simulateWindowTrade(
  symbol: string,
  direction: "BUY" | "SELL",
  bars: { date: string; open: number; high: number; low: number; close: number }[],
  entryIdx: number,
  windowEndIdx: number,
  levels?: { entry?: number; sl?: number; tp1?: number; tp2?: number; tp3?: number; confidence?: number }
): BacktestTrade | null {
  if (entryIdx < 0 || entryIdx >= bars.length || windowEndIdx >= bars.length) return null;
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.close; // #2 pattern: enter at the bar's close
  const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
  const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entryPrice * 0.02;
  const sigEntry = levels.entry && levels.entry > 0 ? levels.entry : entryPrice;
  const slDist = levels.sl && levels.sl > 0 ? Math.abs(sigEntry - levels.sl) : atrVal * 1.5;
  const tp1Dist = levels.tp1 && levels.tp1 > 0 ? Math.abs(levels.tp1 - sigEntry) : atrVal;
  const tp2Dist = levels.tp2 && levels.tp2 > 0 ? Math.abs(levels.tp2 - sigEntry) : 2 * atrVal;
  const tp3Dist = levels.tp3 && levels.tp3 > 0 ? Math.abs(levels.tp3 - sigEntry) : 3 * atrVal;
  const sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
  const tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
  const tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
  const tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;

  const end = Math.min(bars.length - 1, windowEndIdx);
  let tp3Idx = -1, tp2Idx = -1, tp1Idx = -1, slIdx = -1;
  for (let i = entryIdx + 1; i <= end; i++) {
    const b = bars[i];
    if (direction === "BUY") {
      if (tp3Idx < 0 && b.high >= tp3) tp3Idx = i;
      if (tp2Idx < 0 && b.high >= tp2) tp2Idx = i;
      if (tp1Idx < 0 && b.high >= tp1) tp1Idx = i;
      if (slIdx < 0 && b.low <= sl) slIdx = i;
    } else {
      if (tp3Idx < 0 && b.low <= tp3) tp3Idx = i;
      if (tp2Idx < 0 && b.low <= tp2) tp2Idx = i;
      if (tp1Idx < 0 && b.low <= tp1) tp1Idx = i;
      if (slIdx < 0 && b.high >= sl) slIdx = i;
    }
  }
  let exitIdx: number, exitPrice: number, exitReason: BacktestTrade["exitReason"];
  if (tp3Idx >= 0) { exitIdx = tp3Idx; exitPrice = tp3; exitReason = "TP3"; }
  else if (tp2Idx >= 0) { exitIdx = tp2Idx; exitPrice = tp2; exitReason = "TP2"; }
  else if (tp1Idx >= 0) { exitIdx = tp1Idx; exitPrice = tp1; exitReason = "TP1"; }
  else if (slIdx >= 0) { exitIdx = slIdx; exitPrice = sl; exitReason = "SL"; }
  else { exitIdx = end; exitPrice = bars[end].close; exitReason = "TIME"; }
  let bestTp: BacktestTrade["bestTp"] = null;
  if (["TP3", "TP2", "TP1"].includes(exitReason)) bestTp = exitReason as any;
  else {
    if (tp3Idx >= 0 && tp3Idx <= exitIdx) bestTp = "TP3";
    else if (tp2Idx >= 0 && tp2Idx <= exitIdx) bestTp = "TP2";
    else if (tp1Idx >= 0 && tp1Idx <= exitIdx) bestTp = "TP1";
  }
  const exitDate = bars[exitIdx].date;
  const holdingDays = Math.max(1, Math.round((Date.parse(exitDate) - Date.parse(entryBar.date)) / 86400000));
  const grossPnlPct =
    direction === "BUY"
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;
  return {
    symbol, direction, entryDate: entryBar.date, entryPrice,
    exitDate, exitPrice, exitReason, bestTp,
    sl, tp1, tp2, tp3, holdingDays, grossPnlPct,
    netPnlPkr: 0, costPkr: 0, invested: 0, portfolio: 0, confidence: levels?.confidence ?? 0,
  };
}

/**
 * Run the backtest.
 * - Single-stock mode (all signals same symbol): numDays = the WINDOW over which
 *   numTrades trades are taken (e.g. 10 trades in 5 days). Each trade enters at a
 *   random bar within the window (#2 pattern) + holds until TP/SL or window-end.
 * - ALL-stocks mode: each of numTrades signals → 1 trade (find-entry-bar + #2
 *   fallback), held numDays. EXACTLY numTrades (with replacement if fewer).
 */
export async function runBacktest(input: BacktestInput): Promise<BacktestResult> {
  const { startingCapital, amountPerTrade, numTrades, numDays, signals, monthlySip = 0, periodUnit = "day", naturalCount } = input;
  const naturalBuyCount = naturalCount ?? signals.length;
  const trades: BacktestTrade[] = [];

  const singleStock = signals.length > 0 && signals.every((s) => s.symbol === signals[0].symbol);

  if (singleStock) {
    // ── Single-stock REAL-history mode ──
    // numDays > 0 → window = the LAST numDays real bars (= [today − numDays, today],
    //   e.g. 5 days → 18–23 Oct). numTrades trades at REAL bars within this window.
    // numDays == 0 (optional, not given) → pick any start day, scan to the latest bar.
    // Each trade enters at the bar's REAL close + uses the ensemble's SL/TP
    // distances (re-derived), holds until TP3/TP2/TP1/SL or the window end.
    const sig = signals[0];
    try {
      const rows = await db.ohlcvBar.findMany({ where: { symbol: sig.symbol }, orderBy: { date: "asc" } });
      if (rows.length >= 10) {
        const bars = rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));
        const lastIdx = bars.length - 1; // the latest bar (≈ "today" / live day)
        let windowStart: number, windowEnd: number;
        if (numDays > 0) {
          // REAL recent window: last numDays bars = [today − numDays, today]
          windowEnd = lastIdx;
          windowStart = Math.max(2, lastIdx - numDays + 1);
        } else {
          // numDays not given → any start day, scan to the latest bar
          windowEnd = lastIdx;
          windowStart = 2 + Math.floor(Math.random() * Math.max(1, lastIdx - 10));
        }
        const levels = { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3, confidence: sig.confidence };
        const span = Math.max(1, windowEnd - windowStart + 1);
        for (let i = 0; i < numTrades; i++) {
          // random REAL bar within [windowStart, windowEnd] (with replacement → exactly numTrades)
          const entryIdx = windowStart + Math.floor(Math.random() * span);
          const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, windowEnd, levels);
          if (t) trades.push(t);
        }
      }
    } catch {}
  } else {
    // ── ALL-stocks mode: windowed real-history simulation ──
    // Issue 42: trades are executed ONLY within the user's time period.
    // If numDays = 63 (3 months), the window = [today − 63 trading days, today]
    // in CALENDAR dates. Each trade enters at a REAL bar whose DATE falls
    // within this calendar window. Stocks with stale data (latest bar is
    // months/years old) are skipped — only stocks with recent bars trade.
    let picks: typeof signals;
    if (signals.length >= numTrades) {
      const shuffled = [...signals].sort(() => Math.random() - 0.5);
      picks = shuffled.slice(0, numTrades);
    } else if (signals.length > 0) {
      picks = Array.from({ length: numTrades }, () => signals[Math.floor(Math.random() * signals.length)]);
    } else {
      picks = [];
    }
    // Compute the calendar date window: [today − numDays × 1.5, today].
    // 1.5 = approx conversion from trading days to calendar days (weekends +
    // holidays). For numDays = 63 (3 months), this gives ~94 calendar days.
    const todayMs = Date.now();
    const calendarWindowMs = numDays > 0 ? numDays * 1.5 * 86400000 : 0;
    const windowStartMs = todayMs - calendarWindowMs;
    let idx = 0;
    async function worker() {
      while (idx < picks.length) {
        const sig = picks[idx++];
        try {
          const rows = await db.ohlcvBar.findMany({ where: { symbol: sig.symbol }, orderBy: { date: "asc" } });
          if (rows.length < 10) continue;
          const bars = rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));
          // Issue 42: filter bars to only those within the calendar window.
          // This ensures the trade's entry DATE is within the user's time period.
          let windowBars: typeof bars;
          let windowEndIdx: number;
          if (numDays > 0) {
            windowBars = bars.filter((b) => {
              const barMs = Date.parse(b.date);
              return barMs >= windowStartMs && barMs <= todayMs;
            });
            if (windowBars.length < 3) continue; // skip stocks with too few bars in the window
            // Map windowBars indices back to the full bars array for simulateWindowTrade.
            // Find the start + end indices in the original bars array.
            const firstWindowDate = windowBars[0].date;
            const lastWindowDate = windowBars[windowBars.length - 1].date;
            windowEndIdx = bars.findIndex((b) => b.date === lastWindowDate);
            const windowStartIdx = bars.findIndex((b) => b.date === firstWindowDate);
            if (windowStartIdx < 0 || windowEndIdx < 0) continue;
            const span = Math.max(1, windowEndIdx - windowStartIdx + 1);
            const entryIdx = windowStartIdx + Math.floor(Math.random() * span);
            const levels = { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3, confidence: sig.confidence };
            const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, windowEndIdx, levels);
            if (t) trades.push(t);
          } else {
            // numDays = 0 → any start (full history)
            const lastIdx = bars.length - 1;
            const entryIdx = 2 + Math.floor(Math.random() * Math.max(1, lastIdx - 2));
            const levels = { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3, confidence: sig.confidence };
            const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, lastIdx, levels);
            if (t) trades.push(t);
          }
        } catch {}
      }
    }
    await Promise.all(Array.from({ length: 6 }, () => worker()));
    // Fallback: if we don't have enough trades yet, pick more signals.
    while (trades.length < numTrades && signals.length > 0) {
      const sig = signals[Math.floor(Math.random() * signals.length)];
      try {
        const rows = await db.ohlcvBar.findMany({ where: { symbol: sig.symbol }, orderBy: { date: "asc" } });
        if (rows.length < 10) continue;
        const bars = rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));
        if (numDays > 0) {
          const windowBars = bars.filter((b) => {
            const barMs = Date.parse(b.date);
            return barMs >= windowStartMs && barMs <= todayMs;
          });
          if (windowBars.length < 3) continue;
          const firstWindowDate = windowBars[0].date;
          const lastWindowDate = windowBars[windowBars.length - 1].date;
          windowEndIdx = bars.findIndex((b) => b.date === lastWindowDate);
          const windowStartIdx = bars.findIndex((b) => b.date === firstWindowDate);
          if (windowStartIdx < 0 || windowEndIdx < 0) continue;
          const span = Math.max(1, windowEndIdx - windowStartIdx + 1);
          const entryIdx = windowStartIdx + Math.floor(Math.random() * span);
          const levels = { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3, confidence: sig.confidence };
          const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, windowEndIdx, levels);
          if (t) trades.push(t);
        } else {
          const lastIdx = bars.length - 1;
          const entryIdx = 2 + Math.floor(Math.random() * Math.max(1, lastIdx - 2));
          const levels = { entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2, tp3: sig.tp3, confidence: sig.confidence };
          const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, lastIdx, levels);
          if (t) trades.push(t);
        }
      } catch {}
      if (trades.length >= numTrades) break;
    }
  }

  let sipTotal = 0;
  if (monthlySip > 0) {
    const months = Math.max(1, Math.round(numDays / 21));
    sipTotal = monthlySip * months;
  }

  const metrics = aggregate(trades, startingCapital, amountPerTrade, numDays, monthlySip, periodUnit, sipTotal, naturalBuyCount);
  const equityCurve = trades.map((t, i) => ({ trade: i + 1, equity: t.portfolio }));
  return { trades, metrics, equityCurve, generatedAt: new Date().toISOString() };
}
