/**
 * Task 129 — company-results pattern cache warmer.
 *
 * The /api/result-patterns/[symbol] route computes + caches patterns per
 * symbol on demand. This script warms the ResultPatternCache for symbols
 * whose financials snapshot changed since the last warm run (mtime newer
 * than the marker file), so the scheduled pipeline satisfies
 * "company-results pattern refresh, when new company results exist" without
 * duplicating the route's logic. It upserts the ENGINE results only
 * (patterns + results JSON, summaryJson=null note) — never deletes rows.
 *
 * Usage: bun scripts/task129_warm_result_patterns.ts [--all]
 */
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = process.cwd();
const FIN_DIR = path.join(ROOT, "data", "financials");
const MARKER = path.join(ROOT, "data", "backtest_reports", "task129", "ops", "result_pattern_marker.json");

interface ParsedQuarter { period?: string; periodEnd?: string; [k: string]: unknown }

interface FinancialFile {
  quarters?: ParsedQuarter[];
  quarterly?: ParsedQuarter[];
  results?: ParsedQuarter[];
  fetchedAt?: string;
  fetched_at?: string;
  [k: string]: unknown;
}

function quartersOf(f: FinancialFile): ParsedQuarter[] {
  return f.quarters ?? f.quarterly ?? f.results ?? [];
}

async function main() {
  const db = new PrismaClient();
  const args = process.argv.slice(2);
  const forceAll = args.includes("--all");
  let lastRunMs = 0;
  try {
    if (existsSync(MARKER)) lastRunMs = (JSON.parse(readFileSync(MARKER, "utf8")) as { ts: number }).ts ?? 0;
  } catch { /* first run */ }

  if (!existsSync(FIN_DIR)) {
    console.log(JSON.stringify({ status: "skipped", reason: "no data/financials directory" }));
    await db.$disconnect();
    return;
  }

  const files = readdirSync(FIN_DIR).filter((f) => f.endsWith(".json"));
  const changed: string[] = [];
  const nowMs = Date.now();
  for (const f of files) {
    const p = path.join(FIN_DIR, f);
    try {
      const st = statSync(p);
      if (forceAll || st.mtimeMs > lastRunMs) changed.push(f.replace(/\.json$/, ""));
    } catch { /* ignore unreadable */ }
  }
  // Bound the work per run (cache warming is incremental across days).
  const BATCH = changed.slice(0, 60);
  let warmed = 0, noData = 0, failed = 0;
  const failures: { symbol: string; error: string }[] = [];

  const { detectPatterns } = await import(path.join(ROOT, "src/lib/latent/mock-company-results"));
  const { fetchFinancialResults } = await import(path.join(ROOT, "src/lib/latent/financial-results"));

  for (const sym of BATCH) {
    try {
      const payload = await fetchFinancialResults(sym);
      if (!payload || !payload.results || payload.results.length === 0) { noData++; continue; }
      const patterns = detectPatterns(payload.results as never);
      await db.resultPatternCache.upsert({
        where: { symbol: sym },
        create: {
          symbol: sym,
          resultsJson: JSON.stringify(payload.results),
          patternsJson: JSON.stringify(patterns),
          summaryJson: JSON.stringify(null),
          dataSourceDate: (payload.results[payload.results.length - 1] as { periodEnd?: string })?.periodEnd ?? null,
        },
        update: {
          resultsJson: JSON.stringify(payload.results),
          patternsJson: JSON.stringify(patterns),
          dataSourceDate: (payload.results[payload.results.length - 1] as { periodEnd?: string })?.periodEnd ?? null,
          computedAt: new Date(),
        },
      });
      warmed++;
    } catch (e) {
      failed++;
      failures.push({ symbol: sym, error: String((e as Error)?.message ?? e).slice(0, 120) });
    }
  }

  mkdirSync(path.dirname(MARKER), { recursive: true });
  writeFileSync(MARKER, JSON.stringify({ ts: nowMs, warmed, changed_detected: changed.length }));
  console.log(JSON.stringify({
    status: "ok", changed_files: changed.length, warmed, no_data: noData, failed,
    failures: failures.slice(0, 5),
    note: "engine patterns cached; LLM layman summaries remain on-demand via /api/result-patterns/[symbol]",
  }));
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
