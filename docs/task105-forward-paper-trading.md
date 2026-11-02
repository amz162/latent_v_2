# Task 105 — Forward Paper-Trading Observation System

## Purpose

Task 100–104 historical periods are consumed as evidence. The only path to new knowledge is a genuine forward observation process. Task 105 establishes one that is immutable, idempotent and separate from all earlier records.

## Design

Pipeline (reuses Task 103's import + forward-validation conventions):

1. Read current verified market data (latest verified session: **2026-10-29**; no licensed feed is connected, so later real-world sessions are NOT in the system).
2. Build point-in-time features with the frozen Task 100/101 pipeline (22 features, bars ≤ decision date, cross-sectional ranks at the same date).
3. Generate predictions with the **frozen model version** — the Task 104 deterministic reproduction of the Task 101 protocol (RandomForest P(net>0), isotonic fitted on the validation partition only).
4. Store the decision with a unique `decision_id` (`t105gen1_<symbol>_<date>`), data cutoff, model version + hash, feature schema version, data-source versions.
5. Record all confidence values (raw score, calibrated probability, policy state).
6. Apply no-trade rules — Task 105 policy v1 → every observation is `no_trade` with reason `expected_net_value_not_positive`.
7. Record hypothetical entry (TBD until the next session is imported), SL and TP1/TP2/TP3 computed by the **production** `computeRiskLevels` at the cutoff.
8. Track hypothetical outcomes — only when sufficient future data exists.
9. Mature outcomes strictly on realized engine-resolvable sessions.
10. Apply actual V2 costs; reconcile; publish forward metrics.

## Storage

`data/backtest_reports/task105/shadow_observations/task105_shadow_observations.json` — namespace `task105-gen1`, merged by `decision_id` (re-runs add nothing). Task 103 prospective records are preserved untouched.

## Current status

- **State: `awaiting_data`.** 12 observations recorded at the frontier (symbols with a verified 2026-10-29 session; the other 13 pilot symbols are delisted/stale). 0 fills, 0 matured trades — the entry bar (next session open) does not exist in the DB yet.
- Nothing is fabricated. When a licensed feed imports sessions after 2026-10-29, the same script matures the frozen observations and starts the monitoring metrics.

## Monitoring (Phase 9)

`task105_forward_monitoring.json` tracks: independent decision dates, symbols, predictions, NO-TRADE decisions, hypothetical fills, matured trades, net expectancy, win rate, profit factor, drawdown, calibration, cost ratio, concentration, regime coverage. Reporting states: `collecting`, `insufficient_matured_trades`, `awaiting_data`, `negative_edge`, `inconclusive`, `eligible_for_review`, `not_promotable`.

## Promotion gates (minimum checks, not a formula)

≥100 matured trades · ≥2 calendar quarters · ≥15 independent symbols · >1 market regime · positive net expectancy after real costs · CI supports positive expectancy · acceptable drawdown · no severe concentration · calibration stability. No repeated significance testing without adjustment. **Currently 0/9 met → `not_promotable`.**
