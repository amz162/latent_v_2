#!/usr/bin/env python3
"""PSX app server health check. Usage: python3 scripts/server_health_check.py [base_url]"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
PASS, FAIL = [], []


def hit(path, timeout=30, expect=200):
    """Return (ok, status, ms, body_or_None)."""
    t0 = time.time()
    try:
        req = urllib.request.Request(BASE + path, headers={"User-Agent": "health-check/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status, body = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:
        return False, 0, (time.time() - t0) * 1000, str(e).encode()
    ms = (time.time() - t0) * 1000
    return status == expect, status, ms, body


def check(name, path, expect=200, timeout=30, parse=None):
    ok, status, ms, body = hit(path, timeout, expect)
    detail = ""
    if ok and parse and body:
        try:
            detail = " | " + parse(json.loads(body))
        except Exception as e:
            ok, detail = False, f" | parse error: {e}"
    tag = "PASS" if ok else "FAIL"
    (PASS if ok else FAIL).append(name)
    print(f"[{tag}] {name:<42} {status:>3}  {ms:7.0f}ms{detail}")


print(f"=== SERVER HEALTH CHECK — {BASE} ===\n")

# 1. Pages
check("Homepage /", "/", timeout=60)

# 2. Core data APIs (DB connectivity via Prisma)
check("GET /api/data-readiness", "/api/data-readiness", timeout=60,
      parse=lambda d: "ready" if d else "empty")
check("GET /api/stocks", "/api/stocks", timeout=60)
check("GET /api/signals", "/api/signals", timeout=60)
# /api/predictions/record is POST-only (write endpoint); GET must 405 to prove it routes
check("GET /api/predictions/record (expect 405)", "/api/predictions/record", expect=405, timeout=60)
check("GET /api/portfolio/news-digest", "/api/portfolio/news-digest", timeout=60)

# 3. Task 113/114: model report + audit blocks
def model_report(d):
    t = d.get("task113_audit") or {}
    inv = (t.get("inventory_dashboard") or {}).get("total_registry_entries")
    cohorts = len(t.get("forward_validation_dashboard") or [])
    l = t.get("llm_outcome_maturity") or {}
    t114 = d.get("task114_maturity") or {}
    p114 = len(t114.get("panel") or [])
    m114 = sum((p.get("matured_5_session") or 0) for p in (t114.get("panel") or []))
    return (f"v={d.get('report_version')} t113={t.get('available')} inv={inv} cohorts={cohorts} "
            f"LLM 5/10/21={l.get('matured_5_session')}/{l.get('matured_10_session')}/{l.get('matured_21_session')} "
            f"t114={t114.get('available')} panel={p114} mat5_sum={m114} frontier={t114.get('data_frontier')}")

check("GET /api/model-report (task113_audit)", "/api/model-report", timeout=90, parse=model_report)

# 4. Task 113: LLM signals + mock isolation
def llm_default(d):
    return f"total={d.get('total')} facets={d.get('facets', {}).get('recordTypes')}"

def llm_mock(d):
    f = d.get("facets", {}).get("recordTypes", {})
    return f"total={d.get('total')} REAL={f.get('REAL_LLM_DECISION')} MOCK={f.get('MOCK_PIPELINE_CHECK')}"

check("GET /api/llm-signals (mock excluded)", "/api/llm-signals?pageSize=5", timeout=90, parse=llm_default)
check("GET /api/llm-signals?includeMock=1", "/api/llm-signals?pageSize=200&includeMock=1", timeout=90, parse=llm_mock)

# 5. Exports
check("GET /api/llm-signals/export csv", "/api/llm-signals/export?format=csv", timeout=60)
check("GET /api/model-report/download pdf", "/api/model-report/download?format=pdf", timeout=120)

# 6. Invariant assertions
print("\n=== INVARIANTS ===")
ok, status, ms, body = hit("/api/llm-signals?pageSize=200", timeout=90)
if ok:
    d = json.loads(body)
    recs = d.get("facets", {}).get("recordTypes", {})
    inv1 = "MOCK_PIPELINE_CHECK" not in recs
    print(f"[{'PASS' if inv1 else 'FAIL'}] default view excludes MOCK records            facets={recs}")
    (PASS if inv1 else FAIL).append("mock-exclusion")
else:
    print(f"[FAIL] llm-signals unreachable ({status})"); FAIL.append("mock-exclusion")

ok2, s2, m2, b2 = hit("/api/llm-signals?pageSize=200&includeMock=1", timeout=90)
ok1, s1, m1, b1 = hit("/api/llm-signals?pageSize=200", timeout=90)
if ok1 and ok2:
    d1, d2 = json.loads(b1), json.loads(b2)
    n1, n2 = d1.get("total"), d2.get("total")
    inv2 = n2 > n1
    print(f"[{'PASS' if inv2 else 'FAIL'}] includeMock adds records ({n1} -> {n2})")
    (PASS if inv2 else FAIL).append("includeMock-delta")
else:
    print("[FAIL] could not compare totals"); FAIL.append("includeMock-delta")

ok3, s3, m3, b3 = hit("/api/model-report", timeout=90)
if ok3:
    d = json.loads(b3)
    t = d.get("task113_audit") or {}
    t114 = d.get("task114_maturity") or {}
    inv3 = (d.get("report_version") == "task115-augmented" and t.get("available") is True
            and t114.get("available") is True and len(t114.get("panel") or []) == 4)
    print(f"[{'PASS' if inv3 else 'FAIL'}] report_version=task115-augmented, task113+task114 blocks available (4 cohorts)")
    (PASS if inv3 else FAIL).append("task113-block")
else:
    print(f"[FAIL] model-report unreachable ({s3})"); FAIL.append("task113-block")

print(f"\n=== RESULT: {len(PASS)} passed, {len(FAIL)} failed ===")
if FAIL:
    print("Failed:", ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
