# Task ID: 47 — Agent: full-stack-developer

## Task
Price Pattern Finder (detection engine + LLM layer + DB cache + Patterns tab UI) for Latent.pk.

## Inputs used (from prior agents / foundation)
- Prisma `OhlcvBar` (db/custom.db): 1,041,396 rows, 908 symbols, 2016-10-21 → 2026-10-21. **high/low NULL for all rows → engine uses ONLY open/close/volume.**
- LLM convention copied from `src/app/api/pattern-recognition/[symbol]/route.ts` (`ZAI.create()` + `chat.completions.create({messages})`).
- View switch: `AppShell.tsx` case "pattern_finder"; nav button already in AppNav/HomeV2.
- Design language: bg #0A0E1A, cards #131829, primary #00E676, red #FF5C5C, amber #FBBF24; `.custom-scroll` utility exists in globals.css.

## Files created / modified
1. `prisma/schema.prisma` — added `PricePatternCache { symbol @id, patternsJson, summaryJson, computedAt, dataSourceDate? }`; `bun run db:push` done.
2. `src/lib/latent/price-patterns.ts` (NEW, pure TS, zero imports — shared by API route AND bun scripts):
   - 6 detectors: (1) monthly seasonality with ≥4-of-last-5-years recurrence flagging; (2) volume spikes (z≥2 vs trailing 20d avg vol) with day-move + next-5d correlation; (3) buying/selling pressure (vol ≥1.3× avg + flat/up vs flat/down; flat days split by open→close direction); (4) key price zones (2% close-price bins over last 3y, compact non-overlapping zones ≤3 bins, visits/bounces/rejections ≥1% move-away, touch-day volume vs normal); (5) gap behavior (|open vs prev close| ≥0.5%, fill = close back to prev close within 5 days, per direction); (6) post-event drift (after volume spike / 52w-high close / 52w-low close → 5d & 20d avg returns + hit rates; requires ≥250 prior bars).
   - Exact pattern JSON shape: { type, key, title, description, period, occurrences, years_seen, success_rate, avg_move_pct, confidence, evidence_dates[] }.
   - Confidence: high ≥12, medium ≥6, low ≥2 occurrences; patterns with <2 occurrences DROPPED. evidence_dates = up to 10 most recent.
   - Compliance wording baked into all engine strings ("key price zone", "pressure inferred from price + volume", no advice, no indicator jargon).
3. `src/app/api/price-patterns/[symbol]/route.ts` (NEW): loads full history via `db.ohlcvBar.findMany`, runs engine, then LLM layer (GLM) fed ONLY the engine JSON; system prompt encodes hard rules (no invented numbers, no advice, no "support/resistance", "historical pattern observation", JSON-only). Response: analysis + `llmSummary { overallSummary, notableObservations, patternExplanations: Record<patternKey,string> }`. Cache: PricePatternCache upsert, 24h freshness, `?refresh=1` bypass. LLM failure → engine-only response with `llmSummary: null` + `llmError` (graceful). 40s LLM timeout via Promise.race. 404 + suggestions for unknown symbols; `insufficient: true` + message + liquid-symbol suggestions for <60 bars.
4. `scripts/precompute_price_patterns.ts` (NEW): `bun run scripts/precompute_price_patterns.ts [--limit N] [--llm N] [--force]` — warms cache for top-N symbols by bar count (KSE100-style), engine-only by default, optional LLM for first N. Runtime-capped, logs progress. VERIFIED: `--limit 2` → ANL 13 patterns, ASC 15 patterns cached.
5. `src/components/latent/PricePatternFinder.tsx` (NEW, ~900 lines): main view. Sub-experience switch: "Price Patterns" (default) | "Financial Patterns" (→ setView("pattern_finder_financial")). Price tab: StockSearch + Analyze/Refresh buttons + header (symbol, company name, data range, bars, cached/AI badges) → AI overview card (LLM overallSummary + notable observations) → type filter chips with counts + "Evidence on chart" toggle → pattern cards (type badge, confidence badge, LLM-or-engine description, Sample size + Years seen + Avg move stat boxes, colored success-rate bar with % label, "Historical pattern — informational only" caption) → seasonality heatmap (12 cells, green/red intensity by avg return, win rate + n per cell, "recurring" ring/badge on flagged months, legend) → SVG price chart (custom, last ~2y closes, gradient fill, 5 key-zone translucent bands with touch labels, evidence-date dots colored per pattern type for top 3 patterns, hover tooltip, legend, overflow-x on mobile) → key zones panel (max-h-80 custom-scroll: price range, touches, visits, moved up & away, moved down through, touch-day volume vs normal) → pressure panel + gap stats row (2-col) → post-event drift cards (5d/20d + hit rates) → compliance footer ("Historical pattern, informational only, not investment advice" + SECP-style disclaimer line), footer uses mt-auto sticky pattern.
6. `src/components/latent/AppShell.tsx` — case "pattern_finder" → `<PricePatternFinder />`; NEW case "pattern_finder_financial" → `<PatternFinder />` (original component untouched, hosted at its own view to avoid double-AppNav nesting).
7. `src/lib/latent/store.ts` — added `"pattern_finder_financial"` to `LatentView` union.

## Verification (all done)
- `bun run lint`: 0 errors/warnings from my files (only pre-existing StockSearch.tsx `set-state-in-effect` error remains — not mine, left alone).
- curl `/api/price-patterns/ENGRO` → 200, 20 patterns, min occurrences 8, all with evidence_dates, confidence labels correct, LLM explanations present for all 20 + overallSummary + 3 notable observations. Cold 21.5s (engine ~1s + LLM ~18s), 2nd call 44ms (cached:true). `?refresh=1` recompute OK. OGDC → 18 patterns, min occ 10. DMIL (41 bars) → insufficient:true + message + suggestions. UNKNOWN1 → 404 + suggestions.
- agent-browser: / → Enter platform → Pattern Finder nav → view renders; ENGRO via suggestion chip; verified DOM: AI overview, 20 cards with SAMPLE SIZE + CONFIDENCE, 8 flagged "recurring" heatmap cells, chart with 5 zone bands ("zone Rs.256-273 · 218 touches" etc.), key zones panel, pressure + gap panels, drift cards, SECP footer. Type filters work (Seasonality (8) → exactly 8 cards), Evidence toggle ON/OFF works. Financial Patterns tab switches to the original view and back via nav.
- Screenshots: /tmp/pp_desktop.png (1280×6525 full-page), /tmp/pp_mobile.png (390×12763 full-page). No console errors (`agent-browser errors` empty), no horizontal overflow (scrollWidth-clientWidth = 0 at 390px), dev.log clean (all 200s, cache INSERT/UPSERT working).
- NOTE: dev server had to be restarted once (it was down between tool calls + needed fresh Prisma client for the new model — old process had stale client where `db.pricePatternCache` was undefined; restart with the double-paren setsid recipe fixed it).

## Decisions / compromises
- Zones capped at 3 bins (~6% width) to avoid meaningless mega-zones on trending stocks; overlapping windows eliminated.
- Gap "fill" and zone "bounce/rejection" are close-price based (high/low NULL) — documented in UI captions.
- Financial PatternFinder hosted at separate view instead of nested tab (its full-screen layout already includes AppNav; nesting would double the navbar).
- Company names: MOCK_STOCKS for 8 known symbols, else symbol-as-name (no free local name source; pypsx keys not configured in sandbox).
- Precompute defaults to engine-only (no LLM) to cap runtime; API backfills LLM lazily per request.
