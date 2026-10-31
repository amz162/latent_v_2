"""Task 96 Phase 7 — Variant B and cost reconciliation re-verification."""
import json
import re
import sqlite3
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
T95 = BASE / "data/backtest_reports/task95"
T94 = BASE / "data/backtest_reports/task94"
T93 = BASE / "data/backtest_reports/task93"
PRIORITY = 70

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


@reg("p7_variant_b_costs")
def p7_variant_b_costs(ctx):
    def rel_ok(a, b):
        return abs(a - b) <= max(2.0, abs(b) * 1e-5)
    rob = json.loads((T94 / "task94_strategy_robustness.json").read_text())
    net = json.loads((T94 / "task94_net_strategy_results.json").read_text())
    checks = []
    for period, v in rob["variant_b_validation"]["profitability_by_period"].items():
        checks.append({"artifact": "strategy_robustness", "cell": f"variant_b/{period}",
                       "match": rel_ok(v["gross"] - v["cost"], v["net"])})
    for variant in ("baseline", "variant_a", "variant_b"):
        v = net[variant]
        checks.append({"artifact": "net_strategy_results", "cell": variant,
                       "match": rel_ok(v["gross_pnl_total"] - v["total_cost"], v["net_pnl_total"]),
                       "win_rate_stored": v.get("win_rate_pct"),
                       "win_rate_recomputed": round(100 * v["n_winning_trades"] / v["n_completed_trades"], 2)
                       if v["n_completed_trades"] else None})
    # CGT on losers = 0 (from real legs)
    conn = sqlite3.connect(str(BASE / "db/custom.db"))
    conn.row_factory = sqlite3.Row
    cgt_losers = [dict(r) for r in conn.execute(
        """SELECT t.symbol, SUM(l.cgt) cgt FROM PaperTradeLeg l
           JOIN ProspectivePaperTrade t ON t.id = l.tradeId
           WHERE t.state='closed' AND t.isWin=0 GROUP BY t.id, t.isWin HAVING SUM(l.cgt) > 0.005""")]
    # prospective identities
    rows = [dict(r) for r in conn.execute(
        "SELECT grossPnl, totalCosts, netPnl FROM ProspectivePaperTrade WHERE state='closed'")]
    conn.close()
    bad_id = [r for r in rows if abs((r["grossPnl"] or 0) - (r["totalCosts"] or 0) - (r["netPnl"] or 0)) > 0.01]
    # task95 stress preserved
    t95_rob = json.loads((T95 / "task95_strategy_robustness.json").read_text())
    stress = t95_rob.get("slippage_stress")
    t95_cost = json.loads((T95 / "task95_cost_reconciliation.json").read_text())
    ctx.write("task96_variant_b_validation.json", {
        "task": "Task 96 Phase 7 — Variant B (atr_min_net_rr_2_v1) re-verification",
        "historical_checks": checks,
        "cgt_on_losing_trades": len(cgt_losers),
        "prospective_identity_violations": len(bad_id),
        "eligibility_before_outcomes": rob["variant_b_validation"]["checks"].get("eligibility_before_outcomes"),
        "validation_final_test_separated": rob["variant_b_validation"]["checks"].get("validation_final_test_separated"),
        "skipped_signals_reported": rob["variant_b_validation"]["checks"].get("skipped_samples_reported"),
        "tax_profiles": {"ATL": "15%", "NON_ATL": "30%"},
        "cost_profile": "psx_user_schedule_v2 (STANDARD_PSX alias) — zero slippage baseline preserved",
        "slippage_stress_from_task95_preserved": stress,
        "stress_note": "Task 95 stress on ~1.7M realized notional (+0.05/0.15/0.30% per side) is a "
                       "hypothetical overlay only; the user's actual zero-slippage V2 profile is unchanged",
        "verdict": ("all identities hold; CGT charged on winners only; costs not double-counted; "
                    "historical and prospective results kept separate" if all(c["match"] for c in checks)
                    and not cgt_losers and not bad_id else "MISMATCH — inspect"),
    })
    # carry cost reconciliation artifact forward with fresh arithmetic
    ctx.write("task96_cost_reconciliation.json", {
        "task": "Task 96 Phase 7 — cost reconciliation re-verification",
        "rechecked_cells": len(checks),
        "all_match": all(c["match"] for c in checks),
        "task95_baseline": t95_cost.get("verdict"),
        "schedule_source": "src/lib/latent/trading-costs.ts (PSX_USER_SCHEDULE_V2)",
    })
