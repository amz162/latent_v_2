# Task 105 — Production Readiness

## Verdict

The platform is production-ready **as a research and education product with capital protection active**. It is explicitly NOT ready — and must not be presented — as a profitable trading system: no model or strategy has demonstrated positive net expectancy after real PSX costs (Task 104: 0/60 configurations; Task 105: no FDR-surviving positive subgroup, cash dominates every baseline).

## What is verified working

- **Build:** `next build --webpack` exits 0; `tsc --noEmit` clean.
- **APIs:** `/` 200, `/api/data-readiness` 200, `/api/ai-model-signals/<symbol>` 200, `/api/models/registry` 200.
- **Headless browser:** home renders, AI Models view opens, the "Research / shadow mode" capital-protection notice is visible.
- **Cost engine:** `psx_user_schedule_v2` default; sim/engine/strategy/portfolio paths reconcile within PKR 0.01 (10/10 fixtures); `legacy_standard_psx_v1` compatibility retained.
- **QA:** 25/25 deterministic checks (see `task105_test_summary.json`): direction, targets, timestamps, horizons, cutoffs, TP/SL geometry, entry logic, costs, cash, sizing, no-trade logic, confidence semantics, calibration, shadow-only behavior, no-live-order guarantee, idempotency, historical immutability, DB integrity.

## Disposition matrix

| Surface | State | Labeling |
| --- | --- | --- |
| AI Models / signals / consensus | research_only | CapitalProtectionNotice + honest metrics (win rate, negative R² shown as-is) |
| Investment Strategy | research_only | compact notice |
| Portfolio Simulation | research_only | notice inside dialog |
| Paper trading / shadow observations | shadow_only | `task105-gen1` namespace, `awaiting_data` |
| Live order execution | no_trade | no code path exists; policy forbids adding one implicitly |

## Known limitations (data, not software)

- No licensed intraday or real-time feed: forward observations wait at the 2026-10-29 frontier (`awaiting_data`).
- Corporate actions, point-in-time fundamentals and index records remain unavailable — unchanged from earlier tasks.
- Daily-bar execution realism (SL-first conservative tie-breaking).

## What would change the verdict

Only genuinely new forward evidence: ≥100 matured trades across ≥2 quarters, ≥15 symbols, >1 regime, positive net expectancy after real costs with CI support, acceptable drawdown, no concentration, calibration stability — then an explicit versioned policy review. Until then the correct production posture is exactly the current one: research, shadow, and clear NO-TRADE explanations.
