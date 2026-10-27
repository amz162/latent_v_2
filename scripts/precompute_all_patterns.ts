// Issue (user request) — precompute the Pattern Finder results for ALL PSX
// stocks into BOTH permanent cache tables, so the UI never has to interpret
// anything at request time:
//
//   1. PricePatternCache  — daily price-history patterns (open/close/volume
//      only) via the pure-TS engine in src/lib/latent/price-patterns.ts.
//      Source: the local OhlcvBar DB (908 symbols).
//   2. ResultPatternCache — quarterly RESULTS patterns (revenue/profit/EPS/
//      dividend) via detectPatterns() in src/lib/latent/mock-company-results.ts.
//      Source: data/financials/{sym}.json snapshots first, then the live
//      askanalyst API (fetched once and snapshotted to disk by the shared
//      fetchFinancialResults() loader).
//
// Engine-only (NO LLM): the API routes backfill the GLM layman-explanation
// layer lazily on first request per symbol; everything numeric is precomputed
// here so a cached read is a pure DB read.
//
// Usage:
//   bun run scripts/precompute_all_patterns.ts                 # all symbols, both caches
//   bun run scripts/precompute_all_patterns.ts --price-only    # only PricePatternCache
//   bun run scripts/precompute_all_patterns.ts --result-only   # only ResultPatternCache
//   bun run scripts/precompute_all_patterns.ts --force         # recompute even if cached
//   bun run scripts/precompute_all_patterns.ts --limit 50      # cap symbols (testing)
//
// The script is idempotent: cached rows are skipped unless --force is passed.
// Upsert-only — rows are never deleted.

import { db } from "../src/lib/db";
import { analyzePricePatterns, type PricePatternAnalysis } from "../src/lib/latent/price-patterns";
import { fetchFinancialResults } from "../src/lib/latent/financial-results";
import { detectPatterns, type QuarterlyResult } from "../src/lib/latent/mock-company-results";

const args = process.argv.slice(2);
const PRICE_ONLY = args.includes("--price-only");
const RESULT_ONLY = args.includes("--result-only");
const FORCE = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 && args[limitIdx + 1] ? Math.max(1, Number(args[limitIdx + 1]) || 0) : null;

const CONCURRENCY = 5;

function p(symbols: string[], worker: (sym: string) => Promise<string | null>, label: string): Promise<void> {
  let idx = 0;
  let ok = 0, skip = 0, fail = 0;
  async function run() {
    while (idx < symbols.length) {
      const sym = symbols[idx++];
      try {
        const r = await worker(sym);
        if (r === "ok") ok++;
        else skip++;
      } catch (e: any) {
        fail++;
        console.warn(`[${label}] ${sym} failed: ${e?.message || e}`);
      }
      if ((ok + skip + fail) % 50 === 0) {
        console.log(`[${label}] progress: ${ok + skip + fail}/${symbols.length} (ok=${ok}, skip=${skip}, fail=${fail})`);
      }
    }
  }
  return Promise.all(Array.from({ length: CONCURRENCY }, run)).then(() => {
    console.log(`[${label}] DONE — ok=${ok}, skipped=${skip}, failed=${fail}`);
  });
}

async function precomputePrice(symbols: string[]) {
  console.log(`[price] precomputing PricePatternCache for ${symbols.length} symbols (force=${FORCE})`);
  await p(
    symbols,
    async (symbol) => {
      if (!FORCE) {
        const existing = await db.pricePatternCache.findUnique({ where: { symbol } });
        if (existing) return "skip"; // permanent cache — any age is served
      }
      const bars = await db.ohlcvBar.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
        select: { date: true, open: true, close: true, volume: true },
      });
      if (bars.length < 30) return "skip"; // engine marks these insufficient anyway
      const analysis: PricePatternAnalysis = analyzePricePatterns(
        symbol,
        bars.map((b) => ({ date: b.date, open: b.open, close: b.close, volume: b.volume }))
      );
      const lastDate = bars[bars.length - 1]?.date ?? null;
      await db.pricePatternCache.upsert({
        where: { symbol },
        create: {
          symbol,
          patternsJson: JSON.stringify(analysis),
          summaryJson: "null",
          dataSourceDate: lastDate,
        },
        update: {
          patternsJson: JSON.stringify(analysis),
          summaryJson: "null",
          dataSourceDate: lastDate,
          computedAt: new Date(),
        },
      });
      return "ok";
    },
    "price"
  );
}

async function precomputeResult(symbols: string[]) {
  console.log(`[result] precomputing ResultPatternCache for ${symbols.length} symbols (force=${FORCE})`);
  await p(
    symbols,
    async (symbol) => {
      if (!FORCE) {
        const existing = await db.resultPatternCache.findUnique({ where: { symbol } });
        if (existing) return "skip";
      }
      const payload = await fetchFinancialResults(symbol);
      if (!payload || !payload.results || payload.results.length < 4) return "skip"; // engine needs >= 4 quarters
      const results = payload.results as unknown as QuarterlyResult[];
      const patterns = detectPatterns(results);
      const lastPeriod = results[results.length - 1]?.periodEnd ?? null;
      await db.resultPatternCache.upsert({
        where: { symbol },
        create: {
          symbol,
          resultsJson: JSON.stringify(results),
          patternsJson: JSON.stringify(patterns),
          summaryJson: "null",
          dataSourceDate: lastPeriod,
        },
        update: {
          resultsJson: JSON.stringify(results),
          patternsJson: JSON.stringify(patterns),
          summaryJson: "null",
          dataSourceDate: lastPeriod,
          computedAt: new Date(),
        },
      });
      return "ok";
    },
    "result"
  );
}

async function main() {
  const grouped = await db.ohlcvBar.groupBy({ by: ["symbol"], _count: { date: true } });
  // Prefer symbols with real history first (price engine needs >= 30 bars).
  const ranked = grouped
    .sort((a, b) => b._count.date - a._count.date)
    .map((g) => g.symbol);
  const symbols = LIMIT ? ranked.slice(0, LIMIT) : ranked;
  console.log(`[precompute] universe: ${symbols.length} symbols (from ${grouped.length} OHLCV symbols)`);

  if (!RESULT_ONLY) await precomputePrice(symbols);
  if (!PRICE_ONLY) await precomputeResult(symbols);

  const priceRows = await db.pricePatternCache.count();
  const resultRows = await db.resultPatternCache.count();
  console.log(`[precompute] FINAL — PricePatternCache rows: ${priceRows}, ResultPatternCache rows: ${resultRows}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("[precompute] FATAL:", e);
  process.exit(1);
});
