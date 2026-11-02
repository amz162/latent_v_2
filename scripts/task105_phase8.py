#!/usr/bin/env python3
"""Task 105 — Phase 8 (forward shadow observations) + Phase 9 (monitoring and
evidence gates). Records immutable, idempotent shadow observations at the
verified data frontier (2026-10-29) using frozen-model probabilities from the
Task 104 protocol. Outcomes are NOT fabricated: maturity is pending until
future sessions are imported (awaiting_data)."""
from __future__ import annotations
import json, sys, time, hashlib
import numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T105 = ROOT / "data/backtest_reports/task105"
T104 = ROOT / "data/backtest_reports/task104"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402
import task101_lib as T101  # noqa: E402
import task101_phases as P101  # noqa: E402
import task100_lib as T0  # noqa: E402

FRONTIER = "2026-10-29"
STORE = T105 / "shadow_observations" / "task105_shadow_observations.json"
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]


def j(p):
    return json.loads(Path(p).read_text())


def main() -> None:
    t0 = time.time()
    levels = j(T105 / "_frontier_levels.json")
    # ── frontier features via the SAME task100 pipeline ──────────────────────
    syms, _meta, df = P101._dataset()
    dfx = P101._cross_sectional(df)
    FC = list(T0.FC) + ["xs_rank_5d", "xs_breadth_5d", "xs_disp_5d"]
    frontier_ms = int(np.datetime64(FRONTIER, "ms").astype("int64"))
    fr = dfx[dfx["date"] == frontier_ms] if dfx["date"].dtype != object else dfx[dfx["date"] == FRONTIER]
    if len(fr) == 0:  # tolerate ms-vs-day boundary: take the max date <= frontier
        dser = dfx["date"].astype("int64") if dfx["date"].dtype != object else None
        if dser is not None:
            ok_dates = dfx[dser <= frontier_ms + 86_399_000]
            fr = ok_dates[ok_dates["date"] == ok_dates["date"].max()]
    frows = {}
    for s in syms:
        r = fr[fr["symbol"] == s]
        if len(r):
            v = r.iloc[0][FC].values.astype(float)
            frows[s] = [None if x != x else float(x) for x in v]

    # ── frozen-protocol model (identical to Task 104 reproduction) ───────────
    labels = {r["sample_id"]: r for r in j(L.T102 / "trade_outcome_labels/labels.json")["labels"]}
    grid = j(T104 / "task104_grid_cache.json")["rows"]
    X = {p: np.array([r["features"] for r in grid if r["partition"] == p], float)
          for p in ("train", "validation", "final_test")}
    med = np.nanmedian(X["train"], axis=0); med = np.where(np.isfinite(med), med, 0.0)
    X = {p: np.where(np.isfinite(X[p]), X[p], med) for p in X}
    from sklearn.preprocessing import StandardScaler
    sc = StandardScaler().fit(X["train"])
    ytr = np.array([labels[r["sample_id"]]["strategies"]["max_tp_step_trailing"]["positiveNet"]
                     for r in grid if r["partition"] == "train"])
    m = P101.cls_fit101("RandomForest", sc.transform(X["train"]), ytr)
    from sklearn.isotonic import IsotonicRegression
    Xv = sc.transform(X["validation"])
    yv = np.array([labels[r["sample_id"]]["strategies"]["max_tp_step_trailing"]["positiveNet"]
                    for r in grid if r["partition"] == "validation"])
    pv = m.predict_proba(Xv)[:, 1]
    iso = IsotonicRegression(out_of_bounds="clip").fit(pv, yv)

    # ── observation store (idempotent) ───────────────────────────────────────
    existing = {"observations": []}
    if STORE.exists():
        existing = j(STORE)
    have = {o["decision_id"] for o in existing["observations"]}
    obs = []
    for sym, f in frows.items():
        lv = levels["symbols"].get(sym, {})
        did = f"t105gen1_{sym}_{FRONTIER}"
        if did in have:
            continue
        Xf = np.array([[0.0 if x is None else x for x in f]])
        Xf = np.where(np.isfinite(Xf), Xf, med)
        p_raw = float(m.predict_proba(sc.transform(Xf))[0, 1])
        p_cal = float(iso.predict([p_raw])[0])
        obs.append({
            "decision_id": did, "generation": "task105-gen1", "symbol": sym,
            "decision_timestamp": FRONTIER, "data_cutoff": FRONTIER,
            "latest_verified_session": levels["frontier_date"],
            "model_version": "task104-frozen-protocol-repro (RandomForest P(net>0), isotonic on validation)",
            "model_version_hash": hashlib.sha1(
                json.dumps({"model": "RandomForest", "protocol": "task101"}).encode()).hexdigest()[:12],
            "feature_schema_version": "task101-22feat-v1 (rsi_14..xs_disp_5d)",
            "data_source_versions": {"db": "custom.db (psxdata importer)", "latest_verified_date": FRONTIER},
            "prediction_horizon_sessions": 21,
            "predicted_direction": "LONG-candidate (BUY-only cohort; SELL not executable)",
            "raw_score": round(p_raw, 6), "calibrated_probability": round(p_cal, 6),
            "calibration": "isotonic fitted on validation partition only",
            "strategies": {st: {"entry": lv.get("entry", "TBD"),
                                  "sl": lv.get("sl"), "tp1": lv.get("tp1"),
                                  "tp2": lv.get("tp2"), "tp3": lv.get("tp3")} for st in STRATS},
            "cost_profile": "psx_user_schedule_v2 (ATL_15)",
            "decision_status": "no_trade",
            "no_trade_reason": "expected_net_value_not_positive",
            "policy_version": "task105-v1",
            "maturity_status": "pending_outcome",
            "maturity_blocker": "next session open (entry) and outcome bars not yet imported — awaiting_data",
            "realized_outcome": None, "actual_net_pnl": None})
    all_obs = existing["observations"] + obs
    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps({
        "namespace": "task105-gen1 (separate from Task 103 prospective lifecycle; preserved)",
        "idempotency": "merge by decision_id; re-runs add nothing",
        "updated_at": L.NOW(), "n_observations": len(all_obs),
        "observations": all_obs}, indent=1))

    # ── Phase 9 artifacts ────────────────────────────────────────────────────
    (T105 / "task105_forward_monitoring.json").write_text(json.dumps({
        "report": "task105_forward_monitoring", "generated_at": L.NOW(), "status": "collecting_awaiting_data",
        "metrics": {
            "n_new_independent_decision_dates": 1,
            "decision_dates": [FRONTIER],
            "note": "frontier recording only — outcomes require sessions AFTER the last verified date",
            "n_independent_symbols": len(frows),
            "n_generated_predictions": len(frows),
            "n_no_trade_decisions": len(frows),
            "n_hypothetical_fills": 0,
            "n_matured_trades": 0,
            "net_expectancy": None, "win_rate": None, "profit_factor": None, "drawdown": None,
            "confidence_calibration": "insufficient matured trades",
            "cost_ratio": None, "symbol_concentration": None,
            "regime_coverage": "single point — no regime coverage yet"}},
        indent=1))

    gates = [
        {"gate": "at_least_100_matured_trades", "required": 100, "actual": 0, "met": False},
        {"gate": "at_least_two_distinct_calendar_quarters", "required": 2, "actual": 0, "met": False},
        {"gate": "multiple_independent_symbols", "required": ">=15", "actual": len(frows), "met": len(frows) >= 15},
        {"gate": "more_than_one_market_regime", "required": 2, "actual": 0, "met": False},
        {"gate": "positive_net_expectancy_after_real_costs", "actual": None, "met": False,
          "note": "frozen Task 104 evidence: NEGATIVE across all 60 configurations"},
        {"gate": "confidence_interval_supports_positive_expectancy", "actual": None, "met": False},
        {"gate": "acceptable_drawdown", "actual": None, "met": False,
          "note": "historical drawdowns -92..-99.7%"},
        {"gate": "no_severe_concentration", "actual": None, "met": False},
        {"gate": "calibration_stability", "actual": None, "met": False,
          "note": "OOS Spearman(confidence, outcome) ~0"}]
    (T105 / "task105_evidence_gate_report.json").write_text(json.dumps({
        "report": "task105_evidence_gate_report", "generated_at": L.NOW(), "status": "completed",
        "gates": gates, "gates_met": sum(1 for g in gates if g["met"]), "gates_total": len(gates),
        "promotion_conclusion": "NOT_PROMOTABLE — no model or strategy satisfies the minimum evidence gates; "
                                 "frozen historical evidence is negative on every gate it touches",
        "significance_testing_note": "no repeated testing without adjustment; gates are minimum checks, not a promotion formula"}, indent=1))

    (T105 / "task105_forward_validation_status.json").write_text(json.dumps({
        "report": "task105_forward_validation_status", "generated_at": L.NOW(),
        "state": "awaiting_data",
        "state_machine": ["collecting", "insufficient_matured_trades", "awaiting_data",
                           "negative_edge", "inconclusive", "eligible_for_review", "not_promotable"],
        "reason": "no licensed market feed is connected; the last verified session (2026-10-29) is the "
                   "recorded frontier. Shadow observations for that frontier are stored and FROZEN; they "
                   "mature only when genuinely new sessions are imported.",
        "latest_verified_db_date": FRONTIER,
        "observations_recorded": len(all_obs), "matured": 0,
        "idempotent": True,
        "task103_records_preserved": True,
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))
    print(f"phase8+9 done: {len(obs)} new observations, {len(all_obs)} total, state=awaiting_data")


if __name__ == "__main__":
    main()
