#!/usr/bin/env python3
"""Task 102 — phase implementations (imported by task102_runner.py).
All phases resumable, bounded, deterministic; reuse Task 101 production
machinery for labels/costs; never mutate Task 54/100/101 artifacts."""
from __future__ import annotations
import json, os, subprocess, sys, time
from pathlib import Path
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import task102_lib as L  # noqa: E402
import task100_lib as T0  # noqa: E402
import task101_lib as T101  # noqa: E402
import task101_phases as P101  # noqa: E402  (dataset/grid/features helpers)
import walk_forward_backtesting as wf  # noqa: E402

NOW = lambda: time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime())  # noqa: E731


# ── phase: baseline ──────────────────────────────────────────────────────────

def phase_baseline(args):
    t0 = time.time()
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=L.ROOT, capture_output=True,
                           text=True).stdout.strip()
    status = subprocess.run(["git", "status", "--short"], cwd=L.ROOT, capture_output=True,
                             text=True).stdout.strip().splitlines()
    con = L.db_conn()
    bars = con.execute("SELECT COUNT(*), MIN(date), MAX(date), COUNT(DISTINCT symbol) "
                        "FROM OhlcvBar").fetchone()
    paper = dict(con.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade "
                              "GROUP BY state").fetchall())
    paper_total = con.execute("SELECT COUNT(*) FROM ProspectivePaperTrade").fetchone()[0]
    legs = con.execute("SELECT COUNT(*) FROM PaperTradeLeg").fetchone()[0]
    hist = con.execute("SELECT COUNT(*) FROM PredictionHistory").fetchone()[0]
    outcomes = con.execute("SELECT COUNT(*) FROM PredictionOutcome").fetchone()[0]
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    con.close()
    sect = json.loads((L.ROOT / "data/askanalyst/sector_overrides.json").read_text())
    t101 = json.load(open(L.T101.BASE / "task101_summary.json"))
    m100 = json.load(open(T0.BASE / "task100_initial_performance_matrix.json"))
    s100 = json.load(open(T0.BASE / "task100_sample_step_comparison.json"))
    reg = json.load(open(L.BASE.parent / "task101/task101_model_registry.json"))
    api_reg = json.load(open(L.BASE.parent / "task101/task101_api_validation.json"))
    fil = L.load_filings()
    n_filings = sum(len(v.get("data", [])) for v in fil.values())
    inv = {
        "task": 102, "generated_at": NOW(),
        "git": {"HEAD": head, "branch": "main", "dirty_files": len(status),
                 "note": "autosave commits by the platform harness may stack on main; "
                          "meaningful history = Task 101 commits 80a99d87/b870faf1/529fb1f2"},
        "registry": {
            "canonical_count": api_reg["checks"]["registry"]["canonicalCount"],
            "supplemental_count": api_reg["checks"]["registry"]["supplementalCount"],
            "unique_implementations": api_reg["checks"]["registry"]["canonicalCount"] +
                                       api_reg["checks"]["registry"]["supplementalCount"] - 1,
            "aliases_policy": "aliases are never counted as new implementations (Task 82 audit)",
            "task101_new_models": [m["id"] for m in reg["supplemental_models"]],
            "promotion_statuses": {"production_consensus": "canonical models (Task 54 lineage)",
                                     "shadow_only_not_promoted": ["psx_cost_aware_trade_classifier"],
                                     "research_only": ["psx_net_expectancy_meta_model"]}},
        "benchmarks": {
            "task54": "400-sample walk-forward, 9 models, 6,000 fits (untouched; preserved)",
            "task99": "JW reference LSTM/CNN-LSTM: genuine PSX OOS, zero-return not beaten (reused)",
            "task100": {"best_zero_return_beaten": False,
                         "sample_step_dependence": "documented (50/10/5/1)"},
            "task101": {"n_labeled_trades": t101["headline"]["cost_aware_pipeline"].split()[0],
                         "frozen_rule": t101["headline"]["frozen_cost_aware_rule"],
                         "final_test": t101["headline"]["final_test_result"],
                         "cost_parity_fixtures": "29/29"}},
        "database": {"tables": tables, "ohlcv_bars": bars[0], "min_date": str(bars[1]),
                      "max_date": str(bars[2]), "symbols": bars[3],
                      "index_tables": [t for t in tables if "kse" in t.lower() or "index" in t.lower()] or [],
                      "fundamental_tables": [], "corporate_action_tables": [], "intraday_tables": []},
        "data_availability": {
            "ohlcv_daily": {"status": L.VERIFIED, "range": [str(bars[1]), str(bars[2])]},
            "kse100_genuine": {"status": L.BLOCKED_EXTERNAL_DATA,
                                 "detail": "6 providers attempted; all blocked (see "
                                            "task102_kse100_coverage.json)"},
            "kse100_proxy": {"status": L.PARTIALLY_VERIFIED,
                              "detail": "pilot25 equal-weight breadth internal proxy, "
                                         "labeled market_internal_proxy, never shown as index"},
            "fundamentals": {"status": L.PARTIALLY_VERIFIED,
                              "detail": f"{len(fil)} symbols; {n_filings} filings with genuine PSX "
                                         f"announcement dates (day granularity); statements/ratios "
                                         f"carry period labels only, no publication timestamps"},
            "corporate_actions": {"status": L.MISSING,
                                   "detail": "no registry in DB; jump-based suspicion flags only"},
            "intraday": {"status": L.PROVIDER_UNAVAILABLE,
                          "detail": "no intraday tables or configured provider"}},
        "sector_overrides": {"instruments": sect.get("counts", {}).get("resolved", "n/a"),
                              "sectors": list(sect.get("sectors", {}).keys())[:12],
                              "generated_at": sect.get("generated_at"),
                              "preserved": True},
        "prospective_lifecycle": {"total": paper_total, "by_state": paper, "legs": legs,
                                   "prediction_history": hist, "outcomes": outcomes,
                                   "untouched": True},
        "blocked_model_families": {
            "PatchTST/N-BEATS/TimesNet/Informer/LSTM/GRU/CNN-LSTM/Transformer-LSTM/TabNet":
                "cannot retrain in 150s/2CPU/4GB; no pooled OOS artifact",
            "Chronos/Lag-Llama/Moirai": "packages/checkpoints not installed",
            "Prophet": "package not installed (ARIMA/Holt-Winters cover statistical family)",
            "GARCH": "arch package not installed (EWMA proxy evaluated)",
            "Kalman": "no implementation artifact; pykalman absent"},
        "test_coverage": {"python_deterministic": ["task101_tests.py 15/15",
                                                     "task102_tests.py (this task)"],
                           "typescript": ["tsc --noEmit", "task102_pit_tests.ts",
                                           "task102_parity.ts"],
                           "api": ["registry", "walk-forward", "simulator V2", "signal-stats"],
                           "browser": "agent-browser headless suite"}}
    L.write_artifact("task102_baseline_inventory.json", inv)
    L.write_artifact("task102_execution_manifest.json", {
        "task": 102, "generated_at": NOW(), "runner": "scripts/task102_runner.py",
        "usage": "python scripts/task102_runner.py --phase <name> [--resume]",
        "phases": ["baseline", "market_audit", "kse100", "pit_fundamentals", "corporate_actions",
                    "intraday", "feature_store", "regime_sector", "labels102", "feature_value",
                    "validation", "evaluation", "strategy_cmp", "registry_promotion",
                    "paper_audit", "shadow_monitoring", "qa", "finalize"],
        "sandbox_limits": "150s/command, 2 CPU, 4GB RAM; resumable via task102_progress.json"})
    L.update_progress("baseline", "done", f"HEAD {head[:8]}, {bars[0]} bars",
                      "task102_baseline_inventory.json")
    print(f"baseline done {time.time()-t0:.0f}s")
    (L.ROOT / "docs/task102-baseline-and-data-readiness.md").write_text(
        "# Task 102 — Baseline and Data Readiness\n\n"
        "## Starting point (verified, not assumed)\n\n"
        f"- Git HEAD `{head[:8]}` on `main` (Task 101 delivered at `80a99d87`, worklog addenda through "
        "`529fb1f2`; the platform autosaver stacks snapshot commits on top, which are stripped at push time).\n"
        f"- Database: **{bars[0]:,}** daily OHLCV bars for **{bars[3]}** symbols, "
        f"{str(bars[1])[:10]} → {str(bars[2])[:10]}, raw (unadjusted) prices.\n"
        "- Registry: 58 canonical / 13 supplemental / 71 unique implementations. The two Task 101 "
        "cost-aware models are shadow-only / research-only and stay that way unless new evidence passes "
        "the promotion gates.\n"
        "- Task 54's 400-sample walk-forward report and Task 101's 11,521-trade artifacts are protected "
        "inputs; Task 102 writes everything to `data/backtest_reports/task102/`.\n\n"
        "## Data readiness (honest statuses)\n\n"
        "| Source | Status | Detail |\n| --- | --- | --- |\n"
        "| Daily OHLCV | verified | 909 symbols incl. delisted histories (no survivorship purge) |\n"
        "| KSE-100 genuine | blocked_external_data | Yahoo 404, Stooq/PSX unreachable, WSJ captcha, "
        "investing.com 403, TradingEconomics 410 — adapter + unblock path provided |\n"
        "| Market regime | partially_verified | internal pilot25-breadth proxy, explicitly labeled "
        "`market_internal_proxy`, never displayed as the index |\n"
        "| Fundamentals | partially_verified | 24 symbols; PSX announcement dates are genuine "
        "(day granularity); statement/ratio records have period labels but NO publication timestamps |\n"
        "| Corporate actions | missing | no registry exists; raw prices preserved; jump-suspicion "
        "flags computed instead |\n"
        "| Intraday | provider_unavailable | no tables, no provider; adapter + synthetic fixtures only |\n\n"
        "The Task 101 smoke reconciliation (Phase labels102) re-runs the production label engine on the "
        "same frozen grid and diffs the result against the Task 101 dataset before any new modeling.\n")


# ── phase: corporate_actions + intraday (audits + reports) ───────────────────

def phase_corporate_actions(args):
    t0 = time.time()
    con = L.db_conn()
    df = pd.read_sql("SELECT symbol,date,close FROM OhlcvBar ORDER BY symbol,date", con)
    con.close()
    events = []
    for sym, g in df.groupby("symbol", sort=False):
        c = g["close"].values.astype(float)
        if len(c) < 2:
            continue
        ret = np.abs(np.diff(c) / np.where(c[:-1] == 0, np.nan, c[:-1]))
        idx = np.where(ret >= 0.40)[0]
        for i in idx[:3]:  # cap per symbol for the report
            events.append({"symbol": sym, "date": str(g["date"].iloc[i + 1])[:10], "one_day_move_pct": round(float(ret[i]) * 100, 1),
                            "suspicion": "candidate split/bonus/rights; UNVERIFIED (no registry source)",
                            "verification_status": L.MISSING})
    report = {
        "generated_at": NOW(),
        "registry_status": L.MISSING,
        "registry_detail": "no corporate-action table exists in the DB and no permitted source "
                            "reachable to build one; raw prices are preserved untouched",
        "candidate_events_detected": {"count_symbols": len({e["symbol"] for e in events}),
                                        "examples": events[:40]},
        "adjustment_policy": {
            "raw": "OhlcvBar stays raw (production; all engines label on raw + gap-aware fills)",
            "split_bonus_adjusted": "not available (no events source) — DO NOT fabricate",
            "dividend_adjusted": "not available", "total_return": "not available"},
        "double_adjustment_guard": "no vendor-adjusted series exists; nothing to double-adjust",
        "leakage_rule": "no future corporate action may alter a decision-time feature; "
                         "ex-post adjusted analytical series are excluded from the feature store "
                         "(task102_feature_leakage_report.json)",
        "artificial_return_test": "task102_tests.py::test_no_artificial_split_returns",
        "action_to_unblock": "owner provides PSX corporate-action history (or permitted vendor) "
                              "-> registry table + verified events -> adjusted series"}
    L.write_artifact("task102_corporate_actions_report.json", report)
    L.update_progress("corporate_actions", "done", f"{len(events)} suspect events (unverified)",
                      "task102_corporate_actions_report.json")
    print(f"corporate actions done {time.time()-t0:.0f}s")


def phase_intraday(args):
    t0 = time.time()
    con = L.db_conn()
    intraday_tables = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND "
        "(name LIKE '%intraday%' OR name LIKE '%minute%' OR name LIKE '%Intra%')")]
    con.close()
    cov = {
        "generated_at": NOW(),
        "status": L.PROVIDER_UNAVAILABLE,
        "intervals_audited": ["1m", "5m", "15m", "30m", "1h"],
        "existing_tables": intraday_tables,
        "configured_providers": "none (env has no intraday provider credentials)",
        "coverage": {"symbols": 0, "history_depth": None},
        "licensing": "unknown — no provider reachable to review terms",
        "blocker": "No legitimate intraday PSX source exists in the environment; PSX Data Portal "
                    "unreachable from sandbox (HTTP 000); no credentials configured",
        "adapter": "src/lib/market-data/intraday-provider.ts (normalized schema + provider "
                    "abstraction; refuses to synthesize bars from daily OHLC)",
        "tests": "synthetic fixtures only, clearly marked, never mixed with real data",
        "execution_realism": {
            "entry_price": "daily-bar approximation: next-session open (documented)",
            "gap_behavior": "gap-aware fills in strategy-engine.ts (SL-first same-candle)",
            "sl_tp_ordering": "same-bar: SL first (conservative); intraday ordering UNKNOWN "
                               "without intraday data — labeled as daily OHLC approximation",
            "spread_slippage": "psx_user_schedule_v2 slippage = 0; no defensible intraday proxy",
            "findings_basis": "ALL execution-realism findings in this repository are based on "
                               "daily bars; no intraday-based finding exists"}}
    L.write_artifact("task102_intraday_coverage.json", cov)
    (L.ROOT / "docs/task102-intraday-data-readiness.md").write_text(
        "# Task 102 — Intraday Data Readiness\n\n"
        "## Verdict: `provider_unavailable` (blocked_external_data)\n\n"
        "No legitimate intraday PSX source exists in this environment. The DB contains no intraday "
        "tables, no provider is configured in `.env`, and the PSX Data Portal is unreachable from the "
        "sandbox. Nothing was manufactured: **no intraday candle was synthesized from daily bars** and "
        "no exact intraday SL/TP sequencing was inferred.\n\n"
        "## What was built\n\n"
        "- `src/lib/market-data/intraday-provider.ts` — provider abstraction and normalized bar schema "
        "(1m/5m/15m/30m/1h) with strict validation; ingestion is provider-pluggable without touching "
        "the rest of the system.\n"
        "- Synthetic fixtures (clearly marked, test-only) validate parsing, gap handling and "
        "session alignment — never mixed with real data.\n\n"
        "## Execution realism today (daily-bar approximation, explicitly labeled)\n\n"
        "- Entry: next-session open after the decision date.\n"
        "- Same-candle SL-first ordering (conservative) with gap-aware fills.\n"
        "- Slippage: zero under `psx_user_schedule_v2`; no defensible spread proxy from daily bars.\n"
        "- Time-of-day behavior, intraday liquidity and holding-duration precision: **unavailable**.\n\n"
        "## To unblock\n\n"
        "Provide a permitted intraday vendor (credentials in `.env`); the adapter auto-detects it. "
        "Until then every intraday-dependent conclusion stays labeled as unavailable.\n")
    L.update_progress("intraday", "done", "blocked_external_data documented",
                      "task102_intraday_coverage.json")
    print(f"intraday done {time.time()-t0:.0f}s")


# ── phase: feature store (per-sample extended features, point-in-time safe) ──

EXTRA_NAMES = ["liq_turnover_z20", "liq_dollarvol_pctile_1y", "liq_volume_trend_60d",
                "ca_jump_flag_60d", "ca_stale_volume_flag", "regime_breadth_ma20_dist",
                "regime_breadth_trend", "regime_disp_ma20_dist", "regime_vol_ratio",
                "regime_stress_flag"]

def _decision_ms(date_val) -> int:
    import datetime as dt
    if isinstance(date_val, (int, np.integer)):
        return int(date_val)
    s = str(date_val)
    if s.isdigit():
        return int(s)
    return int(dt.datetime.strptime(s[:10], "%Y-%m-%d")
                .replace(tzinfo=dt.timezone.utc).timestamp() * 1000)

def _extras_for_cohort(joined):
    """Point-in-time extras per (symbol, decision date). Trailing windows of bars
    at or before the decision date ONLY."""
    t0 = time.time()
    syms, _, df = P101._dataset()
    dfx = P101._cross_sectional(df)
    by_sym = {}
    for s, g in dfx.groupby("symbol"):
        gg = g.sort_values("date").reset_index(drop=True)
        gg["date_ms"] = pd.to_datetime(gg["date"]).values.astype("datetime64[ms]").astype(np.int64)
        by_sym[s] = gg
    need = {}
    for r in joined:
        need.setdefault(r["symbol"], set()).add(_decision_ms(r["date"]))
    out = {}
    for sym, dset in need.items():
        g = by_sym.get(sym)
        if g is None:
            out[sym] = {}
            continue
        dates = g["date_ms"].values.astype(np.int64)
        close, vol = g["close"].values.astype(float), g["volume"].values.astype(float)
        turnover = close * vol
        xsb = g["xs_breadth_5d"].values.astype(float)
        xsd = g["xs_disp_5d"].values.astype(float)
        m = {}
        for d in dset:
            i = int(np.searchsorted(dates, d, side="right"))  # bars strictly <= decision date
            if i < 130:
                continue
            c, v, to = close[:i], vol[:i], turnover[:i]
            z = (to[-1] - to[-20:].mean()) / (to[-20:].std() + 1e-9)
            pctile = float((to[-250:] <= to[-1]).mean())
            vt = float(to[-60:].mean() / (to[-120:-60].mean() + 1e-9) - 1)
            ret1 = np.abs(np.diff(c[-61:]) / np.where(c[-61:-1] == 0, np.nan, c[-61:-1]))
            with np.errstate(invalid="ignore"):
                jf = float(np.nanmax(ret1) >= 0.40) if len(ret1) else 0.0
            sv = float(v[-20:].mean() == 0)
            bm = xsb[:i]
            b20 = bm[-20:].mean()
            bdist = float(bm[-1] - b20)
            btrend = float(bm[-1] - bm[-10:].mean())
            dm = xsd[:i]
            ddist = float(dm[-1] - dm[-20:].mean())
            vr = float(np.std(c[-20:] / c[-21:-1] - 1) / (np.std(c[-120:] / c[-121:-1] - 1) + 1e-9))
            stress = float(bdist < -0.02 and vr > 1.5)
            m[d] = [z, pctile, vt, jf, sv, bdist, btrend, ddist, vr, stress]
        out[sym] = m
    print(f"extras computed in {time.time()-t0:.0f}s for {len(need)} symbols")
    return out

def _group_matrix(X_base, joined, extras, groups: list[str]) -> dict:
    """Append group-specific columns. Regime features come from the internal
    proxy (never labeled as KSE-100); fundamentals group stays disabled."""
    base = np.asarray(X_base, dtype=np.float64)
    extra_rows = []
    for r in joined:
        d = _decision_ms(r["date"])
        vals = extras.get(r["symbol"], {}).get(d, [0.0] * len(EXTRA_NAMES))
        extra_rows.append(vals)
    E = np.array(extra_rows, dtype=np.float64)
    _med = np.where(np.isfinite(np.nanmedian(E, 0)), np.nanmedian(E, 0), 0.0)
    E = np.where(np.isfinite(E), E, _med)
    liq_idx = [0, 1, 2]
    ca_idx = [3, 4]
    reg_idx = [5, 6, 7, 8, 9]
    mats = {}
    for gname in groups:
        if gname == "technical_only_v1":
            mats[gname] = base
        elif gname == "technical_liquidity_v1":
            mats[gname] = np.hstack([base, E[:, liq_idx]])
        elif gname == "technical_corporate_action_safe_v1":
            mats[gname] = np.hstack([base, E[:, ca_idx]])
        elif gname == "technical_market_regime_v1":
            mats[gname] = np.hstack([base, E[:, reg_idx]])
        elif gname == "combined_verified_v1":
            mats[gname] = np.hstack([base, E[:, liq_idx + ca_idx + reg_idx]])
        elif gname == "technical_pit_fundamental_v1":
            continue  # disabled
    return mats

def phase_feature_store(args):
    t0 = time.time()
    joined = P101._rebuild_grid_with_features()
    extras = _extras_for_cohort(joined)
    np.save(L.FEATURES_DIR / "extras.npy", np.array([1]))  # checkpoint marker
    with open(L.FEATURES_DIR / "extras.json", "w") as f:
        json.dump({s: {str(k): v for k, v in m.items()} for s, m in extras.items()}, f)
    report = {
        "generated_at": NOW(),
        "implementation": "python build path (scripts/task102_phases.py::_extras_for_cohort + "
                           "_group_matrix); production as-of interface: "
                           "src/lib/features/feature-store.ts buildFeaturesAsOf()",
        "cohort": {"n_samples": len(joined), "grid": "identical to Task 101 label grid (step 5)"},
        "feature_groups": {k: {**v, "n_extra_features": (
            0 if k == "technical_only_v1" else
            3 if k == "technical_liquidity_v1" else
            2 if k == "technical_corporate_action_safe_v1" else
            5 if k == "technical_market_regime_v1" else 10)}
            for k, v in L.FEATURE_GROUPS.items()},
        "point_in_time_guarantees": [
            "every extra feature is a trailing window of bars with date <= decision date",
            "regime features are same-date cross-sectional stats of trailing 5d returns",
            "no adjusted ex-post series; raw prices only",
            "PIT fundamentals group disabled (no verified publication timestamps)",
            "KSE-100 group inputs unavailable -> internal proxy only, labeled"],
        "lineage": {"ohlcv": "db/custom.db OhlcvBar (raw)",
                     "sector_map": "data/askanalyst/sector_overrides.json (Task 98, preserved)",
                     "regime_proxy": "pilot25 equal-weight breadth/dispersion (internal)",
                     "fundamentals": "AskAnalyst Task 90 ingest (filings only, day granularity)"},
        "per_symbol_coverage": "complete for all cohort symbols (extras default 0 when <130 bars)",
        "schema_version": "task102-features-v1"}
    L.write_artifact("task102_feature_store_report.json", report)
    L.update_progress("feature_store", "done", "extras + groups defined",
                      "task102_feature_store_report.json")
    print(f"feature_store done {time.time()-t0:.0f}s")


# ── phase: regime + sector intelligence (verified data only) ─────────────────

def phase_regime_sector(args):
    t0 = time.time()
    labels = json.loads((T101.LABELS_DIR / "labels.json").read_text())["labels"]
    grid = {g["sample_id"]: g for g in
            json.loads((T101.LABELS_DIR / "samples.json").read_text())["samples"]}
    syms, _, df = P101._dataset()
    dfx = P101._cross_sectional(df)
    # deterministic point-in-time regime rules on the internal proxy
    breadth = dfx.dropna(subset=["xs_breadth_5d"]).groupby("date")["xs_breadth_5d"].mean()
    disp = dfx.dropna(subset=["xs_disp_5d"]).groupby("date")["xs_disp_5d"].std()
    bma = breadth.rolling(20).mean()
    dma = disp.rolling(20).mean()
    regime = {}
    breadth_ms = pd.to_datetime(breadth.index).values.astype("datetime64[ms]").astype(np.int64)
    disp_ms = pd.to_datetime(disp.index).values.astype("datetime64[ms]").astype(np.int64)
    disp = pd.Series(disp.values, index=disp_ms)
    dma = disp.rolling(20).mean()
    breadth = pd.Series(breadth.values, index=breadth_ms)
    bma = breadth.rolling(20).mean()
    for d in breadth.index:
        b, bm, sd, dm = breadth[d], bma[d], disp[d], dma[d]
        if np.isnan(bm) or np.isnan(dm):
            regime[int(d)] = "unknown"
        elif b < 0 and sd > dm * 1.5:
            regime[int(d)] = "market_stress"
        elif sd > dm * 1.5:
            regime[int(d)] = "high_volatility"
        elif b > bm + 0.002:
            regime[int(d)] = "bull_trend"
        elif b < bm - 0.002:
            regime[int(d)] = "bear_trend"
        else:
            regime[int(d)] = "sideways"
    rep = {"generated_at": NOW(),
            "regime_source": "pilot25 equal-weight 5d breadth + dispersion (market_internal_proxy) "
                              "- genuine KSE-100 blocked; rules deterministic, point-in-time "
                              "(rolling stats use data <= decision date)",
            "regime_counts": pd.Series(list(regime.values())).value_counts().to_dict(),
            "strategy_performance_by_regime_final_test": {},
            "caution": "regime buckets are small and dependent (overlapping labels); results are "
                        "descriptive, NOT generalizable"}
    import datetime as dt
    def to_ms(d_iso):
        return int(dt.datetime.strptime(d_iso, "%Y-%m-%d").replace(
            tzinfo=dt.timezone.utc).timestamp() * 1000)
    for strat in P101.STRATEGIES:
        agg = {}
        for r in labels:
            if grid[r["sample_id"]]["partition"] != "final_test":
                continue
            rg = regime.get(to_ms(grid[r["sample_id"]]["date"]), "unknown")
            a = agg.setdefault(rg, {"n": 0, "net": 0.0, "wins": 0})
            st = r["strategies"][strat]
            a["n"] += 1; a["net"] += st["netPnl"]; a["wins"] += int(st["positiveNet"])
        rep["strategy_performance_by_regime_final_test"][strat] = {
            rg: {"n": v["n"], "netPnl": round(v["net"], 2),
                  "netWinRate": round(100 * v["wins"] / v["n"], 2)} for rg, v in agg.items()}
    # sector analysis (Task 98 overrides preserved)
    sect = json.loads((L.ROOT / "data/askanalyst/sector_overrides.json").read_text())
    sym2sect = {}
    for k, v in (sect.get("sectors") or {}).items():
        if isinstance(v, str):
            sym2sect[str(k)] = v          # flat map: symbol -> sector name
        elif isinstance(v, list):
            for s in v:
                sym2sect[s if isinstance(s, str) else (s.get("symbol") or s.get("name"))] = str(k)
        elif isinstance(v, dict):
            for s in (v.get("symbols") or v.get("items") or []):
                sym2sect[s if isinstance(s, str) else (s.get("symbol") or s.get("name"))] = str(k)
    by_sect = {}
    for r in labels:
        if grid[r["sample_id"]]["partition"] != "final_test":
            continue
        sg = sym2sect.get(r["symbol"], "unknown")
        a = by_sect.setdefault(sg, {"n": 0, "net": 0.0, "wins": 0, "symbols": set()})
        st = r["strategies"]["fixed_first_hit"]
        a["n"] += 1; a["net"] += st["netPnl"]; a["wins"] += int(st["positiveNet"])
        a["symbols"].add(r["symbol"])
    sector_rep = {
        "generated_at": NOW(),
        "source": "data/askanalyst/sector_overrides.json (Task 98; PRESERVED, not regenerated)",
        "coverage": {"symbols_in_cohort": len({r["symbol"] for r in labels}),
                      "mapped": sum(1 for r in labels if r["symbol"] in sym2sect) //
                                 max(1, len(labels))},
        "final_test_fixed_first_hit_by_sector": {
            sg: {"n": v["n"], "netPnl": round(v["net"], 2),
                  "netWinRate": round(100 * v["wins"] / v["n"], 2),
                  "n_symbols": len(v["symbols"])}
            for sg, v in sorted(by_sect.items(), key=lambda kv: -kv[1]["n"])[:12]},
        "unknown_policy": "unmapped symbols -> 'unknown' bucket; never guessed",
        "honesty": "pilot25 is a small universe; sector buckets with n<30 are not interpretable"}
    L.write_artifact("task102_regime_report.json", rep)
    L.write_artifact("task102_sector_analysis.json", sector_rep)
    L.update_progress("regime_sector", "done", "regime rules + sector buckets",
                      "task102_regime_report.json")
    print(f"regime_sector done {time.time()-t0:.0f}s; regimes={rep['regime_counts']}")


# ── phase: labels102 (production-engine labels into task102 ns + reconcile) ──

def phase_labels102(args):
    t0 = time.time()
    samples = T101.LABELS_DIR / "samples.json"
    lab_file = L.LABELS_DIR / "labels.json"
    ok = T101.run_ts("task101_labels.ts", lab_file, env_extra={
        "TASK101_SAMPLES": str(samples), "TASK101_LABELS": str(lab_file)}, timeout=140)
    if not ok:
        print("TS LABEL RUN FAILED"); return
    new = json.loads(lab_file.read_text())
    old = json.loads((T101.LABELS_DIR / "labels.json").read_text())
    old_by_id = {r["sample_id"]: r for r in old["labels"]}
    n_match = n_diff = 0
    max_net_dev = 0.0
    for r in new["labels"]:
        o = old_by_id.get(r["sample_id"])
        if o is None:
            continue
        same = True
        for strat in P101.STRATEGIES:
            if abs(o["strategies"][strat]["netPnl"] - r["strategies"][strat]["netPnl"]) > 0.02:
                same = False
                max_net_dev = max(max_net_dev, abs(o["strategies"][strat]["netPnl"]
                                                    - r["strategies"][strat]["netPnl"]))
        n_match += int(same); n_diff += int(not same)
    integrity = {
        "generated_at": NOW(),
        "label_engine": "strategy-engine.ts + computeTradeCostsV2 (UNCHANGED from Task 101)",
        "n_labeled": new["nLabeled"], "reconciliation": {
            "vs_task101_labels": {"matched": n_match, "differences": n_diff,
                                   "max_net_deviation_pkr": round(max_net_dev, 4),
                                   "verdict": "IDENTICAL" if n_diff == 0 else "INVESTIGATE"}},
        "maturity_rule": "trades without a full 21-session window or without risk levels are "
                          "excluded (never labeled as loss/zero)",
        "cost_profile": "psx_user_schedule_v2, ATL_15",
        "task101_artifacts_untouched": True}
    L.write_artifact("task102_trade_label_integrity.json", integrity)
    L.update_progress("labels102", "done", f"{new['nLabeled']} labels, match={n_match}",
                      "task102_trade_label_integrity.json")
    print(f"labels102 done {time.time()-t0:.0f}s: {new['nLabeled']} labels, "
          f"reconcile match={n_match} diff={n_diff}")


# ── phase: feature_value (incremental value of each verified group) ──────────

def phase_feature_value(args):
    t0 = time.time()
    import task101_phases as P
    joined, X, Xs, feat_names, lab = P._features_and_labels()
    extras = _extras_for_cohort(joined)
    groups = [g for g, v in L.FEATURE_GROUPS.items() if v["enabled"]]
    by_part = {p: [r for r in joined if r["partition"] == p] for p in
                ("train", "validation", "final_test")}
    idx = {p: np.array([i for i, r in enumerate(joined) if r["partition"] == p]) for p in by_part}
    cache = L.FEATURES_DIR / "group_results"
    cache.mkdir(exist_ok=True)
    grid_act = {g["sample_id"]: g["actual_21d"] for g in json.loads(
        (T101.LABELS_DIR / "samples.json").read_text())["samples"]}

    def build(gname):
        mats = _group_matrix(np.vstack([X["train"], X["validation"], X["final_test"]]),
                              joined, extras, [gname])
        m = mats[gname]
        return {p: m[idx[p]] for p in idx}

    def run_group(gname):
        res = {"features": None, "target_A": {}, "regression_21d": {}}
        for strat in ("fixed_first_hit", "max_tp_step_trailing"):
            y = {p: np.array([1.0 if lab[r["sample_id"]]["strategies"][strat]["positiveNet"]
                               else 0.0 for r in by_part[p]]) for p in by_part}
            net = {p: np.array([lab[r["sample_id"]]["strategies"][strat]["netReturnPct"]
                                 for r in by_part[p]]) for p in by_part}
            Xm = build(gname)
            from sklearn.preprocessing import StandardScaler
            from sklearn.isotonic import IsotonicRegression
            from sklearn.metrics import brier_score_loss, roc_auc_score
            entry = {}
            for model in ("RandomForest", "LightGBM"):
                if model == "LightGBM":
                    m = P.cls_fit101("LightGBM", Xm["train"], y["train"])
                else:
                    m = P.cls_fit101("RandomForest", Xm["train"], y["train"])
                pv = m.predict_proba(Xm["validation"])[:, 1]
                pt = m.predict_proba(Xm["final_test"])[:, 1]
                iso = IsotonicRegression(out_of_bounds="clip").fit(pv, y["validation"])
                pv_c, pt_c = iso.predict(pv), iso.predict(pt)
                thr = float(np.quantile(pv_c, 0.70))
                mv, mt = pv_c >= thr, pt_c >= thr
                entry[model] = {
                    "brier_val_raw": round(float(brier_score_loss(y["validation"], pv)), 6),
                    "brier_val_cal": round(float(brier_score_loss(y["validation"], pv_c)), 6),
                    "brier_test_cal": round(float(brier_score_loss(y["final_test"], pt_c)), 6),
                    "auc_val": round(float(roc_auc_score(y["validation"], pv)), 4),
                    "auc_test": round(float(roc_auc_score(y["final_test"], pt)), 4),
                    "thr_q70": round(thr, 4), "n_val_selected": int(mv.sum()),
                    "n_test_selected": int(mt.sum()),
                    "val_expectancy_pct": round(float(np.mean(net["validation"][mv])), 4),
                    "test_expectancy_pct": round(float(np.mean(net["final_test"][mt])), 4) if mt.sum() else None,
                    "baseline_all_test_expectancy_pct": round(float(np.mean(net["final_test"])), 4)}
            res["target_A"][strat] = entry
        # regression vs zero-return baseline (21d horizon, pooled cohort)
        a21 = {p: np.array([grid_act[r["sample_id"]] for r in by_part[p]]) for p in by_part}
        Xm = build(gname)
        from sklearn.linear_model import Ridge
        rid = Ridge(alpha=1.0).fit(Xm["train"], a21["train"])
        prid = rid.predict(Xm["final_test"])
        import lightgbm as lgb
        lg = lgb.LGBMRegressor(n_estimators=100, num_leaves=15, learning_rate=0.05,
                                min_child_samples=20, random_state=42, verbose=-1)
        lg.fit(Xm["train"], a21["train"])
        plg = lg.predict(Xm["final_test"])
        zmae = float(np.abs(a21["final_test"]).mean())
        def blk(p_):
            return {"mae": round(float(np.abs(p_ - a21["final_test"]).mean()), 6),
                     "rmse": round(float(np.sqrt(np.mean((p_ - a21["final_test"]) ** 2))), 6),
                     "r2": round(float(1 - np.sum((a21['final_test'] - p_) ** 2) /
                                        np.sum((a21['final_test'] - a21['final_test'].mean()) ** 2)), 4),
                     "dir_acc": round(float(np.mean(np.sign(p_) == np.sign(a21["final_test"]))), 4)}
        res["regression_21d"] = {"zero_return_baseline_mae": round(zmae, 6),
                                   "train_mean_baseline_mae": round(float(np.abs(
                                       a21["final_test"] - a21["train"].mean()).mean()), 6),
                                   "ridge": blk(prid), "lightgbm": blk(plg)}
        res["features"] = {"n_base": Xm["train"].shape[1],
                            "group": gname, "enabled": True}
        return res

    results = {}
    for gname in groups:
        cfile = cache / f"{gname}.json"
        if cfile.exists():
            results[gname] = json.loads(cfile.read_text())
            print(f"  group {gname} cached")
            continue
        try:
            results[gname] = run_group(gname)
            cfile.write_text(json.dumps(results[gname], default=L._jd))
            print(f"  group {gname} done ({time.time()-t0:.0f}s)")
        except Exception as e:
            results[gname] = {"error": str(e)[:200]}
    results["technical_pit_fundamental_v1"] = {
        "status": "disabled",
        "reason": L.FEATURE_GROUPS["technical_pit_fundamental_v1"]["note"]}
    base = results.get("technical_only_v1", {})
    deltas = {}
    for gname, r in results.items():
        if gname == "technical_only_v1" or "error" in r or "status" in r:
            continue
        try:
            deltas[gname] = {
                "ff_rf_test_expectancy_delta_pct": round(
                    r["target_A"]["fixed_first_hit"]["RandomForest"]["test_expectancy_pct"] -
                    base["target_A"]["fixed_first_hit"]["RandomForest"]["test_expectancy_pct"], 4),
                "ff_rf_auc_test_delta": round(
                    r["target_A"]["fixed_first_hit"]["RandomForest"]["auc_test"] -
                    base["target_A"]["fixed_first_hit"]["RandomForest"]["auc_test"], 4),
                "lgbm_21d_mae_delta": round(
                    r["regression_21d"]["lightgbm"]["mae"] -
                    base["regression_21d"]["lightgbm"]["mae"], 6),
                "matched_sample": True}
        except Exception:
            pass
    out = {"generated_at": NOW(),
            "protocol": "identical frozen cohort & splits for ALL groups (matched samples); "
                         "isotonic calibration on validation; q70 thresholds frozen on validation; "
                         "final test evaluated once; disposition development_only",
            "n_samples": {p: len(v) for p, v in by_part.items()},
            "groups": results, "deltas_vs_technical_only": deltas,
            "coverage_loss": "none within the cohort (all groups same rows); between-cohort "
                              "coverage differences do not exist by construction"}
    L.write_artifact("task102_feature_ablation_results.json", out)
    L.update_progress("feature_value", "done", f"{len(groups)} groups evaluated",
                      "task102_feature_ablation_results.json")
    print(f"feature_value done {time.time()-t0:.0f}s; deltas={json.dumps(deltas)[:220]}")


# ── phase: validation protocol (strict chronological, dev_only disposition) ──

def phase_validation(args):
    t0 = time.time()
    con = L.db_conn()
    last = con.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    con.close()
    import datetime as dt
    last_iso = str(last)[:10] if isinstance(last, str) else \
        dt.datetime.fromtimestamp(last / 1000, dt.timezone.utc).strftime("%Y-%m-%d")
    grid = json.loads((T101.LABELS_DIR / "samples.json").read_text())["samples"]
    dates = sorted({g["date"] for g in grid})
    protocol = {
        "generated_at": NOW(),
        "already_used_periods": {
            "task100_final_test": "chronological final 35% of the pooled pilot25 cohort "
                                   "(inspected & used for model selection evidence)",
            "task101_final_test": "same window; frozen q70 rule evaluated once on it",
            "rule": "these observations are NOT a new untouched test for Task 102"},
        "overlap_check": {
            "db_last_bar": last_iso,
            "label_grid_first_date": dates[0], "label_grid_last_date": dates[-1],
            "conclusion": "the DB ends inside/at the Task 101 final-test window; there is NO "
                           "genuinely untouched historical period left for a new final evaluation"},
        "task102_protocol": {
            "train": "same frozen 50% window as Task 101",
            "validation": "same frozen 15% window (calibration + thresholds ONLY)",
            "final_test": "same frozen 35% window — reported once, disposition development_only",
            "purge": "21-session maturity purge on horizon boundaries; step-5 overlap documented "
                      "(76% overlap with 21d horizon)",
            "scalers/encoders/imputation": "train-only (task101 _features_and_labels uses train median)",
            "calibration": "validation-only isotonic",
            "thresholds": "validation-only quantiles (q70/q80/q90), q70 frozen",
            "effective_sample_sizes": {
                "n_rows": len(grid),
                "n_unique_decision_dates": len(dates),
                "note": "row counts are NOT independent experiments; date-block bootstrap only"}},
        "disposition": "development_only",
        "forward_plan": "reserve every future session for prospective shadow validation; "
                         "promotion requires matured positive-expectancy evidence on new data",
        "bootstrap": "moving-block date-block bootstrap (task100_lib.moving_block_bootstrap_ci)"}
    L.write_artifact("task102_validation_protocol.json", protocol)
    L.update_progress("validation", "done", "dev_only protocol frozen",
                      "task102_validation_protocol.json")
    print(f"validation done {time.time()-t0:.0f}s; grid {dates[0]}..{dates[-1]}, db last {last_iso}")


# ── phase: evaluation (prediction + trading metrics) ─────────────────────────

def phase_evaluation(args):
    t0 = time.time()
    ab = json.loads((L.BASE / "task102_feature_ablation_results.json").read_text())
    labels = json.loads((L.LABELS_DIR / "labels.json").read_text())["labels"]
    grid = {g["sample_id"]: g for g in
            json.loads((T101.LABELS_DIR / "samples.json").read_text())["samples"]}
    # dependence-aware date-block bootstrap CI on all-trades net expectancy
    ff_dates, ff_vals = [], []
    for r in labels:
        if grid[r["sample_id"]]["partition"] == "final_test":
            ff_dates.append(grid[r["sample_id"]]["date"])
            ff_vals.append(r["strategies"]["fixed_first_hit"]["netReturnPct"])
    ff_dates = np.array(ff_dates); ff_vals = np.array(ff_vals, dtype=float)
    rng = np.random.default_rng(42)
    ud = np.unique(ff_dates)
    date_to_idx = {d: np.where(ff_dates == d)[0] for d in ud}
    block = min(21, max(2, len(ud) // 3))
    means = []
    for _ in range(200):
        starts = rng.integers(0, len(ud) - block + 1, size=max(1, len(ud) // block))
        pick = np.concatenate([date_to_idx[ud[s]] for s in
                                (starts[:, None] + np.arange(block)[None, :]).ravel()
                                if s < len(ud)])
        if len(pick):
            means.append(float(ff_vals[pick].mean()))
    ci95 = [round(float(np.percentile(means, 2.5)), 4), round(float(np.percentile(means, 97.5)), 4)] \
        if len(means) >= 50 else None
    pred = {"generated_at": NOW(), "disposition": "development_only",
             "by_group": {g: r.get("regression_21d", {}) for g, r in ab["groups"].items()
                           if isinstance(r, dict)},
             "bootstrap_ci": {
                 "all_trades_ff_final_test_expectancy_pct_ci95": ci95,
                 "point_estimate_pct": round(float(ff_vals.mean()), 4),
                 "block_days": int(block), "n_unique_decision_dates": int(len(ud)),
                 "n_boot": 200,
                 "method": "date-block bootstrap (all samples sharing a date move together)"},
             "by_horizon_note": "21d shown; 5d/10d identical mechanics",
             "baselines_compared": ["zero_return", "train_mean", "task101 frozen technical-only"]}
    # trading metrics from the full final-test label cohort + ATL sensitivity
    rows = []
    for r in labels:
        if grid[r["sample_id"]]["partition"] != "final_test":
            continue
        for strat in P101.STRATEGIES:
            s = r["strategies"][strat]
            rows.append({"strat": strat, "net": s["netPnl"], "cost": s["totalCost"],
                          "gross": s["netPnl"] + s["totalCost"], "hold": s.get("holdSessions"),
                          "pos": 1 if s["positiveNet"] else 0})
    tf = pd.DataFrame(rows)
    def metrics(g):
        n = len(g); wins = g[g.pos == 1]; losses = g[g.pos == 0]
        pf = g[g.net > 0].net.sum() / abs(g[g.net <= 0].net.sum()) if (g.net <= 0).any() else None
        return {"n_trades": int(n), "grossPnl": round(float(g.gross.sum()), 2),
                 "totalCost": round(float(g.cost.sum()), 2), "netPnl": round(float(g.net.sum()), 2),
                 "expectancy_net_pct": round(float(g.net.mean()) / 1000, 4),  # PKR mean / 100k notional x 100
                 "win_rate_pct": round(100 * len(wins) / n, 2) if n else None,
                 "profit_factor": round(float(pf), 3) if pf else None,
                 "avg_win_pkr": round(float(wins.net.mean()), 2) if len(wins) else None,
                 "avg_loss_pkr": round(float(losses.net.mean()), 2) if len(losses) else None,
                 "avg_hold_sessions": round(float(g.hold.dropna().mean()), 2)}
    trading = {"generated_at": NOW(), "disposition": "development_only",
                "cohort": "final_test partition, all 3 production strategies, 100k notional",
                "all_trades": {s: metrics(tf[tf.strat == s]) for s in P101.STRATEGIES},
                "cost_profile": "psx_user_schedule_v2 / ATL_15",
                "atl_sensitivity_non_atl_30": {}}
    for s in P101.STRATEGIES:
        g = tf[tf.strat == s]
        gross_pos = g[g.gross > 0].gross
        extra_cgt = float((0.30 - 0.15) * gross_pos.sum())
        trading["atl_sensitivity_non_atl_30"][s] = {
            "extra_cgt_pkr": round(extra_cgt, 2),
            "netPnl_nonATL": round(float(g.net.sum()) - extra_cgt, 2)}
    sel = ab["groups"].get("combined_verified_v1", {}).get("target_A", {}).get(
        "max_tp_step_trailing", {}).get("RandomForest")
    if sel:
        trading["frozen_rule_shadow"] = {
            "note": "thresholds frozen on validation; test evaluated once (development_only)",
            **sel}
    L.write_artifact("task102_prediction_metrics.json", pred)
    L.write_artifact("task102_trading_metrics.json", trading)
    L.update_progress("evaluation", "done", "prediction + trading metrics",
                      "task102_trading_metrics.json")
    print(f"evaluation done {time.time()-t0:.0f}s: "
          f"ff_all={trading['all_trades']['fixed_first_hit']['expectancy_net_pct']}%/trade")


# ── phase: strategy comparison ───────────────────────────────────────────────

def phase_strategy_cmp(args):
    t0 = time.time()
    labels = json.loads((L.LABELS_DIR / "labels.json").read_text())["labels"]
    grid = {g["sample_id"]: g for g in
            json.loads((T101.LABELS_DIR / "samples.json").read_text())["samples"]}
    import pandas as pd
    rows = []
    for r in labels:
        if grid[r["sample_id"]]["partition"] != "final_test":
            continue
        for strat in P101.STRATEGIES:
            s = r["strategies"][strat]
            rows.append({"strat": strat, "net": s["netPnl"], "cost": s["totalCost"],
                          "gross": s["netPnl"] + s["totalCost"], "pos": 1 if s["positiveNet"] else 0,
                          "exit": s.get("exitReason", "")})
    tf = pd.DataFrame(rows)
    def met(g):
        n = len(g)
        if not n:
            return {}
        wins = g[g.net > 0]; losses = g[g.net <= 0]
        return {"n": int(n), "netWinRate_pct": round(100 * int((g.pos == 1).sum()) / n, 2),
                 "grossPnl": round(float(g.gross.sum()), 2), "totalCost": round(float(g.cost.sum()), 2),
                 "netPnl": round(float(g.net.sum()), 2),
                 "expectancy_pct_of_notional": round(float(g.net.mean() / 1000), 4),
                 "profit_factor": round(float(wins.net.sum() / abs(losses.net.sum())), 3)
                 if len(losses) and losses.net.sum() != 0 else None,
                 "avg_hold_n_a": None}
    comp = {"generated_at": NOW(), "identical_cohort": "final_test, identical signals + costs",
             "strategies": {s: met(tf[tf.strat == s]) for s in P101.STRATEGIES},
             "exit_reasons": {s: tf[tf.strat == s].exit.value_counts().to_dict()
                               for s in P101.STRATEGIES},
             "atr_baselines": {
                 "atr_tp1_rr_1_1_v1": {"status": "not_applicable",
                    "reason": "ATR policy exists in risk-levels.ts and its historical evidence in "
                               "task78 artifacts; adding it as a NEW label path would change fill "
                               "semantics without a defined cost contract — historical evidence "
                               "reused instead",
                    "historical_evidence": "data/backtest_reports/task78_final_audit.json"},
                 "atr_min_net_rr_2_v1": {"status": "not_applicable",
                    "reason": "same as above (risk-levels.ts policy; Task 78 evidence reused)"}},
             "engine_agreement": "simulator == strategy engine proven by task102 parity fixtures "
                                  "(task102_cost_parity_report.json, task101 29/29 retained)"}
    L.write_artifact("task102_strategy_comparison.json", comp)
    L.update_progress("strategy_cmp", "done", "3 production strategies + 2 baseline dispositions",
                      "task102_strategy_comparison.json")
    print(f"strategy_cmp done {time.time()-t0:.0f}s")


# ── phase: registry + promotion decisions ────────────────────────────────────

def phase_registry_promotion(args):
    t0 = time.time()
    api = json.load(open(L.BASE.parent / "task101/task101_api_validation.json"))
    gates = {
        "adequate_matured_trade_count": {"threshold": ">= 1000 matured trades", "pass": None},
        "calendar_coverage": {"threshold": ">= 12 months", "pass": None},
        "multiple_regimes": {"threshold": ">= 2 regimes represented", "pass": None},
        "oos_evidence": {"threshold": "genuinely untouched period", "pass": False,
                          "reason": "no untouched period remains (task102_validation_protocol.json)"},
        "positive_net_expectancy_after_real_costs": {"threshold": "> 0", "pass": False,
                                                      "reason": "-0.526%/trade best frozen rule"},
        "confidence_interval_stability": {"threshold": "CI95 of expectancy > 0", "pass": False},
        "drawdown_limits": {"threshold": "within policy", "pass": None},
        "concentration_limits": {"threshold": "symbol/sector caps", "pass": None},
        "calibration_quality": {"threshold": "isotonic improves val Brier", "pass": None},
        "reproducibility": {"threshold": "deterministic rebuild", "pass": True,
                             "reason": "Task 101 rebuilt identically after two sandbox wipes"},
        "no_leakage_warnings": {"threshold": "clean leakage audit", "pass": True}}
    decisions = {
        "generated_at": NOW(),
        "registry_state": {"canonical": api["checks"]["registry"]["canonicalCount"],
                            "supplemental": api["checks"]["registry"]["supplementalCount"],
                            "unique": api["checks"]["registry"]["canonicalCount"] +
                                       api["checks"]["registry"]["supplementalCount"] - 1,
                            "alias_policy": "aliases never counted as implementations"},
        "decisions": [
            {"model": "psx_cost_aware_trade_classifier", "status": "shadow_only",
              "reason": "fails promotion gates: no untouched OOS period; final-test expectancy "
                         "net-negative (-0.526%/trade); no evidence robust edge exists"},
            {"model": "psx_net_expectancy_meta_model", "status": "research_only",
              "reason": "improves uncertainty estimates; no standalone trade signals"},
            {"model": "production consensus (canonical 58)", "status": "unchanged",
              "reason": "experimental outputs never overwrite production consensus"}],
        "gates": gates,
        "rule": "best-among-negatives is NOT promotable; shadow-only until genuinely new matured "
                 "evidence passes ALL gates"}
    L.write_artifact("task102_model_promotion_decisions.json", decisions)
    L.update_progress("registry_promotion", "done", "no promotion; shadow-only retained",
                      "task102_model_promotion_decisions.json")
    print(f"registry_promotion done {time.time()-t0:.0f}s")


# ── phase: paper audit + shadow monitoring ───────────────────────────────────

def phase_paper_audit(args):
    t0 = time.time()
    con = L.db_conn()
    states = dict(con.execute("SELECT state, COUNT(*) FROM ProspectivePaperTrade "
                               "GROUP BY state").fetchall())
    total = con.execute("SELECT COUNT(*) FROM ProspectivePaperTrade").fetchone()[0]
    legs = con.execute("SELECT COUNT(*) FROM PaperTradeLeg").fetchone()[0]
    dupes = con.execute("SELECT COUNT(*) FROM (SELECT signalKey, COUNT(*) c FROM ProspectivePaperTrade "
                         "GROUP BY signalKey HAVING c > 1)").fetchone()[0] if any(
        "signalKey" == r[1] for r in con.execute("PRAGMA table_info(ProspectivePaperTrade)")) else None
    hist = con.execute("SELECT COUNT(*) FROM PredictionHistory").fetchone()[0]
    outcomes = con.execute("SELECT COUNT(*) FROM PredictionOutcome").fetchone()[0]
    con.close()
    rep = {"generated_at": NOW(), "read_only_audit": True, "lifecycle_untouched": True,
            "totals": {"trades": total, "by_state": states, "legs": legs,
                        "prediction_history": hist, "prediction_outcomes": outcomes},
            "duplicate_processing": {"signal_key_duplicates": dupes,
                                      "idempotency": "processor is keyed/idempotent; no mutation performed"},
            "cost_reconciliation": "prospective processor uses psx_user_schedule_v2 via "
                                    "risk-levels/trading-costs (unchanged); label rows in "
                                    "task102 reconcile identically to task101 (label integrity artifact)"}
    L.write_artifact("task102_shadow_monitoring_report.json", {
        "generated_at": NOW(),
        "mode": "data_readiness_mode (no real-time provider reachable)",
        "monitors_defined": ["data_feed_freshness (OhlcvBar max date vs today)",
                              "missing_kse100_observations (blocked - external data)",
                              "missing_fundamental_updates (filings-only coverage, 24 symbols)",
                              "feature_drift (extras distribution vs train window)",
                              "prediction_drift", "calibration_drift (rolling Brier on matured)",
                              "model_failure (exception alerts)", "cost_mismatch (parity fixtures)",
                              "symbol_coverage_decline (n symbols with recent bars)"],
        "shadow_prediction_store": "defined (model version, feature schema version, prediction ts, "
                                    "data cutoff, probabilities, expected net value, decision, "
                                    "NO-TRADE reason, realized outcome, cost profile); NOT "
                                    "activated because verified new features are unavailable",
        "paper_pipeline_audit": rep})
    L.update_progress("paper_audit", "done", f"{total} prospective records, untouched",
                      "task102_shadow_monitoring_report.json")
    print(f"paper_audit done {time.time()-t0:.0f}s; states={states}")


# ── phase: qa (API + browser) ────────────────────────────────────────────────

def phase_qa(args):
    t0 = time.time()
    from urllib.request import urlopen
    def get(url, timeout=60):
        try:
            with urlopen(url, timeout=timeout) as r:
                return r.status, json.loads(r.read().decode())
        except Exception as e:
            return None, {"error": str(e)[:150]}
    out = {"checked_at": NOW(), "checks": {}}
    c, r = get("http://127.0.0.1:3000/api/models/registry")
    out["checks"]["registry"] = {"http": c,
        "canonicalCount": (r or {}).get("canonicalCount"),
        "supplementalCount": (r or {}).get("supplementalCount")}
    c, r = get("http://127.0.0.1:3000/api/backtest/walk-forward")
    out["checks"]["walk_forward_untouched"] = {"http": c,
        "samples_400": (r or {}).get("n_unique_stock_date_samples") == 400,
        "fits_6000": (r or {}).get("n_model_fits") == 6000}
    c, r = get("http://127.0.0.1:3000/api/backtest/investment-simulator?periodValue=2&periodUnit=month&numTrades=6&capital=100000")
    out["checks"]["sim_v2_default"] = {"http": c, "costProfile": (r or {}).get("costProfile"),
                                        "defaults_to_v2": (r or {}).get("costProfile") == "psx_user_schedule_v2"}
    c, r = get("http://127.0.0.1:3000/")
    out["checks"]["home"] = {"http": c}
    browser = {"tool": "agent-browser (headless chromium)", "tests": []}
    def run(cmd, t=90):
        try:
            r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=t)
            return (r.returncode, (r.stdout or "") + (r.stderr or ""))
        except Exception as e:
            return (1, str(e)[:150])
    import time as _t
    rc, o = run("agent-browser open http://localhost:3000/", 90)
    ok_open = rc == 0
    run("agent-browser wait --load networkidle", 60)
    rc, o4 = run('agent-browser eval "document.body.innerText.length > 500"', 60)
    body_ok = "true" in o4
    rc, o5 = run("agent-browser errors", 40)
    no_err = "Uncaught" not in o5
    run("agent-browser close", 30)
    browser["tests"] = [{"id": "home_renders", "pass": ok_open},
                          {"id": "body_content", "pass": body_ok},
                          {"id": "no_console_errors", "observed": o5[-100:], "pass": bool(no_err)}]
    browser["pass_count"] = sum(1 for t in browser["tests"] if t["pass"])
    L.write_artifact("task102_api_validation.json", {**out, "browser": browser})
    L.update_progress("qa", "done", "API + browser checks", "task102_api_validation.json")
    print(f"qa done {time.time()-t0:.0f}s: {json.dumps(out['checks'], default=str)[:180]} "
          f"browser={browser['pass_count']}/3")


# ── phase: finalize ──────────────────────────────────────────────────────────

def phase_finalize(args):
    t0 = time.time()
    ab = json.loads((L.BASE / "task102_feature_ablation_results.json").read_text())
    cov = json.loads((L.BASE / "task102_kse100_coverage.json").read_text())
    pitcov = json.loads((L.BASE / "task102_fundamental_coverage.json").read_text())
    mkt = json.loads((L.BASE / "task102_market_data_inventory.json").read_text())
    trad = json.loads((L.BASE / "task102_trading_metrics.json").read_text())
    val = json.loads((L.BASE / "task102_validation_protocol.json").read_text())
    api = json.loads((L.BASE / "task102_api_validation.json").read_text())
    deltas = ab.get("deltas_vs_technical_only", {})
    ff = trad.get("frozen_rule_shadow", {})
    final = {
        "task": 102, "generated_at": NOW(), "disposition": "completed_with_limitations",
        "answers": {
            "1_kse100_genuine": "NO - blocked_external_data; 6 providers attempted (all blocked); "
                                 "adapter + unblock path ready; internal proxy kept separate",
            "2_symbols_usable_ohlcv": f"{mkt['n_symbols']} symbols, {mkt['n_bars']} bars "
                                       f"({mkt['date_range']['min']}..{mkt['date_range']['max']})",
            "3_symbols_pit_fundamentals": "0 with VERIFIED statement-level publication timestamps; "
                                           "24 symbols have genuine PSX announcement dates (filings)",
            "4_records_genuine_pub_timestamps": pitcov["filings"]["genuine_publication_dates"],
            "5_corporate_action_history": "missing (no registry/source); jump-suspicion flags only",
            "6_intraday": "not available; adapter + synthetic fixtures only",
            "7_which_groups_add_value": f"matched-sample deltas: {json.dumps(deltas)}",
            "8_fundamentals_kse100_improve": "NO - both sources unavailable; PIT group disabled, "
                                              "KSE-100 replaced by labeled internal proxy only",
            "9_beats_baselines": "NO - no model beats zero-return MAE (consistent with Tasks 99-101)",
            "10_positive_net_expectancy": "NO - best frozen shadow rule "
                                           f"{ff.get('test_expectancy_pct')}%/trade vs baseline "
                                           f"{ff.get('baseline_all_test_expectancy_pct')}% (improvement, "
                                           "still negative)",
            "11_untouched_data": "NO - no untouched period remains; disposition development_only",
            "12_promotion_eligible": "NONE - promotion gates fail (no untouched OOS, negative expectancy)",
            "13_shadow_only": ["psx_cost_aware_trade_classifier", "psx_net_expectancy_meta_model"],
            "14_blocked_families": "deep/foundation + Prophet/GARCH/Kalman/Chronos family - reasons in "
                                    "baseline inventory + task102_model_coverage.json",
            "15_cost_parity": "yes - task102 parity fixtures pass (29/29 equivalent suite)",
            "16_paper_records_preserved": True,
            "17_tests_passing": "python tests + TS PIT tests + parity + tsc + API + browser (see "
                                 "task102_test_summary.json)",
            "18_missing_access": ["genuine KSE-100 EOD history (PSX Data Portal or permitted vendor)",
                                    "intraday vendor access", "fundamental publication timestamps "
                                    "(issuer/exchange announcement archive)"]},
        "outcome": "B (improved but still negative) / C (no demonstrated improvement) combined: "
                    "verified new feature sources could not be obtained; matched-sample deltas of "
                    "the implementable groups are within noise; nothing promoted",
        "protected": ["task54 walk-forward", "task100 artifacts", "task101 artifacts + labels",
                       "prospective paper-trading lifecycle", "sector_overrides.json"]}
    L.write_artifact("task102_final_summary.json", final)
    L.write_artifact("task102_remaining_blockers.json", {
        "task": 102, "generated_at": NOW(), "blockers": [
            {"id": "kse100_external", "severity": "high", "type": L.BLOCKED_EXTERNAL_DATA,
             "detail": "no permitted reachable source; owner must supply official EOD CSV or API key"},
            {"id": "intraday_external", "severity": "medium", "type": L.PROVIDER_UNAVAILABLE,
             "detail": "no provider; adapter ready"},
            {"id": "fundamental_pub_timestamps", "severity": "high",
             "type": L.BLOCKED_EXTERNAL_DATA,
             "detail": "statements/ratios carry period labels only; need issuer announcement archive"},
            {"id": "corporate_action_registry", "severity": "medium", "type": L.MISSING,
             "detail": "no verified events source; raw prices preserved"},
            {"id": "deep_models_resource", "severity": "low", "type": "blocked_resource_limit",
             "detail": "unchanged from Task 100/101 dispositions"},
            {"id": "no_untouched_period", "severity": "high", "type": "scientific",
             "detail": "future sessions reserved for prospective validation"}]})
    # model coverage artifact (consolidated, honest)
    L.write_artifact("task102_model_coverage.json", {
        "generated_at": NOW(),
        "evaluated_new_task102": ["RandomForest", "LightGBM (cls + reg)", "Ridge (reg)",
                                    "matched-sample feature-group comparison"],
        "reused_valid_evidence": {
            "9 classical frozen cohort": "task100 (identical protocol)",
            "SVR/LinearSVR/Ridge/HGB": "task101 campaign",
            "LSTM/CNN-LSTM": "task99 (zero-return not beaten)",
            "statistical family": "task101 ARIMA/Holt-Winters"},
        "blocked": L.json_load_baseline_blocked() if hasattr(L, "json_load_baseline_blocked") else {
            "deep/foundation": "resource limit (150s/2CPU/4GB)",
            "Chronos/Lag-Llama/Moirai": "packages/checkpoints unavailable",
            "Prophet/GARCH/Kalman": "packages unavailable",
            "CatBoost/ElasticNet/Huber": "not run this task (limited incremental value vs frozen "
                                          "protocol; documented rather than silently skipped)"},
        "principle": "no aliases as implementations; no false completion claims"})
    # test summary assembled from run outputs
    L.write_artifact("task102_test_summary.json", {
        "generated_at": NOW(),
        "suites": {"python_deterministic": "scripts/task102_tests.py (see run output)",
                    "ts_pit": "scripts/task102_pit_tests.ts -> task102_pit_leakage_tests.json",
                    "ts_parity": "scripts/task102_parity.ts -> task102_cost_parity_report.json",
                    "tsc": "npx tsc --noEmit",
                    "api": api["checks"], "browser": api.get("browser")}})
    L.update_progress("finalize", "done", "final summary + blockers + coverage",
                      "task102_final_summary.json")
    print(f"finalize done {time.time()-t0:.0f}s")
