// Task 47 — nightly-style precompute for the Price Pattern Finder cache.
// There is no cron in this sandbox; run it manually (e.g. after the daily
// OHLCV update) to warm the PricePatternCache table:
//
//   bun run scripts/precompute_price_patterns.ts                 # top 100 symbols by data availability
//   bun run scripts/precompute_price_patterns.ts --limit 25      # fewer symbols
//   bun run scripts/precompute_price_patterns.ts --llm 20        # also fetch LLM explanations for the first 20
//   bun run scripts/precompute_price_patterns.ts --force         # recompute even if cache < 24h old
//
// Default mode is engine-only (no LLM) so a full run stays fast; the API route
// backfills the LLM layer lazily on first request for any symbol.
import { db } from "../src/lib/db";
import { analyzePricePatterns, type PricePatternAnalysis } from "../src/lib/latent/price-patterns";

const args = process.argv.slice(2);
const getArg = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Math.max(1, Number(args[i + 1]) || 0) : null;
};
const LIMIT = getArg("--limit") ?? 100;
const LLM_COUNT = getArg("--llm") ?? 0;
const FORCE = args.includes("--force");

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function main() {
  console.log(`[precompute] warming price-pattern cache for up to ${LIMIT} symbols (llm=${LLM_COUNT}, force=${FORCE})`);

  // KSE100-style universe: the symbols with the most historical bars.
  const grouped = await db.ohlcvBar.groupBy({
    by: ["symbol"],
    _count: { date: true },
    _max: { date: true },
    orderBy: { _count: { date: "desc" } },
    take: LIMIT,
  });

  let done = 0;
  for (const g of grouped) {
    const symbol = g.symbol;
    try {
      if (!FORCE) {
        const existing = await db.pricePatternCache.findUnique({ where: { symbol } });
        if (existing && Date.now() - existing.computedAt.getTime() < CACHE_TTL_MS) {
          done++;
          continue;
        }
      }

      const bars = await db.ohlcvBar.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
        select: { date: true, open: true, close: true, volume: true },
      });
      const analysis: PricePatternAnalysis = analyzePricePatterns(
        symbol,
        bars.map((b) => ({ date: b.date, open: b.open, close: b.close, volume: b.volume }))
      );
      if (analysis.insufficient) {
        console.log(`[precompute] ${symbol}: skipped (${bars.length} bars, insufficient)`);
        continue;
      }

      // Engine-only here; llmSummary stays null and the API route fills it
      // lazily on first request (or use --llm to precompute explanations).
      let summaryJson = "null";
      if (done < LLM_COUNT) {
        try {
          const { default: ZAI } = await import("z-ai-web-dev-sdk");
          const zai = await ZAI.create();
          const completion = await zai.chat.completions.create({
            messages: [
              {
                role: "user",
                content:
                  `Summarize these statistically detected historical price patterns for ${symbol} in 3-4 layman sentences. ` +
                  `Rules: only use the numbers in the JSON, no buy/sell advice, never say "support"/"resistance" (say "key price zone"), phrase as historical observation. JSON only: {"overallSummary": "...", "notableObservations": ["..."]}\n\n` +
                  `JSON:\n${JSON.stringify({ patterns: analysis.patterns, gaps: analysis.gaps, drift: analysis.drift })}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 600,
          });
          const raw = completion?.choices?.[0]?.message?.content || "";
          const parsed = JSON.parse(raw.replace(/```(?:json)?|```/g, "").trim());
          summaryJson = JSON.stringify({
            overallSummary: String(parsed?.overallSummary || ""),
            notableObservations: Array.isArray(parsed?.notableObservations) ? parsed.notableObservations : [],
            patternExplanations: {},
          });
        } catch (err) {
          console.warn(`[precompute] ${symbol}: LLM layer failed (${err instanceof Error ? err.message : err}) — caching engine-only`);
        }
      }

      await db.pricePatternCache.upsert({
        where: { symbol },
        create: {
          symbol,
          patternsJson: JSON.stringify(analysis),
          summaryJson,
          computedAt: new Date(),
          dataSourceDate: analysis.dataEnd,
        },
        update: {
          patternsJson: JSON.stringify(analysis),
          summaryJson,
          computedAt: new Date(),
          dataSourceDate: analysis.dataEnd,
        },
      });
      console.log(`[precompute] ${symbol}: ${analysis.patterns.length} patterns from ${bars.length} bars (${analysis.dataStart} → ${analysis.dataEnd})`);
    } catch (err) {
      console.error(`[precompute] ${symbol}: FAILED ${err instanceof Error ? err.message : err}`);
    } finally {
      done++;
    }
  }
  console.log(`[precompute] done — processed ${done}/${grouped.length} symbols`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
