// Task 28-A — precompute the Pattern Finder caches for ALL stocks.
//
// Fills BOTH permanent cache tables from the user's issue:
//   1. PricePatternCache  — price-pattern engine results (analyzePricePatterns)
//   2. ResultPatternCache — quarterly-results pattern engine results
//                            (fetchFinancialResults + detectPatterns)
//
// The API routes (/api/price-patterns/[symbol], /api/result-patterns/[symbol])
// read these tables FIRST, so after this script every visit is a pure DB read
// — no runtime interpretation/recalculation.
//
// Usage (bun):
//   bun run scripts/precompute_all_pattern_caches.ts                      # both phases, all symbols, engine-only
//   bun run scripts/precompute_all_pattern_caches.ts --phase price        # price table only
//   bun run scripts/precompute_all_pattern_caches.ts --phase result       # result table only
//   bun run scripts/precompute_all_pattern_caches.ts --phase llm          # LLM enrichment only (fills missing summaries)
//   bun run scripts/precompute_all_pattern_caches.ts --phase llm-price    # LLM enrichment, price table only
//   bun run scripts/precompute_all_pattern_caches.ts --phase llm-result   # LLM enrichment, result table only
//   bun run scripts/precompute_all_pattern_caches.ts --force              # recompute rows that already exist
//   bun run scripts/precompute_all_pattern_caches.ts --limit 100          # cap number of symbols
//   bun run scripts/precompute_all_pattern_caches.ts --concurrency 6     # parallel workers (result + llm phases)
//   bun run scripts/precompute_all_pattern_caches.ts --status            # print table counts and exit
//
// Engine-only runs NEVER overwrite an existing LLM summary (summaryJson is
// preserved on update); LLM rows are written per-symbol so a killed run can
// be resumed (already-summarized symbols are skipped).
import { db } from "../src/lib/db";
import {
  analyzePricePatterns,
  type PricePatternAnalysis,
} from "../src/lib/latent/price-patterns";
import { fetchFinancialResults, type ParsedQuarter } from "../src/lib/latent/financial-results";
import {
  detectPatterns,
  type DetectedPattern,
} from "../src/lib/latent/mock-company-results";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const numArg = (name: string, dflt: number) => {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) {
    const n = Number(args[i + 1]);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return dflt;
};

const phaseIdx = args.indexOf("--phase");
const PHASE = phaseIdx >= 0 && args[phaseIdx + 1] ? args[phaseIdx + 1] : "all";
const STATUS = flag("--status");
const FORCE = flag("--force");
const LIMIT = flag("--limit") ? numArg("--limit", 100000) : 100000;
const CONCURRENCY = Math.max(1, Math.min(10, numArg("--concurrency", 5)));
// Delay between LLM calls per worker — the ZAI endpoint rate-limits
// aggressively (HTTP 429), so keep the LLM phases gentle.
const LLM_DELAY_MS = Math.max(0, numArg("--delay", 6) * 1000);

// ─── helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a DB write a few times — SQLite can be briefly locked by the dev server. */
async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 4): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (i === tries - 1) {
        console.error(`  [db-retry-giveup] ${label}: ${msg}`);
        return null;
      }
      await sleep(250 * (i + 1));
    }
  }
  return null;
}

async function allSymbols(): Promise<string[]> {
  const grouped = await db.ohlcvBar.groupBy({
    by: ["symbol"],
    _count: { date: true },
    orderBy: { _count: { date: "desc" } },
    take: LIMIT,
  });
  return grouped.map((g) => g.symbol);
}

// ─── phase 1: price patterns (engine) ──────────────────────────────────────
async function precomputePrice() {
  const symbols = await allSymbols();
  console.log(`[price] ${symbols.length} symbols (force=${FORCE})`);
  let done = 0, cached = 0, insufficient = 0, failed = 0;
  const t0 = Date.now();

  for (const symbol of symbols) {
    try {
      const prior = await db.pricePatternCache.findUnique({ where: { symbol } });
      if (prior && !FORCE) { cached++; done++; continue; }

      const bars = await db.ohlcvBar.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
        select: { date: true, open: true, close: true, volume: true },
      });
      const analysis: PricePatternAnalysis = analyzePricePatterns(
        symbol,
        bars.map((b) => ({ date: b.date, open: b.open, close: b.close, volume: b.volume }))
      );
      if (analysis.insufficient) { insufficient++; done++; continue; }

      // Engine-only: never clobber an existing LLM summary on a forced recompute.
      await withRetry(
        () =>
          db.pricePatternCache.upsert({
            where: { symbol },
            create: {
              symbol,
              patternsJson: JSON.stringify(analysis),
              summaryJson: prior?.summaryJson ?? "null",
              computedAt: new Date(),
              dataSourceDate: analysis.dataEnd,
            },
            update: {
              patternsJson: JSON.stringify(analysis),
              summaryJson: prior?.summaryJson ?? "null",
              computedAt: new Date(),
              dataSourceDate: analysis.dataEnd,
            },
          }),
        `price:${symbol}`
      );
      done++;
      if (done % 100 === 0) console.log(`[price] ${done}/${symbols.length} (${Math.round((Date.now() - t0) / 1000)}s)`);
    } catch (err) {
      failed++;
      console.error(`[price] ${symbol} FAILED: ${err instanceof Error ? err.message : err}`);
      done++;
    }
  }
  console.log(`[price] DONE — cached=${cached} written=${done - cached - insufficient - failed} insufficient=${insufficient} failed=${failed} in ${Math.round((Date.now() - t0) / 1000)}s`);
}

// ─── phase 2: result patterns (engine) ──────────────────────────────────────
async function precomputeResult() {
  const symbols = await allSymbols();
  console.log(`[result] ${symbols.length} symbols (concurrency=${CONCURRENCY}, force=${FORCE})`);
  const t0 = Date.now();
  let index = 0, written = 0, noData = 0, failed = 0;

  async function worker(id: number) {
    while (true) {
      const i = index++;
      if (i >= symbols.length) return;
      const symbol = symbols[i];
      try {
        const prior = await db.resultPatternCache.findUnique({ where: { symbol } });
        if (prior && !FORCE) continue;

        const payload = await fetchFinancialResults(symbol);
        if (!payload || payload.results.length === 0) { noData++; continue; }

        const results: ParsedQuarter[] = payload.results;
        const patterns: DetectedPattern[] = detectPatterns(results);

        await withRetry(
          () =>
            db.resultPatternCache.upsert({
              where: { symbol },
              create: {
                symbol,
                resultsJson: JSON.stringify(results),
                patternsJson: JSON.stringify(patterns),
                summaryJson: prior?.summaryJson ?? "null",
                dataSourceDate: results[results.length - 1]?.periodEnd || null,
              },
              update: {
                resultsJson: JSON.stringify(results),
                patternsJson: JSON.stringify(patterns),
                summaryJson: prior?.summaryJson ?? "null",
                dataSourceDate: results[results.length - 1]?.periodEnd || null,
                computedAt: new Date(),
              },
            }),
          `result:${symbol}`
        );
        written++;
      } catch (err) {
        failed++;
        console.error(`[result] ${symbol} FAILED: ${err instanceof Error ? err.message : err}`);
      } finally {
        if ((i + 1) % 100 === 0) console.log(`[result] ${i + 1}/${symbols.length} (${Math.round((Date.now() - t0) / 1000)}s)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, k) => worker(k)));
  console.log(`[result] DONE — written=${written} noData=${noData} failed=${failed} in ${Math.round((Date.now() - t0) / 1000)}s`);
}

// ─── phase 3: LLM enrichment (fills missing summaryJson rows) ───────────────
function parseLlmJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fall through */ } }
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch { /* fall through */ } }
  return null;
}

async function zaiChat(messages: { role: string; content: string }[], maxTokens: number) {
  const { default: ZAI } = await import("z-ai-web-dev-sdk");
  const zai = await ZAI.create();
  const completion = (await Promise.race([
    zai.chat.completions.create({ messages: messages as never, temperature: 0.3, max_tokens: maxTokens }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LLM timeout")), 60_000)),
  ])) as { choices?: { message?: { content?: string } }[] };
  return completion?.choices?.[0]?.message?.content || "";
}

/** LLM call with 429 backoff: waits and retries the same call. */
async function zaiChatWithBackoff(
  messages: { role: string; content: string }[],
  maxTokens: number,
  label: string
): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await zaiChat(messages, maxTokens);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.toLowerCase().includes("too many")) {
        const waitMs = 60_000 * (attempt + 1); // 60s, 120s, 180s
        console.warn(`[llm] ${label}: rate-limited — backing off ${waitMs / 1000}s (attempt ${attempt + 1}/3)`);
        await sleep(waitMs);
      } else {
        throw err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// When this many symbols IN A ROW exhaust their 429 backoff retries, the
// quota window is considered drained: abort the run (exit 42) so the
// llm-enrich-loop wrapper sleeps ~20min and retries later. Progress already
// written is kept — the next run resumes from where this one stopped.
let consecutiveRateLimited = 0;
function noteLlmOutcome(rateLimited: boolean) {
  if (rateLimited) {
    consecutiveRateLimited++;
    if (consecutiveRateLimited >= 3) {
      console.error("[llm] rate-limit exhaustion — aborting this run; the enrichment loop will retry later");
      process.exit(42);
    }
  } else {
    consecutiveRateLimited = 0;
  }
}

const PRICE_PROMPT = `You are Latent.pk's market-history analyst for the Pakistan Stock Exchange (PSX). You receive JSON produced by a deterministic statistics engine that scanned a stock's full daily price history (open, close, volume only) for recurring historical patterns. Explain each detected pattern to a Pakistani retail investor with LOW financial literacy.
HARD RULES: Output ONLY valid JSON. NEVER invent or alter numbers. NEVER give buy/sell advice — phrase everything as a HISTORICAL PATTERN OBSERVATION. Never say "support"/"resistance" — say "key price zone". No indicator jargon. Layman language, 2-3 sentences per pattern. Pakistan context (Rs.) where natural.
Output shape exactly: {"patternExplanations":[{"key":"<pattern key from input>","explanation":"2-3 layman sentences"}],"overallSummary":"4-6 sentence paragraph","notableObservations":["observation 1","observation 2"]}`;

const RESULT_PROMPT = `You are Latent.pk's financial-results analyst for the Pakistan Stock Exchange (PSX). You receive JSON describing a company's quarterly results (revenue, profit, EPS, dividends) plus statistically detected recurring patterns in those results. Explain to a Pakistani retail investor with LOW financial literacy what recurring patterns exist in the company's reported results.
HARD RULES: Output ONLY valid JSON. NEVER invent or alter numbers/periods. NEVER give buy/sell advice — historical pattern observations only. Layman language. Don't fabricate reasons — use "may be due to".
Output shape exactly: {"laymanSummary":"4-6 sentence paragraph","patternExplanations":[{"title":"<pattern title from input>","explanation":"2-3 layman sentences"}],"watchNext":"1-2 sentences on what to watch in the NEXT quarterly result"}`;

async function llmEnrichPrice() {
  const rows = await db.pricePatternCache.findMany({
    // summaryJson is a non-nullable String column; "null" is the JSON sentinel
    // we write for engine-only rows.
    where: { OR: [{ summaryJson: "null" }, { summaryJson: "" }] },
    select: { symbol: true },
    orderBy: { symbol: "asc" },
    take: LIMIT,
  });
  console.log(`[llm-price] ${rows.length} symbols missing summaries (concurrency=${Math.min(CONCURRENCY, 2)}, delay=${LLM_DELAY_MS / 1000}s)`);
  let i = 0, ok = 0, skip = 0;

  async function worker() {
    while (true) {
      const k = i++;
      if (k >= rows.length) return;
      const symbol = rows[k].symbol;
      try {
        const row = await db.pricePatternCache.findUnique({ where: { symbol } });
        if (!row) { skip++; continue; }
        const analysis = JSON.parse(row.patternsJson) as PricePatternAnalysis;
        if (!analysis.patterns?.length) { skip++; continue; }

        const input = {
          symbol,
          historyRange: `${analysis.dataStart} to ${analysis.dataEnd}`,
          tradingDays: analysis.totalBars,
          detectedPatterns: analysis.patterns,
          monthlySeasonality: analysis.seasonality,
          keyPriceZones: analysis.keyZones?.map((z) => ({ low: z.low, high: z.high, touches: z.touches, visits: z.visits, bounces: z.bounces, rejections: z.rejections })),
          pressure: analysis.pressure,
          gapStats: analysis.gaps,
          postEventDrift: analysis.drift,
        };
        const raw = await zaiChatWithBackoff(
          [
            { role: "system", content: PRICE_PROMPT },
            { role: "user", content: `Engine output for ${symbol} (${input.tradingDays} trading days, ${input.historyRange}). Explain every pattern following the hard rules.\n\nENGINE JSON:\n${JSON.stringify(input)}` },
          ],
          2000,
          `price:${symbol}`
        );
        const parsed = parseLlmJson(raw);
        if (!parsed) throw new Error("unparseable LLM JSON");
        const explanations: Record<string, string> = {};
        if (Array.isArray(parsed.patternExplanations)) {
          for (const e of parsed.patternExplanations as { key?: string; explanation?: string }[]) {
            if (e && typeof e.key === "string" && typeof e.explanation === "string" && e.explanation.trim()) explanations[e.key] = e.explanation.trim();
          }
        }
        const summary = {
          overallSummary: typeof parsed.overallSummary === "string" ? parsed.overallSummary.trim() : "",
          notableObservations: Array.isArray(parsed.notableObservations) ? (parsed.notableObservations as unknown[]).filter((o): o is string => typeof o === "string" && !!o.trim()).slice(0, 5) : [],
          patternExplanations: explanations,
        };
        await withRetry(
          () => db.pricePatternCache.update({ where: { symbol }, data: { summaryJson: JSON.stringify(summary) } }),
          `llm-price:${symbol}`
        );
        ok++;
        noteLlmOutcome(false);
        if (ok % 25 === 0) console.log(`[llm-price] ${ok}/${rows.length} summarized`);
      } catch (err) {
        skip++;
        const msg = err instanceof Error ? err.message : String(err);
        noteLlmOutcome(msg.includes("429") || msg.toLowerCase().includes("too many"));
        console.warn(`[llm-price] ${symbol} failed: ${msg}`);
      } finally {
        await sleep(LLM_DELAY_MS);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, 2) }, () => worker()));
  console.log(`[llm-price] DONE — summarized=${ok} skipped/failed=${skip}`);
}

async function llmEnrichResult() {
  const rows = await db.resultPatternCache.findMany({
    where: { OR: [{ summaryJson: "null" }, { summaryJson: "" }] },
    select: { symbol: true },
    orderBy: { symbol: "asc" },
    take: LIMIT,
  });
  console.log(`[llm-result] ${rows.length} symbols missing summaries (concurrency=${Math.min(CONCURRENCY, 2)}, delay=${LLM_DELAY_MS / 1000}s)`);
  let i = 0, ok = 0, skip = 0;

  async function worker() {
    while (true) {
      const k = i++;
      if (k >= rows.length) return;
      const symbol = rows[k].symbol;
      try {
        const row = await db.resultPatternCache.findUnique({ where: { symbol } });
        if (!row) { skip++; continue; }
        const results = JSON.parse(row.resultsJson) as ParsedQuarter[];
        const patterns = JSON.parse(row.patternsJson) as DetectedPattern[];
        if (!patterns.length || results.length < 4) { skip++; continue; }

        const input = {
          symbol,
          quartersCovered: results.length,
          range: `${results[0]?.period} → ${results[results.length - 1]?.period}`,
          detectedPatterns: patterns.map((p) => ({ title: p.label, description: p.detail, severity: p.severity, strength: p.strength, affectedQuarters: p.affectedQuarters, supportingData: p.supportingData })),
          recentQuarters: results.slice(-8).map((r) => ({ period: r.period, revenue: r.metrics.revenue, profitAfterTax: r.metrics.profitAfterTax, eps: r.metrics.eps, revenueYoYGrowth: r.metrics.revenueYoYGrowth, epsYoYGrowth: r.metrics.epsYoYGrowth, netMargin: r.metrics.netMargin, dividendPerShare: r.metrics.dividendPerShare })),
        };
        const raw = await zaiChatWithBackoff(
          [
            { role: "system", content: RESULT_PROMPT },
            { role: "user", content: `Quarterly-results pattern scan for ${symbol} (${input.quartersCovered} quarters, ${input.range}). Explain every detected pattern in layman language, following the hard rules.\n\nENGINE JSON:\n${JSON.stringify(input)}` },
          ],
          1600,
          `result:${symbol}`
        );
        const parsed = parseLlmJson(raw);
        if (!parsed) throw new Error("unparseable LLM JSON");
        const explanations: Record<string, string> = {};
        if (Array.isArray(parsed.patternExplanations)) {
          for (const e of parsed.patternExplanations as { title?: string; explanation?: string }[]) {
            if (e && typeof e.title === "string" && typeof e.explanation === "string" && e.explanation.trim()) explanations[e.title] = e.explanation.trim();
          }
        }
        const summary = {
          laymanSummary: typeof parsed.laymanSummary === "string" ? parsed.laymanSummary.trim() : "",
          patternExplanations: explanations,
          watchNext: typeof parsed.watchNext === "string" ? parsed.watchNext.trim() : "",
        };
        await withRetry(
          () => db.resultPatternCache.update({ where: { symbol }, data: { summaryJson: JSON.stringify(summary) } }),
          `llm-result:${symbol}`
        );
        ok++;
        noteLlmOutcome(false);
        if (ok % 25 === 0) console.log(`[llm-result] ${ok}/${rows.length} summarized`);
      } catch (err) {
        skip++;
        const msg = err instanceof Error ? err.message : String(err);
        noteLlmOutcome(msg.includes("429") || msg.toLowerCase().includes("too many"));
        console.warn(`[llm-result] ${symbol} failed: ${msg}`);
      } finally {
        await sleep(LLM_DELAY_MS);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, 2) }, () => worker()));
  console.log(`[llm-result] DONE — summarized=${ok} skipped/failed=${skip}`);
}

// ─── main ───────────────────────────────────────────────────────────────────
async function status() {
  const [p, r, o] = await Promise.all([
    db.pricePatternCache.count(),
    db.resultPatternCache.count(),
    db.ohlcvBar.groupBy({ by: ["symbol"] }).then((g) => g.length),
  ]);
  const pLlm = await db.pricePatternCache.count({ where: { NOT: { summaryJson: "null" } } });
  const rLlm = await db.resultPatternCache.count({ where: { NOT: { summaryJson: "null" } } });
  console.log(`[status] OhlcvBar symbols: ${o}`);
  console.log(`[status] PricePatternCache:  ${p} rows (${pLlm} with LLM summary)`);
  console.log(`[status] ResultPatternCache: ${r} rows (${rLlm} with LLM summary)`);
}

async function main() {
  console.log(`[main] phase=${STATUS ? "status" : PHASE} force=${FORCE} limit=${LIMIT} concurrency=${CONCURRENCY}`);
  if (STATUS) {
    await status();
  } else switch (PHASE) {
    case "status":
      await status();
      break;
    case "price":
      await precomputePrice();
      break;
    case "result":
      await precomputeResult();
      break;
    case "llm":
      await llmEnrichPrice();
      await llmEnrichResult();
      break;
    case "llm-price":
      await llmEnrichPrice();
      break;
    case "llm-result":
      await llmEnrichResult();
      break;
    default:
      await precomputePrice();
      await precomputeResult();
      await status();
      break;
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
