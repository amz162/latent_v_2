#!/usr/bin/env python3
"""task123_health.py — pipeline observability snapshot (read-only).
Produces reports/operations/task123_pipeline_health.json:
market-data freshness, ingest state, worker heartbeat, queue, lifecycle states,
GLM generation + evidence availability by source, failures and retries."""
import json, glob, os, sqlite3, datetime

R = "/home/z/my-project/repo_latent_v_2"
os.makedirs(f"{R}/reports/operations", exist_ok=True)
H = {"report": "task123_pipeline_health", "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}

def j(p, default=None):
    try:
        return json.load(open(f"{R}/{p}"))
    except Exception:
        return default

def tail_run_log(n=3):
    try:
        lines = open(f"{R}/data/backtest_reports/task107/ops/run_log.jsonl").read().strip().split("\n")
        return [json.loads(l) for l in lines[-n:]]
    except Exception:
        return []

# 1. market data freshness
con = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
H["market_data"] = {
    "ohlcv_frontier": cur.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0],
    "ohlcv_bars": cur.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0],
    "ingest_last_report": j("data/backtest_reports/task107/task107_daily_ingestion_report.json", {}).get("frontier_after"),
    "ingest_new_bars_last_run": len(j("data/backtest_reports/task107/task107_daily_ingestion_report.json", {}).get("new_bars", [])),
    "symbols_without_provider_data": j("data/backtest_reports/task107/task107_daily_ingestion_report.json", {}).get("symbols_without_new_data"),
}

# 2. worker heartbeat (intraday snapshot monitor — production poll bot)
ms = j("data/backtest_reports/task107/ops/monitor_state.json", {})
lcr = j("data/backtest_reports/task107/ops/last_cycle_result.json", {})
ph = j("data/backtest_reports/task107/ops/provider_health_state.json", {})
H["worker"] = {
    "kind": "task107 intraday snapshot monitor (production poll bot)",
    "last_cycle_at": lcr.get("ended_at"),
    "last_cycle_classification": lcr.get("classification"),
    "monitor_state_generated_at": ms.get("generated_at"),
    "provider_health": ph.get("state"),
    "consecutive_failures": ph.get("consecutive_failures"),
    "note": "EOD ingest (step 1 of task123_daily_pipeline.sh) is the DB writer; the poll bot only feeds intraday snapshots",
}

# 3. queue: predictions/outcomes
H["queue"] = {
    "predictions_total": cur.execute("SELECT COUNT(*) FROM PredictionHistory").fetchone()[0],
    "predictions_pending_outcome": cur.execute("SELECT COUNT(*) FROM PredictionOutcome WHERE outcomeStatus='pending'").fetchone()[0],
    "outcomes_matured": cur.execute("SELECT COUNT(*) FROM PredictionOutcome WHERE outcomeStatus='matured'").fetchone()[0],
}

# 4. lifecycle (paper trades)
H["paper_trading"] = {
    "states": dict(cur.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state")),
    "legs": cur.execute("SELECT COUNT(*) FROM PaperTradeLeg").fetchone()[0],
    "realized_net_pnl": cur.execute("SELECT SUM(netPnl) FROM ProspectivePaperTrade WHERE state='closed'").fetchone()[0],
    "open_mtm_note": "see task123_lifecycle_verification.json open_positions_mtm",
    "lifecycle_last_run": j("data/backtest_reports/prospective_paper_trading_latest.json", {}).get("generatedAt"),
}

# 5. GLM generation + evidence availability by source
hist_dir = f"{R}/data/backtest_reports/task112/llm_signal_history"
files = glob.glob(f"{hist_dir}/*.json")
real = mock = 0
decisions = {}
prov = {}
last_gen = None
for p in files:
    g = json.load(open(p))
    rt = g.get("recordType") or ("MOCK_PIPELINE_CHECK" if g.get("mockRecord") else "REAL_LLM_DECISION")
    if rt == "REAL_LLM_DECISION":
        real += 1
        decisions[g.get("decision")] = decisions.get(g.get("decision"), 0) + 1
    else:
        mock += 1
    prov[g.get("provenance")] = prov.get(g.get("provenance"), 0) + 1
    ts = g.get("decisionTimestamp")
    if ts and (last_gen is None or ts > last_gen[0]):
        last_gen = (ts, g.get("symbol"))
evpk = sorted(glob.glob(f"{R}/data/backtest_reports/task112/llm_evidence_packages/*.json"))
ev_sources = {}
for p in evpk[-3:]:
    pkg = json.load(open(p))
    for k, v in (pkg.get("sources") or {}).items():
        ev_sources.setdefault(k, set()).add(v)
H["glm"] = {
    "store_records": len(files), "real": real, "mock": mock,
    "provenance": prov, "decision_counts_real": decisions,
    "last_generation": last_gen,
    "scheduled": "scripts/task123_daily_pipeline.sh step 3 + crontab.txt (17:30 PKT Mon-Fri)",
    "research_only_enforced": all(
        json.load(open(p)).get("signalStatus") in (None, "research_only") for p in files),
    "evidence_packages": len(evpk),
    "evidence_source_statuses_recent": {k: sorted(v) for k, v in ev_sources.items()},
}

# 6. failures & retries
H["failures"] = {
    "ingest_errors_last_run": j("data/backtest_reports/task107/task107_daily_ingestion_report.json", {}).get("errors"),
    "provider_errors_last_monitor_cycle": ms.get("provider_errors"),
    "run_log_tail": tail_run_log(),
}

out = f"{R}/reports/operations/task123_pipeline_health.json"
json.dump(H, open(out, "w"), indent=1, default=str)
print(json.dumps(H, indent=1, default=str)[:1600])
print("saved →", out)
