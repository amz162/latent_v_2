# Task 111 — Technical Indicators and Price Patterns

## Technical indicators (Phase 7 — audit of what ACTUALLY exists)

The inventory (`task111_technical_indicator_inventory.json`) records only implemented indicators — nothing is included
merely because documentation mentions it:

| Indicator | Source | Notes |
| --- | --- | --- |
| SMA7/SMA30 + Golden/Death Cross | `golden-cross.ts` (computeGoldenCross) | unchanged task110 definition |
| ATR14 + SL/TP1-3 policy | `risk-levels.ts` | policy `atr14-1.5-1-2-3` (task77-v1) |
| CC / Parkinson / Garman-Klass variance | `volatility-analytics.ts` | annualized exactly once |
| BBW + first/second derivatives | `volatility-analytics.ts` | 20-session, 2 stdev, session-gap aware |
| Price patterns / zones / volume stats | `price-patterns.ts` | the live Pattern Finder engine |
| External technicalchart | `/api/psx/technical/[symbol]` → askanalyst | documented, NOT used as evidence math |

RSI/MACD/ADX/EMA/Stochastics are **not locally implemented** (the Technical tab proxies the external technicalchart
API), so they are excluded from the LLM evidence rather than pretended in. Per-symbol coverage is in
`task111_indicator_data_coverage.csv`; the evidence schema is in `task111_technical_evidence_schema.json`.

## Price pattern finder (Phase 8 — point-in-time safe)

`src/lib/latent/technical/price-pattern-finder.ts` wraps the existing deterministic engine with a PIT guarantee:

- Given a decision index, ONLY bars `[0..index]` are fed to the engine — future candles are structurally excluded and
  the count excluded is recorded per symbol.
- Patterns whose most recent manifestation date equals the decision date are `unconfirmed_candidate`; older
  manifestations are `confirmed_historical`; a candidate is never called confirmed before its confirmation rule fires.
- The LLM may interpret engine output but never invents a formation.

Artifacts: `task111_price_pattern_report.json`, `task111_price_pattern_coverage.csv`,
`task111_pattern_confirmation_audit.json` (verdict PASS: no future confirmation).
