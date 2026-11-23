# Task 128 — Statistical Notes: confidence intervals, multiple testing, eligibility, and known gaps

**Date:** 2026-11-23. Companion to `task128_final_model_ranking.md`, `task128_final_strategy_ranking.md`, `task128_comparison.csv` (110 rows, each with its source artifact and evidence class).

## 1. Confidence-interval machinery actually present in the artifacts (and used here)

| CI type | Where | Parameters | Applies to |
|---|---|---|---|
| Block-bootstrap MAE CI95 | task100, task99 | n_boot=200, block_days=21 (validation: 11) | Every classical-model × horizon × split cell; LSTM/CNN-LSTM |
| Date-block paired-improvement CI | pilot25_robustness.json | 30 decision-date blocks, 1000 reps, seed 20261028 | Paired MAE/RMSE improvement vs zero-return and training-only-mean baselines |
| Symbol-block bootstrap CI + p(>0.5) | task94_majority_vote_robustness.json | 1000 iters, 24 symbols | Majority Vote directional accuracy (the only ensemble CI) |
| Wilson-style dir-acc CI95 | task94_chronos_results.json, task96_moirai_results.json | — | Chronos, Moirai |
| Win-rate CI95 | reports/audit/all_strategies_comparison.csv | — | task78 strategy outcomes |
| Expectancy bootstrap CI | task102/103 prediction metrics | block_days=21, n_boot=200, 237 decision dates | Final-test expectancy: point −0.5833%, CI95 [−1.3784, +0.3546] — **includes 0** |

**Interpretation rule used in the rankings:** a directional result is called *nominally significant* only when its CI excludes 0.5 (dir-acc) or its paired-improvement CI excludes 0 (MAE), and *family-adjusted significant* only when it survives the Bonferroni machinery its own artifact declares.

## 2. Multiple testing

- Declared test families: 33 ensemble-horizon tests (task94 → Bonferroni α_adj=0.0015), 69 strategy-subgroup FDR tests (task105), the implicit 9-model × 3-horizon × 2-split grid of task100, the 45-row audit model table, and the 60-configuration task104 scan. **Only two results survive family-aware scrutiny in any form:** Majority Vote h5 (Bonferroni-marginal) and the 67/69 FDR-significant **negative** subgroups (a negative-result multiple-testing finding).
- **Not present anywhere:** Diebold-Mariano or White reality-check model-vs-model comparisons; Bonferroni/FDR across the full classical model×horizon grid; preregistration documents (the literal term "pre-registered" appears nowhere in the repository). Consequence: the RF h5 walk-forward result (0.595, CI [0.546, 0.642]) is *nominally* significant but its family-size is unbounded — treated as a hypothesis, not a finding.
- Exploratory-vs-confirmatory separation enforced in the deliverables by tagging every row with an evidence class; the task78 artifact's own limitation ("Do NOT claim independent validation, statistical significance, or an unbiased strategy win") is honored verbatim.

## 3. Baselines

Zero-return MAE and training-only-mean MAE are reported per cell in task100 and pilot25 (including the per-sample training-only-mean in walk-forward — the stricter form). task103's verdict stands: no model beats either baseline on gross forecast error. The economic baseline (cash = 0%) and market baseline (buy-and-hold baskets: +17.5%/+23.5%/+30.9% with costs; 10-y descriptive +50.37% without costs, survivorship-caveated) are quoted only where a portfolio equity curve exists. Every active strategy fails the cash baseline; buy-and-hold beats every active strategy in every portfolio test.

## 4. Data eligibility, leakage, and split discipline

- **Maturity purges:** 21-session purges on task100 splits and task99 date ranges; pilot25 maturity-purge boundary 2024-12-04; walk-forward carries per-sample train-feature/target-maturity metadata (`sample_maturity_metadata_summary`) — the sample-eligibility evidence.
- **Leakage tests:** task102 PIT leakage suite 12 pass / 0 fail; task102 feature-leakage report; task103 PIT report + tests. Financial-publication timestamps are flagged non-PIT in the GLM evidence packages (dataQualityFlags) — the same caution applies to fundamental-based features.
- **Split discipline:** task100/101 use ratio splits (50/15/35) without calendar dates (a reproducibility gap — dates recoverable only from task99's LSTM artifacts and task79's split_date 2024-06-01); "final test once / no reuse" is codified in `docs/task105-model-promotion-policy.md` and `docs/task103-final-evaluation.md`, but **no untouched out-of-sample period remains** (task94: "No untouched holdout beyond final-test"; task105: "all final-test periods consumed"). Therefore every historical number in this ranking, however clean its protocol, is **development_only** by the repository's own standard; only the forward paper cohorts (gen1, task109, Task 123/125) are genuinely out-of-sample — and all three lost money.
- **Costs:** LEGACY_STANDARD_PSX_V1 (0.15%/side commission ×2, 0.15% RT slippage, CGT 15%) for task78/79-era results; PSX_USER_SCHEDULE_V2 (per-share commission, PSX/NCCPL/CDC fees, **zero assumed slippage** — real gap-aware fills only, CGT 15%/30% ATL/non-ATL once per position) for task104+ and all forward cohorts; HIGH_SLIPPAGE_PSX (0.50% RT) for sensitivity only. Cost-identity checks: task78 identities ≤0.21 PKR (re-verified this task); task105 engine reconstruction identical (11,521 trades/strategy); Task 125 re-verified the forward ledger leg-identities to 1e-6.

## 5. Known gaps and limitations (explicit)

1. **No portfolio equity curve** for task78/task79 and the forward paper cohort → Sharpe/Sortino/ROI/max-drawdown are **not computed** for them (declared `unsupported_metrics` in `evidence_bundle.json`; the Task 127 monitor is tested to emit none of these keys). Equity curves exist only for the task110/111/112 technical family — drawdown is quoted only there.
2. **No per-strategy 0.50%-slippage sensitivity** for the task78 exits (exists only for pooled fixed_horizon / progressive_tp_sl).
3. **No buy-and-hold benchmark inside the task78 paired cohort** (audit: "never computed").
4. **No model-vs-model paired significance tests.**
5. **No preregistration** for any result; the walk-forward window and all final-test periods have been previously reported and consumed.
6. Forward-cohort sample sizes remain small (78 closed trades in the largest genuine cohort; task106 gen1 only 4 matured), so forward losses are **consistent with** the negative-edge finding, not independent statistical confirmation at high power.
7. The Task 125 premature-closure defect (+4,047.99 PKR realized/unrealized classification on 7 h21 scale_out trades) is carried into the forward per-strategy numbers as a disclosed adjustment, not a rewrite.

## 6. What would change the ranking

A preregistered forward test of Majority Vote h5 (the only family-adjusted-marginal positive) or RF h5 direction (hypothesis) on untouched sessions; a per-strategy 0.50%-slippage scan; an equity-curve-based risk-adjusted comparison of any candidate vs buy-and-hold. Until then, the honest ranking is: **everything loses to cash and to buy-and-hold; the only surviving directional evidence is one Bonferroni-marginal ensemble cell at horizon 5.**
