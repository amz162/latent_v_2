// Latent.pk — beta fusion engine (Task 116 Part E)
//
// Transparent, reproducible consensus — NOT the supplied Kalman fusion:
//   * the supplied implementation restarted its prior state (zero mean,
//     unit variance) on every timestep, so it never maintained a persistent
//     posterior — that defect is not reproduced here;
//   * arbitrary per-strategy "uncertainty" fields are NOT treated as
//     measurement variances;
//   * components derived from the same OHLC series are CORRELATED, so votes
//     are capped per family and the number of represented families is shown
//     — correlated components never stack as independent evidence.
//
// Until out-of-sample evidence supports calibrated weights, the beta uses
// simple auditable eligible votes with documented family-level limits. The
// fusion output states are explicit; no forced BUY/SELL on weak evidence.

import { STRATEGY_INVENTORY, type StrategySignal, type StrategyMeta } from "./engine";

export type FusionState =
  | "BULLISH_ALIGNMENT"
  | "BEARISH_PRESSURE"
  | "MIXED_EVIDENCE"
  | "INSUFFICIENT_DATA"
  | "STALE_DATA"
  | "REGIME_UNCLEAR"
  | "PAIR_CONTEXT_ONLY"
  | "LLM_CONFLICT"
  | "LLM_UNAVAILABLE";

const FAMILY_VOTE_CAP = 2; // correlated components must not stack

export interface FamilyBreakdown {
  family: string;
  strategies: number;
  votes: number; // votes actually cast (after cap)
  positive: number;
  negative: number;
  neutral: number;
  cap: number;
}

export interface FusionResult {
  symbol: string;
  state: FusionState;
  stateReason: string;
  eligibleDirectional: number; // denominator — visible, never inflated
  eligibleVotesPositive: number;
  eligibleVotesNegative: number;
  eligibleVotesNeutral: number;
  alignedCount: number; // max(positive, negative)
  alignmentLabel: string; // honest display line
  familiesRepresented: number;
  familyBreakdown: FamilyBreakdown[];
  regimeFlags: string[]; // gate outputs that disagree with the vote direction
  gates: Array<{ strategyId: string; summary: string }>;
  pairContext: string | null;
  excluded: Array<{ strategyId: string; status: string; reason: string }>;
  methodologyVersion: string;
  decisionTimestamp: string;
  sourceBarDate: string;
}

const METHODOLOGY_VERSION = "beta-consensus-v1";

export function fuseSignals(symbol: string, signals: StrategySignal[]): FusionResult {
  const inv = new Map<string, StrategyMeta>(STRATEGY_INVENTORY.map((m) => [m.strategyId, m]));
  const decisionTimestamp = signals[0]?.decisionTimestamp ?? new Date().toISOString();
  const sourceBarDate = signals[0]?.sourceBarDate ?? "";

  const dirSignals = signals.filter((s) => s.role === "directional");
  const gateSignals = signals.filter((s) => s.role === "regime_gate");
  const pairSignals = signals.filter((s) => s.role === "pair_context");

  const excluded = signals
    .filter((s) => s.validationStatus !== "active" && s.validationStatus !== "context_only")
    .map((s) => ({ strategyId: s.strategyId, status: s.validationStatus, reason: s.reason }));

  // hard states first — no forced consensus on weak evidence
  const stale = signals.filter((s) => s.validationStatus === "stale");
  if (stale.length >= Math.max(1, Math.ceil(signals.length / 2))) {
    return emptyResult(symbol, "STALE_DATA", `Majority of strategy inputs are stale at the last verified bar ${sourceBarDate}.`, signals, decisionTimestamp, sourceBarDate, excluded);
  }
  const insufficient = dirSignals.filter((s) => s.validationStatus === "insufficient_data");
  const votable = dirSignals.filter((s) => s.eligibility === "eligible_vote");
  if (votable.length === 0) {
    // PAIR_CONTEXT_ONLY only when a genuinely usable pair-context output
    // exists; a policy-blocked or insufficient pair does not mask the fact
    // that the directional engine lacks data.
    const pair = pairSignals[0];
    const pairUsable = pair && (pair.validationStatus === "active" || pair.validationStatus === "context_only");
    if (pairUsable && dirSignals.every((s) => s.validationStatus !== "calculation_error")) {
      return emptyResult(symbol, "PAIR_CONTEXT_ONLY", "No eligible directional votes; only pair-relative context is available (excluded from consensus by policy).", signals, decisionTimestamp, sourceBarDate, excluded);
    }
    return emptyResult(
      symbol,
      "INSUFFICIENT_DATA",
      `No eligible directional votes: ${insufficient.length} of ${dirSignals.length} directional strategies lack sufficient valid history.`,
      signals,
      decisionTimestamp,
      sourceBarDate,
      excluded
    );
  }

  // family-capped votes (documented limit, not arbitrary weights)
  const familyBreakdown: FamilyBreakdown[] = [];
  let pos = 0;
  let neg = 0;
  const families = new Map<string, StrategySignal[]>();
  for (const s of votable) {
    const fam = inv.get(s.strategyId)?.family ?? "trend_momentum";
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam)!.push(s);
  }
  for (const [fam, sigs] of families) {
    const capped = sigs.slice(0, FAMILY_VOTE_CAP); // deterministic order = inventory order
    const p = capped.filter((s) => s.direction === "bullish").length;
    const n = capped.filter((s) => s.direction === "bearish").length;
    pos += p;
    neg += n;
    familyBreakdown.push({
      family: fam,
      strategies: sigs.length,
      votes: capped.length,
      positive: p,
      negative: n,
      neutral: sigs.length - capped.length,
      cap: FAMILY_VOTE_CAP,
    });
  }
  const neutralCount = votable.length - pos - neg;
  const familiesRepresented = families.size;
  const aligned = Math.max(pos, neg);
  const alignmentLabel = `${aligned} of ${votable.length} eligible directional strategies align`;

  // regime gates: record flags when a significant gate CONTRADICTS the vote direction
  const regimeFlags: string[] = [];
  for (const g of gateSignals) {
    if (g.validationStatus !== "context_only" && g.validationStatus !== "active") continue;
    if (g.rawScore == null) continue;
    if (pos > neg && g.rawScore < -0.3) regimeFlags.push(`${g.strategyName}: ${g.reason}`);
    if (neg > pos && g.rawScore > 0.3) regimeFlags.push(`${g.strategyName}: ${g.reason}`);
  }

  let state: FusionState;
  let stateReason: string;
  if (pos > 0 && neg === 0 && pos >= 3) {
    state = regimeFlags.length >= 2 ? "REGIME_UNCLEAR" : "BULLISH_ALIGNMENT";
    stateReason = `${alignmentLabel} (positive consensus). ${regimeFlags.length >= 2 ? "However, multiple regime gates contradict the direction." : ""}`.trim();
  } else if (neg > 0 && pos === 0 && neg >= 3) {
    state = regimeFlags.length >= 2 ? "REGIME_UNCLEAR" : "BEARISH_PRESSURE";
    stateReason = `${alignmentLabel} (negative pressure — exit context under the long-only policy, NOT a short signal). ${regimeFlags.length >= 2 ? "However, multiple regime gates contradict the direction." : ""}`.trim();
  } else if (pos > 0 && neg > 0) {
    state = "MIXED_EVIDENCE";
    stateReason = `${pos} positive vs ${neg} negative eligible votes (${alignmentLabel.replace(String(aligned) + " of ", "")}) — conflicting directional evidence is shown, never averaged away.`;
  } else {
    state = "MIXED_EVIDENCE";
    stateReason = `${alignmentLabel} but below the 3-vote threshold for a directional state; ${neutralCount} of ${votable.length} eligible votes were neutral.`;
  }

  return {
    symbol,
    state,
    stateReason,
    eligibleDirectional: votable.length,
    eligibleVotesPositive: pos,
    eligibleVotesNegative: neg,
    eligibleVotesNeutral: neutralCount,
    alignedCount: aligned,
    alignmentLabel,
    familiesRepresented,
    familyBreakdown,
    regimeFlags,
    gates: gateSignals.map((g) => ({ strategyId: g.strategyId, summary: g.reason })),
    pairContext: pairSignals[0]?.reason ?? null,
    excluded,
    methodologyVersion: METHODOLOGY_VERSION,
    decisionTimestamp,
    sourceBarDate,
  };
}

function emptyResult(
  symbol: string,
  state: FusionState,
  reason: string,
  signals: StrategySignal[],
  decisionTimestamp: string,
  sourceBarDate: string,
  excluded: FusionResult["excluded"]
): FusionResult {
  const votable = signals.filter((s) => s.eligibility === "eligible_vote");
  const pos = votable.filter((s) => s.direction === "bullish").length;
  const neg = votable.filter((s) => s.direction === "bearish").length;
  return {
    symbol,
    state,
    stateReason: reason,
    eligibleDirectional: votable.length,
    eligibleVotesPositive: pos,
    eligibleVotesNegative: neg,
    eligibleVotesNeutral: Math.max(0, votable.length - pos - neg),
    alignedCount: Math.max(pos, neg),
    alignmentLabel: votable.length ? `${Math.max(pos, neg)} of ${votable.length} eligible directional strategies align` : "0 of 0 — no eligible directional strategies",
    familiesRepresented: 0,
    familyBreakdown: [],
    regimeFlags: [],
    gates: signals.filter((s) => s.role === "regime_gate").map((g) => ({ strategyId: g.strategyId, summary: g.reason })),
    pairContext: signals.find((s) => s.role === "pair_context")?.reason ?? null,
    excluded,
    methodologyVersion: METHODOLOGY_VERSION,
    decisionTimestamp,
    sourceBarDate,
  };
}
