#!/usr/bin/env python3
"""Task 107 — pipeline orchestrator (ingest -> shadow generation -> maturity ->
reports). Idempotent at every stage; stages skip themselves when there is
nothing new. Usage:
  python3 scripts/task107_runner.py pipeline [--dry-run]
  python3 scripts/task107_runner.py ingest|shadow|maturity|reports
"""
from __future__ import annotations
import json, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402

T107 = LB.T107
STAGES = ["ingest", "shadow", "maturity", "reports"]


def run(stage: str, extra: list[str] | None = None, env_extra: dict | None = None) -> bool:
    scripts = {
        "ingest": [sys.executable, "scripts/task107_daily_ingest.py"],
        "shadow": [sys.executable, "scripts/task107_shadow_gen.py"],
        "maturity": [sys.executable, "scripts/task107_maturity.py"],
        "reports": [sys.executable, "scripts/task107_reports.py"]}
    cmd = scripts[stage] + (extra or [])
    env = dict(__import__("os").environ)
    if env_extra:
        env.update(env_extra)
    env.setdefault("DATABASE_URL", f"file:{ROOT}/db/custom.db")
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=560, env=env)
    tail = (r.stdout or r.stderr).strip().splitlines()[-1:]
    print(f"[{stage}] rc={r.returncode} :: {(tail[0] if tail else '')[:140]}")
    if r.returncode not in (0, 2):  # 2 = legitimate no-op
        print((r.stderr or r.stdout)[-500:])
    return r.returncode in (0, 2)


def pipeline(dry_run: bool) -> int:
    t0 = time.time()
    ok = True
    if dry_run:
        return 0 if run("ingest", ["--dry-run"]) else 1
    for stage in STAGES:
        if not run(stage):
            ok = False
            if stage == "ingest":
                # ingestion failure blocks dependent stages this run
                break
    summary = {"kind": "pipeline", "started_at": LB.NOW(),
                "status": "success" if ok else "partial_failure",
                "runtime_seconds": round(time.time() - t0, 1)}
    LB.save_checkpoint({**summary, "frontier_after": LB.frontier_date()})
    print(json.dumps(summary))
    return 0 if ok else 1


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "pipeline"
    if arg == "pipeline":
        sys.exit(pipeline("--dry-run" in sys.argv))
    elif arg in STAGES:
        sys.exit(0 if run(arg) else 1)
    else:
        print(__doc__); sys.exit(1)
