import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHistorical } from "@/lib/latent/psxClient";
import { detectStockPatterns, type PriceBar } from "@/lib/latent/stock-patterns";
import { MOCK_STOCKS } from "@/lib/latent/mock-stocks";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/stock-patterns/[symbol]
// Runs the technical PRICE-pattern engine on the stock's OHLCV history.
// DB-first (fast — 908 symbols have 2,000-2,500 bars each) with a live
// psxdata API fallback for symbols missing from the DB.

function toBar(b: { date: string; open: number; high: number; low: number; close: number; volume: number }): PriceBar {
  return { date: b.date.slice(0, 10), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const start = Date.now();
  const { symbol } = await params;
  const sym = symbol.toUpperCase().replace(/XD$/, "");

  // ── 1. DB-first: pull the stock's OHLCV history ──
  let bars: PriceBar[] = [];
  let source = "db";
  try {
    const rows = await db.ohlcvBar.findMany({
      where: { symbol: sym },
      orderBy: { date: "asc" },
      take: 6000,
    });
    if (rows.length > 0) bars = rows.map(toBar);
  } catch {}

  // ── 2. Live fallback — DB empty for this symbol ──
  if (bars.length < 60) {
    try {
      const hist = await getHistorical(sym);
      if (hist && hist.length > 0) {
        bars = hist
          .map((d: any) =>
            toBar({
              date: String(d.date).slice(0, 10),
              open: Number(d.open), high: Number(d.high),
              low: Number(d.low), close: Number(d.close),
              volume: Number(d.volume || 0),
            })
          )
          .filter((b) => !isNaN(b.close) && b.close > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        source = "psxdata-api (live)";
      }
    } catch {}
  }

  if (bars.length < 30) {
    return NextResponse.json(
      { error: `No price history available for ${sym} — need at least 30 daily bars to detect patterns.` },
      { status: 404 }
    );
  }

  // ── 3. Run the pattern engine ──
  const { patterns, stats, chart } = detectStockPatterns(bars);

  // Recent bars for the history table (latest first, capped at 60)
  const recentBars = bars.slice(-60).map((b, i, arr) => {
    const prev = i > 0 ? arr[i - 1].close : b.open;
    return {
      date: b.date,
      open: b.open, high: b.high, low: b.low, close: b.close,
      volume: b.volume,
      changePct: prev > 0 ? ((b.close - prev) / prev) * 100 : 0,
    };
  }).reverse();

  const stock = MOCK_STOCKS.find((s) => s.symbol === sym);

  return NextResponse.json({
    symbol: sym,
    company: stock?.name || sym,
    sector: stock?.sector || null,
    source,
    barsCount: bars.length,
    firstDate: bars[0].date,
    lastDate: bars[bars.length - 1].date,
    stats,
    patterns,
    chart,
    recentBars,
    latencyMs: Date.now() - start,
    cached: false,
  });
}
