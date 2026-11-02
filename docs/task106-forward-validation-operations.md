# Task 106 — Forward Validation Operations

## What happened on 2026-11-02 (first genuine forward progress)

1. **Data frontier advanced 2026-10-29 → 2026-11-02.** The app's own approved free provider (`psxdata-api.fastapicloud.dev`, the same `psxdata` source already in `OhlcvBar`) returned two genuinely new PSX sessions. Overlap validation: 48/48 bars identical to previously verified DB rows. 44 new bars were imported through the **Task 103 controlled-drop importer** (staging, SHA-256 manifest) and promoted with `(symbol, date)` dedup after backing up the DB (`db/backups/custom_pre_task106.db`).
2. **Task 105 gen1 entries filled.** All 12 `task105-gen1` observations had their hypothetical entry (2026-10-30 open) become real. The frozen gen1 store was NOT modified — fills live in the Task 106 maturation ledger.
3. **22 new `task106-gen2` observations** were recorded at the 2026-11-02 frontier using the frozen Task 104 protocol (no retraining, no threshold changes), Task 105 policy (all `no_trade`), and production `computeRiskLevels`.
4. **First genuinely matured forward trades.** The maturation engine (`scripts/task106_mature.ts`, production `simulateStrategy`, V2 costs) resolved 4 unique trades (12 strategy-outcomes — the three strategies share identical SL-first exits): SYS, KEL, CNERGY, PAEL — **all stop-loss losses**, realized total ≈ **−PKR 75,548**. Far too few for inference, and consistent with the frozen negative-edge finding. 24 strategy-outcomes remain pending mark-to-market; MTM is never counted as a win.

## How to run the pipeline (every future session)

```
python3 scripts/task106_runner.py run refresh      # validate + import + promote new sessions
bun scripts/task105_phase8_levels.ts <date> <out>  # production levels at a new frontier
python3 scripts/task106_phase5_6.py                # gen2 observations + maturation + gates
python3 scripts/task106_tests.py                   # QA
```

All steps are idempotent (SHA-256 manifests, `decision_id` merge, `INSERT OR IGNORE`).

## Maturity rules

- Entry fills only at the first session **after** the decision date.
- Terminal SL/TP3 exit within available bars → matured (full net, V2 costs).
- TIME_UP counts only at 21 full sessions; otherwise pending MTM.
- Distinguishes positive forward return / positive completed trade / TP-before-SL / net-positive completed position — never interchangeable.

## Evidence gates (minimum review conditions, not an approval formula)

≥100 matured trades · ≥2 calendar quarters · ≥15 symbols · >1 regime · positive net expectancy after actual costs with statistical uncertainty quantified · stable performance/drawdown · no leakage (verified) · calibration stability. Currently **1 of 9** met (leakage) → `not_promotable`; campaign state `collecting`.
