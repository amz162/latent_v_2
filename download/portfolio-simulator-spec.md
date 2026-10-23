# Portfolio Simulator — Full Specification Prompt

## Overview
A portfolio simulation feature in a Next.js 16 app (Latent.pk — PSX investment intelligence) that lets users evaluate which AI ensemble model gives the best real-money gains on real historical PSX data.

## Data Sources
1. **psxdata** (free, no key, `https://psxdata-api.fastapicloud.dev`): daily OHLCV history + live quotes for all 1,048 PSX stocks. Endpoints: `/stocks`, `/stocks/{sym}/historical`, `/stocks/{sym}/quote`, `/indices/KSE100`, `/sectors`, `/screener`.
2. **pypsx** (free key, `https://paper-api.pypsx.com`): REAL intraday 1m/5m/15m/1h candles from 2025-10-20. Endpoints: `/intraday/{sym}` (1m), `/api/v1/market/historical-intraday?symbol=X&interval=5m&from=...&to=...` (5m/15m/1h), `/symbols` (full symbol+name list). Auth: `PYPSX-API-KEY-ID` + `PYPSX-API-SECRET-KEY` headers.

## Database
- **Prisma `OhlcvBar`** model (SQLite): `{symbol, date(YYYY-MM-DD), open, high, low, close, volume, source, updatedAt}`. Composite PK `[symbol, date]`. One-time backfill script (`scripts/backfill_ohlcv.ts`) fetches daily history for all 1,048 symbols → ~1M+ bars. The OHLCV route (`/api/psx/ohlcv/[symbol]`) reads DB-first (~88ms) with live fallback + auto-backfill.

## Backtest Engine (`src/lib/latent/backtest.ts`)

### Trade simulation
- **simulateOne** (ALL-stocks mode): finds the historical bar where close ≈ the signal's entry level (±1.5%). If 0 candidates → #2 pattern fallback (random bar + re-derive SL/TP from the ensemble's relative distances `sl_dist=|entry−sl|`, `tp_dist=|tp−entry|`). Holds forward `numDays` bars. Exit by TP rule.
- **simulateWindowTrade** (single-stock mode): picks a random numDays-day window (last N real bars = `[today−numDays, today]` if numDays>0, else any start). numTrades trades at random REAL bars within the window (with replacement → exactly numTrades). Enters at the bar's close (#2 pattern). Holds until TP/SL or window-end.

### TP rule (check TP3 → TP2 → TP1 → SL → time)
- Scan the hold window for: first TP3 hit, TP2 hit, TP1 hit, SL hit.
- Exit priority: TP3 (if reached) → TP2 → TP1 → SL → time-up (window end).
- TP takes precedence over SL even if SL hit first chronologically ("price goes down then up → re-apply TP rule").
- `bestTp` = the exit TP (TP3/TP2/TP1) or highest reached for SL/time exits.

### Win/loss
- Win = `netPnl > 0` (net, after costs). Loss = `netPnl <= 0`. Consistent with `isWin`.
- Costs: 0.15% × 2 sides commission + 0.50% round-trip slippage + 15% CGT on net gains.

### Metrics (per ensemble)
Starting Capital, Amount Per Trade (= capital, all-in per trade), Total Trades (BUY only) + natural count, Days + trades/day, Win Rate, Win/Loss Trades, Avg Win %, Avg Loss %, Gross Profit, Gross Loss, Total Costs (50bps+CGT), Gross Before Costs, Net P&L, Final Portfolio Value, ROI, Max Drawdown (PKR + %), Profit Factor, Sharpe/Sortino. All % to 2 decimals. All currency in PKR.

### Per-trade fields
tradeNo, symbol, signal (BUY/SELL), entryDate, closingDate, entryPrice, close (exit price), sl, Hit (TP3/TP2/TP1/SL/Close), tp1, tp2, tp3, CS (confidence score), invested, Result (✓W/✗L), P&L (net PKR), Portfolio (running equity).

### runBacktest
- Detects single-stock (all signals same symbol) → window mode. Else → ALL-stocks mode.
- Exactly numTrades trades (with replacement if fewer signals).
- `naturalBuyCount` = the ensemble's actual signal count (for display).

## 13 Ensemble Models
1. A. Majority Vote (computed from per-model predictions)
2. B. Probability-Weighted (computed)
3. C. Tier-Weighted (computed)
4. D. CL-Ensemble (LGB70+Log30) — stored in `ml_predictions_multi.json`
5. E. CL-Extender (8-model weighted) — stored
6. F. CL-2 Ensemble (7 classifiers) — stored
7. G. PI-Ensemble (4 models) — stored
8. H. GM-Model (4-Pillar) — stored
9. I. CG-Ensemble (swing-trader) — stored
10. J. X-Ensemble (10-strategy meta) — stored
11. K. Gian-Ensemble (S/R) — stored
12. L. Gian-Extender (GANN grid) — stored
13. M. M-Ensemble (price-touch S/R) — stored

Each ensemble runs on ITS OWN per-stock BUY signal (NOT the Final Consensus). Base ensembles (A/B/C) computed via `ensemble.ts` functions (`majorityVoteEnsemble`, `probabilityWeightedEnsemble`, `tierWeightedEnsemble`).

## Ensembles Endpoint (`GET /api/backtest/ensembles`)
Params: `capital`, `numTrades`, `numDays` (0=optional/any start), `symbol` (optional stock filter), `rankBy` (winRate|netPnl).
- BUY only (both modes). SELL/HOLD → technical BUY fallback (for non-ML stocks like TISL).
- Single-stock: `simulateWindowTrade` (real recent history window). ALL-stocks: `simulateOne` (find-entry-bar).
- Returns: `{top5, rest, totalEnsembles, numTrades, numDays, capital, amountPerTrade}` — each with full metrics + trade-by-trade list.
- Ranked by `rankBy` (winRate or netPnl). Prediction ranking is client-side.

## UI (`AiModelSignals.tsx` — Portfolio Simulation dialog)

### Inputs
- Capital (PKR, default 100,000)
- No of days (optional — blank = any start; given = last N real bars = today back N days)
- No of trades (exact — with replacement if fewer)
- Stock (optional — StockSearch, default ALL)
- Rank by (Win Rate | Net P&L | Prediction)
- Prediction Score (target, default 1)
- Win Rate (min %, 0-100, default 100 — ensembles with winRate ≥ this get Predict Score incremented)

### Buttons
- **Simulate** (green): runs one simulation, updates Predict Scores.
- **Automate** (amber): loops Simulate until any ensemble's Predict Score ≥ target. Resets scores to 0 on click. Shows count ("Auto (N)"). Safety limit 50. Stop button (red) to cancel.
- **View in depth — Trade by trade** (per ensemble): opens the 16-column trade table.

### Predict Score logic
- On Simulate: ensembles with `winRate ≥ winRateThreshold` → score++ (skip if < threshold — score unchanged, NOT reset).
- On Automate click: reset all scores to 0.
- On stock change: reset all scores to 0.
- Rank by Prediction: sort by Predict Score desc (client-side).

### Display
- "All ensemble models (13) — ranked by [win rate | net P&L | prediction score]"
- Each card: full metrics grid (2-col mobile, 4-col desktop). Score badge when score > 0.
- "Automate finished: N simulations run." (persistent amber badge after automate stops).
- Trade table: compact (text-[10px]), sticky header, overflow-x-auto (no dialog horizontal scroll). 16 columns: #, Symbol, Entry date, Closing date, Signal, CS, Entry, Close, SL, Hit, TP1, TP2, TP3, Invested, Result, P&L, Portfolio.

## Live Data Integration
- `psxClient.ts`: consolidated free psxdata client (listSymbols, getIndexConstituents, getHistorical, getQuote, getScreener).
- `liveQuote.ts`: batch live-quote fetcher + TP/SL outcome evaluator (for the Signals tab).
- `/api/signals/all`: final ensemble consensus signals for all ~284 stocks, with live price overlay + outcome evaluation (TP3/TP2/TP1/SL_HIT/ACTIVE).
- `/api/psx/intraday`: pypsx key-gated intraday route (1m via `/intraday/{sym}`, 5m/15m/1h via `/api/v1/market/historical-intraday`).
- `/api/psx/companies`: merged pypsx `/symbols` (506 with names) + psxdata `/stocks` (1,048) → 1,049 symbols for StockSearch.
- Technical fallback in `/api/ai-model-signals/[symbol]`: for stocks outside the 361 ML universe (e.g. TISL), generates a signal from EMA(20/50) + RSI(14) + ATR(14).

## Chart (`TechnicalAnalysis.tsx`)
- Timeframes: 1m/5m/15m/1h (real intraday from pypsx) + Daily/Weekly/Monthly (psxdata daily, resampled).
- Line ↔ Candlestick (red/green, robust `renderCandle`).
- Zoom in/out + pan buttons (data sliced to brush window — no recharts Brush).
- Controls ALWAYS visible (even on error: "Chart unavailable" + controls stay).
- DB-first OHLCV route for daily; pypsx for intraday.
