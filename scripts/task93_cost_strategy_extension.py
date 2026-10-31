#!/usr/bin/env python3
"""Task 93: Cost-aware strategy testing BEYOND Task 81's 540 cells.

Task 81 produced 540 cells = 5 models × 3 horizons × 2 periods × 3 variants ×
3 strategies × 2 tax profiles, all using costProfile='psx_user_schedule_v2'.

This script EXTENDS that analysis with derived views that don't require re-running
the trade simulator:

  1. Marginal cost impact per cell: grossPnl → netPnl, cost-as-fraction-of-gross
  2. Pairwise variant deltas (baseline vs variant_a vs variant_b)
     — measures the marginal effect of stricter R:R / net-RR filters
  3. Strategy comparison summary (fixed_first_hit vs max_tp_step_trailing vs scale_out_50_25_25)
  4. Tax profile impact (ATL_15 vs NON_ATL_30) — CGT differential
  5. Cost-component breakdown (brokerage vs fees vs CGT) — where the friction lives
  6. No-cost baseline (gross PnL view) — upper bound on profitability
  7. Cost-adjusted win-rate (after-cost break-even) — does cost flip winners to losers?

These views are derived from the saved 540-cell task81 artifact, NOT a new sim run.
They enable fair comparison WITHOUT modifying the protected task81 artifact.
"""
import json
from pathlib import Path
from collections import defaultdict

T81 = Path("/home/z/my-project/data/backtest_reports/task81_cost_rr_results_v1.json")
OUT = Path("/home/z/my-project/data/backtest_reports/task93/task93_cost_strategy_extension.json")


def main():
    d = json.load(open(T81))
    cells = d.get("perCell", [])
    n_cells = len(cells)
    print(f"Loaded {n_cells} cells from task81")

    # 1. Marginal cost impact
    cost_impact_rows = []
    for c in cells:
        gross = c.get("grossPnl", 0)
        net = c.get("netPnl", 0)
        cost = c.get("totalCost", 0)
        # cost-as-fraction-of-gross (only meaningful when gross != 0)
        cost_frac = (cost / abs(gross)) if gross != 0 else None
        # Did cost flip a winning gross into a losing net?
        gross_win = gross > 0
        net_win = net > 0
        flipped = gross_win and not net_win
        cost_impact_rows.append({
            "model": c["model"],
            "horizon": c["horizon"],
            "period": c["period"],
            "variant": c["variant"],
            "strategy": c["strategy"],
            "taxProfile": c["taxProfile"],
            "grossPnl": gross,
            "netPnl": net,
            "totalCost": cost,
            "costAsFracOfGross": round(cost_frac, 4) if cost_frac is not None else None,
            "grossProfitable": gross_win,
            "netProfitable": net_win,
            "costFlippedToLoss": flipped,
        })

    # 2. Pairwise variant deltas (group by everything except variant)
    variant_deltas = []
    groups = defaultdict(dict)
    for c in cells:
        key = (c["model"], c["horizon"], c["period"], c["strategy"], c["taxProfile"])
        groups[key][c["variant"]] = c
    for key, vs in groups.items():
        b = vs.get("baseline")
        a = vs.get("variant_a")
        x = vs.get("variant_b")
        if b and a:
            bw = b.get("winRate") or 0
            aw = a.get("winRate") or 0
            variant_deltas.append({
                "model": key[0], "horizon": key[1], "period": key[2],
                "strategy": key[3], "taxProfile": key[4],
                "comparison": "baseline → variant_a (entry-anchored TP1 R:R 1:1)",
                "baseline_netPnl": b["netPnl"], "variant_a_netPnl": a["netPnl"],
                "delta_netPnl": a["netPnl"] - b["netPnl"],
                "baseline_winRate": bw, "variant_a_winRate": aw,
                "delta_winRate": aw - bw,
            })
        if b and x:
            bw = b.get("winRate") or 0
            xw = x.get("winRate") or 0
            variant_deltas.append({
                "model": key[0], "horizon": key[1], "period": key[2],
                "strategy": key[3], "taxProfile": key[4],
                "comparison": "baseline → variant_b (net R:R ≥ 2.0 filter)",
                "baseline_netPnl": b["netPnl"], "variant_b_netPnl": x["netPnl"],
                "delta_netPnl": x["netPnl"] - b["netPnl"],
                "baseline_winRate": bw, "variant_b_winRate": xw,
                "delta_winRate": xw - bw,
            })

    # 3. Strategy comparison (group by everything except strategy)
    strategy_summary = []
    sgroups = defaultdict(list)
    for c in cells:
        key = (c["model"], c["horizon"], c["period"], c["variant"], c["taxProfile"])
        sgroups[key].append(c)
    for key, cs in sgroups.items():
        # Sort by netPnl
        cs_sorted = sorted(cs, key=lambda x: -x["netPnl"])
        best = cs_sorted[0]
        worst = cs_sorted[-1]
        strategy_summary.append({
            "model": key[0], "horizon": key[1], "period": key[2],
            "variant": key[3], "taxProfile": key[4],
            "bestStrategy": best["strategy"], "best_netPnl": best["netPnl"], "best_winRate": best.get("winRate"),
            "worstStrategy": worst["strategy"], "worst_netPnl": worst["netPnl"], "worst_winRate": worst.get("winRate"),
            "bestWorstDelta": best["netPnl"] - worst["netPnl"],
        })

    # 4. Tax profile impact (ATL_15 vs NON_ATL_30)
    tax_impact = []
    tgroups = defaultdict(dict)
    for c in cells:
        key = (c["model"], c["horizon"], c["period"], c["variant"], c["strategy"])
        tgroups[key][c["taxProfile"]] = c
    for key, ts in tgroups.items():
        atl = ts.get("ATL_15")
        non = ts.get("NON_ATL_30")
        if atl and non:
            tax_impact.append({
                "model": key[0], "horizon": key[1], "period": key[2],
                "variant": key[3], "strategy": key[4],
                "atl_15_netPnl": atl["netPnl"], "non_atl_30_netPnl": non["netPnl"],
                "delta_netPnl": atl["netPnl"] - non["netPnl"],
                "atl_15_cgt": atl.get("cgt", 0), "non_atl_30_cgt": non.get("cgt", 0),
                "cgt_delta": atl.get("cgt", 0) - non.get("cgt", 0),
                "atl_15_winRate": atl.get("winRate"), "non_atl_30_winRate": non.get("winRate"),
            })

    # 5. Cost-component breakdown (averages across all 540 cells)
    cost_components = defaultdict(float)
    for c in cells:
        cost_components["brokerage"] += c.get("brokerage", 0)
        cost_components["psxFee"]    += c.get("psxFee", 0)
        cost_components["nccplFee"]  += c.get("nccplFee", 0)
        cost_components["cdcFee"]    += c.get("cdcFee", 0)
        cost_components["cgt"]       += c.get("cgt", 0)
        cost_components["slippage"]  += c.get("slippage", 0)
        cost_components["totalCost"] += c.get("totalCost", 0)
        cost_components["grossPnl"]  += c.get("grossPnl", 0)
        cost_components["netPnl"]    += c.get("netPnl", 0)
    cost_components_summary = {k: round(v, 2) for k, v in cost_components.items()}
    # Fractional breakdown
    total_cost = cost_components["totalCost"]
    cost_fractions = {
        "brokerage_frac": round(cost_components["brokerage"] / total_cost, 4) if total_cost else 0,
        "psxFee_frac":    round(cost_components["psxFee"] / total_cost, 4) if total_cost else 0,
        "nccplFee_frac":  round(cost_components["nccplFee"] / total_cost, 4) if total_cost else 0,
        "cdcFee_frac":    round(cost_components["cdcFee"] / total_cost, 4) if total_cost else 0,
        "cgt_frac":       round(cost_components["cgt"] / total_cost, 4) if total_cost else 0,
        "slippage_frac":  round(cost_components["slippage"] / total_cost, 4) if total_cost else 0,
    }

    # 6. No-cost baseline (gross PnL view across all 540 cells)
    gross_total = sum(c.get("grossPnl", 0) for c in cells)
    net_total = sum(c.get("netPnl", 0) for c in cells)
    cost_total = sum(c.get("totalCost", 0) for c in cells)
    n_gross_profitable = sum(1 for c in cells if c.get("grossPnl", 0) > 0)
    n_net_profitable = sum(1 for c in cells if c.get("netPnl", 0) > 0)
    n_flipped = sum(1 for r in cost_impact_rows if r["costFlippedToLoss"])

    # 7. Aggregate by variant — overall comparison
    variant_agg = defaultdict(lambda: {"netPnl": 0, "grossPnl": 0, "totalCost": 0, "winRate_sum": 0, "n": 0, "n_with_wr": 0})
    for c in cells:
        v = c["variant"]
        variant_agg[v]["netPnl"] += c["netPnl"]
        variant_agg[v]["grossPnl"] += c["grossPnl"]
        variant_agg[v]["totalCost"] += c["totalCost"]
        wr = c.get("winRate")
        if wr is not None:
            variant_agg[v]["winRate_sum"] += wr
            variant_agg[v]["n_with_wr"] += 1
        variant_agg[v]["n"] += 1
    variant_summary = []
    for v, agg in variant_agg.items():
        n = agg["n"]
        n_wr = agg["n_with_wr"] or 1
        variant_summary.append({
            "variant": v,
            "n_cells": n,
            "n_with_winRate": agg["n_with_wr"],
            "avg_netPnl": round(agg["netPnl"] / n, 2),
            "avg_grossPnl": round(agg["grossPnl"] / n, 2),
            "avg_totalCost": round(agg["totalCost"] / n, 2),
            "avg_winRate": round(agg["winRate_sum"] / n_wr, 2) if agg["n_with_wr"] else None,
        })

    # Aggregate by strategy
    strategy_agg = defaultdict(lambda: {"netPnl": 0, "grossPnl": 0, "winRate_sum": 0, "n": 0, "n_with_wr": 0})
    for c in cells:
        s = c["strategy"]
        strategy_agg[s]["netPnl"] += c["netPnl"]
        strategy_agg[s]["grossPnl"] += c["grossPnl"]
        wr = c.get("winRate")
        if wr is not None:
            strategy_agg[s]["winRate_sum"] += wr
            strategy_agg[s]["n_with_wr"] += 1
        strategy_agg[s]["n"] += 1
    strategy_overall = []
    for s, agg in strategy_agg.items():
        n = agg["n"]
        n_wr = agg["n_with_wr"] or 1
        strategy_overall.append({
            "strategy": s,
            "n_cells": n,
            "n_with_winRate": agg["n_with_wr"],
            "avg_netPnl": round(agg["netPnl"] / n, 2),
            "avg_grossPnl": round(agg["grossPnl"] / n, 2),
            "avg_winRate": round(agg["winRate_sum"] / n_wr, 2) if agg["n_with_wr"] else None,
        })

    # Final report
    report = {
        "task": "Task 93.4 — Cost-aware strategy testing BEYOND Task 81's 540 cells",
        "source_artifact": "data/backtest_reports/task81_cost_rr_results_v1.json",
        "source_cells": n_cells,
        "derived_views": {
            "cost_impact_per_cell_n": len(cost_impact_rows),
            "variant_delta_comparisons_n": len(variant_deltas),
            "strategy_comparison_groups_n": len(strategy_summary),
            "tax_profile_impact_pairs_n": len(tax_impact),
        },
        "cost_components_summary": cost_components_summary,
        "cost_fractions_of_total": cost_fractions,
        "no_cost_baseline": {
            "gross_total": round(gross_total, 2),
            "net_total": round(net_total, 2),
            "total_cost_drag": round(cost_total, 2),
            "cost_as_pct_of_gross": round(cost_total / abs(gross_total) * 100, 2) if gross_total else None,
            "n_gross_profitable": n_gross_profitable,
            "n_net_profitable": n_net_profitable,
            "n_cost_flipped_to_loss": n_flipped,
            "interpretation": (
                f"Of {n_cells} cells, {n_gross_profitable} are gross-profitable but only "
                f"{n_net_profitable} remain net-profitable after costs. "
                f"Costs flipped {n_flipped} cells from gross-win to net-loss."
            ),
        },
        "variant_summary": variant_summary,
        "strategy_overall": strategy_overall,
        "variant_deltas_sample": variant_deltas[:6],
        "tax_impact_sample": tax_impact[:6],
        "strategy_comparison_sample": strategy_summary[:6],
        "limitations": [
            "Derived views are computed from the saved task81 540-cell artifact.",
            "No NEW simulation runs were executed — this is re-aggregation of existing data.",
            "To test additional signal thresholds (e.g., ≥0.55, ≥0.6) or longer horizons (h=30), the underlying trade simulator must be re-run with raw per-trade data.",
            "All cells use costProfile='psx_user_schedule_v2' (zero slippage, PSX/NCCPL/CDC fees, CGT 15%/30%).",
            "No new protected artifacts were modified.",
        ],
    }
    OUT.write_text(json.dumps(report, indent=2))

    print()
    print("=" * 70)
    print("COST-AWARE STRATEGY EXTENSION SUMMARY")
    print("=" * 70)
    print(f"\nSource: task81_cost_rr_results_v1.json ({n_cells} cells)")
    print(f"\nCost components (sum across all 540 cells):")
    for k, v in cost_components_summary.items():
        print(f"  {k:15s}: {v:>15,.2f}")
    print(f"\nCost fractions of total cost:")
    for k, v in cost_fractions.items():
        print(f"  {k:15s}: {v*100:>6.2f}%")
    print(f"\nNo-cost baseline (gross PnL view):")
    print(f"  gross_total       : {gross_total:>15,.2f}")
    print(f"  net_total         : {net_total:>15,.2f}")
    print(f"  total_cost_drag   : {cost_total:>15,.2f}")
    print(f"  gross profitable  : {n_gross_profitable}/{n_cells}")
    print(f"  net profitable    : {n_net_profitable}/{n_cells}")
    print(f"  cost-flipped cells: {n_flipped}")
    print(f"\nVariant summary (avg across cells):")
    for v in variant_summary:
        print(f"  {v['variant']:10s}: avg_net={v['avg_netPnl']:>12,.2f}  avg_winRate={v['avg_winRate']}")
    print(f"\nStrategy overall (avg across cells):")
    for s in strategy_overall:
        nm = s["strategy"]
        print(f"  {nm:25s}: avg_net={s['avg_netPnl']:>12,.2f}  avg_winRate={s['avg_winRate']}")
    print(f"\nWrote: {OUT}")


if __name__ == "__main__":
    main()
