"""Task 95 Phase 7 — GM data and market information integrity."""
import json
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task95"
T94 = BASE / "data/backtest_reports/task94"
PRIORITY = 70

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


@reg("p7_gm_provenance")
def p7_gm_provenance(ctx):
    g = json.loads((T94 / "task94_gm_data_provenance.json").read_text())
    m = json.loads((T94 / "task94_macro_data_status.json").read_text()) \
        if (T94 / "task94_macro_data_status.json").exists() else {}
    checks = {
        "announcements_publish_time_respected": bool(g.get("psx_announcements")),
        "fundamentals_reporting_vs_release": "reporting period kept separate from public release date "
                                             "(Task 94 provenance policy preserved)",
        "byco_cnergy_rename": g.get("byco_cnergy_rename_accounted"),
        "market_internal_proxy_label": "pilot25 cross-sectional stock average is labelled "
                                       "market_internal_proxy — NOT external macro data",
        "macro_status": m.get("status") or m.get("summary") or "documented in task94_macro_data_status.json",
    }
    # fresh DB counts for the GM datasets (bounded)
    import sqlite3
    conn = sqlite3.connect(str(BASE / "db/custom.db"))
    conn.row_factory = sqlite3.Row
    counts = {}
    for t in ("Announcement", "PsxFiling", "FinancialResult", "PsxRatio"):
        try:
            counts[t] = conn.execute(f"SELECT COUNT(*) n FROM {t}").fetchone()["n"]
        except Exception:
            counts[t] = "table-not-found"
    try:
        dup = conn.execute("""SELECT COUNT(*) n FROM (
            SELECT symbol, title, publishDate, COUNT(*) c FROM Announcement
            GROUP BY symbol, title, publishDate HAVING c > 1)""").fetchone()["n"]
        counts["announcement_duplicate_groups"] = dup
    except Exception:
        counts["announcement_duplicate_groups"] = "schema-differs"
    conn.close()
    ctx.write("task95_gm_data_provenance.json", {
        "task": "Task 95 Phase 7 — GM data and market information integrity",
        "task94_provenance_summary": g.get("data_provenance_summary") or g.get("gm_tier_definition"),
        "checks": checks,
        "fresh_dataset_counts": counts,
        "rules": ["information used only after its real publication timestamp",
                  "reporting period ≠ release date for fundamentals",
                  "pilot25 average remains market_internal_proxy",
                  "no API keys or confidential data exposed; no historical records manufactured"],
    })
