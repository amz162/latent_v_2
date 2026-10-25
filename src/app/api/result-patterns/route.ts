import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/result-patterns — bulk read of the ResultPatternCache table.
//
// Task 28-A — user requirement: "make an api to fetch from the db, so we
// don't have to interpret at run time". This endpoint is a PURE database
// read — no quarterly-results fetching, no pattern detection, no LLM calls.
// Every row was precomputed for ALL stocks (where quarterly results exist)
// by scripts/precompute_all_pattern_caches.ts.
//
// Query params:
//   ?symbols=ENGRO,HUBC   — return only these symbols (comma separated)
//   ?limit=100&offset=0   — pagination (default 200, max 1000)
//   ?full=1               — include the full cached payload per row
//                           (quarterly results array + detected patterns +
//                           LLM layman summary); otherwise a light summary
//
// Response rows (light mode):
//   { symbol, company, quarters, patternCount, patternTitles,
//     dataSourceDate, computedAt, hasLlmSummary }
export const dynamic = "force-dynamic";

interface LightRow {
  symbol: string;
  company: string;
  quarters: number;
  patternCount: number;
  patternTitles: string[];
  dataSourceDate: string | null;
  computedAt: string;
  hasLlmSummary: boolean;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols");
  const full = url.searchParams.get("full") === "1";
  const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  try {
    const where = symbols ? { symbol: { in: symbols } } : {};
    const [total, rows] = await Promise.all([
      db.resultPatternCache.count({ where: where as never }),
      db.resultPatternCache.findMany({
        where: where as never,
        orderBy: { symbol: "asc" },
        take: limit,
        skip: offset,
      }),
    ]);

    if (full) {
      return NextResponse.json({
        source: "db",
        table: "ResultPatternCache",
        count: rows.length,
        total,
        offset,
        limit,
        rows: rows.map((r) => ({
          symbol: r.symbol,
          computedAt: r.computedAt.toISOString(),
          dataSourceDate: r.dataSourceDate,
          results: safeParse(r.resultsJson),
          patterns: safeParse(r.patternsJson),
          llmSummary: safeParse(r.summaryJson),
        })),
      });
    }

    const light: LightRow[] = rows.map((r) => {
      const results = safeParse(r.resultsJson) as { company?: string }[] | null;
      const patterns = safeParse(r.patternsJson) as { label?: string }[] | null;
      const patternList = Array.isArray(patterns) ? patterns : [];
      return {
        symbol: r.symbol,
        company: (Array.isArray(results) && results[0]?.company) || r.symbol,
        quarters: Array.isArray(results) ? results.length : 0,
        patternCount: patternList.length,
        patternTitles: patternList.map((p) => p?.label).filter((t): t is string => typeof t === "string"),
        dataSourceDate: r.dataSourceDate,
        computedAt: r.computedAt.toISOString(),
        hasLlmSummary: hasSummary(r.summaryJson),
      };
    });

    return NextResponse.json({
      source: "db",
      table: "ResultPatternCache",
      count: light.length,
      total,
      offset,
      limit,
      rows: light,
    });
  } catch (err) {
    console.error("[result-patterns:list] failed:", err);
    return NextResponse.json({ error: "Failed to read result-pattern cache" }, { status: 500 });
  }
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hasSummary(json: string): boolean {
  try {
    const v = JSON.parse(json);
    return !!(v && typeof v === "object" && (v.laymanSummary || v.patternExplanations || v.watchNext));
  } catch {
    return false;
  }
}
