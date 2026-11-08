#!/usr/bin/env python3
"""Task 120 Phase 7 — full sequential regression runner.

Runs every suite from the Task 118/119 documented baseline in the current
environment, plus the invitation dry-run, production acceptance, reconciliation
rerun, TypeScript check and production build. Per-suite logs go to
/tmp/task120/logs/<name>.log; a JSON summary is written to
/tmp/task120/regression_results.json and mirrored to
data/backtest_reports/task120/task120_regression_results.json.

No assertion is weakened; suites run unmodified in the documented order. The
invitation dry-run is followed by a production restart (documented Task 119
practice) so task117 acceptance runs against a fresh in-process rate limiter,
and the build is followed by another restart so production serves the fresh
build."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGD = Path("/tmp/task120/logs")
OUT = Path("/tmp/task120/regression_results.json")
MIRROR = ROOT / "data/backtest_reports/task120/task120_regression_results.json"
LOGD.mkdir(parents=True, exist_ok=True)

EXPECTED = {
    "task119": 17, "task107_v1": 30, "task107_v2": 29, "task110": 62,
    "task111": 34, "task112": 66, "task113": 65, "task114": 30,
    "task115": 22, "task116_py": 35, "task116_ts": 20,
    "task101_parity": 29, "task102_parity": 33, "api_health": 14,
    "git_safety_audit": 0, "invitation_dryrun": 10, "task117_acceptance": 45,
}

SUITES = [
    ("task119",           ["python3", "scripts/task119_tests.py"]),
    ("task107_v1",        ["python3", "scripts/task107_tests.py"]),
    ("task107_v2",        ["python3", "scripts/task107_v2_tests.py"]),
    ("task110",           ["python3", "scripts/task110_tests.py"]),
    ("task111",           ["python3", "scripts/task111_tests.py"]),
    ("task112",           ["python3", "scripts/task112_tests.py"]),
    ("task113",           ["python3", "scripts/task113_tests.py"]),
    ("task114",           ["python3", "scripts/task114_tests.py"]),
    ("task115",           ["python3", "scripts/task115_tests.py"]),
    ("task116_py",        ["python3", "scripts/task116_tests.py"]),
    ("task116_ts",        ["bun", "test", "scripts/task116_tests.ts"]),
    ("task101_parity",    ["bun", "scripts/task101_parity.ts"]),
    ("task102_parity",    ["bun", "scripts/task102_parity.ts"]),
    ("api_health",        ["python3", "scripts/server_health_check.py"]),
    ("git_safety_audit",  ["python3", "scripts/git_safety_audit.py", "--json"]),
    ("invitation_dryrun", ["python3", "scripts/task118_invitation_dryrun.py"]),
    ("task117_acceptance", ["python3", "scripts/task117_tests.py"]),
    ("reconcile_120",     ["python3", "scripts/task120_reconcile.py"]),
    ("tsc_noemit",        ["bunx", "tsc", "--noEmit"]),
    ("prod_build",        ["bun", "run", "build"]),
]


def restart_production() -> dict:
    """Documented restart: pkill next-server; supervisor loop respawns within
    its 20s poll; wait until /api/health returns 200."""
    subprocess.run(["pkill", "-f", "next-serve[r]"], capture_output=True)
    deadline = time.time() + 120
    ok = False
    while time.time() < deadline:
        time.sleep(5)
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                            "-m", "8", "http://localhost:3000/api/health"],
                           capture_output=True, text=True)
        if r.stdout.strip() == "200":
            ok = True
            break
    return {"restarted": True, "healthy": ok}


def main() -> int:
    results = {}
    for name, cmd in SUITES:
        log = LOGD / f"{name}.log"
        t0 = time.time()
        print(f"[runner] {name}: {' '.join(cmd)}", flush=True)
        try:
            with open(log, "w") as fh:
                p = subprocess.run(cmd, cwd=ROOT, stdout=fh,
                                   stderr=subprocess.STDOUT, timeout=1500)
            rc = p.returncode
        except subprocess.TimeoutExpired:
            rc = -9
            with open(log, "a") as fh:
                fh.write("\n[runner] TIMEOUT after 1500s\n")
        dt = round(time.time() - t0, 1)
        results[name] = {"cmd": " ".join(cmd), "exit": rc, "seconds": dt,
                         "log": str(log)}
        print(f"[runner] {name}: exit={rc} in {dt}s", flush=True)
        # production restart between dry-run and acceptance, and after build
        if name == "invitation_dryrun":
            results["restart_after_dryrun"] = restart_production()
            print(f"[runner] restart_after_dryrun: {results['restart_after_dryrun']}", flush=True)
        if name == "prod_build":
            results["restart_after_build"] = restart_production()
            print(f"[runner] restart_after_build: {results['restart_after_build']}", flush=True)

    summary = {
        "report": "task120_regression_results",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "runtime": "production sandbox (next start on :3000 where applicable)",
        "expected_baseline": EXPECTED,
        "suites": results,
        "failed": [k for k, v in results.items()
                   if isinstance(v, dict) and "cmd" in v and v.get("exit") != 0],
    }
    OUT.write_text(json.dumps(summary, indent=1))
    MIRROR.write_text(json.dumps(summary, indent=1))
    print("[runner] DONE ->", OUT, flush=True)
    print(json.dumps({"failed": summary["failed"]}, indent=1), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
