# AskAnalyst API — Endpoint Map & Local Data Snapshot

> **Purpose:** the sandbox's canonical reference for the AskAnalyst upstream API and
> where its data is persisted in this repo. If you need PSX data, check here first —
> do not ask the user for endpoint details again.
>
> Last verified: **2026-10-31** (all endpoints confirmed reachable, HTTP 200,
> schemas captured in `data/askanalyst/samples/`).

## 1. Endpoint map (upstream → proxy)

Base URL: `https://api.askanalyst.com.pk/api` — plain GET, no auth, requires a
browser-like `User-Agent` header. Rate: keep ≥ 350 ms between calls.

| # | Upstream URL | Latent route (proxy) | Purpose |
|---|---|---|---|
| 1 | `GET companylistwithsymbols` | `/api/psx/companies` | List of all PSX-listed companies (symbol, name, sector) |
| 2 | `GET technicalchart/day/{FROM}/{TO}/{symbol}` | `/api/psx/ohlcv/[symbol]`, `/api/psx/technical/[symbol]` | Daily OHLCV history for charting / technical indicators |
| 3 | `GET ksechartnew/{symbol}` | `/api/psx/ksechart/[symbol]` | KSE chart data (candle series + index data) |
| 4 | `GET settlementchartnew/{symbol}` | `/api/psx/settlement/[symbol]` | Settlement / badla (T+2) rates |
| 5 | `GET bss/{symbol}` | `/api/psx/bss/[symbol]` | Borrowing & short-selling (BSS) data |
| 6 | `GET iss/{symbol}` | `/api/psx/iss/[symbol]` | Insider / substantial shareholding disclosures |
| 7 | `GET financialstatement/{symbol}` | `/api/psx/financials/[symbol]` | Full financial statement (BS / P&L / CF) |
| 8 | `GET incomestatement/{symbol}` | `/api/psx/incomestatement/[symbol]`, `/api/psx/financial-results/[symbol]` | Annual + quarterly income statement (also persisted to `data/financials/{sym}.json`) |
| 9 | `GET rationew/{symbol}` | `/api/psx/ratio/[symbol]` | Financial ratios (P/E, ROE, BVPS, D/E, etc.) |
| 10 | `GET generatevaluation2/{symbol}` | `/api/psx/valuation/[symbol]` | AskAnalyst's own valuation report |
| 11 | `GET news/{symbol}` | `/api/psx/news/[symbol]`, `/api/portfolio/news-digest` | Company-specific news feed |
| 12 | `GET filings/{symbol}` | `/api/psx/filings/[symbol]` | PSX filings / announcements |
| 13 | `GET publishreports/{symbol}` | `/api/psx/reports/[symbol]` | Published research reports |

Derived consumers (routes that call the upstream indirectly):

| Latent route | Upstream used | Note |
|---|---|---|
| `/api/portfolio/news-digest` | `news/{symbol}` | Fetches news, then sends to GLM-4 LLM for summarization |
| `/api/cron/check-tp-sl` | `technicalchart/day/{from}/{now}/{symbol}` | Periodic price check for portfolio TP/SL hits |
| `/api/fair-value/[symbol]` | financials + valuation + ratio (parallel) | Uses routes 7, 9, 10 above in parallel |
| `/api/pattern-recognition/[symbol]` | financialstatement + rationew | Fetches historical ratios / quarterly financials |
| `/api/ml/signal/[symbol]` | financialstatement (per code comment) | Model trained on real PSX OHLCV from askanalyst |
| `/api/tax/dividend` | `news/{symbol}` (Option 3 fallback) | Parses dividend announcements from news |

## 2. Response schemas (captured from live responses)

Exact full fixtures: `data/askanalyst/samples/{endpoint}_ENGRO.json`.

- **companylistwithsymbols** → list of `{id, value, symbol, label (name), sector, sector_id, image}`
- **filings/{sym}** → `{data: [{date (YYYY-MM-DD), description, company_name, company_symbol, pdf (dps.psx.com.pk link), category?}], count, parameter}`
- **rationew/{sym}** → list of `{section ("Valuation"|…), data: [{label (EPS|P/E|ROE|D/E|BVPS|DPS|…), unit, data: [{year ("2013"…), value (string)}]}]}` — annual, 2013+
- **incomestatement/{sym}** → `{annual: [{label, unit, description_id, bold, data: [{year, value}]}], quarter: [{label, …, data: [{year ("Mar-24"), value}]}]}` — quarterly labels are `Mon-YY` fiscal quarters
- **technicalchart/day/{FROM}/{TO}/{sym}** → daily OHLCV series for the date range
- **ksechartnew/{sym}** → candle series + index data
- **news/{sym}**, **valuation**, **reports**, **bss**, **iss**, **settlement** → see `samples/`

Value conventions: numeric fields arrive as **strings**; ratios/financial values may be
empty `""` — always `pd.to_numeric(..., errors="coerce")`. Fiscal year labels are
year-ends ("2013", "Mar-24"); PSX fiscal years commonly end Jun-30, so assume a
conservative publication lag when building point-in-time features (annual: ~9 months;
quarterly: ~2 months after quarter end).

## 3. Where the data lives in this repo

| Path | Contents | Pulled |
|---|---|---|
| `data/askanalyst/companylist.json` | all listed companies | 2026-10-31 |
| `data/askanalyst/filings/{SYM}.json` | PSX filings/announcements, pilot25 | 2026-10-31 |
| `data/askanalyst/ratios/{SYM}.json` | financial ratios, pilot25 | 2026-10-31 |
| `data/askanalyst/index/kse100.json` | KSE-100 index series (macro proxy) | 2026-10-31 |
| `data/askanalyst/samples/*.json` | one schema fixture per endpoint (ENGRO) | 2026-10-31 |
| `data/askanalyst/manifest.json` | every pull logged: URL, counts, timestamp, status | auto |
| `data/financials/{SYM}.json` | income statements (annual+quarter), 358 symbols | 2026-10-21 |
| `data/backtest_reports/task90/raw_external_data/` | task90 snapshot (filings/ratios/income for 24 symbols, stale-2024) | historical |

## 4. How to refresh

```bash
python scripts/fetch_askanalyst.py                    # standard refresh: pilot25 filings+ratios+index+samples
python scripts/fetch_askanalyst.py --all              # filings+ratios for every listed symbol (~360 × 2)
python scripts/fetch_askanalyst.py --symbols PSO,LUCK # specific symbols
python scripts/fetch_askanalyst.py --endpoints filings,ratios,income,news,valuation,reports,bss,iss,settlement,financial
python scripts/fetch_financials.py                    # refresh data/financials/ (all 358 income statements)
```

The script is idempotent, rate-limited (0.35 s), retries twice, and appends every
pull to `data/askanalyst/manifest.json`. Commit refreshed data to git so the next
session never needs to re-fetch.

## 5. Which model tiers consume which endpoint

| Registry model | Data source | Notes |
|---|---|---|
| Announcements Engine (GM) | `filings/{sym}` | Task 98 backtest: filings event features (7d/30d event intensity + dividend/board/accounts keyword flags) |
| Fundamental Engine (GM) | `rationew`, `incomestatement` (`data/financials/`) | Task 98 backtest: point-in-time quarterly sales/EPS growth with publication lag |
| Macro Engine (GM) | KSE-100 index (`ksechartnew`) / market breadth | No CPI/KIBOR series available in sandbox — market-regime proxy documented |
| Meta-Label CG (X) | — (consumes CG component OOF) | Task 98 wires the proper OOF pipeline (TimeSeriesSplit) |
| Technical Engine (GM), X-tier strategies | SQLite `OhlcvBar` (db/custom.db) | via `load(source="db")` |
