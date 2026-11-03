# Task 107 — Intraday Execution Rules

## Mode: `delayed_observation_shadow` (snapshot resolution)

On every newly received delayed observation the monitor:
1. matches it to open paper positions; 2. verifies it is new (price changed since the last stored snapshot); 3. records source (estimated) + retrieval timestamps; 4. classifies with the pure snapshot classifier; 5. updates status + P&L; 6. appends to the event ledger.

Classification (`observation_resolution_limited`):
- only SL beyond → `stop_loss_observed`; only TP beyond → `target_touched`; both flags on one daily bar → ambiguity flagged (`ambiguous_same_bar_dates`), sequence never claimed; between levels → `open`/`partially_exited`; no quote → `pending_data`; expired → `time_up`.

## What is NEVER claimed

- An actual stop execution at the nominal level (the shadow system has no resting exchange order).
- Intraperiod touches/recoveries between snapshots (`crossed_and_recovered_possible = true`).
- Precise TP/SL ordering inside a candle — even a 15-minute candle could not always order them.

## Modes kept separate

`delayed_observation_shadow` (this monitor) vs `intraday_bar_backtest` (historical simulation with documented fill assumptions — daily approximation today). Results are never merged without labels.

## Costs

Estimated exit costs use the authoritative `computeSimTradeCosts → computeTradeCostsV2` with `psx_user_schedule_v2` (ATL_15); scale-out legs costed per leg; CGT once per position. Separate fields: `realized_net_pnl`, `unrealized_gross_pnl`, `estimated_unrealized_net_pnl`, `total_position_net_pnl`.
