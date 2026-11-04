# Task 111 — Forward Shadow Validation and Promotion Policy

## Two strictly separated evidence worlds

1. **Historical (Task 100–110 periods)** — already examined. Any LLM analysis on those periods is labeled
   `development_only` and can never be presented as untouched out-of-sample evidence. Historical LLM ablation is in any
   case impossible: the platform has no point-in-time-safe fundamentals or historical news archive.
2. **Forward (`task111-llm-multisource-gen1`)** — a separate, immutable generation recording genuinely future outcomes.
   It started with the current-date decisions (22 valid signals across the 23-symbol universe; independent-date count
   grows as new sessions elapse). 0 outcomes have matured yet: status **`collecting`**.

## What forward evaluation will measure (once matured)

Directional accuracy, net-positive completed trade rate, win rate, precision/recall, AUC where appropriate, Brier score
where a calibrated probability exists, calibration curves, profit factor, net expectancy, drawdown, confidence
intervals, evidence completeness, signal coverage, NO_TRADE rate, and source-category contribution — always on
independent dates, never just trade counts, and always against the predeclared baselines (cash, technical-only, GC 7/30,
existing technical rules, the frozen cost-aware shadow filter, buy-and-hold where comparable).

## Minimum promotion review gates

≥100 genuinely matured trades · ≥2 calendar quarters · multiple independent symbols · multiple market regimes ·
positive net expectancy after V2 costs · stable confidence calibration · acceptable drawdown · evidence-source
reliability · no point-in-time leakage · reproducibility · operational stability.

These are review prerequisites — **not** automatic promotion, and the LLM does not promote merely because other models
are negative. Current decision: `collecting` / not promotable now.

## Signal-class separation (never merged)

`LLM_RESEARCH_SIGNAL` (this generation) · `TECHNICAL_RULE_SIGNAL` (golden cross / technical tabs, unchanged) ·
`EXISTING_ML_SIGNAL` (ai-model-signals, weights and thresholds untouched) · `PRODUCTION_SIGNAL` (production consensus;
no auto-promotion path exists).

No real orders. No shorts. No leverage. Every decision is immutable per evidence hash; superseding signals are stored as
new versions with the reason, never by overwriting. Artifacts: `task111_llm_validation_protocol.json`,
`task111_llm_forward_metrics.json`, `task111_llm_calibration_report.json`, `task111_llm_promotion_decision.json`,
`task111_llm_shadow_*.json/csv`.
