/**
 * Task 125 — premature-closure gate regression test.
 *
 * Reproduces the defect found in reports/operations/task125_ledger_reconciliation.md:
 * the lifecycle gate let `TIME_UP_AFTER_PARTIALS` (scale-out with a booked
 * partial leg) close a trade whose horizon window was only partially covered
 * by available bars. Run: bun scripts/task125_gate_test.ts
 */
import { simulateStrategy, type StrategyBar } from "../src/lib/latent/strategy-engine";
import { STANDARD_PSX } from "../src/lib/latent/trading-costs";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

// Partial h21 window: 16 bars, TP1 touched on bar 5, nothing else afterwards.
// Mirrors the real cohort: entry 2026-10-30, frontier 2026-11-23 (16 sessions < 21).
const bars: StrategyBar[] = [];
for (let i = 0; i < 16; i++) {
  const d = `2026-10-${30 + i}`.replace("2026-10-40", "2026-11-0" + (i - 10)); // dates are cosmetic
  const hitTp1 = i === 5;
  bars.push({
    date: `day-${String(i).padStart(2, "0")}`,
    open: 10, high: hitTp1 ? 10.6 : 10.1, low: 9.9, close: hitTp1 ? 10.55 : 10.0,
  });
}

const signal = {
  symbol: "TEST", direction: "BUY" as const, entryPrice: 10,
  sl: 9.0, tp1: 10.5, tp2: 11.0, tp3: 11.5, quantity: 1000,
};

const r = simulateStrategy("scale_out_50_25_25", signal, bars, STANDARD_PSX);
check("scale_out partial-window TP1 hit produces TIME_UP_AFTER_PARTIALS",
  r.exitReason === "TIME_UP_AFTER_PARTIALS", `exitReason=${r.exitReason}`);
check("engine marks the trade unresolved", r.unresolved === true, `unresolved=${r.unresolved}`);
check("partial window did not examine the full horizon",
  r.nBarsExamined === 16 && 16 < 21, `nBarsExamined=${r.nBarsExamined}`);

// The FIXED gate (src/lib/latent/prospective-lifecycle.ts) — must keep the trade open.
const fullHorizonExamined = r.nBarsExamined >= 21;
const shouldCloseFixed = !r.exitReason.startsWith("TIME_UP") || fullHorizonExamined;
check("FIXED gate keeps a partial-window timeout trade open", shouldCloseFixed === false);
if (shouldCloseFixed === false) {
  console.log("      (old gate would have computed: " +
    JSON.stringify(r.exitReason !== "TIME_UP" || fullHorizonExamined) + " → closed prematurely)");
}

// Full 21-bar window: timeout with the whole horizon examined → close is correct.
const barsFull: StrategyBar[] = [];
for (let i = 0; i < 21; i++) {
  barsFull.push({ date: `day-${String(i).padStart(2, "0")}`, open: 10, high: 10.1, low: 9.9, close: 10.0 });
}
const rFull = simulateStrategy("scale_out_50_25_25", signal, barsFull, STANDARD_PSX);
const fullExamined = rFull.nBarsExamined >= 21;
const shouldCloseFull = !rFull.exitReason.startsWith("TIME_UP") || fullExamined;
check("FIXED gate closes a full-horizon timeout trade", shouldCloseFull === true,
  `exitReason=${rFull.exitReason}, nBarsExamined=${rFull.nBarsExamined}`);

// Plain TIME_UP without partials on a partial window also stays open.
const rPlain = simulateStrategy("fixed_first_hit", signal, bars.slice(0, 4), STANDARD_PSX);
const shouldClosePlain = !rPlain.exitReason.startsWith("TIME_UP") || rPlain.nBarsExamined >= 21;
check("FIXED gate keeps plain partial-window TIME_UP open", shouldClosePlain === false,
  `exitReason=${rPlain.exitReason}`);

console.log(failures === 0 ? "\nALL GATE TESTS PASSED" : `\n${failures} GATE TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
