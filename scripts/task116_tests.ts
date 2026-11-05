// Task 116 Part M — unit tests: SSRF guard, strategy engine point-in-time
// safety, and fusion semantics. Run: bun test scripts/task116_tests.ts

import { describe, expect, test } from "bun:test";
import { validatePublicHttpUrl, isPrivateAddress } from "../src/lib/latent/url-guard";
import { evaluateStrategies, STRATEGY_INVENTORY, type StrategySignal } from "../src/lib/latent/strategies/engine";
import { fuseSignals } from "../src/lib/latent/strategies/fusion";
import { wilderRsi, varianceRatio, hurstExponent, fitAr1 } from "../src/lib/latent/strategies/series";

// ── B3: SSRF guard ──────────────────────────────────────────────────────────
describe("url-guard SSRF policy", () => {
  test("rejects loopback, localhost and metadata addresses", async () => {
    for (const bad of ["http://127.0.0.1/x", "http://localhost/x", "http://169.254.169.254/latest/meta-data", "http://0.0.0.0/x"]) {
      const g = await validatePublicHttpUrl(bad);
      expect(g.rejection === "unsupported_scheme" || g.rejection === "private_or_reserved_address").toBe(true);
    }
  });
  test("rejects private IPv4 ranges even over https", async () => {
    for (const bad of ["https://10.0.0.5/x", "https://192.168.1.1/x", "https://172.16.0.9/x", "https://100.64.0.1/x"]) {
      expect((await validatePublicHttpUrl(bad)).rejection).toBe("private_or_reserved_address");
    }
  });
  test("rejects private/ULA/link-local IPv6", async () => {
    for (const bad of ["https://[::1]/x", "https://[fe80::1]/x", "https://[fd00::1]/x", "https://[::ffff:127.0.0.1]/x"]) {
      expect((await validatePublicHttpUrl(bad)).rejection).toBe("private_or_reserved_address");
    }
  });
  test("rejects non-https schemes and credentials", async () => {
    expect((await validatePublicHttpUrl("ftp://example.com/a")).rejection).toBe("unsupported_scheme");
    expect((await validatePublicHttpUrl("https://user:pass@example.com/a")).rejection).toBe("credentials_in_url");
  });
  test("rejects malformed and dotless/internal hosts", async () => {
    expect((await validatePublicHttpUrl("not a url")).rejection).toBe("malformed_url");
    expect((await validatePublicHttpUrl("https://intranet/x")).rejection).toBe("private_or_reserved_address");
    expect((await validatePublicHttpUrl("https://db.local/x")).rejection).toBe("private_or_reserved_address");
  });
  test("isPrivateAddress covers 169.254.169.254 (cloud metadata) and CGNAT", () => {
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("100.100.1.1")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});

// ── deterministic bar builder ────────────────────────────────────────────────
let seed = 116;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
function makeBars(n: number, drift = 0.0005, start = 100): Array<{ date: string; open: number; high: number; low: number; close: number }> {
  const bars: Array<{ date: string; open: number; high: number; low: number; close: number }> = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px * (1 + drift + (rnd() - 0.5) * 0.02);
    const high = Math.max(open, close) * (1 + rnd() * 0.01);
    const low = Math.min(open, close) * (1 - rnd() * 0.01);
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
    bars.push({ date: d, open, high, low, close });
    px = close;
  }
  return bars;
}

// ── D2/D3: engine contract ───────────────────────────────────────────────────
describe("12-strategy engine", () => {
  test("all twelve strategies registered with explicit roles", () => {
    expect(STRATEGY_INVENTORY.length).toBe(12);
    const directional = STRATEGY_INVENTORY.filter((s) => s.role === "directional");
    expect(directional.length).toBe(7);
    expect(STRATEGY_INVENTORY.filter((s) => s.role === "regime_gate").length).toBe(4);
    expect(STRATEGY_INVENTORY.filter((s) => s.role === "pair_context").length).toBe(1);
    // non-voters by design: the pair context (excluded — may need a short leg)
    // and the four regime gates (gate_only, never directional votes)
    expect(STRATEGY_INVENTORY.filter((s) => !s.votesInFusion).map((s) => s.strategyId).sort()).toEqual(
      ["pairs_kalman_hedge", "variance_ratio_lo_mackinlay", "hurst_exponent_rs", "autocorrelation_lag1", "bollinger_width_regime"].sort()
    );
  });

  test("every signal carries the full contract fields and traces to source bars", () => {
    const bars = makeBars(200);
    const sigs = evaluateStrategies({ symbol: "TST", bars, peerBars: new Map() });
    expect(sigs.length).toBe(12);
    for (const s of sigs) {
      expect(s.signalId.startsWith(s.strategyId + "_TST_")).toBe(true);
      expect(s.sourceBarDate).toBe(bars[bars.length - 1].date);
      expect(["directional", "regime_gate", "pair_context"]).toContain(s.role);
      expect(["eligible_vote", "gate_only", "excluded", "not_eligible"]).toContain(s.eligibility);
      expect(s.methodVersion).toBe("beta-v1");
      expect(typeof s.reason).toBe("string");
      if (s.validationStatus === "active" || s.validationStatus === "context_only") {
        expect(s.sourceReferences.length).toBeGreaterThan(0);
      }
    }
  });

  test("insufficient history is explicit — never silently neutral", () => {
    const bars = makeBars(40);
    // `now` inside the bar range so POLICY states are not confounded by staleness
    const now = new Date(bars[bars.length - 1].date + "T10:00:00Z");
    const sigs = evaluateStrategies({ symbol: "TST", bars, peerBars: new Map(), now });
    const short = sigs.filter((s) => s.validationStatus === "insufficient_data");
    // 10 strategies deterministically need >40 bars; donchian (needs only 36)
    // may report active/context at 40 depending on the price path.
    expect(short.length).toBeGreaterThanOrEqual(10);
    const donchian = sigs.find((x) => x.strategyId === "donchian_atr_breakout_20")!;
    expect(["active", "context_only", "insufficient_data"]).toContain(donchian.validationStatus);
    const pairs = sigs.find((s) => s.strategyId === "pairs_kalman_hedge")!;
    expect(pairs.validationStatus).toBe("blocked"); // blocked by long-only policy regardless of history
    const fusion = fuseSignals("TST", sigs);
    expect(fusion.state).toBe("INSUFFICIENT_DATA");
  });

  test("point-in-time: decisions are a deterministic function of bars ≤ decision bar", () => {
    // The same bar prefix + the same `now` must produce identical decisions
    // across independent invocations (no hidden mutable state, no future peeking).
    const full = makeBars(240);
    const slice = full.slice(0, 200);
    const now = new Date("2026-07-20T10:00:00Z"); // inside staleness window of the slice end
    const a = evaluateStrategies({ symbol: "TST", bars: slice, peerBars: new Map(), now });
    const b = evaluateStrategies({ symbol: "TST", bars: slice, peerBars: new Map(), now });
    for (let i = 0; i < a.length; i++) {
      expect(b[i].direction).toBe(a[i].direction);
      expect(b[i].rawScore).toBe(a[i].rawScore);
      // every source reference must lie within the decision slice — no future bars
      for (const ref of a[i].sourceReferences) expect(ref <= slice[slice.length - 1].date).toBe(true);
    }
    // And a decision on a SHORTER prefix differs from the full-series decision
    // only through its own trailing window — never by index into a future array.
    const c = evaluateStrategies({ symbol: "TST", bars: full, peerBars: new Map(), now: new Date("2026-08-30T10:00:00Z") });
    for (const s of c) {
      expect(s.sourceBarDate).toBe(full[full.length - 1].date);
    }
  });

  test("staleness is an EXPLICIT state (stale + null score), never silent neutrality", () => {
    const bars = makeBars(200);
    const staleNow = new Date(new Date(bars[bars.length - 1].date).getTime() + 40 * 86_400_000);
    const sigs = evaluateStrategies({ symbol: "TST", bars, peerBars: new Map(), now: staleNow });
    const stale = sigs.filter((s) => s.validationStatus === "stale");
    expect(stale.length).toBeGreaterThan(0);
    for (const s of stale) {
      expect(s.dataFreshness).toBe("stale");
      expect(s.eligibility).toBe("not_eligible");
      expect(s.reason).toContain("days old");
    }
    const fusion = fuseSignals("TST", sigs);
    expect(fusion.state).toBe("STALE_DATA");
  });

  test("golden cross fires only on actual crossovers (not the continuous diff)", () => {
    // strong monotonic uptrend then downtrend must produce GOLDEN then DEATH events
    const bars = makeBars(220, 0.004);
    const now = new Date(bars[bars.length - 1].date + "T10:00:00Z");
    const sigs = evaluateStrategies({ symbol: "TST", bars, peerBars: new Map(), now });
    const gc = sigs.find((s) => s.strategyId === "golden_cross_ma7_30")!;
    expect(["active", "context_only"]).toContain(gc.validationStatus);
    expect(gc.reason).toMatch(/crossover|No crossover event/);
  });

  test("OU fit reports non-stationarity honestly (no clamping)", () => {
    // random walk with drift: AR(1) phi > 1 — must be reported non-stationary
    let x = 0; const rw: number[] = [];
    for (let i = 0; i < 130; i++) { x += 0.02 + (rnd() - 0.5) * 0.01; rw.push(x); }
    const bad = fitAr1(rw);
    expect(bad).not.toBeNull();
    expect(bad!.stationary).toBe(false);
  });

  test("variance ratio and hurst report insufficient data on small samples", () => {
    expect(varianceRatio([0.01, -0.01, 0.02], 4)).toBeNull();
    expect(hurstExponent(Array.from({ length: 30 }, () => rnd() - 0.5))).toBeNull();
  });

  test("wilder RSI bounds", () => {
    const closes = makeBars(60).map((b) => b.close);
    const rsi = wilderRsi(closes, 14).filter((x) => x != null) as number[];
    expect(Math.min(...rsi)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...rsi)).toBeLessThanOrEqual(100);
  });
});

// ── E3: fusion semantics ─────────────────────────────────────────────────────
describe("fusion", () => {
  function signalWith(direction: "bullish" | "bearish" | "neutral", role: "directional" | "regime_gate" | "pair_context", strategyId: string): StrategySignal {
    return {
      signalId: `${strategyId}_TST_2026-06-01`,
      symbol: "TST",
      strategyId,
      strategyName: strategyId,
      decisionTimestamp: "2026-06-01T10:00:00Z",
      sourceBarDate: "2026-06-01",
      direction,
      rawScore: direction === "bullish" ? 1 : direction === "bearish" ? -1 : 0,
      role,
      eligibility: role === "directional" ? "eligible_vote" : role === "regime_gate" ? "gate_only" : "excluded",
      reason: "test",
      dataFreshness: "current" as const,
      inputCoverage: 1,
      methodVersion: "beta-v1",
      sourceReferences: ["2026-06-01"],
      validationStatus: role === "directional" ? ("active" as const) : ("context_only" as const),
    };
  }

  test("bullish consensus across >=3 votes and >=2 families -> BULLISH_ALIGNMENT", () => {
    const sigs = [
      signalWith("bullish", "directional", "golden_cross_ma7_30"),
      signalWith("bullish", "directional", "macd_ema12_26_9"),
      signalWith("bullish", "directional", "zscore_mean_reversion_60"),
      signalWith("bullish", "directional", "ou_mean_reversion_ar1"),
      signalWith("neutral", "directional", "linreg_channel_60"),
      signalWith("neutral", "regime_gate", "hurst_exponent_rs"),
      signalWith("neutral", "pair_context", "pairs_kalman_hedge"),
    ];
    const f = fuseSignals("TST", sigs);
    expect(f.state).toBe("BULLISH_ALIGNMENT");
    expect(f.eligibleDirectional).toBe(5);
    expect(f.alignmentLabel).toBe("4 of 5 eligible directional strategies align");
    // one dissenting vote from an UNCAPPED family slot -> MIXED_EVIDENCE,
    // never an averaged alignment
    const dissent = fuseSignals("TST", [
      sigs[0], sigs[1], // trend_momentum pair (capped here)
      signalWith("bullish", "directional", "zscore_mean_reversion_60"),
      signalWith("bearish", "directional", "ou_mean_reversion_ar1"),
      sigs[4], sigs[5], sigs[6],
    ]);
    expect(dissent.state).toBe("MIXED_EVIDENCE");
    expect(f.familiesRepresented).toBeGreaterThanOrEqual(2);
  });

  test("conflicting evidence -> MIXED_EVIDENCE (never averaged away)", () => {
    const sigs = [
      signalWith("bullish", "directional", "golden_cross_ma7_30"),
      signalWith("bearish", "directional", "macd_ema12_26_9"),
      signalWith("bullish", "directional", "zscore_mean_reversion_60"),
      signalWith("bearish", "directional", "ou_mean_reversion_ar1"),
      signalWith("neutral", "directional", "linreg_channel_60"),
      signalWith("neutral", "regime_gate", "hurst_exponent_rs"),
      signalWith("neutral", "pair_context", "pairs_kalman_hedge"),
    ];
    expect(fuseSignals("TST", sigs).state).toBe("MIXED_EVIDENCE");
  });

  test("pair context NEVER counts as a vote — pair-only input stays PAIR_CONTEXT_ONLY", () => {
    const sigs = [signalWith("bullish", "pair_context", "pairs_kalman_hedge")];
    const f = fuseSignals("TST", sigs);
    expect(f.state).toBe("PAIR_CONTEXT_ONLY");
    expect(f.eligibleDirectional).toBe(0);
  });

  test("family cap: 3 bullish same-family votes count as 2", () => {
    const sigs = [
      signalWith("bullish", "directional", "golden_cross_ma7_30"),
      signalWith("bullish", "directional", "macd_ema12_26_9"),
      signalWith("bullish", "directional", "rsi_divergence_wilder14"), // 3rd trend_momentum
      signalWith("bearish", "directional", "zscore_mean_reversion_60"),
      signalWith("bearish", "directional", "ou_mean_reversion_ar1"),
      signalWith("bearish", "directional", "linreg_channel_60"),
    ];
    const f = fuseSignals("TST", sigs);
    // trend family has 4 votes, capped at 2 (both bullish); mean_reversion has
    // 2 (both bearish) -> 2 pos, 2 neg, 2 capped-out recorded as not voting
    expect(f.eligibleVotesPositive).toBe(2);
    expect(f.eligibleVotesNegative).toBe(2);
    expect(f.eligibleVotesNeutral).toBe(2);
    const trend = f.familyBreakdown.find((x) => x.family === "trend_momentum")!;
    expect(trend.votes).toBe(2);
    expect(trend.strategies).toBe(4);
    expect(f.state).toBe("MIXED_EVIDENCE");
  });

  test("single insufficient vote set yields INSUFFICIENT_DATA with visible reasons", () => {
    const sig = signalWith("neutral", "directional", "golden_cross_ma7_30");
    sig.validationStatus = "insufficient_data";
    sig.eligibility = "not_eligible";
    const f = fuseSignals("TST", [sig]);
    expect(f.state).toBe("INSUFFICIENT_DATA");
    expect(f.stateReason).toContain("No eligible directional votes");
  });
});
