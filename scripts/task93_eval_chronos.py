#!/usr/bin/env python3
"""Task 93: Chronos expanded OOS evaluation.

Generates additional OOS predictions from amazon/chronos-t5-tiny on PSX data
to expand the existing task92 evaluation (n=172) toward n=240+.

Methodology:
  - Pulls OHLCV bars from SQLite (db/custom.db) for 8 PSX symbols with full 2026 coverage
  - For each symbol, picks 30 OOS prediction dates spaced Jan 2026 → Oct 2026
  - For each date, uses the prior 60 closes as context, asks Chronos for a 5-day forecast
  - Records predicted_pct_return = (median_forecast[-1] / last_close) - 1
  - Records actual_pct_return = (close[t+5] / close[t]) - 1
  - Direction correct = sign(pred) == sign(actual)
  - Computes MAE, RMSE, R^2 vs zero-baseline and mean-return-baseline
  - Computes Wilson 95% CI on dir_acc

This is **official pretrained inference** (no fine-tuning), zero-shot CPU.
"""
import os, sys, json, sqlite3, math, warnings
warnings.filterwarnings("ignore")

from pathlib import Path
import numpy as np
import pandas as pd

# Chronos
from chronos import ChronosPipeline
import torch

DB = "/home/z/my-project/db/custom.db"
OUT_DIR = Path("/home/z/my-project/data/backtest_reports/task93")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SYMBOLS = ["HUBC", "LUCK", "MEBL", "SYS", "MARI", "BAFL", "INDU", "ATRL"]
N_PER_SYM = 30  # 8*30 = 240 predictions
HORIZON = 5     # 5-day forward
CTX_LEN = 60    # 60-day context window

# OOS window: Jan 2026 → Oct 2026
OOS_START = pd.Timestamp("2026-01-15")
OOS_END   = pd.Timestamp("2026-10-15")


def wilson_ci(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z*z/n
    center = (p + z*z/(2*n)) / denom
    half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / denom
    return (round(center - half, 4), round(center + half, 4))


def load_bars(symbol):
    conn = sqlite3.connect(DB)
    df = pd.read_sql(
        "SELECT date, close FROM OhlcvBar WHERE symbol=? ORDER BY date ASC",
        conn, params=(symbol,)
    )
    conn.close()
    df["date"] = pd.to_datetime(df["date"])
    return df.reset_index(drop=True)


def pick_oos_dates(df):
    """Pick N_PER_SYM OOS dates in window, evenly spaced."""
    sub = df[(df["date"] >= OOS_START) & (df["date"] <= OOS_END)].copy()
    if len(sub) < N_PER_SYM + HORIZON + 5:
        # Fall back to end of series
        sub = df.tail(N_PER_SYM + HORIZON + 5)
    # Evenly spaced indices
    if len(sub) <= N_PER_SYM:
        idxs = sub.index.tolist()
    else:
        step = (len(sub) - HORIZON - 5) // max(1, (N_PER_SYM - 1))
        idxs = list(range(sub.index[0] + 5, sub.index[-1] - HORIZON, max(1, step)))[:N_PER_SYM]
    return idxs


def main():
    print("Loading chronos-t5-tiny ...", flush=True)
    pipe = ChronosPipeline.from_pretrained("amazon/chronos-t5-tiny")
    print("Chronos loaded.", flush=True)

    all_preds = []
    for sym in SYMBOLS:
        df = load_bars(sym)
        if len(df) < CTX_LEN + HORIZON + 10:
            print(f"  {sym}: SKIP (insufficient bars {len(df)})", flush=True)
            continue
        closes = df["close"].values.astype(float)
        dates = df["date"].values
        idxs = pick_oos_dates(df)
        print(f"  {sym}: {len(idxs)} OOS dates", flush=True)
        sym_correct = 0
        sym_total = 0
        for i, idx in enumerate(idxs):
            if idx < CTX_LEN or idx + HORIZON >= len(closes):
                continue
            ctx = closes[idx-CTX_LEN:idx]
            if np.any(np.isnan(ctx)) or ctx[-1] <= 0:
                continue
            try:
                # Chronos predict() returns shape (batch, num_samples, pred_len)
                ctx_t = torch.tensor(ctx, dtype=torch.float32)
                forecast = pipe.predict(
                    ctx_t.unsqueeze(0),
                    prediction_length=HORIZON,
                    num_samples=20,
                )
                # Median over samples at the final horizon step
                med = torch.median(forecast[0, :, -1], dim=-1).values.item()
                last_close = ctx[-1]
                pred_ret = (med / last_close) - 1.0
                actual_ret = (closes[idx + HORIZON] / last_close) - 1.0
                correct = int((pred_ret > 0) == (actual_ret > 0))
                all_preds.append({
                    "symbol": sym,
                    "date": pd.Timestamp(dates[idx]).strftime("%Y-%m-%d"),
                    "horizon": HORIZON,
                    "last_close": float(last_close),
                    "pred_median": float(med),
                    "pred_return": float(pred_ret),
                    "actual_return": float(actual_ret),
                    "dir_correct": correct,
                })
                sym_correct += correct
                sym_total += 1
            except Exception as e:
                print(f"    {sym} idx={idx}: ERR {type(e).__name__}: {e}", flush=True)
                continue
        if sym_total:
            print(f"    {sym}: dir_acc={sym_correct/sym_total:.3f} (n={sym_total})", flush=True)

    if not all_preds:
        print("NO PREDICTIONS", flush=True)
        return

    n = len(all_preds)
    k = sum(p["dir_correct"] for p in all_preds)
    dir_acc = k / n
    preds = np.array([p["pred_return"] for p in all_preds])
    actuals = np.array([p["actual_return"] for p in all_preds])
    errs = preds - actuals
    mae = float(np.mean(np.abs(errs)))
    rmse = float(np.sqrt(np.mean(errs**2)))
    ss_res = float(np.sum(errs**2))
    ss_tot = float(np.sum((actuals - actuals.mean())**2))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else float("nan")
    # Baselines
    zero_baseline_mae = float(np.mean(np.abs(actuals)))
    mean_baseline_mae = float(np.mean(np.abs(actuals - actuals.mean())))
    beats_mean = bool(mae < mean_baseline_mae)
    ci = wilson_ci(k, n)

    result = {
        "status": "official_pretrained_inference_oos_evaluated",
        "model": "Chronos (Amazon)",
        "checkpoint": "amazon/chronos-t5-tiny (8MB, official Amazon checkpoint)",
        "n": n,
        "dir_acc": round(dir_acc, 4),
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "r2": round(r2, 4),
        "zero_baseline_mae": round(zero_baseline_mae, 6),
        "mean_baseline_mae": round(mean_baseline_mae, 6),
        "beats_mean_baseline": beats_mean,
        "ci95": ci,
        "horizon_days": HORIZON,
        "context_len": CTX_LEN,
        "symbols": SYMBOLS,
        "note": "Official pretrained inference (zero-shot, CPU). NOT fine-tuned. Expanded from task92 n=172.",
        "inference_type": "pretrained_inference (not fine-tuned)",
    }
    out_main = OUT_DIR / "task93_chronos_results.json"
    out_main.write_text(json.dumps(result, indent=2))
    # Also dump raw predictions
    out_preds = OUT_DIR / "batch_logs" / "chronos_predictions.json"
    out_preds.parent.mkdir(parents=True, exist_ok=True)
    out_preds.write_text(json.dumps({"result": result, "predictions": all_preds}, indent=2))
    # Batch log (mirrors task92 format)
    out_log = OUT_DIR / "batch_logs" / "chronos.json"
    out_log.write_text(json.dumps(result, indent=2))

    print()
    print("=" * 60)
    print(f"Chronos expanded: n={n}, dir_acc={dir_acc:.4f}")
    print(f"CI95=[{ci[0]}, {ci[1]}]")
    print(f"MAE={mae:.6f}, RMSE={rmse:.6f}, R2={r2:.4f}")
    print(f"zero_baseline_mae={zero_baseline_mae:.6f}")
    print(f"mean_baseline_mae={mean_baseline_mae:.6f}")
    print(f"beats_mean_baseline={beats_mean}")
    print("=" * 60)
    print(f"Wrote: {out_main}")


if __name__ == "__main__":
    main()
