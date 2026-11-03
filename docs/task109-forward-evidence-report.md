# Task 109 — Forward Evidence Report

Generated: 2026-11-03 (UTC). HEAD at generation: see `task109_final_summary.json`.
All numbers are recalculated from the live store, not copied from Task 108.

## Campaign state

| Entity | Count | Notes |
|---|---|---|
| Forward observations (decisions) | 57 | 3 frozen generations, never merged |
| Independent decision dates | 3 | 2026-10-29 (12), 2026-11-02 (22), 2026-11-03 (23) |
| Unique symbols | 23 | pilot-25 universe minus structural provider gaps |
| Matured strategy outcomes | 43 | strategy-outcome level (observation × 3 strategies) |
| Wins / losses | 13 / 30 | net of `computeTradeCostsV2`, psx_user_schedule_v2 |
| Pending | 59 strategy-outcomes / 30 unique decisions | neither wins nor losses |
| Unfilled signals | 23 | never entered (no long entry trigger) |
| Realized net P&L | **−PKR 102,348.02** | recomputed == frozen Task 108 value |
| Unrealized (engine daily marks) | −PKR 53,867.96 | separate estimate, never realized |
| Unrealized (monitor snapshot) | −PKR 35,151.75 | second estimate of the same exposure |

## Headline forward metrics (completed outcomes only)

- Win rate **30.2 %** (13/43); net expectancy **−PKR 2,380.19** per outcome.
- Profit factor **0.09**; average winner +PKR 786.56 vs average loser −PKR 3,752.44.
- Max drawdown (chronological cumulative realized) **−PKR 102,348.02**.
- Per strategy: `fixed_first_hit` 0/4 wins, `max_tp_step_trailing` 0/5, `scale_out_50_25_25` 13/34 (38.2 %).

## Interpretation (honest)

The forward campaign is **negative after V2 costs** at this sample size. The two
non-scale-out strategies have not produced a single net win. No confidence bucket
shows exploitable association (the mid bucket holds 41 of 43 outcomes). Evidence
gate: **collecting** — promotion remains **blocked**; the negative result is
reported as-is and nothing is re-tuned to change it.

## Horizon accounting (actual DB trading calendar)

Sessions elapsed after each decision date: gen1 **3 of 21**, gen2 **1**, gen3 **0**.
The first complete 21-session evaluation is projected for early December 2026 from
the real session cadence; it is **not** claimed to have matured. 5-session maturity
for the earliest cohort requires two more verified sessions.

## New evidence since Task 108

**Zero new trading sessions** — the worker was deployed after Monday's close and
the next window opens 2026-11-04 09:45 PKT. Session-dependent measurements are
marked `awaiting_future_observations` in their artifacts; the worker collects
them automatically and `python3 scripts/task109_runner.py --phase 3` refreshes
the reports after any session.
