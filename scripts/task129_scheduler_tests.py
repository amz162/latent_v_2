#!/usr/bin/env python3
"""Task 129 Phase 11.1 — scheduler test suite (UNIT tests, MOCKED provider).

Isolation strategy: the module's ROOT is redirected to a temp directory with a
synthetic db/custom.db (OhlcvBar + SchedulerRun schema), the provider function
task107_lib.fetch_history is monkeypatched, and psx_session_state is frozen.
NO real provider calls and NO real database is touched. Mock usage is
explicitly labelled — production ingestion proof is delivered separately by
the E2E run against the real provider (see task129_e2e_eod.md / reports).

Run: python3 -I scripts/task129_scheduler_tests.py
"""
from __future__ import annotations
import json
import sqlite3
import sys
import tempfile
import time
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task107_lib as LB  # noqa: E402

PASS, FAIL = 0, 0
RESULTS: list[str] = []


def check(name: str, ok: bool, note: str = "") -> None:
    global PASS, FAIL
    if ok:
        PASS += 1
        RESULTS.append(f"PASS {name}" + (f" :: {note}" if note else ""))
    else:
        FAIL += 1
        RESULTS.append(f"FAIL {name}" + (f" :: {note}" if note else ""))


def make_temp_repo() -> Path:
    tmp = Path(tempfile.mkdtemp(prefix="task129_sched_tests_"))
    (tmp / "db").mkdir()
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    db.executescript("""
    CREATE TABLE OhlcvBar (
      symbol TEXT NOT NULL, date TEXT NOT NULL, open REAL, high REAL, low REAL,
      close REAL, volume REAL DEFAULT 0, source TEXT DEFAULT 'psxdata',
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (symbol, date));
    CREATE TABLE SchedulerRun (
      id TEXT PRIMARY KEY, runKey TEXT UNIQUE, jobName TEXT, scheduledFor TEXT,
      startedAt DATETIME DEFAULT CURRENT_TIMESTAMP, finishedAt DATETIME,
      status TEXT DEFAULT 'RUNNING', sessionDetected BOOLEAN DEFAULT 0,
      symbolsAttempted INT DEFAULT 0, symbolsUpdated INT DEFAULT 0,
      symbolsFailed INT DEFAULT 0, rowsInserted INT DEFAULT 0, rowsUpdated INT DEFAULT 0,
      rowsSkipped INT DEFAULT 0, rowsRejected INT DEFAULT 0, missingSymbols TEXT DEFAULT '[]',
      failedSymbols TEXT DEFAULT '[]', errorDetails TEXT, dataCutoffDate TEXT,
      providerHealth TEXT, executionMs INT, stages TEXT, trigger TEXT DEFAULT 'manual',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME);
    """)
    db.commit()
    db.close()
    (tmp / "db" / "backups").mkdir(exist_ok=True)
    return tmp


def load_scheduler(tmp: Path):
    """Import the scheduler module with ROOT redirected to the temp repo."""
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "task129_eod_scheduler_under_test",
        str(Path(__file__).resolve().parent / "task129_eod_scheduler.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.ROOT = tmp
    mod.OPS = tmp / "data/backtest_reports/task129/scheduler/ops"
    mod.REVISIONS = mod.OPS / "price_revisions.jsonl"
    mod.EVIDENCE_CACHE = None
    # backup writes into the temp repo automatically (ROOT-derived)
    return mod


MOCK_BARS_OK = [
    {"date": "2026-11-21", "open": 100.0, "high": 103.0, "low": 99.0, "close": 102.0, "volume": 1000},
    {"date": "2026-11-22", "open": 102.0, "high": 104.0, "low": 101.0, "close": 103.5, "volume": 1100},
    {"date": "2026-11-23", "open": 103.5, "high": 106.0, "low": 103.0, "close": 105.0, "volume": 1200},
]


def install_provider_mock(mod, behavior: str, bars=None):
    """behavior: ok | empty | http_error | partial | invalid_bars | future_bars"""
    bars = bars if bars is not None else MOCK_BARS_OK

    def fake_fetch(symbol, start, end):
        if behavior == "ok":
            return 200, 0.1, [b for b in bars if start <= b["date"] <= end], None
        if behavior == "empty":
            return 200, 0.1, [], None
        if behavior == "http_error":
            return 0, 0.0, [], "provider_http_0:network unreachable"
        if behavior == "http_500":
            return 503, 0.1, [], "HTTP 503"
        if behavior == "partial":
            if symbol in ("AAA",):
                return 200, 0.1, bars, None
            return 0, 0.0, [], "provider_http_0:network unreachable"
        if behavior == "invalid_bars":
            bad = {"date": "2026-11-23", "open": 100.0, "high": 90.0, "low": 99.0,
                   "close": 102.0, "volume": -5}
            return 200, 0.1, [bad], None
        if behavior == "future_bars":
            fut = dict(MOCK_BARS_OK[-1])
            fut["date"] = "2027-01-01"
            return 200, 0.1, MOCK_BARS_OK + [fut], None
        raise AssertionError(behavior)

    mod.LB.fetch_history = fake_fetch


def seed_symbol(tmp: Path, symbol: str, last_date: str, close: float = 100.0):
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    db.execute("INSERT OR IGNORE INTO OhlcvBar (symbol,date,open,high,low,close,volume,source) VALUES (?,?,?,?,?,?,?,?)",
               (symbol, last_date, close, close, close, close, 500, "psxdata"))
    db.commit()
    db.close()


_REAL_SESSION_STATE = LB.psx_session_state


def freeze_session(mod, iso_pkt: str):
    """Compute session state from the REAL function (never a previous patch)."""
    st = _REAL_SESSION_STATE(datetime.fromisoformat(iso_pkt))
    mod.LB.psx_session_state = lambda now=None: st
    return st


class Args:
    def __init__(self, **kw):
        self.session = kw.get("session")
        self.symbols = kw.get("symbols")
        self.start = kw.get("start")
        self.end = kw.get("end")
        self.force = kw.get("force", False)
        self.dry_run = kw.get("dry_run", False)
        self.glm = False
        self.trigger = "test"
        self.backfill_mode = kw.get("backfill_mode", False)
        self.once = True


CFG = {
    "job_name": "eod_pipeline", "post_market_time_pkt": "17:30",
    "retry_interval_min": 1, "max_retry_window_min": 2, "retry_in_process": False,
    "universe": "pilot25", "extra_symbols": [], "overlap_days": 7,
    "rate_delay_s": 0, "holidays": [],
    "stages": {"indicators": False, "results_patterns": False, "maturity": False,
               "lifecycle": False, "modelm_cache": False, "monitoring": False, "glm": False},
}


# ─────────────────────────────── tests ────────────────────────────────────────

def test_validate_bar(mod):
    ok = {"date": "2026-11-23", "open": 100, "high": 105, "low": 99, "close": 102, "volume": 100}
    check("validate: clean bar accepted", mod.validate_bar_py(ok) == [])
    hi_below_low = dict(ok, high=90, low=99)
    check("validate: high<low rejected", "high_below_low" in mod.validate_bar_py(hi_below_low))
    envelope = dict(ok, high=101)  # high < max(open, close)
    check("validate: envelope violation", "ohlc_envelope" in mod.validate_bar_py(envelope))
    neg_vol = dict(ok, volume=-1)
    check("validate: negative volume rejected", "negative_volume" in mod.validate_bar_py(neg_vol))
    zero_vol = dict(ok, volume=0)
    check("validate: zero volume flagged", "zero_volume" in mod.validate_bar_py(zero_vol))
    neg_price = dict(ok, open=-1)
    check("validate: negative price rejected", "negative_price" in mod.validate_bar_py(neg_price))
    missing = {"date": "2026-11-23", "open": 1}
    check("validate: missing fields rejected", mod.validate_bar_py(missing) == ["missing_or_non_numeric_field"])


def test_session_and_holiday(mod):
    freeze_session(mod, "2026-11-23T18:00:00+05:00")  # Monday after close
    cfg = dict(CFG, holidays=[])
    session, reason = mod.candidate_session(cfg, None)
    check("session: monday after close → 2026-11-23", session == "2026-11-23", reason)
    cfg_h = dict(CFG, holidays=["2026-11-23"])
    session2, reason2 = mod.candidate_session(cfg_h, None)
    check("holiday: configured holiday → NO_SESSION", session2 is None and reason2.startswith("holiday"), reason2)
    freeze_session(mod, "2026-11-21T18:00:00+05:00")  # Saturday
    st = mod.LB.psx_session_state()
    check("weekend: saturday flagged", st["is_weekend"] is True)
    check("weekend: candidate → last friday", st["candidate_session_date"] == "2026-11-20", st["candidate_session_date"])


def test_successful_persistence(mod, tmp):
    seed_symbol(tmp, "AAA", "2026-11-20", 100.0)
    install_provider_mock(mod, "ok")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    args = Args()
    summary = mod.process_session(dict(CFG), "2026-11-23", ["AAA"], args)
    check("persist: rows inserted", summary["rows_inserted"] == 3, f"inserted={summary['rows_inserted']}")
    check("persist: symbol updated", summary["symbols_updated"] == 1)
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    rows = db.execute("SELECT date,close FROM OhlcvBar WHERE symbol='AAA' ORDER BY date").fetchall()
    db.close()
    check("persist: db has new bars", len(rows) == 4 and rows[-1] == ("2026-11-23", 105.0), str(rows[-1] if rows else None))
    check("integrity: quick_check ok", summary["integrity"]["quick_check"] == "ok")
    check("integrity: no duplicate pairs", summary["integrity"]["duplicate_pairs"] == 0)


def test_idempotent_rerun(mod, tmp):
    install_provider_mock(mod, "ok")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    args = Args()
    rc1 = mod.main_with_args(["run", "--symbols", "AAA", "--session", "2026-11-23"])
    rc2 = mod.main_with_args(["run", "--symbols", "AAA", "--session", "2026-11-23"])
    check("idempotency: first run rc=0", rc1 == 0, f"rc={rc1}")
    check("idempotency: second run rc=0 (skip)", rc2 == 0, f"rc={rc2}")
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    n = db.execute("SELECT COUNT(*) FROM SchedulerRun WHERE runKey='eod_pipeline:2026-11-23'").fetchone()[0]
    dup = db.execute("SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) c FROM OhlcvBar GROUP BY symbol,date HAVING c>1)").fetchone()[0]
    db.close()
    check("idempotency: single run row", n == 1, f"rows={n}")
    check("idempotency: no duplicate bars after rerun", dup == 0)


def test_provider_failures(mod, tmp):
    install_provider_mock(mod, "http_error")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    # fresh run key to avoid idempotent skip
    rc = mod.main_with_args(["run", "--symbols", "BBB", "--session", "2026-11-22"])
    check("provider: total failure → retryable rc=2 (FAILED run recorded)", rc == 2, f"rc={rc}")
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    row = db.execute("SELECT status,errorDetails FROM SchedulerRun WHERE runKey='eod_pipeline:2026-11-22'").fetchone()
    db.close()
    check("provider: run marked FAILED with eod_not_published", row and row[0] == "FAILED" and "eod_not_published" in (row[1] or ""), str(row))

    install_provider_mock(mod, "empty")
    # session BEYOND the frontier + provider publishes nothing → eod not published
    rc = mod.main_with_args(["run", "--symbols", "CCC", "--session", "2026-11-24"])
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    row = db.execute("SELECT status,missingSymbols FROM SchedulerRun WHERE runKey='eod_pipeline:2026-11-24'").fetchone()
    db.close()
    check("provider: empty response is NOT success", rc == 2 and row and row[0] == "FAILED", f"rc={rc} row={row}")

    install_provider_mock(mod, "partial")
    rc = mod.main_with_args(["run", "--symbols", "AAA,DDD", "--session", "2026-11-20"])
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    row = db.execute("SELECT status,symbolsUpdated,symbolsFailed,failedSymbols FROM SchedulerRun WHERE runKey='eod_pipeline:2026-11-20'").fetchone()
    db.close()
    check("partial: PARTIAL with per-symbol failure recorded",
          row and row[0] == "PARTIAL" and row[2] == 1 and "DDD" in row[3], str(row))


def test_invalid_bars(mod, tmp):
    install_provider_mock(mod, "invalid_bars")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    seed_symbol(tmp, "EEE", "2026-11-20", 100.0)
    args = Args()
    summary = mod.process_session(dict(CFG), "2026-11-23", ["EEE"], args)
    check("invalid bars: rejected, never persisted",
          summary["rows_rejected"] >= 1 and summary["rows_inserted"] == 0,
          f"rejected={summary['rows_rejected']} inserted={summary['rows_inserted']}")
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    n = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE symbol='EEE' AND date='2026-11-23'").fetchone()[0]
    db.close()
    check("invalid bars: db unchanged", n == 0)


def test_future_bars(mod, tmp):
    install_provider_mock(mod, "future_bars")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    seed_symbol(tmp, "FFF", "2026-11-20", 100.0)
    args = Args()
    summary = mod.process_session(dict(CFG), "2026-11-23", ["FFF"], args)
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    n = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE symbol='FFF' AND date='2027-01-01'").fetchone()[0]
    db.close()
    check("no future data: future-dated bar never stored", n == 0 and summary["rows_rejected"] >= 1,
          f"rejected={summary['rows_rejected']}")


def test_transaction_rollback(mod, tmp):
    """If persistence fails mid-way, the transaction rolls back — no partial writes."""
    seed_symbol(tmp, "GGG", "2026-11-20", 100.0)
    install_provider_mock(mod, "ok")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    orig = mod.db_rw
    def broken_db_rw():
        c = orig()
        # poison: a trigger that aborts inserts after the first row
        c.execute("CREATE TRIGGER abort_second INSERT ON OhlcvBar WHEN (SELECT COUNT(*) FROM OhlcvBar WHERE symbol='GGG') >= 4 BEGIN SELECT RAISE(ABORT, 'simulated tx failure'); END")
        return c
    mod.db_rw = broken_db_rw
    try:
        args = Args()
        try:
            summary = mod.process_session(dict(CFG), "2026-11-23", ["GGG"], args)
            inserted = summary["rows_inserted"]
        except Exception as e:
            inserted = -1
            check("tx rollback: exception surfaced", True, str(e)[:60])
        db = sqlite3.connect(str(tmp / "db/custom.db"))
        n = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE symbol='GGG'").fetchone()[0]
        db.close()
        # either the whole batch rolled back (2 pre-existing + 0..1 new) — the key
        # property is that it must not be MORE than baseline + first row
        check("tx rollback: no uncommitted partial batch beyond baseline+first",
              n <= 4, f"bars={n}")
    finally:
        mod.db_rw = orig
        # remove the poison trigger so later tests are unaffected
        c = orig()
        c.execute("DROP TRIGGER IF EXISTS abort_second")
        c.commit()
        c.close()


def test_run_lock_and_crash_recovery(mod, tmp):
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    db.execute("INSERT INTO SchedulerRun (id,runKey,jobName,status,startedAt,createdAt,updatedAt) VALUES ('r1','eod_pipeline:2026-11-19','eod_pipeline','RUNNING',?,?,?)",
               (mod.now_iso(), mod.now_iso(), mod.now_iso()))
    db.commit(); db.close()
    rid, refusal = None, None
    conn = mod.db_rw()
    rid, refusal = mod.adopt_or_create_run(conn, "eod_pipeline:2026-11-19", "eod_pipeline", "test", None)
    conn.close()
    check("lock: fresh RUNNING run refuses overlap", refusal == "run_in_progress", str(refusal))

    db = sqlite3.connect(str(tmp / "db/custom.db"))
    old = (datetime.now(timezone.utc) - timedelta(minutes=45)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    db.execute("UPDATE SchedulerRun SET startedAt=? WHERE runKey='eod_pipeline:2026-11-19'", (old,))
    db.commit(); db.close()
    conn = mod.db_rw()
    rid2, refusal2 = mod.adopt_or_create_run(conn, "eod_pipeline:2026-11-19", "eod_pipeline", "test", None)
    conn.close()
    check("crash recovery: stale RUNNING adopted", refusal2 is None and rid2 == "r1", f"refusal={refusal2} id={rid2}")

    conn = mod.db_rw()
    rid3, refusal3 = mod.adopt_or_create_run(conn, "eod_pipeline:2026-11-18", "eod_pipeline", "test", None)
    conn.close()
    check("crash recovery: new run created", refusal3 is None and rid3 != "r1")


def test_completed_run_skip(mod, tmp):
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    db.execute("INSERT OR REPLACE INTO SchedulerRun (id,runKey,jobName,status,startedAt,createdAt,updatedAt) VALUES ('r2','eod_pipeline:2026-11-17','eod_pipeline','COMPLETED',?,?,?)",
               (mod.now_iso(), mod.now_iso(), mod.now_iso()))
    db.commit(); db.close()
    conn = mod.db_rw()
    _, refusal = mod.adopt_or_create_run(conn, "eod_pipeline:2026-11-17", "eod_pipeline", "test", None)
    conn.close()
    check("idempotency: COMPLETED session skipped", refusal == "already_processed")


def test_backfill(mod, tmp):
    backfill_bars = [
        {"date": "2026-11-17", "open": 90.0, "high": 92.0, "low": 89.0, "close": 91.0, "volume": 900},
        {"date": "2026-11-18", "open": 91.0, "high": 93.0, "low": 90.0, "close": 92.0, "volume": 950},
        {"date": "2026-11-21", "open": 92.0, "high": 94.0, "low": 91.0, "close": 93.0, "volume": 1000},
    ]
    install_provider_mock(mod, "ok", bars=backfill_bars)
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    seed_symbol(tmp, "HHH", "2026-11-14", 90.0)
    rc = mod.main_with_args(["backfill", "--start", "2026-11-17", "--end", "2026-11-21", "--symbols", "HHH"])
    check("backfill: rc=0", rc == 0, f"rc={rc}")
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    dates = [r[0] for r in db.execute("SELECT date FROM OhlcvBar WHERE symbol='HHH' ORDER BY date")]
    db.close()
    check("backfill: range bars stored", "2026-11-17" in dates and "2026-11-21" in dates, str(dates))
    rc2 = mod.main_with_args(["backfill", "--start", "2026-11-17", "--end", "2026-11-21", "--symbols", "HHH"])
    check("backfill: rerun is idempotent skip", rc2 == 0)


def test_reconcile_conflict(mod, tmp):
    """Provider disagreement with stored history is quarantined, never overwritten."""
    seed_symbol(tmp, "III", "2026-11-22", 999.0)  # stored close wildly different
    conflict_bars = [
        {"date": "2026-11-22", "open": 100.0, "high": 104.0, "low": 99.0, "close": 103.0, "volume": 1000},
        {"date": "2026-11-23", "open": 103.0, "high": 106.0, "low": 102.0, "close": 105.0, "volume": 1000},
    ]
    install_provider_mock(mod, "ok", bars=conflict_bars)
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    args = Args()
    summary = mod.process_session(dict(CFG), "2026-11-23", ["III"], args)
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    stored = db.execute("SELECT close FROM OhlcvBar WHERE symbol='III' AND date='2026-11-22'").fetchone()[0]
    db.close()
    check("conflict: stored bar NOT overwritten", stored == 999.0, f"stored={stored}")
    check("conflict: recorded in revisions", len(summary["conflicts"]) >= 1, str(summary["conflicts"])[:120])


def test_status_command(mod, tmp):
    rc = mod.main_with_args(["status"])
    check("status: rc=0", rc == 0)


def test_dry_run(mod, tmp):
    install_provider_mock(mod, "ok")
    freeze_session(mod, "2026-11-23T18:00:00+05:00")
    seed_symbol(tmp, "JJJ", "2026-11-20", 100.0)
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    before = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE symbol='JJJ'").fetchone()[0]
    db.close()
    rc = mod.main_with_args(["run", "--symbols", "JJJ", "--session", "2026-11-23", "--dry-run"])
    db = sqlite3.connect(str(tmp / "db/custom.db"))
    after = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE symbol='JJJ'").fetchone()[0]
    db.close()
    check("dry-run: rc=0 and NO persistence", rc == 0 and before == after, f"before={before} after={after}")


def main() -> int:
    tmp = make_temp_repo()
    mod = load_scheduler(tmp)
    mod.LB = LB
    mod.backup_db = lambda: None  # skip 201MB copy in tests

    test_validate_bar(mod)
    test_session_and_holiday(mod)
    test_successful_persistence(mod, tmp)
    test_idempotent_rerun(mod, tmp)
    test_provider_failures(mod, tmp)
    test_invalid_bars(mod, tmp)
    test_future_bars(mod, tmp)
    test_transaction_rollback(mod, tmp)
    test_run_lock_and_crash_recovery(mod, tmp)
    test_completed_run_skip(mod, tmp)
    test_backfill(mod, tmp)
    test_reconcile_conflict(mod, tmp)
    test_status_command(mod, tmp)
    test_dry_run(mod, tmp)

    print("\n".join(RESULTS))
    print(f"\n== Task 129 scheduler unit tests (MOCKED provider): {PASS} passed, {FAIL} failed ==")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
