# Task 109 — Provider Delay Measurements

## What the provider actually supplies

`psxdata-api.fastapicloud.dev` returns **delayed quote snapshots** and **daily
OHLC**. It publishes **no source/market timestamp** on quote snapshots and has
**no candle endpoint** (verified structurally in Task 107's OpenAPI audit and
re-verified this task). Therefore every observation keeps:

- `retrieved_at` — real retrieval time (tz-aware),
- `estimated_source_ts` — `retrieved_at − 15 min`, **explicitly labeled
  `estimated_source_timestamp`** (never presented as verified),
- `provider_delay_minutes` — the assumed 15 (user-observed),
- `timestamp_quality` — quality flag per row.

## Measured so far

| Measurement | Value | Status |
|---|---|---|
| In-session delay distribution | — | **awaiting_future_observations** (needs ≥3 genuine sessions; 0 captured in-window so far) |
| Final-quote vs daily close (2026-11-03) | 22/22 equal | value agreement only — **not** proof of exact timing |
| Observed poll spacing (worker cycles) | 10.7–13.6 s across 3 rapid dispatch cycles | preliminary; the 120 s cadence has not yet run in-window |
| Provider symbol latency | median ≈ 559 ms, max ≈ 10.3 s | preliminary (post-window cycles) |
| Application polling interval | 120 s worker / 5-min Actions fallback | configured and heartbeat-evidenced |

## Three distinct concepts (never conflated)

1. **Provider delay** — time between the market event and the provider
   publishing it (~15 min, *assumed*).
2. **Bar interval** — the provider supplies **none** (no intraday bars; `null`).
3. **Application polling interval** — how often *we* fetch (120 s worker,
   5-min Actions fallback).

## Path to a real distribution

The worker captures in-window snapshots automatically. After ≥3 sessions,
`task109_runner.py --phase 3` rebuilds
`task109_provider_delay_distribution.json` from genuine captures. A matching
closing price remains evidence of value agreement, never of exact observation
time, and a 15-minute constant delay is **not** claimed from one or two matches.
