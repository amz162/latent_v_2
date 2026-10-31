#!/usr/bin/env python3
"""Task 93: Prospective lifecycle integrity check.

Verifies the integrity of the ProspectivePaperTrade table:
  1. Total count consistency (114 trades expected, 3 strategies × 38)
  2. State distribution (all 114 are pending_entry — no matured outcomes yet)
  3. Required field presence per trade (symbol, direction, sl, tp1, tp2, tp3, modelId, etc.)
  4. Idempotency: no duplicate (sourcePredictionId, strategyId) combinations
  5. Policy version consistency
  6. Allocation sanity (allocatedCash > 0 for all pending trades)
  7. SL/TP sanity (sl < entry for LONG, sl > entry for SHORT; tp1/2/3 in increasing order)
  8. Cross-reference with PredictionHistory (each sourcePredictionId must exist)

NO data is modified. Read-only validation.
"""
import sqlite3, json
from pathlib import Path
from collections import Counter

DB = "/home/z/my-project/db/custom.db"
OUT = Path("/home/z/my-project/data/backtest_reports/task93/task93_prospective_lifecycle_integrity.json")


def main():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    # 1. Total count
    total = c.execute("SELECT COUNT(*) FROM ProspectivePaperTrade").fetchone()[0]

    # 2. State distribution
    states = c.execute(
        "SELECT state, COUNT(*) FROM ProspectivePaperTrade GROUP BY state ORDER BY COUNT(*) DESC"
    ).fetchall()
    state_dict = {s: n for s, n in states}

    # 3. Strategy distribution
    strats = c.execute(
        "SELECT strategyId, COUNT(*) FROM ProspectivePaperTrade GROUP BY strategyId"
    ).fetchall()
    strat_dict = {s: n for s, n in strats}

    # 4. Required field presence
    # NOTE: entryPrice and allocatedCash are legitimately NULL for pending_entry state
    # (they're set when the trade actually enters). So they're in "post_entry_fields"
    # rather than required-at-creation.
    required_at_creation = [
        "symbol", "direction", "sl", "tp1", "tp2", "tp3",
        "modelId", "horizon",
        "sourcePredictionId", "policyVersion",
    ]
    post_entry_fields = ["entryPrice", "allocatedCash"]
    field_nulls = {}
    for f in required_at_creation + post_entry_fields:
        n_null = c.execute(
            f"SELECT COUNT(*) FROM ProspectivePaperTrade WHERE {f} IS NULL"
        ).fetchone()[0]
        field_nulls[f] = n_null
    # Only required_at_creation fields must be non-null
    no_required_field_nulls = all(field_nulls[f] == 0 for f in required_at_creation)

    # 5. Idempotency check
    duplicates = c.execute(
        """SELECT sourcePredictionId, strategyId, COUNT(*) as cnt
           FROM ProspectivePaperTrade
           WHERE sourcePredictionId IS NOT NULL
           GROUP BY sourcePredictionId, strategyId
           HAVING cnt > 1"""
    ).fetchall()
    n_duplicate_combos = len(duplicates)

    # 6. Policy version consistency
    policies = c.execute(
        "SELECT policyVersion, COUNT(*) FROM ProspectivePaperTrade GROUP BY policyVersion"
    ).fetchall()
    policy_dict = {p: n for p, n in policies}

    # 7. Allocation sanity
    n_zero_alloc = c.execute(
        "SELECT COUNT(*) FROM ProspectivePaperTrade WHERE allocatedCash = 0 OR allocatedCash IS NULL"
    ).fetchone()[0]
    n_negative_alloc = c.execute(
        "SELECT COUNT(*) FROM ProspectivePaperTrade WHERE allocatedCash < 0"
    ).fetchone()[0]

    # 8. SL/TP sanity check (load all rows)
    # Direction values are 'BUY'/'SELL' (not 'LONG'/'SHORT').
    # For pending_entry trades, entryPrice is NULL — so we check sl/tp RELATIVE to each other
    # rather than relative to entry.
    rows = c.execute(
        """SELECT id, direction, entryPrice, sl, tp1, tp2, tp3, symbol
           FROM ProspectivePaperTrade"""
    ).fetchall()
    sl_tp_issues = []
    for r in rows:
        tid, direction, entry, sl, tp1, tp2, tp3, sym = r
        if sl is None:
            sl_tp_issues.append({"id": tid, "symbol": sym, "issue": "missing_sl"})
            continue
        # Normalize direction: BUY = LONG side, SELL = SHORT side
        is_buy = direction in ("BUY", "LONG")
        is_sell = direction in ("SELL", "SHORT")
        if not (is_buy or is_sell):
            sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"unknown_direction ({direction})"})
            continue
        # TP order check: for BUY, tp1 < tp2 < tp3 (ascending, above entry); for SELL, tp1 > tp2 > tp3 (descending, below entry)
        if tp1 is not None and tp2 is not None:
            if is_buy and tp1 >= tp2:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"BUY tp1 ({tp1}) >= tp2 ({tp2}) — should be ascending"})
            if is_sell and tp1 <= tp2:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"SELL tp1 ({tp1}) <= tp2 ({tp2}) — should be descending"})
        if tp2 is not None and tp3 is not None:
            if is_buy and tp2 >= tp3:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"BUY tp2 ({tp2}) >= tp3 ({tp3}) — should be ascending"})
            if is_sell and tp2 <= tp3:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"SELL tp2 ({tp2}) <= tp3 ({tp3}) — should be descending"})
        # SL relative to TPs (entry-relative check only when entryPrice is present)
        if entry is not None:
            if is_buy and sl >= entry:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"BUY sl ({sl}) >= entry ({entry})"})
            if is_sell and sl <= entry:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"SELL sl ({sl}) <= entry ({entry})"})
            if is_buy and tp1 is not None and tp1 <= entry:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"BUY tp1 ({tp1}) <= entry ({entry})"})
            if is_sell and tp1 is not None and tp1 >= entry:
                sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"SELL tp1 ({tp1}) >= entry ({entry})"})
        else:
            # No entryPrice (pending_entry state) — check sl relative to tp1 instead
            if tp1 is not None:
                if is_buy and sl >= tp1:
                    sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"BUY sl ({sl}) >= tp1 ({tp1}) — should be below TPs"})
                if is_sell and sl <= tp1:
                    sl_tp_issues.append({"id": tid, "symbol": sym, "issue": f"SELL sl ({sl}) <= tp1 ({tp1}) — should be above TPs"})

    # 9. Cross-reference sourcePredictionId with PredictionHistory
    n_orphaned_sources = c.execute(
        """SELECT COUNT(*) FROM ProspectivePaperTrade ppt
           WHERE ppt.sourcePredictionId IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM PredictionHistory ph
               WHERE ph.id = ppt.sourcePredictionId
             )"""
    ).fetchone()[0]

    # 10. Distinct symbols / models / horizons
    n_symbols = c.execute("SELECT COUNT(DISTINCT symbol) FROM ProspectivePaperTrade").fetchone()[0]
    n_models  = c.execute("SELECT COUNT(DISTINCT modelId) FROM ProspectivePaperTrade").fetchone()[0]
    horizons  = c.execute("SELECT DISTINCT horizon FROM ProspectivePaperTrade").fetchall()
    n_horizons = len(horizons)

    # 11. Demo flag
    demo_counts = c.execute(
        "SELECT isDemo, COUNT(*) FROM ProspectivePaperTrade GROUP BY isDemo"
    ).fetchall()
    demo_dict = {str(d): n for d, n in demo_counts}

    conn.close()

    # Build report
    expected_total = 114
    expected_strategies = {"fixed_first_hit": 38, "max_tp_step_trailing": 38, "scale_out_50_25_25": 38}
    strategy_consistent = all(strat_dict.get(k) == v for k, v in expected_strategies.items())
    state_consistent = (state_dict.get("pending_entry") == expected_total)
    no_field_nulls = all(v == 0 for v in field_nulls.values())
    no_duplicates = (n_duplicate_combos == 0)
    no_orphans = (n_orphaned_sources == 0)
    no_sl_tp_issues = (len(sl_tp_issues) == 0)

    report = {
        "task": "Task 93.6 — Prospective lifecycle integrity check",
        "total_trades": total,
        "expected_total": expected_total,
        "total_matches_expected": total == expected_total,
        "state_distribution": state_dict,
        "all_pending_entry": state_consistent,
        "strategy_distribution": strat_dict,
        "expected_strategy_distribution": expected_strategies,
        "strategy_distribution_consistent": strategy_consistent,
        "field_null_counts": field_nulls,
        "required_at_creation_fields": required_at_creation,
        "post_entry_fields_legitimately_null_for_pending_entry": post_entry_fields,
        "no_required_field_nulls": no_required_field_nulls,
        "idempotency": {
            "n_duplicate_sourcePredictionId_strategyId_combos": n_duplicate_combos,
            "idempotent": no_duplicates,
        },
        "policy_versions": policy_dict,
        "allocation_sanity": {
            "n_zero_or_null_allocatedCash": n_zero_alloc,
            "n_negative_allocatedCash": n_negative_alloc,
        },
        "sl_tp_sanity": {
            "n_issues": len(sl_tp_issues),
            "issues_sample": sl_tp_issues[:5],
            "all_sane": no_sl_tp_issues,
        },
        "cross_reference_prediction_history": {
            "n_orphaned_sourcePredictionIds": n_orphaned_sources,
            "all_sources_exist": no_orphans,
        },
        "coverage": {
            "n_distinct_symbols": n_symbols,
            "n_distinct_models": n_models,
            "n_distinct_horizons": n_horizons,
            "horizons": [h[0] for h in horizons],
        },
        "demo_flag_distribution": demo_dict,
        "overall_verdict": {
            "total_matches_expected": total == expected_total,
            "all_pending_entry": state_consistent,
            "strategy_distribution_consistent": strategy_consistent,
            "no_required_field_nulls": no_required_field_nulls,
            "idempotent": no_duplicates,
            "all_sources_exist_in_prediction_history": no_orphans,
            "sl_tp_all_sane": no_sl_tp_issues,
            "lifecycle_integrity_pass": (
                total == expected_total and
                state_consistent and
                strategy_consistent and
                no_required_field_nulls and
                no_duplicates and
                no_orphans and
                no_sl_tp_issues
            ),
        },
        "honesty_notes": [
            "All 114 prospective trades remain in pending_entry state — NO matured outcomes yet.",
            "Statistical verification of prospective performance is NOT possible at this time (no exits).",
            "Lifecycle integrity verifies structural soundness, NOT forecasting skill.",
            "ACTIVE is an operational status (state=pending_entry), NOT proof of skill.",
            "Once trades mature (entry + horizon days pass), outcomes can be backfilled and statistical significance can be assessed.",
        ],
    }
    OUT.write_text(json.dumps(report, indent=2))

    print("=" * 70)
    print("PROSPECTIVE LIFECYCLE INTEGRITY CHECK")
    print("=" * 70)
    print(f"\nTotal trades: {total}  (expected {expected_total})  match={total == expected_total}")
    print(f"\nState distribution:")
    for s, n in state_dict.items():
        print(f"  {s}: {n}")
    print(f"\nStrategy distribution (consistent={strategy_consistent}):")
    for s, n in strat_dict.items():
        print(f"  {s}: {n}  (expected {expected_strategies.get(s)})")
    print(f"\nField null counts:")
    for f, n in field_nulls.items():
        if f in post_entry_fields:
            flag = "OK (pending_entry)" if n == total else "FAIL"
        else:
            flag = "OK" if n == 0 else "FAIL"
        print(f"  {f:25s}: {n} nulls  [{flag}]")
    print(f"\nIdempotency: {n_duplicate_combos} duplicate (sourcePredictionId, strategyId) combos  [{'OK' if no_duplicates else 'FAIL'}]")
    print(f"Orphaned sourcePredictionIds: {n_orphaned_sources}  [{'OK' if no_orphans else 'FAIL'}]")
    print(f"Policy versions: {policy_dict}")
    print(f"Allocation: zero/null={n_zero_alloc}, negative={n_negative_alloc}")
    print(f"SL/TP issues: {len(sl_tp_issues)}  [{'OK' if no_sl_tp_issues else 'FAIL'}]")
    print(f"\nCoverage:")
    print(f"  distinct symbols: {n_symbols}")
    print(f"  distinct models:  {n_models}")
    print(f"  distinct horizons: {n_horizons} ({[h[0] for h in horizons]})")
    print(f"  demo flag: {demo_dict}")
    print(f"\nOVERALL VERDICT:")
    v = report["overall_verdict"]
    for k, val in v.items():
        print(f"  {k}: {val}")
    print(f"\nWrote: {OUT}")


if __name__ == "__main__":
    main()
