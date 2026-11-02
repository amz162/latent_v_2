/**
 * Task 105 Phase 8 — shadow observation LEVELS at the verified data frontier.
 * Uses the PRODUCTION computeRiskLevels at the latest verified session
 * (2026-10-29) for the 25 pilot symbols. The entry (next session open) is
 * NOT yet in the DB — recorded as TBD until a future session is imported.
 * No outcomes are fabricated. Output: _frontier_levels.json.
 */
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { computeRiskLevels } from "@/lib/latent/risk-levels";

const db = new PrismaClient({ log: ["error"] });
const PILOT = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL",
  "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL",
  "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"];
const FRONTIER = process.argv[2] ?? "2026-10-29";
const OUT = process.argv[3] ?? "data/backtest_reports/task105/_frontier_levels.json";

async function main() {
  const out: any = { frontier_date: FRONTIER, generated_at: new Date().toISOString(), symbols: {} };
  for (const sym of PILOT) {
    const bars = await db.ohlcvBar.findMany({
      where: { symbol: sym }, orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true } });
    const idx = bars.findIndex((b) => b.date === FRONTIER);
    if (idx < 0) { out.symbols[sym] = { status: "frontier_session_missing" }; continue; }
    const levels = computeRiskLevels(
      bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close })),
      FRONTIER, "BUY");
    const hasNext = idx + 1 < bars.length;
    out.symbols[sym] = levels
      ? { status: "levels_computed", decision_close: bars[idx].close,
           sl: levels.sl, tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3,
           entry: hasNext ? bars[idx + 1].open : "TBD_next_session_open_not_yet_imported",
           entry_date: hasNext ? bars[idx + 1].date : null }
      : { status: "levels_unavailable" };
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  const ok = Object.values(out.symbols).filter((s: any) => s.status === "levels_computed").length;
  console.log(`frontier levels: ${ok}/${PILOT.length} symbols -> ${OUT}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
