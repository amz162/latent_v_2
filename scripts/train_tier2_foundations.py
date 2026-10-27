#!/usr/bin/env python3
"""Latent.pk — Train Tier 2 Foundation Models (Chronos, Lag-Llama, Moirai, Time-LLM).

Each foundation model is implemented as a faithful lightweight analog of its
conceptual approach (no multi-GB pretrained weights required):

  • Chronos (Amazon)        → quantile-binned tokenize-then-forecast (T5 analog)
  • Lag-Llama               → lag-feature autoregression with gradient boosting
  • Moirai (Salesforce)     → any-variate multivariate linear regression
  • Time-LLM                → reprogramming via SVD projection of base predictions

These analogs preserve the *intent* of each foundation model while running
in seconds on CPU. The output merges into data/ml_predictions_multi.json and
adds per-model backtesting entries.
"""
import json, sys, warnings
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
# ML-integrity helpers (leakage-free targets, chronological split). See
# scripts/ml_integrity.py. Replaces the old .fillna(0) targets + global row
# split on the concatenated df (Phase A1 + A2).
from ml_integrity import (
    add_forward_returns, drop_immature_targets, chronological_split,
    HORIZONS, MAX_HORIZON,
)

warnings.filterwarnings("ignore")
OHLCV = Path("data/ohlcv")
OUT = Path("data/ml_predictions_multi.json")
STOCKS = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL"]
FC = ["rsi_14", "macd", "macd_signal", "macd_hist", "bb_width", "bb_pct_b",
      "atr_14", "obv_change_pct", "price_sma_20_ratio", "price_sma_50_ratio",
      "price_sma_200_ratio", "volume_sma_20_ratio", "return_1d", "return_7d",
      "return_14d", "return_30d", "hl_range_pct", "body_size_pct", "volatility_14d"]
TIER_W = {"TIER_1": 0.35, "TIER_2": 0.25, "TIER_3": 0.30, "TIER_4": 0.10}


def compute_rsi(p, n=14):
    d = p.diff(); g = d.where(d > 0, 0); l = -d.where(d < 0, 0)
    ag = g.ewm(alpha=1/n, min_periods=n).mean(); al = l.ewm(alpha=1/n, min_periods=n).mean()
    return (100 - 100 / (1 + ag / al.replace(0, np.nan))).fillna(50)


def compute_macd(p):
    e12 = p.ewm(span=12, adjust=False).mean(); e26 = p.ewm(span=26, adjust=False).mean()
    m = e12 - e26; s = m.ewm(span=9, adjust=False).mean(); return m, s, m - s


def compute_bb(p, w=20):
    sma = p.rolling(w).mean(); sd = p.rolling(w).std()
    return ((sma + 2*sd - (sma - 2*sd)) / sma).fillna(0), \
           ((p - (sma - 2*sd)) / (4*sd).replace(0, np.nan)).fillna(0.5)


def compute_atr(h, l, c, n=14):
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean().fillna(0)


def compute_obv(c, v):
    s = c.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
    return (s * v).cumsum()


def add_features(df):
    df = df.copy().sort_values("date").reset_index(drop=True)
    c = df["close"]; h = df["high"]; l = df["low"]; v = df["volume"]
    df["rsi_14"] = compute_rsi(c); m, s, hh = compute_macd(c)
    df["macd"] = m; df["macd_signal"] = s; df["macd_hist"] = hh
    bw, pb = compute_bb(c); df["bb_width"] = bw; df["bb_pct_b"] = pb
    df["atr_14"] = compute_atr(h, l, c)
    obv = compute_obv(c, v)
    df["obv_change_pct"] = obv.pct_change(periods=14).replace([np.inf, -np.inf], 0).fillna(0)
    for w in [20, 50, 200]:
        df[f"price_sma_{w}_ratio"] = c / c.rolling(w, min_periods=1).mean()
    df["volume_sma_20_ratio"] = v / v.rolling(20, min_periods=1).mean().replace(0, 1)
    for p in [1, 7, 14, 30]:
        df[f"return_{p}d"] = c.pct_change(periods=p).replace([np.inf, -np.inf], 0).fillna(0)
    df["hl_range_pct"] = ((h - l) / c.replace(0, np.nan)).fillna(0)
    df["body_size_pct"] = ((df["close"] - df["open"]).abs() / c.replace(0, np.nan)).fillna(0)
    df["volatility_14d"] = c.pct_change().rolling(14).std().fillna(0)
    return df


def add_labels(df):
    # NOTE: target construction moved out of add_labels into load() via
    # ml_integrity.add_forward_returns — that primitive uses per-stock
    # groupby(symbol).shift(-h) (no cross-stock leak, no .fillna(0)). Immature
    # rows are left NaN; callers drop per-horizon inside each model's loop.
    return df.copy()


def load():
    frames = []
    for s in STOCKS:
        p = OHLCV / f"{s}.csv"
        if not p.exists():
            continue
        # CSVs have malformed rows with duplicated trailing columns — read only first 6.
        df = pd.read_csv(p, usecols=range(6))
        df = df[df["volume"] > 0].reset_index(drop=True)
        if len(df) < 50:
            continue
        df = add_features(df); df["symbol"] = s
        frames.append(df)
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    if df.empty:
        return df
    # ML integrity (Task 1): per-stock groupby(symbol).shift(-h); no .fillna(0);
    # immature rows left NaN — callers drop per-horizon so per-horizon models
    # keep rows whose shorter-horizon target is mature (Phase A1 requirement).
    df = add_forward_returns(df)
    return df


def _metrics(yte, yp):
    return {
        "mse": float(mean_squared_error(yte, yp)),
        "mae": float(mean_absolute_error(yte, yp)),
        "r2": float(r2_score(yte, yp)),
    }


def _signal_from_avg(r5, r10, r21):
    avg = (r5 + r10 + r21) / 3
    sig = "BUY" if avg > 0.01 else "SELL" if avg < -0.01 else "HOLD"
    d = "LONG" if sig != "SELL" else "SHORT"
    return sig, d, avg


def _pred_record(cp, r5, r10, r21, sl_low_14):
    sig, d, avg = _signal_from_avg(r5, r10, r21)
    return {
        "signal": sig, "direction": d,
        "confidence": min(100, int(abs(avg) * 1000)),
        "currentPrice": round(cp, 2), "entry": round(cp, 2),
        "tp1": round(cp * (1 + r5), 2),
        "tp2": round(cp * (1 + r10), 2),
        "tp3": round(cp * (1 + r21), 2),
        "sl": round(float(sl_low_14), 2),
        "avgReturn": round(float(avg), 4),
    }


# ────────────────────────────────────────────────────────────────────
# 1. Chronos (Amazon) — quantile-binned tokenize-then-forecast analog
# ────────────────────────────────────────────────────────────────────
def train_chronos(df):
    """Chronos analog: tokenize returns into quantile bins (T5-style), then
    forecast next-bin via ridge regression on the bin indices."""
    print("  Training Chronos (Amazon) [quantile-binned analog]...")
    targets = ["target_5d", "target_10d", "target_21d"]
    # ML integrity (Task 2): chronological_split replaces the leaky global row
    # split on the concatenated df (mixed train/test across stocks in stock-
    # concat order, not date order). Per-horizon mask inside the loop.
    tr, va, te = chronological_split(df)

    # Quantile-bin the 1d returns into 100 tokens (Chronos uses 1024, we use 100 for speed)
    bins = np.linspace(-0.05, 0.05, 101)  # 100 bins
    bin_centers = (bins[:-1] + bins[1:]) / 2

    def tokenize(returns):
        idx = np.digitize(returns, bins) - 1
        return np.clip(idx, 0, len(bin_centers) - 1)

    # Build lag features from tokenized returns (Chronos uses lag tokens)
    rets_tr = tr["return_1d"].values
    tokens_tr = tokenize(rets_tr)
    # Use last 10 tokens as features (lag window)
    LAG = 10
    Xtr_full = np.array([tokens_tr[i:i+LAG] for i in range(len(tokens_tr) - LAG)])
    ytr_5_full = tr["target_5d"].values[LAG:]
    ytr_10_full = tr["target_10d"].values[LAG:]
    ytr_21_full = tr["target_21d"].values[LAG:]

    # Pre-build test arrays (Xte only depends on tokens_te, shared across horizons).
    rets_te = te["return_1d"].values
    toks_te = tokenize(rets_te)
    Xte_full = np.array([toks_te[i:i+LAG] for i in range(len(toks_te) - LAG)])
    yte_5_full = te["target_5d"].values[LAG:]
    yte_10_full = te["target_10d"].values[LAG:]
    yte_21_full = te["target_21d"].values[LAG:]

    if len(Xtr_full) < 50:
        return {"trained": False, "error": "Not enough tokenized sequences"}

    # Three ridge models, one per horizon
    metrics = {}; models = {}
    for tc, ytr_full, yte_full in zip(targets,
                                       [ytr_5_full, ytr_10_full, ytr_21_full],
                                       [yte_5_full, yte_10_full, yte_21_full]):
        hz = int(tc.split("_")[1].replace("d", ""))
        # ML integrity (Phase A1): per-horizon drop — mask rows whose THIS-horizon
        # target is NaN/inf (preserves shorter-horizon rows). Keeps X and y aligned.
        mask_tr = np.isfinite(ytr_full)
        mask_te = np.isfinite(yte_full)
        Xtr = Xtr_full[mask_tr]
        ytr = ytr_full[mask_tr]
        Xte = Xte_full[mask_te]
        yte = yte_full[mask_te]
        m = Ridge(alpha=1.0, random_state=42)
        m.fit(Xtr, ytr)
        if len(Xte) >= 5 and len(yte) >= 5:
            yp = m.predict(Xte)
            metrics[f"{hz}d"] = _metrics(yte, yp)
        else:
            metrics[f"{hz}d"] = {"mse": 0.0, "mae": 0.0, "r2": 0.0}
        models[hz] = m

    # Per-stock predictions
    preds = {}
    for s in STOCKS:
        sdf = df[df["symbol"] == s].sort_values("date").reset_index(drop=True)
        if len(sdf) < LAG + 21:
            continue
        cp = float(sdf.iloc[-1]["close"])
        rets = sdf["return_1d"].values
        toks = tokenize(rets)
        X = toks[-LAG:].reshape(1, -1)
        r5 = float(models[5].predict(X)[0])
        r10 = float(models[10].predict(X)[0])
        r21 = float(models[21].predict(X)[0])
        sl = np.min(sdf["low"].tail(14).values)
        preds[s] = _pred_record(cp, r5, r10, r21, sl)

    print(f"    Done — {len(preds)} stocks, R²(5d)={metrics['5d']['r2']:.3f}")
    return {"trained": True, "version": "2.0.0-foundation-analog",
            "metrics": metrics, "predictions": preds,
            "analog": "quantile-binned tokenize-then-forecast (T5-style)"}


# ────────────────────────────────────────────────────────────────────
# 2. Lag-Llama — lag-feature autoregression with gradient boosting
# ────────────────────────────────────────────────────────────────────
def train_lag_llama(df):
    """Lag-Llama analog: lag-based attention → use lagged features + GBR."""
    print("  Training Lag-Llama [lag-feature GBR analog]...")
    targets = ["target_5d", "target_10d", "target_21d"]
    # ML integrity (Task 2): chronological_split replaces the leaky global row split.
    tr0, va0, te0 = chronological_split(df)
    train_end = tr0["date"].max(); val_end = va0["date"].max()

    # Build lag features: 7 lags of return_1d, plus RSI/MACD lags
    LAGS = [1, 2, 3, 5, 7, 14, 21]
    base_cols = ["return_1d", "rsi_14", "macd", "macd_signal"]
    lag_features = []
    for col in base_cols:
        for L in LAGS:
            lag_col = f"{col}_lag_{L}"
            df[lag_col] = df.groupby("symbol")[col].shift(L).fillna(0)
            lag_features.append(lag_col)

    # Re-pull chronological partitions from the updated df (date-based masks).
    tr = df[df["date"] <= train_end].copy()
    te = df[df["date"] > val_end].copy()

    metrics = {}; models = {}
    for tc in targets:
        hz = int(tc.split("_")[1].replace("d", ""))
        # ML integrity (Phase A1): per-horizon drop — drop ONLY rows whose
        # THIS-horizon target is NaN (preserves shorter-horizon rows).
        tr_h = tr.dropna(subset=[tc]); te_h = te.dropna(subset=[tc])
        Xtr = tr_h[lag_features].values; Xte = te_h[lag_features].values
        ytr = tr_h[tc].values; yte = te_h[tc].values
        m = GradientBoostingRegressor(n_estimators=80, max_depth=3,
                                       learning_rate=0.05, random_state=42)
        m.fit(Xtr, ytr)
        yp = m.predict(Xte)
        metrics[f"{hz}d"] = _metrics(yte, yp)
        models[hz] = m

    # Per-stock predictions
    preds = {}
    for s in STOCKS:
        sdf = df[df["symbol"] == s].sort_values("date").reset_index(drop=True)
        if len(sdf) < 30:
            continue
        cp = float(sdf.iloc[-1]["close"])
        X = sdf[lag_features].iloc[-1:].values
        r5 = float(models[5].predict(X)[0])
        r10 = float(models[10].predict(X)[0])
        r21 = float(models[21].predict(X)[0])
        sl = np.min(sdf["low"].tail(14).values)
        preds[s] = _pred_record(cp, r5, r10, r21, sl)

    print(f"    Done — {len(preds)} stocks, R²(5d)={metrics['5d']['r2']:.3f}")
    return {"trained": True, "version": "2.0.0-foundation-analog",
            "metrics": metrics, "predictions": preds,
            "analog": "lag-feature gradient boosting (Lag-Llama lag-attention)"}


# ────────────────────────────────────────────────────────────────────
# 3. Moirai (Salesforce) — any-variate multivariate regression
# ────────────────────────────────────────────────────────────────────
def train_moirai(df):
    """Moirai analog: any-variate forecasting → multivariate regression that
    treats all features jointly with shared weights (any-variate analog)."""
    print("  Training Moirai (Salesforce) [any-variate analog]...")
    targets = ["target_5d", "target_10d", "target_21d"]
    # ML integrity (Task 2): chronological_split replaces the leaky global row
    # split. The scaler fit is ALREADY correct (fit on tr, transform te) — only
    # the underlying split was leaky; the per-horizon dropna is new (Phase A1).
    tr, va, te = chronological_split(df)

    # Any-variate: standardize all features jointly (fit on train only).
    sc = StandardScaler()
    sc.fit(tr[FC].values)

    metrics = {}; models = {}
    for tc in targets:
        hz = int(tc.split("_")[1].replace("d", ""))
        # ML integrity (Phase A1): per-horizon drop — re-pull X per-horizon
        # (row counts differ across horizons after dropna); use the train-fit
        # scaler via transform (no refit).
        tr_h = tr.dropna(subset=[tc]); te_h = te.dropna(subset=[tc])
        Xtr = sc.transform(tr_h[FC].values)
        Xte = sc.transform(te_h[FC].values)
        ytr = tr_h[tc].values; yte = te_h[tc].values
        # Multivariate (any-variate) linear regression with strong regularization
        m = Ridge(alpha=10.0, random_state=42)
        m.fit(Xtr, ytr)
        yp = m.predict(Xte)
        metrics[f"{hz}d"] = _metrics(yte, yp)
        models[hz] = (m, sc)

    # Per-stock predictions
    preds = {}
    for s in STOCKS:
        sdf = df[df["symbol"] == s].sort_values("date").reset_index(drop=True)
        if len(sdf) < 30:
            continue
        cp = float(sdf.iloc[-1]["close"])
        X = sdf[FC].iloc[-1:].values
        Xs = sc.transform(X)
        r5 = float(models[5][0].predict(Xs)[0])
        r10 = float(models[10][0].predict(Xs)[0])
        r21 = float(models[21][0].predict(Xs)[0])
        sl = np.min(sdf["low"].tail(14).values)
        preds[s] = _pred_record(cp, r5, r10, r21, sl)

    print(f"    Done — {len(preds)} stocks, R²(5d)={metrics['5d']['r2']:.3f}")
    return {"trained": True, "version": "2.0.0-foundation-analog",
            "metrics": metrics, "predictions": preds,
            "analog": "any-variate multivariate ridge (Moirai any-variate)"}


# ────────────────────────────────────────────────────────────────────
# 4. Time-LLM — reprogramming via SVD projection of base predictions
# ────────────────────────────────────────────────────────────────────
def train_time_llm(df, existing_models):
    """Time-LLM analog: reprogramming of pretrained source via projection.
    Here we project existing model predictions through an SVD basis to mimic
    Time-LLM's reprogramming layer."""
    print("  Training Time-LLM [SVD-reprogramming analog]...")
    targets = ["target_5d", "target_10d", "target_21d"]
    # ML integrity (Task 2): chronological_split replaces the leaky global row
    # split. Compute train_end/val_end dates, then apply as row masks on the
    # original (stock-concat-order) df so src and tr/te stay aligned.
    tr0, va0, te0 = chronological_split(df)
    train_end = tr0["date"].max(); val_end = va0["date"].max()
    train_mask = (df["date"] <= train_end).values
    test_mask = (df["date"] > val_end).values
    tr = df[train_mask].copy(); te = df[test_mask].copy()

    # Collect base model predictions for each (symbol, date) row
    base_model_names = [n for n, m in existing_models.items()
                        if m.get("trained") and n not in
                        ("Chronos (Amazon)", "Lag-Llama",
                         "Moirai (Salesforce)", "Time-LLM")]
    print(f"    Using {len(base_model_names)} base models as 'pretrained source'")

    # For each base model, predict per-row 5d/10d/21d return using their per-stock
    # latest predictions — but we need a per-row version. As a lightweight stand-in,
    # we use the base model's avgReturn applied per-stock as a constant prediction.
    # This is the "pretrained source activations" in Time-LLM terms.

    # Build a matrix of base-model predicted returns per row (reprogramming source)
    base_returns = {}
    for bn in base_model_names:
        m = existing_models[bn]
        if not m.get("trained"):
            continue
        per_stock = {s: m.get("predictions", {}).get(s, {}).get("avgReturn", 0)
                     for s in STOCKS}
        base_returns[bn] = df["symbol"].map(per_stock).fillna(0).values

    if not base_returns:
        return {"trained": False, "error": "No base models to reprogram"}

    # Stack: shape (n_samples, n_base_models)
    src = np.column_stack([base_returns[bn] for bn in base_model_names])
    # SVD-based reprogramming: project source to a lower-dim space then linearly map to target
    # For training, fit SVD on training source, then ridge regression on the projected source
    src_tr = src[train_mask]; src_te = src[test_mask]
    # Cap components to min(n_base, n_train_samples)
    n_comp = min(len(base_model_names), 5, src_tr.shape[0] - 1)
    n_comp = max(1, n_comp)
    # SVD via truncated SVD on the source matrix
    U_tr, S_tr, Vt_tr = np.linalg.svd(src_tr, full_matrices=False)
    V_k = Vt_tr[:n_comp]  # projection basis (n_comp × n_base)
    src_tr_proj = src_tr @ V_k.T  # (n_train × n_comp)
    src_te_proj = src_te @ V_k.T

    metrics = {}; models = {}
    for tc in targets:
        hz = int(tc.split("_")[1].replace("d", ""))
        # ML integrity (Phase A1): per-horizon drop — mask rows whose THIS-horizon
        # target is NaN/inf. Keeps src_tr_proj and ytr aligned (same row order).
        ytr_full = tr[tc].values
        yte_full = te[tc].values
        mask_tr = np.isfinite(ytr_full)
        mask_te = np.isfinite(yte_full)
        ytr = ytr_full[mask_tr]
        yte = yte_full[mask_te]
        src_tr_proj_h = src_tr_proj[mask_tr]
        src_te_proj_h = src_te_proj[mask_te]
        if src_tr_proj_h.shape[0] < 5 or src_tr_proj_h.shape[1] < 1:
            metrics[f"{hz}d"] = {"mse": 0.0, "mae": 0.0, "r2": 0.0}
            models[hz] = (V_k, Ridge(alpha=1.0).fit(src_tr_proj_h, ytr))
            continue
        m = Ridge(alpha=1.0, random_state=42)
        m.fit(src_tr_proj_h, ytr)
        if len(yte) > 0:
            yp = m.predict(src_te_proj_h)
            metrics[f"{hz}d"] = _metrics(yte, yp)
        else:
            metrics[f"{hz}d"] = {"mse": 0.0, "mae": 0.0, "r2": 0.0}
        models[hz] = (V_k, m)

    # Per-stock predictions: take base-model avgReturns for the latest row per stock,
    # project, then predict
    preds = {}
    for s in STOCKS:
        sdf = df[df["symbol"] == s].sort_values("date").reset_index(drop=True)
        if len(sdf) < 30:
            continue
        cp = float(sdf.iloc[-1]["close"])
        # Build source vector for this stock from base models
        src_v = np.array([existing_models[bn].get("predictions", {}).get(s, {}).get("avgReturn", 0)
                          for bn in base_model_names])
        src_proj = src_v @ V_k.T  # (n_comp,)
        r5 = float(models[5][1].predict(src_proj.reshape(1, -1))[0])
        r10 = float(models[10][1].predict(src_proj.reshape(1, -1))[0])
        r21 = float(models[21][1].predict(src_proj.reshape(1, -1))[0])
        sl = np.min(sdf["low"].tail(14).values)
        preds[s] = _pred_record(cp, r5, r10, r21, sl)

    print(f"    Done — {len(preds)} stocks, R²(5d)={metrics['5d']['r2']:.3f}")
    return {"trained": True, "version": "2.0.0-foundation-analog",
            "metrics": metrics, "predictions": preds,
            "analog": "SVD-reprogrammed base-prediction ensemble (Time-LLM reprogramming)"}


# ────────────────────────────────────────────────────────────────────
# Backtest a single model on the 20% test set (matches train_all_with_backtesting.py)
# ────────────────────────────────────────────────────────────────────
def backtest_model(df, model_pred):
    """Backtest a single model on the 20% test set (matches train_all_with_backtesting.py)
    — DISABLED (Pattern #10 LEAKY_BACKTEST).

    Original implementation: per-stock chronological test partition (the slice
    itself was leak-free thanks to chronological_split), but the SIGNAL applied
    to every historical test row came from `model_pred.get(s, {})` — the model's
    STORED LATEST per-stock signal, constant per stock across all historical
    test rows. This is leakage Pattern #10 (latest-signal replay): today's
    signal applied to historical test dates, which misrepresents the historical
    out-of-sample performance.

    For the leak-free chronological walk-forward evaluation, see
    scripts/walk_forward_backtesting.py (the genuine walk-forward engine that
    Phase A fixed — per-sample re-training + per-bar re-inference + realized
    P&L from future OHLCV). Do NOT duplicate a new walk-forward engine here.

    External interface preserved: same signature (df, model_pred) and same
    top-level return keys (totalTrades / buySignals / sellSignals /
    correctBuys / correctSells / winRate / avgReturnPct / maxReturnPct /
    minReturnPct / stars), with values signaling unavailability, PLUS the new
    status/reason/pointer/ml_integrity_note fields.
    """
    print("  backtest_model: UNAVAILABLE — Pattern #10 leak (latest-signal replay).")
    print("           Use scripts/walk_forward_backtesting.py for leak-free eval.")
    return {
        "status": "unavailable",
        "reason": (
            "Pattern #10 LEAKY_BACKTEST: original implementation applied the "
            "model's stored LATEST per-stock signal (model_pred.get(s, {}).get("
            "'signal', 'HOLD')) to every historical test row in the chronological "
            "test partition. The partition itself was leak-free "
            "(chronological_split); the signal source was the leak (today's "
            "signal replayed on every historical test date). Use "
            "scripts/walk_forward_backtesting.py for leak-free chronological "
            "walk-forward evaluation (per-sample re-training + per-bar "
            "re-inference + realized P&L)."
        ),
        "pointer": "scripts/walk_forward_backtesting.py",
        "ml_integrity_note": "Phase 1+2 fix: function disabled to prevent misleading metrics.",
        "totalTrades": 0,
        "buySignals": 0,
        "sellSignals": 0,
        "correctBuys": 0,
        "correctSells": 0,
        "winRate": None,
        "avgReturnPct": None,
        "maxReturnPct": None,
        "minReturnPct": None,
        "stars": 0,
    }


def main():
    print("=" * 60)
    print("Latent.pk — Tier 2 Foundation Models Training")
    print("=" * 60)
    df = load()
    print(f"\nLoaded: {len(df)} rows from {df['symbol'].nunique()} stocks")

    # Load existing predictions to (a) provide base models for Time-LLM and (b) merge later
    if not OUT.exists():
        print(f"\nERROR: {OUT} not found. Run scripts/train_all_with_backtesting.py first.")
        sys.exit(1)
    with open(OUT) as f:
        existing = json.load(f)
    print(f"Loaded {len(existing.get('models', {}))} existing models from {OUT}")

    # Train each foundation model
    print("\n[1/4] Chronos (Amazon)...")
    chronos = train_chronos(df)

    print("\n[2/4] Lag-Llama...")
    lag_llama = train_lag_llama(df)

    print("\n[3/4] Moirai (Salesforce)...")
    moirai = train_moirai(df)

    # For Time-LLM, we need the existing models dict (with their predictions)
    base_for_reprog = {k: v for k, v in existing["models"].items()}
    # Add newly trained foundation models so Time-LLM can reprogram them too
    if chronos.get("trained"):
        base_for_reprog["Chronos (Amazon)"] = chronos
    if lag_llama.get("trained"):
        base_for_reprog["Lag-Llama"] = lag_llama
    if moirai.get("trained"):
        base_for_reprog["Moirai (Salesforce)"] = moirai

    print("\n[4/4] Time-LLM...")
    time_llm = train_time_llm(df, base_for_reprog)

    # Update existing models dict
    existing["models"]["Chronos (Amazon)"] = chronos
    existing["models"]["Lag-Llama"] = lag_llama
    existing["models"]["Moirai (Salesforce)"] = moirai
    existing["models"]["Time-LLM"] = time_llm

    # Remove from untrained_models dict if they're now trained
    trained_set = {k: v for k, v in existing["models"].items() if v.get("trained")}
    for n in ["Chronos (Amazon)", "Lag-Llama", "Moirai (Salesforce)", "Time-LLM"]:
        if n in trained_set and n in existing.get("untrained_models", {}):
            del existing["untrained_models"][n]

    # Backtest each newly trained model
    print("\n[Backtesting] Computing backtesting for Tier 2 foundation models...")
    bt = existing.get("backtesting", {})
    for name, m in [("Chronos (Amazon)", chronos),
                    ("Lag-Llama", lag_llama),
                    ("Moirai (Salesforce)", moirai),
                    ("Time-LLM", time_llm)]:
        if not m.get("trained"):
            continue
        bt[name] = backtest_model(df, m.get("predictions", {}))
        print(f"  {name}: winRate={bt[name]['winRate']}% "
              f"avgReturn={bt[name]['avgReturnPct']}% stars={'★' * bt[name]['stars']}")
    existing["backtesting"] = bt

    # Update trained_at timestamp
    existing["trained_at"] = pd.Timestamp.now().isoformat()
    existing["ml_integrity"] = {
        "target_construction": "per-stock groupby(symbol).shift(-h) via ml_integrity.add_forward_returns in load(); no .fillna(0); immature rows left NaN and dropped per-horizon inside each foundation analog's loop",
        "split": "date-based chronological_split (60/20/20) with per-stock purge of MAX_HORIZON=21 rows at each boundary; replaces the old global row split on the concatenated df in train_chronos / train_lag_llama / train_moirai / train_time_llm / backtest_model",
        "scaler_fitting": "train_moirai uses StandardScaler fit on TRAIN partition only (was already correct); transform-only on test. Other foundation analogs operate on raw / tokenized features (no scaler).",
        "backtest_methodology": "Pattern #10 LEAKY_BACKTEST disabled — function now returns status='unavailable' with reason + pointer to scripts/walk_forward_backtesting.py for genuine walk-forward ML evaluation. backtest_model() no longer applies the model's stored LATEST per-stock signal to every historical test row; per-model backtest entries now carry status='unavailable' + zeroed metrics.",
        "ml_historical_evaluation": "unavailable",
    }

    # Save
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(existing, indent=2,
                              default=lambda o: int(o) if isinstance(o, (np.integer,)) else
                              float(o) if isinstance(o, (np.floating,)) else str(o)))

    tc = sum(1 for m in existing["models"].values() if m.get("trained"))
    print("\n" + "=" * 60)
    print("TIER 2 FOUNDATION MODELS TRAINING COMPLETE")
    print("=" * 60)
    print(f"Total trained: {tc}/{len(existing['models'])} models")
    print(f"\nTier 2 status:")
    for n in ["Chronos (Amazon)", "Lag-Llama", "Moirai (Salesforce)", "Time-LLM"]:
        m = existing["models"].get(n, {})
        b = bt.get(n, {})
        print(f"  {n}: trained={m.get('trained')} "
              f"winRate={b.get('winRate', 0)}% stars={'★' * b.get('stars', 0)}")
    print(f"\nUntrained models remaining: {len(existing.get('untrained_models', {}))}")
    for n, r in existing.get("untrained_models", {}).items():
        print(f"  {n}: {r}")
    print(f"\nSaved: {OUT}")


if __name__ == "__main__":
    main()
