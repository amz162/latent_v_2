#!/usr/bin/env python3
"""task123_lifecycle_verify.py — ledger integrity checks on a lifecycle-processed DB (read-only).
Verifies: exit reasons, cost math, win labels, fills against real bars, MTM, outcomes."""
import sqlite3, json, sys

DB = sys.argv[1] if len(sys.argv) > 1 else "db/backups/custom.db.task123-lifecycle-test"
con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
cur = con.cursor()
R = {"report": "task123_lifecycle_verification", "db": DB}

R["states"] = dict(cur.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state"))
R["exit_reasons"] = dict(cur.execute(
    "SELECT COALESCE(exitReason,'(none)'), COUNT(*) FROM ProspectivePaperTrade GROUP BY exitReason"))
R["leg_exit_reasons"] = dict(cur.execute(
    "SELECT exitReason, COUNT(*) FROM PaperTradeLeg GROUP BY exitReason"))

# cost math on closed trades: net = gross - costs
bad = cur.execute(
    "SELECT COUNT(*) FROM ProspectivePaperTrade WHERE state='closed' AND "
    "ABS(COALESCE(grossPnl,0) - COALESCE(totalCosts,0) - COALESCE(netPnl,0)) > 0.01").fetchone()[0]
R["net_identity_violations"] = bad

# win labels
misl = cur.execute(
    "SELECT COUNT(*) FROM ProspectivePaperTrade WHERE state='closed' AND "
    "((netPnl > 0 AND isWin != 1) OR (netPnl < 0 AND isWin != 0))").fetchone()[0]
R["win_label_violations"] = misl
row = cur.execute(
    "SELECT SUM(grossPnl), SUM(totalCosts), SUM(netPnl), AVG(netPnl), SUM(isWin), COUNT(*) "
    "FROM ProspectivePaperTrade WHERE state='closed'").fetchone()
R["realized"] = {"grossPnl": row[0], "totalCosts": row[1], "netPnl": row[2],
                 "avgNetPerTrade": row[3], "wins": row[4], "n": row[5]}

# fills against REAL bars: every closed/open trade entry (symbol, entryDate) must exist in OhlcvBar
missing = 0
for sym, ed, ep in cur.execute(
        "SELECT symbol, entryDate, entryPrice FROM ProspectivePaperTrade WHERE entryDate IS NOT NULL"):
    row = cur.execute("SELECT open FROM OhlcvBar WHERE symbol=? AND date=?", (sym, ed)).fetchone()
    if row is None or abs(row[0] - ep) > 1e-9:
        missing += 1
R["entry_fills_not_matching_real_bar_open"] = missing

# exit legs against real bars
bad_leg = 0
for tid, xd, xp in cur.execute("SELECT tradeId, exitDate, exitPrice FROM PaperTradeLeg"):
    sym = cur.execute("SELECT symbol FROM ProspectivePaperTrade WHERE id=?", (tid,)).fetchone()[0]
    row = cur.execute(
        "SELECT 1 FROM OhlcvBar WHERE symbol=? AND date=? AND (high>=? OR low>=?) AND close IS NOT NULL",
        (sym, xd, xp, xp)).fetchone()
    if row is None:
        bad_leg += 1
R["leg_exits_without_matching_session_bar"] = bad_leg

# open position MTM
op = cur.execute(
    "SELECT symbol, entryDate, entryPrice, quantity, horizon FROM ProspectivePaperTrade WHERE state='open'").fetchall()
mtm = []
for sym, ed, ep, q, h in op:
    last = cur.execute(
        "SELECT date, close FROM OhlcvBar WHERE symbol=? ORDER BY date DESC LIMIT 1", (sym,)).fetchone()
    mtm.append({"symbol": sym, "entryDate": ed, "entryPrice": ep, "quantity": q,
                "lastBar": last[0], "lastClose": last[1],
                "mtmPnl": round(q * (last[1] - ep), 2) if last else None})
R["open_positions_mtm"] = mtm

# pending leftovers (should be ENGRO/BYCO provider-gap cohort)
R["pending_symbols"] = dict(cur.execute(
    "SELECT symbol, COUNT(*) FROM ProspectivePaperTrade WHERE state='pending_entry' GROUP BY symbol"))

# outcomes matured must carry real observed closes
R["outcomes"] = dict(cur.execute("SELECT outcomeStatus, COUNT(*) FROM PredictionOutcome GROUP BY outcomeStatus"))
bad_obs = cur.execute(
    "SELECT COUNT(*) FROM PredictionOutcome WHERE outcomeStatus='matured' AND observedClose IS NULL").fetchone()[0]
R["matured_without_observed_close"] = bad_obs
obs_ok = cur.execute(
    "SELECT COUNT(*) FROM PredictionOutcome po JOIN OhlcvBar b ON b.symbol=(SELECT symbol FROM PredictionHistory ph WHERE ph.id=po.predictionId) "
    "AND b.date=po.targetDate WHERE po.outcomeStatus='matured'").fetchone()[0]
R["matured_observed_close_matching_bar"] = obs_ok

print(json.dumps(R, indent=1))
json.dump(R, open("data/backtest_reports/task123_lifecycle_verification.json", "w"), indent=1)
print("saved → data/backtest_reports/task123_lifecycle_verification.json")
