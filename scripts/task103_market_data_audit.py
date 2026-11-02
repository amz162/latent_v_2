#!/usr/bin/env python3
"""Task 103 Phase 3 — complete market-data pipeline audit + historical
security master. Recomputes the per-symbol audit from the real database
(Task 102 logic, preserved semantics), builds the security master with stable
instrument IDs and point-in-time-usable observation-derived lifetimes,
missing-session report, coverage matrix, freshness and reconciliation reports.
All 909 symbols incl. delisted/suspended histories are preserved."""
from __future__ import annotations
import json, sys, time
import numpy as np
import pandas as pd
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L  # noqa: E402

MAX_SESSION_GAP_MS = 5 * 86400_000
STALE_VOLUME_DAYS = 20
PRICE_JUMP_FRAC = 0.40
VERIFIED, PARTIAL, STALE_S, INVALID = L.VERIFIED, L.PARTIALLY_VERIFIED, L.STALE, L.INVALID


def audit_symbol(g: pd.DataFrame) -> dict:
    g = g.sort_values("date")
    n = len(g)
    dates = pd.to_datetime(g["date"]).values.astype("datetime64[ms]").astype(np.int64)
    gaps = np.diff(dates)
    o, h, l, c, v = (g[k].values.astype(float) for k in ("open", "high", "low", "close", "volume"))
    traded = (o > 0) & (h > 0) & (l > 0) & (c > 0)
    with np.errstate(invalid="ignore"):
        h_l_contradictions = int(np.sum(traded & (h < l)))
        envelope_violations = int(np.sum(traded & (h >= l) &
            ((h < np.maximum(o, c)) | (l > np.minimum(o, c)))))
    zero_price_sessions = int(np.sum(~traded))
    neg = int(np.sum(v < 0))
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
        status = INVALID
    elif envelope_violations > n * 0.10:
        status = PARTIAL
    elif n < 250 or big_gaps > 12 or zero_vol_frac > 0.5 or zero_price_frac > 0.5:
        status = STALE_S
    elif big_gaps or jumps or zero_vol_frac > 0.05 or zero_price_frac > 0.05:
        status = PARTIAL
    else:
        status = VERIFIED
    return {"symbol": g["symbol"].iloc[0], "n_bars": n,
             "first_date": pd.to_datetime(dates[0], unit="ms").strftime("%Y-%m-%d"),
             "last_date": pd.to_datetime(dates[-1], unit="ms").strftime("%Y-%m-%d"),
             "h_l_contradictions": h_l_contradictions, "envelope_violations": envelope_violations,
             "neg_values": neg, "zero_price_sessions": zero_price_sessions,
             "duplicate_dates": dup_dates, "gaps_over_5d": big_gaps,
             "max_session_gap_days": round(float(gaps.max() / 86400_000), 1) if n > 1 else 0,
             "single_day_jumps_ge_40pct": jumps, "zero_volume_frac": round(zero_vol_frac, 4),
             "stale_volume_recent": stale_vol, "quality_score": round(score, 1), "status": status}


def main() -> None:
    t0 = time.time()
    con = L.db_conn()
    df = pd.read_sql("SELECT symbol,date,open,high,low,close,volume FROM OhlcvBar "
                      "ORDER BY symbol,date", con)
    con.close()
    t102_inv = L.load_t102("task102_market_data_inventory.json")
    pilot25 = list(t102_inv["universes"]["pilot25"].keys())
    canonical8 = list(t102_inv["universes"]["canonical8"].keys())
    sectors = L.load_json(L.ROOT / "data/askanalyst/sector_overrides.json").get("sectors", {})
    rows = []
    for sym, g in df.groupby("symbol", sort=False):
        try:
            rows.append(audit_symbol(g))
        except Exception as e:
            rows.append({"symbol": sym, "status": INVALID, "error": str(e)[:100]})
    cov = pd.DataFrame(rows)
    cov.to_csv(L.BASE / "task103_symbol_coverage.csv", index=False)
    summary = cov["status"].value_counts().to_dict()

    # ── security master (stable IDs; observation-derived lifetimes, flagged) ──
    sym2 = {r["symbol"]: r for r in rows}
    all_dates = pd.to_datetime(sorted(df["date"].unique()))
    last_verified_session = all_dates[-1].strftime("%Y-%m-%d")
    master = []
    for i, r in enumerate(sorted(rows, key=lambda x: x["symbol"]), start=1):
        sym = r["symbol"]
        last_dt = pd.Timestamp(r["last_date"])
        days_since = (all_dates[-1] - last_dt).days
        delisted = days_since > 60
        suspended_recent = (not delisted) and (r.get("stale_volume_recent", 0) >= STALE_VOLUME_DAYS
                                                or days_since > 14)
        master.append({
            "instrument_id": f"PSX-INST-{i:04d}", "current_symbol": sym,
            "historical_symbols": [sym],
            "company_name": None,
            "sector": sectors.get(sym),
            "sector_source": "task98_sector_overrides" if sectors.get(sym) else "unknown",
            "first_observation": r["first_date"], "last_observation": r["last_date"],
            "listing_date_estimate": r["first_date"],
            "delisting_date_estimate": (r["last_date"] if delisted else None),
            "lifetime_derivation": "first/last OhlcvBar observation - an OBSERVATION-derived "
                                    "approximation; official listing/delisting dates require the "
                                    "security-master source (blocked_external_data)",
            "instrument_type": "common_stock",
            "trading_status": ("delisted_or_inactive" if delisted else
                                "suspended_or_illiquid_recent" if suspended_recent else "active"),
            "days_since_last_observation": int(days_since), "n_bars": r["n_bars"],
            "data_status": r["status"], "quality_score": r["quality_score"],
            "source": "db/custom.db OhlcvBar + task98 sector overrides",
            "effective_date_of_record": last_verified_session,
            "pit_note": "historical universes MUST use point-in-time membership (first/"
                        "last observation windows), never today's survivor list"})
    pd.DataFrame(master).to_csv(L.BASE / "task103_symbol_master.csv", index=False)

    # ── missing-session report vs global calendar ────────────────────────────
    cal_ms = all_dates.values.astype("datetime64[ms]").astype(np.int64)
    missing = []
    for sym, g in df.groupby("symbol", sort=False):
        s = pd.to_datetime(g["date"].sort_values()).values.astype("datetime64[ms]").astype(np.int64)
        first, last = np.searchsorted(cal_ms, s[0]), np.searchsorted(cal_ms, s[-1])
        expected = cal_ms[first:last + 1]
        miss = len(expected) - len(np.intersect1d(expected, s))
        if miss:
            missing.append({"symbol": sym, "sessions_in_span": int(len(expected)),
                             "present": int(len(expected) - miss), "missing_sessions": int(miss)})
    miss_df = pd.DataFrame(missing).sort_values("missing_sessions", ascending=False) if missing \
        else pd.DataFrame(columns=["symbol", "sessions_in_span", "present", "missing_sessions"])
    miss_df.head(50).to_csv(L.BASE / "task103_missing_sessions_top50.csv", index=False)

    # ── coverage matrix (symbol × year completeness) ─────────────────────────
    d = df[["symbol", "date"]].copy()
    d["year"] = pd.to_datetime(d["date"]).dt.year
    n_year = d.groupby(["symbol", "year"]).size().unstack(fill_value=0)
    n_year.to_csv(L.BASE / "task103_data_coverage_matrix.csv")

    fresh = cov[["symbol", "last_date", "status", "quality_score"]].copy()
    fresh["days_behind_latest"] = (pd.Timestamp(last_verified_session)
                                    - pd.to_datetime(fresh["last_date"])).dt.days
    fresh.sort_values("days_behind_latest", ascending=False).to_csv(
        L.BASE / "task103_data_freshness.csv", index=False)
    fresh_by_status = fresh.groupby("status")["days_behind_latest"].agg(
        ["count", "median", "max"]).reset_index().to_dict("records")

    t102_cov = pd.read_csv(L.T102 / "task102_symbol_coverage.csv") if (L.T102 /
                                                                        "task102_symbol_coverage.csv").exists() else None
    recon = {"vs_task102": {
        "symbols": {"task102": int(len(t102_cov)) if t102_cov is not None else None,
                     "task103": len(cov), "match": bool(t102_cov is not None and len(t102_cov) == len(cov))},
        "bars": {"task102": int(t102_inv["n_bars"]) if t102_inv else None, "task103": int(len(df))},
        "status_counts": {"task102": t102_inv["status_counts"] if t102_inv else None,
                           "task103": summary}}}
    L.write_artifact("task103_market_data_audit.json", {
        "report": "task103_market_data_audit", "generated_at": L.NOW(),
        "status": "completed",
        "source": "db/custom.db OhlcvBar recomputed 2026-11-02 (Task 102 audit semantics "
                   "preserved; per-symbol rows in task103_symbol_coverage.csv)",
        "n_symbols": len(cov), "n_bars": int(len(df)),
        "date_range": [str(df['date'].min()), str(df['date'].max())],
        "status_counts": summary,
        "universes": {"pilot25_symbols": pilot25, "canonical8_symbols": canonical8,
                       "source": "frozen Task 102 inventory (reused, not re-derived)"},
        "checks": ["OHLC envelope (vendor trait recorded, raw preserved)", "duplicate dates",
                    "negative values", "zero/stale volume", "session gaps >5d",
                    "single-day jumps >=40% (corporate-action suspects, NOT adjusted)",
                    "survivorship: delisted histories retained, no purge"],
        "honesty": {"raw_vs_adjusted": "raw only; no adjusted series exists in the DB",
                     "pit_universes": "membership by observation window; survivors-only "
                                       "universes are prohibited",
                     "suspensions": "legitimate suspended/illiquid periods kept identifiable "
                                     "via trading_status + zero-volume fractions"},
        "runtime_seconds": round(time.time() - t0, 1)})
    L.write_artifact("task103_symbol_master_report.json", {
        "report": "task103_symbol_master_report", "generated_at": L.NOW(), "status": "completed",
        "n_instruments": len(master),
        "instrument_id_scheme": "PSX-INST-#### (stable internal surrogate, ordered by symbol)",
        "trading_status_counts": pd.Series([m["trading_status"] for m in master]).value_counts().to_dict(),
        "sector_coverage": {"with_sector": sum(1 for m in master if m["sector"]),
                             "unknown": sum(1 for m in master if not m["sector"]),
                             "source": "task98 sector_overrides (verified families only; "
                                        "no sector is inferred for unknown symbols)"},
        "limitations": ["company_name not available from any verified source (null, not invented)",
                         "historical symbol changes cannot be detected from a single-source "
                         "price table; no rename registry exists (blocked_external_data)",
                         "listing/delisting dates are observation-derived approximations"],
        "master_file": "data/backtest_reports/task103/task103_symbol_master.csv"})
    L.write_artifact("task103_missing_sessions_report.json", {
        "report": "task103_missing_sessions", "generated_at": L.NOW(), "status": "completed",
        "definition": "sessions present in the global PSX calendar (union of all symbols) "
                       "inside a symbol's own first..last span but absent for that symbol",
        "symbols_with_gaps": int(len(miss_df)),
        "worst": miss_df.head(10).to_dict("records"),
        "note": "gaps are legitimate (suspensions/holidays per-symbol); they are reported, "
                 "not deleted or forward-filled",
        "full_top50": "task103_missing_sessions_top50.csv"})
    L.write_artifact("task103_data_freshness.json", {
        "report": "task103_data_freshness", "generated_at": L.NOW(), "status": "completed",
        "latest_session": last_verified_session,
        "freshness_by_status": fresh_by_status,
        "stale_definition": "days_behind_latest > 0 at the symbol's last observation",
        "note": "freshness is limited by the ingestion pipeline, not by vendor staleness"})
    L.write_artifact("task103_reconciliation_report.json", {
        "report": "task103_reconciliation_vs_task102", "generated_at": L.NOW(),
        "status": "completed", **recon,
        "note": "Task 102 audit figures recomputed from the same DB; differences would be "
                 "investigated before any use"})
    print(f"phase3 audit done {time.time()-t0:.0f}s: {len(cov)} symbols, statuses={summary}, "
          f"missing-session symbols={len(miss_df)}")


if __name__ == "__main__":
    main()
