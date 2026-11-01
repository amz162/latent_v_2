#!/usr/bin/env python3
"""Task 99 — write the honest remaining-blockers artifact."""
import json
import time
from pathlib import Path

BASE = Path("data/backtest_reports/task99")

BLOCKERS = [
    {
        "model": "jw_reference_lstm",
        "issue": "bounded CPU training: 14 epochs vs the reference's up-to-500 (val MAE still "
                 "improving slowly at the cap; best val 0.06518 at epoch 14)",
        "attempts": "resumable ~110s chunks (runner-managed; see task99_progress.json attempts)",
        "required": "more chunks or a GPU; the 150s per-execution sandbox limit forbids the "
                    "reference's 500-epoch schedule in one command",
        "state": "trained (bounded) + OOS evaluated on the best checkpoint",
    },
    {
        "model": "jw_reference_cnn_lstm",
        "issue": "bounded CPU training stopped by early stopping at epoch 11 (best val 0.0659 at "
                 "epoch 3); the reference used up to 500 epochs",
        "attempts": "resumable ~110s chunks",
        "required": "same as above",
        "state": "trained (bounded) + OOS evaluated on the best checkpoint",
    },
    {
        "scope": "universe expansion",
        "issue": "training covered canonical8 + pilot25 (25 symbols) as instructed; the pooled "
                 "model was NOT extended to all 909 symbols",
        "required": "more runtime; dataset builder and trainer already support arbitrary universes",
        "state": "not attempted beyond pilot25 (per task instructions)",
    },
    {
        "scope": "walk-forward folds",
        "issue": "walk-forward report covers two chronological periods (validation period, "
                 "final-test period) with a strict 21-session maturity purge; deeper multi-fold "
                 "expanding-window retraining was not run",
        "required": "additional training campaigns per fold",
        "state": "partial",
    },
    {
        "scope": "github push",
        "issue": "this recycled sandbox has no GitHub PAT (Task 95 finding); push of the Task 99 "
                 "commit requires the owner to supply a fresh token",
        "required": "a fine-grained PAT wired into .git/config (never committed)",
        "state": "commit ready locally, push blocked on credentials",
    },
    {
        "scope": "final consensus / production weighting",
        "issue": "by design both models stay supplemental + paper/shadow; backtesting shows "
                 "net-negative P&L under PSX User Schedule V2 costs, so no promotion is justified",
        "required": "genuine OOS evidence of net-positive performance before any promotion",
        "state": "correctly excluded",
    },
]

if __name__ == "__main__":
    (BASE / "task99_remaining_blockers.json").write_text(
        json.dumps({"blockers": BLOCKERS, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}, indent=2))
    print("blockers written:", len(BLOCKERS))
