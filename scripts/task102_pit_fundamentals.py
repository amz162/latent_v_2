#!/usr/bin/env python3
"""Task 102 — point-in-time fundamentals engine (spec Phase 3).
Audits AskAnalyst data for genuine publication timestamps; builds PIT records
with the conservative availability rule (announcement DATE known -> available
17:00 PKT same date -> next session); writes fundamental coverage report."""
from __future__ import annotations
import json, re, sys, time
import numpy as np
import pandas as pd
sys.path.insert(0, "/home/z/my-project/scripts")
import task102_lib as L  # noqa: E402
import walk_forward_backtesting as wf  # noqa: E402

RESULT_PAT = re.compile(r"(quarter|annual|interim|final) .*acc|acc.*(quarter|annual)|"
                         r"(un-audited|unaudited).*(result|account)|PUBLICATION OF (QUARTERLY|ANNUAL)|"
                         r"annual report|Q[1-4] ?(result|account)", re.I)

def main() -> None:
    t0 = time.time()
    filings = L.load_filings()
    stmts = L.load_income_statements()
    ratios = L.load_ratios()
    con = L.db_conn()
    session_dates = np.sort(pd.to_datetime(
        [r[0] for r in con.execute("SELECT DISTINCT date FROM OhlcvBar")])
        .values.astype("datetime64[ms]").astype(np.int64))
    con.close()

    pit_records = []
    cov_by_symbol = {}
    for sym, blk in filings.items():
        rows = blk.get("data", []) if isinstance(blk, dict) else (blk if isinstance(blk, list) else [])
        n_result = 0
        for r in rows:
            d = r.get("date")
            if not d:
                continue
            is_result = bool(RESULT_PAT.search(r.get("description", "") or ""))
            n_result += int(is_result)
            pub = L.conservative_publication_ts(d)
            sess = L.next_session_after(pub, session_dates)
            pit_records.append({
                "symbol": sym,
                "filing_date": d,
                "publication_datetime": pub,
                "publication_source": "PSX_DPS_announcement (AskAnalyst ingest, Task 90)",
                "source_document_id": (r.get("pdf") or "").split("/")[-1] or None,
                "retrieval_datetime": "2026-10-31 (Task 90 ingest)",
                "filing_type": "financial_results_announcement" if is_result else "other_announcement",
                "is_amended": False,
                "amendment_datetime": None,
                "currency": "PKR", "unit": "unknown",
                "data_quality_status": L.PARTIALLY_VERIFIED,
                "next_available_session_ms": sess,
                "description_head": (r.get("description") or "")[:120],
            })
        def _blk(d, key):
            v = d.get(sym) if sym in d else None
            if not isinstance(v, dict):
                return []
            a = v.get(key)
            if isinstance(a, dict):
                return a.get("data", []) or []
            return a if isinstance(a, list) else []
        cov_by_symbol[sym] = {"filings": len(rows), "result_announcements": n_result,
                               "statements_annual": len(_blk(stmts, "annual")),
                               "statements_quarter": len(_blk(stmts, "quarter"))}
    with open(L.BASE / "trade_outcome_labels" / "pit_fundamentals.json", "w") as f:
        json.dump({"records": pit_records,
                    "availability_rule": f"announcement DATE genuine (PSX DPS); time unknown -> "
                                          f"conservative availability {L.PIT_CONSERVATIVE_HOUR_PK}:00 PKT "
                                          f"same date; features may use a filing only from "
                                          f"next_available_session onwards"}, f, default=L._jd)

    # statement/ratio timestamp quality: year/quarter labels only
    stmt_periods = set()
    for sym in stmts:
        v = stmts[sym]
        if not isinstance(v, dict):
            continue
        for k in ("annual", "quarter"):
            a = v.get(k)
            lis = a.get("data", []) if isinstance(a, dict) else (a if isinstance(a, list) else [])
            for li in lis:
                if isinstance(li, dict):
                    for pt in li.get("data", []) or []:
                        stmt_periods.add(str(pt.get("year")))
    quarter_labels = sorted(p for p in stmt_periods if re.search(r"\d{4}.?\s?Q[1-4]|\d{4}-?\d{2}[-/]?\d", p))[:10]
    coverage = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime()),
        "filings": {"symbols": len(filings),
                     "total_records": len(pit_records),
                     "genuine_publication_dates": sum(1 for r in pit_records if r["filing_date"]),
                     "financial_result_announcements": sum(1 for r in pit_records
                                                            if r["filing_type"].startswith("financial")),
                     "time_of_day_known": False,
                     "granularity": "day (conservative 17:00 PKT availability rule applied)"},
        "statements_and_ratios": {
            "symbols": len(stmts),
            "period_labels": sorted(stmt_periods)[:12],
            "period_granularity": "annual=year; quarter=year-label only",
            "publication_timestamps": 0,
            "verdict": "NOT point-in-time usable: accounting-period labels without publication "
                        "dates; per spec rule 1 they must NOT be treated as available at period end"},
        "quarter_labels_seen": quarter_labels,
        "by_symbol": cov_by_symbol,
        "pit_fundamental_feature_group": "DISABLED (see task102_lib.FEATURE_GROUPS)",
        "usable_as_pit": "announcement-driven records only",
        "as_of_query": "src/lib/fundamentals/point-in-time.ts getFundamentalsAsOf()",
    }
    L.write_artifact("task102_fundamental_coverage.json", coverage)
    print(f"pit fundamentals done {time.time()-t0:.0f}s: {len(pit_records)} PIT records, "
          f"result announcements={coverage['filings']['financial_result_announcements']}")

if __name__ == "__main__":
    main()
