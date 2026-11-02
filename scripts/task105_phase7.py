#!/usr/bin/env python3
"""Task 105 — Phase 6 (semantics + production decision) and Phase 7 (capital
protection policy artifacts)."""
from __future__ import annotations
import json, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T105 = ROOT / "data/backtest_reports/task105"
T104 = ROOT / "data/backtest_reports/task104"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402


def j(p):
    return json.loads(Path(p).read_text())


def main() -> None:
    t0 = time.time()
    (T105 / "task105_confidence_semantics.json").write_text(json.dumps({
        "report": "task105_confidence_semantics", "generated_at": L.NOW(), "status": "completed",
        "fields": [
            {"field": "ai-model-signals confidence", "surface": "per-model signal cards + Final Consensus",
              "production_value": "heuristic 50-85 derived from |RSI-50| (route.ts) or ensemble agreement % (ensemble.ts clampConfidence)",
              "meaning": "MODEL AGREEMENT / HEURISTIC STRENGTH — NOT a probability of winning",
              "calibrated": False},
            {"field": "exp_win_rate", "surface": "simulator ranking (model-backtest.ts)",
              "production_value": "calibrated expected win rate for the TP1-before-SL-in-5-days target (one specific target)",
              "meaning": "a calibrated probability FOR THAT TARGET ONLY",
              "calibrated": True,
              "caveat": "target-specific; not the probability that a displayed BUY signal profits"},
            {"field": "raw_prob", "surface": "signal cards", "meaning": "raw model score before calibration", "calibrated": False},
            {"field": "agreement", "surface": "ensemble cards", "meaning": "share of trained models agreeing on the direction", "calibrated": False},
            {"field": "Task 101/104 calibrated P(net>0)", "surface": "RESEARCH ARTIFACTS ONLY (not served live)",
              "meaning": "isotonic-calibrated probability that the 21-session TP/SL trade ends net-positive",
              "calibrated": True,
              "caveat": "OOS association with outcomes ~0 (Spearman -0.002..-0.07); unreliable for ranking"},
            {"field": "technical-rule strength (RSI/EMA)", "surface": "ai-model-signals",
              "meaning": "deterministic rule state, not a probability", "calibrated": False}],
        "separation": "directional confidence vs P(positive return) vs P(net-profitable trade) vs ensemble agreement vs raw score are DISTINCT quantities and are now labeled as such",
        "verdict": "no live-served confidence field qualifies as a verified win probability"}, indent=1))

    cal = j(T105 / "task105_calibration_diagnostics.json")["diagnostics"]
    ft = {k: v for k, v in cal.items() if k.endswith("final_test")}
    (T105 / "task105_confidence_production_decision.json").write_text(json.dumps({
        "report": "task105_confidence_production_decision", "generated_at": L.NOW(), "status": "completed",
        "decision": "UNRELIABLE — confidence must not be presented as a win probability",
        "basis": {
            "final_test_diagnostics": {k: {"auc": v["auc"], "brier_cal": v["brier_cal"],
                                             "ece_mean_abs": v["ece_mean_abs"],
                                             "calibration_slope": v["calibration_slope"]}
                                        for k, v in ft.items()},
            "task104_frozen": "Spearman(confidence, outcome) OOS = -0.002..-0.07; filter improves expectancy but stays negative"},
        "production_actions": [
            "CapitalProtectionNotice mounted on AI-model signals and Investment Strategy surfaces",
            "confidence labeled as agreement/strength indicator (Phase 10 wording)",
            "calibrated P(net>0) remains research-only; not promoted",
            "policy module src/lib/latent/trading-policy.ts is the single source of truth (POLICY_VERSION task105-v1)"],
        "reversal_condition": "decision can be revisited only after task105 evidence gates are met on genuinely new forward observations",
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))

    (T105 / "task105_capital_protection_policy.json").write_text(json.dumps({
        "report": "task105_capital_protection_policy", "generated_at": L.NOW(), "status": "completed",
        "policy_version": "task105-v1",
        "implementation": "src/lib/latent/trading-policy.ts (compiled, tsc-clean) + src/components/latent/CapitalProtectionNotice.tsx",
        "defaults": {
            "allowRealTrades": False, "allowLiveOrderExecution": False,
            "allowAutomaticPromotion": False, "presentConfidenceAsWinProbability": False,
            "displayShortSellSignalsAsTradable": False,
            "requireForwardEvidenceForPromotion": True},
        "states": ["research_only", "shadow_only", "no_trade", "insufficient_evidence",
                    "data_unavailable", "promoted"],
        "evidence_gates": {"minMaturedForwardTrades": 100, "minDistinctCalendarQuarters": 2,
                            "minIndependentSymbols": 15, "minMarketRegimes": 2,
                            "requirePositiveNetExpectancyAfterCosts": True,
                            "requireCISupportsPositiveExpectancy": True,
                            "requireAcceptableMaxDrawdown": True,
                            "requireNoSevereConcentration": True,
                            "requireCalibrationStability": True},
        "preservation_guarantees": ["historical signals and paper-trading records preserved",
                                     "prospective lifecycle records untouched",
                                     "production consensus unchanged",
                                     "no model removed from the registry"],
        "verdict": "policy active with safe defaults; nothing promoted"}, indent=1))

    (T105 / "task105_no_trade_reason_registry.json").write_text(json.dumps({
        "report": "task105_no_trade_reason_registry", "generated_at": L.NOW(), "status": "completed",
        "reasons": {
            "no_reliable_predictive_edge": "Historical tests show no reliable predictive edge over a no-trade baseline.",
            "confidence_uncalibrated": "The confidence score is not a calibrated win probability.",
            "expected_net_value_not_positive": "Expected value after PSX trading costs is not positive.",
            "missing_market_data": "Required market data is missing for this decision.",
            "incomplete_fundamentals": "Fundamental data coverage is incomplete.",
            "poor_data_quality": "Data quality checks failed for this instrument.",
            "risk_limit_reached": "A risk limit for this account/policy has been reached.",
            "portfolio_capacity_exhausted": "Available capital or position capacity is exhausted.",
            "model_not_approved": "The model is not approved for trading use.",
            "insufficient_historical_validation": "Forward validation has not accumulated the required evidence."},
        "current_default_reason": "expected_net_value_not_positive",
        "source_of_truth": "NO_TRADE_REASON_REGISTRY in src/lib/latent/trading-policy.ts"}, indent=1))

    (T105 / "task105_production_signal_disposition.json").write_text(json.dumps({
        "report": "task105_production_signal_disposition", "generated_at": L.NOW(), "status": "completed",
        "surfaces": [
            {"surface": "AI Models / ai-model-signals (per-model + ensembles + Final Consensus)",
              "state": "research_only", "no_trade_reason": "expected_net_value_not_positive",
              "labeling": "CapitalProtectionNotice banner; BUY/SELL displayed as research signals with SL/TP geometry"},
            {"surface": "Strategy cards / InvestmentStrategy", "state": "research_only",
              "no_trade_reason": "expected_net_value_not_positive", "labeling": "CapitalProtectionNotice compact banner"},
            {"surface": "Investment Simulator", "state": "research_only",
              "no_trade_reason": None,
              "note": "simulation-only; includes SELL (short) paths that assume unverified rights — disclosed in banner wording"},
            {"surface": "Backtesting reports", "state": "research_only", "note": "historical, development_only labels preserved"},
            {"surface": "Paper-trading dashboard (prospective lifecycle)", "state": "shadow_only",
              "note": "Task 103 lifecycle records preserved; Task 105 shadow observations use a separate namespace"},
            {"surface": "Live order execution", "state": "no_trade",
              "no_trade_reason": "model_not_approved",
              "note": "no live-order pathway exists in the application; policy codifies this"}],
        "consensus_unchanged": True,
        "verdict": "all surfaces accurately labeled; nothing presented as validated profitable"}, indent=1))
    print("phase7 artifacts written")


if __name__ == "__main__":
    main()
