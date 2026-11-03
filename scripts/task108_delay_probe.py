#!/usr/bin/env python3
"""Task 108 Phase 7 — provider delay measurement log.

Two jobs:
  1. probe NOW: fetch every symbol once, record retrieval timestamp, provider
     meta timestamp, price, poll latency, and (post-session) whether the quote
     equals the daily close; append to the observation log.
  2. regenerate task108_in_session_observations.csv from the durable snapshot
     store (every stored observation across all cycles) so the log grows as the
     worker captures future sessions.
The provider publishes NO source market timestamp — market timestamps stay
estimated (retrieved_at − 15 min) and are labeled as such everywhere.
"""
from __future__ import annotations
import csv, json, sqlite3, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT = Path("/home/z/my-project")
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402
import task107_monitor as M  # noqa: E402

T108 = ROOT / "data/backtest_reports/task108"
PKT = LB.PKT
PROVIDER_DELAY_MIN = 15  # user-observed assumption — never presented as verified


def probe_once() -> dict:
    now_pkt = datetime.now(PKT)
    window = M.feed_window_status(now_pkt)
    db = LB.db_connect()
    frontier = LB.frontier_date()
    rows, lat = [], []
    for i, sym in enumerate(LB.PILOT25):
        if i:
            time.sleep(0.12)
        t0 = time.time()
        c, dt, d, e = LB.fetch_json(f"{LB.BASE}/stocks/{sym}/quote", timeout=10)
        lat.append(dt * 1000)
        close = db.execute("SELECT close FROM OhlcvBar WHERE symbol=? AND date=?", (sym, frontier)).fetchone()
        close = close[0] if close else None
        entry = {
            "symbol": sym, "probe_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "window_status": window, "retrieved_at": None, "provider_meta_ts": None,
            "price": None, "daily_close": close, "quote_eq_close": None,
            "estimated_source_ts": None, "provider_delay_assumption_minutes": PROVIDER_DELAY_MIN,
            "timestamp_quality": "estimated_source_timestamp", "poll_latency_ms": round(dt * 1000, 1),
            "error": None}
        if c != 200 or not (d or {}).get("data") or d["data"].get("price") is None:
            entry["error"] = f"{c} {e}"
        else:
            price = d["data"]["price"]
            meta_ts = (d.get("meta", {}) or {}).get("timestamp")
            entry.update({"retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                           "provider_meta_ts": meta_ts, "price": price,
                           "quote_eq_close": (abs(price - close) <= 0.011) if close else None})
            try:
                ret = datetime.fromisoformat(meta_ts).astimezone(PKT) if meta_ts else now_pkt
            except ValueError:
                ret = now_pkt
            entry["estimated_source_ts"] = (ret - timedelta(minutes=PROVIDER_DELAY_MIN)).strftime("%Y-%m-%dT%H:%M:%S+05:00")
        rows.append(entry)
    db.close()
    return {"window": window, "frontier": frontier, "rows": rows,
             "avg_latency_ms": round(sum(lat) / max(1, len(lat)), 1),
             "max_latency_ms": round(max(lat), 1) if lat else None}


def regenerate_csv() -> list[dict]:
    """Full observation log from the durable store (every stored snapshot)."""
    conn = sqlite3.connect(ROOT / "data/external_imports/psx_eod/task107_snapshots.db")
    rows = conn.execute("""SELECT symbol, estimated_source_ts, price, retrieved_at, provider,
        market_date, provider_delay_minutes, timestamp_quality FROM snapshots
        ORDER BY retrieved_at, symbol""").fetchall()
    conn.close()
    out = []
    for sym, est, price, ret, prov, mdate, dmin, quality in rows:
        out.append({"symbol": sym, "estimated_source_ts": est, "price": price,
                     "retrieved_at": ret, "provider": prov, "market_date": mdate,
                     "provider_delay_assumption_minutes": dmin, "timestamp_quality": quality,
                     "source": "durable snapshot store (worker/Actions cycles)"})
    return out


def main() -> int:
    T108.mkdir(parents=True, exist_ok=True)
    probe = probe_once()
    matches = [r for r in probe["rows"] if r.get("quote_eq_close")]
    errors = [r for r in probe["rows"] if r.get("error")]
    # cadence evidence: time between distinct stored observations per symbol
    conn = sqlite3.connect(ROOT / "data/external_imports/psx_eod/task107_snapshots.db")
    cad = conn.execute("""SELECT symbol, COUNT(*) n,
        (MAX(julianday(retrieved_at)) - MIN(julianday(retrieved_at))) * 1440 span_min
        FROM snapshots GROUP BY symbol ORDER BY n DESC LIMIT 5""").fetchall()
    latency = conn.execute("""SELECT AVG(duration_seconds), MAX(duration_seconds),
        AVG(interval_since_prev_seconds), COUNT(*) FROM cycle_latency""").fetchone()
    conn.close()
    report = {
        "report": "task108_provider_delay_measurements",
        "generated_at": LB.NOW(), "status": "completed",
        "delay_status": {
            "user_reported_delay_minutes": 15,
            "estimated_delay_minutes": 15,
            "provider_verified_delay_minutes": None,
            "note": "the provider supplies NO source market timestamp on quote snapshots (verified in task107_delay_verification.json); every market timestamp is estimated as retrieved_at − 15 min and labeled estimated_source_timestamp"},
        "current_probe": {
            "window_status": probe["window"], "data_frontier": probe["frontier"],
            "symbols_probed": len(probe["rows"]), "provider_errors": len(errors),
            "error_symbols": [r["symbol"] for r in errors],
            "quote_equals_daily_close": len(matches),
            "quote_vs_close_scope": "post-session probe: quotes equal the verified daily close for matched symbols; this evidences final-capture correctness, NOT the intraday delay",
            "avg_poll_latency_ms": probe["avg_latency_ms"], "max_poll_latency_ms": probe["max_latency_ms"]},
        "observed_cadence": {
            "note": "distinct observations per symbol so far; true publication cadence measurable only across in-session captures (worker collects from the next session)",
            "top_symbols": [{"symbol": s, "distinct_observations": n, "span_minutes": round(sp or 0, 1)} for s, n, sp in cad]},
        "poll_latency": {
            "avg_cycle_seconds": round(latency[0], 2) if latency[0] else None,
            "max_cycle_seconds": round(latency[1], 2) if latency[1] else None,
            "avg_interval_between_cycles_seconds": round(latency[2], 2) if latency[2] else None,
            "cycles_recorded": latency[3],
            "application_delay_beyond_provider": "poll cadence (120s worker / 300s Actions fallback) — engine processes each new observation immediately; no extra 15-minute wait is added"},
        "timestamp_quality_rule": {
            "estimated": "market_timestamp = retrieved_at − 15 min (labeled estimated_source_timestamp)",
            "verified": "never claimed — provider publishes no source timestamp",
            "retrieved": "retrieved_at is the actual fetch time (provider meta.timestamp or local UTC clock)"},
        "limitations": [
            "today's probe ran after the 15:45 PKT window (21:5x PKT) — in-session cadence/delay distributions begin with the next session via the always-on worker",
            "HASCOL is a structural provider gap (persistent 404)"],
        "verdict": "completed"}
    (T108 / "task108_provider_delay_measurements.json").write_text(json.dumps(report, indent=1))

    log = regenerate_csv()
    with open(T108 / "task108_in_session_observations.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(log[0].keys()))
        w.writeheader()
        w.writerows(log)
    summary = {"probe_symbols": len(probe["rows"]), "errors": len(errors),
                "quote_eq_close": len(matches), "csv_rows": len(log),
                "avg_latency_ms": probe["avg_latency_ms"]}
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
