import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { barIsValid, MIN_SESSION_SYMBOLS } from "@/lib/latent/golden-cross";
import { computeVolatilityAnalytics } from "@/lib/latent/volatility-analytics";
import type { Bar } from "@/lib/latent/golden-cross";
import { guardUser } from "@/lib/latent/access-control";

// Task 110 — Volatility & Convexity Analytics dashboard API.
// Realized-volatility research over the real OhlcvBar history (close-to-close,
// Parkinson, Garman-Klass — annualized exactly once), BBW with first/second
// discrete derivatives, and a descriptive volatility-regime watch.
// REALIZED volatility only: the provider supplies no implied-volatility or
// options data, so no option signal or execution exists behind this route.
export const dynamic = "force-dynamic";

const SERIES_TAIL = 500;

export async function GET(req: NextRequest) {
  const __g = await guardUser(req, "tab.volatility_analytics");
  if (__g) return __g;
  try {
    const sp = req.nextUrl.searchParams;
    const symbol = (sp.get("symbol") || "HUBC").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const varWindow = Math.min(120, Math.max(3, Number(sp.get("varWindow")) || 10));
    const bbwWindow = Math.min(250, Math.max(5, Number(sp.get("bbwWindow")) || 20));
    const bbwK = Math.min(5, Math.max(1, Number(sp.get("k")) || 2));

    const rows = await db.ohlcvBar.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true, updatedAt: true },
    });
    if (rows.length < Math.max(varWindow, bbwWindow) + 5) {
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
    const calRows = await db.$queryRaw<Array<{ date: string; n: number }>>`
      SELECT date, COUNT(*) as n FROM OhlcvBar GROUP BY date HAVING n >= ${MIN_SESSION_SYMBOLS} ORDER BY date`;
    const idxOf = new Map(calRows.map((r) => [r.date, -1]));
    calRows.forEach((r, i) => idxOf.set(r.date, i));
    const sessionIdxOf = (date: string) => idxOf.get(date) ?? -1;
    const res = computeVolatilityAnalytics(bars, sessionIdxOf, varWindow, bbwWindow, bbwK);
    const t = bars.length - 1;
    return NextResponse.json({
      module: "volatility_regime_v1",
      status: "research_only",
      notice:
        "RESEARCH WATCH ONLY — realized volatility from delayed daily data. This is NOT implied volatility; long/short-volatility watches are never option signals and no options data or execution exists behind this API.",
      symbol,
      config: { varWindow, bbwWindow, bollingerK: bbwK, annualization: 252, stdConvention: "sample (ddof=1)", priceBasis: "raw provider daily OHLC (unadjusted)" },
      dataCutoff: bars[t].date,
      dataUpdatedAt: rows[t]?.updatedAt ?? null,
      dataFreshness: rows[t]?.updatedAt
        ? { marketDataDate: bars[t].date, retrievedAt: rows[t].updatedAt, provider: "psxdata (delayed)" }
        : null,
      gkNegatives: res.gkNegatives,
      gkNegativePolicy: "kept unclipped in research data; volatility shown unavailable where sqrt undefined",
      regime: res.regime,
      estimatorNotes: {
        close_to_close: "252 x sample variance of daily log returns; sensitive to drift and jumps",
        parkinson: "252 x mean[ln(H/L)^2]/(4 ln2); assumes continuous sampling, ignores overnight gaps",
        garman_klass: "252 x mean[0.5 ln(H/L)^2 - (2 ln2 - 1) ln(C/O)^2]; OHLC-based, driftless assumption",
        interpretation_guard: "GK vs Parkinson difference is not a directional-trend indicator",
      },
      latest: res.latest,
      series: res.series.slice(-SERIES_TAIL),
      seriesTotalRows: res.series.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "volatility_unavailable", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
