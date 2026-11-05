# PSX Model & Strategy Performance Report (Task 112)
Generated: 2026-11-05T20:21:48Z · git head b2fd2565 · status: completed

Scope: every model and strategy actually present in repository evidence (Tasks 79-111),
including the GLM-4.6 multi-source LLM analyst. Missing information is marked
**Not available in source evidence**. Historical development, training, validation, final
holdout and prospective-forward results are kept strictly separate.

## Cohort separation (critical)
- The Task 109 general forward cohort's 43 matured outcomes are NOT LLM performance.
- LLM-specific cohort (task111-llm-multisource-gen1): **0 matured outcomes**; probability calibration stays forbidden until >=100 genuine matured LLM outcomes exist.

## Summary comparison

| Model | Methodology | Best available result | Forward matured | Status | Promotion |
| --- | --- | --- | --- | --- | --- |
| PatchTST | Transformer-based time-series | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| N-BEATS | Deep residual stacks | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| TimesNet | 2D variation of 1D time series | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| Informer | Efficient attention | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| Chronos (Amazon) | T5-tokenized foundation | Not available in source evidence | Not available in source evidence | Rejected/unavailable (dependency) | no |
| Lag-Llama | Open-source foundation | Not available in source evidence | Not available in source evidence | Rejected/unavailable (dependency) | no |
| Moirai (Salesforce) | Universal forecasting | Not available in source evidence | Not available in source evidence | Rejected/unavailable (dependency) | no |
| Time-LLM | LLM-reformatted | Not available in source evidence | Not available in source evidence | Rejected/unavailable (dependency) | no |
| XGBoost | Gradient-boosted trees regressor | Not available in source evidence | Not available in source evidence | Trained artifact only — no reliable OOS edge evidence | no |
| LightGBM | Light GBT regressor | Not available in source evidence | Not available in source evidence | Trained artifact only — no reliable OOS edge evidence | no |
| CatBoost | Categorical-boosted regressor | Not available in source evidence | Not available in source evidence | Trained artifact only — no reliable OOS edge evidence | no |
| Random Forest | Decision tree ensemble | Not available in source evidence | Not available in source evidence | Trained artifact only — no reliable OOS edge evidence | no |
| LSTM | LSTM neural net (PyTorch) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| CNN-LSTM | CNN+LSTM hybrid | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| Transformer-LSTM | Transformer+LSTM hybrid | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| TabNet | Attention-based tabular | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| FinGPT | LLM fine-tuned for finance | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| ARIMA | ARIMA classic baseline for daily price series | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Holt-Winters | Exponential smoothing trend/seasonality | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| GARCH | Volatility forecast model | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Ridge Regression | Linear regression on indicators (RSI, MACD, MA, volume) | Not available in source evidence | Not available in source evidence | Trained artifact only — no reliable OOS edge evidence | no |
| Kalman Filter | Real-time state estimation filter | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Prophet | Facebook Prophet trend/seasonality forecasting | Not available in source evidence | Not available in source evidence | Rejected/unavailable (dependency) | no |
| GRU | Small GRU (1-2 layers, daily data) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| XGBoost (CL) | Best accuracy-per-cost (copied from Tier 3) | Not available in source evidence | Not available in source evidence | Duplicate alias — counted once | no |
| LightGBM (CL) | Light GBT (copied from Tier 3) | Not available in source evidence | Not available in source evidence | Duplicate alias — counted once | no |
| Random Forest (CL) | Decision tree ensemble (copied from Tier 3) | Not available in source evidence | Not available in source evidence | Duplicate alias — counted once | no |
| LSTM (CL) | Small LSTM (copied from Tier 3) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (resource) | no |
| LightGBM-A (CL-2) | LightGBM classifier (config A: 100 trees, depth 3) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| LightGBM-B (CL-2) | LightGBM classifier (config B: 60 trees, depth 5) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| HistGBM (CL-2) | sklearn HistGradientBoosting classifier | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| ExtraTrees (CL-2) | ExtraTrees classifier | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| RandomForest (CL-2) | RandomForest classifier | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Logistic (CL-2) | Logistic regression baseline | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| MLP (CL-2) | Small MLP (32-unit hidden layer) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Linear Regression (PI) | Linear regression on 20 indicators (predicts realized 5-day return) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Logistic Regression (PI) | Logistic regression (predicts P(TP1 hit before SL) in 5 days) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Pattern Matcher KNN (PI) | KNN classifier (k=15, distance-weighted) — pattern matching | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Neural Network (PI) | MLPClassifier (64-32 hidden, tanh) — distinct from CL-2's MLP | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Technical Engine (GM) | MA Trend + RSI/MACD + Bollinger Bands + OBV (35% weight) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Announcements Engine (GM) | YoY EPS growth + dividend yield + EPS surprise (30% weight) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Fundamental Engine (GM) | P/E + gross/net margin + interest coverage (20% weight) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Macro Engine (GM) | KSE-100 trend + KIBOR + USD/PKR + Brent (15% weight) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| LightGBM (CG) | LightGBM primary classifier — triple-barrier, 10-day horizon, TP1=1R | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| XGBoost (CG) | XGBoost challenger — same target/horizon as LightGBM (CG) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Trend Multi-TF (X) | Multi-timeframe trend (price > EMA20 > EMA50 > SMA200 + EMA separation > 0.5%) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Breakout RelVol (X) | Breakout + relative volume (close > 20-day high AND vol > 1.5× 50d avg) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Trend Pullback (X) | Trend pullback to EMA20 (price > EMA50, low touches EMA20 within 2%) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| RSI Divergence (X) | RSI bullish divergence (price lower-low + RSI higher-low + RSI<35) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| BB Mean Reversion (X) | Bollinger Band mean reversion (below lower band + range-bound) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Vol Contraction (X) | Volatility contraction-then-expansion (BB width pattern) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Relative Strength (X) | Relative strength (stock 50d return > KSE-100 50d return + 2%) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Market Regime (X) | Market regime filter (KSE-100 50d return > 2% → bull regime) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Meta-Label CG (X) | Meta-label of CG-Ensemble predictions (raw_prob >= 0.55) | Not available in source evidence | Not available in source evidence | Rejected/unavailable (data) | no |
| Triple Barrier Dyn (X) | Triple-barrier dynamic (ATR/price < 5% + price > EMA50 = low-vol uptrend) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Gian-Ensemble (GIAN) | Square-root support/resistance with odd-number rule (BUY near S1/S2/S3, SELL near R1/R2/R3) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| Gian-Extender (GIAN-EXT) | Fixed GANN square-of-9 levels (1, 9, 25, 49, 81, 121, 169, 225, 289, 361, 441, 529, 625, ...) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| M-Ensemble (M) | Historical price-touch S/R with ATR clustering (scan all highs/lows, cluster within 1×ATR, pick top 3) | Not available in source evidence | Not available in source evidence | Rule strategy — not ML | no |
| XGBoost | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.050098, "rmse": 0.075551, "r2": -0.03419, "directional_accuracy": 0.4907} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| LightGBM | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.049738, "rmse": 0.075154, "r2": -0.023351, "directional_accuracy": 0.4892} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| CatBoost | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.050014, "rmse": 0.075384, "r2": -0.029628, "directional_accuracy": 0.4902} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| Random Forest | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.049941, "rmse": 0.075355, "r2": -0.028853, "directional_accuracy": 0.4922} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| Ridge Regression | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.050271, "rmse": 0.075887, "r2": -0.043407, "directional_accuracy": 0.5113} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| ExtraTrees | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.049755, "rmse": 0.075243, "r2": -0.025778, "directional_accuracy": 0.4967} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| HistGradientBoosting | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.050278, "rmse": 0.075545, "r2": -0.034023, "directional_accuracy": 0.4802} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| ElasticNet | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.049479, "rmse": 0.074963, "r2": -0.018154, "directional_accuracy": 0.5223} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| HuberRegressor | classical ML (Task 100 nine-model experiment) | {"n": 1995, "mae": 0.050041, "rmse": 0.076113, "r2": -0.04964, "directional_accuracy": 0.4772} | Not available in source evidence | Research only (no demonstrated reliable positive net edge) | not promotable on current evidence |
| ExtraTrees | classical ML (Task 79 experiment) | Not available in source evidence | Not available in source evidence | Research only (superseded by Task 100 evaluation) | not promotable on current evidence |
| HistGradientBoosting | classical ML (Task 79 experiment) | Not available in source evidence | Not available in source evidence | Research only (superseded by Task 100 evaluation) | not promotable on current evidence |
| ElasticNet | classical ML (Task 79 experiment) | Not available in source evidence | Not available in source evidence | Research only (superseded by Task 100 evaluation) | not promotable on current evidence |
| HuberRegressor | classical ML (Task 79 experiment) | Not available in source evidence | Not available in source evidence | Research only (superseded by Task 100 evaluation) | not promotable on current evidence |
| SVR | classical ML (Task 79 experiment) | Not available in source evidence | Not available in source evidence | Research only (superseded by Task 100 evaluation) | not promotable on current evidence |
| ARIMA | classical time series (statsmodels/prophet) | Not available in source evidence | Not available in source evidence | Research only (OOS-evaluated baselines; no net-edge claim) | not promotable on current evidence |
| Prophet | classical time series (statsmodels/prophet) | Not available in source evidence | Not available in source evidence | Research only (OOS-evaluated baselines; no net-edge claim) | not promotable on current evidence |
| jw_reference_lstm | deep learning (reference implementations) | Not available in source evidence | Not available in source evidence | Research only (reference models; no promotion) | not promotable on current evidence |
| jw_reference_cnn_lstm | deep learning (reference implementations) | Not available in source evidence | Not available in source evidence | Research only (reference models; no promotion) | not promotable on current evidence |
| psx_cost_aware_trade_classifier | cost-aware ML (Tasks 99-103) | Not available in source evidence | Not available in source evidence | Shadow only (frozen cost-aware shadow filter) | not promotable on current evidence |
| psx_net_expectancy_meta_model | cost-aware ML (Tasks 99-103) | Not available in source evidence | Not available in source evidence | Shadow only (frozen cost-aware shadow filter) | not promotable on current evidence |
| golden_cross_7_30_v1 (Golden Cross 7/30 SMA) | technical rule system — NOT ML | {"roi_pct": -39.282, "max_drawdown": -87775.26} | Not available in source evidence | Research only (negative edge after costs) | no |
| task104 portfolio strategies (fixed_first_hit family) | rule/portfolio system — NOT ML | Not available in source evidence | Not available in source evidence | Research only (prospective/shadow) | no |
| volatility-aware overlays (A, B 10/15/20, C) | risk overlay — NOT ML | Not available in source evidence | Not available in source evidence | Research only (predeclared family; 10% target is a hypothesis, not promoted) | no |
| shared strategySignal()/technical-rule implementation + existing ensemble | production technical rules — NOT ML | Not available in source evidence | Not available in source evidence | Existing production research signals (unchanged); never auto-promoted | no (existing state preserved) |
| GLM-4.6 multi-source LLM analyst (z-ai-web-dev-sdk) | LLM (authorized existing provider) | Not available in source evidence | 0 (LLM cohort) | Shadow only (LLM cohort distinct from the general Task 109 cohort) | no |

## Account-level comparison (PKR 100,000, V2 costs, whole shares, no leverage/shorts)

| Strategy | Ending balance | Net ROI | Max DD | Ann. vol | Avg exposure | Turnover | Trades |
| --- | --- | --- | --- | --- | --- | --- | --- |
| golden_cross_baseline | 63298.97 | -36.701% | -87775.26% | Not available in source evidence | Not available in source evidence% | 72.3 | 365 |
| overlay_B_vol_target_10pct | 98594.31 | -1.406% | -23.621% | 6.969 | 19.02% | 21.94 | 430 |
| overlay_B_vol_target_15pct | 94582.7 | -5.417% | -33.656% | 10.372 | 28.41% | 32.974 | 430 |
| overlay_B_vol_target_20pct | 89731.55 | -10.268% | -42.54% | 13.73 | 37.68% | 43.976 | 430 |
| overlay_A_fixed_vol_exposure | 83041.19 | -16.959% | -62.414% | 27.278 | 71.32% | 81.183 | 430 |
| overlay_C_expansion_protection | 83041.19 | -16.959% | -62.414% | 27.278 | 71.32% | 81.183 | 430 |
| cash | 100000.0 | 0.0% | 0.0% | Not available in source evidence | Not available in source evidence% | Not available in source evidence | 0 |
| buy_hold_equal_weight | 123504.28 | 23.504% | None% | Not available in source evidence | Not available in source evidence% | Not available in source evidence | None |

## LLM evidence contribution (availability vs actual citation)

- **technical**: available 0.0% · cited 0.0%
- **financial_fundamental**: available 0.0% · cited 0.0%
- **company_news**: available 0.0% · cited 0.0%
- **national_news**: available 0.0% · cited 0.0%
- **international_news**: available 0.0% · cited 0.0%

> No claim is made that any evidence category improves accuracy without a valid controlled comparison.

## Model inventory dashboard (Task 113 audit)

| Metric | Count |
| --- | --- |
| Total registry entries | 83 |
| Implemented models | 0 |
| Trained on PSX data | 9 |
| Successfully evaluated | 11 |
| Forward shadow models | 3 |
| Rule-based strategies (NOT ML) | 20 |
| Blocked / unavailable | 34 |
| Duplicate / alias entries | 3 |
| Historical experiments | 7 |

> Counts come from actual audit records (task82 registry + task79/98/99/100/101/104/111/112 artifacts + DB). Not 83 trained/operational models; 83 inventory entries with mixed status.

## Forward-validation dashboard (Task 113 audit — by cohort)

Each cohort reconciles internally. **Total positions are NOT total decisions and NOT matured outcomes.**

| Cohort | Obs | Symbols | Mat 5 | Pend 5 | Mat 10 | Pend 10 | Mat 21 | Pend 21 | Term-exits | Pend-MTM | Unfilled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| task105-gen1 | 12 | 12 | 0 | 12 | 0 | 12 | 0 | 12 | 30 | 6 | 0 |
| task106-gen2 | 22 | 22 | 0 | 22 | 0 | 22 | 0 | 22 | 42 | 24 | 0 |
| task107-gen3 | 46 | 23 | 0 | 46 | 0 | 46 | 0 | 46 | 42 | 27 | 23 |
| task111-llm-multisource-gen1 | 23 | 23 | 0 | 23 | 0 | 23 | 0 | 23 | 0 | 0 | 23 |
| task76-77-prospective-db-layer | 375 | 25 | 0 | 375 | 0 | 375 | 0 | 375 | 0 | 0 | 114 |

> 0 horizon-matured outcomes for any cohort. The 43 terminal-early-exits are SL/TP3 exits, NOT 5/10/21-session horizon maturities (earliest 21-session ~2026-12-01). MTM pending is never counted as a win. Cohorts are never added across denominators.

## LLM outcome maturity (Task 113 — isolated from all other cohorts)

- **Matured at 5/10/21 sessions**: 0 / 0 / 0 (zero — decisions are current-date; frontier equals decision as-of).
- **Total real decisions**: 48 · **BUY (current)**: 2.
- **Directional accuracy**: Not available — 0 matured LLM outcomes.
- **Net returns (BUY)**: Not available — 0 matured BUY outcomes.
- **Calibration**: Not available — insufficient matured LLM outcomes.
> Never report an LLM win rate when no valid outcomes are mature. Never use general forward-cohort performance as the LLM's performance.

## Forward-horizon maturity panel (Task 114 — first 5/10/21-session audit)

Market-data frontier: **2026-11-05** · new sessions since 2026-11-03: ["2026-11-04", "2026-11-05"] · engine: task114-maturity-v1 · last maturity processing: 2026-11-05T19:12:09Z

| Cohort | Obs | Symbols | Mat 5 | Pend 5 | Mat 10 | Pend 10 | Mat 21 | Pend 21 | Term-exits (frozen engine) | Pend-MTM | Unfilled | Excluded |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| task105-gen1 | 12 | 12 | 12 | 0 | 0 | 12 | 0 | 12 | 30 | 6 | 0 | 0 |
| task106-gen2 | 22 | 22 | 0 | 22 | 0 | 22 | 0 | 22 | 42 | 24 | 0 | 0 |
| task107-gen3 | 46 | 23 | 0 | 23 | 0 | 23 | 0 | 23 | 42 | 27 | 23 | 0 |
| task111-llm-multisource-gen1 | 23 | 23 | 0 | 23 | 0 | 23 | 0 | 23 | None | None | 0 | 48 |

> Fixed-horizon matured / pending are counted per decision at the Nth session close from entry (entry session = session 1); early SL/TP3 terminal exits are a SEPARATE measurement from the frozen Task 106/107 engine and are NEVER labelled horizon-matured; pending never enters completed statistics; 5/10/21 are computed independently from source bars. All current values are 0 matured — reported honestly.

### LLM-specific maturity (isolated cohort `task111-llm`)

- Genuine universe decisions: 23 across 23 symbols (BUY 2 · HOLD 2 · NO_TRADE 19).
- Excluded records: 48 (23 MOCK_PIPELINE_CHECK + 24 second-pass generation_cache duplicates + 1 stale out-of-universe ENGRO) — never evaluated.
- LLM-policy terminal-exit simulation (SL/TP3, separate from horizons): 1 matured.
- Calibration: Not available — insufficient matured LLM outcomes (minimum 100 genuine matured LLM outcomes; current 0).
- original GLM-4.6 decisions, prompt hash (evidenceHash), evidence as-of, generation timestamp, and source references are preserved untouched in task112/llm_signal_history; this audit reads them and never regenerates or rewrites them

> Idempotency: outcome key `decision_id|hN`, 12 duplicate recomputations (identical, benign), 0 source-bar revisions detected (each auditable, never a silent overwrite).

> **Warning**: Sample size before performance metrics: 0 matured horizon outcomes in every cohort — no win rate, expectancy or profitability may be reported yet (Part H).
> **Warning**: First profitable matured trades (when they eventually arrive) must NOT be read as evidence of edge.

## General forward cohort (NOT LLM)

Observations: 57 · matured: 43 (W13/L30) · pending: 59 · symbols: 23

## Full model profiles

### PatchTST
- **model_family**: Transformer-based time-series
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Transformer-based time-series
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_1
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### N-BEATS
- **model_family**: Deep residual stacks
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Deep residual stacks
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_1
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### TimesNet
- **model_family**: 2D variation of 1D time series
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: 2D variation of 1D time series
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_1
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### Informer
- **model_family**: Efficient attention
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Efficient attention
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_1
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### Chronos (Amazon)
- **model_family**: T5-tokenized foundation
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: T5-tokenized foundation
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Requires chronos-forecasting package
- **current_status_label**: Rejected/unavailable (dependency)
- **promotion_eligibility**: no

### Lag-Llama
- **model_family**: Open-source foundation
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Open-source foundation
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Requires custom repo
- **current_status_label**: Rejected/unavailable (dependency)
- **promotion_eligibility**: no

### Moirai (Salesforce)
- **model_family**: Universal forecasting
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Universal forecasting
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Requires uni2ts
- **current_status_label**: Rejected/unavailable (dependency)
- **promotion_eligibility**: no

### Time-LLM
- **model_family**: LLM-reformatted
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: LLM-reformatted
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Requires LLM pipeline
- **current_status_label**: Rejected/unavailable (dependency)
- **promotion_eligibility**: no

### XGBoost
- **model_family**: Gradient-boosted trees regressor
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Gradient-boosted trees regressor
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_3
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: 375 predictions in PredictionHistory. Artifacts lost in restore but re-trainable. OOS eval available via pilot25 walk-forward.
- **current_status_label**: Trained artifact only — no reliable OOS edge evidence
- **promotion_eligibility**: no

### LightGBM
- **model_family**: Light GBT regressor
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Light GBT regressor
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_3
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: 375 predictions in PredictionHistory. Artifacts lost in restore but re-trainable. OOS eval available via pilot25 walk-forward.
- **current_status_label**: Trained artifact only — no reliable OOS edge evidence
- **promotion_eligibility**: no

### CatBoost
- **model_family**: Categorical-boosted regressor
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Categorical-boosted regressor
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_3
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: 375 predictions in PredictionHistory. Artifacts lost in restore but re-trainable. OOS eval available via pilot25 walk-forward.
- **current_status_label**: Trained artifact only — no reliable OOS edge evidence
- **promotion_eligibility**: no

### Random Forest
- **model_family**: Decision tree ensemble
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Decision tree ensemble
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_3
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: 375 predictions in PredictionHistory. Artifacts lost in restore but re-trainable. OOS eval available via pilot25 walk-forward.
- **current_status_label**: Trained artifact only — no reliable OOS edge evidence
- **promotion_eligibility**: no

### LSTM
- **model_family**: LSTM neural net (PyTorch)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: LSTM neural net (PyTorch)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_3
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### CNN-LSTM
- **model_family**: CNN+LSTM hybrid
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: CNN+LSTM hybrid
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_4
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### Transformer-LSTM
- **model_family**: Transformer+LSTM hybrid
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Transformer+LSTM hybrid
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_4
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### TabNet
- **model_family**: Attention-based tabular
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Attention-based tabular
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_4
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### FinGPT
- **model_family**: LLM fine-tuned for finance
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: LLM fine-tuned for finance
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_4
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### ARIMA
- **model_family**: ARIMA classic baseline for daily price series
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: ARIMA classic baseline for daily price series
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: statsmodels available — needs walk-forward training wiring
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Holt-Winters
- **model_family**: Exponential smoothing trend/seasonality
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Exponential smoothing trend/seasonality
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: statsmodels available — needs walk-forward training wiring
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### GARCH
- **model_family**: Volatility forecast model
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Volatility forecast model
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: statsmodels available — needs walk-forward training wiring
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Ridge Regression
- **model_family**: Linear regression on indicators (RSI, MACD, MA, volume)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Linear regression on indicators (RSI, MACD, MA, volume)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: 375 predictions in PredictionHistory. Artifacts lost in restore but re-trainable. OOS eval available via pilot25 walk-forward.
- **current_status_label**: Trained artifact only — no reliable OOS edge evidence
- **promotion_eligibility**: no

### Kalman Filter
- **model_family**: Real-time state estimation filter
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Real-time state estimation filter
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: statsmodels available — needs walk-forward training wiring
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Prophet
- **model_family**: Facebook Prophet trend/seasonality forecasting
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Facebook Prophet trend/seasonality forecasting
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: prophet not installed
- **current_status_label**: Rejected/unavailable (dependency)
- **promotion_eligibility**: no

### GRU
- **model_family**: Small GRU (1-2 layers, daily data)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Small GRU (1-2 layers, daily data)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: PyTorch not installed (CPU-only, 4GB RAM)
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### XGBoost (CL)
- **model_family**: Best accuracy-per-cost (copied from Tier 3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Best accuracy-per-cost (copied from Tier 3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Alias of XGBoost — reuse trained artifact
- **current_status_label**: Duplicate alias — counted once
- **promotion_eligibility**: no

### LightGBM (CL)
- **model_family**: Light GBT (copied from Tier 3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Light GBT (copied from Tier 3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Alias of LightGBM — reuse trained artifact
- **current_status_label**: Duplicate alias — counted once
- **promotion_eligibility**: no

### Random Forest (CL)
- **model_family**: Decision tree ensemble (copied from Tier 3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Decision tree ensemble (copied from Tier 3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Alias of Random Forest — reuse trained artifact
- **current_status_label**: Duplicate alias — counted once
- **promotion_eligibility**: no

### LSTM (CL)
- **model_family**: Small LSTM (copied from Tier 3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Small LSTM (copied from Tier 3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: LSTM needs PyTorch
- **current_status_label**: Rejected/unavailable (resource)
- **promotion_eligibility**: no

### LightGBM-A (CL-2)
- **model_family**: LightGBM classifier (config A: 100 trees, depth 3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: LightGBM classifier (config A: 100 trees, depth 3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### LightGBM-B (CL-2)
- **model_family**: LightGBM classifier (config B: 60 trees, depth 5)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: LightGBM classifier (config B: 60 trees, depth 5)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### HistGBM (CL-2)
- **model_family**: sklearn HistGradientBoosting classifier
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: sklearn HistGradientBoosting classifier
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### ExtraTrees (CL-2)
- **model_family**: ExtraTrees classifier
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: ExtraTrees classifier
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### RandomForest (CL-2)
- **model_family**: RandomForest classifier
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: RandomForest classifier
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Logistic (CL-2)
- **model_family**: Logistic regression baseline
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Logistic regression baseline
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### MLP (CL-2)
- **model_family**: Small MLP (32-unit hidden layer)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Small MLP (32-unit hidden layer)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CL_2
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cl2_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Linear Regression (PI)
- **model_family**: Linear regression on 20 indicators (predicts realized 5-day return)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Linear regression on 20 indicators (predicts realized 5-day return)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_PI
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_pi_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Logistic Regression (PI)
- **model_family**: Logistic regression (predicts P(TP1 hit before SL) in 5 days)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Logistic regression (predicts P(TP1 hit before SL) in 5 days)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_PI
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_pi_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Pattern Matcher KNN (PI)
- **model_family**: KNN classifier (k=15, distance-weighted) — pattern matching
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: KNN classifier (k=15, distance-weighted) — pattern matching
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_PI
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_pi_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Neural Network (PI)
- **model_family**: MLPClassifier (64-32 hidden, tanh) — distinct from CL-2's MLP
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: MLPClassifier (64-32 hidden, tanh) — distinct from CL-2's MLP
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_PI
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_pi_tier.py exists — needs data pipeline audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Technical Engine (GM)
- **model_family**: MA Trend + RSI/MACD + Bollinger Bands + OBV (35% weight)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: MA Trend + RSI/MACD + Bollinger Bands + OBV (35% weight)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GM
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based weighted framework — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Announcements Engine (GM)
- **model_family**: YoY EPS growth + dividend yield + EPS surprise (30% weight)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: YoY EPS growth + dividend yield + EPS surprise (30% weight)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GM
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based weighted framework — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Fundamental Engine (GM)
- **model_family**: P/E + gross/net margin + interest coverage (20% weight)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: P/E + gross/net margin + interest coverage (20% weight)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GM
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based weighted framework — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Macro Engine (GM)
- **model_family**: KSE-100 trend + KIBOR + USD/PKR + Brent (15% weight)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: KSE-100 trend + KIBOR + USD/PKR + Brent (15% weight)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GM
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based weighted framework — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### LightGBM (CG)
- **model_family**: LightGBM primary classifier — triple-barrier, 10-day horizon, TP1=1R
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: LightGBM primary classifier — triple-barrier, 10-day horizon, TP1=1R
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CG
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cg_model.py exists — triple-barrier classification, needs audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### XGBoost (CG)
- **model_family**: XGBoost challenger — same target/horizon as LightGBM (CG)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: XGBoost challenger — same target/horizon as LightGBM (CG)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_CG
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: train_cg_model.py exists — triple-barrier classification, needs audit
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Trend Multi-TF (X)
- **model_family**: Multi-timeframe trend (price > EMA20 > EMA50 > SMA200 + EMA separation > 0.5%)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Multi-timeframe trend (price > EMA20 > EMA50 > SMA200 + EMA separation > 0.5%)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Breakout RelVol (X)
- **model_family**: Breakout + relative volume (close > 20-day high AND vol > 1.5× 50d avg)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Breakout + relative volume (close > 20-day high AND vol > 1.5× 50d avg)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Trend Pullback (X)
- **model_family**: Trend pullback to EMA20 (price > EMA50, low touches EMA20 within 2%)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Trend pullback to EMA20 (price > EMA50, low touches EMA20 within 2%)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### RSI Divergence (X)
- **model_family**: RSI bullish divergence (price lower-low + RSI higher-low + RSI<35)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: RSI bullish divergence (price lower-low + RSI higher-low + RSI<35)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### BB Mean Reversion (X)
- **model_family**: Bollinger Band mean reversion (below lower band + range-bound)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Bollinger Band mean reversion (below lower band + range-bound)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Vol Contraction (X)
- **model_family**: Volatility contraction-then-expansion (BB width pattern)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Volatility contraction-then-expansion (BB width pattern)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Relative Strength (X)
- **model_family**: Relative strength (stock 50d return > KSE-100 50d return + 2%)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Relative strength (stock 50d return > KSE-100 50d return + 2%)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Market Regime (X)
- **model_family**: Market regime filter (KSE-100 50d return > 2% → bull regime)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Market regime filter (KSE-100 50d return > 2% → bull regime)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Meta-Label CG (X)
- **model_family**: Meta-label of CG-Ensemble predictions (raw_prob >= 0.55)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Meta-label of CG-Ensemble predictions (raw_prob >= 0.55)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: LightGBM meta-labeling — needs OOF from CG components
- **current_status_label**: Rejected/unavailable (data)
- **promotion_eligibility**: no

### Triple Barrier Dyn (X)
- **model_family**: Triple-barrier dynamic (ATR/price < 5% + price > EMA50 = low-vol uptrend)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Triple-barrier dynamic (ATR/price < 5% + price > EMA50 = low-vol uptrend)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_X
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Rule-based strategy component — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Gian-Ensemble (GIAN)
- **model_family**: Square-root support/resistance with odd-number rule (BUY near S1/S2/S3, SELL near R1/R2/R3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Square-root support/resistance with odd-number rule (BUY near S1/S2/S3, SELL near R1/R2/R3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GIAN
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Formulaic/technical strategy engine — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### Gian-Extender (GIAN-EXT)
- **model_family**: Fixed GANN square-of-9 levels (1, 9, 25, 49, 81, 121, 169, 225, 289, 361, 441, 529, 625, ...)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Fixed GANN square-of-9 levels (1, 9, 25, 49, 81, 121, 169, 225, 289, 361, 441, 529, 625, ...)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GIAN
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Formulaic/technical strategy engine — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### M-Ensemble (M)
- **model_family**: Historical price-touch S/R with ATR clustering (scan all highs/lows, cluster within 1×ATR, pick top 3)
- **purpose**: candidate prediction/strategy model from the Task 82 registry audit
- **methodology**: Historical price-touch S/R with ATR clustering (scan all highs/lows, cluster within 1×ATR, pick top 3)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: tier=TIER_GIAN
- **artifact_location**: Task 82 registry audit (entry metadata)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: none (never reached reliable evaluation)
- **current_disposition**: Formulaic/technical strategy engine — NOT trained ML
- **current_status_label**: Rule strategy — not ML
- **promotion_eligibility**: no

### XGBoost
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_XGBoost__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042932, "rmse": 0.058292, "r2": -0.019915, "directional_accuracy": 0.4755}, "10": {"n": 816, "mae": 0.06242, "rmse": 0.086808, "r2": -0.027449, "directional_accuracy": 0.4755}, "21": {"n": 816, "mae": 0.088643, "rmse": 0.122898, "r2": -0.084748, "directional_accuracy": 0.5061}}, "final_test": {"5": {"n": 1995, "mae": 0.050098, "rmse": 0.075551, "r2": -0.034
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### LightGBM
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_LightGBM__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042794, "rmse": 0.058125, "r2": -0.014098, "directional_accuracy": 0.4534}, "10": {"n": 816, "mae": 0.061925, "rmse": 0.08637, "r2": -0.017112, "directional_accuracy": 0.4498}, "21": {"n": 816, "mae": 0.086801, "rmse": 0.120536, "r2": -0.043453, "directional_accuracy": 0.4816}}, "final_test": {"5": {"n": 1995, "mae": 0.049738, "rmse": 0.075154, "r2": -0.023
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### CatBoost
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_CatBoost__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042967, "rmse": 0.058387, "r2": -0.023243, "directional_accuracy": 0.4571}, "10": {"n": 816, "mae": 0.062151, "rmse": 0.086758, "r2": -0.026274, "directional_accuracy": 0.4828}, "21": {"n": 816, "mae": 0.088084, "rmse": 0.121907, "r2": -0.067323, "directional_accuracy": 0.4902}}, "final_test": {"5": {"n": 1995, "mae": 0.050014, "rmse": 0.075384, "r2": -0.02
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### Random Forest
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_Random Forest__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.043053, "rmse": 0.058492, "r2": -0.026941, "directional_accuracy": 0.4645}, "10": {"n": 816, "mae": 0.062401, "rmse": 0.086934, "r2": -0.030429, "directional_accuracy": 0.473}, "21": {"n": 816, "mae": 0.088215, "rmse": 0.122474, "r2": -0.07728, "directional_accuracy": 0.5012}}, "final_test": {"5": {"n": 1995, "mae": 0.049941, "rmse": 0.075355, "r2": -0.0288
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### Ridge Regression
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_Ridge Regression__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042818, "rmse": 0.058166, "r2": -0.01552, "directional_accuracy": 0.4963}, "10": {"n": 816, "mae": 0.061906, "rmse": 0.086552, "r2": -0.021413, "directional_accuracy": 0.5123}, "21": {"n": 816, "mae": 0.088445, "rmse": 0.121778, "r2": -0.065064, "directional_accuracy": 0.5025}}, "final_test": {"5": {"n": 1995, "mae": 0.050271, "rmse": 0.075887, "r2": -0.043
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### ExtraTrees
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_ExtraTrees__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042774, "rmse": 0.058162, "r2": -0.015371, "directional_accuracy": 0.4657}, "10": {"n": 816, "mae": 0.061755, "rmse": 0.086483, "r2": -0.01977, "directional_accuracy": 0.4853}, "21": {"n": 816, "mae": 0.087083, "rmse": 0.121112, "r2": -0.053456, "directional_accuracy": 0.4877}}, "final_test": {"5": {"n": 1995, "mae": 0.049755, "rmse": 0.075243, "r2": -0.025
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### HistGradientBoosting
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_HistGradientBoosting__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.043316, "rmse": 0.058747, "r2": -0.035917, "directional_accuracy": 0.462}, "10": {"n": 816, "mae": 0.062838, "rmse": 0.087226, "r2": -0.037373, "directional_accuracy": 0.4645}, "21": {"n": 816, "mae": 0.089461, "rmse": 0.123934, "r2": -0.103118, "directional_accuracy": 0.4963}}, "final_test": {"5": {"n": 1995, "mae": 0.050278, "rmse": 0.075545, "r2": -0.034
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### ElasticNet
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_ElasticNet__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042602, "rmse": 0.057876, "r2": -0.005401, "directional_accuracy": 0.4326}, "10": {"n": 816, "mae": 0.061803, "rmse": 0.086295, "r2": -0.015347, "directional_accuracy": 0.4093}, "21": {"n": 816, "mae": 0.08713, "rmse": 0.120978, "r2": -0.051125, "directional_accuracy": 0.3873}}, "final_test": {"5": {"n": 1995, "mae": 0.049479, "rmse": 0.074963, "r2": -0.018
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: False; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### HuberRegressor
- **model_family**: classical ML (Task 100 nine-model experiment)
- **purpose**: predict future returns; direction/MAE gated strategy evaluation
- **methodology**: supervised regression on engineered features
- **training_approach**: walk-forward style split (see task100 protocol)
- **feature_groups**: engineered technical features (task100 protocol)
- **target_definition**: forward return per horizon
- **prediction_horizon**: 5 / 10 / 21 sessions
- **universe**: {"symbols": ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"], "selection": {"mode": "pilot25", "criteria": "canonical8 (if eligible as of cutoff) + top 17 by PRE-CUTOFF total volume (liquidity proxy), >= 250 bars as of the selection cutoff \u2014
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: validation + final_test blocks reported separately
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": [816, 1995], "10": [816, 1995], "21": [816, 1995]}
- **model_configuration_version**: task100 cells (threshold grids per model)
- **artifact_location**: data/backtest_reports/task100/cells_HuberRegressor__*
- **data_evidence_lineage**: OhlcvBar daily history (raw prices)
- **transaction_cost_assumptions**: V2 cost schedule applied at strategy layer (task100 cost reconciliation)
- **execution_assumptions**: signal -> next-session execution (task100 protocol)
- **historical_backtest_result**: {"validation": {"5": {"n": 816, "mae": 0.042337, "rmse": 0.057844, "r2": -0.004303, "directional_accuracy": 0.5343}, "10": {"n": 816, "mae": 0.060549, "rmse": 0.085762, "r2": -0.002831, "directional_accuracy": 0.5662}, "21": {"n": 816, "mae": 0.084976, "rmse": 0.119693, "r2": -0.028903, "directional_accuracy": 0.5809}}, "final_test": {"5": {"n": 1995, "mae": 0.050041, "rmse": 0.076113, "r2": -0.04
- **metrics_by_category**: prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts
- **forward_validation_status**: not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)
- **current_disposition**: gated pass: True; no positive net edge claim
- **current_status_label**: Research only (no demonstrated reliable positive net edge)
- **promotion_eligibility**: not promotable on current evidence

### ExtraTrees
- **model_family**: classical ML (Task 79 experiment)
- **purpose**: return-prediction candidate
- **methodology**: supervised regression
- **training_approach**: train on live feature rows, split at 2024-06-01
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5 / 10 / 21
- **universe**: ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": {"status": "trained", "train_rows_live": 59920, "n_buy_signals": 0, "n_predicted": 25, "eval": null}, "10": {"status": "trained", "train_rows_live": 59795, "n_buy_signals": 2, "n_predicted": 25, "eval": null}, "21": {"status": "trained", "train_rows_live": 59520, "n_buy_signals": 5, "n_predicted": 25, "eval": null}}
- **model_configuration_version**: task79-v1
- **artifact_location**: task79 artifacts (sha256 per artifact recorded in task79_model_results.json)
- **data_evidence_lineage**: OhlcvBar daily history
- **transaction_cost_assumptions**: strategy layer used V2 where backtested; see task81
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"note": "eval field null in task79 artifact \u2014 OOS evaluation happened in Task 100 for the surviving models"}
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: trained in Task 79; final evaluation carried by the Task 100 nine-model comparison
- **current_status_label**: Research only (superseded by Task 100 evaluation)
- **promotion_eligibility**: not promotable on current evidence

### HistGradientBoosting
- **model_family**: classical ML (Task 79 experiment)
- **purpose**: return-prediction candidate
- **methodology**: supervised regression
- **training_approach**: train on live feature rows, split at 2024-06-01
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5 / 10 / 21
- **universe**: ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": {"status": "trained", "train_rows_live": 59920, "n_buy_signals": 1, "n_predicted": 25, "eval": null}, "10": {"status": "trained", "train_rows_live": 59795, "n_buy_signals": 4, "n_predicted": 25, "eval": null}, "21": {"status": "trained", "train_rows_live": 59520, "n_buy_signals": 6, "n_predicted": 25, "eval": null}}
- **model_configuration_version**: task79-v1
- **artifact_location**: task79 artifacts (sha256 per artifact recorded in task79_model_results.json)
- **data_evidence_lineage**: OhlcvBar daily history
- **transaction_cost_assumptions**: strategy layer used V2 where backtested; see task81
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"note": "eval field null in task79 artifact \u2014 OOS evaluation happened in Task 100 for the surviving models"}
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: trained in Task 79; final evaluation carried by the Task 100 nine-model comparison
- **current_status_label**: Research only (superseded by Task 100 evaluation)
- **promotion_eligibility**: not promotable on current evidence

### ElasticNet
- **model_family**: classical ML (Task 79 experiment)
- **purpose**: return-prediction candidate
- **methodology**: supervised regression
- **training_approach**: train on live feature rows, split at 2024-06-01
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5 / 10 / 21
- **universe**: ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": {"status": "trained", "train_rows_live": 59920, "n_buy_signals": 0, "n_predicted": 25, "eval": null}, "10": {"status": "trained", "train_rows_live": 59795, "n_buy_signals": 0, "n_predicted": 25, "eval": null}, "21": {"status": "trained", "train_rows_live": 59520, "n_buy_signals": 0, "n_predicted": 25, "eval": null}}
- **model_configuration_version**: task79-v1
- **artifact_location**: task79 artifacts (sha256 per artifact recorded in task79_model_results.json)
- **data_evidence_lineage**: OhlcvBar daily history
- **transaction_cost_assumptions**: strategy layer used V2 where backtested; see task81
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"note": "eval field null in task79 artifact \u2014 OOS evaluation happened in Task 100 for the surviving models"}
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: trained in Task 79; final evaluation carried by the Task 100 nine-model comparison
- **current_status_label**: Research only (superseded by Task 100 evaluation)
- **promotion_eligibility**: not promotable on current evidence

### HuberRegressor
- **model_family**: classical ML (Task 79 experiment)
- **purpose**: return-prediction candidate
- **methodology**: supervised regression
- **training_approach**: train on live feature rows, split at 2024-06-01
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5 / 10 / 21
- **universe**: ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": {"status": "trained", "train_rows_live": 59920, "n_buy_signals": 0, "n_predicted": 25, "eval": null}, "10": {"status": "trained", "train_rows_live": 59795, "n_buy_signals": 0, "n_predicted": 25, "eval": null}, "21": {"status": "trained", "train_rows_live": 59520, "n_buy_signals": 2, "n_predicted": 25, "eval": null}}
- **model_configuration_version**: task79-v1
- **artifact_location**: task79 artifacts (sha256 per artifact recorded in task79_model_results.json)
- **data_evidence_lineage**: OhlcvBar daily history
- **transaction_cost_assumptions**: strategy layer used V2 where backtested; see task81
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"note": "eval field null in task79 artifact \u2014 OOS evaluation happened in Task 100 for the surviving models"}
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: trained in Task 79; final evaluation carried by the Task 100 nine-model comparison
- **current_status_label**: Research only (superseded by Task 100 evaluation)
- **promotion_eligibility**: not promotable on current evidence

### SVR
- **model_family**: classical ML (Task 79 experiment)
- **purpose**: return-prediction candidate
- **methodology**: supervised regression
- **training_approach**: train on live feature rows, split at 2024-06-01
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5 / 10 / 21
- **universe**: ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL", "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL", "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: {"5": {"status": "trained", "train_rows_live": 59920, "n_buy_signals": 16, "n_predicted": 25, "eval": null}, "10": {"status": "trained", "train_rows_live": 59795, "n_buy_signals": 10, "n_predicted": 25, "eval": null}, "21": {"status": "trained", "train_rows_live": 59520, "n_buy_signals": 13, "n_predicted": 25, "eval": null}}
- **model_configuration_version**: task79-v1
- **artifact_location**: task79 artifacts (sha256 per artifact recorded in task79_model_results.json)
- **data_evidence_lineage**: OhlcvBar daily history
- **transaction_cost_assumptions**: strategy layer used V2 where backtested; see task81
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"note": "eval field null in task79 artifact \u2014 OOS evaluation happened in Task 100 for the surviving models"}
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: trained in Task 79; final evaluation carried by the Task 100 nine-model comparison
- **current_status_label**: Research only (superseded by Task 100 evaluation)
- **promotion_eligibility**: not promotable on current evidence

### ARIMA
- **model_family**: classical time series (statsmodels/prophet)
- **purpose**: baseline time-series forecasting
- **methodology**: trained_oos_evaluated
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task98/task98_metrics.json (ARIMA)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"5d": {"mae": 0.039384, "r2": -0.0056, "directional_accuracy": 0.5108, "n": 2402}, "10d": {"mae": 0.057141, "r2": -0.0124, "directional_accuracy": 0.5065, "n": 2395}, "21d": {"mae": 0.085493, "r2": -0.0097, "directional_accuracy": 0.5021, "n": 2384}}
- **metrics_by_category**: {"5d": {"mae": 0.039384, "r2": -0.0056, "directional_accuracy": 0.5108, "n": 2402}, "10d": {"mae": 0.057141, "r2": -0.0124, "directional_accuracy": 0.5065, "n": 2395}, "21d": {"mae": 0.085493, "r2": -0.0097, "directional_accuracy": 0.5021, "n": 2384}}
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: Not available in source evidence
- **current_status_label**: Research only (OOS-evaluated baselines; no net-edge claim)
- **promotion_eligibility**: not promotable on current evidence

### Prophet
- **model_family**: classical time series (statsmodels/prophet)
- **purpose**: baseline time-series forecasting
- **methodology**: trained_oos_evaluated
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task98/task98_metrics.json (Prophet)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"5d": {"mae": 0.135897, "r2": -19.457, "directional_accuracy": 0.4867, "n": 2402}, "10d": {"mae": 0.144865, "r2": -9.2339, "directional_accuracy": 0.4994, "n": 2395}, "21d": {"mae": 0.165244, "r2": -4.2979, "directional_accuracy": 0.5147, "n": 2384}}
- **metrics_by_category**: {"5d": {"mae": 0.135897, "r2": -19.457, "directional_accuracy": 0.4867, "n": 2402}, "10d": {"mae": 0.144865, "r2": -9.2339, "directional_accuracy": 0.4994, "n": 2395}, "21d": {"mae": 0.165244, "r2": -4.2979, "directional_accuracy": 0.5147, "n": 2384}}
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: Not available in source evidence
- **current_status_label**: Research only (OOS-evaluated baselines; no net-edge claim)
- **promotion_eligibility**: not promotable on current evidence

### jw_reference_lstm
- **model_family**: deep learning (reference implementations)
- **purpose**: LSTM / CNN-LSTM return-prediction reference models
- **methodology**: PyTorch-free reference training (Task 99 protocol)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5/10/21 (pilot25 h5_10_21 configs)
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task99/predictions/preds_jw_reference_lstm__reference_cpu_compact__canonical8_h1_repro.json, data/backtest_reports/task99/predictions/preds_jw_reference_lstm__reference_full_config__pilot25_h5_10_21.json
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: reference implementations kept for lineage; not production models
- **current_status_label**: Research only (reference models; no promotion)
- **promotion_eligibility**: not promotable on current evidence

### jw_reference_cnn_lstm
- **model_family**: deep learning (reference implementations)
- **purpose**: LSTM / CNN-LSTM return-prediction reference models
- **methodology**: PyTorch-free reference training (Task 99 protocol)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: 5/10/21 (pilot25 h5_10_21 configs)
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task99/predictions/preds_jw_reference_cnn_lstm__reference_full_config__pilot25_h5_10_21.json
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: reference implementations kept for lineage; not production models
- **current_status_label**: Research only (reference models; no promotion)
- **promotion_eligibility**: not promotable on current evidence

### psx_cost_aware_trade_classifier
- **model_family**: cost-aware ML (Tasks 99-103)
- **purpose**: trade classifier / meta-model trained on cost-adjusted outcomes
- **methodology**: cost-aware labeling/training with psx_user_schedule_v2
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task101/task101_cost_aware_training.json (+ task99/102/103 artifacts)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: general forward campaign (Task 105-110) includes the frozen shadow filter cohort — NOT LLM-specific
- **current_disposition**: frozen; referenced by the forward shadow filter; not promotable on current evidence
- **current_status_label**: Shadow only (frozen cost-aware shadow filter)
- **promotion_eligibility**: not promotable on current evidence

### psx_net_expectancy_meta_model
- **model_family**: cost-aware ML (Tasks 99-103)
- **purpose**: meta-model estimating net expectancy after V2 costs
- **methodology**: cost-aware labeling/training with psx_user_schedule_v2
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task101/task101_cost_aware_training.json (+ task99/102/103 artifacts)
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: general forward campaign (Task 105-110) includes the frozen shadow filter cohort — NOT LLM-specific
- **current_disposition**: frozen; referenced by the forward shadow filter; not promotable on current evidence
- **current_status_label**: Shadow only (frozen cost-aware shadow filter)
- **promotion_eligibility**: not promotable on current evidence

### golden_cross_7_30_v1 (Golden Cross 7/30 SMA)
- **model_family**: technical rule system — NOT ML
- **purpose**: trend-following crossover research strategy
- **methodology**: MA7/MA30 crossover at close, fill next global session open, whole shares, V2 costs, long-only
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: task109-consistent 23-symbol universe
- **evaluation_period**: ~10 years to frontier 2026-11-05
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: Not available in source evidence
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: psx_user_schedule_v2 (computeTradeCostsV2)
- **execution_assumptions**: signal at close t -> next-session open; unfilled never fabricated
- **historical_backtest_result**: {"initial_capital": 100000.0, "final_equity": 60718.23, "roi_pct": -39.282, "max_drawdown": -87775.26, "trades": 363, "win_rate_pct": 27.0, "profit_factor": 0.8701, "total_costs": 78867.55, "source": "task110 engine (unchanged)"}
- **metrics_by_category**: strategy metrics (ROI/win rate/PF/drawdown)
- **forward_validation_status**: research dashboards simulate on demand; not part of the forward cohort
- **current_disposition**: negative edge vs cash and buy-and-hold; never promoted; unchanged since Task 110
- **current_status_label**: Research only (negative edge after costs)
- **promotion_eligibility**: no

### task104 portfolio strategies (fixed_first_hit family)
- **model_family**: rule/portfolio system — NOT ML
- **purpose**: prospective paper-trading portfolio configs from the Task 104 experiment
- **methodology**: first-hit TP/SL portfolio configs (see task104_portfolio_results.json)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task104/task104_portfolio_results.json
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"fixed_first_hit__A_eq10__none": {"strategy": "fixed_first_hit", "sizing": "A_eq10", "filter": "none", "initial_cash": 100000, "final_equity": 4207.28, "ending_cash": 4207.28, "roi_pct": -95.7927, "realized_pnl": -95792.72, "unrealized_pnl": 0, "total_fees_excl_cgt": 37215.77, "total_cgt": 39148.14, "total_slippage": 0, "n_trades_taken": 2467, "n_wins": 884, "win_rate_pct": 35.83, "n_skipped_filt
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: Not available in source evidence
- **current_status_label**: Research only (prospective/shadow)
- **promotion_eligibility**: no

### volatility-aware overlays (A, B 10/15/20, C)
- **model_family**: risk overlay — NOT ML
- **purpose**: reduce drawdown/losses without changing GC entry signals
- **methodology**: universe-mean 20d realized vol percentile bands; sizing multipliers + pauses
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: data/backtest_reports/task111/task111_volatility_overlay_backtest.json
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: {"overlay_A_fixed_vol_exposure": {"initial_capital": 100000.0, "final_equity": 79652.78, "realized_net_pnl": -49907.37, "unrealized_pnl": 29560.15, "roi_pct": -20.347, "max_drawdown_pct": -62.414, "trades": 428, "wins": 123, "losses": 305, "win_rate_pct": 28.74, "profit_factor": 0.8611, "exposure_note": "cash-constrained, whole shares, no leverage, no shorts, V2 costs (psx_user_schedule_v2)"}, "ov
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: hypothesis for forward validation; drawdown reduction is not alpha
- **current_status_label**: Research only (predeclared family; 10% target is a hypothesis, not promoted)
- **promotion_eligibility**: no

### shared strategySignal()/technical-rule implementation + existing ensemble
- **model_family**: production technical rules — NOT ML
- **purpose**: the platform's existing production signal path (signals v2 / ensemble)
- **methodology**: existing implementation unchanged (see src/lib/latent/strategy-engine.ts, ensemble.ts)
- **training_approach**: Not available in source evidence
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: Not available in source evidence
- **universe**: Not available in source evidence
- **evaluation_period**: Not available in source evidence
- **train_validation_test_split**: Not available in source evidence
- **purge_embargo**: Not available in source evidence
- **sample_counts**: Not available in source evidence
- **model_configuration_version**: Not available in source evidence
- **artifact_location**: src/lib/latent/strategy-engine.ts, src/lib/latent/ensemble.ts
- **data_evidence_lineage**: Not available in source evidence
- **transaction_cost_assumptions**: Not available in source evidence
- **execution_assumptions**: Not available in source evidence
- **historical_backtest_result**: Not available in source evidence
- **metrics_by_category**: Not available in source evidence
- **forward_validation_status**: Not available in source evidence
- **current_disposition**: untouched by Tasks 110-112 (no retraining, no threshold changes)
- **current_status_label**: Existing production research signals (unchanged); never auto-promoted
- **promotion_eligibility**: no (existing state preserved)

### GLM-4.6 multi-source LLM analyst (z-ai-web-dev-sdk)
- **model_family**: LLM (authorized existing provider)
- **purpose**: research-only multi-source stock analysis: fundamentals + patterns + news + technicals
- **methodology**: latent_psx_llm_evidence_v1 -> glm-4.6 -> strict output validation -> deterministic R:R -> capital protection
- **training_approach**: no training/fine-tuning (inference only, temperature 0.2)
- **feature_groups**: Not available in source evidence
- **target_definition**: Not available in source evidence
- **prediction_horizon**: analysis horizon 5/10/21 sessions (decision-level, not numeric forecast)
- **universe**: task109-consistent 23-symbol universe
- **evaluation_period**: current-date decisions from 2026-11-04 (generation task111-llm-multisource-gen1)
- **train_validation_test_split**: n/a (no training)
- **purge_embargo**: n/a
- **sample_counts**: {"total_persisted_records": 71, "real_records_excl_mock": 48, "mock_pipeline_check_records": 23, "unique_symbols_valid": 23}
- **model_configuration_version**: provider=zai model=glm-4.6 prompt=task111-prompt-v1
- **artifact_location**: data/backtest_reports/task111/signals/ + task112/llm_signal_history/
- **data_evidence_lineage**: evidence packages hashed (evidenceHash) per decision; news snapshots retrieval-timestamped
- **transaction_cost_assumptions**: R:R priced through computeTradeCostsV2 (psx_user_schedule_v2)
- **execution_assumptions**: next-session-open reference; delayed snapshots labeled delayed_observation_shadow
- **historical_backtest_result**: {"note": "historical LLM simulation forbidden (no PIT evidence packages); current-date decisions only"}
- **metrics_by_category**: {"final_signals_current": {"NO_TRADE": 63, "HOLD": 5, "BUY": 3}}
- **forward_validation_status**: task111-llm-multisource-gen1 collecting; 0 matured LLM-specific outcomes (horizons 5/10/21 pending)
- **current_disposition**: research_only; LLM conviction is uncalibrated; promotion gates require >=100 genuinely matured LLM outcomes
- **current_status_label**: Shadow only (LLM cohort distinct from the general Task 109 cohort)
- **promotion_eligibility**: no

## Honest status legend
- **Research only** — evaluated, no reliable positive net edge demonstrated.
- **Shadow only** — frozen, collecting genuinely future outcomes.
- **Insufficient evidence** — cannot be evaluated yet.
- **Not promotable** — promotion gates not passed.
- **Rule strategy — not ML** — deterministic rules, not trained models.
- **Rejected/unavailable** — blocked by resources, dependencies or data.

No model is production-ready merely because a build or test passes. Nothing here places orders.