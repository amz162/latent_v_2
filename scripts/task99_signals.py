#!/usr/bin/env python3
"""Task 99 — generate BUY signals from final-test/val predictions for the
PSX strategy backtest (mirrors the Task 81 candidate contract):
predicted 5d forward return > SIGNAL_THRESHOLD (0.01, same as Task 81)."""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np

BASE = Path("data/backtest_reports/task99")
THRESHOLD = 0.01
H5 = 0  # horizon index for 5d


def emit(model_id: str, tag: str) -> dict:
    name = f"{model_id}__reference_full_config__{tag}"
    z = np.load(BASE / "predictions" / f"preds_{name}.npz")
    out = []
    for period, pk, yk, sk, dk in (
            ("final-test", "test_pred", "test_y", "test_sym", "test_date"),
            ("validation", "val_pred", "val_y", "val_sym", "val_date")):
        pred, sym, date = z[pk][:, H5], z[sk], z[dk]
        m = pred > THRESHOLD
        for s, d, p in zip(sym[m], date[m], pred[m]):
            out.append({"model": model_id, "symbol": str(s), "decisionDate": str(d),
                        "horizon": 5, "period": period, "predictedReturn": float(p)})
    return {"threshold": THRESHOLD, "note": "BUY when predicted 5d forward return > 1%; "
                                               "entry next session open; risk levels from risk-levels.ts; "
                                               "costs psx_user_schedule_v2",
            "candidates": out}


def main() -> None:
    sig = {}
    for mid in ("jw_reference_lstm", "jw_reference_cnn_lstm"):
        try:
            sig[mid] = emit(mid, "pilot25_h5_10_21")
            print(mid, "signals:", len(sig[mid]["candidates"]),
                  "(final-test:", sum(1 for c in sig[mid]["candidates"] if c["period"] == "final-test"), ")")
        except FileNotFoundError:
            print(mid, "no predictions yet")
    (BASE / "predictions" / "task99_signals.json").write_text(json.dumps(sig, indent=2))
    if not sig:
        raise SystemExit(1)  # no predictions yet — keep the runner job pending


if __name__ == "__main__":
    main()
