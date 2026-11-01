#!/usr/bin/env python3
"""Task 100 — OOS signal emission from frozen-protocol predictions.

Contract identical to scripts/task99_signals.py (BUY when predicted 5d forward
return > threshold; entry next session open; horizon-5 scan window; risk levels
from risk-levels.ts; costs psx_user_schedule_v2). Dates converted from epoch-ms
sample ids to the DB's YYYY-MM-DD bar dates.

Usage: task100_signals.py --models M1,M2 --thresholds 0.005,0.01,... --periods validation|both
"""
from __future__ import annotations
import argparse, gzip, json
from pathlib import Path
import pandas as pd

BASE = Path("data/backtest_reports/task100")
PRED = BASE / "predictions/frozen_comparison_step10.json.gz"


def emit(models: list[str], thresholds: list[float], periods: str) -> None:
    fr = json.load(gzip.open(PRED, "rt"))
    comp = json.load(open(BASE / "task100_model_comparison.json"))
    out_dir = BASE / "predictions"
    out_dir.mkdir(parents=True, exist_ok=True)
    for m in models:
        comp5 = comp["models"].get(m, {}).get("validation", {}).get("5", {})
        for thr in thresholds:
            sig = {"threshold": thr, "source": "frozen_comparison_step10.json.gz",
                   "val_5d_mae": comp5.get("mae"), "candidates": []}
            for part_file, part_name in (("validation", "validation"), ("final_test", "final-test")):
                if periods == "validation" and part_name != "validation":
                    continue
                pmap = fr["predictions"][m][part_file].get("5", {})
                amap = fr["actuals"][part_file]["5"]
                sids = {s["sample_id"]: s for s in fr["samples"][part_file]}
                for sid, p in pmap.items():
                    if sid not in amap or sid not in sids:
                        continue
                    if p > thr:
                        s = sids[sid]
                        sig["candidates"].append({
                            "model": m, "symbol": s["stock"],
                            "decisionDate": pd.to_datetime(s["date"], unit="ms", utc=True).strftime("%Y-%m-%d"),
                            "horizon": 5, "period": part_name, "predictedReturn": round(float(p), 6),
                        })
            name = f"signals_{m}__thr{thr}__{periods}.json"
            (out_dir / name).write_text(json.dumps({m: sig}, indent=1))
            n_val = sum(1 for c in sig["candidates"] if c["period"] == "validation")
            print(f"{name}: {n_val} validation / {len(sig['candidates']) - n_val} final-test")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--thresholds", default="0.005,0.01,0.02,0.03,0.05")
    ap.add_argument("--periods", default="validation", choices=["validation", "both"])
    a = ap.parse_args()
    emit(a.models.split(","), [float(t) for t in a.thresholds.split(",")], a.periods)


if __name__ == "__main__":
    main()
