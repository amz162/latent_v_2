import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { simulateProgressiveTpSl } from "@/lib/latent/tp-sl-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/backtest/signal-stats?days=30
//
// Reconstructs the LAST-N-DAY performance of the Signal tab's CURRENT
// final-consensus signals across ALL stocks in the OhlcvBar DB — the four
// stat cards under the Investment Simulator in the Signal Tracker.
//
// Why reconstruct (no persistent signal history): signals are computed LIVE
// by /api/signals/all — there is no stored "signal from 26 Sept" row. So we
// take today's signals (entry/SL/TP1/TP2/TP3 per stock), replay each one over
// the OHLCV window [today − days, today] using the SAME TP-rule as the
// investment simulator (TP3 > TP2 > TP1 > SL; skips if nothing hit = ACTIVE),
// and aggregate:
//   total        — all actionable signals (BUY/SELL with entry) attempted
//   closed       — signals that hit a TP or SL within the window
//   wins/losses  — closed signals that hit a TP / hit SL
//   winRate      — wins / closed × 100
//   avgReturnPct — mean signed % return of closed trades (after costs)
//   bestPct/worstPct — max/min closed-trade return
//   stocksInDb   — distinct symbols in OhlcvBar (the "all stocks in our
//                  database" count the UI label shows)
//   dataSourceDate — latest OhlcvBar date (for the freshness chip later)
//
// Costs match the investment simulator: commission 0.15%×2, slippage 0.15%,
// CGT 15% on gross profit.

const COMMISSION_RATE = 0.0015;
const SLIPPAGE_RATE = 0.0015;
const CGT_RATE = 0.15;

interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SignalIn {
  symbol: string;
  signal: "BUY" | "SELL";
  confidence?: number;
  entry?: number;
  sl?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
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

// Replay ONE signal over its bars (already filtered to the window). Enters at
// the first bar's close; uses the signal's absolute SL/TP1/TP2/TP3 levels
// (ATR-derived if missing); delegates the chronological TP/SL state machine
// to the SHARED canonical helper (src/lib/latent/tp-sl-engine.ts — Task 58).
// ALWAYS returns a result — unresolved (TIME_UP) trades are NOT discarded.
// Returns null only if bars.length < 5 (defensive).
function replaySignal(sig: SignalIn, bars: Bar[]): {
  hit: "TP3" | "TP2" | "TP1" | "SL" | "—"; // backward-compat: TP3 for TP3 exit, SL for any SL exit, — for time-up
  bestTargetReached: "TP3" | "TP2" | "TP1" | "—"; // Task 58: canonical
  exitReason: "TP3_HIT" | "SL_HIT" | "SL_AFTER_TP1" | "SL_AFTER_TP2" | "TIME_UP"; // Task 58: canonical (distinguishes SL_AFTER_TP1/TP2)
  entryPrice: number;
  exitPrice: number;
  returnPct: number; // realized net % (after costs)
  unresolved: boolean; // Task 58: true if TIME_UP
  nBarsExamined: number; // Task 58: candles scanned after entry
} | null {
  if (bars.length < 5) return null;
  const direction = sig.signal === "SELL" ? "SELL" : "BUY";
  const entryIdx = 0; // first bar in the window (deterministic — no cherry-picking)
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.close;
  const sigEntry = sig.entry && sig.entry > 0 ? sig.entry : entryPrice;
  const atrSlice = bars.slice(0, Math.min(14, bars.length));
  const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entryPrice * 0.02;

  const slDist = sig.sl && sig.sl > 0 ? Math.abs(sigEntry - sig.sl) : atrVal * 1.5;
  const tp1Dist = sig.tp1 && sig.tp1 > 0 ? Math.abs(sig.tp1 - sigEntry) : atrVal;
  const tp2Dist = sig.tp2 && sig.tp2 > 0 ? Math.abs(sig.tp2 - sigEntry) : 2 * atrVal;
  const tp3Dist = sig.tp3 && sig.tp3 > 0 ? Math.abs(sig.tp3 - sigEntry) : 3 * atrVal;

  const sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
  const tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
  const tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
  const tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;

  // Task 58: delegate to the SHARED canonical TP/SL state machine.
  // scanBars = all bars AFTER the entry bar (the entry is at idx 0).
  const scanBars = bars.slice(1);
  const tpSl = simulateProgressiveTpSl({ direction, entryPrice, sl, tp1, tp2, tp3, bars: scanBars });
  const exitPrice = tpSl.exitPrice;

  // Per-trade costs: commission both sides + slippage (as % of entry); CGT on
  // the gross profit (as % of entry = grossPct × CGT_RATE).
  const grossPct = direction === "BUY"
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;
  const costPct = (COMMISSION_RATE * 2 + SLIPPAGE_RATE) * 100;
  const cgtPct = grossPct > 0 ? grossPct * CGT_RATE : 0;
  const netPct = grossPct - costPct - cgtPct;
  // Map canonical hit → legacy "TP3"|"TP2"|"TP1"|"SL"|"—" (backward compat).
  const hitLegacy: "TP3" | "TP2" | "TP1" | "SL" | "—" =
    tpSl.exitReason === "TP3_HIT" ? "TP3"
    : tpSl.exitReason === "TIME_UP" ? "—"
    : "SL"; // SL_HIT, SL_AFTER_TP1, SL_AFTER_TP2 → "SL"
  return {
    hit: hitLegacy,
    bestTargetReached: tpSl.bestTargetReached,
    exitReason: tpSl.exitReason,
    entryPrice,
    exitPrice,
    returnPct: netPct,
    unresolved: tpSl.unresolved,
    nBarsExamined: tpSl.nBarsExamined,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") || "30", 10) || 30));

  // Window: [today − days, today] in YYYY-MM-DD strings for the date column.
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = now.toISOString().slice(0, 10);

  // 1. Pull current final-consensus signals from /api/signals/all.
  let signals: SignalIn[] = [];
  try {
    const r = await fetch("http://127.0.0.1:3000/api/signals/all", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      signals = (j.signals || [])
        .filter((s: any) => s && s.symbol && (s.signal === "BUY" || s.signal === "SELL") && s.entry && s.entry > 0)
        .map((s: any) => ({
          symbol: s.symbol,
          signal: s.signal as "BUY" | "SELL",
          confidence: s.confidence ?? 0,
          entry: s.entry,
          sl: s.sl,
          tp1: s.tp1,
          tp2: s.tp2,
          tp3: s.tp3,
        }));
    }
  } catch {}

  if (signals.length === 0) {
    return NextResponse.json(
      {
        total: 0, closed: 0, wins: 0, losses: 0, winRate: 0,
        avgReturnPct: 0, bestPct: 0, worstPct: 0,
        stocksInDb: 0, dataSourceDate: null, days, error: "No actionable signals available.",
      },
      { status: 200 },
    );
  }

  // 2. Fetch ALL OhlcvBar rows in the window for these symbols in ONE query,
  //    then group by symbol in memory (much faster than N per-symbol queries).
  const symbols = Array.from(new Set(signals.map((s) => s.symbol)));
  let barsBySymbol = new Map<string, Bar[]>();
  let stocksInDb = 0;
  let dataSourceDate: string | null = null;
  try {
    const rows = await db.ohlcvBar.findMany({
      where: { symbol: { in: symbols }, date: { gte: startStr, lte: endStr } },
      orderBy: { date: "asc" },
    });
    barsBySymbol = new Map();
    for (const r of rows) {
      let arr = barsBySymbol.get(r.symbol);
      if (!arr) { arr = []; barsBySymbol.set(r.symbol, arr); }
      arr.push({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close });
    }
    // stocksInDb (distinct symbols in the whole DB) + dataSourceDate (latest
    // bar date) — for the "all stocks in our database" label + freshness chip.
    const distinctRows = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });
    const latestRows = await db.ohlcvBar.findMany({ select: { date: true }, orderBy: { date: "desc" }, take: 1 });
    stocksInDb = distinctRows.length;
    dataSourceDate = latestRows[0]?.date ?? null;
  } catch (e) {
    return NextResponse.json(
      { total: 0, closed: 0, wins: 0, losses: 0, winRate: 0, avgReturnPct: 0, bestPct: 0, worstPct: 0, stocksInDb: 0, dataSourceDate: null, days, error: "DB read failed." },
      { status: 200 },
    );
  }

  // 3. Replay each signal over its windowed bars.
  // Task 58: replaySignal now ALWAYS returns a result (TIME_UP for unresolved,
  // NOT discarded). Wins are based on realized net P&L (returnPct > 0), NOT on
  // the hit field — consistent with investment-simulator + backtest.ts.
  let total = 0;
  let closed = 0;
  let unresolvedCount = 0;
  let wins = 0;
  let losses = 0;
  let sumReturn = 0;
  let sumReturnInclUnresolved = 0;
  let best = -Infinity;
  let worst = Infinity;
  for (const sig of signals) {
    const bars = barsBySymbol.get(sig.symbol) || [];
    if (bars.length < 5) continue; // no in-window history for this symbol
    total++;
    const res = replaySignal(sig, bars);
    if (!res) continue; // defensive (bars.length < 5 already checked)
    if (res.unresolved) {
      unresolvedCount++;
    } else {
      closed++; // resolved SL/TP3 exit (backward-compat definition of "closed")
    }
    // Task 58: win/loss by REALIZED NET P&L (was: hit === TP3/TP2/TP1).
    if (res.returnPct > 0) wins++;
    else losses++;
    sumReturn += res.returnPct;
    sumReturnInclUnresolved += res.returnPct;
    if (res.returnPct > best) best = res.returnPct;
    if (res.returnPct < worst) worst = res.returnPct;
  }
  if (closed === 0) { best = 0; worst = 0; }
  if (!Number.isFinite(best)) best = 0;
  if (!Number.isFinite(worst)) worst = 0;

  const winRate = total > 0 ? (wins / total) * 100 : 0; // Task 58: over TOTAL (incl unresolved)
  const avgReturnPct = total > 0 ? sumReturnInclUnresolved / total : 0;

  return NextResponse.json({
    total,
    closed, // resolved SL/TP3 exits (backward-compat)
    unresolvedCount, // Task 58: TIME_UP count (not discarded)
    wins,
    losses,
    winRate: Math.round(winRate * 100) / 100,
    avgReturnPct: Math.round(avgReturnPct * 100) / 100,
    bestPct: Math.round(best * 100) / 100,
    worstPct: Math.round(worst * 100) / 100,
    stocksInDb,
    dataSourceDate,
    days,
    windowStart: startStr,
    windowEnd: endStr,
    cached: false,
    note: "Task 58: win/loss now based on realized net P&L (returnPct > 0), not the TP/SL hit field — consistent with investment-simulator + backtest.ts. Unresolved (TIME_UP) trades are NOT discarded — winRate + avgReturnPct are over TOTAL (closed + unresolved). This is an illustrative current-signal replay over the last `days` window, NOT a genuine walk-forward ML evaluation.",
  });
}
