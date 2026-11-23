#!/usr/bin/env python3
"""task128_verify.py — independently re-verify the pivotal prior claims from the
actual source artifacts (never assume a previous result remains correct)."""
import json, sqlite3

print("=== 1. task78 strategy results: net=gross-costs identity + cohort definition ===")
d = json.load(open("data/backtest_reports/task78_strategy_results_v1.json"))
meta_keys = {k: d.get(k) for k in ("sourceRunId", "sourceSamples", "valEndIdx", "costProfile", "notionalPerTrade", "policyVersion", "riskOverlay") if k in d or True}
print("meta:", json.dumps({k: d.get(k) for k in list(d.keys())[:12] if not isinstance(d.get(k), (dict, list))}, default=str)[:400])
for split in ("validationByStrategy", "finalTestByStrategy", "overallByStrategy"):
    pass
def rows(split_key):
    blk = d.get(split_key) or d.get("byStrategy", {}).get(split_key) or {}
    return blk
# find the actual structure
for k in d.keys():
    v = d[k]
    if isinstance(v, dict) and "fixed_first_hit" in v:
        print(f"structure: d['{k}'] has fixed_first_hit")
        for strat, s in v["fixed_first_hit"].items() if False else [(k2, v2) for k2, v2 in v.items()]:
            pass
        for strat in v:
            s = v[strat]
            if isinstance(s, dict) and "netPnl" in s:
                ident = abs(s["grossPnl"] - s["totalCosts"] - s["netPnl"])
                print(f"  {strat}: n={s.get('n') or s.get('nTrades')} win={s.get('winRate'):.2f}% gross={s['grossPnl']:.2f} costs={s['totalCosts']:.2f} net={s['netPnl']:.2f} PF={s.get('profitFactor')} identity_delta={ident:.4f}")

print()
print("=== 2. Task 123/125 per-strategy closed-trade breakdown (from DB, live) ===")
con = sqlite3.connect("file:db/custom.db?mode=ro", uri=True)
for r in con.execute("""SELECT strategyId, COUNT(*), ROUND(SUM(netPnl),2), SUM(isWin)
    FROM ProspectivePaperTrade WHERE state='closed' GROUP BY strategyId"""):
    print("  ", r)

print()
print("=== 3. RF h21 exploratory best-cell (task79 final-test) from audit CSV ===")
import csv
for r in csv.DictReader(open("reports/audit/all_models_comparison.csv")):
    if r.get("model") == "Random Forest":
        keys = [k for k in r.keys() if "21" in k or "netPnl" in k.lower() or "pf" in k.lower() or "tier" in k or "verdict" in k.lower()]
        print("  RF row fields:", {k: r[k] for k in keys if r[k]})

print()
print("=== 4. Majority Vote robustness + Bonferroni ===")
mv = json.load(open("data/backtest_reports/task94/task94_majority_vote_robustness.json"))
print("  keys:", list(mv.keys())[:12])
print("  dir_acc:", mv.get("dir_acc"), "CI:", mv.get("ci95") or mv.get("confidence_interval_95"))
mta = mv.get("multiple_testing_adjustment") or {}
print("  multiple_testing:", json.dumps(mta)[:300])
hc = mv.get("honest_conclusion") or mv.get("conclusion")
print("  conclusion:", (json.dumps(hc)[:400] if hc else None))
