#!/usr/bin/env python3
"""Task 102 — shared library. Reuses Task 100/101 machinery; adds task102
artifact conventions, data-status enums, KSE-100 status, PIT availability
rules (conservative 17:00 PKT when only a publication DATE is known)."""
from __future__ import annotations
import json, os, sys, time, sqlite3
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task101_lib as T101  # noqa: E402
import task100_lib as T0  # noqa: E402

BASE = ROOT / "data/backtest_reports/task102"
BATCH_LOGS = BASE / "batch_logs"
CHECKPOINTS = BASE / "checkpoints"
LABELS_DIR = BASE / "trade_outcome_labels"
FEATURES_DIR = BASE / "features"
RAW_DIR = BASE / "raw_external_data"
for d in (BASE, BATCH_LOGS, CHECKPOINTS, LABELS_DIR, FEATURES_DIR, RAW_DIR):
    d.mkdir(parents=True, exist_ok=True)

PROGRESS_FILE = BASE / "task102_progress.json"
MANIFEST = BASE / "task102_execution_manifest.json"

# data status vocabulary (spec Phase 1)
VERIFIED = "verified"
PARTIALLY_VERIFIED = "partially_verified"
MISSING = "missing"
INVALID = "invalid"
STALE = "stale"
PROVIDER_UNAVAILABLE = "provider_unavailable"
BLOCKED_EXTERNAL_DATA = "blocked_external_data"

KSE100_PROVIDERS_ATTEMPTED = [
    {"provider": "yahoo_finance_chart_v8", "symbol": "^KSE100",
     "endpoint": "https://query1.finance.yahoo.com/v8/finance/chart/%5EKSE100",
     "result": "HTTP 404 - 'symbol may be delisted' (Yahoo does not carry KSE-100)"},
    {"provider": "stooq_csv", "symbol": "kse100",
     "endpoint": "https://stooq.com/q/d/l/?s=kse100&i=d",
     "result": "connection failed (HTTP 000, unreachable from sandbox)"},
    {"provider": "wsj_download", "symbol": "XX/XKAR/IDXKSE100",
     "endpoint": "https://www.wsj.com/market-data/quotes/XX/XKAR/IDXKSE100/historical-prices/download",
     "result": "HTTP 401 - DataDome captcha (bot protection)"},
    {"provider": "psx_data_portal", "symbol": "KSE100",
     "endpoint": "https://dps.psx.com.pk/api/historic",
     "result": "connection failed (HTTP 000, unreachable from sandbox)"},
    {"provider": "investing_api", "symbol": "3440",
     "endpoint": "https://api.investing.com/api/financialdata/historical/3440",
     "result": "HTTP 403 forbidden"},
    {"provider": "tradingeconomics", "symbol": "markets/index",
     "endpoint": "https://api.tradingeconomics.com/markets/index?c=guest:guest",
     "result": "HTTP 410 gone (guest tier does not expose KSE-100)"},
]
KSE100_STATUS = BLOCKED_EXTERNAL_DATA

# PIT availability rule (spec Phase 3 rule 4): if only a publication DATE is
# known, the record becomes available conservatively AFTER market close on
# that date (17:00 PKT), i.e. usable for decisions from the NEXT session.
PIT_CONSERVATIVE_HOUR_PK = 17
PKT_TZ = "Asia/Karachi"

FEATURE_GROUPS = {
    "technical_only_v1": {"sources": ["ohlcv_technical"], "enabled": True},
    "technical_market_regime_v1": {"sources": ["ohlcv_technical", "market_regime_internal_proxy"],
                                    "enabled": True,
                                    "note": "regime features from pilot25 equal-weight breadth "
                                            "(internal proxy) - genuine KSE-100 blocked"},
    "technical_pit_fundamental_v1": {"sources": ["pit_fundamentals"], "enabled": False,
                                      "note": "DISABLED: no verified publication timestamps link "
                                               "statements/ratios to decision times; filings carry "
                                               "genuine PSX announcement dates for 24 symbols but "
                                               "statement-level linkage is not verifiable"},
    "technical_liquidity_v1": {"sources": ["ohlcv_technical", "ohlcv_liquidity"], "enabled": True},
    "technical_corporate_action_safe_v1": {"sources": ["ohlcv_technical", "corporate_action_flags"],
                                            "enabled": True,
                                            "note": "raw-price CA-suspicion flags only; no adjusted "
                                                     "ex-post series used in decision features"},
    "combined_verified_v1": {"sources": ["ohlcv_technical", "ohlcv_liquidity",
                                          "corporate_action_flags", "market_regime_internal_proxy"],
                              "enabled": True,
                              "note": "only verified sources; PIT fundamentals excluded "
                                       "(unavailable), genuine KSE-100 excluded (blocked)"},
}


def _jd(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, float) and np.isnan(o):
        return None
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (pd.Timestamp,)):
        return o.isoformat()
    return str(o)


def write_artifact(name: str, obj) -> Path:
    p = BASE / name
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, default=_jd))
    tmp.replace(p)
    return p


def update_progress(phase: str, status: str, detail: str = "", artifact: str | None = None):
    prog = {}
    if PROGRESS_FILE.exists():
        try:
            prog = json.loads(PROGRESS_FILE.read_text())
        except Exception:
            prog = {}
    prog.setdefault("phases", {})
    prog["phases"][phase] = {"status": status, "detail": str(detail)[:400], "artifact": artifact,
                              "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime())}
    prog["last_phase"] = phase
    tmp = PROGRESS_FILE.with_name("tmp.json")
    tmp.write_text(json.dumps(prog, indent=2, default=_jd))
    tmp.replace(PROGRESS_FILE)


def db_conn() -> sqlite3.Connection:
    return sqlite3.connect(str(ROOT / "db/custom.db"))


def load_filings() -> dict:
    f = ROOT / "data/backtest_reports/task90/raw_external_data/askanalyst_filings.json"
    return json.loads(f.read_text())


def load_income_statements() -> dict:
    f = ROOT / "data/backtest_reports/task90/raw_external_data/askanalyst_income_statements.json"
    return json.loads(f.read_text())


def load_ratios() -> dict:
    f = ROOT / "data/backtest_reports/task90/raw_external_data/askanalyst_ratios.json"
    return json.loads(f.read_text())


def conservative_publication_ts(date_str: str) -> str:
    """Publication DATE (day granularity, genuine PSX announcement date) ->
    conservative availability datetime 17:00 PKT same date."""
    d = pd.Timestamp(date_str).tz_localize(PKT_TZ).normalize() + pd.Timedelta(hours=PIT_CONSERVATIVE_HOUR_PK)
    return d.isoformat()


def next_session_after(ts, dates_ms: np.ndarray):
    """First trading session STRICTLY AFTER the availability timestamp ts."""
    t = pd.Timestamp(ts).value // 10**6
    later = dates_ms[dates_ms > t]
    return int(later[0]) if len(later) else None
