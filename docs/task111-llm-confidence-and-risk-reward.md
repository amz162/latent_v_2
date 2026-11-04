# Task 111 — LLM Confidence Semantics and Deterministic Risk/Reward

## Four numbers that never share a meaning

1. **`llm_conviction_score` (0-100)** — the model's own, uncalibrated conviction in its thesis. UI label: "LLM conviction —
   uncalibrated". It is NOT a win probability; 80/100 never means 80%.
2. **`evidence_quality_score` (0-100)** — deterministic, computed by `computeEvidenceQuality` (weights: source
   verification 20, PIT availability 8, completeness 20, freshness 15, financial-history coverage 10, news corroboration 7,
   technical quality 10, pattern confirmation 5, cross-source consistency 5). The LLM cannot set it; missing/unverified
   data strictly reduces it.
3. **`calibrated_net_positive_probability`** — always `null` until the forward generation has ≥100 genuinely matured
   outcomes over ≥2 quarters; validation-only calibration then an independent forward check.
4. **Historical realized win rate** — realized trade statistics, never mixed with the fields above.

## Deterministic entry / stop / targets / net R:R (Phase 12)

- Levels come from the platform's own policy (`risk-levels.ts`, `atr14-1.5-1-2-3`): entry reference = last completed
  close, SL = entry − 1.5×ATR14 (may be tightened — never loosened — by a verified support zone), TP1/2/3 = entry +
  1/2/3×ATR14.
- Execution semantics: signal after a completed session; the next session's open is the hypothetical entry reference.
  Delayed snapshots are labeled `delayed_observation_shadow` and never backdated.
- **Net** R:R per target: whole-share position (20% of PKR 100,000 reference), every leg priced through
  `computeTradeCostsV2` (psx_user_schedule_v2: brokerage + PSX + NCCPL + CDC + slippage + CGT; nothing double-counted).
- Zero/negative/unavailable risk denominator ⇒ ratio `unavailable` and the setup is invalid.
- Predeclared minimum-R:R thresholds {1.0, 1.5, 2.0} — evaluated as a family, never tuned on the final test.
- NO_TRADE triggers: no valid entry/stop, unsupported targets, R:R below threshold, stale data, fundamentals not
  PIT-safe for the thesis, required news unavailable, technical/fundamental conflict, inadequate evidence quality,
  capital-protection rejection. The LLM cannot relax any rule; a research BUY that fails the deterministic gate is
  downgraded to NO_TRADE with the reason recorded.

Artifacts: `task111_llm_trade_levels.json`, `task111_risk_reward_validation.json`,
`task111_cost_inclusive_reward_risk.csv`, `task111_no_trade_decision_report.json`.
