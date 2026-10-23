import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHistorical } from "@/lib/latent/psxClient";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// LIVE-FIRST OHLCV route: fetches from the psxdata API FIRST (live data),
// falls back to the DB backup only if the API fails. This ensures the app
// always works on LIVE data, not stale DB snapshots.
function toEpochMs(date: unknown): number {
  if (typeof date === "number" && !isNaN(date)) return date;
  if (typeof date === "string") {
    const t = Date.parse(date);
    if (!isNaN(t)) return t;
  }
  return NaN;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase().replace(/XD$/, "");
  const start = Date.now();

  // 1. LIVE FIRST — fetch from the psxdata API (real-time daily history)
  try {
    const hist = await getHistorical(sym);
    if (hist && hist.length > 0) {
      const ohlcv = hist
        .map((d: any) => ({
          date: toEpochMs(d.date),
          open: Number(d.open),
          high: Number(d.high),
          low: Number(d.low),
          close: Number(d.close),
          volume: Number(d.volume || 0),
        }))
        .filter((x) => !isNaN(x.date) && !isNaN(x.close))
        .sort((a, b) => a.date - b.date);

      if (ohlcv.length > 0) {
        // Opportunistically backfill new bars to the DB (fire-and-forget)
        void (async () => {
          try {
            const latest = await db.ohlcvBar.findFirst({
              where: { symbol: sym },
              orderBy: { date: "desc" },
              select: { date: true },
            });
            const newBars = latest
              ? hist.filter((b: any) => b.date > latest.date)
              : hist;
            for (const b of newBars) {
              try {
                await db.ohlcvBar.upsert({
                  where: { symbol_date: { symbol: sym, date: b.date } },
                  create: {
                    symbol: sym, date: b.date,
                    open: Number(b.open), high: Number(b.high),
                    low: Number(b.low), close: Number(b.close),
                    volume: Number(b.volume || 0), source: "psxdata",
                  },
                  update: {},
                });
              } catch {}
            }
          } catch {}
        })();

        return NextResponse.json({
          symbol: sym,
          source: "psxdata-api (live)",
          rowsCount: ohlcv.length,
          firstDate: ohlcv[0].date,
          lastDate: ohlcv[ohlcv.length - 1].date,
          ohlcv,
          latencyMs: Date.now() - start,
          cached: false,
        });
      }
    }
  } catch {}

  // 2. DB FALLBACK — only if the live API failed
  try {
    const rows = await db.ohlcvBar.findMany({
      where: { symbol: sym },
      orderBy: { date: "asc" },
      take: 6000,
    });
    if (rows.length > 0) {
      const ohlcv = rows.map((r) => ({
        date: toEpochMs(r.date),
        open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume,
      }));
      return NextResponse.json({
        symbol: sym,
        source: "db-backup (psxdata API unavailable)",
        rowsCount: ohlcv.length,
        firstDate: ohlcv[0].date,
        lastDate: ohlcv[ohlcv.length - 1].date,
        ohlcv,
        latencyMs: Date.now() - start,
        cached: true,
      });
    }
  } catch {}

  return NextResponse.json(
    { error: `No OHLCV data for ${sym}`, symbol: sym },
    { status: 404 }
  );
}
