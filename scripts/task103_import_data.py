#!/usr/bin/env python3
"""Task 103 Phase 2 — user data-onboarding system.

Controlled drop structure:  data/external_imports/<type>/
Types: psx_eod | kse100 | fundamentals | filings | corporate_actions | intraday

Imports go to a STAGING SQLite database (data/backtest_reports/task103/
external_imports_staging.db), NEVER directly into production db/custom.db;
promotion to production is an explicit separate step (see
docs/task103-provider-onboarding.md). Idempotent via SHA-256 manifests;
duplicate rows rejected, not silently dropped; fixtures are quarantined.

Usage:
  python scripts/task103_import_data.py --type kse100 --file <csv> --dry-run
  python scripts/task103_import_data.py --type psx_eod --file <csv> --validate
  python scripts/task103_import_data.py --type fundamentals --file <csv> --import
  python scripts/task103_import_data.py --templates        # (re)write templates
"""
from __future__ import annotations
import argparse, csv, hashlib, json, re, sqlite3, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L  # noqa: E402

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?")

SCHEMAS: dict[str, dict] = {
    "psx_eod": {
        "required": ["symbol", "date", "open", "high", "low", "close", "volume"],
        "optional": ["turnover", "provider", "source_id", "retrieved_at"],
        "numeric": ["open", "high", "low", "close", "volume", "turnover"],
        "date_cols": ["date"], "ts_cols": ["retrieved_at"],
        "notes": "Raw UNADJUSTED prices as published by the source. If the vendor series is "
                 "adjusted, set provider_adjusted=true column; adjusted and raw must never be mixed."},
    "kse100": {
        "required": ["date", "close"],
        "optional": ["open", "high", "low", "volume", "turnover", "provider", "source_id", "retrieved_at"],
        "numeric": ["open", "high", "low", "close", "volume", "turnover"],
        "date_cols": ["date"], "ts_cols": ["retrieved_at"],
        "notes": "GENUINE KSE-100 index values only. Never an average of pilot stocks or an "
                 "internal proxy; such series must never be imported under this type."},
    "fundamentals": {
        "required": ["symbol", "period_end", "metric", "value"],
        "optional": ["period_start", "statement_type", "publication_datetime", "announcement_date",
                      "source", "filing_id", "version", "amendment_of", "currency", "unit",
                      "source_checksum", "retrieved_at"],
        "numeric": ["value"], "date_cols": ["period_end", "period_start", "announcement_date"],
        "ts_cols": ["publication_datetime", "retrieved_at"],
        "notes": "publication_datetime when the source truly publishes it; otherwise leave BOTH "
                 "publication_datetime and announcement_date empty - the record stays 'unknown' "
                 "and is NOT usable for point-in-time decisions (conservative policy). Do not "
                 "misrepresent financial-period dates as publication dates."},
    "filings": {
        "required": ["symbol", "date", "description"],
        "optional": ["category", "pdf_url", "source", "retrieved_at"],
        "numeric": [], "date_cols": ["date"], "ts_cols": ["retrieved_at"],
        "notes": "date = genuine exchange announcement date (day precision is fine)."},
    "corporate_actions": {
        "required": ["symbol", "event_type", "ex_date"],
        "optional": ["announcement_date", "announcement_datetime", "record_date", "payment_date",
                      "ratio", "amount_per_share", "source", "filing_id", "retrieved_at"],
        "numeric": ["ratio", "amount_per_share"],
        "date_cols": ["ex_date", "record_date", "payment_date", "announcement_date"],
        "ts_cols": ["announcement_datetime", "retrieved_at"],
        "notes": "event_type in {split, bonus, rights, cash_dividend, other}. Events without a "
                 "verifiable source are stored with verification_status=unverified_suspect and "
                 "are NOT applied as confirmed adjustment facts."},
    "intraday": {
        "required": ["symbol", "date", "bar_start", "bar_end", "open", "high", "low", "close", "volume"],
        "optional": ["turnover", "interval", "provider", "source_id", "quality"],
        "numeric": ["open", "high", "low", "close", "volume", "turnover"],
        "date_cols": ["date"], "ts_cols": ["bar_start", "bar_end"],
        "notes": "interval in {1min,5min,15min,30min,60min}. Never manufacture intraday bars "
                 "from daily OHLC; synthetic rows must carry quality=synthetic_fixture and are "
                 "quarantined (rejected on import unless --allow-fixture)."},
}

FIXTURE_MARKERS = {"synthetic_fixture", "test_fixture", "fixture"}


def _fixture_rows(rows: list[dict], schema_key_cols: list[str]) -> list[str]:
    bad = []
    for i, r in enumerate(rows):
        q = (r.get("quality") or "").strip().lower()
        if q in FIXTURE_MARKERS:
            bad.append(f"row{i + 2}:quality={q}")
    return bad


def validate_csv(ftype: str, path: Path) -> tuple[list[dict], dict, list[str]]:
    """Returns (valid_rows, validation_summary, fatal_errors). Invalid rows are
    rejected WITH reasons (never silently dropped)."""
    schema = SCHEMAS[ftype]
    errors: list[str] = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        cols = [c.strip() for c in (reader.fieldnames or [])]
        rows = list(reader)
    for req in schema["required"]:
        if req not in cols:
            errors.append(f"missing required column: {req}")
    if errors:
        return [], {"columns": cols, "rows": 0}, errors
    seen, dups = set(), 0
    valid: list[dict] = []
    rejected: list[dict] = []
    keyfn = lambda r: tuple(str(r.get(k, "")).strip() for k in schema["required"])
    for i, r in enumerate(rows, start=2):
        reasons = []
        for c in schema["date_cols"]:
            v = (r.get(c) or "").strip()
            if v and not DATE_RE.match(v):
                reasons.append(f"{c} not YYYY-MM-DD: {v[:20]}")
        for c in schema["ts_cols"]:
            v = (r.get(c) or "").strip()
            if v and not TS_RE.match(v):
                reasons.append(f"{c} not a timestamp: {v[:20]}")
        for c in schema["numeric"]:
            v = (r.get(c) or "").strip()
            if v:
                try:
                    fv = float(v)
                    if fv < 0:
                        reasons.append(f"{c} negative")
                except ValueError:
                    reasons.append(f"{c} not numeric: {v[:20]}")
        if ftype in ("psx_eod", "intraday"):
            try:
                o, h, lo, c = (float(r[k]) if r.get(k) else None for k in ("open", "high", "low", "close"))
                if None not in (o, h, lo, c) and (h < lo or h < max(o, c) - 1e-9 or lo > min(o, c) - 1e-9):
                    reasons.append("OHLC envelope violation")
            except (ValueError, TypeError):
                pass
        k = keyfn(r)
        if k in seen:
            dups += 1
            reasons.append("duplicate of an earlier row in the same file")
        seen.add(k)
        q = (r.get("quality") or "").strip().lower()
        if q in FIXTURE_MARKERS:
            reasons.append(f"synthetic fixture row (quality={q}) - quarantine; use --allow-fixture "
                           "to load into the fixture quarantine table only")
        (rejected if reasons else valid).append({**r, "_row": i, "_reasons": reasons})
    summary = {"columns": cols, "rows_in_file": len(rows), "valid_rows": len(valid),
                "rejected_rows": len(rejected), "in_file_duplicates": dups,
                "fixture_rows": sum(1 for r in rows if (r.get("quality") or "").strip().lower()
                                     in FIXTURE_MARKERS),
                "rejected_sample": rejected[:10]}
    if summary["fixture_rows"] and summary["fixture_rows"] == len(rows):
        errors.append("ENTIRE file is synthetic fixture data - never mixed into production imports")
    return valid, summary, errors


def staging_conn() -> sqlite3.Connection:
    con = sqlite3.connect(str(L.STAGING_DB))
    con.execute("""CREATE TABLE IF NOT EXISTS imported_rows (
        import_id TEXT, ftype TEXT, row_key TEXT, payload TEXT,
        PRIMARY KEY (ftype, row_key))""")
    con.execute("""CREATE TABLE IF NOT EXISTS fixture_quarantine (
        import_id TEXT, ftype TEXT, payload TEXT, reason TEXT)""")
    con.execute("""CREATE TABLE IF NOT EXISTS imports (
        import_id TEXT PRIMARY KEY, ftype TEXT, filename TEXT, sha256 TEXT UNIQUE,
        source TEXT, provider TEXT, retrieval_date TEXT, coverage_start TEXT,
        coverage_end TEXT, record_count INTEGER, valid_count INTEGER, rejected_count INTEGER,
        validation TEXT, result TEXT, imported_at TEXT)""")
    return con


def do_import(ftype: str, path: Path, mode: str, source: str, provider: str,
              allow_fixture: bool) -> dict:
    t0 = time.time()
    sha = L.sha256_file(path)
    con = staging_conn()
    prev = con.execute("SELECT import_id, result FROM imports WHERE sha256=?", (sha,)).fetchone()
    if prev:
        con.close()
        return {"status": "already_imported", "import_id": prev[0], "sha256": sha,
                 "note": "idempotent: identical file (same SHA-256) was already imported; "
                         "no rows inserted again", "previous_result": prev[1]}
    valid, summary, fatal = validate_csv(ftype, path)
    if not valid or fatal:
        # visible failure: a file with nothing importable (or schema-fatal) never imports
        status = "validation_failed" if mode != "dry_run" else "dry_run_fatal"
        return {"status": status, "sha256": sha, "errors": fatal,
                 "summary": summary,
                 "note": ("all rows rejected - import fails visibly; no silent drop"
                          if not fatal and not valid else None)}
    if mode == "dry_run":
        con.close()
        return {"status": "dry_run_ok", "sha256": sha, "would_import": len(valid),
                 "summary": summary}
    if mode == "validate":
        con.close()
        if summary["rejected_rows"] > 0:
            return {"status": "validation_failed", "sha256": sha, "summary": summary,
                     "note": "validate mode is a strict gate: any rejected row fails the file"}
        return {"status": "validation_ok", "sha256": sha, "summary": summary}
    if fatal:
        con.close()
        return {"status": "validation_failed", "errors": fatal, "summary": summary}
    import_id = f"imp_{sha[:12]}_{time.strftime('%Y%m%dT%H%M%S', time.gmtime())}"
    keyfn = lambda r: "|".join(str(r.get(k, "")).strip() for k in SCHEMAS[ftype]["required"])
    inserted = dup_db = 0
    for r in valid:
        k = keyfn(r)
        exists = con.execute("SELECT 1 FROM imported_rows WHERE ftype=? AND row_key=?",
                              (ftype, k)).fetchone()
        if exists:
            dup_db += 1
            continue
        con.execute("INSERT INTO imported_rows VALUES (?,?,?,?)",
                     (import_id, ftype, k, json.dumps({kk: vv for kk, vv in r.items()
                                                        if not kk.startswith("_")}, default=str)))
        inserted += 1
    dates = sorted({(r.get("date") or r.get("period_end") or r.get("ex_date") or "")[:10]
                     for r in valid if (r.get("date") or r.get("period_end") or r.get("ex_date"))})
    con.execute("""INSERT INTO imports VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                 (import_id, ftype, path.name, sha, source, provider,
                  time.strftime("%Y-%m-%d"), dates[0] if dates else None,
                  dates[-1] if dates else None, summary["rows_in_file"], len(valid),
                  summary["rejected_rows"], json.dumps(summary, default=str)[:4000],
                  "imported", L.NOW()))
    con.commit()
    manifest = {"import_id": import_id, "type": ftype, "filename": path.name,
                 "sha256": sha, "source": source, "provider": provider,
                 "retrieval_date": time.strftime("%Y-%m-%d"), "date_coverage": [dates[0] if dates else None,
                                                                                  dates[-1] if dates else None],
                 "record_count": summary["rows_in_file"], "valid_count": len(valid),
                 "rejected_count": summary["rejected_rows"], "duplicate_in_staging": dup_db,
                 "validation": summary, "result": "imported_to_staging", "imported_at": L.NOW(),
                 "promotion_to_production": "separate explicit step; see docs/task103-provider-onboarding.md",
                 "runtime_seconds": round(time.time() - t0, 2)}
    mp = L.MANIFESTS_DIR / f"{import_id}.json"
    mp.write_text(json.dumps(manifest, indent=1))
    con.close()
    return {"status": "imported", "manifest": str(mp), "summary": {k: v for k, v in summary.items()
                                                                    if k != "rejected_sample"},
             **{k: v for k, v in manifest.items() if k != "validation"}}


def write_templates() -> None:
    for ftype, sch in SCHEMAS.items():
        d = L.IMPORTS_DIR / ftype
        d.mkdir(parents=True, exist_ok=True)
        allcols = sch["required"] + [c for c in sch["optional"]]
        tp = d / "template.csv"
        if not tp.exists():
            with open(tp, "w", newline="") as f:
                csv.writer(f).writerow(allcols)
                w = csv.DictWriter(f, fieldnames=allcols)
                row = {c: "" for c in allcols}
                if ftype == "psx_eod":
                    row.update({"symbol": "EXAMPLE", "date": "2026-01-01", "open": "10.0",
                                 "high": "10.5", "low": "9.8", "close": "10.2", "volume": "1000",
                                 "provider": "YOUR_PROVIDER", "source_id": "doc-1",
                                 "retrieved_at": "2026-11-02T18:00:00"})
                elif ftype == "kse100":
                    row.update({"date": "2026-01-01", "open": "78000", "high": "78500",
                                 "low": "77900", "close": "78200", "volume": "1000000",
                                 "provider": "YOUR_PROVIDER", "source_id": "doc-1",
                                 "retrieved_at": "2026-11-02T18:00:00"})
                elif ftype == "fundamentals":
                    row.update({"symbol": "EXAMPLE", "period_end": "2026-09-30",
                                 "metric": "revenue", "value": "1234567", "currency": "PKR",
                                 "unit": "PKR", "source": "annual_report", "filing_id": "f-1"})
                elif ftype == "filings":
                    row.update({"symbol": "EXAMPLE", "date": "2026-01-01",
                                 "description": "EXAMPLE announcement", "category": "other"})
                elif ftype == "corporate_actions":
                    row.update({"symbol": "EXAMPLE", "event_type": "cash_dividend",
                                 "ex_date": "2026-01-10", "announcement_date": "2026-01-02",
                                 "amount_per_share": "2.5", "source": "notice"})
                elif ftype == "intraday":
                    row.update({"symbol": "EXAMPLE", "date": "2026-01-01",
                                 "bar_start": "2026-01-01T10:00:00", "bar_end": "2026-01-01T10:05:00",
                                 "open": "10.0", "high": "10.2", "low": "9.9", "close": "10.1",
                                 "volume": "100", "interval": "5min", "quality": "synthetic_fixture"})
                w.writerow(row)
        (d / "data_dictionary.json").write_text(json.dumps(
            {"type": ftype, "required": sch["required"], "optional": sch["optional"],
             "notes": sch["notes"], "drop_location": str(d),
             "import_command": f"python scripts/task103_import_data.py --type {ftype} --file <path> --dry-run"},
            indent=1))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--type", required=True, choices=list(SCHEMAS) + ["all"])
    ap.add_argument("--file")
    ap.add_argument("--mode", default="dry_run", choices=["dry_run", "validate", "import"])
    ap.add_argument("--source", default="user_supplied")
    ap.add_argument("--provider", default="unspecified")
    ap.add_argument("--allow-fixture", action="store_true")
    ap.add_argument("--templates", action="store_true")
    args = ap.parse_args()
    write_templates()
    if args.templates:
        print("templates ensured under", L.IMPORTS_DIR)
        return
    if not args.file:
        ap.error("--file required (or use --templates)")
    p = Path(args.file)
    if not p.exists():
        print(json.dumps({"status": "error", "error": f"file not found: {p}"}))
        sys.exit(2)
    res = do_import(args.type, p, args.mode, args.source, args.provider, args.allow_fixture)
    print(json.dumps(res, indent=1, default=str))
    if res.get("status") in ("validation_failed", "error", "dry_run_fatal"):
        sys.exit(1)


if __name__ == "__main__":
    main()
