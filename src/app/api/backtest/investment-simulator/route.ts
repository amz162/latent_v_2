import { NextResponse } from "next/server";
import { runInvestmentSimulation, type PeriodUnit } from "@/lib/latent/investment-simulator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/backtest/investment-simulator
//   ?capital=100000&periodValue=3&periodUnit=month&monthlySip=5000
//   &numTrades=40&minConfidence=70&direction=BOTH
//
// Chronological COMPOUNDING investment simulation (per the user spec):
//   - Go back periodValue units from now (month unit → 1st of that month,
//     e.g. now=Oct + 3 months → start July 1st) and start trading forward.
//   - Trade 1 entry = the user's initial capital. Net P&L is added to the
//     pool. Trade 2 entry = trade 1's exit amount. And so on (compounding).
//   - At the start of each month M >= 2, add monthlySip to the pool (amber
//     "Month M deposit" row).
//   - Each trade picks a final-consensus signal (BUY/SELL), enters at the
//     first bar after the previous trade's exit (chronological progression),
//     holds up to holdBars (= period trading days / numTrades), exits at
//     TP3 > TP2 > TP1 > SL > time-up (the TP rule).
//   - Per-trade costs: broker commission 0.15% × entry × 2 (both sides),
//     slippage 0.5% × entry, CGT 15% on gross profit.
//
// Returns the flat SimResponse schema the Tracker Investment Simulator UI
// renders: initialAmount, finalAmount, totalPnl, totalReturnPct, totalGain,
// wins, losses, totalSip, totalInvested, tradeCount, rows (each row carries
// hit/sl/tp1-3/entryAmount/pnl/totalGain/exitAmount + entry&exit date+price)
// + startDate/endDate + the nested config for compatibility.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const capital = parseFloat(url.searchParams.get("capital") || "100000") || 100000;
  const periodValue = parseInt(url.searchParams.get("periodValue") || "3", 10) || 3;
  const periodUnit = (url.searchParams.get("periodUnit") as PeriodUnit) || "month";
  const monthlySip = parseFloat(url.searchParams.get("monthlySip") || "0") || 0;
  const numTradesReq = parseInt(url.searchParams.get("numTrades") || "40", 10) || 40;
  const minConfidence = parseFloat(url.searchParams.get("minConfidence") || "0") || 0;
  const direction = (url.searchParams.get("direction") || "BOTH").toUpperCase() as "BOTH" | "LONG" | "SHORT";
  const numTrades = Math.max(1, Math.min(500, numTradesReq));

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

  if (signals.length === 0) {
    return NextResponse.json(
      { error: "No signals available to simulate (the signals API returned no actionable signals)." },
      { status: 503 },
    );
  }

  try {
    const result = await runInvestmentSimulation({
      capital,
      periodValue,
      periodUnit,
      monthlySip,
      numTrades,
      minConfidence,
      direction,
      signals,
    });

    if (result.tradeCount === 0) {
      return NextResponse.json(
        {
          error:
            minConfidence > 0 || direction !== "BOTH"
              ? `No trades executed — the filters (min confidence ${minConfidence}, direction ${direction}) matched no DB-backed symbols. Lower the confidence or switch direction to BOTH.`
              : "No trades executed — the signal symbols have no OHLCV history in the DB.",
        },
        { status: 503 },
      );
    }

    // Flat aliases the Tracker UI renders read directly.
    return NextResponse.json({
      ...result,
      initialAmount: result.initialAmount,
      finalAmount: result.finalAmount,
      totalPnl: result.totalPnl,
      totalReturnPct: result.totalReturnPct,
      totalGain: result.totalGain,
      wins: result.wins,
      losses: result.losses,
      totalSip: result.totalSip,
      totalInvested: result.totalInvested,
      tradeCount: result.tradeCount,
      rows: result.rows,
      startDate: result.startDate,
      endDate: result.endDate,
      config: result.config,
      cached: false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Simulation failed" }, { status: 500 });
  }
}
