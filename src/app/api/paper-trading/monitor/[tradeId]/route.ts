import { NextResponse } from "next/server";
import { buildMonitorPayload } from "@/lib/latent/paperMonitor";

// Task 107 v2 — Paper Trade Monitor detail API.
// GET /api/paper-trading/monitor/[tradeId]  (tradeId = base64url of
// "<decision_id>::<strategy>" as returned by the monitor list endpoint)
// Returns the single position plus its full context: signal origin, entry,
// levels, latest delayed snapshot with both timestamps, resolved-leg history,
// ambiguity flags, and cost/P&L estimates.
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await params;
  let key: string;
  try {
    key = Buffer.from(tradeId, "base64url").toString("utf8");
  } catch {
    return NextResponse.json({ error: "invalid_trade_id" }, { status: 400 });
  }
  try {
    const payload = await buildMonitorPayload();
    const pos = payload.positions.find((p) => `${p.decisionId}::${p.strategy}` === key);
    if (!pos) {
      return NextResponse.json({ error: "trade_not_found", tradeKey: key }, { status: 404 });
    }
    const fs = await import("fs");
    const path = await import("path");
    const eventsRoot = path.join(process.cwd(), "data/backtest_reports/task107/ops");
    let events: unknown[] = [];
    try {
      events = (JSON.parse(fs.readFileSync(path.join(eventsRoot, "event_ledger.json"), "utf8")) as unknown[])
        .filter((e) => (e as { trade_key?: string }).trade_key === key);
    } catch {
      events = [];
    }
    return NextResponse.json({
      position: pos,
      whereFrom: {
        signalOrigin: pos.signalSource,
        symbol: pos.symbol,
        model: pos.modelVersion,
        signalTime: pos.signalTime,
        horizonSessions: 21,
        strategy: pos.strategy,
        entryReason: "frozen-protocol shadow decision (BUY research direction)",
        entryPrice: pos.entryPrice,
      },
      whereGoing: {
        stopLoss: pos.sl,
        tp1: pos.tp1,
        tp2: pos.tp2,
        tp3: pos.tp3,
        latestObservedPrice: pos.latestPrice,
        highestTargetTouched: pos.bestTargetReached,
        distanceToNextTarget:
          pos.latestPrice != null && pos.tp1 != null
            ? Math.round((pos.tp1 - pos.latestPrice) * 100) / 100
            : null,
        distanceToStop:
          pos.latestPrice != null && pos.sl != null
            ? Math.round((pos.latestPrice - pos.sl) * 100) / 100
            : null,
        estimatedUnrealizedNetPnl: pos.estimatedUnrealizedNetPnl,
        status: pos.status,
      },
      detectedEvents: events,
      disclaimers: payload.disclaimers,
      banner: payload.banner,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "monitor_unavailable", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
