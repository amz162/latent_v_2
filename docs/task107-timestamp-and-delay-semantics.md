# Task 107 — Timestamp & Delay Semantics

## Two times per observation

- `market_timestamp` — the market time the observation belongs to. **Estimated** for quotes: `retrieved_at − provider_delay_minutes` (15 min, user-observed), quality = `estimated_source_timestamp`.
- `retrieved_at` — when the application actually received it (provider `meta.timestamp`, tz-aware).

Example: an event belonging to 10:00 arrives at 10:15 → market=10:00 (estimated), retrieved=10:15, delay=15.

## Rules enforced

1. Trade decision timestamps are never shifted by the delay.
2. A delayed observation is never treated as known at its earlier source time.
3. Historical backtests may describe events at source market time; the forward monitor also records `detected_at`.
4. Missing source timestamps are labeled, never silently converted to verified.
5. UI shows both timestamps on every price row.

## Verified rows

`task107_timestamp_integrity_report.json` checks 09:30→09:45, 10:00→10:15, 15:30→15:45, a different delay (20 min), and tz-awareness.
