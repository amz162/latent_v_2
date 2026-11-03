# Task 105 — Signal Forensics

## Why the existing models lose (the headline)

The forensic audit found **no software defect** in the signal-generation or execution path. Six fixture suites run against the production modules (`task105_direction_mapping_tests.json`) verify BUY/SELL geometry, SL-first gap-aware fills, scale-out accounting, CGT behavior and cost identities. Sign conventions on real bars (5/10/21-day forward returns) are correct (`task105_target_direction_tests.json`). Timestamps are clean: features use only bars ≤ decision date, entries are the next session's open, the engine scans only post-entry bars, and partitions are purged by 21 sessions (`task105_timestamp_alignment_report.json`).

The loss is explained by **absence of predictive edge plus friction**:

1. Gross (pre-cost) mean trade return is negative for all three strategies — the signals lose even with zero trading costs (34,563 trade-strategy pairs, `task105_loss_attribution.json`).
2. Of 69 FDR-corrected subgroup tests (symbol, sector, year, horizon, RR geometry, confidence, volatility, liquidity, regime, entry gap, holding bucket), 67 are significantly negative and **none is positive** — there is no tradable subgroup hiding inside the aggregate.
3. PSX costs roughly double the loss (cost drag 92.6% of gross on validation, 232.8% on final test).
4. Win rates of 35–51% cannot survive an average loser 1.5–3× the average winner; ~19% of trades never reach TP or SL within 21 sessions (TIME_UP), locking capital without payoff.
5. Cash (no-trade) dominates every strategy, every selection rule and every filter (`task105_baseline_comparison.json`).

## What was checked for defects (all clean)

Raw/adjusted price mixing, symbol mapping, suspended/stale handling, ATR window, TP/SL direction validity, prediction-unit scaling, inverse transforms, horizon mismatch between target and strategy, entry timing, same-candle SL/TP ambiguity (resolved SL-first — the conservative choice), scale-out leg double-counting, cash reuse before close.

## Two capital-protection findings (not computation bugs)

- **CP-1:** SELL/SHORT signals are displayed (ai-model-signals, ensemble mapping) and simulated (Investment Simulator `direction=SELL`) although PSX retail short-selling rights are unverified. Historical Task 100–104 results are unaffected (all 11,521 trades are long-only). Disposition: research-only labeling (see `task105-capital-protection.md`).
- **CP-2:** Confidence values shown in the UI (heuristic RSI-derived scores, ensemble agreement %) are not calibrated win probabilities. See `task105-confidence-calibration.md`.

## Method notes

All analysis is `development_only` over the frozen Task 100–104 cohort. No threshold was re-optimized on final-test data. The contrarian (sign-flip) observation is recorded as a research hypothesis only (`task105_contrarian_hypothesis.json`) — it assumes unverified short rights and identical fill geometry, and cannot be promoted from already-inspected data.
