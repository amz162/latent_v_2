# Task 111 — Multi-Source LLM Prediction Engine (Master)

Status: `completed_with_limitations` · Generation: `task111-llm-multisource-gen1` · Research-only everywhere.

## What was built

A research-only, multi-source LLM stock-analysis engine for PSX on top of the existing Latent.pk platform:

1. **LLM provider adapter** (`src/lib/latent/llm/llm-provider.ts`) — the already-authorized `z-ai-web-dev-sdk`
   (model glm-4.6, verified live via probe). Env-configurable (`LLM_PROVIDER/LLM_MODEL/LLM_TIMEOUT_MS/LLM_MAX_TOKENS`).
   No new credentials, no paid services. Provider failures produce a controlled `llm_unavailable` state — never a fabricated signal.
2. **Evidence builder** (`src/lib/latent/llm/evidence-builder.ts`) — structured `latent_psx_llm_evidence_v1` packages per
   symbol from verified platform data: OhlcvBar DB, golden-cross.ts SMA7/30 + crossovers, risk-levels.ts ATR14 policy,
   documented realized-vol/BBW math, price-patterns.ts via the PIT wrapper, quarterly financial snapshots, and news
   (company via askanalyst API, national/international via authorized web-search snapshots). Raw DB dumps are never sent to the LLM.
3. **Signal engine** (`src/lib/latent/llm/stock-signal-engine.ts`) — evidence → completeness check → LLM → strict JSON
   validation → deterministic R:R → capital protection → research signal. The LLM never computes costs, sizes, equity or R:R.
4. **Risk/reward engine** (`src/lib/latent/llm/risk-reward-engine.ts`) — deterministic entry/SL/TP1-3 from the platform
   policy `atr14-1.5-1-2-3`, priced per leg through `computeTradeCostsV2` (psx_user_schedule_v2), whole shares, long-only.
5. **Fundamentals** (`company-pattern-finder.ts`), **news intelligence** (`market-news-intelligence.ts` with source
   registry, sanitization, prompt-injection defense, duplicate detection), **PIT-safe price patterns**
   (`technical/price-pattern-finder.ts`).
6. **Dashboard** — new "AI Analysis" tab (`AiStockAnalysisView.tsx`) + `/api/ai-analysis` routes; side-by-side LLM panels
   added to the Golden Cross and Volatility dashboards (additive only).

## Campaign results (23-symbol universe, frontier 2026-11-03)

- Real LLM signals: **22/23 valid**; 1 stale symbol honestly refused (`stale_evidence`).
- Final research signals: 20 NO_TRADE, 3 HOLD, 1 BUY — conservative abstention by design (evidence-quality and R:R gates).
- Golden Cross 7/30 baseline **reconciled exactly** (ROI −39.282%, 363 trades, PF 0.8701, costs PKR 78,867.55).
- Volatility overlays (entry signals untouched): all improved over the baseline (best predeclared: vol-target 10%,
  ROI −2.68%, drawdown −23.6% vs baseline −87.8%) — reported as hypotheses for forward validation, family presented, nothing tuned.
- Forward shadow generation `task111-llm-multisource-gen1` created; 0 matured outcomes; promotion decision `collecting`.

## Hard limitations (not hidden)

- Quarterly fundamentals have **no verified publication timestamps** (Task 102 re-verified) → current-analysis only, disabled for historical as-of use.
- No historical news archive with reliable publication times → historical LLM ablation is impossible; historical runs are `development_only`.
- No PSX listed-options data → `blocked_options_data`; realized volatility is never implied volatility.
- News retrieved live is `partially_verified`/`unverified` and is treated strictly as evidence; flagged injections are never followed.
