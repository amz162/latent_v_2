import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/price-patterns — bulk read of the PricePatternCache table.
//
// Task 28-A — user requirement: "make an api to fetch from the db, so we
// don't have to interpret at run time". This endpoint is a PURE database
// read — no pattern detection, no LLM calls, no OHLCV loading. Every row was
// precomputed for ALL stocks by scripts/precompute_all_pattern_caches.ts.
//
// Query params:
//   ?symbols=ENGRO,HUBC   — return only these symbols (comma separated)
//   ?limit=100&offset=0   — pagination (default 200, max 1000)
//   ?full=1               — include the complete cached analysis JSON per row
//                           (patterns + seasonality + zones + gaps + drift +
//                           LLM summary); otherwise a light summary is returned
//
// Response rows (light mode):
//   { symbol, patternCount, patternKeys, dataStart, dataEnd, totalBars,
//     computedAt, hasLlmSummary }
export const dynamic = "force-dynamic";

interface LightRow {
  symbol: string;
  patternCount: number;
  patternKeys: string[];
  dataStart: string | null;
  dataEnd: string | null;
  totalBars: number | null;
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
      db.pricePatternCache.count({ where: where as never }),
      db.pricePatternCache.findMany({
        where: where as never,
        orderBy: { symbol: "asc" },
        take: limit,
        skip: offset,
      }),
    ]);

    if (full) {
      return NextResponse.json({
        source: "db",
        table: "PricePatternCache",
        count: rows.length,
        total,
        offset,
        limit,
        rows: rows.map((r) => ({
          symbol: r.symbol,
          computedAt: r.computedAt.toISOString(),
          dataSourceDate: r.dataSourceDate,
          analysis: safeParse(r.patternsJson),
          llmSummary: safeParse(r.summaryJson),
        })),
      });
    }

    const light: LightRow[] = rows.map((r) => {
      const a = safeParse(r.patternsJson) as {
        patterns?: { key?: string }[];
        dataStart?: string;
        dataEnd?: string;
        totalBars?: number;
      } | null;
      const patterns = Array.isArray(a?.patterns) ? a!.patterns : [];
      return {
        symbol: r.symbol,
        patternCount: patterns.length,
        patternKeys: patterns.map((p) => p?.key).filter((k): k is string => typeof k === "string"),
        dataStart: a?.dataStart ?? null,
        dataEnd: a?.dataEnd ?? r.dataSourceDate ?? null,
        totalBars: typeof a?.totalBars === "number" ? a!.totalBars! : null,
        computedAt: r.computedAt.toISOString(),
        hasLlmSummary: hasSummary(r.summaryJson),
      };
    });

    return NextResponse.json({
      source: "db",
      table: "PricePatternCache",
      count: light.length,
      total,
      offset,
      limit,
      rows: light,
    });
  } catch (err) {
    console.error("[price-patterns:list] failed:", err);
    return NextResponse.json({ error: "Failed to read price-pattern cache" }, { status: 500 });
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
    return !!(v && typeof v === "object" && (v.overallSummary || v.patternExplanations || v.notableObservations));
  } catch {
    return false;
  }
}
