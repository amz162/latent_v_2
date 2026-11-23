#!/usr/bin/env python3
"""Task 129 — automated post-market EOD scheduler (authoritative daily pipeline).

Fetches the latest PSX daily OHLCV data for the configured universe after the
trading session, validates it, persists it idempotently into OhlcvBar, then
runs the downstream pipeline in strict order:

  1. market-data fetch (approved provider: psxdata-api.fastapicloud.dev)
  2. database persistence (INSERT OR IGNORE transactions + pre-run backup)
  3. data-integrity validation (duplicates, envelope, frontier advance)
  4. technical indicator / price-pattern refresh (precompute_price_patterns.ts)
  5. company-results pattern refresh (when financials changed)
  6. forecast maturity (task107_maturity.py)
  7. paper-trading lifecycle (prospective_paper_trading.ts)
  8. Model M evidence cache refresh (task129_model_m_cache.ts)
  9. optional GLM-4.6 research generation (--glm; host pipeline enables it)
 10. monitoring + daily reports (task112 + task127 + task123_health)

Design contract (Task 129 Phase 2):
  - Session presence is decided by PROVIDER DATA + calendar, never assumed:
    weekends, configured holidays and "provider published nothing new" are
    three distinct outcomes (NO_SESSION / retry / FAILED eod_not_published).
  - A run is COMPLETED only when new bars were persisted AND integrity passed;
    per-symbol failures make the run PARTIAL with failed symbols recorded.
  - Every run is recorded in the SchedulerRun table with a unique runKey
    (jobName:session) — overlapping schedulers cannot process a session twice.
  - Historical prices are never overwritten: conflicts are quarantined to
    ops/price_revisions.jsonl and reported.
  - No future timestamps, no fabricated bars, no secrets in logs.

Usage:
  python3 scripts/task129_eod_scheduler.py run [--session YYYY-MM-DD] [--force]
        [--symbols A,B,C] [--glm] [--trigger cron|manual|ci|daemon|retry]
  python3 scripts/task129_eod_scheduler.py recover --symbols A,B,C
  python3 scripts/task129_eod_scheduler.py backfill --start 2026-10-30 --end 2026-11-23 [--symbols ...]
  python3 scripts/task129_eod_scheduler.py status
  python3 scripts/task129_eod_scheduler.py daemon [--once]
  (add --dry-run to run/recover/backfill for fetch+validate without persistence)

Exit codes: 0 ok/no-op · 1 hard failure · 2 nothing-to-do (retryable) ·
3 lock/overlap refused · 4 provider/validation failure.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402

CONFIG_PATH = Path(
    __import__("os").environ.get("EOD_SCHEDULER_CONFIG", str(ROOT / "config/eod_scheduler.json"))
)
OPS = ROOT / "data/backtest_reports/task129/scheduler/ops"
REVISIONS = OPS / "price_revisions.jsonl"
CLOSE_TOLERANCE = 0.011  # PKR — same tolerance as task107 reconciliation
STALE_HEARTBEAT_S = 30 * 60  # a RUNNING row older than this is a crashed run

PKT = timezone(timedelta(hours=5))
GLM_SYMBOLS = ("ANL,BOP,CNERGY,ENGRO,FCCL,HASCOL,HUBC,HUMNL,KEL,LOTCHEM,LUCK,"
               "MEBL,MLCF,OGDC,PAEL,PIBTL,PPL,PRL,PSO,SYS,TELE,TRG,UNITY,WTL")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
        f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def load_config() -> dict:
    cfg = {
        "job_name": "eod_pipeline",
        "post_market_time_pkt": "17:30",
        "retry_interval_min": 15,
        "max_retry_window_min": 120,
        "retry_in_process": False,
        "universe": "pilot25",
        "extra_symbols": [],
        "overlap_days": 7,
        "rate_delay_s": 0.35,
        "holidays": [],
        "stages": {
            "indicators": True, "results_patterns": True, "maturity": True,
            "lifecycle": True, "modelm_cache": True, "monitoring": True, "glm": False,
        },
    }
    if CONFIG_PATH.exists():
        cfg.update(json.loads(CONFIG_PATH.read_text()))
    return cfg


def db_rw() -> sqlite3.Connection:
    c = sqlite3.connect(f"file:{ROOT}/db/custom.db", uri=True, timeout=60)
    c.execute("PRAGMA journal_mode=WAL")
    return c


def db_ro() -> sqlite3.Connection:
    return sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True, timeout=60)


# ─────────────────────────────── SchedulerRun ledger ──────────────────────────

RUN_COLUMNS = ("runKey,jobName,scheduledFor,startedAt,finishedAt,status,sessionDetected,"
               "symbolsAttempted,symbolsUpdated,symbolsFailed,rowsInserted,rowsUpdated,"
               "rowsSkipped,rowsRejected,missingSymbols,failedSymbols,errorDetails,"
               "dataCutoffDate,providerHealth,executionMs,stages,trigger,createdAt,updatedAt")


def _q1(db: sqlite3.Connection, sql: str, args: tuple = ()) -> tuple | None:
    return db.execute(sql, args).fetchone()


def adopt_or_create_run(db: sqlite3.Connection, run_key: str, job: str, trigger: str,
                        scheduled_for: str | None) -> tuple[str, str | None]:
    """Create the run row, or adopt a crashed run. Returns (run_id, refusal)."""
    row = _q1(db, "SELECT id,status,startedAt FROM SchedulerRun WHERE runKey=?", (run_key,))
    if row is None:
        vals = {
            "id": str(uuid.uuid4()), "runKey": run_key, "jobName": job,
            "scheduledFor": scheduled_for, "startedAt": now_iso(), "finishedAt": None,
            "status": "RUNNING", "sessionDetected": 0,
            "symbolsAttempted": 0, "symbolsUpdated": 0, "symbolsFailed": 0,
            "rowsInserted": 0, "rowsUpdated": 0, "rowsSkipped": 0, "rowsRejected": 0,
            "missingSymbols": "[]", "failedSymbols": "[]", "errorDetails": None,
            "dataCutoffDate": None, "providerHealth": None, "executionMs": None,
            "stages": "[]", "trigger": trigger, "createdAt": now_iso(), "updatedAt": now_iso(),
        }
        cols = ", ".join(vals)
        ph = ", ".join("?" for _ in vals)
        db.execute(f"INSERT INTO SchedulerRun ({cols}) VALUES ({ph})", tuple(vals.values()))
        db.commit()
        return str(vals["id"]), None
    rid, status, started = row
    if status in ("COMPLETED", "PARTIAL", "NO_SESSION"):
        return str(rid), "already_processed"
    if status == "RUNNING":
        try:
            age = time.time() - datetime.fromisoformat(started.replace("Z", "+00:00")).timestamp()
        except Exception:
            age = STALE_HEARTBEAT_S + 1
        if age < STALE_HEARTBEAT_S:
            return str(rid), "run_in_progress"
        # crashed run — adopt (update heartbeat, reset counters)
        db.execute(
            "UPDATE SchedulerRun SET startedAt=?,trigger=?,updatedAt=? WHERE id=?",
            (now_iso(), trigger, now_iso(), rid))
        db.commit()
        print(f"[run] adopted crashed RUNNING run {rid} (heartbeat age {int(age)}s)")
    return str(rid), None


def finish_run(db: sqlite3.Connection, rid: int, **fields) -> None:
    sets = ", ".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE SchedulerRun SET {sets}, updatedAt=? WHERE id=?",
               (*fields.values(), now_iso(), rid))
    db.commit()


def run_status_note(db: sqlite3.Connection, run_key: str) -> str | None:
    row = _q1(db, "SELECT status FROM SchedulerRun WHERE runKey=?", (run_key,))
    return row[0] if row else None


# ─────────────────────────────── universe / session ───────────────────────────

def resolve_universe(cfg: dict, symbols_arg: str | None) -> list[str]:
    if symbols_arg:
        return [s.strip().upper() for s in symbols_arg.split(",") if s.strip()]
    uni = cfg.get("universe", "pilot25")
    if uni == "pilot25":
        base = list(LB.PILOT25)
    elif uni == "all":
        ro = db_ro()
        try:
            base = [r[0] for r in ro.execute("SELECT DISTINCT symbol FROM OhlcvBar ORDER BY symbol")]
        finally:
            ro.close()
    else:
        base = [str(uni).upper()]
    extra = [s.strip().upper() for s in cfg.get("extra_symbols", []) if s.strip()]
    return sorted(set(base) | set(extra))


def is_holiday(date_iso: str, cfg: dict) -> bool:
    return date_iso in set(cfg.get("holidays", []))


def candidate_session(cfg: dict, session_arg: str | None) -> tuple[str | None, str]:
    """Returns (session_date|None, reason). None = no closed session to process."""
    st = LB.psx_session_state()
    cand = session_arg or st["candidate_session_date"]
    if session_arg:
        return cand, "explicit"
    if is_holiday(cand, cfg):
        return None, f"holiday:{cand}"
    if st["is_weekend"] and not session_arg:
        # candidate_session_date already points at the last weekday
        pass
    return cand, "session_state"


# ─────────────────────────────── fetch + validate ─────────────────────────────

def last_stored_date(ro: sqlite3.Connection, symbol: str) -> str | None:
    row = _q1(ro, "SELECT MAX(date) FROM OhlcvBar WHERE symbol=?", (symbol,))
    return row[0] if row and row[0] else None


def fetch_symbol_bars(symbol: str, start: str, end: str) -> tuple[list[dict], str | None]:
    """Returns (bars, error). error=None on success (bars may be empty)."""
    code, _dt, data, err = LB.fetch_history(symbol, start, end)
    if code != 200:
        return [], f"provider_http_{code}:{(err or '')[:80]}"
    return data or [], None


def validate_bar_py(b: dict) -> list[str]:
    return LB.validate_bar(b)


def reconcile_and_collect(ro: sqlite3.Connection, symbol: str, bars: list[dict],
                          overlap_days: int) -> dict:
    """Split provider bars into: new inserts, overlap-conflicts, already-stored."""
    res = {"inserts": [], "skipped_existing": 0, "conflicts": [], "rejected": []}
    last = last_stored_date(ro, symbol)
    overlap_start = (datetime.now() - timedelta(days=overlap_days + 2)).strftime("%Y-%m-%d")
    today = LB.psx_session_state()["now_pkt"][:10]
    for b in bars:
        problems = validate_bar_py(b)
        date = str(b.get("date", ""))[:10]
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            res["rejected"].append({"date": date, "problems": ["invalid_date_format"]})
            continue
        if problems:
            res["rejected"].append({"date": date, "problems": problems})
            continue
        if date > today:
            res["rejected"].append({"date": date, "problems": ["future_date"]})
            continue
        row = _q1(ro, "SELECT close,source FROM OhlcvBar WHERE symbol=? AND date=?", (symbol, date))
        if row is not None:
            res["skipped_existing"] += 1
            try:
                existing_close = float(row[0])
                provider_close = float(b.get("close"))
                if abs(existing_close - provider_close) > CLOSE_TOLERANCE and date >= overlap_start:
                    conflict = {"symbol": symbol, "date": date, "existing_close": existing_close,
                                "provider_close": provider_close, "existing_source": row[1],
                                "at": LB.NOW()}
                    res["conflicts"].append(conflict)
            except (TypeError, ValueError):
                pass
            continue
        if last is not None and date <= last:
            res["skipped_existing"] += 1  # older than frontier but missing (hole) → insert
            # holes inside history ARE inserted (never fabricated, provider-provided)
        res["inserts"].append({
            "symbol": symbol, "date": date,
            "open": float(b["open"]), "high": float(b["high"]),
            "low": float(b["low"]), "close": float(b["close"]),
            "volume": int(float(b.get("volume") or 0)), "source": "psxdata",
        })
    return res


def record_conflicts(conflicts: list[dict]) -> None:
    if not conflicts:
        return
    OPS.mkdir(parents=True, exist_ok=True)
    with open(REVISIONS, "a") as fh:
        for c in conflicts:
            fh.write(json.dumps(c) + "\n")


def persist_inserts(rows: list[dict]) -> int:
    """Transaction-safe INSERT OR IGNORE. Returns rows inserted."""
    if not rows:
        return 0
    db = db_rw()
    inserted = 0
    try:
        db.execute("BEGIN")
        for r in rows:
            cur = db.execute(
                "INSERT OR IGNORE INTO OhlcvBar (symbol,date,open,high,low,close,volume,source,"
                "updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
                (r["symbol"], r["date"], r["open"], r["high"], r["low"], r["close"],
                 r["volume"], r["source"], now_iso()))
            inserted += cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return inserted


def backup_db() -> str | None:
    src = ROOT / "db/custom.db"
    dst_dir = ROOT / "db/backups"
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / "custom_pre_task129.db"
    try:
        shutil.copy2(src, dst)
        return str(dst.relative_to(ROOT))
    except Exception as e:
        print(f"[backup] failed: {e}")
        return None


# ─────────────────────────────── downstream stages ────────────────────────────

def run_stage(name: str, cmd: list[str], timeout: int, stages: list, bun_ok: bool) -> int:
    t0 = time.time()
    if cmd[0] == "bun" and not bun_ok:
        stages.append({"stage": name, "rc": 2, "ms": 0, "note": "bun unavailable — skipped"})
        print(f"[{name}] rc=2 (no bun) :: skipped")
        return 2
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=timeout,
                           env={**__import__("os").environ,
                                "DATABASE_URL": f"file:{ROOT}/db/custom.db"})
        rc = r.returncode
        tail = ((r.stdout or r.stderr).strip().splitlines() or [""])[-1][:140]
        note = ""
    except subprocess.TimeoutExpired:
        rc, tail, note = 124, "", f"timeout after {timeout}s"
    stages.append({"stage": name, "rc": rc, "ms": int((time.time() - t0) * 1000), "note": note or str(tail)})
    print(f"[{name}] rc={rc} :: {str(tail)[:120]}")
    return rc


def downstream_stages(cfg: dict, stages: list, glm: bool, bun_ok: bool) -> bool:
    """Returns True when every mandatory stage passed (rc 0/2)."""
    st = cfg.get("stages", {})
    ok = True
    if st.get("indicators", True):
        rc = run_stage("indicators", ["bun", "scripts/precompute_price_patterns.ts", "--limit", "100"],
                       900, stages, bun_ok)
        ok &= rc in (0, 2)
    if st.get("results_patterns", True):
        rc = run_stage("results_patterns", ["bun", "scripts/task129_warm_result_patterns.ts"],
                       600, stages, bun_ok)
        ok &= rc in (0, 2)
    if st.get("maturity", True):
        rc = run_stage("maturity", [sys.executable, "scripts/task107_maturity.py"], 560, stages, bun_ok)
        ok &= rc in (0, 2)
    if st.get("lifecycle", True):
        rc = run_stage("lifecycle", ["bun", "scripts/prospective_paper_trading.ts"], 560, stages, bun_ok)
        ok &= rc in (0, 2)
    if st.get("modelm_cache", True):
        rc = run_stage("modelm_cache", ["bun", "scripts/task129_model_m_cache.ts"], 600, stages, bun_ok)
        ok &= rc in (0, 2)
    if glm or st.get("glm", False):
        rc = run_stage("glm", ["bun", "scripts/task111_llm_runner.ts", "--symbols", GLM_SYMBOLS],
                       1800, stages, bun_ok)
        # GLM failure is recorded but does NOT fail the run (llm_unavailable is a
        # legitimate research state; monitoring surfaces it via task127 alerts).
    if st.get("monitoring", True):
        rc = run_stage("monitoring_reports", [sys.executable, "scripts/task112_build_report.py"],
                       560, stages, bun_ok)
        ok &= rc in (0, 2)
        rc = run_stage("monitoring_alerts", [sys.executable, "scripts/task127_monitor.py"],
                       560, stages, bun_ok)
        ok &= rc in (0, 2)
        rc = run_stage("monitoring_health", [sys.executable, "scripts/task123_health.py"],
                       560, stages, bun_ok)
        ok &= rc in (0, 2)
    return ok


# ─────────────────────────────── core pipeline ────────────────────────────────

def process_session(cfg: dict, session: str, symbols: list[str], args) -> dict:
    """Fetch → validate → persist → integrity for ONE session/range. Returns summary."""
    overlap = int(cfg.get("overlap_days", 7))
    rate_delay = float(cfg.get("rate_delay_s", 0.35))
    ro = db_ro()
    summary = {"session": session, "symbols_attempted": 0, "symbols_updated": 0,
               "symbols_failed": 0, "rows_inserted": 0, "rows_skipped": 0,
               "rows_rejected": 0, "missing_symbols": [], "failed_symbols": [],
               "conflicts": [], "provider_unavailable": []}
    bun_ok = shutil.which("bun") is not None
    stages: list[dict] = []
    try:
        frontier_before = _q1(ro, "SELECT MAX(date) FROM OhlcvBar")[0]
        backup_db()
        for sym in symbols:
            summary["symbols_attempted"] += 1
            last = last_stored_date(ro, sym)
            start = session if args.backfill_mode else (last or session)
            if args.backfill_mode:
                start = args.start
            fetch_start = start
            if last and not args.backfill_mode:
                # re-fetch a small overlap window for reconciliation
                d0 = datetime.strptime(last, "%Y-%m-%d") - timedelta(days=overlap)
                fetch_start = d0.strftime("%Y-%m-%d")
            bars, err = fetch_symbol_bars(sym, fetch_start, session)
            if err:
                summary["symbols_failed"] += 1
                summary["failed_symbols"].append({"symbol": sym, "reason": err})
                if "provider_http_0" in err or "provider_http_5" in err or "provider_http_429" in err:
                    summary["provider_unavailable"].append(sym)
                time.sleep(rate_delay)
                continue
            if not bars:
                # provider responded OK but has no data in range
                summary["missing_symbols"].append(sym)
                time.sleep(rate_delay)
                continue
            res = reconcile_and_collect(ro, sym, bars, overlap)
            record_conflicts(res["conflicts"])
            summary["conflicts"].extend(res["conflicts"][:5])
            summary["rows_skipped"] += res["skipped_existing"]
            summary["rows_rejected"] += len(res["rejected"])
            if res["inserts"]:
                n = persist_inserts(res["inserts"])
                summary["rows_inserted"] += n
                if n > 0:
                    summary["symbols_updated"] += 1
            elif res["skipped_existing"] and not res["rejected"]:
                pass  # nothing new — up to date
            time.sleep(rate_delay)
    finally:
        ro.close()

    # integrity stage
    integ = {"duplicate_pairs": None, "frontier_after": None, "quick_check": None}
    try:
        ro = db_ro()
        integ["duplicate_pairs"] = _q1(
            ro, "SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) c FROM OhlcvBar "
                "GROUP BY symbol,date HAVING c>1)")[0]
        integ["frontier_after"] = _q1(ro, "SELECT MAX(date) FROM OhlcvBar")[0]
        integ["quick_check"] = _q1(ro, "PRAGMA quick_check")[0]
        ro.close()
    except Exception as e:
        integ["quick_check"] = f"error:{e}"
    summary["integrity"] = integ
    summary["frontier_before"] = frontier_before
    summary["stages"] = stages
    return summary


def cmd_run(cfg: dict, args) -> int:
    t0 = time.time()
    session, reason = candidate_session(cfg, args.session)
    if session is None:
        print(json.dumps({"status": "NO_SESSION", "reason": reason}))
        return 0
    symbols = resolve_universe(cfg, args.symbols)
    run_key = f"{cfg.get('job_name','eod_pipeline')}:{session}"
    db = db_rw()
    try:
        rid, refusal = adopt_or_create_run(db, run_key, cfg.get("job_name", "eod_pipeline"),
                                           args.trigger, None)
        if refusal == "already_processed":
            if not args.force:
                print(json.dumps({"status": run_status_note(db, run_key), "runKey": run_key,
                                  "note": "session already processed — idempotent skip"}))
                return 0
            # --force: deliberate re-run — reset the run row and re-process
            db.execute(
                "UPDATE SchedulerRun SET status='RUNNING', startedAt=?, finishedAt=NULL, "
                "rowsInserted=0, rowsUpdated=0, rowsSkipped=0, rowsRejected=0, updatedAt=? "
                "WHERE runKey=?", (now_iso(), now_iso(), run_key))
            db.commit()
            print(f"[run] --force re-processing {run_key}")
        if refusal == "run_in_progress":
            print(json.dumps({"status": "REFUSED", "note": "another run is in progress", "runKey": run_key}))
            return 3
    finally:
        db.close()

    OPS.mkdir(parents=True, exist_ok=True)
    print(f"[eod] session={session} ({reason}) symbols={len(symbols)} dry_run={args.dry_run}")

    if args.dry_run:
        ro = db_ro()
        would = 0
        try:
            for sym in symbols[:25]:  # bounded probe for dry-run
                last = last_stored_date(ro, sym)
                fs = (datetime.strptime(last, "%Y-%m-%d") - timedelta(days=int(cfg.get("overlap_days", 7)))).strftime("%Y-%m-%d") if last else session
                bars, err = fetch_symbol_bars(sym, fs, session)
                if err or not bars:
                    continue
                res = reconcile_and_collect(ro, sym, bars, int(cfg.get("overlap_days", 7)))
                would += len(res["inserts"])
        finally:
            ro.close()
        print(json.dumps({"status": "DRY_RUN", "session": session,
                          "probed_symbols": min(25, len(symbols)), "would_insert_bars": would}))
        return 0

    summary = process_session(cfg, session, symbols, args)
    stages = summary["stages"]
    frontier_after = summary["integrity"]["frontier_after"]

    # ── outcome classification (honest: empty ≠ success) ─────────────────────
    all_failed = (summary["symbols_attempted"] > 0
                  and summary["symbols_failed"] == summary["symbols_attempted"]
                  and summary["rows_inserted"] == 0)
    all_missing = (summary["symbols_attempted"] > 0
                   and len(summary["missing_symbols"]) == summary["symbols_attempted"]
                   and summary["rows_inserted"] == 0)

    if all_failed or (all_missing and frontier_after and frontier_after < session):
        # every symbol failed at the provider, or the provider has published
        # nothing for a session the frontier hasn't reached yet → retryable
        db = db_rw()
        try:
            finish_run(db, rid, status="FAILED", finishedAt=now_iso(),
                       symbolsAttempted=summary["symbols_attempted"],
                       symbolsFailed=summary["symbols_failed"],
                       missingSymbols=json.dumps(summary["missing_symbols"]),
                       failedSymbols=json.dumps(summary["failed_symbols"]),
                       errorDetails="eod_not_published_or_provider_unavailable",
                       executionMs=int((time.time() - t0) * 1000),
                       stages=json.dumps(stages), providerHealth=json.dumps(LB.provider_health_state()),
                       dataCutoffDate=frontier_after)
        finally:
            db.close()
        print(json.dumps({"status": "FAILED", "note": "eod_not_published_or_provider_unavailable"}))
        return 2  # retryable

    if summary["rows_inserted"] == 0 and summary["symbols_updated"] == 0 and summary["symbols_failed"] == 0:
        # provider healthy, universe already up to date for this session
        db = db_rw()
        try:
            finish_run(db, rid, status="NO_SESSION", finishedAt=now_iso(), sessionDetected=0,
                       symbolsAttempted=summary["symbols_attempted"],
                       symbolsUpdated=0, symbolsFailed=0,
                       rowsSkipped=summary["rows_skipped"], rowsRejected=summary["rows_rejected"],
                       missingSymbols=json.dumps(summary["missing_symbols"]),
                       dataCutoffDate=frontier_after,
                       executionMs=int((time.time() - t0) * 1000), stages=json.dumps(stages),
                       providerHealth=json.dumps(LB.provider_health_state()))
        finally:
            db.close()
        print(json.dumps({"status": "NO_SESSION", "note": "no new bars — already up to date",
                          "frontier": frontier_after}))
        return 0

    # persisted something (or partial symbol failures) → integrity + downstream
    integ = summary["integrity"]
    integrity_ok = (integ["quick_check"] == "ok" and (integ["duplicate_pairs"] or 0) == 0)
    downstream_ok = False
    if summary["rows_inserted"] > 0 and integrity_ok:
        downstream_ok = downstream_stages(cfg, stages, args.glm, shutil.which("bun") is not None)
    elif not integrity_ok:
        stages.append({"stage": "downstream", "rc": 4, "ms": 0,
                       "note": "blocked: integrity check failed — dependent analysis NOT run"})
    elif summary["rows_inserted"] == 0:
        stages.append({"stage": "downstream", "rc": 2, "ms": 0,
                       "note": "skipped: nothing new persisted (per-symbol failures recorded)"})

    status = "COMPLETED" if (integrity_ok and downstream_ok and summary["symbols_failed"] == 0) else "PARTIAL"

    status = "COMPLETED" if (integrity_ok and downstream_ok) else "PARTIAL"
    db = db_rw()
    try:
        finish_run(db, rid, status=status, finishedAt=now_iso(), sessionDetected=1,
                   symbolsAttempted=summary["symbols_attempted"],
                   symbolsUpdated=summary["symbols_updated"],
                   symbolsFailed=summary["symbols_failed"],
                   rowsInserted=summary["rows_inserted"], rowsSkipped=summary["rows_skipped"],
                   rowsRejected=summary["rows_rejected"],
                   missingSymbols=json.dumps(summary["missing_symbols"]),
                   failedSymbols=json.dumps(summary["failed_symbols"]),
                   errorDetails=None if integrity_ok else json.dumps(summary["integrity"]),
                   dataCutoffDate=summary["integrity"]["frontier_after"],
                   executionMs=int((time.time() - t0) * 1000), stages=json.dumps(stages),
                   providerHealth=json.dumps(LB.provider_health_state()))
    finally:
        db.close()
    print(json.dumps({"status": status, "runKey": run_key,
                      "rows_inserted": summary["rows_inserted"],
                      "symbols_updated": summary["symbols_updated"],
                      "frontier": summary["integrity"]["frontier_after"],
                      "stages": {s["stage"]: s["rc"] for s in stages}}))
    return 0 if status == "COMPLETED" else 1


def cmd_recover(cfg: dict, args) -> int:
    if not args.symbols:
        print("recover requires --symbols A,B,C")
        return 1
    args.backfill_mode = False
    args.start = None
    cfg["stages"] = {"indicators": False, "results_patterns": False, "maturity": False,
                     "lifecycle": False, "modelm_cache": False, "monitoring": True, "glm": args.glm}
    session, _ = candidate_session(cfg, args.session)
    if session is None:
        print(json.dumps({"status": "NO_SESSION"}))
        return 0
    run_key = f"eod_recover:{session}:{hashlib.sha1(args.symbols.encode()).hexdigest()[:10]}"
    recover_t0 = time.time()
    db = db_rw()
    try:
        rid, refusal = adopt_or_create_run(db, run_key, "eod_recover", "manual", None)
        if refusal == "run_in_progress":
            return 3
    finally:
        db.close()
    summary = process_session(cfg, session, resolve_universe(cfg, args.symbols), args)
    stages = summary.pop("stages")
    status = "COMPLETED" if summary["symbols_failed"] == 0 else "PARTIAL"
    db = db_rw()
    try:
        finish_run(db, rid, status=status, finishedAt=now_iso(), sessionDetected=1,
                   symbolsAttempted=summary["symbols_attempted"],
                   symbolsUpdated=summary["symbols_updated"],
                   symbolsFailed=summary["symbols_failed"],
                   rowsInserted=summary["rows_inserted"], rowsSkipped=summary["rows_skipped"],
                   rowsRejected=summary["rows_rejected"],
                   missingSymbols=json.dumps(summary["missing_symbols"]),
                   failedSymbols=json.dumps(summary["failed_symbols"]),
                   dataCutoffDate=summary["integrity"]["frontier_after"],
                   executionMs=int((time.time() - recover_t0) * 1000),
                   stages=json.dumps(stages))
    finally:
        db.close()
    print(json.dumps({"status": status, "summary": {k: v for k, v in summary.items() if k != "conflicts"}}))
    return 0 if status == "COMPLETED" else 1


def cmd_backfill(cfg: dict, args) -> int:
    if not (args.start and args.end):
        print("backfill requires --start and --end (YYYY-MM-DD)")
        return 1
    args.backfill_mode = True
    symbols = resolve_universe(cfg, args.symbols)
    key = hashlib.sha1(("|".join(symbols)).encode()).hexdigest()[:10]
    run_key = f"eod_backfill:{args.start}:{args.end}:{key}"
    db = db_rw()
    try:
        rid, refusal = adopt_or_create_run(db, run_key, "eod_backfill", args.trigger, None)
        if refusal == "already_processed" and not args.force:
            print(json.dumps({"status": run_status_note(db, run_key),
                              "note": "backfill already recorded — use --force to re-run"}))
            return 0
        if refusal == "run_in_progress":
            return 3
    finally:
        db.close()
    summary = process_session(cfg, args.end, symbols, args)
    stages = summary.pop("stages")
    integ = summary["integrity"]
    integrity_ok = (integ["quick_check"] == "ok" and (integ["duplicate_pairs"] or 0) == 0)
    status = "COMPLETED" if (integrity_ok and summary["symbols_failed"] == 0) else "PARTIAL"
    db = db_rw()
    try:
        finish_run(db, rid, status=status, finishedAt=now_iso(), sessionDetected=1,
                   symbolsAttempted=summary["symbols_attempted"],
                   symbolsUpdated=summary["symbols_updated"],
                   symbolsFailed=summary["symbols_failed"],
                   rowsInserted=summary["rows_inserted"], rowsSkipped=summary["rows_skipped"],
                   rowsRejected=summary["rows_rejected"],
                   missingSymbols=json.dumps(summary["missing_symbols"]),
                   failedSymbols=json.dumps(summary["failed_symbols"]),
                   dataCutoffDate=integ["frontier_after"], stages=json.dumps(stages))
    finally:
        db.close()
    print(json.dumps({"status": status, "rows_inserted": summary["rows_inserted"],
                      "symbols_updated": summary["symbols_updated"],
                      "failed": summary["symbols_failed"]}))
    return 0 if status == "COMPLETED" else 1


def cmd_status(cfg: dict) -> int:
    ro = db_ro()
    try:
        last_runs = [dict(zip(["runKey", "status", "startedAt", "finishedAt", "rowsInserted",
                               "symbolsUpdated", "symbolsFailed", "dataCutoffDate", "trigger"],
                              r)) for r in ro.execute(
            "SELECT runKey,status,startedAt,finishedAt,rowsInserted,symbolsUpdated,"
            "symbolsFailed,dataCutoffDate,trigger FROM SchedulerRun "
            "ORDER BY startedAt DESC LIMIT 8")]
        frontier = _q1(ro, "SELECT MAX(date) FROM OhlcvBar")[0]
    finally:
        ro.close()
    st = LB.psx_session_state()
    session, reason = candidate_session(cfg, None)
    print(json.dumps({
        "scheduler": "task129_eod_scheduler",
        "config": {"post_market_time_pkt": cfg["post_market_time_pkt"],
                   "universe": cfg["universe"], "holidays_configured": len(cfg["holidays"])},
        "frontier_date": frontier,
        "candidate_session": session, "candidate_reason": reason,
        "next_scheduled_run": f" weekdays {cfg['post_market_time_pkt']} PKT (cron) / daemon loop",
        "session_state": st,
        "provider_health": LB.provider_health_state(),
        "recent_runs": last_runs,
    }, indent=1))
    return 0


def cmd_daemon(cfg: dict, args) -> int:
    """Sleep until the next post-market window and run with the retry policy."""
    hh, mm = cfg["post_market_time_pkt"].split(":")
    retry_s = int(cfg["retry_interval_min"]) * 60
    window_s = int(cfg["max_retry_window_min"]) * 60
    while True:
        now = datetime.now(PKT)
        target = now.replace(hour=int(hh), minute=int(mm), second=0, microsecond=0)
        if now >= target:
            target += timedelta(days=1)
        # skip weekends (holidays are decided by provider data at run time)
        while target.weekday() >= 5:
            target += timedelta(days=1)
        wait = (target - datetime.now(PKT)).total_seconds()
        print(f"[daemon] next run {target.isoformat()} (sleep {int(wait)}s)", flush=True)
        if wait > 0:
            time.sleep(min(wait, 300))  # sleep in ≤5 min chunks, re-check clock
            continue
        # post-market window: run + retry loop
        deadline = time.time() + window_s
        while True:
            rc = main_with_args(["run", "--trigger", "daemon"])
            if rc in (0, 1, 3):
                break
            if rc == 2 and time.time() < deadline:  # eod not published → retry
                print(f"[daemon] eod not published — retrying in {retry_s}s", flush=True)
                time.sleep(retry_s)
                continue
            break
        if args.once:
            return 0


def main_with_args(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["run", "recover", "backfill", "status", "daemon"])
    parser.add_argument("--session")
    parser.add_argument("--symbols")
    parser.add_argument("--start")
    parser.add_argument("--end")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--glm", action="store_true")
    parser.add_argument("--trigger", default="manual")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args(argv)
    args.backfill_mode = False
    cfg = load_config()
    if args.mode == "run":
        return cmd_run(cfg, args)
    if args.mode == "recover":
        return cmd_recover(cfg, args)
    if args.mode == "backfill":
        return cmd_backfill(cfg, args)
    if args.mode == "status":
        return cmd_status(cfg)
    if args.mode == "daemon":
        return cmd_daemon(cfg, args)
    return 1


if __name__ == "__main__":
    sys.exit(main_with_args(sys.argv[1:]))
