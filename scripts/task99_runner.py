#!/usr/bin/env python3
"""Task 99 — budgeted job runner (sandbox execution limit ≈ 150s per command).

Usage: python3 scripts/task99_runner.py --budget-seconds 150 --job <name>
       python3 scripts/task99_runner.py --budget-seconds 150 --job all --loop

Discipline:
  - every job is executed as a subprocess with a hard timeout (budget − 15s
    margin for interpreter startup, or a job-specific override),
  - the progress manifest (task99_progress.json) is updated after EVERY
    execution (status, duration, attempts, error),
  - completed jobs (done-marker present / artifact exists) are skipped,
  - failures are recorded and the remaining jobs continue,
  - heavy jobs (training) are never grouped; light jobs may be grouped,
  - the execution plan (task99_execution_plan.json) records benchmarks and
    scheduling decisions.
"""
from __future__ import annotations
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

PY = sys.executable
BASE = Path("data/backtest_reports/task99")
BASE.mkdir(parents=True, exist_ok=True)
(BASE / "batch_logs").mkdir(exist_ok=True)
PLAN_PATH = BASE / "task99_execution_plan.json"
PROGRESS_PATH = BASE / "task99_progress.json"

# job -> (argv template, heavy?, timeout override)
JOBS: dict[str, dict] = {
    "reference_audit": {"cmd": [PY, "scripts/task99_reference_audit.py"], "heavy": False},
    "dataset_canonical8": {"cmd": [PY, "scripts/task99_dataset.py", "--universe", "canonical8", "--tag", "canonical8_h5_10_21"], "heavy": False},
    "dataset_pilot25": {"cmd": [PY, "scripts/task99_dataset.py", "--universe", "pilot25", "--tag", "pilot25_h5_10_21"], "heavy": False},
    "dataset_canonical8_1d": {"cmd": [PY, "scripts/task99_dataset.py", "--universe", "canonical8", "--horizons", "1", "--tag", "canonical8_h1_repro"], "heavy": False},
    "tests_architecture": {"cmd": [PY, "scripts/task99_tests.py", "--suite", "architecture"], "heavy": False},
    "tests_data_leakage": {"cmd": [PY, "scripts/task99_tests.py", "--suite", "data_leakage"], "heavy": False},
    "tests_training": {"cmd": [PY, "scripts/task99_tests.py", "--suite", "training"], "heavy": False},
    "train_lstm_full": {"cmd": [PY, "scripts/task99_train.py", "--model", "jw_reference_lstm", "--config", "reference_full_config", "--dataset", "pilot25_h5_10_21", "--time-budget", "110"], "heavy": True, "repeat_until_done": True},
    "train_cnn_full": {"cmd": [PY, "scripts/task99_train.py", "--model", "jw_reference_cnn_lstm", "--config", "reference_full_config", "--dataset", "pilot25_h5_10_21", "--time-budget", "110"], "heavy": True, "repeat_until_done": True},
    "train_lstm_1d_repro": {"cmd": [PY, "scripts/task99_train.py", "--model", "jw_reference_lstm", "--config", "reference_cpu_compact", "--dataset", "canonical8_h1_repro", "--time-budget", "110"], "heavy": True, "repeat_until_done": True},
    "evaluate": {"cmd": [PY, "scripts/task99_evaluate.py"], "heavy": False},
    "signals": {"cmd": [PY, "scripts/task99_signals.py"], "heavy": False},
    "backtest": {"cmd": ["bun", "scripts/task99_backtest.ts"], "heavy": False},
    "registry_integration": {"cmd": [PY, "scripts/task99_registry_write.py"], "heavy": False},
    "artifacts": {"cmd": [PY, "scripts/task99_artifacts.py"], "heavy": False},
}
TRAINING_JOBS = {"train_lstm_full", "train_cnn_full", "train_lstm_1d_repro"}
# training jobs are "done" when their checkpoint sidecar reports finished:true


def load_json(p: Path, default):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def job_done(name: str) -> bool:
    if name in TRAINING_JOBS:
        for side in (BASE / "checkpoints").glob(f"*.json"):
            d = load_json(side, {})
            if d.get("finished"):
                return True
        return False
    return (BASE / "batch_logs" / f"{name}.done").exists()


def training_job_finished_for(name: str) -> bool:
    model_cfg = {"train_lstm_full": ("jw_reference_lstm", "reference_full_config", "pilot25_h5_10_21"),
                 "train_cnn_full": ("jw_reference_cnn_lstm", "reference_full_config", "pilot25_h5_10_21"),
                 "train_lstm_1d_repro": ("jw_reference_lstm", "reference_cpu_compact", "canonical8_h1_repro")}
    if name not in model_cfg:
        return job_done(name)
    mid, cn, tag = model_cfg[name]
    side = load_json(BASE / "checkpoints" / f"{mid}__{cn}__{tag}.json", {})
    return bool(side.get("finished"))


def run_job(name: str, budget: float, plan: dict, progress: dict) -> None:
    spec = JOBS[name]
    timeout = min(budget - 15.0, spec.get("timeout", budget - 15.0))
    entries = plan.setdefault("jobs", {})
    ent = entries.setdefault(name, {"attempts": 0, "durations": []})
    ent["attempts"] += 1
    t0 = time.time()
    log_path = BASE / "batch_logs" / f"{name}_attempt{ent['attempts']}.log"
    status = "done"
    err = None
    try:
        with open(log_path, "w") as lf:
            subprocess.run(spec["cmd"], stdout=lf, stderr=subprocess.STDOUT,
                           timeout=timeout, check=True, cwd=".")
    except subprocess.TimeoutExpired:
        status = "timeout"
        err = f"exceeded {timeout:.0f}s — will resume/retry"
    except subprocess.CalledProcessError as e:
        status = "failed"
        err = f"exit {e.returncode} — see {log_path}"
    dur = time.time() - t0
    ent["durations"].append(round(dur, 1))
    ent["last_status"] = status
    if status == "done":
        if name in TRAINING_JOBS:
            if training_job_finished_for(name):
                (BASE / "batch_logs" / f"{name}.done").write_text(
                    json.dumps({"finished": True, "at": time.time()}))
                ent["status"] = "done"
            else:
                ent["status"] = "in_progress_resumable"
        else:
            (BASE / "batch_logs" / f"{name}.done").write_text(json.dumps({"at": time.time()}))
            ent["status"] = "done"
    else:
        ent["status"] = status
        ent["last_error"] = err
        if name in TRAINING_JOBS:
            ent["status"] = "resumable_after_" + status
    # repeatable training jobs stay pending until finished
    prog = progress.setdefault("jobs", {})
    prog[name] = {"status": ent["status"], "attempts": ent["attempts"],
                  "last_duration_s": ent["durations"][-1], "error": err}
    progress["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    PROGRESS_PATH.write_text(json.dumps(progress, indent=2))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget-seconds", type=float, default=150.0)
    ap.add_argument("--job", required=True, help="job name or 'all'")
    ap.add_argument("--loop-minutes", type=float, default=0, help="repeat 'all' for N minutes")
    a = ap.parse_args()
    plan = load_json(PLAN_PATH, {"created": time.strftime("%Y-%m-%d"), "jobs": {}})
    progress = load_json(PROGRESS_PATH, {"jobs": {}})
    if not PLAN_PATH.exists():
        PLAN_PATH.write_text(json.dumps(plan, indent=2))
    names = list(JOBS) if a.job == "all" else [x.strip() for x in a.job.split(",")]
    stop_at = time.time() + a.loop_minutes * 60 if a.loop_minutes else None
    while True:
        pending = []
        for name in names:
            if name in TRAINING_JOBS:
                if training_job_finished_for(name):
                    continue
            elif job_done(name):
                continue
            pending.append(name)
        if not pending:
            print("all requested jobs done")
            return 0
        # heavy jobs individually; light jobs batched only if they fit together
        heavy = [j for j in pending if JOBS[j].get("heavy")]
        light = [j for j in pending if not JOBS[j].get("heavy")]
        batch = [heavy[0]] if heavy else light
        for name in batch:
            run_job(name, a.budget_seconds, plan, progress)
            PLAN_PATH.write_text(json.dumps(plan, indent=2))
        if stop_at is None or time.time() > stop_at:
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
