# Task 110 — Daily Portfolio Ledger & Account Identity

The Golden Cross simulation is a **cash-constrained, daily-marked account**, not a list of trades. Every trading session produces one portfolio row — even when nothing happens.

## Ledger fields (`task110_golden_cross_daily_ledger.csv`)

| Field | Meaning |
|---|---|
| `date` | PSX session (provider calendar) |
| `symbol` | `PORTFOLIO` for account rows |
| `close/ma7/ma30` | blank on portfolio rows; populated on per-symbol event rows in the MA/signals CSV |
| `signal` | crossovers observed at that session's close (queued for next-session execution) |
| `action` | fills executed at that session's open (sells before buys, alphabetical) |
| `position_after` | number of open positions |
| `cash_balance` | cash after entry/exit cash flows for the day |
| `invested_capital` | market value of open positions at last valid closes |
| `realized_pnl_cum` | cumulative **net** realized P&L (after full V2 costs) of closed trades |
| `unrealized_pnl` | open-position market value minus entry value, minus their sunk entry costs |
| `costs_today` | all fees/CGT charged that day (buy side charged on entry day, sell side + CGT on exit day) |
| `total_net_pnl` | portfolio equity − initial capital |
| `portfolio_equity` | cash + invested capital |
| `current_drawdown` | equity − running peak equity |

The full ledger is printed to the CLI (head + tail) when the phase runs and saved as CSV; the dashboard serves the last 250 rows plus the equity curve.

## Cost methodology

Production pathway `computeSimTradeCosts` → `computeTradeCostsV2`, profile `psx_user_schedule_v2`:

- Brokerage: **PKR 0.03/share fixed when price ≤ 20**, else **0.15%** of transaction value — per side.
- PSX fee 0.00035% + NCCPL 0.00081% + CDC 0.0036% — per side, on transaction value.
- Slippage: **zero** (V2 uses real gap-aware fills only).
- **CGT 15% (ATL) / 30% (non-ATL), charged once per completed position** on aggregate positive gross P&L — never per leg, never on losses. ATL and NON-ATL scenarios are reported separately.

No double-charging: entry costs leave cash on the entry day; exit costs + CGT on the exit day; the per-trade `total_costs` column aggregates both exactly once.

## Return integrity (enforced + tested)

```
ROI            = (final_equity − initial_capital) / initial_capital × 100
final_equity   = cash + open-position market value
identity       : realized_net + unrealized_net_of_entry_costs == final_equity − initial_capital
```

- Per-trade expectancy is never called account ROI.
- Unrealized MTM is **never** counted as realized profit anywhere in the pipeline.
- The ledger identity is checked to the cent by `task110_tests.py::test_ledger_identity` (holds exactly: −36,730.07 + (−2,551.70) = −39,281.77 on the headline run).

## Trade ledger

One row per completed round trip: signal date, execution date, symbol, entry/exit prices (next-session opens), shares (whole), gross P&L, total V2 costs, net P&L, return %, holding sessions, win/loss, closing reason (`DEATH_CROSS`). Open positions are listed separately with unrealized MTM.

## Headline result (default: PKR 100,000, 20% sizing, max 5 positions, ATL)

Final equity **PKR 60,718.23** (ROI **−39.28%**, CAGR −5.0%), 363 trades, win rate 27.0%, profit factor 0.87, expectancy −PKR 108/trade, total costs PKR 78,868, max drawdown −PKR 87,775, longest loss streak 24. Sensitivity across 5/10/25% and equal-alloc sizing, plus NON-ATL, is in `task110_golden_cross_portfolio_results.json` — **every configuration is negative net of costs**; the strategy remains a research candidate only.
