import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHistorical } from "@/lib/latent/psxClient";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Normalise date input (string "YYYY-MM-DD" OR epoch-ms number) → epoch ms.
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

  // 1. DB-first — the OhlcvBar backup (backfilled from psxdata). This is the
  //    fast path: ~2500 bars read locally in a few ms. Lets the chart + the
  //    backtest engine run on ALL backed-up stocks without per-request live
  //    fetches. Live/ticker data is still fetched live elsewhere (quotes).
  try {
    const rows = await db.ohlcvBar.findMany({
      where: { symbol: sym },
      orderBy: { date: "asc" },
      take: 6000,
    });
    if (rows.length > 0) {
      const ohlcv = rows.map((r) => ({
        date: toEpochMs(r.date),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }));
      return NextResponse.json({
        symbol: sym,
        source: "db-backup (psxdata)",
        rowsCount: ohlcv.length,
        firstDate: ohlcv[0].date,
        lastDate: ohlcv[ohlcv.length - 1].date,
        ohlcv,
        latencyMs: Date.now() - start,
        cached: true,
      });
    }
  } catch {}

  // 2. Live fallback — fetch from the psxdata API (and opportunistically
  //    backfill to the DB so the next call is fast).
  try {
    const hist = await getHistorical(sym);
    if (hist.length > 0) {
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
      // Opportunistic backfill (fire-and-forget; don't block the response)
      void db.ohlcvBar
        .deleteMany({ where: { symbol: sym } })
        .then(() =>
          db.ohlcvBar.createMany({
            data: hist.map((b: any) => ({
              symbol: sym,
              date: b.date,
              open: Number(b.open),
              high: Number(b.high),
              low: Number(b.low),
              close: Number(b.close),
              volume: Number(b.volume || 0),
              source: "psxdata",
            })),
          })
        )
        .catch(() => {});
      return NextResponse.json({
        symbol: sym,
        source: "psxdata-api (live + auto-backfilled)",
        rowsCount: ohlcv.length,
        firstDate: ohlcv[0].date,
        lastDate: ohlcv[ohlcv.length - 1].date,
        ohlcv,
        latencyMs: Date.now() - start,
        cached: false,
      });
    }
  } catch {}

  return NextResponse.json(
    { error: `No OHLCV data for ${sym}`, symbol: sym },
    { status: 404 }
  );
}
