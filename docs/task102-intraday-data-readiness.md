# Task 102 — Intraday Data Readiness

## Verdict: `provider_unavailable` (blocked_external_data)

No legitimate intraday PSX source exists in this environment. The DB contains no intraday tables, no provider is configured in `.env`, and the PSX Data Portal is unreachable from the sandbox. Nothing was manufactured: **no intraday candle was synthesized from daily bars** and no exact intraday SL/TP sequencing was inferred.

## What was built

- `src/lib/market-data/intraday-provider.ts` — provider abstraction and normalized bar schema (1m/5m/15m/30m/1h) with strict validation; ingestion is provider-pluggable without touching the rest of the system.
- Synthetic fixtures (clearly marked, test-only) validate parsing, gap handling and session alignment — never mixed with real data.

## Execution realism today (daily-bar approximation, explicitly labeled)

- Entry: next-session open after the decision date.
- Same-candle SL-first ordering (conservative) with gap-aware fills.
- Slippage: zero under `psx_user_schedule_v2`; no defensible spread proxy from daily bars.
- Time-of-day behavior, intraday liquidity and holding-duration precision: **unavailable**.

## To unblock

Provide a permitted intraday vendor (credentials in `.env`); the adapter auto-detects it. Until then every intraday-dependent conclusion stays labeled as unavailable.

## Task 103 update (2026-11-02)

The intraday ingestion pathway is now operational end-to-end via the onboarding CLI: `python scripts/task103_import_data.py --type intraday --file <csv> --dry-run | --validate | --import`, supporting 1/5/15/30/60-minute bars with session-boundary, duplicate-timestamp, bar-integrity and volume-consistency validation, SHA-256 manifests and fixture quarantine (`quality=synthetic_fixture` rows can never enter production). No genuine intraday provider is reachable (status `provider_unavailable`), so the activation rule stands: an interval is enabled only when a verified provider actually supplies it, and all execution realism remains labeled daily-OHLC approximation.
