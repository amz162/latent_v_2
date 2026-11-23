# Task 128 — Final Strategy Ranking (identical-cohort comparisons, cost-aware)

**Date:** 2026-11-23 · All numbers re-read from source artifacts and independently re-verified (`scripts/task128_verify.py` re-computed the task78 identity checks and the live per-strategy forward ledger). Strategy data also in `task128_comparison.csv`.

---

## 1. Headline

Across every cohort type — retrospective pooled (task78), 10-year capital-compounding scan (task104), walk-forward pooled sim, and the **one genuine forward cohort** (Task 123/125) — **no strategy is profitable after realistic PSX costs**, and the honest ranking is about *how negative* each is. The only configurations in the whole repository that beat cash are **buy-and-hold baskets** of the universe (+17.5% / +23.5% / +30.9% with costs in the task110/111/112 portfolio tests; task105's 10-year descriptive mean +50.37% without costs, survivorship-caveated). Sharpe/Sortino/ROI/max-drawdown are quoted **only** where a portfolio equity curve exists (task110/111/112 family); the task78 and Task-123 trade-level cohorts have none, and none are invented for them.

## 2. ML exit policies — identical cohort (task78: 400 paired BUY samples, valEndIdx=200, standard_psx, 100k/trade; RETROSPECTIVE EXPLORATORY by its own declaration)

| Strategy | Validation n=393 net / PF / WR | Final-test n=696 net / PF / WR | Exit mix (final) |
|---|---|---|---|
| **fixed_first_hit** | **+177,740.42 / 1.502 / 48.60%** | **+83,373.96 / 1.389 / 47.99%** | TP3 238, TIME_UP 201, SL 156, SL_after_TP1 68, SL_after_TP2 33 |
| max_tp_step_trailing | +15,238.97 / 1.442 / 59.80% | −41,856.29 / 1.380 / 62.21% | Complex exits cut winners (only 238+ exits at targets) |
| scale_out_50_25_25 | −6,689.67 / 1.426 / 60.31% | −160,959.63 / 1.309 / 55.03% | Worst net both periods — disable candidate |

Identity checks re-verified: |gross − costs − net| ≤ 0.21 PKR on all six rows. **Adjudication of the "fixed_first_hit positive on both splits" claim:** the numbers are real and reproduced, but (a) the artifact itself forbids calling them an unbiased win ("Do NOT claim independent validation, statistical significance, or an unbiased strategy win"), (b) the same strategy's 10-year compounding scan ends at −91.20% of capital (best of 60 task104 configurations — "least bad", not good), and (c) the genuine forward cohort (below) lost money with it. **The prior positive result does not survive forward contact.**

## 3. The genuine forward cohort (Task 123/125 — the only non-hypothetical evidence; all three strategies on the same 2026-10-29 predictions)

| Strategy | Closed trades | Net P&L (PKR) | Wins | Profit factor |
|---|---|---|---|---|
| fixed_first_hit | 25 | **−219,476.14** | 5 | ~0.15 |
| max_tp_step_trailing | 26 | **−249,310.55** | 2 | ~0.10 |
| scale_out_50_25_25 | 27 | **−238,584.28** | 3 | ~0.14 |

(Verified live from `ProspectivePaperTrade` this task. scale_out's figure **includes +4,047.99 from the 7 h21 trades closed on partial windows** — the Task 125 gate defect; strictly re-marked it would be ≈ −242,632.27 with that amount unrealized instead. Total cohort: −707,370.97 realized, 10W/68L.) Prior forward observations agree in direction: task106 gen1 −75,548.35 (4 matured, all SL); task109 delayed-shadow cohort −102,348.02 (43 matured, PF < 0.2 in every strategy). Four independent cohorts, four losses.

## 4. Walk-forward pooled sim (expanding window 2023-04→2026-07, 696 executed, 100k/trade)

| Exit policy | Net P&L | PF | At 0.50% RT slippage |
|---|---|---|---|
| fixed_horizon | **+1,265,626.91** | 1.5177 | survives: +1,022,026.91 |
| progressive_tp_sl | +205,206.86 | 1.0836 | **dies: −38,393.14 (PF 0.9851)** |

Genuinely out-of-sample (expanding-window), but the periods were reported before — not a preregistered holdout — and the pooled edge concentrates in a few names (PRL +740,851 vs KEL −293,866). The **0.50%-slippage sensitivity** the task flagged is verified exactly: the progressive exit's edge flips negative while fixed_horizon absorbs it. **No per-strategy (task78 exits) 0.50% sensitivity exists anywhere in the repo** — a documented gap; the audit's pooled statement ("+1.82%/trade → −0.055%/trade at 0.50% slippage") applies to the progressive exit only.

## 5. Capital-compounding and attribution (task104/105)

- 60 sizing/filter configurations × 3 strategies, 2016–2026, PSX_USER_SCHEDULE_V2 + ATL-15 tax: **0/60 positive after costs**; best ends at PKR 8,796 from 100,000 (−91.20% ROI, MDD −92.06% — equity curve exists here, drawdown legitimately quoted). Win rates 35–51%: "win rate is NOT the problem; win/loss asymmetry + costs are."
- task105 attribution: gross P&L itself is negative for every strategy over 2016–2026 (ffh gross −1,150,031; trailing −1,014,645; scale_out −3,161,236) with costs adding 12.2–14.2M — "gross loss dominates; costs add 40–60% on top." 67/69 subgroups FDR-significant **negative**; "cash dominates every strategy and every selection rule."

## 6. Technical strategies

| Strategy | ROI (10-y sim, V2 costs) | MDD | PF | Verdict |
|---|---|---|---|---|
| golden_cross_7_30 | −39.28% (final equity 60,718 from 100k) | −87,775 PKR | 0.8701 | Loses to cash (0%) **and** buy-and-hold (+30.88%); 27% WR, 363 trades |
| + vol-target overlay B @10% | −2.68% | −23.62% | 0.8946 | Drawdown reduction is real but the edge stays negative |
| + overlay B @15% / @20% / A / C | −7.24% / −12.58% / −20.35% / −20.35% | −33.7% / −42.5% / −62.4% | 0.85–0.87 | Same |
| buy_hold_equal_weight | **+17.50%** (task111) / **+23.50%** (task112 re-validation, frozen rules, no threshold selection on test) | modest | — | **The only positive strategy-like configuration in the repo** — and it is not a model, it is the market |
| cash | 0% | 0% | — | Benchmark that every active strategy failed to beat |

Task 116's seven directional votes (MACD, RSI-divergence, z-score/OU reversion, linreg channel, Donchian) are implemented and unit-tested but have **no out-of-sample performance evidence** — unranked, not candidates. The matched-sample comparison (technical vs ML selection) returned `insufficient_evidence`.

## 7. Ranking

1. **buy_hold_equal_weight** — only positive configuration; not tradeable alpha, but the correct benchmark any candidate must beat, preregistered.
2. **fixed_horizon exit on pooled walk-forward** (+1.27M, PF 1.52, survives 0.50% slippage) — best *simulated* active policy; cohort-concentration and no-preregistration caveats apply.
3. **fixed_first_hit** — best *retrospective paired-cohort* exit and "least bad" in compounding; **refuted forward** (−219,476 in the genuine cohort). Research observation only.
4. **overlay_B_vol_target_10pct** — risk-reduction overlay with real drawdown benefit on a negative base; research only.
5. **max_tp_step_trailing** — validation-positive, final-test-negative, forward-worst (−249,311): unstable.
6. **scale_out_50_25_25** — negative in every cohort examined (task78 both periods, forward −238,584/−242,632 corrected): **disable candidate confirmed** (unchanged from the audit).
7. **golden_cross_7_30** — negative-edge technical rule, loses to cash and buy-and-hold: disable candidate confirmed.

**No strategy is production-ready or profitable. No real-money deployment is supported.** GLM is not ranked (no matured comparable cohort — see the model ranking §7).
