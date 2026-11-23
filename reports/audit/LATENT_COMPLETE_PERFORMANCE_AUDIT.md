# LATENT.PK — COMPLETE AI MODELS, STRATEGIES & PAPER-TRADING PERFORMANCE AUDIT

> **Recovery note (Task 123):** the original audit workspace (commit `97328538`) was lost in a
> sandbox recycle before it could be pushed. This report set was rebuilt verbatim from the
> conversation record against the re-cloned repository. Numbers below describe the audit-time
> snapshot (2026-11-23 ~02:15 UTC): market frontier 2026-11-03, 114 `pending_entry` records, GLM
> 0 matured. The Task 123 recovery report (`reports/operations/task123_recovery_report.md`)
> documents the post-repair state (frontier 2026-11-23; ledger 78 closed / 3 open / 33 pending;
> realized net −707,370.97 PKR) and must be read as the current operational truth.

**Repository:** amz162/latent_v_2 · **Branch:** main · **HEAD at audit:** f1a0f8fe ("GLM-4.6 paper-trading performance export")
**Extraction:** 2026-11-23 ~02:15 UTC / ~07:15 PKT (see `audit_data_manifest.json` for exact stamps + SHA-256 of every source)
**Auditor rule honored:** no model or strategy logic was modified; nothing is assumed profitable; missing evidence is reported as missing, never invented.
**Method:** every metric below is recomputed or cross-checked by `scripts/audit_extract.py`, `scripts/audit_glm_paper.py`, `scripts/audit_validate.py` (22/22 checks green) from the immutable sources listed in the manifest.

---

## 1. Executive summary

1. **Best-supported model:** **Random Forest, 21-day horizon** — best final-test trading result (net **+PKR 99,800**, PF **2.142**, n=59, win-rate 57.6%) and the strongest 5-day directional accuracy (**59.5%**, 95% CI 54.6–64.2%, n=400, significantly above coin-flip). This is **exploratory retrospective evidence** (n small, single universe, policies chosen after results were inspected) — promising, not proven.
2. **Best-supported strategy:** **`fixed_first_hit`** (Task 76 policy v1) — the **only strategy with positive net P&L in both validation (+177,740) and final-test (+83,374)** on the identical BUY cohort, despite the *lowest* win rate (48–49%). Complex exits cut winners: `max_tp_step_trailing` and `scale_out_50_25_25` both lose money after costs.
3. **Overall paper-trading realized result (audit-time):** **zero realized trades** — the live ledger held **114 `pending_entry`** positions (38 BUYs × 3 strategies, cohort 2026-10-29) that never filled because the prospective lifecycle had never been invoked and the data pipeline had stalled on 2026-11-03. (Repaired in Task 123; see the recovery note above.)
4. **GLM analyst status:** pipeline correctness proven, decision value **unproven** — **UNRANKED**. 48 real decisions from a single manual batch (2026-11-04), 2 unique BUYs, **0 matured outcomes**, and store records carrying **no traceable evidence references** (`evidenceRef=null`; all six categories 0 available/0 cited store-side). Research-only by construction.
5. **Biggest problems:** (a) data/worker pipeline stalled since 2026-11-03; (b) paper-trading fills never executed (lifecycle idle); (c) no portfolio equity curve → ROI/Sharpe/Sortino/max-drawdown **unavailable**; (d) GLM evidence traceability broken (`evidenceRef=null`); (e) cost fragility — the out-of-sample trading edge flips negative at 0.50% slippage (PF 0.985).
6. **Recommended next task:** repair the data pipeline and prospective lifecycle, then let the existing 114-signal cohort and a scheduled GLM cohort mature **forward**, untouched. *(Executed as Task 123.)*
7. **Real-money deployment:** **not supported by any evidence in this system** — nothing had filled in paper trading at audit time, all positive results are retrospective with selection bias, and the edge dies at realistic slippage.

---

## 2. Repository and data freshness

| Item | Finding | Source |
|---|---|---|
| Branch / HEAD | `main` @ `f1a0f8fe` | git |
| Live application DB | **`db/custom.db`** (SQLite) — confirmed by `.env` `DATABASE_URL=file:…/db/custom.db` and the app health endpoint (`dataRootLabel: workspace-persistent`, `databaseExists: true`) | `.env`, `src/app/api/health` |
| Provenance | Restored **2026-11-23 00:43 PKT** from the **git-committed snapshot `db/custom.db.gz`** (49,746,709 bytes, tracked in HEAD) via `db/restore-db.sh` | `db/restore-db.sh`, `git ls-files` |
| Production DB | **No separate production database is accessible from this workspace.** The committed `custom.db.gz` is the freshest snapshot (data frontier 2026-11-03/05). Nov 4–20 production deltas live only in committed intraday-monitor state files, not in a reachable DB. Stated explicitly per audit rules — no stale snapshot is presented as live. | — |
| OHLCV data (audit-time) | 1,042,923 bars, **2016-10-21 → 2026-11-03** (frontier 20+ days old at audit) | `OhlcvBar` MAX(date) |
| Worker pipeline (audit-time) | heartbeat last seen **2026-11-03T19:17Z → stale**; task107/108 suite reports green logic but nothing had run since | `/api/health`, task112 pipeline audit |
| Key report timestamps | walk_forward 2026-10-28 · task78 2026-10-30T07:20Z · task79 2026-10-30T08:10Z · task82 2026-10-30T13:16Z · GLM store 2026-11-04/05 · paper cohort 2026-10-29T20:21Z | manifest |

**Model inventory:** 58-entry registry audit (task82) across tiers: PatchTST/N-BEATS/TimesNet/Informer (T1, trained), Chronos/Lag-Llama/Moirai/Time-LLM (T2, **untrained**), XGBoost/LightGBM/CatBoost/RF/LSTM (T3), CNN-LSTM/Transformer-LSTM (T4), TabNet/FinGPT (**untrained**), classical CL/CL-2/PI tiers (ARIMA, GARCH, Prophet, Kalman, GRU, Ridge, calibrated classifiers, pattern/indicator models) — plus the GLM-4.6 analyst tracked separately. **Only 5 models have out-of-sample evaluation; 5 new models were trained with `eval: null` (task79).**

## 3. Predictive performance (walk-forward, 25 stocks, 400 samples, 2023-04-17→2026-07-23, expanding window)

| Model | h5 dir-acc (CI95) | h10 dir-acc | h21 dir-acc | MAE h5 | R² h5 / h10 / h21 |
|---|---|---|---|---|---|
| Random Forest | **59.5%** (54.6–64.2) | 49.3% | 45.5% | 0.0522 | −0.054 / −0.072 / −0.136 |
| CatBoost | **58.0%** (53.1–62.7) | 51.3% | 48.5% | 0.0522 | −0.055 / −0.072 / −0.156 |
| XGBoost | **56.8%** (51.9–61.5) | 50.5% | 46.8% | 0.0524 | −0.058 / −0.090 / −0.166 |
| Ridge Regression | 54.8% (49.9–59.6) | 52.5% | 54.8% | 0.0523 | −0.057 / −0.114 / −0.147 |
| LightGBM | 53.5% (48.6–58.3) | 50.3% | 50.0% | 0.0525 | −0.063 / −0.070 / −0.140 |

- **Baselines:** zero-return baseline = coin flip 50% (CIs above); **R² < 0 at every model × horizon → every model is worse than the training-mean baseline on magnitude.** No model has both direction and magnitude skill.
- Significant directional edge exists **only at h5** (RF, CatBoost, XGBoost — CIs exclude 50%; n=400 each). h10/h21 direction is statistically indistinguishable from coin-flip.
- Evaluation sample limits: 25-liquidity-stock universe, 30 decision dates, 50-session steps; per-stock n=16–17. New models (ExtraTrees, HistGradientBoosting, ElasticNet, HuberRegressor, SVR) trained on 59,920 rows but **never evaluated** → UNRANKED.

## 4. Trading performance by model (task79 final-test, 100k/trade, standard PSX costs)

| Model | h5 net (PF, n) | h10 net (PF, n) | h21 net (PF, n) |
|---|---|---|---|
| Random Forest | −4,641 (1.09, 8) | +38,866 (1.68, 57) | **+99,800 (2.14, 59)** |
| LightGBM | −8,025 (0.89, 7) | +25,255 (1.67, 37) | +70,938 (1.85, 59) |
| CatBoost | −4,826 (1.16, 10) | −14,374 (1.21, 40) | +24,825 (1.47, 73) |
| XGBoost | −9,569 (1.13, 17) | −13,890 (1.26, 58) | +18,202 (1.42, 77) |
| Ridge Regression | −10,428 (1.17, 22) | **−107,777 (0.78, 60)** | −20,983 (1.26, 112) |

- h21 is the only horizon with positive net for 4 of 5 models; **Ridge loses at every horizon** (worst: h10 −107,777, PF 0.783).
- Out-of-sample pooled trading sim (`walk_forward_trading_latest`, 696 executed trades): fixed-horizon exit **net +1,265,627** (avg **+1.818%/trade**, PF **1.518**); progressive TP/SL +205,207 (PF 1.084); at 0.50% slippage **−38,393 (PF 0.985)** → the edge is real but **cost-fragile**.
- Per-symbol concentration: KEL −293,866 vs LUCK +24,155 — results are not uniform; no regime split exists in the reports (marked unavailable, not invented).

## 5. Strategy ranking (task78 — same 5-model BUY cohort, same dates, same costs)

| Strategy | Period | n | Win% | Net P&L | Expectancy/trade | PF |
|---|---|---|---|---|---|---|
| **fixed_first_hit** | validation | 393 | 48.6% | **+177,740** | **+452.3** | 1.502 |
| max_tp_step_trailing | validation | 393 | 59.8% | +15,239 | +38.8 | 1.442 |
| scale_out_50_25_25 | validation | 393 | 60.3% | −6,690 | −17.0 | 1.426 |
| **fixed_first_hit** | final-test | 696 | 48.0% | **+83,374** | **+119.8** | 1.389 |
| max_tp_step_trailing | final-test | 696 | 62.2% | −41,856 | −60.1 | 1.380 |
| scale_out_50_25_25 | final-test | 696 | 55.0% | −160,960 | −231.3 | 1.309 |

- **High win rate ≠ profit:** both complex exits raise win rate to 55–62% and still lose money — they truncate the TP3 tail that `fixed_first_hit` captures (238 TP3 exits vs 33/30).
- **Risk-adjusted ranking: UNAVAILABLE by construction** — the reports contain no portfolio equity curve, so Sharpe/Sortino/max-drawdown cannot be computed honestly (declared in `unsupported_metrics`). PF + consistency across periods is the only risk proxy.
- Best cell: RF h21 fixed_first_hit (+99,800, PF 2.142); worst: Ridge h10 fixed_first_hit (−107,777, PF 0.783).
- Benchmarks: cash (0% return per trade) beaten only by fixed_first_hit in both periods; **buy-and-hold comparison was never computed in any report — UNAVAILABLE.**
- Cohort caveats: retrospective exploratory (policy chosen post-hoc), pilot25 universe, 100k/trade with no capital constraint — declared by task78 itself.

## 6. Paper-trading reconciliation (live ledger at audit time, `db/custom.db`, read-only)

| Check | Result |
|---|---|
| Total rows | **114** `ProspectivePaperTrade` + **0** `PaperTradeLeg` |
| Cohort | single data cutoff **2026-10-29**; created 2026-10-29T20:21:46Z (all rows within 178 ms); 375 predictions → **38 BUY / 337 HOLD** |
| Composition | 5 classical models (CatBoost 30, Ridge 27, XGBoost 24, RF 18, LightGBM 15) × 3 strategies = 38 parallel books each; `isDemo=0` |
| States (audit-time) | **114 `pending_entry`, 0 filled, 0 open, 0 matured, 0 cancelled** |
| "Duplicates" | 38 `sourcePredictionId`s × 3 rows — **by design** (one BUY fans out into 3 strategy books); `dedupKey` duplicates in PredictionHistory: **0** |
| GLM leakage | **0 GLM-attributed rows** — the analyst is hard-blocked from paper trading |
| P&L labels | none existed at audit time (no fills) |
| **Critical finding** | **Fills never executed.** 5 sessions existed after the cutoff (bars through 2026-11-03) but every row was still `pending_entry` — the lifecycle engine had never been invoked and the worker was idle since 2026-11-03T19:17Z. |

Matured fixed-horizon outcomes at audit time: 375 predictions all `outcomeStatus=pending` — the outcome tracker could not mature because the data frontier stopped at 2026-11-03. *(Task 123 repaired both; current state in the recovery report.)*

## 7. GLM-4.6 analyst (summary — full treatment in `glm_deep_analysis.md`)

- 71 store records = 48 real + 23 mock QA probes; real → 24 unique (symbol, cutoff) decisions; the "23 duplicate-generation pairs" = 22 pairs + 1 triple (HUBC), retained append-only; 2 real records rejected (ENGRO stale_evidence, PSO invalid_view).
- **2 unique BUY decisions** (PRL, SYS) with complete ATR risk plans; 4 unique HOLD; 18 NO_TRADE — an extremely conservative, evidence-starved analyst.
- **0 matured outcomes** (pending 23) — generation ran once (manual runner, 2026-11-04, 19-minute window) and the forward tracker had no new bars since 2026-11-03.
- **All six evidence categories `available=0, cited=0` in the store records** (`evidenceRef=null`) → no ablation was possible from the store alone. *(Task 123 correction: the runner-side evidence packages DID contain real multi-source data — see `task111_evidence_coverage.csv`; the traceability gap was in persistence, and is now fixed.)*
- Research-only by construction (schema-enforced `signal_status`, no lifecycle references, 0 DB rows). **UNRANKED vs classical models.**

## 8. Rankings

| Ranking | Result |
|---|---|
| A. Predictive models | 1. Random Forest (h5 dir-acc 59.5%*, best h21 trading) · 2. CatBoost · 3. XGBoost (*h5 significant, all R²<0) · Ridge/LightGBM h5 not distinguishable from coin-flip · all others **UNRANKED** (never evaluated OOS) |
| B. Realized paper-trading | At audit time: **UNRANKED — zero realized trades existed.** Retrospective proxy: Random Forest h21. *(Task 123 produced the first forward cohort: net −707,371 PKR — see recovery report.)* |
| C. Strategy | 1. `fixed_first_hit` (only strategy positive in both periods) · 2. `max_tp_step_trailing` (validation-positive, final-test-negative) · 3. `scale_out_50_25_25` (negative both) |
| D. Risk-adjusted | **UNAVAILABLE** (no equity curve) — PF-consistency order equals C |
| E. GLM analyst | **UNRANKED** (0 matured, store-side evidence untraceable at audit time, no ablation possible) |

## 9. Risks and limitations

1. **Data pipeline stall** (audit-time) — frontier 2026-11-03, worker heartbeat stale; every forward metric was frozen behind it.
2. **Selection/look-ahead risks:** task78 exit policies were chosen after results were inspected (declared); task79 feature correlations are full-dataset (declared); single 25-stock universe; no regime analysis; buy-and-hold benchmark missing. *(Task 123 additionally found and fixed a lifecycle look-ahead: entries anchored on the risk-level cutoff instead of the decision cutoff for stale symbols.)*
3. **Cost fragility:** the pooled edge goes from +1.82%/trade to −0.055%/trade at 0.50% slippage — PSX liquidity can exceed that.
4. **Multiplicity:** 5 models × 3 horizons × 3 strategies = 45 cells; best cells (RF h21) are the maximum of many draws without correction.
5. **GLM:** evidence persistence gap (now fixed); conviction/calibration channels partly unused (calibrated probability always null); single manual batch.
6. **Sample sizes:** per-cell n=7–112; CI widths ±5–10pp; nothing here supports statistical confidence at portfolio level.

## 10. Recommended next steps

- **Repair first (→ executed as Task 123):** restore OHLCV ingestion, restart the worker, fix lifecycle invocation, let cohorts mature forward untouched.
- **Retain:** `fixed_first_hit` + ATR14 policy as the default exit; h5 signal generation for RF/CatBoost/XGBoost; the pilot25 discipline (append-only stores, QA suites).
- **Disable candidates:** `scale_out_50_25_25` (negative both periods); Ridge Regression signals (PF 0.78–1.26, worst cells); SVR/task79-new models until evaluated.
- **Investigate (engineering):** portfolio equity curve for true ROI/Sharpe/MDD; buy-and-hold benchmark; per-regime analysis; GLM evidence wiring with point-in-time timestamps + scheduled generation; populate `calibratedNetPositiveProbability`.
- **Needs more forward observations:** h10/h21 edges, Ridge, ensembles, GLM-vs-classical comparison (only after GLM ablation becomes possible).
- **Paper-trading expansion:** **not ready** until fills work end-to-end and one full cohort matures with net-positive results. *(Task 123 fixed fills; the first forward cohort is now maturing — result negative so far.)*
- **Real money:** **no strategy is currently supported for real-money deployment** by independent out-of-sample and forward evidence.

## 11. Validation (Phase 9) — exact results (audit-time run)

- **22/22 independent recomputation checks passed, 0 warnings** (`scripts/audit_validate.py`): per-stock net sums equal totals (3 families, delta 0.00); gross−costs=net for all 6 task78 rows; win-rates recomputed from counts; cost identity (0.15%×2 commission + 0.15% slippage + 15% CGT → implied 1.43%/trade); cohort boundaries (valEndIdx=200 of 400); duplicates (0 dedupKey dups; 38×3 by design; GLM 24 extra append-only records); entry convention T+1 open (no same-bar leakage).
- **Regression suites (audit-time):** Task 112 QA **66 passed / 0 failed / 0 skipped**; Task 107 QA **30 passed / 0 failed / 2 skipped** (environment-dependent skips, noted honestly). *(Task 123 added Task 111 QA 34/34 and its own 22-check suite.)*
- **Consistency:** CSV/MD/JSON cross-checked against `evidence_bundle.json`; every file SHA-256 stamped in `audit_data_manifest.json`.

## 12. Report set

| File | Content |
|---|---|
| `LATENT_COMPLETE_PERFORMANCE_AUDIT.md` | this report |
| `glm_deep_analysis.md` | Phase 4 GLM deep dive |
| `all_models_comparison.csv` | 45 model rows (accuracy + trading + status + verdict) |
| `all_strategies_comparison.csv` | 15 strategy rows (task78 + OOS sim + best cells) |
| `paper_trading_reconciliation.csv` | ledger rows reconciled from source IDs (post-Task-123 states) |
| `glm_records_table.csv` | all 71 GLM records with risk plans and validation |
| `audit_data_manifest.json` | sources, SHA-256, mtimes, freshness, tests, extraction stamps |

*Every metric traces to a source table/file/script listed in the manifest. Nothing was assumed, extrapolated, or fabricated; unavailable metrics are labeled UNAVAILABLE/UNRANKED.*
