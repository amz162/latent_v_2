# Task 107 — 15-Minute Delayed Data

## Verified provider capability (OpenAPI + live probes)

- Endpoints: `/health`, `/stocks`, `/stocks/{sym}/historical` (DAILY OHLC), `/stocks/{sym}/quote` (delayed snapshot), fundamentals, indices, sectors, screener, debt, eligible-scrips.
- **No candle/intraday endpoint exists.** Historical rows are daily bars (`date, open, high, low, close, volume, is_anomaly`).
- The quote response carries **no source market timestamp** — only `meta.timestamp` (server retrieval time, tz-aware) and a `cached` flag.
- Status: quotes = `delayed_snapshot_only`; historical = `daily_ohlc_only`; candles = `intraday_unavailable`.

## The three distinct concepts (never conflated)

| Field | Value | Basis |
|---|---|---|
| `provider_delay_minutes` | 15 | user-observed schedule (09:45 first .. 15:45 final) |
| `bar_interval_minutes` | null | no candles exist |
| `poll_interval_seconds` | 120 (configurable) | our fetch frequency |

## Post-session evidence

After the close the quote price equals the session's verified daily close for every matched symbol (2026-11-03: 22/22 → `eod_verified`), consistent with a delayed final update ≈15:45 PKT.

## Consequences

- Every snapshot stores `retrieved_at` (real) and `market_timestamp` = `estimated_source_timestamp` (retrieved − 15 min), explicitly labeled estimated.
- The delay is never used as proof of 15-minute OHLC; no OHLC is manufactured around snapshots.
