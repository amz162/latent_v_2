#!/usr/bin/env python3
"""task128_build_comparison.py — build task128_comparison.csv from the source
artifacts (task100/task99/task94/walk-forward/task78/forward cohorts). Read-only."""
import json, csv, sqlite3

OUT = "reports/operations/task128_comparison.csv"
rows = []

# ---- forecast metrics: task100 (9 classical models, val + final-test) ----
d = json.load(open("data/backtest_reports/task100/task100_model_comparison.json"))
by = d.get("byModel") or d.get("models") or d
def cells(obj):
    out = []
    def rec(o, ctx):
        if isinstance(o, dict):
            if "mae" in o and "directional_accuracy" in o:
                out.append((ctx, o))
            for k, v in o.items():
                rec(v, ctx + [k])
    rec(obj, [])
    return out
models_seen = set()
for ctx, c in cells(d):
    mdl = next((x for x in ctx if x in ("XGBoost","LightGBM","CatBoost","Random Forest","Ridge Regression","ExtraTrees","HistGradientBoosting","ElasticNet","HuberRegressor")), None)
    split = next((x for x in ctx if x in ("validation", "final_test")), None)
    hz = next((x for x in ctx if x in ("5", "10", "21", 5, 10, 21)), None)
    if mdl and split and hz is not None and (mdl, split, hz) not in models_seen:
        models_seen.add((mdl, split, hz))
        rows.append({"family": "classical", "name": mdl, "horizon": hz, "split": split,
                     "n": c.get("n"), "mae": c.get("mae"), "rmse": c.get("rmse"), "r2": c.get("r2"),
                     "directional_accuracy": c.get("directional_accuracy"),
                     "ci95_low": c.get("mae_ci95_low"), "ci95_high": c.get("mae_ci95_high"),
                     "evidence_class": "historical frozen-split (task100; final-test once, no preregistration doc)",
                     "source": "task100_model_comparison.json"})

# ---- walk-forward (pilot25 classical 5) ----
wf = json.load(open("data/backtest_reports/walk_forward_latest.json"))
wf_rows = wf.get("perModelPerHorizon") or wf.get("models") or {}
def flat_models(obj):
    out = []
    def rec(o, ctx):
        if isinstance(o, dict):
            if "directional_accuracy" in o:
                out.append((ctx, o))
            for k, v in o.items():
                rec(v, ctx + [k])
    rec(obj, [])
    return out
seen2 = set()
for ctx, c in flat_models(wf):
    mdl = next((x for x in ctx if x in ("XGBoost","LightGBM","CatBoost","Random Forest","Ridge Regression")), None)
    hz = next((x for x in ctx if x in ("5","10","21",5,10,21,"h5","h10","h21")), None)
    if mdl and hz is not None and (mdl, hz) not in seen2:
        seen2.add((mdl, hz))
        rows.append({"family": "classical", "name": mdl, "horizon": hz, "split": "walk_forward_expanding",
                     "n": c.get("n") or c.get("n_observations") or 400, "mae": c.get("mae"), "rmse": c.get("rmse"),
                     "r2": c.get("r2") or c.get("r2_standard_unclamped"),
                     "directional_accuracy": c.get("directional_accuracy"),
                     "ci95_low": (c.get("uncertainty_95ci") or [None, None])[0] if isinstance(c.get("uncertainty_95ci"), list) else None,
                     "ci95_high": (c.get("uncertainty_95ci") or [None, None])[1] if isinstance(c.get("uncertainty_95ci"), list) else None,
                     "evidence_class": "walk-forward expanding window 2023-04-17..2026-07-23 (untouched rolling OOS)",
                     "source": "walk_forward_latest.json"})

# ---- deep / foundation ----
for f, fam, src in (("data/backtest_reports/task99/task99_metrics.csv", "deep", "task99_metrics.csv"),
                    ("data/backtest_reports/task94/task94_chronos_results.json", "foundation", "task94_chronos_results.json"),
                    ("data/backtest_reports/task96/task96_moirai_results.json", "foundation", "task96_moirai_results.json"),
                    ("data/backtest_reports/task94/task94_majority_vote_robustness.json", "ensemble", "task94_majority_vote_robustness.json")):
    try:
        if f.endswith(".csv"):
            for r in csv.DictReader(open(f)):
                rows.append({"family": fam, "name": r.get("model"), "horizon": r.get("horizon"),
                             "split": r.get("partition") or r.get("split"), "n": r.get("n"),
                             "mae": r.get("mae"), "rmse": r.get("rmse"), "r2": r.get("r2"),
                             "directional_accuracy": r.get("directional_accuracy"),
                             "ci95_low": r.get("mae_ci95_low"), "ci95_high": r.get("mae_ci95_high"),
                             "evidence_class": "historical frozen split (explicit calendar dates)", "source": src})
        else:
            j = json.load(open(f))
            for ctx, c in cells(j):
                nm = next((x for x in ctx if "majority" in str(x).lower() or "chronos" in str(x).lower() or "moirai" in str(x).lower() or x in ("h5","h10","h21","5","10",5,10,21)), None)
                hz = next((x for x in ctx if x in ("h5","h10","h21","5","10",5,10,21)), None)
                if "dir_acc" in c:
                    rows.append({"family": fam, "name": nm or fam + "_model", "horizon": hz, "split": str(ctx[-1]) if ctx else "",
                                 "n": c.get("n"), "mae": c.get("mae"), "rmse": c.get("rmse"), "r2": c.get("r2"),
                                 "directional_accuracy": c.get("dir_acc") if "dir_acc" in c else c.get("directional_accuracy"),
                                 "ci95_low": (c.get("dir_acc_ci95") or c.get("ci95") or [None,None])[0] if isinstance(c.get("dir_acc_ci95") or c.get("ci95"), list) else None,
                                 "ci95_high": (c.get("dir_acc_ci95") or c.get("ci95") or [None,None])[1] if isinstance(c.get("dir_acc_ci95") or c.get("ci95"), list) else None,
                                 "evidence_class": "exploratory post-hoc", "source": src})
    except FileNotFoundError:
        pass

# ---- strategies: task78 (retrospective exploratory) ----
t78 = json.load(open("data/backtest_reports/task78_strategy_results_v1.json"))
for r in t78["overallByStrategy"]:
    rows.append({"family": "strategy", "name": r["strategyId"], "horizon": "pooled(5+10+21)",
                 "split": r["period"], "n": r["nCompleted"], "mae": None, "rmse": None, "r2": None,
                 "directional_accuracy": None, "ci95_low": None, "ci95_high": None,
                 "win_rate": round(r["winRate"], 2), "gross_pnl": r["grossPnl"], "costs": r["totalCosts"],
                 "net_pnl": r["netPnl"], "profit_factor": r["profitFactor"],
                 "evidence_class": "RETROSPECTIVE EXPLORATORY (task78 declaration; policies chosen after inspection)",
                 "source": "task78_strategy_results_v1.json"})

# ---- strategies: genuine forward cohort (Task 123/125 live ledger) ----
con = sqlite3.connect("file:db/custom.db?mode=ro", uri=True)
for strat, n, net, wins in con.execute("""SELECT strategyId, COUNT(*), ROUND(SUM(netPnl),2), SUM(isWin)
    FROM ProspectivePaperTrade WHERE state='closed' GROUP BY strategyId"""):
    gp = con.execute("SELECT SUM(CASE WHEN grossPnl>0 THEN grossPnl ELSE 0 END), SUM(CASE WHEN grossPnl<0 THEN grossPnl ELSE 0 END) FROM ProspectivePaperTrade WHERE state='closed' AND strategyId=?", (strat,)).fetchone()
    pf = round(gp[0] / abs(gp[1]), 4) if gp[1] else None
    rows.append({"family": "strategy", "name": strat, "horizon": "pooled(5+10+21)", "split": "forward_genuine_2026-10-29",
                 "n": n, "win_rate": round(100*wins/n, 2), "net_pnl": net, "profit_factor": pf,
                 "evidence_class": "GENUINE FORWARD cohort (only non-hypothetical evidence; 7 h21 scale_out rows carry the premature-closure defect +4,047.99, see task125 §10)",
                 "source": "db ProspectivePaperTrade (task125_reconcile)"})

# ---- technical strategies (golden cross / overlays) ----
gc = json.load(open("data/backtest_reports/task110/task110_golden_cross_benchmark_comparison.json"))
def find_gc(o):
    if isinstance(o, dict):
        if "roi_pct" in o and ("win_rate" in o or "profit_factor" in o):
            yield o
        for v in o.values(): yield from find_gc(v)
    elif isinstance(o, list):
        for v in o: yield from find_gc(v)
for c in find_gc(gc):
    rows.append({"family": "technical", "name": "golden_cross_7_30", "horizon": "daily swing",
                 "split": "2016-10..2026-11 historical sim (V2 costs)", "n": c.get("trades"),
                 "win_rate": c.get("win_rate"), "net_pnl": c.get("final_equity"), "roi_pct": c.get("roi_pct"),
                 "profit_factor": c.get("profit_factor"),
                 "evidence_class": "historical sim, threshold-free rules; loses to cash and buy-and-hold",
                 "source": "task110_golden_cross_benchmark_comparison.json"})
    break

vo = json.load(open("data/backtest_reports/task111/task111_volatility_overlay_backtest.json"))
def find_ov(o):
    if isinstance(o, dict):
        if "roi_pct" in o:
            yield o
        for v in o.values(): yield from find_ov(v)
    elif isinstance(o, list):
        for v in o: yield from find_ov(v)
seen3 = set()
for c in find_ov(vo):
    nm = c.get("strategy") or c.get("config") or c.get("name")
    if nm and nm not in seen3 and ("overlay" in str(nm) or "golden" in str(nm) or "buy" in str(nm) or "cash" in str(nm)):
        seen3.add(nm)
        rows.append({"family": "technical", "name": nm, "horizon": "daily", "split": "2016-10..2026-11 historical sim (V2 costs)",
                     "n": c.get("trades"), "win_rate": c.get("win_rate"), "roi_pct": c.get("roi_pct"),
                     "max_drawdown_pct": c.get("max_drawdown_pct") or c.get("mdd_pct"),
                     "evidence_class": "historical sim with equity curve (drawdown legitimately computable here)",
                     "source": "task111_volatility_overlay_backtest.json"})

# ---- write ----
cols = ["family", "name", "horizon", "split", "n", "mae", "rmse", "r2", "directional_accuracy",
        "ci95_low", "ci95_high", "win_rate", "gross_pnl", "costs", "net_pnl", "profit_factor",
        "roi_pct", "max_drawdown_pct", "evidence_class", "source"]
with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in rows:
        w.writerow({k: (round(r[k], 6) if isinstance(r.get(k), float) else r.get(k, "")) for k in cols})
print(f"wrote {len(rows)} rows → {OUT}")
