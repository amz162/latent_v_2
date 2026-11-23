# Task 125 — Paper-Trading Ledger Reconciliation & Lifecycle Audit

**Date:** 2026-11-23 · **Source of truth:** `db/custom.db` (restored snapshot, market-data frontier 2026-11-23) · Method: independent recomputation from `ProspectivePaperTrade` + `PaperTradeLeg` + `OhlcvBar` + `PredictionHistory`/`PredictionOutcome` by `scripts/task125_reconcile.py` (read-only; the ledger was not modified).

---

## 1. Reconciled counts (final equation)

| Quantity | Value |
|---|---|
| **Total parent records** | **114** |
| Closed | **78** |
| Open | **3** (ANL ×2, LOTCHEM ×1 — all Ridge Regression 21-day, entered 2026-10-30) |
| Pending entry | **33** (BYCO 12, ENGRO 21) |
| **Equation** | **114 = 78 + 3 + 33 ✓** |
| Unique trade IDs | 114 (0 duplicates, 0 missing) |
| Distinct source predictions | 38 (each prediction × 3 strategy variants = 114) |
| Duplicate (prediction, strategy) pairs | 0 |
| **Exit events (legs)** | **86** — all on closed trades; 0 on open trades |
| — final exit legs (legIdx 0) | 78 |
| — partial exit legs (legIdx ≥ 1) | 8 (7× TP1_PARTIAL, 1× TP2_PARTIAL) |
| Trades by leg count | 71 × 1 leg, 6 × 2 legs, 1 × 3 legs (= 78 trades, 86 legs) |

## 2. The 79-versus-78 discrepancy: a prose defect, not an accounting defect

The Task 123 recovery report's *prose* summarized exits as "74 SL, 2 TP3, 1 scale-out completion, 1 trailing, 1 TIME_UP" — which sums to **79**. Recomputation shows this taxonomy matches **neither** ledger layer:

- **Parent-level final exit reasons (78 closed):** SL 60, TIME_UP_AFTER_PARTIALS 7, TP3 6, TRAILING_SL_AT_TP1 5 → sums to **78**.
- **Leg-level exit events (86):** SL 40, SL_REMAINDER 20, TIME_UP_REMAINDER 7, TP1_PARTIAL 7, TP2_PARTIAL 1, TP3 6, TRAILING_SL_AT_TP1 5 → sums to **86**.

The "79" therefore was a **mis-stated summary in the report's prose**; the machine artifact of the same task (`task123_lifecycle_verification.json`) and the ledger agree exactly. No trade, fill, or P&L row is affected; counts did **not** need forcing. The correct statement is: **78 closed trades produced 86 exit events, of which 8 were partial exits on 7 trades (one trade exited in 3 legs).** The prose claim in `task123_recovery_report.md` §4.5 is superseded by this report and by a correction note appended there.

## 3. Independent P&L recomputation (from immutable fills)

| Measure | Recomputed from legs | Task 123 reported | Δ |
|---|---|---|---|
| Gross P&L | **−664,000.40** PKR | −664,000.40 | 0.00 |
| Total costs (commission + slippage + CGT) | **43,370.58** PKR | 43,370.58 | 0.00 |
| **Realized net P&L** | **−707,370.97** PKR | −707,370.97 | 0.00 |
| Wins / losses (net > 0) | **10 W / 68 L** | 10 W / 68 L | — |
| Avg net per closed trade | −9,068.86 PKR | −9,068.86 | 0.00 |

Integrity checks, all passing with zero violations:

- Per leg: `netPnl == grossPnl − totalCost` → **0 violations**; `totalCost == commission + slippage + cgt` → **0 violations**.
- Per parent: parent net/gross/costs equal the sum of its legs → **0 mismatches**.
- Win labels: `isWin == (netPnl > 0)` → **0 violations**. Open parents carry no `netPnl` → **0** (realized/unrealized separation holds).

## 4. Entry verification — no look-ahead, real bars only

- **81 filled trades, all entered 2026-10-30**; 33 remain `pending_entry`.
- Entry price equals the real session **open** of `OhlcvBar[symbol, 2026-10-30]` for **81/81** trades (0 mismatches) — entries are not intra-bar fabrications.
- Every source prediction exists (38 rows in `PredictionHistory`), every one carries a `dataCutoff` (2026-10-29), and **entry date > cutoff date in 81/81 cases** — the earlier look-ahead defect (fills 2 sessions before predictions existed) is confirmed fixed; 0 violations remain.

## 5. Exit verification — gap-aware stops, level fills, priority

- **Every exit leg has a real session bar** (86/86; 0 missing).
- **SL-family legs (65 = 40 SL + 20 SL_REMAINDER + 5 TRAILING_SL_AT_TP1):** all obey the long gap rule *fill = session open if it gapped below the active stop, else exactly at the stop* → **65/65 ok, 0 violations**. Only 6 fills occurred at the exact stop; 59 filled at a worse (real) gap open — e.g. the CNERGY stop 13.37 vs 12.55 open recorded in Task 123.
- TRAILING_SL_AT_TP1 legs fill against the **trailed** stop (= tp1 after the TP1 step): 5/5 exact.
- **TP legs (14):** all fill at the level or better on a gap-up → **14/14 ok, 0 violations**.
- **TIME_UP_REMAINDER legs (7):** all fill at the last window session's real **close** → 7/7 ok.
- **SL/TP same-bar priority:** the engine checks SL first (`strategy-engine.ts:414-421`) and books TP legs ascending after the SL check; a probe found **0 bars** where an SL exit and a TP3 touch were both reachable and a TP was preferred.

## 6. Pending entries — justified by provider data gaps

- BYCO 12 + ENGRO 21 = 33; provider coverage in the restored DB: **BYCO's newest bar is 2021-12-20, ENGRO's 2025-01-03** — no 2026-10-30 session exists to fill against. The engine correctly refuses to invent entry prices; they stay `pending_entry`. (BYCO is effectively absent from the provider for ~5 years — worth flagging to the data owner.)

## 7. Open positions — marked to market, separated from realized

| Trade | Symbol | Strategy | Qty | Entry (2026-10-30) | Latest close (2026-11-23) | Unrealized P&L |
|---|---|---|---|---|---|---|
| cmvtzoeb5002… | ANL | fixed_first_hit | 11,299 | 8.85 | 9.48 | +7,118.37 |
| cmvtzoeb6002… | ANL | max_tp_step_trailing | 11,299 | 8.85 | 9.48 | +7,118.37 |
| cmvtzoebl0030… | LOTCHEM | fixed_first_hit | 4,086 | 24.47 | 25.50 | +4,208.58 |

Unrealized total **+18,445.32 PKR** — excluded from the −707,370.97 realized figure (open parents have no `netPnl`).

## 8. Duplicate-fill / idempotency verification

- 0 duplicate trade IDs; 0 duplicate `(sourcePredictionId, strategyId)` pairs; all 114 bookIds use the single cost profile `legacy_standard_psx_v1` — the earlier cost-profile-rename duplication (114→228 in testing) is confirmed absent from the ledger.

## 9. Forecast-outcome maturity — the 220 explained

`PredictionOutcome` rows are **forecast-realization observations for the whole shadow universe**: 375 predictions (5 models × 25 symbols × 3 horizons), one outcome each — **not** paper-trade outcomes.

| Horizon | Predictions | Matured | Pending | Pending reason |
|---|---|---|---|---|
| 5-day | 125 | 110 | 15 | BYCO/ENGRO/SYS × 5 models — provider gap |
| 10-day | 125 | 110 | 15 | BYCO/ENGRO/SYS × 5 models — provider gap |
| 21-day | 125 | 0 | 125 | target sessions ≥ 2026-11-27, beyond the 11-23 frontier |
| **Total** | **375** | **220** | **155** | |

- All **220** matured outcomes carry an `observedClose` that equals the real bar close of the target session → **0 mismatches, 0 fabrications**.
- Relation to the 114 parents: the trades derive from **38** of those 375 predictions (BUY signals with entry opportunity) × 3 strategies. Of the 38, **11 matured outcome observations** exist so far (4 of 4 traded 5-day predictions, 7 of 10 traded 10-day predictions; the rest are provider-gap or not-yet-due 21-day). Realized P&L comes from fills, **not** from these observations — the two ledgers measure different things and are never mixed.

## 10. Accounting defect found and documented (ledger preserved, engine fixed forward)

Recomputation surfaced **one genuine defect**, disclosed here without rewriting history:

- **What:** the 7 h21 `scale_out_50_25_25` trades (WTL ×4 models, FCCL, ANL, LOTCHEM — all Ridge/XGBoost/LightGBM/CatBoost/RF 21-day) closed with `TIME_UP_AFTER_PARTIALS` after only **16 of 21** window sessions existed. The lifecycle contract (`prospective-lifecycle.ts` header: "Partial windows keep the trade open") was violated because the gate `exitReason !== "TIME_UP"` does not match the string `"TIME_UP_AFTER_PARTIALS"`, so partial-window timeouts of scale-out trades fell through and closed at the last available bar. The 71 non-scale-out h21 trades were unaffected (plain `TIME_UP` matched the old gate).
- **Evidence:** all 7 parents created 2026-10-29T20:21Z, legs written 2026-11-23T20:39-40Z during the Task 123 reprocess; WTL ×4 + FCCL remainder legs carry a **stale 2026-11-03 mark** (the pre-stall frontier) while ANL/LOTCHEM carry the 11-23 frontier mark — two different treatments of the same situation.
- **Impact:** +4,047.99 PKR of net P&L currently counted as realized belongs to trades that, per contract, should still be open. The strictly-correct realized figure would be **−711,418.96 PKR** (7W/68L among 71 realized trades) with **+4,047.99** unrealized. The published −707,370.97 stays in place per the cohort-protection rules; both figures are now on record.
- **Action taken (forward-only):** gate fixed to `!exitReason.startsWith("TIME_UP") || fullHorizonExamined` (`src/lib/latent/prospective-lifecycle.ts`) with a regression test (`scripts/task125_gate_test.ts`, 5/5 passing, which also demonstrates the old gate would have closed the trade). **The historical 114-record cohort, its fills, timestamps and outcomes were not altered.** The forward re-mark policy for any trade still sitting in this state is specified in Task 127.

## 11. Bottom line

`114 = 78 + 3 + 33` holds; 86 exit events reconcile exactly to the ledger; the 79-vs-78 discrepancy is a corrected prose defect; P&L reproduces to the paisa from immutable fills; every fill is causally ordered after its prediction and priced from real bars; pending entries are honestly pending on provider gaps; and one premature-closure defect was found, quantified (+4,047.99 PKR mis-classified as realized), fixed forward in the engine, and documented without rewriting the historical cohort.
