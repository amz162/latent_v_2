#!/usr/bin/env python3
"""Task 110 — parity harness (Python side + comparison). Computes the same
symbols/configs as scripts/task110_parity_ts.ts and writes
data/backtest_reports/task110/task110_cost_parity_report.json."""
from __future__ import annotations
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task110_lib as L
import task110_phases_research as R


def main():
    ts_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/task110_parity_ts.json")
    ts = L.jread(ts_path)
    symbols = ["HUBC", "SYS", "LUCK"]
    configs = [(0.2, "ATL_15"), (0.1, "NON_ATL_30")]
    checks, mismatches = [], []
    for sym in symbols:
        ind = R.compute_symbol_indicators(sym)
        bars = ind["bars"]
        t = len(bars) - 1
        # MA parity
        ts_sym = ts["symbols"][sym]
        for name, py_v, ts_v in [("lastMa7", ind["ma7"][t], ts_sym["lastMa7"]),
                                 ("lastMa30", ind["ma30"][t], ts_sym["lastMa30"]),
                                 ("lastClose", ind["closes"][t], ts_sym["lastClose"])]:
            ok = (py_v is None) == (ts_v is None) and (py_v is None or abs(py_v - ts_v) < 1e-9)
            checks.append(dict(kind="indicator", name=name, symbol=sym, python=py_v, ts=ts_v, match=ok))
            if not ok:
                mismatches.append(checks[-1])
        for pct, tax in configs:
            key = f"p{pct}_{tax}"
            r = R.run_portfolio({sym: ind}, sizing_pct=pct, sizing_mode="pct_equity",
                                tax_profile=tax)
            py = dict(finalEquity=r["account"]["final_equity"], trades=r["account"]["trades"],
                      realizedNetPnl=r["account"]["realized_net_pnl"], roiPct=r["account"]["roi_pct"],
                      firstTrade=r["_trades"][0] if r["_trades"] else None,
                      lastTrade=r["_trades"][-1] if r["_trades"] else None)
            tsv = ts_sym[key]
            ok_eq = abs(py["finalEquity"] - tsv["finalEquity"]) < 0.01
            ok_n = py["trades"] == tsv["trades"]
            ok_r = abs(py["realizedNetPnl"] - tsv["realizedNetPnl"]) < 0.01
            ft_ok = (py["firstTrade"] is None) == (tsv["firstTrade"] is None) and (
                py["firstTrade"] is None or (
                    py["firstTrade"]["symbol"] == tsv["firstTrade"]["symbol"] and
                    py["firstTrade"]["execution_date"] == tsv["firstTrade"]["executionDate"] and
                    abs(py["firstTrade"]["net_pnl"] - tsv["firstTrade"]["netPnl"]) < 0.01))
            ok = ok_eq and ok_n and ok_r and ft_ok
            checks.append(dict(kind="portfolio", name=key, symbol=sym,
                               python=dict(finalEquity=py["finalEquity"], trades=py["trades"],
                                           realizedNetPnl=py["realizedNetPnl"]),
                               ts=dict(finalEquity=tsv["finalEquity"], trades=tsv["trades"],
                                       realizedNetPnl=tsv["realizedNetPnl"]),
                               match=ok))
            if not ok:
                mismatches.append(checks[-1])
    L.artifact("task110_cost_parity_report.json", "task110_cost_parity_report",
               "completed" if not mismatches else "mismatch",
               method="identical inputs (db bars, >=10-symbol session calendar, V2 profile) through the Python research engine and the TS dashboard engine",
               cost_pathways=dict(python="task110_lib.trade_costs_v2 (exact port)",
                                  ts="src/lib/latent/trading-costs.ts computeTradeCostsV2 (production engine)"),
               checks=checks, all_match=not mismatches, mismatches=mismatches[:10],
               symbols=symbols, configs=[f"{p}_{t}" for p, t in configs])
    print(f"parity: {sum(1 for c in checks if c['match'])}/{len(checks)} checks match")


if __name__ == "__main__":
    main()
