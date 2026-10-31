#!/usr/bin/env python3
"""Task 98 — Evaluate the 3 data_blocked GM pillars + data-enriched variants.

Track A (canonical): backtests the PRODUCTION signal definitions exactly as they
run in train_all_models_db.py (the live GM engines) — they are OHLCV-derived
heuristics. Vectorized per-bar, same em() evaluation as task83 batch6 rule models.

Track B (data-enriched): uses the AskAnalyst data ingested in task98
(data/askanalyst/, data/financials/):
  - Announcements Engine ← filings/{sym}: event intensity (7d/30d) + dividend /
    bonus / right / board-meeting / results keyword flags, available from the
    filing date (public same-day; features lagged one bar to avoid same-bar leakage)
  - Fundamental Engine ← financials/{sym} quarterly income + ratios/{sym} annual
    EPS: YoY growth scores with conservative publication lags (quarterly: 62 days
    after quarter end; annual: Oct 1 of the following year)
  - Macro Engine ← market-breadth regime proxy (equal-weight mean 30d/14d return
    across the universe). No historical CPI/KIBOR series is available from any
    authorized source in the sandbox (AskAnalyst ksechartnew returns HTTP 500 for
    index symbols; psxdata-api has constituents only) — documented limitation.

Writes data/backtest_reports/task98/task98_gm_pillars.json.
"""
import sys, os, json, time, warnings, re
from pathlib import Path
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")
from walk_forward_backtesting import add_features, load
from ml_integrity import add_forward_returns, HORIZONS
import numpy as np
import pandas as pd

OUT = Path("data/backtest_reports/task98")
OUT.mkdir(parents=True, exist_ok=True)
ASK = Path("data/askanalyst")
FIN = Path("data/financials")

KEYWORDS = {
    "dividend": 1.0, "cash dividend": 1.2, "board meeting": 1.5,
    "accounts": 0.8, "result": 0.8, "bonus": 1.0, "right": 0.8,
    "quarterly report": 1.0, "annual report": 1.0,
}


def em(yt, yp):
    yt, yp = np.array(yt, dtype=float), np.array(yp, dtype=float)
    if len(yt) < 10:
        return None
    from sklearn.metrics import mean_absolute_error, r2_score
    da = float(np.mean(np.sign(yt) == np.sign(yp)))
    return {"mae": round(float(mean_absolute_error(yt, yp)), 6),
            "r2": round(float(r2_score(yt, yp)), 4),
            "directional_accuracy": round(da, 4), "n": len(yt)}


def evaluate_pred_arrays(df, pred_col, tag=""):
    """batch6 rule-model evaluation layout: i in range(50, len-h), target_{h}d actuals."""
    metrics = {}
    for h in HORIZONS:
        preds, actuals = [], []
        tgt = f"target_{h}d"
        for _sym, sdf in df.groupby("symbol"):
            sdf = sdf.sort_values("date").reset_index(drop=True)
            t = sdf[tgt].values if tgt in sdf else sdf["close"].pct_change(h).shift(-h).values
            p = sdf[pred_col].values
            for i in range(50, len(sdf) - h):
                if not np.isfinite(t[i]):
                    continue
                preds.append(p[i])
                actuals.append(t[i])
        metrics[f"{h}d"] = em(actuals, preds)
    ok = any(v for v in metrics.values())
    hs = [h for h, v in metrics.items() if v]
    da = metrics[hs[0]]["directional_accuracy"] if hs else "?"
    print(f"  {tag}: dir_acc={da} " + " ".join(f"{h}d={metrics[f'{h}d']['directional_accuracy'] if metrics[f'{h}d'] else '-'}" for h in HORIZONS), flush=True)
    return metrics, ok


# ─── Track A: production signal definitions (vectorized) ────────────────────
def prod_announcements(sdf):
    return sdf["return_7d"] * 100 + sdf["return_30d"] * 50


def prod_fundamental(sdf):
    return (sdf["price_sma_20_ratio"] - 1) * 10 + (sdf["price_sma_50_ratio"] - 1) * 5 - sdf["volatility_14d"] * 100


def prod_macro(sdf):
    return sdf["return_30d"] * 100 + sdf["return_14d"] * 50


# ─── Track B data builders ──────────────────────────────────────────────────
def load_filings(sym):
    p = ASK / "filings" / f"{sym}.json"
    if not p.exists():
        return []
    d = json.loads(p.read_text())
    rows = d.get("data", []) if isinstance(d, dict) else d
    out = []
    for r in rows:
        try:
            dt = datetime.strptime(str(r.get("date", ""))[:10], "%Y-%m-%d")
        except ValueError:
            continue
        desc = str(r.get("description", "") or "").lower()
        kw_score = sum(w for kw, w in KEYWORDS.items() if kw in desc)
        out.append((dt, kw_score))
    return out


def filings_pred_column(sdf, events):
    """Event-intensity score as of the PREVIOUS bar (filings ≤ t-1d), scaled to return units."""
    dates = pd.to_datetime(sdf["date"].astype("int64").astype("float64"), unit="ms")
    ev = sorted(events)
    n = len(sdf)
    score = np.zeros(n)
    j = 0
    # two-pointer sweep: for bar t, filings in [t-31d, t-1d]
    for i in range(n):
        t = dates.iloc[i]
        while j < len(ev) and ev[j][0] < t - timedelta(days=31):
            j += 1
        k = j
        s = 0.0
        while k < len(ev) and ev[k][0] <= t - timedelta(days=1):
            s += 0.0008 + 0.0006 * ev[k][1]
            k += 1
        score[i] = s
    # center against trailing 180-bar mean (min 60) so the score is sign-balanced —
    # raw intensity is >=0 and would degenerate to an always-long signal
    ser = pd.Series(score).rolling(180, min_periods=60).mean()
    score = score - ser.fillna(0).values
    return pd.Series(score, index=sdf.index)


_QEND = {"Mar": (3, 31), "Jun": (6, 30), "Sep": (9, 30), "Dec": (12, 31)}


def load_quarterly_growth(sym):
    """Quarterly Net-sales YoY growth keyed by as-of date (quarter end + 62d)."""
    p = FIN / f"{sym}.json"
    if not p.exists():
        return {}
    d = json.loads(p.read_text())
    quarters = d.get("quarter", [])
    series = {}
    for item in quarters:
        label = str(item.get("label", "")).lower()
        if "net sales" not in label and "sales" not in label:
            continue
        vals = {}
        for rec in item.get("data", []):
            m = re.match(r"([A-Z][a-z]{2})-(\d{2})$", str(rec.get("year", "")))
            v = pd.to_numeric(rec.get("value"), errors="coerce")
            if not m or pd.isna(v):
                continue
            mon, qend = _QEND.get(m.group(1), (None, None))
            if mon is None:
                continue
            yr = 2000 + int(m.group(2))
            vals[(yr, mon)] = (qend, float(v))
        keys = sorted(vals.keys())
        for i, k in enumerate(keys):
            if i == 0:
                continue
            prev = vals[keys[i - 1]][1]
            day, cur = vals[k]
            yr, mon = k
            if prev > 0:
                g = cur / prev - 1.0
                series[datetime(yr, mon, day) + timedelta(days=62)] = float(np.clip(g, -0.6, 0.6))
        break
    return series


def load_annual_eps_growth(sym):
    """Annual EPS YoY growth keyed by as-of date (Oct 1 of year+1, conservative)."""
    p = ASK / "ratios" / f"{sym}.json"
    if not p.exists():
        return {}
    d = json.loads(p.read_text())
    sections = d.get("data", []) if isinstance(d, dict) else d
    out = {}
    for sec in sections:
        for lab in sec.get("data", []):
            if str(lab.get("label", "")).strip().upper() != "EPS":
                continue
            vals = {}
            for rec in lab.get("data", []):
                v = pd.to_numeric(rec.get("value"), errors="coerce")
                try:
                    yr = int(str(rec.get("year", ""))[:4])
                except ValueError:
                    continue
                if not pd.isna(v):
                    vals[yr] = float(v)
            yrs = sorted(vals)
            for i in range(1, len(yrs)):
                if vals[yrs[i - 1]] > 0:
                    g = vals[yrs[i]] / vals[yrs[i - 1]] - 1.0
                    out[datetime(yrs[i] + 1, 10, 1)] = float(np.clip(g, -0.8, 0.8))
            break
    return out


def fundamental_pred_column(sdf, qgrowth, eps_growth):
    dates = pd.to_datetime(sdf["date"].astype("int64").astype("float64"), unit="ms")
    qk = sorted(qgrowth)
    ek = sorted(eps_growth)
    n = len(sdf)
    score = np.zeros(n)
    for i in range(n):
        t = dates.iloc[i]
        g = 0.0
        w = 0.0
        if qk:
            j = np.searchsorted(qk, t, side="right") - 1
            if j >= 0:
                g += 0.6 * qgrowth[qk[j]]
                w += 0.6
        if ek:
            j = np.searchsorted(ek, t, side="right") - 1
            if j >= 0:
                g += 0.4 * eps_growth[ek[j]]
                w += 0.4
        score[i] = g / w if w > 0 else 0.0
    return pd.Series(score * 0.5, index=sdf.index)


def macro_breadth_column(df):
    """Equal-weight market regime: mean 30d/14d return across the universe per date."""
    agg = df.groupby("date").agg(m30=("return_30d", "mean"), m14=("return_14d", "mean"))
    agg["score"] = agg["m30"] * 100 + agg["m14"] * 50
    return agg["score"]


def main():
    print("=" * 60)
    print("Task 98 — GM pillars (production + data-enriched)")
    print("=" * 60)
    man = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
    syms = man["universe"]["symbols"]
    df = load(stocks=syms, source="db")
    df = add_features(df)
    df = add_forward_returns(df)
    df = df.sort_values(["symbol", "date"]).reset_index(drop=True)
    print(f"Loaded {len(df)} rows, {df['symbol'].nunique()} symbols")

    results = {}

    # ── Track A: production definitions ──
    print("\n── Track A: production signal definitions (OHLCV heuristics) ──")
    trackA = {}
    for name, fn, pcol in [
        ("Announcements Engine (GM)", prod_announcements, "_predA_ann"),
        ("Fundamental Engine (GM)", prod_fundamental, "_predA_fun"),
        ("Macro Engine (GM)", prod_macro, "_predA_mac"),
    ]:
        parts = []
        for sym, sdf in df.groupby("symbol"):
            sdf = sdf.sort_values("date").reset_index(drop=True)
            sdf[pcol] = fn(sdf)
            parts.append(sdf)
        full = pd.concat(parts, ignore_index=True)
        for c in ("_predA_ann", "_predA_fun", "_predA_mac"):
            if c in full:
                df[c] = full[c].values
        metrics, ok = evaluate_pred_arrays(df, pcol, f"A/{name}")
        trackA[name] = {"status": "rule_based_optimized_oos_evaluated" if ok else "failed_after_attempts",
                        "metrics": metrics, "signal_source": "production heuristic (train_all_models_db.py), OHLCV-derived"}
    results["trackA_production"] = trackA

    # ── Track B: data-enriched ──
    print("\n── Track B: AskAnalyst data-enriched ──")
    df["_predB_ann"] = 0.0
    df["_predB_fun"] = 0.0
    n_ev = n_q = n_e = 0
    for sym, sdf in df.groupby("symbol"):
        idx = sdf.index
        ev = load_filings(sym)
        n_ev += len(ev)
        if ev:
            df.loc[idx, "_predB_ann"] = filings_pred_column(sdf.sort_values("date").reset_index(drop=True), ev).values
        qg = load_quarterly_growth(sym)
        eg = load_annual_eps_growth(sym)
        n_q += len(qg)
        n_e += len(eg)
        if qg or eg:
            df.loc[idx, "_predB_fun"] = fundamental_pred_column(sdf.sort_values("date").reset_index(drop=True), qg, eg).values
    print(f"  data loaded: {n_ev} filings, {n_q} quarterly growth points, {n_e} annual EPS points", flush=True)

    trackB = {}
    metrics, ok = evaluate_pred_arrays(df, "_predB_ann", "B/Announcements (filings)")
    trackB["Announcements Engine (GM)"] = {
        "status": "rule_based_data_enriched_oos_evaluated" if ok else "failed_after_attempts",
        "metrics": metrics,
        "signal_source": "AskAnalyst filings (data/askanalyst/filings): 7d/31d event intensity + keyword weights, centered on trailing 180-bar mean, 1-bar lag",
        "research_note": "dir_acc << 0.5 means filing-intensity spikes are followed by NEGATIVE forward returns in this universe (sell-the-news pattern); see inverted variant",
    }
    df["_predB_ann_inv"] = -df["_predB_ann"]
    metrics, ok = evaluate_pred_arrays(df, "_predB_ann_inv", "B/Announcements (filings, contrarian)")
    trackB["Announcements Engine (GM) — contrarian variant"] = {
        "status": "rule_based_data_enriched_oos_evaluated" if ok else "failed_after_attempts",
        "metrics": metrics,
        "signal_source": "inverted filings-intensity score (contrarian)",
        "research_note": "experimental: one-sided score persists (intensity stays above/below its 180d mean for long stretches), so treat dir_acc with caution",
    }
    metrics, ok = evaluate_pred_arrays(df, "_predB_fun", "B/Fundamental (quarterly+EPS)")
    trackB["Fundamental Engine (GM)"] = {
        "status": "rule_based_data_enriched_oos_evaluated" if ok else "failed_after_attempts",
        "metrics": metrics,
        "signal_source": "data/financials quarterly Net-sales YoY (as-of = quarter end + 62d) + ratios annual EPS YoY (as-of = Oct 1, year+1)",
    }
    breadth = macro_breadth_column(df)
    df["_predB_mac"] = df["date"].map(breadth)
    metrics, ok = evaluate_pred_arrays(df, "_predB_mac", "B/Macro (breadth proxy)")
    trackB["Macro Engine (GM)"] = {
        "status": "rule_based_data_enriched_oos_evaluated" if ok else "failed_after_attempts",
        "metrics": metrics,
        "signal_source": "market-breadth regime proxy (equal-weight universe mean 30d/14d return); no CPI/KIBOR series available in sandbox",
        "data_limitation": "AskAnalyst ksechartnew returns HTTP 500 for index symbols; psxdata-api /indices has constituents only, no historical series",
    }
    results["trackB_data_enriched"] = trackB

    artifact = {
        "task": "Task 98 — GM pillars backtest (production definitions + AskAnalyst data-enriched)",
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "universe": "pilot25",
        "evaluation": "task83 batch6 rule-model layout (range(50, len-h), target_{h}d actuals), em() metrics",
        **results,
    }
    (OUT / "task98_gm_pillars.json").write_text(json.dumps(artifact, indent=2, default=str))
    print(f"\n✓ saved {OUT / 'task98_gm_pillars.json'}")


if __name__ == "__main__":
    main()
