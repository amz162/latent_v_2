/**
 * Task 129 E2E driver — run the full Model M analysis for given symbols
 * against the REAL database + REAL GLM-4.6 provider, print a compact verdict.
 * Usage: bun scripts/task129_e2e_analysis.ts --symbols MEBL,LUCK [--stale ENGRO]
 */
import { runModelMAnalysis, getAnalysisHistory, type ModelMAnalysisResult } from "../src/lib/latent/model-m/engine";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function run(sym: string) {
  console.log(`\n══ ${sym} ══`);
  try {
    const r = await runModelMAnalysis(sym, { analysisHorizon: "10d", trigger: "e2e" });
    if ("blocked" in r && r.blocked) {
      console.log(`BLOCKED: ${r.reason}`);
      console.log(`  data quality: ${r.dataQuality.status} · ${r.dataQuality.freshnessNote}`);
      return;
    }
    if ("error" in r && r.error) {
      console.log(`ERROR: ${r.reason}`);
      return;
    }
    const ok = r as ModelMAnalysisResult;
    console.log(`decision: ${ok.decision.decision} (llm ${ok.decision.llmState}, model ${ok.decision.llmModel})`);
    console.log(`  entry ${ok.decision.entryPrice} · SL ${ok.decision.stopLoss} · TP1/2/3 ${ok.decision.tp1}/${ok.decision.tp2}/${ok.decision.tp3} · RR→TP1 1:${ok.decision.riskRewardTp1} · ATR ${ok.decision.atr14}`);
    console.log(`  evidence: ${ok.evidence.packageId} hash ${ok.evidence.contentHash.slice(0, 12)}… quality ${ok.evidence.qualityScore}/100`);
    console.log(`  missing sources: ${ok.evidence.missingSources.length ? ok.evidence.missingSources.join(", ") : "none"}`);
    console.log(`  warnings: ${ok.decision.warnings.length ? ok.decision.warnings.join(", ") : "none"}`);
    if (ok.decision.sellNote) console.log(`  SELL note: ${ok.decision.sellNote}`);
    console.log(`  reasoning: ${(ok.decision.reasoning || "").slice(0, 220)}`);
    const hist = await getAnalysisHistory(sym, 5);
    console.log(`  history rows: ${hist.length} (append-only)`);
  } catch (e) {
    console.log(`EXCEPTION: ${(e as Error).message}`);
  }
}

const symbols = (arg("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
for (const s of symbols) await run(s);
process.exit(0);
