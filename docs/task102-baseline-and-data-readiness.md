# Task 102 — Baseline and Data Readiness

## Starting point (verified, not assumed)

- Git HEAD `7fc1cd5b` on `main` (Task 101 delivered at `80a99d87`, worklog addenda through `529fb1f2`; the platform autosaver stacks snapshot commits on top, which are stripped at push time).
- Database: **1,042,821** daily OHLCV bars for **909** symbols, 2016-10-21 → 2026-10-29, raw (unadjusted) prices.
- Registry: 58 canonical / 13 supplemental / 71 unique implementations. The two Task 101 cost-aware models are shadow-only / research-only and stay that way unless new evidence passes the promotion gates.
- Task 54's 400-sample walk-forward report and Task 101's 11,521-trade artifacts are protected inputs; Task 102 writes everything to `data/backtest_reports/task102/`.

## Data readiness (honest statuses)

| Source | Status | Detail |
| --- | --- | --- |
| Daily OHLCV | verified | 909 symbols incl. delisted histories (no survivorship purge) |
| KSE-100 genuine | blocked_external_data | Yahoo 404, Stooq/PSX unreachable, WSJ captcha, investing.com 403, TradingEconomics 410 — adapter + unblock path provided |
| Market regime | partially_verified | internal pilot25-breadth proxy, explicitly labeled `market_internal_proxy`, never displayed as the index |
| Fundamentals | partially_verified | 24 symbols; PSX announcement dates are genuine (day granularity); statement/ratio records have period labels but NO publication timestamps |
| Corporate actions | missing | no registry exists; raw prices preserved; jump-suspicion flags computed instead |
| Intraday | provider_unavailable | no tables, no provider; adapter + synthetic fixtures only |

The Task 101 smoke reconciliation (Phase labels102) re-runs the production label engine on the same frozen grid and diffs the result against the Task 101 dataset before any new modeling.
