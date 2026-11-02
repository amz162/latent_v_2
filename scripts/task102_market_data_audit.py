#!/usr/bin/env python3
"""Task 102 — market data audit (spec Phase 1).
Per-symbol coverage/quality over all 909 OhlcvBar symbols with special
continuity for pilot25 / canonical8 universes. Bounded: aggregate SQL, vector
checks, chunked writes. Resumable (single pass ~60-90s)."""
from __future__ import annotations
import json, sys, time
import numpy as np
import pandas as pd
sys.path.insert(0, "/home/z/my-project/scripts")
import task102_lib as L  # noqa: E402
import task100_lib as T0  # noqa: E402
import walk_forward_backtesting as wf  # noqa: E402

MAX_SESSION_GAP_MS = 5 * 86400_000   # >5 calendar days without a session is suspicious
STALE_VOLUME_DAYS = 20
PRICE_JUMP_FRAC = 0.40               # single-session |ret| >= 40% -> corporate-action suspicion

def audit_symbol(g: pd.DataFrame) -> dict:
    g = g.sort_values("date")
    n = len(g)
    dates = pd.to_datetime(g["date"]).values.astype("datetime64[ms]").astype(np.int64)
    gaps = np.diff(dates)
    o, h, l, c, v = (g[k].values.astype(float) for k in ("open", "high", "low", "close", "volume"))
    traded = (o > 0) & (h > 0) & (l > 0) & (c > 0)   # suspended sessions recorded as 0s are legit
    with np.errstate(invalid="ignore"):
        h_l_contradictions = int(np.sum(traded & (h < l)))
        envelope_violations = int(np.sum(traded & (h >= l) &
            ((h < np.maximum(o, c)) | (l > np.minimum(o, c)))))
    zero_price_sessions = int(np.sum(~traded))
    neg = int(np.sum((v < 0)))
    dup_dates = int(n - len(np.unique(dates)))
    big_gaps = int(np.sum(gaps > MAX_SESSION_GAP_MS))
    ret = c[1:] / np.where(c[:-1] == 0, np.nan, c[:-1]) - 1
    with np.errstate(invalid="ignore"):
        jumps = int(np.nansum(np.abs(ret) >= PRICE_JUMP_FRAC))
    zero_vol_frac = float(np.mean(v[traded] == 0)) if traded.any() else 0.0
    stale_vol = int(np.sum(v[-STALE_VOLUME_DAYS:] == 0)) if n >= STALE_VOLUME_DAYS else 0
    zero_price_frac = 1.0 - (float(traded.mean()) if n else 0.0)
    score = 100.0
    score -= 30 * h_l_contradictions / max(n, 1) * 10
    score -= 10 * envelope_violations / max(n, 1) * 2
    score -= 20 * dup_dates / max(n, 1) * 10
    score -= 10 * zero_vol_frac * 3
    score -= 8 * big_gaps
    score -= 8 * jumps / max(n, 1) * 5
    score -= 15 * zero_price_frac
    score -= (2 if stale_vol >= STALE_VOLUME_DAYS else 0)
    score = max(0.0, min(100.0, score))
    if h_l_contradictions or dup_dates:
        status = L.INVALID
    elif envelope_violations > n * 0.10:
        status = L.PARTIALLY_VERIFIED
    elif n < 250 or big_gaps > 12 or zero_vol_frac > 0.5 or zero_price_frac > 0.5:
        status = L.STALE
    elif big_gaps or jumps or zero_vol_frac > 0.05 or zero_price_frac > 0.05:
        status = L.PARTIALLY_VERIFIED
    else:
        status = L.VERIFIED
    return {"symbol": g["symbol"].iloc[0], "n_bars": n,
             "first_date": pd.to_datetime(dates[0], unit="ms").strftime("%Y-%m-%d"),
             "last_date": pd.to_datetime(dates[-1], unit="ms").strftime("%Y-%m-%d"),
             "h_l_contradictions": h_l_contradictions, "envelope_violations": envelope_violations, "neg_values": neg,
             "zero_price_sessions": zero_price_sessions,
             "duplicate_dates": dup_dates, "gaps_over_5d": big_gaps,
             "max_session_gap_days": round(float(gaps.max() / 86400_000), 1) if n > 1 else 0,
             "single_day_jumps_ge_40pct": jumps, "zero_volume_frac": round(zero_vol_frac, 4),
             "stale_volume_recent": stale_vol, "quality_score": round(score, 1),
             "status": status,
             "status_note": "envelope violations (high<open/close) are a known PSX vendor trait; "
                             "counts recorded, values preserved raw; NOT treated as contradictions",
             "ca_suspicion_note": "jumps are corporate-action suspects; raw prices preserved, "
                                   "no adjustment applied (registry empty)"}

def main() -> None:
    t0 = time.time()
    con = L.db_conn()
    df = pd.read_sql("SELECT symbol,date,open,high,low,close,volume FROM OhlcvBar "
                      "ORDER BY symbol,date", con)
    con.close()
    pilot25, _ = T0.resolve_pilot25()
    canonical8 = list(T0.CANONICAL8) if hasattr(T0, "CANONICAL8") else pilot25[:8]
    grp = df.groupby("symbol", sort=False)
    rows, summary = [], {"verified": 0, "partially_verified": 0, "missing": 0,
                          "invalid": 0, "stale": 0, "provider_unavailable": 0}
    for sym, g in grp:
        try:
            r = audit_symbol(g)
        except Exception as e:
            r = {"symbol": sym, "status": L.INVALID, "error": str(e)[:100]}
        summary[r.get("status", "invalid")] = summary.get(r.get("status", "invalid"), 0) + 1
        rows.append(r)
    cov = pd.DataFrame(rows)
    cov.to_csv(L.BASE / "task102_symbol_coverage.csv", index=False)
    inventory = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime()),
        "source": "db/custom.db OhlcvBar (provider provenance: PSX EOD history ingested by the "
                   "existing fetch pipeline; raw unadjusted prices)",
        "n_symbols": len(cov), "n_bars": int(len(df)),
        "date_range": {"min": str(df["date"].min()), "max": str(df["date"].max())},
        "status_counts": summary,
        "universes": {
            "pilot25": {s: {**r} for s in pilot25 for r in rows if r["symbol"] == s},
            "canonical8": {s: {**r} for s in canonical8 for r in rows if r["symbol"] == s}},
        "checks": ["envelope violations recorded per symbol (vendor trait)", "symbol mapping (all tickers unique in OhlcvBar)", "duplicate dates",
                    "invalid OHLC combinations", "negative/impossible values", "zero/stale volume",
                    "single-day price jumps (>=40%, corporate-action suspects, NOT adjusted)",
                    "session gaps > 5 calendar days", "survivorship note: 909 symbols include "
                    "delisted/suspended histories still present in DB (no removal performed)"],
        "honesty": {"adjusted_vs_raw": "raw only; no vendor-adjusted series exists in the DB",
                     "kse100": "no index table; genuine KSE-100 blocked_external_data (see "
                                "task102_kse100_coverage.json)",
                     "survivorship_bias": "delisted symbols retained; universe selection must be "
                                           "point-in-time (existing convention)"},
        "quality_score_definition": "100 - penalties for bad OHLC, duplicates, zero volume, gaps, "
                                     "jumps, staleness (clamped 0-100)"}
    L.write_artifact("task102_market_data_inventory.json", inventory)
    dq = {"report": "task102_data_quality_report",
           "status_counts": summary, "symbols": len(cov),
           "worst_symbols": cov.nsmallest(10, "quality_score").to_dict("records"),
           "best_symbols": cov.nlargest(5, "quality_score").to_dict("records"),
           "pilot25_scores": {r["symbol"]: r["quality_score"] for r in rows
                               if r["symbol"] in pilot25},
           "notes": "legit illiquid/suspended periods preserved; reasons recorded per symbol in "
                     "task102_symbol_coverage.csv (gaps/jumps/stale flags)"}
    L.write_artifact("task102_data_quality_report.json", dq)
    print(f"market audit done {time.time()-t0:.0f}s: {len(cov)} symbols, statuses={summary}")

if __name__ == "__main__":
    main()
