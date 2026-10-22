# Task ID: 10 — Agent: full-stack-developer

## Task
Issue 5 (AI Models portfolio simulation redesign) + Issue 13 (Tracker investment
simulator redesign) — build a shared backtest engine that both call into.

## Inputs (from prior agents / foundation)
- `src/lib/latent/psxClient.ts` — psxdata free client (listSymbols, getHistorical, etc.).
- Prisma `OhlcvBar` model — 228,092 daily bars across 100 KSE-100 stocks; access via `db.ohlcvBar.findMany({where:{symbol}, orderBy:{date:"asc"}})`.
- `GET /api/signals/all` — FINAL ENSEMBLE CONSENSUS signals for all ~284 stocks, with: symbol, signal, direction, confidence, entry, sl, tp1, tp2, tp3, riskReward, avgReturn, livePrice, outcome, pnlPct, ensemble + model vote counts. Cached 120s; `?refresh=1` bypasses.
- `GET /api/psx/ohlcv/[symbol]` — DB-first OHLCV; returns `{ ohlcv: [{date(epoch-ms), open, high, low, close, volume}], source, rowsCount }`.
- `src/lib/latent/ensemble.ts` — per-symbol ensemble computation: `majorityVoteEnsemble`, `probabilityWeightedEnsemble`, `tierWeightedEnsemble`, `computeFinalConsensus` + the `EnsembleResult` type. The per-ensemble per-symbol signals (entry/sl/tp1/tp2/tp3) live in `data/ml_predictions_multi.json`'s `cl_ensemble_predictions`, `cl_extender_predictions`, `cl2_ensemble_predictions`, `pi_ensemble_predictions`, `gm_model_predictions`, `cg_ensemble_predictions`, `x_ensemble_predictions`.

## Plan (in order)
1. Create `src/lib/latent/backtest.ts` — shared engine.
2. Create `src/app/api/backtest/ensembles/route.ts` — Issue 5 endpoint.
3. Create `src/app/api/backtest/investment-simulator/route.ts` — Issue 13 endpoint.
4. Rewrite Portfolio Simulation modal in `src/components/latent/AiModelSignals.tsx` (Issue 5).
5. Rewrite Investment Simulator section in `src/components/latent/Tracker.tsx` (Issue 13) + remove the "Backtest" button from the Portfolio Tracker sub-view.
6. Verify (curl + dev.log + agent-browser).

## Constraints (DO NOT BREAK)
- Never touch server/bootstrap files (`.zscripts/*`, `next.config.ts`, `package.json`, `Caddyfile`, `start.sh`, watchdog).
- NEVER restart/kill the dev server. Work only in `src/`, `prisma/`, `scripts/`.
- Use API routes (not server actions) for backend logic.
- z-ai-web-dev-sdk backend-only (not on client).
- Dark fintech palette: bg #0A0E1A, surface #131829, accent #00E676, text #F4F7FB, red #FF5C5C.
- Use existing shadcn components (Card, Button, Badge, Input, Label, Select, Slider, Table) + lucide-react + recharts.
- Don't break existing functionality (signal history, accuracy stats, etc.).

## Progress
- [in-progress] Reading foundation + designing backtest engine.
