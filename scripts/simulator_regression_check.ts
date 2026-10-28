/**
 * Task 57 Phase 6 — Deterministic regression checks for the investment
 * simulator's progressive TP tracking.
 *
 * This is a STANDALONE verification script (NOT a jest/vitest test file — it
 * respects the environment restriction on adding test files). It imports
 * simulateFromIdx directly and constructs synthetic OHLCV bars to verify:
 *   1. TP1 → TP2 → SL: preserve TP2 as bestTargetReached, exit SL_AFTER_TP2
 *   2. TP1 → SL: preserve TP1, exit SL_AFTER_TP1
 *   3. TP1 → TP2 → TP3: preserve TP3, exit TP3_HIT
 *   4. SL + TP2 same bar: SL priority, do NOT award TP2, exit SL_HIT
 *   5. TP2 milestone then SL: preserve TP2, exit SL_AFTER_TP2
 *   6. Multiple TPs in one bar (TP3 touched): award TP3, exit TP3_HIT
 *   7. SELL/short equivalents (directionally correct)
 *   8. No TP/SL reached: unresolved TIME_UP, not discarded
 *   9. Gap beyond SL: realistic stop-fill at gap-open price
 *  10. Realized gross P&L uses ACTUAL exit price (not best-target price)
 *  11. Target attainment ≠ winning-trade count (TP2 reached + SL exit = loss)
 *  12. Unresolved trades are NOT discarded (simulateFromIdx returns non-null)
 *
 * Run: bun scripts/simulator_regression_check.ts
 */
import { simulateFromIdx, type SimSignal, type Bar } from "../src/lib/latent/investment-simulator";

let pass = 0, fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

// Helper: build a bar with a given date + OHLC.
function bar(date: string, open: number, high: number, low: number, close: number): Bar {
  return { date, open, high, low, close };
}

// Helper: a signal with explicit sl/tp1/tp2/tp3 (so ATR defaults aren't used).
function sig(symbol: string, signal: "BUY" | "SELL", entry: number, sl: number, tp1: number, tp2: number, tp3: number): SimSignal {
  return { symbol, signal, confidence: 100, entry, sl, tp1, tp2, tp3 };
}

// Helper: pad with neutral pre-entry bars so bars.length >= 5 (simulateFromIdx
// guard). Pre-entry bars sit flat at the entry price so they don't affect ATR
// or trigger anything. Returns { bars, entryIdx } where entryIdx is the index
// of the real entry bar.
function makeBars(postEntry: Bar[], entryPrice: number): { bars: Bar[]; entryIdx: number } {
  const pre: Bar[] = [];
  for (let i = 4; i >= 1; i--) {
    pre.push(bar(`2023-12-2${i}`, entryPrice, entryPrice, entryPrice, entryPrice));
  }
  return { bars: [...pre, ...postEntry], entryIdx: pre.length };
}

// Deterministic window end (far future so all bars are in-window).
const WINDOW_END = Date.parse("2030-01-01");

// ─── Test 1: TP1 → TP2 → SL (BUY) — preserve TP2 ────────────────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 104, 100, 103), // high=104 → TP1 (103) touched; < TP2 (106)
    bar("2024-01-03", 103, 107, 103, 106),  // high=107 → TP2 (106) touched; < TP3 (110)
    bar("2024-01-04", 106, 106, 94, 95),   // low=94 → SL (95) touched
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T1", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T1 simulateFromIdx returns non-null", r !== null);
  if (r) {
    check("T1 bestTargetReached = TP2", r.bestTargetReached === "TP2", `got ${r.bestTargetReached}`);
    check("T1 exitReason = SL_AFTER_TP2", r.exitReason === "SL_AFTER_TP2", `got ${r.exitReason}`);
    check("T1 hit = SL", r.hit === "SL", `got ${r.hit}`);
    check("T1 exitPrice = 95 (sl, no gap)", r.exitPrice === 95, `got ${r.exitPrice}`);
    check("T1 unresolved = false", r.unresolved === false);
    check("T1 tp2HitIdx = 6 (bar 7, 0-indexed incl. 4 padding bars)", r.tp2HitIdx === 6, `got ${r.tp2HitIdx}`);
    check("T1 nBarsExamined = 3", r.nBarsExamined === 3, `got ${r.nBarsExamined}`);
    // Realized gross P&L uses exit price (95), NOT TP2 (106).
    const grossPct = ((r.exitPrice - r.entryPrice) / r.entryPrice) * 100;
    check("T1 grossPnl% = -5% (exit at SL, NOT TP2's +6%)", Math.abs(grossPct - (-5)) < 1e-9, `got ${grossPct}%`);
  }
}

// ─── Test 2: TP1 → SL (BUY) — preserve TP1 ──────────────────────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 104, 100, 103), // TP1 (103)
    bar("2024-01-03", 103, 103, 94, 95),   // SL (95)
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T2", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T2 bestTargetReached = TP1", r?.bestTargetReached === "TP1", `got ${r?.bestTargetReached}`);
  check("T2 exitReason = SL_AFTER_TP1", r?.exitReason === "SL_AFTER_TP1", `got ${r?.exitReason}`);
  check("T2 exitPrice = 95", r?.exitPrice === 95, `got ${r?.exitPrice}`);
}

// ─── Test 3: TP1 → TP2 → TP3 (BUY) — preserve TP3, exit TP3_HIT ─────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 104, 100, 103), // TP1
    bar("2024-01-03", 103, 107, 103, 106), // TP2
    bar("2024-01-04", 106, 111, 106, 110), // TP3 (110) → close
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T3", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T3 bestTargetReached = TP3", r?.bestTargetReached === "TP3", `got ${r?.bestTargetReached}`);
  check("T3 exitReason = TP3_HIT", r?.exitReason === "TP3_HIT", `got ${r?.exitReason}`);
  check("T3 hit = TP3", r?.hit === "TP3", `got ${r?.hit}`);
  check("T3 exitPrice = 110 (tp3)", r?.exitPrice === 110, `got ${r?.exitPrice}`);
  check("T3 unresolved = false", r?.unresolved === false);
}

// ─── Test 4: SL + TP2 same bar (BUY) — SL priority, do NOT award TP2 ─────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    // high=107 (>= tp2=106) AND low=94 (<= sl=95) → SL touched → SL priority
    bar("2024-01-02", 100, 107, 94, 95),
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T4", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T4 bestTargetReached = — (SL priority, no TP awarded)", r?.bestTargetReached === "—", `got ${r?.bestTargetReached}`);
  check("T4 exitReason = SL_HIT (not SL_AFTER_TP2)", r?.exitReason === "SL_HIT", `got ${r?.exitReason}`);
  check("T4 exitPrice = 95 (sl)", r?.exitPrice === 95, `got ${r?.exitPrice}`);
}

// ─── Test 5: TP2 reached then SL later (BUY) — preserve TP2 ──────────────────
// (Same as Test 1 but without TP1 first — TP2 directly)
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 107, 100, 106), // TP2 (106) — note: also >= TP1 but TP2 is higher
    bar("2024-01-03", 106, 106, 94, 95),   // SL
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T5", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T5 bestTargetReached = TP2", r?.bestTargetReached === "TP2", `got ${r?.bestTargetReached}`);
  check("T5 exitReason = SL_AFTER_TP2", r?.exitReason === "SL_AFTER_TP2", `got ${r?.exitReason}`);
}

// ─── Test 6: Multiple TPs in one bar (TP3 touched) — award TP3 ──────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    // high=111 → touches TP1 (103), TP2 (106), AND TP3 (110) in one bar
    bar("2024-01-02", 100, 111, 100, 110),
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T6", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T6 bestTargetReached = TP3 (highest in one bar)", r?.bestTargetReached === "TP3", `got ${r?.bestTargetReached}`);
  check("T6 exitReason = TP3_HIT", r?.exitReason === "TP3_HIT", `got ${r?.exitReason}`);
  check("T6 exitPrice = 110", r?.exitPrice === 110, `got ${r?.exitPrice}`);
}

// ─── Test 7: SELL/short equivalents (directionally correct) ──────────────────
{
  // SELL at entry=100. sl=105 (above), tp1=97, tp2=94, tp3=90 (below).
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 100, 96, 97),   // low=96 → TP1 (97) touched
    bar("2024-01-03", 97, 97, 93, 94),     // low=93 → TP2 (94) touched
    bar("2024-01-04", 94, 106, 94, 105),   // high=106 → SL (105) touched
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T7", "SELL", 100, 105, 97, 94, 90), bars, entryIdx, WINDOW_END);
  check("T7 SELL bestTargetReached = TP2", r?.bestTargetReached === "TP2", `got ${r?.bestTargetReached}`);
  check("T7 SELL exitReason = SL_AFTER_TP2", r?.exitReason === "SL_AFTER_TP2", `got ${r?.exitReason}`);
  check("T7 SELL exitPrice = 105 (sl)", r?.exitPrice === 105, `got ${r?.exitPrice}`);
  // SELL gross P&L: (entry - exit)/entry * 100 = (100-105)/100 = -5%
  const grossPct = r ? ((r.entryPrice - r.exitPrice) / r.entryPrice) * 100 : 0;
  check("T7 SELL grossPnl% = -5% (exit at SL)", Math.abs(grossPct - (-5)) < 1e-9, `got ${grossPct}%`);
}

// ─── Test 7b: SELL TP1→TP2→TP3 (directionally correct) ──────────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 100, 96, 97),   // TP1
    bar("2024-01-03", 97, 97, 93, 94),     // TP2
    bar("2024-01-04", 94, 94, 89, 90),     // TP3 (90) → close
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T7b", "SELL", 100, 105, 97, 94, 90), bars, entryIdx, WINDOW_END);
  check("T7b SELL bestTargetReached = TP3", r?.bestTargetReached === "TP3", `got ${r?.bestTargetReached}`);
  check("T7b SELL exitReason = TP3_HIT", r?.exitReason === "TP3_HIT", `got ${r?.exitReason}`);
  check("T7b SELL exitPrice = 90 (tp3)", r?.exitPrice === 90, `got ${r?.exitPrice}`);
}

// ─── Test 8: No TP/SL reached — unresolved TIME_UP ──────────────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 101, 99, 100),  // no touch (tp1=103, sl=95)
    bar("2024-01-03", 100, 101, 99, 100),
    bar("2024-01-04", 100, 101, 99, 100),  // last bar — close=100
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T8", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T8 simulateFromIdx returns non-null (NOT discarded)", r !== null, "was null — unresolved discarded!");
  check("T8 exitReason = TIME_UP", r?.exitReason === "TIME_UP", `got ${r?.exitReason}`);
  check("T8 hit = —", r?.hit === "—", `got ${r?.hit}`);
  check("T8 unresolved = true", r?.unresolved === true);
  check("T8 bestTargetReached = —", r?.bestTargetReached === "—", `got ${r?.bestTargetReached}`);
  check("T8 exitPrice = last close (100)", r?.exitPrice === 100, `got ${r?.exitPrice}`);
}

// ─── Test 8b: No TP/SL but TP1 was touched before time-up ───────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    bar("2024-01-02", 100, 104, 100, 103), // TP1 (103) touched
    bar("2024-01-03", 103, 104, 100, 102), // no further touch
    bar("2024-01-04", 102, 104, 100, 101), // time-up, close=101
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T8b", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T8b exitReason = TIME_UP", r?.exitReason === "TIME_UP", `got ${r?.exitReason}`);
  check("T8b unresolved = true", r?.unresolved === true);
  check("T8b bestTargetReached = TP1 (preserved even though time-up)", r?.bestTargetReached === "TP1", `got ${r?.bestTargetReached}`);
  check("T8b exitPrice = last close (101)", r?.exitPrice === 101, `got ${r?.exitPrice}`);
}

// ─── Test 9: Gap beyond SL — realistic stop-fill at gap-open ────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    // Gap-down: open=92 (below sl=95), low=91. SL touched → fill at OPEN (92), not sl (95).
    bar("2024-01-02", 92, 93, 91, 92),
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T9", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T9 exitReason = SL_HIT", r?.exitReason === "SL_HIT", `got ${r?.exitReason}`);
  check("T9 exitPrice = 92 (gap-open fill, NOT sl=95)", r?.exitPrice === 92, `got ${r?.exitPrice}`);
  const grossPct = r ? ((r.exitPrice - r.entryPrice) / r.entryPrice) * 100 : 0;
  check("T9 grossPnl% = -8% (gap-fill at 92)", Math.abs(grossPct - (-8)) < 1e-9, `got ${grossPct}%`);
}

// ─── Test 9b: SELL gap-up beyond SL ─────────────────────────────────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100), // entry
    // Gap-up: open=108 (above sl=105), high=109. SL touched → fill at OPEN (108).
    bar("2024-01-02", 108, 109, 107, 108),
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T9b", "SELL", 100, 105, 97, 94, 90), bars, entryIdx, WINDOW_END);
  check("T9b SELL exitPrice = 108 (gap-open fill, NOT sl=105)", r?.exitPrice === 108, `got ${r?.exitPrice}`);
}

// ─── Test 10: Realized P&L uses ACTUAL exit, not best-target ─────────────────
// (Covered by T1: bestTarget=TP2 (+6%) but exit at SL (-5%). grossPnl = -5%.)
{
  // Re-verify explicitly: a trade that reached TP2 but exited at SL.
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100),
    bar("2024-01-02", 100, 107, 100, 106), // TP2
    bar("2024-01-03", 106, 106, 94, 95),   // SL
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T10", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  if (r) {
    const grossPct = ((r.exitPrice - r.entryPrice) / r.entryPrice) * 100;
    check("T10 grossPnl% = -5% (actual SL exit, NOT TP2's +6%)", Math.abs(grossPct - (-5)) < 1e-9, `got ${grossPct}%`);
    check("T10 bestTargetReached = TP2 (attainment separate from ROI)", r.bestTargetReached === "TP2");
    // isWin would be netPnl > 0; netPnl = grossPnl - costs; grossPnl is negative → isWin = false.
    // This proves target attainment (TP2) ≠ winning trade.
    check("T10 implied isWin = false (netPnl < 0 → loss, NOT a win despite TP2)", grossPct < 0, `grossPct=${grossPct}% should be negative`);
  }
}

// ─── Test 11: Active stop is FIXED (no trailing stop invented) ───────────────
{
  const _postBars: Bar[] = [
    bar("2024-01-01", 100, 100, 100, 100),
    bar("2024-01-02", 100, 107, 100, 106), // TP2
    bar("2024-01-03", 106, 106, 100, 105), // no SL touch (low=100 > sl=95)
    bar("2024-01-04", 105, 105, 94, 95),   // SL touched at 95 (the ORIGINAL sl, not a moved stop)
  ];
  const { bars, entryIdx } = makeBars(_postBars, 100);
  const r = simulateFromIdx(sig("T11", "BUY", 100, 95, 103, 106, 110), bars, entryIdx, WINDOW_END);
  check("T11 activeStop = sl (95, fixed — no trailing stop)", r?.activeStop === 95, `got ${r?.activeStop}`);
  check("T11 exitPrice = 95 (original sl, not moved)", r?.exitPrice === 95, `got ${r?.exitPrice}`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`Task 57 regression checks: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:");
  failures.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("All regression checks PASSED.");
