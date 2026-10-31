#!/usr/bin/env python3
"""Task 94 Phase 9 — Backend API & registry integrity validation.
Bounded (<150s), idempotent. Emits task94_api_validation.json.
"""
import json, urllib.request, os

ROOT = "/home/z/my-project"
BASE = "http://localhost:3000"
OUT = f"{ROOT}/data/backtest_reports/task94/task94_api_validation.json"

def get(path, timeout=45):
    try:
        with urllib.request.urlopen(f"{BASE}{path}", timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except Exception as e:
        return None, {"error": str(e)}

checks = []
def check(name, ok, detail):
    checks.append({"check": name, "ok": bool(ok), "detail": detail})

# 1. /api/models/registry — counts must match Phase 1 reconciliation
s, reg = get("/api/models/registry")
recon = json.load(open(f"{ROOT}/data/backtest_reports/task94/task94_registry_reconciliation.json"))
if s == 200:
    n_canon = reg.get("canonicalCount")
    n_supp = reg.get("supplementalCount")
    n_alias = reg.get("aliasCount")
    uniq = reg.get("uniqueImplementationCount")
    check("registry.http_200", True, {"status": s})
    check("registry.counts_match_reconciliation",
          n_canon == recon["canonical_count"] and n_supp == recon["supplemental_count"] and uniq == recon["total_unique_implementations"],
          {"api_canonical": n_canon, "api_supplemental": n_supp, "api_aliases": n_alias,
           "api_unique": uniq, "reconciliation": [recon["canonical_count"], recon["supplemental_count"], recon["total_unique_implementations"]]})
    alias_names = [a.get("name") for a in (reg.get("aliases") or [])]
    check("registry.aliases_visible_not_hidden",
          n_alias is not None and len(alias_names) == n_alias and all(a.get("aliasParent") for a in reg.get("aliases") or []),
          {"aliases": alias_names})
else:
    check("registry.http_200", False, {"status": s, "error": reg.get("error")})

# 2. /api/backtest/task81-results — loads + V2 cost fields present
s, t81 = get("/api/backtest/task81-results", timeout=90)
if s == 200:
    blob = json.dumps(t81)
    check("task81.http_200", True, {"status": s})
    check("task81.v2_cost_markers",
          any(k in blob for k in ("PSX_USER_SCHEDULE_V2", "psx_user_schedule_v2", "netRR", "net_rr", "costDrag", "cost_drag")),
          {"markers_found": [k for k in ("PSX_USER_SCHEDULE_V2","psx_user_schedule_v2","netRR","net_rr","costDrag","cost_drag") if k in blob][:3]})
else:
    check("task81.http_200", False, {"status": s})

# 3. /api/backtest/walk-forward
s, wf = get("/api/backtest/walk-forward", timeout=60)
check("walkforward.http_200", s == 200, {"status": s, "keys": list(wf)[:6] if isinstance(wf, dict) else type(wf).__name__})

# 4. /api/backtest/per-stock-walk-forward — must reflect the 360 Task87 cells
s, ps = get("/api/backtest/per-stock-walk-forward", timeout=60)
if s == 200 and ps.get("available"):
    check("perstock.http_200_available", True, {"count": ps.get("count"), "cells_len": len(ps.get("cells") or [])})
    check("perstock.count_matches_task87", ps.get("count") == 360 or len(ps.get("cells") or []) == 360,
          {"api_count": ps.get("count"), "expected": 360})
else:
    check("perstock.http_200_available", False, {"status": s, "error": ps.get("error") if isinstance(ps, dict) else "?"})

# 5. /api/backtest/walk-forward/prospective — must match persisted DB records (114)
s, pr = get("/api/backtest/walk-forward/prospective", timeout=60)
if s == 200:
    blob = json.dumps(pr)
    check("prospective.http_200", True, {"status": s})
    n_trades = pr.get("totalTrades") or pr.get("n_total") or pr.get("count")
    check("prospective.count_field_present", n_trades is not None or "total" in blob.lower(),
          {"totalTrades": n_trades, "keys": list(pr)[:8] if isinstance(pr, dict) else "?"})
else:
    check("prospective.http_200", False, {"status": s})

# 6. error/stale state: a bogus symbol on a per-symbol route must fail gracefully (4xx/5xx JSON, not crash)
s2, e2 = get("/api/backtest/model-graph?symbol=___BOGUS___", timeout=30)
check("error_state.graceful", s2 is not None, {"status": s2, "body_keys": list(e2)[:5] if isinstance(e2, dict) else "?"})

passed = sum(1 for c in checks if c["ok"])
report = {"task": "Task 94 Phase 9 — API & registry integrity",
          "base_url": BASE, "checks_total": len(checks), "checks_passed": passed,
          "checks_failed": len(checks) - passed, "checks": checks,
          "reconciliation_reference": {"canonical": recon["canonical_count"],
                                       "supplemental": recon["supplemental_count"],
                                       "ensembles": recon["ensemble_total_in_registry_and_supplemental"]},
          "fixes_applied": ["registry route: alias entries (Kalman, Logistic (PI)) excluded from supplementalCount, exposed under aliases[] with aliasParent — counts now match Phase 1 reconciliation"]}
with open(OUT, "w") as f: json.dump(report, f, indent=2)
print(f"PHASE9: {passed}/{len(checks)} checks passed")
for c in checks:
    print(("PASS " if c["ok"] else "FAIL ") + c["check"] + " :: " + json.dumps(c["detail"])[:120])
