/**
 * Task 129 — Model M evidence-cache refresh (scheduler stage "modelm_cache").
 *
 * Builds + persists the Model M evidence package (technical section, monthly
 * patterns, Task 111 multi-source evidence, content-only hash) for the
 * tracked universe WITHOUT calling the LLM. GLM-4.6 decisions stay on-demand
 * (user POST /api/model-m/[symbol]) and in the host GLM runner — the cache
 * only guarantees that evidence is fresh and verifiable before analysis.
 *
 * Deduplicated by (symbol, dataCutoff, contentHash): unchanged evidence is
 * never re-packaged. Unavailable/stale symbols still get packages (with
 * quality flags) so the UI can show honest coverage.
 *
 * Usage:
 *   bun scripts/task129_model_m_cache.ts [--symbols A,B,C] [--limit N]
 */
import { PrismaClient } from "@prisma/client";
import { buildModelMEvidence } from "../src/lib/latent/model-m/engine";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const db = new PrismaClient();
  const limit = Math.min(200, Math.max(1, Number(arg("limit") ?? 25) || 25));
  let symbols: string[];
  const symbolsArg = arg("symbols");
  if (symbolsArg) {
    symbols = symbolsArg.split(",").map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  } else {
    const pilot = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL",
      "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL",
      "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"];
    symbols = pilot;
  }
  symbols = symbols.slice(0, limit);

  const results: Array<{ symbol: string; status: string; packageId?: string; freshness?: string; note?: string }> = [];
  for (const sym of symbols) {
    try {
      const built = await buildModelMEvidence(sym);
      if ("error" in built) {
        results.push({ symbol: sym, status: "evidence_error", note: built.error.slice(0, 120) });
        continue;
      }
      results.push({
        symbol: sym,
        status: "cached",
        packageId: built.pkg.packageId,
        freshness: built.dataQuality.status,
        note: built.dataQuality.freshnessNote,
      });
    } catch (e) {
      results.push({ symbol: sym, status: "error", note: String((e as Error)?.message ?? e).slice(0, 120) });
    }
  }

  const cached = results.filter((r) => r.status === "cached").length;
  console.log(JSON.stringify({
    status: "ok", requested: symbols.length, cached,
    errors: results.length - cached,
    results,
  }));
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
