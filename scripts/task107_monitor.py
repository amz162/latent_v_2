#!/usr/bin/env python3
"""Task 107 v2 Phases 2-4 + 10 — delayed-snapshot monitor engine.

Mode: `delayed_observation_shadow` with SNAPSHOT semantics (the provider has no
candles endpoint — verified in task107_delay_verification.json). Never
manufactures OHLC around a snapshot; every snapshot keeps
  market_timestamp  = estimated_source_timestamp (retrieved_at - 15 min, labeled estimated)
  retrieved_at      = actual retrieval time (tz-aware)
Idempotent: UNIQUE(symbol, estimated_source_ts, price, provider); repeat cycles
detect no new observations. Separate SQLite store: snapshots are kept apart
from the daily OhlcvBar dataset.

Also performs the 15:45 PKT end-of-session reconciliation and writes the
open-position state consumed by /api/paper-trading/monitor.
"""
from __future__ import annotations
import csv, json, sqlite3, subprocess, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT = Path("/home/z/my-project")
T107 = ROOT / "data/backtest_reports/task107"
OPS = T107 / "ops"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # type: ignore  # noqa: E402
import task107_lib as LB  # type: ignore  # noqa: E402

PKT = LB.PKT
SNAP_DB = ROOT / "data/external_imports/psx_eod/task107_snapshots.db"
PROVIDER_DELAY_MIN = 15          # user-observed, verified structurally (no source ts on quotes)
POLL_INTERVAL_SECONDS = 120      # configurable; default inside 1-2 min recommendation
FEED_WINDOW = ("09:45", "15:45") # delayed-observation availability window (PKT)
SNAPSHOT_SOURCE_TTL_MIN = 30     # during-window staleness threshold
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]


def classify_snapshot(price: float, sl: float | None, tp1: float | None, has_legs: bool,
                       remaining: int, sessions_to_21: int) -> str:
    """Pure snapshot-semantics classifier (unit-tested): an observed crossing
    only — the intraperiod path between snapshots is unknowable."""
    if price is None:
        return "pending_data"
    sl_hit = sl is not None and price <= sl + 1e-9
    tp_hit = tp1 is not None and price >= tp1 - 1e-9
    if sl_hit and tp_hit:
        return "ambiguous_same_bar"
    if sl_hit:
        return "stop_loss_observed"
    if tp_hit:
        return "target_touched"
    if has_legs:
        return "partially_exited"
    if sessions_to_21 <= 0:
        return "time_up"
    return "open"


def feed_window_status(now: datetime) -> str:
    hm = now.strftime("%H:%M")
    if now.weekday() >= 5:
        return "weekend_closed"
    if hm < FEED_WINDOW[0]:
        return "pre_window"
    if hm > FEED_WINDOW[1]:
        return "post_window"
    return "open"


def ensure_snap_db() -> sqlite3.Connection:
    SNAP_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SNAP_DB)
    conn.execute("""CREATE TABLE IF NOT EXISTS snapshots (
        symbol TEXT NOT NULL, estimated_source_ts TEXT NOT NULL, price REAL NOT NULL,
        retrieved_at TEXT NOT NULL, provider TEXT NOT NULL, market_date TEXT,
        provider_delay_minutes INTEGER, timestamp_quality TEXT, data_interval TEXT,
        UNIQUE(symbol, estimated_source_ts, price, provider))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS poll_log (
        cycle_id TEXT PRIMARY KEY, started_at TEXT, ended_at TEXT, window_status TEXT,
        symbols_polled INTEGER, snapshots_new INTEGER, snapshots_total INTEGER,
        provider_errors INTEGER, notes TEXT)""")
    return conn


def load_open_positions() -> list[dict]:
    matured = json.loads((T107 / "_matured.json").read_text())
    ledger = {l["decision_id"]: l for l in json.loads((T107 / "_pending_ledger.json").read_text())}
    rows = []
    for o in matured["observations"]:
        if "decision_date" not in o:
            continue
        lv = ledger.get(o["decision_id"], {})
        for st, res in o["outcomes"].items():
            if st not in STRATS or res.get("status") != "pending_mtm":
                continue
            resolved = res.get("genuinely_resolved_legs", []) or []
            resolved_qty = sum(l.get("qty", 0) for l in resolved)
            rows.append({
                "trade_key": f"{o['decision_id']}::{st}",
                "decision_id": o["decision_id"], "strategy": st,
                "generation": lv.get("generation", ""),
                "symbol": o["symbol"], "side": "BUY",
                "model_version": "task104-frozen-protocol-repro (research-only)",
                "signal_source": "AI model shadow observation (frozen protocol)",
                "signal_time": o["decision_date"], "entry_date": o["entry_date"],
                "entry_price": res["entry"], "quantity": res["quantity"],
                "resolved_legs": resolved, "resolved_legs_pnl": res.get("resolved_legs_pnl_pkr", 0.0),
                "remaining_quantity": res["quantity"] - resolved_qty,
                "sl": lv["levels"]["sl"], "tp1": lv["levels"]["tp1"],
                "tp2": lv["levels"]["tp2"], "tp3": lv["levels"]["tp3"],
                "sessions_available": res.get("sessions_available"),
                "sessions_to_21": max(0, 21 - (res.get("sessions_available") or 0)),
                "engine_unrealized_mtm": res.get("unrealized_mtm_pkr"),
                "daily_mark_date": res.get("mark_date")})
    return rows


def daily_same_bar_ambiguity(db, rows: list[dict]) -> None:
    """Flag positions whose entry-to-date daily bars contain BOTH an SL touch and
    a TP1 touch in the SAME daily bar (daily resolution cannot order them)."""
    for r in rows:
        bars = db.execute(
            "SELECT date, high, low FROM OhlcvBar WHERE symbol=? AND date>=? AND date<=? ORDER BY date",
            (r["symbol"], r["entry_date"] or "2026-10-30", r["daily_mark_date"] or "9999")).fetchall()
        amb = [d for d, hi, lo in bars
               if lo is not None and hi is not None
               and lo <= r["sl"] + 1e-9 and hi >= r["tp1"] - 1e-9]
        r["ambiguous_same_bar_dates"] = amb


def main() -> int:
    t0 = time.time()
    with LB.Lock("task107_monitor"):
        now = datetime.now(PKT)
        window = feed_window_status(now)
        conn = ensure_snap_db()
        errors = []
        # ── poll cycle: fetch snapshots ──────────────────────────────────────
        new_snaps, total_before = 0, conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
        latest = {}
        for i, sym in enumerate(LB.PILOT25):
            if i:
                time.sleep(0.12)  # rate-limit courtesy
            c, dtl, d, e = LB.fetch_json(f"{LB.BASE}/stocks/{sym}/quote", timeout=10)
            if c != 200 or not (d or {}).get("data") or d["data"].get("price") is None:
                errors.append({"symbol": sym, "status": c, "error": e})
                continue
            price = d["data"]["price"]
            retrieved = d.get("meta", {}).get("timestamp") or datetime.now(timezone.utc).isoformat()
            try:
                ret_dt = datetime.fromisoformat(retrieved).astimezone(PKT)
            except ValueError:
                ret_dt = now
            src_dt = ret_dt - timedelta(minutes=PROVIDER_DELAY_MIN)  # ESTIMATED (labeled)
            est = src_dt.strftime("%Y-%m-%dT%H:%M:%S+05:00")
            # Idempotency: the provider publishes no observation id, so a NEW
            # observation is detected by a CHANGED price since the last stored
            # snapshot (unchanged polls are no-ops, never re-processed).
            last = conn.execute("SELECT price FROM snapshots WHERE symbol=? ORDER BY retrieved_at DESC, rowid DESC LIMIT 1", (sym,)).fetchone()
            if last is not None and abs(price - last[0]) <= 0.011:
                latest[sym] = {"price": last[0], "retrieved_at": ret_dt.isoformat(),
                                "estimated_source_ts": est, "cached": d.get("meta", {}).get("cached"),
                                "changed": False}
                continue
            conn.execute(
                "INSERT OR IGNORE INTO snapshots VALUES (?,?,?,?,?,?,?,?,?)",
                (sym, est, price, ret_dt.isoformat(), "psxdata-api.fastapicloud.dev",
                 src_dt.strftime("%Y-%m-%d"), PROVIDER_DELAY_MIN,
                 "estimated_source_timestamp", None))
            new_snaps += 1
            latest[sym] = {"price": price, "retrieved_at": ret_dt.isoformat(),
                            "estimated_source_ts": est, "cached": d.get("meta", {}).get("cached"),
                            "changed": True}
        total_after = conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]

        # ── positions ────────────────────────────────────────────────────────
        rows = load_open_positions()
        db = LB.db_connect()
        daily_same_bar_ambiguity(db, rows)
        frontier = LB.frontier_date()
        db.close()
        cost_in = []
        for r in rows:
            snap = latest.get(r["symbol"])
            # daily-bar touch flags (same-candle problem handled explicitly)
            if snap:
                r.update({"latest_price": snap["price"], "market_timestamp": snap["estimated_source_ts"],
                           "retrieved_at": snap["retrieved_at"], "provider_delay_minutes": PROVIDER_DELAY_MIN,
                           "timestamp_quality": "estimated_source_timestamp",
                           "data_interval": None, "data_source": "provider delayed quote snapshot",
                           "snapshot_event": "delayed_observation_shadow"})
                r["_age_min"] = (now - datetime.fromisoformat(snap["retrieved_at"])).total_seconds() / 60
            else:
                r.update({"latest_price": None, "pending_data": True,
                           "data_interval": "daily_ohlc_approximation",
                           "data_source": "daily bar (frontier close)",
                           "market_timestamp": None, "retrieved_at": None})
            # status per snapshot semantics (pure classifier; unit-tested)
            if r.get("latest_price") is None:
                r["status"] = "pending_data"
            else:
                p = r["latest_price"]
                sl_hit, tp_hit = p <= r["sl"] + 1e-9, p >= r["tp1"] - 1e-9
                best = r["tp3"] if p >= r["tp3"] - 1e-9 else r["tp2"] if p >= r["tp2"] - 1e-9 else r["tp1"] if tp_hit else None
                r["best_target_reached"] = best
                r["crossed_and_recovered_possible"] = True  # snapshots cannot see intraperiod excursions
                r["status"] = classify_snapshot(p, r["sl"], r["tp1"], bool(r["resolved_legs"]),
                                                 r["remaining_quantity"], r["sessions_to_21"])
            # estimated P&L inputs (authoritative V2 costs computed once per cycle)
            if r.get("latest_price") is not None and r["remaining_quantity"] > 0:
                r["unrealized_gross_pnl"] = round((r["latest_price"] - r["entry_price"]) * r["remaining_quantity"], 2)
                cost_in.append({"key": r["trade_key"], "buyQuantity": r["quantity"], "buyPrice": r["entry_price"],
                                 "exitLegs": [*({"quantity": l.get("qty", 0), "exitPrice": l.get("price", r["entry_price"])} for l in r["resolved_legs"]),
                                              {"quantity": r["remaining_quantity"], "exitPrice": r["latest_price"]}],
                                 "grossPnl": round(r["resolved_legs_pnl"] + r["unrealized_gross_pnl"], 2)})
        # costs via the production engine
        costs = {}
        if cost_in:
            Path("/tmp/t107_costs_in.json").write_text(json.dumps(cost_in))
            rc = subprocess.run(["bun", "scripts/task107_cost_quote.ts", "/tmp/t107_costs_in.json", "/tmp/t107_costs_out.json"],
                                 capture_output=True, text=True, cwd=ROOT, timeout=120)
            if rc.returncode == 0:
                costs = json.loads(Path("/tmp/t107_costs_out.json").read_text())
            else:
                errors.append({"cost_engine": rc.stderr[-160:]})
        for r in rows:
            c = costs.get(r["trade_key"], {})
            r["estimated_exit_costs"] = c.get("exitSideCosts")
            r["estimated_cgt"] = c.get("cgt")
            r["estimated_unrealized_net_pnl"] = (round(r["unrealized_gross_pnl"] - (c.get("exitSideCosts") or 0) - (c.get("cgt") or 0), 2)
                                                   if r.get("unrealized_gross_pnl") is not None else None)
            r["total_position_net_pnl_estimate"] = (round(r["resolved_legs_pnl"] + r["estimated_unrealized_net_pnl"], 2)
                                                     if r.get("estimated_unrealized_net_pnl") is not None else None)
            r["freshness"] = ("stale_data" if r.get("_age_min") is not None and window == "open" and r["_age_min"] > SNAPSHOT_SOURCE_TTL_MIN
                               else "session_closed_data" if window != "open" and r.get("latest_price") is not None
                               else "fresh" if r.get("latest_price") is not None else "no_data")
            r.pop("_age_min", None)

        # ── event ledger (append status transitions only) ────────────────────
        OPS.mkdir(parents=True, exist_ok=True)
        ev_path = OPS / "event_ledger.json"
        events = json.loads(ev_path.read_text()) if ev_path.exists() else []
        seen = {(e["trade_key"], e["status"]) for e in events}
        cycle_id = f"cycle_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
        for r in rows:
            if (r["trade_key"], r["status"]) not in seen:
                events.append({"trade_key": r["trade_key"], "symbol": r["symbol"],
                                "status": r["status"], "observed_price": r.get("latest_price"),
                                "event_market_timestamp": r.get("market_timestamp"),
                                "detected_at": datetime.now(PKT).isoformat(),
                                "provider_delay_minutes": PROVIDER_DELAY_MIN,
                                "execution_mode": "delayed_observation_shadow",
                                "resolution": "observation_resolution_limited (snapshot semantics; no intraperiod path knowledge)",
                                "cycle_id": cycle_id})
        ev_path.write_text(json.dumps(events[-2000:], indent=1))
        with open(T107 / "task107_position_event_ledger.csv", "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=["trade_key", "symbol", "status", "observed_price",
                                                "event_market_timestamp", "detected_at", "provider_delay_minutes",
                                                "execution_mode", "resolution", "cycle_id"])
            w.writeheader()
            w.writerows(events)

        # ── EOD reconciliation (runs meaningfully after 15:45 PKT) ───────────
        eod = None
        if window in ("post_window", "weekend_closed") or now.strftime("%H:%M") >= "15:45":
            db = LB.db_connect()
            matches, checked = 0, 0
            for sym, q in latest.items():
                row = db.execute("SELECT close FROM OhlcvBar WHERE symbol=? AND date=?", (sym, frontier)).fetchone()
                if row:
                    checked += 1
                    if abs(q["price"] - row[0]) <= 0.011:
                        matches += 1
            db.close()
            state = ("eod_verified" if checked and matches / max(1, checked) >= 0.8
                      else "eod_partial" if checked else "eod_missing")
            eod = {"session_date": frontier, "checked": checked, "quote_matches_close": matches,
                    "state": state,
                    "note": "quote price equals the session daily close for matched symbols; the provider publishes no final-candle completeness flag, so completeness follows the data itself"}
            (T107 / "task107_eod_reconciliation.json").write_text(json.dumps({
                "report": "task107_eod_reconciliation", "generated_at": L.NOW(), "status": "completed",
                "session_date": frontier, "final_update_window": "15:45 PKT (user-observed)",
                "quote_vs_daily_close": {"checked": checked, "matched": matches},
                "eod_state": state,
                "maturity": "open positions remain open overnight unless the strategy rules mature them (21 sessions / terminal exit); no forced closes",
                "verdict": "completed"}, indent=1))
            (T107 / "task107_final_delayed_update.json").write_text(json.dumps({
                "report": "task107_final_delayed_update", "generated_at": L.NOW(), "status": "completed",
                "latest_snapshot_per_symbol": {s: {"price": q["price"], "retrieved_at": q["retrieved_at"],
                                                    "estimated_source_ts": q["estimated_source_ts"]} for s, q in latest.items()},
                "retrieval_mode": "poll cycle at engine run time; snapshots preserved in task107_snapshots.db",
                "verdict": "completed"}, indent=1))
            (T107 / "task107_overnight_positions.json").write_text(json.dumps({
                "report": "task107_overnight_positions", "generated_at": L.NOW(), "status": "completed",
                "open_overnight": len(rows),
                "positions": [{"trade_key": r["trade_key"], "symbol": r["symbol"], "status": r["status"],
                                "latest_price": r.get("latest_price"), "sessions_to_21": r["sessions_to_21"]} for r in rows],
                "resume_rule": "next verified session resumes monitoring; no duplicate trade creation for existing positions",
                "verdict": "completed"}, indent=1))

        # ── poll log + state for the API ─────────────────────────────────────
        conn.execute("INSERT OR REPLACE INTO poll_log VALUES (?,?,?,?,?,?,?,?,?)",
                      (cycle_id, L.NOW(), datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                       window, len(LB.PILOT25) - len([e for e in errors if "symbol" in e]), new_snaps,
                       total_after, len(errors), json.dumps(errors)[:200]))
        conn.commit()
        hist = conn.execute("SELECT cycle_id, started_at, window_status, symbols_polled, snapshots_new, snapshots_total, provider_errors FROM poll_log ORDER BY started_at DESC LIMIT 50").fetchall()
        conn.close()
        legacy = _legacy_rows()
        state = {
            "generated_at": L.NOW(), "cycle_id": cycle_id,
            "feed": {"provider": LB.BASE, "mode": "delayed_observation_shadow",
                      "data_type": "delayed_snapshot_only (no candle endpoint — verified)",
                      "provider_delay_minutes": PROVIDER_DELAY_MIN, "bar_interval_minutes": None,
                      "poll_interval_seconds": POLL_INTERVAL_SECONDS, "window": FEED_WINDOW,
                      "window_status": window, "staleness_threshold_minutes": SNAPSHOT_SOURCE_TTL_MIN},
            "snapshot_store": {"path": str(SNAP_DB.relative_to(ROOT)), "total": total_after, "new_this_cycle": new_snaps},
            "provider_errors": errors,
            "positions": rows,
            "summary": _summarize(rows),
            "legacy_paper_trades": legacy,
            "eod": eod,
            "job_history": [dict(zip(["cycle_id", "started_at", "window_status", "symbols_polled", "snapshots_new", "snapshots_total", "provider_errors"], h)) for h in hist],
            "disclaimers": [
                "Market data is delayed by approximately 15 minutes (user-observed). Displayed prices carry an earlier market timestamp, not the live exchange price.",
                "Snapshot semantics: a price beyond a level is an OBSERVED CROSSING at the snapshot; intraperiod touches/recoveries between snapshots are invisible (observation_resolution_limited).",
                "Open positions are neither wins nor losses; MTM is not realized P&L."]}
        (OPS / "monitor_state.json").write_text(json.dumps(state, indent=1))
        (T107 / "task107_open_positions.json").write_text(json.dumps({
            "report": "task107_open_positions", "generated_at": L.NOW(), "status": "completed",
            "n_active": len(rows), "positions": rows,
            "legacy_group": legacy,
            "execution_mode": "delayed_observation_shadow",
            "verdict": "completed"}, indent=1))
        (T107 / "task107_paper_trade_monitoring.json").write_text(json.dumps({
            "report": "task107_paper_trade_monitoring", "generated_at": L.NOW(), "status": "completed",
            "cycle_id": cycle_id, "window_status": window,
            "snapshots": {"new": new_snaps, "total": total_after},
            "summary": state["summary"], "provider_errors": errors,
            "processing": "each newly received snapshot is processed immediately on arrival (no extra 15-minute wait); duplicates suppressed by the unique key",
            "verdict": "completed"}, indent=1))
        LB.append_run_log("monitor", {"cycle": cycle_id, "window": window, "new": new_snaps,
                                        "total": total_after, "positions": len(rows), "errors": len(errors)})
        print(json.dumps({"cycle": cycle_id, "window": window, "snapshots_new": new_snaps,
                           "snapshots_total": total_after, "positions": len(rows),
                           "status_counts": state["summary"]["by_status"], "errors": len(errors)}))
        return 0


def _summarize(rows: list[dict]) -> dict:
    by = {}
    for r in rows:
        by[r["status"]] = by.get(r["status"], 0) + 1
    unreal = round(sum(r.get("estimated_unrealized_net_pnl") or 0 for r in rows), 2)
    return {"n_active": len(rows), "by_status": by, "by_symbol_count": len({r["symbol"] for r in rows}),
             "estimated_unrealized_net_pnl_total_pkr": unreal,
             "separate_from_realized": "realized P&L lives in the maturity ledger (-PKR 75,548.35); MTM here is never counted as realized"}


def _legacy_rows() -> dict:
    db = LB.db_connect()
    cols = [c[1] for c in db.execute("PRAGMA table_info(ProspectivePaperTrade)").fetchall()]
    out = []
    for row in db.execute("SELECT * FROM ProspectivePaperTrade WHERE state != 'closed' LIMIT 200").fetchall():
        d = dict(zip(cols, row))
        out.append({"id": d["id"], "symbol": d["symbol"], "state": d["state"], "model": d["modelId"],
                     "strategy": d["strategyId"], "horizon_sessions": d["horizon"],
                     "sl": d["sl"], "tp1": d["tp1"], "tp2": d["tp2"], "tp3": d["tp3"],
                     "label": "legacy_task76_signal_never_entered"})
    db.close()
    return {"n": len(out), "note": "Task 76-era prospective paper trades with state=pending_entry (signals that never entered). Shown separately; NOT merged into the active forward campaign.", "rows": out[:50]}


if __name__ == "__main__":
    sys.exit(main())
