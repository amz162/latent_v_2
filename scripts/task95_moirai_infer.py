#!/usr/bin/env python3
"""Task 95 Phase 6.3 — Moirai smoke inference with the OFFICIAL uni2ts pipeline.

Runs inside .moirai-venv (torch 2.4.1+cpu, uni2ts 2.0.0, gluonts 0.14.4).
Produces REAL zero-shot forecasts for 5 pilot symbols from the project DB and
saves raw outputs. This is evidence generation only — the model must NOT be
marked "evaluated" until a full OOS cohort run exists.
"""
import json
import sqlite3
import sys
import time
from pathlib import Path

BASE = Path("/home/z/my-project")
OUT = BASE / "data/backtest_reports/task95/predictions/moirai_smoke_forecasts.json"

SYMBOLS = ["WTL", "KEL", "FCCL", "ANL", "CNERGY"]
PRED_LEN = 5
CTX = 180

result = {"task": "Task 95 Phase 6.3 — Moirai official smoke inference",
          "model": "Salesforce/moirai-1.1-R-small (official checkpoint)",
          "pipeline": "uni2ts 2.0.0 MoiraiForecast.as_predictor (official transform/predictor)",
          "symbols": SYMBOLS, "prediction_length": PRED_LEN}

t0 = time.time()
try:
    import torch
    torch.set_num_threads(2)
    from gluonts.dataset.common import ListDataset
    from uni2ts.model.moirai import MoiraiForecast, MoiraiModule

    conn = sqlite3.connect(str(BASE / "db/custom.db"))
    series = {}
    for sym in SYMBOLS:
        rows = conn.execute(
            "SELECT date, close FROM OhlcvBar WHERE symbol=? ORDER BY date DESC LIMIT ?",
            (sym, CTX)).fetchall()
        rows = list(reversed(rows))
        series[sym] = {"dates": [r[0] for r in rows], "closes": [float(r[1]) for r in rows]}
    conn.close()
    result["context_bars"] = {s: len(v["closes"]) for s, v in series.items()}

    items = []
    for sym, v in series.items():
        if len(v["closes"]) >= 60:
            items.append({"start": v["dates"][0], "target": v["closes"], "item_id": sym})
    ds = ListDataset(items, freq="D")

    module = MoiraiModule.from_pretrained("Salesforce/moirai-1.1-R-small")
    model = MoiraiForecast(
        module=module, prediction_length=PRED_LEN, target_dim=1,
        feat_dynamic_real_dim=0, past_feat_dynamic_real_dim=0,
        context_length=CTX, patch_size="auto", num_samples=100,
    )
    predictor = model.as_predictor(batch_size=1)
    forecasts = {}
    for f in predictor.predict(ds):
        mean = [round(float(x), 6) for x in f.mean]
        last = float(f.samples[:, -1].mean())
        forecasts[str(f.item_id)] = {
            "last_context_close": series[str(f.item_id)]["closes"][-1],
            "last_context_date": series[str(f.item_id)]["dates"][-1],
            "forecast_mean_next5": mean,
            "sample_mean_last_step": round(last, 6),
        }
        f.samples = f.samples[:2]  # keep memory small
    result["forecasts"] = forecasts
    result["n_forecasts"] = len(forecasts)
    result["status"] = "real_forecasts_generated"
    result["note"] = ("zero-shot official inference OK — Moirai dependency blocker RESOLVED; "
                      "full OOS cohort evaluation required before any 'evaluated' status or metric claim")
    result["seconds"] = round(time.time() - t0, 1)
except Exception as e:
    result["status"] = "inference_failed"
    result["error"] = f"{type(e).__name__}: {e}"
    result["seconds"] = round(time.time() - t0, 1)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=1, default=str))
print(f"STATUS {result['status']} n={result.get('n_forecasts')} {result.get('error', '')[:200]}")
sys.exit(0 if result["status"] == "real_forecasts_generated" else 2)
