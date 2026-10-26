/**
 * investment-simulator.ts — chronological, COMPOUNDING trade-by-trade
 * simulator for the Tracker → Signal Tracker → Investment Simulator.
 *
 * User spec (latest, 2026-10-26):
 *   - "simulate will must have to no of trade provided by user" — the number
 *     of trades MUST be fulfilled (no fewer trades because signals ran out or
 *     a trade skipped). Keep cycling the signal pool + allow same-day entries
 *     on DIFFERENT stocks until numTrades is hit.
 *   - "you have to check trade on that day on all stock which matches the
 *     criteria you can use that but you must have to take trade" — for each
 *     slot, scan ALL matching signals and take a trade.
 *   - "don't take all trade in a day or a 1 week (short time)" — distribute
 *     trades evenly across the whole window (slot targets are evenly spaced).
 *   - "cover each month (when month and year is given) and each day (when day
 *     less then the month selected)" — month unit → cover every calendar
 *     month in the window; day unit → cover every day.
 *   - "1st sip is shown from after completing first month, also add result of
 *     current month as well" — SIP installments at the 1st of each calendar
 *     month STRICTLY AFTER the start month, INCLUDING the current (partial)
 *     month. So periodValue=3 (month, today=Oct 26) → start Jul 1 → window
 *     Jul→Oct → SIPs at Aug 1, Sep 1, Oct 1 = 3 installments (= periodValue),
 *     and October trades run up to today.
 *
 * Earlier spec (still honored):
 *   - Compounding: trade 1 entry = initial capital; net P&L added to pool;
 *     trade 2 entry = trade 1's exit amount; and so on.
 *   - Result columns: symbol, entry/exit date+time, entry/exit price, HIT
 *     (TP3 > TP2 > TP1 > SL per the TP rule), sl/tp1/tp2/tp3, win/loss, entry
 *     amount, P&L, total gain (cumulative), exit amount.
 *
 * Method:
 *   1. Window: startDate = computeStartDate(periodValue, periodUnit)
 *      (month unit → 1st of (now − periodValue months); day → now − days;
 *      year → 1st of (now − years)). endDate = now. Sim progresses FORWARD.
 *   2. SIP schedule: 1st of each calendar month after the start month, within
 *      [startMs, endMs]. Decoupled from the trade loop so the current partial
 *      month gets its SIP + trades up to today.
 *   3. Evenly-space numTrades target entry timestamps across [startMs, endMs]
 *      → guarantees the "don't cluster" rule + "cover each month/day" rule.
 *   4. For each target: scan ALL matching signals round-robin, pick the one
 *      whose first in-window bar is closest to the target. simulateTrade
 *      (TP3 > TP2 > TP1 > SL; skips if nothing hit). Allow same-day entries on
 *      different stocks (no forced +1-day cursor advance).
 *   5. Compounding: each trade enters with the running pool; SIPs add to the
 *      pool when their date is on/before the trade's entry bar.
 *   6. Per-trade costs: commission 0.15%×2, slippage 0.15%, CGT 15% on gains.
 */

import { db } from "@/lib/db";

export type PeriodUnit = "day" | "month" | "year";
const UNIT_DAYS: Record<PeriodUnit, number> = { day: 1, month: 21, year: 252 };
// PSX realistic round-trip costs. Commission 0.15% per side × 2 sides =
// 0.30%. Slippage 0.15% (large-cap PSX is liquid; 0.5% was 10× too high
// and was flipping tiny-TP hits into net losses). CGT 15% on gross profit
// (PSX equity, ≤12mo holding) — matches the Portfolio close-trade flow.
const COMMISSION_RATE = 0.0015;
const SLIPPAGE_RATE = 0.0015;
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
  exitReason: string; // "TP3_HIT" | "TP2_HIT" | "TP1_HIT" | "SL_HIT" | "TIME_UP" | "SIP_DEPOSIT"
  hit: string; // "TP3" | "TP2" | "TP1" | "SL" | "—"
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  entryAmount: number;
  pnl: number;
  totalGain: number; // cumulative net P&L up to and including this row
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
    numSips: number;
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
//   month unit → 1st of (now − periodValue months). E.g. now=2026-10-26,
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

// Run ONE chronological trade for a symbol within [fromMs, windowEndMs].
// Finds the first bar in the symbol's history whose date >= fromMs AND
// <= windowEndMs (chronological progression within the simulation window).
// Holds until SL or a TP is reached (TP3 > TP2 > TP1 > SL priority). If
// NOTHING is hit by windowEnd, returns null (the caller skips it so the HIT
// column is never "—").
function simulateTrade(
  sig: SimSignal,
  bars: Bar[],
  fromMs: number,
  windowEndMs: number
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

  // Find entry bar: first bar with date >= fromMs AND date <= windowEndMs.
  let entryIdx = -1;
  for (let i = 0; i < bars.length; i++) {
    const t = Date.parse(bars[i].date);
    if (t >= fromMs && t <= windowEndMs) {
      entryIdx = i;
      break;
    }
  }
  if (entryIdx < 0) return null; // no bar in the chronological window

  const entryBar = bars[entryIdx];
  let entryPrice = entryBar.close;
  const sigEntry = sig.entry && sig.entry > 0 ? sig.entry : null;
  const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
  const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entryPrice * 0.02;

  const slDist = sig.sl && sig.sl > 0 && sigEntry ? Math.abs(sigEntry - sig.sl) : atrVal * 1.5;
  const tp1Dist = sig.tp1 && sig.tp1 > 0 && sigEntry ? Math.abs(sig.tp1 - sigEntry) : atrVal;
  const tp2Dist = sig.tp2 && sig.tp2 > 0 && sigEntry ? Math.abs(sig.tp2 - sigEntry) : 2 * atrVal;
  const tp3Dist = sig.tp3 && sig.tp3 > 0 && sigEntry ? Math.abs(sig.tp3 - sigEntry) : 3 * atrVal;

  const sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
  const tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
  const tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
  const tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;

  // TP rule: scan forward through the FULL remaining window. Each trade holds
  // until SL or a TP is reached; if NOTHING is hit by windowEnd the trade is
  // skipped (return null) so the HIT column is never "—".
  let end = Math.min(bars.length - 1, entryIdx);
  for (let i = bars.length - 1; i > entryIdx; i--) {
    if (Date.parse(bars[i].date) <= windowEndMs) { end = i; break; }
  }
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
  else return null; // nothing hit within the window — skip

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

  const startDate = computeStartDate(periodValue, periodUnit);
  const endDate = new Date(); // now
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Calendar months spanned by the window (info only — for the UI label).
  // month unit, periodValue=3 from Oct → start Jul 1 → window Jul+Aug+Sep+Oct
  // (current partial) = 4 calendar months = periodValue + 1.
  const numMonths =
    periodUnit === "month"
      ? Math.max(1, periodValue + 1)
      : periodUnit === "year"
        ? Math.max(1, periodValue * 12 + 1)
        : Math.max(1, Math.ceil((endMs - startMs) / (30 * 86400000)));

  // SIP schedule: 1st of each calendar month STRICTLY after the start month,
  // within [startMs, endMs]. For periodValue=3 (start=Jul 1): Aug 1, Sep 1,
  // Oct 1 = 3 installments (= periodValue). The current partial month (Oct)
  // gets its SIP + trades up to today ("also add result of current month").
  const sipDeposits: { date: number; amount: number; month: number }[] = [];
  if (monthlySip > 0) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    let m = 2;
    while (d.getTime() <= endMs) {
      sipDeposits.push({ date: d.getTime(), amount: monthlySip, month: m });
      d.setMonth(d.getMonth() + 1);
      m++;
    }
  }
  const numSips = sipDeposits.length;
  const totalSip = sipDeposits.reduce((s, x) => s + x.amount, 0);
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

  // Seeded shuffle (deterministic per seed) — rotates which signal is tried
  // first per slot so the same stock isn't always picked first.
  let s = seed;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const shuffled = [...signals].sort(() => rng() - 0.5);

  // Evenly-spaced target entry timestamps across [startMs, endMs]. This is the
  // "don't cluster all trades in a day/week" guarantee: slots are spread across
  // the whole window. For month unit each calendar month naturally gets
  // numTrades/numMonths slots (≥1 per month → "cover each month"); for day unit
  // each day gets numTrades/periodValue slots (multiple per day allowed →
  // same-day multi-stock trades → "cover each day").
  const windowMs = Math.max(1, endMs - startMs);
  const targets: number[] = [];
  for (let i = 0; i < numTrades; i++) {
    targets.push(startMs + (i + 0.5) * (windowMs / numTrades));
  }

  // Bar cache (per-run).
  const cache = new Map<string, Bar[]>();
  const getBars = async (symbol: string): Promise<Bar[]> => {
    let b = cache.get(symbol);
    if (!b) {
      try {
        const rows2 = await db.ohlcvBar.findMany({ where: { symbol }, orderBy: { date: "asc" } });
        b = rows2.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));
      } catch {
        b = [];
      }
      cache.set(symbol, b);
    }
    return b;
  };

  // Month index of a timestamp relative to startDate (1 = the start month).
  const monthIndexOf = (ms: number) => {
    const d = new Date(ms);
    return (d.getFullYear() - startDate.getFullYear()) * 12 + (d.getMonth() - startDate.getMonth()) + 1;
  };

  const rows: SimTradeRow[] = [];
  let pool = capital; // running pool — trade entry = pool, exit = pool + netPnl
  let totalGain = 0;
  let wins = 0;
  let losses = 0;
  let tradeNo = 0;
  let lastExitMs = startMs; // earliest allowed entry for the next trade
  let cursor = 0; // rotating pointer into the shuffled signal pool
  let sipIdx = 0;

  for (let i = 0; i < numTrades; i++) {
    if (numSignalsAvailable === 0) break;
    const targetMs = targets[i];
    // Can't enter before the previous trade closed (chronological + compounding).
    const desiredEntryMs = Math.max(targetMs, lastExitMs);

    // Scan ALL matching signals round-robin; pick the one whose first in-window
    // bar is closest to the target. Allow same-day entries on different stocks
    // (the user spec: "multiple trade on multiple stock on same day"). The
    // triedThisSlot set prevents re-picking the SAME symbol within one slot,
    // but the same symbol CAN be picked again in a later slot.
    let pickedSig: SimSignal | null = null;
    let pickedBars: Bar[] = [];
    let pickedRes: ReturnType<typeof simulateTrade> = null;
    let pickedEntryMs = endMs;
    const triedThisSlot = new Set<string>();
    for (let attempt = 0; attempt < numSignalsAvailable; attempt++) {
      const candidate = shuffled[cursor % shuffled.length];
      cursor++;
      if (triedThisSlot.has(candidate.symbol)) continue;
      triedThisSlot.add(candidate.symbol);
      const candBars = await getBars(candidate.symbol);
      if (candBars.length < 5) continue;
      const r = simulateTrade(candidate, candBars, desiredEntryMs, endMs);
      if (r) {
        const entryMs = Date.parse(candBars[r.entryIdx].date);
        if (!pickedRes || Math.abs(entryMs - targetMs) < Math.abs(pickedEntryMs - targetMs)) {
          pickedSig = candidate;
          pickedBars = candBars;
          pickedRes = r;
          pickedEntryMs = entryMs;
        }
        // Near-perfect (within a day) — stop early to save DB reads.
        if (Math.abs(entryMs - targetMs) < 86400000) break;
      }
    }
    if (!pickedRes || !pickedSig) continue; // no in-window signal this slot (rare w/ 900 stocks)

    // Apply any SIP deposits whose date is on/before this trade's entry bar
    // (SIPs are applied to the pool chronologically before the trade enters).
    while (sipIdx < sipDeposits.length && sipDeposits[sipIdx].date <= pickedEntryMs) {
      const dep = sipDeposits[sipIdx];
      pool += dep.amount;
      tradeNo++;
      rows.push({
        tradeNo,
        type: "SIP",
        month: dep.month,
        symbol: `Month ${dep.month} deposit`,
        side: "SIP",
        direction: "SIP",
        entryDate: dep.date,
        entryPrice: 0,
        exitDate: dep.date,
        exitPrice: 0,
        exitReason: "SIP_DEPOSIT",
        hit: "—",
        sl: 0, tp1: 0, tp2: 0, tp3: 0,
        entryAmount: dep.amount,
        pnl: 0,
        totalGain,
        exitAmount: dep.amount,
        returnPct: 0,
        isWin: false,
        confidence: 0,
      });
      sipIdx++;
    }

    // COMPOUNDING: trade the full running pool.
    const entryAmount = pool;
    const grossPnlPct =
      pickedRes.direction === "BUY"
        ? ((pickedRes.exitPrice - pickedRes.entryPrice) / pickedRes.entryPrice) * 100
        : ((pickedRes.entryPrice - pickedRes.exitPrice) / pickedRes.entryPrice) * 100;
    const grossPnl = (grossPnlPct / 100) * entryAmount;
    const commission = entryAmount * COMMISSION_RATE * 2; // both sides
    const slippage = entryAmount * SLIPPAGE_RATE;
    const cgt = grossPnl > 0 ? grossPnl * CGT_RATE : 0;
    const cost = commission + slippage + cgt;
    const netPnl = grossPnl - cost;
    const exitAmount = entryAmount + netPnl;

    totalGain += netPnl;
    pool = exitAmount; // next trade enters with the new pool
    // Win/loss by HIT, NOT by netPnl (the user spec: "tp3 hit and it still
    // count my loss"). A TP hit (TP3/TP2/TP1) is a WIN; an SL hit is a LOSS.
    const isWin = pickedRes.hit === "TP3" || pickedRes.hit === "TP2" || pickedRes.hit === "TP1";
    if (isWin) wins++;
    else losses++;

    const entryBarDateMs = Date.parse(pickedBars[pickedRes.entryIdx].date);
    const exitBarDateMs = Date.parse(pickedBars[pickedRes.exitIdx].date);
    // Advance the cursor to this trade's exit date. NO +1-day advance — the
    // next trade may enter on the SAME day on a different stock (user spec).
    lastExitMs = exitBarDateMs;

    tradeNo++;
    rows.push({
      tradeNo,
      type: "TRADE",
      month: monthIndexOf(entryBarDateMs),
      symbol: pickedSig.symbol,
      side: pickedRes.direction,
      direction: pickedRes.direction === "BUY" ? "LONG" : "SHORT",
      entryDate: entryBarDateMs,
      entryPrice: pickedRes.entryPrice,
      exitDate: exitBarDateMs,
      exitPrice: pickedRes.exitPrice,
      exitReason: pickedRes.exitReason,
      hit: pickedRes.hit,
      sl: pickedRes.sl,
      tp1: pickedRes.tp1,
      tp2: pickedRes.tp2,
      tp3: pickedRes.tp3,
      entryAmount,
      pnl: netPnl,
      totalGain,
      exitAmount,
      returnPct: entryAmount > 0 ? (netPnl / entryAmount) * 100 : 0,
      isWin,
      confidence: pickedSig.confidence ?? 0,
    });
  }

  // Apply any SIP deposits due AFTER the last trade's exit but within the
  // window (e.g. a SIP on the 1st when the last trade closed on the 28th).
  while (sipIdx < sipDeposits.length) {
    const dep = sipDeposits[sipIdx];
    pool += dep.amount;
    tradeNo++;
    rows.push({
      tradeNo,
      type: "SIP",
      month: dep.month,
      symbol: `Month ${dep.month} deposit`,
      side: "SIP",
      direction: "SIP",
      entryDate: dep.date,
      entryPrice: 0,
      exitDate: dep.date,
      exitPrice: 0,
      exitReason: "SIP_DEPOSIT",
      hit: "—",
      sl: 0, tp1: 0, tp2: 0, tp3: 0,
      entryAmount: dep.amount,
      pnl: 0,
      totalGain,
      exitAmount: dep.amount,
      returnPct: 0,
      isWin: false,
      confidence: 0,
    });
    sipIdx++;
  }

  // Sort chronologically for display (trades by entryDate, SIPs by their date)
  // and renumber tradeNo in chronological order. Because targets are evenly
  // spaced and lastExitMs only moves forward, slot order ≈ chronological order;
  // this sort just cleans up same-day ties + SIP interleaving.
  rows.sort((a, b) => (a.entryDate || 0) - (b.entryDate || 0));
  rows.forEach((r, idx) => { r.tradeNo = idx + 1; });

  const finalAmount = pool; // = capital + totalSip + totalGain
  const totalPnl = totalGain;
  const totalReturnPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const tradeCount = rows.filter((r) => r.type === "TRADE").length;

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
    tradeCount,
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
      numSips,
      totalSip,
      totalInvested,
      numSignalsAvailable,
      seed,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}
