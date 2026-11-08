#!/usr/bin/env python3
"""Task 107 — shared library: PSX session awareness, lockfiles, checkpoints,
provider access, validation, revision quarantine, coverage reporting."""
from __future__ import annotations
import csv, hashlib, json, os, random, sqlite3, subprocess, sys, threading, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Task 108: tests can redirect the whole task107 report tree via env so error
# injection never touches real artifacts.
_T107_ENV = os.environ.get("TASK108_T107_DIR")
T107 = Path(_T107_ENV) if _T107_ENV else ROOT / "data/backtest_reports/task107"
OPS = T107 / "ops"
T103 = ROOT / "data/backtest_reports/task103"
BASE = "https://psxdata-api.fastapicloud.dev"
UA = "latent-v2/1.0 (+https://github.com/amz162/latent_v_2)"
PILOT25 = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL",
           "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL",
           "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
NOW = lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# PSX regular session: 09:30-15:30 PKT (Mon-Fri; holidays unknown without an
# official calendar source — session presence is decided by PROVIDER DATA ONLY,
# never by weekday arithmetic).
PKT = timezone(timedelta(hours=5))


def psx_session_state(now: datetime | None = None) -> dict:
    now = now or datetime.now(PKT)
    wd = now.weekday()  # 5=Sat, 6=Sun
    closed = now.time().replace(microsecond=0)
    weekend = wd >= 5
    after_close = closed >= datetime.strptime("15:30", "%H:%M").time()
    today = now.strftime("%Y-%m-%d")
    # Last closed candidate session strictly before today:
    #   Mon(before close) -> Fri (-3d); Tue-Fri(before close) -> previous weekday (-1d);
    #   Sat/Sun -> Fri ((wd-4)d). The old (wd+1)%7 formula returned the most recent
    #   SUNDAY for mid-week mornings (e.g. Thu 03:00 PKT -> Sun), hiding the last
    #   fully closed session from the ingest window. Defect found by Task 114 Part B.
    back = 3 if wd == 0 else (1 if wd < 5 else (wd - 4))
    return {"now_pkt": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
             "is_weekend": weekend,
             "regular_session_ended_today": (not weekend) and after_close,
             "candidate_session_date": today if (not weekend and after_close) else
             (now - timedelta(days=back)).strftime("%Y-%m-%d"),
             "note": "weekends treated as non-sessions; holidays undetectable without an official calendar — provider data decides"}


def fetch_json(url: str, timeout: int = 25) -> tuple[int, float, dict | None, str]:
    """Task 119 Part 2 — resilient provider fetch.

    Wraps the historical single-shot call with:
      - bounded exponential backoff with jitter (base 1.5s, factor 2, +-30%),
      - Retry-After honored on 429/503 (seconds or HTTP-date form),
      - max attempts (default 4) and a total request deadline (default 60s),
      - single-flight dedup per URL within this process (no concurrent
        duplicate requests; cross-process single-flight remains the durable
        task107 Lock, not Redis),
      - persistent provider-health transitions in
        ops/provider_health_state.json (healthy / degraded / rate_limited /
        unavailable with last-success timestamps),
      - NO frontier implication: every failure returns gracefully like the
        old signature, so callers record provider_unavailable and never
        fabricate bars.

    Retryable: 429 and 5xx and network errors. 4xx like 404/400 fail fast
    (permanent). Retry delays are env-tunable for deterministic tests.
    """
    max_attempts = int(os.environ.get("PROVIDER_RETRY_MAX_ATTEMPTS", "4"))
    deadline_s = float(os.environ.get("PROVIDER_RETRY_DEADLINE_S", "60"))
    base_s = float(os.environ.get("PROVIDER_RETRY_BASE_S", "1.5"))
    retryable_codes = {429, 500, 502, 503, 504}
    deadline = time.time() + deadline_s

    # single-flight: join an identical in-flight request instead of duplicating it
    with _INFLIGHT_GUARD:
        entry = _INFLIGHT.get(url)
        if entry is None:
            entry = {"event": threading.Event(), "result": None}
            _INFLIGHT[url] = entry
            owner = True
        else:
            owner = False
    if not owner:
        entry["event"].wait(timeout=max(1.0, deadline_s))
        res = entry["result"]
        if res is not None:
            return res
        return 0, 0.0, None, "single-flight wait expired"

    attempt, last = 0, (0, 0.0, None, "not attempted")
    try:
        while attempt < max_attempts and time.time() < deadline:
            attempt += 1
            t0 = time.time()
            code, payload, err, retry_after = 0, None, "", None
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    body = r.read()
                code, payload = r.status, json.loads(body)
            except urllib.error.HTTPError as e:
                code, err = e.code, f"HTTP {e.code}"
                ra = (e.headers or {}).get("Retry-After") if e.headers else None
                if ra:
                    try:
                        retry_after = float(ra)
                    except ValueError:
                        try:
                            delta = parsedate_to_datetime(ra) - datetime.now(timezone.utc)
                            retry_after = max(0.0, delta.total_seconds())
                        except Exception:
                            retry_after = None
            except Exception as e:
                err = str(e)[:120]

            latency = time.time() - t0
            last = (code, latency, payload, err)
            _record_provider_outcome(code, err, retry_after)
            if code == 200:
                return last
            retryable = code in retryable_codes or code == 0
            if not retryable or attempt >= max_attempts:
                return last
            remaining = deadline - time.time()
            if remaining <= 0:
                return last
            if retry_after is not None:
                delay = min(retry_after, remaining)
            else:
                delay = min(base_s * (2 ** (attempt - 1)) * random.uniform(0.7, 1.3), remaining)
            time.sleep(max(0.0, delay))
        return last
    finally:
        # publish result to joiners, then drop the single-flight entry
        entry["result"] = last
        entry["event"].set()
        with _INFLIGHT_GUARD:
            if _INFLIGHT.get(url) is entry:
                del _INFLIGHT[url]


_INFLIGHT: dict[str, dict] = {}
_INFLIGHT_GUARD = threading.Lock()


def provider_health_state() -> dict:
    """Current persisted provider health (Task 119 monitoring surface)."""
    try:
        return json.loads(PROVIDER_STATE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"state": "unknown", "consecutive_failures": 0,
                "note": "no provider request recorded yet"}


def _record_provider_outcome(code: int, err: str, retry_after: float | None) -> None:
    """Persist provider health transitions; never raises."""
    try:
        OPS.mkdir(parents=True, exist_ok=True)
        try:
            st = json.loads(PROVIDER_STATE_FILE.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            st = {"state": "unknown", "consecutive_failures": 0, "transitions": []}
        prev = st.get("state", "unknown")
        if code == 200:
            st["consecutive_failures"] = 0
            st["last_success_at"] = NOW()
            st["last_error"] = ""
        else:
            st["consecutive_failures"] = int(st.get("consecutive_failures", 0)) + 1
            st["last_failure_at"] = NOW()
            st["last_error"] = (err or "")[:200]
        st["last_http_code"] = code
        if retry_after is not None:
            st["last_retry_after_s"] = retry_after
        fails = st["consecutive_failures"]
        if code == 200:
            st["state"] = "healthy"
        elif code == 429:
            st["state"] = "rate_limited"
        elif fails >= 3:
            st["state"] = "unavailable"
        else:
            st["state"] = "degraded"
        if st["state"] != prev:
            st.setdefault("transitions", []).append(
                {"at": NOW(), "from": prev, "to": st["state"], "code": code})
            st["transitions"] = st["transitions"][-50:]
        tmp = PROVIDER_STATE_FILE.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(st, indent=1))
        tmp.replace(PROVIDER_STATE_FILE)
    except Exception:
        pass  # health bookkeeping must never break a data call


PROVIDER_STATE_FILE = OPS / "provider_health_state.json"


def fetch_history(symbol: str, start: str, end: str):
    code, dt, data, err = fetch_json(f"{BASE}/stocks/{symbol}/historical?start={start}&end={end}")
    return code, dt, (data or {}).get("data") or [], err


def db_connect(readonly: bool = True):
    p = str(ROOT / "db/custom.db")
    uri = f"file:{p}?mode=ro" if readonly else f"file:{p}"
    return sqlite3.connect(uri, uri=True)


def frontier_date() -> str:
    db = db_connect()
    try:
        return db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    finally:
        db.close()


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


class Lock:
    def __init__(self, name: str):
        self.path = OPS / f"{name}.lock"
        self.acquired = False

    def __enter__(self):
        OPS.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            try:
                info = json.loads(self.path.read_text())
                age = time.time() - info.get("ts", 0)
                if age < 3600:
                    print(f"LOCK held by pid {info.get('pid')} ({int(age)}s) — refusing duplicate run")
                    raise SystemExit(3)
            except json.JSONDecodeError:
                pass
        self.path.write_text(json.dumps({"pid": os.getpid(), "ts": time.time(), "started": NOW()}))
        self.acquired = True
        return self

    def __exit__(self, *a):
        if self.acquired and self.path.exists():
            self.path.unlink()
        return False


def checkpoints() -> dict:
    p = OPS / "checkpoints.json"
    return json.loads(p.read_text()) if p.exists() else {"runs": []}


def save_checkpoint(entry: dict) -> None:
    OPS.mkdir(parents=True, exist_ok=True)
    p = OPS / "checkpoints.json"
    c = checkpoints()
    c["runs"].append(entry)
    c["runs"] = c["runs"][-120:]
    c["last_run"] = entry["started_at"]
    if entry.get("status") == "success":
        c["last_successful_run"] = entry["started_at"]
        c["last_frontier"] = entry.get("frontier_after", c.get("last_frontier"))
    p.write_text(json.dumps(c, indent=1))


def append_run_log(kind: str, payload: dict) -> None:
    OPS.mkdir(parents=True, exist_ok=True)
    with open(OPS / "run_log.jsonl", "a") as fh:
        fh.write(json.dumps({"ts": NOW(), "kind": kind, **payload}) + "\n")


def validate_bar(b: dict) -> list[str]:
    """OHLC envelope, positivity, volume sanity. Returns list of problems."""
    problems = []
    try:
        o, h, l, c, v = (float(b[k]) for k in ("open", "high", "low", "close", "volume"))
    except (KeyError, TypeError, ValueError):
        return ["missing_or_non_numeric_field"]
    if min(o, h, l, c) < 0:
        problems.append("negative_price")
    if h < l:
        problems.append("high_below_low")
    if h < max(o, c) - 1e-9 or l > min(o, c) + 1e-9:
        problems.append("ohlc_envelope")
    if v < 0:
        problems.append("negative_volume")
    if v == 0:
        problems.append("zero_volume")
    return problems


def run_importer(drop_csv: Path) -> dict:
    r = subprocess.run([sys.executable, "scripts/task103_import_data.py", "--type", "psx_eod",
                         "--file", str(drop_csv), "--mode", "import",
                         "--provider", "psxdata-api.fastapicloud.dev", "--source", "task107_daily"],
                        capture_output=True, text=True, cwd=ROOT, timeout=140)
    tail = (r.stdout or r.stderr).strip().splitlines()[-1:]
    return {"rc": r.returncode, "sha256": sha256_file(drop_csv), "tail": tail}
