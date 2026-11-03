# Task 107 — Shadow Evidence Interpretation

## What the numbers mean (and do not mean)

- `directional_score` — frozen-protocol model output. Not a probability.
- `ensemble_agreement` — not computed for shadow generations; never substituted for a probability.
- `predicted_net_positive_probability` — modeled P(net-positive 21-session TP/SL trade); research-only.
- `calibrated_probability` — isotonic on the Task 104 validation split; carries
  **"Probability calibration not established"** (Task 105 evidence: Spearman ≈ −0.002..−0.07).
- `no_trade` with a machine reason — the Task 105 policy is unchanged by new data.
- MTM values are unrealized marks, not performance.
- Distinguish always: positive forward stock-return ≠ positive completed trade ≠ TP-before-SL ≠ net-positive position.

## Reading small samples

All Task 107 reports mark metrics `insufficient_sample` below the stated thresholds, show counts,
and never rank strategies/models into a leaderboard. New observations are never pooled with the
examined Task 100–105 record and called untouched-OOS.

## Current evidence (2026-11-03)

4 matured unique trades (all SL, −PKR 75,548.35 realized), 90 pending MTM (−PKR 53,867.98 unrealized),
57 observations across 3 decision dates (2026-10-29, 2026-11-02, 2026-11-03), zero no-trade exceptions.
Campaign state: **collecting / insufficient_matured_trades / not_promotable**.
