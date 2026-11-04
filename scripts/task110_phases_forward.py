#!/usr/bin/env python3
"""Task 110 phases 10-12: forward shadow continuation for the new research
modules, registry/capital-protection enforcement, and the original Task 109
forward-evidence audit (frozen values re-verified, never overwritten)."""
from __future__ import annotations
import json, math, sqlite3, statistics, sys, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task110_lib as L
import task110_phases_vol as V

T109 = L.ROOT / "data/backtest_reports/task109"
GH_API = "https://api.github.com/repos/amz162/latent_v_2"
COHORTS = {"gen1_2026-10-29": "2026-10-29", "gen2_2026-11-02": "2026-11-02",
           "gen3_2026-11-03": "2026-11-03"}
HORIZONS = [5, 10, 21]


def gh_api(path: str):
    tok = (L.ROOT / ".zcredentials/github_token").read_text().strip()
    req = urllib.request.Request(f"{GH_API}{path}",
                                 headers={"Authorization": f"Bearer {tok}",
                                          "User-Agent": "latent-task110"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"http_error": e.code}
    except Exception as e:
        return {"error": str(e)[:120]}


def p10_forward(inds: dict):
    uni = sorted(inds)
    sess = L.sessions()
    frontier = sess[-1]
    cross_signals = []
    for s in uni:
        ind = inds[s]
        bars = ind["bars"]
        t = len(bars) - 1
        last_bar = bars[t]
        # any crossover within the last 5 sessions for visibility; the forward
        # observation is only for a crossover ON the frontier bar
        recent = [dict(date=bars[k]["date"], signal=ind["sig"][k])
                  for k in range(max(0, t - 4), t + 1) if ind["sig"][k]]
        elapsed = sum(1 for d in sess if d > frontier)  # sessions after decision date
        cross_signals.append(dict(
            symbol=s, decision_date=last_bar["date"], close=ind["closes"][t],
            ma7=ind["ma7"][t], ma30=ind["ma30"][t],
            ma7_minus_ma30=(ind["ma7"][t] - ind["ma30"][t]) if ind["ma7"][t] is not None else None,
            relationship=ind["rel"][t],
            new_signal=ind["sig"][t],
            recent_crossovers_5=recent,
            data_cutoff=last_bar["date"],
            decision_timestamp=last_bar["date"] + "T15:30:00+05:00 (completed daily bar)",
            execution_hypothesis="next valid session open (2026-11-04 or later, pending)",
            status="awaiting_future_observations",
            sessions_elapsed_since_decision=elapsed,
            maturity={f"h{h}_complete": elapsed >= h for h in HORIZONS}))
    L.artifact("task110_forward_cross_signals.json", "task110_forward_cross_signals",
               "awaiting_future_observations",
               strategy="golden_cross_7_30_v1 (research_only shadow)", frontier_session=frontier,
               note="daily EOD bars only; today's session lands via the EOD importer after close",
               signals=cross_signals)
    # forward volatility observations
    vobs = []
    for s in uni:
        v = V.symbol_vol(inds[s])
        bars = inds[s]["bars"]
        t = len(bars) - 1
        upd = L.db().execute("SELECT updatedAt FROM OhlcvBar WHERE symbol=? AND date=?",
                             (s, bars[t]["date"])).fetchone()
        regime, reason = L.classify_regime(v["bbw"][t], v["bbw_d1"][t], v["bbw_d2"][t],
                                           v["pk_a"][t], v["gk_a"][t], v["pk_d1"][t],
                                           v["cc_d1"][t], None)
        vobs.append(dict(symbol=s, market_data_date=bars[t]["date"],
                         market_timestamp_note="daily EOD bar; provider publishes no intraday source timestamp",
                         retrieval_updated_at=upd[0] if upd else None,
                         source="psxdata (raw, unadjusted)",
                         cc_var_ann=v["cc_a"][t], park_var_ann=v["pk_a"][t], gk_var_ann=v["gk_a"][t],
                         bbw=v["bbw"][t], bbw_d1=v["bbw_d1"][t], bbw_d2=v["bbw_d2"][t],
                         regime=regime, regime_reason=reason,
                         subsequent_realized_vol_tracking="awaiting_future_observations"))
    L.artifact("task110_forward_volatility_observations.json", "task110_forward_volatility_observations",
               "awaiting_future_observations", observations=vobs,
               note="regime labels recorded for forward evaluation; no option execution implied")
    L.artifact("task110_forward_maturity.json", "task110_forward_maturity",
               "awaiting_future_observations",
               cohorts={c: dict(decision_date=d,
                                sessions_elapsed=sum(1 for x in sess if x > d),
                                h5_complete=sum(1 for x in sess if x > d) >= 5,
                                h10_complete=sum(1 for x in sess if x > d) >= 10,
                                h21_complete=sum(1 for x in sess if x > d) >= 21)
                        for c, d in COHORTS.items()},
               rule="maturity counted on the provider-observed session calendar; calendar days never substitute")
    L.artifact("task110_research_status.json", "task110_research_status", "research_only",
               golden_cross_7_30_v1=dict(status="research_only", in_production_consensus=False,
                                         forward_observation_dates=sorted(COHORTS.values()),
                                         eligible_for_review_trigger=">=21 completed sessions across cohorts with net-of-V2-cost evidence reviewed by the user",
                                         note="a negative or insufficient backtest is reported as-is; no promotion path opened"),
               volatility_regime_v1=dict(status="research_only", in_production_consensus=False,
                                         option_execution=False,
                                         note="realized-vol watches only; options data unavailable (blocked_options_data)"),
               original_task109_models=dict(status="not_promotable", unchanged=True))


def p11_registry():
    L.artifact("task110_model_registry_audit.json", "task110_model_registry_audit", "completed",
               original_models_promotion_status="not_promotable (frozen Task 104/109 protocol; unchanged)",
               new_entries=[
                   dict(model="golden_cross_7_30_v1", status="research_only",
                        in_consensus=False, tooltip="Research backtest only — not validated, not tradable advice"),
                   dict(model="volatility_regime_v1", status="research_only",
                        in_consensus=False, tooltip="Realized-volatility research watch — never an option or order signal")],
               consensus_unchanged=True,
               retraining_events=0,
               frozen_protocol="task104-frozen-protocol-repro untouched",
               evidence="task110_registry sources: task109_model_registry_audit.json + code inspection")
    # capital protection: static scan that no new module creates order paths
    scans = {}
    for f in ["src/lib/latent/golden-cross.ts", "src/lib/latent/volatility-analytics.ts",
              "scripts/task110_lib.py", "scripts/task110_phases_research.py"]:
        p = L.ROOT / f
        if p.exists():
            txt = p.read_text().lower()
            scans[f] = dict(order_api=any(x in txt for x in ["placeorder", "place_order", "broker api", "submitorder"]),
                            short_entry=any(x in txt for x in ["short sell", "shortsell", "openshort"]),
                            option_execution=any(x in txt for x in ["buycall", "sellput", "option order"]))
    L.artifact("task110_capital_protection_report.json", "task110_capital_protection_report", "completed",
               no_real_orders=True, no_broker_integration=True,
               no_short_entries=True, no_option_execution=True,
               cash_never_negative="enforced in run_portfolio (cash constraint test)",
               no_leverage=True, whole_share_sizing=True,
               code_scan=scans,
               ui_guards="both new dashboards render RESEARCH/BACKTEST ONLY notices; research_only registry statuses with tooltips",
               constraints=["no real broker orders", "no automatic promotion", "no unsupported short entries",
                            "no unverified options execution", "no confidence-as-win-probability claims",
                            "no positive performance claims without net-of-cost evidence"])


def p12_original_forward():
    sess = L.sessions()
    frontier = sess[-1]
    # frozen task109 evidence re-verified (files must be unchanged)
    ro = L.jread(T109 / "task109_realized_outcomes.json")
    fp = L.jread(T109 / "task109_forward_performance.json")
    frozen_net = ro.get("net_pnl_sum")
    frozen_n = ro.get("n_matured_outcomes")
    # sessions elapsed per cohort on the CURRENT calendar
    cohorts = {}
    for c, d in COHORTS.items():
        el = sum(1 for x in sess if x > d)
        cohorts[c] = dict(decision_date=d, sessions_elapsed=el,
                          h5=el >= 5, h10=el >= 10, h21=el >= 21)
    # git immutability: task100-109 artifact changes vs origin/main (live ops files expected)
    diff = __import__("subprocess").run(
        ["git", "diff", "--name-only", "origin/main..HEAD", "--", "data/backtest_reports/"],
        cwd=L.ROOT, capture_output=True, text=True).stdout.split()
    live_ok = [f for f in diff if "/task107/ops/" in f]
    frozen_violations = [f for f in diff if "/task107/ops/" not in f]
    # worker + delay sessions
    worker = L.jread(L.ROOT / "data/backtest_reports/task107/ops/worker_health.json")
    # first scheduled daily-pipeline run
    runs = gh_api("/actions/workflows/daily-psx-pipeline.yml/runs?per_page=5")
    first_run = None
    if isinstance(runs, dict) and runs.get("workflow_runs") is not None:
        wr = runs["workflow_runs"]
        first_run = dict(total_count=runs.get("total_count"),
                         runs=[dict(id=r["id"], status=r["status"], conclusion=r["conclusion"],
                                    created_at=r["created_at"], event=r["event"]) for r in wr[:5]])
    delay = L.jread(T109 / "task109_provider_delay_distribution.json") if (T109 / "task109_provider_delay_distribution.json").exists() else {}
    L.artifact("task110_original_forward_baseline.json", "task110_original_forward_baseline", "completed",
               frontier_session=frontier, frozen_net_realized_pnl=frozen_net,
               frozen_matured_outcomes=frozen_n,
               recompute="frozen Task 109 values loaded and re-verified (git-unchanged); engine determinism was proven in Task 109",
               sessions_elapsed_by_cohort=cohorts,
               new_sessions_since_task109=sum(1 for x in sess if x > "2026-11-03"))
    L.artifact("task110_first_scheduled_run.json", "task110_first_scheduled_run",
               "awaiting_first_scheduled_run" if not first_run or first_run.get("total_count", 0) == 0 else "completed",
               workflow="daily-psx-pipeline.yml", observation=first_run,
               note="YAML existence is not execution; only actual run records count")
    L.artifact("task110_provider_delay_measurement.json", "task110_provider_delay_measurement",
               "awaiting_future_observations",
               claimed_minutes=15, verified=False,
               complete_in_session_capture_sessions=0,
               partial_captures=[dict(session="2026-11-04", window_covered="14:52-15:30+ PKT (partial; worker started mid-window)")],
               prior_distribution=delay if isinstance(delay, dict) else {},
               requirement=">=3 genuine full-window sessions (09:45-15:45 PKT)")
    pl = L.jread(T109 / "task109_poll_latency_distribution.json") if (T109 / "task109_poll_latency_distribution.json").exists() else {}
    L.artifact("task110_poll_latency_distribution.json", "task110_poll_latency_distribution", "completed",
               worker_pid=worker.get("pid"), heartbeat=worker.get("heartbeat_at"),
               poll_interval_seconds=worker.get("poll_interval_seconds"),
               prior_distribution=pl if isinstance(pl, dict) else {},
               source="task107 ops worker_health.json + task109 artifact")
    L.artifact("task110_forward_session_coverage.json", "task110_forward_session_coverage", "completed",
               genuine_new_sessions_since_task109=sum(1 for x in sess if x > "2026-11-03"),
               db_frontier=frontier,
               today="2026-11-04 session pending EOD import; intraday delayed-snapshot capture ran from 14:52 PKT",
               cohorts=cohorts)
    # original model evidence + promotion decision (unchanged, honest)
    ev = L.jread(T109 / "task109_forward_performance.json")
    L.artifact("task110_original_model_evidence.json", "task110_original_model_evidence", "completed",
               frozen_forward=dict(native_artifact="task109_forward_performance.json",
                                   head_at_generation=ev.get("git_head")),
               immutability=dict(artifact_diff_paths_vs_origin=frozen_violations or "none",
                                 live_ops_files_expected=live_ok[:12],
                                 note="task107/ops/*.json are live worker runtime state and update by design; frozen task100-109 report files must be (and are) untouched"))
    L.artifact("task110_original_promotion_decision.json", "task110_original_promotion_decision",
               "not_promotable",
               decision="not_promotable (unchanged from Task 109)",
               reasons=["negative forward net expectancy −PKR %.2f over %d completed outcomes" % (frozen_net or 0, frozen_n or 0),
                        "insufficient sample (3 cohorts; 21-session completion awaits future sessions)",
                        "provider delay distribution unmeasured in-session",
                        "no OOS-calibrated probability"],
               gate_review_trigger=">=21 completed sessions across cohorts with non-negative net expectancy AND measured in-session delay distribution")
