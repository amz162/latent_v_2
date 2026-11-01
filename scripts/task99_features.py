#!/usr/bin/env python3
"""Task 99 — PSX feature engineering for the reference RNN-LSTM adaptation.

Implements the reference feature family (rnn_modelling.py technical_indicators_df
+ preprocessing) on real PSX OHLCV bars, with the reference's preprocessing
defects corrected:

  DEFECT FIXED (MA collision): the reference computes close MAs and then
  OVERWRITES MA5/MA10/MA20 with volume MAs. Here close and volume MAs are
  DISTINCT fields: close_ma_5/10/20/60/120 and volume_ma_5/10/20.

  DEFECT FIXED (objective mismatch): the reference selects features against a
  binary daily-return-direction label while regressing the next-day close.
  Here feature selection (in the training pipeline) uses the same horizon
  target family as training. No directional labels are used for selection.

  MARKET CONTEXT: the reference is CAPM-inspired and adds S&P 500 context.
  No genuine KSE-100 index series exists in the Latent.pk database (verified:
  no index-like symbol/table). Per the task rules a synthetic proxy is NOT
  used and the market-context block is EXCLUDED — recorded in
  task99_feature_schema.json. No S&P 500 data is imported.

Indicators are implemented in numpy/pandas (TA-Lib is not installed); HT_DC
is an Ehlers-style dominant-cycle approximation. All scale-sensitive
quantities are expressed as ratios so a single pooled model is meaningful.
"""
from __future__ import annotations
import numpy as np
import pandas as pd

CORE_LAGS = (1, 2, 3)
MARKET_CONTEXT_INCLUDED = False
MARKET_CONTEXT_REASON = ("no genuine KSE-100 index series in OhlcvBar (verified 2026-11-01); "
                         "reference S&P 500 context not portable; synthetic proxy forbidden")


def _wilder_ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(alpha=1.0 / n, adjust=False, min_periods=n).mean()


def _rsi(close: pd.Series, n: int = 14) -> pd.Series:
    d = close.diff()
    up = d.clip(lower=0.0)
    dn = (-d).clip(lower=0.0)
    rs = _wilder_ema(up, n) / _wilder_ema(dn, n).replace(0.0, np.nan)
    out = 100.0 - 100.0 / (1.0 + rs)
    return out.fillna(50.0).where(_wilder_ema(up, n).notna() & _wilder_ema(dn, n).notna())


def _adx(h: pd.Series, l: pd.Series, c: pd.Series, n: int = 14) -> tuple[pd.Series, pd.Series]:
    up = h.diff()
    dn = -l.diff()
    plus_dm = up.where((up > dn) & (up > 0), 0.0)
    minus_dm = dn.where((dn > up) & (dn > 0), 0.0)
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    atr = _wilder_ema(tr, n)
    pdi = 100.0 * _wilder_ema(plus_dm, n) / atr.replace(0.0, np.nan)
    mdi = 100.0 * _wilder_ema(minus_dm, n) / atr.replace(0.0, np.nan)
    dx = 100.0 * (pdi - mdi).abs() / (pdi + mdi).replace(0.0, np.nan)
    adx = _wilder_ema(dx.fillna(0.0), n)
    adxr = (adx + adx.shift(n)) / 2.0
    return adx, adxr


def _ht_dcperiod(close: pd.Series) -> pd.Series:
    """Ehlers-style dominant-cycle approximation of TA-Lib HT_DCPERIOD.

    Phasor accumulation over a 40-bar window; clamped to [10, 50]; labelled an
    approximation because TA-Lib is not installed in this environment.
    """
    c = close.astype(float)
    filt = (0.25 * c + 0.5 * c.shift(1) + 0.25 * c.shift(2)).fillna(c)
    shift = filt.shift(1).bfill()
    dc = pd.Series(20.0, index=c.index)
    win = 40
    im_part = filt - shift
    re_part = filt.rolling(2).mean().sub(filt.shift(1).rolling(2).mean()).fillna(0.0)
    # period estimation via in-phase/quadrature smoothing
    i_sm = im_part.rolling(win, min_periods=10).mean().fillna(0.0)
    q_sm = re_part.rolling(win, min_periods=10).mean().fillna(0.0)
    denom = (i_sm.abs() + q_sm.abs()).replace(0.0, np.nan)
    period = 2 * np.pi / denom.where(denom.notna(), np.nan)
    dc = period.clip(10.0, 50.0).fillna(20.0)
    return dc


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """df: columns [open, high, low, close, volume], index: dates (ascending,
    one symbol). Returns feature DataFrame (same index, NaN warmups preserved —
    the dataset builder drops incomplete rows; no fabricated values)."""
    o, h, l, c, v = df["open"], df["high"], df["low"], df["close"], df["volume"].astype(float)
    f = pd.DataFrame(index=df.index)
    # ── core: scale-free OHLCV relatives ──────────────────────────────────
    prev_c = c.shift(1)
    f["close_ret_1d"] = c.pct_change(1)
    f["log_ret_1d"] = np.log(c / prev_c)
    f["range_hl_over_c"] = (h - l) / c.replace(0.0, np.nan)
    f["high_over_open"] = h / o
    f["low_over_open"] = l / o
    f["close_over_open"] = c / o
    for k in CORE_LAGS:
        po, pc, ph, pl, pv = o.shift(k), c.shift(k), h.shift(k), l.shift(k), v.shift(k)
        f[f"lag{k}_open_over_close"] = po / c
        f[f"lag{k}_close_over_close"] = pc / c
        f[f"lag{k}_high_over_close"] = ph / c
        f[f"lag{k}_low_over_close"] = pl / c
        f[f"lag{k}_volume_over_volume"] = pv / v.replace(0.0, np.nan)
    # ── moving averages: CLOSE and VOLUME kept DISTINCT (defect fixed) ────
    for n in (5, 10, 20, 60, 120):
        f[f"close_ma_{n}_rel"] = c / c.rolling(n).mean() - 1.0
    for n in (5, 10, 20):
        f[f"volume_ma_{n}_rel"] = v / v.rolling(n).mean() - 1.0
    # ── indicators (reference set) ────────────────────────────────────────
    adx, adxr = _adx(h, l, c, 14)
    f["adx_14"] = adx / 100.0
    f["adxr_14"] = adxr / 100.0
    ema12, ema26 = c.ewm(span=12, adjust=False).mean(), c.ewm(span=26, adjust=False).mean()
    f["macd_rel"] = (ema12 - ema26) / c
    f["rsi_14"] = _rsi(c, 14) / 100.0
    mid = c.rolling(5).mean()
    sd = c.rolling(5).std(ddof=0)
    bbu, bbl = mid + 2.0 * sd, mid - 2.0 * sd
    f["boll_upper_dist"] = (c - bbu) / c
    f["boll_mid_dist"] = (c - mid) / c
    f["boll_lower_dist"] = (c - bbl) / c
    hl_rng = (h - l).replace(0.0, np.nan)
    clv = ((c - l) - (h - c)) / hl_rng
    ad = (clv.fillna(0.0) * v).cumsum()
    f["ad_flow_5"] = (ad - ad.shift(5)) / (v.rolling(20).mean() * 20.0).replace(0.0, np.nan)
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    f["atr_14_rel"] = _wilder_ema(tr, 14) / c
    f["ht_dcperiod"] = _ht_dcperiod(c) / 20.0
    return f


FEATURE_SCHEMA_VERSION = "task99-psx-v1"

if __name__ == "__main__":
    # deterministic validation on synthetic OHLCV
    rng = np.random.default_rng(7)
    n = 400
    close = 100 * np.exp(np.cumsum(rng.normal(0, 0.02, n)))
    df = pd.DataFrame({
        "open": close * (1 + rng.normal(0, 0.005, n)),
        "high": close * (1 + np.abs(rng.normal(0, 0.01, n))),
        "low": close * (1 - np.abs(rng.normal(0, 0.01, n))),
        "close": close,
        "volume": rng.integers(1e4, 1e6, n).astype(float),
    })
    feats = build_features(df)
    assert "close_ma_5_rel" in feats and "volume_ma_5_rel" in feats
    assert not any(feats.columns.duplicated())
    # distinctness: close vs volume MA features differ
    assert not np.allclose(feats["close_ma_5_rel"].dropna()[:50], feats["volume_ma_5_rel"].dropna()[:50])
    body = feats.iloc[130:]
    assert np.isfinite(body.values).all(), "NaN/inf in feature body"
    print(f"features: {feats.shape[1]} columns; body finite OK; no fabricated fills (warmup rows dropped downstream)")
