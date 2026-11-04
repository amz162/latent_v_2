# Task 110 — Golden Cross 7/30 SMA Research Strategy

Strategy id: `golden_cross_7_30_v1` — status **`research_only`** (never in production consensus, never promoted).

## Definitions

- **MA7 / MA30**: simple moving averages of the last **7 / 30 valid PSX trading-session closes** ending at session *t*: `MA_n(t) = (1/n) Σ Close_{t-i}`. A window counts **valid** observations only — invalid bars (non-positive prices or `high < low`) are skipped, never zero-filled, and the strategy produces nothing until 30 valid closes exist.
- **Golden Cross (BUY research signal)**: previous valid `MA7 <= previous valid MA30` **and** current `MA7 > current MA30`, both from completed sessions.
- **Death Cross (SELL research signal)**: previous `MA7 >= previous MA30` **and** current `MA7 < current MA30`.
- **Equality** is its own relationship (`0`, "at"), which counts as at-or-below for a Golden trigger and at-or-above for a Death trigger. This is deterministic and tested.
- **7/30 is the user-specified configuration** — no claim is made that textbooks or market convention use these periods.
- **No artificial first signal**: the first valid observation can never signal (a crossover needs a previous relation). No repeated BUY while MA7 stays above, none repeated SELL while below.

## Signal and execution timing

1. A daily bar completes at the session close (~15:30 PKT). The signal is generated **after** that close, using only data through it.
2. The hypothetical fill is the **next valid global session's OPEN** (global session calendar = dates with ≥10 provider bars; no weekday arithmetic).
3. If the symbol has no valid bar on that next session, the signal is **not filled** — no price is ever fabricated (status `UNFILLED_NO_NEXT_SESSION_BAR`).
4. Same-close execution (a known defect of the audited prototype `psx_simulator.py`) is forbidden and tested against.
5. Costs use the production engine `computeTradeCostsV2` with `psx_user_schedule_v2` (zero synthetic slippage; real gap-aware reference prices only).

## State machine

`flat → long → (death cross pending) → closed` with explicit pending-fill handling. A death cross while flat does **nothing** (no short selling). One crossover produces at most one position.

## Where the numbers live

- Artifacts: `data/backtest_reports/task110/task110_ma_7_30_*.json/csv`, `task110_golden_cross_*.json/csv`
- Engines: `scripts/task110_lib.py` + `task110_phases_research.py` (artifacts) and `src/lib/latent/golden-cross.ts` + `/api/golden-cross` (dashboard) — **parity-tested 15/15 to match** (`task110_cost_parity_report.json`).
- Dashboard: SPA tab **"Golden Cross — 7/30 SMA"** with price/MA chart, cross markers, equity curve, complete daily + trade ledgers.

## Result (honest)

Over the full 10-year history of the 23-symbol research universe with PKR 100,000, 20% sizing and max 5 positions, the strategy is a **negative edge after V2 costs**: final equity ≈ PKR 60,718 (ROI −39.3%), win rate 27%, profit factor 0.87, max drawdown ≈ −PKR 87,775, and it loses to both cash and an equal-weight buy-and-hold basket (+30.9%). It stays `research_only`; the negative result is reported as-is.

## Limitations

- **Raw, unadjusted prices**: corporate actions appear as level jumps (flagged in `task110_price_adjustment_report.json`), which distort a long-horizon MA strategy in unknowable directions.
- Daily closes cannot prove real intraday execution quality; next-open fills are a documented hypothesis (see `docs/task110-forward-evidence.md`).
- PSX lot sizes are not verified per instrument, so sizing is plain whole shares from available cash.
