#!/usr/bin/env python3
"""task127_monitor.py — forward monitoring, alerts and cohort protection.

Read-only over the ledger; writes:
  reports/operations/task127_daily_health.json  (daily forward report + alerts)
  reports/operations/task127_cohort_registry.csv
  data/backtest_reports/task127/ops/alert_state.json  (dedup + recovery state)
  data/backtest_reports/task127/ops/alerts_log.jsonl  (append-only alert events)

Alert contract (severity, timestamp, component, affected, reason, action),
deduplication (no re-fire within 12h unless severity escalates) and recovery
notifications are implemented here and unit-tested by scripts/task127_tests.py.

Metrics policy: win rate and profit factor only when closed trades exist;
NO Sharpe/Sortino/ROI/max-drawdown — no portfolio equity time series exists
(book-level cash only), and none may be labelled without documented methodology.
"""
import json, glob, os, sqlite3, csv, datetime

ROOT = "/home/z/my-project/repo_latent_v_2"
OUT = f"{ROOT}/reports/operations"
OPS = f"{ROOT}/data/backtest_reports/task127/ops"
os.makedirs(OUT, exist_ok=True); os.makedirs(OPS, exist_ok=True)
NOW = datetime.datetime.now(datetime.timezone.utc)
NOW_ISO = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
TODAY = NOW.strftime("%Y-%m-%d")
WD = NOW.weekday() < 5  # Mon-Fri

def j(path, default=None):
    try:
        return json.load(open(path))
    except Exception:
        return default

def isoparse(s):
    try:
        return datetime.datetime.fromisoformat(str(s).replace("+0000", "+00:00").replace("Z", "+00:00"))
    except Exception:
        return None

def hours_since(s):
    t = isoparse(s)
    return (NOW - t).total_seconds() / 3600 if t else None

# ---------------- alerts engine (shared, tested) ----------------
import sys as _sys
_sys.path.insert(0, f"{ROOT}/scripts")
import task127_alerts as AL
state = j(f"{OPS}/alert_state.json", {})
alerts_log = f"{OPS}/alerts_log.jsonl"

def evaluate(alerts):
    return AL.evaluate(alerts, state, NOW, NOW_ISO)

def log_events(fired, recoveries):
    AL.log_events(alerts_log, fired, recoveries)

# ---------------- data inputs ----------------
con = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
frontier = cur.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
bars_total = cur.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0]
integrity = cur.execute("PRAGMA quick_check").fetchone()[0]

parents = [dict(zip([c[0] for c in cur.description], r)) for r in cur.execute(
    "SELECT id, symbol, modelId, horizon, strategyId, state, entryDate, exitReason, grossPnl, totalCosts, netPnl, isWin, createdAt, sourcePredictionId, bookId FROM ProspectivePaperTrade")]
states = {}
for p in parents:
    states[p["state"]] = states.get(p["state"], 0) + 1

ingest_report = j(f"{ROOT}/data/backtest_reports/task107/task107_daily_ingestion_report.json", {})
monitor_state = j(f"{ROOT}/data/backtest_reports/task107/ops/monitor_state.json", {})
last_cycle = j(f"{ROOT}/data/backtest_reports/task107/ops/last_cycle_result.json", {})
prov_health = j(f"{ROOT}/data/backtest_reports/task107/ops/provider_health_state.json", {})
pp_latest = j(f"{ROOT}/data/backtest_reports/prospective_paper_trading_latest.json", {})
run_log = j(f"{ROOT}/data/backtest_reports/task107/ops/run_log.jsonl", []) or []
pipeline_logs = sorted(glob.glob(f"{ROOT}/data/backtest_reports/task123/ops/pipeline_*.log"))
glm_files = sorted(glob.glob(f"{ROOT}/data/backtest_reports/task112/llm_signal_history/*.json"))

# ---------------- cohort separation ----------------
FREEZE = "2026-11-23T21:30:00Z"  # baseline cohort freeze (Task 125 reconciliation)
BASELINE_ID = "C20261029"
baseline = [p for p in parents if str(p["createdAt"] or 0) <= "1793305999999"]  # created ≤ 2026-10-29T23:59:59Z
forward = [p for p in parents if p not in baseline]

def cohort_metrics(trades):
    closed = [t for t in trades if t["state"] == "closed"]
    net = sum(t["netPnl"] or 0 for t in closed)
    costs = sum(t["totalCosts"] or 0 for t in closed)
    gp = sum(t["grossPnl"] for t in closed if (t["grossPnl"] or 0) > 0)
    gl = sum(t["grossPnl"] for t in closed if (t["grossPnl"] or 0) < 0)
    return {
        "records": len(trades),
        "pending_entry": sum(1 for t in trades if t["state"] == "pending_entry"),
        "open": sum(1 for t in trades if t["state"] == "open"),
        "closed": len(closed),
        "realized_net_pnl": round(net, 2), "trading_costs": round(costs, 2),
        "wins": sum(1 for t in closed if t["isWin"]), "losses": sum(1 for t in closed if not t["isWin"]),
        "win_rate": round(sum(1 for t in closed if t["isWin"]) / len(closed), 4) if closed else None,
        "profit_factor": round(gp / abs(gl), 4) if gl else (None if not gp else float("inf")),
        "note": "drawdown NOT computed — no portfolio equity time series exists (book-level cash only); "
                "Sharpe/Sortino/ROI likewise not labelled (no documented equity methodology)",
    }

registry_rows = [{
    "cohort_id": BASELINE_ID, "start_cutoff": "2026-10-29", "created_at": "2026-10-29T20:21:46Z",
    "generation_source": "task107 2026-10-29 predictions (38 BUY x 3 strategies)",
    "records": len(baseline),
    "protection": "FROZEN BASELINE — historical ledger preserved; never reset, "
    "re-marked or re-filled; premature-closure classification defect documented (task125 §10), engine fixed forward",
    "metrics": cohort_metrics(baseline),
}]
if forward:
    fc_id = "C" + TODAY.replace("-", "")
    registry_rows.append({
        "cohort_id": fc_id, "start_cutoff": TODAY, "created_at": NOW_ISO,
        "generation_source": "post-freeze lifecycle entries", "records": len(forward),
        "protection": "FORWARD COHORT — paper mode only; idempotent processing; reported separately from the baseline",
        "metrics": cohort_metrics(forward),
    })
else:
    registry_rows.append({
        "cohort_id": "(none yet)", "start_cutoff": "", "created_at": "",
        "generation_source": "new cohorts are assigned C<signal-date> at creation and reported separately",
        "records": 0, "protection": "—",
        "metrics": {},
    })

with open(f"{OUT}/task127_cohort_registry.csv", "w", newline="") as f:
    w = csv.writer(f)
    header = list(registry_rows[0].keys())
    w.writerow(header)
    for r in registry_rows:
        w.writerow([json.dumps(r[c]) if isinstance(r[c], dict) else r[c] for c in header])

# ---------------- alert conditions ----------------
gap_symbols = {"BYCO", "ENGRO"}
pending_syms = {p["symbol"] for p in parents if p["state"] == "pending_entry"}
new_pending = pending_syms - gap_symbols
dup_pairs = cur.execute("SELECT COUNT(*) FROM (SELECT sourcePredictionId, strategyId FROM ProspectivePaperTrade GROUP BY 1,2 HAVING COUNT(*)>1)").fetchone()[0]
glm_cur = [json.load(open(f)) for f in glm_files if "current" in json.load(open(f)).get("provenance", "")]
cov_today = []
for f in glm_files:
    r = json.load(open(f))
    if r.get("provenance") == "current_record" and str(r.get("decisionTimestamp", ""))[:10] == TODAY:
        cov_today.append(r)
ingest_today = (ingest_report.get("frontier_after") == frontier and
                str(ingest_report.get("generated_at", ""))[:10] == TODAY)
hb_age = hours_since(last_cycle.get("ended_at") or monitor_state.get("generated_at"))
lc_age = hours_since(pp_latest.get("generatedAt"))

alerts = [
    {"id": "heartbeat_stale", "component": "task107 intraday poll bot", "severity": "CRIT" if (hb_age or 0) > 72 else "WARN",
     "affected": f"last_cycle={last_cycle.get('cycle_id')}",
     "reason": f"poll-bot heartbeat {hb_age and round(hb_age, 1)}h old (observed cadence ~daily; >36h weekday = stale)",
     "action": "check intraday-poll.yml Actions runs (`gh run list --workflow intraday-poll.yml`); inspect provider health",
     "active": WD and (hb_age or 0) > 36},
    {"id": "eod_ingest_missing", "component": "task107_daily_ingest (17:10 PKT)", "severity": "WARN",
     "affected": f"frontier={frontier}",
     "reason": f"weekday past 18:00 PKT and no ingest run recorded today (report date {ingest_report.get('generated_at')})",
     "action": "verify S1/S4 executors (task124_operator_commands.md §1, §5); rerun ingest — idempotent",
     "active": WD and not ingest_today},
    {"id": "missing_psx_sessions", "component": "market data", "severity": "CRIT" if (frontier and frontier < TODAY) and (NOW - datetime.datetime.fromisoformat(frontier + "T00:00:00+00:00")).days >= 5 else "WARN",
     "affected": f"frontier={frontier}",
     "reason": f"OHLCV frontier {frontier} is behind the latest completed PSX session",
     "action": "run task107_daily_ingest.py; check provider health; never backfill from non-provider sources",
     "active": frontier is not None and frontier < TODAY and WD},
    {"id": "provider_repeated_failures", "component": "psxdata provider", "severity": "CRIT" if (prov_health or {}).get("consecutive_failures", 0) >= 6 else "WARN",
     "affected": f"state={prov_health.get('state')}",
     "reason": f"consecutive provider failures={prov_health.get('consecutive_failures')}",
     "action": "inspect provider availability; poll-bot will auto-recover; do not fabricate bars",
     "active": (prov_health or {}).get("consecutive_failures", 0) >= 3},
    {"id": "lifecycle_not_running", "component": "prospective lifecycle (17:30 PKT)", "severity": "WARN",
     "affected": f"latest_run={pp_latest.get('generatedAt')}",
     "reason": f"weekday past 18:30 PKT and lifecycle report {lc_age and round(lc_age, 1)}h old",
     "action": "run bash scripts/task123_daily_pipeline.sh (idempotent) or install S4/S1 extension per task124",
     "active": WD and (lc_age or 1e9) > 30},
    {"id": "pending_entry_accumulation", "component": "paper trading", "severity": "WARN",
     "affected": f"symbols={sorted(pending_syms)}",
     "reason": f"pending entries {states.get('pending_entry', 0)}; new pending symbols outside known provider gaps: {sorted(new_pending)}",
     "action": "check provider coverage for new symbols; known gaps BYCO/ENGRO stay pending honestly",
     "active": bool(new_pending) or states.get("pending_entry", 0) > 40},
    {"id": "duplicate_fill_attempts", "component": "paper trading ledger", "severity": "CRIT",
     "affected": f"pairs={dup_pairs}",
     "reason": "duplicate (prediction, strategy) parent pairs detected — idempotency violated",
     "action": "stop lifecycle runs; restore from pre-promotion backup; investigate bookId/rename path",
     "active": dup_pairs > 0},
    {"id": "glm_evidence_coverage_drop", "component": "GLM evidence", "severity": "WARN",
     "affected": f"current_records_today={len(cov_today)}",
     "reason": "today's current_record decisions carry < 6 available/verified evidence sources each",
     "action": "inspect provider statuses in the evidence packages; check news/technical providers",
     "active": bool(cov_today) and any(
         sum(1 for k, v in (json.load(open(f"{ROOT}/data/backtest_reports/task111/signals/{r['symbol']}.evidence.json")).get("evidence", {}).items()
                            if os.path.exists(f"{ROOT}/data/backtest_reports/task111/signals/{r['symbol']}.evidence.json") else {}).items()
              if isinstance(v, dict) and v.get("status") in ("verified", "partially_verified")) < 6
         for r in cov_today)},
    {"id": "glm_generation_failure", "component": "GLM scheduled generation", "severity": "WARN",
     "affected": "task123 pipeline step 3",
     "reason": "weekday 17:30 pipeline ran but produced no new GLM decision records today",
     "action": "check provider_calls.jsonl for llm_unavailable reasons; verify GLM credentials/env on host",
     "active": WD and ingest_today and len(cov_today) == 0},
    {"id": "db_integrity_failure", "component": "db/custom.db", "severity": "CRIT",
     "affected": f"quick_check={integrity}",
     "reason": "SQLite integrity check failed or ledger identity check violated",
     "action": "restore latest pre-promotion backup (db/backups/); re-run task125_reconcile.py",
     "active": integrity != "ok" or dup_pairs > 0},
]

fired, recoveries, new_state = evaluate(alerts)
log_events(fired, recoveries)
json.dump(new_state, open(f"{OPS}/alert_state.json", "w"), indent=1)

# ---------------- daily health report ----------------
H = {
    "report": "task127_daily_health", "generated_at": NOW_ISO,
    "data_pipeline": {
        "ohlcv_frontier": frontier, "ohlcv_bars": bars_total,
        "db_integrity": integrity,
        "ingest_last_report_frontier": ingest_report.get("frontier_after"),
        "ingest_new_bars_last_run": len(ingest_report.get("new_bars", [])),
        "symbols_without_provider_data": ingest_report.get("symbols_without_new_data"),
        "worker": {"kind": "intraday poll bot (Actions S2)", "last_cycle_at": last_cycle.get("ended_at"),
                   "classification": last_cycle.get("classification"),
                   "provider_health": prov_health.get("state"),
                   "consecutive_failures": prov_health.get("consecutive_failures")},
        "latest_pipeline_log": pipeline_logs[-1] if pipeline_logs else None,
    },
    "paper_trading": {
        "states_total": states,
        "duplicate_fill_pairs": dup_pairs,
        "realized_net_pnl_baseline_cohort": registry_rows[0]["metrics"]["realized_net_pnl"],
        "open_mtm_note": "unrealized MTM tracked per task125 §7 (+18,445.32 at 11-23); excluded from realized",
        "exit_reason_distribution_closed": dict(cur.execute(
            "SELECT exitReason, COUNT(*) FROM ProspectivePaperTrade WHERE state='closed' GROUP BY exitReason")),
    },
    "glm": {
        "store_records": len(glm_files),
        "real": sum(1 for r in glm_files if (json.load(open(r)).get("recordType")) == "REAL_LLM_DECISION"),
        "mock": sum(1 for r in glm_files if (json.load(open(r)).get("recordType")) == "MOCK_PIPELINE_CHECK"),
        "research_only": True,
        "last_generation": max((json.load(open(r)).get("decisionTimestamp") or "") for r in glm_files),
        "scheduled": "task123_daily_pipeline.sh step 3 — production execution NOT VERIFIED (task124)",
    },
    "cohorts": registry_rows,
    "metrics_policy": "win_rate and profit_factor only; no Sharpe/Sortino/ROI/max-drawdown (no portfolio "
                      "equity time series; none may be labelled without documented methodology)",
    "alerts_active": [{k: a[k] for k in ("id", "severity", "component", "affected", "reason", "action")}
                      for a in fired if a.get("active")],
    "alerts_suppressed": [a["id"] for a in fired if a.get("suppressed")],
    "alerts_recovered": recoveries,
}
json.dump(H, open(f"{OUT}/task127_daily_health.json", "w"), indent=1, default=str)
print(json.dumps({"alerts_active": [a["id"] for a in fired if a.get("active")],
                  "alerts_suppressed": H["alerts_suppressed"],
                  "recoveries": recoveries,
                  "baseline_metrics": {k: registry_rows[0]["metrics"][k] for k in ("records", "closed", "realized_net_pnl", "win_rate", "profit_factor")}}, indent=1))
con.close()
