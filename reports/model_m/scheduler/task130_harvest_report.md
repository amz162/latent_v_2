# Task 130 Report — 5 PM PKT Full-Harvest Scheduler (market data + scrapers + all APIs → DB)

Date: 2026-11-24 (UTC) · Repository: `amz162/latent_v_2` · Runtime: Bun + Next.js 16 + Prisma/SQLite (`db/custom.db`)

## 1. What was requested

One scheduler at **5:00 PM PKT** that, in a single run: fetches market data and
saves new rows to the DB, runs the app scraper, fetches data from all APIs,
scrapes the news and saves it in the database, and fetches company results
(ask analyst API) and saves them in the DB.

## 2. What was built

The Task 129 EOD scheduler became the full-harvest pipeline; the authoritative
host entry moved from 17:30 to **17:00 PKT Mon–Fri** (`0 12 * * 1-5` UTC).

| Stage (new order) | Script | Persists to |
|---|---|---|
| market data (fetch → validate → persist → integrity) | `task129_eod_scheduler.py` (psxdata provider, universe `all`) | `OhlcvBar` |
| **news_scrape** | `scripts/task130_news_persist.ts` | `NewsArticle`, `CompanyAnnouncement` |
| **company_results** | `scripts/task130_company_results.ts` | `CompanyResult` |
| indicators → results_patterns → maturity → lifecycle → modelm_cache → monitoring | unchanged Task 129 chain | unchanged |

Sources wired into the harvest stages:

1. **The app scraper** — the investify.pk parsing previously locked inside
   `src/app/api/scrape/{news,announcements}/route.ts` (return-only, never
   persisted) was extracted into the shared library
   `src/lib/latent/scrape/investify.ts`; the routes and the scheduler stage now
   parse identically, and the stage **persists** the results.
2. **askanalyst news + filings** — `news/{sym}` and `filings/{sym}` for the
   pilot25 shadow universe (25 symbols × 2 endpoints, rate-limited 350 ms),
   stored with synthetic URL keys (`askanalyst:news:{sym}:{id}`) because the
   API items carry no URL; filings keep the PSX PDF link in `pdfUrl`.
3. **askanalyst company results** — `companylistwithsymbols` ∩ `OhlcvBar`
   universe (361 listed) → `incomestatement/{sym}` for each; annual + quarterly
   periods parsed (revenue / gross / operating profit / net profit / EPS) with
   bank statements supported (`Mark-up/interest revenue` fallback label);
   idempotent upsert on `(symbol, periodEnd, source)`; full period record kept
   in `rawJson` for auditability.

## 3. Schema additions (36 → 39 tables)

- `NewsArticle` — unique `url`, symbol-nullable, source, category,
  publishedAt (+raw), fetchedAt, runKey.
- `CompanyAnnouncement` — unique `url`, kind (`result|dividend|agm|news|other`),
  pdfUrl, symbol/company, publishedAt (+raw), fetchedAt, runKey.
- `CompanyResult` — unique `(symbol, periodEnd, source)`, periodLabel,
  fiscalYear/quarter, revenue / grossProfit / operatingProfit / netProfit /
  eps, rawJson, fetchedAt, runKey.

## 4. Behavioral rule: harvest runs even when market data is current

Found during E2E: a re-run against the already-current frontier returned
NO_SESSION and skipped **all** stages — news/filings/results arrive
independently of the OHLCV session, so the scheduler now always runs the two
harvest stages (on new-rows runs they execute first inside the normal
downstream chain; on NO_SESSION runs a `harvest_only` pass executes them and
the ledger records every stage). On FAILED/retryable attempts (provider down)
harvest is skipped — a network outage likely affects every API, and the retry
daemon re-runs anyway.

## 5. End-to-end verification (real run 2026-11-24, 853 s)

`run --session 2026-11-23 --trigger e2e --force` (universe all, 909 symbols):

| Check | Result |
|---|---|
| Market data | NO_SESSION — universe already at frontier 2026-11-23 (correct: data current from the Task 129 full-universe run) |
| `news_scrape` | rc=0 — investify 16 news + 28 announcements; askanalyst 87 news + 3,339 filings |
| `company_results` | rc=0 — **253 symbols, 19,798 rows** (15,604 quarters, 4,194 annual; 18,354 with revenue) |
| `NewsArticle` dedup | 0 duplicate URLs |
| `CompanyAnnouncement` dedup | 0 duplicate URLs (3,367 total: 3,070 other + 269 result + 27 news + 1 result) |
| `CompanyResult` samples | MEBL Q3-2026 rev 130,215 mn / NP 25,847 / EPS 14.34; LUCK Q3-2026 rev 131,863 mn; AASM Q3-2026 loss −26 mn (bank + industrial + loss-making all parse) |
| Idempotency | second MEBL run: 0 inserted / 110 updated; second news run: same counts, no dupes |
| Run ledger | `NO_SESSION`, stages `[(market_data,0),(news_scrape,0),(company_results,0)]` |
| Integrity | `PRAGMA quick_check` ok; `OhlcvBar` untouched (1,053,205 rows) |
| Unit tests | 39/39 scheduler suite still green; `tsc --noEmit` 0 errors |

## 6. Honest gaps

- **Company-results coverage**: 253 of 361 askanalyst-listed symbols yielded
  rows; the remaining 108 return fetch failures or empty statements from the
  provider (delisted/private) — skipped and never fabricated. The stage log
  records per-symbol failures; the count is in the run ledger.
- **askanalyst news/filings scope**: pilot25 only (rate limits + payload size);
  extending to all 909 symbols is a config/loop change if the host allows the
  extra ~30 min run time.
- **investify.pk parsing fragility**: selector-based scraping of a site the
  team does not control; the shared lib keeps routes and scheduler in sync,
  but a site redesign can zero the counts (recorded honestly, never fabricated).
- **Ratios/valuation endpoints** (P/E, ROE, valuation reports) are NOT
  persisted — no tables; a future task if fundamentals need them.
- **CI fallback moved to 18:00 PKT** (after the host window) so the CI net
  cannot race the authoritative 17:00 run; a green CI run is still pending
  (Task 129 K1).

## 7. Operating commands

```
crontab scripts/crontab.txt                       # install: 17:00 PKT authoritative harvest
python3 scripts/task129_eod_scheduler.py run --force   # manual full harvest
python3 scripts/task129_eod_scheduler.py status
bun scripts/task130_news_persist.ts               # news+announcements only
bun scripts/task130_company_results.ts --symbols MEBB,LUCK  # results subset
```
