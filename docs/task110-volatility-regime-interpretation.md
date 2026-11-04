# Task 110 — Volatility Regime Interpretation

The regime module (`classifyRegime` / `L.classify_regime`) converts BBW and realized-variance dynamics into **descriptive research watches**. It never issues orders, never sizes positions, and never touches the production consensus.

## The three hypotheses that must not be conflated

| Hypothesis | Evidence required | Task 110 status |
|---|---|---|
| **Price mean reversion** | price/return behavior (e.g., decay of return autocorrelation) | separate future study; the `mean_reversion_watch` label is only "BBW contracting" and explicitly does NOT assert price reversion |
| **Volatility compression** | realized-vol measures (BBW + variance estimators) | watch only |
| **Short-option premium selling** | option-chain evidence: strikes, bid/ask, implied vol, open interest, margin and permission verification | **blocked_options_data** — not available; never simulated |

Realized-vol compression says nothing about whether implied vol (the price of options) is rich. An instrument can show falling realized vol while options are expensively priced — selling premium on that signal alone is exactly the error this module is built to prevent.

## State machine

- `long_vol_watch` — BBW d1 > 0 **and** d2 > 0 on the current and previous observation (persistence), **plus** Parkinson or close-to-close variance d1 > 0. Meaning: realized-vol expansion under way. NOT a claim that long options will be profitable (that depends on implied vs subsequently realized vol — unknowable without options data).
- `volatility_compression` — mirror condition (d1, d2 < 0 persisting + variance contraction confirmed). NOT a short-premium signal.
- `volatility_expansion` / `mean_reversion_watch` — single-observation d1 sign, no persistence yet.
- `short_vol_watch` — **never assigned** from realized data; exists in the enum only as documented policy.
- `transition`, `wait`, `insufficient_data` — bookkeeping states.

## Persistence and noise

A single d1 sign flip is noise-prone; watch states therefore require the d1 **and** d2 sign condition to hold twice consecutively with estimator confirmation. `transition` labels regime changes so downstream consumers can distinguish fresh regimes from stale ones.

## Explicit non-claims

1. Realized variance/BBW are **not implied volatility**.
2. BBW expansion is **not** a guarantee of option profitability.
3. GK-vs-Parkinson differences are **not** directional indicators.
4. No regime maps to an order instruction — verified by a banned-token code scan (`test_no_option_execution_paths`) and by the capital-protection report.
5. PSX options availability was **not** assumed; the option-availability artifact records the missing data contract in full (underlying, expiry, strike, C/P, bid/ask/last, IV, OI, volume, multiplier, settlement, margin, permissions).

## Validation

`task110_volatility_regime_validation.json` — 92/92 independent re-derivations; state-transition unit tests for equality/gap/insufficient-data edges; persistence-rule tests.
