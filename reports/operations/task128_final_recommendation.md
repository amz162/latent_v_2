# Task 128 — Final Recommendation

**Date:** 2026-11-23 · Synthesis of `task128_final_model_ranking.md`, `task128_final_strategy_ranking.md`, `task128_statistical_notes.md`, `task128_comparison.csv`.

## Verdict

**Nothing in this repository is ready for real-money deployment. Nothing should be promoted to production trading. The paper-trading and shadow-evaluation posture (research_only everywhere) is correct and should continue.**

This is not a hedge — it is the only conclusion the evidence supports:

1. **Forecast skill is absent.** No classical model (task100, n=1995 final-test) beats the zero-return or training-only-mean baseline; every final-test R² is negative; deep models (LSTM/CNN-LSTM) and foundation models (Chronos, Moirai) sit within noise of chance at every horizon.
2. **The only nominal positives are fragile.** Majority Vote at horizon 5 (dir-acc 0.565, CI [0.516, 0.614]) is significant at α=0.05 but marginal under its own Bonferroni correction (33 tests); Random Forest h5 walk-forward (0.595, CI [0.546, 0.642]) carries no family adjustment and is contradicted by the same model's frozen-split result (0.4922). Both are hypotheses for preregistered forward tests — not candidates.
3. **The previously-reported positives fail re-verification as evidence.** fixed_first_hit's +177,740/+83,374 (task78) reproduce to the paisa but are declared retrospective-exploratory by their own artifact, are the "least bad" (−91.2%) in a 10-year compounding scan where 0/60 configurations profit, and the strategy **lost −219,476.14 PKR in the one genuine forward cohort**. RF h21's +99,800 (PF 2.142) is an unadjusted best-of-45 exploratory cell with below-chance directional accuracy in the same artifact.
4. **Four independent forward cohorts all lost money**: gen1 −75,548 (4 matured, all SL), task109 −102,348 (43 matured), Task 123/125 −707,371 (78 closed, 10W/68L, verified to the paisa), plus task104's 0/60 compounding scan. Costs are not the villain: gross P&L is negative before them.
5. **The only positive configuration is buy-and-hold** (+17.5%/+23.5%/+30.9% with costs) — the market, not an edge — and every active strategy, ML or technical (Golden Cross −39.28%), fails to beat it and cash.

## Recommended actions (in order)

1. **Keep research_only enforcement exactly as is** (Task 126 verified it at store, ledger, and decision layers; the Task 127 monitor tests it). Do not wire GLM or any model to fills.
2. **Disable candidates (owner decision, unchanged from the audit, now re-confirmed):** `scale_out_50_25_25` exits (negative in every cohort; −238,584 forward including the corrected −4,047.99 defect adjustment) and Ridge Regression signals (worst trading cells; no forecast edge). Keep `fixed_first_hit` and `max_tp_step_trailing` running in shadow only for cohort continuity — they are evidence generators, not income.
3. **Preregister, then forward-test at most two hypotheses** on untouched sessions, with thresholds fixed in advance and the Task 127 monitor watching: (a) Majority Vote h5 directional accuracy ≥ 0.52 over a pre-declared session count; (b) RF h5 direction ≥ 0.55. If either fails, retire it.
4. **Close the production-contract gap first** (Task 124): without the 17:30 PKT executor there is no forward data pipeline, and without that there are no forward cohorts to test anything on. The single highest-value action in this repository is operational, not statistical.
5. **Fix the documented measurement gaps before the next evaluation cycle:** per-strategy 0.50%-slippage sensitivity, a buy-and-hold benchmark inside the paired ML cohort, an equity-curve recorder for the paper books (which unlocks risk-adjusted metrics honestly), and calendar dates (not just ratios) in the task100 split protocol.
6. **Rotate the GH credential and purge history** as already flagged in Task 123's operator list.

## What this task changed and did not change

Changed: verification status of every pivotal prior claim (all re-verified from artifacts, four independently recomputed), the premature-closure engine gate (Task 125, forward-only), evidence-package verifiability (Task 126, forward-only), and the monitoring/alerting layer (Task 127). **Not changed:** any historical trade, fill, price, timestamp, or P&L record; any model or strategy configuration; any promotion decision (there was nothing promotable to promote).
