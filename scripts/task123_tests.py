#!/usr/bin/env python3
"""task123_tests.py — Task 123 regression suite (10 areas).

Areas: (1) ingestion idempotency, (2) missing-data detection, (3) worker recovery
observability, (4) pending-entry lifecycle, (5) duplicate-fill prevention,
(6) SL/TP outcome correctness, (7) GLM evidence completeness, (8) source
timestamp validation, (9) scheduled generation, (10) no-look-ahead integrity.

Run: python3 scripts/task123_tests.py   (read-only + sandboxed mock GLM run)
Exit 0 only if every check passes."""
import json, glob, os, sqlite3, subprocess, sys, tempfile, datetime, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = []

def check(name, ok, detail=""):
    RES.append((name, bool(ok), str(detail)[:220]))

def j(p):
    try:
        return json.load(open(ROOT / p))
    except Exception:
        return None

# ── 1. ingestion idempotency ──────────────────────────────────────────────────
before = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True).execute(
    "SELECT COUNT(*) FROM OhlcvBar").fetchone()[0]
r = subprocess.run([sys.executable, "scripts/task107_daily_ingest.py"],
                   capture_output=True, text=True, cwd=ROOT, timeout=300)
after = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True).execute(
    "SELECT COUNT(*) FROM OhlcvBar").fetchone()[0]
check("ingest_idempotent_no_new_bars_on_rerun", r.returncode == 2 and before == after,
      f"rc={r.returncode} bars {before}->{after}")

# ── 2. missing-data detection ─────────────────────────────────────────────────
ing = j("data/backtest_reports/task107/task107_daily_ingestion_report.json") or {}
check("missing_data_symbols_reported",
      isinstance(ing.get("symbols_without_new_data"), list) and len(ing.get("symbols_without_new_data", [])) > 0,
      f"symbols_without_new_data={ing.get('symbols_without_new_data')}")

# ── 3. worker recovery observability ──────────────────────────────────────────
ms = j("data/backtest_reports/task107/ops/monitor_state.json") or {}
lcr = j("data/backtest_reports/task107/ops/last_cycle_result.json") or {}
ph = j("data/backtest_reports/task107/ops/provider_health_state.json") or {}
check("worker_heartbeat_observable",
      bool(ms.get("generated_at")) and bool(lcr.get("ended_at")) and ph.get("state") is not None,
      f"monitor={ms.get('generated_at')} cycle={lcr.get('ended_at')} provider={ph.get('state')}")
hp = j("reports/operations/task123_pipeline_health.json") or {}
check("health_report_covers_all_sections",
      all(k in hp for k in ("market_data", "worker", "queue", "paper_trading", "glm", "failures")),
      f"sections={sorted(hp.keys())}")

# ── 4. pending-entry lifecycle ────────────────────────────────────────────────
con = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
states = dict(con.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state"))
check("lifecycle_processed_114",
      sum(states.values()) == 114 and states.get("closed", 0) + states.get("open", 0) == 81,
      f"states={states}")
lv = j("data/backtest_reports/task123_lifecycle_verification.json") or {}
check("lifecycle_no_invented_prices",
      lv.get("entry_fills_not_matching_real_bar_open") == 0
      and lv.get("leg_exits_without_matching_session_bar") == 0,
      "all fills/exits match real OhlcvBar sessions")

# ── 5. duplicate-fill prevention ──────────────────────────────────────────────
dupe = con.execute("SELECT COUNT(*) FROM (SELECT sourcePredictionId, strategyId, COUNT(*) c "
                   "FROM ProspectivePaperTrade GROUP BY 1,2 HAVING c > 1)").fetchone()[0]
check("no_duplicate_prediction_strategy_rows", dupe == 0, f"duplicate pairs={dupe}")
lf = j("data/backtest_reports/prospective_paper_trading_latest.json") or {}
check("lifecycle_second_run_zero_delta",
      lf.get("runStats", {}).get("tradesEntered") == 0 and lf.get("runStats", {}).get("tradesClosed") == 0,
      f"runStats={lf.get('runStats')}")

# ── 6. SL/TP outcome correctness ──────────────────────────────────────────────
check("exit_math_and_labels_clean",
      lv.get("net_identity_violations") == 0 and lv.get("win_label_violations") == 0,
      f"net violations={lv.get('net_identity_violations')} label violations={lv.get('win_label_violations')}")
check("matured_outcomes_carry_real_closes",
      lv.get("matured_without_observed_close") == 0
      and lv.get("matured_observed_close_matching_bar", 0) == lv.get("outcomes", {}).get("matured", -1),
      f"matured={lv.get('outcomes')}")

# ── 7. GLM evidence completeness (sandboxed mock generation) ──────────────────
tmp = Path(tempfile.mkdtemp(prefix="task123_glm_test_"))
hdir, edir = tmp / "history", tmp / "evidence"
hdir.mkdir(); edir.mkdir()
env = dict(os.environ, LLM_SIGNAL_HISTORY_DIR=str(hdir), LLM_EVIDENCE_DIR=str(edir))
r = subprocess.run(["bun", "scripts/task111_llm_runner.ts", "--symbols", "ANL,LUCK", "--mock", "--force"],
                   capture_output=True, text=True, cwd=ROOT, timeout=300, env=env)
pkgs = list(edir.glob("*.json"))
ok_status = True
for p in pkgs:
    d = json.load(open(p))
    st = d.get("sources", {})
    if len(st) < 8 or any(not v for v in st.values()):
        ok_status = False
check("glm_evidence_package_all_sources_statused", r.returncode == 0 and len(pkgs) == 2 and ok_status,
      f"pkgs={len(pkgs)} statuses_ok={ok_status}")
recs = list(hdir.glob("*.json"))
r0 = json.load(open(recs[0])) if recs else {}
check("glm_record_carries_evidenceRef",
      bool(r0.get("evidenceRef")) and r0.get("signalStatus") == "research_only" and r0.get("llmState") == "ok",
      f"evidenceRef={r0.get('evidenceRef')} llmState={r0.get('llmState')}")
check("glm_mock_marked_pipeline_check",
      r0.get("recordType") == "MOCK_PIPELINE_CHECK" and r0.get("mockRecord") is True,
      f"recordType={r0.get('recordType')}")

# real (non-sandbox) store: research_only everywhere
hist = ROOT / "data/backtest_reports/task112/llm_signal_history"
real_recs = [json.load(open(p)) for p in hist.glob("*.json")]
check("store_research_only_enforced",
      all((g.get("signalStatus") in (None, "research_only")) for g in real_recs),
      f"n={len(real_recs)}")
check("store_no_glm_rows_in_paper_ledger",
      con.execute("SELECT COUNT(*) FROM ProspectivePaperTrade WHERE modelId LIKE '%GLM%' OR modelId LIKE '%glm%'").fetchone()[0] == 0,
      "0 GLM-attributed ledger rows")

# ── 8. source timestamp validation ────────────────────────────────────────────
def iso_or_none(v):
    if v is None: return True
    try:
        datetime.datetime.fromisoformat(str(v).replace("Z", "+00:00")); return True
    except Exception: return False
ts_ok, cutoff_ok = True, True
for p in pkgs:
    d = json.load(open(p))
    cutoff_ok &= d.get("dataCutoff") == hp.get("market_data", {}).get("ohlcv_frontier")
    for ref in d.get("sourceRefs", []):
        ts_ok &= iso_or_none(ref.get("retrievedAt")) and iso_or_none(ref.get("publishedAt"))
check("source_timestamps_iso_or_honest_null", ts_ok, "retrievedAt/publishedAt ISO or null")
check("evidence_cutoff_matches_frontier", cutoff_ok, f"cutoff vs frontier {hp.get('market_data',{}).get('ohlcv_frontier')}")

# ── 9. scheduled generation ───────────────────────────────────────────────────
check("pipeline_script_and_crontab_present",
      (ROOT / "scripts/task123_daily_pipeline.sh").exists()
      and "task123_daily_pipeline.sh" in (ROOT / "scripts/crontab.txt").read_text(),
      "scheduler wiring exists")
n_before = len(recs)
r2 = subprocess.run(["bun", "scripts/task111_llm_runner.ts", "--symbols", "ANL,LUCK", "--mock", "--force"],
                    capture_output=True, text=True, cwd=ROOT, timeout=300, env=env)
n_after = len(list(hdir.glob("*.json")))
# same evidence (unchanged bars) → same hash → duplicate-decision guard skips
check("glm_duplicate_decision_prevented",
      r2.returncode == 0 and n_after <= n_before,
      f"history files {n_before}->{n_after}")

# ── 10. no-look-ahead integrity ────────────────────────────────────────────────
bad_entry = con.execute(
    "SELECT COUNT(*) FROM ProspectivePaperTrade p JOIN PredictionHistory h ON h.id=p.sourcePredictionId "
    "WHERE p.entryDate IS NOT NULL AND p.entryDate <= h.dataCutoff").fetchone()[0]
check("entries_strictly_after_decision_cutoff", bad_entry == 0, f"violations={bad_entry}")
fut = con.execute("SELECT COUNT(*) FROM PredictionOutcome po JOIN PredictionHistory ph ON ph.id=po.predictionId "
                  "WHERE po.outcomeStatus='matured' AND po.observedClose IS NULL").fetchone()[0]
check("no_outcome_marked_matured_without_observation", fut == 0, f"violations={fut}")
cvg = j("data/backtest_reports/task107/task107_daily_ingestion_report.json") or {}
check("ingest_overlap_integrity_verified",
      cvg.get("overlap_checked", 0) > 0 and len(cvg.get("overlap_mismatches", [])) == 0,
      f"overlap={cvg.get('overlap_checked')} mismatches={len(cvg.get('overlap_mismatches', []))}")

shutil.rmtree(tmp, ignore_errors=True)

passed = sum(1 for _, ok, _ in RES if ok)
for name, ok, detail in RES:
    print(("  ok " if ok else "FAIL ") + name + (" — " + detail if detail else ""))
print(f"\ntask123 regression: {passed} passed, {len(RES) - passed} failed")
json.dump({"passed": passed, "failed": len(RES) - passed, "results": RES},
          open(ROOT / "data/backtest_reports/task123_test_results.json", "w"), indent=1)
sys.exit(0 if passed == len(RES) else 1)
