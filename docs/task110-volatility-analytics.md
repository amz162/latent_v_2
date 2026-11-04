# Task 110 — Volatility Analytics

Module id: `volatility_regime_v1` — status **`research_only`**. A separate dashboard window (**"Volatility & Convexity Analytics"**, SPA view `volatility_analytics`, API `/api/volatility`), fully distinct from the Golden Cross window.

## What is computed (real `OhlcvBar` data only — never synthetic)

Configurable windows; defaults: **variance window 10 sessions, BBW window 20, k = 2.0, annualization 252**.

### Estimators (daily variance → annualized exactly once)

| Estimator | Daily variance | Annualized |
|---|---|---|
| Close-to-close | sample variance (ddof=1) of `r_t = ln(C_t/C_{t-1})` over the window | `× 252` |
| Parkinson | `mean[ln(H/L)²] / (4 ln2)` | `× 252` |
| Garman-Klass | `mean[0.5·ln(H/L)² − (2ln2−1)·ln(C/O)²]` | `× 252` |

Annualized **volatility** = `sqrt(annualized variance) × 100` — this is the exact point where the audited prototype doubled the 252 factor (`sqrt(Var_GK × 252)` on an already-annualized series). Here annualization happens once, in one layer, and is unit-tested.

### BBW and derivatives

- `Middle = SMA_20(close)`, `Upper/Lower = Middle ± 2σ₂₀` (sample σ, ddof=1), `BBW = (Upper−Lower)/Middle`.
- First/second **differences** (`d1`, `d2`) are discrete per-session derivatives — not continuous-time derivatives, and **never computed across a missing-session gap** (adjacency on the global session calendar is enforced; gap-affected values are `null` with a gap note).
- The same d1/d2 treatment applies to each annualized variance series (daily-basis derivatives are available in the artifact CSVs; units are never mixed).

### Negative Garman-Klass handling

With strictly valid bars (O,C inside [L,H]) every GK term is mathematically ≥ 0, so negative estimates can only arise from range-violating data anomalies. Policy: **keep them unclipped**, count them, and show volatility as *unavailable* where the square root is undefined. (The independent-validation harness caught and fixed a missing `1/(4ln2)` Parkinson divisor during this task — that is what the validation is for.)

## Regime module

States: `long_vol_watch`, `volatility_expansion`, `volatility_compression`, `short_vol_watch`, `mean_reversion_watch`, `transition`, `wait`, `insufficient_data`.

- Expansion/compression **watches** require persistence: BBW d1 and d2 with the same sign on the current **and** previous observation, plus a realized-variance d1 confirmation.
- `short_vol_watch` is **never generated from realized data** — it would require verified option-contract data (implied vol, strikes, bids, permissions), which the provider does not supply.
- GK-vs-Parkinson differences are **not** treated as directional-trend indicators.

## Implied vs realized — the critical boundary

Everything on this screen is **realized** volatility of past prices. It is **not** implied volatility. Expanding realized vol does not mean options are cheap; compressing realized vol does not mean premium should be sold. PSX options/IV data is unavailable to this project (`blocked_options_data`), so no option signal, order instruction, or tradability claim exists anywhere in the module.

## Access

- API: `/api/volatility?symbol=HUBC&varWindow=10&bbwWindow=20&k=2` (server-side computation from the DB; series tail of 500 sessions).
- Artifacts: `task110_volatility_indicators_report.json`, `task110_volatility_series.csv`, `task110_volatility_derivatives.csv`, `task110_estimator_comparison.json`, `task110_volatility_regimes.json`, `task110_strategy_guidance_rules.json`, `task110_option_market_availability.json`, `task110_volatility_signal_validation.json` (92/92 independent recalculations match).

## Limitations

Delayed **daily** bars (no intraday range granularity); raw unadjusted prices (corporate-action jumps contaminate log returns — flagged per symbol); Parkinson/GK assume continuous sampling and driftless dynamics; provider-observed sessions, not an official exchange calendar.
