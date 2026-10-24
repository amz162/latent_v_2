import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/latent/backtest";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/backtest/investment-simulator
//   ?capital=100000&periodValue=3&periodUnit=month&monthlySip=5000
//   &numTrades=40&minConfidence=70&direction=BOTH
//
// Runs a CONSECUTIVE MONTHLY SEQUENTIAL trade-by-trade simulation on the FINAL
// ENSEMBLE CONSENSUS signals (from /api/signals/all) + the OhlcvBar DB:
//  - The investment period is split into consecutive months (numMonths).
//  - Each month: the optional SIP deposit is added first (rendered as its own
//    amber "SIP deposit" row), then that month's trades execute in sequence.
//  - numTrades is distributed across the months (remainder in early months).
//  - Filters: minConfidence (signal confidence >= N) and direction
//    (BOTH | LONG → BUY | SHORT → SELL).
//  - Each trade uses the final-ensemble-consensus entry/SL/TP1/2/3 on ALL
//    stock data in the DB (find-entry-bar methodology, see backtest.ts).
//
// Returns the flat SimResponse schema the Tracker Investment Simulator UI
// renders (initialAmount, finalAmount, totalPnl, totalReturnPct, wins, losses,
// rows) PLUS totalSip + totalInvested (shown in the simulation summary) and
// the nested config/metrics for compatibility.

type PeriodUnit = "day" | "month" | "year";
const UNIT_DAYS: Record<PeriodUnit, number> = { day: 1, month: 21, year: 252 };

function toEpochMs(date: string): number {
  const t = Date.parse(date);
  return isNaN(t) ? 0 : t;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const capital = parseFloat(url.searchParams.get("capital") || "100000") || 100000;
  const periodValue = parseInt(url.searchParams.get("periodValue") || "3", 10) || 3;
  const periodUnit = (url.searchParams.get("periodUnit") as PeriodUnit) || "month";
  const monthlySip = parseFloat(url.searchParams.get("monthlySip") || "0") || 0;
  const numTradesReq = parseInt(url.searchParams.get("numTrades") || "40", 10) || 40;
  const minConfidence = parseFloat(url.searchParams.get("minConfidence") || "0") || 0;
  const direction = (url.searchParams.get("direction") || "BOTH").toUpperCase(); // BOTH | LONG | SHORT

  const numTrades = Math.max(1, Math.min(500, numTradesReq));
  const numDays = periodValue * (UNIT_DAYS[periodUnit] || 21);
  const numMonths =
    periodUnit === "month"
      ? Math.max(1, periodValue)
      : periodUnit === "year"
        ? Math.max(1, periodValue * 12)
        : Math.max(1, Math.round(numDays / 21));
  const totalSip = monthlySip * numMonths;
  const totalInvested = capital + totalSip;
  const amountPerTrade = totalInvested / numTrades; // equal slice of the full pool
  const seed = Date.now();

  // Load final-consensus signals (all ~284 stocks) WITH their absolute levels.
  let signals: Array<{
    symbol: string;
    signal: "BUY" | "SELL";
    confidence: number;
    entry?: number;
    sl?: number;
    tp1?: number;
    tp2?: number;
    tp3?: number;
  }> = [];
  try {
    const r = await fetch("http://127.0.0.1:3000/api/signals/all", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      signals = (j.signals || []).map((s: any) => ({
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
  let numSignalsAvailable = signals.length;

  // Filter to DB-backed symbols (have history to trade on)
  try {
    const backed = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });
    const set = new Set(backed.map((b) => b.symbol));
    signals = signals.filter((s) => set.has(s.symbol));
  } catch {}
  numSignalsAvailable = signals.length;

  // Min-confidence filter
  if (minConfidence > 0) {
    signals = signals.filter((s) => (s.confidence ?? 0) >= minConfidence);
  }
  // Direction filter: LONG → BUY signals, SHORT → SELL signals, BOTH → all
  if (direction === "LONG") signals = signals.filter((s) => s.signal === "BUY");
  if (direction === "SHORT") signals = signals.filter((s) => s.signal === "SELL");

  if (signals.length === 0) {
    return NextResponse.json(
      {
        error:
          minConfidence > 0 || direction !== "BOTH"
            ? `No signals match the filters (min confidence ${minConfidence}, direction ${direction}). Lower the confidence or switch direction to BOTH.`
            : "No signals available to simulate",
      },
      { status: 503 },
    );
  }

  // Seeded shuffle (deterministic per seed, random not alphabetical)
  let s = seed;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const shuffled = [...signals].sort(() => rng() - 0.5);

  // Distribute numTrades across the consecutive months (remainder in early months)
  const basePerMonth = Math.floor(numTrades / numMonths);
  const remainder = numTrades % numMonths;

  // ── Consecutive monthly sequential simulation ──
  const monthTradesLists: Awaited<ReturnType<typeof runBacktest>>["trades"][] = [];
  let cursor = 0; // rotating pointer into the shuffled signal pool
  for (let m = 1; m <= numMonths; m++) {
    const monthCount = basePerMonth + (m <= remainder ? 1 : 0);
    const monthSignals: typeof signals = [];
    for (let i = 0; i < monthCount; i++) {
      monthSignals.push(shuffled[cursor % shuffled.length]);
      cursor++;
    }
    if (monthSignals.length === 0) {
      monthTradesLists.push([]);
      continue;
    }
    // Each month runs its own slice of trades on the same per-trade budget.
    // SIP accounting happens at route level (rows + totals) so runBacktest is
    // called with monthlySip 0 and the base capital to avoid double counting.
    const result = await runBacktest({
      startingCapital: capital,
      amountPerTrade,
      numTrades: monthSignals.length,
      numDays,
      monthlySip: 0,
      periodUnit,
      signals: monthSignals,
    });
    monthTradesLists.push(result.trades);
  }

  // ── Build the ordered rows (month by month: SIP row first, then trades) ──
  interface OutRow {
    tradeNo: number;
    type: "TRADE" | "SIP";
    month: number;
    date: number;
    symbol: string;
    side: "BUY" | "SELL" | "SIP";
    direction: "LONG" | "SHORT" | "SIP";
    entryDate: number;
    entryPrice: number;
    exitDate: number;
    exitPrice: number;
    exitReason: string;
    sl: number;
    tp1: number;
    tp2: number;
    tp3: number;
    entryAmount: number;
    exitAmount: number;
    returnPct: number;
    pnl: number;
    isWin: boolean;
  }
  const rows: OutRow[] = [];
  const reasonMap: Record<string, string> = {
    TP3: "TP3_HIT",
    TP2: "TP2_HIT",
    TP1: "TP1_HIT",
    SL: "SL_HIT",
    TIME: "TIME_UP",
    NO_DATA: "TIME_UP",
  };

  let tradeNo = 0;
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  let runningEquity = capital;
  let peak = capital;
  let maxDrawdownPct = 0;
  const allTrades = monthTradesLists.flat();

  for (let m = 1; m <= numMonths; m++) {
    // SIP deposit row at the start of each month
    if (monthlySip > 0) {
      tradeNo++;
      rows.push({
        tradeNo,
        type: "SIP",
        month: m,
        date: 0,
        symbol: `Month ${m}`,
        side: "SIP",
        direction: "SIP",
        entryDate: 0,
        entryPrice: 0,
        exitDate: 0,
        exitPrice: 0,
        exitReason: "SIP_DEPOSIT",
        sl: 0,
        tp1: 0,
        tp2: 0,
        tp3: 0,
        entryAmount: monthlySip,
        exitAmount: monthlySip,
        returnPct: 0,
        pnl: 0,
        isWin: false,
      });
      runningEquity += monthlySip;
      peak = Math.max(peak, runningEquity);
    }
    // That month's trades, in sequence
    for (const t of monthTradesLists[m - 1] || []) {
      tradeNo++;
      const entryAmount = t.invested || amountPerTrade;
      const pnl = t.netPnlPkr;
      const returnPct = entryAmount > 0 ? (pnl / entryAmount) * 100 : 0;
      const exitAmount = entryAmount + pnl;
      totalPnl += pnl;
      if (pnl > 0) wins++;
      else losses++;
      runningEquity += pnl;
      peak = Math.max(peak, runningEquity);
      const dd = peak > 0 ? ((peak - runningEquity) / peak) * 100 : 0;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      rows.push({
        tradeNo,
        type: "TRADE",
        month: m,
        date: toEpochMs(t.entryDate),
        symbol: t.symbol,
        side: t.direction,
        direction: t.direction === "BUY" ? "LONG" : "SHORT",
        entryDate: toEpochMs(t.entryDate),
        entryPrice: t.entryPrice,
        exitDate: t.exitDate ? toEpochMs(t.exitDate) : 0,
        exitPrice: t.exitPrice ?? 0,
        exitReason: reasonMap[t.exitReason] || "TIME_UP",
        sl: t.sl,
        tp1: t.tp1,
        tp2: t.tp2,
        tp3: t.tp3,
        entryAmount,
        exitAmount,
        returnPct,
        pnl,
        isWin: pnl > 0,
      });
    }
  }

  const totalTrades = allTrades.length;
  const grossProfit = allTrades.filter((t) => t.netPnlPkr > 0).reduce((a, t) => a + t.netPnlPkr, 0);
  const grossLoss = Math.abs(allTrades.filter((t) => t.netPnlPkr <= 0).reduce((a, t) => a + t.netPnlPkr, 0));
  const finalAmount = capital + totalSip + totalPnl;
  const totalReturnPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  const metrics = {
    startingCapital: capital,
    amountPerTrade,
    totalTrades,
    numDays,
    numMonths,
    tradesPerMonth: basePerMonth,
    winTrades: wins,
    lossTrades: losses,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    grossProfit,
    grossLoss,
    totalCosts: allTrades.reduce((a, t) => a + (t.costPkr || 0), 0),
    netPnL: totalPnl,
    finalValue: finalAmount,
    roiPct: totalReturnPct,
    maxDrawdownPct,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0,
    // Running equity per trade, in row order (SIP deposits raise the pool too)
    equityCurve: (() => {
      let eq = capital;
      const curve: { tradeNo: number; value: number }[] = [];
      for (const r of rows) {
        if (r.type === "SIP") {
          eq += r.entryAmount;
          continue;
        }
        eq += r.pnl;
        curve.push({ tradeNo: r.tradeNo, value: eq });
      }
      return curve;
    })(),
  };

  const config = {
    initialCapital: capital,
    periodValue,
    periodUnit,
    monthlySip,
    numDays,
    numMonths,
    numTrades,
    tradesPerMonth: basePerMonth,
    minConfidence,
    direction,
    totalSip,
    totalInvested,
    amountPerTrade,
    numSignalsAvailable,
    seed,
  };

  // Flat aliases — the Tracker results render reads these top-level fields
  // (initialAmount, finalAmount, totalPnl, totalReturnPct, wins, losses, rows)
  // plus totalSip + totalInvested for the simulation summary.
  return NextResponse.json({
    config,
    metrics,
    // flat aliases for the render:
    initialAmount: capital,
    finalAmount,
    totalPnl,
    totalReturnPct,
    wins,
    losses,
    totalSip,
    totalInvested,
    tradeCount: totalTrades,
    rows,
    cached: false,
  });
}
