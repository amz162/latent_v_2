# Task 111 — Python Reference Implementation Audit

## Is `psx_simulator.py` available now?

**No.** The file was checked in this task's environment (`upload/`, `data/`, repository tree): it is still absent. Per
the task contract, no direct source modification is claimed, and the Task 110 finding stands: the audit was performed
against the supplied *specification*, and a corrected reference implementation was produced.

## Corrected reference implementation — verified again this task

- No artificial first MA signal.
- No same-close execution bias (signal at close t fills at next global session open t+1; unfilled never fabricated).
- Correct 7/30 crossover definition (two consecutive valid observations).
- Correct V2 costs (`psx_user_schedule_v2`): entry-side at buy, exit-side + CGT at sell, nothing double-counted.
- Correct portfolio ledger; account equation `Ending Equity = Cash + Open Position Market Value` reconciles.
- Correct Parkinson variance `mean[ln(H/L)²]/(4 ln 2)`; Garman-Klass annualized exactly once; correct BBW derivatives
  across real sessions only; missing sessions handled without fabrication.
- No synthetic-data profitability claims.

## Parity and regression evidence

- Python↔TypeScript parity harness re-run in Task 111: **15/15 checks match** (costs, MAs, crossovers, all three
  variance estimators, BBW, derivatives).
- Task 110 reference regression suite re-run: **62/62 passed**.
- Task 111's own suite (34 checks) additionally covers the new engine modules.
- Task 110's golden-cross portfolio result was independently recomputed and matches exactly (see
  `task111_task110_reconciliation.json`) — the reference implementation and the production TS path agree to the paisa.

Artifacts: `task111_python_reference_audit.json`, `task111_python_ts_parity_report.json`,
`task111_reference_regression_tests.json`. The original file's checksum from Task 110 remains documented; if the owner
supplies `psx_simulator.py` later, the direct-source audit can be executed against it without redoing the reference work.
