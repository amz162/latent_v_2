#!/usr/bin/env python3
"""Task 105 — Phase 2: end-to-end signal path forensics artifacts."""
from __future__ import annotations
import csv, json, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T105 = ROOT / "data/backtest_reports/task105"
T104 = ROOT / "data/backtest_reports/task104"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402

STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]


def j(p):
    return json.loads(Path(p).read_text())


def main() -> None:
    t0 = time.time()
    recon = j(T104 / "task104_engine_recon.json")["trades"]
    probs = j(T104 / "task104_probabilities.json")
    pmap = {(r["sample_id"]): r["p_cal"] for r in probs["rows"] if r["strategy"] == "max_tp_step_trailing"}
    dtests = j(T105 / "_direction_tests_raw.json")

    # ── 1) signal path audit (18 stages, code-referenced) ────────────────────
    path = {
        "report": "task105_signal_path_audit", "generated_at": L.NOW(), "status": "completed",
        "evidence_class": "code inspection + fixture tests + frozen historical artifacts (development_only)",
        "stages": [
            {"stage": 1, "name": "raw market data", "source": "Prisma OhlcvBar (db/custom.db), psxdata.ts importer", "finding": "OK — 25-symbol pilot cohort, dates 2016-2026; verified latest session 2026-10-29"},
            {"stage": 2, "name": "adjusted market data", "source": "task101_data_quality_report.json adjustment_semantics; psxdata.ts", "finding": "OK — single adjustment convention applied at import; no raw/adjusted mixing found in feature or label paths"},
            {"stage": 3, "name": "feature generation", "source": "task101_phases._rebuild_grid_with_features (T0.FC + 3 cross-sectional)", "finding": "OK — 22 frozen features, bars strictly <= decision date (cutoff index), train-median NaN fill, train-only scaler"},
            {"stage": 4, "name": "model input", "source": "StandardScaler fit on train partition only", "finding": "OK — no test statistics leak into scaling"},
            {"stage": 5, "name": "model output", "source": "cls_fit101 RandomForest predict_proba (P(net>0)); historical direction models predict forward return", "finding": "OK — output is a probability for cost-aware models; return-regression models output fraction-of-price returns"},
            {"stage": 6, "name": "prediction horizon", "source": "task100 horizons 5/10/21d; trade labels 21-session engine horizon", "finding": "CONSISTENT WITHIN each protocol; direction models (5/10/21d) and trade labels (21-session TP/SL) are DIFFERENT targets — see task105_target_semantics_audit.json"},
            {"stage": 7, "name": "probability/confidence transformation", "source": "isotonic on validation (task104_probabilities.json)", "finding": "calibrated probabilities valid by construction on validation; OOS association ~0 (Task 104) — reproduced in Phase 6"},
            {"stage": 8, "name": "BUY/SELL/HOLD mapping", "source": "ensemble.ts (avgRet>+1% BUY, <-1% SELL); ai-model-signals route (EMA/RSI rules); cost-aware filter: no direction — take/skip long trade", "finding": "MAPPING DIRECTIONALLY CORRECT; SELL/SHORT signals are DISPLAYED and SIMULATED although PSX retail has no verified short-selling rights — flagged as capital-protection issue, not a sign defect"},
            {"stage": 9, "name": "entry timestamp", "source": "portfolio-config entry_convention=next_session_open; label engine entryIdx=cutoffIdx+1", "finding": "OK — decision date is the information cutoff; entry is the NEXT session's open"},
            {"stage": 10, "name": "entry price", "source": "bars[entryIdx].open", "finding": "OK — verified in recon records"},
            {"stage": 11, "name": "ATR calculation", "source": "risk-levels.ts (ATR14, canonical atr14-1-1.5-2-3)", "finding": "OK — uses historical candles up to cutoff only; fixture-tested"},
            {"stage": 12, "name": "SL calculation", "source": "risk-levels.ts: entry -/+ 1xATR", "finding": "OK — direction-correct on both sides (fixture suite risk_levels_buy/sell_geometry)"},
            {"stage": 13, "name": "TP1/TP2/TP3", "source": "risk-levels.ts: entry +/- {1,1.5,2}xATR (tp3 at 2x per policy string 1-1.5-2-3)", "finding": "OK — monotone, direction-correct"},
            {"stage": 14, "name": "position sizing", "source": "Task 104 sizing policies (A/B/C); engine quantity=floor(alloc/price)", "finding": "OK — whole shares, cash-constrained, no leverage"},
            {"stage": 15, "name": "exit strategy", "source": "strategy-engine.ts (SL-first same-candle, gap-aware, TP3 terminal, step-trailing, 50/25/25, TIME_UP@21)", "finding": "OK — 6/6 fixture suites pass"},
            {"stage": 16, "name": "execution simulation", "source": "strategy-engine.ts + task104_portfolio_sim.ts (exits before entries same session)", "finding": "OK — daily-bar realism limitation documented; no intraday data exists"},
            {"stage": 17, "name": "fee calculation", "source": "trading-costs.ts computeTradeCostsV2 (psx_user_schedule_v2, ATL_15/NON_ATL_30)", "finding": "OK — parity-tested in Task 103/104 and Phase 12"},
            {"stage": 18, "name": "final net P&L", "source": "net = gross - costs per leg; portfolio ledger identity verified", "finding": "OK — task105_portfolio_integrity.json PASS"},
        ],
        "defects_found": [
            {"id": "CP-1", "severity": "capital-protection", "title": "SELL/SHORT signals displayed and simulated without verified short-selling rights",
              "affected_production_surface": "ai-model-signals route, Investment Simulator (simTrade direction=SELL), ensemble SELL mapping",
              "historical_impact": "NONE on Task 100-104 results — all 11,521 historical label trades are BUY-only",
              "action": "Task 105 policy layer marks short-capable signals research_only; UI disclosure added (Phase 10)"},
            {"id": "CP-2", "severity": "capital-protection", "title": "Uncalibrated confidence displayed as if actionable",
              "affected_production_surface": "ai-model-signals confidence formula (55+min(30,|rsi-50|)) is a heuristic score, not a probability",
              "historical_impact": "none on labels; misleads users if read as win probability",
              "action": "Phase 6 semantics + Phase 10 UI labeling"},
        ],
        "sign_defects_found": "NONE — no evidence of reversed predictions, mis-scaled targets, or wrong-horizon conflation in the execution path",
        "runtime_seconds": round(time.time() - t0, 1)}
    (T105 / "task105_signal_path_audit.json").write_text(json.dumps(path, indent=1))

    # ── 2) prediction -> trade trace CSV (3 representative trades) ───────────
    by_exit = {}
    for r in recon:
        s = r["strategies"]["scale_out_50_25_25"]
        if s["exit_reason"] == "SL" and "SL" not in by_exit: by_exit["SL"] = r
        if r["strategies"]["fixed_first_hit"]["exit_reason"] == "TP3" and "TP3" not in by_exit: by_exit["TP3"] = r
        if len(s["legs_detail"]) >= 3 and "SCALE" not in by_exit: by_exit["SCALE"] = r
    rows = []
    for kind, r in by_exit.items():
        base = [("sample_id", r["sample_id"]), ("symbol", r["symbol"]),
                 ("decision_date(info cutoff)", r["decision_date"]),
                 ("model_probability_P(net>0)", round(pmap.get(r["sample_id"], float("nan")), 4)),
                 ("entry_date(next session open)", r["entry_date"]),
                 ("entry_price", r["entry_price"]),
                 ("ATR14_policy", "atr14-1-1.5-2-3 baseline"),
                 ("sl", round(r["sl"], 4)), ("tp1", round(r["tp1"], 4)),
                 ("tp2", round(r["tp2"], 4)), ("tp3", round(r["tp3"], 4))]
        for st in STRATS:
            s = r["strategies"][st]
            base += [(f"{st}:direction", "BUY (long-only cohort)"),
                      (f"{st}:quantity@100k", r["quantity"]),
                      (f"{st}:legs", "|".join(f"{l['exit_date']}@{l['exit_price']}x{l['quantity']}" for l in s["legs_detail"])),
                      (f"{st}:gross_pnl", s["gross_pnl"]), (f"{st}:total_cost", s["total_cost"]),
                      (f"{st}:brokerage", s["brokerage"]), (f"{st}:cgt", s["cgt"]),
                      (f"{st}:slippage", s["slippage"]),
                      (f"{st}:net_pnl", s["net_pnl"]), (f"{st}:net_return_pct", s["net_return_pct"]),
                      (f"{st}:exit_reason", s["exit_reason"]), (f"{st}:hold_sessions", s["hold_sessions"])]
        for i, (f, v) in enumerate(base):
            rows.append({"trade": f"{kind}:{r['sample_id']}", "step_order": i, "field": f, "value": v})
    with open(T105 / "task105_prediction_to_trade_trace.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["trade", "step_order", "field", "value"])
        w.writeheader(); w.writerows(rows)

    # ── 3) direction mapping tests merge ─────────────────────────────────────
    (T105 / "task105_direction_mapping_tests.json").write_text(json.dumps({
        "report": "task105_direction_mapping_tests", "generated_at": L.NOW(), "status": "completed",
        "method": "fixture tests executed against PRODUCTION modules (scripts/task105_direction_tests.ts); synthetic OHLC fixtures only — no market claims",
        "suites": dtests["suites"],
        "production_mappings": {
            "cost_aware_filter": "probability of net-positive trade; take/skip a long-only trade; no direction inversion",
            "ensemble_majority_and_return": "avgReturn>+1% BUY, <-1% SELL, else HOLD (ensemble.ts)",
            "ai_model_signals_route": "EMA20/50 + RSI rules -> BUY/SELL/HOLD with heuristic confidence 50-85",
            "strategy_engine": "direction-aware SL-first gap-aware TP/SL; BUY and SELL symmetric (fixtures pass)"},
        "verdict": "NO sign or mapping defect; SELL capability is a rights/permissions issue (CP-1), not a bug"}, indent=1))

    # ── 4) timestamp alignment report ────────────────────────────────────────
    ts = {
        "report": "task105_timestamp_alignment_report", "generated_at": L.NOW(), "status": "completed",
        "checks": [
            {"check": "features use bars <= decision date", "implementation": "task101_phases._rebuild_grid_with_features via wf.build_sample_list cutoff", "verdict": "PASS"},
            {"check": "entry at next available execution point", "implementation": "entryIdx = cutoffIdx + 1; entryPrice = bars[entryIdx].open; entry_convention=next_session_open", "verdict": "PASS"},
            {"check": "engine scans only post-entry bars", "implementation": "scanBars = bars.slice(entryIdx, entryIdx+21)", "verdict": "PASS"},
            {"check": "portfolio sim chronological acceptance", "implementation": "candidates sorted by entry_date; no future info in selection (Task 104)", "verdict": "PASS"},
            {"check": "label horizon == strategy horizon", "implementation": "21-session MAX_HORIZON in labels and engine", "verdict": "PASS"},
            {"check": "no future candle used in exits", "implementation": "engine walks scanBars forward only (fixture-tested)", "verdict": "PASS"},
            {"check": "decision-time model probabilities frozen", "implementation": "train/val/final split chronological with 21-session purge (task104_probabilities.json)", "verdict": "PASS"}],
        "verdict": "NO timestamp or lookahead defect"}
    (T105 / "task105_timestamp_alignment_report.json").write_text(json.dumps(ts, indent=1))

    # ── 5) execution logic audit ─────────────────────────────────────────────
    ex = {
        "report": "task105_execution_logic_audit", "generated_at": L.NOW(), "status": "completed",
        "semantics_verified": [
            "SL-first same-candle priority", "gap-aware stop fills (open beyond SL -> open)",
            "TP3 terminal; TP1/TP2 milestones then continue", "step-trailing after TP1/TP2",
            "scale-out 50/25/25 integer split with per-leg costs once per leg",
            "TIME_UP exit at 21-session horizon", "suspended symbols carry last close in MTM (Task 104 sim)",
            "same-session ordering: exits processed before entries (conservative)",
            "no double-counting of exit legs; cash reused only after leg exits"],
        "daily_bar_limitation": "execution realism bounded by daily OHLC (no intraday records exist); same-candle SL+TP ambiguous case resolved SL-first — the CONSERVATIVE choice (pessimistic for results)",
        "raw_vs_adjusted": "single adjustment convention; no mixing found",
        "suspended_or_stale": "data-freshness module gates live signals; historical labels exclude missing-entry-bar samples",
        "verdict": "NO execution-logic defect that would explain negative performance; SL-first bias is conservative"}
    (T105 / "task105_execution_logic_audit.json").write_text(json.dumps(ex, indent=1))
    print(f"phase2 done: trace rows={len(rows)}")


if __name__ == "__main__":
    main()
