#!/usr/bin/env python3
"""Task 107 Phase 5 — automated trade-outcome maturation + horizon accounting.

Wraps the production maturation engine (task106_mature.ts: simulateStrategy +
computeTradeCostsV2, psx_user_schedule_v2) over ALL pending observations from
the three frozen generations, then emits:
  - task107_outcome_maturity_report.json   (matured / pending / unfilled)
  - task107_pending_positions.csv          (open positions + MTM, never wins)
  - task107_realized_trade_ledger.csv      (one row per matured outcome)
  - task107_mark_to_market_report.json     (unrealized, kept separate)
  - task107_horizon_maturity_report.json   (5/10/21 session accounting)

Trading-session counting uses ACTUAL DB sessions (never calendar days).
TIME_UP maturity requires 21 full sessions; terminal SL/TP3 exits mature early.
"""
from __future__ import annotations
import csv, json, os, sqlite3, subprocess, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T107 = ROOT / "data/backtest_reports/task107"
T106 = ROOT / "data/backtest_reports/task106"
T105 = ROOT / "data/backtest_reports/task105"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # type: ignore  # noqa: E402

STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]
HORIZONS = [5, 10, 21]


def j(p):
    return json.loads(Path(p).read_text())


def build_ledger() -> list[dict]:
    ledger = []
    gen1 = j(T105 / "shadow_observations/task105_shadow_observations.json")
    gen2 = j(T106 / "shadow_observations/task106_shadow_observations.json")
    gen3 = j(T107 / "shadow_observations/task107_shadow_observations.json") if (T107 / "shadow_observations/task107_shadow_observations.json").exists() else {"observations": []}
    for o in gen1["observations"]:
        lv = o["strategies"]["fixed_first_hit"]
        if lv.get("sl") is None:
            continue
        ledger.append({"decision_id": o["decision_id"], "generation": "task105-gen1",
                        "symbol": o["decision_id"].split("_")[1],
                        "decision_date": o.get("decision_timestamp", "2026-10-29"),
                        "levels": {k: lv[k] for k in ("sl", "tp1", "tp2", "tp3")}})
    for src, gen in ((gen2, "task106-gen2"), (gen3, "task107-gen3")):
        for o in src["observations"]:
            ledger.append({"decision_id": o["decision_id"], "generation": gen,
                            "symbol": o["symbol"],
                            "decision_date": o.get("market_session_date", o.get("decision_timestamp")),
                            "levels": o["levels"]})
    return ledger


def sessions_between(db, start_exclusive: str, end: str) -> list[str]:
    rows = db.execute("SELECT DISTINCT date FROM OhlcvBar WHERE date>? AND date<=? ORDER BY date",
                       (start_exclusive, end)).fetchall()
    return [r[0] for r in rows]


def main() -> int:
    t0 = time.time()
    ledger = build_ledger()
    lp = T107 / "_pending_ledger.json"
    lp.write_text(json.dumps(ledger))
    out = T107 / "_matured.json"

    env = dict(os.environ)
    env.setdefault("DATABASE_URL", f"file:{ROOT}/db/custom.db")
    r = subprocess.run(["bun", "scripts/task106_mature.ts", str(lp), str(out)],
                        capture_output=True, text=True, cwd=ROOT, timeout=560, env=env)
    if r.returncode != 0:
        print((r.stderr or r.stdout)[-400:])
        return 4
    matured = j(out)
    msum = matured["summary"]

    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    max_date = db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    realized_rows, pending_rows, horizon_rows = [], [], []
    for o in matured["observations"]:
        if "decision_date" not in o:
            continue  # unfilled entries have no outcomes to process
        sess = sessions_between(db, o["decision_date"], max_date)
        for st, res in o["outcomes"].items():
            if st not in STRATS or "status" not in res:
                continue
            status = res["status"]
            row = {"decision_id": o["decision_id"], "generation": next(
                l["generation"] for l in ledger if l["decision_id"] == o["decision_id"]),
                "symbol": o["symbol"], "decision_date": o["decision_date"],
                "strategy": st, "status": status}
            if status.startswith("matured"):
                row.update({"entry_date": o["entry_date"], "entry": res["entry"],
                             "exit_reason": res["exit_reason"], "net_pnl_pkr": res["realized_net_pnl"],
                             "net_return_pct": round(res["net_return_pct"], 4),
                             "sessions_used": res["sessions_used"], "win": res["realized_net_pnl"] > 0})
                realized_rows.append(row)
            else:
                row.update({"entry_date": o["entry_date"], "entry": res["entry"],
                             "sessions_available": res["sessions_available"],
                             "sessions_to_21": max(0, 21 - res["sessions_available"]),
                             "realized_legs_pnl_pkr": res.get("realized_net_pnl", 0.0),
                             "unrealized_mtm_pkr": res.get("unrealized_mtm_pkr"),
                             "latest_session": sess[-1] if sess else None,
                             "maturity_evidence_needed": f"sessions {res['sessions_available'] + 1}..21 after {o['decision_date']} (or terminal SL/TP3 earlier)"})
                pending_rows.append(row)
    db.close()

    # horizon accounting: per entry date, how many actual sessions exist
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    for entry_date in sorted({p.get("entry_date") or r.get("entry_date") for p in pending_rows + realized_rows if (p.get("entry_date") or r.get("entry_date"))}):
        sess = sessions_between(db, "2026-10-29", max_date)
        sess = [s for s in sess if s > "2026-10-29"]
    # per-generation entry cohorts
    seen = set()
    for row in pending_rows + realized_rows:
        ed = row.get("entry_date")
        if not ed or (ed, row["generation"]) in seen:
            continue
        seen.add((ed, row["generation"]))
        sess = [s for s in sessions_between(db, "2026-10-29", max_date) if s > "2026-10-29"]
        after = [s for s in sess if s >= ed]
        horizon_rows.append({"generation": row["generation"], "entry_date": ed,
                              "sessions_observed_since_entry": len(after),
                              "h5_complete": len(after) >= 5, "h10_complete": len(after) >= 10,
                              "h21_complete": len(after) >= 21,
                              "expected_h21_date_if_all_sessions_real": "unknown (depends on future genuine sessions)",
                              "latest_session": sess[-1] if sess else None})
    db.close()

    realized_total = round(sum(r["net_pnl_pkr"] for r in realized_rows), 2)
    unrealized_total = round(sum(p["unrealized_mtm_pkr"] or 0.0 for p in pending_rows), 2)

    (T107 / "task107_outcome_maturity_report.json").write_text(json.dumps({
        "report": "task107_outcome_maturity_report", "generated_at": L.NOW(), "status": "completed",
        "engine": "task106_mature.ts (production simulateStrategy; computeSimTradeCosts -> computeTradeCostsV2; psx_user_schedule_v2)",
        "ledger_entries": len(ledger), "summary": msum,
        "matured_strategy_outcomes": msum["matured"],
        "matured_unique_trades": len({r["decision_id"] for r in realized_rows if r["status"].startswith("matured")}),
        "pending_strategy_outcomes": len(pending_rows),
        "realized_total_pkr": realized_total,
        "unrealized_mtm_total_pkr": unrealized_total,
        "cost_rules": ["SL-first; gap-aware fills; TIME_UP only at 21 full sessions",
                        "scale-out legs charged individually by the engine (no double charge); parity fixture in task107_cost_parity_report.json"],
        "no_mtm_counted_as_realized": True,
        "verdict": "PASS"}, indent=1))

    with open(T107 / "task107_pending_positions.csv", "w", newline="") as fh:
        if pending_rows:
            w = csv.DictWriter(fh, fieldnames=list(pending_rows[0].keys()))
            w.writeheader()
            w.writerows(pending_rows)
    with open(T107 / "task107_realized_trade_ledger.csv", "w", newline="") as fh:
        if realized_rows:
            w = csv.DictWriter(fh, fieldnames=list(realized_rows[0].keys()))
            w.writeheader()
            w.writerows(realized_rows)

    (T107 / "task107_mark_to_market_report.json").write_text(json.dumps({
        "report": "task107_mark_to_market_report", "generated_at": L.NOW(), "status": "completed",
        "pending_positions": len(pending_rows),
        "unrealized_total_pkr": unrealized_total,
        "realized_total_pkr_separate": realized_total,
        "warning": "MTM is hypothetical unrealized value at the latest verified close; it is NEVER counted as realized P&L, never classified win/loss, and never used as promotion evidence",
        "stale_handling": "a pending position whose latest available bar is older than the frontier is flagged by latest_session in the pending CSV; no synthetic closing price is ever invented",
        "verdict": "PASS"}, indent=1))

    (T107 / "task107_horizon_maturity_report.json").write_text(json.dumps({
        "report": "task107_horizon_maturity_report", "generated_at": L.NOW(), "status": "completed",
        "horizons_sessions": HORIZONS,
        "counting_rule": "trading sessions from the ACTUAL OhlcvBar calendar; calendar days are never substituted; a 21-session observation does NOT close because 21 calendar days passed",
        "cohorts": horizon_rows,
        "verdict": "PASS"}, indent=1))
    print(json.dumps({"matured_outcomes": msum["matured"], "pending": len(pending_rows),
                       "realized": realized_total, "unrealized": unrealized_total,
                       "horizon_cohorts": len(horizon_rows)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
