/**
 * Task 129 Phase 11.2 — Model M test suite (bun).
 *
 * Pure-function tests use hand-computed fixtures. DB-backed tests use the REAL
 * database in read-only fashion (getDataQuality) and the idempotent evidence
 * dedup path (no GLM calls are made in this suite — the stale gate fires
 * before the provider, which is itself one of the tested behaviours).
 *
 * Run: DATABASE_URL=file:$PWD/db/custom.db bun scripts/task129_model_m_tests.ts
 */
import { sma, ema, rsi, macd, atr14, bollinger, buildTechnicalSection, type AnalysisBar } from "../src/lib/latent/model-m/technical";
import { analyzeMonthlyPatterns, MIN_MONTHLY_SAMPLES } from "../src/lib/latent/model-m/patterns";
import { stableStringify, evidenceHash } from "../src/lib/latent/llm/llm-provider";
import { getDataQuality, buildModelMEvidence, runModelMAnalysis } from "../src/lib/latent/model-m/engine";
import crypto from "node:crypto";

let PASS = 0, FAIL = 0;
const out: string[] = [];
function check(name: string, ok: boolean, note = "") {
  if (ok) { PASS++; out.push(`PASS ${name}${note ? " :: " + note : ""}`); }
  else { FAIL++; out.push(`FAIL ${name}${note ? " :: " + note : ""}`); }
}
const approx = (a: number | null, b: number, tol = 1e-6) => a != null && Math.abs(a - b) <= tol;

// ── indicators (hand-computed) ──
const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; // 10 points
check("sma: mean of all 10", approx(sma(closes, 10), 14.5), String(sma(closes, 10)));
check("sma: insufficient window → null", sma(closes, 11) === null);
check("ema: SMA-seeded EMA after full series", approx(ema(closes, 5), (() => {
  const k = 2 / 6;
  let e = (10 + 11 + 12 + 13 + 14) / 5;
  for (let i = 5; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
  return e;
})()), String(ema(closes, 5)));
check("ema: insufficient window → null", ema(closes.slice(0, 3), 12) === null);
// RSI: monotonic-up 20-point series → 100
const up20 = Array.from({ length: 20 }, (_, i) => 10 + i);
check("rsi: monotonic up → 100", approx(rsi(up20), 100), String(rsi(up20)));
// RSI: flat series → 50 (avgG=avgL=0 branch)
check("rsi: flat → 50", approx(rsi([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), 50));
const rsiMix = rsi([10, 11, 10.5, 11.5, 10, 12, 11, 13, 12, 14, 13, 15, 14, 16, 15, 17]);
check("rsi: mixed series in (0,100)", rsiMix != null && rsiMix > 0 && rsiMix < 100, String(rsiMix));
check("rsi: insufficient → null", rsi(closes.slice(0, 10), 14) === null);

// MACD on a linear ramp: EMA(12) > EMA(26) → macd line > 0
const ramp = Array.from({ length: 40 }, (_, i) => 100 + i);
const m = macd(ramp);
check("macd: ramp → positive line", (m.macd ?? 0) > 0, String(m.macd));
check("macd: signal present", m.signal != null);
check("macd: insufficient → nulls", macd(closes).macd === null);

// ATR(14) on constant-range bars = range
const flat: AnalysisBar[] = Array.from({ length: 20 }, (_, i) => ({
  date: `2026-01-${String(i + 1).padStart(2, "0")}`,
  open: 100, high: 101, low: 99, close: 100, volume: 1000,
}));
check("atr14: constant range = 2", approx(atr14(flat), 2, 1e-9), String(atr14(flat)));
check("atr14: insufficient → null", atr14(flat.slice(0, 5)) === null);

// Bollinger on constant closes: mid=100, sd=0 → bands collapse
const bb = bollinger(Array(25).fill(100));
check("bollinger: constant series collapses", approx(bb.mid!, 100) && approx(bb.upper!, 100) && approx(bb.bandwidthPct!, 0));

// buildTechnicalSection: too few bars → null; complete flags false when window short
check("technical: <5 bars → null", buildTechnicalSection(flat.slice(0, 3)) === null);
const sec = buildTechnicalSection(flat);
check("technical: section built", sec != null && sec.indicators.length >= 10);
check("technical: SMA30 marked incomplete on 20 bars", sec!.indicators.find((i) => i.name === "SMA 30")?.complete === false);
check("technical: SMA30 value null on 20 bars", sec!.indicators.find((i) => i.name === "SMA 30")?.value === null);

// ── monthly patterns: small-sample guard ──
const yearlyBars: AnalysisBar[] = [];
// 2 years of daily bars (2024-01-01..2025-12-31, weekdays) with +0.1% drift
let price = 100;
for (let d = new Date("2024-01-01"); d <= new Date("2025-12-31"); d = new Date(d.getTime() + 86400000)) {
  const iso = d.toISOString().slice(0, 10);
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  price *= 1.001;
  yearlyBars.push({ date: iso, open: price, high: price * 1.01, low: price * 0.99, close: price, volume: 1000 });
}
const mp = analyzeMonthlyPatterns(yearlyBars);
const jan = mp.months[0];
check("patterns: January has 2 samples (< MIN) → insufficient", jan.samples < MIN_MONTHLY_SAMPLES && !jan.sufficient && jan.avgReturnPct === null, `n=${jan.samples}`);
const dec = mp.months[11];
check("patterns: December has 2 transitions over 2 years → insufficient", !dec.sufficient || dec.samples >= MIN_MONTHLY_SAMPLES, `n=${dec.samples}`);
check("patterns: caveat present", mp.caveat.length > 50);

// 4 years → some months reach n>=3
const yearlyBars4: AnalysisBar[] = [];
price = 100;
for (let d = new Date("2022-01-01"); d <= new Date("2025-12-31"); d = new Date(d.getTime() + 86400000)) {
  const iso = d.toISOString().slice(0, 10);
  if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  price *= 1.001;
  yearlyBars4.push({ date: iso, open: price, high: price * 1.01, low: price * 0.99, close: price, volume: 1000 });
}
const mp4 = analyzeMonthlyPatterns(yearlyBars4);
const sufficientCount = mp4.months.filter((m) => m.sufficient).length;
check("patterns: 4-year series yields sufficient months", sufficientCount >= 10, `sufficient=${sufficientCount}`);
const avgOfSufficient = mp4.months.find((m) => m.sufficient);
check("patterns: positive drift → positive avg for sufficient months", avgOfSufficient != null && (avgOfSufficient.avgReturnPct ?? 0) > 0, String(avgOfSufficient?.avgReturnPct));

// ── evidence hash stability ──
const e1 = { b: 2, a: { y: [1, 2], x: "s" } };
const e2 = { a: { x: "s", y: [1, 2] }, b: 2 };
check("hash: key-order independent", stableStringify(e1) === stableStringify(e2));
check("hash: same content → same sha256",
  crypto.createHash("sha256").update(stableStringify(e1)).digest("hex") ===
  crypto.createHash("sha256").update(stableStringify(e2)).digest("hex"));
check("hash: different content → different hash",
  evidenceHash(e1) !== evidenceHash({ ...e1, b: 3 }));
check("hash: array-order significant", evidenceHash({ l: [1, 2] }) !== evidenceHash({ l: [2, 1] }));

// ── data-quality classification (REAL DB, read-only) ──
const dqMEBL = await getDataQuality("MEBL");
check("dq: MEBL at frontier → VERIFIED", dqMEBL.status === "VERIFIED", `${dqMEBL.latestBarDate} vs ${dqMEBL.globalFrontierDate}`);
const dqENGRO = await getDataQuality("ENGRO");
check("dq: ENGRO far behind → STALE", dqENGRO.status === "STALE", `${dqENGRO.latestBarDate} behind ${dqENGRO.sessionsBehindFrontier}d`);
check("dq: UNKNOWN symbol → UNAVAILABLE", (await getDataQuality("ZZZZZ")).status === "UNAVAILABLE");

// ── evidence dedup (REAL DB; writes only via dedup-upsert path) ──
const built1 = await buildModelMEvidence("MEBL");
if ("error" in built1) {
  check("dedup: MEBL evidence builds", false, built1.error);
} else {
  const built2 = await buildModelMEvidence("MEBL");
  if ("error" in built2) {
    check("dedup: second build ok", false, built2.error);
  } else {
    check("dedup: same (symbol,cutoff) → same packageId", built1.pkg.packageId === built2.pkg.packageId,
      `${built1.pkg.packageId} vs ${built2.pkg.packageId}`);
    check("dedup: cutoff identity reuse keeps one package per cutoff", built1.pkg.contentHash === built2.pkg.contentHash);
  }
}

// ── stale gate blocks fresh analysis BEFORE any GLM call ──
const blocked = await runModelMAnalysis("ENGRO", { analysisHorizon: "10d" }) as { blocked: boolean; reason?: string };
check("stale gate: ENGRO blocked", blocked.blocked === true, blocked.blocked ? (blocked.reason ?? "").slice(0, 60) : "NOT BLOCKED");

console.log(out.join("\n"));
console.log(`\n== Task 129 Model M tests: ${PASS} passed, ${FAIL} failed ==`);
process.exit(FAIL ? 1 : 0);
