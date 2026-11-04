// ============================================================================
// Task 111 — deterministic test CLI (bun). Unit fixtures for the QA suite.
// Usage: bun scripts/task111_test_cli.ts <cmd> <in.json> <out.json>
// Commands:
//   validate-signal : {evidence, raw} -> {valid, errors}
//   risk-reward     : {bars, cutoffDate, minRR?, supportZones?} -> RR result
//   sanitize-news   : {text} -> {sanitized, injection}
//   evidence-quality: {evidence} -> {score, parts}
// ============================================================================
import { promises as fs } from "fs";
import { validateSignalOutput, type LLMEvidence } from "../src/lib/latent/llm/schemas";
import { computeRiskReward, type RRBar } from "../src/lib/latent/llm/risk-reward-engine";
import { sanitizeNewsText, detectInjection } from "../src/lib/latent/news/market-news-intelligence";

async function main() {
  const [cmd, inPath, outPath] = process.argv.slice(2);
  const input = JSON.parse(await fs.readFile(inPath, "utf8"));
  let out: unknown;
  if (cmd === "validate-signal") {
    out = validateSignalOutput(input.raw, input.evidence as LLMEvidence, Date.parse(input.now ?? "2026-11-04T12:00:00Z") || Date.now());
  } else if (cmd === "risk-reward") {
    out = computeRiskReward({ ...input, bars: input.bars as RRBar[] });
  } else if (cmd === "sanitize-news") {
    out = { sanitized: sanitizeNewsText(input.text, input.maxLen ?? 600), injection: detectInjection(input.text) };
  } else {
    throw new Error(`unknown cmd: ${cmd}`);
  }
  await fs.writeFile(outPath, JSON.stringify(out, null, 1), "utf8");
  console.log("ok");
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e?.message ?? e); process.exit(1); });
