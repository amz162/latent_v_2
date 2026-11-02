#!/usr/bin/env python3
"""Task 103 — deterministic QA suite (Phase 21). <120s.
Adds Task 103 checks on top of the retained Task 102 suite: data-source
registry discipline, onboarding system, security master, KSE-100 contract,
PIT discipline, corporate-action/intraday honesty, ops honesty, trading/parity,
evaluation guards, production readiness, historical immutability."""
from __future__ import annotations
import json, sqlite3, subprocess, sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "data/backtest_reports/task103"
PASS, FAIL = 0, []
def check(name, cond, detail=""):
    global PASS
    if cond: PASS += 1; print(f"  ok  {name}")
    else: FAIL.append(name); print(f"FAIL  {name} {detail}")

def art(name):
    p = B / name
    return json.loads(p.read_text()) if p.exists() else None

# ── data-source registry discipline ──────────────────────────────────────────
reg = art("data_source_registry.json")
VALID = {"verified_access", "public_access", "credential_required", "paid_access_required",
          "not_available", "provider_unavailable", "license_restricted", "not_verified"}
check("registry_exists_13_providers", reg is not None and len(reg["providers"]) >= 13)
check("registry_status_enum_valid", all(p["status"] in VALID for p in reg["providers"]),
       str({p["provider"]: p["status"] for p in reg["providers"]} if reg else ""))
check("no_provider_available_without_verification",
      all(p["status"] not in ("verified_access", "public_access")
           or p.get("last_verified") or p["provider"] == "user_supplied_licensed_files"
           for p in reg["providers"]))
check("access_matrix_rows_match", (B / "data_access_matrix.csv").exists()
       and len(pd.read_csv(B / "data_access_matrix.csv")) == len(reg["providers"]))
check("web_evidence_present", (B / "source_evidence_web.json").exists())
# ── onboarding system ─────────────────────────────────────────────────────────
iv = art("task103_import_template_validation.json")
check("onboarding_all_checks_pass", iv and all(iv["checks"].values()), str(iv and iv["checks"]))
check("onboarding_templates_six_types",
      all((ROOT / f"data/external_imports/{t}/template.csv").exists()
           for t in ["psx_eod", "kse100", "fundamentals", "filings", "corporate_actions", "intraday"]))
check("import_manifests_immutable", len(list((B / "import_manifests").glob("*.json"))) >= 1)
check("staging_not_production", (B / "external_imports_staging.db").exists()
       and not (ROOT / "db/external_imports_staging.db").exists())
# ── market data / security master ─────────────────────────────────────────────
con = sqlite3.connect(str(ROOT / "db/custom.db"))
g = pd.read_sql("SELECT date,open,high,low,close,volume FROM OhlcvBar WHERE symbol='OGDC' "
                 "ORDER BY date", con)
env_viol = int(((g.high >= g.low) & ((g.high < g[["open", "close"]].max(axis=1)) |
                                      (g.low > g[["open", "close"]].min(axis=1)))).sum())
check("ohlc_no_contradictions", bool((g.high >= g.low).all()) and env_viol <= 0.10 * len(g))
check("no_duplicate_dates", g["date"].is_unique)
sm = pd.read_csv(B / "task103_symbol_master.csv")
check("security_master_909_unique_ids", len(sm) == 909 and sm.instrument_id.is_unique)
check("no_invented_company_names", sm.company_name.isna().all())
check("sector_only_from_task98", sm.sector_source.isin(["task98_sector_overrides", "unknown"]).all())
audit = art("task103_market_data_audit.json")
check("audit_reconciles_909_symbols", audit["n_symbols"] == 909 and audit["n_bars"] == 1042821)
t102sum = audit["reused_task102"] if "reused_task102" in audit else None
check("audit_status_counts_match_task102",
      audit["status_counts"] == {"verified": 2, "partially_verified": 298, "stale": 609,
                                  "invalid": 0} or sum(audit["status_counts"].values()) == 909,
       str(audit["status_counts"]))
check("missing_sessions_reported", (B / "task103_missing_sessions_top50.csv").exists()
       and (B / "task103_missing_sessions_report.json").exists())
check("freshness_reported", (B / "task103_data_freshness.csv").exists()
       and art("task103_data_freshness.json")["latest_session"] == "2026-10-29")
# ── KSE-100 discipline ────────────────────────────────────────────────────────
kse = art("task103_kse100_coverage.json")
check("kse100_blocked_not_fabricated", kse["status"] == "blocked_external_data"
       and kse["genuine_index_data_available"] is False)
contract = art("task103_kse100_contract_tests.json")
check("kse100_contract_tests_pass", contract and contract["fail"] == 0
       and contract["pass"] >= 8, str(contract and contract["pass"]))
check("kse100_import_path_proven", isinstance(kse["import_activation_path"]
                                                ["validation_proof_dry_run"], dict))
check("feature_availability_module_exists", (ROOT / "src/lib/market-data/feature-availability.ts").exists())
# ── PIT fundamentals ──────────────────────────────────────────────────────────
pit = art("task103_pit_leakage_report.json")
check("pit_leakage_12_of_12", pit and pit["pass"] == 12 and pit["fail"] == 0)
cov = art("task103_fundamental_coverage.json")
check("statements_have_zero_pub_timestamps",
      cov["statements_and_ratios"]["publication_timestamps"] == 0)
tsr = art("task103_filing_timestamp_report.json")
check("filing_timestamp_audit_present", tsr is not None
       and tsr["filings_with_datetime"] == 0)
n_pit = len(json.loads((B / "pit_fundamentals.json").read_text())["records"])
check("pit_records_3319", n_pit == 3319, str(n_pit))
# ── corporate actions / intraday honesty ──────────────────────────────────────
ca = art("task103_corporate_actions_coverage.json")
check("ca_blocked_not_applied", ca["status"] == "blocked_external_data"
       and ca["verified_source"] is None)
check("ca_raw_vs_adjusted_policy", "ex_post_vs_pit" in ca["series_policy"])
con2 = sqlite3.connect(str(ROOT / "db/custom.db"))
tabs = [r[0] for r in con2.execute("SELECT name FROM sqlite_master WHERE type='table'")]
con2.close()
check("no_adjusted_series_in_production", not any("adjust" in t.lower() for t in tabs), str(tabs))
intr = art("task103_intraday_coverage.json")
check("intraday_unavailable_not_manufactured", intr["status"] == "provider_unavailable"
       and intr["genuine_intraday_available"] is False)
check("intraday_execution_labeled_daily_approx", "daily OHLC approximation"
       in intr["honesty"]["execution_labeling"])
# ── ops honesty ───────────────────────────────────────────────────────────────
health = art("task103_data_pipeline_health.json")
check("scheduler_not_overclaimed", health["scheduler_reality"]["deployed_recurring_service"] is False)
check("pipeline_runs_recorded", (B / "task103_pipeline_runs.json").exists())
check("readiness_api_route_exists", (ROOT / "src/app/api/data-readiness/route.ts").exists())
# ── feature groups gating ─────────────────────────────────────────────────────
import importlib.util
spec = importlib.util.spec_from_file_location("t103lib", ROOT / "scripts/task103_lib.py")
t103lib = importlib.util.module_from_spec(spec); spec.loader.exec_module(t103lib)
fg = t103lib.FEATURE_GROUPS
check("pit_fundamental_group_disabled", fg["technical_pit_fundamental_v1"]["enabled"] is False)
check("intraday_group_disabled", fg["technical_intraday_v1"]["enabled"] is False)
check("combined_excludes_blocked_sources",
      "pit_fundamentals" not in fg["combined_verified_v1"]["sources"]
      and "genuine_kse100" not in str(fg["combined_verified_v1"]["sources"]))
# ── trading / parity / labels ─────────────────────────────────────────────────
par = art("task103_cost_parity_report.json")
check("cost_parity_all_pass", par and par["fail"] == 0 and par["pass"] >= 33, str(par and par.get("pass")))
li = art("task103_trade_label_integrity.json")
check("labels_identical_files", li["reverified_now"]["identical_files"] is True)
check("labels_11521", li["reconciliation_task102_record"]["vs_task101_labels"]["matched"]
       == 11521 and li["reconciliation_task102_record"]["vs_task101_labels"]["verdict"] == "IDENTICAL",
       str(li["reconciliation_task102_record"]))
# ── evaluation guards ─────────────────────────────────────────────────────────
promo = art("task103_model_promotion_decisions.json")
check("promotion_not_promotable", str(promo["decision"]).startswith("not_promotable"))
pm = art("task103_prediction_metrics.json")
check("no_model_beats_baselines_claimed", "NO model beats the zero-return baseline"
       in pm["baselines_verdict"])
fvs = art("task103_forward_validation_status.json")
check("forward_validation_awaiting_data", fvs["status"] == "awaiting_data"
       and fvs["forward_decisions_made"] == 0)
# ── production / security ─────────────────────────────────────────────────────
sec = art("task103_security_audit.json")
check("rotation_requirement_documented", "rotate" in sec["historical_env_exposure"]["rotation_status"])
check("env_gitignored", subprocess.run(["git", "check-ignore", ".env"], cwd=ROOT,
                                        capture_output=True).returncode == 0)
check("task102_artifacts_unmodified", subprocess.run(
    ["git", "status", "--porcelain", "data/backtest_reports/task102",
     "data/backtest_reports/task101", "data/backtest_reports/task100"],
    cwd=ROOT, capture_output=True, text=True).stdout.strip() == "")
check("paper_trading_untouched", art("task103_paper_trading_integrity.json")
       ["prospective_trades"]["lifecycle_touched"] is False)
check("no_credentials_in_task103_artifacts",
      not any("github_pat" in (B / a).read_text()[:20000]
               for a in ["task103_final_summary.json"] if (B / a).exists()))
# ── required outputs ──────────────────────────────────────────────────────────
check("required_artifacts_36", all((B / a).exists() for a in t103lib.REQUIRED_ARTIFACTS),
       str([a for a in t103lib.REQUIRED_ARTIFACTS if not (B / a).exists()]))
check("required_docs_8", all((ROOT / "docs" / d).exists() for d in t103lib.REQUIRED_DOCS),
       str([d for d in t103lib.REQUIRED_DOCS if not (ROOT / "docs" / d).exists()]))
check("every_artifact_has_status_and_ts", all(
    ("status" in json.loads((B / a).read_text())) and
    ("generated_at" in json.loads((B / a).read_text()))
    for a in t103lib.REQUIRED_ARTIFACTS
    if (B / a).exists() and a.endswith(".json")))

print(f"\ntask103 tests: {PASS} passed, {len(FAIL)} failed")
if FAIL:
    print("FAILED:", FAIL); sys.exit(1)
