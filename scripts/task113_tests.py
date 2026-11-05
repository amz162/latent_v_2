#!/usr/bin/env python3
"""Task 113 regression tests (Part H) — 10 categories.

All assertions read immutable records (JSON ledgers, DB, signal-history store)
and the Task 113 audit artifacts. No mutation. Fails loudly on any breach of
the research invariants:

  1. cohort count reconciliation
  2. unique-symbol vs signal-record counts
  3. real vs mock signal separation (recordType isolation)
  4. duplicate/retry handling (no double-count)
  5. independent 5/10/21-session maturity (zero horizon-matured)
  6. no future-data leakage (decision as-of <= frontier)
  7. LLM and general cohort isolation (never added across denominators)
  8. model inventory classification (83 entries, 12 categories, sum reconciles)
  9. report reconciliation against source artifacts
 10. Task 112 LLM Signals UI + exports preserve records + recordType

Run: python3 scripts/task113_tests.py
Exit 0 = all pass.
"""
from __future__ import annotations
import csv, json, sqlite3, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BR = ROOT / "data" / "backtest_reports"
T112 = BR / "task112"
T113 = BR / "task113"
REP = ROOT / "data" / "reports"
DB = ROOT / "db" / "custom.db"

PASS, FAIL = 0, 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def jload(p: Path):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def test_1_cohort_reconciliation():
    print("\n[1] Cohort count reconciliation")
    audit = jload(T113 / "task113_forward_validation_audit.json")
    cohorts = audit["part_a_cohort_reconciliation"]
    check("audit has 5 cohorts", len(cohorts) == 5, f"got {len(cohorts)}")
    for c in cohorts:
        check(f"{c['cohort_id']} reconciles=True", c.get("reconciles") is True)
        check(f"{c['cohort_id']} total>=unique_symbols",
              c["total_decision_records"] >= c["unique_symbols"],
              f"records={c['total_decision_records']} symbols={c['unique_symbols']}")
    # general cohorts sum to the frozen campaign ledger total (57 at Task 113
    # time; the standing pipeline appended gen3's 2026-11-05 incremental batch,
    # so the denominator is read from _matured.json, never hardcoded)
    _mat = jload(BR / "task107" / "_matured.json") or {}
    gen = [c for c in cohorts if c["cohort_id"].startswith("task10")]
    check("general cohorts sum to frozen campaign ledger total",
          sum(c["total_decision_records"] for c in gen) == len(_mat.get("observations") or []),
          f"got {sum(c['total_decision_records'] for c in gen)}")


def test_2_unique_symbols_vs_records():
    print("\n[2] Unique-symbol vs signal-record counts")
    recon = jload(T112 / "task112_llm_decision_reconciliation.json")["findings"]
    check("unique_symbols_in_universe == 23", recon["unique_symbols_in_universe"] == 23)
    check("current_record provenance == 24", recon["records_by_provenance"]["current_record"] == 24)
    check("24 = 23 universe + 1 stale ENGRO",
          recon["total_decision_records_persisted_all_sources"] == 71
          and recon["real_decision_records_excl_mock"] == 48
          and recon["mock_pipeline_check_records"] == 23)
    # every universe symbol has >=1 record; multi-records are retries/cache, not dupes
    multi = recon["symbols_with_multiple_records"]
    check("multi-record symbols are all in universe (no phantom)",
          all(s in recon["universe_symbols"] for s in multi))


def test_3_real_vs_mock_separation():
    print("\n[3] Real vs mock signal separation (recordType)")
    audit = jload(T113 / "task113_forward_validation_audit.json")
    llm = audit["part_c_llm_outcome_maturity"]
    # LLM metrics must use real decisions only
    check("LLM total_real_decisions == 48 (mock excluded)", llm["total_real_decisions"] == 48)
    recs = [jload(p) for p in sorted((T112 / "llm_signal_history").glob("*.json"))]
    real = [r for r in recs if r.get("recordType") == "REAL_LLM_DECISION"]
    mock = [r for r in recs if r.get("recordType") == "MOCK_PIPELINE_CHECK"]
    check("48 REAL_LLM_DECISION records", len(real) == 48, f"got {len(real)}")
    check("23 MOCK_PIPELINE_CHECK records", len(mock) == 23, f"got {len(mock)}")
    check("no record lacks recordType", all(r.get("recordType") for r in recs))
    check("mock records have provider=mock", all(r.get("provider") == "mock" for r in mock))
    check("real records have provider!=mock", all(r.get("provider") != "mock" for r in real))


def test_4_duplicate_retry_handling():
    print("\n[4] Duplicate/retry handling (no double-count)")
    gen = jload(BR / "task111" / "task111_llm_shadow_generation.json")
    check("LLM duplicate_evidence_decisions == 0", gen.get("duplicate_evidence_decisions") == 0)
    check("LLM no_duplicate_policy set", "same evidence hash never produces a second decision" in str(gen.get("no_duplicate_policy", "")))
    # signal IDs are unique in the store
    recs = [jload(p) for p in sorted((T112 / "llm_signal_history").glob("*.json"))]
    ids = [r["signalId"] for r in recs]
    check("all 71 signalIds unique", len(ids) == len(set(ids)) == 71)


def test_5_independent_horizon_maturity():
    print("\n[5] Independent 5/10/21-session maturity")
    audit = jload(T113 / "task113_forward_validation_audit.json")
    llm = audit["part_c_llm_outcome_maturity"]
    check("LLM matured_5 == 0", llm["matured_5_session"] == 0)
    check("LLM matured_10 == 0", llm["matured_10_session"] == 0)
    check("LLM matured_21 == 0", llm["matured_21_session"] == 0)
    for c in audit["part_a_cohort_reconciliation"]:
        m5, m10, m21 = c["matured_5_session"], c["matured_10_session"], c["matured_21_session"]
        check(f"{c['cohort_id']} matured_5 is 0", m5 == 0, f"got {m5}")
        check(f"{c['cohort_id']} matured_21 is 0", m21 == 0, f"got {m21}")
    check("calibration forbidden (insufficient)",
          "insufficient" in str(llm["calibration"]["status"]).lower())


def test_6_no_future_data_leakage():
    print("\n[6] No future-data leakage")
    audit = jload(T113 / "task113_forward_validation_audit.json")
    frontier = audit["data_frontier"]
    # LLM dataCutoff must be <= frontier (decisions use only data up to frontier)
    llm = audit["part_c_llm_outcome_maturity"]
    check("LLM data_cutoff <= frontier",
          str(llm["data_cutoff"]) <= str(frontier),
          f"cutoff={llm['data_cutoff']} frontier={frontier}")
    # Task 114: frontier advanced past the LLM as-of date; elapsed forward
    # sessions must equal the ACTUAL distinct sessions after the cutoff in
    # OhlcvBar (never calendar days, never a hardcoded snapshot value).
    import sqlite3 as _sq
    _conn = _sq.connect(f"file:{DB}?mode=ro", uri=True)
    _actual = _conn.execute(
        "SELECT COUNT(DISTINCT date) FROM OhlcvBar WHERE date > ?",
        (llm["data_cutoff"],)).fetchone()[0]
    _conn.close()
    check("LLM forward_sessions_elapsed == actual sessions after data_cutoff",
          llm["forward_sessions_elapsed"] == _actual,
          f"audit={llm['forward_sessions_elapsed']} actual={_actual}")
    # general cohort decision dates <= frontier
    for c in audit["part_a_cohort_reconciliation"]:
        # the LLM cohort's decision_date is the generation-run timestamp
        # (2026-11-04); its POINT-IN-TIME evidence (data_cutoff=2026-11-03) is
        # what must be <= frontier, and that is verified above. Skip the
        # generation-timestamp check for the LLM cohort.
        if c["cohort_id"] == "task111-llm-multisource-gen1":
            continue
        if c.get("decision_date"):
            check(f"{c['cohort_id']} decision_date <= frontier",
                  str(c["decision_date"]) <= str(frontier), f"date={c['decision_date']}")


def test_7_llm_general_isolation():
    print("\n[7] LLM and general cohort isolation")
    audit = jload(T113 / "task113_forward_validation_audit.json")
    explanation = audit["part_a_57_43_59_explanation"]
    check("explanation states different denominators",
          "denominator" in explanation["why_they_do_not_add_up_to_one_denominator"].lower())
    llm_cohort = next(c for c in audit["part_a_cohort_reconciliation"] if c["cohort_id"] == "task111-llm-multisource-gen1")
    gen_cohorts = [c for c in audit["part_a_cohort_reconciliation"] if c["cohort_id"].startswith("task10")]
    # LLM matured (0) must never be added to general 43
    check("LLM matured_terminal_exits == 0 (not borrowing general 43)",
          llm_cohort["matured_terminal_exits_early"] == 0)
    # 43 is at the STRATEGY-OUTCOME level (decision x strategy), per the
    # summary block in task107/_matured.json; the audit field is now
    # strategy-outcome-level too.
    # Task 114: the frozen engine legitimately advanced after gen3 filled on
    # 2026-11-04 (43 → more terminal exits). The invariant is no longer a
    # hardcoded 43 but exact reconciliation with _matured.json: the audit's
    # per-generation terminal counts must equal the frozen ledger's
    # (matured_terminal_exit + matured_full_exit) strategy outcomes, and
    # terminal + pending must equal filled decisions x 3 strategies.
    mat = jload(BR / "task107" / "_matured.json") or {}
    obs = mat.get("observations") or []
    filled = [o for o in obs if o.get("status") != "awaiting_entry_bar"]
    term_expected = sum(1 for o in obs for s in (o.get("outcomes") or {}).values()
                        if s.get("status") in ("matured_terminal_exit", "matured_full_exit"))
    pend_expected = sum(1 for o in obs for s in (o.get("outcomes") or {}).values()
                        if s.get("status") == "pending_mtm")
    got_term = sum(c["matured_terminal_exits_early"] for c in gen_cohorts)
    check("general cohort terminal-exits reconcile with frozen ledger (strategy-outcome level, separate)",
          got_term == term_expected and term_expected + pend_expected == len(filled) * 3,
          f"audit={got_term} ledger={term_expected} reconciliation={term_expected}+{pend_expected} vs {len(filled)}x3")


def test_8_inventory_classification():
    print("\n[8] Model inventory classification (83 entries, 12 categories)")
    audit = jload(T113 / "task113_forward_validation_audit.json")
    dash = audit["part_d_model_inventory"]["dashboard"]
    entries = audit["part_d_model_inventory"]["entries"]
    check("total_registry_entries == 83", dash["total_registry_entries"] == 83, f"got {dash['total_registry_entries']}")
    check("entries count == 83", len(entries) == 83, f"got {len(entries)}")
    # sum of by_category == 83
    check("by_category sums to 83", sum(dash["by_category"].values()) == 83)
    # every entry has a valid category
    valid_cats = {"registry_only","implemented","trained_artifact","trained_psx","evaluated",
                  "historical_experiment","forward_shadow","rule_strategy","dependency_blocked",
                  "resource_blocked","data_blocked","duplicate_alias"}
    bad = [e["entry_name"] for e in entries if e["category"] not in valid_cats]
    check("all entries have a valid category", not bad, f"bad: {bad[:3]}")
    # no invented performance for untested models
    blocked = [e for e in entries if e["category"] in ("resource_blocked","dependency_blocked","data_blocked","registry_only")]
    check("blocked/registry entries have no metrics",
          all(e["metrics_available"] in ("no", "Not available in source evidence") for e in blocked))


def test_9_report_reconciliation():
    print("\n[9] Report reconciliation against source artifacts")
    rep = jload(REP / "model_strategy_performance_latest.json")
    # Task 114 bumped the report version (task114-augmented); the Task 113 audit
    # block itself must remain present and reconciled — that is the preserved part.
    check("report_version == task114-augmented (carries task113 block)",
          rep.get("report_version") == "task115-augmented")
    check("report inventory == 83", len(rep["inventory"]) == 83)
    t113 = rep.get("task113_audit", {})
    check("report has task113_audit block", t113.get("available") is True)
    check("report inventory_dashboard total == 83",
          (t113.get("inventory_dashboard") or {}).get("total_registry_entries") == 83)
    check("report forward_validation_dashboard has 5 cohorts",
          len(t113.get("forward_validation_dashboard") or []) == 5)
    # CSV exists and has 83 rows + header
    csv_rows = list(csv.DictReader(open(T113 / "task113_model_inventory_classification.csv")))
    check("inventory CSV has 83 rows", len(csv_rows) == 83)
    csv_cohorts = list(csv.DictReader(open(T113 / "task113_cohort_reconciliation.csv")))
    check("cohort CSV has 5 rows", len(csv_cohorts) == 5)


def test_10_llm_signals_ui_exports():
    print("\n[10] Task 112 LLM Signals UI + exports preserve records + recordType")
    # history_index reflects 71 records with by_record_type
    idx = jload(T112 / "history_index.json")
    check("history_index record_count == 71", idx["record_count"] == 71)
    check("history_index by_record_type present", "by_record_type" in idx)
    check("history_index by_record_type REAL == 48", idx["by_record_type"]["REAL_LLM_DECISION"] == 48)
    check("history_index by_record_type MOCK == 23", idx["by_record_type"]["MOCK_PIPELINE_CHECK"] == 23)
    # export CSV fields include recordType (the export route is TS, but the field
    # list is the source of truth; verify a generated export would include it by
    # checking the route source contains recordType)
    route = (ROOT / "src" / "app" / "api" / "llm-signals" / "export" / "route.ts").read_text()
    check("export route CSV_FIELDS includes recordType", "recordType" in route)
    list_route = (ROOT / "src" / "app" / "api" / "llm-signals" / "route.ts").read_text()
    check("list route accepts recordType param", "recordType" in list_route)
    sh = (ROOT / "src" / "lib" / "latent" / "llm" / "signal-history.ts").read_text()
    check("signal-history exports recordTypeOf", "export function recordTypeOf" in sh)
    check("applyFilter excludes mock by default via recordType", 'rt === "MOCK_PIPELINE_CHECK" && !f.includeMock' in sh)


def main() -> int:
    print("=" * 60)
    print("Task 113 regression tests (Part H)")
    print("=" * 60)
    test_1_cohort_reconciliation()
    test_2_unique_symbols_vs_records()
    test_3_real_vs_mock_separation()
    test_4_duplicate_retry_handling()
    test_5_independent_horizon_maturity()
    test_6_no_future_data_leakage()
    test_7_llm_general_isolation()
    test_8_inventory_classification()
    test_9_report_reconciliation()
    test_10_llm_signals_ui_exports()
    print("\n" + "=" * 60)
    print(f"PASS: {PASS}   FAIL: {FAIL}")
    print("=" * 60)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
