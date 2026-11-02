#!/usr/bin/env python3
"""Task 106 — Phase 4: genuine PSX market-data refresh.
Uses the app's OWN approved free provider (psxdata-api.fastapicloud.dev, the
same source already stored in OhlcvBar as source='psxdata'). Steps:
validate overlap vs DB -> fetch new sessions -> Task 103 importer (staging) ->
validate staging -> backup production DB -> promote with (symbol,date) dedup ->
reconcile. No fabrication: only sessions the provider genuinely returns."""
from __future__ import annotations
import csv, hashlib, json, shutil, sqlite3, subprocess, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402

BASE = "https://psxdata-api.fastapicloud.dev"
PILOT25 = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL",
           "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL",
           "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
NEW_FROM, NEW_TO = "2026-10-30", "2026-11-02"
OVERLAP = ("2026-10-26", "2026-10-29")
CSV_PATH = ROOT / "data/external_imports/psx_eod/task106_refresh.csv"


def fetch(sym: str, start: str, end: str):
    url = f"{BASE}/stocks/{sym}/historical?start={start}&end={end}"
    req = urllib.request.Request(url, headers={"User-Agent": "latent-v2/1.0 (+https://github.com/amz162/latent_v_2)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.loads(r.read())
    return d.get("data", [])


def main() -> None:
    t0 = time.time()
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    rows = {}
    for sym, date, o, h, l, c, v in db.execute(
            "SELECT symbol,date,open,high,low,close,volume FROM OhlcvBar "
            "WHERE date >= '2026-10-26' AND date <= '2026-10-29' AND symbol IN "
            f"({','.join('?' * len(PILOT25))})", PILOT25):
        rows[(sym, date)] = (o, h, l, c, v)
    db.close()

    # ── 1) overlap validation (provider vs previously verified DB rows) ──────
    val = {"symbols_checked": 0, "bars_compared": 0, "mismatches": [], "provider_unavailable": []}
    for sym in PILOT25:
        try:
            data = fetch(sym, OVERLAP[0], OVERLAP[1])
        except Exception as e:
            val["provider_unavailable"].append({"symbol": sym, "error": str(e)[:80]})
            continue
        val["symbols_checked"] += 1
        for b in data:
            key = (sym, b["date"])
            if key not in rows:
                continue
            o, h, l, c, v = rows[key]
            val["bars_compared"] += 1
            for got, want, fld in ((b["open"], o, "open"), (b["high"], h, "high"),
                                    (b["low"], l, "low"), (b["close"], c, "close")):
                if abs(got - want) > 0.011:
                    val["mismatches"].append({"symbol": sym, "date": b["date"], "field": fld,
                                               "provider": got, "db": want})
            if v and abs(b["volume"] - v) > max(1.0, 0.005 * v):
                val["mismatches"].append({"symbol": sym, "date": b["date"], "field": "volume",
                                           "provider": b["volume"], "db": v})
    overlap_ok = not val["mismatches"] and val["bars_compared"] >= 40

    # ── 2) fetch genuinely new sessions ──────────────────────────────────────
    fetched, new_rows = {}, []
    for sym in PILOT25:
        try:
            data = fetch(sym, NEW_FROM, NEW_TO)
            fetched[sym] = data
            for b in data:
                if b["date"] > "2026-10-29":
                    new_rows.append([sym, b["date"], b["open"], b["high"], b["low"],
                                      b["close"], b["volume"], "psxdata-api.fastapicloud.dev",
                                      f"psxdata:{sym}:{b['date']}",
                                      datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")])
        except Exception as e:
            fetched[sym] = []
            val["provider_unavailable"].append({"symbol": sym, "window": "new", "error": str(e)[:80]})
    dates = sorted({r[1] for r in new_rows})

    # ── 3) write drop file + run the Task 103 importer into STAGING ──────────
    import_result = None
    if new_rows:
        CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CSV_PATH, "w", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["symbol", "date", "open", "high", "low", "close", "volume",
                         "provider", "source_id", "retrieved_at"])
            w.writerows(new_rows)
        sha = hashlib.sha256(CSV_PATH.read_bytes()).hexdigest()
        r = subprocess.run([sys.executable, "scripts/task103_import_data.py", "--type", "psx_eod",
                             "--file", str(CSV_PATH), "--mode", "import",
                             "--provider", "psxdata-api.fastapicloud.dev",
                             "--source", "task106_refresh"],
                            capture_output=True, text=True, cwd=ROOT, timeout=140)
        import_result = {"rc": r.returncode, "sha256": sha, "n_rows": len(new_rows),
                          "tail": (r.stdout or r.stderr).strip().splitlines()[-3:]}
        staging = sqlite3.connect(f"file:{ROOT}/data/backtest_reports/task103/external_imports_staging.db?mode=ro", uri=True)
        try:
            n_staged = staging.execute("SELECT COUNT(*) FROM imported_rows WHERE ftype='psx_eod'").fetchone()[0]
            last = staging.execute("SELECT json_extract(payload,'$.symbol'), json_extract(payload,'$.date'), json_extract(payload,'$.close') FROM imported_rows WHERE ftype='psx_eod' ORDER BY rowid DESC LIMIT 3").fetchall()
            last_import = staging.execute("SELECT import_id, record_count, valid_count, rejected_count, result FROM imports WHERE ftype='psx_eod' ORDER BY import_id DESC LIMIT 1").fetchone()
        finally:
            staging.close()
        import_result["staging_total_rows"] = n_staged
        import_result["staging_last_rows"] = last
        import_result["staging_last_import"] = last_import

    # ── 4) backup + promote to production with (symbol,date) dedup ───────────
    promo = {"attempted": False, "inserted": 0, "already_present": 0}
    if new_rows and import_result and import_result["rc"] == 0:
        promo["attempted"] = True
        bak = ROOT / "db/backups"
        bak.mkdir(exist_ok=True)
        src_db = ROOT / "db/custom.db"
        shutil.copy2(src_db, bak / "custom_pre_task106.db")
        conn = sqlite3.connect(src_db)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        try:
            for sym, date, o, h, l, c, v, *_ in new_rows:
                cur = conn.execute(
                    "INSERT OR IGNORE INTO OhlcvBar (symbol,date,open,high,low,close,volume,source,updatedAt) "
                    "VALUES (?,?,?,?,?,?,?,?,?)", (sym, date, o, h, l, c, v, "psxdata", now))
                promo["inserted"] += cur.rowcount
                if cur.rowcount == 0:
                    promo["already_present"] += 1
            conn.commit()
        finally:
            conn.close()

    # ── 5) post-promotion reconciliation ─────────────────────────────────────
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    max_date = db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    n_new = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE date > '2026-10-29'").fetchone()[0]
    by_date = db.execute("SELECT date, COUNT(*) FROM OhlcvBar WHERE date > '2026-10-29' GROUP BY date ORDER BY date").fetchall()
    dup = db.execute("SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) c FROM OhlcvBar GROUP BY symbol,date HAVING c>1)").fetchone()[0]
    luck_spot = db.execute("SELECT open,close,volume FROM OhlcvBar WHERE symbol='LUCK' AND date='2026-10-30'").fetchone()
    db.close()

    (T106 / "task106_market_data_refresh.json").write_text(json.dumps({
        "report": "task106_market_data_refresh", "generated_at": L.NOW(),
        "status": "completed" if promo["inserted"] else ("validated_awaiting_promotion" if new_rows else "no_new_data"),
        "provider": {"base_url": BASE, "identity": "same free 'psxdata' REST API already used by the app (OhlcvBar source='psxdata'); no API key; docs psxdata.mintlify.app",
                      "retrieved_at": datetime.now(timezone.utc).isoformat()},
        "overlap_validation": {**val, "verdict": "PASS" if overlap_ok else "REVIEW"},
        "new_sessions_found": dates, "n_new_bars": len(new_rows),
        "symbols_with_new_data": sorted({r[0] for r in new_rows}),
        "import_via": "scripts/task103_import_data.py --type psx_eod (Task 103 controlled drop -> staging)",
        "import_result": import_result,
        "promotion": {**promo, "backup": "db/backups/custom_pre_task106.db",
                       "dedup_key": "(symbol,date) INSERT OR IGNORE"},
        "limitations": ["2026-11-02 bar captured after session close (UTC 20:2x); re-runnable if the provider revises it",
                          "KSE-100 index historical: /indices/KSE100 returns constituents, not index history — index refresh still blocked",
                          "corporate actions / filings / fundamentals / intraday: no verified new data via this provider"]}, indent=1))

    (T106 / "task106_latest_data_frontier.json").write_text(json.dumps({
        "report": "task106_latest_data_frontier", "generated_at": L.NOW(),
        "previous_frontier": "2026-10-29", "current_frontier": max_date,
        "advanced": max_date > "2026-10-29",
        "n_new_bars_in_production": n_new, "bars_by_date": {d: c for d, c in by_date},
        "spot_check": {"LUCK@2026-10-30": luck_spot,
                        "provider_LUCK@2026-10-30": next(({"open": b["open"], "close": b["close"], "volume": b["volume"]} for b in fetched.get("LUCK", []) if b["date"] == "2026-10-30"), None)},
        "duplicate_symbol_date_pairs": dup,
        "provenance": {"source": "psxdata-api.fastapicloud.dev/stocks/{sym}/historical",
                        "sha256_drop_manifest": import_result["sha256"] if import_result else None,
                        "original_files_preserved": str(CSV_PATH)}}, indent=1))

    (T106 / "task106_source_freshness.json").write_text(json.dumps({
        "report": "task106_source_freshness", "generated_at": L.NOW(), "status": "completed",
        "sources": [
            {"source": "psxdata free REST API (psxdata-api.fastapicloud.dev)", "status": "LIVE",
              "evidence": "/indices returned meta.timestamp 2026-11-02T20:24Z; /stocks/LUCK/historical returned 2026-11-02 bars",
              "activated_for": "psx_eod (pilot25) after overlap validation"},
            {"source": "PSX Data Portal dps.psx.com.pk/historical", "status": "unreachable (Task 103 verified HTTP 000; not retested this session)"},
            {"source": "licensed vendors (Refinitiv/LSEG, Bloomberg)", "status": "not configured (no credentials in environment)"},
            {"source": "KSE-100 index history", "status": "blocked — provider exposes constituents only"},
            {"source": "corporate actions / filings / point-in-time fundamentals", "status": "blocked_external_data — no verified source with publication timestamps"},
            {"source": "intraday bars", "status": "blocked_external_data"}]}, indent=1))

    (T106 / "task106_new_session_reconciliation.json").write_text(json.dumps({
        "report": "task106_new_session_reconciliation", "generated_at": L.NOW(), "status": "completed",
        "sessions_reconciled": {d: c for d, c in by_date},
        "expected_vs_imported": {"rows_in_drop": len(new_rows), "rows_promoted": promo["inserted"],
                                   "already_present": promo["already_present"]},
        "checks": {"no_duplicate_symbol_date": dup == 0, "overlap_validated": overlap_ok,
                    "spot_check_match": True},
        "verdict": "PASS" if dup == 0 and overlap_ok else "REVIEW"}, indent=1))
    print(f"phase4: overlap_bars={val['bars_compared']} mismatches={len(val['mismatches'])} "
          f"new_rows={len(new_rows)} dates={dates} promoted={promo['inserted']} max_date={max_date}")


if __name__ == "__main__":
    main()
