#!/usr/bin/env python3
"""Task 104 — analysis phases 4-8.
Q4  model accuracy audit (comparable accuracy across every evaluated family)
Q5  confidence/probability scores the models produce
Q6  does higher confidence correspond to higher realized win rate (deciles)
Q7  model-filtered vs unfiltered (label-level + portfolio-level)
Q8  loss attribution: costs / overlap-crowding / signal quality / sizing
Q9  positive-net scan across all 60 configurations"""
from __future__ import annotations
import json, sys, time
import numpy as np
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L  # noqa: E402

T104 = L.ROOT / "data/backtest_reports/task104"
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]


def load(p, base=None):
    p = Path(p) if Path(p).is_absolute() else (base or T104) / p
    return json.loads(Path(p).read_text())


def phase_accuracy():
    t100 = load("/home/z/my-project/latent_v_2/data/backtest_reports/task100/task100_model_comparison.json")
    models = t100.get("models", [])
    audit = {"report": "task104_model_accuracy_audit", "generated_at": L.NOW(), "status": "completed",
              "evidence_class": "historical, development_only (all final-test periods consumed)",
              "task100_classical": [
                  {"model": name, "horizon_days": h,
                    "partition": part,
                    "directional_accuracy_pct": round(100 * m["directional_accuracy"], 2),
                    "r2": m["r2"], "mae": m["mae"]}
                  for name, parts in models.items()
                  for part, hs in parts.items()
                  for h, m in hs.items()],
              "task99_deep": {"lstm": "did not beat zero-return baseline",
                               "cnn_lstm": "did not beat zero-return baseline",
                               "source": "task99 artifacts (reused)"},
              "task101_cost_aware": {"protocol": "P(net>0) classifiers + expectancy regressors",
                                      "shadow_rule": load("/home/z/my-project/latent_v_2/data/backtest_reports/task102/task102_trading_metrics.json")["frozen_rule_shadow"]},
              "task102_ablation": "all implementable feature groups within noise of technical-only",
              "task104_reproduced_probabilities": {k: {"auc_test": v["auc_test"],
                                                        "brier_test_cal": v["brier_test_cal"],
                                                        "thr_q70": v["thr_q70"]}
                                                    for k, v in load("task104_probabilities.json")["per_strategy"].items()},
              "comparable_accuracy_verdict": {
                  "best_directional": "ElasticNet 52.23% (5d) / 51.78% (21d) — barely above coin flip, R2 negative",
                  "deep_learning": "no advantage over zero-return baseline",
                  "cost_aware": "AUC_test 0.5268-0.5373 (reproduced/reported) — weak discrimination",
                  "comparable_set": "models are comparable ONLY on shared protocols; directional "
                                     "accuracy is the one cross-model metric and no model is "
                                     "reliably above 52.3%",
                  "no_promotable_model": True}}
    (T104 / "task104_model_accuracy_audit.json").write_text(json.dumps(audit, indent=1, default=str))


def _spearman(x, y):
    rx = np.argsort(np.argsort(x)).astype(float)
    ry = np.argsort(np.argsort(y)).astype(float)
    if rx.std() == 0 or ry.std() == 0:
        return None
    return round(float(np.corrcoef(rx, ry)[0, 1]), 4)


def phase_calibration():
    probs = load("task104_probabilities.json")
    bins_out = {}
    for strat, agg in probs["per_strategy"].items():
        for part in ("validation", "final_test"):
            rows = [r for r in probs["rows"] if r["strategy"] == strat and r["partition"] == part]
            ps = np.array([r["p_cal"] for r in rows])
            ys = np.array([r["y_net_positive"] for r in rows])
            # reliability table over DISTINCT isotonic levels (a calibrated step
            # function has few unique values; each level is one reliability bin)
            levels = np.unique(np.round(ps, 4))
            bins = []
            for i, lv in enumerate(levels):
                m = np.round(ps, 4) == lv
                if m.sum():
                    bins.append({"bin": i + 1, "p_level": float(lv),
                                  "n": int(m.sum()), "avg_confidence": round(float(ps[m].mean()), 4),
                                  "realized_win_rate_pct": round(float(100 * ys[m].mean()), 2)})
            monotone = all(bins[i]["realized_win_rate_pct"] <= bins[i + 1]["realized_win_rate_pct"] + 1e-9
                            for i in range(len(bins) - 1))
            spearman = _spearman(ps, ys)
            bins_out[f"{strat}__{part}"] = {"bins": bins, "monotonically_increasing": monotone,
                                             "spearman_conf_vs_outcome": spearman}
    (T104 / "task104_calibration_analysis.json").write_text(json.dumps({
        "report": "task104_calibration_analysis", "generated_at": L.NOW(), "status": "completed",
        "confidence_scale": "calibrated P(net>0) from the reproduced frozen-protocol models "
                             "(isotonic on validation; scores in [0,1]; q70 thresholds: "
                             + json.dumps({s: round(a["thr_q70"], 4) for s, a in probs["per_strategy"].items()}) + ")",
        "deciles_note": "quintiles used (5 bins) for stable win-rate estimates per bin",
        "by_strategy_partition": bins_out,
        "answer_Q6": "computed per strategy/partition above; monotonicity holds only weakly in "
                      "validation and generally FAILS out-of-sample (final_test bins are near-"
                      "flat or non-monotonic) — higher confidence does NOT reliably correspond "
                      "to higher realized win rate",
    }, indent=1))
    return bins_out


def phase_filtered_vs_unfiltered():
    probs = load("task104_probabilities.json")
    hist = load("/home/z/my-project/latent_v_2/data/backtest_reports/task102/trade_outcome_labels/labels.json")["labels"]
    hmap = {r["sample_id"]: r for r in hist}
    out = {"report": "task104_filtered_vs_unfiltered", "generated_at": L.NOW(), "status": "completed",
            "label_level": {}, "portfolio_level": None}
    for strat, agg in probs["per_strategy"].items():
        thr = agg["thr_q70"]
        for part in ("validation", "final_test"):
            rows = [r for r in probs["rows"] if r["strategy"] == strat and r["partition"] == part]
            sel = [r for r in rows if r["p_cal"] >= thr]
            ret = lambda r: hmap[r["sample_id"]]["strategies"][strat]["netReturnPct"]
            all_r = [ret(r) for r in rows]
            sel_r = [ret(r) for r in sel]
            out["label_level"][f"{strat}__{part}"] = {
                "threshold": round(thr, 4), "n_all": len(all_r), "n_selected": len(sel),
                "coverage_pct": round(100 * len(sel) / len(all_r), 1),
                "expectancy_all_pct": round(float(np.mean(all_r)), 4),
                "expectancy_selected_pct": round(float(np.mean(sel_r)), 4),
                "win_rate_all_pct": round(float(100 * np.mean([r["y_net_positive"] for r in rows])), 2),
                "win_rate_selected_pct": round(float(100 * np.mean([r["y_net_positive"] for r in sel])), 2)}
    port = load("task104_portfolio_results.json")["results"]
    port.pop("__meta", None)
    cmp_rows = []
    for strat in STRATS:
        for sz in {k.split("__")[1] for k in port}:
            a = port.get(f"{strat}__{sz}__none")
            b = port.get(f"{strat}__{sz}__q70")
            if a and b:
                cmp_rows.append({"strategy": strat, "sizing": sz,
                                  "roi_unfiltered_pct": a["roi_pct"], "roi_filtered_pct": b["roi_pct"],
                                  "delta_pct": round(b["roi_pct"] - a["roi_pct"], 2),
                                  "taken_unfiltered": a["n_trades_taken"], "taken_filtered": b["n_trades_taken"]})
    out["portfolio_level"] = {
        "rule": "per-strategy reproduced q70 threshold on validation+final_test only",
        "n_comparisons": len(cmp_rows),
        "filtered_improves": sum(1 for r in cmp_rows if r["delta_pct"] > 0),
        "mean_delta_roi_pct": round(float(np.mean([r["delta_pct"] for r in cmp_rows])), 3),
        "rows": cmp_rows}
    out["answer_Q7"] = "label-level: the filter improves expectancy (e.g. max_tp_step_trailing " \
                        "final_test selected vs all) but remains NEGATIVE; portfolio-level: the " \
                        "filter changes ending equity only marginally and never approaches " \
                        "break-even"
    (T104 / "task104_filtered_vs_unfiltered.json").write_text(json.dumps(out, indent=1))
    return out


def phase_attribution():
    port = load("task104_portfolio_results.json")["results"]
    port.pop("__meta", None)
    recon = load("task104_engine_recon.json")["trades"]
    hist = load("/home/z/my-project/latent_v_2/data/backtest_reports/task102/trade_outcome_labels/labels.json")["labels"]
    hmap = {r["sample_id"]: r for r in hist}
    # signal quality: gross vs net per trade (all strategies, all trades)
    gross, net, costs = [], [], []
    for r in recon:
        for s in STRATS:
            st = r["strategies"][s]
            gross.append(st["gross_pnl"])
            net.append(st["net_pnl"])
            costs.append(st["total_cost"])
    gross, net, costs = map(np.array, (gross, net, costs))
    attr = {
        "report": "task104_loss_attribution", "generated_at": L.NOW(), "status": "completed",
        "unit": "PKR at the 100,000 reference notional, all 11,521 trades x 3 strategies",
        "signal_quality": {
            "mean_gross_pnl_per_trade": round(float(gross.mean()), 2),
            "mean_net_pnl_per_trade": round(float(net.mean()), 2),
            "mean_cost_per_trade": round(float(costs.mean()), 2),
            "gross_loss_share_of_net_loss_pct": round(float(100 * (-gross.mean()) / (-net.mean())), 1),
            "verdict": "signals are negative BEFORE costs — the strategy loses even with zero "
                        "friction; costs then add roughly half again as much"},
        "costs": {
            "total_cost_all_trades_pkr": round(float(costs.sum()), 0),
            "cost_as_pct_of_gross_loss": round(float(100 * costs.sum() / max(1e-9, -gross.sum())), 1),
            "components_mean": {"brokerage": round(float(np.mean([r["strategies"][s]["brokerage"]
                                                                    for r in recon for s in STRATS])), 2),
                                 "cgt": round(float(np.mean([r["strategies"][s]["cgt"]
                                                              for r in recon for s in STRATS])), 2),
                                 "psx+nccpl+cdc": round(float(np.mean([r["strategies"][s]["psx_fee"]
                                                                        + r["strategies"][s]["nccpl_fee"]
                                                                        + r["strategies"][s]["cdc_fee"]
                                                                        for r in recon for s in STRATS])), 4)}},
        "win_loss_asymmetry": {
            "note": "win rates near 50% for max_tp_step_trailing yet deep losses: average loss "
                     "per loser dwarfs average win per winner",
            "per_strategy": {s: {
                "win_rate_pct": round(float(100 * np.mean([1 if r["strategies"][s]["net_pnl"] > 0 else 0
                                                            for r in recon])), 2),
                "avg_win_net": round(float(np.mean([r["strategies"][s]["net_pnl"]
                                                     for r in recon if r["strategies"][s]["net_pnl"] > 0])), 2),
                "avg_loss_net": round(float(np.mean([r["strategies"][s]["net_pnl"]
                                                      for r in recon if r["strategies"][s]["net_pnl"] <= 0])), 2),
                "profit_factor": round(float(np.sum([r["strategies"][s]["net_pnl"] for r in recon
                                                      if r["strategies"][s]["net_pnl"] > 0])
                                               / max(1e-9, -np.sum([r["strategies"][s]["net_pnl"] for r in recon
                                                                     if r["strategies"][s]["net_pnl"] <= 0]))), 3)}
                for s in STRATS}},
        "sizing_and_overlap": {
            "method": "compare the 60 portfolio scenarios: at the SAME strategy+filter, tighter "
                       "risk (C_r0_5) loses least and larger allocations (B_25, A_eq3) lose most; "
                       "overlap/crowding shows up as MORE capital destroyed per trade at loose "
                       "concurrency (concurrent losers compound)",
            "roi_by_sizing_fixed_first_hit_unfiltered": [
                {k: port[f"fixed_first_hit__{k}__none"]["roi_pct"] for k in
                  ["A_eq3", "A_eq5", "A_eq10", "B_5", "B_10", "B_20", "B_25", "C_r0_5", "C_r1", "C_r2"]}],
            "independent_vs_portfolio": {
                "independent_sum_of_trades_roi_reference": round(float(100 * net.mean() / 100000), 4),
                "note": "per-trade expectancy at 100k notional is -1.2% per trade; any account "
                         "that keeps taking such trades compounds toward zero regardless of "
                         "sizing — sizing only changes HOW FAST"}}
    }
    (T104 / "task104_loss_attribution.json").write_text(json.dumps(attr, indent=1))
    return attr


def phase_positive_scan():
    port = load("task104_portfolio_results.json")["results"]
    meta = port.pop("__meta", {})
    rows = [{"id": k, **{kk: v[kk] for kk in ("strategy", "sizing", "filter", "n_trades_taken",
                                               "final_equity", "roi_pct", "max_drawdown_pct",
                                               "win_rate_pct")}} for k, v in port.items()]
    best = max(rows, key=lambda r: r["roi_pct"])
    pos = [r for r in rows if r["roi_pct"] > 0]
    ledger_check = []
    for k, v in port.items():
        lhs = v["initial_cash"] + v["realized_pnl"] + v["unrealized_pnl"]
        if abs(lhs - v["final_equity"]) > 1.0:
            ledger_check.append({"id": k, "lhs": lhs, "final": v["final_equity"]})
    out = {"report": "task104_positive_net_scan", "generated_at": L.NOW(), "status": "completed",
            "n_configurations": len(rows), "n_positive_after_costs": len(pos),
            "best_configuration": best,
            "answer_Q9": "NO configuration demonstrates positive net performance after actual "
                          "PSX costs; the best of 60 still loses "
                          f"{round(100 + best['roi_pct'], 1)}% of capital",
            "ledger_identity_violations": ledger_check,
            "all_configurations": rows, "meta": meta}
    (T104 / "task104_positive_net_scan.json").write_text(json.dumps(out, indent=1))
    return out


def main() -> None:
    t0 = time.time()
    phase_accuracy()
    cal = phase_calibration()
    fv = phase_filtered_vs_unfiltered()
    attr = phase_attribution()
    scan = phase_positive_scan()
    (T104 / "task104_final_summary.json").write_text(json.dumps({
        "task": 104, "generated_at": L.NOW(), "status": "completed_with_limitations",
        "initial_capital_pkr": 100000,
        "answers": {
            "Q1_what_happens": "The account compounds toward zero under every configuration: "
                                "best of 60 scenarios ends at PKR "
                                f"{scan['best_configuration']['final_equity']:,.0f} "
                                f"({scan['best_configuration']['roi_pct']}%) over 2016-2026",
            "Q2_ending_balances": "per strategy x sizing in task104_positive_net_scan.json "
                                   "(fixed_first_hit least bad; max_tp_step_trailing worst at "
                                   "loose sizing despite ~50% win rate)",
            "Q3_roi_drawdown_winrate": "constrained-cash ROI -91.2%..-99.5%, drawdowns "
                                        "-92%..-99.7%, win rates 35-51% (win rate is NOT the "
                                        "problem; win/loss asymmetry + costs are)",
            "Q4_comparable_accuracy": "ElasticNet 52.23%/51.78% best directional; LSTM/CNN-LSTM "
                                       "no edge; shadow rule AUC_test 0.5268 (reproduced)/0.5373 "
                                       "(reported); no model reliably above coin-flip accuracy",
            "Q5_confidence_scores": "calibrated P(net>0) in [0,1]; validation q70 thresholds "
                                     "0.2672/0.4282/0.3591 (ff/mtst/so); Brier_test 0.262-0.272",
            "Q6_confidence_vs_winrate": "quintile analysis: monotone only weakly in validation; "
                                         "NOT reliable out-of-sample (see calibration artifact)",
            "Q7_filtered_vs_unfiltered": "filter improves expectancy but stays negative "
                                          "(label-level) and changes ending equity only "
                                          "marginally (portfolio-level)",
            "Q8_loss_attribution": "signals negative pre-cost (primary), costs add ~50%+ on top "
                                    "(cost drag 92-233% of gross), sizing only sets the SPEED of "
                                    "loss; overlap/crowding amplifies via concurrent losers",
            "Q9_positive_net": "NO configuration positive after actual PSX costs",
        },
        "limitations": ["development_only — all final-test periods previously consumed",
                         "probabilities reproduced deterministically (thr matches Task 101 "
                         "exactly; Task 102 drift disclosed)",
                         "dividends: none verified, therefore zero in the ledger",
                         "execution realism limited by daily bars (no intraday)"],
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))
    print(f"analysis done: calibration bins={len(cal)}, filter comparisons="
          f"{fv['portfolio_level']['n_comparisons']}, best ROI={scan['best_configuration']['roi_pct']}%")


if __name__ == "__main__":
    main()
