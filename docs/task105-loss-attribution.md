# Task 105 — Loss Attribution

Full data: `data/backtest_reports/task105/task105_loss_attribution.json`, `task105_symbol_failure_analysis.csv`, `task105_exit_geometry_analysis.json`, `task105_cost_vs_gross_loss.json`.

## Decomposition of the gross loss (why signals lose before costs)

| Component | Evidence | Share of the problem |
| --- | --- | --- |
| Poor direction prediction | Gross mean trade return negative in every strategy; best directional model 52.23% with negative R² | **Primary** |
| Reward-to-risk asymmetry | Win rates 35–51% but average loser ≫ average winner; profit factors < 1 | **Large** |
| Unresolved trades | ~19% TIME_UP at the 21-session horizon: capital locked, zero payoff | Moderate |
| Regime / sector / symbol effects | 67 of 69 FDR-corrected subgroup tests negative; none positive — losses are broad, not concentrated | Distributional, not additive |
| Entry timing / gaps | Gap-up entries slightly worse; not significant after correction | Minor |
| Costs | Add 40–60% on top of the gross loss (drag 92.6–232.8% of gross) | Second-order multiplier |

## Reading the numbers correctly

- Subgroup statistics are associations, **not causal explanations**; Benjamini–Hochberg FDR (5%) is applied across all 69 tests.
- A handful of historically profitable symbols exist in `task105_symbol_failure_analysis.csv` (the aggregation spans 3 strategies × 11,521 trades). They are **not** a strategy: selecting them now would be mining already-inspected final-test data, which Task 105 forbids.
- MFE ≫ realized return: price frequently travels toward the targets and reverses before filling — the geometry is consistent, the signal is simply not predictive enough to exploit it.

## Per-strategy aggregates (reference notional PKR 100,000, all 11,521 trades)

Gross totals, cost totals and net totals per strategy and per year are in `task105_cost_vs_gross_loss.json`. The ordering is stable across years: no strategy shows a positive-gross year block that would indicate a regime where the system works.

## Bottom line

The largest single component of the gross loss is the **direction signal itself** — there is no configuration of the existing TP/SL geometry, sizing, horizon or filter that turns non-predictive signals into positive expectancy. This is why Task 105 keeps every model in research/shadow mode and records forward observations instead of promoting anything.
