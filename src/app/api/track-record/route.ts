import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeTrackRecord, INSUFFICIENT_REAL_HISTORY } from "@/lib/latent/track-record";
import { MOCK_TRADES } from "@/lib/latent/mock-trades";
import type { Trade, TradeStatus, TradeHorizon, SignalDirection } from "@/lib/latent/types";

// Task 116 (C5): the track record is built from REAL persisted executions
// (ProspectivePaperTrade rows with state="closed" and isDemo=false — the
// deterministic forward-engine outcomes). When no genuine history exists the
// API says "Insufficient real history" — it never falls back to the synthetic
// fixture. The demo fixture remains available ONLY under ?demo=1 with a
// permanent SAMPLE/DEMO label so it can never pass as live performance.

function pctOf(netPnl: number, entryPrice: number | null, quantity: number | null): number | undefined {
  const cost = (entryPrice ?? 0) * (quantity ?? 0);
  if (cost <= 0) return undefined;
  return (netPnl / cost) * 100;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const demo = url.searchParams.get("demo") === "1";

  if (demo) {
    const stats = computeTrackRecord(MOCK_TRADES);
    const recentTrades = [...MOCK_TRADES]
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime())
      .slice(0, 25);
    return NextResponse.json({
      stats,
      trades: recentTrades,
      dataSource: "DEMO_FIXTURE",
      sampleLabel: "SAMPLE / DEMO DATA — synthetic fixture, not real performance",
      warning: "These trades are seeded demo fixtures and do not represent platform performance.",
    });
  }

  try {
    const closed = await db.prospectivePaperTrade.findMany({
      where: { state: "closed", isDemo: false },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    if (closed.length === 0) {
      return NextResponse.json({
        stats: null,
        trades: [],
        dataSource: "REAL_EXECUTIONS",
        message: INSUFFICIENT_REAL_HISTORY,
        detail:
          "No closed real executions yet. Forward shadow cohorts are tracked in the Model Performance report; the first matured fixed-horizon outcomes are reported there (Task 115: n=12, descriptive only).",
      });
    }
    const trades: Trade[] = closed.map((t) => {
      const netPnl = t.netPnl ?? 0;
      const status: TradeStatus = t.isWin === true ? "CLOSED_WIN" : t.isWin === false ? "CLOSED_LOSS" : "CLOSED_BREAKEVEN";
      const entry = t.entryPrice ?? null;
      const exitDate = t.updatedAt.toISOString();
      const entryDate = t.entryDate ? new Date(t.entryDate).toISOString() : t.createdAt.toISOString();
      const days = Math.max(
        1,
        Math.round((new Date(exitDate).getTime() - new Date(entryDate).getTime()) / 86_400_000)
      );
      return {
        id: t.id,
        signalId: t.sourcePredictionId,
        symbol: t.symbol,
        direction: "LONG" as SignalDirection, // long-only forward engine
        // forward-engine cohorts are multi-session by construction
        horizon: "SWING" as TradeHorizon,
        status,
        entryPrice: entry ?? 0,
        exitPrice: null,
        entryDate,
        exitDate,
        pnlPct: pctOf(netPnl, entry, t.quantity) ?? null,
        pnlPkr: netPnl,
        timeToCloseDays: days,
      } as Trade;
    });
    return NextResponse.json({
      stats: computeTrackRecord(trades),
      trades: trades.slice(0, 25),
      dataSource: "REAL_EXECUTIONS",
    });
  } catch (err) {
    console.error("[/api/track-record] real history unavailable:", err);
    return NextResponse.json({
      stats: null,
      trades: [],
      dataSource: "REAL_EXECUTIONS",
      message: INSUFFICIENT_REAL_HISTORY,
    });
  }
}
