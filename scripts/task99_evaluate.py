#!/usr/bin/env python3
"""Task 99 — OOS evaluation, baselines, per-stock metrics, walk-forward report.

Evaluates the trained reference models on the untouched final-test partition
(and the validation partition separately), against SAME-SAMPLE baselines:
  - zero-return baseline (predict 0)
  - training-only mean-return baseline (per horizon)
  - Ridge regression on flattened sequences (fit on train, frozen)
  - LightGBM / XGBoost on flattened sequences (fit on train, frozen)
plus published Task 84 metrics for the existing Latent.pk LSTM / CNN-LSTM /
GRU (reported as REFERENCE-ONLY: their evaluation window differs, so they are
not pooled into the same-sample table).

All metrics per horizon (5d/10d/21d): MAE, RMSE, R² (negative preserved),
directional accuracy, n, symbol coverage, 95% CI on MAE (bootstrap, seed 42).
Final-test results are used ONLY for reporting (no tuning).
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np

BASE = Path("data/backtest_reports/task99")
MODELS_DIR = BASE / "models"
PRED_DIR = BASE / "predictions"
OUT = {}

HORIZONS = [5, 10, 21]
SEED = 42


def metrics(pred: np.ndarray, truth: np.ndarray) -> dict:
    err = pred - truth
    n = len(truth)
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    ss_res = float(np.sum(err ** 2))
    ss_tot = float(np.sum((truth - truth.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")
    diracc = float(np.mean(np.sign(pred) == np.sign(truth))) if n else float("nan")
    rng = np.random.default_rng(SEED)
    boots = [float(np.mean(np.abs(err[rng.integers(0, n, n)]))) for _ in range(500)]
    ci = [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]
    return {"n": int(n), "mae": round(mae, 6), "rmse": round(rmse, 6),
            "r2": round(r2, 6), "directional_accuracy": round(diracc, 4),
            "mae_ci95": [round(ci[0], 6), round(ci[1], 6)]}


def flat_matrix(X: np.ndarray) -> np.ndarray:
    return X.reshape(len(X), -1)


def baseline_models(Xtr, ytr, Xte, yte) -> dict:
    """Same-sample baselines on flattened sequences."""
    Ftr, Fte = flat_matrix(Xtr), flat_matrix(Xte)
    out = {}
    # zero-return
    out["zero_return"] = {h: metrics(np.zeros(len(yte)), yte[:, i])
                          for i, h in enumerate(HORIZONS)}
    # train-mean
    mu = ytr.mean(axis=0)
    out["train_mean_return"] = {h: metrics(np.full(len(yte), mu[i]), yte[:, i])
                                for i, h in enumerate(HORIZONS)}
    # ridge (frozen on train)
    from sklearn.linear_model import Ridge
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    imp = SimpleImputer(strategy="median").fit(Ftr)
    sc2 = StandardScaler().fit(imp.transform(Ftr))
    Ftr2, Fte2 = sc2.transform(imp.transform(Ftr)), sc2.transform(imp.transform(Fte))
    ridge = Ridge(alpha=10.0, random_state=SEED).fit(Ftr2, ytr)
    pr = ridge.predict(Fte2)
    out["ridge_flattened"] = {h: metrics(pr[:, i], yte[:, i]) for i, h in enumerate(HORIZONS)}
    # LightGBM / XGBoost per horizon (fit on train only)
    try:
        import lightgbm as lgb
        lg_out = {}
        for i, h in enumerate(HORIZONS):
            m = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=31,
                                  verbose=-1, random_state=SEED)
            m.fit(Ftr2, ytr[:, i])
            lg_out[h] = metrics(m.predict(Fte2), yte[:, i])
        out["lightgbm_flattened"] = lg_out
    except Exception as e:  # noqa: BLE001
        out["lightgbm_flattened"] = {"error": str(e)}
    try:
        import xgboost as xgb
        xg_out = {}
        for i, h in enumerate(HORIZONS):
            m = xgb.XGBRegressor(n_estimators=200, learning_rate=0.05, max_depth=6,
                                 random_state=SEED, verbosity=0, n_jobs=2)
            m.fit(Ftr2, ytr[:, i])
            xg_out[h] = metrics(m.predict(Fte2), yte[:, i])
        out["xgboost_flattened"] = xg_out
    except Exception as e:  # noqa: BLE001
        out["xgboost_flattened"] = {"error": str(e)}
    return out


def task84_reference_metrics() -> dict:
    """Existing-model published metrics — reference-only (different window)."""
    p = Path("data/backtest_reports/task84/task84_metrics.json")
    try:
        ar = json.loads(p.read_text())["allResults"]
    except Exception:
        return {}
    out = {}
    for name in ("LSTM", "CNN-LSTM", "GRU", "Ridge Regression", "LightGBM", "XGBoost"):
        m5 = (ar.get(name) or {}).get("metrics", {}).get("5d") or {}
        if m5:
            out[name] = {"5d": m5, "note": "Task 84 published evaluation window (13,731 pooled samples); NOT the same samples as task99 — reference-only."}
    return out


def per_stock(pred, y, syms, dates):
    out = {}
    for s in sorted(set(syms)):
        m = syms == s
        blk = {}
        for i, h in enumerate(HORIZONS):
            mm = metrics(pred[m, i], y[m, i])
            blk[h] = mm
        blk["date_range"] = [str(min(dates[m])), str(max(dates[m]))] if m.any() else None
        out[str(s)] = blk
    return out


def evaluate_model(model_id: str, config_name: str, dataset_tag: str) -> dict:
    name = f"{model_id}__{config_name}__{dataset_tag}"
    z = np.load(PRED_DIR / f"preds_{name}.npz")
    dmeta = json.loads((MODELS_DIR / f"dataset_{dataset_tag}.json").read_text())
    res = {"model_id": model_id, "config_name": config_name, "dataset_tag": dataset_tag,
           "horizons": HORIZONS, "date_ranges": dmeta["date_ranges"],
           "counts": dmeta["counts"], "n_features": dmeta["n_features"],
           "test_metrics": {}, "validation_metrics": {},
           "per_stock_final_test": {}, "per_stock_validation": {}}
    for part, pk, yk, sk, dk in (
            ("test_metrics", "test_pred", "test_y", "test_sym", "test_date"),
            ("validation_metrics", "val_pred", "val_y", "val_sym", "val_date")):
        pred, y = z[pk], z[yk]
        syms, dates = z[sk], z[dk]
        res[part] = {h: metrics(pred[:, i], y[:, i]) for i, h in enumerate(HORIZONS)}
        key = "per_stock_final_test" if part == "test_metrics" else "per_stock_validation"
        res[key] = per_stock(pred, y, syms, dates)
    return res


def main() -> None:
    results = {}
    for model_id, cn, tag in (("jw_reference_lstm", "reference_full_config", "pilot25_h5_10_21"),
                              ("jw_reference_cnn_lstm", "reference_full_config", "pilot25_h5_10_21")):
        name = f"{model_id}__{cn}__{tag}"
        if not (PRED_DIR / f"preds_{name}.npz").exists():
            print(f"skip {model_id}: no predictions yet")
            continue
        results[model_id] = evaluate_model(model_id, cn, tag)
    if not results:
        print("nothing to evaluate — training not finished yet")
        raise SystemExit(1)  # keep the runner job pending, never mark done
    # same-sample baselines on the first model's dataset
    z = np.load(MODELS_DIR / "dataset_pilot25_h5_10_21.npz")
    baselines = baseline_models(z["Xtr"], z["ytr"], z["Xte"], z["yte"])
    (BASE / "task99_baseline_comparison.json").write_text(json.dumps({
        "same_sample_baselines": baselines,
        "sample": {"dataset": "pilot25_h5_10_21", "n_test": int(len(z["yte"]))},
        "reference_only_published": task84_reference_metrics(),
    }, indent=2))
    for mid, r in results.items():
        fn = "task99_lstm_results.json" if "lstm" in mid and "cnn" not in mid else "task99_cnn_lstm_results.json"
        (BASE / fn).write_text(json.dumps(r, indent=2))
    # walk-forward style: validation period + final-test period per model
    wf = {mid: {"policy": "chronological expanding-window walk-forward; two evaluation periods "
                              "(validation period, final-test period); strict 21-session maturity purge",
                "periods": {"validation_period": r["validation_metrics"],
                            "final_test_period": r["test_metrics"]}}
          for mid, r in results.items()}
    (BASE / "task99_walk_forward_metrics.json").write_text(json.dumps(wf, indent=2))
    # per-stock matrix artifact (final-test, all horizons)
    ps = {mid: r["per_stock_final_test"] for mid, r in results.items()}
    (BASE / "task99_per_stock_metrics.json").write_text(json.dumps(ps, indent=2))
    print("evaluated:", ", ".join(results))


if __name__ == "__main__":
    main()
