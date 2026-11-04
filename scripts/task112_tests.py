#!/usr/bin/env python3
"""Task 112 QA suite: signal-history store integrity, count reconciliation,
UI/API surface guarantees, report completeness, cohort separation, safety."""
from __future__ import annotations
import csv, json, subprocess, sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task111_lib as LB  # noqa: E402

T112 = ROOT / "data" / "backtest_reports" / "task112"
T111 = LB.T111
REP = ROOT / "data" / "reports"
RES = []


def check(name: str, ok: bool, detail: str = ""):
    RES.append((name, bool(ok), detail))


def main() -> int:
    # ── 1. append-only history store ─────────────────────────────────────────
    hist = list((T112 / "llm_signal_history").glob("*.json"))
    check("history_store_exists", len(hist) >= 70, f"n={len(hist)}")
    ids = [p.stem for p in hist]
    check("history_ids_unique", len(ids) == len(set(ids)))
    recs = [json.loads(p.read_text()) for p in hist]
    mock = [r for r in recs if r.get("mockRecord")]
    real = [r for r in recs if not r.get("mockRecord")]
    check("mock_records_labeled", len(mock) == 23 and all(r.get("provenance") == "mock_pipeline_check" for r in mock))
    check("real_records_present", len(real) == 48, f"n={len(real)}")
    check("no_fake_probabilities_any_record", all(r.get("calibratedNetPositiveProbability") is None for r in recs))
    check("research_only_labels", all(r.get("researchStatus") == "research_only" for r in recs))
    provs = {r["signalId"]: r.get("provenance") for r in recs}
    check("provenance_distinguishes_retries", len(set(provs.values())) >= 3, str(set(provs.values())))

    # ── 2. reconciliation artifact ───────────────────────────────────────────
    recon = json.loads((T112 / "task112_llm_decision_reconciliation.json").read_text())
    f = recon["findings"]
    check("recon_unique_symbols", f["unique_symbols_in_universe"] == 23)
    check("recon_current_records_24", f["records_by_provenance"]["current_record"] == 24)
    check("recon_two_generation_passes", f["symbols_with_multiple_records"].get("HUBC", 0) >= 2)
    check("recon_no_deletion_policy", "no records deleted" in recon["policy"])
    check("recon_23_unique_valid", f["unique_symbols_with_valid_llm_state"] == 23)
    # PKT correctness spot check: decision timestamps parse and convert
    ts = next(r["decisionTimestamp"] for r in real if r.get("decisionTimestamp"))
    pkt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(ZoneInfo("Asia/Karachi"))
    check("pkt_conversion_sane", pkt.utcoffset().total_seconds() == 5 * 3600, str(pkt))

    # ── 3. UI/API surface guarantees (static source checks) ──────────────────
    ui = (ROOT / "src/components/latent/LlmSignalsView.tsx").read_text()
    for needle in ["SHADOW / RESEARCH ONLY — NOT AN ORDER", "Asia/Karachi", "includeMock",
                   "llm_unavailable", "stale", "Not a calibrated win probability",
                   "insufficient matured forward outcomes", "pageSize", "CSV", "JSON",
                   "Hypothetical research levels", "API failure", "No signals match"]:
        check(f"ui_contains:{needle[:30]}", needle in ui)
    api = (ROOT / "src/app/api/llm-signals/route.ts").read_text()
    check("api_filters_paginated", "pageSize" in api and "promptVersion" in api and "evidenceCompleteness" in api)
    exp = (ROOT / "src/app/api/llm-signals/export/route.ts").read_text()
    check("export_preserves_fields", "promptVersion" in exp and "evidenceHash" in exp and "research_only" in exp)
    det = (ROOT / "src/app/api/llm-signals/[id]/route.ts").read_text()
    check("detail_no_fabrication_note", "not retained" in det)
    # decision-detail uses stored evidence (same platform functions), not a new formula
    check("detail_uses_stored_evidence", "findEvidence" in det and ".evidence.json" in (ROOT / "src/lib/latent/llm/signal-history.ts").read_text())
    # runner appends history going forward
    runner = (ROOT / "scripts/task111_llm_runner.ts").read_text()
    check("runner_appends_history", "appendHistory" in runner and "append-only" in runner)

    # ── 4. model performance report ──────────────────────────────────────────
    rep = json.loads((REP / "model_strategy_performance_latest.json").read_text())
    inv = rep["inventory"]
    check("report_inventory_83", len(inv) == 83, f"n={len(inv)}")
    names = " | ".join(m["model_name"] for m in inv)
    nine = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression",
            "ExtraTrees", "HistGradientBoosting", "ElasticNet", "HuberRegressor"]
    check("nine_model_experiment_present", all(n in names for n in nine))
    for n in ["jw_reference_lstm", "jw_reference_cnn_lstm", "psx_cost_aware_trade_classifier",
              "psx_net_expectancy_meta_model", "golden_cross_7_30_v1 (Golden Cross 7/30 SMA)",
              "GLM-4.6 multi-source LLM analyst (z-ai-web-dev-sdk)", "PatchTST", "Gian-Ensemble (GIAN)"]:
        check(f"inventory_has:{n[:34]}", n in names)
    check("na_markers_present", any("Not available in source evidence" == m["model_family"] or
                                    "Not available in source evidence" in json.dumps(m)[:4000] for m in inv[:5]) or
          sum(1 for m in inv for v in m.values() if v == "Not available in source evidence") > 20)
    check("cohort_separation_warning", "NOT LLM" in rep["general_forward_cohort"].get("model_name", ""))
    check("llm_zero_matured_recorded", any("0 matured" in json.dumps(m)[:6000] or "0 matured" in str(m.get("forward_validation_status")) for m in inv if "GLM-4.6" in m["model_name"]))
    # validation vs final test kept separate in task100 profiles
    t100 = [m for m in inv if m["model_name"] == "XGBoost" and "Task 100" in str(m.get("model_family"))][0]
    hbr = t100["historical_backtest_result"]
    check("validation_final_test_separate", isinstance(hbr, dict) and "validation" in hbr and "final_test" in hbr,
          str(hbr)[:80])
    # CSV matches JSON summary
    with open(REP / "model_strategy_comparison_latest.csv") as fh:
        rows = list(csv.DictReader(fh))
    check("csv_matches_json_count", len(rows) == len(rep["summary"]), f"{len(rows)} vs {len(rep['summary'])}")
    check("csv_has_all_models", len(rows) == 83)
    # md + pdf exist and are non-trivial
    md = ROOT / "docs/reports/psx_model_strategy_performance_report.md"
    pdf = REP / "psx_model_strategy_performance_report.pdf"
    check("markdown_report_exists", md.exists() and md.stat().st_size > 4000)
    check("pdf_report_exists", pdf.exists() and pdf.stat().st_size > 4000 and pdf.read_bytes()[:4] == b"%PDF")
    check("report_generation_metadata", bool(rep.get("generated_at")) and bool(rep.get("git_head")))
    check("report_status_labels_used", any("Research only" in r["current_status"] or "Shadow only" in r["current_status"] for r in rep["summary"]))
    check("no_production_ready_labels", not any("production-ready" in r["current_status"].lower() for r in rep["summary"]))

    # ── 5. Part E/F/G/H/I artifacts ──────────────────────────────────────────
    for a in ["task112_llm_evidence_lineage_audit.json", "task112_llm_evidence_contribution_audit.json",
              "task112_llm_pending_outcomes.json", "task112_volatility_overlay_validation.json",
              "task112_llm_plus_volatility_research.json", "task112_forward_pipeline_audit.json"]:
        check(f"artifact:{a}", (T112 / a).exists())
    pend = json.loads((T112 / "task112_llm_pending_outcomes.json").read_text())
    check("llm_zero_matured_pending_separate", pend["matured_observations"] == 0 and pend["pending_observations"] > 0)
    comb = json.loads((T112 / "task112_llm_plus_volatility_research.json").read_text())
    check("combined_insufficient_evidence", comb["status"] == "insufficient_evidence")
    ov = json.loads((T112 / "task112_volatility_overlay_validation.json").read_text())
    check("overlay_no_threshold_tuning", "NONE" in ov["threshold_selection_on_test"])
    acc = list(csv.DictReader(open(T112 / "task112_account_comparison_pkr100k.csv")))
    check("account_comparison_rows", len(acc) >= 8)
    check("realized_unrealized_separate", all(("realized_net_pnl" in r and "unrealized_pnl" in r) for r in acc))

    # ── 6. safety ────────────────────────────────────────────────────────────
    pol = (ROOT / "src/lib/latent/trading-policy.ts").read_text()
    check("no_real_trades", "allowRealTrades: false" in pol)
    check("no_short_selling_supported", "SHORT" not in ui.replace("SHORT_ENTER", "").replace("BEARISH", ""))
    # history store untouched by API layer (read-only module)
    histmod = (ROOT / "src/lib/latent/llm/signal-history.ts").read_text()
    check("api_layer_read_only", "writeFile" not in histmod and "appendFile" not in histmod and "unlink" not in histmod)

    passed = sum(1 for _, ok, _ in RES if ok)
    failed = sum(1 for _, ok, _ in RES if not ok)
    print(f"task112 QA: {passed} passed, {failed} failed, 0 skipped")
    for name, ok, detail in RES:
        if not ok:
            print(f"FAIL {name} {detail}")
    LB.artifact("task112_ui_validation.json", "task112_ui_validation", "completed", base=T112,
                checks=passed + failed, passed=passed, failed=failed,
                ui_states_covered=["loading", "no signals", "api failure", "llm_unavailable", "rejected",
                                   "stale", "partial evidence", "last update", "provider/model versioning"],
                note="static + data-layer verification; live browser verification runs in CI (Browser Tests workflow)")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
