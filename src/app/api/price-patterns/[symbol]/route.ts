import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import type { ChatMessage } from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { PricePatternCache } from "@prisma/client";
import {
  analyzePricePatterns,
  LIQUID_SUGGESTIONS,
  type PricePatternAnalysis,
} from "@/lib/latent/price-patterns";
import { MOCK_STOCKS } from "@/lib/latent/mock-stocks";

// GET /api/price-patterns/[symbol]
// Task 47 + Issue 3 — Price Pattern Finder:
//   1. Load full daily history (open/close/volume only — high/low are NULL in DB)
//   2. Run the pure-TS detection engine (6 detectors)
//   3. Pass ONLY the resulting pattern JSON to GLM for layman explanations
//   4. Cache PERMANENTLY in PricePatternCache — rows are never deleted or
//      expired by the server. Recomputed ONLY via ?refresh=1 (explicit user
//      action) or the precompute script (which upserts, never deletes).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface LlmSummary {
  overallSummary: string;
  notableObservations: string[];
  patternExplanations: Record<string, string>;
}

const SYSTEM_PROMPT = `You are Latent.pk's market-history analyst for the Pakistan Stock Exchange (PSX). You receive JSON produced by a deterministic statistics engine that scanned a stock's full daily price history (open, close, volume only) for recurring historical patterns. Your job: explain each detected pattern to a Pakistani retail investor with LOW financial literacy.

ABSOLUTE HARD RULES (violations make the output unusable):
1. Output ONLY valid JSON — no markdown fences, no commentary outside the JSON object.
2. NEVER invent, round, or alter any number. Only reference numbers that appear in the input JSON. If you need a number that is not in the input, do not mention it.
3. NEVER give buy/sell advice, signals, ratings, or "should" statements about trading. Phrase everything as a HISTORICAL PATTERN OBSERVATION ("in the past, X happened N times").
4. NEVER use the words "support" or "resistance" — say "key price zone".
5. NEVER say "buyers" or "sellers" as if confirmed — say "buying pressure" / "selling pressure" (inferred from price + volume).
6. No indicator jargon (no RSI, MACD, ATR, moving averages). Define any term you must use in a short clause.
7. Layman language, 2-3 sentences per pattern. Pakistan context (Rs. amounts) where natural.
8. You may flag a notable anomaly (an extreme month, an unusual volume event, an extreme gap) as a "notable observation" — clearly framed as an observation about history, never advice.

Your JSON output shape (exactly):
{
  "patternExplanations": [{ "key": "<repeat the pattern's key from input>", "explanation": "2-3 layman sentences using only input numbers" }],
  "overallSummary": "one short paragraph (4-6 sentences) describing what recurring historical patterns this stock's price history shows overall",
  "notableObservations": ["observation 1", "observation 2"]
}`;

const LLM_TIMEOUT_MS = 40_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const startTime = Date.now();
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase().trim();
  const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  const stock = MOCK_STOCKS.find((s) => s.symbol === symbol);
  const companyName = stock?.name ?? symbol;

  // 1) Permanent cache check (unless ?refresh=1) — any age is served so a
  //    repeat visit NEVER recalculates or re-calls the LLM.
  if (!forceRefresh) {
    try {
      const cached = await db.pricePatternCache.findUnique({ where: { symbol } });
      if (cached) {
        const analysis = JSON.parse(cached.patternsJson) as PricePatternAnalysis;
        const summary = safeParseSummary(cached.summaryJson);
        return NextResponse.json({
          ...analysis,
          companyName,
          llmSummary: summary,
          cached: true,
          computedAt: cached.computedAt.toISOString(),
          latencyMs: Date.now() - startTime,
        });
      }
    } catch (err) {
      console.warn(`[price-patterns] cache read failed for ${symbol}:`, err);
    }
  }

  // 2) Load full history from OhlcvBar (open/close/volume only — high/low are NULL)
  const bars = await db.ohlcvBar.findMany({
    where: { symbol },
    orderBy: { date: "asc" },
    select: { date: true, open: true, close: true, volume: true },
  });

  if (!bars.length) {
    return NextResponse.json(
      {
        error: `No price history found for ${symbol}`,
        suggestions: LIQUID_SUGGESTIONS,
      },
      { status: 404 }
    );
  }

  // 3) Run the detection engine (pure stats, no LLM)
  const analysis = analyzePricePatterns(
    symbol,
    bars.map((b) => ({ date: b.date, open: b.open, close: b.close, volume: b.volume }))
  );

  if (analysis.insufficient) {
    return NextResponse.json({
      ...analysis,
      companyName,
      llmSummary: null,
      suggestions: LIQUID_SUGGESTIONS,
      cached: false,
      latencyMs: Date.now() - startTime,
    });
  }

  // 4) Layer 2 — LLM explanations (only the engine's JSON goes in)
  let llmSummary: LlmSummary | null = null;
  let llmError: string | null = null;
  if (analysis.patterns.length > 0) {
    try {
      llmSummary = await explainWithLlm(symbol, companyName, analysis);
    } catch (err) {
      llmError = err instanceof Error ? err.message : "LLM call failed";
      console.error(`[price-patterns] LLM failed for ${symbol}:`, err);
    }
  } else {
    llmError = "No recurring patterns met the minimum sample size";
  }

  // 5) Persist cache (graceful degradation: engine results are cached even if LLM failed)
  try {
    const row: PricePatternCache = {
      symbol,
      patternsJson: JSON.stringify(analysis),
      summaryJson: JSON.stringify(llmSummary),
      computedAt: new Date(),
      dataSourceDate: analysis.dataEnd,
    };
    await db.pricePatternCache.upsert({
      where: { symbol },
      create: row,
      update: {
        patternsJson: row.patternsJson,
        summaryJson: row.summaryJson,
        computedAt: row.computedAt,
        dataSourceDate: row.dataSourceDate,
      },
    });
  } catch (err) {
    console.warn(`[price-patterns] cache write failed for ${symbol}:`, err);
  }

  return NextResponse.json({
    ...analysis,
    companyName,
    llmSummary,
    llmError,
    cached: false,
    computedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  });
}

async function explainWithLlm(symbol: string, companyName: string, analysis: PricePatternAnalysis): Promise<LlmSummary> {
  const input = {
    symbol,
    companyName,
    historyRange: `${analysis.dataStart} to ${analysis.dataEnd}`,
    tradingDays: analysis.totalBars,
    detectedPatterns: analysis.patterns,
    monthlySeasonality: analysis.seasonality,
    keyPriceZones: analysis.keyZones.map((z) => ({
      low: z.low, high: z.high, touches: z.touches, visits: z.visits,
      bounces: z.bounces, rejections: z.rejections, volumeVsAvg: z.volumeVsAvg,
    })),
    pressure: analysis.pressure
      ? {
          buyingDays: analysis.pressure.buyingDays,
          sellingDays: analysis.pressure.sellingDays,
          buyingAvgNext5Pct: analysis.pressure.buyingAvgNext5Pct,
          sellingAvgNext5Pct: analysis.pressure.sellingAvgNext5Pct,
          buyingHitRate: analysis.pressure.buyingHitRate,
          sellingHitRate: analysis.pressure.sellingHitRate,
        }
      : null,
    gapStats: analysis.gaps,
    postEventDrift: analysis.drift,
  };

  const client = await ZAI.create();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Engine output for ${symbol} — ${companyName} (${input.tradingDays} trading days, ${input.historyRange}).\n` +
        `Explain every pattern below for a low-financial-literacy Pakistani retail investor, following the hard rules.\n\n` +
        `ENGINE JSON:\n${JSON.stringify(input)}`,
    },
  ];

  const completion = (await Promise.race([
    client.chat.completions.create({ messages, temperature: 0.3, max_tokens: 2000 }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout after 40s")), LLM_TIMEOUT_MS)
    ),
  ])) as Awaited<ReturnType<typeof client.chat.completions.create>>;

  const raw: string = completion?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonFromLlm(raw);
  if (!parsed) throw new Error("LLM returned unparseable JSON");

  const explanations: Record<string, string> = {};
  if (Array.isArray(parsed?.patternExplanations)) {
    for (const e of parsed.patternExplanations) {
      if (e && typeof e.key === "string" && typeof e.explanation === "string" && e.explanation.trim()) {
        explanations[e.key] = e.explanation.trim();
      }
    }
  }

  return {
    overallSummary:
      typeof parsed?.overallSummary === "string" && parsed.overallSummary.trim()
        ? parsed.overallSummary.trim()
        : "",
    notableObservations: Array.isArray(parsed?.notableObservations)
      ? parsed.notableObservations.filter((o: unknown): o is string => typeof o === "string" && !!o.trim()).slice(0, 5)
      : [],
    patternExplanations: explanations,
  };
}

function safeParseSummary(json: string): LlmSummary | null {
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && (v.overallSummary || v.patternExplanations || v.notableObservations)) {
      return {
        overallSummary: typeof v.overallSummary === "string" ? v.overallSummary : "",
        notableObservations: Array.isArray(v.notableObservations) ? v.notableObservations : [],
        patternExplanations: v.patternExplanations && typeof v.patternExplanations === "object" ? v.patternExplanations : {},
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseJsonFromLlm(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1]); } catch { /* fall through */ }
    }
    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
    }
    return null;
  }
}
