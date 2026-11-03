# Task 109 — Model Evidence Policy

## What counts as forward evidence

Only **prospectively generated** observations enter the forward campaign: the 57
frozen decisions (3 weekly cohorts) tracked against delayed market observations.
Task 100–104 backtests remain `development_only` and are never reused as
unseen test observations. Nothing is trained, calibrated, tuned or optimized on
forward observations — the protocol is frozen
(`task104-frozen-protocol-repro`, weights, thresholds, feature schema unchanged).

## Metric definitions (kept strictly separate)

1. Directional correctness — predicted direction vs realized session move.
2. Positive forward stock return — raw return, no strategy rules.
3. Positive completed position — a matured strategy outcome with net P&L > 0.
4. TP-before-SL outcome — **not claimable at current resolution** (delayed
   snapshots + daily bars cannot order intraperiod touches).
5. Net-positive completed trade — after `computeTradeCostsV2`.
6. Ensemble agreement — an **agreement indicator**, not a probability.
7. Calibrated probability — isotonic fitted on the **validation partition
   only**; OOS calibration is NOT established, so no number is presented as a
   verified win probability.
8. Unrealized MTM — an estimate of open exposure; never realized P&L, never a
   win.

## Current evidence gate

| Gate | State |
|---|---|
| Forward net result | **negative** (−PKR 102,348.02 over 43 completed outcomes; win rate 30.2 %) |
| Sample size | insufficient (3 cohorts; 5/10/21-session completion awaits future sessions) |
| Confidence association | none established (`insufficient_evidence`) |
| Promotion gate | **BLOCKED — models remain `not_promotable`** |
| Decision | `collecting` (accrual continues; no promotion path opened) |

## Rules this policy enforces

- No model is promoted automatically or on a small positive sample.
- Negative results are reported as-is; nothing is re-tuned to look profitable.
- Skipped tests are never counted as passing.
- Any future promotion review requires ≥21 completed sessions across cohorts
  with non-negative net expectancy AND a measured in-session delay
  distribution — both currently absent.

The objective of this campaign is to establish whether a genuine edge exists,
not to make a negative strategy look profitable.
