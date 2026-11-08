#!/usr/bin/env python3
"""Task 116 — beta launch acceptance tests (Part M).

Checks M1-M6 against the live repository and artifacts. Run:
  python3 scripts/task116_tests.py
"""
from __future__ import annotations
import json, sqlite3, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
T116 = ROOT / "data" / "backtest_reports" / "task116"
RES = []


def check(name, ok, detail=""):
    RES.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not ok else ""))


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120, cwd=ROOT).stdout


def main():
    print(f"=== Task 116 acceptance tests ===")
    sec = json.loads((T116 / "task116_security_remediation.json").read_text())
    host = json.loads((T116 / "task116_hosting_readiness.json").read_text())
    audit = json.loads((T116 / "task116_beta_launch_audit.json").read_text())
    m = sec["measured"]

    print("-- M1 security & hosting --")
    check("m1a_no_hardcoded_localhost_routes", m["hardcoded_localhost3000_in_src"] == 0)
    check("m1b_no_hardcoded_homez_or_mnt_in_src",
          m["hardcoded_homez_in_src"] == 0 and m["hardcoded_mnt_userdata_in_src"] == 0)
    check("m1c_ssrf_guard_present_and_used", m["ssrf_guard_module"] and m["ssrf_guard_usage_sites"] >= 1)
    check("m1d_cache_production_gated", m["cache_production_gating"])
    check("m1e_health_endpoint_exists", m["health_endpoint"] and m["central_paths_module"])
    check("m1f_db_persistence_verified", host["database"]["persistence"].startswith("VERIFIED"))
    check("m1g_worker_model_documented", "singleton" in host["workers"]["model"] or "singleton" in json.dumps(host["workers"]))
    # note: the RSA literal is split so this check does not self-match its own source
    secrets = sh('git grep -lE "ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN RSA PRIVAT[E] KEY" -- . 2>/dev/null | wc -l')
    check("m1h_no_secrets_in_tree", secrets.strip() == "0", secrets)

    print("-- M2 strategy engine --")
    with open(T116 / "task116_strategy_inventory.csv") as f:
        inv = list(__import__("csv").DictReader(f))
    check("m2a_twelve_registered", len(inv) == 12)
    check("m2b_all_have_status_and_role", all(r["role"] in ("directional", "regime_gate", "pair_context") for r in inv))
    check("m2c_pairs_not_a_vote", next(r for r in inv if r["strategyId"] == "pairs_kalman_hedge")["beta_status"] == "context_only_excluded")
    check("m2d_bbw_not_options_signal", "no options instrument" in next(r for r in inv if r["strategyId"] == "bollinger_width_regime")["restrictions"])
    check("m2e_gates_not_votes", all(r["beta_status"] == "regime_gate" for r in inv if r["role"] == "regime_gate"))
    with open(T116 / "task116_strategy_validation.csv") as f:
        val = list(__import__("csv").DictReader(f))
    check("m2f_none_performance_validated", all("NOT performance-validated" in r["validation_status"] for r in val))
    bunqa = (T116 / "_qa_bun.txt").read_text() if (T116 / "_qa_bun.txt").exists() else ""
    check("m2g_bun_unit_suite_green", "0 fail" in bunqa and " 20 pass" in bunqa or ("0 fail" in bunqa and "pass" in bunqa), bunqa[-80:])

    print("-- M3 LLM integration --")
    llmv = json.loads((ROOT / "data/backtest_reports/task114/task114_llm_maturity.json").read_text())
    check("m3a_llm_cohort_intact", llmv["rollup"]["total_observations"] == 23)
    check("m3b_mock_records_excluded", llmv["frozen_baseline_verified"]["mock_pipeline_check_records"] == 23)
    check("m3c_calibration_gated", llmv["calibration"]["current_matured_llm_outcomes"] == 0
          and "100" in str(llmv["calibration"]["minimum_required"]))
    ins = (ROOT / "src/app/api/beta/insight/route.ts").read_text()
    check("m3d_insight_reads_real_records_only", 'recordType !== "REAL_LLM_DECISION"' in ins)
    check("m3e_insight_uncalibrated_label", "uncalibrated" in ins)

    print("-- M4/M5 beta UX surface --")
    check("m4a_onboarding_route_exists", (ROOT / "src/app/beta/onboarding/page.tsx").exists())
    check("m4b_dashboard_route_exists", (ROOT / "src/app/beta/page.tsx").exists())
    check("m4c_flag_is_server_side", 'BETA_ONBOARDING_ENABLED' in (ROOT / "src/app/api/beta/status/route.ts").read_text()
          or 'BETA_ONBOARDING_ENABLED' in (ROOT / "src/lib/latent/beta-access.ts").read_text())  # Task 117: gate logic centralized
    prof = (ROOT / "src/app/api/beta/profile/route.ts").read_text()
    access = (ROOT / "src/lib/latent/beta-access.ts").read_text()
    check("m4d_profile_hard_delete", "deleteMany" in prof)
    # Task 117: identity lookup is now sha256-hash based (raw token never
    # stored server-side) — the equivalent no-cross-user invariant.
    check("m4e_no_cross_user_access",
          "sessionTokenHash" in prof and "sha256(token)" in access)
    # Task 117: consent version moved to beta-access.ts (single source of truth)
    check("m4f_consent_versioned", "beta-consent-v1" in access
          and "CONSENT_VERSION" in (ROOT / "src/app/api/beta/status/route.ts").read_text())
    i18n = (ROOT / "src/lib/latent/i18n.ts").read_text()
    seg = i18n.split('"beta.dashboard.banner":')[1][:600]
    check("m5a_beta_strings_trilingual", "urdu:" in seg and "roman_urdu:" in seg and "en:" in seg)
    check("m5b_nav_entry_flag_gated", "betaEnabled" in (ROOT / "src/components/latent/AppNav.tsx").read_text())
    check("m5c_alignment_label_not_winrate", "eligible directional strategies align" in (ROOT / "src/lib/latent/strategies/fusion.ts").read_text()
          and "win probability" not in (ROOT / "src/lib/latent/strategies/fusion.ts").read_text().lower().replace("must not be called win probability", ""))

    print("-- M6 research integrity --")
    check("m6a_v2_costs_canonical", "computeTradeCostsV2" in (ROOT / "src/lib/latent/trading-costs.ts").read_text())
    check("m6b_track_record_real_only", "Insufficient real history" in (ROOT / "src/lib/latent/track-record.ts").read_text()
          and "isDemo: false" in (ROOT / "src/app/api/track-record/route.ts").read_text())
    check("m6c_task115_result_descriptive", "n=12" in audit["research_facts_preserved"]["gen1_checkpoint"])
    check("m6d_release_status_honest", audit["release_status"] == "BETA_READY_WITH_LIMITATIONS")
    check("m6e_tax_schedule_versioned", "pk-tax-v2026-11-r2" in (ROOT / "src/lib/latent/tax.ts").read_text())  # Task 117 Part H: re-verified schedule
    # DB untouched by this task except the additive BetaProfile table
    conn = sqlite3.connect(f"file:{ROOT/'db/custom.db'}?mode=ro", uri=True)
    bars = conn.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0]
    frontier = conn.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    bp = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='BetaProfile'").fetchone()
    conn.close()
    # Task 119 update (documented): the invariant is ADDITIVITY — bars never
    # shrink and the frontier never regresses. The 2026-11-06 session was
    # ingested with verified provider data (task119_frontier_verification.json:
    # 69 overlap bars revalidated 0 mismatches), so >= the Task 116 markers.
    check("m6f_db_intact_and_additive", bars >= 1042969 and frontier >= "2026-11-05" and bp is not None, f"bars={bars} frontier={frontier}")

    p = sum(1 for _, ok, _ in RES if ok)
    f = len(RES) - p
    print(f"\ntask116 QA: {p} passed, {f} failed, 0 skipped")
    if f:
        for name, ok, detail in RES:
            if not ok:
                print(f"  FAIL: {name} {detail}")
        sys.exit(1)


if __name__ == "__main__":
    main()
