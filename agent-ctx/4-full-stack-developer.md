# Task ID 4 — full-stack-developer

## Task
Issue 1 (AI Models live current price) + Issue 14 (Tracker Signal History).

## Work Log
- Read prior work in /home/z/my-project/worklog.md (Tasks 0-3) and confirmed:
  * `getLiveQuote(symbol)` lives in `src/lib/latent/liveQuote.ts` (server-side, 60s cache, returns number|null).
  * `GET /api/signals/all` returns the final ensemble-consensus signal list for ALL ~361 stocks (284 actionable BUY/SELL after R:R≥1:2 filter) with LIVE price overlay + outcome (`TP3_HIT`/`TP2_HIT`/`TP1_HIT`/`SL_HIT`/`ACTIVE`) + `pnlPct` already evaluated server-side via `evaluateOutcome()` in liveQuote.ts.
  * `GET /api/psx/live?symbol=SYM` wraps the same upstream (`psxdata-api.fastapicloud.dev/stocks/{sym}/quote`) and returns `{ ..., price, mode:"live" }`.

### Issue 1 — `src/components/latent/AiModelSignals.tsx`
- Imported `Loader2` from lucide-react.
- Added three pieces of state: `livePrice:number|null`, `liveLoading:boolean`, `liveFailed:boolean`.
- Added a new `useEffect([symbol])` that fires on symbol change and fetches `/api/psx/live?symbol=...`. On success with `j.price>0` → `setLivePrice(j.price)`. On any failure → `setLiveFailed(true)` (keeps `livePrice=null` so the UI falls back to `data.currentPrice`).
- Replaced the stale "Current Price" block (which rendered `data.currentPrice` — the ml_predictions snapshot, ~2 days old). New block:
  * While `liveLoading` → label `Live` with a spinning `Loader2` icon.
  * Once `livePrice!=null && !liveFailed` → green pulsing dot + `Live` label (in `text-[#00E676]`).
  * Else (failed or pre-load) → `Current Price` label, with a tiny `snapshot fallback` hint when live failed.
  * Price always shows `livePrice != null ? livePrice : data.currentPrice` (live preferred, snapshot fallback).
- Did NOT touch any other AI Models UI (final consensus card, ensemble breakdown, model tier cards, backtesting modal, portfolio simulation modal) — per issue 5 deferred.

### Issue 14 — `src/components/latent/Tracker.tsx`
- Imported `History` and `RefreshCw` from lucide-react.
- Added `SignalHistoryRow` interface mirroring `/api/signals/all`'s `StockSignalSummary` (incl. `livePrice`, `outcome`, `pnlPct`, `riskReward`, ensemble+model vote counts).
- Added state: `signalHistory`, `historyLoading`, `historyError`, `outcomeFilter` ("ALL"|"TP"|"SL"|"ACTIVE"), `confFilter` (0-100), `historySort` ("rr"|"conf"|"pnl").
- Added a mount `useEffect` that fetches `/api/signals/all` (cached 120s server-side) and a `refreshHistory(force)` handler that passes `?refresh=1` to bypass cache.
- Added `filteredHistory` `useMemo` that applies the outcome filter, min-confidence filter, and chosen sort (R:R / confidence / live P&L %, all high→low).
- Replaced the old "Live signals — last {timeframeLabel}" per-stock table Card (which only showed the 8 hardcoded `COVERED_SYMBOLS`) with a brand-new **"Signal History"** Card that:
  * Header: `History` icon + "Signal History" + subtitle "Final ensemble consensus across {N} PSX stocks · live price overlay · TP/SL outcome evaluated".
  * Refresh button (spins `RefreshCw` while loading).
  * Three filter controls: outcome `<select>` (All / TP hit / SL hit / Active), sort `<select>` (R:R / Confidence / Live P&L %), and a min-confidence `<input type="range">` slider.
  * Live row count chip: "{filtered} of {total} signals".
  * Loading skeleton rows / error message states.
  * Table columns: Symbol, Side (BUY/SELL badge), Entry, Live, SL, TP1, TP2, TP3, R:R, Conf., Outcome (badge with the outcome name + signed pnlPct, color-coded green/red).
- Did NOT touch: the investment simulator Card (uses the 8-symbol `stockSignals`), the timeframe selector, the 4 ensemble-stats Cards, the portfolio tracker tab (incl. its pie chart, open-positions, closed-trades — and any Backtest button in there stays, per issue 13 deferred).

## Files changed
- `src/components/latent/AiModelSignals.tsx` — +1 import, +3 state hooks, +1 useEffect, replaced 1-line "Current Price" block with a live-aware 5-line block.
- `src/components/latent/Tracker.tsx` — +2 imports, +1 interface (`SignalHistoryRow`), +1 type alias (`SignalOutcome`), +6 state hooks, +1 fetch useEffect, +1 `refreshHistory` handler, +1 `filteredHistory` memo, replaced the 54-line "Live signals" table Card with the 165-line "Signal History" Card.

## Verification
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/` → `200`.
- `curl -s -o /dev/null http://127.0.0.1:3000/api/signals/all` → `200`; sample response: `count=284`, `buyCount=30`, `sellCount=254`, first signal has `livePrice=17.5`, `outcome="TP3_HIT"`, `pnlPct=5.405` — all fields the UI consumes.
- `bun run lint` → no errors in `AiModelSignals.tsx` or `Tracker.tsx` (only pre-existing errors in `PortfolioTab.tsx` and `StockSearch.tsx`, unrelated to this task).
- `tail -n 30 dev.log` → no compile errors, app still serving 200s.

## Result
- App compiles and serves cleanly. Both issues shipped; the rest of the Tracker and AI Models tabs left intact per the deferred-issue instructions.
