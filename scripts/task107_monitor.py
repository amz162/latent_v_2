#!/usr/bin/env python3
"""Task 107 v2 / Task 108 — delayed-snapshot monitor engine.

Mode: `delayed_observation_shadow` with SNAPSHOT semantics (the provider has no
candles endpoint — verified in task107_delay_verification.json). Never
manufactures OHLC around a snapshot; every snapshot keeps
  market_timestamp  = estimated_source_timestamp (retrieved_at - 15 min, labeled estimated)
  retrieved_at      = actual retrieval time (tz-aware)
Idempotent: UNIQUE(symbol, estimated_source_ts, price, provider); repeat cycles
detect no new observations. Separate SQLite store: snapshots are kept apart
from the daily OhlcvBar dataset.

Task 108 additions (Phases 2/4/6/7):
  - structured exit semantics: 0 success_with_updates | success_no_change,
    2 degraded_provider, 3 failed_configuration, 4 failed_internal_error,
    5 failed_data_integrity — workflow failures are never masked as success.
  - snapshot sanity validation with quarantine (rejected observations are never
    inserted into the store; the run fails visibly).
  - per-cycle and per-symbol latency recorded in the snapshot store.
  - ops/last_cycle_result.json consumed by the Actions step summary and the
    monitoring worker heartbeat.
  - report tree redirectable via TASK108_T107_DIR / TASK108_SNAP_DB so error
    injection tests never touch real artifacts.
"""
from __future__ import annotations
import csv, json, os, sqlite3, subprocess, sys, time, traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T107 = LB_T107 = Path(os.environ.get("TASK108_T107_DIR") or ROOT / "data/backtest_reports/task107")
OPS = T107 / "ops"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # type: ignore  # noqa: E402
import task107_lib as LB  # type: ignore  # noqa: E402

PKT = LB.PKT
SNAP_DB = Path(os.environ.get("TASK108_SNAP_DB") or ROOT / "data/external_imports/psx_eod/task107_snapshots.db")
PROVIDER_DELAY_MIN = 15          # user-observed, verified structurally (no source ts on quotes)
POLL_INTERVAL_SECONDS = 120      # configurable; default inside 1-2 min recommendation
FEED_WINDOW = ("09:45", "15:45") # delayed-observation availability window (PKT)
SNAPSHOT_SOURCE_TTL_MIN = 30     # during-window staleness threshold
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]

# ── Task 108 Phase 4: structured run classification → exit codes ─────────────
EXIT_OK = 0                       # success_with_updates / success_no_change
EXIT_DEGRADED = 2                 # degraded_provider (visible, retryable — run stays green, summary carries the banner)
EXIT_CONFIG = 3                   # failed_configuration
EXIT_INTERNAL = 4                 # failed_internal_error
EXIT_INTEGRITY = 5                # failed_data_integrity
CLASS_UPDATES = "success_with_updates"
CLASS_NOCHANGE = "success_no_change"
CLASS_DEGRADED = "degraded_provider"
CLASS_CONFIG = "failed_configuration"
CLASS_INTERNAL = "failed_internal_error"
CLASS_INTEGRITY = "failed_data_integrity"


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
    conn = sqlite3.connect(SNAP_DB, timeout=30)
    # Task 108 Phase 6: WAL + busy timeout so host-worker writes and website
    # reads never block each other; integrity is checked by the daily pipeline.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("""CREATE TABLE IF NOT EXISTS snapshots (
        symbol TEXT NOT NULL, estimated_source_ts TEXT NOT NULL, price REAL NOT NULL,
        retrieved_at TEXT NOT NULL, provider TEXT NOT NULL, market_date TEXT,
        provider_delay_minutes INTEGER, timestamp_quality TEXT, data_interval TEXT,
        UNIQUE(symbol, estimated_source_ts, price, provider))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS poll_log (
        cycle_id TEXT PRIMARY KEY, started_at TEXT, ended_at TEXT, window_status TEXT,
        symbols_polled INTEGER, snapshots_new INTEGER, snapshots_total INTEGER,
        provider_errors INTEGER, notes TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS cycle_latency (
        cycle_id TEXT PRIMARY KEY, started_at TEXT, ended_at TEXT,
        duration_seconds REAL, interval_since_prev_seconds REAL,
        avg_symbol_latency_ms REAL, max_symbol_latency_ms REAL, window_status TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS symbol_gaps (
        symbol TEXT PRIMARY KEY, status INTEGER, first_seen TEXT, last_seen TEXT,
        consecutive_cycles INTEGER)""")
    return conn


def _daily_closes(db, frontier: str) -> dict:
    return {s: r[0] for s, r in ((s, db.execute(
        "SELECT close FROM OhlcvBar WHERE symbol=? AND date=?", (s, frontier)).fetchone())
        for s in LB.PILOT25) if r}


def _validate_snapshot(price: float, sym: str, closes: dict) -> str | None:
    """Task 108 Phase 4: quarantine a snapshot that cannot be a plausible PSX
    quote. Returns a rejection reason or None. Price tolerance: far outside a
    10x/0.1x band of the latest daily close means provider data corruption."""
    if not isinstance(price, (int, float)) or price != price:  # NaN
        return "non_numeric_or_nan_price"
    if price <= 0:
        return "non_positive_price"
    close = closes.get(sym)
    if close and (price > close * 10 + 1e-9 or price < close * 0.1 - 1e-9):
        return f"price_far_from_daily_close ({price} vs close {close})"
    return None


def _quarantine(rows: list[dict]) -> None:
    OPS.mkdir(parents=True, exist_ok=True)
    p = OPS / "rejected_observations.json"
    prior = json.loads(p.read_text()) if p.exists() else []
    p.write_text(json.dumps((prior + rows)[-500:], indent=1))


def _config_check() -> str | None:
    for f in ("_matured.json", "_pending_ledger.json"):
        if not (T107 / f).exists():
            return f"missing required Task 107 state file: {f}"
    return None


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


def run_cycle() -> tuple[str, dict]:
    """One monitor cycle: fetch delayed snapshots, process immediately, persist.
    Returns (classification, info). Never raises for provider/data issues —
    those map to degraded/integrity classes; unexpected exceptions propagate
    and are turned into failed_internal_error by main()."""
    t0 = time.time()
    with LB.Lock("task107_monitor"):
        started = L.NOW()
        now = datetime.now(PKT)
        window = feed_window_status(now)
        missing = _config_check()
        conn = ensure_snap_db()
        prev = conn.execute("SELECT started_at FROM poll_log ORDER BY started_at DESC LIMIT 1").fetchone()
        interval_prev = ((now - datetime.fromisoformat(prev[0])).total_seconds()) if prev else None
        errors: list[dict] = []
        rejected: list[dict] = []
        if missing:
            result = {"classification": CLASS_CONFIG, "cycle_id": None, "error": missing,
                      "started_at": started}
            _write_cycle_result(result)
            return CLASS_CONFIG, result

        # ── poll cycle: fetch snapshots (processed immediately on arrival) ───
        frontier = LB.frontier_date()
        db_ro = LB.db_connect()
        closes = _daily_closes(db_ro, frontier)
        new_snaps, total_before = 0, conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
        latest = {}
        sym_lat = []
        for i, sym in enumerate(LB.PILOT25):
            if i:
                time.sleep(0.12)  # rate-limit courtesy (respects provider access frequency)
            c, dtl, d, e = LB.fetch_json(f"{LB.BASE}/stocks/{sym}/quote", timeout=10)
            sym_lat.append(dtl * 1000)
            if c != 200 or not (d or {}).get("data") or d["data"].get("price") is None:
                errors.append({"symbol": sym, "status": c, "error": e})
                g = conn.execute("SELECT consecutive_cycles FROM symbol_gaps WHERE symbol=?", (sym,)).fetchone()
                conn.execute("INSERT OR REPLACE INTO symbol_gaps VALUES (?,?,?,?,?)",
                             (sym, c, L.NOW(), L.NOW(), (g[0] + 1) if g else 1))
                continue
            price = d["data"]["price"]
            reason = _validate_snapshot(price, sym, closes)
            if reason:
                rejected.append({"symbol": sym, "price": price, "reason": reason,
                                 "retrieved_at": (d.get("meta", {}).get("timestamp") or L.NOW()),
                                 "cycle": started})
                continue
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
            conn.execute("DELETE FROM symbol_gaps WHERE symbol=?", (sym,))
            new_snaps += 1
            latest[sym] = {"price": price, "retrieved_at": ret_dt.isoformat(),
                            "estimated_source_ts": est, "cached": d.get("meta", {}).get("cached"),
                            "changed": True}
        db_ro.close()
        if rejected:
            _quarantine(rejected)
        total_after = conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]

        # ── positions ────────────────────────────────────────────────────────
        rows = load_open_positions()
        db = LB.db_connect()
        daily_same_bar_ambiguity(db, rows)
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
            eod = _eod_reconciliation(frontier, latest, len(rows), rows)

        # ── classification (Task 108 Phase 4) ────────────────────────────────
        # Structural gaps: symbols the provider has 404'd for >=3 consecutive
        # cycles (e.g. delisted HASCOL) are reported but are not outages.
        structural = {s for (s,) in conn.execute(
            "SELECT symbol FROM symbol_gaps WHERE consecutive_cycles>=3").fetchall()}
        transient = [e for e in errors if e.get("symbol") not in structural]
        if rejected:
            classification = CLASS_INTEGRITY
        elif transient:
            classification = CLASS_DEGRADED
        elif new_snaps > 0:
            classification = CLASS_UPDATES
        else:
            classification = CLASS_NOCHANGE

        # ── poll log + latency + state for the API ───────────────────────────
        ended = L.NOW()
        duration = round(time.time() - t0, 2)
        conn.execute("INSERT OR REPLACE INTO poll_log VALUES (?,?,?,?,?,?,?,?,?)",
                      (cycle_id, started, ended, window, len(LB.PILOT25) - len([e for e in errors if "symbol" in e]), new_snaps,
                       total_after, len(errors), json.dumps(errors)[:200]))
        conn.execute("INSERT OR REPLACE INTO cycle_latency VALUES (?,?,?,?,?,?,?,?)",
                      (cycle_id, started, ended, duration, interval_prev,
                       round(sum(sym_lat) / max(1, len(sym_lat)), 1) if sym_lat else None,
                       round(max(sym_lat), 1) if sym_lat else None, window))
        conn.commit()
        hist = conn.execute("SELECT cycle_id, started_at, window_status, symbols_polled, snapshots_new, snapshots_total, provider_errors FROM poll_log ORDER BY started_at DESC LIMIT 50").fetchall()
        conn.close()
        legacy = _legacy_rows()
        state = {
            "generated_at": L.NOW(), "cycle_id": cycle_id,
            "run_classification": classification,
            "feed": {"provider": LB.BASE, "mode": "delayed_observation_shadow",
                      "data_type": "delayed_snapshot_only (no candle endpoint — verified)",
                      "provider_delay_minutes": PROVIDER_DELAY_MIN, "bar_interval_minutes": None,
                      "poll_interval_seconds": POLL_INTERVAL_SECONDS, "window": FEED_WINDOW,
                      "window_status": window, "staleness_threshold_minutes": SNAPSHOT_SOURCE_TTL_MIN},
            "snapshot_store": {"path": str(SNAP_DB.relative_to(ROOT)) if str(SNAP_DB).startswith(str(ROOT)) else str(SNAP_DB),
                                "total": total_after, "new_this_cycle": new_snaps},
            "rejected_observations": rejected,
            "provider_errors": errors,
            "structural_provider_gaps": sorted(structural),
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
            "run_classification": classification,
            "snapshots": {"new": new_snaps, "total": total_after},
            "summary": state["summary"], "provider_errors": errors,
            "processing": "each newly received snapshot is processed immediately on arrival (no extra 15-minute wait); duplicates suppressed by the unique key",
            "verdict": "completed"}, indent=1))
        LB.append_run_log("monitor", {"cycle": cycle_id, "window": window, "new": new_snaps,
                                        "total": total_after, "positions": len(rows), "errors": len(errors),
                                        "classification": classification})
        info = {"cycle_id": cycle_id, "classification": classification, "window": window,
                 "new": new_snaps, "total": total_after, "positions": len(rows),
                 "status_counts": state["summary"]["by_status"], "errors": errors,
                 "structural_symbols": sorted(structural),
                 "rejected": rejected, "duration_s": duration, "interval_prev_s": interval_prev,
                 "eod": eod, "started_at": started, "ended_at": ended}
        _write_cycle_result(info)
        print(json.dumps(info, default=str))
        return classification, info


def _eod_reconciliation(frontier: str, latest: dict, n_rows: int, rows: list[dict]) -> dict:
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
        "open_overnight": n_rows,
        "positions": [{"trade_key": r["trade_key"], "symbol": r["symbol"], "status": r["status"],
                        "latest_price": r.get("latest_price"), "sessions_to_21": r["sessions_to_21"]} for r in rows],
        "resume_rule": "next verified session resumes monitoring; no duplicate trade creation for existing positions",
        "verdict": "completed"}, indent=1))
    return eod


def _write_cycle_result(info: dict) -> None:
    OPS.mkdir(parents=True, exist_ok=True)
    (OPS / "last_cycle_result.json").write_text(json.dumps(info, indent=1, default=str))


def main() -> int:
    try:
        classification, info = run_cycle()
    except SystemExit:
        # LB.Lock refused a duplicate run — visible failure, never silent success
        info = {"classification": CLASS_INTERNAL, "error": "lock_held_by_other_cycle"}
        _write_cycle_result(info)
        return EXIT_INTERNAL
    except Exception:
        info = {"classification": CLASS_INTERNAL, "error": traceback.format_exc()[-400:]}
        _write_cycle_result(info)
        return EXIT_INTERNAL
    return {CLASS_UPDATES: EXIT_OK, CLASS_NOCHANGE: EXIT_OK,
            CLASS_DEGRADED: EXIT_DEGRADED, CLASS_CONFIG: EXIT_CONFIG,
            CLASS_INTERNAL: EXIT_INTERNAL, CLASS_INTEGRITY: EXIT_INTEGRITY}[classification]


def _summarize(rows: list[dict]) -> dict:
    by = {}
    for r in rows:
        by[r["status"]] = by.get(r["status"], 0) + 1
    unreal = round(sum(r.get("estimated_unrealized_net_pnl") or 0 for r in rows), 2)
    return {"n_active": len(rows), "by_status": by, "by_symbol_count": len({r["symbol"] for r in rows}),
             "estimated_unrealized_net_pnl_total_pkr": unreal,
             "separate_from_realized": "realized P&L lives in the maturity ledger; MTM here is never counted as realized"}


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
