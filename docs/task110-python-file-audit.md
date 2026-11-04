# Task 110 — Audit of the Supplied `psx_simulator.py`

## Attachment status (stated first, plainly)

**The file was not present in the coding environment.** `upload/` contained only pasted task prompts; a repository-wide search found no `psx_simulator.py`. Per the task's own contract, this audit is performed **against the behavior quoted verbatim in the task specification**, every finding is labeled with that basis, and `task110_python_file_original_checksum.json` records `file_supplied: false` with the search paths. If the file is supplied later, the audit can be re-verified line-by-line and the checksum recomputed.

## Findings (19; full detail in `task110_python_file_audit.json` / `.csv`)

| Severity | Count | Headline items |
|---|---|---|
| critical | 5 | F-MA-01 artificial first-row MA signal; F-EX-01 same-close execution (look-ahead); F-VOL-01 GK annualized twice; F-PA-04 all real PSX costs missing; F-SYN-01 synthetic GARCH prices used as if market data |
| high | 6 | Parkinson annualization inconsistency; GK negatives silently `clip()`-ed; no O/H/L/C validation; hardcoded `LOT_SIZE=500`; no daily account ledger; realized/unrealized never reconciled |
| medium | 6 | run_portfolio tuple annotation vs 5-value return; capital hardcoded 1,000,000; naive fixed sizing; incomplete metrics; no benchmarks; derivatives across gaps + unsupported chart claims (BBW as "IV convexity", GK>P as direction) |
| low | 2 | hardcoded ticker/60-day/global RNG/weekday calendar/paths/suppressed warnings/missing mkdir/no input validation; indicator versioning absent |

## What "fixed" means here

The prototype was **not** patched in place (it is absent). Instead, a **corrected reference implementation** was written and is the engine behind all Task 110 numbers:

- `scripts/task110_lib.py` — crossover rules (two-consecutive-observation rule, equality convention), exact V2 cost port, validated bars, Parkinson/GK/CC estimators with single annualization, gap-guarded derivatives, regime classifier.
- `scripts/task110_phases_research.py` — cash-constrained whole-share portfolio with the complete daily account ledger, identity-enforced accounting, next-session-open execution.
- `src/lib/latent/golden-cross.ts` + `src/lib/latent/volatility-analytics.ts` — the same conventions for the dashboards, driven by the production `computeTradeCostsV2`.
- `scripts/task110_tests.py` — 62 deterministic tests, each audit finding mapped to at least one test (see `task110_python_file_test_report.json`).

Every finding carries `existing_behavior → why_it_matters → correct_behavior → fixed_in → test`, so re-auditing against the real file later is a mechanical comparison.

## Test evidence

`task110 QA: 62 passed, 0 failed` — including: no first-row signal, equality handling, no repeated crossovers, next-open-only fills, no fabricated fills, cash never negative, whole shares, CGT once per position (15%/30%), fixed-vs-percentage brokerage rule, ledger identity to the cent, Parkinson/GK/CC hand-checks, single annualization, GK negatives kept and counted, gap-guarded derivatives, and no-option/no-short/no-order code scans.

## Synthetic-data policy

The prototype's GARCH-like generator is treated as a **software-test fixture only**. Every market number in Task 110 comes from `db/custom.db` (`OhlcvBar`, source `psxdata`), and each artifact records that source.
