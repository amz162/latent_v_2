# Task 111 — Company Financial Analysis

Source: `data/financials/{sym}.json` quarterly snapshots via `financial-results.ts` (falls back to the existing
askanalyst income-statement API and snapshots to disk — the platform's established integration).

## What is computed (deterministic, in code)

- Revenue level + YoY growth + sequential change.
- EPS, profit-after-tax, gross margin, net margin, DPS.
- Quarters-available counter (data-coverage honesty).

## What is NOT computable (stated, not faked)

ROE, ROA, debt/equity, current ratio, operating cash flow, cash-flow quality, interest coverage — the snapshots contain
no balance-sheet or cash-flow statement. Valuation ratios (P/E etc.) would require a contemporaneous same-date close and
are only allowed when that exists.

## Layer separation

1. **Reported facts** — numbers exactly as published in the snapshot.
2. **Deterministic ratios** — computed by TypeScript/Python code, never by the LLM.
3. **LLM interpretation** — verbal views bounded by the evidence; must cite evidence sources.
4. **Missing information** — explicitly listed in each evidence package (`missing_evidence`).

## Historical availability rule (critical)

Task 102's finding is re-verified in `task111_financial_statement_pit_audit.json`: statement-level publication
timestamps remain unavailable, so fundamentals stay **disabled in historical prediction**. Current-time research analysis
is allowed with explicit freshness labeling. Period-end labels are never converted into publication timestamps.
Artifacts: `task111_company_financial_analysis.json`, `task111_financial_ratio_coverage.csv`,
`task111_fundamental_availability_report.json`.

AskAnalyst ratio/filing sample data (`data/askanalyst/`) is referenced in the source inventory; no fabrication is used
to fill gaps for the 23-symbol research universe beyond what the snapshots actually contain.
