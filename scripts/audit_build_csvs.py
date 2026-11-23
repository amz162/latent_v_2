#!/usr/bin/env python3
"""audit_build_csvs.py — build all_models_comparison.csv, all_strategies_comparison.csv,
audit_data_manifest.json from evidence_bundle.json (Phase 6/8). Read-only inputs.
(Restored verbatim after workspace recycle.)"""
import json, csv, hashlib, os, math, datetime, glob

R = "/home/z/my-project/repo_latent_v_2"
BR = f"{R}/data/backtest_reports"
OUT = f"{R}/reports/audit"
os.makedirs(OUT, exist_ok=True)
B = json.load(open(f"{BR}/audit/evidence_bundle.json"))
V = {"ok": [], "warn": [], "stamp": {}}
try:
    V = json.load(open(f"{BR}/audit/validation_results.json"))
except Exception:
    pass

def wilson(p, n, z=1.96):
    if n == 0: return ("", "")
    ph = p / 100 if p > 1 else p
    d = 1 + z * z / n
    c = (ph + z * z / (2 * n)) / d
    h = z * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d
    return (round(100 * (c - h), 1), round(100 * (c + h), 1))

# ── all_models_comparison.csv ────────────────────────────────────────────────
wf = {r["model"]: {} for r in B["walkforward_accuracy"]["rows"]}
for r in B["walkforward_accuracy"]["rows"]:
    wf[r["model"]][str(r["horizon"])] = r
t79 = {}
for r in B["task79_final_test"]["rows"]:
    t79[(r["model"], str(r["horizon"]))] = r

CODE_STATUS = {
    "PatchTST": "trained", "N-BEATS": "trained", "TimesNet": "trained", "Informer": "trained",
    "Chronos (Amazon)": "untrained (needs chronos-forecasting pkg)",
    "Lag-Llama": "untrained (needs custom repo)", "Moirai (Salesforce)": "untrained (needs uni2ts)",
    "Time-LLM": "untrained (needs LLM pipeline)",
    "XGBoost": "trained", "LightGBM": "trained", "CatBoost": "trained",
    "Random Forest": "trained", "LSTM": "trained", "CNN-LSTM": "trained",
    "Transformer-LSTM": "trained", "TabNet": "untrained (data type issue)",
    "FinGPT": "untrained (needs BloombergGPT)", "ARIMA": "trained", "Holt-Winters": "trained",
    "GARCH": "trained", "Ridge Regression": "trained", "Kalman Filter": "trained",
    "Prophet": "trained", "GRU": "trained", "XGBoost (CL)": "trained",
    "LightGBM (CL)": "trained", "Random Forest (CL)": "trained", "LSTM (CL)": "trained",
    "LightGBM-A (CL-2)": "trained", "LightGBM-B (CL-2)": "trained", "HistGBM (CL-2)": "trained",
    "ExtraTrees (CL-2)": "trained", "RandomForest (CL-2)": "trained", "Logistic (CL-2)": "trained",
    "MLP (CL-2)": "trained", "Linear Regression (PI)": "trained",
    "Logistic Regression (PI)": "trained", "Pattern Matcher KNN (PI)": "trained",
    "Neural Network (PI)": "trained"}

MODEL_ROWS = []
for name in ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"]:
    MODEL_ROWS.append((name, "TIER_3/CL", CODE_STATUS.get(name, "unknown"),
                       wf.get(name, {}), {h: t79.get((name, h)) for h in ("5", "10", "21")},
                       "walk-forward evaluated 2023-04→2026-07; task79 final-test traded"))
for name in ["ExtraTrees", "HistGradientBoosting", "ElasticNet", "HuberRegressor", "SVR"]:
    MODEL_ROWS.append((name, "task79 new", "trained (no eval)",
                       {}, {}, "task79: trained on 59,920 rows, eval=null → UNRANKED"))
_added = {"XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression",
          "ExtraTrees", "HistGradientBoosting", "ElasticNet", "HuberRegressor", "SVR"}
for name, status in CODE_STATUS.items():
    if name not in _added:
        MODEL_ROWS.append((name, "registry", status, {}, {},
                           "no out-of-sample evaluation available → UNRANKED"))
MODEL_ROWS.append(("GLM-4.6 analyst", "LLM", "research_only (hard-blocked)", {}, {},
                   "48 real decisions; 0 matured; excluded from paper cohort"))

with open(f"{OUT}/all_models_comparison.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["model", "tier", "implementation_status",
                "wf_h5_dir_acc", "wf_h5_mae", "wf_h5_rmse", "wf_h5_r2",
                "wf_h10_dir_acc", "wf_h10_mae", "wf_h10_rmse", "wf_h10_r2",
                "wf_h21_dir_acc", "wf_h21_mae", "wf_h21_rmse", "wf_h21_r2",
                "dir_acc_h5_ci95", "r2_baseline_note", "n_walkforward_obs",
                "t79_final_h5_netPnl", "t79_final_h5_PF", "t79_final_h5_n",
                "t79_final_h10_netPnl", "t79_final_h10_PF", "t79_final_h10_n",
                "t79_final_h21_netPnl", "t79_final_h21_PF", "t79_final_h21_n",
                "live_paper_ledger", "evidence_verdict"])
    for name, tier, status, wfd, t79d, note in MODEL_ROWS:
        row = [name, tier, status]
        for h in ("5", "10", "21"):
            r = wfd.get(h)
            row += [r["dir_acc_wavg"] if r else "", r["mae_wavg"] if r else "",
                    r["rmse_wavg"] if r else "", r["r2_wavg"] if r else ""]
        h5 = wfd.get("5")
        row.append(f"{wilson(h5['dir_acc_wavg'], h5['n_obs'])[0]}–{wilson(h5['dir_acc_wavg'], h5['n_obs'])[1]}%" if h5 else "")
        row.append("ALL R2<0 → worse than training-mean baseline; dir-acc vs 50% zero-return" if wfd else "no walk-forward evaluation")
        row.append(wfd.get("5", {}).get("n_obs", "") if wfd else "")
        for h in ("5", "10", "21"):
            r = t79d.get(h)
            row += ([round(r["netPnl"], 0), r["profitFactor"], r["n"]] if r else ["", "", ""])
        if name == "GLM-4.6 analyst":
            row += ["excluded (research_only)", "UNRANKED — 0 matured outcomes, no ablation possible"]
        elif wfd and t79d.get("21"):
            row += ["cohort processed in Task 123 (78 closed / 3 open / 33 pending)",
                    "RANKED (predictive weak: R2<0; trading exploratory n≤112)"]
        elif wfd:
            row += ["n/a", "RANKED predictive-only (R2<0, no significant edge)"]
        else:
            row += ["n/a", "UNRANKED — trained but never evaluated out-of-sample"]
        w.writerow(row)

# ── all_strategies_comparison.csv ────────────────────────────────────────────
t78 = json.load(open(f"{BR}/task78_strategy_results_v1.json"))
ov = t78["overallByStrategy"]
wfm = B["walkforward_trading"]["metrics"]
rows = []
rank_map = {("validation", "fixed_first_hit"): "RANKED #1 validation",
            ("final-test", "fixed_first_hit"): "RANKED #1 final-test (only positive net)",
            ("validation", "max_tp_step_trailing"): "RANKED (positive, fragile)",
            ("final-test", "max_tp_step_trailing"): "DISABLE candidate (negative net)",
            ("validation", "scale_out_50_25_25"): "DISABLE candidate (negative net)",
            ("final-test", "scale_out_50_25_25"): "DISABLE (worst net)"}
for r in ov:
    lo, hi = wilson(r["winRate"], r["nWinning"] + r["nLosing"])
    rows.append(["task78 (5 models pooled, same BUY cohort)",
                 r["strategyId"], r["period"],
                 f"2026-10-30 report; valEndIdx={t78['valEndIdx']}; pilot25_step50_20261028",
                 r["nEligible"], round(r["winRate"], 2), f"{lo}–{hi}%",
                 round(r["grossPnl"], 0), round(r["totalCosts"], 0), round(r["netPnl"], 0),
                 round(r["avgNetPerTrade"], 2), r["profitFactor"],
                 "YES (avgNet/trade>0)" if r["avgNetPerTrade"] > 0 else "NO",
                 "UNAVAILABLE", "UNAVAILABLE (no portfolio equity curve)",
                 rank_map[(r["period"], r["strategyId"])]])
fam_rank = {"fixed_horizon": "RANKED #1 (out-of-sample sim)",
            "progressive_tp_sl": "RANKED (marginal, cost-fragile)",
            "progressive_tp_sl_high_slippage_sensitivity": "REJECT at high slippage (PF<1)"}
for fam, m in wfm.items():
    lo, hi = wilson(100 * m["wins"] / m["n_executed_trades"], m["n_executed_trades"])
    rows.append(["walk_forward_trading_latest (genuine OOS sim, 100k/trade)",
                 fam, "final-test 200 samples",
                 f"generated {B['walkforward_trading']['generated_at'][:10]}; eval window 2023-04→2026-07",
                 m["n_eligible_samples"], round(100 * m["wins"] / m["n_executed_trades"], 2), f"{lo}–{hi}%",
                 round(m["total_gross_pnl"], 0), round(m["total_costs"], 0), round(m["total_net_pnl"], 0),
                 round(m["avg_net_return_pct"], 3) * 1000, round(m["profit_factor"], 3),
                 "YES" if m["avg_net_return_pct"] > 0 else "NO",
                 "UNAVAILABLE", "UNAVAILABLE (no portfolio equity curve)",
                 fam_rank[fam]])
cells = [c for c in t78["perCell"] if c["period"] == "final-test"]
cells.sort(key=lambda c: -c.get("netPnl", 0))
for c in cells[:6]:
    rows.append(["task78 perCell", f"{c['strategyId']} @ {c['model']} h{c['horizon']}",
                 "final-test cell", "same cohort", c.get("nEligible", ""),
                 round(c.get("winRate", 0), 2), "",
                 round(c.get("grossPnl", 0), 0), round(c.get("totalCosts", 0), 0),
                 round(c.get("netPnl", 0), 0), round(c.get("avgNetPerTrade", 0), 2),
                 c.get("profitFactor", ""), "",
                 "UNAVAILABLE", "UNAVAILABLE", "best cells (exploratory, no correction for multiplicity)"])
with open(f"{OUT}/all_strategies_comparison.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["source", "strategy", "period", "cohort", "n", "winRate%", "winRate_CI95",
                "grossPnl_PKR", "costs_PKR", "netPnl_PKR", "expectancy_PKR_per_trade",
                "profitFactor", "beats_cash_benchmark", "buyhold_benchmark",
                "max_drawdown", "verdict"])
    w.writerows(rows)

# ── audit_data_manifest.json ─────────────────────────────────────────────────
def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

SOURCES = [
    (f"{BR}/walk_forward_latest.json", "walk-forward forecast-quality evaluation (5 models × 3 horizons, 25 stocks, 400 samples)"),
    (f"{BR}/walk_forward_trading_latest.json", "genuine out-of-sample trading simulation (fixed-horizon + progressive TP/SL)"),
    (f"{BR}/task78_strategy_results_v1.json", "strategy comparison (3 exit policies × 5 models × 3 horizons × 2 periods)"),
    (f"{BR}/task79_model_research_audit.json", "existing-model final-test trading + weaknesses/limitations"),
    (f"{BR}/task79_model_results.json", "new-model training results (eval=null)"),
    (f"{BR}/task82_model_registry_audit.json", "58-entry model registry implementation audit"),
    (f"{BR}/task112/llm_signal_history", "GLM-4.6 append-only decision store (71 records)"),
    (f"{BR}/task112/task112_llm_pending_outcomes.json", "GLM forward-outcome tracker state"),
    (f"{BR}/task112/task112_llm_evidence_contribution_audit.json", "GLM evidence availability/citation audit (store-side evidenceRef=null)"),
    (f"{BR}/task112/task112_llm_decision_reconciliation.json", "GLM record reconciliation"),
    (f"{BR}/task112/task112_forward_pipeline_audit.json", "forward pipeline/worker state"),
    (f"{BR}/task111/task111_evidence_coverage.csv", "runner-side evidence package coverage at generation time (Task 123 correction source)"),
    (f"{BR}/task111/task111_news_coverage.json", "news coverage snapshot at generation time"),
    (f"{BR}/prospective_predictions_latest.json", "live prospective predictions snapshot"),
    (f"{BR}/prospective_paper_trading_latest.json", "live prospective paper-trading snapshot"),
    (f"{R}/db/custom.db", "LIVE application database (SQLite; .env DATABASE_URL)"),
    (f"{R}/db/custom.db.gz", "git-committed DB snapshot used for restore"),
    (f"{BR}/audit/evidence_bundle.json", "audit extraction bundle (produced by scripts/audit_extract.py)"),
    (f"{BR}/audit/validation_results.json", "Phase-9 validation results (scripts/audit_validate.py)"),
    (f"{OUT}/paper_trading_reconciliation.csv", "ledger reconciliation (scripts/audit_glm_paper.py; post-Task-123 states)"),
    (f"{OUT}/glm_records_table.csv", "Phase-4 GLM per-record table"),
]
manifest = {
    "audit": "LATENT_COMPLETE_PERFORMANCE_AUDIT",
    "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "recovery_note": "Original audit workspace (commit 97328538, extracted 2026-11-23T02:15Z) was lost in a "
                     "sandbox recycle before push. This manifest and the report set were rebuilt from the "
                     "re-cloned repository (same committed sources; market-data repair + ledger processing of "
                     "Task 123 applied in between). Narrative reports keep their original snapshot numbers; "
                     "ledger-derived figures reflect the post-Task-123 state and are labeled as such.",
    "git_head": B["extraction"]["git_head"],
    "git_branch": B["extraction"]["git_branch"],
    "extraction": B["extraction"],
    "freshness": {
        "ohlcv_bar_max_date": B["db"]["ohlcv"]["max_date"],
        "ohlcv_bar_min_date": B["db"]["ohlcv"]["min_date"],
        "ohlcv_bars": B["db"]["ohlcv"]["n_bars"],
        "db_file_mtime": datetime.datetime.fromtimestamp(os.path.getmtime(f"{R}/db/custom.db")).isoformat(),
        "db_restored_from": "db/custom.db.gz (49,746,709 bytes) + task107 ingest repair 2026-11-23 (+286 bars, frontier 2026-11-23)",
        "worker_heartbeat_last_seen": "2026-11-23T13:53:38Z (production poll bot, healthy)",
        "note": "DB restored from git-committed db/custom.db.gz; no separate production DB accessible from this workspace; the live app (.env DATABASE_URL) uses db/custom.db"},
    "sources": [{"path": p.replace(R + "/", ""), "role": role,
                 "bytes": (os.path.getsize(p) if os.path.isfile(p) else None),
                 "mtime": (datetime.datetime.fromtimestamp(os.path.getmtime(p)).isoformat(timespec="seconds") if os.path.exists(p) else None),
                 "sha256": (sha(p) if os.path.isfile(p) else "directory")}
                for p, role in SOURCES],
    "regression_tests": {"task112_QA": "66 passed, 0 failed, 0 skipped",
                         "task107_QA": "30 passed, 0 failed, 2 skipped (environment-dependent)",
                         "task111_QA": "34 passed, 0 failed, 0 skipped",
                         "task123_regression": "22 passed, 0 failed"},
    "report_files": ["LATENT_COMPLETE_PERFORMANCE_AUDIT.md", "glm_deep_analysis.md",
                     "all_models_comparison.csv", "all_strategies_comparison.csv",
                     "paper_trading_reconciliation.csv", "glm_records_table.csv",
                     "audit_data_manifest.json"]}
with open(f"{OUT}/audit_data_manifest.json", "w") as f:
    json.dump(manifest, f, indent=1, default=str)
print("built: all_models_comparison.csv, all_strategies_comparison.csv, audit_data_manifest.json")
print("models rows:", len(MODEL_ROWS), "| strategy rows:", len(rows))
