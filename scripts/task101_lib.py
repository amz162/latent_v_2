#!/usr/bin/env python3
"""Task 101 — shared library. Wraps Task 100 machinery (imported from
scripts/task100_lib.py, which wraps the Task 54 walk-forward engine) and adds:
  - task101 artifact/progress writers
  - cost-aware trade-outcome label loading (TS engine output)
  - statistical/scalable model additions (LinearSVR as a separate
    implementation from RBF SVR; bounded ARIMA/Holt-Winters/EWMA helpers)
All commands bounded by the 150s sandbox limit; phases resumable.
"""
from __future__ import annotations
import json, os, sys, time, subprocess
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

BASE = ROOT / "data/backtest_reports/task101"
PROGRESS_FILE = BASE / "task101_progress.json"
PLAN_FILE = BASE / "task101_execution_plan.json"
LABELS_DIR = BASE / "trade_outcome_labels"
MODELS_DIR = BASE / "models"
PREDICTIONS_DIR = BASE / "predictions"
CHECKPOINTS = BASE / "checkpoints"
BATCH_LOGS = BASE / "batch_logs"

HORIZONS = [5, 10, 21]
MAX_HORIZON = 21


def _jd(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, float) and np.isnan(o):
        return None
    if isinstance(o, np.ndarray):
        return o.tolist()
    return str(o)


def write_artifact(name: str, obj) -> Path:
    p = BASE / name
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, default=_jd))
    tmp.replace(p)
    return p


def update_progress(phase: str, status: str, detail: str = "", artifact: str | None = None):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    prog = {}
    if PROGRESS_FILE.exists():
        try:
            prog = json.loads(PROGRESS_FILE.read_text())
        except Exception:
            prog = {}
    prog.setdefault("phases", {})
    prog["phases"][phase] = {"status": status, "detail": str(detail)[:400], "artifact": artifact,
                              "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime())}
    prog["last_phase"] = phase
    tmp = PROGRESS_FILE.with_name("tmp.json")
    tmp.write_text(json.dumps(prog, indent=2, default=_jd))
    tmp.replace(PROGRESS_FILE)


def run_ts(script: str, out: Path, env_extra: dict | None = None, timeout: int = 140) -> bool:
    env = {**os.environ, **(env_extra or {})}
    r = subprocess.run(["bun", f"scripts/{script}"], cwd=ROOT, env=env,
                       capture_output=True, text=True, timeout=timeout)
    (BATCH_LOGS / f"ts_{script}_{int(time.time())}.log").write_text(
        (r.stdout or "") + "\nSTDERR:\n" + (r.stderr or ""))
    return r.returncode == 0 and out.exists()


# ── scalable / statistical models (all bounded, resource-aware) ──────────────

def fit_model101(name: str, Xtr, ytr, sample_cap: int = 20000):
    """Task 101 model factory. SVR: RBF-SVR on a bounded representative subset
    (documented subsample, NOT LinearSVR); LinearSVR is a separate model id."""
    from sklearn.svm import SVR, LinearSVR
    from sklearn.linear_model import Ridge, LogisticRegression
    from sklearn.ensemble import HistGradientBoostingRegressor
    import lightgbm as lgb
    X = np.asarray(Xtr, dtype=np.float64)
    y = np.asarray(ytr, dtype=np.float64)
    if name in ("SVR", "LinearSVR", "SVR_rbf_bounded") and len(X) > sample_cap:
        rng = np.random.default_rng(42)
        idx = np.sort(rng.choice(len(X), sample_cap, replace=False))
        X, y = X[idx], y[idx]
    if name == "SVR" or name == "SVR_rbf_bounded":
        m = SVR(kernel="rbf", C=1.0, epsilon=0.01, cache_size=200)
    elif name == "LinearSVR":
        m = LinearSVR(C=0.1, epsilon=0.005, max_iter=2000, random_state=42)
    elif name == "Ridge":
        m = Ridge(alpha=1.0, random_state=42)
    elif name == "HistGradientBoosting":
        m = HistGradientBoostingRegressor(max_iter=150, max_depth=3, learning_rate=0.05,
                                          min_samples_leaf=20, l2_regularization=1.0, random_state=42)
    elif name == "LightGBM":
        m = lgb.LGBMRegressor(n_estimators=100, num_leaves=15, learning_rate=0.05,
                              min_child_samples=20, reg_alpha=0.5, reg_lambda=2.0,
                              random_state=42, verbose=-1)
    elif name == "LogisticRegression":
        m = LogisticRegression(max_iter=1000, C=0.5, random_state=42)
    else:
        raise ValueError(f"unknown model {name}")
    m.fit(X, y)
    return m


def holt_winters_forecast(close: pd.Series, horizon: int) -> float | None:
    """Bounded Holt-Winters (additive damped trend) via statsmodels if available."""
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        s = close.iloc[-250:].astype(float)
        if len(s) < 60:
            return None
        m = ExponentialSmoothing(s.values, trend="add", damped_trend=True,
                                 initialization_method="estimated").fit(optimized=True)
        return float(m.forecast(horizon)[-1])
    except Exception:
        return None


def arima_forecast(close: pd.Series, horizon: int, order=(1, 0, 0)) -> float | None:
    """Bounded ARIMA(1,0,0) on log price; returns expected horizon-ahead log return."""
    try:
        from statsmodels.tsa.arima.model import ARIMA
        s = np.log(close.iloc[-300:].astype(float).values)
        if len(s) < 60:
            return None
        m = ARIMA(s, order=order).fit()
        f = m.forecast(steps=horizon)
        return float(f[-1] - s[-1])
    except Exception:
        return None


def ewma_vol_forecast(returns: pd.Series, lam: float = 0.94) -> float | None:
    r = returns.dropna().iloc[-250:].astype(float)
    if len(r) < 30:
        return None
    return float(np.sqrt(lam * (r ** 2).iloc[::-1].cumsum().iloc[-1]))
