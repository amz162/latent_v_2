# Task 111 — Realized Volatility Forecasting

Question: do today's realized-volatility measures predict subsequent realized volatility?

## Method (point-in-time safe)

At each session t (per symbol, 23-symbol universe): predictors are the 20-session close-to-close variance and the
20-session Parkinson variance (both computed only from data ≤ t). Outcomes are the mean log-return variance over the
NEXT 5 / 10 / 21 sessions — strictly later data. Immature windows are never scored; future observations never enter features.

## Metrics (`task111_realized_volatility_forecast.json`)

MAE, RMSE and Spearman rank correlation per horizon per predictor, plus regime-classification context
(`task111_volatility_regime_maturity.json`). The full error table is in `task111_volatility_forecast_errors.csv`.

## Honest labels

- These are **historical diagnostics** (`development_only`) — a statistical property of volatility persistence, not a
  strategy claim and not a tradable signal.
- **Implied-volatility prediction is NOT claimed anywhere**: PSX has no verified listed-options market data, so implied
  volatility does not exist in this system. Realized volatility is never used as implied volatility.
- Any regime-conditioned strategy implication requires the forward shadow generation to mature.

## Estimator integrity carried into the forecast

The underlying estimators are the task110 implementations, re-verified this task: non-negativity on real data,
annualization exactly once (`sqrt(var × 252)`), and derivative computation that never bridges a missing-session gap
(`task111_derivative_integrity.json`, `task111_estimator_consistency.json`).
