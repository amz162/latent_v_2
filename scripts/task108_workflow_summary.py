#!/usr/bin/env python3
"""Task 108 Phase 4 — GitHub Actions step-summary renderer.

Reads ops/last_cycle_result.json (written by every monitor cycle) and renders a
markdown job summary with the required fields: run id/source/quote counts/new/
unchanged/rejected/latest timestamp/provider errors/data status/shadow changes.
Also emits a ::warning:: for degraded runs. Fails (exit 1) if no result file
exists — a run without a cycle result must never look like success.
"""
from __future__ import annotations
import json, os, sqlite3, sys
from pathlib import Path
ROOT = Path("/home/z/my-project")
T107 = Path(os.environ.get("TASK108_T107_DIR") or ROOT / "data/backtest_reports/task107")
OPS = T107 / "ops"
SNAP_DB = Path(os.environ.get("TASK108_SNAP_DB") or ROOT / "data/external_imports/psx_eod/task107_snapshots.db")


def main() -> int:
    res_path = OPS / "last_cycle_result.json"
    if not res_path.exists():
        print("::error::no monitor cycle result found — run produced no data")
        return 1
    r = json.loads(res_path.read_text())
    lines = ["## Intraday delayed-snapshot poll", ""]
    lines.append(f"- **Run ID:** {os.environ.get('GITHUB_RUN_ID', 'local')} "
                 f"({os.environ.get('GITHUB_RUN_NUMBER', '-')})")
    lines.append(f"- **Source:** PSX provider `psxdata-api.fastapicloud.dev` — delayed quote snapshots only "
                 f"(no candles; no source market timestamps; timestamps are ESTIMATED)")
    lines.append(f"- **Classification:** `{r.get('classification')}`")
    lines.append(f"- **Window status:** {r.get('window')} | cycle {r.get('cycle_id')} "
                 f"({r.get('started_at')} → {r.get('ended_at')}, {r.get('duration_s')}s)")
    lines.append(f"- **Quotes requested:** {len(r.get('errors', []) or [])} errored of 25 "
                 f"(structural gaps excluded from classification: {r.get('structural_symbols') or 'none'})")
    lines.append(f"- **New observations:** {r.get('new')} | **store total:** {r.get('total')}")
    err_n = len(r.get("errors") or [])
    rej_n = len(r.get("rejected") or [])
    lines.append(f"- **Provider errors:** {err_n} | **Rejected observations:** {rej_n}")
    if rej_n:
        lines.append("  - quarantined: " + "; ".join(
            f"{x.get('symbol')}: {x.get('reason')}" for x in (r.get("rejected") or [])[:5]))
    lines.append(f"- **Open paper positions tracked:** {r.get('positions')} | statuses: {r.get('status_counts')}")
    eod = r.get("eod")
    if eod:
        lines.append(f"- **EOD reconciliation:** {eod.get('state')} "
                     f"({eod.get('quote_matches_close')}/{eod.get('checked')} quotes == daily close)")
    lines.append(f"- **Shadow records changed:** {'yes — new snapshots / status transitions' if r.get('new') else 'no (no-op)'}")
    lines.append("")
    lines.append("_Delayed prices are NOT live market data. Timestamps are estimated "
                 "(retrieved_at − 15 min); the provider publishes no source timestamp._")
    md = "\n".join(lines)
    out = os.environ.get("GITHUB_STEP_SUMMARY")
    if out:
        Path(out).write_text(md + "\n")
    print(md)
    if r.get("classification") == "degraded_provider":
        print(f"::warning::degraded_provider — {err_n} provider error(s), data refresh incomplete")
    elif r.get("classification") == "failed_data_integrity":
        print("::error::failed_data_integrity — rejected observations quarantined")
    return 0


if __name__ == "__main__":
    sys.exit(main())
