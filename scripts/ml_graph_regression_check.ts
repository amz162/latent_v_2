/**
 * Task 74 Phase 4 — Deterministic regression checks for the Trained-ML
 * Out-of-Sample actual-vs-predicted graph (ml-graph-points.ts).
 *
 * STANDALONE verification script (NOT jest/vitest — respects the environment
 * restriction on adding test files). Imports ONLY pure functions from
 * src/lib/latent/ml-graph-points.ts and feeds them SYNTHETIC fixtures (no live
 * database, no filesystem, no network). Every assertion is against a
 * hand-computed expected value.
 *
 * Run:  bun scripts/ml_graph_regression_check.ts
 *
 * What is NOT covered here (and is reported honestly at the end):
 *  - Browser rendering of the chart (covered by Phase 5 agent-browser).
 *  - The /api/backtest/model-graph/ml HTTP-layer validation (HTTP 400 for
 *    unsupported model/horizon/period) — covered by Phase 6 curl smoke tests.
 *  - UI stale-clearing + tooltip fields — covered by Phase 5 browser checks.
 *  - Rule-Based Preview endpoint independence — covered by Phase 5.
 *
 * These unit tests prove the PURE LOGIC that the API delegates to; the HTTP +
 * UI layers are verified separately and are NOT claimed to pass here.
 */
import {
  buildGraphPoints,
  classifyValidPoint,
  computeCalculatedActualPrice,
  computePredictedPrice,
  epochMsToDateStr,
  isValidPrice,
  isValidReturn,
  periodRangeFor,
  resolveTargetSession,
  SUPPORTED_HORIZONS,
  SUPPORTED_MODELS,
  SUPPORTED_PERIODS,
  VERIFY_TOLERANCE,
  type BarDateClose,
  type SampleRecord,
} from "../src/lib/latent/ml-graph-points";

let pass = 0,
  fail = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
  }
}
function approx(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** UTC epoch-ms for a YYYY-MM-DD. */
function utcMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d);
}
/** Parse a "YYYY-MM-DD" string → UTC epoch-ms (inverse of epochMsToDateStr). */
function dateStrToMs(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
/** N weekday date-strings starting startY/startM/startD (skips Sat/Sun). */
function weekdayDates(n: number, startY = 2024, startM = 1, startD = 2): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(startY, startM - 1, startD));
  while (out.length < n) {
    const day = d.getUTCDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6)
      out.push(dateStr(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
/** Build bars with a linear close = base * (1 + i*step). */
function barsLinear(dates: string[], base: number, step: number): BarDateClose[] {
  return dates.map((date, i) => ({ date, close: base * (1 + i * step) }));
}
/** A minimal evaluated sample for one model+horizon. */
function sample(
  idx: number,
  stock: string,
  dateMs: number,
  close: number,
  model: string,
  horizon: number,
  predicted: number,
  actual: number,
  opts: { evalSkipped?: boolean; status?: string } = {}
): SampleRecord {
  return {
    sample_idx: idx,
    stock,
    date: dateMs,
    close,
    status: opts.status ?? "evaluated",
    models: {
      [model]: {
        horizon_preds: {
          [String(horizon)]: {
            predicted,
            actual,
            eval_skipped: opts.evalSkipped ?? false,
          },
        },
      },
    },
  };
}

// ─── 1. Price calculations ────────────────────────────────────────────────────

console.log("\n── 1. Price calculations ──────────────────────────────────────");

{
  const dc = 100;
  const pr = 0.05;
  check("predicted price = close×(1+predReturn)", approx(computePredictedPrice(dc, pr), 105));
}
{
  const dc = 1067.02;
  const pr = 0.005944810342043638;
  check(
    "predicted price matches real LUCK fixture (1067.02 × 1.00594…)",
    approx(computePredictedPrice(dc, pr), 1073.3632315311675, 1e-6)
  );
}
{
  const dc = 100;
  const ar = 0.05;
  check(
    "calculated actual (validation) = close×(1+actualReturn)",
    approx(computeCalculatedActualPrice(dc, ar), 105)
  );
}
{
  // Main chart actual_price must equal the OBSERVED OHLCV close, not a
  // recomputation. Build a verified point and assert actual_price === bar close.
  const dates = weekdayDates(12);
  const bars = barsLinear(dates, 100, 0.0); // flat at 100 except we override target
  const decisionMs = utcMs(2024, 1, 2); // = dates[0]
  // actual return 0.05 → calculated actual = 105. Set the 5th-future bar close to 105.
  bars[5].close = 105;
  const s = sample(0, "LUCK", decisionMs, 100, "XGBoost", 5, 0.0, 0.05);
  const r = buildGraphPoints([s], "LUCK", "XGBoost", 5, bars);
  check("verified point exists (calc==observed)", r.n_verified === 1, `n_verified=${r.n_verified}`);
  if (r.points.length === 1) {
    const p = r.points[0];
    check(
      "actual_price uses OBSERVED OHLCV close (=== bar[5].close=105)",
      approx(p.actual_price, 105) && p.actual_price === r.points[0].verified_actual_close
    );
    check(
      "calculated_actual_price is the validation value (100×1.05=105)",
      approx(p.calculated_actual_price, 105)
    );
    check(
      "actual_price sourced from observed, not recomputed from actualReturn via a different path",
      p.actual_price === bars[5].close
    );
    check("predicted_price = 100×(1+0)=100", approx(p.predicted_price, 100));
    check("error = predicted − actual = 100−105 = −5", approx(p.error, -5));
  }
}
{
  // Invalid price inputs rejected.
  check("NaN price rejected", isValidPrice(NaN) === false);
  check("Infinity price rejected", isValidPrice(Infinity) === false);
  check("zero price rejected", isValidPrice(0) === false);
  check("negative price rejected", isValidPrice(-5) === false);
  check("valid positive price accepted", isValidPrice(0.01) === true);
  check("valid large price accepted", isValidPrice(1067.02) === true);
}
{
  // Invalid returns rejected (returns may be negative/zero but must be finite).
  check("NaN return rejected", isValidReturn(NaN) === false);
  check("Infinity return rejected", isValidReturn(Infinity) === false);
  check("-Infinity return rejected", isValidReturn(-Infinity) === false);
  check("zero return accepted", isValidReturn(0) === true);
  check("negative return accepted", isValidReturn(-0.07) === true);
  check("positive return accepted", isValidReturn(0.07) === true);
}
{
  // A sample with non-finite decisionClose → omitted (not valid, not verified).
  const dates = weekdayDates(12);
  const bars = barsLinear(dates, 100, 0.01);
  const s = sample(0, "LUCK", utcMs(2024, 1, 2), NaN, "XGBoost", 5, 0.01, 0.01);
  const r = buildGraphPoints([s], "LUCK", "XGBoost", 5, bars);
  check("non-finite decisionClose → omitted, not verified", r.n_omitted === 1 && r.n_verified === 0);
}
{
  // A sample with non-finite predictedReturn → omitted.
  const dates = weekdayDates(12);
  const bars = barsLinear(dates, 100, 0.01);
  const s = sample(0, "LUCK", utcMs(2024, 1, 2), 100, "XGBoost", 5, NaN, 0.01);
  const r = buildGraphPoints([s], "LUCK", "XGBoost", 5, bars);
  check("non-finite predictedReturn → omitted", r.n_omitted === 1 && r.n_valid_points === 0);
}

// ─── 2. Target-session alignment ─────────────────────────────────────────────

console.log("\n── 2. Target-session alignment ─────────────────────────────────");

{
  const dates = weekdayDates(30); // 30 weekday sessions from 2024-01-02
  const bars = barsLinear(dates, 100, 0.001);
  const decisionMs = utcMs(2024, 1, 2); // dates[0]
  const decisionDate = epochMsToDateStr(decisionMs);
  check("epochMsToDateStr matches first bar date", decisionDate === dates[0]);

  // 5-session target
  const t5 = resolveTargetSession(dates, new Map(bars.map((b) => [b.date, b.close])), decisionDate, 5);
  check("5-session target date = dates[5]", t5.targetDate === dates[5], `got ${t5.targetDate}, want ${dates[5]}`);
  check("5-session observed close = bars[5].close", t5.verifiedActualClose === bars[5].close);

  // 10-session target
  const t10 = resolveTargetSession(dates, new Map(bars.map((b) => [b.date, b.close])), decisionDate, 10);
  check("10-session target date = dates[10]", t10.targetDate === dates[10]);

  // 21-session target
  const t21 = resolveTargetSession(dates, new Map(bars.map((b) => [b.date, b.close])), decisionDate, 21);
  check("21-session target date = dates[21]", t21.targetDate === dates[21]);
}
{
  // Session indexing uses actual available trading bars, NOT calendar days.
  // weekdayDates skips Sat/Sun, so dates[0]=2024-01-02 (Tue), dates[1]=2024-01-03,
  // dates[2]=2024-01-04, dates[3]=2024-01-05 (Fri), dates[4]=2024-01-08 (Mon).
  const dates = weekdayDates(10);
  check("dates[3] is Friday 2024-01-05", dates[3] === "2024-01-05", `got ${dates[3]}`);
  check("dates[4] is Monday 2024-01-08 (weekend skipped)", dates[4] === "2024-01-08", `got ${dates[4]}`);
  const bars = barsLinear(dates, 100, 0.0);
  // horizon=1 from Friday 2024-01-05 → Monday 2024-01-08 (session+1), NOT Sat 01-06.
  const decisionMs = utcMs(2024, 1, 5);
  const decisionDate = epochMsToDateStr(decisionMs);
  const t = resolveTargetSession(dates, new Map(bars.map((b) => [b.date, b.close])), decisionDate, 1);
  check(
    "horizon=1 from Friday → Monday (session-indexed, not calendar-day)",
    t.targetDate === "2024-01-08",
    `got ${t.targetDate}`
  );
}
{
  // Missing decision bar → unavailable.
  const dates = weekdayDates(10);
  const bars = barsLinear(dates, 100, 0.0);
  const t = resolveTargetSession(dates, new Map(bars.map((b) => [b.date, b.close])), "2099-12-31", 5);
  check("missing decision bar → null target", t.targetDate === null && t.verifiedActualClose === null);
}
{
  // Missing target bar (decisionIdx + horizon out of range) → unavailable.
  const dates = weekdayDates(10);
  const bars = barsLinear(dates, 100, 0.0);
  // weekdayDates(10) from 2024-01-02 (Tue): idx8 = 2024-01-12 (Fri).
  // decision at dates[8], horizon=5 → index 13 ≥ length 10 → unavailable.
  const decisionMs = utcMs(2024, 1, 12); // = dates[8]
  const decisionDate = epochMsToDateStr(decisionMs);
  check("dates[8] is 2024-01-12 (Fri)", dates[8] === "2024-01-12", `got ${dates[8]}`);
  check("decisionMs maps to dates[8]", decisionDate === dates[8]);
  const t = resolveTargetSession(dates, new Map(bars.map((b) => [b.date, b.close])), decisionDate, 5);
  check("decisionIdx+horizon ≥ length → null target", t.targetDate === null);
}
{
  // Historical split membership follows manifest (periodRangeFor).
  const v = periodRangeFor("validation", 200, 400);
  const f = periodRangeFor("final-test", 200, 400);
  check("validation range = [0, 200)", v.startIdx === 0 && v.endIdx === 200);
  check("final-test range = [200, 400)", f.startIdx === 200 && f.endIdx === 400);
}

// ─── 3. Verification and counts ──────────────────────────────────────────────

console.log("\n── 3. Verification and counts ─────────────────────────────────");

{
  // Matching calculated + observed → verified.
  const target = { targetDate: "2024-01-09", verifiedActualClose: 105 };
  check(
    "matching calc (105) vs observed (105) → verified",
    classifyValidPoint(target, 105) === "verified"
  );
  // Within tolerance (tiny float diff) → still verified.
  check(
    "diff within tolerance (0.001) → verified",
    classifyValidPoint(target, 105.001) === "verified"
  );
}
{
  // Price mismatch → never verified (mismatch).
  const target = { targetDate: "2024-01-09", verifiedActualClose: 110 };
  check(
    "calc 105 vs observed 110 → mismatch (NOT verified)",
    classifyValidPoint(target, 105) === "mismatch"
  );
}
{
  // Unavailable target → never a valid chart point.
  const target = { targetDate: null as string | null, verifiedActualClose: null as number | null };
  check(
    "null target → unavailable_target (NOT verified)",
    classifyValidPoint(target, 105) === "unavailable_target"
  );
}
{
  // Missing target date is NEVER replaced with the decision date.
  const dates = weekdayDates(10);
  const bars = barsLinear(dates, 100, 0.0);
  // Decision at last bar (dates[9]), horizon=5 → no future bar → unavailable.
  const decisionMs = utcMs(2024, 1, 12); // dates[9] = 2024-01-12 (Fri)
  const s = sample(0, "LUCK", decisionMs, 100, "XGBoost", 5, 0.0, 0.05);
  const r = buildGraphPoints([s], "LUCK", "XGBoost", 5, bars);
  check("unavailable point → 0 verified, 1 unavailable", r.n_verified === 0 && r.n_unavailable_target === 1);
  if (r.diagnostics.length === 1) {
    check(
      "unavailable diagnostic target_date is NULL (no decision-date fallback)",
      r.diagnostics[0].target_date === null,
      `got ${r.diagnostics[0].target_date}`
    );
    check("unavailable diagnostic status = unavailable_target", r.diagnostics[0].status === "unavailable_target");
  }
}
{
  // Full reconciliation with a mixed fixture.
  const dates = weekdayDates(40);
  const bars = barsLinear(dates, 100, 0.0);
  // A — verified: decision dates[0], horizon 5 → target dates[5], set close=105 (calc 100×1.05=105).
  bars[5].close = 105;
  const A = sample(0, "LUCK", utcMs(2024, 1, 2), 100, "XGBoost", 5, 0.0, 0.05);
  // B — mismatch: decision dates[1], horizon 5 → target dates[6], close=110 (calc 100×1.05=105 ≠ 110).
  bars[6].close = 110;
  const B = sample(1, "LUCK", utcMs(2024, 1, 3), 100, "XGBoost", 5, 0.0, 0.05);
  // C — unavailable: decision at last bar dates[39], horizon 5 → no future bar.
  // Derive C's epoch-ms FROM the dates[39] string (don't hardcode a calendar date).
  const C = sample(2, "LUCK", dateStrToMs(dates[39]), 100, "XGBoost", 5, 0.0, 0.05);
  // D — omitted: status pending.
  const D = sample(3, "LUCK", utcMs(2024, 1, 4), 100, "XGBoost", 5, 0.0, 0.05, { status: "pending" });
  // E — omitted: eval_skipped.
  const E = sample(4, "LUCK", utcMs(2024, 1, 5), 100, "XGBoost", 5, 0.0, 0.05, { evalSkipped: true });
  // F — duplicate of A (same decision_date|model|horizon).
  const F = sample(5, "LUCK", utcMs(2024, 1, 2), 100, "XGBoost", 5, 0.0, 0.05);

  // Verify C's decision date maps to dates[39].
  check("C decision date === dates[39]", epochMsToDateStr(C.date) === dates[39], `got ${epochMsToDateStr(C.date)}, want ${dates[39]}`);

  const r = buildGraphPoints([A, B, C, D, E, F], "LUCK", "XGBoost", 5, bars);
  check("n_candidates = 6", r.n_candidates === 6, `got ${r.n_candidates}`);
  check("n_valid_points = 3 (A,B,C)", r.n_valid_points === 3, `got ${r.n_valid_points}`);
  check("n_verified = 1 (A)", r.n_verified === 1, `got ${r.n_verified}`);
  check("n_mismatch = 1 (B)", r.n_mismatch === 1, `got ${r.n_mismatch}`);
  check("n_unavailable_target = 1 (C)", r.n_unavailable_target === 1, `got ${r.n_unavailable_target}`);
  check("n_omitted = 2 (D,E)", r.n_omitted === 2, `got ${r.n_omitted}`);
  check("n_duplicates = 1 (F)", r.n_duplicates === 1, `got ${r.n_duplicates}`);
  // Reconciliation invariants.
  check(
    "RECONCILE: candidates == valid + omitted + duplicates (6 == 3+2+1)",
    r.n_candidates === r.n_valid_points + r.n_omitted + r.n_duplicates
  );
  check(
    "RECONCILE: valid == verified + mismatch + unavailable (3 == 1+1+1)",
    r.n_valid_points === r.n_verified + r.n_mismatch + r.n_unavailable_target
  );
  check("points array contains VERIFIED ONLY (len 1)", r.points.length === 1);
  check("diagnostics contains mismatch+unavailable (len 2)", r.diagnostics.length === 2);
  check("verified point is A (target dates[5])", r.points[0].target_date === dates[5]);
  check("mismatch (B) is in diagnostics, NOT in points", r.diagnostics.some((d) => d.status === "mismatch" && d.target_date === dates[6]));
  check("unavailable (C) is in diagnostics, NOT in points", r.diagnostics.some((d) => d.status === "unavailable_target" && d.target_date === null));
}
{
  // Duplicate sample/model/horizon records do not create duplicate observations.
  const dates = weekdayDates(20);
  const bars = barsLinear(dates, 100, 0.0);
  bars[5].close = 105;
  const A = sample(0, "LUCK", utcMs(2024, 1, 2), 100, "XGBoost", 5, 0.0, 0.05);
  const A2 = sample(1, "LUCK", utcMs(2024, 1, 2), 100, "XGBoost", 5, 0.0, 0.05);
  const A3 = sample(2, "LUCK", utcMs(2024, 1, 2), 100, "XGBoost", 5, 0.0, 0.05);
  const r = buildGraphPoints([A, A2, A3], "LUCK", "XGBoost", 5, bars);
  check("3 identical samples → 1 verified, 2 duplicates", r.n_verified === 1 && r.n_duplicates === 2, `v=${r.n_verified} d=${r.n_duplicates}`);
  check("points has exactly 1 entry (no dup observations)", r.points.length === 1);
}
{
  // Missing / corrupt artifacts fail safely.
  const dates = weekdayDates(20);
  const bars = barsLinear(dates, 100, 0.01);
  const recs: SampleRecord[] = [
    // @ts-expect-error — simulating a corrupt record with missing stock field.
    { sample_idx: 0, date: utcMs(2024, 1, 2), close: 100, status: "evaluated" },
    // missing models entirely
    { sample_idx: 1, stock: "LUCK", date: utcMs(2024, 1, 2), close: 100, status: "evaluated" } as SampleRecord,
    // null record (corrupt file parsed to null → API guards, but builder is defensive)
    null as unknown as SampleRecord,
    // wrong symbol
    sample(3, "SYS", utcMs(2024, 1, 2), 100, "XGBoost", 5, 0.0, 0.05),
  ];
  const r = buildGraphPoints(recs, "LUCK", "XGBoost", 5, bars);
  // null + missing-stock are skipped before candidate count; only the wrong-symbol
  // and missing-models (stock LUCK) count as candidates.
  check("corrupt/missing records fail safely (no crash, 0 verified)", r.n_verified === 0);
  check("missing-models LUCK sample counted as candidate then omitted", r.n_candidates >= 1 && r.n_omitted >= 1);
}

// ─── 4. API / UI behavior (pure-logic subset) ────────────────────────────────

console.log("\n── 4. API/UI behavior (pure-logic subset) ─────────────────────");

{
  // Unsupported horizon / model / period are not in the supported sets.
  check("horizon 7 not supported", !SUPPORTED_HORIZONS.includes(7 as never));
  check("horizon 5 supported", SUPPORTED_HORIZONS.includes(5 as never));
  check("horizon 10 supported", SUPPORTED_HORIZONS.includes(10 as never));
  check("horizon 21 supported", SUPPORTED_HORIZONS.includes(21 as never));
  check("model 'Bogus' not supported", !SUPPORTED_MODELS.includes("Bogus" as never));
  check("model 'XGBoost' supported", SUPPORTED_MODELS.includes("XGBoost" as never));
  check("model 'Ridge Regression' supported", SUPPORTED_MODELS.includes("Ridge Regression" as never));
  check("period 'bogus' not supported", !SUPPORTED_PERIODS.includes("bogus" as never));
  check("period 'final-test' supported", SUPPORTED_PERIODS.includes("final-test" as never));
  check("period 'validation' supported", SUPPORTED_PERIODS.includes("validation" as never));
}
{
  // Each filter returns the correct sample set — changing the model selects a
  // different prediction for the same decision point.
  const dates = weekdayDates(12);
  const bars = barsLinear(dates, 100, 0.0);
  bars[5].close = 105; // makes actualReturn-from-dates[0] = 0.05
  // One sample with TWO models giving different predicted returns.
  const s: SampleRecord = {
    sample_idx: 0,
    stock: "LUCK",
    date: utcMs(2024, 1, 2),
    close: 100,
    status: "evaluated",
    models: {
      XGBoost: { horizon_preds: { "5": { predicted: 0.0, actual: 0.05 } } },
      LightGBM: { horizon_preds: { "5": { predicted: 0.1, actual: 0.05 } } },
    },
  };
  const rX = buildGraphPoints([s], "LUCK", "XGBoost", 5, bars);
  const rL = buildGraphPoints([s], "LUCK", "LightGBM", 5, bars);
  check("XGBoost predicted_price = 100×1.0 = 100", approx(rX.points[0].predicted_price, 100));
  check("LightGBM predicted_price = 100×1.1 = 110", approx(rL.points[0].predicted_price, 110));
  check("both verified, same actual (observed 105)", approx(rX.points[0].actual_price, 105) && approx(rL.points[0].actual_price, 105));
  check("model selection changes predicted series", rX.points[0].predicted_price !== rL.points[0].predicted_price);
}
{
  // Horizon selection changes the target date.
  const dates = weekdayDates(40);
  const bars = barsLinear(dates, 100, 0.0);
  // For horizon 5/10/21 from dates[0], set target closes to match calc=100×1.05=105.
  bars[5].close = 105;
  bars[10].close = 105;
  bars[21].close = 105;
  const s: SampleRecord = {
    sample_idx: 0,
    stock: "LUCK",
    date: utcMs(2024, 1, 2),
    close: 100,
    status: "evaluated",
    models: {
      XGBoost: {
        horizon_preds: {
          "5": { predicted: 0.0, actual: 0.05 },
          "10": { predicted: 0.0, actual: 0.05 },
          "21": { predicted: 0.0, actual: 0.05 },
        },
      },
    },
  };
  const r5 = buildGraphPoints([s], "LUCK", "XGBoost", 5, bars);
  const r10 = buildGraphPoints([s], "LUCK", "XGBoost", 10, bars);
  const r21 = buildGraphPoints([s], "LUCK", "XGBoost", 21, bars);
  check("horizon 5 → target dates[5]", r5.points[0].target_date === dates[5]);
  check("horizon 10 → target dates[10]", r10.points[0].target_date === dates[10]);
  check("horizon 21 → target dates[21]", r21.points[0].target_date === dates[21]);
  check("horizon selection changes target date", r5.points[0].target_date !== r10.points[0].target_date);
}
{
  // Verified points are aligned by target date ascending (chart X-axis).
  const dates = weekdayDates(40);
  const bars = barsLinear(dates, 100, 0.0);
  // 3 verified points at dates[0],[10],[20] (horizon 5 → targets [5],[15],[25]).
  [5, 15, 25].forEach((i) => (bars[i].close = 105));
  const recs = [0, 10, 20].map((di, k) =>
    sample(k, "LUCK", utcMs(2024, 1, 2 + di), 100, "XGBoost", 5, 0.0, 0.05)
  );
  // Map decision-day-offset → epoch ms. di is the day offset from 2024-01-02.
  // (weekdayDates are weekdays; 2024-01-02 + di days may hit weekends, so use the
  //  actual dates array for correctness.)
  const fixed = recs.map((r, k) => {
    const dt = dates[[0, 10, 20][k]];
    const [y, m, d] = dt.split("-").map(Number);
    return { ...r, date: utcMs(y, m, d) } as SampleRecord;
  });
  const r = buildGraphPoints(fixed, "LUCK", "XGBoost", 5, bars);
  check("3 verified points returned", r.n_verified === 3);
  const tds = r.points.map((p) => p.target_date);
  check(
    "verified points sorted by target_date ascending",
    tds[0] <= tds[1] && tds[1] <= tds[2],
    `got ${JSON.stringify(tds)}`
  );
  check("actual = observed close (105) for all 3", r.points.every((p) => approx(p.actual_price, 105)));
}
{
  // Tolerance is documented and a sensible small constant.
  check("VERIFY_TOLERANCE is 0.01 PKR", VERIFY_TOLERANCE === 0.01);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  ml_graph_regression_check: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`  FAILURES:`);
  failures.forEach((f) => console.log(`    ✗ ${f}`));
  process.exit(1);
} else {
  console.log(`  All deterministic unit checks passed.`);
}
console.log(`\n  TESTS NOT RUN IN THIS SCRIPT (reported honestly):`);
console.log(`    • Browser rendering of the chart / tooltip / legend — Phase 5 (agent-browser).`);
console.log(`    • /api/backtest/model-graph/ml HTTP 400 for unsupported model/horizon/period — Phase 6 (curl smoke).`);
console.log(`    • UI stale-clearing on filter change — Phase 5 (browser DOM check).`);
console.log(`    • UI no-verified-points / no-candidates truthful state — Phase 5 (browser, BYCO).`);
console.log(`    • Rule-Based Preview calls its own endpoint independently — Phase 5 (browser).`);
console.log(`    • Genuine ML mode calls /api/backtest/model-graph/ml (network) — Phase 5 (browser).`);
console.log(`═══════════════════════════════════════════════════════════════`);
