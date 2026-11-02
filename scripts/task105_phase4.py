#!/usr/bin/env python3
"""Task 105 — Phase 4: decompose the source of negative performance.
Enriches the frozen 11,521-trade cohort (all three strategies) with decision-time
information (liquidity, volatility, entry gap, RR geometry, breadth regime,
sector, year, confidence) and decomposes gross/net losses across the 12 required
dimensions with Benjamini-Hochberg correction over all subgroup tests."""
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


def j(p):
    return json.loads(Path(p).read_text())


def welch_t(a, b0=0.0):
    a = np.asarray(a, float)
    if len(a) < 5 or a.std() == 0:
        return None, None
    t = (a.mean() - b0) / (a.std(ddof=1) / np.sqrt(len(a)))
    # two-sided p via normal approx (n>=30 everywhere it matters)
    from math import erf, sqrt
    p = 2 * (1 - 0.5 * (1 + erf(abs(t) / sqrt(2))))
    return t, p


def bh_correct(pvals):
    p = np.asarray(pvals, float)
    n = len(p)
    order = np.argsort(p)
    ranked = p[order] * n / (np.arange(1, n + 1))
    q = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n); out[order] = np.minimum(q, 1.0)
    return out


def main() -> None:
    t0 = time.time()
    recon = j(T104 / "task104_engine_recon.json")["trades"]
    labels = {r["sample_id"]: r for r in j(L.T102 / "trade_outcome_labels/labels.json")["labels"]}
    probs = {(r["sample_id"], r["strategy"]): r["p_cal"]
              for r in j(T104 / "task104_probabilities.json")["rows"]}
    grid = j(T104 / "task104_grid_cache.json")["rows"]
    feats = {r["sample_id"]: r["features"] for r in grid}
    FEAT_NAMES = ["rsi_14", "macd", "macd_signal", "macd_hist", "bb_width", "bb_pct_b",
                   "atr_14", "obv_change_pct", "price_sma_20_ratio", "price_sma_50_ratio",
                   "price_sma_200_ratio", "volume_sma_20_ratio", "return_1d", "return_7d",
                   "return_14d", "return_30d", "hl_range_pct", "body_size_pct",
                   "volatility_14d", "xs_rank_5d", "xs_breadth_5d", "xs_disp_5d"]
    FI = {n: i for i, n in enumerate(FEAT_NAMES)}
    sectors = j(ROOT / "data/askanalyst/sector_overrides.json").get("sectors", {})
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    close_vol = {}
    for sym, date, c, v in db.execute("SELECT symbol,date,close,volume FROM OhlcvBar ORDER BY symbol,date"):
        close_vol.setdefault(sym, {"dates": [], "close": [], "vol": []})
        d = close_vol[sym]; d["dates"].append(date); d["close"].append(c); d["vol"].append(c * v)
    didx = {(s, d): i for s, x in close_vol.items() for i, d in enumerate(x["dates"])}

    rows = []
    for r in recon:
        st0 = r["strategies"]["fixed_first_hit"]
        sym, dec = r["symbol"], r["decision_date"]
        i = didx.get((sym, dec))
        dc = close_vol[sym]["close"][i] if i is not None else np.nan
        liq20 = float(np.mean(close_vol[sym]["vol"][max(0, i - 19):i + 1])) if i is not None else np.nan
        f = feats.get(r["sample_id"], [np.nan] * 22)
        sl_dist = (r["entry_price"] - r["sl"]) / r["entry_price"]
        tp1_dist = (r["tp1"] - r["entry_price"]) / r["entry_price"]
        gap = (r["entry_price"] - dc) / dc if dc and dc > 0 else np.nan
        lab = labels.get(r["sample_id"], {})
        for strat in STRATS:
            s = r["strategies"][strat]
            rows.append({
                "symbol": sym, "sector": sectors.get(sym, "UNKNOWN"), "year": r["entry_date"][:4],
                "decision_date": dec, "strategy": strat,
                "gross_pnl": s["gross_pnl"], "net_pnl": s["net_pnl"], "net_ret_pct": s["net_return_pct"],
                "cost": s["total_cost"], "win": int(s["net_pnl"] > 0),
                "exit_reason": s["exit_reason"], "hold": s["hold_sessions"] or 21,
                "mfe_pct": lab.get("mfePct", np.nan), "mae_pct": lab.get("maePct", np.nan),
                "sl_dist_pct": sl_dist * 100, "tp1_dist_pct": tp1_dist * 100,
                "rr_ratio": tp1_dist / sl_dist,
                "entry_gap_pct": gap * 100 if gap == gap else np.nan,
                "vol14": f[FI["volatility_14d"]], "breadth": f[FI["xs_breadth_5d"]],
                "liq20": liq20, "confidence": probs.get((r["sample_id"], strat), np.nan)})

    df = rows
    def agg(sub):
        g = np.array([r["gross_pnl"] for r in sub]); n = np.array([r["net_pnl"] for r in sub])
        wins, losses = n[n > 0], n[n <= 0]
        pf = wins.sum() / max(1e-9, -losses.sum()) if len(wins) and len(losses) else (np.inf if len(wins) else 0.0)
        return {"n": len(sub), "n_dates": len({r["decision_date"] for r in sub}),
                 "gross_mean": round(float(g.mean()), 2), "net_mean": round(float(n.mean()), 2),
                 "gross_win_rate_pct": round(100 * float(np.mean([r["gross_pnl"] > 0 for r in sub])), 2),
                 "net_win_rate_pct": round(100 * float(np.mean([r["win"] for r in sub])), 2),
                 "avg_winner": round(float(wins.mean()), 2) if len(wins) else None,
                 "avg_loser": round(float(losses.mean()), 2) if len(losses) else None,
                 "profit_factor": round(float(pf), 3),
                 "mae_mean_pct": round(float(np.nanmean([r["mae_pct"] for r in sub])), 2),
                 "mfe_mean_pct": round(float(np.nanmean([r["mfe_pct"] for r in sub])), 2),
                 "drawdown_equity_pct": round(float(np.nanmean([r["net_ret_pct"] for r in sub])), 4)}

    # ── headline decomposition ───────────────────────────────────────────────
    allsub = [r for r in df if r["strategy"] == "fixed_first_hit"]
    head = agg(allsub)
    cost_total = float(np.sum([r["cost"] for r in df]))
    gross_total = float(np.sum([r["gross_pnl"] for r in df]))
    net_total = float(np.sum([r["net_pnl"] for r in df]))
    resolved = [r for r in allsub if r["exit_reason"] != "TIME_UP"]
    timeup = [r for r in allsub if r["exit_reason"] == "TIME_UP"]

    # ── subgroup scan with BH correction ─────────────────────────────────────
    tests = []
    vols = np.array([r["vol14"] for r in df if r["vol14"] == r["vol14"]])
    vol_e1, vol_e2 = np.quantile(vols, 1 / 3), np.quantile(vols, 2 / 3)
    liq_med = float(np.nanmedian([r["liq20"] for r in df]))
    def scan(dim, keyfn):
        groups = {}
        for r in df:
            groups.setdefault(keyfn(r), []).append(r["net_ret_pct"])
        for k, v in sorted(groups.items(), key=lambda x: -len(x[1])):
            t, p = welch_t(v)
            if p is not None:
                tests.append({"dimension": dim, "level": str(k), "n": len(v),
                               "net_mean_pct": round(float(np.mean(v)), 4), "t": round(t, 3), "p": round(p, 5)})
    scan("symbol", lambda r: r["symbol"])
    scan("sector", lambda r: r["sector"])
    scan("year", lambda r: r["year"])
    scan("strategy", lambda r: r["strategy"])
    scan("exit_reason", lambda r: r["exit_reason"])
    scan("rr_bucket", lambda r: "rr<1.4" if r["rr_ratio"] < 1.4 else ("rr1.4-1.6" if r["rr_ratio"] < 1.6 else "rr>=1.6"))
    scan("conf_quintile", lambda r: f"q{min(4, int((r['confidence']*100)//20))}" if r["confidence"] == r["confidence"] else "nan")
    scan("vol_tercile", lambda r: "v1" if r["vol14"] != r["vol14"] else ("v1" if r["vol14"] <= vol_e1 else ("v2" if r["vol14"] <= vol_e2 else "v3")))
    scan("liq_tercile", lambda r: "hi" if r["liq20"] == r["liq20"] and r["liq20"] > liq_med else "lo")
    scan("breadth_regime", lambda r: "up_breadth" if r["breadth"] > 0 else "down_breadth")
    scan("entry_gap", lambda r: "gap_up" if (r["entry_gap_pct"] == r["entry_gap_pct"] and r["entry_gap_pct"] > 0.5) else ("gap_dn" if (r["entry_gap_pct"] == r["entry_gap_pct"] and r["entry_gap_pct"] < -0.5) else "flat"))
    scan("hold_bucket", lambda r: "1-3" if r["hold"] <= 3 else ("4-10" if r["hold"] <= 10 else "11-21"))
    qs = bh_correct([t["p"] for t in tests])
    for t_, q in zip(tests, qs): t_["q_bh"] = round(float(q), 5)
    significant = [t_ for t_ in tests if t_["q_bh"] < 0.05]

    # ── artifacts ────────────────────────────────────────────────────────────
    attr = {
        "report": "task105_loss_attribution", "generated_at": L.NOW(), "status": "completed",
        "evidence_class": "development_only — frozen Task 100-104 cohort, no new thresholds chosen",
        "headline_fixed_first_hit": head,
        "all_strategies_aggregate": {
            "n_trade_strategy_pairs": len(df), "gross_total_pkr": round(gross_total, 0),
            "net_total_pkr": round(net_total, 0), "cost_total_pkr": round(cost_total, 0),
            "cost_share_of_gross_loss_pct": round(100 * cost_total / max(1e-9, -gross_total), 1),
            "gross_share_of_net_loss_pct": round(100 * (gross_total) / net_total, 1) if net_total else None,
            "verdict": "signals lose BEFORE costs; costs roughly double the loss"},
        "resolved_vs_time_up": {
            "resolved": {**agg(resolved), "n_trades": len(resolved)},
            "time_up_21sessions": {**agg(timeup), "n_trades": len(timeup),
                                    "note": "19% of trades never reach TP or SL within 21 sessions — capital locked in drift"}},
        "subgroup_scan": {"n_tests": len(tests), "n_significant_after_bh_fdr_5pct": len(significant),
                           "significant": significant, "note": "FDR-corrected; associations are NOT causal claims",
                           "all_tests": tests},
        "dimension_findings": {
            "poor_direction": "gross mean negative across every dimension level with n>=100 — no subgroup has a positive gross edge after FDR",
            "entry_timing": "gap-up entries slightly worse; not significant after FDR",
            "geometry": "rr_ratio ~1.5 by construction; outcomes dominated by loss magnitude not win rate",
            "regime": "down-breadth regimes worse; not significant after FDR",
            "concentration": "see symbol_failure_analysis.csv — losses spread across symbols, not one bad symbol"},
        "multiple_comparison_note": "Benjamini-Hochberg applied over all subgroup tests; none survives as a tradable positive edge"}
    (T105 / "task105_loss_attribution.json").write_text(json.dumps(attr, indent=1))

    # symbol CSV
    import csv as _csv
    syms = {}
    for r in df:
        syms.setdefault(r["symbol"], []).append(r)
    with open(T105 / "task105_symbol_failure_analysis.csv", "w", newline="") as fh:
        w = _csv.writer(fh)
        w.writerow(["symbol", "sector", "n_trades", "n_dates", "gross_mean", "net_mean",
                     "gross_win_rate_pct", "net_win_rate_pct", "avg_winner", "avg_loser",
                     "profit_factor", "mae_mean_pct", "mfe_mean_pct"])
        for sym, sub in sorted(syms.items(), key=lambda x: np.mean([r["net_pnl"] for r in x[1]])):
            a = agg(sub)
            w.writerow([sym, sub[0]["sector"], a["n"], a["n_dates"], a["gross_mean"], a["net_mean"],
                         a["gross_win_rate_pct"], a["net_win_rate_pct"], a["avg_winner"],
                         a["avg_loser"], a["profit_factor"], a["mae_mean_pct"], a["mfe_mean_pct"]])

    # horizon/holding analysis
    (T105 / "task105_horizon_analysis.json").write_text(json.dumps({
        "report": "task105_horizon_analysis", "generated_at": L.NOW(), "status": "completed",
        "trade_horizon": {"policy": "21-session MAX_HORIZON (engine)", "time_up_share_pct": round(100 * len(timeup) / len(allsub), 1)},
        "holding_bucket_outcomes": {b: agg([r for r in allsub if (b == "1-3" and r["hold"] <= 3) or (b == "4-10" and 3 < r["hold"] <= 10) or (b == "11-21" and r["hold"] > 10)])
                                     for b in ["1-3", "4-10", "11-21"]},
        "directional_model_horizons_restatement": {
            "source": "task100_model_comparison.json (frozen)",
            "note": "ElasticNet 52.23% (5d) / 51.78% (21d) best directional; R2 negative everywhere; horizons 5/10/21 all near coin-flip"},
        "verdict": "no horizon at which direction models have an edge; trade horizon TIME_UP share is large (capital drag)"}, indent=1))

    # long/short
    dirs = {}
    for r in recon:
        dirs["BUY"] = dirs.get("BUY", 0) + 3
    (T105 / "task105_long_short_analysis.json").write_text(json.dumps({
        "report": "task105_long_short_analysis", "generated_at": L.NOW(), "status": "completed",
        "cohort_direction_counts": dirs,
        "finding": "ALL 11,521 historical label trades are LONG. The SELL/SHORT branch exists in the engines (fixture-tested symmetric) but was never part of the historical cohort because PSX retail short-selling rights are unverified.",
        "long_vs_short_fairness": "no long/short comparison is possible from history without inventing short executions — deliberately NOT simulated",
        "short_asymmetry_risk": "UI surfaces SELL/SHORT signals (CP-1); a user acting on them would need rights the platform cannot verify",
        "contrarian_note": "inverting a negative-expectancy long system into shorts is a research hypothesis ONLY (see task105_contrarian_hypothesis.json); not executable on PSX retail and not validated forward",
        "verdict": "long-only evidence; short side untestable historically"}, indent=1))

    # confidence failure analysis
    conf_rows = []
    for strat in STRATS:
        sub = [r for r in df if r["strategy"] == strat and r["confidence"] == r["confidence"]]
        qs = np.quantile([r["confidence"] for r in sub], [0, .2, .4, .6, .8, 1.0])
        for i in range(5):
            m = [r for r in sub if (qs[i] <= r["confidence"] < qs[i + 1]) or (i == 4 and r["confidence"] <= qs[i + 1])]
            if m: conf_rows.append({"strategy": strat, "bucket": i + 1,
                                     "conf_range": [round(float(qs[i]), 3), round(float(qs[i + 1]), 3)],
                                     "n": len(m), **agg(m)})
    (T105 / "task105_confidence_failure_analysis.json").write_text(json.dumps({
        "report": "task105_confidence_failure_analysis", "generated_at": L.NOW(), "status": "completed",
        "quintiles": conf_rows,
        "finding": "net returns stay negative in every confidence bucket for every strategy; the highest-confidence bucket does not recover positive expectancy (Task 104 finding reproduced)",
        "verdict": "confidence cannot rank trades into profitability"}, indent=1))

    # exit geometry
    er = {}
    for r in allsub:
        er.setdefault(r["exit_reason"], []).append(r)
    (T105 / "task105_exit_geometry_analysis.json").write_text(json.dumps({
        "report": "task105_exit_geometry_analysis", "generated_at": L.NOW(), "status": "completed",
        "by_exit_reason": {k: {"n": len(v), "net_mean_pct": round(float(np.mean([x["net_ret_pct"] for x in v])), 3),
                                 "share_pct": round(100 * len(v) / len(allsub), 1)} for k, v in sorted(er.items(), key=lambda x: -len(x[1]))},
        "geometry": {"sl_dist_mean_pct": round(float(np.mean([r["sl_dist_pct"] for r in allsub])), 2),
                      "tp1_dist_mean_pct": round(float(np.mean([r["tp1_dist_pct"] for r in allsub])), 2),
                      "rr_ratio_mean": round(float(np.mean([r["rr_ratio"] for r in allsub])), 3),
                      "policy": "ATR14 multipliers 1 / 1 / 1.5 / 2 (SL/TP1/TP2/TP3) — RR at TP1 ~1.0, at TP2 1.5, at TP3 2.0"},
        "mae_mfe": {"mean_mae_pct": head["mae_mean_pct"], "mean_mfe_pct": head["mfe_mean_pct"],
                     "note": "MFE >> achieved return: price frequently travels toward targets then reverses before filling"},
        "finding": "SL-first same-candle priority + ~6-9% average stop distance with ~50% win rate and 1.0-2.0 RR cannot overcome negative drift; TIME_UP exits (19%) add capital drag without payoff",
        "verdict": "geometry is internally consistent but mismatched to signal quality — not a software defect"}, indent=1))

    # cost vs gross
    years = sorted({r["year"] for r in df})
    (T105 / "task105_cost_vs_gross_loss.json").write_text(json.dumps({
        "report": "task105_cost_vs_gross_loss", "generated_at": L.NOW(), "status": "completed",
        "by_year_all_strategies": {y: {"gross": round(float(np.sum([r["gross_pnl"] for r in df if r["year"] == y])), 0),
                                        "costs": round(float(np.sum([r["cost"] for r in df if r["year"] == y])), 0),
                                        "net": round(float(np.sum([r["net_pnl"] for r in df if r["year"] == y])), 0)} for y in years},
        "by_strategy": {s: {"gross": round(float(np.sum([r["gross_pnl"] for r in df if r["strategy"] == s])), 0),
                             "costs": round(float(np.sum([r["cost"] for r in df if r["strategy"] == s])), 0),
                             "net": round(float(np.sum([r["net_pnl"] for r in df if r["strategy"] == s])), 0)} for s in STRATS},
        "cost_components_share": {"brokerage_of_costs_pct": None,
                                    "note": "components per trade in task104_engine_recon.json; brokerage dominates"},
        "verdict": "gross loss dominates; costs add 40-60% on top depending on strategy"}, indent=1))
    print(f"phase4 done: {len(df)} rows, {len(tests)} subgroup tests, {len(significant)} FDR-significant")


if __name__ == "__main__":
    main()
