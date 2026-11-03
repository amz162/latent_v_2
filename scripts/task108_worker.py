#!/usr/bin/env python3
"""Task 108 Phase 2/3 — always-on delayed-snapshot monitoring worker.

The production design: PSX provider → this persistent worker → durable snapshot
store (SQLite, WAL) → Next.js monitor API → Paper Trade Monitor UI. Worker and
website read/write the SAME local durable state; nothing here commits to Git.

Key properties:
  - polls every TASK108_POLL_INTERVAL_SECONDS (default 120) during the verified
    delayed-feed window (09:45-15:45 PKT); processes each new observation
    immediately — no extra 15-minute wait on top of the provider delay;
  - session gating: pre_window sleeps until 09:45, post_window runs the EOD
    reconciliation once then idles at a slow cadence until the next session;
    weekends idle; PSX holidays are data-decided (unchanged quotes -> no-op);
  - duplicate-worker lock (ops/task108_worker.lock with live heartbeat);
  - graceful shutdown on SIGTERM/SIGINT (finishes the current cycle);
  - heartbeat: ops/worker_health.json (also serves as the health check).

Usage:
  python3 scripts/task108_worker.py            # daemon loop
  python3 scripts/task108_worker.py --once     # one gated cycle (tests/Actions)
  python3 scripts/task108_worker.py --status   # print heartbeat, exit
"""
from __future__ import annotations
import json, os, signal, sqlite3, sys, time
from datetime import datetime, timedelta
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402
import task107_monitor as M  # noqa: E402

PKT = LB.PKT
OPS = LB.OPS
INTERVAL = int(os.environ.get("TASK108_POLL_INTERVAL_SECONDS", "120"))
IDLE_INTERVAL = int(os.environ.get("TASK108_IDLE_INTERVAL_SECONDS", "600"))
WORKER_LOCK = OPS / "task108_worker.lock"
HEARTBEAT = OPS / "worker_health.json"

_shutdown = {"flag": False}


def _on_signal(signum, frame):
    _shutdown["flag"] = True


def _window(now: datetime) -> str:
    return M.feed_window_status(now)


def _seconds_until(hm: str, now: datetime) -> int:
    target = datetime.strptime(hm, "%H:%M").time()
    nxt = now.replace(hour=target.hour, minute=target.minute, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return int((nxt - now).total_seconds())


def _write_heartbeat(pid: int, started: str, cycles: int, last: dict | None, note: str) -> None:
    OPS.mkdir(parents=True, exist_ok=True)
    HEARTBEAT.write_text(json.dumps({
        "pid": pid, "started_at": started, "heartbeat_at": LB.NOW(),
        "poll_interval_seconds": INTERVAL, "idle_interval_seconds": IDLE_INTERVAL,
        "cycles_completed": cycles, "last_cycle": last, "note": note,
        "provider_delay_minutes": M.PROVIDER_DELAY_MIN,
        "timestamp_quality": "estimated_source_timestamp (provider supplies no source ts)"} , indent=1))


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _acquire_worker_lock(pid: int) -> bool:
    """Refuse while the LOCK HOLDER PROCESS IS ALIVE (pid-liveness, not lock
    age): a timestamp alone goes stale after 5 idle minutes and would admit a
    second worker. A lock left by a DEAD pid (SIGKILL/crash) is stolen so the
    monitor self-heals after an ungraceful death."""
    OPS.mkdir(parents=True, exist_ok=True)
    if WORKER_LOCK.exists():
        try:
            info = json.loads(WORKER_LOCK.read_text())
            holder = info.get("pid")
            if holder and holder != pid and _pid_alive(holder):
                print(json.dumps({"error": "duplicate_worker_refused",
                                   "held_by_pid": holder}))
                return False
        except json.JSONDecodeError:
            pass
    WORKER_LOCK.write_text(json.dumps({"pid": pid, "ts": time.time(), "started": LB.NOW()}))
    return True


def run_forever() -> int:
    pid = os.getpid()
    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)
    if not _acquire_worker_lock(pid):
        return 3
    started = LB.NOW()
    cycles, last, skip = 0, None, False
    print(json.dumps({"worker": "task108", "pid": pid, "interval": INTERVAL,
                       "window": M.FEED_WINDOW, "started": started}), flush=True)
    try:
        while not _shutdown["flag"]:
            now = datetime.now(PKT)
            w = _window(now)
            if w == "open":
                skip = False
                cls, last = M.run_cycle()
                cycles += 1
                _write_heartbeat(pid, started, cycles, _safe(last), f"cycle done: {cls}")
                _sleep(INTERVAL)
            elif w == "pre_window":
                note = "pre_window: no delayed observations expected before 09:45 PKT — idling"
                _write_heartbeat(pid, started, cycles, _safe(last), note)
                _sleep(min(IDLE_INTERVAL, _seconds_until(M.FEED_WINDOW[0], now)))
            else:  # post_window / weekend_closed
                if not skip:
                    cls, last = M.run_cycle()   # EOD reconciliation + state refresh
                    cycles += 1
                    skip = True
                _write_heartbeat(pid, started, cycles, _safe(last),
                                  "post_window: EOD reconciliation done — idling until next session")
                _sleep(min(IDLE_INTERVAL, max(60, _seconds_until(M.FEED_WINDOW[0], now))))
    finally:
        try:
            WORKER_LOCK.unlink()
        except FileNotFoundError:
            pass
        _write_heartbeat(pid, started, cycles, _safe(last), "worker stopped (graceful)")
    return 0


def _sleep(seconds: int) -> None:
    end = time.time() + max(1, seconds)
    while time.time() < end and not _shutdown["flag"]:
        time.sleep(min(5, max(1, end - time.time())))


def _safe(d: dict | None) -> dict | None:
    if not d:
        return d
    return {k: d.get(k) for k in ("cycle_id", "classification", "window", "new", "total",
                                   "positions", "status_counts", "errors", "duration_s",
                                   "started_at", "ended_at") if k in d}


def main() -> int:
    if "--status" in sys.argv:
        print(HEARTBEAT.read_text() if HEARTBEAT.exists() else json.dumps({"error": "no heartbeat"}))
        return 0
    if "--once" in sys.argv:
        cls, info = M.run_cycle()
        print(json.dumps({"once": True, **_safe(info)}, default=str))
        return M.EXIT_OK if cls in (M.CLASS_UPDATES, M.CLASS_NOCHANGE) else \
               M.EXIT_DEGRADED if cls == M.CLASS_DEGRADED else \
               M.EXIT_CONFIG if cls == M.CLASS_CONFIG else \
               M.EXIT_INTEGRITY if cls == M.CLASS_INTEGRITY else M.EXIT_INTERNAL
    return run_forever()


if __name__ == "__main__":
    sys.exit(main())
