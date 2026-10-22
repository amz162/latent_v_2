import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/latent/backtest";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/backtest/investment-simulator
//   ?capital=100000&periodValue=3&periodUnit=month&monthlySip=5000
//
// Runs the trade-by-trade simulation on the FINAL ENSEMBLE CONSENSUS signals
// (from /api/signals/all) + the OhlcvBar DB (100 KSE-100 stocks), picking
// numTrades signals RANDOMLY (seeded), trading on ALL stock data (not just 8),
// each trade using the final-ensemble-consensus entry/SL/TP1/2/3. Derives
// numDays from the user's time-period input (day=1, month=21, year=252 trading
// days per unit). Optional monthly SIP adds to the total capital pool.
//
// Returns the SimResponse schema expected by the Tracker Investment Simulator UI.

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

  const numDays = periodValue * (UNIT_DAYS[periodUnit] || 21);
  const numMonths =
    periodUnit === "month" ? periodValue : periodUnit === "year" ? periodValue * 12 : Math.max(1, Math.round(numDays / 21));
  const totalSipContribution = monthlySip * numMonths;
  const totalCapital = capital + totalSipContribution;
  const amountPerTrade = totalCapital / 10; // 10 concurrent positions worth
  const numTrades = 40;
  const seed = Date.now();

  // Load final-consensus signals (all ~284 stocks)
  let signals: Array<{ symbol: string; signal: "BUY" | "SELL"; confidence: number }> = [];
  try {
    const r = await fetch("http://127.0.0.1:3000/api/signals/all", { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      signals = (j.signals || []).map((s: any) => ({
        symbol: s.symbol,
        signal: s.signal as "BUY" | "SELL",
        confidence: s.confidence,
      }));
    }
  } catch {}
  // Filter to backed-up symbols (have DB history)
  let numSignalsAvailable = signals.length;
  try {
    const backed = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });
    const set = new Set(backed.map((b) => b.symbol));
    const filtered = signals.filter((s) => set.has(s.symbol));
    if (filtered.length > 0) { signals = filtered; numSignalsAvailable = signals.length; }
  } catch {}
  if (signals.length === 0) {
    return NextResponse.json({ error: "No signals available to simulate" }, { status: 503 });
  }

  // Seeded shuffle (deterministic per seed, random not alphabetical)
  let s = seed;
  const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const shuffled = [...signals].sort(() => rng() - 0.5);

  const result = await runBacktest({
    startingCapital: capital, // runBacktest adds sipTotal internally
    amountPerTrade,
    numTrades: Math.min(numTrades, shuffled.length),
    numDays,
    monthlySip,
    periodUnit,
    signals: shuffled,
  });

  // Map to the UI's SimResponse schema
  const trades = result.trades.map((t, i) => {
    const reasonMap: Record<string, string> = {
      TP3: "TP3_HIT", TP2: "TP2_HIT", TP1: "TP1_HIT", SL: "SL_HIT", TIME: "TIME_UP", NO_DATA: "TIME_UP",
    };
    const shares = t.entryPrice > 0 ? amountPerTrade / t.entryPrice : 0;
    const netPnl = t.netPnlPkr;
    const netPnlPct = amountPerTrade > 0 ? (netPnl / amountPerTrade) * 100 : 0;
    return {
      tradeNo: i + 1,
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
      shares,
      notional: amountPerTrade,
      netPnl,
      netPnlPct,
      isWin: netPnl > 0,
    };
  });

  const m = result.metrics;
  const metrics = {
    startingCapital: m.startingCapital,
    amountPerTrade: m.amountPerTrade,
    totalTrades: m.totalTrades,
    numDays: m.days,
    winTrades: m.winTrades,
    lossTrades: m.lossTrades,
    winRate: m.winRate,
    avgWinPct: m.amountPerTrade > 0 ? (m.avgWinPkr / m.amountPerTrade) * 100 : 0,
    avgLossPct: m.amountPerTrade > 0 ? (m.avgLossPkr / m.amountPerTrade) * 100 : 0,
    grossProfit: m.grossProfit,
    grossLoss: m.grossLoss,
    totalCosts: m.totalCosts,
    grossBeforeCosts: m.grossBeforeCosts,
    netPnL: m.netPnl,
    finalValue: m.finalPortfolioValue,
    roiPct: m.roi,
    maxDrawdownPct: m.maxDrawdown,
    profitFactor: m.profitFactor,
    sharpe: m.sharpe,
    sortino: m.sortino,
    equityCurve: result.equityCurve.map((p) => ({ tradeNo: p.trade, value: p.equity })),
  };

  const config = {
    initialCapital: capital,
    periodValue,
    periodUnit,
    monthlySip,
    numDays,
    numMonths,
    totalSipContribution,
    totalCapital,
    amountPerTrade,
    numSignalsAvailable,
    numTrades: result.trades.length,
    seed,
  };

  // Flat aliases — subagent 4's results render reads these top-level fields
  // (initialAmount, finalAmount, totalPnl, totalReturnPct, wins, losses, rows)
  // in addition to the nested config/metrics/trades.
  return NextResponse.json({
    config,
    metrics,
    trades,
    // flat aliases for the render:
    initialAmount: capital,
    finalAmount: metrics.finalValue,
    totalPnl: metrics.netPnL,
    totalReturnPct: metrics.roiPct,
    wins: metrics.winTrades,
    losses: metrics.lossTrades,
    rows: trades,
    cached: false,
  });
}
