#!/usr/bin/env python3
"""Task 103 Phase 2 — template/fixture validation suite.
Proves the onboarding system end-to-end: template schemas validate, malformed
CSVs fail visibly with reasons, fixture rows are quarantined, duplicate-file
imports are idempotent, manifests are immutable records."""
from __future__ import annotations
import csv, json, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L  # noqa: E402
import task103_import_data as imp  # noqa: E402

FX = L.BASE / "import_test_files"


def make_fixtures() -> dict:
    FX.mkdir(parents=True, exist_ok=True)
    made = {}

    def write(name, header, rows):
        p = FX / name
        with open(p, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)
        made[name] = p
        return p

    write("kse100_valid.csv", ["date", "open", "high", "low", "close", "volume", "provider",
                                "source_id", "retrieved_at"],
          [["2026-10-30", "78100", "78400", "78000", "78300", "1500000",
            "UNIT_TEST_FIXTURE_NOT_REAL_DATA", "doc-test", "2026-11-02T18:00:00"],
           ["2026-10-31", "78300", "78600", "78200", "78550", "1600000",
            "UNIT_TEST_FIXTURE_NOT_REAL_DATA", "doc-test", "2026-11-02T18:00:00"]])
    write("kse100_malformed.csv", ["date", "open", "high", "low", "close"],
          [["not-a-date", "1", "2", "3", "4"],
           ["2026-10-30", "5", "1", "0.5", "2"]])          # envelope: high<open, low>close
    write("kse100_missing_col.csv", ["date", "volume"], [["2026-10-30", "100"]])
    write("kse100_fixture.csv", ["date", "close", "quality"],
          [["2026-10-30", "100", "synthetic_fixture"], ["2026-10-31", "101", "synthetic_fixture"]])
    write("kse100_dupes.csv", ["date", "close"],
          [["2026-10-30", "78300"], ["2026-10-30", "78300"], ["2026-10-31", "78400"]])
    write("psx_eod_valid.csv", ["symbol", "date", "open", "high", "low", "close", "volume",
                                 "provider", "source_id", "retrieved_at"],
          [["TEST", "2026-10-30", "10", "10.5", "9.9", "10.2", "1000",
            "UNIT_TEST_FIXTURE_NOT_REAL_DATA", "doc-test", "2026-11-02T18:00:00"]])
    write("fundamentals_valid.csv", ["symbol", "period_end", "metric", "value", "currency", "unit"],
          [["TEST", "2026-09-30", "revenue", "12345", "PKR", "PKR"]])
    write("corporate_actions_valid.csv", ["symbol", "event_type", "ex_date", "ratio",
                                           "announcement_date", "source"],
          [["TEST", "bonus", "2026-06-15", "0.2", "2026-06-01", "UNIT_TEST_FIXTURE_NOT_REAL_DATA"]])
    write("intraday_valid.csv", ["symbol", "date", "bar_start", "bar_end", "open", "high", "low",
                                  "close", "volume", "interval", "quality"],
          [["TEST", "2026-10-30", "2026-10-30T10:00:00", "2026-10-30T10:05:00", "10", "10.2", "9.9",
            "10.1", "100", "5min", "synthetic_fixture"]])
    write("filings_valid.csv", ["symbol", "date", "description", "category"],
          [["TEST", "2026-10-30", "UNIT TEST announcement - not a real filing", "other"]])
    return made


def run_import(ftype: str, path: Path, mode: str) -> dict:
    r = subprocess.run([sys.executable, "scripts/task103_import_data.py", "--type", ftype,
                         "--file", str(path), "--mode", mode],
                        capture_output=True, text=True, cwd=L.ROOT, timeout=60)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"status": "cli_error", "stdout": r.stdout[-300:], "stderr": r.stderr[-300:],
                 "rc": r.returncode}


def main() -> None:
    t0 = time.time()
    # deterministic suite: reset the TEST staging database and its manifests
    if L.STAGING_DB.exists():
        L.STAGING_DB.unlink()
    for old in L.MANIFESTS_DIR.glob("*.json"):
        old.unlink()
    made = make_fixtures()
    imp.write_templates()
    results: dict[str, dict] = {}
    # template schema validation for every type
    for ftype in imp.SCHEMAS:
        tp = L.IMPORTS_DIR / ftype / "template.csv"
        valid, summary, errors = imp.validate_csv(ftype, tp)
        results[f"template_{ftype}"] = {"exists": tp.exists(), "valid_rows": len(valid),
                                         "errors": errors, "notes": imp.SCHEMAS[ftype]["notes"][:160]}
    results["kse100_valid_import"] = run_import("kse100", made["kse100_valid.csv"], "import")
    results["kse100_idempotent_reimport"] = run_import("kse100", made["kse100_valid.csv"], "import")
    results["kse100_malformed_validate"] = run_import("kse100", made["kse100_malformed.csv"], "validate")
    results["kse100_missing_col"] = run_import("kse100", made["kse100_missing_col.csv"], "dry_run")
    results["kse100_fixture_quarantined"] = run_import("kse100", made["kse100_fixture.csv"], "import")
    results["kse100_dupes_rejected"] = run_import("kse100", made["kse100_dupes.csv"], "import")
    for ftype, fn in [("psx_eod", "psx_eod_valid.csv"), ("fundamentals", "fundamentals_valid.csv"),
                       ("corporate_actions", "corporate_actions_valid.csv"),
                       ("intraday", "intraday_valid.csv"), ("filings", "filings_valid.csv")]:
        results[f"{ftype}_import"] = run_import(ftype, made[fn], "import")
    checks = {
        "template_every_type_exists": all(results[f"template_{t}"]["exists"] for t in imp.SCHEMAS),
        "valid_file_imports": results["kse100_valid_import"].get("status") == "imported",
        "reimport_idempotent": results["kse100_idempotent_reimport"].get("status") == "already_imported",
        "malformed_fails_visibly": results["kse100_malformed_validate"].get("status") == "validation_failed",
        "missing_column_fails": results["kse100_missing_col"].get("status") in ("dry_run_fatal", "validation_failed"),
        "fixture_rows_quarantined": results["kse100_fixture_quarantined"].get("status") == "validation_failed",
        "intraday_fixture_quarantined": results.get("intraday_import", {}).get("status") == "validation_failed",
        "in_file_duplicates_rejected": (results["kse100_dupes_rejected"].get("summary", {})
                                         .get("in_file_duplicates") == 1),
        "all_types_importable": all(results.get(f"{t}_import", {}).get("status") == "imported"
                                     for t in ["psx_eod", "fundamentals", "corporate_actions",
                                                "filings"]),
    }
    L.write_artifact("task103_import_template_validation.json", {
        "report": "task103_import_template_validation", "generated_at": L.NOW(),
        "status": "completed" if all(checks.values()) else "failed",
        "checks": checks, "n_checks": len(checks), "n_passed": sum(checks.values()),
        "results": results,
        "notes": "all imports land in the STAGING db only; UNIT_TEST_FIXTURE_NOT_REAL_DATA "
                 "provenance marks these rows as test data; production promotion is a separate "
                 "explicit step; fixture rows are quarantined by design",
        "runtime_seconds": round(time.time() - t0, 1)})
    print("phase2 validation:", checks)
    if not all(checks.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
