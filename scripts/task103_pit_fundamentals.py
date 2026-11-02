#!/usr/bin/env python3
"""Task 103 Phase 5 — point-in-time fundamentals completion.
Rebuilds the PIT records from the genuine AskAnalyst ingest (Task 90) with the
conservative availability rule, writes the Task 103 fundamental-coverage,
filing-timestamp-audit artifacts and the timestamp-discipline audit. The
leakage test SUITE (TS, src/lib/fundamentals/point-in-time) is executed by
task103_phases.pit and restated into task103_pit_leakage_report.json."""
from __future__ import annotations
import json, re, sys, time
import numpy as np
import pandas as pd
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L  # noqa: E402

RESULT_PAT = re.compile(r"(quarter|annual|interim|final) .*acc|acc.*(quarter|annual)|"
                         r"(un-audited|unaudited).*(result|account)|PUBLICATION OF (QUARTERLY|ANNUAL)|"
                         r"annual report|Q[1-4] ?(result|account)", re.I)

T90 = L.ROOT / "data/backtest_reports/task90/raw_external_data"


def load_filings():
    return L.load_json(T90 / "askanalyst_filings.json")


def load_income_statements():
    return L.load_json(T90 / "askanalyst_income_statements.json")


def load_ratios():
    return L.load_json(T90 / "askanalyst_ratios.json")


def main() -> None:
    t0 = time.time()
    filings = load_filings()
    stmts = load_income_statements()
    ratios = load_ratios()
    session_dates = L.session_dates_ms()

    pit_records = []
    cov_by_symbol = {}
    ts_audit = {"filings_with_date_only": 0, "filings_with_datetime": 0,
                 "statements_with_pub_ts": 0, "statements_total_rows": 0,
                 "ratios_total_rows": 0, "ratios_with_pub_ts": 0,
                 "policy": "day-precision announcement dates are genuine PSX DPS dates; the "
                            "time of day is UNKNOWN -> conservative availability 17:00 PKT same "
                            "date (usable from the NEXT session only). Statements/ratios carry "
                            "NO publication timestamps and are never treated as PIT-usable."}
    for sym, blk in filings.items():
        rows = blk.get("data", []) if isinstance(blk, dict) else (blk if isinstance(blk, list) else [])
        n_result = 0
        for r in rows:
            d = r.get("date")
            if not d:
                continue
            is_result = bool(RESULT_PAT.search(r.get("description", "") or ""))
            n_result += int(is_result)
            ts_audit["filings_with_date_only"] += 1
            pub = L.conservative_publication_ts(d)
            sess = L.next_session_after(pub, session_dates)
            pit_records.append({
                "symbol": sym, "filing_date": d, "publication_datetime": pub,
                "publication_time_known": False,
                "publication_source": "PSX_DPS_announcement (AskAnalyst ingest, Task 90)",
                "source_document_id": (r.get("pdf") or "").split("/")[-1] or None,
                "retrieval_datetime": "2026-10-31 (Task 90 ingest)",
                "filing_type": "financial_results_announcement" if is_result else "other_announcement",
                "is_amended": False, "amendment_datetime": None, "currency": "PKR", "unit": "unknown",
                "data_quality_status": L.PARTIALLY_VERIFIED,
                "next_available_session_ms": sess,
                "description_head": (r.get("description") or "")[:120]})
        def _blk(d, key):
            v = d.get(sym) if sym in d else None
            if not isinstance(v, dict):
                return []
            a = v.get(key)
            if isinstance(a, dict):
                return a.get("data", []) or []
            return a if isinstance(a, list) else []
        s_ann = _blk(stmts, "annual") or []
        s_q = _blk(stmts, "quarter") or []
        s_any = s_ann + s_q
        ts_audit["statements_total_rows"] += len(s_any)
        for li in s_any:
            if isinstance(li, dict):
                for pt in li.get("data", []) or []:
                    if isinstance(pt, dict) and pt.get("publication_datetime"):
                        ts_audit["statements_with_pub_ts"] += 1
        r_any = _blk(ratios, "annual") + _blk(ratios, "quarter")
        ts_audit["ratios_total_rows"] += len(r_any)
        for li in r_any:
            if isinstance(li, dict):
                for pt in li.get("data", []) or []:
                    if isinstance(pt, dict) and pt.get("publication_datetime"):
                        ts_audit["ratios_with_pub_ts"] += 1
        cov_by_symbol[sym] = {"filings": len(rows), "result_announcements": n_result,
                               "statements_annual": len(s_ann), "statements_quarter": len(s_q)}

    out = L.BASE / "pit_fundamentals.json"
    out.write_text(json.dumps({
        "records": pit_records,
        "availability_rule": "announcement DATE genuine (PSX DPS); time unknown -> conservative "
                              "availability 17:00 PKT same date; a filing may be used only from "
                              "next_available_session onwards; records with UNKNOWN publication "
                              "time stay unknown/unavailable (never assumed pre-close)"},
        default=L._jd))

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
    quarter_labels = sorted(p for p in stmt_periods
                             if re.search(r"\d{4}.?\s?Q[1-4]|\d{4}-?\d{2}[-/]?\d", p))[:10]
    L.write_artifact("task103_fundamental_coverage.json", {
        "report": "task103_fundamental_coverage", "generated_at": L.NOW(),
        "status": "completed_with_limitations",
        "filings": {"symbols": len(filings), "total_records": len(pit_records),
                     "genuine_publication_dates": sum(1 for r in pit_records if r["filing_date"]),
                     "financial_result_announcements": sum(1 for r in pit_records
                                                            if r["filing_type"].startswith("financial")),
                     "time_of_day_known": False,
                     "granularity": "day (conservative 17:00 PKT rule)"},
        "statements_and_ratios": {
            "symbols": len(stmts), "period_labels": sorted(stmt_periods)[:12],
            "period_granularity": "annual=year; quarter=year-label only",
            "publication_timestamps": 0,
            "verdict": "NOT point-in-time usable: accounting-period labels without publication "
                        "dates must never be treated as available at period end"},
        "by_symbol": cov_by_symbol,
        "pit_fundamental_feature_group": "DISABLED (task103_lib.FEATURE_GROUPS)",
        "usable_as_pit": "announcement-driven records only",
        "as_of_query": "src/lib/fundamentals/point-in-time.ts getFundamentalsAsOf()",
        "import_path": "scripts/task103_import_data.py --type fundamentals (publication_datetime "
                        "column honoured when the source truly publishes it)"})
    L.write_artifact("task103_filing_timestamp_report.json", {
        "report": "task103_filing_timestamp_report", "generated_at": L.NOW(),
        "status": "completed",
        **ts_audit,
        "verdict": f"filings with a genuine DATE: {ts_audit['filings_with_date_only']}; with a "
                    f"real DATETIME: {ts_audit['filings_with_datetime']}; statements rows with "
                    f"publication timestamps: {ts_audit['statements_with_pub_ts']}/"
                    f"{ts_audit['statements_total_rows']}; ratios with publication timestamps: "
                    f"{ts_audit['ratios_with_pub_ts']}/{ts_audit['ratios_total_rows']}",
        "conservative_policy": "announcement after market close must not be used in that day's "
                                "earlier decision; unknown publication time stays unavailable"})
    print(f"phase5 pit done {time.time()-t0:.0f}s: {len(pit_records)} PIT records, "
          f"result announcements={sum(1 for r in pit_records if r['filing_type'].startswith('financial'))}")


if __name__ == "__main__":
    main()
