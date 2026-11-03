# Task 109 — Position Maturity

## Counting rule

Trading sessions are counted from the **actual `OhlcvBar` calendar** — never
calendar days. A 21-session observation does not close because 21 calendar days
passed. The production maturity engine (`task106_mature.ts`: `simulateStrategy`
+ `computeTradeCostsV2`, `psx_user_schedule_v2`) was re-run over all three
frozen generations this task; results were **identical** to the frozen record
(43 matured outcomes, realized −PKR 102,348.02).

## Current maturity state (frontier 2026-11-03)

| Cohort (decision date) | Sessions elapsed | 5-session | 10-session | 21-session |
|---|---|---|---|---|
| 2026-10-29 (gen1) | 3 | pending (2 more needed) | pending | pending |
| 2026-11-02 (gen2) | 1 | pending | pending | pending |
| 2026-11-03 (gen3) | 0 | pending | pending | pending |

- 43 outcomes already matured **early** via terminal events (12 SL,
  30 TIME_UP-remainder full exits, 1 trailing-SL-at-TP1).
- 59 strategy-outcomes (30 unique decisions) remain pending; their MTM
  (−PKR 53,867.96 engine daily marks; −PKR 35,151.75 monitor snapshot estimate)
  is **never** counted as realized.
- First complete 21-session evaluation: projected early December 2026 from the
  actual session cadence — **awaiting_future_observations**, never claimed early.

## Execution honesty (unchanged from Task 108, re-verified)

- Resolution is **observation_resolution_limited**: the provider gives delayed
  snapshots and daily bars, never verified intraday OHLC.
- **No TP-before-SL ordering is claimed from daily candles.**
- `crossed_and_recovered_possible` is retained for every snapshot-status
  position; same-candle SL+TP1 ambiguity is flagged per position
  (`ambiguous_same_bar_dates`).
- No retrospective inference of unseen events; no historical daily-resolution
  outcome was altered (recompute == frozen, verified byte-level in
  `task109_historical_immutability.json`).

## What happens next

Each new verified session advances every pending cohort by one session. When a
cohort reaches its horizon, the engine matures it under the same frozen rules —
no new exit rules were introduced in Task 109.
