import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHistorical } from "@/lib/latent/psxClient";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — incremental refresh of ~908 stocks

// GET /api/cron/refresh-ohlcv
// Incremental refresh: for each backed-up symbol, fetch the latest daily bars
// from the psxdata API + append only NEW bars (date > latest in DB). Idempotent
// — re-running only adds new bars, skips up-to-date stocks. Called daily by
// the instrumentation scheduler at 5 PM PKT (after market close).
export async function GET() {
  const start = Date.now();
  const symbols = await db.ohlcvBar.findMany({
    select: { symbol: true },
    distinct: ["symbol"],
  });

  let updated = 0, skipped = 0, errors = 0, newBars = 0;

  for (const { symbol } of symbols) {
    try {
      const hist = await getHistorical(symbol);
      if (!hist || hist.length === 0) { skipped++; continue; }

      // Get the latest date already in the DB for this symbol
      const latest = await db.ohlcvBar.findFirst({
        where: { symbol },
        orderBy: { date: "desc" },
        select: { date: true },
      });

      // Filter to only NEW bars (date > latest in DB, or all if no DB data)
      const newBarsForSym = latest
        ? hist.filter((b: any) => b.date > latest.date)
        : hist;

      if (newBarsForSym.length === 0) { skipped++; continue; }

      // Insert new bars (upsert per bar — SQLite doesn't support skipDuplicates)
      for (const b of newBarsForSym) {
        try {
          await db.ohlcvBar.upsert({
            where: { symbol_date: { symbol, date: b.date } },
            create: {
              symbol, date: b.date,
              open: Number(b.open), high: Number(b.high),
              low: Number(b.low), close: Number(b.close),
              volume: Number(b.volume || 0), source: "psxdata",
            },
            update: {}, // don't update existing bars
          });
          newBars++;
        } catch {}
      }
      updated++;
    } catch { errors++; }
  }

  const totalBars = await db.ohlcvBar.count();
  return NextResponse.json({
    refreshed: true,
    stocksChecked: symbols.length,
    stocksUpdated: updated,
    stocksSkipped: skipped,
    errors,
    newBarsAdded: newBars,
    totalBarsInDB: totalBars,
    latencyMs: Date.now() - start,
  });
}
