#!/usr/bin/env python3
"""Task 105 runner — resumable, bounded phase orchestration.

Usage:
  python3 scripts/task105_runner.py status          # artifact status board
  python3 scripts/task105_runner.py run <phase>     # run one bounded phase
  python3 scripts/task105_runner.py run all         # run phases sequentially

Every phase script is deterministic and checkpointed; completed phases (all
their artifacts present) are skipped on re-run. Bounded: each phase is a
separate process so a 150s command limit applies per phase, never to the run.
"""
from __future__ import annotations
import json, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T105 = ROOT / "data/backtest_reports/task105"

PHASES = {
    "phase1": "scripts/task105_phase1.py",
    "phase2_direction_fixtures": "scripts/task105_direction_tests.ts",
    "phase2": "scripts/task105_phase2.py",
    "phase3": "scripts/task105_phase3.py",
    "phase4": "scripts/task105_phase4.py",
    "phase5_6": "scripts/task105_phase5_6.py",
    "phase7": "scripts/task105_phase7.py",
    "phase8_levels": "scripts/task105_phase8_levels.ts",
    "phase8_9": "scripts/task105_phase8.py",
    "phase11_12_parity_fixtures": "scripts/task105_parity.ts",
    "phase11_12": "scripts/task105_phase11_12.py",
    "phase14_qa": "scripts/task105_tests.py",
    "phase15": "scripts/task105_phase15.py",
}
PY = {"phase1", "phase2", "phase3", "phase4", "phase5_6", "phase7", "phase8_9",
       "phase11_12", "phase14_qa", "phase15"}


def status() -> None:
    for name, script in PHASES.items():
        ext = ".py" if script.endswith(".py") else ".ts"
        done = "?"
        if Path(ROOT / script).exists():
            done = "present" if (ROOT / script).stat().st_size else "empty"
        print(f"{name:28} {script:40} {done}")
    arts = sorted(p.name for p in T105.glob("task105_*")) if T105.exists() else []
    print(f"\nartifacts in task105/: {len(arts)}")


def run(phase: str) -> int:
    if phase in ("all", "status"):
        order = list(PHASES)
    else:
        order = [phase]
    for p in order:
        script = PHASES.get(p)
        if not script:
            print(f"unknown phase {p}"); return 1
        cmd = ["python3" if p in PY else "bun", script]
        t0 = time.time()
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=580)
        tail = (r.stdout or r.stderr).strip().splitlines()[-1:] or [""]
        print(f"[{p}] rc={r.returncode} {time.time()-t0:.0f}s :: {tail[0][:100]}")
        if r.returncode != 0:
            print((r.stderr or r.stdout)[-800:]); return r.returncode
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "status"
    sys.exit(status() if arg == "status" else run(arg))
