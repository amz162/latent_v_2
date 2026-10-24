// GET /api/result-patterns/[symbol] — Issue 3: "Result Pattern" tab of the
// Pattern Finder. Detects recurring patterns in the company's QUARTERLY
// RESULTS (revenue/profit/EPS/dividend), adds a GLM layman explanation, and
// caches EVERYTHING permanently in the ResultPatternCache DB table.
//
// Cache policy (user requirement): rows are NEVER deleted or expired by the
// server — a repeat visit is a pure DB read (no recalculation, no LLM call).
// Recompute happens ONLY via ?refresh=1 (explicit user action) or the
// precompute script (which upserts, never deletes).
import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import type { ChatMessage } from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { fetchFinancialResults } from "@/lib/latent/financial-results";
import { detectPatterns, type QuarterlyResult, type DetectedPattern } from "@/lib/latent/mock-company-results";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ResultLlmSummary {
  laymanSummary: string;
  patternExplanations: Record<string, string>;
  watchNext: string;
}

const SYSTEM_PROMPT = `You are Latent.pk's financial-results analyst for the Pakistan Stock Exchange (PSX). You receive JSON describing a company's quarterly results (revenue, profit, EPS, dividends) plus statistically detected recurring patterns in those results. Your job: explain to a Pakistani retail investor with LOW financial literacy what recurring patterns exist in the company's reported results.

ABSOLUTE HARD RULES (violations make the output unusable):
1. Output ONLY valid JSON — no markdown fences, no commentary outside the JSON object.
2. NEVER invent, round, or alter any number. Only reference numbers/periods that appear in the input JSON.
3. NEVER give buy/sell advice or recommendations. Phrase everything as a HISTORICAL PATTERN OBSERVATION about reported results.
4. Layman language — define any technical term in a short clause. Pakistan context (Rs., fiscal year) where natural.
5. Don't fabricate reasons — use "may be due to" language for hypotheses.

Your JSON output shape (exactly):
{
  "laymanSummary": "one short paragraph (4-6 sentences) describing the recurring patterns in this company's quarterly results",
  "patternExplanations": [{ "title": "<repeat the pattern's title from input>", "explanation": "2-3 layman sentences using only input numbers/periods" }],
  "watchNext": "1-2 sentences on what to watch in the NEXT quarterly result, based only on the detected patterns"
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

  // 1) Permanent cache check (unless ?refresh=1) — any age is served.
  if (!forceRefresh) {
    try {
      const cached = await db.resultPatternCache.findUnique({ where: { symbol } });
      if (cached) {
        const results = JSON.parse(cached.resultsJson) as QuarterlyResult[];
        const patterns = JSON.parse(cached.patternsJson) as DetectedPattern[];
        const llmSummary = safeParseSummary(cached.summaryJson);
        return NextResponse.json({
          symbol,
          company: results[0]?.company || symbol,
          results,
          patterns,
          llmSummary,
          cached: true,
          computedAt: cached.computedAt.toISOString(),
          latencyMs: Date.now() - startTime,
        });
      }
    } catch (err) {
      console.warn(`[result-patterns] cache read failed for ${symbol}:`, err);
    }
  }

  // 2) Load quarterly results (shared lib: disk snapshot → askanalyst API)
  const payload = await fetchFinancialResults(symbol);
  if (!payload || payload.results.length === 0) {
    return NextResponse.json(
      { error: `No quarterly results data available for ${symbol}`, symbol, results: [] },
      { status: 404 }
    );
  }

  const results = payload.results;
  const patterns = detectPatterns(results);

  // 3) LLM layman summary (only the engine JSON goes in)
  let llmSummary: ResultLlmSummary | null = null;
  let llmError: string | null = null;
  if (patterns.length > 0 && results.length >= 4) {
    try {
      llmSummary = await explainWithLlm(symbol, payload.company, results, patterns);
    } catch (err) {
      llmError = err instanceof Error ? err.message : "LLM call failed";
      console.error(`[result-patterns] LLM failed for ${symbol}:`, err);
    }
  } else {
    llmError = "Not enough quarterly results for pattern explanations";
  }

  // 4) Persist PERMANENTLY (engine results cached even if LLM failed)
  try {
    await db.resultPatternCache.upsert({
      where: { symbol },
      create: {
        symbol,
        resultsJson: JSON.stringify(results),
        patternsJson: JSON.stringify(patterns),
        summaryJson: JSON.stringify(llmSummary),
        dataSourceDate: results[results.length - 1]?.periodEnd || null,
      },
      update: {
        resultsJson: JSON.stringify(results),
        patternsJson: JSON.stringify(patterns),
        summaryJson: JSON.stringify(llmSummary),
        dataSourceDate: results[results.length - 1]?.periodEnd || null,
        computedAt: new Date(),
      },
    });
  } catch (err) {
    console.warn(`[result-patterns] cache write failed for ${symbol}:`, err);
  }

  return NextResponse.json({
    symbol,
    company: payload.company,
    results,
    patterns,
    llmSummary,
    llmError,
    cached: false,
    computedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
  });
}

async function explainWithLlm(
  symbol: string,
  companyName: string,
  results: QuarterlyResult[],
  patterns: DetectedPattern[]
): Promise<ResultLlmSummary> {
  const input = {
    symbol,
    companyName,
    quartersCovered: results.length,
    range: `${results[0]?.period} → ${results[results.length - 1]?.period}`,
    detectedPatterns: patterns.map((p) => ({
      title: p.label,
      description: p.detail,
      severity: p.severity,
      strength: p.strength,
      affectedQuarters: p.affectedQuarters,
      supportingData: p.supportingData,
    })),
    recentQuarters: results.slice(-8).map((r) => ({
      period: r.period,
      revenue: r.metrics.revenue,
      profitAfterTax: r.metrics.profitAfterTax,
      eps: r.metrics.eps,
      revenueYoYGrowth: r.metrics.revenueYoYGrowth,
      epsYoYGrowth: r.metrics.epsYoYGrowth,
      netMargin: r.metrics.netMargin,
      dividendPerShare: r.metrics.dividendPerShare,
    })),
  };

  const client = await ZAI.create();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `Quarterly-results pattern scan for ${symbol} — ${companyName} (${input.quartersCovered} quarters, ${input.range}).\n` +
        `Explain every detected pattern in layman language, following the hard rules.\n\n` +
        `ENGINE JSON:\n${JSON.stringify(input)}`,
    },
  ];

  const completion = (await Promise.race([
    client.chat.completions.create({ messages, temperature: 0.3, max_tokens: 1600 }),
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
      if (e && typeof e.title === "string" && typeof e.explanation === "string" && e.explanation.trim()) {
        explanations[e.title] = e.explanation.trim();
      }
    }
  }

  return {
    laymanSummary:
      typeof parsed?.laymanSummary === "string" && parsed.laymanSummary.trim()
        ? parsed.laymanSummary.trim()
        : "",
    patternExplanations: explanations,
    watchNext: typeof parsed?.watchNext === "string" ? parsed.watchNext.trim() : "",
  };
}

function safeParseSummary(json: string): ResultLlmSummary | null {
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && (v.laymanSummary || v.patternExplanations || v.watchNext)) {
      return {
        laymanSummary: typeof v.laymanSummary === "string" ? v.laymanSummary : "",
        patternExplanations:
          v.patternExplanations && typeof v.patternExplanations === "object" ? v.patternExplanations : {},
        watchNext: typeof v.watchNext === "string" ? v.watchNext : "",
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
