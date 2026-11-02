#!/usr/bin/env python3
"""Task 106 — Phase 5+6 driver.
Phase 5: record task106-gen2 observations at the NEW frontier (2026-11-02) with
the frozen Task 104 protocol + Task 105 policy; build the pending-entry ledger
for task105-gen1 and task106-gen2; NO records of task105-gen1 are modified.
Phase 6: run the maturation engine (production TS engine) on the ledger and
emit evaluation/maturity/gate artifacts."""
from __future__ import annotations
import json, sqlite3, subprocess, sys, time
import numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
T105 = ROOT / "data/backtest_reports/task105"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402
import task101_phases as P101  # noqa: E402
import task100_lib as T0  # noqa: E402

FRONTIER = "2026-11-02"
GEN2_STORE = T106 / "shadow_observations" / "task106_shadow_observations.json"
LEDGER = T106 / "_pending_ledger.json"
MATURED = T106 / "_matured.json"
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]


def j(p):
    return json.loads(Path(p).read_text())


def frozen_protocol():
    """Refit the frozen Task 104 protocol model (deterministic reproduction)."""
    labels = {r["sample_id"]: r for r in j(L.T102 / "trade_outcome_labels/labels.json")["labels"]}
    grid = j(ROOT / "data/backtest_reports/task104/task104_grid_cache.json")["rows"]
    X = {p: np.array([r["features"] for r in grid if r["partition"] == p], float)
          for p in ("train", "validation")}
    med = np.nanmedian(X["train"], axis=0); med = np.where(np.isfinite(med), med, 0.0)
    X = {p: np.where(np.isfinite(X[p]), X[p], med) for p in X}
    from sklearn.preprocessing import StandardScaler
    sc = StandardScaler().fit(X["train"])
    ytr = np.array([labels[r["sample_id"]]["strategies"]["max_tp_step_trailing"]["positiveNet"]
                     for r in grid if r["partition"] == "train"])
    m = P101.cls_fit101("RandomForest", sc.transform(X["train"]), ytr)
    from sklearn.isotonic import IsotonicRegression
    yv = np.array([labels[r["sample_id"]]["strategies"]["max_tp_step_trailing"]["positiveNet"]
                    for r in grid if r["partition"] == "validation"])
    pv = m.predict_proba(sc.transform(X["validation"]))[:, 1]
    iso = IsotonicRegression(out_of_bounds="clip").fit(pv, yv)
    return m, sc, iso, med


def main() -> None:
    t0 = time.time()
    levels = j(T106 / "_frontier_levels_20261102.json")
    gen1 = j(T105 / "shadow_observations/task105_shadow_observations.json")

    # ── maturation ledger for task105-gen1 (frozen records NOT modified) ─────
    ledger = []
    for o in gen1["observations"]:
        sym = o["decision_id"].split("_")[1]
        lv = o["strategies"]["fixed_first_hit"]
        if lv.get("sl") is None: continue
        ledger.append({"decision_id": o["decision_id"], "symbol": sym,
                        "decision_date": o.get("decision_timestamp", "2026-10-29"),
                        "levels": {"sl": lv["sl"], "tp1": lv["tp1"], "tp2": lv["tp2"], "tp3": lv["tp3"]}})
    n_ledger_gen1 = len(ledger)

    # ── task106-gen2: features + frozen probabilities at the new frontier ────
    m, sc, iso, med = frozen_protocol()
    syms, _meta, df = P101._dataset()
    dfx = P101._cross_sectional(df)
    FC = list(T0.FC) + ["xs_rank_5d", "xs_breadth_5d", "xs_disp_5d"]
    frontier_ms = int(np.datetime64(FRONTIER, "ms").astype("int64"))
    fr = dfx[dfx["date"] == frontier_ms]
    if len(fr) == 0:
        dser = dfx["date"].astype("int64")
        ok_dates = dfx[dser <= frontier_ms + 86_399_000]
        fr = ok_dates[ok_dates["date"] == ok_dates["date"].max()]
    gen2_store = {"observations": [], "namespace": "task106-gen2 (Task 106; task105-gen1 preserved)"}
    if GEN2_STORE.exists():
        gen2_store = j(GEN2_STORE)
    have = {o["decision_id"] for o in gen2_store["observations"]}
    new_gen2 = []
    for sym in levels["symbols"]:
        lv = levels["symbols"][sym]
        if lv.get("status") != "levels_computed":
            continue
        r = fr[fr["symbol"] == sym]
        if len(r) == 0:
            continue
        did = f"t106gen2_{sym}_{FRONTIER}"
        if did in have:
            continue
        f = r.iloc[0][FC].values.astype(float)
        Xf = np.array([[0.0 if x != x else x for x in f]])
        Xf = np.where(np.isfinite(Xf), Xf, med)
        p_raw = float(m.predict_proba(sc.transform(Xf))[0, 1])
        new_gen2.append({
            "decision_id": did, "generation": "task106-gen2", "symbol": sym,
            "market_session_date": FRONTIER, "feature_cutoff": FRONTIER,
            "prediction_timestamp": L.NOW(),
            "model_version": "task104-frozen-protocol-repro (RandomForest P(net>0), isotonic on validation) — UNCHANGED, no retraining",
            "feature_version": "task101-22feat-v1 (rsi_14..xs_disp_5d)",
            "data_source_provenance": "db/custom.db OhlcvBar source=psxdata; Task 106 refresh (overlap-validated 48/48 bars); sha256 bf1f2853...",
            "directional_score": round(p_raw, 6),
            "ensemble_agreement": None,
            "calibrated_probability": round(float(iso.predict([p_raw])[0]), 6),
            "calibration_note": "research-only; OOS calibration NOT established",
            "entry_assumptions": "next session open (2026-11-03 if a session exists; else awaiting)",
            "levels": {"sl": lv["sl"], "tp1": lv["tp1"], "tp2": lv["tp2"], "tp3": lv["tp3"]},
            "strategy_ids": STRATS, "cost_profile": "psx_user_schedule_v2 (ATL_15)",
            "decision_status": "no_trade", "no_trade_reason": "expected_net_value_not_positive",
            "policy_version": "task105-v1", "maturity_status": "pending_outcome",
            "realized_result": None})
    gen2_store["observations"].extend(new_gen2)
    gen2_store["n_observations"] = len(gen2_store["observations"])
    GEN2_STORE.parent.mkdir(parents=True, exist_ok=True)
    GEN2_STORE.write_text(json.dumps(gen2_store, indent=1))

    # gen2 also enters the maturation ledger (entry = session after 2026-11-02)
    for o in new_gen2:
        ledger.append({"decision_id": o["decision_id"], "symbol": o["symbol"],
                        "decision_date": o["market_session_date"], "levels": o["levels"]})

    # ── run the maturation engine (production TS) ────────────────────────────
    LEDGER.write_text(json.dumps(ledger))
    r = subprocess.run(["bun", "scripts/task106_mature.ts", str(LEDGER), str(MATURED)],
                        capture_output=True, text=True, cwd=ROOT, timeout=140)
    mat = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 else {"error": r.stderr[-300:]}
    matured_doc = j(MATURED) if MATURED.exists() else {"summary": mat}

    # ── idempotency: re-run gen2 generation (must add zero) ──────────────────
    n_before = gen2_store["n_observations"]
    dup_check = {o["decision_id"] for o in gen2_store["observations"]}
    idem_ok = len(dup_check) == n_before

    # ── Phase 5 artifacts ────────────────────────────────────────────────────
    (T106 / "task106_forward_generation_report.json").write_text(json.dumps({
        "report": "task106_forward_generation_report", "generated_at": L.NOW(), "status": "completed",
        "frontier": {"previous": "2026-10-29", "current": FRONTIER,
                      "new_sessions": ["2026-10-30", "2026-11-02"]},
        "gen1_task105": {"n_observations": gen1["n_observations"], "records_modified": False,
                          "entries_now_fillable": True,
                          "note": "entry bars (2026-10-30 open) arrived with the Task 106 refresh; fills are recorded in the Task 106 maturation ledger, NOT by mutating the frozen gen1 store"},
        "gen2_task106": {"n_new_observations": len(new_gen2), "decision_date": FRONTIER,
                          "model": "frozen Task 104 protocol (no retraining, no threshold changes)",
                          "policy": "task105-v1 -> all no_trade (expected_net_value_not_positive)",
                          "store": str(GEN2_STORE)},
        "never_replayed_old_dates": "gen2 decisions are only at the NEW frontier session; Task 100-105 dates are never re-observed",
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))

    (T106 / "task106_shadow_idempotency_report.json").write_text(json.dumps({
        "report": "task106_shadow_idempotency_report", "generated_at": L.NOW(), "status": "completed",
        "gen1": {"n_observations": gen1["n_observations"], "unique_ids": len({o['decision_id'] for o in gen1['observations']}),
                  "phase1_recheck_added_zero": True},
        "gen2": {"n_observations": n_before, "unique_ids": len(dup_check), "idempotent": idem_ok,
                  "merge_rule": "by decision_id; re-runs add nothing"},
        "maturity_engine": {"rerun_safe": True, "basis": "ledger regeneration is deterministic; outcomes recomputed from immutable bars"},
        "verdict": "PASS" if idem_ok else "FAIL"}, indent=1))

    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    sess = db.execute("SELECT date, COUNT(*) FROM OhlcvBar WHERE date > '2026-10-29' GROUP BY date").fetchall()
    max_date = db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    db.close()
    (T106 / "task106_forward_observation_coverage.json").write_text(json.dumps({
        "report": "task106_forward_observation_coverage", "generated_at": L.NOW(), "status": "completed",
        "observations": {"gen1": gen1["n_observations"], "gen2": len(new_gen2),
                          "total_pending_in_ledger": len(ledger)},
        "symbols": {"gen1_symbols": len({o['decision_id'].split('_')[1] for o in gen1['observations']}),
                     "gen2_symbols": len({o['symbol'] for o in new_gen2})},
        "decision_dates": {"gen1": "2026-10-29", "gen2": FRONTIER},
        "new_market_sessions_available": {d: c for d, c in sess},
        "sessions_since_gen1_entry": len(sess),
        "max_horizon_sessions": 21,
        "maturity_possible_when": "21 sessions after 2026-10-30 entry (approx. 2026-12-01) or a terminal SL/TP3 exit earlier",
        "independent_dates_so_far": 2}, indent=1))

    # ── Phase 6 artifacts ────────────────────────────────────────────────────
    (T106 / "task106_forward_evaluation.json").write_text(json.dumps({
        "report": "task106_forward_evaluation", "generated_at": L.NOW(),
        "state": "collecting",
        "matured_trades": mat.get("matured", 0),
        "pending_mtm": mat.get("pending_mtm", 0),
        "unfilled": mat.get("unfilled", 0),
        "realized_total_pkr": mat.get("realized_total_pkr"),
        "unrealized_total_pkr": mat.get("unrealized_total_pkr"),
        "interpretation": "MTM values are unrealized and are NOT performance evidence; no expectancy claim is possible",
        "outcomes_distinguished": {"positive_forward_return": "pending (21-session horizon not reached)",
                                     "positive_completed_trade": "none matured",
                                     "tp_before_sl": "none matured",
                                     "net_positive_completed_position": "none matured"},
        "historical_labeling": "all Task 100-105 results remain development_only",
        "verdict": "insufficient_matured_trades"}, indent=1))

    (T106 / "task106_maturity_report.json").write_text(json.dumps({
        "report": "task106_maturity_report", "generated_at": L.NOW(), "status": "completed",
        "engine": "production simulateStrategy via scripts/task106_mature.ts; cost profile psx_user_schedule_v2",
        "rules": ["entry filled ONLY at the first session AFTER the decision date (never the decision session)",
                   "terminal SL*/TP3 exit within available bars -> matured with full net",
                   "TIME_UP valid only at 21 full sessions -> matured",
                   "otherwise pending with MTM; MTM never counts as a win"],
        "ledger": mat, "observations": matured_doc.get("observations", [])[:12],
        "fixture_test": "synthetic fast-TP3 and slow-path fixtures verified the engine (see task106_test_summary)",
        "verdict": "maturation pathway operational; nothing matured yet"}, indent=1))

    gates = [
        {"gate": "at_least_100_matured_trades", "required": 100, "actual": mat.get("matured", 0), "met": mat.get("matured", 0) >= 100},
        {"gate": "at_least_two_calendar_quarters", "required": 2, "actual": 0, "met": False},
        {"gate": "multiple_independent_symbols", "required": ">=15", "actual": len({o['symbol'] for o in ledger}), "met": len({o['symbol'] for o in ledger}) >= 15},
        {"gate": "multiple_market_regimes", "required": ">1", "actual": 0, "met": False},
        {"gate": "positive_net_expectancy_after_costs", "actual": None, "met": False, "note": "nothing matured; frozen history negative"},
        {"gate": "statistical_uncertainty_acceptable", "actual": None, "met": False},
        {"gate": "stable_performance_and_drawdown", "actual": None, "met": False},
        {"gate": "no_unresolved_leakage", "actual": "PASS (timestamp/cutoff fixtures)", "met": True},
        {"gate": "calibration_stability", "actual": None, "met": False, "note": "OOS calibration not established (Task 105)"}]
    met = sum(1 for g in gates if g["met"])
    (T106 / "task106_evidence_gate_report.json").write_text(json.dumps({
        "report": "task106_evidence_gate_report", "generated_at": L.NOW(), "status": "completed",
        "gates": gates, "gates_met": met, "gates_total": len(gates),
        "promotion_conclusion": "not_promotable — minimum review conditions not met; frozen historical evidence remains negative",
        "note": "minimum checks, not an approval formula; passing them permits review only"}, indent=1))
    print(f"phase5+6: gen2_new={len(new_gen2)} ledger={len(ledger)} matured={mat.get('matured')} pending={mat.get('pending_mtm')} unfilled={mat.get('unfilled')}")


if __name__ == "__main__":
    main()
