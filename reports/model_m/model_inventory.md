# Model Inventory — Verified Reconciliation (Task 129 Phase 0)

Generated: 2026-11-23T22:27:14Z · Repository: latent_v_2 · Database: db/custom.db (read-only audit)

## 1. What does "52 models" actually mean?

The string "52 models" appears nowhere in the repository. The number is an
**arithmetic fact of the model registry**: `src/lib/latent/ensemble.ts`
(`ALL_MODELS`) contains **58 canonical entries, of which 52 carry
`trained: true`**. Those 52 include **17 rule-based engines**
(GM 4-pillar, X 10-strategy, GIAN 3 S/R) that were never trained on anything —
the flag is used as a UI visibility marker, not as evidence of training.

## 2. Verified counts

| Category | Count | Evidence basis |
|---|---|---|
| Canonical registry entries | 58 | parsed from ensemble.ts |
| Registry entries flagged `trained:true` | 52 | parsed from ensemble.ts |
| Registry entries flagged `trained:false` | 6 | parsed from ensemble.ts |
| **Genuinely trained-ML entries** | 35 | classification (T1/T3/T4/CL/CL-2/PI/CG tiers) |
| — unique ML implementations | 31 | 4 " (CL)" entries are duplicate aliases |
| — duplicate alias entries | 4 | XGBoost (CL), LightGBM (CL), Random Forest (CL), LSTM (CL) |
| Rule-based strategy entries (not ML) | 17 | GM/X/GIAN tiers, deterministic code |
| Foundation models requiring external weights | 4 | Chronos, Lag-Llama, Moirai, Time-LLM |
| Untrained placeholders | 2 | TabNet (status conflict), FinGPT |
| Runtime model keys | 65 | model-backtest.ts (incl. 10 un-suffixed X duplicates) |
| Ensemble aggregators | 13 | A–M ensemble methods |
| Models with task84 OOS-evaluated status | 34 | task84_metrics.json |
| **Models with verified positive OOS skill** | **0** | task128 final ranking |

## 3. Claim sources reconciled

| claim | location |
|---|---|
| 58 canonical / 9 supplemental / 67 unique | README.md:31 |
| 65-model ensemble across 10 tiers (stale) | README.md:47,115,186 |
| 52 trained | src/lib/latent/ensemble.ts — 52 of 58 ALL_MODELS entries have trained:true |
| 36 models per stock (per-stock trainable tier) | scripts/force_train_all_fast.py:4,62,64,74 |
| registry 58 canonical / 13 supplemental / 71 unique | worklog.md:4505 (Task 101) |

## 4. Runtime truth (critical)

src/lib/latent/fallback-predictions.ts:strategyConfigFor() maps EVERY model key to one of 12 deterministic indicator families (seeded mulberry32 thresholds); strategySignal() produces the runtime signal

**Implication:** at request time the application does not run model weights for
any of the 65 keys; every key is served by the deterministic strategy engine.
Trained parameters are exercised offline (walk-forward backtests, prospective
paper-trading cohorts), not in live inference. "Inference operational" in the
table below therefore means *the runtime strategy path serves this key*.

## 5. Per-model inventory

| Tier | Model | Class | trained flag | task84 status | In per-stock store |
|---|---|---|---|---|---|
| TIER_1 | PatchTST | trained_ml | True | unknown | True |
| TIER_1 | N-BEATS | trained_ml | True | trained_oos_evaluated | True |
| TIER_1 | TimesNet | trained_ml | True | trained_oos_evaluated | True |
| TIER_1 | Informer | trained_ml | True | trained_oos_evaluated | True |
| TIER_2 | Chronos (Amazon) | foundation_blocked | False | dependency_blocked_after_attempts | True |
| TIER_2 | Lag-Llama | foundation_blocked | False | dependency_blocked_after_attempts | True |
| TIER_2 | Moirai (Salesforce) | foundation_blocked | False | dependency_blocked_after_attempts | True |
| TIER_2 | Time-LLM | foundation_blocked | False | dependency_blocked_after_attempts | True |
| TIER_3 | XGBoost | trained_ml | True | unknown | True |
| TIER_3 | LightGBM | trained_ml | True | unknown | True |
| TIER_3 | CatBoost | trained_ml | True | unknown | True |
| TIER_3 | Random Forest | trained_ml | True | unknown | True |
| TIER_3 | LSTM | trained_ml | True | trained_oos_evaluated | True |
| TIER_4 | CNN-LSTM | trained_ml | True | trained_oos_evaluated | True |
| TIER_4 | Transformer-LSTM | trained_ml | True | unknown | True |
| TIER_4 | TabNet | untrained_placeholder | False | trained_oos_evaluated | False |
| TIER_4 | FinGPT | untrained_placeholder | False | dependency_blocked_after_attempts | False |
| TIER_CL | ARIMA | trained_ml | True | failed_after_attempts | True |
| TIER_CL | Holt-Winters | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL | GARCH | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL | Ridge Regression | trained_ml | True | unknown | True |
| TIER_CL | Kalman Filter | trained_ml | True | unknown | True |
| TIER_CL | Prophet | trained_ml | True | failed_after_attempts | True |
| TIER_CL | GRU | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL | XGBoost (CL) | trained_ml | True | duplicate_alias_reused | True |
| TIER_CL | LightGBM (CL) | trained_ml | True | duplicate_alias_reused | True |
| TIER_CL | Random Forest (CL) | trained_ml | True | duplicate_alias_reused | True |
| TIER_CL | LSTM (CL) | trained_ml | True | duplicate_alias_reused | False |
| TIER_CL_2 | LightGBM-A (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL_2 | LightGBM-B (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL_2 | HistGBM (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL_2 | ExtraTrees (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL_2 | RandomForest (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL_2 | Logistic (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CL_2 | MLP (CL-2) | trained_ml | True | trained_oos_evaluated | True |
| TIER_PI | Linear Regression (PI) | trained_ml | True | trained_oos_evaluated | True |
| TIER_PI | Logistic Regression (PI) | trained_ml | True | unknown | True |
| TIER_PI | Pattern Matcher KNN (PI) | trained_ml | True | trained_oos_evaluated | True |
| TIER_PI | Neural Network (PI) | trained_ml | True | trained_oos_evaluated | True |
| TIER_GM | Technical Engine (GM) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_GM | Announcements Engine (GM) | rule_based_engine | True | data_blocked | True |
| TIER_GM | Fundamental Engine (GM) | rule_based_engine | True | data_blocked | True |
| TIER_GM | Macro Engine (GM) | rule_based_engine | True | data_blocked | True |
| TIER_CG | LightGBM (CG) | trained_ml | True | trained_oos_evaluated | True |
| TIER_CG | XGBoost (CG) | trained_ml | True | trained_oos_evaluated | True |
| TIER_X | Trend Multi-TF (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | Breakout RelVol (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | Trend Pullback (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | RSI Divergence (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | BB Mean Reversion (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | Vol Contraction (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | Relative Strength (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | Market Regime (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_X | Meta-Label CG (X) | rule_based_meta | True | data_blocked | True |
| TIER_X | Triple Barrier Dyn (X) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_GIAN | Gian-Ensemble (GIAN) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_GIAN | Gian-Extender (GIAN-EXT) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |
| TIER_GIAN | M-Ensemble (M) | rule_based_engine | True | rule_based_optimized_oos_evaluated | True |

## 6. Training artifacts verified on disk

| Artifact | Belongs to | Bytes |
|---|---|---|
| models/xgboost_signal.json | serialized XGBoost binary (trained_at 2026-10-02T01:23:49.523161, ? rows, ROC AUC 0.4022021070584682) | 25376 |
| data/ml_predictions_multi.json | per-stock parameters + predictions for 65 keys, 908 stocks | 14722716 |
| data/cl2_cache/calib.pkl + data/pi_cache/calib.pkl | CL-2 / PI calibrators | 989 / 965 |
| data/backtest_reports/task79_models/*.joblib (15 files) | ExtraTrees, HistGBM, ElasticNet, Huber, SVR × horizons (beyond registry) | — |
| data/backtest_reports/task99/checkpoints/*.pt (3 files) | reference LSTM / CNN-LSTM checkpoints | — |
| data/walk_forward_backtesting.json | walk-forward OOS for 5 baselines | 9727 |

## 7. Out-of-sample evaluation (verified)

- Walk-forward (400 samples, 2023-04-17 → 2026-07-23): Random Forest h5
  direction-accuracy **0.595 CI [0.546, 0.642]** — the only CI excluding 50%;
  CatBoost 0.580, XGBoost 0.568; **all R² < 0** at every horizon.
- Task 128 final ranking (2026-11-23): **no classical model beats the
  zero-return baseline**; the best majority-vote h5 accuracy 0.565 CI
  [0.516, 0.614] is marginal after multiple-comparison correction; the
  "RF +99,800 PKR / PF 2.142" cell is declared EXPLORATORY post-hoc
  best-cell, not a research candidate.
- GLM-4.6 cohort: 0 matured outcomes → excluded from rankings.

## 8. Database state (read-only audit, 2026-11-23T22:27:14Z)

| Metric | Value |
|---|---|
| file | db/custom.db |
| ohlcv_rows | 1043209 |
| ohlcv_min_date | 2016-10-21 |
| ohlcv_max_date | 2026-11-23 |
| ohlcv_symbols | 909 |
| duplicate_symbol_date_pairs | 0 |
| model_prediction_cache_rows | 8 |
| model_backtest_cache_rows | 0 |
| prediction_history_rows | 375 |
| prediction_outcome_rows | 375 |
| prospective_paper_trades | 114 |
| paper_trade_legs | 86 |

## 9. GLM-4.6 classification

GLM-4.6 is the **LLM analyst / inference engine** behind the research-only
signal pipeline (z-ai-web-dev-sdk). It is not a trained PSX forecasting model,
has no training artifacts, no fine-tuning, and **0 matured outcome rows** —
it is excluded from every model count in this inventory.

## 10. Known limitations

- Runtime predictions for every model key are deterministic indicator strategies (fallback-predictions.ts), so 'inference operational' does not imply model-weight inference.
- The trained:true registry flag is set for 17 rule-based entries (GM 4, X 10, GIAN 3) — these are NOT trained models.
- task84 marks TabNet as evaluated while the registry and training store both list it untrained — status conflict; no reproducible artifact was found.
- Only serialized ML artifacts are xgboost_signal.json, 15 task79 joblibs (models beyond this registry) and 3 task99 PyTorch reference checkpoints; per-stock parameters for the 65 keys live only inside ml_predictions_multi.json.
- No model has verified positive out-of-sample skill after costs; task128 ranks everything at or below the zero-return baseline.
- GLM-4.6 has 0 matured outcome rows — its cohort is still pending; it must not be counted as a forecasting model.

## 11. Bottom line

**Of the claimed 52 trained models: 35 are genuinely trained-ML registry
entries (31 unique implementations after removing 4 duplicate aliases),
17 are deterministic rule engines mis-flagged as trained, and the remaining
registry entries (6) are foundation-model dependencies or
placeholders. Verified out-of-sample evidence shows no model with a positive,
post-cost, promotable edge; the honest headline is that the platform's
forecasting value remains unproven, and all runtime "model" output is
deterministic strategy logic.**
