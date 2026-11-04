# Task 111 — Golden Cross Comparison

## Baseline reconciliation (Phase 1)

Task 110's golden-cross result was independently recomputed inside Task 111 using the same deterministic engine
(`task110_phases_research.run_portfolio`) and matches **exactly on all eight reported values**:

| Metric | Task 110 reported | Task 111 recompute | Match |
| --- | --- | --- | --- |
| Initial capital | PKR 100,000.00 | 100,000.00 | ✓ |
| Final equity | PKR 60,718.23 | 60,718.23 | ✓ |
| ROI | −39.282% | −39.282% | ✓ |
| Trades | 363 | 363 | ✓ |
| Wins | 98 | 98 | ✓ |
| Win rate | 27.0% | 27.0% | ✓ |
| Profit factor | 0.8701 | 0.8701 | ✓ |
| Total costs | PKR 78,867.55 | 78,867.55 | ✓ |

Definition unchanged (`golden_cross_7_30_v1`, MA 7/30, next-session-open fills, whole shares, V2 costs, no shorts/leverage).

## Comparison set (same data, period, constraints)

From `task111_portfolio_strategy_comparison.json` (predeclared configurations only):

- **Cash**: 0.0%.
- **Buy-and-hold equal weight**: +17.5%.
- **GC baseline**: −39.28% (worse than cash — negative edge confirmed, unchanged).
- **Overlays** (entries untouched): A fixed-vol-exposure −20.35%; B vol-target 10/15/20% → −2.68% / −7.24% / −12.58%;
  C expansion-protection −20.35%. All improve both ROI and drawdown versus the baseline.
- **LLM strategies**: forward-only (`collecting`) — historical LLM simulation would require PIT evidence that does not
  exist; the current-date signals feed the forward shadow generation instead.

## Honest reading

Volatility-targeted sizing is the first intervention in this research program that materially changes the GC account
outcome (still negative against buy-and-hold; not a profitable strategy claim). Because 10/15/20% were predeclared and
the whole family is reported, this is a **hypothesis for forward validation**, not a tuned discovery. The LLM's research
signals are displayed side-by-side with the GC dashboard via an additive panel; the original strategy is untouched.
