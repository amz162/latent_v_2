import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  computeAndSaveReport,
  isFreshReport,
  loadPriceBars,
} from "@/lib/latent/price-patterns-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/price-patterns/precompute
// Nightly batch worker (called by the pattern-precompute mini-service).
// Processes up to `limit` symbols per call: runs the statistical engine +
// one LLM explanation pass per symbol and stores everything in
// PricePatternReport. Called repeatedly until `remaining` hits 0.

const PRECOMPUTE_KEY = process.env.PRECOMPUTE_KEY || "latent-pk-nightly";
/** Symbols that just failed are skipped for 12h so the nightly loop advances. */
const FAIL_COOLDOWN_MS = 12 * 60 * 60 * 1000;

let symbolCache: { at: number; symbols: string[] } | null = null;
const failAt = new Map<string, number>();

async function allSymbols(): Promise<string[]> {
  if (symbolCache && Date.now() - symbolCache.at < 10 * 60 * 1000) {
    return symbolCache.symbols;
  }
  // raw DISTINCT — Prisma's findMany({distinct}) dedupes client-side, which
  // would pull all 1M+ rows into memory. SQLite does this in ~2ms.
  const rows = await db.$queryRaw<{ symbol: string }[]>`SELECT DISTINCT symbol FROM OhlcvBar`;
  const symbols = rows.map((r) => r.symbol).sort();
  symbolCache = { at: Date.now(), symbols };
  return symbols;
}

export async function POST(req: Request) {
  const key = req.headers.get("x-precompute-key");
  if (key !== PRECOMPUTE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { limit?: number; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* defaults */
  }
  const limit = Math.min(25, Math.max(1, Number(body.limit) || 10));
  const force = !!body.force;

  const symbols = await allSymbols();
  const reports = await db.pricePatternReport.findMany({
    select: { symbol: true, computedAt: true, llmJson: true, patternCount: true },
  });
  const bySymbol = new Map(reports.map((r) => [r.symbol, r]));

  const pending = symbols.filter((s) => {
    if (force) return true;
    const failedAt = failAt.get(s);
    if (failedAt && Date.now() - failedAt < FAIL_COOLDOWN_MS) return false;
    return !isFreshReport(bySymbol.get(s) ?? null);
  });

  const todo = pending.slice(0, limit);
  let processed = 0;
  const failed: { symbol: string; reason: string }[] = [];

  for (const sym of todo) {
    try {
      const bars = await loadPriceBars(sym);
      await computeAndSaveReport(sym, bars);
      failAt.delete(sym);
      processed++;
    } catch (err) {
      failAt.set(sym, Date.now());
      failed.push({ symbol: sym, reason: err instanceof Error ? err.message : "unknown" });
      console.error(`[price-patterns-precompute] ${sym} failed:`, err instanceof Error ? err.message : err);
    }
  }

  const freshCount = symbols.filter((s) => isFreshReport(bySymbol.get(s) ?? null)).length;

  return NextResponse.json({
    processed,
    failed,
    attempted: todo.length,
    remaining: Math.max(0, pending.length - todo.length),
    total: symbols.length,
    freshCount,
  });
}
