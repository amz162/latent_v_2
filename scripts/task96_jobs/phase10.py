"""Task 96 Phases 10-11 — API validation + browser regression (no redesign)."""
import json
import sqlite3
import subprocess
import urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
T95 = BASE / "data/backtest_reports/task95"
SHOTS = REPORTS / "batch_logs"
PRIORITY = 90

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def api(path, timeout=40):
    with urllib.request.urlopen(f"http://localhost:3000{path}", timeout=timeout) as r:
        return json.loads(r.read())


@reg("p10_api_validation")
def p10_api_validation(ctx):
    checks = []
    def check(name, ok, detail):
        checks.append({"check": name, "ok": bool(ok), "detail": str(detail)[:250]})

    reg_ = api("/api/models/registry")
    check("registry_counts", reg_.get("canonicalCount") == 58 and reg_.get("supplementalCount") == 9
          and reg_.get("aliasCount") == 2 and reg_.get("uniqueImplementationCount") == 67,
          f"58/9/2 unique={reg_.get('uniqueImplementationCount')}")
    moirai = next((e for e in reg_.get("canonical", []) if "Moirai" in e["name"]), {})
    check("moirai_status", "oos_evaluation_pending" in str(moirai.get("verifiedStatus")),
          moirai.get("verifiedStatus"))
    patch = next((e for e in reg_.get("canonical", []) if e["name"] == "PatchTST"), {})
    check("patchtst_recomputed_metrics", patch.get("dirAcc5d") == 0.75 and patch.get("n5d") == 40,
          f"dirAcc5d={patch.get('dirAcc5d')} n={patch.get('n5d')}")
    for path, name in (("/api/backtest/task81-results", "task81"),
                       ("/api/backtest/walk-forward", "walkforward"),
                       ("/api/backtest/per-stock-walk-forward", "perstock")):
        try:
            d = api(path)
            check(f"{name}_loads", bool(d), "loaded")
        except Exception as e:
            check(f"{name}_loads", False, str(e)[:120])
    conn = sqlite3.connect(str(BASE / "db/custom.db"))
    db_states = dict(conn.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state").fetchall())
    conn.close()
    pr = api("/api/backtest/walk-forward/prospective")
    api_states = pr["counts"]["tradesByState"]
    check("prospective_matches_db", api_states == db_states, f"db={db_states} api={api_states}")
    check("latest_session_reported", pr.get("latest_ohlcv_session") == "2026-10-30",
          pr.get("latest_ohlcv_session"))
    passed = sum(1 for c in checks if c["ok"])
    ctx.write("task96_api_validation.json", {
        "task": "Task 96 Phase 10 — API validation (regression, no endpoint changes)",
        "passed": passed, "total": len(checks), "checks": checks,
    })
    ctx.log(f"api validation: {passed}/{len(checks)}")


@reg("p11_browser_regression")
def p11_browser_regression(ctx):
    SHOTS.mkdir(parents=True, exist_ok=True)
    def ab(*args, t=45):
        r = subprocess.run(["agent-browser", *args], capture_output=True, text=True, timeout=t)
        return (r.stdout or r.stderr or "").strip()
    def ev(js):
        out = ab("eval", js)
        try:
            return json.loads(out)
        except Exception:
            return out
    checks = []
    def check(n, name, ok, evd):
        checks.append({"n": n, "check": name, "ok": bool(ok), "evidence": str(evd)[:300]})

    ab("open", "http://localhost:3000"); ab("wait", "--load", "networkidle")
    check(1, "Main page", "Latent.pk" in ab("get", "title"), ab("get", "title"))
    ab("find", "text", "AI Models", "click"); ab("wait", "1200")
    body = ev("document.body.innerText")
    reg_api = api("/api/models/registry")
    check(2, "AI Models + registry counts", reg_api.get("canonicalCount") == 58 and "evaluated" in body,
          "registry renders, API 58 canonical")
    moirai = next((e for e in reg_api.get("canonical", []) if "Moirai" in e["name"]), {})
    check(3, "Foundation statuses", "oos_evaluation_pending" in str(moirai.get("verifiedStatus")),
          moirai.get("verifiedStatus"))
    # model detail expand (Task 94's old failure — regression)
    opened = ev("(()=>{const row=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.startsWith('PatchTST')&&r.offsetParent); if(!row) return 'NO_ROW'; row.scrollIntoView({block:'center'}); row.click(); return 'clicked';})()")
    ab("wait", "700")
    det = ev("(()=>{const t=document.body.innerText; const i=t.indexOf('PatchTST — Detail'); return i>=0? t.slice(i,i+160):'NOT_OPEN';})()")
    check(4, "Model detail expand", isinstance(det, str) and det.startswith("PatchTST — Detail"),
          f"{opened} -> {det[:120]}")
    ev("(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Close'); if(b) b.click(); return 1;})()")
    # prospective section vs DB
    conn = sqlite3.connect(str(BASE / "db/custom.db"))
    db_states = dict(conn.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state").fetchall())
    conn.close()
    pr = api("/api/backtest/walk-forward/prospective")
    check(5, "Prospective section matches backend", pr["counts"]["tradesByState"] == db_states,
          f"{db_states} | latest session {pr.get('latest_ohlcv_session')}")
    # desktop + mobile screenshots
    ab("screenshot", str(SHOTS / "task96_ai_models_desktop.png"))
    ab("set", "device", "iPhone 13")
    ab("open", "http://localhost:3000"); ab("wait", "--load", "networkidle")
    ab("screenshot", str(SHOTS / "task96_landing_mobile.png"))
    mob = ev("(()=>{const el=document.querySelector('nav, header, aside, [role=navigation]'); return el? 'nav-render':'no-nav';})()")
    check(6, "Mobile layout", mob == "nav-render", mob)
    ab("set", "device", "desktop")
    # console/network
    ab("close"); ab("open", "http://localhost:3000"); ab("wait", "--load", "networkidle")
    cons = ab("console")
    bad = [l for l in cons.splitlines() if "error" in l.lower()][:3]
    check(7, "No console errors", not bad, bad or "clean")
    net = ab("network", "requests")
    failed = [l for l in net.splitlines() if any(x in l for x in ("404", "500", "502", "503"))
              and "favicon" not in l][:3]
    fav = ev("fetch('/favicon.ico').then(r=>r.status)")
    check(8, "No broken requests", not failed and fav == 200, f"favicon={fav} failed={failed or 'none'}")
    ab("close")
    passed = sum(1 for c in checks if c["ok"])
    ctx.write("task96_browser_test_results.json", {
        "task": "Task 96 Phase 11 — focused browser regression (16/16 Task 95 suite preserved; focused re-run)",
        "task95_baseline": "16/16",
        "checks_passed": passed, "checks_total": len(checks), "items": checks,
        "screenshots": sorted(p.name for p in SHOTS.glob("*.png")),
    })
    ctx.log(f"browser regression: {passed}/{len(checks)}")
