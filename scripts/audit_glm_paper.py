#!/usr/bin/env python3
"""audit_glm_paper.py — Phase 4 (GLM deep dive) + Phase 5 (paper-trading reconciliation).
Read-only. Writes:
  reports/audit/glm_records_table.csv
  reports/audit/paper_trading_reconciliation.csv
(Restored after workspace recycle; reflects the post-Task-123 ledger state.)"""
import json, os, glob, collections, csv, sqlite3, datetime

R = "/home/z/my-project/repo_latent_v_2"
BR = f"{R}/data/backtest_reports"
OUTD = f"{R}/reports/audit"
os.makedirs(OUTD, exist_ok=True)

# ── Phase 4: GLM per-record deep dive ────────────────────────────────────────
files = sorted(glob.glob(f"{BR}/task112/llm_signal_history/*.json"))
rows = []
for p in files:
    g = json.load(open(p))
    rr = g.get("riskReward") or {}
    rows.append({
        "signalId": g["signalId"], "symbol": g["symbol"],
        "recordType": g.get("recordType"), "decision": g.get("decision"),
        "validationStatus": g.get("validationStatus"),
        "rejectionReason": g.get("rejectionReason") or "",
        "researchStatus": g.get("researchStatus"),
        "decisionTimestamp": g.get("decisionTimestamp"),
        "dataCutoff": g.get("dataCutoff"),
        "conviction": g.get("llmConvictionScore"),
        "evidenceQualityScore": g.get("evidenceQualityScore"),
        "calibratedProb": g.get("calibratedNetPositiveProbability"),
        "provider": g.get("provider"), "model": g.get("model"),
        "promptVersion": g.get("promptVersion"),
        "entryRef": rr.get("entryReference"), "stopLoss": rr.get("stopLoss"),
        "tp1": (rr.get("targets") or {}).get("tp1"),
        "tp2": (rr.get("targets") or {}).get("tp2"),
        "tp3": (rr.get("targets") or {}).get("tp3"),
        "riskPolicy": rr.get("riskPolicyId"),
        "forwardCohortId": g.get("forwardCohortId") or "",
        "evidenceHash": g.get("evidenceHash") or "",
        "finalSignalReason": (g.get("finalSignalReason") or "")[:400]})
with open(f"{OUTD}/glm_records_table.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

real = [r for r in rows if r["recordType"] == "REAL_LLM_DECISION"]
mock = [r for r in rows if r["recordType"] != "REAL_LLM_DECISION"]
combos = collections.defaultdict(list)
for r in real:
    combos[(r["symbol"], r["dataCutoff"])].append(r)
pair_sizes = collections.Counter(len(v) for v in combos.values())
print("== GLM deep dive ==")
print(f"files={len(rows)} real={len(real)} mock={len(mock)}")
print(f"unique (symbol,cutoff) real combos={len(combos)} combo-size-dist={dict(pair_sizes)}")
dup_syms = {k: [x['signalId'][-8:] for x in v] for k, v in combos.items() if len(v) > 1}
print(f"duplicate pairs (combo with >1 real): {len(dup_syms)}")
rejected_real = [r for r in real if r["validationStatus"] != "valid"]
print(f"rejected REAL: {[(r['symbol'], r['validationStatus'], r['rejectionReason'][:40]) for r in rejected_real]}")
buys = [r for r in real if r["decision"] == "BUY"]
print(f"BUY records ({len(buys)}):")
for r in buys:
    print(f"  {r['symbol']} conv={r['conviction']} eq={r['evidenceQualityScore']} entry={r['entryRef']} SL={r['stopLoss']} tp1/2/3={r['tp1']}/{r['tp2']}/{r['tp3']} {r['decisionTimestamp']}")
holds = [r for r in real if r["decision"] == "HOLD"]
print(f"HOLD symbols: {[r['symbol'] for r in holds]}")
eqs = [r["evidenceQualityScore"] for r in real if r["evidenceQualityScore"] is not None]
print(f"evidenceQualityScore: n={len(eqs)} min={min(eqs)} max={max(eqs)} mean={sum(eqs)/len(eqs):.1f}")
convs = [r["conviction"] for r in real if r["conviction"] is not None]
print(f"conviction: n={len(convs)} min={min(convs)} max={max(convs)} mean={sum(convs)/len(convs):.1f}")
print(f"unique dataCutoffs: {sorted(set(r['dataCutoff'] for r in real))}")
ts = sorted(r["decisionTimestamp"] for r in rows)
print(f"generation window: {ts[0]} → {ts[-1]}")
ec = json.load(open(f"{BR}/task112/task112_llm_evidence_contribution_audit.json"))
print("store-side evidence contribution (all-zero):", json.dumps(ec.get("contribution", {}))[:200])

# ── Phase 5: paper-trading reconciliation (current ledger) ───────────────────
con = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
cols = [r[1] for r in cur.execute("PRAGMA table_info(ProspectivePaperTrade)").fetchall()]
ppt_rows = cur.execute("SELECT * FROM ProspectivePaperTrade").fetchall()
ppt = [dict(zip(cols, r)) for r in ppt_rows]
recon_rows = []
state_ct = collections.Counter(); model_ct = collections.Counter()
strat_ct = collections.Counter(); book_ct = collections.Counter()
dup_source = collections.Counter(p["sourcePredictionId"] for p in ppt)
for p in ppt:
    state_ct[p["state"]] += 1; model_ct[p["modelId"]] += 1
    strat_ct[p["strategyId"]] += 1; book_ct[p["bookId"]] += 1
    recon_rows.append({
        "tradeId": p["id"], "sourcePredictionId": p["sourcePredictionId"],
        "dupSourcePrediction": dup_source[p["sourcePredictionId"]] > 1,
        "modelId": p["modelId"], "strategyId": p["strategyId"], "bookId": p["bookId"],
        "symbol": p["symbol"], "horizon": p["horizon"], "state": p["state"],
        "direction": p["direction"], "entryDate": p["entryDate"],
        "entryPrice": p["entryPrice"], "quantity": p["quantity"],
        "allocatedCash": p["allocatedCash"], "sl": p["sl"],
        "isWin": p["isWin"], "grossPnl": p["grossPnl"], "totalCosts": p["totalCosts"],
        "netPnl": p["netPnl"], "isDemo": p["isDemo"],
        "skipReason": p["skipReason"] or "",
        "createdAt": p["createdAt"]})
with open(f"{OUTD}/paper_trading_reconciliation.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(recon_rows[0].keys()))
    w.writeheader(); w.writerows(recon_rows)
print("== Paper-trading reconciliation (live DB ledger) ==")
print(f"rows={len(ppt)} states={dict(state_ct)} models={dict(model_ct)}")
print(f"strategies={dict(strat_ct)}")
created = sorted(str(p["createdAt"]) for p in ppt)
print(f"createdAt range: {created[0]} → {created[-1]}")
ph = cur.execute("SELECT COUNT(*), COUNT(DISTINCT dedupKey), MIN(dataCutoff), MAX(dataCutoff) FROM PredictionHistory").fetchone()
print(f"PredictionHistory n={ph[0]} distinctDedupKeys={ph[1]} dataCutoff {ph[2]}→{ph[3]}")
sig_ct = dict(cur.execute("SELECT signal, COUNT(*) FROM PredictionHistory GROUP BY signal"))
print(f"signals={sig_ct}")
legs = cur.execute("SELECT COUNT(*) FROM PaperTradeLeg").fetchone()[0]
print(f"PaperTradeLeg rows={legs}")
glm_db = cur.execute("SELECT COUNT(*) FROM ProspectivePaperTrade WHERE modelId LIKE '%GLM%' OR modelId LIKE '%glm%'").fetchone()[0]
print(f"GLM-attributed rows in ProspectivePaperTrade: {glm_db}")
print("CSV →", OUTD)
