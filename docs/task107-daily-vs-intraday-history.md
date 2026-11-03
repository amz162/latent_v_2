# Task 107 — Daily vs Intraday History

## Two namespaces

- **`daily_ohlc_approximation`** — the historical record (Task 54, 100–106 backtests, maturity engine). SL-first within a bar is a bookkeeping CONVENTION, not a verified market sequence.
- **`delayed_intraday_observation`** — this task's snapshot store (`data/external_imports/psx_eod/task107_snapshots.db`), kept separate from the daily `OhlcvBar` dataset.

## If genuine 15-minute candles existed

They would be normalized into a bar store with key `(symbol, interval, bar_start_timestamp, provider)` and full validation (OHLC envelope, duplicates, missing intervals, ordering, session boundaries, staleness, symbol identity, corrections quarantined). TP/SL events inside one candle would still be `ambiguous_same_bar` — a 15-minute candle does not prove intrabar order.

## Today's reality

The provider supplies snapshots only → the monitor stores snapshots verbatim (no manufactured OHLC) and labels everything `observation_resolution_limited`. Symbols without quotes (HASCOL) stay `pending_data` — never fabricated. The provider offers no intraday backfill, so snapshot gaps are permanent gaps.
