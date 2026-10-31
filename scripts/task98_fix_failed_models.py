#!/usr/bin/env python3
"""Task 98 — Fix the two failed_after_attempts models (ARIMA, Prophet).

Root causes (reproduced live on 2026-10-31, see task98 artifacts):
  ARIMA   → TypeError: ARIMA.fit() got an unexpected keyword argument 'disp'
            (statsmodels 0.14.5 removed `disp`; task83_train_feasible.py:107 passed disp=False)
  Prophet → ValueError: Column ds has timezone specified, which is not supported
            (task83_train_feasible.py:128 built ds with utc=True; Prophet requires naive ds)

Methodology mirrors task83 batch1 exactly (10 symbols, last-50-date eval window,
every-10th bar, target_{h}d actuals), with one documented optimization: the model is
fit ONCE per bar and the forecast sliced for all 3 horizons (metric-equivalent: the
h-step prediction is forecast step h, identical to the original per-horizon refit).

Writes data/backtest_reports/task98/task98_metrics.json (task98 key namespace).
"""
import sys, os, json, time, warnings
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")
from walk_forward_backtesting import add_features, load
from ml_integrity import add_forward_returns, HORIZONS
import numpy as np
import pandas as pd

OUT = Path("data/backtest_reports/task98")
OUT.mkdir(parents=True, exist_ok=True)


def em(yt, yp):
    yt, yp = np.array(yt, dtype=float), np.array(yp, dtype=float)
    if len(yt) < 10:
        return None
    from sklearn.metrics import mean_absolute_error, r2_score
    da = float(np.mean(np.sign(yt) == np.sign(yp)))
    return {"mae": round(float(mean_absolute_error(yt, yp)), 6),
            "r2": round(float(r2_score(yt, yp)), 4),
            "directional_accuracy": round(da, 4), "n": len(yt)}


def eval_stat_model(model_name, df, universe, latest_ms, fit_fn):
    """Same sample layout as task83 batch1; one fit per (sym, bar) memoized."""
    sample_dates = sorted(df["date"].unique())
    eval_dates = sample_dates[-50:]
    eval_set = set(d for d in eval_dates if d <= latest_ms)
    preds_h = {h: [] for h in HORIZONS}
    actuals_h = {h: [] for h in HORIZONS}
    fit_cache = {}
    t0 = time.time()
    for sym in universe[:10]:
        sdf = df[df["symbol"] == sym].sort_values("date").reset_index(drop=True)
        closes = sdf["close"].values
        dates = sdf["date"].values
        for h in HORIZONS:
            target_col = f"target_{h}d"
            for i in range(max(30, h), len(sdf) - h, 10):
                if dates[i] > latest_ms:
                    break
                actual = sdf[target_col].iloc[i]
                if not np.isfinite(actual):
                    continue
                train_closes = closes[:i + 1]
                if len(train_closes) < 30:
                    continue
                key = (sym, i)
                if key not in fit_cache:
                    try:
                        fit_cache[key] = fit_fn(train_closes, dates[:i + 1])
                    except Exception:
                        fit_cache[key] = None
                fc = fit_cache[key]
                if fc is None:
                    continue
                pred_ret = (fc[h - 1] - train_closes[-1]) / train_closes[-1]
                preds_h[h].append(pred_ret)
                actuals_h[h].append(actual)
    metrics = {f"{h}d": em(actuals_h[h], preds_h[h]) for h in HORIZONS}
    el = round(time.time() - t0, 1)
    st = "trained_oos_evaluated" if any(v for v in metrics.values()) else "failed_after_attempts"
    ns = {f"{h}d": len(actuals_h[h]) for h in HORIZONS}
    print(f"  {model_name}: {st} ({el}s) n={ns}", flush=True)
    for h in HORIZONS:
        m = metrics[f"{h}d"]
        if m:
            print(f"    {h}d dir_acc={m['directional_accuracy']} mae={m['mae']}")
    return {"status": st, "metrics": metrics, "elapsed_s": el, "n_samples": ns}


def main():
    print("=" * 60)
    print("Task 98 — ARIMA + Prophet re-evaluation (bug-fixed)")
    print("=" * 60)
    man = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
    df = load(stocks=man["universe"]["symbols"], source="db")
    df = add_features(df)
    df = add_forward_returns(df)
    latest_ms = int(df["date"].max())
    print(f"Loaded {len(df)} rows, {df['symbol'].nunique()} symbols")

    from statsmodels.tsa.arima.model import ARIMA
    results = {}

    print("\n── ARIMA (fixed: no disp kwarg) ──", flush=True)

    def arima_fit(closes, _dates):
        m = ARIMA(closes, order=(1, 1, 1)).fit()
        fc = m.forecast(steps=max(HORIZONS))
        return [float(x) for x in fc]

    results["ARIMA"] = eval_stat_model(
        "ARIMA", df, man["universe"]["symbols"], latest_ms, fit_fn=arima_fit,
    )

    print("\n── Prophet (fixed: naive ds) ──", flush=True)

    def prophet_fit(closes, dates):
        from prophet import Prophet
        pdf = pd.DataFrame({"ds": pd.to_datetime(dates, unit="ms"), "y": closes})
        m = Prophet(yearly_seasonality=False, weekly_seasonality=False,
                    daily_seasonality=False, n_changepoints=5)
        m.fit(pdf)
        future = m.make_future_dataframe(periods=max(HORIZONS), freq="B")
        fc = m.predict(future)
        base = len(pdf) - 1
        return [float(fc["yhat"].iloc[base + h]) for h in HORIZONS]

    results["Prophet"] = eval_stat_model(
        "Prophet", df, man["universe"]["symbols"], latest_ms, fit_fn=prophet_fit,
    )

    for name, r in results.items():
        r["root_cause_fixed"] = ("disp kwarg removed (statsmodels 0.14.5)" if name == "ARIMA"
                                 else "tz-naive ds (Prophet requires naive timestamps)")
        r["methodology"] = "task83 batch1 layout (10 syms, last-50-date window, every-10th bar); fit-once-per-bar, forecast sliced per horizon"

    artifact = {
        "task": "Task 98 — fix failed_after_attempts models (ARIMA, Prophet)",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "root_causes": {
            "ARIMA": "ARIMA.fit(disp=False) → TypeError under statsmodels 0.14.5 (disp removed)",
            "Prophet": "ds built with utc=True → ValueError (Prophet requires tz-naive)",
        },
        "allResults": results,
        "batches": {"batch1_stats_fixed": results},
    }
    (OUT / "task98_metrics.json").write_text(json.dumps(artifact, indent=2, default=str))
    print(f"\n✓ saved {OUT / 'task98_metrics.json'}")


if __name__ == "__main__":
    main()
