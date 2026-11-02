#!/usr/bin/env python3
"""Task 106 — Phase 10 QA suite. Deterministic checks: no-trade policy, sell
semantics, confidence labels, shadow idempotency, V2 cost parity, historical
artifact immutability, DB integrity, data frontier. Emits partial summary;
api/browser/build results are appended by the driver."""
from __future__ import annotations
import json, sqlite3, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
T105 = ROOT / "data/backtest_reports/task105"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402
PASS, FAIL = 0, []


def check(name, cond, detail=""):
    global PASS
    if cond: PASS += 1; print(f"  ok  {name}")
    else: FAIL.append({"test": name, "detail": detail}); print(f"FAIL  {name} {detail}")


def j(p):
    return json.loads(Path(p).read_text())


def main() -> None:
    t0 = time.time()
    # no-trade policy + sell semantics (production fixtures)
    sell = j(T106 / "task106_sell_semantics_tests.json")
    check("sell_semantics_no_short_entry", sell["verdict"] == "PASS" and not sell["failed"], str(sell["failed"]))
    pol = j(T106 / "task106_production_policy_validation.json")
    check("policy_validation_all_pass", pol["verdict"] == "ALL CHECKS PASS")
    nt = j(T106 / "task106_no_trade_path_tests.json")
    check("no_trade_paths_pass", nt["verdict"] == "PASS")
    conf = j(T106 / "task106_confidence_semantics_audit.json")
    check("confidence_labels_canonical", len(conf["canonical_fields"]) == 5
           and not any(v["presentable_as_probability"] for k, v in conf["canonical_fields"].items()
                        if k in ("raw_model_score", "ensemble_agreement", "directional_score")))

    # shadow idempotency (both generations) + no fabricated records
    g1 = j(T105 / "shadow_observations/task105_shadow_observations.json")
    g2 = j(T106 / "shadow_observations/task106_shadow_observations.json")
    check("gen1_untouched_12", g1["n_observations"] == 12)
    check("gen2_unique_ids", len({o["decision_id"] for o in g2["observations"]}) == g2["n_observations"])
    check("no_fabricated_outcomes", all(o["realized_result"] is None for o in g2["observations"])
           and all(o["realized_outcome"] is None for o in g1["observations"]))
    mat = j(T106 / "_matured.json")["summary"]
    check("maturity_counts_consistent", mat["n"] == 34 and mat["matured"] == 12 and mat["pending_mtm"] == 24 and mat["unfilled"] == 22)

    # V2 cost parity (production fixtures)
    r = subprocess.run(["bun", "scripts/task105_parity.ts"], capture_output=True, text=True, cwd=ROOT, timeout=120)
    par = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 else {}
    check("v2_cost_parity", par.get("verdict") == "PASS", str(par)[:120])

    # data frontier + integrity
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    check("db_integrity_ok", db.execute("PRAGMA quick_check").fetchone()[0] == "ok")
    frontier = db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    check("frontier_2026_11_02", frontier == "2026-11-02", frontier)
    dup = db.execute("SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) c FROM OhlcvBar GROUP BY symbol,date HAVING c>1)").fetchone()[0]
    check("no_duplicate_symbol_date", dup == 0)

    # historical artifact immutability: Task 100-105 REPORTS must be untouched
    # (the Task 103 staging DB is an append-only OPERATIONAL ledger — new import
    # rows are its designed behavior, not a report modification)
    st = subprocess.run(["git", "status", "--porcelain",
                          "data/backtest_reports/task100", "data/backtest_reports/task101",
                          "data/backtest_reports/task102", "data/backtest_reports/task104",
                          "data/backtest_reports/task105",
                          "data/backtest_reports/task103/task103_final_summary.json",
                          "data/backtest_reports/task103/task103_forward_validation_status.json",
                          "db/custom.db.gz"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    check("historical_artifacts_unmodified", st == "", st[:200])
    stage_ok = subprocess.run(["git", "status", "--porcelain", "data/backtest_reports/task103/"],
                               capture_output=True, text=True, cwd=ROOT).stdout.strip().splitlines()
    OPERATIONAL = ("external_imports_staging.db", "import_manifests/")
    staging_only = all(any(op in l.split()[-1] for op in OPERATIONAL) for l in stage_ok)
    check("task103_changes_limited_to_operational_staging_ledger", staging_only, str(stage_ok)[:200])

    # Task 103 importer idempotency on the Task 106 drop file
    r = subprocess.run([sys.executable, "scripts/task103_import_data.py", "--type", "psx_eod",
                         "--file", "data/external_imports/psx_eod/task106_refresh.csv", "--mode", "import"],
                        capture_output=True, text=True, cwd=ROOT, timeout=140)
    check("importer_idempotent_same_sha", "already_imported" in (r.stdout or ""), (r.stdout or r.stderr)[-120:])

    (T106 / "task106_test_summary.json").write_text(json.dumps({
        "report": "task106_test_summary", "generated_at": L.NOW(),
        "python_checks": {"passed": PASS, "failed": FAIL, "runtime_seconds": round(time.time() - t0, 1)},
        "additional_suites": {},  # filled by the driver after build/api/browser
        "verdict": "PASS" if not FAIL else "FAIL"}, indent=1))
    print(f"\ntask106 QA: {PASS} passed, {len(FAIL)} failed")


if __name__ == "__main__":
    main()
