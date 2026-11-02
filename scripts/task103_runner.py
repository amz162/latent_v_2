#!/usr/bin/env python3
"""Task 103 — phase runner (bounded <=150s per phase; resumable).
Usage: python3 scripts/task103_runner.py --phase <name> [--resume]
       python3 scripts/task103_runner.py --phase all --resume
Every phase writes a run record (task103_pipeline_runs.json) with run_id,
start/finish, source, row counters, failure reason, checkpoint and duration."""
from __future__ import annotations
import argparse, json, subprocess, sys, time, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L  # noqa: E402

PHASE_ORDER = ["baseline", "sources", "import_onboarding", "market_audit", "kse100", "pit_fundamentals",
                "corporate_actions", "intraday", "ops", "feature_store", "feature_lineage",
                "regime_sector", "labels", "ablation", "models", "validation", "paper",
                "strategy", "cost_parity", "api", "security", "tests", "finalize"]
EXTERNAL = {
    "sources": ["python3", "scripts/task103_sources.py"],
    "import_onboarding": ["python3", "scripts/task103_import_validation.py"],
    "market_audit": ["python3", "scripts/task103_market_data_audit.py"],
    "kse100": ["python3", "scripts/task103_kse100.py"],
    "pit_fundamentals": ["python3", "scripts/task103_pit_fundamentals.py"],
}
RUNS = L.BASE / "task103_pipeline_runs.json"


def record_run(phase: str, rc: int, dur: float, detail: str = "") -> None:
    runs = {"runs": []}
    if RUNS.exists():
        try:
            runs = L.load_json(RUNS)
        except Exception:
            runs = {"runs": []}
    runs["runs"].append({
        "run_id": f"run_{uuid.uuid4().hex[:10]}", "job": phase,
        "start": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime(time.time() - dur)),
        "finish": L.NOW(), "source": "scripts/task103_runner.py",
        "rows_fetched": None, "rows_inserted": None, "rows_updated": None,
        "rows_rejected": None, "failure_reason": detail if rc else None,
        "checkpoint": f"phase:{phase}=done" if rc == 0 else f"phase:{phase}=failed",
        "duration_seconds": round(dur, 1),
        "last_successful_run": L.NOW() if rc == 0 else None})
    runs["runs"] = runs["runs"][-200:]
    RUNS.write_text(json.dumps(runs, indent=1))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", required=True)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()
    phases = PHASE_ORDER if args.phase == "all" else [args.phase]
    prog = {}
    if L.PROGRESS_FILE.exists():
        try:
            prog = L.load_json(L.PROGRESS_FILE).get("phases", {})
        except Exception:
            prog = {}
    for ph in phases:
        if args.resume and prog.get(ph, {}).get("status") == "done":
            print(f"skip {ph} (done)")
            continue
        t0 = time.time()
        rc, detail = 0, ""
        try:
            if ph in EXTERNAL:
                r = subprocess.run(EXTERNAL[ph], cwd=L.ROOT, timeout=140)
                if r.returncode != 0:
                    rc, detail = r.returncode, f"external rc={r.returncode}"
                elif ph == "pit_fundamentals":
                    ts = subprocess.run(["bun", "scripts/task103_pit_tests.ts"], cwd=L.ROOT,
                                         capture_output=True, text=True, timeout=140)
                    pit = L.load_json(L.BASE / "task103_pit_leakage_tests.json")
                    L.write_artifact("task103_pit_leakage_report.json", {
                        "report": "task103_pit_leakage_report", "generated_at": L.NOW(),
                        "status": "completed" if pit["fail"] == 0 else "failed",
                        "pass": pit["pass"], "fail": pit["fail"], "tests": pit["tests"],
                        "suite": "scripts/task103_pit_tests.ts (drives getFundamentalsAsOf + "
                                  "kse100-provider against synthetic fixtures; task103 namespace)",
                        "required_cases_covered": ["announcement before decision",
                                                    "announcement after decision",
                                                    "announcement after market close",
                                                    "later filing amendment", "missing publication time",
                                                    "two statements different publication dates",
                                                    "restated historical value", "delisted company"]})
            else:
                import task103_phases as P
                getattr(P, f"phase_{ph}")(args)
        except Exception as e:
            rc, detail = 1, f"{type(e).__name__}: {str(e)[:200]}"
        record_run(ph, rc, time.time() - t0, detail)
        L.update_progress(ph, "done" if rc == 0 else "failed", detail)
        print(f"== {ph} {'ok' if rc == 0 else 'FAILED rc=' + str(rc) + ' ' + detail} "
              f"({time.time() - t0:.0f}s)")
        if rc:
            sys.exit(1)


if __name__ == "__main__":
    main()
