# Task 106 — Confidence Score Definitions

Canonical definitions live in `src/lib/latent/confidence-semantics.ts` and must be used wherever a score is displayed.

| Canonical name | What it is | Presented as probability? |
| --- | --- | --- |
| `raw_model_score` | Raw model output before calibration | No |
| `ensemble_agreement` | Share of trained models agreeing on a direction (clamped 0–100) | **No — an agreement indicator, never a win chance** |
| `directional_score` | Indicator/rule strength (RSI/EMA-derived, 50–85 heuristic) | No |
| `calibrated_probability` | Probability fitted to realized outcomes | Only with a valid calibration method AND separate evaluation evidence — none served live |
| `predicted_net_positive_probability` | P(net-positive 21-session TP/SL trade), Task 101/104 protocol (`exp_win_rate`) | Research-only; out-of-sample calibration not established |

When calibration is weak the display carries: **"Probability calibration not established."**

## UI state after Task 106

- Ensemble cards: "Ensemble agreement: X% (not a win probability)" with a policy-driven tooltip.
- Signal detail: "Confidence: X/100 (directional score, not a win probability)".
- `raw_prob` / `exp_win_rate` / `agreement` breakdown: canonical tooltips on every field.
- The Task 105 research/shadow warning remains on all signal surfaces; negative performance (negative R², losing win rates) stays visible.

## Evidence basis (frozen)

Final-test AUC 0.496–0.527 and Spearman(confidence, outcome) ≈ −0.002..−0.07 (Tasks 104–105). A score of 70 is an agreement/strength indicator, not a 70% chance of success. The decision can be revisited only via the Task 106 evidence gates (calibration stability is one of them) on genuinely new forward observations.
