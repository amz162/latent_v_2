#!/usr/bin/env python3
"""Task 107 — shared library: PSX session awareness, lockfiles, checkpoints,
provider access, validation, revision quarantine, coverage reporting."""
from __future__ import annotations
import csv, hashlib, json, os, sqlite3, subprocess, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
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
    return {"now_pkt": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
             "is_weekend": weekend,
             "regular_session_ended_today": (not weekend) and after_close,
             "candidate_session_date": today if (not weekend and after_close) else
             (now - timedelta(days=(wd + 1) % 7 if wd < 5 else (wd - 4))).strftime("%Y-%m-%d"),
             "note": "weekends treated as non-sessions; holidays undetectable without an official calendar — provider data decides"}


def fetch_json(url: str, timeout: int = 25) -> tuple[int, float, dict | None, str]:
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
        return r.status, time.time() - t0, json.loads(body), ""
    except urllib.error.HTTPError as e:
        return e.code, time.time() - t0, None, f"HTTP {e.code}"
    except Exception as e:
        return 0, time.time() - t0, None, str(e)[:120]


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
