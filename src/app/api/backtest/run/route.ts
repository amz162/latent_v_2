import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/latent/backtest";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/backtest/run
// Body: { startingCapital, amountPerTrade, numTrades, numDays, monthlySip?, periodUnit? }
// Runs the trade-by-trade simulation on the FINAL ENSEMBLE CONSENSUS signals
// (fetched from /api/signals/all) + the OhlcvBar DB history (all KSE-100
// stocks), picking numTrades signals RANDOMLY. Returns per-trade list +
// metrics + equity curve.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const startingCapital = Number(body.startingCapital) || 100000;
    const amountPerTrade = Number(body.amountPerTrade) || 10000;
    const numTrades = Math.min(500, Math.max(1, Number(body.numTrades) || 50));
    const numDays = Math.min(60, Math.max(1, Number(body.numDays) || 5));
    const monthlySip = Number(body.monthlySip) || 0;
    const periodUnit = (body.periodUnit as "day" | "month" | "year") || "day";

    // Fetch the final-consensus signal list (all ~284 stocks)
    const sigRes = await fetch("http://127.0.0.1:3000/api/signals/all", { cache: "no-store" });
    if (!sigRes.ok) {
      return NextResponse.json({ error: "Failed to load signals" }, { status: 502 });
    }
    const sigData = await sigRes.json();
    const allSignals = (sigData.signals || []).map((s: any) => ({
      symbol: s.symbol,
      signal: s.signal as "BUY" | "SELL",
      confidence: s.confidence,
    }));
    if (allSignals.length === 0) {
      return NextResponse.json({ error: "No signals available to simulate" }, { status: 503 });
    }

    // Filter to symbols that have DB history (so every simulated trade has
    // OHLCV to walk through). The KSE-100 backup covers ~100 stocks; signals
    // for non-backed-up symbols are skipped.
    let signals = allSignals;
    try {
      const backed = await db.ohlcvBar.findMany({
        select: { symbol: true },
        distinct: ["symbol"],
      });
      const set = new Set(backed.map((b) => b.symbol));
      signals = allSignals.filter((s: any) => set.has(s.symbol));
      if (signals.length === 0) signals = allSignals; // fallback (route will skip missing)
    } catch {}

    const result = await runBacktest({
      startingCapital,
      amountPerTrade,
      numTrades,
      numDays,
      monthlySip,
      periodUnit,
      signals,
    });
    return NextResponse.json({ ...result, cached: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "backtest failed" }, { status: 500 });
  }
}
