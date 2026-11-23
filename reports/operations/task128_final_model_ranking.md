# Task 128 — Final Model Ranking (statistically honest, evidence-classed)

**Date:** 2026-11-23 · **Method:** all figures re-read from the source artifacts listed in `task128_comparison.csv` (110 rows) and re-verified independently for the pivotal claims (`scripts/task128_verify.py`, `task128_build_comparison.py`). No model was retrained or re-tuned in this task. GLM is excluded from this ranking (no matured comparable cohort) — see §7.

**Evidence classes used throughout (a result's class is part of its meaning):**
- **WF (walk-forward):** expanding-window re-evaluation 2023-04-17→2026-07-23, 400 obs/model/horizon (`walk_forward_latest.json`) — genuinely out-of-sample rolling, but the window has been reported before (not a preregistered holdout).
- **FS (frozen split):** task100 protocol — chronological 50/15/35 + 21-session maturity purge, val n=816, final-test n=1995, final test consumed once (`task100_model_comparison.json`).
- **EXPL (exploratory post-hoc):** retrospective results where the configuration was chosen after inspecting the data (task78/79 cells, Majority Vote family) — explicitly declared by their own artifacts.

---

## 1. Headline finding

**No classical model beats the zero-return baseline or the training-only-mean baseline on forecast error, and no model shows usable out-of-sample skill at horizon 10 or 21.** The strongest directional evidence anywhere in the repository is Majority Vote at horizon 5 (dir-acc 0.565, CI95 [0.516, 0.614], p(>0.5)=0.998 under symbol-block bootstrap) — significant at α=0.05 but only **marginal** after Bonferroni correction for the 33 ensemble-horizon tests its own artifact declares (α_adj = 0.0015). Horizon 10 and 21 ensembles are not significant. Every final-test R² in task100 is negative (all models worse than the training-mean predictor); task103 states it plainly: "NO model beats the zero-return baseline; NO model beats the training-only-mean baseline."

## 2. Classical models (task100 FS, n=1995 final-test / n=816 validation; MAE CI95 via 21-day block bootstrap, 200 reps)

| Model | h5 dir-acc (val → final) | h21 dir-acc (val → final) | final-test R² (h5 / h21) | Verdict |
|---|---|---|---|---|
| ElasticNet | 0.500 → **0.5223** (best final) | ~0.50 → 0.5178 | −0.03 / −0.09 | Best final-test dir-acc; no MAE edge vs zero-return; UNRANKED-tier in prior audit, now evaluated |
| HuberRegressor | 0.534 → 0.475 | **0.5809** (best val) → 0.475 | −0.03 / −0.09 | Validation champion collapses on final test — the clearest selection-overfitting demonstration in the repo |
| Random Forest | 0.4645 → 0.4922 | 0.5012 → 0.4977 | −0.029 / −0.087 | Forecast skill ≈ coin flip at both horizons (see §5 for its trading claims) |
| XGBoost | 0.4755 → ~0.50 | — | −0.020 / <0 | No edge |
| LightGBM / CatBoost | ~0.48–0.50 | ~0.50 | <0 | No edge |
| Ridge Regression | ~0.50 | ~0.50 | <0 | No forecast edge; worst trading cells (§5) |
| SVR family (task101) | ~0.48–0.51 | ARIMA h21 0.4533 / Holt-Winters damped 0.52 | <0 | Statistical-family baseline itself fails to beat zero-return on MAE |

**WF view (400 obs, pilot-25 models):** Random Forest **h5 dir-acc 0.595, CI95 [0.546, 0.642]** — the only single-model directional result whose CI excludes 0.5 (nominally significant); RF h21 0.455 (below chance); CatBoost h5 0.58; Ridge h21 0.5475. All walk-forward R² ≤ ~0.01. The RF h5 result is a **hypothesis, not a candidate**: it sits inside a family of ≥33 evaluated model×horizon cells with no recorded Bonferroni-adjusted p, and the same model's h21 directional accuracy is below 0.5.

## 3. Deep and foundation models

| Model | Best directional result | Verdict |
|---|---|---|
| LSTM (task99, explicit calendar splits, final-test n=10,875) | h21 0.5162, h5 0.4972 | Within noise of chance; MAE worse than classical at h5 |
| CNN-LSTM (task99) | h10 val 0.5243; final-test h21 0.5106 | Within noise |
| Chronos (task94/task97, n=400) | 0.4775 [0.429, 0.5264]; independent re-check 0.5175 | "No statistically significant directional advantage" (both evaluations) |
| Moirai (task96, OOS 2026, 25 symbols) | h5 0.4975 / h10 0.4726 / h21 0.505 (CIs all include 0.5) | "No directional edge; negative R²" |
| PatchTST/N-BEATS/TimesNet/Informer/Lag-Llama/Time-LLM/TabNet/FinGPT/Prophet/Kalman (task94 registry) | rows without reproducible metrics or "insufficient evidence" | UNRANKED — no usable evidence |

## 4. Ensembles

- **Majority Vote h5: dir-acc 0.565, CI95 [0.516, 0.614]** — the only statistically significant directional result at α=0.05; **marginal under Bonferroni** (33 tests). h10/h21: not significant. If anything in this repository deserves a forward test with a preregistered rule, it is this one — at 5-day horizon only, and only as a research candidate.
- task100 aggregators (mean/median/inverse-MAE/ridge-stacker/single-best): final-test dir-acc 0.4772–0.4922 — no edge.

## 5. Adjudication of the previously-reported claims (re-verified from artifacts)

| Prior claim | Re-verified result | Adjudication |
|---|---|---|
| "Random Forest 21-day result (+99,800 PKR, PF 2.142)" | Present in `all_models_comparison.csv`: t79_final_h21_netPnl=99,800, PF 2.142, **n=59**, tier TIER_3/CL, verdict "trading exploratory n≤112" | **EXPL post-hoc best-cell.** The same artifact shows RF h21 walk-forward dir-acc 0.455 (below chance) and R² −0.136. Selected best-of-45-rows with no multiplicity correction. **Not a research candidate.** |
| "Random Forest 5-day directional accuracy" | WF 0.595, CI95 [0.546, 0.642] (verified from `walk_forward_latest.json`); FS final-test 0.4922 | Nominally significant, family-unadjusted; contradicted by FS. **Hypothesis for a preregistered forward test only.** |
| "fixed_first_hit positive validation AND final-test" | Verified exactly: +177,740.42 (PF 1.502, n=393) and +83,373.96 (PF 1.389, n=696), net=gross−costs to ≤0.21 PKR — see the strategy ranking | Task-78 itself declares RETROSPECTIVE EXPLORATORY; policies were designed after inspection; the genuine forward cohort then lost −219,476.14 (5W/20L). **Observation, not a candidate.** |
| "0.50% slippage sensitivity" | progressive_tp_sl: +205,206.86 (PF 1.0836) → **−38,393.14 (PF 0.9851)** at 0.50% RT slippage; fixed_horizon survives (+1,022,026.91) | Edge dies at realistic slippage for the progressive exit; no per-strategy (task78 exits) 0.50% sensitivity exists anywhere — documented gap |
| "Previously negative results" | scale_out −6,689.67/−160,959.63 (task78 both periods); Ridge worst trading cells (h10 −107,777, PF 0.783); Golden Cross −39.28% ROI; all confirmed | Disable candidates stand |

## 6. Multiple-testing and baselines

Baselines reported per cell: zero-return MAE and training-only-mean MAE (task100/pilot25), constant-mean and buy-and-hold (task105 descriptive +50.37% 10-y, no costs; portfolio tests +17.5/+23.5/+30.9% with costs). Significance machinery present: block-bootstrap MAE CI95 (task100/99), 30-date-block paired-improvement CIs (pilot25), symbol-block bootstrap + Bonferroni for the ensemble family (task94), Wilson dir-acc CIs (Chronos/Moirai). **Absent:** model-vs-model paired tests (Diebold-Mariano/White reality check), Bonferroni across the full model×horizon grid, and any preregistration document (the strictest existing rule is `docs/task105-model-promotion-policy.md`'s "no final-test reuse"). Leakage/eligibility: PIT leakage test suites pass (task102: 12/0; task103), 21-session maturity purges everywhere, train-only scalers; task99 documents explicit calendar splits.

## 7. GLM

**GLM predictive performance: NOT YET RANKABLE** — GLM-4.6 decisions (48 real, research-only) have zero matured, comparable-cohort outcomes (Task 126); no win rate or profitability claim is made.

## 8. Ranking

**Tier A (evidence-supported research candidates — forward-test only, no deployment):** Majority Vote h5 (Bonferroni-marginal, preregistered forward test warranted). **Tier B (hypotheses, weaker):** RF h5 walk-forward directional accuracy. **Tier C (no evidence of skill / negative):** every other model×horizon cell — including all h10/h21 forecasts, all deep and foundation models, Chronos, and the RF h21 trading cell. **Nothing in this repository is promotable to production or real money** (consistent with task105's "not_promotable for ALL models/strategies" and the forward-cohort losses).
