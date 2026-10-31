#!/usr/bin/env python3
"""Task 94 Resumable Runner — bounded execution + checkpoint/resume.

Usage:
  python3 scripts/task94_runner.py --budget-seconds 150 --job <job_name>
  python3 scripts/task94_runner.py --list-jobs
  python3 scripts/task94_runner.py --resume

Features:
  - --budget-seconds N: hard ceiling on execution time per invocation
  - Persistent job manifest at data/backtest_reports/task94/task94_progress.json
  - Automatic progress tracking with start/end timestamps + status
  - Checkpoint/resume — failed jobs retried only after cause fix
  - Individual model jobs + small grouped batches
  - One failed job never stops remaining jobs
"""
import argparse, json, os, sys, time, subprocess, traceback
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path("/home/z/my-project")
OUT = ROOT / "data/backtest_reports/task94"
PROGRESS = OUT / "task94_progress.json"
CHECKPOINTS = OUT / "checkpoints"
BATCH_LOGS = OUT / "batch_logs"
CHECKPOINTS.mkdir(parents=True, exist_ok=True)
BATCH_LOGS.mkdir(parents=True, exist_ok=True)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_progress():
    if PROGRESS.exists():
        return json.load(open(PROGRESS))
    return {"jobs": {}, "phases": {}, "started_at": now_iso(), "last_updated": now_iso()}


def save_progress(p):
    p["last_updated"] = now_iso()
    PROGRESS.write_text(json.dumps(p, indent=2))


def list_jobs():
    p = load_progress()
    print(f"Task 94 Progress — last updated: {p.get('last_updated')}")
    print(f"Started: {p.get('started_at')}")
    print()
    print(f"{'Job':<40} {'Status':<12} {'Phase':<8} {'Duration':<10} {'Attempts'}")
    print("-" * 90)
    for name, job in sorted(p.get("jobs", {}).items()):
        status = job.get("status", "pending")
        phase = job.get("phase", "?")
        dur = job.get("duration_s")
        attempts = job.get("attempts", 0)
        dur_str = f"{dur:.1f}s" if dur is not None else "—"
        print(f"{name:<40} {status:<12} {phase:<8} {dur_str:<10} {attempts}")


def run_job(job_name, phase, budget_seconds, command):
    """Run a single job with budget enforcement."""
    p = load_progress()
    if job_name in p["jobs"] and p["jobs"][job_name].get("status") == "completed":
        print(f"SKIP: {job_name} already completed at {p['jobs'][job_name].get('completed_at')}")
        return "skipped"

    job = p["jobs"].get(job_name, {
        "name": job_name, "phase": phase, "status": "pending", "attempts": 0,
        "first_attempt_at": None, "last_attempt_at": None,
    })
    job["attempts"] = job.get("attempts", 0) + 1
    job["first_attempt_at"] = job.get("first_attempt_at") or now_iso()
    job["last_attempt_at"] = now_iso()
    job["status"] = "running"
    job["command"] = command
    job["budget_seconds"] = budget_seconds
    p["jobs"][job_name] = job
    save_progress(p)

    start = time.time()
    exit_code = None
    error = None
    try:
        # Run subprocess with timeout slightly under budget
        proc_timeout = max(5, budget_seconds - 5)
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=proc_timeout, cwd=str(ROOT),
        )
        exit_code = result.returncode
        stdout = result.stdout[-4000:]
        stderr = result.stderr[-4000:]
        # Save batch log
        log_file = BATCH_LOGS / f"{job_name}.log"
        log_file.write_text(f"=== {job_name} @ {now_iso()} ===\nCMD: {command}\nEXIT: {exit_code}\n--- STDOUT ---\n{stdout}\n--- STDERR ---\n{stderr}\n")
        if exit_code == 0:
            job["status"] = "completed"
            job["completed_at"] = now_iso()
        else:
            job["status"] = "failed"
            job["error"] = f"Exit {exit_code}: {stderr[:500]}"
    except subprocess.TimeoutExpired:
        job["status"] = "timeout"
        job["error"] = f"Timed out after {budget_seconds - 5}s"
    except Exception as e:
        job["status"] = "error"
        job["error"] = f"{type(e).__name__}: {e}\n{traceback.format_exc()[:1000]}"
    finally:
        elapsed = time.time() - start
        job["duration_s"] = round(elapsed, 1)
        p["jobs"][job_name] = job
        save_progress(p)
        print(f"DONE: {job_name} status={job['status']} elapsed={elapsed:.1f}s")
        return job["status"]


def main():
    ap = argparse.ArgumentParser(description="Task 94 resumable runner")
    ap.add_argument("--budget-seconds", type=int, default=150)
    ap.add_argument("--job", help="Job name to run")
    ap.add_argument("--phase", default="?", help="Phase number/name")
    ap.add_argument("--command", help="Shell command to execute")
    ap.add_argument("--list-jobs", action="store_true")
    ap.add_argument("--resume", action="store_true", help="Show resume status")
    args = ap.parse_args()

    if args.list_jobs or args.resume:
        list_jobs()
        return

    if not args.job or not args.command:
        ap.error("--job and --command required (or use --list-jobs)")

    status = run_job(args.job, args.phase, args.budget_seconds, args.command)
    sys.exit(0 if status in ("completed", "skipped") else 1)


if __name__ == "__main__":
    main()
