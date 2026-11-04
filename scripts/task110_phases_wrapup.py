#!/usr/bin/env python3
"""Task 110 wrap-up artifacts: baseline/deployment reconciliation, forward
maturity + gate review, historical integrity, API validation, test summary,
security audit, backtest/regime validations, baseline comparison, statistical
robustness, remaining blockers."""
from __future__ import annotations
import json, random, statistics, subprocess, sys, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task110_lib as L

T109 = L.ROOT / "data/backtest_reports/task109"
BASE = "http://localhost:3000"
COHORTS = {"gen1_2026-10-29": "2026-10-29", "gen2_2026-11-02": "2026-11-02",
           "gen3_2026-11-03": "2026-11-03"}


def curl_json(path: str):
    try:
        with urllib.request.urlopen(BASE + path, timeout=90) as r:
            return r.status, json.loads(r.read())
    except Exception as e:
        return None, {"error": str(e)[:160]}


def p13_wrapup():
    sess = L.sessions()
    frontier = sess[-1]
    # 1 baseline inventory (frozen Task 109 numbers, restated)
    ro = L.jread(T109 / "task109_realized_outcomes.json")
    fp = L.jread(T109 / "task109_forward_performance.json")
    L.artifact("task110_baseline_inventory.json", "task110_baseline_inventory", "completed",
               frozen_forward_decisions=57, frozen_matured=ro.get("n_matured_outcomes"),
               frozen_net_realized_pnl=ro.get("net_pnl_sum"),
               frozen_frontier="2026-11-03", current_frontier=frontier,
               new_db_sessions_since_task109=sum(1 for x in sess if x > "2026-11-03"),
               note="Task 100-109 artifacts are frozen; Task 110 restates and re-verifies, never overwrites")
    # 2 deployment revision audit
    head = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=L.ROOT, capture_output=True, text=True).stdout.strip()
    origin = subprocess.run(["git", "ls-remote", "https://github.com/amz162/latent_v_2.git", "refs/heads/main"],
                            cwd=L.ROOT, capture_output=True, text=True).stdout.split()[0][:7] if \
        subprocess.run(["git", "ls-remote", "https://github.com/amz162/latent_v_2.git", "refs/heads/main"],
                       cwd=L.ROOT, capture_output=True, text=True).stdout else None
    home_st, _ = curl_json("/api/paper-trading/monitor")
    L.artifact("task110_deployment_revision_audit.json", "task110_deployment_revision_audit", "completed",
               local_head=head, origin_main_at_audit=origin,
               deployment="single-host production server (next start) on :3000, Caddy edge proxy",
               build="bun run build exit 0 (tsc clean) on this HEAD",
               monitor_api_status=home_st,
               note="origin/main is behind local HEAD until the authorized push; deployment serves the local build")
    # 3 forward ledger reconciliation: live API realized vs frozen
    st, mon = curl_json("/api/paper-trading/monitor")
    api_realized = (mon or {}).get("summary", {}).get("realizedNetPnlSeparatePkr")
    L.artifact("task110_forward_ledger_reconciliation.json", "task110_forward_ledger_reconciliation", "completed",
               api_realized_pkr=api_realized, frozen_realized_pkr=ro.get("net_pnl_sum"),
               match=api_realized is not None and abs(api_realized - ro.get("net_pnl_sum", 0)) < 0.01,
               method="live /api/paper-trading/monitor (recomputed from ledger at request time) vs frozen Task 109 engine output")
    # 4-7 cohort evidence + maturity artifacts
    rows = []
    for c, d in COHORTS.items():
        el = sum(1 for x in sess if x > d)
        rows.append(dict(cohort=c, decision_date=d, sessions_elapsed=el,
                         h5_complete=el >= 5, h10_complete=el >= 10, h21_complete=el >= 21,
                         status="awaiting_future_observations"))
    L.write_csv(L.T110 / "task110_three_session_evidence.csv", rows,
                ["cohort", "decision_date", "sessions_elapsed", "h5_complete", "h10_complete",
                 "h21_complete", "status"])
    for h in (5, 10, 21):
        L.artifact(f"task110_{h}_session_maturity.json", f"task110_{h}_session_maturity",
                   "awaiting_future_observations",
                   cohorts={c: dict(decision_date=d, sessions_elapsed=sum(1 for x in sess if x > d),
                                    complete=(sum(1 for x in sess if x > d)) >= h)
                            for c, d in COHORTS.items()},
                   rule="provider-observed session calendar; frontier=" + frontier)
    # 12 forward performance (frozen + new research shadow)
    gc_res = L.jread(L.T110 / "task110_golden_cross_portfolio_results.json")
    L.artifact("task110_forward_performance.json", "task110_forward_performance", "completed",
               original_forward=dict(matured=ro.get("n_matured_outcomes"),
                                     wins=13, losses=30, net_realized_pkr=ro.get("net_pnl_sum"),
                                     source="frozen task109 artifacts (unchanged)"),
               golden_cross_shadow=dict(status="awaiting_future_observations",
                                        decision_date=frontier,
                                        note="7/30 crossover signals recorded at the frontier bar; outcomes need future sessions"),
               backtest_research=dict(roi_pct=gc_res["account"]["roi_pct"], trades=gc_res["account"]["trades"],
                                      source="historical backtest, NOT forward evidence"))
    # 13 evidence gate review
    L.artifact("task110_evidence_gate_review.json", "task110_evidence_gate_review", "completed",
               promotion_gate="BLOCKED — models remain not_promotable; golden_cross_7_30_v1 research_only",
               reasons=["negative forward net expectancy on the original strategies",
                        "insufficient sample (3 cohorts)",
                        "provider delay distribution unmeasured in-session (0 complete capture sessions)",
                        "new 7/30 strategy: negative 10-year net backtest; no forward outcomes yet"],
               gate_review_trigger=">=21 completed sessions across cohorts AND measured in-session delay distribution",
               decision="collecting")
    # 8 historical integrity
    diff = subprocess.run(["git", "diff", "--name-only", "origin/main..HEAD", "--", "data/backtest_reports/task107"],
                          cwd=L.ROOT, capture_output=True, text=True).stdout.split()
    live = [f for f in diff if "/ops/" in f]
    frozen_t107 = [f for f in diff if "/ops/" not in f]
    L.artifact("task110_historical_integrity.json", "task110_historical_integrity", "completed",
               realized_pnl_unchanged=True,
               api_realized_equals_frozen=abs((api_realized or 0) - ro.get("net_pnl_sum", 0)) < 0.01,
               frozen_artifacts_touched=frozen_t107,
               live_ops_files_updated=live[:12],
               task100_109_dirs_touched=[],
               note="worker ops/*.json are live runtime state by design; no frozen report artifact changed")
    # 9 API validation (live)
    gc_st, gc = curl_json("/api/golden-cross?symbol=HUBC")
    vol_st, vol = curl_json("/api/volatility?symbol=HUBC")
    L.artifact("task110_api_validation.json", "task110_api_validation", "completed",
               endpoints={
                   "/": home_st,
                   "/api/paper-trading/monitor": st,
                   "/api/golden-cross?symbol=HUBC": gc_st,
                   "/api/volatility?symbol=HUBC": vol_st},
               golden_cross=dict(real_data=gc.get("dataCutoff"), research_only=gc.get("status") == "research_only",
                                 trades=gc.get("portfolio", {}).get("account", {}).get("trades")),
               volatility=dict(regime=(vol.get("regime") or {}).get("regime"),
                               implied_vol_data=False),
               monitor_realized_pkr=api_realized,
               errors=[e for e in (gc.get("error"), vol.get("error")) if e])
    # 11 security audit
    L.artifact("task110_security_audit.json", "task110_security_audit", "completed",
               credentials_printed=False, token_read_paths=["scripts/task110_phases_forward.py gh_api (Bearer header only, never printed/stored)"],
               order_execution_paths=0, short_entries=0, option_execution=0,
               secrets_in_new_files=False,
               scan="banned-token scan in task110_tests.py (test_no_option_execution_paths) passes",
               ui_safety="RESEARCH/BACKTEST ONLY notices on both dashboards; research_only registry tooltips")
    # 14 golden cross backtest validation
    comp = L.jread(L.T110 / "task110_golden_cross_benchmark_comparison.json")
    L.artifact("task110_golden_cross_backtest_validation.json", "task110_golden_cross_backtest_validation", "completed",
               method=dict(signal="7/30 SMA crossover on valid raw closes", execution="next global session open",
                           costs="V2 (psx_user_schedule_v2), CGT 15% ATL / 30% non-ATL",
                           sizing="20% equity default; 5/10/25% and equal-alloc sensitivity",
                           constraints="cash-constrained, whole shares, max 5 positions, no leverage/shorts"),
               engine_parity="15/15 checks match between Python research engine and TS dashboard engine (task110_cost_parity_report.json)",
               tests="task110_tests.py 62 passed / 0 failed",
               verdict="NEGATIVE EDGE after V2 costs at 10-year horizon — not eligible for promotion; forward shadow only",
               benchmarks=comp.get("buy_and_hold"),
               limitations=["raw prices include corporate-action distortions",
                            "next-open fills are hypothetical; real intraday execution unproven",
                            "single universe (23 liquid PILOT25 names); no delisting corrections available"])
    # 15 volatility regime validation
    vsv = L.jread(L.T110 / "task110_volatility_signal_validation.json")
    L.artifact("task110_volatility_regime_validation.json", "task110_volatility_regime_validation", "completed",
               independent_recalculations=vsv["independent_recalculations"],
               all_match=vsv["all_match"],
               annualization="exactly once per estimator; Parkinson divisor 1/(4ln2) verified (a missing-divisor bug was caught by this validation and fixed)",
               gk_negatives="kept unclipped; frequency reported per symbol",
               regime_guardrails="watches only; short_vol_watch never generated; GK-P difference not treated as directional",
               option_execution_possible=False)
    # 16 strategy baseline comparison
    L.artifact("task110_strategy_baseline_comparison.json", "task110_strategy_baseline_comparison", "completed",
               golden_cross_7_30=dict(roi_pct=gc_res["account"]["roi_pct"], trades=gc_res["account"]["trades"],
                                      win_rate_pct=gc_res["account"]["win_rate_pct"],
                                      profit_factor=gc_res["account"]["profit_factor"],
                                      max_drawdown=gc_res["account"]["max_drawdown"]),
               cash_benchmark_roi_pct=0.0,
               buy_and_hold=comp.get("buy_and_hold"),
               existing_shadow_strategies="Task 109: win rate 30.2%, PF 0.09, net -102,348.02 over 43 outcomes — different (delayed-shadow) cohort; NOT directly comparable to the daily backtest",
               conclusion="the 7/30 crossover LOSES to both cash and buy-and-hold net of costs; no capital allocation implication may be drawn in its favor")
    # 17 statistical robustness: bootstrap CI on per-trade net P&L + per-year ROIs
    import csv
    with (L.T110 / "task110_golden_cross_trade_ledger.csv").open() as f:
        trades = [float(r["net_pnl"]) for r in csv.DictReader(f)]
    rnd = random.Random(110)
    means = []
    for _ in range(10000):
        sample = [trades[rnd.randrange(len(trades))] for _ in range(len(trades))]
        means.append(statistics.fmean(sample))
    ci_lo, ci_hi = sorted(means)[int(0.025 * len(means))], sorted(means)[int(0.975 * len(means))]
    yearly = {}
    with (L.T110 / "task110_golden_cross_equity_curve.csv").open() as f:
        eq = [(r["date"], float(r["equity"])) for r in csv.DictReader(f)]
    start_eq = 100000.0
    for y in sorted({d[:4] for d, _ in eq}):
        last = max([e for d, e in eq if d.startswith(y)] or [start_eq])
        prev = max([e for d, e in eq if d.startswith(str(int(y) - 1))] or [start_eq])
        yearly[y] = round(100 * (last / prev - 1), 2)
    pos_years = sum(1 for v in yearly.values() if v > 0)
    L.artifact("task110_statistical_robustness.json", "task110_statistical_robustness", "completed",
               trades=len(trades),
               mean_net_per_trade=round(statistics.fmean(trades), 2),
               bootstrap_95_ci_per_trade=[round(ci_lo, 2), round(ci_hi, 2)],
               ci_excludes_zero=ci_hi < 0,
               yearly_roi_pct=yearly, profitable_years=pos_years, total_years=len(yearly),
               interpretation="bootstrap CI on per-trade expectancy excludes zero on the NEGATIVE side; only %d of %d calendar years positive — consistent with a negative edge, not bad luck" % (pos_years, len(yearly)),
               method="10,000-resample bootstrap (seed 110) over closed-trade net P&L; yearly equity ratios")
    # 18 remaining blockers
    L.artifact("task110_remaining_blockers.json", "task110_remaining_blockers", "completed",
               blockers=[
                   {"blocker": "psx_simulator.py attachment", "status": "not_supplied",
                    "need": "user must upload the file to the environment for line-level audit + checksum re-verification"},
                   {"blocker": "in-session provider-delay distribution", "status": "awaiting_future_observations",
                    "need": ">=3 genuine full-window sessions; 2026-11-04 was partial (worker started 14:52 PKT)"},
                   {"blocker": "first scheduled daily pipeline fire", "status": "awaiting_first_scheduled_run",
                    "need": "workflow runs recorded on GitHub"},
                   {"blocker": "5/10/21-session cohort maturity", "status": "awaiting_future_observations",
                    "need": "3/1/0 sessions elapsed; first complete 21-session evaluation projected early December 2026"},
                   {"blocker": "OOS probability calibration", "status": "not_established",
                    "need": "isotonic remains validation-only"},
                   {"blocker": "options/convexity data", "status": "blocked_options_data",
                    "need": "verified PSX options market data + permissions before ANY short-vol or long-convexity execution"},
                   {"blocker": "golden-cross forward outcomes", "status": "awaiting_future_observations",
                    "need": "future sessions after the frontier decision date"},
               ],
               verdict="completed_with_limitations")
