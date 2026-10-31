"""Task 97 Phases 6-7 — prospective session check, monitoring hook, performance, thresholds."""
import datetime
import json
import math
import sqlite3
import subprocess
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task97"
T96 = BASE / "data/backtest_reports/task96"
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


@reg("p6_session_check")
def p6_session_check(ctx):
    latest_db = q("SELECT MAX(date) m FROM OhlcvBar WHERE symbol NOT IN ('BYCO','ENGRO')")[0]["m"]
    pend_syms = [r["symbol"] for r in q(
        "SELECT DISTINCT symbol FROM ProspectivePaperTrade WHERE state='pending_entry' AND bookId LIKE '%legacy%'")]
    dupes = q("""SELECT symbol, date, COUNT(*) n FROM OhlcvBar GROUP BY symbol, date HAVING n > 1 LIMIT 5""")
    invalid = q("""SELECT symbol, date FROM OhlcvBar
                   WHERE high < low OR close <= 0 OR open <= 0 OR high <= 0 OR low <= 0 LIMIT 5""")
    gaps = []
    for r in q("""SELECT DISTINCT symbol FROM ProspectivePaperTrade WHERE state IN ('open','pending_entry')
                  AND bookId LIKE '%legacy%' LIMIT 10"""):
        last2 = q("SELECT date FROM OhlcvBar WHERE symbol=? ORDER BY date DESC LIMIT 2", (r["symbol"],))
        if len(last2) == 2:
            d1 = datetime.date.fromisoformat(last2[0]["date"])
            d0 = datetime.date.fromisoformat(last2[1]["date"])
            if (d1 - d0).days > 7:
                gaps.append({"symbol": r["symbol"], "gap_days": (d1 - d0).days})
    ctx.write("task97_prospective_session_report.json", {
        "task": "Task 97 Section 6B — actual OHLCV freshness and validity (active symbols)",
        "latest_real_session_excl_dead_symbols": latest_db,
        "today_utc": datetime.datetime.utcnow().strftime("%Y-%m-%d %A"),
        "pending_symbols": pend_syms,
        "duplicate_candles": dupes,
        "invalid_bars": invalid,
        "stale_symbol_gaps_over_7d": gaps,
        "note": ("next expected session Monday 2026-11-02; no session assumed without ingestion — "
                 "the monitoring hook processes whatever the refresh genuinely delivers"),
    })


@reg("p6_monitoring_hook")
def p6_monitoring_hook(ctx):
    """Finalize the post-refresh hook: OHLCV refresh -> prospective processor -> monitoring report."""
    hook = BASE / ".zscripts/ohlcv-refresh-and-process.sh"
    hook.write_text("""#!/bin/bash
# ohlcv-refresh-and-process.sh — Task 97 Section 7 monitoring hook.
# Runs the REAL OHLCV refresh, then the prospective processor on whatever the
# refresh genuinely delivered (no fabricated sessions), then writes a
# monitoring report. Idempotent: the processor refuses duplicate fills and
# re-running on the same session changes nothing.
set -uo pipefail
cd /home/z/my-project
LOG=/home/z/my-project/data/backtest_reports/task97/batch_logs/monitoring-hook.log
ts() { date -Iseconds; }
echo "[$(ts)] refresh start" >> "$LOG"

# 1. Real incremental OHLCV refresh (existing project procedure)
if [ -f scripts/task95_ingest_ohlcv.ts ]; then
  bun scripts/task95_ingest_ohlcv.ts >> "$LOG" 2>&1 || echo "[$(ts)] WARN refresh rc!=0" >> "$LOG"
fi

# 2. Prospective processor on the refreshed data
bun scripts/prospective_paper_trading.ts >> "$LOG" 2>&1 \
  || echo "[$(ts)] WARN processor rc!=0" >> "$LOG"

# 3. Monitoring snapshot (state counts + latest session)
bun -e '
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const byState = await db.prospectivePaperTrade.groupBy({ by: ["state"], _count: true });
const latest = await db.ohlcvBar.aggregate({ _max: { date: true } });
const fs = await import("fs");
fs.writeFileSync("data/backtest_reports/task97/batch_logs/monitoring-latest.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  states: Object.fromEntries(byState.map(s => [s.state, s._count])),
  latestOhlcvSession: latest._max.date,
}, null, 1));
await db.$disconnect();
' >> "$LOG" 2>&1 || echo "[$(ts)] WARN snapshot rc!=0" >> "$LOG"
echo "[$(ts)] hook complete" >> "$LOG"
""")
    subprocess.run(["chmod", "+x", str(hook)], check=True)
    # execute the hook once now (idempotent; no new session expected today)
    r = subprocess.run(["bash", str(hook)], capture_output=True, text=True, cwd=BASE, timeout=140)
    snap = {}
    sp = BASE / "data/backtest_reports/task97/batch_logs/monitoring-latest.json"
    if sp.exists():
        snap = json.loads(sp.read_text())
    before = {x["state"]: x["n"] for x in q(
        "SELECT state, COUNT(*) n FROM ProspectivePaperTrade WHERE bookId LIKE '%legacy%' GROUP BY state")}
    ctx.write("task97_prospective_monitoring.json", {
        "task": "Task 97 Section 7 — prospective daily monitoring mechanism",
        "hook": {"/": "runs after the real OHLCV refresh in the daily lifecycle",
                 "path": str(hook), "executed_now": True, "rc": r.returncode,
                 "idempotent": "processor refuses duplicate fills; re-run on same session is a no-op"},
        "snapshot_after_hook": snap,
        "active_generation_states": before,
        "alerts": {"stale_symbols": [g for g in (json.loads(
            (REPORTS / "task97_prospective_session_report.json").read_text()
        ).get("stale_symbol_gaps_over_7d", []))],
                   "ingestion_failure_alerting": "hook logs WARN lines on nonzero rc (batch_logs/monitoring-hook.log)"},
        "paper_mode": "system remains in paper/shadow mode; hook only records evidence",
    })


@reg("p6_prospective_performance")
def p6_prospective_performance(ctx):
    trades = q("""SELECT id, symbol, strategyId, bookId, modelId, horizon, state, entryDate, entryPrice,
                  quantity, allocatedCash, exitReason, grossPnl, totalCosts, netPnl, isWin
                  FROM ProspectivePaperTrade WHERE bookId LIKE '%legacy%' ORDER BY entryDate""")
    closed = [t for t in trades if t["state"] == "closed"]
    open_t = [t for t in trades if t["state"] == "open"]
    pending = [t for t in trades if t["state"] == "pending_entry"]
    n = len(closed)
    wins = [t for t in closed if t["isWin"]]
    gross = sum(t["grossPnl"] or 0 for t in closed)
    costs = sum(t["totalCosts"] or 0 for t in closed)
    net = sum(t["netPnl"] or 0 for t in closed)
    pf = None
    if wins and any(not t["isWin"] for t in closed):
        pf = sum(t["netPnl"] for t in wins) / abs(sum(t["netPnl"] for t in closed if not t["isWin"]))
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
    t96perf = json.loads((T96 / "task96_prospective_performance.json").read_text())
    ctx.write("task97_prospective_performance.json", {
        "task": "Task 97 Section 6/7 — prospective performance evidence (final closure state)",
        "cohort": {"total_active": len(trades), "fills": len(open_t) + n, "open": len(open_t),
                   "closed": n, "pending_entry": len(pending),
                   "pending_symbols": sorted(set(t["symbol"] for t in pending)),
                   "superseded_separate": True},
        "closed_performance": {
            "n": n, "wins": len(wins), "win_rate": round(wr, 4) if wr is not None else None,
            "win_rate_ci95_wilson": ci,
            "gross_pnl_pkr": round(gross, 2), "costs_pkr": round(costs, 2), "net_pnl_pkr": round(net, 2),
            "profit_factor": round(pf, 4) if pf else None,
            "max_drawdown_pkr": round(mdd, 2),
            "identity_gross_minus_costs_eq_net": abs(gross - costs - net) < 1.0,
            "task96_loss_unchanged": abs(net - t96perf["closed_performance"]["net_pnl_pkr"]) < 1.0,
            "evidence": "all closed trades remain in the record; nothing reset or hidden",
        },
        "open_exposure_pkr": round(sum((t["allocatedCash"] or 0) for t in open_t), 2),
        "matured_outcomes": n,
        "production_decision": "paper/shadow mode — see task97_paper_mode_thresholds.json",
        "comparison_historical_variant_b": "kept fully separate; historical backtests are not live evidence",
    })


@reg("p6_paper_mode_thresholds")
def p6_paper_mode_thresholds(ctx):
    ctx.write("task97_paper_mode_thresholds.json", {
        "task": "Task 97 Section 7 — conservative paper-to-production promotion thresholds",
        "current_evidence": "18 closed trades, all losses, net ≈ -108,188 PKR — promotion NOT justified",
        "thresholds_all_required": {
            "min_matured_trades": 100,
            "independent_periods": ">= 2 distinct calendar quarters with positive net expectancy in each",
            "net_expectancy": "mean net P&L per trade > 0 after PSX V2 costs, bootstrap 95% CI excluding zero",
            "max_drawdown": "cumulative net drawdown no worse than -15% of peak allocated capital",
            "symbol_coverage": ">= 10 symbols with >= 3 matured trades each; no single symbol > 35% of net P&L",
            "regime_stability": "positive expectancy in both up- and down-trending PSX sub-periods",
            "no_single_winner": "removing the best single trade must not flip aggregate expectancy negative",
        },
        "monitoring_source": ".zscripts/ohlcv-refresh-and-process.sh (daily, idempotent, after real refresh)",
        "decision_owner": "the user; the agent never promotes autonomously",
    })
