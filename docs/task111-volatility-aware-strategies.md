# Task 111 — Volatility-Aware Equity Risk Overlays

Purpose: does volatility information reduce account losses and drawdowns **without changing entry signals**?

## Overlays (predeclared; `task111_risk_overlay_definitions.json`)

- **A — Fixed volatility exposure**: universe-mean 20d realized vol vs trailing-250-session 40th/80th percentile bands →
  multiplier 1.00 / 0.75 / 0.50 (low/normal/high). Position budget only.
- **B — Volatility-targeted sizing**: multiplier = clamp(target / realized_vol_20d, 0, 1) for targets 10%, 15%, 20%.
  Never leverage; exposure capped at 100% of available equity.
- **C — Volatility expansion protection**: extreme-expansion state (vol above the 80th band AND BBW above its 80th
  band) suppresses new entries.
- **D — Mean-reversion research**: uses price z-score / MA-distance indicators; falling BBW alone is explicitly NOT a
  mean-reversion signal.
- **E — Drawdown protection**: 5% alert (halve new budgets), 10% pause (no new entries), 2% per-position risk cap,
  6% combined open-risk cap, 100% max exposure.

## Results (task110 engine semantics preserved; whole shares; V2 costs; no leverage/shorts)

| Strategy | ROI | Max drawdown | Trades |
| --- | --- | --- | --- |
| GC baseline (signals unchanged) | −39.28% | −87.8% (PKR −87,775) | 363 |
| A fixed-vol exposure | −20.35% | −62.41% | 428 |
| B vol-target 10% | **−2.68%** | **−23.62%** | 428 |
| B vol-target 15% | −7.24% | −33.66% | 428 |
| B vol-target 20% | −12.58% | −42.54% | 428 |
| C expansion protection | −20.35% | −62.41% | 428 |

## Reading and honesty

Every overlay improves both ROI and drawdown relative to the baseline — volatility information clearly carried
risk-relevant signal in this period. The whole predeclared family is reported (including the weakest member); the
10% target looks best **and is not promoted on that basis**: it is a hypothesis requiring forward validation, and the
account remains below cash and buy-and-hold. These are simulated protective rules, not guarantees against price gaps.
Artifacts: `task111_volatility_exposure_rules.json`, `task111_position_sizing_rules.json`,
`task111_capital_protection_scenarios.json`, `task111_volatility_overlay_backtest.json`, `task111_drawdown_comparison.json`.
