# Task 105 — Confidence Calibration

## What each confidence field actually is

| Field | Where | What it is | Calibrated? |
| --- | --- | --- | --- |
| Confidence X/100 (signal cards, Final Consensus) | ai-model-signals route | Heuristic 50–85 from \|RSI−50\| | No |
| Ensemble confidence | ensemble.ts | Model agreement share (majority vote), clamped 0–100 | No — it is agreement, not a probability |
| raw_prob | signal cards | Raw model score pre-calibration | No |
| exp_win_rate | simulator ranking | Calibrated P(TP1-before-SL within 5 days) for that one target | Yes, target-specific |
| Task 101/104 P(net>0) | research artifacts only | Isotonic-calibrated probability of a net-positive 21-session trade | Yes — but unreliable OOS |

The full inventory with code references is `task105_confidence_semantics.json`. These quantities are distinct and are now labeled distinctly; an uncalibrated agreement score is never displayed as a win probability.

## Calibration evidence

`task105_calibration_diagnostics.json` (per strategy × partition): Brier, ECE (mean |p−y|), AUC, PR-AUC, logistic calibration slope/intercept, and decile reliability tables with Wilson 95% intervals.

- **Validation:** isotonic is perfectly calibrated in-sample by construction (slope ≈ 1, ECE ≈ 0). This is not evidence.
- **Final test (honest):** AUC 0.496–0.527 across strategies; calibration slope departs from 1; reliability segments are flat or inverted; Spearman(confidence, realized outcome) ≈ **−0.002 to −0.07** (Task 104, reproduced in Task 105 Phase 6).
- Net win rate by confidence bucket never recovers positive expectancy in any bucket (`task105_confidence_failure_analysis.json`).

## Production decision

**UNRELIABLE** (`task105_confidence_production_decision.json`): no live-served confidence field qualifies as a verified win probability. Actions taken: the `CapitalProtectionNotice` wording states that confidence is a model-agreement indicator; the research-only calibrated P(net>0) is not surfaced as a recommendation. The decision can be revisited only after the Task 105 evidence gates are met on genuinely new forward observations — calibration stability is one of the gates.

Nothing was invented to make buckets monotonic, and Task 104's finding is preserved.
