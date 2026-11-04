#!/usr/bin/env python3
"""Task 110 phases 6-7: rolling variance estimators (close-to-close, Parkinson,
Garman-Klass — each annualized exactly once), BBW + first/second discrete
derivatives (session-adjacency guarded), volatility regime classification,
research guidance rules, and the options-market availability check."""
from __future__ import annotations
import math, statistics, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task110_lib as L
import task110_phases_research as R

VAR_WINDOW = 10
BBW_WINDOW = 20
BBW_K = 2.0
SERIES_TAIL = 500


def symbol_vol(ind: dict) -> dict:
    bars, sidx = ind["bars"], L.session_index()
    valid = [k for k in range(len(bars)) if bars[k]["valid"]]
    closes = [bars[k]["close"] if bars[k]["valid"] else None for k in range(len(bars))]
    opens = [bars[k]["open"] if bars[k]["valid"] else None for k in range(len(bars))]
    highs = [bars[k]["high"] if bars[k]["valid"] else None for k in range(len(bars))]
    lows = [bars[k]["low"] if bars[k]["valid"] else None for k in range(len(bars))]
    rets = L.log_returns(closes)
    cc_d = L.rolling_sample_variance(rets, VAR_WINDOW)
    pk_d = L.parkinson_daily_variance(highs, lows, VAR_WINDOW)
    gk_d = L.garman_klass_daily_variance(opens, highs, lows, closes, VAR_WINDOW)
    cc_a = [None if v is None else v * L.ANNUALIZATION for v in cc_d]
    pk_a = [None if v is None else v * L.ANNUALIZATION for v in pk_d]
    gk_a = [None if v is None else v * L.ANNUALIZATION for v in gk_d]
    gk_neg = [(bars[k]["date"], gk_d[k]) for k in range(len(gk_d)) if gk_d[k] is not None and gk_d[k] < 0]
    # BBW on the raw close series (population-consistent sample std, ddof=1)
    bbw, mid, sd = [], [], []
    for t in range(len(closes)):
        seg = closes[t - BBW_WINDOW + 1: t + 1] if t >= BBW_WINDOW - 1 else None
        if seg is None or any(v is None for v in seg):
            bbw.append(None); mid.append(None); sd.append(None)
            continue
        m = statistics.fmean(seg)
        s = statistics.stdev(seg)
        mid.append(m); sd.append(s)
        bbw.append(None if m <= 0 else (2 * BBW_K * s) / m)
    # adjacency guard: positions must be adjacent on the GLOBAL calendar
    gidx = [sidx.get(b["date"], None) for b in bars]
    bbw_d1 = L.first_diff(bbw, idx_by_pos=gidx)
    bbw_d2 = L.second_diff(bbw_d1, idx_by_pos=gidx)
    cc_d1 = L.first_diff(cc_a, idx_by_pos=gidx)
    cc_d2 = L.second_diff(cc_d1, idx_by_pos=gidx)
    pk_d1 = L.first_diff(pk_a, idx_by_pos=gidx)
    pk_d2 = L.second_diff(pk_d1, idx_by_pos=gidx)
    gk_d1 = L.first_diff(gk_a, idx_by_pos=gidx)
    gk_d2 = L.second_diff(gk_d1, idx_by_pos=gidx)
    return dict(closes=closes, cc_a=cc_a, pk_a=pk_a, gk_a=gk_a, gk_neg=gk_neg,
                bbw=bbw, bbw_d1=bbw_d1, bbw_d2=bbw_d2, cc_d1=cc_d1, cc_d2=cc_d2,
                pk_d1=pk_d1, pk_d2=pk_d2, gk_d1=gk_d1, gk_d2=gk_d2, mid=mid, sd=sd,
                gidx=gidx)


def p6_volatility(inds: dict):
    uni = sorted(inds)
    vols = {s: symbol_vol(inds[s]) for s in uni}
    # series CSV — last SERIES_TAIL valid observations per symbol (bounded)
    rows = []
    for s in uni:
        v, bars = vols[s], inds[s]["bars"]
        ks = [k for k in range(len(bars)) if bars[k]["valid"]][-SERIES_TAIL:]
        for k in ks:
            rows.append(dict(
                symbol=s, date=bars[k]["date"], close=v["closes"][k],
                cc_var_daily=(v["cc_a"][k] / L.ANNUALIZATION) if v["cc_a"][k] is not None else None,
                cc_var_annualized=v["cc_a"][k],
                cc_vol_annualized_pct=round(math.sqrt(v["cc_a"][k]) * 100, 4) if v["cc_a"][k] and v["cc_a"][k] > 0 else None,
                parkinson_var_daily=(v["pk_a"][k] / L.ANNUALIZATION) if v["pk_a"][k] is not None else None,
                parkinson_var_annualized=v["pk_a"][k],
                parkinson_vol_annualized_pct=round(math.sqrt(v["pk_a"][k]) * 100, 4) if v["pk_a"][k] and v["pk_a"][k] > 0 else None,
                gk_var_daily=(v["gk_a"][k] / L.ANNUALIZATION) if v["gk_a"][k] is not None else None,
                gk_var_annualized=v["gk_a"][k],
                gk_vol_annualized_pct=round(math.sqrt(v["gk_a"][k]) * 100, 4) if v["gk_a"][k] and v["gk_a"][k] > 0 else None,
                bbw=v["bbw"][k], valid_sample_count=VAR_WINDOW))
    fields = ["symbol", "date", "close", "cc_var_daily", "cc_var_annualized", "cc_vol_annualized_pct",
              "parkinson_var_daily", "parkinson_var_annualized", "parkinson_vol_annualized_pct",
              "gk_var_daily", "gk_var_annualized", "gk_vol_annualized_pct", "bbw", "valid_sample_count"]
    n = L.write_csv(L.T110 / "task110_volatility_series.csv", rows, fields)
    # derivatives CSV
    drows = []
    for s in uni:
        v, bars = vols[s], inds[s]["bars"]
        ks = [k for k in range(len(bars)) if bars[k]["valid"]][-SERIES_TAIL:]
        for k in ks:
            drows.append(dict(symbol=s, date=bars[k]["date"],
                              bbw_d1=v["bbw_d1"][k], bbw_d2=v["bbw_d2"][k],
                              cc_var_ann_d1=v["cc_d1"][k], cc_var_ann_d2=v["cc_d2"][k],
                              park_var_ann_d1=v["pk_d1"][k], park_var_ann_d2=v["pk_d2"][k],
                              gk_var_ann_d1=v["gk_d1"][k], gk_var_ann_d2=v["gk_d2"][k],
                              session_index=v["gidx"][k],
                              gap_note="derivative null when observations are not adjacent on the global session calendar"))
    L.write_csv(L.T110 / "task110_volatility_derivatives.csv", drows,
                ["symbol", "date", "bbw_d1", "bbw_d2", "cc_var_ann_d1", "cc_var_ann_d2",
                 "park_var_ann_d1", "park_var_ann_d2", "gk_var_ann_d1", "gk_var_ann_d2",
                 "session_index", "gap_note"])
    # estimator comparison (full history stats)
    comp = {}
    for s in uni:
        v = vols[s]
        def stat(xs):
            vals = [x for x in xs if x is not None]
            return dict(n=len(vals), mean=round(statistics.fmean(vals), 8) if vals else None,
                        median=round(statistics.median(vals), 8) if vals else None)
        comp[s] = dict(cc_annualized_var=stat(v["cc_a"]), parkinson_annualized_var=stat(v["pk_a"]),
                       garman_klass_annualized_var=stat(v["gk_a"]),
                       gk_negative_estimates=len(v["gk_neg"]),
                       gk_negative_examples=v["gk_neg"][:5],
                       note="GK<P is common in flat/low-range sessions; GK-P difference is NOT a directional indicator")
    L.artifact("task110_estimator_comparison.json", "task110_estimator_comparison", "completed",
               annualization="each estimator annualized exactly once (daily variance x 252); volatility = sqrt(annualized variance)",
               variance_window_sessions=VAR_WINDOW, sample_variance_convention="ddof=1",
               comparison=comp,
               units_check="series CSV exposes daily AND annualized variance; volatility columns are sqrt(annualized) x 100 (no double 252)")
    latest = {}
    for s in uni:
        v, bars = vols[s], inds[s]["bars"]
        k = len(bars) - 1
        latest[s] = dict(date=bars[k]["date"], close=v["closes"][k],
                         cc_var_ann=v["cc_a"][k], park_var_ann=v["pk_a"][k], gk_var_ann=v["gk_a"][k],
                         cc_vol_pct=round(math.sqrt(v["cc_a"][k]) * 100, 2) if v["cc_a"][k] and v["cc_a"][k] > 0 else None,
                         bbw=v["bbw"][k], bbw_d1=v["bbw_d1"][k], bbw_d2=v["bbw_d2"][k])
    L.artifact("task110_volatility_indicators_report.json", "task110_volatility_indicators_report", "completed",
               config=dict(variance_window=VAR_WINDOW, bbw_window=BBW_WINDOW, bollinger_k=BBW_K,
                           annualization=L.ANNUALIZATION, std_convention="sample (ddof=1)",
                           price_basis="raw close/high/low/open"),
               formulas=dict(cc="Var_CC = 252 x sampleVar(log returns, 10)",
                             parkinson="Var_P = 252 x mean[ln(H/L)^2]/(4 ln2)",
                             garman_klass="Var_GK = 252 x mean[0.5 ln(H/L)^2 - (2 ln2 - 1) ln(C/O)^2]",
                             bbw="(Upper-Lower)/Middle with Upper/Lower = SMA20 ± 2 sigma20"),
               negative_estimator_policy="GK negatives kept unclipped in research data; count + examples reported; vol shown unavailable where sqrt undefined",
               derivative_rule="first/second differences only across global-calendar-adjacent observations",
               latest=latest, series_rows=n,
               limitations=["realized volatility from delayed daily bars; NOT implied volatility",
                            "Parkinson/GK assume continuous sampling, zero drift; jumps distort GK downward/CC upward",
                            "raw unadjusted prices: corporate-action gaps contaminate log returns (flagged in adjustment report)"])


def p7_regimes(inds: dict):
    uni = sorted(inds)
    regimes, series = {}, {}
    for s in uni:
        v = symbol_vol(inds[s])
        bars = inds[s]["bars"]
        labels = []
        prev = None
        for k in range(len(bars)):
            r, reason = L.classify_regime(
                v["bbw"][k], v["bbw_d1"][k], v["bbw_d2"][k],
                v["pk_a"][k], v["gk_a"][k], v["pk_d1"][k], v["cc_d1"][k], prev)
            labels.append(dict(date=bars[k]["date"], regime=r, reason=reason))
            prev = r
        regimes[s] = dict(latest=labels[-1],
                          recent=[x for x in labels[-10:] if x["regime"] not in ("wait", "insufficient_data")][-5:])
        series[s] = labels
    L.artifact("task110_volatility_regimes.json", "task110_volatility_regimes", "completed",
               states=L.REGIME_STATES,
               persistence_rule="expansion/compression watches require BBW d1 AND d2 same-sign on current and previous observation + realized-variance d1 confirmation",
               interpretation_guardrails=[
                   "realized variance/BBW are NOT implied volatility",
                   "LONG_VOL_WATCH is an expansion indication, never an option-purchase signal",
                   "VOL_COMPRESSION_WATCH is not a short-premium signal (no verified PSX options data)",
                   "GK vs Parkinson difference is not a directional-trend indicator",
                   "price mean-reversion needs return evidence; volatility compression needs realized-vol evidence; short-vol needs option-market evidence — three separate hypotheses"],
               regimes_latest={s: regimes[s]["latest"] for s in uni},
               recent_watch_events={s: regimes[s]["recent"] for s in uni})
    guidance = dict(
        long_vol_watch=dict(condition="BBW d1>0 & d2>0 (persisting) + Parkinson or CC variance d1>0",
                            action="RESEARCH WATCH ONLY", executable=False,
                            note="expansion of realized vol; option profitability requires implied-vol data (unavailable)"),
        volatility_compression=dict(condition="BBW d1<0 & d2<0 (persisting) + realized-variance d1<0",
                                    action="RESEARCH WATCH ONLY", executable=False,
                                    note="distinct from short-option premium selling; no PSX options data to validate"),
        mean_reversion_watch=dict(condition="BBW d1<0 (single observation)",
                                  action="price/return study only", executable=False),
        volatility_expansion=dict(condition="BBW d1>0 (single observation)", action="monitor", executable=False),
        short_vol_watch=dict(condition="NOT ASSIGNED — requires verified option contract data, implied vol, permissions",
                             action="never generated from realized-vol data", executable=False),
        transition=dict(condition="regime label changed between observations", action="monitor", executable=False),
        wait=dict(condition="no condition met", action="none", executable=False),
        insufficient_data=dict(condition="warmup/gap", action="none", executable=False))
    L.artifact("task110_strategy_guidance_rules.json", "task110_strategy_guidance_rules", "completed",
               rules=guidance,
               enforcement="no module maps any regime to an order instruction; search of code paths is part of task110_tests.py (no-option-execution test)")
    # option market availability — provider has no options feed; PSX derivatives market
    # status verified against public sources during this task (see artifact note)
    L.artifact("task110_option_market_availability.json", "task110_option_market_availability",
               "blocked_options_data",
               provider_fields_available=["daily OHLCV (psxdata)", "delayed quote snapshots"],
               option_data_available=False,
               required_fields_missing=["option symbol/underlying", "expiry", "strike", "call/put",
                                        "bid", "ask", "last", "implied volatility", "open interest",
                                        "volume", "contract multiplier", "settlement rules",
                                        "margin requirements", "trading permissions"],
               psx_market_note="PSX's listed derivatives are limited; no equity-options feed exists in this project's provider and no retail options market-data access is configured. Long-convexity/short-volatility outputs remain descriptive research watches ONLY.",
               decision="blocked_options_data — regimes stay research_only; no option execution paths exist in the codebase")
    # signal validation: re-derive 40 random observations independently
    import random
    rnd = random.Random(110)
    checks = []
    for s in uni:
        v = symbol_vol(inds[s])
        bars = inds[s]["bars"]
        for _ in range(2):
            k = rnd.randrange(BBW_WINDOW + 2, len(bars))
            seg = [v["closes"][j] for j in range(k - BBW_WINDOW + 1, k + 1)]
            if any(x is None for x in seg):
                continue
            m = statistics.fmean(seg)
            sd = statistics.stdev(seg)
            bbw_re = (2 * BBW_K * sd) / m
            checks.append(dict(symbol=s, date=bars[k]["date"], bbw_engine=v["bbw"][k],
                               bbw_independent=bbw_re, match=abs(bbw_re - (v["bbw"][k] or 0)) < 1e-12))
            pk_terms = [math.log(bars[j]["high"] / bars[j]["low"]) ** 2 for j in range(k - VAR_WINDOW + 1, k + 1)
                        if bars[j]["valid"]]
            pk_re = (statistics.fmean(pk_terms) / (4 * L.LN2)) * L.ANNUALIZATION
            checks.append(dict(symbol=s, date=bars[k]["date"], park_engine=v["pk_a"][k],
                               park_independent=pk_re, match=abs(pk_re - v["pk_a"][k]) < 1e-9))
    L.artifact("task110_volatility_signal_validation.json", "task110_volatility_signal_validation", "completed",
               independent_recalculations=len(checks),
               all_match=all(c["match"] for c in checks),
               failed=[c for c in checks if not c["match"]][:5])
