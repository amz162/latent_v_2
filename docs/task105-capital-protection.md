# Task 105 — Capital Protection

## Policy

`src/lib/latent/trading-policy.ts` (POLICY_VERSION `task105-v1`) is the single source of truth. Defaults:

- **No real trades. No live-order execution.** (No live-order pathway exists anywhere in the application; the policy codifies this so one can never be added implicitly.)
- **No automatic promotion.** Promotion is a human, versioned decision requiring all evidence gates on genuinely new forward observations.
- **Confidence is never presented as a win probability.**
- **Short-sell signals are not presented as tradable** (PSX retail rights unverified).

## States

`research_only` · `shadow_only` · `no_trade` · `insufficient_evidence` · `data_unavailable` · `promoted`

Every model/strategy currently evaluates to `no_trade` with reason `expected_net_value_not_positive` (frozen Task 104 evidence: 0/60 portfolio configurations positive after real PSX costs).

## NO-TRADE reason registry

Ten machine-readable reasons with user-facing wording (see `task105_no_trade_reason_registry.json`): no reliable predictive edge, confidence uncalibrated, expected net value not positive, missing market data, incomplete fundamentals, poor data quality, risk limit reached, portfolio capacity exhausted, model not approved, insufficient historical validation. A NO-TRADE result always explains why.

## UI surface

`CapitalProtectionNotice` (src/components/latent/CapitalProtectionNotice.tsx) is mounted on:

1. AI Model Signals page (above the signal cards and consensus),
2. Investment Strategy page,
3. Portfolio Simulation dialog.

Wording is factual and non-alarmist: research/shadow mode, historical win rates are simulation outcomes, confidence is an agreement indicator, short signals are research displays.

## What is preserved

- All historical signals, backtests and paper-trading results remain browsable.
- Task 103 prospective lifecycle records are untouched.
- The production consensus is unchanged.
- No model was removed from the 58-model registry for performing poorly.

## Reversal condition

A state other than `no_trade` requires the Task 105 evidence gates (`task105_evidence_gate_report.json`) to be met on genuinely new forward observations — at minimum 100 matured trades across ≥2 quarters, ≥15 symbols, >1 regime, positive net expectancy after real costs with CI support, acceptable drawdown, no severe concentration, and calibration stability — followed by an explicit, versioned policy review. Currently 0 of 9 gates are met.
