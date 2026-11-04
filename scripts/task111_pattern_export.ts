// ============================================================================
// Task 111 — deterministic financial-pattern exporter (bun).
// Prints a JSON array of findCompanyFinancialPatterns() results for the given
// symbols so the Python artifact runner can verify/consume the EXACT TS logic
// (single implementation, no drift).
//   bun scripts/task111_pattern_export.ts --symbols HUBC,ENGRO [--out path.json]
// ============================================================================
import { promises as fs } from "fs";
import path from "path";
import { fetchFinancialResults } from "../src/lib/latent/financial-results";
import { findCompanyFinancialPatterns } from "../src/lib/latent/fundamentals/company-pattern-finder";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const symbols = (arg("symbols") ?? "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const out: unknown[] = [];
  for (const sym of symbols) {
    const fin = await fetchFinancialResults(sym);
    const quarters = fin?.results ?? [];
    out.push(findCompanyFinancialPatterns(sym, quarters, new Date().toISOString()));
  }
  const json = JSON.stringify(out, null, 1);
  const outFile = arg("out");
  if (outFile) {
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, json, "utf8");
    console.log("wrote", outFile);
  } else {
    console.log(json);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
