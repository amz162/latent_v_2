#!/usr/bin/env python3
"""Task 103 — shared library. Portable paths (works wherever the repo is
cloned). Reuses Task 102 conventions: artifact JSON writer with progress
checkpoints, SQLite access to db/custom.db, data-status enums, PIT
availability rules. Does NOT modify Task 100/101/102 artifacts."""
from __future__ import annotations
import hashlib, json, os, sqlite3, sys, time
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent          # repo root (portable)
BASE = ROOT / "data/backtest_reports/task103"
CHECKPOINTS = BASE / "checkpoints"
IMPORTS_DIR = ROOT / "data/external_imports"
MANIFESTS_DIR = BASE / "import_manifests"
STAGING_DB = BASE / "external_imports_staging.db"
PROGRESS_FILE = BASE / "task103_progress.json"
for d in (BASE, CHECKPOINTS, MANIFESTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

T102 = ROOT / "data/backtest_reports/task102"
T101 = ROOT / "data/backtest_reports/task101"
T100 = ROOT / "data/backtest_reports/task100"

NOW = lambda: time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime())

# ── status vocabularies (Task 103 spec Part Q + Phase 1) ────────────────────
VERIFIED, PARTIALLY_VERIFIED, STALE, INVALID, MISSING = (
    "verified", "partially_verified", "stale", "invalid", "missing")
BLOCKED_EXTERNAL_DATA, PROVIDER_UNAVAILABLE = "blocked_external_data", "provider_unavailable"
# Phase 1 provider statuses (explicit, never inferred from a website existing)
P_VERIFIED_ACCESS = "verified_access"          # fetched genuine data in this run
P_PUBLIC_ACCESS = "public_access"              # official page reachable, data downloadable
P_CREDENTIAL_REQUIRED = "credential_required"
P_PAID_ACCESS_REQUIRED = "paid_access_required"
P_NOT_AVAILABLE = "not_available"
P_PROVIDER_UNAVAILABLE = "provider_unavailable"  # unreachable from sandbox (network)
P_LICENSE_RESTRICTED = "license_restricted"
P_NOT_VERIFIED = "not_verified"

REQUIRED_ARTIFACTS = [
    "task103_baseline_inventory.json", "task103_execution_manifest.json",
    "data_source_registry.json", "data_access_matrix.csv",
    "provider_verification_report.json", "task103_import_template_validation.json",
    "task103_market_data_audit.json", "task103_symbol_master_report.json",
    "task103_kse100_coverage.json", "task103_fundamental_coverage.json",
    "task103_filing_timestamp_report.json", "task103_pit_leakage_report.json",
    "task103_corporate_actions_coverage.json", "task103_intraday_coverage.json",
    "task103_data_pipeline_health.json", "task103_feature_store_report.json",
    "task103_feature_lineage.json", "task103_market_regime_report.json",
    "task103_sector_report.json", "task103_trade_label_integrity.json",
    "task103_feature_ablation_report.json", "task103_model_coverage.json",
    "task103_validation_protocol.json", "task103_prediction_metrics.json",
    "task103_trading_metrics.json", "task103_strategy_comparison.json",
    "task103_cost_parity_report.json", "task103_paper_trading_integrity.json",
    "task103_forward_validation_status.json", "task103_model_promotion_decisions.json",
    "task103_api_validation.json", "task103_production_readiness.json",
    "task103_security_audit.json", "task103_test_summary.json",
    "task103_remaining_blockers.json", "task103_final_summary.json",
]

REQUIRED_DOCS = [
    "task103-final-data-readiness.md", "task103-provider-onboarding.md",
    "task103-operational-runbook.md", "task103-forward-validation.md",
    "task103-final-evaluation.md", "investment-simulator-metrics.md",
    "point-in-time-fundamentals.md", "task102-intraday-data-readiness.md",
]

PIT_CONSERVATIVE_HOUR_PK = 17
PKT_TZ = "Asia/Karachi"


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


def load_json(p: Path):
    return json.loads(Path(p).read_text())


def load_t102(name: str):
    p = T102 / name
    if not p.exists():
        p = T101 / name
    return load_json(p)


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def update_progress(phase: str, status: str, detail: str = "", artifact: str | None = None):
    prog = {}
    if PROGRESS_FILE.exists():
        try:
            prog = load_json(PROGRESS_FILE)
        except Exception:
            prog = {}
    prog.setdefault("phases", {})
    prog["phases"][phase] = {"status": status, "detail": str(detail)[:400], "artifact": artifact,
                             "updated_at": NOW()}
    prog["last_phase"] = phase
    tmp = PROGRESS_FILE.with_name("tmp.json")
    tmp.write_text(json.dumps(prog, indent=2, default=_jd))
    tmp.replace(PROGRESS_FILE)


def db_conn() -> sqlite3.Connection:
    return sqlite3.connect(str(ROOT / "db/custom.db"))


def session_dates_ms() -> np.ndarray:
    con = db_conn()
    ds = np.sort(pd.to_datetime([r[0] for r in con.execute("SELECT DISTINCT date FROM OhlcvBar")])
                 .values.astype("datetime64[ms]").astype(np.int64))
    con.close()
    return ds


def conservative_publication_ts(date_str: str) -> str:
    """Publication DATE (day granularity) -> conservative availability 17:00 PKT
    same date (usable for decisions from the NEXT session only)."""
    d = pd.Timestamp(date_str).tz_localize(PKT_TZ).normalize() + pd.Timedelta(hours=PIT_CONSERVATIVE_HOUR_PK)
    return d.isoformat()


def next_session_after(ts, dates_ms: np.ndarray):
    t = pd.Timestamp(ts).value // 10**6
    later = dates_ms[dates_ms > t]
    return int(later[0]) if len(later) else None


# ── feature groups (Task 102 verified definitions, carried forward) ─────────
FEATURE_GROUPS = {
    "technical_only_v1": {"sources": ["ohlcv_technical"], "enabled": True},
    "technical_market_regime_v1": {"sources": ["ohlcv_technical", "market_regime_internal_proxy"],
                                    "enabled": True,
                                    "note": "regime features from pilot25 equal-weight breadth "
                                            "(internal proxy) - genuine KSE-100 blocked"},
    "technical_pit_fundamental_v1": {"sources": ["pit_fundamentals"], "enabled": False,
                                      "note": "DISABLED: no verified publication timestamps link "
                                              "statements/ratios to decision times"},
    "technical_liquidity_v1": {"sources": ["ohlcv_technical", "ohlcv_liquidity"], "enabled": True},
    "technical_corporate_action_safe_v1": {"sources": ["ohlcv_technical", "corporate_action_flags"],
                                            "enabled": True,
                                            "note": "raw-price CA-suspicion flags only"},
    "technical_intraday_v1": {"sources": ["intraday_bars"], "enabled": False,
                               "note": "DISABLED: no genuine historical intraday data available"},
    "combined_verified_v1": {"sources": ["ohlcv_technical", "ohlcv_liquidity",
                                          "corporate_action_flags", "market_regime_internal_proxy"],
                              "enabled": True,
                              "note": "only verified sources; PIT fundamentals excluded "
                                      "(unavailable), genuine KSE-100 excluded (blocked)"},
}
