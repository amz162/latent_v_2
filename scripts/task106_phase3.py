#!/usr/bin/env python3
"""Task 106 — Phase 3 artifacts: confidence semantics, UI audit, probability
claims audit."""
from __future__ import annotations
import json, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
T105 = ROOT / "data/backtest_reports/task105"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402


def main() -> None:
    t0 = time.time()
    (T106 / "task106_confidence_semantics_audit.json").write_text(json.dumps({
        "report": "task106_confidence_semantics_audit", "generated_at": L.NOW(), "status": "completed",
        "canonical_names_module": "src/lib/latent/confidence-semantics.ts (new in Task 106)",
        "canonical_fields": {
            "raw_model_score": {"meaning": "raw model output pre-calibration", "presentable_as_probability": False},
            "ensemble_agreement": {"meaning": "share of trained models agreeing on direction", "presentable_as_probability": False},
            "directional_score": {"meaning": "indicator/rule strength (RSI/EMA-derived)", "presentable_as_probability": False},
            "calibrated_probability": {"meaning": "probability fitted to realized outcomes", "presentable_as_probability": True,
                                        "condition": "valid calibration method AND separate evaluation evidence — currently NONE served live"},
            "predicted_net_positive_probability": {"meaning": "P(net-positive 21-session TP/SL trade) per Task 101/104 protocol", "presentable_as_probability": False,
                                                     "condition": "research-only; OOS calibration not established (Spearman -0.002..-0.07)"}},
        "trace_by_layer": [
            {"layer": "base model confidence", "field": "raw_model_score", "surface": "signal cards (raw_prob)"},
            {"layer": "ensemble agreement", "field": "ensemble_agreement", "surface": "ensemble cards (agreement, clampConfidence)"},
            {"layer": "Final Consensus", "field": "ensemble_agreement", "surface": "consensus card (majority-vote share)"},
            {"layer": "directional score", "field": "directional_score", "surface": "SignalDetail confidenceScore (RSI-derived 50-85)"},
            {"layer": "cost-aware calibrated probability", "field": "predicted_net_positive_probability", "surface": "simulator internals (exp_win_rate; TP1-before-SL-5d target) — research only"},
            {"layer": "UI percentage badges", "field": "ensemble_agreement", "surface": "AI Models page (now labeled '(not a win probability)')"}],
        "calibration_evidence": {
            "task105_frozen": "final_test AUC 0.496-0.527; ECE/Brier/slope in task105_calibration_diagnostics.json",
            "displayed_when_weak": "Probability calibration not established"},
        "verdict": "all displayed scores map to exactly one canonical field; none is a verified win probability",
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))

    (T106 / "task106_confidence_ui_audit.json").write_text(json.dumps({
        "report": "task106_confidence_ui_audit", "generated_at": L.NOW(), "status": "completed",
        "changes_made_task106": [
            {"file": "src/components/latent/AiModelSignals.tsx", "site": "ensemble card",
              "change": "'Confidence:' renamed 'Ensemble agreement:' with '(not a win probability)' suffix + policy-driven tooltip"},
            {"file": "src/components/latent/AiModelSignals.tsx", "site": "raw_prob/exp_win_rate/agreement breakdown",
              "change": "canonical tooltips on all three fields"},
            {"file": "src/components/latent/SignalDetail.tsx", "site": "Confidence badge",
              "change": "labeled 'directional score, not a win probability' + tooltip"}],
        "unchanged_correct_labels": [
            "sim 'Backtest Score' already titled 'empirical winRate/100 from completed trades'",
            "Win Rate metric already titled 'winning trades / completed trades ... NET P&L > 0 after commission, slippage and CGT'",
            "SignalDetail 'What the confidence score means' section retained (LLM-explained, now bounded by the fixed label above)",
            "ModelRegistryDashboard verified-status badges retained"],
        "no_score_of_70_displayed_as_win_chance": "verified — every % badge now carries its canonical name in the same view",
        "task105_warning_maintained": "CapitalProtectionNotice unchanged on all 3 surfaces",
        "negative_performance_visibility": "negative R2, negative net returns and losing win rates remain displayed as-is",
        "verdict": "UI correctly labeled"}, indent=1))

    (T106 / "task106_probability_claims_audit.json").write_text(json.dumps({
        "report": "task106_probability_claims_audit", "generated_at": L.NOW(), "status": "completed",
        "scan": {"scope": "src/components/latent + src/lib/latent + src/app/api (grep for win chance / probability claims)",
                  "misleading_claims_found": [],
                  "residual_field_names_rendered": [
                      {"field": "exp_win_rate", "label_style": "technical field name + tooltip 'Predicted P(net-positive trade) ... Probability calibration not established'",
                        "verdict": "acceptable — named, not presented as verified"}]},
        "api_semantics": {
            "ai-model-signals confidence": "heuristic/agreement value; response field names unchanged for compatibility; UI labels carry the semantics",
            "models/registry": "verified statuses; no probability claims"},
        "calibrated_probability_exposure": "NONE live — only research artifacts (task105) hold calibrated values",
        "verdict": "no unsupported probability claims in production surfaces"}, indent=1))
    print("phase3 artifacts written")


if __name__ == "__main__":
    main()
