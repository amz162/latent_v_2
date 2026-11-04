#!/usr/bin/env python3
"""Task 113 (Part B) — backfill the explicit `recordType` field onto the 71
existing LLM signal-history records (data/backtest_reports/task112/llm_signal_history/).

This is a NON-DESTRUCTIVE field addition: every original field and value is
preserved exactly; we only add `recordType` ("REAL_LLM_DECISION" or
"MOCK_PIPELINE_CHECK") derived from the existing `mockRecord`/`provenance`
fields. No record is deleted, no value is rewritten, no signalId changes.
Records that already carry a recordType are left untouched (idempotent).

The recordType is the single source of truth for metric isolation: every
performance / forward-outcome / win-rate / calibration / promotion path uses
REAL_LLM_DECISION records only; MOCK_PIPELINE_CHECK records are retained for
provenance/audit and shown in the UI only via the includeMock opt-in filter.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HIST = ROOT / "data" / "backtest_reports" / "task112" / "llm_signal_history"


def record_type_of(rec: dict) -> str:
    explicit = rec.get("recordType")
    if explicit in ("REAL_LLM_DECISION", "MOCK_PIPELINE_CHECK"):
        return explicit
    is_mock = bool(rec.get("mockRecord")) or rec.get("provenance") == "mock_pipeline_check" \
        or rec.get("provider") == "mock" or bool(rec.get("__mock"))
    return "MOCK_PIPELINE_CHECK" if is_mock else "REAL_LLM_DECISION"


def main() -> None:
    if not HIST.exists():
        print(f"history dir not found: {HIST}")
        return
    files = sorted(HIST.glob("*.json"))
    updated, already, skipped = 0, 0, 0
    by_type = {"REAL_LLM_DECISION": 0, "MOCK_PIPELINE_CHECK": 0}
    for fp in files:
        try:
            rec = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            skipped += 1
            continue
        if not isinstance(rec, dict):
            skipped += 1
            continue
        rt = record_type_of(rec)
        by_type[rt] = by_type.get(rt, 0) + 1
        if rec.get("recordType") == rt:
            already += 1
            continue
        # non-destructive: add the field, preserve everything else, keep key order
        rec["recordType"] = rt
        fp.write_text(json.dumps(rec, indent=1, ensure_ascii=False), encoding="utf-8")
        updated += 1
    # refresh the index by_provenance-style summary with recordType counts
    idx_path = ROOT / "data" / "backtest_reports" / "task112" / "history_index.json"
    if idx_path.exists():
        idx = json.loads(idx_path.read_text(encoding="utf-8"))
        idx["by_record_type"] = by_type
        idx["task113_record_type_backfilled"] = True
        idx_path.write_text(json.dumps(idx, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"records: {len(files)} total · updated: {updated} · already_had_recordType: {already} · skipped: {skipped}")
    print(f"by_record_type: {by_type}")


if __name__ == "__main__":
    main()
