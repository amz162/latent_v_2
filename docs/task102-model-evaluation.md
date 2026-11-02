# Task 102 — Model Evaluation and Validation Protocol

## 1. Strict chronological validation — `development_only`

The Task 100/101 final-test window is the most recent data in the database and has already been
inspected and used. **No genuinely untouched historical period remains** (the DB ends
2026-10-29, inside/adjacent to that window). Therefore every Task 102 result carries the
explicit disposition **`development_only`**: the frozen protocol is unchanged (50/15/35
chronological split, 21-session maturity purge, train-only scalers/imputation, validation-only
isotonic calibration and q70 thresholds), the final test is evaluated once, and all future
sessions are reserved for prospective shadow validation. Row counts are never presented as
independent experiments: the label cohort has 11,521 rows but only ~237 unique decision dates
in the final-test window, and date-block bootstrap (21-session blocks) is used for intervals.

## 2. Label reconciliation (production engine as source of truth)

Task 102 re-ran the unchanged production label engine (`strategy-engine.ts` +
`computeTradeCostsV2`) on the same frozen grid: **11,521/11,521 labels reconcile IDENTICAL to
Task 101 (max deviation PKR 0.00)** — see `task102_trade_label_integrity.json`. Task 101
artifacts were not touched; the new dataset lives in `task102/trade_outcome_labels/`.

## 3. Incremental feature value (matched samples, frozen protocol)

Question: do verified non-technical sources add value beyond technical features? Groups were
evaluated on identical rows (no coverage confound); deltas vs `technical_only_v1`:

| Group | Δ final-test expectancy (RF, fixed_first_hit) | Δ AUC (test) | Δ LightGBM 21d MAE |
| --- | --- | --- | --- |
| + market regime (internal proxy) | +0.0000% | +0.0017 | −0.000697 |
| + liquidity | −0.0061% | +0.0024 | −0.001858 |
| + corporate-action flags | −0.0057% | +0.0020 | +0.000000 |
| combined verified | −0.0054% | +0.0024 | −0.001553 |
| + PIT fundamentals | **disabled** — no verified publication timestamps | | |

Every delta is inside noise: **no feature group adds defensible predictive or trading value**.
KSE-100 features could not be tested (source blocked) and are reported as such, not simulated.

## 4. Trading outcomes (final-test cohort, V2 costs, ATL_15)

All-trades, fixed_first_hit: 3,978 trades, net PKR −2,318,763 (gross +2,796,120 − costs
5,114,883), **net expectancy −0.583% of notional per trade**, win rate 42.5%, profit factor
0.843, avg hold 10.2 sessions. NON-ATL_30 sensitivity: net falls to −4,727,202 PKR (extra CGT
2,408,439). Date-block bootstrap CI95 for all-trades expectancy: **[−1.378%, +0.355%]** — zero
is inside the interval; nothing here is distinguishable from a negative-EV coin toss.

Best frozen shadow rule (RandomForest / max_tp_step_trailing / q70, thresholds frozen on
validation): final-test expectancy **−0.529%/trade vs −0.650% unfiltered** — an improvement of
~0.12%/trade, still clearly net-negative. The improvement is consistent with Task 101's
−0.526% vs −0.650% and does not change the verdict.

## 5. Baselines and blocked families

No model beats the zero-return MAE baseline (LightGBM 21d MAE ≈ 0.0856 vs 0.0853 zero-return
on the combined group) — consistent with Tasks 99/100/101. Deep/foundation families
(PatchTST, N-BEATS, TimesNet, Informer, LSTM/GRU/CNN-LSTM, TabNet, Chronos, Lag-Llama,
Moirai), Prophet, GARCH and Kalman remain blocked with unchanged reasons (resource limit /
packages unavailable); CatBoost/ElasticNet/Huber were not rerun this task (documented rather
than silently skipped). No aliases were counted as implementations.

## 6. Promotion decision

The promotion gates fail on the two decisive criteria: (a) no untouched out-of-sample period,
(b) net expectancy remains negative after real costs. **No model is promoted.**
`psx_cost_aware_trade_classifier` and `psx_net_expectancy_meta_model` stay **shadow-only** /
research-only; the production consensus is unchanged. Best-among-negatives is not promotable.

**Final disposition: `completed_with_limitations` — outcome C (no demonstrated improvement):
the verified new data sources could not be obtained, and the implementable groups add nothing
measurable. The honest deliverable is the disciplined negative result plus the ready-to-run
adapters for the day the data access exists.**
