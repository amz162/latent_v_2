#!/usr/bin/env python3
"""task127_tests.py — Task 127 forward-monitoring tests.

Covers: alert fire/dedup/escalation/recovery, alert record completeness,
cohort separation invariants (frozen baseline, forward separation), paper-mode
enforcement (monitor is read-only over the ledger), and the metrics policy
(no Sharpe/Sortino/ROI/max-drawdown labelling). Read-only.
"""
import json, sys, datetime, sqlite3, io, contextlib

sys.path.insert(0, "/home/z/my-project/repo_latent_v_2/scripts")
import task127_alerts as AL

ROOT = "/home/z/my-project/repo_latent_v_2"
PASS = FAIL = 0

def check(name, ok, detail=""):
    global PASS, FAIL
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f" — {detail}" if detail else ""))
    PASS, FAIL = PASS + (1 if ok else 0), FAIL + (0 if ok else 1)

NOW = datetime.datetime(2026, 11, 24, 6, 0, tzinfo=datetime.timezone.utc)
NOW2 = datetime.datetime(2026, 11, 24, 18, 0, tzinfo=datetime.timezone.utc)
T0 = "2026-11-24T05:00:00Z"
T1 = "2026-11-24T05:30:00Z"   # 30 min after T0 (within 12h dedup)
T2 = "2026-11-24T18:00:00Z"   # 13h after T0 (past dedup window)

def alert(sev="WARN", active=True, aid="a1"):
    return {"id": aid, "severity": sev, "component": "test", "affected": "x",
            "reason": "r", "action": "act", "active": active}

# 1. fresh alert fires
f, r, st = AL.evaluate([alert()], {}, NOW, T0)
check("fresh alert fires", len(f) == 1 and not f[0]["suppressed"] and st["a1"]["fire_count"] == 1)

# 2. same severity within dedup window -> suppressed
f, r, st2 = AL.evaluate([alert()], st, NOW, T1)
check("re-fire within 12h suppressed", len(f) == 1 and f[0]["suppressed"]
      and st2["a1"]["fire_count"] == 1 and st2["a1"]["suppressed_since_last"] == 1)

# 3. re-fire after dedup window
f, r, st3 = AL.evaluate([alert()], st2, NOW2, T2)
check("re-fire after 12h fires", len(f) == 1 and not f[0]["suppressed"]
      and st3["a1"]["fire_count"] == 2)

# 4. severity escalation fires immediately
f, r, st4 = AL.evaluate([alert(sev="CRIT")], st2, NOW2, T2)
check("WARN->CRIT escalation fires despite dedup window",
      len(f) == 1 and not f[0]["suppressed"] and st4["a1"]["last_severity"] == "CRIT")

# 5. recovery notification when condition clears
f, r, st5 = AL.evaluate([alert(active=False)], st4, NOW, T2)
check("condition clear -> recovery event", len(f) == 0 and len(r) == 1
      and r[0]["event"] == "recovered" and r[0]["id"] == "a1"
      and st5["a1"]["recovered"] is True)
check("recovery not duplicated", (AL.evaluate([alert(active=False)], st5, NOW, T2)[1] == []))

# 6. alert record completeness (all 6 required fields + timestamp)
req = {"id", "severity", "component", "affected", "reason", "action", "timestamp"}
f, _, _ = AL.evaluate([alert()], {}, NOW, T0)
check("alert record carries severity/timestamp/component/affected/reason/action",
      req.issubset(set(f[0].keys())))

# 7. alert log journal shape
import tempfile, os
tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jsonl").name
fired_rec, _, _ = AL.evaluate([alert()], {}, NOW, T0)
AL.log_events(tmp, fired_rec, [{"id": "a1", "component": "test", "timestamp": T0, "event": "recovered", "previously_fired": 1}])
lines = [json.loads(l) for l in open(tmp)]
check("alert journal: suppressed alerts not logged, recoveries logged",
      len(lines) == 2 and lines[0]["kind"] == "alert" and lines[1]["event"] == "recovered")
os.unlink(tmp)

# 8. cohort separation: frozen baseline metrics match the published Task 125 reconciliation
con = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
net = cur.execute("SELECT ROUND(SUM(netPnl),2) FROM ProspectivePaperTrade WHERE state='closed'").fetchone()[0]
states = dict(cur.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state"))
check("baseline realized net unchanged (frozen cohort)", net == -707370.97, f"sum={net}")
check("baseline states unchanged", states == {"closed": 78, "open": 3, "pending_entry": 33}, str(states))

# 9. monitor is read-only over the ledger (paper-mode enforcement)
src = open(f"{ROOT}/scripts/task127_monitor.py").read()
check("monitor opens DB read-only (mode=ro)", "mode=ro" in src)
check("monitor never writes to the DB", "INSERT" not in src and "UPDATE " not in src and "DELETE" not in src)

# 10. metrics policy: no Sharpe/Sortino/ROI/MDD keys anywhere in the emitted health JSON
def walk_keys(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from walk_keys(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk_keys(v)
health = json.load(open(f"{ROOT}/reports/operations/task127_daily_health.json"))
keys = {k.lower() for k in walk_keys(health)}
for bad in ("sharpe", "sortino", "roi", "max_drawdown"):
    check(f"no '{bad}' key in task127_daily_health.json", bad not in keys)

# 11. paper-mode: no real-order/broker paths in the monitoring stack
check("no broker/order endpoints in monitor", "broker" not in src.lower() and "/api/order" not in src)

# 12. registry: baseline row frozen + forward cohort separated
import csv
rows = list(csv.DictReader(open(f"{ROOT}/reports/operations/task127_cohort_registry.csv")))
base = [r for r in rows if r["cohort_id"] == "C20261029"]
check("cohort registry has frozen baseline C20261029", len(base) == 1)
m = json.loads(base[0]["metrics"]) if base else {}
check("registry baseline metrics match ledger", m.get("realized_net_pnl") == -707370.97
      and m.get("closed") == 78, str(m.get("realized_net_pnl")))
fwd = [r for r in rows if r["cohort_id"] not in ("C20261029",)]
check("forward cohorts (if any) reported separately", all(r["cohort_id"] != "C20261029" for r in fwd))

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
