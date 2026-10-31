/**
 * Task 95 Phase 8 — bounded OHLCV ingestion for symbols with pending prospective trades.
 * Mirrors src/app/api/cron/refresh-ohlcv/route.ts upsert logic, restricted to the
 * symbols that actually have pending_entry paper trades. Idempotent.
 * Run: bun scripts/task95_ingest_ohlcv.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "https://psxdata-api.fastapicloud.dev";

async function main() {
  const pend = await db.prospectivePaperTrade.groupBy({
    by: ["symbol"],
    where: { state: "pending_entry" },
    _count: { _all: true },
  });
  const symbols = pend.map((p) => p.symbol);
  console.log(`symbols with pending_entry trades: ${symbols.length} -> ${symbols.join(",")}`);
  let totalNew = 0;
  const perSymbol: Record<string, number> = {};
  for (const symbol of symbols) {
    try {
      const res = await fetch(`${BASE}/stocks/${encodeURIComponent(symbol)}/historical`);
      if (!res.ok) {
        console.log(`${symbol}: HTTP ${res.status}`);
        perSymbol[symbol] = -1;
        continue;
      }
      const j: any = await res.json();
      const hist: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      if (hist.length === 0) {
        perSymbol[symbol] = 0;
        continue;
      }
      const latest = await db.ohlcvBar.findFirst({
        where: { symbol },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      const fresh = latest ? hist.filter((b) => String(b.date) > latest.date) : hist.slice(-30);
      for (const b of fresh) {
        await db.ohlcvBar.upsert({
          where: { symbol_date: { symbol, date: String(b.date) } },
          create: {
            symbol,
            date: String(b.date),
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume || 0),
            source: "psxdata",
          },
          update: {},
        });
      }
      perSymbol[symbol] = fresh.length;
      totalNew += fresh.length;
      console.log(`${symbol}: latest_db=${latest?.date ?? "none"} api_latest=${hist[0]?.date} new_bars=${fresh.length}`);
    } catch (e: any) {
      console.log(`${symbol}: ERROR ${String(e).slice(0, 120)}`);
      perSymbol[symbol] = -2;
    }
  }
  console.log(`TOTAL_NEW_BARS ${totalNew}`);
  await db.$disconnect();
}

main();
