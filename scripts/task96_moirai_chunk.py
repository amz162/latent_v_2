#!/usr/bin/env python3
"""Task 96 Phase 3 — Moirai full OOS evaluation, resumable per (symbol, horizon) chunk.

Mirrors the Chronos evaluation protocol exactly (task93_eval_chronos.py):
  - evenly-spaced OOS dates in 2026-01-15..2026-10-15
  - pred_return = (median of forecast samples at final step / last close) - 1
  - actual_return = (close[idx+H] / last_close) - 1  (target fully realized by construction)
  - dir_correct = sign match

Run inside .moirai-venv:  .moirai-venv/bin/python scripts/task96_moirai_chunk.py --symbol X --horizon 5
Writes data/backtest_reports/task96/checkpoints/moirai_{sym}_{h}d.json (idempotent).
"""
import argparse
import json
import math
import sqlite3
import time
from pathlib import Path

BASE = Path("/home/z/my-project")
CKPT = BASE / "data/backtest_reports/task96/checkpoints"

OOS_START = "2026-01-15"
OOS_END = "2026-10-15"
N_PER_SYM = 16
CTX_LEN = 180

p = argparse.ArgumentParser()
p.add_argument("--symbol", required=True)
p.add_argument("--horizon", type=int, required=True, choices=[5, 10, 21])
p.add_argument("--cohort", default="pilot25")
args = p.parse_args()

out_path = CKPT / f"moirai_{args.symbol}_{args.horizon}d.json"
if out_path.exists():
    print(json.dumps(json.loads(out_path.read_text())["summary"]))
    raise SystemExit(0)

import numpy as np
import pandas as pd
import torch

torch.set_num_threads(2)
t0 = time.time()

conn = sqlite3.connect(str(BASE / "db/custom.db"))
df = pd.read_sql("SELECT date, close FROM OhlcvBar WHERE symbol=? ORDER BY date ASC",
                 conn, params=(args.symbol,))
conn.close()
if len(df) < CTX_LEN + args.horizon + 10:
    out_path.write_text(json.dumps({
        "symbol": args.symbol, "horizon": args.horizon, "cohort": args.cohort,
        "status": "insufficient_history", "bars": len(df),
        "reason": f"needs >= {CTX_LEN + args.horizon + 10} bars, has {len(df)}",
    }))
    print(f"SKIP {args.symbol} insufficient history ({len(df)} bars)")
    raise SystemExit(0)

df["date"] = pd.to_datetime(df["date"])
df = df.reset_index(drop=True)
closes = df["close"].values.astype(float)
dates = df["date"].values

# evenly spaced OOS dates (same algorithm as task93_eval_chronos.py)
sub = df[(df["date"] >= OOS_START) & (df["date"] <= OOS_END)]
if len(sub) < N_PER_SYM + args.horizon + 5:
    sub = df.tail(N_PER_SYM + args.horizon + 5)
if len(sub) <= N_PER_SYM:
    idxs = sub.index.tolist()
else:
    step = (len(sub) - args.horizon - 5) // max(1, N_PER_SYM - 1)
    idxs = list(range(sub.index[0] + 5, sub.index[-1] - args.horizon, max(1, step)))[:N_PER_SYM]
idxs = [i for i in idxs if i >= CTX_LEN and i + args.horizon < len(closes)]

from gluonts.dataset.common import ListDataset
from uni2ts.model.moirai import MoiraiForecast, MoiraiModule

module = MoiraiModule.from_pretrained("Salesforce/moirai-1.1-R-small")
model = MoiraiForecast(
    module=module, prediction_length=args.horizon, target_dim=1,
    feat_dynamic_real_dim=0, past_feat_dynamic_real_dim=0,
    context_length=CTX_LEN, patch_size="auto", num_samples=100,
)
predictor = model.create_predictor(batch_size=4, device="cpu")

items, meta = [], []
for idx in idxs:
    ctx = closes[idx - CTX_LEN: idx]
    if np.any(np.isnan(ctx)) or ctx[-1] <= 0:
        continue
    items.append({"start": pd.Timestamp(dates[idx - CTX_LEN]).strftime("%Y-%m-%d"),
                  "target": list(ctx), "item_id": str(idx)})
    meta.append(idx)

ds = ListDataset(items, freq="D")
records, sym_correct = [], 0
for f in predictor.predict(ds):
    idx = int(f.item_id)
    med = float(np.median(f.samples[:, -1]))
    last_close = closes[idx - 1]
    pred_ret = med / last_close - 1.0
    actual_ret = closes[idx + args.horizon] / last_close - 1.0
    correct = int((pred_ret > 0) == (actual_ret > 0))
    sym_correct += correct
    records.append({
        "symbol": args.symbol, "date": pd.Timestamp(dates[idx]).strftime("%Y-%m-%d"),
        "horizon": args.horizon, "last_close": float(last_close),
        "pred_median": med, "pred_return": float(pred_ret),
        "actual_return": float(actual_ret), "dir_correct": correct,
    })

n = len(records)
k = sum(r["dir_correct"] for r in records)
preds = np.array([r["pred_return"] for r in records]) if n else np.array([0.0])
actuals = np.array([r["actual_return"] for r in records]) if n else np.array([0.0])
errs = preds - actuals
summary = {
    "symbol": args.symbol, "horizon": args.horizon, "cohort": args.cohort,
    "n": n, "dir_correct": k, "dir_acc": round(k / n, 4) if n else None,
    "mae": round(float(np.mean(np.abs(errs))), 6) if n else None,
    "rmse": round(float(np.sqrt(np.mean(errs ** 2))), 6) if n else None,
}
out = {
    "symbol": args.symbol, "horizon": args.horizon, "cohort": args.cohort,
    "model": "Salesforce/moirai-1.1-R-small (official uni2ts pipeline)",
    "protocol": "task93_eval_chronos.py mirror: OOS 2026-01-15..2026-10-15, median final-step, "
                f"context {CTX_LEN}, 100 samples; targets fully realized (idx+H < last session)",
    "records": records, "summary": summary, "seconds": round(time.time() - t0, 1),
}
out_path.write_text(json.dumps(out))
print(f"DONE {args.symbol} h={args.horizon}: n={n} dir_acc={summary['dir_acc']} mae={summary['mae']} in {out['seconds']}s")
