# Latent.pk — AI-Driven Investment Intelligence for PSX

> The plan-first PSX investment platform for salaried Pakistanis. Latent.pk cuts through market noise using predictive algorithms trained on PSX data — translating every signal (news, results, technicals, fundamentals) into a clear, personalized action plan in your language. No WhatsApp rumors, no TradingView overwhelm. Just here's the plan to reach your goal.

**Version 0.2.1** · **909 PSX-listed stocks covered** · **1,042,821 daily OHLCV bars (2016-10-21 → 2026-10-29)** · **58 canonical + 9 supplemental + 2 aliases = 69 registry entries (67 unique implementations), 8 ensembles across 10 tiers** (reconciled in Task 94) · **61 API routes**

---

## Table of Contents

- [Overview](#overview)
- [Key Features (the 10 tabs)](#key-features-the-10-tabs)
- [AI / ML Architecture](#ai--ml-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database](#database)
- [API Surface](#api-surface)
- [Getting Started](#getting-started)
- [Training & Backtesting Scripts](#training--backtesting-scripts)
- [AI Skills (z-ai-web-dev-sdk)](#ai-skills-z-ai-web-dev-sdk)
- [Development Supervisor](#development-supervisor-dev-watchsh)
- [Production Notes](#production-notes)
- [License](#license)

---

## Overview

Latent.pk is a full-stack Next.js 16 application that turns raw Pakistan Stock Exchange (PSX) data into actionable investment intelligence. It combines:

- **67 unique model implementations (58 canonical + 9 supplemental)** organized into **10 tiers**, blended via **8 ensemble aggregators** into a single final-consensus BUY/SELL signal per stock (Task 94 Phase 1 reconciliation: aliases and deterministic aggregators are not double-counted as base ML models).
- **Real OHLCV history** for 908 PSX symbols (10 years, ~1M bars) stored locally in SQLite — no per-stock live fetch needed for backtesting.
- **Live price overlays** + server-side TP1/TP2/TP3/SL outcome evaluation for every signal.
- **A 10-tab platform** covering the full workflow: news interpretation → technicals → signals → AI models → tax calculators → pattern finder → portfolio → strategy → dividends → tracker.

The whole experience is dark-themed, responsive (mobile → desktop), bilingual-ready (i18n), and built so a salaried investor gets a *plan*, not a chart.

---

## Key Features (the 10 tabs)

| # | Tab | What it does |
|---|---|---|
| 01 | **Fundamental News** | International + national news, company announcements & results — each interpreted in layman terms with stock-impact analysis. News-link interpreter, sector categorization, auto-redirect to signals. |
| 02 | **Technical Analysis** | Index support/resistance, indicator matrix (Up/Down/Accumulate), AI price prediction. Each indicator explained in plain language. |
| 03 | **Signal Section** | Per-stock BUY/SELL signals with confidence scores + layman reasoning. Fundamentals + technicals + AI model combined. Buy/Sell/Hold/Accumulate, confidence per signal, deep-dive view per stock. Final-ensemble consensus for ~361 stocks with live price + TP/SL outcome. |
| 04 | **AI Models** | 65-model ensemble across 10 tiers with backtesting per model + ensemble. Per-model "Stocks covered" badge, backtesting report (freshness chip + win-rate/avg-return/best/worst/Sharpe/Sortino/drawdown), and a per-model **actual-vs-predicted graph view** (multi-model overlay, KSE-100/all-stocks filter, tunable decision-point cadence). Search any of 361+ PSX stocks. |
| 05 | **Tax Calculators** | CGT (15% / 12.5% / 0% tiers), dividend tax (15% filer / 20% non-filer / 39% company), SIP compounding, position sizing — Pakistan Finance Act 2024 rates. |
| 06 | **Pattern Finder** | Detects fundamental patterns from quarterly results (EPS growth, margin trends, dividend consistency, CAGRs). 15-rule pattern engine, multi-line chart + quarterly summary, real financial data (22 years). |
| 07 | **Portfolio & Watchlist** | Add/remove/reorder stocks. Optional buy-price triggers P&L tracking with hold/sell/buy-more suggestions. Drag-to-reorder, P&L color coding, avg-down suggestions, live batch quotes (60s auto-refresh). |
| 08 | **Investment Strategy** | Goal-based strategy selector — dividend, yield, swing, or intraday. Goal questionnaire, strategy auto-selection, portfolio builder for income goals. |
| 09 | **Dividends** | Top-to-bottom list of dividend announcements by PSX-listed companies — sorted by yield, ex-date, amount. Latest declarations, yield rankings, ex-date alerts. |
| 10 | **Tracker** | Two-track accuracy dashboard: **Signal Tracker** (last-1-month reconstructed performance across all 908 DB stocks — total signals / win rate / avg return / best-worst, plus an Investment Simulator that guarantees the user's trade count with compounding + monthly SIP) and **Portfolio Tracker** (your open positions + closed-trades P&L + sector-concentration pie chart). |

### Investment Simulator (Tracker → Signal Tracker)
A chronological, **realized-compounding** trade-by-trade simulator:
- Enter starting capital + time period + monthly SIP + number of trades.
- Goes back N months (e.g. 3 → July 1) and trades forward to **today**, including the **current partial month**.
- SIP deposits at the 1st of each month after the start month (= periodValue installments).
- **Guarantees the user's `numTrades`** — scans all DB-backed signals, picks the closest-bar TP/SL-hitting entry per evenly-spaced slot; allows same-day entries on different stocks; HIT is always TP3/TP2/TP1/SL (no time-ups, no blanks).
- Realistic PSX costs: 0.15% commission × 2 sides, 0.15% slippage, 15% CGT on gains.

---

## AI / ML Architecture

### The 10 model tiers (58 canonical + 9 supplemental models + 8 ensembles)

| Tier | Models | Method |
|---|---|---|
| **Tier 1 — SOTA Deep Learning** | PatchTST, N-BEATS, TimesNet, Informer | Transformer-based time-series |
| **Tier 2 — Foundation Models** | Chronos (Amazon), Lag-Llama, Moirai (Salesforce), Time-LLM | LLM-tokenized / universal forecasting (requires extra packages) |
| **Tier 3 — Classical ML** | XGBoost, LightGBM, CatBoost, Random Forest, LSTM, Ridge Regression | Gradient-boosted trees + small neural nets |
| **Tier 4 — Hybrid + Specialized** | CNN-LSTM, Transformer-LSTM, TabNet, FinGPT | Hybrid architectures |
| **CL — Classical/Linear** | ARIMA, Holt-Winters, GARCH, Kalman Filter, Prophet, GRU + (CL) copies of XGBoost/LightGBM/RF/LSTM | Classic baselines for daily price series |
| **CL-2 — Calibrated Classifier Ensemble** | LightGBM-A/B, HistGBM, ExtraTrees, RandomForest, Logistic, MLP + logistic meta | Calibrated classifiers, TP1-before-SL-in-5-days target |
| **PI — Pattern & Indicator** | Linear/Logistic Regression, Pattern Matcher KNN, Neural Network | Indicator-based pattern matching |
| **GM — 4-Pillar Weighted** | Technical (35%) + Announcements (30%) + Fundamental (20%) + Macro (15%) engines | Rule-based, not ML |
| **CG — Swing-Trading Classifier** | LightGBM (CG) + XGBoost (CG) | Triple-barrier labels, 10-day horizon, 1R/2R/3R TPs, cost-aware |
| **X — 10-Strategy Meta-Labeling** | Trend Multi-TF, Breakout RelVol, Trend Pullback, RSI Divergence, BB Mean Reversion, Vol Contraction, Relative Strength, Market Regime, Meta-Label CG, Triple Barrier Dyn + LightGBM meta | 10 complementary strategies + meta-labeling |
| **Gian — Square-Root S/R** | Gian-Ensemble, Gian-Extender (GANN sq-of-9), M-Ensemble (price-touch S/R + ATR clustering) | Square-root support/resistance with odd-number rule |

### Ensembles (8 distinct registry ensembles after Task 94 reconciliation)
**Supplemental aggregators:** Majority Vote · Probability-Weighted · Tier-Weighted · Final Consensus. **Meta/rule aggregators inside the canonical registry:** CL-2 Meta-Ensemble · PI · CG (X Meta-Labeling) · Gian-Ensemble/Gian-Extender · M-Ensemble. Final signal = **Final Consensus** (≥2-ensemble agreement). Historical references to "13 blending methods" double-counted renamed/aliased variants — reconciled in Task 94 Phase 1 (`task94_registry_reconciliation.json`).

### Backtest engine
- **Runtime (TypeScript):** `src/lib/latent/model-backtest.ts → runAllBacktests()` backtests all 58 canonical + 9 supplemental models + 8 ensembles over the full 908-stock universe, close-based, walk-forward (monthly decision points over the last ~3 years). Results cached in the `ModelBacktestCache` table; surfaced in the AI Models → Backtesting Report (win rate, avg return, best/worst, profit factor, Sharpe, Sortino, max drawdown, stars, stocks-covered).
- **Per-tier offline (Python):** each tier has a `scripts/train_*.py` that trains its models AND embeds per-model backtest stats into `data/ml_predictions_multi.json`.
- **Per-model graph view:** on-demand `/api/backtest/model-graph` replays any model's predicted target price vs the actual realized close at each decision point (multi-model overlay, tunable step).

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack) + TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons + next-themes (dark/light)
- **Database:** Prisma ORM 6 + SQLite (`db/custom.db`)
- **Charts:** Recharts 2
- **Auth:** NextAuth.js v4
- **AI SDK:** `z-ai-web-dev-sdk` (LLM, VLM, TTS, ASR, image-generation, web-search — used server-side only)
- **Drag & drop:** @dnd-kit (portfolio reordering)
- **Icons:** lucide-react

---

## Project Structure

```
latent_v_2/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing (the only public route)
│   │   ├── api/                      # 61 API routes across 22 dirs
│   │   │   ├── ai-model-signals/     # per-symbol 65-model predictions + backtest
│   │   │   ├── backtest/             # investment-simulator, ensembles, signal-stats, model-graph
│   │   │   ├── signals/             # /signals/all — final consensus for ~361 stocks
│   │   │   ├── psx/                  # companies, live quotes, indices, financial-results…
│   │   │   ├── llm/                  # interpret-news, explain-signal
│   │   │   ├── ml/, pattern-recognition/, price-patterns/, result-patterns/
│   │   │   ├── portfolio/, tax/, track-record/, dividends/, plan/, onboarding/…
│   │   │   └── cron/                 # check-tp-sl (TP/SL hit checker)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── latent/                   # 20+ feature components (one per tab/flow)
│   │   └── ui/                       # shadcn/ui primitives
│   └── lib/
│       ├── latent/
│       │   ├── ensemble.ts           # ALL_MODELS (58 canonical) + 8 ensemble aggregators + final consensus
│       │   ├── model-backtest.ts     # runAllBacktests() — runtime backtest engine
│       │   ├── fallback-predictions.ts # indicator-based strategy engines (per-model signals)
│       │   ├── investment-simulator.ts # chronological realized-compounding simulator
│       │   ├── liveQuote.ts          # live price + TP/SL outcome evaluator
│       │   ├── backtest.ts           # per-symbol backtest helpers
│       │   ├── psxClient.ts          # psxdata API client
│       │   ├── store.ts              # Zustand store
│       │   ├── i18n.ts               # translations
│       │   ├── db.ts                 # Prisma client
│       │   └── …
│       └── db.ts
├── prisma/schema.prisma              # OhlcvBar, ModelPredictionCache, ModelBacktestCache, PricePatternCache, ResultPatternCache, Trade, User, Plan, RiskProfile
├── scripts/                          # Python training + backtest + precompute scripts
├── .zscripts/                        # dev supervisor + restore/autosave helpers
├── data/                             # ml_predictions_multi.json (14MB), financials/, ohlcv/, caches
├── db/custom.db                      # SQLite (908 symbols, 1M+ bars)
├── Caddyfile                         # gateway (:81 → :3000)
└── package.json
```

---

## Database

SQLite via Prisma. Key tables:

| Table | Purpose |
|---|---|
| `OhlcvBar` | Daily OHLCV history — 909 symbols × ~1,148 bars each = **1,042,821 rows** (2016-10-21 → 2026-10-29). Composite PK `(symbol, date)`. |
| `ModelPredictionCache` | Per-symbol predictions for stocks outside the original ML-trained universe (extended/fallback coverage). |
| `ModelBacktestCache` | Per-model + per-ensemble backtest stats (winRate, avgReturnPct, coveredSymbols, computedAt). 78 rows (58 canonical + 9 supplemental models + 8 ensembles + legacy alias rows, reconciled in Task 94). |
| `PricePatternCache` | Price-pattern finder output per symbol (permanent cache). |
| `ResultPatternCache` | Quarterly-results pattern output per symbol (permanent cache). |
| `Trade` | User trades (open/closed, P&L, time-to-close). |
| `User`, `RiskProfile`, `Plan` | Onboarding + goal-based plan storage. |

### DB setup
```bash
# 1. The DB file lives at db/custom.db (env: DATABASE_URL=file:/home/z/my-project/db/custom.db)
# 2. Push the schema:
bun run db:push        # prisma db push --accept-data-loss
# 3. (Optional) Restore the full 197MB OHLCV backup if you only have a schema-only DB:
bash db/restore-db.sh  # gunzips db/custom.db.gz → db/custom.db
# 4. (Optional) Populate ModelBacktestCache (per-model coverage + stats):
bun run scripts/train_missing_stocks.ts   # ~15s for 908 symbols
```

---

## API Surface

61 routes across 22 top-level directories. Highlights:

| Route | Method | Purpose |
|---|---|---|
| `/api/signals/all` | GET | Final-consensus signals for ~361 stocks + live price + TP/SL outcome |
| `/api/ai-model-signals/[symbol]` | GET | Per-symbol 65-model predictions + tiers + ensembles + backtesting |
| `/api/backtest/investment-simulator` | GET | Chronological compounding simulator (numTrades guarantee + SIP) |
| `/api/backtest/ensembles` | GET | Per-ensemble portfolio simulation |
| `/api/backtest/signal-stats` | GET | Last-N-day reconstructed signal performance across all DB stocks |
| `/api/backtest/model-graph` | GET | Per-model actual-vs-predicted series (multi-model, step, KSE-100 filter) |
| `/api/backtest/run` | GET | Per-symbol backtest runner |
| `/api/psx/companies` | GET | All PSX companies (symbol + name + sector) |
| `/api/psx/live/batch` | GET | Batched live quotes |
| `/api/psx/indices/[name]` | GET | Index constituents (e.g. KSE100 → 100 stocks + weights) |
| `/api/psx/financial-results` | GET | Real quarterly results (psxdata) |
| `/api/llm/interpret-news` | POST | LLM news interpretation with stock-impact analysis |
| `/api/llm/explain-signal/[symbol]` | GET | LLM layman explanation of a signal |
| `/api/portfolio/news-digest` | GET | LLM portfolio news digest |
| `/api/cron/check-tp-sl` | GET | TP/SL hit checker (polled every 5 min) |
| `/api/track-record` | GET | Verified track-record stats |

---

## Getting Started

### Prerequisites
- **Node.js 20+** + **Bun** (package manager / runner)
- **Python 3.10+** (only if you want to retrain models offline — `scripts/train_*.py`)
- **SQLite** (bundled — no separate server)

### Install & run
```bash
# 1. Clone
git clone https://github.com/amz162/latent_v_2.git
cd latent_v_2

# 2. Install deps
bun install

# 3. Configure env (.env)
#    DATABASE_URL=file:/<repo>/db/custom.db
#    + AI SDK keys, GitHub token (for the dev supervisor's restore-on-start), etc.

# 4. Set up the database
bun run db:push            # create tables
# (optional) restore the full OHLCV backup if your db/custom.db is schema-only:
bash db/restore-db.sh

# 5. (optional) populate per-model backtest coverage
bun run scripts/train_missing_stocks.ts

# 6. Start the dev server
bun run dev                # http://localhost:3000
```

Open `http://localhost:3000` — the landing page renders. Click **Enter platform** for the 10-tab dashboard.

### Lint
```bash
bun run lint
```

---

## Training & Backtesting Scripts

Python scripts in `scripts/` train each tier's models offline and embed per-model backtest stats into `data/ml_predictions_multi.json`:

| Script | Tier / models |
|---|---|
| `train_all_with_backtesting.py` | Tier 1–4 (PatchTST, N-BEATS, TimesNet, Informer, XGBoost, LightGBM, CatBoost, RF, LSTM, CNN-LSTM, Transformer-LSTM) |
| `train_cl_tier.py` | CL (ARIMA, Holt-Winters, GARCH, Ridge, Kalman, Prophet, GRU) |
| `train_cl2_tier.py` | CL-2 (7 classifiers + logistic meta) |
| `train_cg_model.py` | CG (LightGBM + XGBoost, triple-barrier) |
| `train_gm_model.py` | GM (4-pillar engines) |
| `train_gian_model.py` / `train_gian_extender.py` | Gian / Gian-Extender |
| `train_cl_ensembles.py` | CL-Ensemble + CL-Extender backtest |
| `train_all_db.py` / `train_all_models_db.py` | Train across the full DB universe |
| `train_missing_stocks.ts` | (TypeScript) Populate `ModelPredictionCache` + `ModelBacktestCache` for the extended universe |
| `precompute_all_pattern_caches.ts` | Precompute PricePattern + ResultPattern caches |
| `generate_backtest_pdf.py` | Generate a PDF backtest report |

Run any with `python3 scripts/<script>.py` (or `bun run scripts/<script>.ts`).

---

## AI Skills (z-ai-web-dev-sdk)

The project bundles the **z-ai-web-dev-sdk** for server-side AI capabilities (used in API routes, never client-side):

- **LLM** — news interpretation, signal explanations, portfolio digests (`/api/llm/*`)
- **VLM** — image/document understanding
- **TTS** — text-to-speech
- **ASR** — speech-to-text (audio transcription)
- **Image Generation** — AI-generated images
- **Web Search** — current-information retrieval

All invoked from Next.js API routes (server-side only per the SDK contract).

---

## Development Supervisor (`.zscripts/dev-watch.sh`)

An optional self-healing dev-server supervisor for sandboxed environments:

1. **Restore-on-start** — fetches `origin/main` + `git reset --hard` so the running app always boots from the latest pushed code (read-only, never pushes).
2. **DB restore** — if `db/custom.db` is empty/missing, gunzips `db/custom.db.gz` + runs `db:push`.
3. **Local autosave** — 60-second `git commit` loop (local only, **never pushes** — respects the standing rule "never push to GitHub without explicit instruction").
4. **Restart-on-crash** — `next dev` runs in a `while true` loop; restarts 2s after a crash.

Run it with:
```bash
bash .zscripts/dev-watch.sh
```
Manual restore anytime: `bash .zscripts/restore-from-github.sh`.

---

## Production Notes

- **Build:** `bun run build` (standalone output configured in `next.config.ts`).
- **Gateway:** Caddyfile proxies `:81 → :3000` (the only externally-exposed port in the sandbox).
- **`allowedDevOrigins`** is set in `next.config.ts` so the preview iframe (different origin) can load `/_next/*` dev assets.
- **No test files** — the project follows the convention of not shipping test code.
- **DB size:** `db/custom.db` is ~197 MB — stored compressed as `db/custom.db.gz` in git; the raw file is gitignored.

---

## Task 93 Verification Batch (2026-10-31)

All artifacts in `data/backtest_reports/task93/`. Read-only validation — NO protected artifacts modified.

| # | Verification | Result |
|---|---|---|
| 1 | Chronos expanded OOS evaluation | n=232 (was 172), dir_acc=0.517, CI=[0.453, 0.581] — NOT significant (CI includes 0.50) |
| 2 | Ensemble verification (Majority Vote) | dir_acc=0.565 @ h=5d VERIFIED (CI math matches, matrix=360 cells, within model range) — significant ONLY at h=5d |
| 3 | Full metric reproduction | 56/58 canonical models have reproduced metrics (96.6%); 2 resource_blocked (PatchTST, Transformer-LSTM — PyTorch not in 4GB sandbox) |
| 4 | Cost-aware strategy extension | 7 derived views from task81 540-cell artifact; cost drag = 22.5M PKR (285% of gross); 209/540 cells flipped gross-win → net-loss; **Variant B (net R:R ≥2.0) is ONLY profitable variant** |
| 5 | GM data provenance | Functionally COMPLETE: 25 companies covered after BYCO→CNERGY corporate-rename accounting; 3,319 filings (matches log); 12,916 ratios + 540 income stmts |
| 6 | Prospective lifecycle integrity | PASS — 114 trades all pending_entry, idempotent, 0 orphaned sources, 0 SL/TP issues, policyVersion=task76-v1 |

**Key honest findings:**
- Statistical significance holds ONLY at h=5d for the Majority Vote ensemble. h=10d and h=21d CIs include 0.50.
- Foundation models (Chronos n=232, Lag-Llama n=60) do NOT show statistically significant directional advantage on PSX data.
- PSX cost drag is severe — Variant B (net R:R ≥2.0 filter) is essential to overcome brokerage (56.57% of cost) + CGT (42.86% of cost).
- All 114 prospective paper trades remain pending_entry — statistical verification of live performance is NOT yet possible.

---

## License

Proprietary — © Latent.pk. All rights reserved.

---

**Built for the salaried Pakistani investor who wants depth without the jargon — here's the plan to reach your goal.**
