#!/usr/bin/env python3
"""task123_reconciliation_csv.py — build reports/operations/task123_lifecycle_reconciliation.csv
from the live ledger: one row per ProspectivePaperTrade with IDs, fills, exits, costs, P&L,
win label, MTM; plus outcome maturity breakdown by horizon."""
import sqlite3, json, csv, os

R = "/home/z/my-project/repo_latent_v_2"
OUTD = f"{R}/reports/operations"
os.makedirs(OUTD, exist_ok=True)
con = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()

rows = []
trades = cur.execute(
    "SELECT id, sourcePredictionId, strategyId, policyVersion, bookId, modelId, horizon, symbol, "
    "state, direction, entryDate, entryPrice, quantity, allocatedCash, sl, tp1, tp2, tp3, "
    "activeStopFinal, exitReason, grossPnl, totalCosts, netPnl, isWin, isDemo, skipReason, "
    "createdAt, updatedAt FROM ProspectivePaperTrade ORDER BY bookId, symbol").fetchall()
for (tid, spid, strat, pol, book, model, h, sym, state, direction, ed, ep, q, cash,
     sl, tp1, tp2, tp3, asf, xr, gp, tc, np_, win, demo, skip, created, updated) in trades:
    legs = cur.execute(
        "SELECT legIdx, exitDate, exitPrice, exitReason, quantity, netPnl FROM PaperTradeLeg "
        "WHERE tradeId=? ORDER BY legIdx", (tid,)).fetchall()
    legstr = "; ".join(f"leg{l[0]}:{l[1]}@{l[2]}({l[3]},qty{l[4]},net{l[5]:.2f})" for l in legs) if legs else ""
    # MTM for open
    mtm = ""
    if state == "open" and ed and ep and q:
        last = cur.execute("SELECT date, close FROM OhlcvBar WHERE symbol=? ORDER BY date DESC LIMIT 1", (sym,)).fetchone()
        if last:
            mtm = f"{last[0]} close {last[1]} -> MTM {q*(last[1]-ep):.2f}"
    rows.append({
        "tradeId": tid, "sourcePredictionId": spid, "bookId": book, "modelId": model,
        "horizonSessions": h, "strategyId": strat, "policyVersion": pol,
        "symbol": sym, "direction": direction, "state": state,
        "entryDate": ed or "", "entryPrice": ep or "", "quantity": q or "",
        "allocatedCash": cash or "", "sl": sl, "tp1": tp1, "tp2": tp2, "tp3": tp3,
        "activeStopFinal": asf, "exitReason": xr or "",
        "grossPnl": gp if gp is not None else "", "totalCosts": tc if tc is not None else "",
        "netPnl": np_ if np_ is not None else "", "isWin": win if win is not None else "",
        "isDemo": demo, "skipReason": skip or "",
        "legs": legstr, "openMTM": mtm, "createdAtEpoch": created, "updatedAtEpoch": updated})

with open(f"{OUTD}/task123_lifecycle_reconciliation.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

# outcome maturity breakdown by horizon
ob = {}
for h, st, n in cur.execute(
        "SELECT ph.horizon, po.outcomeStatus, COUNT(*) FROM PredictionOutcome po "
        "JOIN PredictionHistory ph ON ph.id=po.predictionId GROUP BY ph.horizon, po.outcomeStatus"):
    ob.setdefault(str(h), {})[st] = n
pending_syms = cur.execute(
    "SELECT ph.symbol, ph.horizon, COUNT(*) FROM PredictionOutcome po "
    "JOIN PredictionHistory ph ON ph.id=po.predictionId WHERE po.outcomeStatus='pending' "
    "GROUP BY ph.symbol, ph.horizon ORDER BY ph.symbol").fetchall()
summary = {"by_horizon": ob,
           "pending_by_symbol_horizon": {f"{s}:{h}": n for s, h, n in pending_syms}}
json.dump(summary, open(f"{OUTD}/task123_outcome_maturity_breakdown.json", "w"), indent=1)
print(f"rows={len(rows)} → {OUTD}/task123_lifecycle_reconciliation.csv")
print("outcome maturity by horizon:", json.dumps(ob))
pend = summary["pending_by_symbol_horizon"]
from collections import Counter
hc = Counter()
for k, n in pend.items():
    hc[k.split(':')[1]] += n
print("pending outcomes by horizon:", dict(hc))
print("pending outcome symbols:", sorted(set(k.split(':')[0] for k in pend)))
