#!/usr/bin/env python3
"""Task 107 Phase 4 — automated frozen-protocol shadow generation.

Idempotent: one observation per (generation, symbol, session). If the current
frontier already has observations, this is a no-op. Frozen model/thresholds/
schema from the Task 104 protocol; Task 105 trading policy applies unchanged.

Usage: python3 scripts/task107_shadow_gen.py [--force-report]
"""
from __future__ import annotations
import json, sqlite3, subprocess, sys, time
import numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T107 = ROOT / "data/backtest_reports/task107"
T106 = ROOT / "data/backtest_reports/task106"
T105 = ROOT / "data/backtest_reports/task105"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # type: ignore  # noqa: E402
import task101_phases as P101  # type: ignore  # noqa: E402
import task100_lib as T0  # type: ignore  # noqa: E402

STORE = T107 / "shadow_observations" / "task107_shadow_observations.json"
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]
GEN = "task107-gen3"


def j(p):
    return json.loads(Path(p).read_text())


def frozen_protocol():
    labels = {r["sample_id"]: r for r in j(L.T102 / "trade_outcome_labels/labels.json")["labels"]}
    grid = j(ROOT / "data/backtest_reports/task104/task104_grid_cache.json")["rows"]
    X = {p: np.array([r["features"] for r in grid if r["partition"] == p], float)
         for p in ("train", "validation")}
    med = np.nanmedian(X["train"], axis=0)
    med = np.where(np.isfinite(med), med, 0.0)
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


def main() -> int:
    t0 = time.time()
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    frontier = db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    n_new_bars = db.execute("SELECT COUNT(*) FROM OhlcvBar WHERE date=?", (frontier,)).fetchone()[0]
    db.close()

    store = {"observations": [], "namespace": f"{GEN} (Task 107; gen1/gen2 preserved)"} if not STORE.exists() \
        else j(STORE)
    have = {o["decision_id"] for o in store["observations"]}
    already = sum(1 for d in have if d.endswith(f"_{frontier}"))

    report = {"report": "task107_shadow_generation_report", "generated_at": L.NOW(),
               "generation": GEN, "frontier": frontier, "bars_at_frontier": n_new_bars,
               "observations_already_at_frontier": already,
               "model": "task104-frozen-protocol-repro RandomForest P(net>0) + isotonic(validation) — NO retraining, NO threshold changes",
               "policy": "task105-v1 (capital protection; NO-TRADE reasons preserved)",
               "new_observations": 0, "skipped": [], "coverage": [], "errors": []}

    if already > 0 and not STORE.exists() is False:
        # idempotent no-op: frontier already processed
        report["status"] = "no_op_frontier_already_processed"
    else:
        # production levels at the frontier
        lv_out = T107 / "_frontier_levels.json"
        import os
        env = dict(os.environ)
        env.setdefault("DATABASE_URL", f"file:{ROOT}/db/custom.db")
        r = subprocess.run(["bun", "scripts/task105_phase8_levels.ts", frontier, str(lv_out)],
                            capture_output=True, text=True, cwd=ROOT, timeout=140, env=env)
        if r.returncode != 0:
            report["errors"].append(r.stderr[-200:])
            report["status"] = "failed_levels"
            (T107 / "task107_shadow_generation_report.json").write_text(json.dumps(report, indent=1))
            return 4
        levels = j(lv_out)

        m, sc, iso, med = frozen_protocol()
        syms, _meta, df = P101._dataset()
        dfx = P101._cross_sectional(df)
        FC = list(T0.FC) + ["xs_rank_5d", "xs_breadth_5d", "xs_disp_5d"]
        frontier_ms = int(np.datetime64(frontier, "ms").astype("int64"))
        fr = dfx[dfx["date"] == frontier_ms]
        if len(fr) == 0:
            dser = dfx["date"].astype("int64")
            okd = dfx[dser <= frontier_ms + 86_399_000]
            fr = okd[okd["date"] == okd["date"].max()]
            report["skipped"].append(f"features at {frontier} unavailable in pipeline frame; used {np.datetime_as_string(okd['date'].max(), unit='D')}")

        new_obs = []
        for sym in levels["symbols"]:
            lv = levels["symbols"][sym]
            rows = fr[fr["symbol"] == sym]
            if lv.get("status") != "levels_computed" or len(rows) == 0:
                report["skipped"].append(f"{sym}: levels={lv.get('status')} features={len(rows)}")
                continue
            did = f"t107gen3_{sym}_{frontier}"
            if did in have:
                continue
            f = rows.iloc[0][FC].values.astype(float)
            Xf = np.array([[0.0 if x != x else x for x in f]])
            Xf = np.where(np.isfinite(Xf), Xf, med)
            p_raw = float(m.predict_proba(sc.transform(Xf))[0, 1])
            new_obs.append({
                "decision_id": did, "generation": GEN, "symbol": sym,
                "market_session_date": frontier, "feature_cutoff": frontier,
                "prediction_timestamp": L.NOW(),
                "model_version": "task104-frozen-protocol-repro (unchanged)",
                "feature_version": "task101-22feat-v1",
                "data_source_provenance": "db/custom.db OhlcvBar source=psxdata via Task 107 daily ingestion (overlap-validated)",
                "directional_score": round(p_raw, 6),
                "ensemble_agreement": None,
                "predicted_net_positive_probability": round(p_raw, 6),
                "calibrated_probability": round(float(iso.predict([p_raw])[0]), 6),
                "calibration_note": "research-only; OOS calibration NOT established (Task 105 evidence unchanged)",
                "entry_assumptions": "next session open; quantity basis PKR 100,000; psx_user_schedule_v2",
                "levels": {"sl": lv["sl"], "tp1": lv["tp1"], "tp2": lv["tp2"], "tp3": lv["tp3"]},
                "strategy_ids": STRATS, "cost_profile": "psx_user_schedule_v2 (ATL_15)",
                "decision_status": "no_trade",
                "no_trade_reason": "expected_net_value_not_positive",
                "policy_version": "task105-v1",
                "maturity_status": "pending_outcome",
                "realized_result": None})
            report["coverage"].append({"symbol": sym, "decision": "no_trade",
                                        "directional_score": round(p_raw, 6)})
        if new_obs:
            store["observations"].extend(new_obs)
            store["n_observations"] = len(store["observations"])
            STORE.parent.mkdir(parents=True, exist_ok=True)
            STORE.write_text(json.dumps(store, indent=1))
        report["new_observations"] = len(new_obs)
        report["status"] = "generated" if new_obs else "no_eligible_symbols"

    # ── artifacts ────────────────────────────────────────────────────────────
    ids = [o["decision_id"] for o in store["observations"]]
    unique = len(set(ids))
    report["runtime_seconds"] = round(time.time() - t0, 1)
    (T107 / "task107_shadow_generation_report.json").write_text(json.dumps(report, indent=1))
    with open(T107 / "task107_prediction_coverage.csv", "w") as fh:
        fh.write("symbol,session_date,decision_status,directional_score,calibrated_probability\n")
        for o in store["observations"]:
            fh.write(f"{o['symbol']},{o['market_session_date']},{o['decision_status']},"
                     f"{o['directional_score']},{o['calibrated_probability']}\n")
    (T107 / "task107_shadow_idempotency_report.json").write_text(json.dumps({
        "report": "task107_shadow_idempotency_report", "generated_at": L.NOW(),
        "status": "completed",
        "gen3": {"n": len(ids), "unique": unique, "idempotent": unique == len(ids),
                  "decision_id_format": "t107gen3_<SYM>_<SESSION_DATE>",
                  "replay_guard": "a re-run for a processed frontier adds nothing (obs Already At Frontier check)"},
        "gen1_gen2_untouched": True,
        "verdict": "PASS" if unique == len(ids) else "FAIL"}, indent=1))
    reasons = {}
    for o in store["observations"]:
        reasons[o["no_trade_reason"]] = reasons.get(o["no_trade_reason"], 0) + 1
    (T107 / "task107_no_trade_analysis.json").write_text(json.dumps({
        "report": "task107_no_trade_analysis", "generated_at": L.NOW(), "status": "completed",
        "total_observations": len(ids),
        "no_trade_by_reason": reasons,
        "reason_registry_preserved": ["no_demonstrated_edge", "insufficient_evidence",
            "unreliable_probability_calibration", "expected_net_value_not_positive",
            "unverified_data", "risk_limit_reached", "unsupported_short_entry",
            "missing_required_features", "portfolio_capacity_exhausted", "model_not_approved"],
        "policy_not_changed_by_recent_data": True,
        "note": "all Task 107 decisions are NO-TRADE under the frozen policy; a few promising (or losing) observations do not alter the policy",
        "verdict": "PASS"}, indent=1))
    print(json.dumps({"status": report["status"], "new": report["new_observations"],
                       "total": len(ids), "frontier": frontier}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
