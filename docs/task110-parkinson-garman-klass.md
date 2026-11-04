# Task 110 — Parkinson & Garman-Klass Estimators: Math, Units, Assumptions

Both estimators turn intraday price **ranges** into daily variance estimates that use more information than close-to-close returns. All formulas below are implemented identically in `scripts/task110_lib.py` and `src/lib/latent/volatility-analytics.ts` (parity-tested).

## Parkinson (1980)

```
Var_P(daily) = mean over window of [ ln(H_t/L_t)² ] / (4 ln 2)
Var_P(ann)   = 252 × Var_P(daily)          -- exactly once
```

- Uses only high/low. The `1/(4 ln2)` divisor is load-bearing: during Task 110's independent-validation harness a **missing divisor bug** (values ≈ 4 ln2 ≈ 2.77× too large) was caught and fixed; the shipped engine matches hand calculations to 1e-12.
- Assumes continuous geometric Brownian motion with zero drift, no jumps, and sampling that captures the true extremes. Real bars discretize the range, so Parkinson is biased **downward**; overnight gaps are invisible to it.

## Garman-Klass (1980)

```
Var_GK(daily) = mean over window of [ 0.5·ln(H/L)² − (2 ln2 − 1)·ln(C/O)² ]
Var_GK(ann)   = 252 × Var_GK(daily)        -- exactly once
```

- Uses OHLC; theoretically ~7.4× more efficient than close-to-close under its assumptions.
- The open-to-close term is subtractive, but whenever open and close lie inside `[L, H]` each bar's term is non-negative (`0.5 > 2ln2 − 1 ≈ 0.386`). **Negative estimates therefore signal data anomalies** (close outside the recorded range) rather than genuine negative variance. Policy: keep them unclipped, count them, show volatility as unavailable where `sqrt` is undefined.

## Units contract (the audit's central finding)

The audited prototype annualized `Var_GK` inside the estimator and then plotted `sqrt(Var_GK × 252)` — applying **252 twice**, overstating volatility by `√252 ≈ 15.9×`. Task 110's contract:

1. Engine functions return **daily** variance (`*_daily_variance`).
2. A separate layer multiplies by 252 **once** (`*Var_ann`).
3. Volatility = `sqrt(Var_ann)` (reported ×100 as %).
4. Tests: `test_annualization_exactly_once`, `test_parkinson_formula`, `test_gk_formula_and_negatives`, `test_cc_variance`.

## Interpretation guardrails

- **GK > Parkinson does NOT prove a directional trend.** The estimators weight OHLC components differently under different efficiency assumptions; their gap depends on microstructure, drift, jumps, and range granularity. Any directional reading is unsupported and is excluded from chart annotations and regime logic.
- Close-to-close vs range estimators diverge most around gaps and jumps: CC captures overnight moves that Parkinson/GK ignore. Divergence is information about **data structure**, not a trading signal by itself.
- All three are **realized** measures — none measures implied volatility.

## Validation

`task110_volatility_signal_validation.json`: 92 independent re-derivations (fresh code path, hand formulas) across the universe — **92/92 match**. Formulas are additionally hand-checked on fixed synthetic vectors in `task110_tests.py` (synthetic data used only for software tests, never for market conclusions).
