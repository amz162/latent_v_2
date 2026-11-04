# Task 111 — Company Financial-Result Pattern Finder

Module: `src/lib/latent/fundamentals/company-pattern-finder.ts` (deterministic; the LLM may only summarize).

## Data

Quarterly income-statement snapshots (`data/financials/{sym}.json`, 358 symbols) parsed by the platform's existing
`financial-results.ts` loader: revenue, profit-after-tax, EPS, gross/net margins, DPS. Snapshots carry a `fetched_at`
timestamp but the underlying filings' publication dates are NOT verified point-in-time (Task 102 re-verified: 3,319
filing announcements with day-granularity dates across 24 symbols, zero verified statement publication timestamps).

## Patterns detected (all deterministic)

- Revenue trend (slope relative to mean level), YoY growth acceleration/deceleration (4-quarter lookback).
- Repeated profitability / repeated losses; net-margin and gross-margin expansion/contraction.
- EPS growth without revenue support (flagged as `mixed` with an explicit verification warning).
- Earnings-stability proxy (margin volatility).

Each pattern carries: `pattern_id`, `period_start/end`, `observation_count`, `direction`, `strength` (0-1),
`source_filing_ids`, `publication_timestamps` (always null — never fabricated), `data_quality`, `as_of_timestamp`,
`limitations`. Minimum 4 consecutive verified quarters; fewer returns `insufficient_history`. A single quarter can
never establish a repeated pattern. Balance-sheet/cash-flow fields do not exist in the snapshots, so cash-flow-quality,
leverage, current-ratio and interest-coverage patterns return `insufficient_data` honestly.

## Coverage (see `task111_company_financial_patterns.json` / `task111_financial_pattern_coverage.csv`)

All 358 snapshot symbols scanned; symbols with ≥4 quarters yield patterns; the rest honestly report
`insufficient_history`. Artifacts: `task111_company_financial_patterns.json`, `task111_financial_pattern_coverage.csv`,
`task111_financial_statement_pit_audit.json`.

## Rules honored

Period end ≠ publication date (distinct fields, publication always null here); amended statements preserved (the
snapshot file is never overwritten by Task 111); no invented earnings surprises (no historical consensus estimates exist).
