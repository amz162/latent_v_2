"""Task 95 Phase 8 — prospective paper-trading: diagnose, ingest, process, monitor."""
import json
import sqlite3
import subprocess
import time
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task95"
DB = BASE / "db/custom.db"
PRIORITY = 30

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def sh(cmd, t=130):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=BASE, timeout=t)


def q(sql, args=()):
    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute(sql, args).fetchall()]
    conn.close()
    return rows


def state_snapshot():
    states = q("SELECT state, COUNT(*) n FROM ProspectivePaperTrade GROUP BY state")
    latest_ohlcv = q("""SELECT symbol, MAX(date) latest FROM OhlcvBar
                        WHERE symbol IN (SELECT DISTINCT symbol FROM ProspectivePaperTrade)
                        GROUP BY symbol""")
    pend_syms = q("""SELECT symbol, COUNT(*) n, MIN(state) FROM ProspectivePaperTrade
                     WHERE state='pending_entry' GROUP BY symbol ORDER BY n DESC""")
    earliest_pred = q("""SELECT MIN(CAST(p.predictionTs AS INTEGER)) earliest FROM ProspectivePaperTrade t
                        JOIN PredictionHistory p ON p.id = t.sourcePredictionId""")
    return {"states": states, "latest_ohlcv_by_symbol": latest_ohlcv,
            "pending_by_symbol": pend_syms, "earliest_prediction_ms": earliest_pred}


@reg("p8_prospective_diagnose")
def p8_prospective_diagnose(ctx):
    snap = state_snapshot()
    # compare latest ohlcv vs prediction dates per pending symbol
    ohlcv = {r["symbol"]: r["latest"] for r in snap["latest_ohlcv_by_symbol"]}
    diag = []
    for r in snap["pending_by_symbol"]:
        sym = r["symbol"]
        pred_ms = q("""SELECT MIN(CAST(p.predictionTs AS INTEGER)) ms FROM ProspectivePaperTrade t
                       JOIN PredictionHistory p ON p.id=t.sourcePredictionId
                       WHERE t.state='pending_entry' AND t.symbol=?""", (sym,))
        ms = (pred_ms[0]["ms"] if pred_ms and pred_ms[0]["ms"] else None)
        import datetime
        pred_date = datetime.datetime.utcfromtimestamp(ms / 1000).strftime("%Y-%m-%d") if ms else None
        diag.append({"symbol": sym, "pending_trades": r["n"], "latest_ohlcv": ohlcv.get(sym),
                     "earliest_pending_prediction_date": pred_date,
                     "ohlcv_covers_entry_window": bool(pred_date and ohlcv.get(sym) and ohlcv[sym] > pred_date)})
    blocked = [d for d in diag if not d["ohlcv_covers_entry_window"]]
    ctx.write("task95_prospective_integrity.json", {
        "task": "Task 95 Phase 8.1 — prospective pending-entry diagnosis (fresh DB state)",
        "state_distribution": snap["states"],
        "per_symbol_diagnosis": diag,
        "symbols_blocked_by_stale_ohlcv": [d["symbol"] for d in blocked],
        "cause": ("pending_entry is correct behavior: predictions post-date the last ingested OHLCV "
                  "session for these symbols; entries can only be created when a newer real session "
                  "is ingested — no fabrication"),
        "fix_attempted": "p8_ingest_recent_ohlcv fetches newer sessions from the psxdata API (bounded, idempotent)",
    })
    ctx.log(f"states: {snap['states']} | blocked symbols: {len(blocked)}")


@reg("p8_ingest_recent_ohlcv")
def p8_ingest_recent_ohlcv(ctx):
    r = sh("bun scripts/task95_ingest_ohlcv.ts", t=140)
    tail = r.stdout.strip().splitlines()[-6:] if r.stdout else []
    ctx.log("ingest: " + " | ".join(tail))
    if r.returncode != 0:
        raise RuntimeError(f"ingest failed: {r.stderr[-400:]}")
    (REPORTS / "batch_logs" / "p8_ingest_output.txt").write_text(r.stdout[-4000:])
    ctx.write("task95_ohlcv_ingestion.json", {
        "task": "Task 95 Phase 8 — incremental OHLCV ingestion for pending-trade symbols",
        "method": "scripts/task95_ingest_ohlcv.ts (psxdata API, new bars only, idempotent upsert)",
        "output_tail": tail,
        "note": "only real API sessions ingested; no simulated bars",
    })


@reg("p8_prospective_process")
def p8_prospective_process(ctx):
    before = {r["state"]: r["n"] for r in q("SELECT state, COUNT(*) n FROM ProspectivePaperTrade GROUP BY state")}
    t0 = time.time()
    r = sh("bun scripts/prospective_paper_trading.ts", t=140)
    took = round(time.time() - t0, 1)
    if r.returncode != 0:
        raise RuntimeError(f"lifecycle processor failed: {r.stderr[-500:]}")
    after = {r2["state"]: r2["n"] for r2 in q("SELECT state, COUNT(*) n FROM ProspectivePaperTrade GROUP BY state")}
    ctx.write("task95_prospective_processing.json", {
        "task": "Task 95 Phase 8.2 — run authoritative lifecycle processor (scripts/prospective_paper_trading.ts)",
        "seconds": took, "states_before": before, "states_after": after,
        "changes": {k: after.get(k, 0) - before.get(k, 0) for k in set(before) | set(after)},
        "processor_output_tail": r.stdout.strip().splitlines()[-10:],
        "honesty": "entries created only where a real next-session open exists in ingested OHLCV",
    })


@reg("p8_prospective_monitor")
def p8_prospective_monitor(ctx):
    snap = state_snapshot()
    outcomes = q("SELECT outcomeState, COUNT(*) n FROM ProspectivePaperTrade GROUP BY outcomeState") \
        if q("SELECT name FROM sqlite_master WHERE name='ProspectivePaperTrade'") else []
    try:
        outcomes = q("SELECT outcomeState, COUNT(*) n FROM ProspectivePaperTrade GROUP BY outcomeState")
    except Exception:
        outcomes = []
    closed = q("""SELECT COUNT(*) n, SUM(netPnl) net FROM ProspectivePaperTrade WHERE state='closed'""")
    ctx.write("task95_prospective_monitoring.json", {
        "task": "Task 95 Phase 8.3 — prospective monitoring report",
        "state_distribution": snap["states"],
        "outcome_distribution": outcomes,
        "closed_summary": closed,
        "latest_ohlcv_by_symbol": snap["latest_ohlcv_by_symbol"],
        "pending_by_symbol": snap["pending_by_symbol"],
        "rule": "pending entries are NEVER displayed as executed trades; profitability claims require matured closed trades",
    })
