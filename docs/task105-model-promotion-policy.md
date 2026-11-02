# Task 105 — Model Promotion Policy

## Current status: nothing promotable

Every model and strategy in the registry is **`not_promotable`**. Frozen evidence:

- Task 104: 0 of 60 capital-constrained portfolio configurations positive after actual `psx_user_schedule_v2` costs (best −91.2%).
- Task 105 Phase 4: 67 of 69 FDR-corrected subgroup tests significantly negative; none positive.
- Task 105 Phase 5: cash dominates every strategy, selection rule and filter; model ranking barely exceeds random (AUC 0.527).
- Task 105 Phase 6: confidence unreliable out-of-sample.
- Task 105 Phase 9: forward evidence gates 0/9 met.

## Rules

1. **No best-among-negative promotion.** Selecting the least-bad losing configuration is not approval.
2. **No final-test reuse.** Thresholds, filters or reversals may never be chosen using already-inspected final-test results. The contrarian hypothesis is recorded research-only.
3. **New evidence only.** Promotion review requires the forward observation system (namespace `task105-gen1`) to accumulate genuinely new matured trades meeting all nine minimum gates.
4. **Explicit, versioned human decision.** The system never auto-promotes; `evaluatePolicyState` cannot return `promoted`.
5. **Registry completeness.** Poor performers are retained with verified statuses — the registry is historical evidence, not marketing (see `task105_model_registry_audit.json`).

## Gate list (minimum checks)

≥100 matured forward trades · ≥2 calendar quarters · ≥15 independent symbols · >1 market regime · positive net expectancy after real costs · CI supports positive expectancy · acceptable drawdown · no severe concentration · calibration stability. Passing them makes a strategy **eligible for review** — not promoted.

## Audit trail

Every promotion-relevant fact is an artifact under `data/backtest_reports/task105/`, and the policy module (`src/lib/latent/trading-policy.ts`, `task105-v1`) is the executable source of truth. Changing an outcome requires a new policy version plus the artifacts that justify it.
