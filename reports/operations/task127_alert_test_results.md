# Task 127 — Alert Engine & Monitoring Tests (results)

**Date:** 2026-11-23 · **Suite:** `scripts/task127_tests.py` · **Result: 20 passed, 0 failed**

## Alert engine (`task127_alerts.py`)

| # | Test | Result |
|---|---|---|
| 1 | Fresh alert fires (fire_count=1, not suppressed) | PASS |
| 2 | Re-fire within 12 h dedup window → suppressed, `suppressed_since_last` counter incremented, fire_count unchanged | PASS |
| 3 | Re-fire after 12 h → fires again (fire_count=2) | PASS |
| 4 | WARN→CRIT severity escalation fires immediately despite the dedup window | PASS |
| 5 | Condition cleared → single `recovered` event, state marked recovered | PASS |
| 6 | Recovery not duplicated on the next evaluation | PASS |
| 7 | Alert record completeness: id, severity, timestamp, component, affected, reason, action all present | PASS |
| 8 | Journal shape: suppressed alerts are **not** written to `alerts_log.jsonl`; fired alerts and recoveries are | PASS |

## Cohort protection & paper-mode enforcement

| # | Test | Result |
|---|---|---|
| 9 | Baseline realized net unchanged on re-run: **−707,370.97 PKR** (frozen cohort) | PASS |
| 10 | Baseline state counts unchanged: closed 78 / open 3 / pending_entry 33 | PASS |
| 11 | Monitor opens `db/custom.db` **read-only** (`mode=ro`) | PASS |
| 12 | Monitor contains no INSERT/UPDATE/DELETE (never writes the ledger) | PASS |
| 13–16 | No `sharpe` / `sortino` / `roi` / `max_drawdown` keys anywhere in the emitted `task127_daily_health.json` (schema walk, not a source grep) | PASS ×4 |
| 17 | No broker/order endpoints in the monitoring stack | PASS |
| 18 | Registry contains the frozen baseline `C20261029` row | PASS |
| 19 | Registry baseline metrics match the ledger (realized −707,370.97, closed 78) | PASS |
| 20 | Forward cohorts (if any) reported separately from the baseline | PASS |

## Live behaviour observed on 2026-11-23

- First monitor run: exactly one **true-positive** alert — `glm_generation_failure` (WARN): the ingest evidence is dated today but no GLM decision has been generated since 2026-11-04 (the Task 124 contract gap). Written to `alerts_log.jsonl` with severity/timestamp/component/affected/reason/action.
- Second run: the same alert was **suppressed** by the 12 h dedup window (`alerts_suppressed: ["glm_generation_failure"]`), no duplicate journal line — exactly the designed noise control.
- Recoveries: none pending (no previously-fired alert has cleared yet).

## Production verification status

- Engine, tests, report and registry: **implemented and verified locally.**
- Scheduled production execution of the monitor: **NOT VERIFIED** — blocked by the Task 124 contract gap (no installed 17:30 PKT executor yet). Recommended operator step: append `python3 scripts/task127_monitor.py` to `task123_daily_pipeline.sh` step 5 or the Actions extension.
