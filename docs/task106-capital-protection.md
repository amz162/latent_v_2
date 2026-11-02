# Task 106 — Capital Protection

Task 105 introduced `trading-policy.ts` (v1). Task 106 audited it and extended it; all defaults hold.

## Verified safe defaults (source: `task106_capital_protection_audit.json`)

- `allowRealTrades: false` · `allowLiveOrderExecution: false` · `allowAutomaticPromotion: false`
- `presentConfidenceAsWinProbability: false`
- No unsupported short entries (`SHORT_SELLING_COMPLIANCE.status = "compliance_unverified"`; `classifySellAction` exhaustive fixtures)
- NO-TRADE with a reason whenever evidence is inadequate
- No positive-profitability claim for the negative historical record

**Bypass scan: zero hits** — no order-placement code exists in `src/`, and no code path sets the dangerous defaults to true.

## Surfaces (all using the real policy state, not hardcoded text)

AI Models · Investment Strategy · Portfolio Simulation dialog — `CapitalProtectionNotice` renders `CAPITAL_PROTECTION_POLICY.historicalEvidenceNote`. Backtesting reports, Signal Stats and paper-trading dashboards remain fully browsable as historical/research surfaces with honest labels; nothing was made unusable.

## Task 106 hardening

- A no-op re-run of the Task 105 generator can no longer rewrite frozen Task 105 artifacts (guard added after the Task 106 QA suite caught a timestamp-only diff; files restored byte-identical to git HEAD).
- `task106_no_trade_path_tests.json`: 6/6 path tests pass, including "positive expectancy + huge sample still cannot self-promote".
- The Task 103 staging ledger is recognized as an append-only operational record (its growth is by design; reports remain immutable).

## Promotion

Remains impossible by construction: `evaluatePolicyState` cannot return `promoted`; gates currently 1/9 (leakage check only). See `docs/task106-model-promotion` context in Task 105 and `task106_evidence_gate_report.json`.
