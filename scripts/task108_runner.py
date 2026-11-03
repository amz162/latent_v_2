#!/usr/bin/env python3
"""Task 108 — production scheduler & reliability orchestrator.

Phases (deterministic, checkpointed, resumable):
  verify     baseline + deployed-revision + Task 107 reconciliation artifacts
  worker     start/verify the always-on monitor worker (Phase 2/3)
  scheduler  Actions dispatch evidence + activation artifacts (Phase 3)
  workflows  failure semantics + error-injection suite (Phase 4)
  storage    storage/concurrency/integrity/backup artifacts (Phases 5/6)
  delay      provider delay probe + observation CSV (Phase 7)
  ui         API consistency + browser verification (Phase 8)
  docs       documentation audit artifacts (Phase 9 — edits themselves are manual)
  forward    maturity recalc + forward evidence artifacts (Phase 10)
  tests      regression suites + tsc + build (Phase 11)
  artifacts  regenerate all 36 artifacts + final summary (Phase 12)

Usage:
  python3 scripts/task108_runner.py <phase>       # run one phase
  python3 scripts/task108_runner.py all           # everything not yet done
  python3 scripts/task108_runner.py status        # show checkpoint state

Checkpoints: data/backtest_reports/task108/ops/_checkpoint.json — each phase is
recorded with status/timestamps so interrupted campaigns resume cleanly.
Exit codes: 0 all-ok, 1 any phase failed, 2 nothing to do.
"""
from __future__ import annotations
import json, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T108 = ROOT / "data/backtest_reports/task108"
CKPT = T108 / "ops/_checkpoint.json"
PHASES = ["verify", "worker", "scheduler", "workflows", "storage", "delay", "ui", "forward", "tests", "artifacts"]


def load() -> dict:
    return json.loads(CKPT.read_text()) if CKPT.exists() else {"phases": {}}


def save(c: dict) -> None:
    CKPT.parent.mkdir(parents=True, exist_ok=True)
    CKPT.write_text(json.dumps(c, indent=1))


def run_phase(name: str) -> bool:
    t0 = time.time()
    print(f"== phase {name} ==")
    if name == "verify":
        ok = _py("task108_artifacts.py")  # artifacts regenerate everything from live state
    elif name == "worker":
        ok = _worker()
    elif name == "scheduler":
        ok = _scheduler()
    elif name == "workflows":
        ok = _py("task108_error_injection_tests.py")
    elif name == "storage":
        ok = _py("task108_artifacts.py")  # storage artifacts computed with the rest
    elif name == "delay":
        ok = _py("task108_delay_probe.py")
    elif name == "ui":
        ok = _ui()
    elif name == "forward":
        ok = _maturity()
    elif name == "tests":
        ok = _tests()
    elif name == "artifacts":
        ok = _py("task108_artifacts.py")
    else:
        print(f"unknown phase {name}")
        return False
    c = load()
    c["phases"][name] = {"status": "ok" if ok else "failed",
                          "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                          "seconds": round(time.time() - t0, 1)}
    save(c)
    print(f"== phase {name}: {'ok' if ok else 'FAILED'} ==")
    return ok


def _py(script: str, *args: str) -> bool:
    r = subprocess.run([sys.executable, f"scripts/{script}", *args],
                       capture_output=True, text=True, cwd=ROOT, timeout=560)
    tail = (r.stdout or r.stderr).strip().splitlines()[-1:]
    print(f"  {script} rc={r.returncode} :: {(tail[0] if tail else '')[:120]}")
    return r.returncode == 0


def _worker() -> bool:
    hb = ROOT / "data/backtest_reports/task107/ops/worker_health.json"
    if hb.exists():
        h = json.loads(hb.read_text())
        import os, signal
        try:
            os.kill(h["pid"], 0)  # liveness probe
            print(f"  worker alive pid={h['pid']} cycles={h['cycles_completed']}")
            return True
        except OSError:
            print("  worker heartbeat stale — restarting")
    r = subprocess.Popen(["nohup", sys.executable, "scripts/task108_worker.py"],
                          stdout=open(ROOT / "logs/task108_worker.log", "a"),
                          stderr=subprocess.STDOUT, cwd=ROOT,
                          start_new_session=True)
    print(f"  worker started pid={r.pid}")
    return True


def _scheduler() -> bool:
    """Scheduler activation is evidenced by real Actions runs (dispatch tests are
    run by the operator; this phase audits their results via git + artifacts)."""
    ev = T108 / "task108_scheduler_execution_evidence.json"
    ok = ev.exists() and any(r.get("conclusion") == "success" for r in
                              json.loads(ev.read_text()).get("dispatch_runs", []))
    print(f"  dispatch evidence with success: {ok}")
    return ok


def _ui() -> bool:
    import urllib.request
    try:
        with urllib.request.urlopen("http://localhost:3000/api/paper-trading/monitor", timeout=50) as r:
            d = json.loads(r.read())
        print(f"  API 200, positions={len(d['positions'])}")
        Path("/tmp/mon_api.json").write_text(json.dumps(d))
        return len(d["positions"]) > 0
    except Exception as e:
        print(f"  API unavailable: {e} — start `bun run dev` first")
        return False


def _maturity() -> bool:
    return _py("task107_maturity.py") and _py("task107_reports.py")


def _tests() -> bool:
    a = _py("task107_v2_tests.py")
    b = _py("task107_tests.py")
    c = _py("task108_error_injection_tests.py")
    d = subprocess.run(["bunx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=ROOT, timeout=560)
    app_errs = [l for l in (d.stdout or "").splitlines() if not l.startswith("skills/")]
    print(f"  tsc app errors: {len(app_errs)}")
    e = subprocess.run(["bun", "run", "build"], capture_output=True, text=True, cwd=ROOT, timeout=560)
    print(f"  build rc={e.returncode}")
    return a and b and c and not app_errs and e.returncode == 0


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else "status"
    if arg == "status":
        print(json.dumps(load(), indent=1))
        return 0
    if arg == "all":
        c = load()
        results = {p: run_phase(p) for p in PHASES if c["phases"].get(p, {}).get("status") != "ok"}
        if not results:
            print("all phases already ok")
            return 2
        return 0 if all(results.values()) else 1
    return 0 if run_phase(arg) else 1


if __name__ == "__main__":
    sys.exit(main())
