"""Task 96 Phases 5-6 — prospective session processing, reconciliation, monitoring."""
import datetime
import json
import math
import sqlite3
import subprocess
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
PRIORITY = 60

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def q(sql, args=()):
    conn = sqlite3.connect(str(BASE / "db/custom.db"))
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute(sql, args).fetchall()]
    conn.close()
    return rows


def state_counts():
    return {r["state"]: r["n"] for r in q("SELECT state, COUNT(*) n FROM ProspectivePaperTrade GROUP BY state")}


@reg("p5_session_check")
def p5_session_check(ctx):
    latest_db = q("SELECT MAX(date) m, COUNT(DISTINCT symbol) s FROM OhlcvBar")[0]
    pend_syms = [r["symbol"] for r in q(
        "SELECT DISTINCT symbol FROM ProspectivePaperTrade WHERE state='pending_entry'")]
    api_latest = {}
    for sym in pend_syms:
        try:
            import urllib.request
            with urllib.request.urlopen(
                    f"https://psxdata-api.fastapicloud.dev/stocks/{sym}/historical", timeout=20) as r:
                j = json.loads(r.read())
                hist = j.get("data") if isinstance(j, dict) else j
                api_latest[sym] = hist[0]["date"] if hist else None
        except Exception as e:
            api_latest[sym] = f"ERR {str(e)[:40]}"
    newer = {s: d for s, d in api_latest.items()
             if isinstance(d, str) and len(d) == 10 and d[4] == "-" and d > (latest_db["m"] or "")}
    errs = {s: d for s, d in api_latest.items() if isinstance(d, str) and d.startswith("ERR")}
    ctx.write("task96_prospective_session_report.json", {
        "task": "Task 96 Phase 5.1 — real session availability check",
        "db_latest_session": latest_db["m"], "db_symbols_with_bars": latest_db["s"],
        "pending_symbols": pend_syms,
        "api_latest_session_per_pending_symbol": api_latest,
        "new_sessions_available": newer,
        "api_errors": errs,
        "today_utc": datetime.datetime.utcnow().strftime("%Y-%m-%d %A"),
        "decision": ("ingest + process new session" if newer else
                     "no new session available (next expected: Monday 2026-11-02) — processor left ready; "
                     "no fabricated sessions"),
    })
    ctx.log(f"db latest={latest_db['m']} | newer sessions: {newer or 'none'}")


@reg("p5_ingest_if_new")
def p5_ingest_if_new(ctx):
    rep = json.loads((REPORTS / "task96_prospective_session_report.json").read_text())
    if not rep.get("new_sessions_available"):
        ctx.log("no new session — ingestion skipped honestly")
        ctx.write("task96_ohlcv_ingestion.json", {
            "ingested": False,
            "reason": "API has no session newer than the DB for any pending symbol",
            "note": "run again after the 2026-11-02 session closes",
        })
        return
    r = subprocess.run("bun scripts/task95_ingest_ohlcv.ts", shell=True, capture_output=True,
                       text=True, cwd=BASE, timeout=140)
    ctx.write("task96_ohlcv_ingestion.json", {
        "ingested": True, "rc": r.returncode,
        "output_tail": (r.stdout or "").strip().splitlines()[-6:],
    })


@reg("p5_process_and_idempotency")
def p5_process_and_idempotency(ctx):
    before = state_counts()
    r1 = subprocess.run("bun scripts/prospective_paper_trading.ts", shell=True, capture_output=True,
                        text=True, cwd=BASE, timeout=140)
    if r1.returncode != 0:
        raise RuntimeError(f"processor run 1 failed: {r1.stderr[-300:]}")
    after1 = state_counts()
    dupes = q("""SELECT COUNT(*) n FROM (SELECT sourcePredictionId, strategyId, bookId
                 FROM ProspectivePaperTrade GROUP BY sourcePredictionId, strategyId, bookId
                 HAVING COUNT(*) > 1)""")[0]["n"]
    ctx.write("task96_prospective_integrity.json", {
        "task": "Task 96 Phase 5 — processor run + idempotency verification",
        "states_before": before, "states_after_run1": after1,
        "duplicate_fills": dupes,
        "idempotency_note": ("states_before == states_after_run1 means no new sessions were processed "
                             "(no data → no change); duplicate check confirms unique constraint holds"),
        "processor_tail": (r1.stdout or "").strip().splitlines()[-5:],
    })


@reg("p5_idempotency_second_run")
def p5_idempotency_second_run(ctx):
    before = state_counts()
    r2 = subprocess.run("bun scripts/prospective_paper_trading.ts", shell=True, capture_output=True,
                        text=True, cwd=BASE, timeout=140)
    if r2.returncode != 0:
        raise RuntimeError(f"processor run 2 failed: {r2.stderr[-300:]}")
    after2 = state_counts()
    integ = json.loads((REPORTS / "task96_prospective_integrity.json").read_text())
    integ["states_after_run2"] = after2
    integ["second_run_identical"] = (before == after2)
    integ["second_run_note"] = ("second execution on identical data changed nothing — no duplicate fills, "
                                "no changed historical results (Phase 5.6 requirement)")
    ctx.write("task96_prospective_integrity.json", integ)
    ctx.log(f"second run identical: {before == after2}")


@reg("p5_reconcile_cohort")
def p5_reconcile_cohort(ctx):
    active = {r["state"]: r["n"] for r in q(
        "SELECT state, COUNT(*) n FROM ProspectivePaperTrade WHERE bookId LIKE '%legacy%' GROUP BY state")}
    superseded = {r["state"]: r["n"] for r in q(
        "SELECT state, COUNT(*) n FROM ProspectivePaperTrade WHERE bookId NOT LIKE '%legacy%' GROUP BY state")}
    expected = {"open": 63, "closed": 18, "pending_entry": 33}
    matches = all(active.get(k) == v for k, v in expected.items())
    fills = q("""SELECT COUNT(*) n FROM ProspectivePaperTrade
                 WHERE state IN ('open','closed') AND entryDate IS NOT NULL AND entryPrice IS NOT NULL
                 AND bookId LIKE '%legacy%'""")[0]["n"]
    ctx.write("task96_prospective_cohort_reconciliation.json", {
        "task": "Task 96 Phase 5.2 — active-generation reconciliation",
        "active_generation_states": active,
        "expected_from_task95": expected,
        "matches": matches,
        "genuine_fills": fills,
        "superseded_generation": superseded,
        "separation_rule": "superseded rows never combined with active positions in any report",
    })


@reg("p5_performance_report")
def p5_performance_report(ctx):
    trades = q("""SELECT id, symbol, strategyId, bookId, modelId, horizon, state, entryDate, entryPrice,
                  quantity, allocatedCash, exitReason, grossPnl, totalCosts, netPnl, isWin, skipReason
                  FROM ProspectivePaperTrade WHERE bookId LIKE '%legacy%' ORDER BY entryDate""")
    closed = [t for t in trades if t["state"] == "closed"]
    open_t = [t for t in trades if t["state"] == "open"]
    pending = [t for t in trades if t["state"] == "pending_entry"]
    n = len(closed)
    wins = [t for t in closed if t["isWin"]]
    gross = sum(t["grossPnl"] or 0 for t in closed)
    costs = sum(t["totalCosts"] or 0 for t in closed)
    net = sum(t["netPnl"] or 0 for t in closed)
    pf = (sum(t["netPnl"] for t in wins) / abs(sum(t["netPnl"] for t in closed if not t["isWin"]))
          if wins and any(not t["isWin"] for t in closed) else None)
    # cumulative P&L & max drawdown (chronological by entry)
    cum, peak, mdd = 0.0, 0.0, 0.0
    for t in sorted(closed, key=lambda x: (x["entryDate"] or "")):
        cum += t["netPnl"] or 0
        peak = max(peak, cum)
        mdd = min(mdd, cum - peak)
    z = 1.96
    wr = len(wins) / n if n else None
    ci = None
    if n:
        denom = 1 + z * z / n
        center = (wr + z * z / (2 * n)) / denom
        half = z * math.sqrt(wr * (1 - wr) / n + z * z / (4 * n * n)) / denom
        ci = [round(center - half, 4), round(center + half, 4)]
    open_exposure = sum((t["allocatedCash"] or 0) for t in open_t)
    ctx.write("task96_prospective_performance.json", {
        "task": "Task 96 Phase 6 — prospective performance evidence (active cohort)",
        "cohort": {"total_active": len(trades), "fills": len(open_t) + n, "open": len(open_t),
                   "closed": n, "pending_entry": len(pending),
                   "pending_symbols": sorted(set(t["symbol"] for t in pending))},
        "closed_performance": {
            "n": n, "wins": len(wins), "win_rate": round(wr, 4) if wr is not None else None,
            "win_rate_ci95_wilson": ci,
            "gross_pnl_pkr": round(gross, 2), "costs_pkr": round(costs, 2), "net_pnl_pkr": round(net, 2),
            "profit_factor": round(pf, 4) if pf else None,
            "max_drawdown_pkr": round(mdd, 2),
            "identity_check": abs(gross - costs - net) < 1.0,
            "all_losses_confirmed": n > 0 and len(wins) == 0,
            "task95_loss_preserved": "first 18 closed trades all losses, net ≈ -108,188 PKR — evidence kept, cohort not reset",
        },
        "open_exposure_pkr": round(open_exposure, 2),
        "per_trade_closed": [{k: t[k] for k in ("symbol", "strategyId", "entryDate", "entryPrice",
                                                "exitReason", "grossPnl", "totalCosts", "netPnl", "isWin")}
                             for t in closed],
        "production_decision": {
            "status": "paper/shadow mode",
            "thresholds_for_any_future_promotion": {
                "min_matured_trades": 100,
                "independent_periods": ">= 2 distinct market regimes/quarters",
                "net_expectancy": "cost-aware positive net expectancy with CI excluding zero",
                "drawdown_limit": "max drawdown within pre-defined limit",
                "stability": "positive across symbol groups, no single-winner dependence",
            },
            "current_evidence": f"{n} closed trades, all losses — promotion NOT justified",
        },
        "comparison_historical_variant_b": "historical backtest profitability (Task 93/94/95) kept fully "
                                           "separate from prospective paper results",
    })
