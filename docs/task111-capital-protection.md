# Task 111 — Capital Protection (Research Overlay)

Policy ID: `task111-capital-protection-v1` (mirrored in `src/lib/latent/llm/stock-signal-engine.ts` and
`scripts/task111_lib.py`).

## Rules

| Rule | Value | Effect |
| --- | --- | --- |
| Max risk per position | 2% of account equity | position not entered if the ATR-based stop risk exceeds it |
| Max combined open risk | 6% | blocks new entries beyond the cap |
| Max exposure | 100% | no leverage, ever; cash-constrained whole shares |
| Drawdown alert | 5% | new position budgets halved |
| Drawdown pause | 10% | no new entries until recovery; a research LLM BUY is downgraded to NO_TRADE with the reason recorded |
| Min evidence quality for a BUY | 35/100 | thin evidence cannot open a position |
| Min net R:R | 1.5 default (family 1.0/1.5/2.0 predeclared) | deterministic gate; LLM cannot relax it |

## Where it is enforced

- **Per signal** (`stock-signal-engine.ts`): capital-protection triggers are checked after the LLM output and after the
  deterministic R:R engine; a BUY failing any trigger is downgraded to NO_TRADE with an explicit reason.
- **Per session** (`task111_lib.run_portfolio_overlay`): the overlay engine applies sizing multipliers and pauses without
  ever modifying entry signals.

## Guarantees — and their limits

These are simulated protective rules for research accounts. They are **not guarantees against price gaps**, liquidity
losses, or halts; a stop-loss is an instruction concept, and the shadow pipeline executes nothing. No real broker orders
exist anywhere behind these controls (verified by the regression suites: `allowRealTrades: false`, no short paths).

Scenarios are documented in `task111_capital_protection_scenarios.json`; the enforcement report is
`task111_capital_protection_report.json`; the measured effect of the drawdown/volatility overlays on the historical
golden-cross account is in `task111_volatility_overlay_backtest.json` and `task111_drawdown_comparison.json`.
