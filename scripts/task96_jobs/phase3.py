"""Task 96 Phase 3 (P0) — Moirai full OOS evaluation: chunk batches + aggregation."""
import json
import subprocess
import time
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
CKPT = REPORTS / "checkpoints"
T95 = BASE / "data/backtest_reports/task95"
PRIORITY = 30

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def chunk_plan():
    wf = json.loads((BASE / "data/backtest_reports/walk_forward_latest.json").read_text())
    pilot25 = sorted(wf.get("per_stock_results", {}).keys())
    chunks = [(s, h, "pilot25") for s in pilot25 for h in (5, 10, 21)]
    smoke = ["WTL", "KEL", "FCCL", "ANL", "CNERGY"]
    chunks += [(s, 5, "task95_smoke") for s in smoke if (s, 5, "pilot25") not in chunks]
    return pilot25, chunks


@reg("p3_moirai_chunk_batch")
def p3_moirai_chunk_batch(ctx):
    """Process pending chunks until ~115s elapsed; each chunk is idempotent + resumable."""
    pilot25, chunks = chunk_plan()
    done = {p.name for p in CKPT.glob("moirai_*.json")}
    pending = [(s, h, c) for s, h, c in chunks if f"moirai_{s}_{h}d.json" not in done]
    total = len(chunks)
    ctx.log(f"chunks: {total - len(pending)}/{total} done, processing next batch")
    t0 = time.time()
    ran = 0
    for s, h, c in pending:
        if time.time() - t0 > 115:
            break
        r = subprocess.run(
            [str(BASE / ".moirai-venv/bin/python"), "scripts/task96_moirai_chunk.py",
             "--symbol", s, "--horizon", str(h)],
            capture_output=True, text=True, cwd=BASE, timeout=45)
        ran += 1
        tail = (r.stdout or r.stderr).strip().splitlines()[-1:] or ["?"]
        ctx.log(f"{s} h={h}: {tail[0][:90]}")
    remaining = total - len({p.name for p in CKPT.glob("moirai_*.json")})
    if remaining > 0:
        # stay pending so the next runner pass continues the campaign
        prog_path = REPORTS / "task96_progress.json"
        prog = json.loads(prog_path.read_text())
        prog["jobs"]["p3_moirai_chunk_batch"]["status"] = "pending"
        prog["jobs"]["p3_moirai_chunk_batch"]["chunks_remaining"] = remaining
        prog_path.write_text(json.dumps(prog, indent=1, default=str))
    ctx.log(f"batch done: ran {ran}, remaining {remaining}/{total}")


@reg("p3_moirai_aggregate")
def p3_moirai_aggregate(ctx):
    import math
    import numpy as np
    pilot25, chunks = chunk_plan()
    done = {p.name for p in CKPT.glob("moirai_*.json")}
    records, skips, by_horizon = [], [], {}
    for s, h, c in chunks:
        f = CKPT / f"moirai_{s}_{h}d.json"
        if f.name not in done:
            continue
        d = json.loads(f.read_text())
        if d.get("status") == "insufficient_history":
            skips.append({"symbol": s, "horizon": h, "reason": d.get("reason")})
            continue
        records.extend(d.get("records", []))
    for h in (5, 10, 21):
        rs = [r for r in records if r["horizon"] == h]
        if not rs:
            continue
        n = len(rs)
        k = sum(r["dir_correct"] for r in rs)
        preds = np.array([r["pred_return"] for r in rs])
        actuals = np.array([r["actual_return"] for r in rs])
        errs = preds - actuals
        pos = int((actuals > 0).sum())
        z = 1.96
        p_hat = k / n
        denom = 1 + z * z / n
        center = (p_hat + z * z / (2 * n)) / denom
        half = z * math.sqrt(p_hat * (1 - p_hat) / n + z * z / (4 * n * n)) / denom
        ss_res = float(np.sum(errs ** 2))
        ss_tot = float(np.sum((actuals - actuals.mean()) ** 2))
        by_horizon[h] = {
            "n": n, "symbols": len(set(r["symbol"] for r in rs)),
            "dir_correct": k, "dir_acc": round(p_hat, 4),
            "dir_acc_ci95": [round(center - half, 4), round(center + half, 4)],
            "mae": round(float(np.mean(np.abs(errs))), 6),
            "rmse": round(float(np.sqrt(ss_res / n)), 6),
            "r2": round(1 - ss_res / ss_tot, 4) if ss_tot else None,
            "zero_return_baseline_dir_acc": round(max(pos, n - pos) / n, 4),
            "mean_baseline_mae": round(float(np.mean(np.abs(actuals - actuals.mean()))), 6),
            "zero_baseline_mae": round(float(np.mean(np.abs(actuals))), 6),
            "positive_target_share": round(pos / n, 4),
        }
    overall_n = len(records)
    all_done = len(done) >= len(chunks)
    ctx.write("task96_moirai_results.json", {
        "task": "Task 96 Phase 3 (P0) — Moirai full OOS evaluation",
        "model": "Salesforce/moirai-1.1-R-small (official uni2ts 2.0 pipeline, torch 2.4.1+cpu isolated venv)",
        "status": ("official_inference_evaluated" if all_done and records
                   else f"evaluation_in_progress ({len(done)}/{len(chunks)} chunks)"),
        "protocol": "task93_eval_chronos.py mirror — OOS dates 2026-01-15..2026-10-15, "
                    "median of 100 samples at final step, context 180 bars; every target date fully "
                    "realized (idx+H < last session 2026-10-30); chronological targets, no leakage",
        "cohort": {"pilot25_symbols": pilot25, "task95_smoke_symbols_extra": ["WTL", "KEL", "FCCL", "ANL", "CNERGY"],
                   "horizons": [5, 10, 21], "n_per_symbol_horizon": 16},
        "by_horizon": by_horizon,
        "overall": {"n_predictions": overall_n,
                    "dir_acc": round(sum(r["dir_correct"] for r in records) / overall_n, 4) if overall_n else None},
        "skipped_symbols": skips,
        "chunks_done": len(done), "chunks_total": len(chunks),
        "prediction_files": sorted(p.name for p in (REPORTS / "predictions").glob("*.json")) or
                             ["chunk records in checkpoints/moirai_*.json"],
        "honesty": "OOS label only because targets are fully realized closes; n=16 per symbol-horizon is "
                   "small — no fine-tuning claim; official pretrained zero-shot inference only",
    })
    (REPORTS / "predictions" / "moirai_oos_predictions.json").write_text(json.dumps(records))
    ctx.log(f"aggregate: {len(done)}/{len(chunks)} chunks, {overall_n} scored predictions, "
            f"horizons scored: {sorted(by_horizon.keys())}")
