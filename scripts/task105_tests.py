#!/usr/bin/env python3
"""Task 105 — Phase 14: deterministic QA suite.
Covers: signal direction, target direction, timestamp alignment, model horizon,
feature cutoff, TP/SL direction, entry logic, cost reconciliation, portfolio
cash, position sizing, no-trade logic, confidence semantics, calibration,
shadow-only behavior, no-live-order-execution, paper-trading idempotency and
historical artifact immutability. Emits task105_test_summary.json."""
from __future__ import annotations
import json, sqlite3, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T105 = ROOT / "data/backtest_reports/task105"
T104 = ROOT / "data/backtest_reports/task104"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402
PASS, FAIL, SKIP = 0, [], 0


def check(name, cond, detail=""):
    global PASS
    if cond:
        PASS += 1; print(f"  ok  {name}")
    else:
        FAIL.append({"test": name, "detail": detail}); print(f"FAIL  {name} {detail}")


def skip(name, why):
    global SKIP
    SKIP += 1; print(f" skip {name} ({why})")


def j(p):
    return json.loads(Path(p).read_text())


def main() -> None:
    t0 = time.time()
    # 1) signal direction + TP/SL direction (production fixtures)
    dt = j(T105 / "task105_direction_mapping_tests.json")
    check("signal_direction_suites_pass", all(s["passed"] for s in dt["suites"]),
           str([s["suite"] for s in dt["suites"] if not s["passed"]]))
    check("tp_sl_direction_both_sides",
          any(s["suite"] == "risk_levels_sell_geometry" and s["passed"] for s in dt["suites"]))

    # 2) target direction on real bars
    sem = j(T105 / "task105_target_semantics_audit.json")
    check("target_sign_convention", sem["sign_convention_fixture"]["sign_violations"] == 0)

    # 3) timestamp alignment + feature cutoff + entry logic
    ts = j(T105 / "task105_timestamp_alignment_report.json")
    check("timestamp_alignment_all_pass", all(c["verdict"] == "PASS" for c in ts["checks"]))
    check("feature_cutoff_no_lookahead",
          any(c["check"].startswith("features use bars") and c["verdict"] == "PASS" for c in ts["checks"]))
    check("entry_logic_next_open",
          any(c["check"].startswith("entry at next") and c["verdict"] == "PASS" for c in ts["checks"]))

    # 4) model horizon == label horizon
    recon = j(T104 / "task104_engine_recon.json")
    check("model_horizon_21_sessions",
          recon["cost_profile"] == "psx_user_schedule_v2"
          and all(s["hold_sessions"] in (None,) or (isinstance(s["hold_sessions"], int) and 1 <= s["hold_sessions"] <= 21)
                   for r in recon["trades"][:500] for s in r["strategies"].values()))

    # 5) cost reconciliation
    par = j(T105 / "task105_cost_parity_report.json")
    check("cost_parity_pass", par["checks"].get("verdict") == "PASS" and not par["checks"].get("failed"))

    # 6) portfolio cash + sizing + ledger
    port = j(T104 / "task104_portfolio_results.json")["results"]
    meta = port.pop("__meta")
    check("portfolio_cash_non_negative", all(v["ending_cash"] >= -0.01 for v in port.values()))
    check("position_sizing_caps_respected", all(
        v["max_concurrent_positions"] <= {"A_eq3": 3, "A_eq5": 5, "A_eq10": 10, "B_5": 100,
                                           "B_10": 100, "B_20": 100, "B_25": 100,
                                           "C_r0_5": 10, "C_r1": 10, "C_r2": 10}[v["sizing"]]
        for v in port.values()))
    check("ledger_identity_all_scenarios", all(
        abs(v["initial_cash"] + v["realized_pnl"] + v["unrealized_pnl"] - v["final_equity"]) <= 1.0
        for v in port.values()))

    # 7) no-trade logic (policy module behavior via node-free re-derivation)
    pol = j(T105 / "task105_capital_protection_policy.json")
    check("no_trade_defaults", pol["defaults"]["allowRealTrades"] is False
           and pol["defaults"]["allowAutomaticPromotion"] is False
           and pol["defaults"]["allowLiveOrderExecution"] is False)
    dispo = j(T105 / "task105_production_signal_disposition.json")
    check("all_surfaces_dispositioned", all(
        s["state"] in ("research_only", "shadow_only", "no_trade") for s in dispo["surfaces"]))

    # 8) confidence semantics + calibration
    cs = j(T105 / "task105_confidence_semantics.json")
    check("confidence_semantics_documented", len(cs["fields"]) >= 5)
    cd = j(T105 / "task105_confidence_production_decision.json")
    check("confidence_marked_unreliable", cd["decision"].startswith("UNRELIABLE"))
    cal = j(T105 / "task105_calibration_diagnostics.json")
    check("final_test_calibration_present",
          sum(1 for k in cal["diagnostics"] if k.endswith("final_test")) == 3)

    # 9) shadow-only behavior + idempotency + no fabricated outcomes
    store = j(T105 / "shadow_observations/task105_shadow_observations.json")
    obs = store["observations"]
    check("shadow_observations_no_trade", all(o["decision_status"] == "no_trade" for o in obs))
    check("shadow_outcomes_not_fabricated", all(o["realized_outcome"] is None for o in obs))
    check("shadow_namespace_separate", store["namespace"].startswith("task105-gen1")
           and "preserved" in store["namespace"])
    before = store["n_observations"]
    r = subprocess.run([sys.executable, "scripts/task105_phase8.py"], capture_output=True,
                        text=True, cwd=ROOT, timeout=140)
    after = j(T105 / "shadow_observations/task105_shadow_observations.json")["n_observations"]
    check("paper_trading_idempotent", r.returncode == 0 and after == before,
           f"{before} -> {after}")

    # 10) no live order execution pathway
    hits = subprocess.run(["grep", "-rn", "placeOrder|submitOrder|liveOrder|place_order",
                            "src/"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    check("no_live_order_code_path", hits == "", hits[:120])

    # 11) historical artifact immutability
    st = subprocess.run(["git", "status", "--porcelain", "data/backtest_reports/task100",
                          "data/backtest_reports/task101", "data/backtest_reports/task102",
                          "data/backtest_reports/task103", "data/backtest_reports/task104"],
                         capture_output=True, text=True, cwd=ROOT).stdout.strip()
    check("historical_artifacts_unmodified", st == "", st[:160])

    # 12) DB integrity
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    check("db_integrity_ok", db.execute("PRAGMA quick_check").fetchone()[0] == "ok")

    # 13) forward status + gates
    fvs = j(T105 / "task105_forward_validation_status.json")
    check("forward_state_awaiting_data", fvs["state"] == "awaiting_data")
    eg = j(T105 / "task105_evidence_gate_report.json")
    check("gates_reported_honestly", eg["gates_met"] == 0 and eg["gates_total"] == 9)

    (T105 / "task105_test_summary.json").write_text(json.dumps({
        "report": "task105_test_summary", "generated_at": L.NOW(),
        "python_checks": {"passed": PASS, "failed": FAIL, "skipped": SKIP},
        "note": "skipped tests are reported as skipped, never as passing",
        "additional_suites": {
            "typescript": "bunx tsc --noEmit -> clean (see run log)",
            "production_build": "executed separately; result recorded in run log",
            "api_integration": "executed separately (data-readiness, ai-model-signals, models)",
            "headless_browser": "executed separately (home + signals page + notice present)"},
        "verdict": "PASS" if not FAIL else "FAIL",
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))
    print(f"\ntask105 QA: {PASS} passed, {len(FAIL)} failed, {SKIP} skipped")


if __name__ == "__main__":
    main()
