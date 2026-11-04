// ============================================================================
// Task 111 / Phase 12 — Deterministic entry / stop / target / net risk-reward
// engine. The LLM may PROPOSE levels; this engine recomputes them from
// verified market data and the platform's existing risk policy
// (risk-levels.ts: atr14-1.5-1-2-3) and prices every leg through the
// production V2 cost engine (psx_user_schedule_v2). The LLM can never write
// an R:R that differs from this calculation, and cannot relax any rule.
// Long-only: no leverage, no shorting, whole shares, cash-constrained.
// ============================================================================
import {
  computeRiskLevels,
  RISK_LEVEL_POLICY_ID,
  RISK_LEVEL_POLICY_VERSION,
  type RiskLevelBar,
} from "../risk-levels";
import { computeTradeCostsV2, COST_PROFILES, type TradeCostsV2 } from "../trading-costs";

export const RR_CONFIG_VERSION = "task111-rr-v1";
export const REFERENCE_CAPITAL_PKR = 100_000;
export const REFERENCE_POSITION_PCT = 0.2; // same default as the GC research config
export const MIN_RR_THRESHOLDS = [1.0, 1.5, 2.0] as const; // predeclared; none "selected" on final test
export const DEFAULT_MIN_RR = 1.5;

export interface RRBar extends RiskLevelBar {
  volume?: number;
}

export interface RiskRewardResult {
  configVersion: typeof RR_CONFIG_VERSION;
  riskPolicyId: string;
  riskPolicyVersion: string;
  costSchedule: string;
  symbol: string;
  cutoffDate: string;
  executionAssumption: "next_session_open_reference" | "delayed_observation_shadow";
  entryReference: number;
  atr14: number;
  stopLoss: number;
  stopRule: string;
  targets: { tp1: number; tp2: number; tp3: number };
  targetRule: string;
  positionQty: number;
  positionNotional: number;
  netGainAtTp1: number | null;
  netGainAtTp2: number | null;
  netGainAtTp3: number | null;
  netLossAtStop: number | null;
  rr_to_tp1: number | null;
  rr_to_tp2: number | null;
  rr_to_tp3: number | null;
  risk_reward_status: "available" | "unavailable";
  unavailableReason: string | null;
  costsAtTp2: TradeCostsV2 | null;
  noTrade: boolean;
  noTradeReasons: string[];
}

function atrSupportFromZones(zones: { low: number | null; high: number | null }[], entry: number): number | null {
  // Verified support = highest zone top that is still BELOW the entry reference.
  const candidates = zones
    .map((z) => (z.high != null && z.high < entry ? z.high : z.low != null && z.low < entry ? z.low : null))
    .filter((v): v is number => v != null && v > 0);
  return candidates.length ? Math.max(...candidates) : null;
}

export interface RRInput {
  symbol: string;
  bars: RRBar[]; // chronological, verified OHLC only
  cutoffDate: string; // last completed session
  supportZones?: { low: number | null; high: number | null }[];
  delayedSnapshot?: boolean; // true when the snapshot is intraday-delayed
  minRR?: number; // predeclared threshold (never tuned on final test)
  taxProfile?: "ATL_15" | "NON_ATL_30";
  fundamentalPitSafe?: boolean;
  thesisDependsOnNews?: boolean;
  newsAvailable?: boolean;
  technicalFundamentalConflict?: boolean;
  evidenceQualityScore?: number; // 0-100 deterministic
}

/**
 * Deterministic levels + cost-inclusive R:R. Returns a result even when the
 * verdict is NO_TRADE (with reasons) so decisions remain auditable.
 */
export function computeRiskReward(input: RRInput): RiskRewardResult {
  const noTradeReasons: string[] = [];
  const minRR = input.minRR ?? DEFAULT_MIN_RR;
  const taxProfile = input.taxProfile ?? "ATL_15";
  const levels = computeRiskLevels(input.bars, input.cutoffDate, "BUY");
  const base: RiskRewardResult = {
    configVersion: RR_CONFIG_VERSION,
    riskPolicyId: RISK_LEVEL_POLICY_ID,
    riskPolicyVersion: RISK_LEVEL_POLICY_VERSION,
    costSchedule: "psx_user_schedule_v2 (computeTradeCostsV2)",
    symbol: input.symbol,
    cutoffDate: input.cutoffDate,
    executionAssumption: (input.delayedSnapshot ? "delayed_observation_shadow" : "next_session_open_reference") as RiskRewardResult["executionAssumption"],
    entryReference: levels?.entryReference ?? NaN,
    atr14: levels?.atr14 ?? NaN,
    stopLoss: NaN,
    stopRule: "",
    targets: { tp1: NaN, tp2: NaN, tp3: NaN },
    targetRule: `${RISK_LEVEL_POLICY_ID}: TP1/2/3 = entry + 1/2/3 x ATR14 (platform policy, unmodified)`,
    positionQty: 0,
    positionNotional: 0,
    netGainAtTp1: null,
    netGainAtTp2: null,
    netGainAtTp3: null,
    netLossAtStop: null,
    rr_to_tp1: null,
    rr_to_tp2: null,
    rr_to_tp3: null,
    risk_reward_status: "unavailable" as RiskRewardResult["risk_reward_status"],
    unavailableReason: null as string | null,
    costsAtTp2: null as TradeCostsV2 | null,
    noTrade: true,
    noTradeReasons,
  };

  if (!levels) {
    base.unavailableReason = "ATR/cutoff unavailable or insufficient bar history";
    noTradeReasons.push("no_valid_entry_or_stop_possible");
    return base;
  }
  const entry = levels.entryReference;
  base.stopLoss = levels.sl;
  base.stopRule = `${RISK_LEVEL_POLICY_ID}: entry - 1.5 x ATR14` + (input.supportZones?.length ? "; tightened only if a verified support zone sits lower" : "");
  base.targets = { tp1: levels.tp1, tp2: levels.tp2, tp3: levels.tp3 };

  // Optional conservative tightening from verified support (never loosening).
  const support = input.supportZones?.length ? atrSupportFromZones(input.supportZones, entry) : null;
  if (support != null && support - 0.25 * levels.atr14 < base.stopLoss) {
    base.stopLoss = support - 0.25 * levels.atr14;
    base.stopRule += `; support zone ${support.toFixed(2)} - 0.25 x ATR applied (tighter)`;
  }

  if (!(base.stopLoss > 0) || base.stopLoss >= entry) {
    noTradeReasons.push("stop_not_below_entry");
  }
  if (!(levels.atr14 > 0)) noTradeReasons.push("atr_non_positive");

  // Whole-share position on the reference notional (cash-constrained, no leverage).
  const notional = REFERENCE_CAPITAL_PKR * REFERENCE_POSITION_PCT;
  const qty = Math.floor(notional / entry);
  base.positionQty = qty;
  base.positionNotional = qty * entry;
  if (qty < 1) noTradeReasons.push("whole_share_size_zero");

  // NO-TRADE controls (documented policy; the LLM cannot override these).
  if (input.evidenceQualityScore != null && input.evidenceQualityScore < 35) noTradeReasons.push("evidence_quality_inadequate");
  if (input.fundamentalPitSafe === false) noTradeReasons.push("fundamentals_not_point_in_time_safe_for_the_thesis");
  if (input.thesisDependsOnNews && input.newsAvailable === false) noTradeReasons.push("required_news_evidence_unavailable");
  if (input.technicalFundamentalConflict) noTradeReasons.push("technical_fundamental_material_conflict");
  if (input.delayedSnapshot) noTradeReasons.push("delayed_observation_shadow_no_historical_backfill");

  // Net R:R per target through the production V2 cost engine.
  if (qty >= 1 && base.stopLoss > 0 && base.stopLoss < entry) {
    const profile = COST_PROFILES.psx_user_schedule_v2;
    const exits: Array<{ key: "tp1" | "tp2" | "tp3"; price: number }> = [
      { key: "tp1", price: base.targets.tp1 },
      { key: "tp2", price: base.targets.tp2 },
      { key: "tp3", price: base.targets.tp3 },
    ];
    let netLossAtStop: number | null = null;
    {
      const gross = (base.stopLoss - entry) * qty; // negative
      const c = computeTradeCostsV2(qty, entry, [{ quantity: qty, exitPrice: base.stopLoss }], gross, profile, taxProfile);
      netLossAtStop = c.netPnl; // net loss (<= 0)
      if (netLossAtStop >= 0) noTradeReasons.push("risk_denominator_non_negative");
    }
    base.netLossAtStop = netLossAtStop;
    for (const { key, price } of exits) {
      const gross = (price - entry) * qty;
      const c = computeTradeCostsV2(qty, entry, [{ quantity: qty, exitPrice: price }], gross, profile, taxProfile);
      if (key === "tp2") base.costsAtTp2 = c;
      const net = c.netPnl;
      base[`netGainAt${key.toUpperCase()}` as "netGainAtTp1"] = net;
      if (netLossAtStop != null && netLossAtStop < 0 && net > 0) {
        base[`rr_to_${key}` as "rr_to_tp1"] = net / Math.abs(netLossAtStop);
      }
    }
    const rrs = [base.rr_to_tp1, base.rr_to_tp2, base.rr_to_tp3].filter((v) => v != null) as number[];
    if (rrs.length) {
      base.risk_reward_status = "available";
      const best = Math.max(...rrs);
      if (best < minRR) noTradeReasons.push(`best_net_rr_${best.toFixed(2)}_below_min_${minRR.toFixed(1)}`);
    } else {
      base.unavailableReason = base.unavailableReason ?? "net risk denominator non-positive or no positive-net target";
      noTradeReasons.push("net_rr_unavailable");
    }
  }

  base.noTrade = noTradeReasons.length > 0;
  return base;
}
