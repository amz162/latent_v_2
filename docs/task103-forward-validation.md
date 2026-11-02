# Task 103 — Forward Validation Protocol

Strict forward validation on genuinely new observations — the only remaining path to a promotion decision.

## 1. Why nothing historical can be reused

Task 100 (400-sample walk-forward), Task 101 (3,978 final-test trades) and Task 102 (same period, deeper features) have all *examined* their final-test periods. Those windows are consumed as untouched evidence. Task 103 re-verified that the latest database session is **2026-10-29** and that no licensed feed exists, so the forward-validation state is:

```
status: awaiting_data   forward_decisions: 0   forward_trades_matured: 0
state machine: collecting → insufficient_matured_trades → awaiting_data → not_yet_evaluable
```

A later script run does **not** turn the last DB date into an untouched test date — only genuinely new ingested sessions count.

## 2. The frozen protocol (unchanged from here on)

| Component | Frozen value |
| --- | --- |
| Feature definitions | `task103_lib.FEATURE_GROUPS` (verified-only groups enabled) |
| Models | Task 101 frozen rule: RandomForest, `max_tp_step_trailing`, q70 threshold — shadow-only |
| Calibration | isotonic, fit on validation only |
| Thresholds | validation quantiles, frozen before final test |
| Selection | max validation expectancy with coverage ≥ 30; NO TRADE otherwise |
| Costs | `computeTradeCostsV2`, default `psx_user_schedule_v2` (ATL 15% / NON-ATL 30% profiles) |
| Exits | existing semantics (SL-first, gap-aware, scale-out legs) |
| Universe | point-in-time membership by observation window (security master) |

## 3. Per-session forward process

1. Ingest the new session via the onboarding CLI (or a licensed feed).
2. Build features strictly as-of the decision timestamp (`buildFeaturesAsOf`).
3. Generate predictions from the frozen model versions.
4. Record the shadow decision — including the explicit NO TRADE reason when expected value is insufficient. Thresholds are never altered.
5. Record predicted entry / SL / TP and replay actual executions.
6. Mature outcomes only when enough post-exit data exists; unresolved outcomes are never mislabeled.
7. Apply actual costs and compare predictions with realized outcomes.
8. Append immutable, idempotent records (existing paper-trading idempotency guarantees retained).

## 4. Promotion gates (all must pass)

Verified point-in-time inputs · leakage-free evaluation · genuine new out-of-sample observations · positive net expectancy after real costs · sufficient matured outcomes · more than one meaningful market regime · stable across symbols/sectors · acceptable drawdown · reliable calibration · reproducibility · all quality gates. **Best-among-negative models are never promoted.** Until every gate passes, the production model/consensus stays unchanged and the Task 101 models remain `shadow_only`.

## 5. Activation checklist

- [ ] Official KSE-100/EOD export imported (`--type kse100` / `--type psx_eod`) → contract flips to `verified_index` automatically
- [ ] New sessions present in `OhlcvBar` after 2026-10-29
- [ ] `/api/data-readiness` shows fresh sources
- [ ] Shadow decisions logged per session with NO-TRADE reasons
- [ ] Sufficient matured trades → evaluate against the frozen protocol → report (never optimize on it)
