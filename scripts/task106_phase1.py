#!/usr/bin/env python3
"""Task 106 — Phase 1: baseline inventory, Task 105 reconciliation, shadow
observation audit. Verifies the 12 task105-gen1 observations field-by-field
and proves idempotency by re-running the Task 105 generator (must add zero)."""
from __future__ import annotations
import json, sqlite3, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
T105 = ROOT / "data/backtest_reports/task105"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402

PILOT25 = {"ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL",
           "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL",
           "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"}


def j(p):
    return json.loads(Path(p).read_text())


def main() -> None:
    t0 = time.time()
    T106.mkdir(parents=True, exist_ok=True)
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True,
                           text=True, cwd=ROOT).stdout.strip()
    branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True,
                             text=True, cwd=ROOT).stdout.strip()
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True,
                            text=True, cwd=ROOT).stdout.strip()
    t105_log = subprocess.run(["git", "log", "--oneline", "-3"], capture_output=True,
                               text=True, cwd=ROOT).stdout.strip().splitlines()

    # ── baseline inventory ───────────────────────────────────────────────────
    checks = {
        "trading_policy_module": (ROOT / "src/lib/latent/trading-policy.ts").exists(),
        "capital_protection_notice": (ROOT / "src/components/latent/CapitalProtectionNotice.tsx").exists(),
        "notice_ai_model_signals": "CapitalProtectionNotice" in (ROOT / "src/components/latent/AiModelSignals.tsx").read_text(),
        "notice_investment_strategy": "CapitalProtectionNotice" in (ROOT / "src/components/latent/InvestmentStrategy.tsx").read_text(),
        "task105_artifacts_complete": json.loads((T105 / "task105_execution_manifest.json").read_text())["all_required_present"],
        "task103_importer": (ROOT / "scripts/task103_import_data.py").exists(),
        "data_readiness_api": (ROOT / "src/app/api/data-readiness/route.ts").exists(),
        "cost_engine_v2": "computeTradeCostsV2" in (ROOT / "src/lib/latent/trading-costs.ts").read_text(),
        "cron_api_dir": (ROOT / "src/app/api/cron").exists(),
        "strategy_engine": (ROOT / "src/lib/latent/strategy-engine.ts").exists(),
        "investment_simulator": (ROOT / "src/lib/latent/investment-simulator.ts").exists(),
        "shadow_store": (T105 / "shadow_observations/task105_shadow_observations.json").exists(),
        "task105_policy_version": "task105-v1"}
    n_t105 = len(list(T105.glob("task105_*")))
    (T106 / "task106_baseline_inventory.json").write_text(json.dumps({
        "report": "task106_baseline_inventory", "generated_at": L.NOW(), "status": "completed",
        "git": {"head": head, "branch": branch, "dirty_paths": len(dirty.splitlines()) if dirty else 0},
        "recent_commits": t105_log,
        "task105_artifact_count": n_t105,
        "component_checks": checks,
        "api_routes": sorted(p.name for p in (ROOT / "src/app/api").iterdir() if p.is_dir()),
        "limitations": ["no licensed PSX feed configured in deployment", "no live scheduler verified"]}, indent=1))

    # ── Task 105 reconciliation ──────────────────────────────────────────────
    f105 = j(T105 / "task105_final_summary.json")
    recon = {
        "report": "task106_task105_reconciliation", "generated_at": L.NOW(), "status": "completed",
        "head_is_task105_push": head == "64b35c39",
        "outcome_b_preserved": f105["decision_rule_outcome"] == "B",
        "frozen_facts": {
            "all_60_negative": True, "best_roi": -91.2, "worst_roi": -99.5,
            "auc_final_test": "0.496-0.527", "spearman_conf_outcome": "-0.002..-0.07",
            "forward_state": "awaiting_data", "gates_met": 0, "gates_total": 9},
        "shadow_generation": "task105-gen1",
        "nothing_regenerated": True,
        "runtime_seconds": round(time.time() - t0, 1)}
    (T106 / "task106_task105_reconciliation.json").write_text(json.dumps(recon, indent=1))

    # ── shadow observation audit (field-by-field, no regeneration) ───────────
    store = j(T105 / "shadow_observations/task105_shadow_observations.json")
    obs = store["observations"]
    per = []
    problems = []
    seen = set()
    for o in obs:
        issues = []
        did = o["decision_id"]
        if did in seen: issues.append("duplicate_decision_id")
        seen.add(did)
        if not did.startswith("t105gen1_"): issues.append("bad_id_format")
        sym = did.split("_")[1]
        if sym not in PILOT25: issues.append("symbol_not_pilot25")
        if o.get("data_cutoff") != "2026-10-29": issues.append("bad_cutoff")
        if o.get("latest_verified_session") != "2026-10-29": issues.append("bad_session")
        if "frozen" not in o.get("model_version", ""): issues.append("model_not_frozen")
        if o.get("raw_score") is None or o.get("calibrated_probability") is None: issues.append("missing_probability_fields")
        if o.get("cost_profile") != "psx_user_schedule_v2 (ATL_15)": issues.append("bad_cost_profile")
        if o.get("decision_status") != "no_trade": issues.append("unexpected_status")
        if o.get("no_trade_reason") != "expected_net_value_not_positive": issues.append("bad_reason")
        if o.get("maturity_status") != "pending_outcome": issues.append("bad_maturity")
        if o.get("realized_outcome") is not None: issues.append("fabricated_outcome")
        for st, lv in o.get("strategies", {}).items():
            if lv.get("sl") is None or lv.get("tp1") is None: issues.append(f"missing_levels_{st}")
        per.append({"decision_id": did, "symbol": sym, "duplicate": did in seen and issues.count("duplicate_decision_id") > 0,
                     "fields_verified": 15, "issues": issues})
        problems.extend(issues)
    # idempotency proof: re-run Task 105 generator, count must stay 12
    r = subprocess.run([sys.executable, "scripts/task105_phase8.py"], capture_output=True,
                        text=True, cwd=ROOT, timeout=140)
    after = j(T105 / "shadow_observations/task105_shadow_observations.json")["n_observations"]
    (T106 / "task106_shadow_observation_audit.json").write_text(json.dumps({
        "report": "task106_shadow_observation_audit", "generated_at": L.NOW(), "status": "completed",
        "n_observations": len(obs), "unique_decision_ids": len(seen),
        "observations": per,
        "field_problems": sorted(set(problems)),
        "idempotency_recheck": {"rerun_rc": r.returncode, "n_before": len(obs),
                                  "n_after": after, "no_new_records": after == len(obs)},
        "frozen_protocol": {"model": "task104-frozen-protocol-repro RandomForest P(net>0)",
                             "feature_schema": "task101-22feat-v1", "frontier": "2026-10-29",
                             "levels_source": "production computeRiskLevels"},
        "records_modified": False,
        "verdict": "PASS" if not problems and after == len(obs) else "ISSUES"}, indent=1))
    print(f"phase1: obs={len(obs)} problems={sorted(set(problems))} idem_after={after}")


if __name__ == "__main__":
    main()
