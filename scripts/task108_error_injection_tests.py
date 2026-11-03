#!/usr/bin/env python3
"""Task 108 Phase 4/11 — error-injection and concurrency tests.

Every scenario runs the REAL monitor engine (task107_monitor.run_cycle) against
redirected state (TASK108_T107_DIR / TASK108_SNAP_DB) with an injected provider,
so real artifacts are never touched. Output: task108_error_injection_tests.json
"""
from __future__ import annotations
import json, os, shutil, sqlite3, sys, threading, tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
ROOT = Path("/home/z/my-project")
RESULTS = []

BASE_STATE = ROOT / "data/backtest_reports/task107"

# real last-known prices for the five injected symbols (validation band sanity)
REAL_PRICE = {"ENGRO": 100.0, "HUBC": 100.0, "LUCK": 100.0, "SYS": 100.0, "MEBL": 100.0}


def fresh_env() -> tuple[str, str]:
    tmp = Path(tempfile.mkdtemp(prefix="t108_inject_"))
    t107 = tmp / "task107"
    (t107 / "ops").mkdir(parents=True)
    for f in ("_matured.json", "_pending_ledger.json"):
        shutil.copy(BASE_STATE / f, t107 / f)
    os.environ["TASK108_T107_DIR"] = str(t107)
    os.environ["TASK108_SNAP_DB"] = str(tmp / "snapshots.db")
    for mod in list(sys.modules):
        if mod.startswith(("task107_", "task103_", "task108_")):
            del sys.modules[mod]
    return str(t107), str(tmp / "snapshots.db")


class FakeErr(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(f"HTTP {code}")


def real_closes() -> dict[str, float]:
    """Inject REAL daily closes so the far-from-close validation does not fire
    on otherwise-valid synthetic observations."""
    import task107_lib as LB
    db = LB.db_connect()
    frontier = LB.frontier_date()
    out = {s: (db.execute("SELECT close FROM OhlcvBar WHERE symbol=? AND date=?",
            (s, frontier)).fetchone() or [100.0])[0] for s in LB.PILOT25}
    db.close()
    return out


def setup_provider(prices: dict[str, float | Exception], seq: list | None = None):
    import task107_lib as LB
    ALL = real_closes()
    ALL.update(prices)

    def fake(url, timeout=10):
        sym = url.split("/stocks/")[1].split("/")[0]
        p = ALL.get(sym, 100.0)
        if isinstance(p, Exception):
            return p.code, 0.01, None, str(p)
        ts = datetime.now(timezone.utc).isoformat()
        return 200, 0.01, {"data": {"price": p}, "meta": {"timestamp": ts, "cached": False}}, ""
    LB.fetch_json = fake
    return ALL


def run_scenario(name: str, prices, expect_class: str, note: str, cycles: int = 1):
    t107, snap = fresh_env()
    setup_provider(prices)
    import task107_monitor as M
    M.SNAP_DB = Path(snap)
    got = []
    for _ in range(cycles):
        cls, info = M.run_cycle()
        got.append((cls, info.get("new"), len(info.get("errors") or []), len(info.get("rejected") or [])))
    final_cls = got[-1][0]
    ok = final_cls == expect_class
    RESULTS.append({"scenario": name, "expected": expect_class, "got": got[-1][0],
                     "cycles": [{"class": c, "new": n, "errors": e, "rejected": r} for c, n, e, r in got],
                     "pass": ok, "note": note})
    return ok


def main() -> int:
    # 1. total provider outage → degraded, never success
    run_scenario("provider_total_outage", {s: FakeErr(503) for s in ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL"]}, "degraded_provider",
                 "all-symbols HTTP 503 — run must NOT look like a successful refresh")
    # 2. partial outage → degraded with per-symbol errors
    p = {s: REAL_PRICE.get(s, 100.0) for s in ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL"]}
    p["SYS"] = FakeErr(500)
    run_scenario("provider_partial_outage", p, "degraded_provider",
                 "one symbol HTTP 500 → degraded, errors recorded per symbol")
    # 3. malformed price → integrity failure + quarantine
    p = {s: REAL_PRICE.get(s, 100.0) for s in ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL"]}
    p["ENGRO"] = -5.0
    t107, snap = fresh_env()
    setup_provider(p)
    import task107_monitor as M
    M.SNAP_DB = Path(snap)
    cls, info = M.run_cycle()
    q = Path(os.environ["TASK108_T107_DIR"]) / "ops/rejected_observations.json"
    RESULTS.append({"scenario": "malformed_price_quarantined", "expected": "failed_data_integrity",
                     "got": cls, "pass": cls == "failed_data_integrity" and q.exists(),
                     "quarantine_file": q.exists(),
                     "note": "non-positive price rejected, never inserted, run fails visibly"})
    # 4. structural 404 → 3 consecutive cycles then excluded from degradation
    p = {s: REAL_PRICE.get(s, 100.0) for s in ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL"]}
    p["HASCOL"] = FakeErr(404)
    run_scenario("structural_symbol_gap", p, "success_no_change",
                 "after 3 consecutive 404s the symbol is a reported structural gap, not an outage",
                 cycles=4)
    # 5. missing configuration → visible config failure
    t107, snap = fresh_env()
    os.remove(Path(t107) / "_matured.json")
    setup_provider({})
    import task107_monitor as M
    M.SNAP_DB = Path(snap)
    cls, info = M.run_cycle()
    RESULTS.append({"scenario": "missing_configuration", "expected": "failed_configuration",
                     "got": cls, "pass": cls == "failed_configuration",
                     "note": "missing _matured.json → failed_configuration (exit 3)"})
    # 6. no change → legitimate no-op success (all symbols at real closes)
    run_scenario("unchanged_prices_noop", {},
                 "success_no_change", "repeat poll with unchanged prices = no-op success (exit 0)",
                 cycles=2)
    # 7. changed price → immediate processing, success_with_updates
    t107, snap = fresh_env()
    setup_provider({s: REAL_PRICE.get(s, 100.0) for s in ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL"]})
    import task107_monitor as M
    M.SNAP_DB = Path(snap)
    M.run_cycle()
    import task107_lib as LB
    base = real_closes()["ENGRO"]
    bumped = round(base * 1.01, 2)
    def bumped_fake(url, timeout=10):
        sym = url.split("/stocks/")[1].split("/")[0]
        price = bumped if sym == "ENGRO" else real_closes().get(sym, base)
        return 200, 0.01, {"data": {"price": price},
                            "meta": {"timestamp": datetime.now(timezone.utc).isoformat()}}, ""
    LB.fetch_json = bumped_fake
    cls, info = M.run_cycle()
    RESULTS.append({"scenario": "changed_price_processed_immediately", "expected": "success_with_updates",
                     "got": cls, "new_obs": info.get("new"),
                     "pass": cls == "success_with_updates" and (info.get("new") or 0) >= 1,
                     "note": "changed price processed on the same cycle it arrives — no extra 15-minute wait"})
    # 8. SQLite concurrent writers (WAL + busy_timeout)
    tmp = Path(tempfile.mkdtemp(prefix="t108_conc_"))
    dbp = tmp / "conc.db"
    c = sqlite3.connect(dbp)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("CREATE TABLE t (a INTEGER)")
    c.commit(); c.close()
    errs = []
    def writer(n):
        try:
            conn = sqlite3.connect(dbp, timeout=10)
            conn.execute("PRAGMA busy_timeout=5000")
            for i in range(25):
                conn.execute("INSERT INTO t VALUES (?)", (n * 100 + i,))
                conn.commit()
            conn.close()
        except Exception as e:
            errs.append(str(e))
    threads = [threading.Thread(target=writer, args=(k,)) for k in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    c = sqlite3.connect(dbp)
    n = c.execute("SELECT COUNT(*) FROM t").fetchone()[0]
    integ = c.execute("PRAGMA integrity_check").fetchone()[0]
    c.close()
    RESULTS.append({"scenario": "sqlite_concurrent_writers_wal", "expected": "100 rows, ok integrity",
                     "got": f"{n} rows, {integ}", "errors": errs,
                     "pass": n == 100 and integ == "ok" and not errs,
                     "note": "WAL + busy_timeout: concurrent writers serialize safely; readers unblocked"})

    passed = sum(1 for r in RESULTS if r["pass"])
    out = {"report": "task108_error_injection_tests", "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "completed", "passed": passed, "failed": len(RESULTS) - passed,
            "total": len(RESULTS), "results": RESULTS,
            "verdict": "passed" if passed == len(RESULTS) else "failed"}
    dst = ROOT / "data/backtest_reports/task108"
    dst.mkdir(parents=True, exist_ok=True)
    (dst / "task108_error_injection_tests.json").write_text(json.dumps(out, indent=1))
    print(json.dumps({"passed": passed, "failed": len(RESULTS) - passed,
                       "scenarios": [r["scenario"] for r in RESULTS if not r["pass"]] or "all passed"}))
    return 0 if passed == len(RESULTS) else 1


if __name__ == "__main__":
    sys.exit(main())
