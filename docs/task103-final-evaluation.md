# Task 103 — Final Evaluation

The consolidated, honest answer of the Task 103 campaign. Historical evidence is explicitly labeled; nothing was re-optimized or re-run without cause.

## 1. Prediction quality (historical evidence, Task 101/102)

No model beats the zero-return baseline and no model beats the training-only mean baseline. Per-stock ARIMA(1,0,0) reached MAE 0.0982 vs 0.0853 for the zero-return baseline on the Task 101 protocol. Matched-sample feature ablations (Task 102) showed every implementable group — market regime (proxy), liquidity, corporate-action flags, combined verified — within noise of technical-only (expectancy ±0.006%, AUC ±0.0024, MAE ±0.0019). Task 103 acquired **no new verified data**, so no new ablation was scientifically possible; the governing evidence stands unchanged.

## 2. Trading quality (historical evidence, identical signals and costs)

- All-trades fixed-first-hit final test: expectancy **−0.583%/trade** (win 42.5%, profit factor 0.843).
- Best frozen shadow rule (RandomForest q70 filter): **−0.529%** vs −0.650% unfiltered — loss reduction, still net-negative.
- NON-ATL tax profile is worse: −4.73M vs −2.32M PKR.
- Date-block bootstrap CI95 for all-trades expectancy: **[−1.378%, +0.355%]** over 237 unique decision dates (not independent) — zero cannot be excluded.

## 3. Cost parity (re-verified in Task 103)

`bun scripts/task103_parity.ts`: **33/33 fixtures pass** in the Task 103 namespace — simulator/engine parity within PKR 0.01, no double-charging, no missing fees, CGT zero on non-positive gross, ATL/NON-ATL exact, scale-out legs exact, `psx_user_schedule_v2` default, `legacy_flat_v1` explicit-compatibility only.

## 4. Label reconciliation (re-verified)

The production label engine was reconciled in Task 102 (11,521/11,521 IDENTICAL, max deviation PKR 0.00). Task 103 re-verified the stored label files by checksum: the Task 101 and Task 102 label files are byte-identical today. Exit semantics, cost pathway (`computeSimTradeCosts` → `computeTradeCostsV2`), maturity rules and preserved fields (net outcome, TP-before-SL, MFE/MAE, TP1-3, stop probability, expectancy, duration, costs, maturity) are unchanged. No new label dataset was created — no new verified features justify one.

## 5. Promotion decision

**`not_promotable` — production selection unchanged.** Gates fail on: no untouched out-of-sample period, negative net expectancy after real costs, and no multi-regime forward evidence. `psx_cost_aware_trade_classifier` and `psx_net_expectancy_meta_model` remain `shadow_only`.

## 6. What would change the answer

1. Genuine KSE-100/EOD import → verified index features + real regime detection.
2. Statement-level publication timestamps → PIT fundamentals enabled and ablated on matched samples.
3. Verified corporate-action registry → adjusted/total-return series and clean event handling.
4. Genuine intraday history → real execution realism beyond the daily-OHLC approximation.
5. New sessions after 2026-10-29 → the frozen forward-validation process finally has material.

Until then, the honest report is: **no demonstrated edge, system ready to evaluate one lawfully the moment the data exists.**
