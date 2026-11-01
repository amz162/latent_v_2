#!/usr/bin/env python3
"""Task 99 — evaluate the original-style 1-day-ahead reproduction experiment
(jw_reference_lstm, reference_cpu_compact, canonical8, output_dim=1).
Labelled separately: this is the REFERENCE's next-day target, NOT the
5d/10d/21d primary adaptation metrics."""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np

BASE = Path("data/backtest_reports/task99")
NAME = "jw_reference_lstm__reference_cpu_compact__canonical8_h1_repro"


def main() -> None:
    z = np.load(BASE / "predictions" / f"preds_{NAME}.npz")
    pred, y, syms = z["test_pred"][:, 0], z["test_y"][:, 0], z["test_sym"]
    per = {}
    for s in sorted(set(syms)):
        m = syms == s
        e = pred[m] - y[m]
        per[str(s)] = {
            "n": int(m.sum()),
            "mae": round(float(np.mean(np.abs(e))), 6),
            "rmse": round(float(np.sqrt(np.mean(e ** 2))), 6),
            "directional_accuracy": round(float(np.mean(np.sign(pred[m]) == np.sign(y[m]))), 4),
        }
    overall = {
        "n": int(len(pred)),
        "mae": round(float(np.mean(np.abs(pred - y))), 6),
        "rmse": round(float(np.sqrt(np.mean((pred - y) ** 2))), 6),
        "directional_accuracy": round(float(np.mean(np.sign(pred) == np.sign(y))), 4),
        "note": ("pooled next-day FORWARD-RETURN regression (1d), reference-style single-horizon target; "
                 "raw price MAE across differently priced securities is NOT comparable and is not reported"),
    }
    out_path = BASE / "task99_lstm_results.json"
    res = json.loads(out_path.read_text())
    res["reference_reproduction_1d"] = {
        "config": "reference_cpu_compact (documented; compact profile)",
        "dataset": "canonical8_h1_repro",
        "target": "next-session forward return (reference used next-day close PRICE; returns are the "
                  "reference README's own suggested improvement — price MAE not pooled across stocks)",
        "final_test_overall": overall,
        "per_stock": per,
    }
    out_path.write_text(json.dumps(res, indent=2))
    print("1d repro overall:", overall["n"], overall["mae"], overall["directional_accuracy"])


if __name__ == "__main__":
    main()
