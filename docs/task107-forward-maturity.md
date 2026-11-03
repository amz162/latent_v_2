# Task 107 — Forward Maturity

## Rules (unchanged, now automated)

- Entry fills only at the first session AFTER the decision date.
- Terminal SL/TP3 exit within available bars → **matured early** (full net, `psx_user_schedule_v2`).
- TIME_UP maturity requires **21 full trading sessions** (actual DB sessions; calendar days never substituted).
- Otherwise the position is **pending MTM**: unrealized value of the open remainder at the latest
  verified close, reported separately, never counted as a win or as realized P&L.
- Costs: production engine (`simulateStrategy` → `computeTradeCostsV2`); scale-out legs costed per leg.

## Current state (2026-11-03)

- 4 unique trades matured early (12 strategy-outcomes; all SL) — realized **PKR −75,548.35** (deterministically reproduced twice).
- 90 strategy-outcomes pending MTM (unrealized ≈ **PKR −53,867.98**, kept strictly separate).
- 21-session maturities: earliest ≈ 2026-12-01 **if** genuine sessions occur — see `task107_21_session_maturity_plan.json`.
- Ledgers: `task107_realized_trade_ledger.csv`, `task107_pending_positions.csv`.

## Evidence gates

Unchanged: ≥100 matured trades, ≥2 quarters, ≥15 symbols, >1 regime, positive net expectancy after
costs with quantified uncertainty, stability, no leakage, calibration stability. Currently 1/9 →
`not_promotable`. A few wins or losses never change thresholds or policy.
