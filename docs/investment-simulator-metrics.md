# Investment Simulator & Backtesting Metrics — Field-by-Field Reference

Task 100 documentation. Every formula below is extracted from the actual
source code (file and line references at the bottom) — nothing is invented.
There are **three different calculation contexts** in Latent.pk; mixing their
numbers is the single most common misreading:

| Context | Where | Entry price | Cost model |
| --- | --- | --- | --- |
| **Investment Simulator** (Tracker → Investment Simulator) | `investment-simulator.ts` | close of the bar nearest the slot target | **`psx_user_schedule_v2` (Task 101 default)**: 0.03 PKR/share (price ≤ 20) or 0.15%/side, PSX + NCCPL + CDC fees, zero slippage, CGT 15% ATL / 30% NON-ATL — via the shared `computeSimTradeCosts` → `computeTradeCostsV2` |
| **Strategy Backtest** (Backtesting Report / walk-forward trading) | `strategy-engine.ts` + `trading-costs.ts` | **next session's open** after the decision date | `psx_user_schedule_v2`: 0.03 PKR/share (price ≤ 20) or 0.15%/side, PSX + NCCPL + CDC fees, **zero** slippage, CGT 15% ATL / 30% NON-ATL |
| **Ensemble Tracker backtest** (AI Models tab) | `backtest.ts` | per model card simulation | per-trade costs included in `netPnlPkr`; win/loss decided on **net** P&L |

---

## 1. The four kinds of "performance" — never mix them

1. **Prediction quality** — MAE / RMSE / R² / directional accuracy of a
   forecast against the matured forward return. Cost-free by definition.
2. **Gross directional-return proxy** — "if you had held in the sign of the
   forecast" statistics. No commission, no CGT, no position sizing. The
   Backtesting Report's `trading_metrics` are explicitly labelled this.
3. **Historical trading simulation** — strategy engine with SL/TP fills and
   full `psx_user_schedule_v2` costs. This is net P&L territory.
4. **Prospective paper trading** — live shadow book, separate lifecycle,
   never backfilled.

A model can look good in (1) and lose money in (3). Task 100's headline
finding: no evaluated model beats the zero-return MAE baseline, and **every**
validation-tuned strategy cell is net-negative after PSX costs.

## 2. Win rate — exact definition

`winRate = nWinning / nCompleted × 100` where:

- `nCompleted` = positions with `skipped == false` **and** a realized
  `exitReason` (strategy cells) or `type === "TRADE"` (Investment Simulator).
- `nWinning` = completed positions with **net P&L > 0** — after *all* costs
  (brokerage, PSX/NCCPL/CDC fees, CGT where applicable). A trade that touched
  TP2 and then exited at SL is a **LOSS** if its net P&L is negative
  (`isWin = netPnl > 0` — the old "TP3 hit but it counted my loss" bug is
  fixed by this rule).
- **Skipped signals are never in the denominator.** Variant B skips signals
  whose estimated net reward:risk is below minimum before entry
  (`skipReason: "skipped_rr_below_minimum"`); they are counted in
  `nSkipped` / `nCandidates`, not in `nCompleted`.

**Win rate ≠ profitability.** A 44% win rate with average win ≫ average loss
can be profitable; a 55% win rate with small wins and large losses loses
money. Always read `winRate` together with `avgWin`, `avgLoss`,
`expectancy (avgNetPerTrade)` and `profitFactor`.

## 3. Strategy risk levels (Task 57/76/80 canonical policy `atr14-1.5-1-2-3`)

For a BUY signal with decision date `d`:

```
atr14       = ATR(14) over the 15 daily bars ending at d (Wilder-compatible TR)
sl  = entry − 1.5 × atr14        tp1 = entry + 1.0 × atr14
tp2 = entry + 2.0 × atr14        tp3 = entry + 3.0 × atr14
```

- `entry` for the strategy engine = **next session's open** after `d`.
- Variant A (`atr_tp1_rr_1_1_v1`) recomputes TP1/SL distances from the actual
  entry price (1:1 reward:risk at TP1).
- Variant B (`atr_min_net_rr_2_v1`) **skips** the trade unless the estimated
  net reward:risk after costs ≥ minimum — this is the only mechanism that
  produced marginally positive (exploratory) cells in Task 100.

### Exit policies

- **Fixed First Hit**: the first touch of SL or TP3 closes 100% of the
  position. TP1/TP2 are milestones only.
- **Max TP Step Trailing**: TP1/TP2 hits **step the stop up** to the reached
  TP; TP3 closes. Exit is therefore often `TRAILING_SL_AT_TP1` — a win locked
  in by the trailed stop, *not* a TP1 payout.
- **Scale Out 50/25/25**: 50% exits at TP1, 25% at TP2, 25% at TP3; an SL
  touch closes the remainder. `legs` = 1–3 execution legs of ONE position.

**SL-first same-candle rule**: on any bar where both SL and a TP are touched,
the **stop is assumed first** (realistic pessimism; gaps fill at the worse of
open/stop). A bar that closes the trade at SL can never award a new TP.
`bestTargetReached` preserves the highest TP touched even when the realized
exit is SL — target attainment and realized P&L are deliberately separate.

## 4. Costs — `psx_user_schedule_v2` (strategy backtest)

Per **side** (buy, and each sell leg separately), on transaction value
`V = fillPrice × quantity`:

| Component | Formula |
| --- | --- |
| Brokerage | `0.03 × quantity` if `fillPrice ≤ 20`, else `0.0015 × V` |
| PSX fee | `0.0000035 × V` |
| NCCPL fee | `0.0000081 × V` |
| CDC fee | `0.000036 × V` |
| Slippage | **0** (real gap-aware fills only) |

Position-level, once: `CGT = 15% (ATL) or 30% (NON-ATL) × grossPnl` **only if
`grossPnl > 0`** — losing positions pay zero CGT. Scale-out legs are
aggregated *before* CGT.

**Identity (verified on 4,713 completed Task 100 rows, max deviation 0.01 PKR):**

```
netPnl = grossPnl − (totalBrokerage + totalPSX + totalNCCPL + totalCDC + slippage + cgt)
```

**Worked example** — buy 1,000 shares @ 50, exit one leg @ 52 (ATL_15):

| Item | Buy side | Sell side |
| --- | --- | --- |
| Value | 50,000 | 52,000 |
| Brokerage 0.15% | 75.00 | 78.00 |
| PSX 0.00035% | 0.175 | 0.182 |
| NCCPL 0.00081% | 0.405 | 0.421 |
| CDC 0.0036% | 1.80 | 1.872 |
| **gross P&L** | | **+2,000** |
| CGT 15% of 2,000 | | 300.00 |
| **total cost** | | **457.86** |
| **net P&L** | | **+1,542.14** |

Low-price example: 5,000 shares @ 10 → brokerage `5,000 × 0.03 = 150` per side
(fixed rule), not 0.15% × 50,000 = 75.

## 5. Investment Simulator specifics (different cost model!)

- **Slot targeting**: `numTrades` evenly spaced target timestamps across the
  window; each slot enters on the bar **nearest** its target (deterministic,
  timestamp-based — never cherry-picked by outcome). Multiple parallel trades
  on different stocks are allowed and required to fulfil `numTrades`.
- **Entry price = that bar's close.** SL/TP distances fall back to
  1.5/1/2/3 × ATR(14) when the signal carries no levels — the same
  multipliers as the strategy engine.
- **Costs (legacy flat model)**: `commission = 0.15% × entryAmount × 2`,
  `slippage = 0.15% × entryAmount` (one-way), `CGT = 15% × grossPnl` when
  positive. **No PSX/NCCPL/CDC fees here** — which is why simulator net P&L
  is *not* comparable to strategy-backtest net P&L.
- **Realized compounding**: each trade's `entryAmount` = capital + SIPs
  deposited before that entry + P&L of trades already **closed** before it.
  Open trades never fund new entries (no borrowing unrealized gains).
- `totalGain` = running sum of trade net P&L (chronological; SIP rows add 0).
- `finalAmount = capital + totalSip + totalGain`;
  `totalReturnPct = totalPnl / totalInvested`.
- `unresolvedCount` = trades that hit neither SL nor TP3 by window end
  (`TIME_UP`, exited at last close) — displayed, never discarded.
- `bestTargetAttainmentRate` = fraction of trades with
  `bestTargetReached ≠ "—"` (touched any TP at some point).

## 6. Ranking & Backtest Score (AI Models tab)

- **Backtest Score = empirical winRate / 100** — a monotonic transformation of
  historical win rate. It is **not** a calibrated probability, not a streak
  count, not significance.
- Ranking sorts by the selected metric (`winRate`/`backtestScore` → winRate;
  `netPnL` → net P&L). The streak counter is never used for ranking.
- The minimum-win-rate filter requires `totalTrades > 0` — zero-trade results
  never qualify. Card metrics always reconcile with the drilldown
  (`totalTrades = trades.length`, `winTrades = count(netPnl > 0)`,
  `netPnL = sum(netPnl)`).

## 7. Reading a low win rate — the Task 100 diagnosis

Exit-reason distribution on the frozen Task 100 final-test run
(HuberRegressor, q90 threshold, 302 positions): SL 123, TRAILING_SL_AT_TP1 72,
TIME_UP 62, TRAILING_SL_AT_TP2 25, TP3 20. The 44% win rate decomposes into:
entry timing (next-open after a 5d-horizon signal), stop distance (1.5 ATR
against ~2% average 5d moves), cost drag (≈0.36–0.55% round trip + CGT), and —
dominantly — the absence of genuine directional edge (validation directional
accuracy 49–53% across nine models). Prediction error, signal conversion,
exit design and costs are diagnosed separately in
`data/backtest_reports/task100/task100_strategy_diagnostics.json`; the
simulator itself was verified, not redesigned.

## 8. Source of truth

- `src/lib/latent/investment-simulator.ts` (slots, compounding, legacy costs)
- `src/lib/latent/tp-sl-engine.ts` (SL-first state machine, gap fills)
- `src/lib/latent/strategy-engine.ts` (three exit policies, legs)
- `src/lib/latent/risk-levels.ts` (`atr14-1.5-1-2-3`, variants A/B)
- `src/lib/latent/trading-costs.ts` (`psx_user_schedule_v2`)
- `src/lib/latent/simulator-ranking.ts` (Backtest Score, filters)
- `src/lib/latent/backtest.ts` (tracker backtest win rate on net P&L)
- Machine-readable twin: `data/backtest_reports/task100/task100_simulator_data_dictionary.json`


---

## 9. Task 101 additions — cost-aware trade selection

- `psx_cost_aware_trade_classifier` / `psx_net_expectancy_meta_model` are
  supplemental registry entries trained on **11,521 trade outcomes labeled by
  the production engine** (SL-first, gap-aware, V2 costs) over the pilot25
  chronological 50/15/35 cohort.
- Decision rule: BUY only when the isotonic-calibrated probability of a
  positive-net trade exceeds a validation-frozen threshold; otherwise
  **NO TRADE**. Final test: the filter improved per-trade expectancy from
  −0.650% (all trades) to **−0.526%** and abstained on 483 low-quality setups —
  still net-negative, so the models remain **shadow-only, not promoted**.
- Exit-reason mix, skipped accounting and win-rate-vs-profitability guidance
  are unchanged from earlier sections; `data/backtest_reports/task101/` holds
  the full evidence (`task101_cost_parity_report.json`,
  `task101_strategy_optimization.json`, `task101_cost_reconciliation.json`).

---

## 10. Task 102 additions — definitions, data honesty and shadow-vs-production

Definitions (unchanged mechanics, made explicit):

- **Win rate** numerator = trades with realized net P&L > 0 after full `psx_user_schedule_v2`
  costs; denominator = **completed trades** (a trade = one signal position; scale-out legs are
  NOT separate trades). Skipped/unmatured trades are excluded from both.
- **Gross vs net P&L**: gross = realized price P&L before costs; net = gross − (brokerage +
  PSX + NCCPL + CDC + CGT + slippage). CGT applies only to positive gross realized profit
  (ATL 15% / NON-ATL 30%).
- **Return-percentage denominator** = position notional (100,000 PKR by default).
- **Drawdown** = running max of cumulative net P&L minus current cumulative net P&L, over
  chronological completed trades.
- **Model confidence vs calibrated probability**: `confidence` is a model score (uncalibrated);
  the cost-aware decision rule uses **isotonic-calibrated** P(net>0) fitted on validation only.
- **Shadow vs production**: production models drive the live consensus; shadow-only models
  (the two Task 101 cost-aware models) are computed and stored but never place trades or
  alter signals; `development_only` results never upgrade to production without passing the
  promotion gates.
- **Unmatured labels**: trades without a full 21-session outcome window are excluded from
  training artifacts, never filled with zeros.

Data honesty (Task 102):

- The Investment Simulator and signal-stats display **only** `psx_user_schedule_v2` by default;
  `legacy_flat_v1` is available only when explicitly requested.
- No screen presents the internal pilot25-breadth proxy as the KSE-100 index; genuine KSE-100
  status is `blocked_external_data` (see `docs/task102-data-foundation.md`).
- Fundamentals and intraday coverage gaps are reported as unavailable, never interpolated.
