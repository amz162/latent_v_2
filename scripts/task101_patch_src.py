#!/usr/bin/env python3
"""Task 101 — P0 source patches: unify Investment Simulator + signal-stats on
psx_user_schedule_v2 (default), keep legacy_flat_v1 as an explicitly named
compatibility profile, extend the models registry with task101 supplemental
entries, update docs. Idempotent-ish: asserts expected anchors exist."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

# ── 1. investment-simulator.ts ────────────────────────────────────────────────
p = ROOT / "src/lib/latent/investment-simulator.ts"
s = p.read_text()
old = 'import { db } from "@/lib/db";\nimport { simulateProgressiveTpSl, type TpSlBar } from "./tp-sl-engine";'
new = '''import { db } from "@/lib/db";
import { simulateProgressiveTpSl, type TpSlBar } from "./tp-sl-engine";
import {
  PSX_USER_SCHEDULE_V2, computeTradeCostsV2, type TaxProfile,
} from "./trading-costs";

// ─── Task 101 — unified cost models ──────────────────────────────────────────
// The Investment Simulator now DEFAULTS to psx_user_schedule_v2 (the same
// canonical cost functions the strategy engine uses), so the same trade shows
// the same gross/net P&L on every screen. The old flat model (commission
// 0.15% x2 + slippage 0.15% + CGT 15%, no PSX/NCCPL/CDC fees) is preserved
// ONLY as the explicitly named historical compatibility profile
// "legacy_flat_v1". Results always carry costProfile/taxProfile labels.
export type SimCostProfileId = "psx_user_schedule_v2" | "legacy_flat_v1";
export const SIM_DEFAULT_COST_PROFILE: SimCostProfileId = "psx_user_schedule_v2";
export const SIM_COST_PROFILES: { id: SimCostProfileId; label: string; defaultTaxProfile: TaxProfile }[] = [
  { id: "psx_user_schedule_v2", label: "PSX User Schedule v2 (0.03/share <=20 or 0.15% >20 per side, PSX+NCCPL+CDC fees, zero slippage, CGT 15% ATL / 30% NON-ATL)", defaultTaxProfile: "ATL_15" },
  { id: "legacy_flat_v1", label: "Legacy flat v1 (commission 0.15% x2, slippage 0.15%, CGT 15% flat, no ancillary fees) — historical compatibility only", defaultTaxProfile: "ATL_15" },
];

export interface SimCostBreakdown {
  costProfile: SimCostProfileId;
  taxProfile: TaxProfile;
  brokerage: number;
  psxFee: number;
  nccplFee: number;
  cdcFee: number;
  slippage: number;
  cgt: number;
  totalCost: number;
  netPnl: number;
}

/**
 * Single source of truth for Investment-Simulator trade costs.
 * V2 delegates to computeTradeCostsV2 (strategy-engine parity by construction);
 * quantity is the exact fraction entryAmount/entryPrice so value-based fees are
 * exact and the per-share minimum applies pro-rata. Legacy path reproduces the
 * pre-Task-101 flat model bit-for-bit.
 */
export function computeSimTradeCosts(
  entryAmount: number,
  entryPrice: number,
  exitPrice: number,
  grossPnl: number,
  profileId: SimCostProfileId = SIM_DEFAULT_COST_PROFILE,
  taxProfile: TaxProfile = "ATL_15",
): SimCostBreakdown {
  if (profileId === "legacy_flat_v1") {
    const commission = entryAmount * COMMISSION_RATE * 2; // both sides
    const slippage = entryAmount * SLIPPAGE_RATE;
    const cgt = grossPnl > 0 ? grossPnl * CGT_RATE : 0; // legacy flat 15%
    const totalCost = commission + slippage + cgt;
    return { costProfile: profileId, taxProfile: "ATL_15", brokerage: commission,
             psxFee: 0, nccplFee: 0, cdcFee: 0, slippage, cgt, totalCost,
             netPnl: grossPnl - totalCost };
  }
  const qty = entryPrice > 0 ? entryAmount / entryPrice : 0;
  const v2 = computeTradeCostsV2(qty, entryPrice,
    [{ quantity: qty, exitPrice }], grossPnl, PSX_USER_SCHEDULE_V2, taxProfile);
  void exitPrice; // exit fills enter via the leg list above
  return { costProfile: profileId, taxProfile, brokerage: v2.totalBrokerage,
           psxFee: v2.totalPSX, nccplFee: v2.totalNCCPL, cdcFee: v2.totalCDC,
           slippage: v2.slippage, cgt: v2.cgt, totalCost: v2.totalCost,
           netPnl: v2.netPnl };
}'''
assert old in s, "simulator import anchor"
s = s.replace(old, new)

idx = s.index("export interface InvestmentSimInput {")
end = s.index("}", idx)
s = s[:end] + '''  /** Task 101: cost model — psx_user_schedule_v2 (default) or legacy_flat_v1. */
  costProfile?: SimCostProfileId;
  /** Task 101: CGT profile for the V2 path (ATL 15% / NON-ATL 30%). */
  taxProfile?: TaxProfile;
''' + s[end:]

old3 = '''    signals: rawSignals,
    seed = Date.now(),
  } = input;'''
new3 = '''    signals: rawSignals,
    seed = Date.now(),
    costProfile = SIM_DEFAULT_COST_PROFILE,
    taxProfile = "ATL_15",
  } = input;'''
assert old3 in s, "destructure anchor"
s = s.replace(old3, new3)

old4 = '''    const commission = entryAmount * COMMISSION_RATE * 2; // both sides
    const slippage = entryAmount * SLIPPAGE_RATE;
    const cgt = grossPnl > 0 ? grossPnl * CGT_RATE : 0;
    const cost = commission + slippage + cgt;
    const netPnl = grossPnl - cost;'''
new4 = '''    // Task 101: unified cost model (psx_user_schedule_v2 by default; the
    // legacy flat model only when costProfile === "legacy_flat_v1").
    const costs = computeSimTradeCosts(entryAmount, pickedRes.entryPrice,
      pickedRes.exitPrice, grossPnl, costProfile, taxProfile);
    const commission = costs.brokerage;
    const slippage = costs.slippage;
    const cgt = costs.cgt;
    const cost = costs.totalCost;
    const netPnl = costs.netPnl;
    const psxFee = costs.psxFee;
    const nccplFee = costs.nccplFee;
    const cdcFee = costs.cdcFee;'''
assert old4 in s, "cost block anchor"
s = s.replace(old4, new4)

old = "      pnl: netPnl,"
new = '''      pnl: netPnl,
      commission: costs.brokerage,
      psxFee: costs.psxFee,
      nccplFee: costs.nccplFee,
      cdcFee: costs.cdcFee,
      slippage: costs.slippage,
      cgt: costs.cgt,
      totalCost: costs.totalCost,
      costProfile: costProfile,
      taxProfile: taxProfile,'''
assert old in s, "row anchor"
s = s.replace(old, new, 1)

old2 = '''  pnl: number; // realized NET P&L (after costs)
  grossPnl: number; // realized GROSS P&L (before costs)'''
new2 = '''  pnl: number; // realized NET P&L (after costs)
  grossPnl: number; // realized GROSS P&L (before costs)
  // Task 101 — cost breakdown (V2 by default; legacy when legacy_flat_v1)
  commission?: number;
  psxFee?: number;
  nccplFee?: number;
  cdcFee?: number;
  slippage?: number;
  cgt?: number;
  totalCost?: number;
  costProfile?: SimCostProfileId;
  taxProfile?: TaxProfile;'''
assert old2 in s, "row interface anchor"
s = s.replace(old2, new2)

old3 = '''export interface InvestmentSimResult {
  initialAmount: number;'''
new3 = '''export interface InvestmentSimResult {
  costProfile: SimCostProfileId; // Task 101 — label of the cost model used
  taxProfile: TaxProfile;
  totalCosts: number; // sum of per-trade totalCost (brokerage+fees+slippage+CGT)
  costBreakdown: { brokerage: number; psxFee: number; nccplFee: number; cdcFee: number; slippage: number; cgt: number };
  initialAmount: number;'''
assert old3 in s, "result interface anchor"
s = s.replace(old3, new3)

old4 = '''  return {
    initialAmount: capital,
    finalAmount,'''
new4 = '''  // Task 101 — cost profile labels + aggregate cost breakdown
  const tradeRowsOnly = rows.filter((r) => r.type === "TRADE");
  const costBreakdown = tradeRowsOnly.reduce(
    (acc, r) => ({
      brokerage: acc.brokerage + (r.commission ?? 0),
      psxFee: acc.psxFee + (r.psxFee ?? 0),
      nccplFee: acc.nccplFee + (r.nccplFee ?? 0),
      cdcFee: acc.cdcFee + (r.cdcFee ?? 0),
      slippage: acc.slippage + (r.slippage ?? 0),
      cgt: acc.cgt + (r.cgt ?? 0),
    }),
    { brokerage: 0, psxFee: 0, nccplFee: 0, cdcFee: 0, slippage: 0, cgt: 0 });

  return {
    costProfile,
    taxProfile,
    totalCosts: tradeRowsOnly.reduce((sm, r) => sm + (r.totalCost ?? 0), 0),
    costBreakdown,
    initialAmount: capital,
    finalAmount,'''
assert old4 in s, "result return anchor"
s = s.replace(old4, new4, 1)
p.write_text(s)
print("investment-simulator.ts patched")

# ── 2. signal-stats route ─────────────────────────────────────────────────────
p = ROOT / "src/app/api/backtest/signal-stats/route.ts"
s = p.read_text()
old = '''const COMMISSION_RATE = 0.0015;
const SLIPPAGE_RATE = 0.0015;
const CGT_RATE = 0.15;'''
new = '''// Task 101 — cost model unified with the strategy engine: psx_user_schedule_v2
// by default via the shared Investment-Simulator cost helper; the legacy flat
// model is available ONLY as an explicitly named compatibility profile.
const SIGNAL_STATS_NOTIONAL = 100_000; // notional used to size cost fractions'''
assert old in s, "signal-stats constants anchor"
s = s.replace(old, new)
old2 = '''  const costPct = (COMMISSION_RATE * 2 + SLIPPAGE_RATE) * 100;
  const cgtPct = grossPct > 0 ? grossPct * CGT_RATE : 0;
  const netPct = grossPct - costPct - cgtPct;'''
new2 = '''  const grossAbs = (grossPct / 100) * SIGNAL_STATS_NOTIONAL;
  const costs = computeSimTradeCosts(SIGNAL_STATS_NOTIONAL, entryPrice, exitPrice, grossAbs, "psx_user_schedule_v2", "ATL_15");
  const costPct = (costs.totalCost / SIGNAL_STATS_NOTIONAL) * 100;
  const netPct = grossPct - costPct;'''
assert old2 in s, "signal-stats cost block anchor"
s = s.replace(old2, new2)
if "computeSimTradeCosts" not in s.split("\n\n")[0] and not any(
        "computeSimTradeCosts" in l and "import" in l for l in s.split("\n")):
    lines = s.split("\n")
    last_import = max(i for i, l in enumerate(lines) if l.startswith("import "))
    lines.insert(last_import + 1, 'import { computeSimTradeCosts } from "@/lib/latent/investment-simulator";')
    s = "\n".join(lines)
p.write_text(s)
print("signal-stats route patched")

# ── 3. investment-simulator route ─────────────────────────────────────────────
p = ROOT / "src/app/api/backtest/investment-simulator/route.ts"
s = p.read_text()
old = '''    const result = await runInvestmentSimulation({
      capital,
      periodValue,
      periodUnit,
      monthlySip,
      numTrades,
      minConfidence,
      direction,
      signals,
    });'''
new = '''    const result = await runInvestmentSimulation({
      capital,
      periodValue,
      periodUnit,
      monthlySip,
      numTrades,
      minConfidence,
      direction,
      signals,
      // Task 101 — cost model defaults to psx_user_schedule_v2; callers may
      // request legacy_flat_v1 explicitly for historical comparison.
      costProfile: ["psx_user_schedule_v2", "legacy_flat_v1"].includes(String(url.searchParams.get("costProfile")))
        ? (url.searchParams.get("costProfile") as "psx_user_schedule_v2" | "legacy_flat_v1")
        : undefined,
      taxProfile: url.searchParams.get("taxProfile") === "NON_ATL_30" ? "NON_ATL_30" : "ATL_15",
    });'''
assert old in s, "simulator route anchor"
p.write_text(s.replace(old, new))
print("investment-simulator route patched")

# ── 4. models registry route (task101 supplemental merge) ────────────────────
p = ROOT / "src/app/api/models/registry/route.ts"
s = p.read_text()
old = '''      }
    }
    return NextResponse.json({
      available: true,
      canonicalCount: ALL_MODELS.length,'''
new = '''      }
    }
    // Task 101: merge the cost-aware trade-outcome models (supplemental).
    // psx_cost_aware_trade_classifier: P(realized net trade > 0 after full
    // psx_user_schedule_v2 costs) on 11,521 production-engine-labeled trades;
    // psx_net_expectancy_meta_model: net-return/excursion regressors (Targets C/D).
    // Both are shadow-only until matured positive-expectancy evidence exists.
    const t101Reg = await readJson("data/backtest_reports/task101/task101_model_registry.json");
    if (t101Reg?.supplemental_models) {
      for (const m of t101Reg.supplemental_models as any[]) {
        supplemental.push({
          name: m.name,
          id: m.id,
          verifiedStatus: m.verifiedStatus,
          status: m.status,
          metrics: m.metrics,
          dirAcc5d: m.dirAcc5d ?? null,
          mae5d: m.mae5d ?? null,
          supplemental: true,
          task101: {
            family: m.family,
            cost_profile: m.cost_profile,
            label_engine: m.label_engine,
            n_labeled_trades: m.n_labeled_trades,
            positive_rate_train: m.positive_rate_train,
            frozen_rule: m.frozen_rule,
            final_test_summary: m.final_test_summary,
            promotion_status: m.promotion_status,
            evaluation_policy: m.evaluation_policy,
          },
        });
      }
    }
    return NextResponse.json({
      available: true,
      canonicalCount: ALL_MODELS.length,'''
assert old in s, "registry anchor"
p.write_text(s.replace(old, new))
print("registry route patched")

# ── 5. docs/investment-simulator-metrics.md ──────────────────────────────────
p = ROOT / "docs/investment-simulator-metrics.md"
s = p.read_text()
old = """| **Investment Simulator** (Tracker → Investment Simulator) | `investment-simulator.ts` | close of the bar nearest the slot target | commission 0.15% × 2 sides + slippage 0.15% + CGT 15% (legacy flat model, **no** PSX/NCCPL/CDC fees, no ATL/NON-ATL choice) |"""
new = """| **Investment Simulator** (Tracker → Investment Simulator) | `investment-simulator.ts` | close of the bar nearest the slot target | **`psx_user_schedule_v2` (Task 101 default)**: 0.03 PKR/share (price ≤ 20) or 0.15%/side, PSX + NCCPL + CDC fees, zero slippage, CGT 15% ATL / 30% NON-ATL — via the shared `computeSimTradeCosts` → `computeTradeCostsV2` |"""
if old in s:
    s = s.replace(old, new)
    s += """

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
"""
    p.write_text(s)
    print("docs updated")
else:
    print("docs already updated or anchor changed")
print("ALL SRC PATCHES DONE")
