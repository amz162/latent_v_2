# Task 110 — Forward Evidence (Original Campaign + New Shadow)

## Original frozen campaign (Task 104→109 protocol) — re-verified, unchanged

The Task 109 frontier evidence stands exactly as frozen; Task 110 re-verified it from the stored records and the live API:

- 57 forward decisions across three frozen generations (2026-10-29 ×12, 2026-11-02 ×22, 2026-11-03 ×23), 23 symbols.
- 43 matured strategy outcomes: **13 wins / 30 losses**, realized net **−PKR 102,348.02** after V2 costs — identical to the frozen Task 108/109 value (the live monitor API recomputes it from ledger outcomes at request time and matches to the cent).
- Session maturity on the provider calendar: gen1 **3 of 21** sessions elapsed, gen2 **1**, gen3 **0** — unchanged because the DB frontier is still 2026-11-03 (the 2026-11-04 session lands via the EOD importer after close).
- Promotion status: **not_promotable** (unchanged). Gate: collecting. No retraining, no frozen-row edits, `task100_109_artifacts_unchanged` test passes (git diff vs `origin/main` shows only live `task107/ops/*` worker-state files, which update by design).

## Delay-measurement blockers (honest)

- The provider (`psxdata-api.fastapicloud.dev`) publishes **no source timestamps** and no candle endpoint; the 15-minute delay remains an **assumption**, labeled estimated everywhere.
- Complete in-session capture sessions (09:45–15:45 PKT): **0**. The first capture began 2026-11-04 14:52 PKT (partial). ≥3 genuine sessions are required; the worker collects automatically.
- The daily GitHub-Actions pipeline had **no recorded run yet** (first scheduled fire pending); only real run records count, not YAML existence.

## New 7/30 crossover shadow (separate, research_only)

- Signals for the 23-symbol universe are recorded at the frontier bar with MA7/MA30, relationship, crossover type, decision timestamp, data cutoff, and the explicit execution hypothesis (next valid session open — pending).
- Outcome maturity: **`awaiting_future_observations`** (0 sessions elapsed since the frontier decision date). No backtest result is ever presented as forward evidence.
- The new strategy's data lives only in `data/backtest_reports/task110/`; nothing is merged into the frozen model-prediction or shadow stores.

## Volatility forward observations

Per symbol: BBW, d1/d2, three variance estimators, regime label, market-data date, retrieval timestamp (`updatedAt`), and provenance are recorded; subsequent realized volatility tracking is `awaiting_future_observations`.

## Why historical data cannot prove intraday execution

The provider supplies delayed quote snapshots (~15 min assumed) and daily OHLC — no verified intraday timestamps, no bid/ask, no fill mechanics. A daily backtest's "next-open fill" is therefore a **modeling hypothesis**: the real fill a trader would get depends on queue position, auction behavior, and latency invisible in this data. That is why (a) backtests are labeled research/backtest-only, (b) the shadow campaign records retrieval times and never claims exchange-verified timestamps, and (c) no conclusion in Task 110 depends on intraday fill quality.

## The 5/10/21 evidence ladder

Artifacts `task110_{5,10,21}_session_maturity.json` + `task110_three_session_evidence.csv` restate per-cohort completion; the first complete 21-session evaluation projects to **early December 2026** from the real session cadence. Until then the gate review trigger stands: ≥21 completed sessions with non-negative net expectancy **and** a measured in-session delay distribution.
