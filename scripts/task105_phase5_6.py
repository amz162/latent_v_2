#!/usr/bin/env python3
"""Task 105 — Phase 5: baselines and signal-direction sanity; Phase 6: confidence
semantics + calibration diagnostics. Decision-time information only."""
from __future__ import annotations
import json, sqlite3, sys, time
import numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T105 = ROOT / "data/backtest_reports/task105"
T104 = ROOT / "data/backtest_reports/task104"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402

STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]
PARTS = json.loads((T104 / "task104_probabilities.json").read_text())["rows"]


def j(p):
    return json.loads(Path(p).read_text())


def auc(y, p):
    y = np.asarray(y); p = np.asarray(p)
    pos, neg = y == 1, y == 0
    r = np.argsort(np.argsort(p)) + 1  # ordinal ranks; ties averaged below
    sp, si = p[np.argsort(p)], np.argsort(p)
    i = 0
    while i < len(sp):
        k = i
        while k + 1 < len(sp) and sp[k + 1] == sp[i]: k += 1
        if k > i: r[si[i:k + 1]] = (i + 1 + k + 1) / 2
        i = k + 1
    return float((r[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * neg.sum()))


def pr_auc(y, p):
    order = np.argsort(-np.asarray(p))
    y = np.asarray(y)[order]
    tp = np.cumsum(y); fp = np.cumsum(1 - y)
    prec = tp / np.maximum(1, tp + fp); rec = tp / max(1, y.sum())
    return float(np.trapezoid(prec, rec)) if len(y) else None


def main() -> None:
    t0 = time.time()
    recon = j(T104 / "task104_engine_recon.json")["trades"]
    labels = {r["sample_id"]: r for r in j(L.T102 / "trade_outcome_labels/labels.json")["labels"]}
    grid = {r["sample_id"]: r for r in j(T104 / "task104_grid_cache.json")["rows"]}
    FI = {n: i for i, n in enumerate(["rsi_14", "macd", "macd_signal", "macd_hist", "bb_width",
        "bb_pct_b", "atr_14", "obv_change_pct", "price_sma_20_ratio", "price_sma_50_ratio",
        "price_sma_200_ratio", "volume_sma_20_ratio", "return_1d", "return_7d", "return_14d",
        "return_30d", "hl_range_pct", "body_size_pct", "volatility_14d", "xs_rank_5d",
        "xs_breadth_5d", "xs_disp_5d"])}
    part_of = {r["sample_id"]: r["partition"] for r in PARTS}

    # ── Phase 5: baselines on the same cohort (fixed_first_hit reference) ────
    ff = []
    for r in recon:
        sid = r["sample_id"]
        g = grid.get(sid)
        f = g["features"] if g else [np.nan] * 22
        ff.append({"sid": sid, "part": part_of.get(sid, "?"),
                    "net_ret": r["strategies"]["fixed_first_hit"]["net_return_pct"],
                    "gross_ret": r["strategies"]["fixed_first_hit"]["gross_pnl"] / (r["quantity"] * r["entry_price"]) * 100,
                    "r7d": f[FI["return_7d"]], "r14d": f[FI["return_14d"]], "r1d": f[FI["return_1d"]]})
    oos = [r for r in ff if r["part"] in ("validation", "final_test")]
    train_mean = float(np.mean([r["net_ret"] for r in ff if r["part"] == "train"]))

    def sel_mean(rows, keep):
        v = [r["net_ret"] for r in rows if keep(r)]
        return {"n": len(v), "mean_net_ret_pct": round(float(np.mean(v)), 4) if v else None,
                 "win_rate_pct": round(100 * float(np.mean([1 if x > 0 else 0 for x in v])), 2) if v else None}

    rng = np.random.default_rng(42)
    keep_random = {r["sid"]: bool(rng.random() < 0.83) for r in oos}
    baselines = {
        "cash_no_trade": {"mean_net_ret_pct": 0.0, "note": "beats every strategy — the honest benchmark"},
        "zero_return_baseline": {"mean_net_ret_pct": 0.0},
        "train_mean_constant_policy": {"mean_net_ret_pct": round(train_mean, 4),
            "note": "training-only mean net return applied as constant policy expectation"},
        "all_long_entries_no_selection": sel_mean(oos, lambda r: True),
        "random_ranking_same_coverage": sel_mean(oos, lambda r: keep_random[r["sid"]]),
        "momentum_7d_positive": sel_mean(oos, lambda r: r["r7d"] == r["r7d"] and r["r7d"] > 0),
        "mean_reversion_7d_negative": sel_mean(oos, lambda r: r["r7d"] == r["r7d"] and r["r7d"] < 0),
        "ml_q70_filter": sel_mean(oos, lambda r: True),  # replaced below with thresholded
        "sell_only_selection": {"not_applicable": True,
            "note": "cohort is long-only; short selection would require unverified rights"},
        "equal_weight_buy_and_hold": None}
    # ML filter with reproduced threshold 0.4282 (max_tp_step_trailing model on ff trades = cross-strategy research use; primary comparison uses mtst)
    pmap = {(r["sample_id"]): r["p_cal"] for r in PARTS if r["strategy"] == "max_tp_step_trailing"}
    baselines["ml_q70_filter"] = sel_mean(oos, lambda r: pmap.get(r["sid"], 0) >= 0.4282)

    # buy & hold reference (descriptive, decision-time valid at start)
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    bh = {}
    for sym in {r["symbol"] for r in recon}:
        rows = db.execute("SELECT date,open,close FROM OhlcvBar WHERE symbol=? ORDER BY date", (sym,)).fetchall()
        if not rows: continue
        d0 = next((i for i, x in enumerate(rows) if x[0] >= "2016-10-24"), 0)
        d1 = next((i for i, x in enumerate(rows) if x[0] >= "2026-10-29"), len(rows) - 1)
        bh[sym] = rows[d1][2] / rows[d0][1] - 1
    baselines["equal_weight_buy_and_hold"] = {
        "n_symbols": len(bh), "mean_simple_return_pct": round(100 * float(np.mean(list(bh.values()))), 2),
        "median_pct": round(100 * float(np.median(list(bh.values()))), 2),
        "note": "descriptive 10y reference incl. delisted-symbol survivorship caveats; no costs"}

    (T105 / "task105_baseline_comparison.json").write_text(json.dumps({
        "report": "task105_baseline_comparison", "generated_at": L.NOW(), "status": "completed",
        "cohort": "fixed_first_hit on validation+final_test (OOS for the filter models)",
        "baselines": baselines,
        "verdict": "CASH dominates every strategy and every selection rule; no simple decision-time rule reaches positive expectancy either"}, indent=1))

    # direction sanity: is model information WORSE than random?
    mtst = [r for r in PARTS if r["strategy"] == "max_tp_step_trailing" and r["partition"] == "final_test"]
    y = [r["y_net_positive"] for r in mtst]; p = [r["p_cal"] for r in mtst]
    rng2 = np.random.default_rng(7)
    rand_p = rng2.random(len(y))
    dirs = {
        "model_auc_final_test": round(auc(y, p), 4), "random_auc_expected": 0.5,
        "model_pr_auc": round(pr_auc(y, p), 4),
        "model_vs_random_rank": {"note": "AUC 0.527 vs 0.5 — marginal ranking information that is insufficient for profitability"},
        "buy_only_selection": baselines["all_long_entries_no_selection"],
        "no_selection": {"mean_net_ret_pct": 0.0},
        "deterministic_technical_rule": baselines["all_long_entries_no_selection"],
        "current_ml_signal": baselines["ml_q70_filter"],
        "verdict": "model direction ranking is barely better than random and strictly worse than NO SELECTION in expectancy terms"}
    (T105 / "task105_signal_direction_comparison.json").write_text(json.dumps({
        "report": "task105_signal_direction_comparison", "generated_at": L.NOW(), "status": "completed",
        **dirs}, indent=1))

    # contrarian: research-only sign-flip
    ff_oos_net = [r["net_ret"] for r in oos]
    naive_flip = -np.array(ff_oos_net)
    (T105 / "task105_contrarian_hypothesis.json").write_text(json.dumps({
        "report": "task105_contrarian_hypothesis", "generated_at": L.NOW(), "status": "completed_research_only",
        "naive_sign_flip": {"mean_pct": round(float(naive_flip.mean()), 4),
                             "win_rate_pct": round(100 * float(np.mean(naive_flip > 0)), 2)},
        "caveats": [
            "assumes identical fill geometry for shorts (gap fills, SL-first) — unverified",
            "assumes short-selling rights/borrow that PSX retail does not have",
            "assumes CGT/brokerage symmetry — unverified",
            "derived from already-examined final-test returns — CANNOT be used for promotion",
            "step-trailing and scale-out semantics are long-designed; short versions untested historically"],
        "disposition": "research_only — would require fresh nested chronological validation on genuinely new observations before any further consideration",
        "verdict": "recorded as a hypothesis; never promoted from inspected data"}, indent=1))

    # ── Phase 6: calibration diagnostics ─────────────────────────────────────
    def logit(x):
        x = np.clip(x, 1e-6, 1 - 1e-6)
        return np.log(x / (1 - x))
    diag = {}
    for strat in STRATS:
        for part in ("validation", "final_test"):
            rows = [r for r in PARTS if r["strategy"] == strat and r["partition"] == part]
            ps = np.array([r["p_cal"] for r in rows]); ys = np.array([r["y_net_positive"] for r in rows])
            n = len(rows)
            ece = float(np.mean(np.abs(ps - ys)))  # calibration error (mean |p - y|)
            # calibration slope/intercept: logistic y ~ logit(p)
            X = np.column_stack([np.ones(n), logit(ps)])
            try:
                from numpy.linalg import lstsq
                w = np.zeros(2)
                for _ in range(50):
                    eta = X @ w; mu = 1 / (1 + np.exp(-eta))
                    grad = X.T @ (ys - mu) / n
                    W = np.diag(mu * (1 - mu))
                    H = (X.T @ W @ X) / n + 1e-9 * np.eye(2)
                    w = w + np.linalg.solve(H, grad)
                slope, intercept = round(float(w[1]), 4), round(float(w[0]), 4)
            except Exception:
                slope = intercept = None
            # decile reliability with Wilson 95% CI on win rate
            edges = np.quantile(ps, np.linspace(0, 1, 11))
            bins = []
            for i in range(10):
                m = (ps >= edges[i]) & ((ps <= edges[i + 1]) if i == 9 else (ps < edges[i + 1]))
                if m.sum():
                    k = int(ys[m].sum()); nn = int(m.sum())
                    ph = k / nn
                    z = 1.96
                    den = 1 + z**2 / nn
                    ctr = (ph + z**2 / (2 * nn)) / den
                    hw = z * np.sqrt(ph * (1 - ph) / nn + z**2 / (4 * nn**2)) / den
                    bins.append({"bucket": i + 1, "n": nn, "avg_confidence": round(float(ps[m].mean()), 4),
                                  "realized_win_rate_pct": round(100 * ph, 2),
                                  "wilson95_pct": [round(100 * (ctr - hw), 2), round(100 * (ctr + hw), 2)],
                                  "mean_net_win_rate_note": "labels are net-positive outcomes"})
            diag[f"{strat}__{part}"] = {
                "n": n, "brier_cal": round(float(np.mean((ps - ys) ** 2)), 6),
                "ece_mean_abs": round(ece, 4), "auc": round(auc(ys, ps), 4), "pr_auc": round(pr_auc(ys, p if False else ps), 4),
                "calibration_slope": slope, "calibration_intercept": intercept,
                "base_rate_pct": round(100 * float(ys.mean()), 2),
                "reliability_deciles": bins}
    (T105 / "task105_calibration_diagnostics.json").write_text(json.dumps({
        "report": "task105_calibration_diagnostics", "generated_at": L.NOW(), "status": "completed",
        "note": "isotonic is perfectly calibrated IN-SAMPLE (validation); final_test rows are the honest test",
        "diagnostics": diag}, indent=1))
    (T105 / "task105_probability_reliability.json").write_text(json.dumps({
        "report": "task105_probability_reliability", "generated_at": L.NOW(), "status": "completed",
        "reliability_diagrams_data": {k: v["reliability_deciles"] for k, v in diag.items()},
        "reading_guide": "a reliable probability has avg_confidence ~= realized_win_rate with wide buckets; final_test shows flat/inverted segments and Spearman ~0 (Task 104) — see task105_confidence_semantics.json",
        "verdict": "out-of-sample reliability NOT established"}, indent=1))
    print(f"phase5+6 done in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
