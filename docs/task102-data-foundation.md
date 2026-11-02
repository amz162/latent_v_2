# Task 102 — Data Foundation (KSE-100, Market Audit, Corporate Actions, Intraday)

## 1. Genuine KSE-100 index data: `blocked_external_data`

Six permitted providers were attempted from the sandbox and **all are blocked**:

| Provider | Endpoint | Result |
| --- | --- | --- |
| Yahoo Finance chart API | `query1.finance.yahoo.com/v8/finance/chart/%5EKSE100` | HTTP 404 — symbol not carried |
| Stooq CSV | `stooq.com/q/d/l/?s=kse100` | connection failed (unreachable) |
| PSX Data Portal | `dps.psx.com.pk/api/historic` | connection failed (unreachable) |
| WSJ download | `wsj.com/.../IDXKSE100/historical-prices/download` | HTTP 401 — DataDome captcha |
| Investing.com | `api.investing.com/api/financialdata/historical/3440` | HTTP 403 |
| TradingEconomics | `api.tradingeconomics.com/markets/index` | HTTP 410 (guest tier) |

**Nothing was fabricated.** No index observations were created, downloaded or substituted. The
internal market proxy (pilot25 equal-weight 5-day breadth/dispersion) remains available and is
**always labeled `market_internal_proxy`** — it is never displayed or used as the KSE-100 index.

To unblock: place the official PSX KSE-100 EOD CSV at
`data/backtest_reports/task102/raw_external_data/kse100_official_eod.csv`, or set a permitted
vendor key in `.env`. The adapter `src/lib/market-data/kse100-provider.ts` auto-detects either
and switches its status to `verified` / `partially_verified` without code changes. While blocked,
`getKse100AsOf()` returns `null` (proven by `task102_pit_leakage_tests.json`) — never the proxy.

## 2. Market data audit (all instruments)

`task102_market_data_inventory.json` + `task102_symbol_coverage.csv` cover all **909 symbols /
1,042,821 bars (2016-10-21 → 2026-10-29)**, including delisted/suspended histories (no
survivorship purge). Statuses: 2 verified, 298 partially_verified, 609 stale (thin/zero-price
suspended sessions), 0 invalid, 0 missing. Known vendor trait: single-day envelope violations
(high < open/close) are counted per symbol and preserved raw — never "corrected" silently.

## 3. Point-in-time fundamentals

See `docs/point-in-time-fundamentals.md`. Headline: 3,319 genuine PSX announcement records
(24 symbols, day granularity) feed the PIT engine; statements/ratios carry **no publication
timestamps**, so the `technical_pit_fundamental_v1` feature group stays disabled.

## 4. Corporate actions

No registry exists and no permitted source is reachable: status `missing`. Candidate
split/bonus events (≥40% single-day moves) are detected and listed as **unverified suspects**
in `task102_corporate_actions_report.json`. Raw prices are preserved everywhere; adjusted
series are explicitly listed as not available (nothing to double-adjust).

## 5. Intraday

`provider_unavailable` — see `docs/task102-intraday-data-readiness.md`. Adapter and normalized
schema exist; synthetic fixtures are test-only; no candle is ever synthesized from daily bars.

## 6. Feature store

`src/lib/features/feature-store.ts` (`buildFeaturesAsOf`) joins OHLCV, genuine index (blocked →
labeled proxy), PIT fundamentals (publication-bounded), CA suspicion flags, sector map and
liquidity variables, all cutoff-bounded. Six groups defined in
`task102_feature_store_report.json`; only verified sources are enabled.
