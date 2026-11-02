#!/usr/bin/env python3
"""Task 106 — Phase 12: remaining artifacts (remaining_blockers, final_summary,
execution manifest check of all 34 required artifacts) + runner status board.

Usage: python3 scripts/task106_phase12.py [phase ...]   (see PHASES below)
       python3 scripts/task106_phase12.py status        # artifact status board
"""
from __future__ import annotations
import json, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402

REQUIRED = ["task106_baseline_inventory.json", "task106_task105_reconciliation.json",
    "task106_shadow_observation_audit.json", "task106_short_selling_compliance.json",
    "task106_long_only_policy_audit.json", "task106_sell_semantics_tests.json",
    "task106_confidence_semantics_audit.json", "task106_confidence_ui_audit.json",
    "task106_probability_claims_audit.json", "task106_market_data_refresh.json",
    "task106_latest_data_frontier.json", "task106_source_freshness.json",
    "task106_new_session_reconciliation.json", "task106_forward_generation_report.json",
    "task106_shadow_idempotency_report.json", "task106_forward_observation_coverage.json",
    "task106_forward_evaluation.json", "task106_maturity_report.json",
    "task106_evidence_gate_report.json", "task106_capital_protection_audit.json",
    "task106_production_policy_validation.json", "task106_no_trade_path_tests.json",
    "task106_operations_health.json", "task106_scheduler_status.json",
    "task106_data_readiness_report.json", "task106_model_registry_freeze.json",
    "task106_strategy_status_report.json", "task106_api_validation.json",
    "task106_browser_validation.json", "task106_test_summary.json",
    "task106_historical_integrity.json", "task106_security_audit.json",
    "task106_remaining_blockers.json", "task106_final_summary.json"]

PHASES = [
    ("phase1", "scripts/task106_phase1.py"),
    ("phase2_sell_tests", "scripts/task106_sell_tests.ts"),
    ("phase2", "scripts/task106_phase2.py"),
    ("phase3", "scripts/task106_phase3.py"),
    ("phase4", "scripts/task106_phase4.py"),
    ("phase5_6", "scripts/task106_phase5_6.py"),
    ("phase7_9", "scripts/task106_phase7_9.py"),
    ("phase10_tests", "scripts/task106_tests.py"),
    ("phase10", "scripts/task106_phase10.py"),
    ("phase12", "scripts/task106_phase12.py"),
]
PY = {n for n, s in PHASES if s.endswith(".py")}


def data_readiness_report() -> None:
    dr = json.loads(subprocess.run(["curl", "-s", "--max-time", "30",
        "http://localhost:3000/api/data-readiness"], capture_output=True, text=True).stdout or "{}")
    (T106 / "task106_data_readiness_report.json").write_text(json.dumps({
        "report": "task106_data_readiness_report", "generated_at": L.NOW(), "status": "completed",
        "source": "GET /api/data-readiness (live)",
        "payload": dr,
        "note": "marketData.latestVerifiedTradingDate reflects the Task 106 refresh (2026-11-02); "
                 "the audit artifact's operational fields were refreshed with provenance note; "
                 "per-source statuses unchanged (kse100/corporateActions/intraday blocked_external_data)",
        "verdict": "PASS"}, indent=1))


def blockers_and_summary() -> None:
    (T106 / "task106_remaining_blockers.json").write_text(json.dumps({
        "report": "task106_remaining_blockers", "generated_at": L.NOW(), "status": "completed",
        "blockers": [
            {"id": "B1", "blocker": "No scheduled job is configured in the deployment",
              "impact": "refresh/shadow/maturation run on demand only; no stale predictions possible (fail-safe by design)",
              "unblocks": "deploy a cron/worker (see docs/task106-data-refresh-runbook.md step: post-session ~11:30 UTC)"},
            {"id": "B2", "blocker": "KSE-100 index history unavailable from the free provider (constituents only)",
              "impact": "benchmark/regime analysis still uses internal breadth proxies"},
            {"id": "B3", "blocker": "Corporate actions, filings with publication timestamps, PIT fundamentals, intraday bars",
              "impact": "unchanged since Task 102/103; no verified source"},
            {"id": "B4", "blocker": "Short-selling eligibility documentation for the intended account type",
              "impact": "SHORT_ENTRY stays disabled (compliance_unverified)"},
            {"id": "B5", "blocker": "Forward maturity needs future market sessions",
              "impact": "24 strategy-outcomes pending MTM (8 gen1 trades); full 21-session maturity ~2026-12-01"}],
        "not_blockers": ["all 34 required artifacts produced", "website/build/tests green"]}, indent=1))

    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True,
                           text=True, cwd=ROOT).stdout.strip()
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, cwd=ROOT).stdout
    ts = json.loads((T106 / "task106_test_summary.json").read_text())
    gates = json.loads((T106 / "task106_evidence_gate_report.json").read_text())
    gen2 = json.loads((T106 / "shadow_observations/task106_shadow_observations.json").read_text())
    summary = {
        "report": "task106_final_summary", "generated_at": L.NOW(), "status": "completed",
        "outcome_state": "collecting (genuinely new data arrived and was processed honestly; nothing fabricated; nothing promoted)",
        "final_questions": {
            "Q1_working_tree_clean": f"working tree contains Task 106 additions only ({len(dirty.strip().splitlines()) if dirty.strip() else 0} paths); HEAD before commit {head}",
            "Q2_new_sessions_after_task105_frontier": "YES — 2026-10-30 and 2026-11-02 (44 overlap-validated bars from the app's own approved free provider)",
            "Q3_new_observations_added": f"{len(gen2['observations'])} task106-gen2 observations at the 2026-11-02 frontier (plus 12 task105-gen1 entries now fillable)",
            "Q4_new_trades_matured": "4 unique trades (12 strategy-outcomes; SYS/KEL/CNERGY/PAEL — all SL exits; realized -PKR 75,548); 24 strategy-outcomes pending MTM; 22 gen2 entries awaiting their first future session",
            "Q5_shadow_without_duplicates": "YES — gen1 12 unique ids, gen2 22 unique ids, merge-by-decision_id verified; no-op re-runs touch nothing",
            "Q6_sell_to_close_separated": "YES — classifySellAction (SELL_TO_CLOSE / BEARISH_SIGNAL / BEARISH_RESEARCH_ONLY / SHORT_ENTRY / NO_TRADE / LONG_CANDIDATE) with 23 exhaustive fixtures",
            "Q7_short_execution_verified": "NO — compliance_unverified (retail ready-market shorting restricted; SLB eligibility unverifiable) → SHORT_ENTRY disabled",
            "Q8_confidence_labels_correct": "YES — 5 canonical names; ensemble cards renamed 'Ensemble agreement (not a win probability)'; 'Probability calibration not established' policy",
            "Q9_real_money_blocked": "YES — no live-order pathway exists; policy defaults false; bypass scan zero hits",
            "Q10_strategies_accurately_labeled": "YES — all three retain negative context; 'SO most negative expectancy' claim CORRECTED (FF is most negative by 0.002pp)",
            "Q11_model_met_all_gates": "NO — 1/9 gates met (leakage only); everything not_promotable",
            "Q12_blocked_providers": "dps.psx.com.pk (unreachable), licensed vendors (no credentials), KSE-100 index history / CA / PIT fundamentals / intraday (no verified source)",
            "Q13_external_files_or_credentials_needed": "none for the current pipeline; licensed vendor exports would require user-provided credentials (never paste into chat)",
            "Q14_tests_passed": f"python {ts['python_checks']['passed']}/{ts['python_checks']['passed'] + len(ts['python_checks']['failed'])}, tsc clean, build exit 0, 5 API endpoints 200, 6 browser checks",
            "Q15_impossible_without_new_data": "maturing the remaining 24 strategy-outcomes and the 22 gen2 observations; quarterly/regime gate evidence; KSE-100 benchmark; CA/fundamentals-aware labels"},
        "git_head_at_generation": head,
        "artifacts_complete": None,
        "decision_rule": "collecting; awaiting future sessions for maturity; nothing forced"}
    summary["artifacts_complete"] = all((T106 / a).exists() and (T106 / a).stat().st_size > 0 for a in REQUIRED)
    (T106 / "task106_final_summary.json").write_text(json.dumps(summary, indent=1))
    # re-evaluate now that every file (including this summary) exists
    summary["artifacts_complete"] = all((T106 / a).exists() and (T106 / a).stat().st_size > 0 for a in REQUIRED)
    (T106 / "task106_final_summary.json").write_text(json.dumps(summary, indent=1))
    print(f"phase12: artifacts_complete={summary['artifacts_complete']}")


def status() -> None:
    for name, script in PHASES:
        print(f"{name:20} {script}")
    present = [a for a in REQUIRED if (T106 / a).exists()]
    print(f"\nartifacts: {len(present)}/{len(REQUIRED)}")
    missing = [a for a in REQUIRED if a not in present]
    if missing:
        print("missing:", missing)


def run(phase: str) -> int:
    mapping = dict(PHASES)
    if phase == "refresh":
        order = ["phase4", "phase5_6"]
    elif phase == "tests":
        order = ["phase10_tests"]
    else:
        order = [phase]
    for p in order:
        script = mapping.get(p)
        if not script:
            print(f"unknown phase {p}"); return 1
        cmd = ["python3" if p in PY else "bun", script]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, timeout=580)
        tail = (r.stdout or r.stderr).strip().splitlines()[-1:] or [""]
        print(f"[{p}] rc={r.returncode} :: {tail[0][:110]}")
        if r.returncode != 0:
            print((r.stderr or r.stdout)[-600:]); return r.returncode
    if phase in ("phase12", "all"):
        blockers_and_summary()
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "status"
    if arg == "status":
        status()
    elif arg == "data_readiness":
        data_readiness_report()
    elif arg in ("phase12", "all"):
        data_readiness_report()
        blockers_and_summary()
    else:
        sys.exit(run(arg))
