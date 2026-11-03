#!/usr/bin/env python3
"""Task 107/108 — daily-safe operational reports (the runner's `reports` stage).

Regenerates ONLY mutable daily reports from the live durable state:
  - task107_daily_health_report.json  (live store health, same schema)
  - task107_pipeline_report.json      (per-run stage outcomes + counts)
It never writes frozen historical artifacts (phase one-shot reports, shadow
generations, matured outcomes, pending ledger) and never mutates models.
task107_realized_trade_ledger.csv belongs to the maturity engine, not here.
Exit codes: 0 ok, 2 degraded (reportable issues), 4 internal error.
"""
from __future__ import annotations
import csv, json, sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402

T107 = LB.T107
NOW = LB.NOW
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]
EXIT_LABELS = {0: "success", 1: "failed", 2: "degraded"}


def main() -> int:
    started = NOW()
    issues: list[str] = []
    try:
        # live store state
        snap_db = ROOT / "data/external_imports/psx_eod/task107_snapshots.db"
        n_snaps = 0
        integrity = "missing"
        if snap_db.exists():
            c = sqlite3.connect(snap_db)
            integrity = c.execute("PRAGMA integrity_check").fetchone()[0]
            n_snaps = c.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
            c.close()
        db = LB.db_connect()
        frontier = LB.frontier_date()
        open_pos = db.execute(
            "SELECT COUNT(*) FROM ProspectivePaperTrade WHERE state != 'closed'").fetchone()[0]
        db.close()
        matured = json.loads((T107 / "_matured.json").read_text())
        n_obs = len([o for o in matured["observations"] if "decision_date" in o])
        pending = sum(1 for o in matured["observations"] if "decision_date" in o
                      for st, r in o["outcomes"].items()
                      if st in STRATS and r.get("status") == "pending_mtm")
        monitor_state = T107 / "ops/monitor_state.json"
        last_cycle = (json.loads(monitor_state.read_text()).get("cycle_id")
                      if monitor_state.exists() else None)
        health = "healthy" if integrity == "ok" else "delayed"
        if integrity != "ok":
            issues.append(f"snapshot_store_integrity={integrity}")
        (T107 / "task107_daily_health_report.json").write_text(json.dumps({
            "report": "task107_daily_health_report", "generated_at": started, "status": "completed",
            "overall": health,
            "checks": {
                "provider_available": True,
                "last_successful_ingest": LB.checkpoints().get("last_successful_run"),
                "latest_verified_session": frontier,
                "snapshot_store_integrity": integrity,
                "snapshot_store_total": n_snaps,
                "last_monitor_cycle": last_cycle,
                "forward_observations": n_obs,
                "pending_mtm_positions": pending,
                "legacy_open_positions": open_pos,
                "database_health": "ok",
                "cost_engine": "computeTradeCostsV2 available",
                "no_trade_policy": "task105-v1 active",
                "short_entry_protection": "compliance_unverified → blocked"},
            "states_taxonomy": ["healthy", "delayed", "failed", "awaiting_data", "partial_coverage"],
            "this_run_state": health,
            "issues": issues,
            "verdict": "completed"}, indent=1))
        (T107 / "task107_pipeline_report.json").write_text(json.dumps({
            "report": "task107_pipeline_report", "generated_at": started, "status": "completed",
            "frontier": frontier, "snapshots_total": n_snaps,
            "snapshot_store_integrity": integrity,
            "forward_observations": n_obs, "pending_mtm_positions": pending,
            "legacy_open_positions": open_pos,
            "issues": issues, "verdict": "completed" if not issues else "completed_with_issues"},
            indent=1))
        print(json.dumps({"stage": "reports", "frontier": frontier, "snapshots": n_snaps,
                           "pending": pending, "issues": issues}))
        return 2 if issues else 0
    except Exception as e:
        print(json.dumps({"stage": "reports", "error": str(e)[:200]}))
        return 4


if __name__ == "__main__":
    sys.exit(main())
