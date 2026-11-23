#!/usr/bin/env python3
"""task127_alerts.py — alert engine for the Task 127 forward monitor.

Pure functions: evaluate(alerts, state, now) -> (fired, recoveries, new_state)
with deduplication (no re-fire within DEDUP_HOURS unless severity escalates)
and recovery notifications. Unit-tested by scripts/task127_tests.py.
"""
import datetime

SEV_ORDER = {"INFO": 0, "WARN": 1, "CRIT": 2}
DEDUP_HOURS = 12


def isoparse(s):
    try:
        return datetime.datetime.fromisoformat(str(s).replace("+0000", "+00:00").replace("Z", "+00:00"))
    except Exception:
        return None


def hours_since(s, now):
    t = isoparse(s)
    return (now - t).total_seconds() / 3600 if t else None


def evaluate(alerts, state, now, now_iso=None):
    """alerts: [{id, severity, component, affected, reason, action, active}].
    state: persisted dedup state {id: {last_fired, last_severity, fire_count,
    suppressed_since_last, recovered}}. Returns (fired, recoveries, new_state)."""
    now_iso = now_iso or now.strftime("%Y-%m-%dT%H:%M:%SZ")
    fired, recoveries = [], []
    new_state = {}
    for a in alerts:
        st = state.get(a["id"], {})
        prev_sev = st.get("last_severity")
        last_fired = st.get("last_fired")
        age = hours_since(last_fired, now) if last_fired else None
        escalated = bool(a.get("active")) and prev_sev is not None and \
            SEV_ORDER[a["severity"]] > SEV_ORDER[prev_sev]
        should_fire = bool(a.get("active")) and (
            prev_sev is None or escalated or age is None or age >= DEDUP_HOURS)
        if a.get("active"):
            fired.append(dict(a, timestamp=now_iso,
                              suppressed=bool(st) and not should_fire and not escalated))
            new_state[a["id"]] = {
                "last_fired": now_iso if should_fire else last_fired,
                "last_severity": a["severity"],
                "fire_count": st.get("fire_count", 0) + (1 if should_fire else 0),
                "suppressed_since_last": st.get("suppressed_since_last", 0) + (0 if should_fire else 1),
            }
        elif a["id"] in state and not st.get("recovered"):
            recoveries.append({"id": a["id"], "component": a["component"], "timestamp": now_iso,
                               "event": "recovered", "previously_fired": st.get("fire_count", 0)})
            new_state[a["id"]] = dict(st, recovered=True)
        elif a["id"] in state:
            new_state[a["id"]] = st
    return fired, recoveries, new_state


def log_events(path, fired, recoveries):
    """Append-only alert/recovery journal (the project's existing notification
    surface: ops JSONL + committed health JSON; no external paid services)."""
    import json as _json
    with open(path, "a") as f:
        for r in fired:
            if not r.get("suppressed"):
                f.write(_json.dumps({"kind": "alert", **{k: r[k] for k in
                          ("id", "severity", "component", "affected", "reason", "action", "timestamp")}}) + "\n")
        for r in recoveries:
            f.write(_json.dumps(r) + "\n")
