#!/usr/bin/env python3
"""Task 115 — first 5-session maturity checkpoint & source-bar verification.

Verifies the twelve Part G properties against the live checkpoint (gen1's
first 5-session maturity at the 2026-11-05 close) and independently
recalculates a sample of matured outcomes directly from source bars with a
separate code path (raw SQL + inline arithmetic, not the engine's helpers).

Run: python3 scripts/task115_tests.py
"""
from __future__ import annotations
import csv, json, sqlite3, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task114_maturity as M  # noqa: E402
import task110_lib as CL  # noqa: E402

BR = ROOT / "data" / "backtest_reports"
T114 = BR / "task114"
T115 = BR / "task115"
DB = ROOT / "db" / "custom.db"
RES: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RES.append((name, bool(ok), detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail and not ok else ""))


def sessions_of(sym: str, after: str, upto: str | None = None) -> list[str]:
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    q = "SELECT DISTINCT date FROM OhlcvBar WHERE symbol=? AND date>? " + \
        ("AND date<=?" if upto else "") + " ORDER BY date ASC"
    args = (sym, after, upto) if upto else (sym, after)
    out = [r[0] for r in conn.execute(q, args)]
    conn.close()
    return out


def main() -> None:
    print(f"=== Task 115 checkpoint tests — {datetime.now(timezone.utc).isoformat()} ===")
    audit = json.loads((T114 / "task114_forward_maturity_audit.json").read_text())
    llm = json.loads((T114 / "task114_llm_maturity.json").read_text())
    ledger = json.loads((T114 / "task114_outcome_ledger.json").read_text())
    rollups = {r["cohort_id"]: r for r in audit["part_c_d_cohort_maturity"]}
    gen1 = rollups["task105-gen1"]

    print("-- 1. first 5-session maturity checkpoint --")
    mat = audit["part_c_matured_outcomes"]
    check("g1_first_checkpoint_twelve_matured",
          gen1["matured_5_session"] == 12 and gen1["pending_5_session"] == 0 and len(mat) == 12)
    check("g1b_endpoint_is_fifth_session_2026_11_05",
          all(o["horizons"]["h5"]["endpoint_session"] == "2026-11-05" for o in mat))
    check("g1c_ledger_recorded_exactly_twelve",
          len(ledger) == 12 and all(k.endswith("|h5") for k in ledger)
          and all("first_processed_at" in v and "fingerprint" in v for v in ledger.values()))
    with open(T114 / "task114_matured_outcomes.csv") as f:
        mrows = list(csv.DictReader(f))
    check("g1d_matured_csv_twelve_rows", len(mrows) == 12
          and all(r["horizon"] == "5" and r["endpoint_session"] == "2026-11-05" for r in mrows))

    print("-- 2. correct PSX session counting --")
    dates = [o["horizons"]["h5"]["source_bar_refs"][i]["date"] for o in mat[:1] for i in range(5)]
    wd = [datetime.strptime(d, "%Y-%m-%d").weekday() for d in dates]
    # Task 119 update (documented): the h5 source window is FROZEN at the
    # 2026-11-05 close (source_bar_refs), so those exact five dates and their
    # weekday property remain the invariant; sessions since entry may grow as
    # new genuine sessions close (frontier 2026-11-06 verified in
    # task119_frontier_verification.json) — the clock only ever accumulates.
    check("g2_five_actual_sessions_no_weekends",
          dates == ["2026-10-30", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]
          and all(w < 5 for w in wd)
          and len(sessions_of("LUCK", "2026-10-29")) >= 5)

    print("-- 3. entry-session treatment (frozen convention: entry = session 1) --")
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    luck_open = conn.execute(
        "SELECT open FROM OhlcvBar WHERE symbol='LUCK' AND date='2026-10-30'").fetchone()[0]
    conn.close()
    o0 = next(o for o in mat if o["decision_id"] == "t105gen1_LUCK_2026-10-29")
    check("g3_entry_session_is_session_one",
          o0["entry_session"] == "2026-10-30" and abs(o0["entry_fill"] - luck_open) < 1e-9
          and o0["horizons"]["h5"]["sessions_elapsed_from_entry"] == 5
          and len(o0["horizons"]["h5"]["source_bar_refs"]) == 5)

    print("-- 4. missing endpoint bars keep outcomes pending --")
    check("g4_short_clocks_pending",
          rollups["task106-gen2"]["matured_5_session"] == 0
          and rollups["task106-gen2"]["remaining_sessions_pending_5"] == [2]
          and rollups["task107-gen3"]["remaining_sessions_pending_5"] == [3]
          and rollups["task111-llm-multisource-gen1"]["remaining_sessions_pending_5"] == [3])
    # synthetic: 4 bars can never mature h5
    dec = [{"cohort_id": "c", "decision_id": "s4", "symbol": "AAA", "decision_date": "2026-11-01",
            "entry_fill": 100.0, "quantity": 10}]
    out, _ = M.evaluate(dec, {"AAA": M.__dict__.get("_x") or [
        {"date": d, "open": 100, "high": 100, "low": 100, "close": 100, "volume": 1}
        for d in ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]]}, {}, is_llm=False)
    check("g4b_synthetic_four_bars_pending", out[0]["horizons"]["h5"]["status"] == "pending"
          and out[0]["horizons"]["h5"]["remaining_sessions"] == 1)

    print("-- 5. terminal exits vs fixed-horizon maturity --")
    frozen = json.loads((BR / "task107" / "_matured.json").read_text())
    obs = frozen["observations"]
    term_by_id = {o["decision_id"]: any(
        s.get("status") in ("matured_terminal_exit", "matured_full_exit")
        for s in (o.get("outcomes") or {}).values()) for o in obs}
    term_gen1 = [k for k, v in term_by_id.items() if v and k.startswith("t105gen1_")]
    mat_ids = {o["decision_id"] for o in mat}
    both = [k for k in term_gen1 if k in mat_ids]
    # a decision can have BOTH a strategy terminal exit AND an independent h5
    # mark; the rollup must count them separately and never merge them.
    check("g5_terminal_and_horizon_separate",
          len(term_gen1) > 0 and len(both) > 0
          and gen1["matured_5_session"] == 12
          and gen1["terminal_exits_from_frozen_engine"] is not None
          and all(o["horizons"]["h5"].get("exit_mark_methodology", "").startswith("fixed-horizon")
                  for o in mat if o["decision_id"] in both))

    print("-- 6. idempotent reprocessing --")
    led2: dict = {}
    decs, _meta = M.general_decisions()
    bars = M.load_bars()
    M.evaluate(decs, bars, led2, is_llm=False)
    _, stats2 = M.evaluate(decs, bars, led2, is_llm=False)
    check("g6_idempotent_reprocess",
          len(led2) == 12 and stats2["duplicate_processing_attempts_identical"] == 12
          and stats2["source_bar_revisions_detected"] == 0)

    print("-- 7. duplicate source bars --")
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    tot, uniq = conn.execute(
        "SELECT COUNT(*), COUNT(DISTINCT symbol||'|'||date) FROM OhlcvBar").fetchone()
    conn.close()
    check("g7_no_duplicate_source_bars", tot == uniq, f"rows={tot} unique={uniq}")

    print("-- 8. corrected source-bar auditability --")
    up = [{"date": d, "open": 100, "high": 100, "low": 100, "close": 100, "volume": 1}
          for d in ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"]]
    d6 = [{"cohort_id": "c", "decision_id": "s8", "symbol": "AAA", "decision_date": "2026-11-01",
           "entry_fill": 100.0, "quantity": 10}]
    led8: dict = {}
    M.evaluate(d6, {"AAA": up}, led8, is_llm=False)
    up2 = [dict(b) for b in up]
    up2[4] = {**up2[4], "close": 123.0}
    _, st8 = M.evaluate(d6, {"AAA": up2}, led8, is_llm=False)
    check("g8_corrected_bar_auditable",
          st8["source_bar_revisions_detected"] >= 1
          and "source_bar_revision_detected_at" in led8["s8|h5"]
          and led8["s8|h5"].get("first_processed_at"))

    print("-- 9/10/11. cohort + mock isolation --")
    ids_by_cohort = {}
    for cid in ("task105-gen1", "task106-gen2", "task107-gen3", "task111-llm-multisource-gen1"):
        ids_by_cohort[cid] = {o["decision_id"] for o in audit["part_c_matured_outcomes"]
                              if o["cohort_id"] == cid} | \
                             {r["decision_id"] for r in (audit["part_c_d_cohort_maturity"] and [])} \
                             if False else set()
    # use the pending CSV for full denominators
    with open(T114 / "task114_pending_outcomes.csv") as f:
        prows = list(csv.DictReader(f))
    pend_ids: dict[str, set] = {}
    for r in prows:
        pend_ids.setdefault(r["cohort_id"], set()).add(r["decision_id"])
    all_ids = [frozenset(v) for v in pend_ids.values()]
    check("g9_cohort_ids_disjoint", len(set().union(*all_ids)) == sum(len(v) for v in all_ids)
          and len(pend_ids) == 4)
    llmr = rollups["task111-llm-multisource-gen1"]
    check("g10_mock_isolation",
          llm["frozen_baseline_verified"]["mock_pipeline_check_records"] == 23
          and llm["frozen_baseline_verified"]["real_records_two_passes"] == 48
          and "MOCK" not in json.dumps(llm["buy_outcomes"])
          and all("mock pipeline check" in e["reason"]
                  for e in llmr["excluded_records"] if "MOCK" in e["reason"]))
    check("g11_llm_vs_general_separate",
          llmr["matured_5_session"] == 0 and gen1["matured_5_session"] == 12
          and llmr["cohort_id"] != gen1["cohort_id"]
          and not (pend_ids["task111-llm-multisource-gen1"] & pend_ids["task105-gen1"]))

    print("-- 12. independent source-bar recalculation (separate code path) --")
    import random
    random.seed(115)
    sample = random.sample(mrows, 5)
    ok_entry = ok_pnl = True
    for r in sample:
        sym, did = r["symbol"], r["decision_id"]
        conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
        barsx = conn.execute(
            "SELECT date,open,close FROM OhlcvBar WHERE symbol=? ORDER BY date ASC", (sym,)).fetchall()
        conn.close()
        after = [(d, o, c) for d, o, c in barsx if d > did.rsplit("_", 1)[1].replace("_", "-")]
        # decision date is the id suffix; rebuild robustly from the engine row
        dd = next(o0["decision_date"] for o0 in
                  json.loads((T114 / "task114_forward_maturity_audit.json").read_text())["part_c_matured_outcomes"]
                  if o0["decision_id"] == did)
        after = [(d, o, c) for d, o, c in barsx if d > dd]
        entry = after[0][1]
        fifth_close = after[4][2] if len(after) >= 5 else None
        gross = (fifth_close - entry) * float(r["entry_fill"] and 0 or 0)  # placeholder; qty below
        qty = None
        fz = next(o for o in frozen["observations"] if o["decision_id"] == did)
        qty = (fz.get("outcomes") or {}).get("fixed_first_hit", {}).get("quantity")
        gross = (fifth_close - entry) * qty
        costs = CL.trade_costs_v2(qty, entry, [(qty, fifth_close)], gross)
        net = costs["net_pnl"]
        if abs(entry - float(r["entry_fill"])) > 1e-9:
            ok_entry = False
        if abs(net - float(r["net_return_pkr"])) > 0.02:
            ok_pnl = False
    check("r1_independent_entry_recompute", ok_entry)
    check("r2_independent_net_pnl_reconciles", ok_pnl)

    print("-- current-world artifact assertions --")
    check("w1_frontier_2026_11_05", audit["data_frontier"] == "2026-11-05")
    check("w2_new_sessions_recorded",
          audit["sessions_new_since_2026_11_03"] == ["2026-11-04", "2026-11-05"])
    check("w3_ingest_integrity",
          audit["pipeline_events"]["ingest_result"]["new_bars"] == 46
          and audit["pipeline_events"]["ingest_result"]["mismatches"] == 0)
    check("w4_gen3_second_batch_unfilled",
          rollups["task107-gen3"]["total_observations"] == 46
          and rollups["task107-gen3"]["unfilled_awaiting_entry_bar"] == 23)
    check("w5_calibration_still_gated",
          llm["calibration"]["current_matured_llm_outcomes"] == 0
          and llm["calibration"]["minimum_required"] == 100)

    p = sum(1 for _, ok, _ in RES if ok)
    f = len(RES) - p
    print(f"\ntask115 QA: {p} passed, {f} failed, 0 skipped")
    if f:
        for name, ok, detail in RES:
            if not ok:
                print(f"  FAIL: {name} {detail}")
        sys.exit(1)


if __name__ == "__main__":
    main()
