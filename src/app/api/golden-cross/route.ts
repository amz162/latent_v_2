import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computeGoldenCross,
  runGoldenCrossPortfolio,
  barIsValid,
  GC_STRATEGY_ID,
  GC_STATUS,
  MA_FAST,
  MA_SLOW,
  MIN_SESSION_SYMBOLS,
} from "@/lib/latent/golden-cross";
import type { Bar } from "@/lib/latent/golden-cross";

// Task 110 — Golden Cross (7/30 SMA) research dashboard API.
// RESEARCH / BACKTEST ONLY: single-symbol cash-constrained simulation over the
// real OhlcvBar history using the production V2 cost engine. Signal at close t
// fills at the next global session open; unfilled signals are never
// fabricated. No order execution exists anywhere behind this route.
export const dynamic = "force-dynamic";

const SERIES_TAIL = 500;
const LEDGER_TAIL = 250;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const symbol = (sp.get("symbol") || "HUBC").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const capital = Math.max(1000, Number(sp.get("capital")) || 100000);
    const sizingPct = Math.min(100, Math.max(1, Number(sp.get("sizing")) || 20)) / 100;
    const maxPositions = Math.min(20, Math.max(1, Number(sp.get("maxPos")) || 5));
    const taxProfile = sp.get("tax") === "NON_ATL_30" ? "NON_ATL_30" : "ATL_15";

    const rows = await db.ohlcvBar.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true },
    });
    if (rows.length < MA_SLOW + 5) {
      return NextResponse.json({ error: "insufficient_history", symbol }, { status: 404 });
    }
    const bars: Bar[] = rows.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      valid: barIsValid(r),
    }));
    // global session calendar — identical rule to the research artifacts
    const calRows = await db.$queryRaw<Array<{ date: string; n: number }>>`
      SELECT date, COUNT(*) as n FROM OhlcvBar GROUP BY date HAVING n >= ${MIN_SESSION_SYMBOLS} ORDER BY date`;
    const sessions = calRows.map((r) => r.date);
    const ind = computeGoldenCross(bars);
    const barIndex: Record<string, number> = {};
    bars.forEach((b, k) => {
      if (b.valid) barIndex[b.date] = k;
    });
    const portfolio = runGoldenCrossPortfolio(
      { [symbol]: ind },
      sessions,
      { [symbol]: barIndex },
      { sizingPct, maxPositions, initialCapital: capital, taxProfile: taxProfile as "ATL_15" | "NON_ATL_30" }
    );
    const t = bars.length - 1;
    const lastRow = await db.ohlcvBar.findFirst({
      where: { symbol, date: bars[t].date },
      select: { updatedAt: true },
    });
    return NextResponse.json({
      strategy: GC_STRATEGY_ID,
      status: GC_STATUS,
      notice:
        "RESEARCH / BACKTEST ONLY — hypothetical simulation on raw delayed daily data with V2 hypothetical costs. Not tradable advice; no order execution exists behind this API; the strategy is not promoted.",
      symbol,
      dataCutoff: bars[t].date,
      dataUpdatedAt: lastRow?.updatedAt ?? null,
      priceBasis: "raw provider daily OHLC (unadjusted)",
      definition: `MA${MA_FAST}/MA${MA_SLOW} simple moving averages of valid session closes; Golden = prev MA${MA_FAST}<=prev MA${MA_SLOW} & cur MA${MA_FAST}>cur MA${MA_SLOW}; Death = mirror; execution at next session open`,
      current: {
        date: bars[t].date,
        close: ind.closes[t],
        ma7: ind.ma7[t],
        ma30: ind.ma30[t],
        relationship: ind.rel[t],
        lastSignal: (() => {
          for (let k = t; k >= 0; k--) if (ind.signals[k]) return { signal: ind.signals[k], date: bars[k].date };
          return null;
        })(),
        state: portfolio.openPositions.some((o) => o.symbol === symbol) ? "long" : "flat",
      },
      series: ind.dates.slice(-SERIES_TAIL).map((date, i) => {
        const k = bars.length - SERIES_TAIL + i;
        return {
          date,
          close: ind.closes[k],
          ma7: ind.ma7[k],
          ma30: ind.ma30[k],
          signal: ind.signals[k],
        };
      }),
      markers: ind.signals
        .map((sig, k) => (sig ? { date: ind.dates[k], signal: sig, price: ind.closes[k] } : null))
        .filter(Boolean)
        .slice(-120),
      portfolio: {
        config: portfolio.config,
        account: portfolio.account,
        openPositions: portfolio.openPositions,
        unfilledRecent: portfolio.unfilled.slice(-25),
      },
      equityCurve: portfolio.daily.slice(-SERIES_TAIL).map((r) => ({ date: r.date, equity: r.portfolioEquity, drawdown: r.currentDrawdown })),
      dailyLedger: portfolio.daily.slice(-LEDGER_TAIL),
      dailyLedgerTotalRows: portfolio.daily.length,
      tradeLedger: portfolio.trades.slice(-150),
      tradeLedgerTotalRows: portfolio.trades.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "golden_cross_unavailable", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
