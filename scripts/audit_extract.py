#!/usr/bin/env python3
"""audit_extract.py — Latent.pk complete audit, Phase 1-5 evidence extraction.
Reads ONLY read-only sources (DB via mode=ro, JSON reports, GLM store).
Writes: data/backtest_reports/audit/evidence_bundle.json (+ prints digest).
No model/strategy logic is modified. (Restored verbatim after workspace recycle.)"""
import json, os, glob, hashlib, collections, sqlite3, datetime, re

R = "/home/z/my-project/repo_latent_v_2"
BR = f"{R}/data/backtest_reports"
OUT = f"{BR}/audit"
os.makedirs(OUT, exist_ok=True)
B = {}

def mt(p):
    return datetime.datetime.fromtimestamp(os.path.getmtime(p)).isoformat(timespec="seconds")

def load(p):
    with open(p) as f:
        return json.load(f)

# ── 1. Walk-forward forecast-quality (walk_forward_latest.json) ──────────────
wf = load(f"{BR}/walk_forward_latest.json")
acc = collections.defaultdict(lambda: {"n": 0, "mae_w": 0.0, "rmse_w": 0.0, "r2_w": 0.0,
                                       "dir_correct": 0.0, "dir_n": 0, "stocks": 0})
for sym, s in wf["per_stock_results"].items():
    for mdl, hs in s["models"].items():
        for h, m in hs.items():
            if m.get("status") != "completed" or m.get("n_observations", 0) == 0:
                continue
            a = acc[(mdl, h)]
            n = m["n_observations"]
            a["n"] += n; a["stocks"] += 1
            a["mae_w"] += m["mae"] * n; a["rmse_w"] += m["rmse"] ** 2 * n
            a["r2_w"] += m["r2"] * n
            a["dir_correct"] += m["directional_accuracy"] * n; a["dir_n"] += n
B["walkforward_accuracy"] = {
    "source": "data/backtest_reports/walk_forward_latest.json",
    "generated_at": wf["generated_at"], "data_cutoff": wf["data_cutoff"],
    "eval_range": wf["evaluation_date_range"], "method": wf["evaluation_method"],
    "universe_size": wf["universe_size"], "horizons": wf["forecast_horizons"],
    "rows": [
        {"model": k[0], "horizon": k[1], "n_obs": a["n"], "stocks": a["stocks"],
         "mae_wavg": round(a["mae_w"] / a["n"], 5),
         "rmse_wavg": round((a["rmse_w"] / a["n"]) ** 0.5, 5),
         "r2_wavg": round(a["r2_w"] / a["n"], 4),
         "dir_acc_wavg": round(a["dir_correct"] / a["dir_n"], 4)}
        for k, a in sorted(acc.items())]}

# ── 2. Walk-forward TRADING simulation (walk_forward_trading_latest.json) ─────
wt = load(f"{BR}/walk_forward_trading_latest.json")
B["walkforward_trading"] = {
    "source": "data/backtest_reports/walk_forward_trading_latest.json",
    "generated_at": wt["generated_at"], "cost_profile": wt["cost_profile_primary"],
    "sensitivity": wt["cost_profile_sensitivity"], "notional": wt["notional_per_trade"],
    "signal_threshold": wt["signal_threshold"], "signal_policy": wt["signal_policy"],
    "final_test_range": wt["final_test_sample_range"], "horizons": wt["horizons"],
    "model_names": wt["model_names"], "limitations": wt["limitations"],
    "unsupported_metrics": wt["unsupported_metrics"],
    "metrics": wt["metrics"]}

# ── 3. Task 78 strategy comparison ────────────────────────────────────────────
t78 = load(f"{BR}/task78_strategy_results_v1.json")
B["task78_strategies"] = {k: t78[k] for k in
    ("task", "runId", "createdAt", "sourceRunId", "sourceSamples", "valEndIdx",
     "signalThreshold", "riskLevelPolicy", "strategyPolicy", "costProfile",
     "candidatesTotal", "buyCandidates", "omissionBreakdown")}
rr = t78.get("resultRows")
if isinstance(rr, list):
    B["task78_strategies"]["resultRows_n"] = len(rr)
    B["task78_strategies"]["resultRows_sample"] = rr[:2]
    B["task78_strategies"]["row_keys"] = list(rr[0].keys())
else:
    B["task78_strategies"]["resultRows_count_scalar"] = rr

# ── 4. Task 79 final-test per-model trading (15 rows) ─────────────────────────
t79 = load(f"{BR}/task79_model_research_audit.json")
B["task79_final_test"] = {
    "source": "data/backtest_reports/task79_model_research_audit.json",
    "created_at": t79["created_at"], "universe": t79["universe"],
    "data_range": t79["date_range"], "total_bars": t79["total_bars"],
    "rows": t79["existing_model_final_test"],
    "weaknesses": t79["existing_model_weaknesses_summary"],
    "limitations": t79["limitations"]}
t79r = load(f"{BR}/task79_model_results.json")
B["task79_new_models"] = {"created_at": t79r["created_at"],
    "data_cutoff": t79r["data_cutoff"], "split_date": t79r["split_date"],
    "models": {k: {h: {"status": v.get("status"), "n_buy_signals": v.get("n_buy_signals"),
                       "eval": v.get("eval")} for h, v in hh.items()}
               for k, hh in t79r["models"].items()},
    "live_predictions_total": t79r.get("live_predictions_total")}

# ── 5. Task 82 registry audit (implementation status of 58 entries) ───────────
t82 = load(f"{BR}/task82_model_registry_audit.json")
B["task82_registry"] = {"createdAt": t82["createdAt"], "totalEntries": t82["totalEntries"],
    "summary": t82["summary"], "sandboxConstraints": t82["sandboxConstraints"],
    "models_status": [{"name": m.get("name") or m.get("model"), "tier": m.get("tier"),
                       "status": m.get("status"), "trained": m.get("trained"),
                       "note": (m.get("note") or m.get("untrainedReason") or "")[:120]}
                      for m in t82["models"]]}

# ── 6. GLM llm_signal_history store ───────────────────────────────────────────
gdir = f"{BR}/task112/llm_signal_history"
files = sorted(glob.glob(f"{gdir}/*.json"))
glm_rows, ev_hashes, sym_dec = [], collections.defaultdict(list), collections.Counter()
mock_ct, real_ct = 0, 0
for p in files:
    g = load(p)
    is_mock = bool(g.get("mockRecord"))
    mock_ct += is_mock; real_ct += not is_mock
    sym_dec[g["symbol"]] += 1
    glm_rows.append({
        "file": os.path.basename(p), "symbol": g["symbol"], "decision": g.get("decision"),
        "mock": is_mock, "recordType": g.get("recordType"),
        "ts": g.get("decisionTimestamp"), "dataCutoff": g.get("dataCutoff"),
        "evidenceHash": g.get("evidenceHash"),
        "conviction": g.get("llmConvictionScore"), "eq": g.get("evidenceQualityScore"),
        "validationStatus": g.get("validationStatus"),
        "rejectionReason": g.get("rejectionReason"),
        "researchStatus": g.get("researchStatus"),
        "forwardCohortId": g.get("forwardCohortId"),
        "generationId": g.get("generationId"),
        "rr_entry": (g.get("riskReward") or {}).get("entryReference"),
        "rr_sl": (g.get("riskReward") or {}).get("stopLoss"),
        "rr_tps": list(((g.get("riskReward") or {}).get("targets") or {}).values()),
        "llmFailureReason": g.get("llmFailureReason"),
        "provider": g.get("provider"), "model": g.get("model"),
        "promptVersion": g.get("promptVersion")})
dups = collections.Counter(r["evidenceHash"] for r in glm_rows)
dup_pairs = {h: c for h, c in dups.items() if c > 1}
dec_ct = collections.Counter(r["decision"] for r in glm_rows)
B["glm"] = {
    "source": "data/backtest_reports/task112/llm_signal_history/",
    "dir_mtime": mt(gdir), "n_files": len(files), "n_real": real_ct, "n_mock": mock_ct,
    "decision_counts": dict(dec_ct), "symbol_counts": dict(sym_dec),
    "duplicate_evidenceHash_groups": dup_pairs,
    "n_duplicate_extra_records": sum(c - 1 for c in dup_pairs.values()),
    "validationStatus_counts": dict(collections.Counter(r["validationStatus"] for r in glm_rows)),
    "researchStatus_counts": dict(collections.Counter(r["researchStatus"] for r in glm_rows)),
    "recordType_counts": dict(collections.Counter(r["recordType"] for r in glm_rows)),
    "prompt_versions": dict(collections.Counter(r["promptVersion"] for r in glm_rows)),
    "mock_decisions": dict(collections.Counter(r["decision"] for r in glm_rows if r["mock"])),
    "real_decisions": dict(collections.Counter(r["decision"] for r in glm_rows if not r["mock"])),
    "timestamp_range": [min(r["ts"] for r in glm_rows if r["ts"]),
                        max(r["ts"] for r in glm_rows if r["ts"])],
    "rows": glm_rows}

# ── 7. DB: predictions, outcomes, paper trades (read-only) ────────────────────
con = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
def q(sql):
    return cur.execute(sql).fetchall()
B["db"] = {"path": f"{R}/db/custom.db", "size_bytes": os.path.getsize(f"{R}/db/custom.db"),
           "db_mtime": mt(f"{R}/db/custom.db")}
B["db"]["ohlcv"] = {"max_date": q("SELECT MAX(date) FROM OhlcvBar")[0][0],
                    "min_date": q("SELECT MIN(date) FROM OhlcvBar")[0][0],
                    "n_bars": q("SELECT COUNT(*) FROM OhlcvBar")[0][0]}
B["db"]["prediction_history"] = {
    "n": q("SELECT COUNT(*) FROM PredictionHistory")[0][0],
    "by_model": q("SELECT modelId, COUNT(*) FROM PredictionHistory GROUP BY modelId"),
    "by_horizon": q("SELECT horizon, COUNT(*) FROM PredictionHistory GROUP BY horizon"),
    "by_signal": q("SELECT signal, COUNT(*) FROM PredictionHistory GROUP BY signal"),
    "by_kind": q("SELECT kind, COUNT(*) FROM PredictionHistory GROUP BY kind"),
    "pred_ts_range": q("SELECT MIN(predictionTs), MAX(predictionTs) FROM PredictionHistory")[0],
    "by_cutoff": q("SELECT dataCutoff, COUNT(*) FROM PredictionHistory GROUP BY dataCutoff"),
    "created_range": q("SELECT MIN(createdAt), MAX(createdAt) FROM PredictionHistory")[0],
    "columns": [r[1] for r in q("PRAGMA table_info(PredictionHistory)")]}
B["db"]["prediction_outcome"] = {
    "n": q("SELECT COUNT(*) FROM PredictionOutcome")[0][0],
    "by_status": q("SELECT outcomeStatus, COUNT(*) FROM PredictionOutcome GROUP BY outcomeStatus"),
    "columns": [r[1] for r in q("PRAGMA table_info(PredictionOutcome)")]}
cols = [r[1] for r in q("PRAGMA table_info(ProspectivePaperTrade)")]
B["db"]["prospective_paper_trades"] = {
    "n": q("SELECT COUNT(*) FROM ProspectivePaperTrade")[0][0],
    "by_model_state": q("SELECT modelId, state, COUNT(*) FROM ProspectivePaperTrade GROUP BY modelId, state"),
    "by_state": q("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state"),
    "created_range": q("SELECT MIN(createdAt), MAX(createdAt) FROM ProspectivePaperTrade")[0],
    "columns": cols}
B["db"]["risk_levels_n"] = q("SELECT COUNT(*) FROM PredictionRiskLevels")[0][0]
B["db"]["model_prediction_cache"] = {
    "columns": [r[1] for r in q("PRAGMA table_info(ModelPredictionCache)")],
    "rows_sample": q("SELECT * FROM ModelPredictionCache LIMIT 8")}

# ── 8. Prospective (live) reports + freshness ─────────────────────────────────
for name in ("prospective_predictions_latest.json", "prospective_paper_trading_latest.json"):
    p = f"{BR}/{name}"
    d = load(p)
    slim = {k: (v if not isinstance(v, (list, dict)) else f"{type(v).__name__}({len(v)})")
            for k, v in d.items()}
    B.setdefault("prospective_reports", {})[name] = {"mtime": mt(p), "keys": slim}

B["extraction"] = {"script": "scripts/audit_extract.py",
    "extracted_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
    "extracted_at_pkt_note": "PKT = UTC+5",
    "git_head": os.popen(f"git -C {R} rev-parse HEAD").read().strip(),
    "git_branch": os.popen(f"git -C {R} branch --show-current").read().strip(),
    "note": "Re-extracted after workspace recycle + Task 123 repair; supersedes the "
            "2026-11-23T02:15Z bundle whose workspace was lost (commit 97328538 never pushed)."}

with open(f"{OUT}/evidence_bundle.json", "w") as f:
    json.dump(B, f, indent=1, default=str)

# ── digest print ──────────────────────────────────────────────────────────────
print("== WALK-FORWARD ACCURACY (pooled 25 stocks) ==")
for r in B["walkforward_accuracy"]["rows"][:5]:
    print(f"  {r['model']:<14} h{r['horizon']:>2}  n={r['n_obs']:>4}  MAE={r['mae_wavg']:.4f}  R2={r['r2_wavg']:+.3f}  dirAcc={r['dir_acc_wavg']:.3f}")
print("== GLM ==")
print(f"  files={B['glm']['n_files']} real={B['glm']['n_real']} mock={B['glm']['n_mock']} decisions={B['glm']['decision_counts']}")
print("== DB ==")
print(f"  ohlcv {B['db']['ohlcv']['min_date']} → {B['db']['ohlcv']['max_date']} ({B['db']['ohlcv']['n_bars']})")
print(f"  PPT states={B['db']['prospective_paper_trades']['by_state']}")
print("bundle →", f"{OUT}/evidence_bundle.json")
