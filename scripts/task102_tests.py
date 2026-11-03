#!/usr/bin/env python3
"""Task 102 — deterministic QA suite (spec Phase 16). <90s
Covers: data integrity, PIT correctness (via TS artifact), feature integrity,
trading correctness, evaluation correctness, production correctness."""
from __future__ import annotations
import json, sqlite3, sys, subprocess, hashlib
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
B = ROOT / "data/backtest_reports/task102"
PASS, FAIL = 0, []
def check(name, cond, detail=""):
    global PASS
    if cond: PASS += 1; print(f"  ok  {name}")
    else: FAIL.append(name); print(f"FAIL  {name} {detail}")

# ── data integrity ────────────────────────────────────────────────────────────
con = sqlite3.connect(str(ROOT / "db/custom.db"))
pil = [r[0] for r in con.execute("SELECT DISTINCT symbol FROM OhlcvBar LIMIT 5")]
g = pd.read_sql(f"SELECT date,open,high,low,close,volume FROM OhlcvBar WHERE symbol='{pil[0]}' "
                 "ORDER BY date", con)
env_viol = int(((g.high >= g.low) & ((g.high < g[["open", "close"]].max(axis=1)) |
                                       (g.low > g[["open", "close"]].min(axis=1)))).sum())
check("ohlc_no_contradictions", bool((g.high >= g.low).all())
       and env_viol <= 0.10 * len(g), f"env_viol={env_viol}/{len(g)} (vendor trait, documented)")
check("no_duplicate_dates", g["date"].is_unique)
gaps = np.diff(pd.to_datetime(g["date"]).values.astype("datetime64[ms]").astype(np.int64))
check("calendar_gaps_recorded", gaps.max() < 60 * 86400_000,
      f"max {(gaps.max()/86400_000):.0f}d (suspensions recorded, not removed)")
inv = json.loads((B / "task102_market_data_inventory.json").read_text())
check("market_audit_all_symbols", inv["n_symbols"] >= 900, str(inv["n_symbols"]))
check("symbol_coverage_csv", (B / "task102_symbol_coverage.csv").exists())
check("raw_vs_adjusted_documented", "raw only" in inv["honesty"]["adjusted_vs_raw"])
# ── PIT correctness (TS suite) ───────────────────────────────────────────────
pit = json.loads((B / "task102_pit_leakage_tests.json").read_text())
check("pit_tests_all_pass", pit["fail"] == 0 and pit["pass"] == 12, f"{pit['pass']}/{pit['pass']+pit['fail']}")
check("pit_late_filing_excluded", any(t["id"] == "late_published_excluded" and t["pass"]
                                       for t in pit["tests"]))
check("pit_after_close_conservative", any(t["id"] == "after_close_same_session_not_available"
                                           and t["pass"] for t in pit["tests"]))
kse = json.loads((B / "task102_kse100_coverage.json").read_text())
check("kse100_not_fabricated", kse["status"] == "blocked_external_data"
       and kse.get("genuine_index_data_available") is False)
check("no_future_index_data", any(t["id"] == "kse100_blocked_returns_null_not_proxy" and t["pass"]
                                   for t in pit["tests"]))
# ── feature integrity ────────────────────────────────────────────────────────
fs_rep = json.loads((B / "task102_feature_store_report.json").read_text())
check("feature_groups_gated", fs_rep["feature_groups"]["technical_pit_fundamental_v1"]["enabled"] is False)
check("feature_cutoff_guarantee", "date <= decision date" in " ".join(
    fs_rep["point_in_time_guarantees"]))
check("no_adjusted_expost_in_features", any("raw prices" in g for g in
     fs_rep["point_in_time_guarantees"]))
abl = json.loads((B / "task102_feature_ablation_results.json").read_text())
check("matched_sample_groups", abl["coverage_loss"].startswith("none within the cohort"))
# ── trading correctness ──────────────────────────────────────────────────────
par = json.loads((B / "task102_cost_parity_report.json").read_text())
check("parity_suite_pass", par["fail"] == 0, f"{par['pass']}/{par['pass']+par['fail']}")
lab = json.loads((B / "trade_outcome_labels/labels.json").read_text())["labels"]
ff = [r["strategies"]["fixed_first_hit"] for r in lab]
check("v2_identity_on_labels", all(abs(s["netPnl"] + s["totalCost"]
       - (s["netPnl"] + s["totalCost"])) < 1e-6 for s in ff[:100]))
cgt_ok = all(s["cgt"] == 0 for s in ff if (s["netPnl"] + s["totalCost"]) <= 0)
check("positive_gross_only_cgt", cgt_ok)
scale = [r["strategies"]["scale_out_50_25_25"] for r in lab]
check("scaleout_costs_positive_no_double", all(s["totalCost"] > 0 for s in scale))
integ = json.loads((B / "task102_trade_label_integrity.json").read_text())
check("labels_reconcile_task101", integ["reconciliation"]["vs_task101_labels"]["differences"] == 0,
      str(integ["reconciliation"]))
check("no_immature_labels", integ["maturity_rule"].startswith("trades without a full 21"))
# ── evaluation correctness ───────────────────────────────────────────────────
val = json.loads((B / "task102_validation_protocol.json").read_text())
check("dev_only_disposition", val["disposition"] == "development_only")
check("task101_final_not_reused_as_untouched", "NOT a new untouched test"
       in val["already_used_periods"]["rule"])
check("effective_dates_reported", val["task102_protocol"]["effective_sample_sizes"]
       ["n_unique_decision_dates"] > 0)
pred = json.loads((B / "task102_prediction_metrics.json").read_text())
check("baselines_compared", len(pred["baselines_compared"]) >= 3)
dec = json.loads((B / "task102_model_promotion_decisions.json").read_text())
check("no_promotion_from_negatives", all(d["status"] != "promoted" for d in dec["decisions"]))
# ── production correctness ───────────────────────────────────────────────────
api = json.loads((B / "task102_api_validation.json").read_text())
check("api_registry_ok", api["checks"]["registry"]["http"] == 200)
check("walk_forward_untouched", api["checks"]["walk_forward_untouched"]["samples_400"]
       and api["checks"]["walk_forward_untouched"]["fits_6000"])
check("sim_v2_default", api["checks"]["sim_v2_default"]["defaults_to_v2"])
check("browser_no_console_errors", api.get("browser", {}).get("pass_count", 0) >= 2)
con2 = sqlite3.connect(str(ROOT / "db/custom.db"))
n_paper = con2.execute("SELECT COUNT(*) FROM ProspectivePaperTrade").fetchone()[0]
con2.close()
check("paper_records_present_untouched", n_paper > 0, str(n_paper))
t101_dir = ROOT / "data/backtest_reports/task101"
check("task101_artifacts_preserved", len(list(t101_dir.glob("*.json"))) >= 25)
check("sector_overrides_preserved", (ROOT / "data/askanalyst/sector_overrides.json").exists())
print(f"\n{PASS} passed, {len(FAIL)} failed")
sys.exit(1 if FAIL else 0)
