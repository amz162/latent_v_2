// ============================================================================
// Task 111 — LLM multi-source signal runner (bun).
//
// For each symbol: build evidence -> (optional) LLM analysis -> strict
// validation -> deterministic R:R -> capital protection -> research signal.
//
// Usage:
//   bun scripts/task111_llm_runner.ts --symbols HUBC,ENGRO [--mock] [--limit N]
//        [--evidence-only] [--probe] [--force]
// Outputs:
//   data/backtest_reports/task111/signals/{SYMBOL}.json   (decision records)
//   data/backtest_reports/task111/llm_cache/              (idempotency cache)
//   data/backtest_reports/task111/ops/provider_calls.jsonl (provider log)
//
// Idempotent: a symbol is skipped when a cached signal with the SAME evidence
// hash exists (unchanged evidence is never re-sent to the provider).
// Provider failure -> record.llmState = "llm_unavailable"; never fabricated.
// ============================================================================
import { promises as fs } from "fs";
import path from "path";
import { buildEvidenceBundle, primeMarketEvidence, type MarketContext } from "../src/lib/latent/llm/evidence-builder";
import { runStockSignal, computeEvidenceQuality, type Task111SignalRecord } from "../src/lib/latent/llm/stock-signal-engine";
import { createLLMClient, llmConfigFromEnv, evidenceHash } from "../src/lib/latent/llm/llm-provider";
import type { RRBar } from "../src/lib/latent/llm/risk-reward-engine";

const ROOT = process.cwd();
function arg(name: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const OUT_DIR_OVERRIDE = arg("out-dir");
const OUT_DIR = OUT_DIR_OVERRIDE ? path.join(ROOT, OUT_DIR_OVERRIDE) : path.join(ROOT, "data/backtest_reports/task111/signals");
const CACHE_DIR = path.join(ROOT, "data/backtest_reports/task111", OUT_DIR_OVERRIDE ? "llm_cache_mock" : "llm_cache");
const OPS_DIR = path.join(ROOT, "data/backtest_reports/task111/ops");

function hasFlag(name: string): boolean {
  return process.argv.includes("--" + name);
}

async function writeJsonl(file: string, obj: unknown): Promise<void> {
  await fs.appendFile(file, JSON.stringify(obj) + "\n", "utf8");
}

// Task 112 — append-only signal history: every decision (ok, unavailable,
// rejected, stale) is preserved under task112/llm_signal_history; existing
// records are never overwritten, so retries stay distinguishable.
async function appendHistory(rec: Task111SignalRecord | Record<string, unknown>): Promise<void> {
  const r = rec as Record<string, unknown>;
  const sym = String(r.symbol ?? "UNKNOWN");
  const ts = String(r.decisionTimestamp ?? "unknown");
  const h = String(r.evidenceHash ?? "nohash");
  const id = `${sym}-${ts.slice(0, 19)}-${h.slice(0, 8)}`;
  const dir = path.join(ROOT, "data/backtest_reports/task112/llm_signal_history");
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, `${id}.json`);
  try {
    await fs.access(fp);
    return; // append-only: identical record already stored
  } catch {
    /* new record */
  }
  await fs.writeFile(fp, JSON.stringify({ ...r, signalId: id, provenance: "runner_append" }, null, 1), "utf8");
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.mkdir(OPS_DIR, { recursive: true });

  if (hasFlag("probe")) {
    const client = createLLMClient(llmConfigFromEnv());
    const t0 = Date.now();
    try {
      const r = await client.complete([{ role: "user", content: "Reply with exactly: OK" }]);
      console.log(JSON.stringify({ probe: "ok", provider: r.provider, model: r.model, latencyMs: Date.now() - t0 }));
    } catch (e) {
      console.log(JSON.stringify({ probe: "failed", error: String((e as Error).message ?? e) }));
      process.exit(2);
    }
    return;
  }

  const symbolsArg = arg("symbols");
  if (!symbolsArg) {
    console.error("--symbols required");
    process.exit(1);
  }
  const symbols = symbolsArg.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const limit = Number(arg("limit") ?? "0");
  const mock = hasFlag("mock");
  const evidenceOnly = hasFlag("evidence-only");
  const force = hasFlag("force");
  const genId = arg("generation") ?? "task111-llm-multisource-gen1";

  const client = createLLMClient({ ...llmConfigFromEnv(), provider: mock ? "mock" : llmConfigFromEnv().provider });

  await primeMarketEvidence();

  // Market context: universe breadth (pct of symbols with close > SMA30).
  const { db } = await import("../src/lib/db");
  const breadthRows = await db.$queryRaw<Array<{ above: number; total: number }>>`
    SELECT SUM(CASE WHEN above THEN 1 ELSE 0 END) as above, COUNT(*) as total FROM (
      SELECT o.symbol, o.close > (SELECT AVG(c.close) FROM (SELECT close FROM OhlcvBar WHERE symbol = o.symbol ORDER BY date DESC LIMIT 30) c) AS above
      FROM OhlcvBar o
      WHERE o.date = (SELECT MAX(date) FROM OhlcvBar WHERE symbol = o.symbol)
    )`;
  const marketContext: MarketContext = {
    asOfSession: "",
    universeSize: Number(breadthRows[0]?.total ?? 0),
    pctAboveMa30: Number(breadthRows[0]?.total ?? 0) > 0 ? (Number(breadthRows[0].above) / Number(breadthRows[0].total)) * 100 : 0,
    breadthNote: `Universe breadth snapshot: ${breadthRows[0]?.above ?? 0}/${breadthRows[0]?.total ?? 0} symbols closed above their 30-session mean price (deterministic, OhlcvBar).`,
  };

  const results: Array<{ symbol: string; status: string; finalSignal?: string; evidenceQuality?: number; error?: string; llmState?: string }> = [];
  const selected = limit > 0 ? symbols.slice(0, limit) : symbols;

  for (const sym of selected) {
    try {
      const bundle = await buildEvidenceBundle(sym, marketContext);
      if ("error" in bundle) {
        results.push({ symbol: sym, status: "skipped", error: bundle.error });
        await writeJsonl(path.join(OPS_DIR, "runner_log.jsonl"), { ts: new Date().toISOString(), symbol: sym, event: "skipped", reason: bundle.error });
        continue;
      }
      marketContext.asOfSession = bundle.evidence.dataCutoff;
      const evHash = evidenceHash(bundle.evidence);
      // Early freshness gate: never send stale evidence to the provider.
      const cutoffAgeDays = (Date.now() - Date.parse(bundle.evidence.dataCutoff + "T17:00:00Z")) / 86400000;
      if (cutoffAgeDays > 10) {
        const staleRecord = {
          generationId: genId,
          symbol: sym,
          decisionTimestamp: new Date().toISOString(),
          dataCutoff: bundle.evidence.dataCutoff,
          evidenceHash: evHash,
          llmState: "llm_unavailable",
          llmFailureReason: `stale_evidence: last session ${bundle.evidence.dataCutoff} is ${Math.round(cutoffAgeDays)} days old`,
          finalSignal: "NO_TRADE",
          finalSignalReason: "Evidence frontier is stale; no LLM analysis and no fabricated signal.",
          evidenceQualityScore: computeEvidenceQuality(bundle.evidence).score,
          staleSkipped: true,
        };
        await fs.writeFile(path.join(OUT_DIR, `${sym}.json`), JSON.stringify(staleRecord, null, 1), "utf8");
        await appendHistory(staleRecord);
        await writeJsonl(path.join(OPS_DIR, "runner_log.jsonl"), { ts: new Date().toISOString(), symbol: sym, event: "stale_skipped", cutoff: bundle.evidence.dataCutoff, ageDays: Math.round(cutoffAgeDays) });
        results.push({ symbol: sym, status: "stale_skipped", finalSignal: "NO_TRADE", error: staleRecord.llmFailureReason });
        continue;
      }
      const cacheFile = path.join(CACHE_DIR, `${sym}_${evHash}.json`);
      if (!force && !evidenceOnly) {
        try {
          const cached = JSON.parse(await fs.readFile(cacheFile, "utf8")) as Task111SignalRecord;
          results.push({ symbol: sym, status: "cached", finalSignal: cached.finalSignal, evidenceQuality: cached.evidenceQualityScore, llmState: cached.llmState });
          await fs.writeFile(path.join(OUT_DIR, `${sym}.json`), JSON.stringify(cached, null, 1), "utf8");
          continue;
        } catch {
          /* cache miss -> run */
        }
      }
      const rrBars: RRBar[] = bundle.bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close }));
      if (evidenceOnly) {
        const q = computeEvidenceQuality(bundle.evidence);
        const out = { symbol: sym, evidence: bundle.evidence, evidenceQualityScore: q.score, evidenceQualityParts: q.parts, evidenceHash: evHash, patterns: bundle.patterns, pitPatterns: { candidates: bundle.pitPatterns.candidates, keyZones: bundle.pitPatterns.keyZones, barsUsed: bundle.pitPatterns.bars_used }, newsCounts: { company: bundle.news.company.length, national: bundle.news.national.length, international: bundle.news.international.length } };
        await fs.writeFile(path.join(OUT_DIR, `${sym}.evidence.json`), JSON.stringify(out, null, 1), "utf8");
        results.push({ symbol: sym, status: "evidence_only", evidenceQuality: q.score });
        continue;
      }
      const record = await runStockSignal(bundle.evidence, rrBars, { client, generationId: genId });
      await fs.writeFile(path.join(OUT_DIR, `${sym}.json`), JSON.stringify(record, null, 1), "utf8");
      await appendHistory(record);
      await fs.writeFile(cacheFile, JSON.stringify(record), "utf8");
      await writeJsonl(path.join(OPS_DIR, "provider_calls.jsonl"), {
        ts: record.decisionTimestamp,
        symbol: sym,
        provider: record.provider,
        model: record.model,
        promptVersion: record.promptVersion,
        evidenceHash: record.evidenceHash,
        llmState: record.llmState,
        failureReason: record.llmFailureReason,
        parseErrors: record.parseErrors,
        finalSignal: record.finalSignal,
      });
      results.push({ symbol: sym, status: "ok", finalSignal: record.finalSignal, evidenceQuality: record.evidenceQualityScore, llmState: record.llmState });
    } catch (e) {
      results.push({ symbol: sym, status: "error", error: String((e as Error).message ?? e).slice(0, 200) });
      await writeJsonl(path.join(OPS_DIR, "runner_log.jsonl"), { ts: new Date().toISOString(), symbol: sym, event: "error", reason: String((e as Error).message ?? e).slice(0, 300) });
    }
  }
  console.log(JSON.stringify({ run: "task111_llm_runner", mock, evidenceOnly, processed: results.length, results }, null, 1));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
