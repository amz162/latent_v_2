#!/usr/bin/env python3
"""Task 107 Phase 2 — automated daily PSX EOD ingestion (resumable, idempotent).

Steps: session-state check -> provider availability -> fetch window
(frontier+1 .. today) for the pilot-25 shadow universe -> classify bars
(overlap / new / in-response duplicate) -> validate (structure, OHLC envelope,
volume, staleness) -> REVISION QUARANTINE for provider edits of verified bars
-> immutable drop CSV + Task 103 controlled-drop import -> backup + promote
with (symbol,date) dedup -> reconcile -> refresh data-readiness freshness ->
coverage + provider-health artifacts. Overlap byte-equality vs verified rows is
retained as the Task 106 integrity check.

Usage: python3 scripts/task107_daily_ingest.py [--dry-run] [--end YYYY-MM-DD] [--force]
Exit codes: 0 ok, 2 nothing-to-do, 3 lock contention, 4 provider/validation failure.
"""
from __future__ import annotations
import argparse, csv, json, shutil, sqlite3, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import task107_lib as LB  # noqa: E402

T107, OPS = LB.T107, LB.OPS
IMPORTS_DIR = LB.ROOT / "data/external_imports/psx_eod"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--end", default=None, help="inclusive end date (default: last closed candidate session)")
    ap.add_argument("--force", action="store_true", help="run even if nothing new (for testing)")
    a = ap.parse_args()
    t0 = time.time()
    started = LB.NOW()

    sess = LB.psx_session_state()
    end = a.end or sess["candidate_session_date"]
    db = LB.db_connect()
    frontier = LB.frontier_date()
    # fetch window intentionally INCLUDES the last 3 verified sessions so the
    # overlap byte-equality check (Task 106 integrity method) always runs
    start = (datetime.strptime(frontier, "%Y-%m-%d") - timedelta(days=2)).strftime("%Y-%m-%d")

    # ── provider availability probe ──────────────────────────────────────────
    code, latency, _payload, err = LB.fetch_json(f"{LB.BASE}/indices", timeout=15)
    provider = {"base_url": LB.BASE, "identity": "approved free 'psxdata' REST API (source='psxdata')",
                 "probe_status": code, "probe_latency_s": round(latency, 2), "probe_error": err or None,
                 "available": code == 200}
    report = {"report": "task107_daily_ingestion_report", "generated_at": LB.NOW(),
               "started_at": started, "dry_run": a.dry_run, "session_state": sess,
               "window": {"from": start, "to": end}, "universe": "pilot-25 shadow universe (NOT full-market coverage)",
               "provider": provider, "symbols": {}, "bars_in_response": 0, "overlap_checked": 0,
               "overlap_mismatches": [], "revisions_quarantined": [], "new_bars": [],
               "rejected_bars": [], "in_response_duplicates": 0, "symbols_with_new_data": [],
               "symbols_without_new_data": [], "provider_errors": [], "import": None,
               "promotion": None, "frontier_before": frontier, "frontier_after": frontier,
               "reconcile": None, "errors": []}

    if not provider["available"]:
        report["errors"].append("provider_unavailable")
        report["status"] = "failed_provider_unavailable"
        (T107 / "task107_daily_ingestion_report.json").write_text(json.dumps(report, indent=1))
        LB.save_checkpoint({"started_at": started, "kind": "ingest", "status": "failed",
                             "reason": "provider_unavailable", "frontier_after": frontier})
        return 4

    rows_by_symbol: dict[str, list[dict]] = {}
    for sym in LB.PILOT25:
        code, dt, data, err = LB.fetch_history(sym, start, end)
        if code != 200:
            report["provider_errors"].append({"symbol": sym, "status": code, "error": err})
            rows_by_symbol[sym] = []
            continue
        rows_by_symbol[sym] = data
        report["bars_in_response"] += len(data)

    if a.dry_run:
        report["status"] = "dry_run"
        for sym, data in rows_by_symbol.items():
            report["symbols"][sym] = {"n_bars": len(data),
                "dates": [b["date"] for b in data]}
        (T107 / "task107_daily_ingestion_report.json").write_text(json.dumps(report, indent=1))
        print(json.dumps({"dry_run": True, "bars_in_response": report["bars_in_response"]}))
        return 0

    # ── classify + validate ──────────────────────────────────────────────────
    for sym in LB.PILOT25:
        seen_keys = set()
        data = rows_by_symbol[sym]
        info = {"fetched": len(data), "overlap": 0, "new": 0, "rejected": 0, "duplicate_in_response": 0,
                 "latest_date": None}
        for b in data:
            key = (sym, b["date"])
            if key in seen_keys:
                report["in_response_duplicates"] += 1
                info["duplicate_in_response"] += 1
                continue
            seen_keys.add(key)
            row = db.execute("SELECT open,high,low,close,volume FROM OhlcvBar WHERE symbol=? AND date=?",
                              key).fetchone()
            if row is not None:
                info["overlap"] += 1
                report["overlap_checked"] += 1
                prov = (b["open"], b["high"], b["low"], b["close"], b["volume"])
                if any(abs(p - d) > 0.011 for p, d in zip(prov, row)):
                    report["overlap_mismatches"].append({"symbol": sym, "date": b["date"],
                        "db_verified": list(row), "provider_now": list(prov)})
                continue
            problems = LB.validate_bar(b)
            if problems:
                report["rejected_bars"].append({"symbol": sym, "date": b["date"],
                                                 "bar": {k: b.get(k) for k in ("open", "high", "low", "close", "volume")},
                                                 "problems": problems})
                info["rejected"] += 1
                continue
            report["new_bars"].append({"symbol": sym, "date": b["date"], "open": b["open"],
                "high": b["high"], "low": b["low"], "close": b["close"], "volume": b["volume"]})
            info["new"] += 1
            info["latest_date"] = max(info["latest_date"] or "0000", b["date"])
        if info["new"]:
            report["symbols_with_new_data"].append(sym)
        elif info["fetched"] == 0 and not any(pe["symbol"] == sym for pe in report["provider_errors"]):
            report["symbols_without_new_data"].append(sym)
        report["symbols"][sym] = info
    db.close()

    # revision policy: mismatched overlap = suspected vendor correction → quarantine, no overwrite
    if report["overlap_mismatches"]:
        OPS.mkdir(parents=True, exist_ok=True)
        q = OPS / "revisions"
        q.mkdir(exist_ok=True)
        stamp = started.replace(":", "")
        (q / f"revision_review_{stamp}.json").write_text(json.dumps({
            "report": "provider_historical_revision_review", "generated_at": LB.NOW(),
            "policy": "never overwrite a verified bar automatically; quarantine and reconcile manually",
            "mismatches": report["overlap_mismatches"]}, indent=1))
        report["revisions_quarantined"] = [f"{m['symbol']}@{m['date']}" for m in report["overlap_mismatches"]]

    new_bars = report["new_bars"]
    # (no early return: coverage/frontier/overlap/provider artifacts are written
    # on EVERY completed run — a no-op run still reports freshness honestly)

    # ── immutable drop file + Task 103 controlled import ─────────────────────
    if new_bars:
        IMPORTS_DIR.mkdir(parents=True, exist_ok=True)
        stamp = started.replace(":", "").replace("-", "")
        drop = IMPORTS_DIR / f"task107_daily_{stamp}.csv"
        with open(drop, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["symbol", "date", "open", "high", "low", "close", "volume",
                         "provider", "source_id", "retrieved_at"])
            for r in sorted(new_bars, key=lambda x: (x["date"], x["symbol"])):
                w.writerow([r["symbol"], r["date"], r["open"], r["high"], r["low"],
                             r["close"], r["volume"], "psxdata-api.fastapicloud.dev",
                             f"psxdata:{r['symbol']}:{r['date']}", started])
        imp = LB.run_importer(drop)
        report["import"] = {**imp, "file": str(drop), "n_rows": len(new_bars)}
        if imp["rc"] != 0:
            report["status"] = "failed_import"
            (T107 / "task107_daily_ingestion_report.json").write_text(json.dumps(report, indent=1))
            LB.save_checkpoint({"started_at": started, "kind": "ingest", "status": "failed",
                                 "reason": "import_failed", "frontier_after": frontier})
            print(json.dumps({"status": "failed_import"})); return 4

        # ── backup + promote (symbol,date) dedup ────────────────────────────
        bak = LB.ROOT / "db/backups"
        bak.mkdir(exist_ok=True)
        shutil.copy2(LB.ROOT / "db/custom.db", bak / "custom_pre_task107.db")
        conn = LB.db_connect(readonly=False)
        inserted = already = 0
        try:
            for r in sorted(new_bars, key=lambda x: (x["date"], x["symbol"])):
                cur = conn.execute(
                    "INSERT OR IGNORE INTO OhlcvBar (symbol,date,open,high,low,close,volume,source,updatedAt) "
                    "VALUES (?,?,?,?,?,?,?,?,?)",
                    (r["symbol"], r["date"], r["open"], r["high"], r["low"], r["close"],
                     r["volume"], "psxdata", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")))
                inserted += cur.rowcount
                already += (cur.rowcount == 0)
            conn.commit()
        finally:
            conn.close()
        report["promotion"] = {"attempted": True, "inserted": inserted, "already_present": already,
                                 "backup": "db/backups/custom_pre_task107.db (local-only)"}

    # ── reconcile + frontier ─────────────────────────────────────────────────
    db = LB.db_connect()
    new_frontier = db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    dup = db.execute("SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) c FROM OhlcvBar GROUP BY symbol,date HAVING c>1)").fetchone()[0]
    by_date = dict(db.execute("SELECT date, COUNT(*) FROM OhlcvBar WHERE date > ? GROUP BY date", (frontier,)).fetchall())
    db.close()
    report["frontier_after"] = new_frontier
    report["reconcile"] = {"rows_promoted": report["promotion"]["inserted"] if report["promotion"] else 0,
                             "bars_by_date": by_date, "duplicate_symbol_date_pairs": dup,
                             "frontier_advanced": new_frontier > frontier,
                             "overlap_mismatch_count": len(report["overlap_mismatches"])}
    if not new_bars:
        report["status"] = "no_new_data" if dup == 0 and not report["overlap_mismatches"] else "no_new_data_with_review_items"
    else:
        report["status"] = "success" if dup == 0 and not report["overlap_mismatches"] else "success_with_review_items"
    report["runtime_seconds"] = round(time.time() - t0, 1)

    # ── artifacts: frontier, freshness CSV, provider health, readiness refresh ─
    (T107 / "task107_data_frontier.json").write_text(json.dumps({
        "report": "task107_data_frontier", "generated_at": LB.NOW(), "status": report["status"],
        "frontier": new_frontier, "previous": frontier, "advanced": new_frontier > frontier,
        "bars_by_new_date": by_date, "universe": "pilot-25 shadow universe",
        "provenance": {"provider": LB.BASE, "drop_manifests": "data/external_imports/psx_eod/task107_daily_*.csv + data/backtest_reports/task103/import_manifests/"},
        "limitations": ["pilot-25 coverage only", "KSE-100/CA/fundamentals/intraday still blocked"]}, indent=1))

    db = LB.db_connect()
    with open(T107 / "task107_symbol_freshness.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["symbol", "latest_date", "bars_total", "new_in_run"])
        for sym in sorted(LB.PILOT25):
            latest, n = db.execute("SELECT MAX(date), COUNT(*) FROM OhlcvBar WHERE symbol=?", (sym,)).fetchone()
            w.writerow([sym, latest, n, report["symbols"].get(sym, {}).get("new", 0)])
    db.close()

    (T107 / "task107_provider_health.json").write_text(json.dumps({
        "report": "task107_provider_health", "generated_at": LB.NOW(), "status": "completed",
        "provider": provider,
        "symbol_errors": report["provider_errors"], "bars_in_response": report["bars_in_response"],
        "overlap_mismatches": len(report["overlap_mismatches"]),
        "verdict": "healthy" if provider["available"] and not report["provider_errors"] else "degraded"}, indent=1))

    (T107 / "task107_overlap_reconciliation.json").write_text(json.dumps({
        "report": "task107_overlap_reconciliation", "generated_at": LB.NOW(),
        "status": "PASS" if not report["overlap_mismatches"] else "REVIEW_REQUIRED",
        "overlap_bars_checked": report["overlap_checked"],
        "mismatches": report["overlap_mismatches"],
        "policy": "provider edits of verified bars are quarantined, never auto-applied",
        "quarantined_files": report["revisions_quarantined"]}, indent=1))

    # data-readiness freshness fields (operational artifact; history preserved)
    apath = LB.T103 / "task103_market_data_audit.json"
    if apath.exists():
        audit = json.loads(apath.read_text())
        old = audit.get("date_range", [None, None])
        audit["date_range"] = [old[0] if old else None, new_frontier]
        audit["task107_refresh_note"] = (f"Frontier {frontier} -> {new_frontier} via Task 107 daily ingestion "
                                          f"at {started} (pilot-25; overlap {report['overlap_checked']} bars, "
                                          f"{len(report['overlap_mismatches'])} mismatches).")
        apath.write_text(json.dumps(audit, indent=1))

    LB.save_checkpoint({"started_at": started, "kind": "ingest", "status": "success",
                         "frontier_after": new_frontier, "bars_promoted": report["promotion"]["inserted"] if report["promotion"] else 0,
                         "overlap_checked": report["overlap_checked"],
                         "mismatches": len(report["overlap_mismatches"])})
    LB.append_run_log("ingest", {"status": report["status"], "frontier": new_frontier,
                                   "inserted": report["promotion"]["inserted"] if report["promotion"] else 0})
    if not new_bars:
        print(json.dumps({"status": "no_new_data", "frontier": new_frontier,
                           "overlap_checked": report["overlap_checked"],
                           "mismatches": len(report["overlap_mismatches"])}))
        return 2
    (T107 / "task107_daily_ingestion_report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps({"status": report["status"], "frontier": new_frontier,
                       "inserted": report["promotion"]["inserted"] if report["promotion"] else 0,
                       "new_dates": sorted(by_date), "overlap_checked": report["overlap_checked"],
                       "mismatches": len(report["overlap_mismatches"])}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
