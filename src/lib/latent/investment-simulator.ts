/**
 * investment-simulator.ts — chronological, compounding trade-by-trade
 * simulator for the Tracker → Signal Tracker → Investment Simulator.
 *
 * User spec (latest, 2026-10-26):
 *   - "simulate will must have to no of trade provided by user" — the number
 *     of trades MUST be fulfilled (no fewer because signals ran out or a
 *     trade's long hold consumed the window).
 *   - "you have to check trade on that day on all stock which matches the
 *     criteria you can use that but you must have to take trade" — for each
 *     slot, scan ALL matching signals; place the entry on the bar closest to
 *     the slot's target day. With ~900 DB-backed symbols there is almost
 *     always a bar on any trading day, so every slot fills.
 *   - "you can take multiple trade on multiple stock on same day as well to
 *     full fill the no of trade" — parallel trades allowed (multiple open at
 *     once on different stocks). This is REQUIRED to fit, e.g., 40 trades in
 *     ~117 days when each TP-rule hold can span weeks.
 *   - "don't take all trade in a day or a 1 week (short time)" — slot targets
 *     are evenly spaced across [startMs, endMs] so trades spread out.
 *   - "cover each month (when month and year is given) and each day (when day
 *     less then the month selected)" — month unit → ≥1 slot per calendar
 *     month; day unit ≥1 slot per day (multiple per day allowed).
 *   - "1st sip is shown from after completing first month, also add result of
 *     current month as well" — SIP installments at the 1st of each calendar
 *     month STRICTLY AFTER the start month, INCLUDING the current (partial)
 *     month. So periodValue=3 (month, today=Oct 26) → start Jul 1 → window
 *     Jul→Oct → SIPs at Aug 1, Sep 1, Oct 1 = 3 installments (= periodValue),
 *     and October trades run up to today.
 *
 * Compounding model (realized, parallel-safe):
 *   - Each trade enters with the REALIZED pool = initial capital + SIPs
 *     deposited before this trade's entry + P&L from trades that already
 *     CLOSED at or before this trade's entry. Trades still open when the next
 *     enters do NOT fund the next entry (no borrowing unrealized gains).
 *   - This honors the original "compounding" intent (winners grow the pool)
 *     while allowing the same-day multi-stock entries the user needs.
 *
 * Earlier spec (still honored):
 *   - Result columns: symbol, entry/exit date, entry/exit price, HIT
 *     (TP3 > TP2 > TP1 > SL), sl/tp1/tp2/tp3, win/loss, entry amount, P&L,
 *     total gain (cumulative), exit amount.
 *
 * Per-trade costs: commission 0.15%×2, slippage 0.15%, CGT 15% on gains.
 */

import { db } from "@/lib/db";
import { simulateProgressiveTpSl, type TpSlBar } from "./tp-sl-engine";

export type PeriodUnit = "day" | "month" | "year";
const UNIT_DAYS: Record<PeriodUnit, number> = { day: 1, month: 21, year: 252 };
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
  exitReason: string; // "TP3_HIT" | "SL_HIT" | "SL_AFTER_TP1" | "SL_AFTER_TP2" | "TIME_UP" | "SIP_DEPOSIT"
  hit: string; // EXIT type: "TP3" | "SL" | "—" (reflects actual exit, NOT highest TP)
  bestTargetReached: string; // HIGHEST TP touched during the trade (preserved even if later SL exits): "TP3" | "TP2" | "TP1" | "—"
  tp1HitIdx: number; // bar index where TP1 was first reached, or -1
  tp2HitIdx: number; // bar index where TP2 was first reached, or -1
  tp3HitIdx: number; // bar index where TP3 was first reached, or -1
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  activeStop: number; // the currently-active stop level (fixed = sl; no trailing stop invented)
  entryAmount: number;
  pnl: number; // realized NET P&L (after costs)
  grossPnl: number; // realized GROSS P&L (before costs)
  totalGain: number; // cumulative net P&L up to and including this row
  exitAmount: number;
  returnPct: number; // realized net return %
  isWin: boolean; // based on netPnl > 0 (NOT on hit — fixes "tp3 hit and it still count my loss")
  unresolved: boolean; // true if no SL/TP3 exit by window end (TIME_UP)
  nBarsExamined: number; // number of bars scanned after entry
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
  unresolvedCount: number; // trades that did not hit SL or TP3 by window end (TIME_UP)
  bestTargetAttainmentRate: number; // fraction of trades where bestTargetReached >= TP1
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

export interface Bar {
  date: string; // ISO date (OhlcvBar.date)
  open: number;
  high: number;
  low: number;
  close: number;
}

// Exported for reuse by the Task 77 risk-level overlay (src/lib/latent/risk-levels.ts)
// so the prospective system uses the EXACT canonical ATR formula, not a duplicate.
export function atr(highs: number[], lows: number[], closes: number[], period = 14): number {
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
  const d = new Date(now);
  d.setMonth(d.getMonth() - periodValue);
  d.setDate(1); // "take 1st july"
  d.setHours(0, 0, 0, 0);
  return d;
}

// Find the bar in `bars` whose date is closest to targetMs, within
// [searchStartMs, windowEndMs]. Returns the bar index or -1 if none. Used to
// place a trade entry on the trading day nearest the slot's target — allows
// multiple trades on the SAME day on different stocks (the user spec:
// "multiple trade on multiple stock on same day").
function findEntryIdx(bars: Bar[], targetMs: number, searchStartMs: number, windowEndMs: number): number {
  if (bars.length < 5) return -1;
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < bars.length; i++) {
    const t = Date.parse(bars[i].date);
    if (t < searchStartMs || t > windowEndMs) continue;
    const diff = Math.abs(t - targetMs);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

// Find the K bars in `bars` whose dates are closest to targetMs, within
// [searchStartMs, windowEndMs], sorted nearest-first. Used to try MULTIPLE
// candidate entry bars per signal so a TP/SL-hitting entry is found even when
// the single nearest bar wouldn't hit (maximizes TP/SL-only fills → keeps the
// numTrades guarantee WITHOUT any time-up exits).
function findEntryIdxList(bars: Bar[], targetMs: number, searchStartMs: number, windowEndMs: number, k: number): number[] {
  if (bars.length < 5) return [];
  const cand: { idx: number; diff: number }[] = [];
  for (let i = 0; i < bars.length; i++) {
    const t = Date.parse(bars[i].date);
    if (t < searchStartMs || t > windowEndMs) continue;
    cand.push({ idx: i, diff: Math.abs(t - targetMs) });
  }
  cand.sort((a, b) => a.diff - b.diff);
  return cand.slice(0, k).map((c) => c.idx);
}

// Run ONE trade for a symbol starting at a DETERMINISTIC entry bar (entryIdx),
// scanned candle-by-candle in chronological order. Implements Task 57/58's
// progressive TP tracking via the SHARED canonical helper
// (src/lib/latent/tp-sl-engine.ts → simulateProgressiveTpSl).
//   - Check the active SL FIRST on every bar. If SL is touched on a bar, exit
//     at the realistic stop-fill price (gap-aware). SL takes priority over any
//     new TP on the SAME bar (do not award a new TP from a bar that already
//     closed the trade at SL).
//   - If SL is NOT touched, check TP3 > TP2 > TP1 (descending — highest first).
//     Reaching TP3 closes the trade (TP3 is the final target). Reaching TP1 or
//     TP2 UPGRADES bestTargetReached but does NOT close — continue scanning.
//   - bestTargetReached is preserved even if a later bar exits at SL.
//   - If no SL and no TP3 by window end: TIME_UP (unresolved), exit at last
//     close, bestTargetReached preserved.
//   - The active stop is FIXED = sl (no trailing stop invented — Phase 3).
// Realized P&L uses the ACTUAL exit price (sl / tp3 / last close), NOT the
// best-target price. This separates target attainment from realized ROI.
// EXPORTED for scripts/simulator_regression_check.ts (Task 57/58 Phase 6).
export function simulateFromIdx(
  sig: SimSignal,
  bars: Bar[],
  entryIdx: number,
  windowEndMs: number
): {
  exitIdx: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: SimTradeRow["exitReason"];
  hit: string;
  bestTargetReached: string;
  tp1HitIdx: number;
  tp2HitIdx: number;
  tp3HitIdx: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  activeStop: number;
  direction: "BUY" | "SELL";
  nBarsExamined: number;
  unresolved: boolean;
} | null {
  if (entryIdx < 0 || bars.length < 5) return null;
  const direction = sig.signal === "SELL" ? "SELL" : "BUY";
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.close;
  const sigEntry = sig.entry && sig.entry > 0 ? sig.entry : entryPrice;
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

  // Determine the last bar index within the window (inclusive).
  let end = Math.min(bars.length - 1, entryIdx);
  for (let i = bars.length - 1; i > entryIdx; i--) {
    if (Date.parse(bars[i].date) <= windowEndMs) { end = i; break; }
  }

  // Task 58: delegate the chronological TP/SL state machine to the SHARED
  // canonical helper (src/lib/latent/tp-sl-engine.ts). Pass the post-entry
  // bars as the scan window.
  const scanBars: TpSlBar[] = bars.slice(entryIdx + 1, end + 1);
  const r = simulateProgressiveTpSl({ direction, entryPrice, sl, tp1, tp2, tp3, bars: scanBars });

  // The helper's exitBarIdx is relative to scanBars; convert back to bars[] index.
  const exitIdx = r.exitBarIdx >= 0 ? entryIdx + 1 + r.exitBarIdx : end;

  return {
    exitIdx,
    entryPrice,
    exitPrice: r.exitPrice,
    exitReason: r.exitReason,
    hit: r.hit,
    bestTargetReached: r.bestTargetReached,
    tp1HitIdx: r.tp1HitIdx >= 0 ? entryIdx + 1 + r.tp1HitIdx : -1,
    tp2HitIdx: r.tp2HitIdx >= 0 ? entryIdx + 1 + r.tp2HitIdx : -1,
    tp3HitIdx: r.tp3HitIdx >= 0 ? entryIdx + 1 + r.tp3HitIdx : -1,
    sl, tp1, tp2, tp3,
    activeStop: r.activeStop,
    direction,
    nBarsExamined: r.nBarsExamined,
    unresolved: r.unresolved,
  };
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
  // Realized-compounding model (parallel trades allowed). entryAmount for a
  // trade = the REALIZED pool at its entry (capital + SIPs deposited before
  // this entry + P&L from trades that already CLOSED before this entry).
  // Trades still open when the next enters do NOT fund the next entry — this
  // honors "compounding" while allowing the same-day multi-stock trades the
  // user needs to fulfill numTrades.
  let realizedPool = capital;
  let wins = 0;
  let losses = 0;
  let cursor = 0; // rotating pointer into the shuffled signal pool
  let sipIdx = 0;
  // Trades entered but not yet closed at the time a later trade enters.
  const openTrades: { exitMs: number; netPnl: number }[] = [];

  for (let i = 0; i < numTrades; i++) {
    if (numSignalsAvailable === 0) break;
    const targetMs = targets[i];

    // Task 57: DETERMINISTIC entry — use the SINGLE nearest bar to targetMs
    // (findEntryIdx, NOT findEntryIdxList). Do NOT cherry-pick among multiple
    // candidate bars based on which one produces a TP/SL hit. Round-robin
    // through shuffled signals and pick the one whose nearest bar is closest
    // to targetMs (this is timestamp-based selection, NOT result-based).
    // The trade is ALWAYS recorded — unresolved (TIME_UP) trades are NOT
    // discarded (Phase 4: "Unresolved positions are not silently discarded").
    let pickedSig: SimSignal | null = null;
    let pickedBars: Bar[] = [];
    let pickedRes: ReturnType<typeof simulateFromIdx> = null;
    let pickedEntryIdx = -1;
    let pickedEntryMs = endMs;
    const triedThisSlot = new Set<string>();
    for (let attempt = 0; attempt < numSignalsAvailable; attempt++) {
      const candidate = shuffled[cursor % shuffled.length];
      cursor++;
      if (triedThisSlot.has(candidate.symbol)) continue;
      triedThisSlot.add(candidate.symbol);
      const candBars = await getBars(candidate.symbol);
      if (candBars.length < 5) continue;
      // Single deterministic nearest bar (no K-candidate cherry-picking).
      const entryIdx = findEntryIdx(candBars, targetMs, startMs, endMs);
      if (entryIdx < 0) continue;
      const r = simulateFromIdx(candidate, candBars, entryIdx, endMs);
      if (!r) continue; // bars < 5 or entryIdx < 0 (defensive)
      const entryMs = Date.parse(candBars[entryIdx].date);
      // Pick the signal whose entry bar is closest to targetMs (timestamp-based).
      if (!pickedRes || Math.abs(entryMs - targetMs) < Math.abs(pickedEntryMs - targetMs)) {
        pickedSig = candidate;
        pickedBars = candBars;
        pickedRes = r;
        pickedEntryIdx = entryIdx;
        pickedEntryMs = entryMs;
      }
      // Near-perfect (within a day) — stop scanning more signals to save DB reads.
      if (pickedRes && Math.abs(pickedEntryMs - targetMs) < 86400000) break;
    }
    if (!pickedRes || !pickedSig || pickedEntryIdx < 0) continue; // no in-window signal this slot (rare w/ 900 stocks)

    // REALIZE closes: move P&L from trades that closed at/before this entry
    // into the realized pool (so this trade's entry funds from realized gains
    // only — parallel trades don't borrow unrealized P&L).
    const stillOpen: { exitMs: number; netPnl: number }[] = [];
    for (const ot of openTrades) {
      if (ot.exitMs <= pickedEntryMs) realizedPool += ot.netPnl; // realize
      else stillOpen.push(ot);
    }
    openTrades.length = 0;
    openTrades.push(...stillOpen);

    // Apply any SIP deposits whose date is on/before this trade's entry bar
    // (SIPs are applied to the realized pool chronologically before the trade).
    while (sipIdx < sipDeposits.length && sipDeposits[sipIdx].date <= pickedEntryMs) {
      const dep = sipDeposits[sipIdx];
      realizedPool += dep.amount;
      rows.push({
        tradeNo: 0, // assigned after chronological sort
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
        bestTargetReached: "—",
        tp1HitIdx: -1, tp2HitIdx: -1, tp3HitIdx: -1,
        sl: 0, tp1: 0, tp2: 0, tp3: 0,
        activeStop: 0,
        entryAmount: dep.amount,
        pnl: 0,
        grossPnl: 0,
        totalGain: 0, // assigned after chronological sort
        exitAmount: dep.amount,
        returnPct: 0,
        isWin: false,
        unresolved: false,
        nBarsExamined: 0,
        confidence: 0,
      });
      sipIdx++;
    }

    // COMPOUNDING: this trade enters with the realized pool.
    const entryAmount = realizedPool;
    // Task 57: realized P&L uses the ACTUAL exit price (sl / tp3 / last close),
    // NOT the best-target price. This separates target attainment from ROI.
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
    // Task 57 Phase 2: isWin is based on REALIZED NET P&L > 0, NOT on the hit
    // field. A trade that touched TP2 then exited at SL has negative P&L → LOSS
    // (fixes the "tp3 hit and it still count my loss" bug — the old code used
    // hit==TP3/TP2/TP1 which counted TP-touch-then-SL as a win).
    const isWin = netPnl > 0;
    if (isWin) wins++;
    else losses++;

    const entryBarDateMs = Date.parse(pickedBars[pickedEntryIdx].date);
    const exitBarDateMs = Date.parse(pickedBars[pickedRes.exitIdx].date);
    // Track this trade as open; its P&L is realized when a later trade enters
    // after its exit (or at the end of the simulation).
    openTrades.push({ exitMs: exitBarDateMs, netPnl });

    rows.push({
      tradeNo: 0, // assigned after chronological sort
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
      bestTargetReached: pickedRes.bestTargetReached,
      tp1HitIdx: pickedRes.tp1HitIdx,
      tp2HitIdx: pickedRes.tp2HitIdx,
      tp3HitIdx: pickedRes.tp3HitIdx,
      sl: pickedRes.sl,
      tp1: pickedRes.tp1,
      tp2: pickedRes.tp2,
      tp3: pickedRes.tp3,
      activeStop: pickedRes.activeStop,
      entryAmount,
      pnl: netPnl,
      grossPnl,
      totalGain: 0, // assigned after chronological sort
      exitAmount,
      returnPct: entryAmount > 0 ? (netPnl / entryAmount) * 100 : 0,
      isWin,
      unresolved: pickedRes.unresolved,
      nBarsExamined: pickedRes.nBarsExamined,
      confidence: pickedSig.confidence ?? 0,
    });
  }

  // Realize any still-open trades' P&L into the pool (all close by window end).
  for (const ot of openTrades) realizedPool += ot.netPnl;
  openTrades.length = 0;

  // Apply any SIP deposits due AFTER the last trade's entry but within the
  // window (e.g. a SIP on the 1st when the last trade entered on the 28th).
  while (sipIdx < sipDeposits.length) {
    const dep = sipDeposits[sipIdx];
    realizedPool += dep.amount;
    rows.push({
      tradeNo: 0,
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
      bestTargetReached: "—",
      tp1HitIdx: -1, tp2HitIdx: -1, tp3HitIdx: -1,
      sl: 0, tp1: 0, tp2: 0, tp3: 0,
      activeStop: 0,
      entryAmount: dep.amount,
      pnl: 0,
      grossPnl: 0,
      totalGain: 0,
      exitAmount: dep.amount,
      returnPct: 0,
      isWin: false,
      unresolved: false,
      nBarsExamined: 0,
      confidence: 0,
    });
    sipIdx++;
  }

  // Sort chronologically for display (trades by entryDate, SIPs by their date)
  // and renumber tradeNo in chronological order. Then compute the cumulative
  // totalGain per row (sum of netPnl of all trades entered at or before this
  // row's date — a forward-running total so the user sees the running P&L).
  rows.sort((a, b) => (a.entryDate || 0) - (b.entryDate || 0));
  let cumGain = 0;
  for (const r of rows) {
    if (r.type === "TRADE") cumGain += r.pnl;
    r.totalGain = cumGain;
  }
  rows.forEach((r, idx) => { r.tradeNo = idx + 1; });

  const totalGain = cumGain; // = sum of all trades' net P&L
  const finalAmount = realizedPool; // = capital + totalSip + totalGain
  const totalPnl = totalGain;
  const totalReturnPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const tradeRows = rows.filter((r) => r.type === "TRADE");
  const tradeCount = tradeRows.length;
  const unresolvedCount = tradeRows.filter((r) => r.unresolved).length;
  const bestTargetAttainmentRate = tradeCount > 0
    ? tradeRows.filter((r) => r.bestTargetReached !== "—").length / tradeCount
    : 0;

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
    unresolvedCount,
    bestTargetAttainmentRate,
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
