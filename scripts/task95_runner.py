#!/usr/bin/env python3
"""Task 95 resumable job runner — every job must finish well under 150s.

Usage:
  python3 scripts/task95_runner.py --list
  python3 scripts/task95_runner.py --run <job> [<job> ...]
  python3 scripts/task95_runner.py --auto --budget-seconds 150
  python3 scripts/task95_runner.py --retry-failed
Progress: data/backtest_reports/task95/task95_progress.json
Logs:     data/backtest_reports/task95/batch_logs/<job>.log
"""
import argparse
import importlib.util
import json
import sys
import time
import traceback
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task95"
PROGRESS = REPORTS / "task95_progress.json"
JOBS_DIR = BASE / "scripts/task95_jobs"


def load_jobs():
    jobs = {}
    for f in sorted(JOBS_DIR.glob("*.py")):
        if f.name.startswith("_"):
            continue
        spec = importlib.util.spec_from_file_location(f"task95_jobs_{f.stem}", f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for name, fn in getattr(mod, "JOBS", {}).items():
            if name in jobs:
                raise SystemExit(f"duplicate job name {name}")
            jobs[name] = {"fn": fn, "priority": getattr(mod, "PRIORITY", 100), "module": f.stem}
    return jobs


def load_progress():
    if PROGRESS.exists():
        try:
            return json.loads(PROGRESS.read_text())
        except Exception:
            pass
    return {"jobs": {}, "history": []}


def save_progress(p):
    REPORTS.mkdir(parents=True, exist_ok=True)
    PROGRESS.write_text(json.dumps(p, indent=1, default=str))


class Ctx:
    def __init__(self, name):
        self.name = name
        self.lines = []

    def log(self, msg):
        line = f"[{time.strftime('%H:%M:%S')}] {msg}"
        print(line, flush=True)
        self.lines.append(line)

    def write(self, fname, data):
        p = REPORTS / fname
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=1, default=str))
        self.log(f"wrote {fname} ({p.stat().st_size}B)")
        return str(p)


def run_job(name, jobs, progress):
    if name not in jobs:
        print(f"UNKNOWN JOB {name}")
        return "unknown"
    ent = jobs[name]
    p = progress["jobs"].setdefault(name, {"status": "pending", "runs": 0})
    if p["status"] == "done":
        print(f"SKIP {name} (already done)")
        return "skip"
    p.update(status="running", runs=p["runs"] + 1, started=time.strftime("%Y-%m-%dT%H:%M:%SZ"), error=None)
    save_progress(progress)
    ctx = Ctx(name)
    ctx.log(f"job {name} from {ent['module']} starting (run #{p['runs']})")
    t0 = time.time()
    try:
        ent["fn"](ctx)
        p.update(status="done", finished=time.strftime("%Y-%m-%dT%H:%M:%SZ"), seconds=round(time.time() - t0, 1))
        res = "done"
    except Exception as e:
        p.update(
            status="failed",
            finished=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            seconds=round(time.time() - t0, 1),
            error=f"{type(e).__name__}: {e}",
            traceback=traceback.format_exc()[-2500:],
        )
        res = "FAILED"
    (REPORTS / "batch_logs").mkdir(parents=True, exist_ok=True)
    (REPORTS / "batch_logs" / f"{name}.log").write_text("\n".join(ctx.lines) + "\n")
    save_progress(progress)
    print(f"{res} {name} in {time.time() - t0:.1f}s", flush=True)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--run", nargs="+")
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--retry-failed", action="store_true")
    ap.add_argument("--budget-seconds", type=float, default=150)
    args = ap.parse_args()
    jobs = load_jobs()
    if args.list:
        for name, ent in sorted(jobs.items(), key=lambda kv: (kv[1]["priority"], kv[0])):
            print(f"{ent['priority']:>4}  {name:45s} [{ent['module']}]")
        return
    progress = load_progress()
    if args.run:
        for n in args.run:
            run_job(n, jobs, progress)
    elif args.retry_failed:
        failed = [n for n, j in jobs.items() if progress["jobs"].get(n, {}).get("status") == "failed"]
        print("retrying:", failed or "(none)")
        for n in failed:
            progress["jobs"][n]["status"] = "pending"
            run_job(n, jobs, progress)
    elif args.auto:
        t0 = time.time()
        ran = 0
        for name, ent in sorted(jobs.items(), key=lambda kv: (kv[1]["priority"], kv[0])):
            if time.time() - t0 > args.budget_seconds:
                print(f"BUDGET {args.budget_seconds}s exhausted — resume with --auto later")
                break
            st = progress["jobs"].get(name, {}).get("status")
            if st == "done":
                continue
            run_job(name, jobs, progress)
            ran += 1
        print(f"auto pass complete: {ran} jobs attempted, elapsed {time.time() - t0:.0f}s")
    else:
        ap.print_help()
        sys.exit(1)
    done = sum(1 for j in progress["jobs"].values() if j.get("status") == "done")
    failed = [n for n, j in progress["jobs"].items() if j.get("status") == "failed"]
    print(f"progress: {done} done, {len(failed)} failed {failed if failed else ''}")


if __name__ == "__main__":
    main()
