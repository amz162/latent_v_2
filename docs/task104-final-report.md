# Task 104 — PKR 100,000 Capital-Constrained Portfolio Backtest, All-Model Accuracy Audit, Confidence Calibration & Three-Strategy ROI Analysis

*Generated 2026-11-02 · Task 104 of the Latent.pk PSX platform campaign · evidence class: `development_only` (all final-test periods were consumed by Tasks 100–102)*

## The answer in one paragraph

A PKR 100,000 account following the current production signals would have lost money under **every one of the 60 tested configurations** (3 production strategies × 10 cash-constrained sizing policies × filtered/unfiltered), ending between **PKR 8,796 (−91.2%) and PKR 474 (−99.5%)** over 2016-10 → 2026-10. This is not a sizing problem and not a filtering problem: the average trade is negative *before* costs (≈ −0.7% to −1.0% of notional gross), real PSX costs then add roughly another 0.5–0.7% per trade (cost drag 92–233% of gross loss), and win rates of 35–51% cannot survive an average loss that is 1.5–3× the average win. No configuration demonstrates positive net performance after actual `psx_user_schedule_v2` costs.

## Method (why these numbers are trustworthy)

- **Reconstruction, not approximation.** All 11,521 historical label trades × 3 strategies (`fixed_first_hit`, `max_tp_step_trailing`, `scale_out_50_25_25`) were re-executed through the **unchanged production engine** (`strategy-engine.ts`, SL-first gap-aware, 21-session horizon) with `computeTradeCostsV2`. Every record reconciles with the frozen Task 102 labels within PKR 0.01 (`task104_reconciliation.json`).
- **Account-level ledger.** The simulator (`scripts/task104_portfolio_sim.ts`) maintains cash, invested capital, open positions, realized/unrealized P/L, fees/taxes/slippage, daily mark-to-market equity, peak, drawdown, exposure and cash utilization. No leverage, no negative cash, whole shares only, cash reused only after leg exits, exits processed before same-session entries. The production engine runs **at the actual accepted size** of every accepted trade, so costs and scale-out legs are exact at that size.
- **Probabilities reproduced, not invented.** Per-sample model probabilities come from re-running the persisted Task 101 frozen protocol (same features, split, scaler, RandomForest, isotonic-on-validation). The q70 threshold reproduces Task 101's 0.4282 **exactly**; AUC/Brier land within tolerance of the Task 101/102 reports and the deltas are disclosed (`task104_reconciliation.json`).
- Ledger identity (`initial + realized + unrealized = final equity`) verified across all 60 scenarios; prior-task artifacts untouched (git-checked).

## Q2/Q3 — Ending balances, ROI, drawdown, win rate (identical historical signals, cash-constrained)

Representative endings (full 60-row table in `task104_positive_net_scan.json`):

| Sizing (PKR 100,000 start) | fixed_first_hit | max_tp_step_trailing | scale_out_50_25_25 |
| --- | --- | --- | --- |
| Equal, max 3 positions | PKR 474 | PKR 777 (filtered) | ~PKR 1–2k |
| Fixed 10% of equity | ~PKR 1–3k | ~PKR 2–4k | ~PKR 1–2k |
| Risk 0.5% at stop | PKR 8,722 / 8,796 (filtered) | ~PKR 2–3k | PKR 5,901 / 6,435 (filtered) |

ROI range **−91.2% to −99.5%**; max drawdowns **−92% to −99.7%**; win rates 35–51%. Tighter risk sizing loses *slowest* (C_r0_5 is best-in-class); loose concurrency (A_eq3) compounds concurrent losers fastest. The best strategy is the *simplest* one (`fixed_first_hit`) simply because it takes fewer holding-day overlaps — not because its signals are better.

## Q4 — Which models have genuinely comparable accuracy?

On the one cross-model metric (directional accuracy, Task 100 frozen protocol), the best of nine classical models is **ElasticNet at 52.23% (5-day) / 51.78% (21-day)** with negative R². Task 99's LSTM and CNN-LSTM did not beat the zero-return baseline. The Task 101/102 shadow rule reaches test AUC 0.5268 (reproduced) / 0.5373 (reported) — weak discrimination. **No model is reliably above coin-flip accuracy, and none is promotable.**

## Q5/Q6 — Confidence scores and whether they mean anything

Models output calibrated P(net>0) ∈ [0,1] (isotonic on validation). Validation q70 thresholds: 0.2672 / 0.4282 / 0.3591 (fixed_first_hit / max_tp_step_trailing / scale_out). Reliability tables (`task104_calibration_analysis.json`): monotone *in validation by construction*; **out-of-sample the confidence→win-rate relationship collapses** — Spearman(confidence, realized outcome) on the final test is −0.002 (max_tp_step_trailing) and −0.071 (fixed_first_hit). Higher confidence does **not** reliably correspond to higher realized win rates.

## Q7 — Filtered vs unfiltered

Label-level, the filter does what it was designed to do: final-test expectancy on `max_tp_step_trailing` improves from −0.650% to −0.531% (win rate 55.4% → 56.3%). Portfolio-level it improves 29 of 30 scenarios by a mean of just +0.39 percentage points of ROI — from about −95% to about −94.6%. **A filter on a negative-expectancy signal stream can only slow the bleed, never reverse it.**

## Q8 — Where the loss comes from

1. **Signal quality (primary):** mean gross P/L per trade is negative (≈ −PKR 700 to −1,000 per PKR 100k notional). Zero-friction trading still loses.
2. **Costs (second, large):** PKR 15.7M+ total costs across 34,563 reference trades; cost drag 92.6% of gross loss on validation, 232.8% on final test — losses are more than doubled by friction once gross edge is near zero.
3. **Win/loss asymmetry:** `max_tp_step_trailing` wins ~50% of trades yet has a profit factor of ~0.85 — the average loser is much larger than the average winner.
4. **Sizing/overlap:** sizing sets the *speed* of destruction (per-trade expectancy −1.2% at any notional compounds toward zero under any fixed-fraction policy); cash-constrained overlap compounds concurrent losers — visible as A_eq3/B_25 being worst and C_r0_5 least bad.

## Q9 — Anything positive after real costs?

**No.** 0 of 60 configurations positive; the best (−91.2%) still loses 91% of capital.

## Caveats

`development_only` evidence; no verified dividends in the ledger (none verified — recorded as zero, never invented); daily-bar execution realism (no intraday data exists); reproduced probabilities self-consistent with Task 101 and disclosed against Task 102's drift.

## Artifacts

`data/backtest_reports/task104/`: `task104_source_inventory.json`, `task104_reconciliation.json`, `task104_engine_recon.json`, `task104_probabilities.json`, `task104_portfolio_results.json` (60 scenarios + 5-day equity curves), `task104_model_accuracy_audit.json`, `task104_calibration_analysis.json`, `task104_filtered_vs_unfiltered.json`, `task104_loss_attribution.json`, `task104_positive_net_scan.json`, `task104_final_summary.json`. Scripts: `scripts/task104_recon.ts`, `task104_reconcile.py`, `task104_probs.py`, `task104_portfolio_sim.ts`, `task104_analysis.py`, `task104_tests.py` (26 checks).
