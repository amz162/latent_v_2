#!/usr/bin/env python3
"""Task 119 Checkpoint D — INDEPENDENT outcome-ledger reconciliation.

Re-derives every reported outcome number from raw inputs (frozen shadow
observation ledgers + raw OhlcvBar calendar + the production maturation
engine invoked fresh) WITHOUT trusting stored reports:

  Layer 1 (strategy outcomes, task107 engine): partition every
  (decision_id, strategy) outcome row into mutually exclusive categories:
    fixed_horizon_matured (TIME_UP exit at horizon completion)
    terminal_exits        (early SL/TP strategy exits — realized, NOT horizon maturities)
    pending_open          (open positions; views: pending_fixed_horizon outcomes,
                           pending_mtm positions — reported as separate COUNTS)
    unfilled              (no entry filled — no outcome exists)
    missing_data          (open position without a valid latest close — MTM impossible)
  Layer 2 (fixed-horizon 5/10/21 ledger, task114): recompute session clocks from
  raw bars and re-count matured/pending/terminal per horizon, independent of the
  stored artifact.

Point-in-time mode: a temp DB clone clamped to <= 2026-11-05 reproduces the
Task 118 reported population for comparison. Historical records are never
modified."""
from __future__ import annotations
import csv
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402
import task107_maturity as TM  # noqa: E402

T107 = ROOT / "data/backtest_reports/task107"
T114 = ROOT / "data/backtest_reports/task114"
T119 = ROOT / "data/backtest_reports/task119"
T119.mkdir(parents=True, exist_ok=True)
STRATS = TM.STRATS
HORIZONS = [5, 10, 21]
PIT_FRONTIER = "2026-11-05"  # Task 118 reported population


def sessions_after(db_path: str, entry_exclusive: str, max_date: str) -> list[str]:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        rows = con.execute("SELECT DISTINCT date FROM OhlcvBar WHERE date>? AND date<=? ORDER BY date",
                           (entry_exclusive, max_date)).fetchall()
        return [r[0] for r in rows]
    finally:
        con.close()


def partition_engine_output(matured: dict, ledger: list[dict], db_path: str, max_date: str) -> dict:
    """Independent five-way exclusive partition of engine outcome rows."""
    gen_of = {l["decision_id"]: l["generation"] for l in ledger}
    part = {"fixed_horizon_matured": [], "terminal_exits": [], "pending_open": [],
            "unfilled": [], "missing_data": []}
    for o in matured["observations"]:
        did = o["decision_id"]
        if "decision_date" not in o:
            # unfilled entry: the engine records no entry/outcomes
            for st in STRATS:
                part["unfilled"].append({
                    "id": f"{did}::{st}", "decision_id": did, "strategy": st,
                    "cohort": gen_of.get(did, "?"), "outcome_type": "unfilled"})
            continue
        sess = sessions_after(db_path, o["decision_date"], max_date)
        for st, res in o["outcomes"].items():
            if st not in STRATS or "status" not in res:
                continue
            status = res["status"]
            base = {"id": f"{did}::{st}", "decision_id": did, "strategy": st,
                    "cohort": gen_of.get(did, "?"), "symbol": o["symbol"],
                    "entry_date": o.get("entry_date")}
            if status.startswith("matured"):
                exit_reason = res.get("exit_reason", "")
                base.update({"entry": res.get("entry"), "exit_reason": exit_reason,
                             "sessions_used": res.get("sessions_used"),
                             "pnl_pkr": res.get("realized_net_pnl"),
                             "exit_session": sess[res["sessions_used"] - 1]
                             if res.get("sessions_used") and 0 < res["sessions_used"] <= len(sess) else None,
                             "in_realized_pnl": True, "in_mtm": False})
                if exit_reason == "TIME_UP":
                    base["outcome_type"] = "fixed_horizon_maturity"
                    part["fixed_horizon_matured"].append(base)
                else:
                    base["outcome_type"] = "terminal_strategy_exit"
                    part["terminal_exits"].append(base)
            else:
                mtm = res.get("unrealized_mtm_pkr")
                base.update({"entry": res.get("entry"),
                             "sessions_available": res.get("sessions_available"),
                             "latest_session": sess[-1] if sess else None,
                             "mtm_pkr": mtm, "realized_legs_pnl_pkr": res.get("realized_net_pnl", 0.0),
                             "horizons_pending": [h for h in HORIZONS
                                                  if (res.get("sessions_available") or 0) < h],
                             "in_realized_pnl": False, "in_mtm": mtm is not None})
                if mtm is None:
                    base["outcome_type"] = "missing_data"
                    part["missing_data"].append(base)
                else:
                    base["outcome_type"] = "pending_open"
                    part["pending_open"].append(base)
    return part


def summarize(part: dict) -> dict:
    realized = round(sum(r.get("pnl_pkr") or 0 for r in part["fixed_horizon_matured"])
                     + sum(r.get("pnl_pkr") or 0 for r in part["terminal_exits"]), 2)
    mtm = round(sum(r.get("mtm_pkr") or 0 for r in part["pending_open"]), 2)
    total = sum(len(v) for v in part.values())
    fh_by_h = {f"h{h}": len([r for r in part["fixed_horizon_matured"]
                             if (r.get("sessions_used") or 0) >= h]) for h in HORIZONS}
    cohorts = sorted({r["cohort"] for r in part["fixed_horizon_matured"]
                      + part["terminal_exits"] + part["pending_open"]})
    return {"total_outcome_rows": total,
            "fixed_horizon_matured": len(part["fixed_horizon_matured"]),
            "fixed_horizon_matured_by_horizon_reached": fh_by_h,
            "terminal_exits": len(part["terminal_exits"]),
            "pending_fixed_horizon_outcomes": len(part["pending_open"]),
            "pending_horizons_open": sum(len(r.get("horizons_pending", [])) for r in part["pending_open"]),
            "pending_mtm_positions": len(part["pending_open"]),
            "missing_data_positions": len(part["missing_data"]),
            "unfilled": len(part["unfilled"]),
            "unique_decisions_total": len({r["decision_id"] for v in part.values() for r in v}),
            "unique_filled_trades": len({r["decision_id"] for k in ("fixed_horizon_matured", "terminal_exits", "pending_open", "missing_data") for r in part[k]}),
            "cohorts": cohorts,
            "realized_pkr_independent": realized,
            "mtm_pkr_independent": mtm}


def run_engine(db_env_file: str | None, ledger: list[dict], out_file: Path) -> dict:
    """Invoke the production maturation engine fresh (bun task106_mature.ts)."""
    lp = out_file.with_suffix(".ledger.json")
    lp.write_text(json.dumps(ledger))
    env = dict(os.environ)
    env.setdefault("DATABASE_URL", db_env_file or f"file:{ROOT}/db/custom.db")
    r = subprocess.run(["bun", "scripts/task106_mature.ts", str(lp), str(out_file)],
                       capture_output=True, text=True, cwd=ROOT, timeout=560, env=env)
    if r.returncode != 0:
        raise RuntimeError(f"engine failed: {(r.stderr or r.stdout)[-300:]}")
    return json.loads(out_file.read_text())


def run_point_in_time() -> dict:
    """Clone the DB clamped to <= PIT_FRONTIER, re-run the engine, partition."""
    tmpdir = tempfile.mkdtemp(prefix="task119_pit_")
    pit_db = str(Path(tmpdir) / "pit.db")
    con = sqlite3.connect(ROOT / "db/custom.db")
    dst = sqlite3.connect(pit_db)
    con.backup(dst)
    dst.close()
    con.close()
    dcon = sqlite3.connect(pit_db)
    removed = dcon.execute("DELETE FROM OhlcvBar WHERE date>?", (PIT_FRONTIER,)).rowcount
    dcon.commit()
    frontier = dcon.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
    dcon.close()
    ledger = TM.build_ledger()
    matured = run_engine(f"file:{pit_db}", ledger, Path(tmpdir) / "matured.json")
    part = partition_engine_output(matured, ledger, pit_db, frontier)
    summ = summarize(part)
    summ["point_in_time_frontier"] = frontier
    summ["bars_removed_for_pit"] = removed
    return {"summary": summ, "partition": part, "tmpdir": tmpdir}


def run_current() -> dict:
    ledger = TM.build_ledger()
    out = T119 / "_task119_matured_current.json"
    matured = run_engine(None, ledger, out)
    max_date = LB.frontier_date()
    part = partition_engine_output(matured, ledger, str(ROOT / "db/custom.db"), max_date)
    return {"summary": summarize(part), "partition": part, "frontier": max_date}


def horizon_layer_reconcile() -> dict:
    """Recompute the fixed-horizon 5/10/21 ledger INDEPENDENTLY: per-symbol
    session clocks from raw OhlcvBar rows for every decision in the frozen
    shadow ledgers (task114 engine convention: entry = first bar after the
    decision date; horizon h matures when h per-symbol sessions have closed
    at/after entry). Compares point-in-time (<= 2026-11-05) against the
    committed task114_cohort_maturity.csv and reports the current-frontier
    recount."""
    ledger = TM.build_ledger()
    con = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    bars: dict[str, list[str]] = {}
    for sym, in con.execute("SELECT DISTINCT symbol FROM OhlcvBar").fetchall():
        bars[sym] = [r[0] for r in con.execute(
            "SELECT DISTINCT date FROM OhlcvBar WHERE symbol=? ORDER BY date", (sym,)).fetchall()]
    con.close()

    def recount(max_date: str) -> dict:
        out = {"h5_matured": 0, "h10_matured": 0, "h21_matured": 0,
               "h5_pending": 0, "h10_pending": 0, "h21_pending": 0,
               "unfilled": 0, "unique_decisions": 0, "no_bar_after_decision": [],
               "per_cohort": {}}
        seen = set()
        for l in ledger:
            did, sym, ddate, cohort = l["decision_id"], l["symbol"], l["decision_date"], l["generation"]
            if did in seen:
                continue
            seen.add(did)
            out["unique_decisions"] += 1
            sbars = [d for d in bars.get(sym, []) if d <= max_date]
            after = [d for d in sbars if d > ddate]
            if not after:
                out["unfilled"] += 1
                out["no_bar_after_decision"].append(did)
                continue
            entry = after[0]
            elapsed = len([d for d in after])  # sessions closed from entry (inclusive)
            coh = out["per_cohort"].setdefault(cohort, {"decisions": 0, "entry_date": entry,
                                                        "sessions_elapsed_from_entry": elapsed})
            coh["decisions"] += 1
            for h in HORIZONS:
                if elapsed >= h:
                    out[f"h{h}_matured"] += 1
                else:
                    out[f"h{h}_pending"] += 1
        return out

    current = recount(LB.frontier_date())
    # point-in-time: committed task114 cohort CSV was generated at 2026-11-05
    committed_csv = list(csv.DictReader(open(T114 / "task114_cohort_maturity.csv")))
    pit_committed = {r["cohort_id"]: r for r in committed_csv}
    # independent PIT recount uses the same per-symbol clocks clamped to 2026-11-05
    saved_bars = bars
    bars = {s: [d for d in ds if d <= PIT_FRONTIER] for s, ds in bars.items()}
    pit = recount(PIT_FRONTIER)
    bars = saved_bars

    # comparison: matured_5_session per cohort (committed) vs independent PIT recount
    cohort_check = []
    pit_by_cohort = {c: v for c, v in pit["per_cohort"].items()}
    for cid, r in pit_by_cohort.items():
        committed = pit_committed.get(cid)
        cohort_check.append({
            "cohort": cid, "independent_entry": r["entry_date"],
            "independent_sessions_elapsed": r["sessions_elapsed_from_entry"],
            "committed_present": committed is not None,
            "committed_total_observations": committed.get("total_observations") if committed else None,
            "independent_decisions": r["decisions"]})
    return {"status": "ok", "method": "independent per-symbol session-clock recount from raw bars",
            "point_in_time_frontier": PIT_FRONTIER,
            "point_in_time": pit,
            "point_in_time_cohort_comparison": cohort_check,
            "current_frontier_recount": current}


def main() -> int:
    print("[1/4] current-frontier engine rerun + independent partition ...")
    cur = run_current()
    cur_summary = cur["summary"]
    print("     ", json.dumps(cur_summary))

    print("[2/4] point-in-time reconstruction at frontier", PIT_FRONTIER, "...")
    pit = run_point_in_time()
    pit_summary = pit["summary"]
    print("     ", json.dumps(pit_summary))

    print("[3/4] horizon-layer (task114) reconciliation ...")
    hz = horizon_layer_reconcile()

    print("[4/4] writing artifacts ...")
    # per-category CSV (no identities — decision ids are synthetic research ids)
    with open(T119 / "task119_outcome_categories.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["layer", "id", "decision_id", "cohort", "strategy", "outcome_type",
                    "entry_date", "exit_session", "sessions_used", "exit_reason",
                    "in_realized_pnl", "in_mtm", "pnl_pkr", "mtm_pkr"])
        for r in cur["partition"]["fixed_horizon_matured"]:
            w.writerow(["current", r["id"], r["decision_id"], r["cohort"], r["strategy"],
                        r["outcome_type"], r.get("entry_date"), r.get("exit_session"),
                        r.get("sessions_used"), r.get("exit_reason"), r["in_realized_pnl"],
                        r["in_mtm"], r.get("pnl_pkr"), ""])
        for r in cur["partition"]["terminal_exits"]:
            w.writerow(["current", r["id"], r["decision_id"], r["cohort"], r["strategy"],
                        r["outcome_type"], r.get("entry_date"), r.get("exit_session"),
                        r.get("sessions_used"), r.get("exit_reason"), r["in_realized_pnl"],
                        r["in_mtm"], r.get("pnl_pkr"), ""])
        for r in cur["partition"]["pending_open"] + cur["partition"]["missing_data"]:
            w.writerow(["current", r["id"], r["decision_id"], r["cohort"], r["strategy"],
                        r["outcome_type"], r.get("entry_date"), "", r.get("sessions_available"),
                        "", r["in_realized_pnl"], r["in_mtm"], "", r.get("mtm_pkr")])
        for r in pit["partition"]["fixed_horizon_matured"] + pit["partition"]["terminal_exits"]:
            w.writerow(["pit_2026-11-05", r["id"], r["decision_id"], r["cohort"], r["strategy"],
                        r["outcome_type"], r.get("entry_date"), r.get("exit_session"),
                        r.get("sessions_used"), r.get("exit_reason"), r["in_realized_pnl"],
                        r["in_mtm"], r.get("pnl_pkr"), ""])

    task118_reported = {"matured_outcomes": 114, "pending": 57, "realized_pkr": 251057.33,
                        "unrealized_mtm_pkr": 115928.22, "horizon_cohorts": 3}
    pit_match = {
        "matured_outcomes": pit_summary["fixed_horizon_matured"] + pit_summary["terminal_exits"],
        "pending": pit_summary["pending_mtm_positions"] + pit_summary["missing_data_positions"],
        "realized_pkr": pit_summary["realized_pkr_independent"],
        "unrealized_mtm_pkr": pit_summary["mtm_pkr_independent"],
        "horizon_cohorts": len(pit_summary["cohorts"]),
    }
    reconcile = {
        "report": "task119_outcome_reconciliation",
        "generated_at": LB.NOW(),
        "method": "production engine (task106_mature.ts) re-invoked fresh on frozen shadow ledgers; "
                  "partition + arithmetic recomputed independently from raw records; point-in-time DB "
                  "clone clamped to 2026-11-05 for the Task 118 population; no historical record modified",
        "task118_reported_at_frontier_2026_11_05": task118_reported,
        "task118_reproduced_point_in_time": pit_match,
        "task118_reconciliation": {
            k: {"reported": task118_reported[k], "reproduced": pit_match[k],
                "match": abs((pit_match[k] or 0) - task118_reported[k]) < 0.005
                if isinstance(task118_reported[k], float) else pit_match[k] == task118_reported[k]}
            for k in task118_reported},
        "current_frontier": cur["frontier"],
        "current_summary": cur_summary,
        "horizon_layer_task114": hz,
        "category_exclusivity_note": "pending fixed-horizon outcomes and pending MTM positions are two "
                                     "COUNTS over the same exclusive pending_open population (every open "
                                     "position is both an incomplete horizon observation and an MTM "
                                     "position); fixed-horizon maturity and terminal exit are exclusive "
                                     "outcome types",
        "csv": "task119_outcome_categories.csv",
    }
    (T119 / "task119_outcome_reconciliation.json").write_text(json.dumps(reconcile, indent=1))
    shutil.rmtree(pit["tmpdir"], ignore_errors=True)
    print(json.dumps({"pit_match": pit_match, "current": cur_summary}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
