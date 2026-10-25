/**
 * investment-simulator.ts — chronological, COMPOUNDING trade-by-trade
 * simulator for the Tracker → Signal Tracker → Investment Simulator.
 *
 * User spec:
 *   - "start investing with the user investment amount and after month add
 *     sip amount"
 *   - "take user time period and go back to that time and then start trading
 *     (i.e. if user put 3 months, its not oct then go back to 3 month that is
 *     july, take 1st july and start trading)"
 *   - "use invest amount and start trading after 1st trade take profit or
 *     loss minus and plus in invest amount and use that amount in entry amount
 *     of 2nd trade and so on (i.e. if user put 1000 PKR initial investment
 *     amount then trade if we win and make profit of 500 PKR then total amount
 *     is 1500 then take a 2nd trade of 1500 and take trade and so on). also
 *     add sip after month."
 *   - Result columns: symbol, entry date & time, closing date & time, entry
 *     price, closing price, HIT (what hits — SL or TP per the TP rule, i.e.
 *     TP3 > TP2 > TP1), sl, tp1, tp2, tp3, win/loss, entry amount, profit and
 *     loss, total gain (cumulative), exit amount.
 *
 * Method:
 *   1. Compute the chronological window: startDate = 1st of (now −
 *      periodValue months) for month unit (now − periodValue days for day,
 *      now − periodValue years for year); endDate = now (latest available
 *      bar). The simulation progresses FORWARD from startDate.
 *   2. Load final-consensus signals (filtered by confidence + direction),
 *      seeded-shuffle for determinism.
 *   3. Walk forward chronologically: trade i enters at the first bar of the
 *      picked symbol whose date >= the previous trade's exit date (or
 *      startDate for the first trade). Hold up to holdBars (= period trading
 *      days / numTrades, min 1) checking TP3 → TP2 → TP1 → SL → time-up.
 *   4. COMPOUNDING: trade 1 entry = the user's initial capital. After the
 *      trade, net P&L is added to the pool. Trade 2 entry = trade 1's exit
 *      amount (pool). And so on.
 *   5. SIP: at the start of each month M >= 2, add monthlySip to the pool
 *      (rendered as its own amber "Month M deposit" row before that month's
 *      trades).
 *   6. Per-trade costs: broker commission 0.15% × entry × 2 (both sides),
 *      slippage 0.5% × entry, CGT 15% on gross profit (PSX equity, ≤12mo
 *      holding). Matches the close-trade flow in PortfolioTab.
 */

import { db } from "@/lib/db";

export type PeriodUnit = "day" | "month" | "year";
const UNIT_DAYS: Record<PeriodUnit, number> = { day: 1, month: 21, year: 252 };
const COMMISSION_RATE = 0.0015;
const SLIPPAGE_RATE = 0.005;
const CGT_RATE = 0.15;

export interface SimSignal {
  symbol: string;
  signal: "BUY" | "SELL";
  confidence: number;
  entry?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
}

export interface SimTradeRow {
  tradeNo: number;
  type: "TRADE" | "SIP";
  month: number;
  symbol: string;
  side: "BUY" | "SELL" | "SIP";
  direction: "LONG" | "SHORT" | "SIP";
  entryDate: number; // epoch ms
  entryPrice: number;
  exitDate: number; // epoch ms
  exitPrice: number;
  exitReason: string; // "TP3_HIT" | "TP2_HIT" | "TP1_HIT" | "SL_HIT" | "TIME_UP"
  hit: string; // "TP3" | "TP2" | "TP1" | "SL" | "—"
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  entryAmount: number;
  pnl: number;
  totalGain: number; // cumulative net P&L up to and including this trade
  exitAmount: number; // entryAmount + pnl = next trade's entry (compounding)
  returnPct: number;
  isWin: boolean;
  confidence: number;
}

export interface InvestmentSimResult {
  initialAmount: number;
  finalAmount: number;
  totalPnl: number; // = totalGain
  totalReturnPct: number;
  totalGain: number;
  totalSip: number;
  totalInvested: number;
  wins: number;
  losses: number;
  tradeCount: number;
  rows: SimTradeRow[];
  startDate: string; // ISO
  endDate: string; // ISO
  config: {
    periodValue: number;
    periodUnit: PeriodUnit;
    monthlySip: number;
    numTrades: number;
    minConfidence: number;
    direction: "BOTH" | "LONG" | "SHORT";
    numMonths: number;
    totalSip: number;
    totalInvested: number;
    numSignalsAvailable: number;
    seed: number;
    startDate: string;
    endDate: string;
  };
}

interface Bar {
  date: string; // ISO date (OhlcvBar.date)
  open: number;
  high: number;
  low: number;
  close: number;
}

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

// Compute the simulation start date = "go back periodValue units from now".
//   month unit → 1st of (now − periodValue months). E.g. now=2026-10-25,
//     periodValue=3 → 2026-07-01 (the user's "if its oct, go back 3 months
//     = july, take 1st july" example).
//   day unit → now − periodValue days.
//   year unit → 1st of (now − periodValue years).
function computeStartDate(periodValue: number, periodUnit: PeriodUnit): Date {
  const now = new Date();
  if (periodUnit === "day") {
    const d = new Date(now);
    d.setDate(d.getDate() - periodValue);
    return d;
  }
  if (periodUnit === "year") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - periodValue);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // month (default)
  const d = new Date(now);
  d.setMonth(d.getMonth() - periodValue);
  d.setDate(1); // "take 1st july"
  d.setHours(0, 0, 0, 0);
  return d;
}

// Resolve a symbol's bars (cached per-run).
function barCache(): Map<string, Bar[]> {
  return new Map();
}

// Run ONE chronological trade for a symbol within [fromMs, toMs] (calendar
// window for THIS trade's entry). Finds the first bar in the symbol's history
// whose date >= fromMs (chronological progression from the previous trade's
// exit), within the month window. Falls back to the window's last bar if the
// symbol has no bar after fromMs (wraps so we still produce a trade).
function simulateTrade(
  sig: SimSignal,
  bars: Bar[],
  fromMs: number,
  windowEndMs: number,
  holdBars: number
): {
  entryIdx: number;
  exitIdx: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: SimTradeRow["exitReason"];
  hit: string;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  direction: "BUY" | "SELL";
} | null {
  if (bars.length < 5) return null;
  const direction = sig.signal === "SELL" ? "SELL" : "BUY";

  // Find entry bar: first bar with date >= fromMs AND date <= windowEndMs
  // (chronological progression within the simulation window). If the symbol
  // has NO bar in this window (e.g. its history ends before the window, or
  // starts after it) we SKIP the trade — return null so the caller can pick
  // the next signal. This keeps every trade's entry date INSIDE the user's
  // [startDate, endDate] window (the user spec: "take 1st july and start
  // trading" — no trading before the window start).
  let entryIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    const t = Date.parse(bars[i].date);
    if (t >= fromMs && t <= windowEndMs) {
      entryIdx = i;
      break;
    }
  }
  if (entryIdx < 0) {
    // No bar in the chronological window for this symbol — skip it.
    return null;
  }

  const entryBar = bars[entryIdx];
  // Entry price: if the signal has an entry level AND a bar in the window
  // touched it (within ±1.5%), enter at that level; otherwise enter at the
  // bar's close (the real price on that day) — matches the #2 pattern in
  // backtest.ts.
  let entryPrice = entryBar.close;
  const sigEntry = sig.entry && sig.entry > 0 ? sig.entry : null;
  // ATR at entry for filling missing SL/TP
  const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
  const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entryPrice * 0.02;

  // Levels: prefer the signal's absolute levels; derive from relative
  // distances if missing.
  const slDist = sig.sl && sig.sl > 0 && sigEntry ? Math.abs(sigEntry - sig.sl) : atrVal * 1.5;
  const tp1Dist = sig.tp1 && sig.tp1 > 0 && sigEntry ? Math.abs(sig.tp1 - sigEntry) : atrVal;
  const tp2Dist = sig.tp2 && sig.tp2 > 0 && sigEntry ? Math.abs(sig.tp2 - sigEntry) : 2 * atrVal;
  const tp3Dist = sig.tp3 && sig.tp3 > 0 && sigEntry ? Math.abs(sig.tp3 - sigEntry) : 3 * atrVal;

  const sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
  const tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
  const tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
  const tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;

  // TP rule (check TP3 → TP2 → TP1 → SL → time): scan forward up to holdBars.
  const end = Math.min(bars.length - 1, entryIdx + holdBars);
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
  let exitIdx: number, exitPrice: number;
  let exitReason: SimTradeRow["exitReason"];
  let hit: string;
  if (tp3Idx >= 0) { exitIdx = tp3Idx; exitPrice = tp3; exitReason = "TP3_HIT"; hit = "TP3"; }
  else if (tp2Idx >= 0) { exitIdx = tp2Idx; exitPrice = tp2; exitReason = "TP2_HIT"; hit = "TP2"; }
  else if (tp1Idx >= 0) { exitIdx = tp1Idx; exitPrice = tp1; exitReason = "TP1_HIT"; hit = "TP1"; }
  else if (slIdx >= 0) { exitIdx = slIdx; exitPrice = sl; exitReason = "SL_HIT"; hit = "SL"; }
  else { exitIdx = end; exitPrice = bars[end].close; exitReason = "TIME_UP"; hit = "—"; }

  return { entryIdx, exitIdx, entryPrice, exitPrice, exitReason, hit, sl, tp1, tp2, tp3, direction };
}

export interface InvestmentSimInput {
  capital: number;
  periodValue: number;
  periodUnit: PeriodUnit;
  monthlySip: number;
  numTrades: number;
  minConfidence: number;
  direction: "BOTH" | "LONG" | "SHORT";
  signals: SimSignal[];
  seed?: number;
}

export async function runInvestmentSimulation(input: InvestmentSimInput): Promise<InvestmentSimResult> {
  const {
    capital,
    periodValue,
    periodUnit,
    monthlySip,
    numTrades,
    minConfidence,
    direction,
    signals: rawSignals,
    seed = Date.now(),
  } = input;

  const numDays = periodValue * (UNIT_DAYS[periodUnit] || 21);
  const numMonths =
    periodUnit === "month"
      ? Math.max(1, periodValue)
      : periodUnit === "year"
        ? Math.max(1, periodValue * 12)
        : Math.max(1, Math.round(numDays / 21));
  const totalSip = monthlySip * numMonths;
  const totalInvested = capital + totalSip;

  // Filter signals by confidence + direction.
  let signals = rawSignals.filter((s) => (s.confidence ?? 0) >= minConfidence);
  if (direction === "LONG") signals = signals.filter((s) => s.signal === "BUY");
  if (direction === "SHORT") signals = signals.filter((s) => s.signal === "SELL");

  // Keep only DB-backed symbols (have OHLCV history to trade on).
  let backedSymbols: Set<string> | null = null;
  try {
    const backed = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });
    backedSymbols = new Set(backed.map((b) => b.symbol));
    signals = signals.filter((s) => backedSymbols!.has(s.symbol));
  } catch {
    // DB unavailable — proceed with whatever signals we have.
  }
  const numSignalsAvailable = signals.length;

  const startDate = computeStartDate(periodValue, periodUnit);
  const endDate = new Date(); // now
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Per-trade hold: spread numTrades evenly across the period (each trade
  // gets ~period/numTrades trading days of hold room). Min 1 bar.
  const holdBars = Math.max(1, Math.floor(numDays / Math.max(1, numTrades)));

  // Distribute numTrades across months (remainder in early months).
  const basePerMonth = Math.floor(numTrades / numMonths);
  const remainder = numTrades % numMonths;

  // Seeded shuffle (deterministic per seed).
  let s = seed;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const shuffled = [...signals].sort(() => rng() - 0.5);

  const rows: SimTradeRow[] = [];
  const cache = barCache();
  let pool = capital; // running pool — trade entry = pool, exit = pool + netPnl
  let totalGain = 0;
  let wins = 0;
  let losses = 0;
  let tradeNo = 0;
  let cursorMs = startMs; // earliest allowed entry date for the next trade
  let cursor = 0; // rotating pointer into the shuffled signal pool

  // Month-by-month windows (chronological).
  for (let m = 1; m <= numMonths; m++) {
    // SIP deposit at the START of each month M >= 2 (month 1 = the initial
    // capital already in the pool). Rendered as its own amber row.
    if (m > 1 && monthlySip > 0) {
      tradeNo++;
      pool += monthlySip;
      rows.push({
        tradeNo,
        type: "SIP",
        month: m,
        symbol: `Month ${m} deposit`,
        side: "SIP",
        direction: "SIP",
        entryDate: 0,
        entryPrice: 0,
        exitDate: 0,
        exitPrice: 0,
        exitReason: "SIP_DEPOSIT",
        hit: "—",
        sl: 0, tp1: 0, tp2: 0, tp3: 0,
        entryAmount: monthlySip,
        pnl: 0,
        totalGain,
        exitAmount: monthlySip,
        returnPct: 0,
        isWin: false,
        confidence: 0,
      });
    }

    // This month's calendar window.
    const monthStart = new Date(startDate);
    monthStart.setMonth(monthStart.getMonth() + (m - 1));
    const monthStartMs = monthStart.getTime();
    const monthEnd = new Date(startDate);
    monthEnd.setMonth(monthEnd.getMonth() + m);
    const monthEndMs = monthEnd.getTime();

    const monthCount = basePerMonth + (m <= remainder ? 1 : 0);
    for (let i = 0; i < monthCount; i++) {
      if (numSignalsAvailable === 0) break;
      // Try up to numSignalsAvailable signals for this trade slot — skip any
      // symbol that has no bar in the chronological window (returns null) so
      // the trade we DO execute has an entry date inside [startDate, endDate].
      let res: ReturnType<typeof simulateTrade> = null;
      let sig: SimSignal | null = null;
      let bars: Bar[] = [];
      for (let attempt = 0; attempt < numSignalsAvailable; attempt++) {
        const candidate = shuffled[cursor % shuffled.length];
        cursor++;
        let candBars = cache.get(candidate.symbol);
        if (!candBars) {
          try {
            const rows2 = await db.ohlcvBar.findMany({ where: { symbol: candidate.symbol }, orderBy: { date: "asc" } });
            candBars = rows2.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));
          } catch {
            candBars = [];
          }
          cache.set(candidate.symbol, candBars);
        }
        const fromMs = Math.max(cursorMs, monthStartMs);
        const r = simulateTrade(candidate, candBars, fromMs, Math.min(monthEndMs, endMs), holdBars);
        if (r) {
          res = r;
          sig = candidate;
          bars = candBars;
          break;
        }
      }
      if (!res || !sig) continue; // no in-window signal this slot

      const entryAmount = pool; // COMPOUNDING: trade the full running pool
      const grossPnlPct =
        res.direction === "BUY"
          ? ((res.exitPrice - res.entryPrice) / res.entryPrice) * 100
          : ((res.entryPrice - res.exitPrice) / res.entryPrice) * 100;
      const grossPnl = (grossPnlPct / 100) * entryAmount;
      const commission = entryAmount * COMMISSION_RATE * 2; // both sides
      const slippage = entryAmount * SLIPPAGE_RATE;
      const cgt = grossPnl > 0 ? grossPnl * CGT_RATE : 0;
      const cost = commission + slippage + cgt;
      const netPnl = grossPnl - cost;
      const exitAmount = entryAmount + netPnl;

      totalGain += netPnl;
      pool = exitAmount; // next trade enters with the new pool
      if (netPnl > 0) wins++;
      else losses++;

      // Advance the chronological cursor past this trade's exit so the next
      // trade enters AFTER this one closed.
      const exitBarDateMs = Date.parse(bars[res.exitIdx].date);
      if (exitBarDateMs > cursorMs) cursorMs = exitBarDateMs + 86400000; // +1 day

      tradeNo++;
      rows.push({
        tradeNo,
        type: "TRADE",
        month: m,
        symbol: sig.symbol,
        side: res.direction,
        direction: res.direction === "BUY" ? "LONG" : "SHORT",
        entryDate: Date.parse(bars[res.entryIdx].date),
        entryPrice: res.entryPrice,
        exitDate: Date.parse(bars[res.exitIdx].date),
        exitPrice: res.exitPrice,
        exitReason: res.exitReason,
        hit: res.hit,
        sl: res.sl,
        tp1: res.tp1,
        tp2: res.tp2,
        tp3: res.tp3,
        entryAmount,
        pnl: netPnl,
        totalGain,
        exitAmount,
        returnPct: entryAmount > 0 ? (netPnl / entryAmount) * 100 : 0,
        isWin: netPnl > 0,
        confidence: sig.confidence ?? 0,
      });
    }
  }

  const finalAmount = pool; // = capital + totalSip + totalGain
  const totalPnl = totalGain;
  const totalReturnPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return {
    initialAmount: capital,
    finalAmount,
    totalPnl,
    totalReturnPct,
    totalGain,
    totalSip,
    totalInvested,
    wins,
    losses,
    tradeCount: rows.filter((r) => r.type === "TRADE").length,
    rows,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    config: {
      periodValue,
      periodUnit,
      monthlySip,
      numTrades,
      minConfidence,
      direction,
      numMonths,
      totalSip,
      totalInvested,
      numSignalsAvailable,
      seed,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}
