/**
 * One-time backfill: fetch daily OHLCV history for all KSE-100 constituents
 * (or all ~1048 symbols with `--all`) from the psxdata API and store in the
 * OhlcvBar table. This is the local corpus the backtest/simulation engine runs
 * on — so it can trade ALL stocks (not just the 8 hardcoded CSVs).
 *
 * Idempotent: uses createMany skipDuplicates, so re-running only adds new bars.
 *
 * Usage:
 *   bun run scripts/backfill_ohlcv.ts            # KSE-100 universe (~100 stocks)
 *   bun run scripts/backfill_ohlcv.ts --all      # all ~1048 symbols (slow)
 *   bun run scripts/backfill_ohlcv.ts --symbol LUCK   # single stock
 */
import { db } from "../src/lib/db";
import { getIndexConstituents, getHistorical, listSymbols } from "../src/lib/latent/psxClient";

const args = new Set(process.argv.slice(2));
const CONCURRENCY = 6;
const CHUNK = 100; // rows per createMany (SQLite param limit safety)

async function backfillSymbol(symbol: string): Promise<{ symbol: string; bars: number; err?: string }> {
  try {
    const hist = await getHistorical(symbol);
    if (!hist.length) return { symbol, bars: 0 };
    const rows = hist.map((b) => ({
      symbol,
      date: b.date,
      open: b.open, high: b.high, low: b.low, close: b.close,
      volume: b.volume || 0,
      source: "psxdata",
    }));
    // Idempotent: clear this symbol's bars then re-insert. SQLite Prisma
    // doesn't support createMany skipDuplicates, so deleteMany first.
    await db.ohlcvBar.deleteMany({ where: { symbol } });
    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const r = await db.ohlcvBar.createMany({ data: rows.slice(i, i + CHUNK) });
      inserted += r.count;
    }
    return { symbol, bars: inserted };
  } catch (e: any) {
    return { symbol, bars: 0, err: e?.message?.slice(0, 120) };
  }
}

async function runPool(symbols: string[]) {
  const results: { symbol: string; bars: number; err?: string }[] = [];
  let i = 0;
  async function worker() {
    while (i < symbols.length) {
      const sym = symbols[i++];
      const r = await backfillSymbol(sym);
      results.push(r);
      if (r.err) console.error(`✗ ${sym}: ${r.err}`);
      else console.log(`✓ ${sym}: ${r.bars} bars`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, () => worker()));
  return results;
}

(async () => {
  const t0 = Date.now();
  let symbols: string[];
  if (args.has("--all")) {
    symbols = await listSymbols();
    console.log(`backfilling ALL ${symbols.length} symbols…`);
  } else if (args.has("--symbol")) {
    const idx = process.argv.indexOf("--symbol");
    symbols = [process.argv[idx + 1]!];
  } else {
    const cons = await getIndexConstituents("KSE100");
    symbols = cons.map((c) => c.symbol);
    console.log(`backfilling KSE-100 (${symbols.length} constituents)…`);
  }

  const results = await runPool(symbols);
  const totalBars = results.reduce((s, r) => s + r.bars, 0);
  const errs = results.filter((r) => r.err).length;
  const ok = results.filter((r) => !r.err && r.bars > 0).length;
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${ok}/${symbols.length} symbols, ${totalBars} bars, ${errs} errors.`);
  const cnt = await db.ohlcvBar.count();
  console.log(`OhlcvBar total rows in DB: ${cnt}`);
  await db.$disconnect();
})().catch((e) => { console.error("backfill failed:", e); process.exit(1); });
