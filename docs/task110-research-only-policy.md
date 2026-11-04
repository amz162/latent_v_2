# Task 110 — Research-Only Policy & Capital Protection

## Statuses

| Entity | Status | In production consensus | Executable |
|---|---|---|---|
| Task 104/109 frozen models | `not_promotable` | No — unchanged | No |
| `golden_cross_7_30_v1` (7/30 SMA crossover) | **`research_only`** | **No** | No |
| `volatility_regime_v1` (volatility regimes) | **`research_only`** | **No** | No |

- **A new strategy is not promoted merely because it beats the existing losing strategies.** The 7/30 crossover's 10-year backtest is negative net of costs anyway; even a positive backtest would only open a review path (≥21 forward sessions), never an automatic promotion.
- No conversion path exists from Golden Cross → real BUY, Death Cross → short entry, LONG VOL watch → options purchase, or SHORT VOL watch → short-option order.
- Model predictions, weights, thresholds and the isotonic calibration remain **frozen** (Task 104 protocol); the isotonic stays validation-only (no future-dated OOS calibration exists).

## Hard constraints (all enforced and tested)

1. **No real broker orders** — no order API exists in the codebase; banned-token scans over all new modules pass (`test_no_option_execution_paths`).
2. **No short selling** — a Death Cross while flat does nothing; the portfolio engine cannot represent negative share counts.
3. **No leverage / no borrowing** — cash is bounded below by 0 at every session (`test_cash_never_negative`).
4. **No unverified options execution** — options data is absent (`blocked_options_data`); regime outputs are watches only.
5. **No confidence-as-win-probability claims** — the new modules emit no confidence numbers.
6. **No positive performance claims without net-of-cost evidence** — headline results are net of V2 costs, and the headline result is negative.
7. **MTM is never realized** — enforced in accounting and tested (`test_ledger_identity`, `test_mtm_never_realized`).
8. **Historical immutability** — Task 100–109 artifacts and the frozen shadow generations are untouched; worker `ops/*` runtime state updates by design and is the only diff in those directories.
9. **No duplicate signals/positions** — the new strategy writes only to `data/backtest_reports/task110/`; the state machine admits one position per crossover.

## UI surface

- Both new dashboards carry persistent banners: **"RESEARCH / BACKTEST ONLY — not tradable advice"** (Golden Cross) and **"RESEARCH WATCH ONLY — realized vol ≠ implied vol; never an option signal"** (Volatility).
- The existing Paper Trade Monitor, its delayed-data banner, realized/unrealized separation, and generation badges are unchanged (browser regression passed).
- Registry tooltips: `golden_cross_7_30_v1` — "Research backtest only — not validated, not tradable advice"; `volatility_regime_v1` — "Realized-volatility research watch — never an option or order signal".

## Capital protection in the simulator

Whole-share sizing from actual available cash; configurable per-trade exposure (5/10/20/25%, equal-alloc) and max concurrent positions; deterministic alphabetical signal ordering (no future-return ranking); CGT 15%/30% by ATL profile; no unverified lot-size assumptions.

Artifacts: `task110_capital_protection_report.json`, `task110_model_registry_audit.json`, `task110_security_audit.json`, `task110_research_status.json`.
