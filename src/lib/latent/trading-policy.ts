/**
 * Task 105 — Capital-protection and no-trade policy (single source of truth).
 *
 * Evidence basis (frozen, Task 100-105):
 *  - All 60 Task 104 portfolio configurations lost money (-91.2% .. -99.5%).
 *  - Best comparable directional accuracy: ElasticNet 52.23%/51.78%, R2 < 0.
 *  - LSTM / CNN-LSTM did not beat the zero-return baseline.
 *  - Out-of-sample confidence-vs-outcome Spearman ~ -0.002 .. -0.07.
 *  - Signals are negative BEFORE costs; no configuration is positive after
 *    actual psx_user_schedule_v2 costs.
 *
 * Default posture: every model/strategy is research/shadow only; real orders
 * are impossible (no live-order pathway exists in this application); nothing
 * may be presented as a validated profitable system until the Task 105
 * evidence gates (task105_evidence_gate_report.json) are met on GENUINELY NEW
 * forward observations. This module is deliberately conservative: promotion
 * requires explicit, versioned policy edits — never inference from UI code.
 */

export const POLICY_VERSION = "task105-v1";

export type TradingPolicyState =
  | "research_only"
  | "shadow_only"
  | "no_trade"
  | "insufficient_evidence"
  | "data_unavailable"
  | "promoted";

export type NoTradeReason =
  | "no_reliable_predictive_edge"
  | "confidence_uncalibrated"
  | "expected_net_value_not_positive"
  | "missing_market_data"
  | "incomplete_fundamentals"
  | "poor_data_quality"
  | "risk_limit_reached"
  | "portfolio_capacity_exhausted"
  | "model_not_approved"
  | "insufficient_historical_validation";

export interface CapitalProtectionPolicy {
  policyVersion: string;
  allowRealTrades: false;
  allowLiveOrderExecution: false;
  allowAutomaticPromotion: false;
  presentConfidenceAsWinProbability: false;
  displayShortSellSignalsAsTradable: false;
  requireForwardEvidenceForPromotion: true;
  /** Minimum gates before a strategy/model may even be REVIEWED (not auto-promoted). */
  evidenceGates: {
    minMaturedForwardTrades: 100;
    minDistinctCalendarQuarters: 2;
    minIndependentSymbols: 15;
    minMarketRegimes: 2;
    requirePositiveNetExpectancyAfterCosts: true;
    requireCISupportsPositiveExpectancy: true;
    requireAcceptableMaxDrawdown: true;   // threshold set by review, not auto
    requireNoSevereConcentration: true;
    requireCalibrationStability: true;
  };
  states: Record<TradingPolicyState, string>;
  historicalEvidenceNote: string;
}

export const CAPITAL_PROTECTION_POLICY: CapitalProtectionPolicy = {
  policyVersion: POLICY_VERSION,
  allowRealTrades: false,
  allowLiveOrderExecution: false,
  allowAutomaticPromotion: false,
  presentConfidenceAsWinProbability: false,
  displayShortSellSignalsAsTradable: false,
  requireForwardEvidenceForPromotion: true,
  evidenceGates: {
    minMaturedForwardTrades: 100,
    minDistinctCalendarQuarters: 2,
    minIndependentSymbols: 15,
    minMarketRegimes: 2,
    requirePositiveNetExpectancyAfterCosts: true,
    requireCISupportsPositiveExpectancy: true,
    requireAcceptableMaxDrawdown: true,
    requireNoSevereConcentration: true,
    requireCalibrationStability: true,
  },
  states: {
    research_only: "Historical exploration only; not a trading recommendation.",
    shadow_only: "Records hypothetical paper observations; no user action implied.",
    no_trade: "Do not trade this signal; reason must be displayed.",
    insufficient_evidence: "Not enough matured forward evidence to evaluate.",
    data_unavailable: "Required market data is missing or stale.",
    promoted: "All evidence gates met on genuinely new data and review approved.",
  },
  historicalEvidenceNote:
    "Historical tests have not demonstrated positive net expectancy after PSX " +
    "trading costs. Models remain in research/shadow mode. No reliable profit " +
    "probability has been established.",
};

/** The reason registry with user-facing explanations (Task 105 Phase 7). */
export const NO_TRADE_REASON_REGISTRY: Record<NoTradeReason, string> = {
  no_reliable_predictive_edge:
    "Historical tests show no reliable predictive edge over a no-trade baseline.",
  confidence_uncalibrated:
    "The confidence score is not a calibrated win probability.",
  expected_net_value_not_positive:
    "Expected value after PSX trading costs is not positive.",
  missing_market_data: "Required market data is missing for this decision.",
  incomplete_fundamentals: "Fundamental data coverage is incomplete.",
  poor_data_quality: "Data quality checks failed for this instrument.",
  risk_limit_reached: "A risk limit for this account/policy has been reached.",
  portfolio_capacity_exhausted:
    "Available capital or position capacity is exhausted.",
  model_not_approved: "The model is not approved for trading use.",
  insufficient_historical_validation:
    "Forward validation has not accumulated the required evidence.",
};

/**
 * Evaluate the policy state for a model/strategy in the CURRENT evidence
 * regime. Nothing is promoted: the frozen Task 104 evidence fails every gate.
 */
export function evaluatePolicyState(input?: {
  hasPositiveNetExpectancy?: boolean;
  maturedForwardTrades?: number;
}): { state: TradingPolicyState; noTradeReason: NoTradeReason | null } {
  const g = CAPITAL_PROTECTION_POLICY.evidenceGates;
  const matured = input?.maturedForwardTrades ?? 0;
  if (!input?.hasPositiveNetExpectancy) {
    return { state: "no_trade", noTradeReason: "expected_net_value_not_positive" };
  }
  if (matured < g.minMaturedForwardTrades) {
    return { state: "insufficient_evidence", noTradeReason: "insufficient_historical_validation" };
  }
  // Even with positive expectancy and enough trades, promotion is a human,
  // versioned decision — the system itself never promotes.
  return { state: "no_trade", noTradeReason: "model_not_approved" };
}
