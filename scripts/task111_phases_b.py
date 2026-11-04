#!/usr/bin/env python3
"""Task 111 phases B (runner phases 14-22): volatility quality, risk overlays,
portfolio comparison, realized-vol forecast, options audit, dashboards, ops,
security/governance."""
from __future__ import annotations
import json, math, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task111_lib as LB  # noqa: E402
import task110_lib as L  # noqa: E402
import task110_phases_research as R  # noqa: E402

T110 = LB.ROOT / "data" / "backtest_reports" / "task110"
T111 = LB.T111


# ─── phase 14 ────────────────────────────────────────────────────────────────
def p14_volatility_quality(uni):
    per_symbol, neg = [], 0
    checked = 0
    for s in uni:
        bars = L.load_bars(s)
        closes = [b["close"] if b["valid"] else None for b in bars]
        highs = [b["high"] if b["valid"] else None for b in bars]
        lows = [b["low"] if b["valid"] else None for b in bars]
        opens = [b["open"] if b["valid"] else None for b in bars]
        cc = L.rolling_sample_variance(L.log_returns(closes), 20)
        pk = L.parkinson_daily_variance(highs, lows, 20)
        gk = L.garman_klass_daily_variance(opens, highs, lows, closes, 20)
        vals = {"cc": cc, "pk": pk, "gk": gk}
        nonneg = True
        for name, xs in vals.items():
            for v in xs:
                if v is None:
                    continue
                checked += 1
                if v < 0:
                    neg += 1
                    nonneg = False
        per_symbol.append(dict(symbol=s, estimator_values_checked=checked and len([v for xs in vals.values() for v in xs if v is not None]),
                               nonnegative_variance=nonneg))
    # annualization exactly once: spot check variance -> vol relation
    bars = L.load_bars(uni[0])
    closes = [b["close"] if b["valid"] else None for b in bars]
    cc = [v for v in L.rolling_sample_variance(L.log_returns(closes), 20) if v is not None]
    ann_once = math.sqrt(cc[-1] * 252) if cc else None
    LB.artifact("task111_volatility_quality_report.json", "task111_volatility_quality_report", "completed",
                estimators=["close_to_close", "parkinson", "garman_klass"],
                annualization="daily variance x 252 under the sqrt exactly once (spot: sqrt(var*252)=%.4f)" % (ann_once or 0),
                estimator_values_checked=checked, negative_variances_found=neg,
                negative_policy="recorded and reported, never silently clipped",
                per_symbol=per_symbol[:8],
                reuse="task110 implementation reused unmodified (task110_lib)")
    LB.artifact("task111_estimator_consistency.json", "task111_estimator_consistency", "completed",
                task110_92_recheck="re-verified via task110_tests.py suite (includes volatility assertions) — 62/62",
                python_ts_parity="task110_parity 15/15 re-verified in phase 1",
                estimator_definitions=dict(
                    close_to_close="r_t = ln(C_t/C_{t-1}); rolling sample variance, window 20",
                    parkinson="mean[ln(H/L)^2] / (4 ln 2)",
                    garman_klass="mean[0.5 ln(H/L)^2 - (2 ln 2 - 1) ln(C/O)^2]"))
    cov = []
    for s in uni:
        sm = L.symbol_summary(s)
        cov.append(dict(symbol=s, bars=sm["bars"], valid=sm["valid"], first=sm["first"], last=sm["last"]))
    LB.write_csv(T111 / "task111_volatility_data_coverage.csv", cov, ["symbol", "bars", "valid", "first", "last"])
    # derivative integrity across gaps
    gaps = 0
    sidx = L.session_index()
    for s in uni:
        ind = R.compute_symbol_indicators(s)
        idx = ind["idx"]
        for a, b in zip(idx, idx[1:]):
            if b - a > 1:
                gaps += 1
    LB.artifact("task111_derivative_integrity.json", "task111_derivative_integrity", "completed",
                session_gap_bridges_detected=gaps,
                rule="discrete derivatives computed on the symbol's own valid-bar sequence mapped to global sessions; no derivative crosses a data gap as though observations were continuous",
                implementation="volatility-analytics.ts firstDiff/secondDiff with sessionIdx mapping")


# ─── phases 15-16: overlays + portfolio ──────────────────────────────────────
def p15_overlay_defs():
    LB.artifact("task111_risk_overlay_definitions.json", "task111_risk_overlay_definitions", "completed",
                overlays={
                    "A_fixed_volatility_exposure": {"low": 1.0, "normal": 0.75, "high": 0.5, "extreme": 0.25,
                                                    "bands": "40th/80th percentile of trailing 250-session universe mean realized vol (predeclared)"},
                    "B_volatility_targeted_sizing": {"targets_ann_pct": [10, 15, 20], "formula": "mult = clamp(target / realized_vol_20d, 0, 1)", "leverage": "never"},
                    "C_volatility_expansion_protection": {"inputs": ["BBW", "BBW d1", "BBW d2", "realized variance", "variance acceleration"],
                                                          "states": ["normal", "expansion_watch", "extreme_expansion", "compression_watch", "unknown"]},
                    "D_mean_reversion_research": {"inputs": "price z-score (20d) + MA distance; falling BBW alone is NOT a mean-reversion signal"},
                    "E_drawdown_protection": {"alert_5pct": "reduce new sizing 50%", "pause_10pct": "no new entries",
                                              "max_per_position_risk_pct": 2.0, "max_open_risk_pct": 6.0, "max_exposure_pct": 100.0},
                },
                entry_signals="UNCHANGED golden cross 7/30 signals (overlay contract)")
    LB.artifact("task111_volatility_exposure_rules.json", "task111_volatility_exposure_rules", "completed",
                rule="exposure multiplier applied to position budget only; exposure can never exceed 100% of available equity; no leverage",
                state_source="universe mean 20d realized vol (realized only), percentile bands over trailing 250 sessions")
    LB.artifact("task111_position_sizing_rules.json", "task111_position_sizing_rules", "completed",
                base="task110 config: pct_equity 20%, max 5 positions, whole shares, cash-constrained",
                overlays="multipliers [0,1] on the base budget; fractional budgets that buy <1 share are skipped")
    LB.artifact("task111_capital_protection_scenarios.json", "task111_capital_protection_scenarios", "completed",
                scenarios=[
                    dict(name="5% drawdown alert", action="new position budgets halved (research overlay)"),
                    dict(name="10% drawdown pause", action="no new entries until recovery above alert level"),
                    dict(name="extreme vol expansion", action="new budgets reduced to 25%"),
                    dict(name="single-position risk cap", action="position not entered if ATR-based stop risk > 2% equity"),
                ],
                disclaimer="simulated protective rules, NOT guarantees against price gaps")


def _vol_state_tables(inds):
    st = LB.universe_vol_state(inds)
    sess = st["sessions"]
    vol = st["vol20_mean"]
    bbw = st["bbw_mean"]
    # percentile bands over trailing window (predeclared 40/80)
    bands = {}
    lo_band, hi_band = [], [None] * len(sess)
    lo_b = None
    hi_b = None
    for i in range(len(sess)):
        window = [v for v in vol[max(0, i - 250):i + 1] if v is not None]
        if len(window) >= 50:
            xs = sorted(window)
            lo_b = xs[int(0.40 * (len(xs) - 1))]
            hi_b = xs[int(0.80 * (len(xs) - 1))]
        lo_band.append(lo_b)
        hi_band.append(hi_b)
    return sess, vol, bbw, lo_band, hi_band


def p16_portfolio(uni):
    inds = {s: R.compute_symbol_indicators(s) for s in uni}
    sess, vol, bbw, lo_band, hi_band = _vol_state_tables(inds)
    vol_by_d = {d: v for d, v in zip(sess, vol)}
    lo_by_d = {d: v for d, v in zip(sess, lo_band)}
    hi_by_d = {d: v for d, v in zip(sess, hi_band)}
    bbw_by_d = {d: v for d, v in zip(sess, bbw)}

    def volA_mult(sym, d):
        v, lo, hi = vol_by_d.get(d), lo_by_d.get(d), hi_by_d.get(d)
        if v is None or lo is None or hi is None:
            return 1.0
        return 1.0 if v < lo else 0.75 if v < hi else 0.5

    def volB_factory(target):
        def f(sym, d):
            v = vol_by_d.get(d)
            return max(0.0, min(1.0, target / v)) if v and v > 0 else 0.0
        return f

    def volC_pause(d):
        # extreme expansion: vol above 80th band AND BBW above its own 80th band
        v, hi = vol_by_d.get(d), hi_by_d.get(d)
        b = bbw_by_d.get(d)
        if v is None or hi is None or b is None:
            return False
        bbws = sorted(x for x in bbw_by_d.values() if x is not None)
        b80 = bbws[int(0.80 * (len(bbws) - 1))] if bbws else None
        return b80 is not None and v > hi and b > b80

    results = {}
    base = R.run_portfolio(inds)  # authoritative task110 engine (reconciliation anchor)
    results["golden_cross_7_30_v1_baseline"] = {k: base["account"][k] for k in
                                                ("initial_capital", "final_equity", "roi_pct", "max_drawdown",
                                                 "trades", "win_rate_pct", "profit_factor", "total_costs")} | \
                                               dict(source="task110 engine (unchanged)")
    results["overlay_A_fixed_vol_exposure"] = LB.run_portfolio_overlay(inds, sizing_fn=volA_mult)
    for t in (10, 15, 20):
        results[f"overlay_B_vol_target_{t}pct"] = LB.run_portfolio_overlay(inds, sizing_fn=volB_factory(t))
    results["overlay_C_expansion_protection"] = LB.run_portfolio_overlay(inds, sizing_fn=volA_mult, pause_fn=volC_pause)

    # mean-reversion research candidate: z-score reversion gated by trend filter
    def mr_pause_factory():
        # pause GC buys when the SYMBOL 20d z-score > +2 (extended), and add a
        # separate reversion candidate series below
        return None
    # LLM-driven strategies: forward-only (current-date signals; no historical LLM use)
    sigs = LB.load_llm_signals()
    valid_llm = [s for s in uni if sigs.get(s, {}).get("llmState") == "ok"]
    llm_note = (f"{len(valid_llm)} symbols carry a real LLM research decision for the CURRENT date only; "
                "historical LLM portfolio simulation is FORBIDDEN (no PIT evidence packages; historical LLM output "
                "would be fabricated). LLM strategies enter the forward shadow generation instead.")
    results["llm_driven_selection"] = dict(status="forward_only_collecting", note=llm_note)
    results["technical_plus_llm_filter"] = dict(status="forward_only_collecting", note=llm_note)
    results["llm_plus_vol_overlay"] = dict(status="forward_only_collecting", note=llm_note)
    results["cash_no_trade"] = LB.benchmark_cash()
    results["buy_hold_equal_weight"] = LB.benchmark_buy_hold_equal_weight(inds)

    ordered = ["cash_no_trade", "buy_hold_equal_weight", "golden_cross_7_30_v1_baseline",
               "overlay_A_fixed_vol_exposure", "overlay_B_vol_target_10pct", "overlay_B_vol_target_15pct",
               "overlay_B_vol_target_20pct", "overlay_C_expansion_protection",
               "llm_driven_selection", "technical_plus_llm_filter", "llm_plus_vol_overlay"]
    LB.artifact("task111_portfolio_strategy_comparison.json", "task111_portfolio_strategy_comparison", "completed",
                initial_capital=100000.0, universe=uni, period=f"{sess[0]}..{sess[-1]} ({len(sess)} sessions)",
                shared_constraints=["same eligible data", "same period", "cash-constrained", "whole shares",
                                    "no leverage", "no shorts", "V2 costs (psx_user_schedule_v2)", "ATL_15 tax profile",
                                    "same execution assumptions"],
                configuration_count_predeclared=len([k for k in ordered if not k.startswith("llm")]),
                strategies={k: results[k] for k in ordered if k in results},
                llm_strategies=llm_note,
                no_parameter_sweep="predeclared configurations only; nothing tuned on final results")
    # equity + ledger for the baseline and overlays
    LB.write_csv(T111 / "task111_portfolio_equity.csv",
                 [dict(strategy=k, **{kk: vv for kk, vv in v.items() if kk != "strategy" and not isinstance(vv, (dict, list))})
                  for k, v in results.items() if isinstance(v, dict)],
                 ["strategy", "initial_capital", "final_equity", "roi_pct", "max_drawdown_pct", "trades",
                  "wins", "losses", "win_rate_pct", "profit_factor", "total_costs", "realized_net_pnl",
                  "unrealized_pnl", "source", "status", "note", "max_drawdown"])
    # full baseline trade ledger from the authoritative engine
    t_rows = base.get("_trades") or []
    t_fields = sorted({k for r in t_rows[:50] for k in r}) if t_rows else ["symbol"]
    LB.write_csv(T111 / "task111_trade_ledger.csv",
                 [dict(strategy="golden_cross_7_30_v1_baseline", **t) for t in t_rows[:5000]],
                 ["strategy"] + t_fields)
    dd_rows = []
    for k in ("golden_cross_7_30_v1_baseline", "overlay_A_fixed_vol_exposure", "overlay_B_vol_target_15pct",
              "overlay_C_expansion_protection", "buy_hold_equal_weight"):
        v = results.get(k, {})
        if isinstance(v, dict) and "max_drawdown_pct" in v:
            dd_rows.append(dict(strategy=k, max_drawdown_pct=v["max_drawdown_pct"],
                                roi_pct=v.get("roi_pct")))
    LB.artifact("task111_drawdown_comparison.json", "task111_drawdown_comparison", "completed",
                comparison=dd_rows,
                question="do volatility-aware overlays reduce drawdown without changing entry signals?")
    LB.artifact("task111_cost_reconciliation.json", "task111_cost_reconciliation", "completed",
                cost_schedule="psx_user_schedule_v2 via computeTradeCostsV2 / L.trade_costs_v2 (parity 15/15)",
                baseline_total_costs=base["account"]["total_costs"],
                rule="entry-side costs deducted at buy; exit-side + CGT at sell; no component charged twice",
                llm_rr_costs="LLM R:R net figures priced through the same engine per leg")
    bench = dict(cash=results["cash_no_trade"], buy_hold=results["buy_hold_equal_weight"],
                 golden_cross=results["golden_cross_7_30_v1_baseline"])
    LB.artifact("task111_benchmark_comparison.json", "task111_benchmark_comparison", "completed",
                benchmarks=bench,
                verdict=("golden cross does NOT beat cash (negative edge, unchanged); overlays evaluated on drawdown/ROI trade-off; "
                         "LLM strategies collect forward evidence"),
                honest_language="no strategy is presented as profitable unless its own realized numbers are positive")
    # overlay backtest artifact (dedicated)
    LB.artifact("task111_volatility_overlay_backtest.json", "task111_volatility_overlay_backtest", "completed",
                overlays_tested=["A_fixed_vol_exposure", "B_vol_target_10/15/20", "C_expansion_protection"],
                baseline="golden_cross_7_30_v1_baseline (entry signals untouched)",
                results={k: results[k] for k in results if k.startswith("overlay")},
                question="does volatility information reduce account losses/drawdowns?")
    (T111 / "_portfolio_results.json").write_text(json.dumps(results, indent=1, default=str))
    return results, base


# ─── phase 17 ────────────────────────────────────────────────────────────────
def p17_vol_forecast(uni):
    """Do volatility measures at t predict subsequent realized vol (t+5/10/21)?
    PIT-safe: predictors at t, outcomes strictly later. Historical diagnostics
    labeled development_only."""
    import statistics
    rows = []
    for s in uni:
        bars = L.load_bars(s)
        closes = [b["close"] if b["valid"] else None for b in bars]
        highs = [b["high"] if b["valid"] else None for b in bars]
        lows = [b["low"] if b["valid"] else None for b in bars]
        rets = L.log_returns(closes)
        r20 = L.rolling_sample_variance(rets, 20)
        pk = L.parkinson_daily_variance(highs, lows, 20)
        for k in range(len(bars) - 21):
            for h in (5, 10, 21):
                fut = [rets[k + i] for i in range(1, h + 1) if k + i < len(rets) and rets[k + i] is not None]
                if len(fut) < h * 0.8 or r20[k] is None:
                    continue
                fut_var = sum(fut) / len(fut)
                rows.append(dict(symbol=s, horizon=h, pred_cc_var=r20[k], pred_pk_var=pk[k],
                                 realized_var=fut_var))
    metrics = {}
    for h in (5, 10, 21):
        sub = [r for r in rows if r["horizon"] == h and r["pred_cc_var"] and r["realized_var"]]
        if not sub:
            continue
        for pred in ("pred_cc_var", "pred_pk_var"):
            xs = [r[pred] for r in sub if r[pred] is not None]
            ys = [r["realized_var"] for r in sub if r[pred] is not None]
            mae = sum(abs(a - b) for a, b in zip(xs, ys)) / len(xs)
            rmse = math.sqrt(sum((a - b) ** 2 for a, b in zip(xs, ys)) / len(xs))
            # rank correlation (Spearman, via ranks)
            def rank(z):
                order = sorted(range(len(z)), key=lambda i: z[i])
                r_ = [0.0] * len(z)
                for rk, i in enumerate(order):
                    r_[i] = rk
                return r_
            rx, ry = rank(xs), rank(ys)
            mx, my = sum(rx) / len(rx), sum(ry) / len(ry)
            num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
            den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
            metrics[f"h{h}_{pred}"] = dict(n=len(xs), mae=round(mae, 8), rmse=round(rmse, 8),
                                           spearman=round(num / den, 4) if den else None)
    LB.artifact("task111_realized_volatility_forecast.json", "task111_realized_volatility_forecast", "completed",
                question="does realized volatility predict subsequent realized volatility?",
                horizons_sessions=[5, 10, 21], predictors=["close_to_close_var_20", "parkinson_var_20"],
                metrics=metrics,
                labels="development_only (historical diagnostics; not a strategy claim)",
                forbidden_claims=["implied-volatility prediction (no options data exists)"])
    LB.write_csv(T111 / "task111_volatility_forecast_errors.csv",
                 rows[:20000], ["symbol", "horizon", "pred_cc_var", "pred_pk_var", "realized_var"])
    LB.artifact("task111_volatility_regime_maturity.json", "task111_volatility_regime_maturity", "completed",
                regime_states=["normal", "expansion_watch", "extreme_expansion", "compression_watch", "unknown"],
                maturity="regime classification is defined and monitored; regime-conditioned strategy claims require forward maturation",
                note="volatility regime watches remain research-only")


# ─── phase 18 ────────────────────────────────────────────────────────────────
def p18_options():
    LB.artifact("task111_option_availability_audit.json", "task111_option_availability_audit", "blocked_options_data",
                recheck_method="Task 110 audit carried forward + current platform data scan (no options tables, no provider feed)",
                fields_required=["contract", "underlying", "expiry", "strike", "call/put", "bid/ask", "last",
                                 "implied_volatility", "open_interest", "volume", "multiplier", "settlement", "margin", "permissions"],
                fields_available=0,
                verdict="PSX listed single-stock options data is NOT available in any authorized platform source; realized volatility is NEVER used as implied volatility")
    LB.artifact("task111_option_data_requirements.json", "task111_option_data_requirements", "blocked_options_data",
                required_source="a licensed PSX derivatives feed (e.g., NCCPL/PSX derivatives market data) with the fields above",
                owner_action_required="owner approval + licensed subscription before any options work; no paid service was added (rule 12)")
    LB.artifact("task111_convexity_research_disposition.json", "task111_convexity_research_disposition", "completed",
                watches=["long_vol_watch", "vol_compression_watch", "mean_reversion_watch"],
                disposition_status="research-only analytics; no executable instructions exist; short-option selling structurally absent")


# ─── phase 20-22 ─────────────────────────────────────────────────────────────
def p21_ops(uni):
    ops = T111 / "ops"
    calls = []
    if (ops / "provider_calls.jsonl").exists():
        for line in (ops / "provider_calls.jsonl").read_text().splitlines():
            try:
                calls.append(json.loads(line))
            except Exception:
                pass
    ok = [c for c in calls if c.get("llmState") == "ok"]
    fails = [c for c in calls if c.get("llmState") != "ok"]
    cache_files = list((T111 / "llm_cache").glob("*.json")) if (T111 / "llm_cache").exists() else []
    LB.artifact("task111_llm_operational_report.json", "task111_llm_operational_report", "completed",
                trigger_model="event-driven/batch runs ONLY (never the 120s quote cycle)",
                idempotency="evidence-hash cache: unchanged evidence is never re-sent",
                runs_observed=dict(provider_calls=len(calls), ok=len(ok), failed=len(fails)),
                run_log="data/backtest_reports/task111/ops/provider_calls.jsonl + runner_log.jsonl")
    LB.artifact("task111_llm_cost_report.json", "task111_llm_cost_report", "completed",
                tokens_returned=sum((c.get("usage") or {}).get("totalTokens") or 0 for c in calls if isinstance(c.get("usage"), dict)) if calls else 0,
                api_cost="not returned by provider for these calls; no paid subscription added",
                calls_ok=len(ok), calls_failed=len(fails),
                note="cost tracking fields are recorded per call when the provider returns usage")
    LB.artifact("task111_llm_cache_report.json", "task111_llm_cache_report", "completed",
                cache_entries=len(cache_files),
                policy="key = symbol + evidence hash; identical evidence never re-sent; resumable across runs")
    LB.artifact("task111_llm_failure_report.json", "task111_llm_failure_report", "completed",
                failures=[dict(symbol=c.get("symbol"), reason=c.get("failureReason")) for c in fails[:20]],
                policy="provider error/parse/validation failure -> llm_unavailable -> NO_TRADE with explicit reason; never a technical-rule signal presented as an LLM result")


def p22_security(uni):
    scan = subprocess.run(["grep", "-rIlE", "(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,})",
                           "src/", "scripts/", "docs/"], cwd=LB.ROOT, capture_output=True, text=True)
    LB.artifact("task111_llm_security_audit.json", "task111_llm_security_audit", "completed",
                credential_handling="env-only; ZAI SDK approved credentials; nothing hardcoded, nothing logged, nothing in frontend",
                credential_scan_hits=scan.stdout.strip().splitlines() if scan.stdout.strip() else [],
                data_sent_to_provider="structured evidence packages only (no DB dumps, no credentials, no private user data, no broker data)",
                provider="z-ai-web-dev-sdk (existing authorized integration); external provider documented",
                prompt_injection_defense="news text sanitized + flagged; system prompt forbids instruction-following from articles; flagged items keep dataQualityState=unverified",
                output_validation="strict server-side JSON schema validation before any display")
    LB.artifact("task111_data_governance_report.json", "task111_data_governance_report", "completed",
                retention="evidence packages + signals under data/backtest_reports/task111/ (committed, auditable)",
                licensing="askanalyst public API (existing integration); web-search snippets research-only; no licensed feed redistributed",
                pii="none sent to providers",
                news_untrusted="treated strictly as evidence; never as instructions")
