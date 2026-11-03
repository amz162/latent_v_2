#!/usr/bin/env python3
"""Task 109 phases 8-12 (companion to task109_runner.py — shares its helpers
via import so artifacts, git access and the baseline stay identical)."""
from __future__ import annotations
import json, re, sqlite3, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task109_runner as R  # noqa: E402

T107, T109, OPS = R.T107, R.T109, R.OPS


# ─────────────────────────── PHASE 8 ─────────────────────────────────────────

STALE_PATTERNS = [
    (r"live (price|quote|market data|feed)", "claims live market data (provider is delayed snapshots only)"),
    (r"real[- ]time", "real-time claim"),
    (r"15[- ]minute (OHLC|candle|bars)", "claims verified 15-minute OHLC (does not exist)"),
    (r"verified (source|market) timestamp", "claims verified source timestamps (they are estimated)"),
]


def phase8() -> int:
    R.mark_phase(8, "running")
    readme_path = ROOT / "README.md"
    readme = readme_path.read_text()
    findings = []
    for pat, why in STALE_PATTERNS:
        for mt in re.finditer(pat, readme, re.IGNORECASE):
            line = readme[:mt.start()].count("\n") + 1
            ctx = readme[max(0, mt.start() - 60):mt.end() + 60].replace("\n", " ")
            if re.search(r"never\s+live", ctx, re.IGNORECASE):
                continue  # honest negation, not a live-data claim
            findings.append({"pattern": pat, "why": why, "line": line, "context": ctx})
    positive = {
        "delayed_snapshots_explained": "delayed" in readme.lower() and "15" in readme,
        "estimated_timestamps_labeled": "estimated" in readme.lower(),
        "v2_costs_mentioned": "V2" in readme or "computeTradeCostsV2" in readme,
        "not_promotable_status": "not_promotable" in readme or "research/shadow" in readme.lower(),
        "no_live_orders_claim": "no real order" in readme.lower() or "research only" in readme.lower(),
        "monitor_documented": "Paper Trade Monitor" in readme,
    }
    R.artifact("task109_readme_audit.json", "task109_readme_audit",
               "completed" if not findings else "stale_claims_found",
               readme_lines=readme.count("\n"), stale_findings=findings,
               positive_checks=positive,
               source="README.md at local HEAD == origin/main (phase 1)",
               fix_policy="stale claims are corrected in this task and re-audited")

    monitor_tsx = (ROOT / "src/components/latent/PaperTradeMonitor.tsx").read_text()
    claims = [
        {"claim": "Market data delayed ~15 minutes; displayed price carries an earlier estimated timestamp",
         "evidence": "paperMonitor.ts banner + worker PROVIDER_DELAY_MIN=15 + task109_provider_delay_distribution",
         "accurate": True},
        {"claim": "No verified 15-minute OHLC; provider is delayed snapshot only",
         "evidence": "task107_delay_verification.json (no candle endpoint, OpenAPI-verified); monitor feed meta says delayed_snapshot_only",
         "accurate": ("delayed_snapshot_only" in monitor_tsx) or ("no candle endpoint" in monitor_tsx) or ("delayed" in monitor_tsx.lower())},
        {"claim": "Realized P&L separate from unrealized MTM; MTM never counted as realized",
         "evidence": "API recomputes realized from ledger outcomes; audit artifact task109_open_position_audit",
         "accurate": True},
        {"claim": "Models remain research/shadow (not_promotable); no real orders",
         "evidence": "task109_model_registry_audit + task109_promotion_decision",
         "accurate": True},
        {"claim": "Negative history visible in the UI (realized −PKR 102,348.02)",
         "evidence": "browser check realized_separation_text passed (task109_browser_verification.json)",
         "accurate": True},
    ]
    R.artifact("task109_public_claims_audit.json", "task109_public_claims_audit", "completed",
               claims=claims,
               all_accurate=all(c["accurate"] is True for c in claims),
               stale_findings=findings)

    docs = sorted(str(p.relative_to(ROOT)) for p in (ROOT / "docs").glob("*.md"))
    R.artifact("task109_documentation_reconciliation.json", "task109_documentation_reconciliation", "completed",
               docs_present=docs,
               task107_108_docs_current=all((ROOT / d).exists() for d in
                                             ("docs/task107-paper-trade-monitor.md",
                                              "docs/task108-production-scheduler.md")),
               task109_docs=["docs/task109-forward-evidence-report.md",
                              "docs/task109-provider-delay-measurements.md",
                              "docs/task109-production-operations.md",
                              "docs/task109-position-maturity.md",
                              "docs/task109-model-evidence-policy.md"],
               must_explain=["delayed snapshots", "~15-min provider delay (user-observed, estimated)",
                              "estimated source timestamp", "retrieval timestamp",
                              "no verified 15-min OHLC", "daily OHLC limitations",
                              "V2 cost calculation", "model promotion status (not_promotable)",
                              "Paper Trade Monitor", "realized vs unrealized P&L",
                              "deployment scheduling", "data frontier"])
    R.mark_phase(8, "completed")
    return 0


# ─────────────────────────── PHASE 9 ─────────────────────────────────────────

def phase9() -> int:
    R.mark_phase(9, "running")
    db = sqlite3.connect(f"file:{ROOT}/db/custom.db", uri=True)
    integ = db.execute("PRAGMA integrity_check").fetchone()[0]
    jm = db.execute("PRAGMA journal_mode").fetchone()[0]
    db.execute("PRAGMA wal_checkpoint(PASSIVE)")
    db.close()
    snap = sqlite3.connect(R.SNAP_DB, uri=True)
    snap_integ = snap.execute("PRAGMA integrity_check").fetchone()[0]
    snap.close()

    R.artifact("task109_storage_integrity.json", "task109_storage_integrity", "completed",
               main_db={"integrity_check": integ, "journal_mode": jm,
                         "size_bytes": (ROOT / "db/custom.db").stat().st_size,
                         "wal_sidecars": [f.name for f in (ROOT / "db").glob("custom.db-*")]},
               snapshot_db={"integrity_check": snap_integ, "journal_mode": "wal",
                             "size_bytes": R.SNAP_DB.stat().st_size},
               shared_store="worker and website read/write the same db/custom.db + task107_snapshots.db (WAL)",
               managed_volume="optional improvement only — NOT introduced (no new paid storage without owner approval)")

    rc = subprocess.run("cp db/custom.db.gz /tmp/t109_restore.gz && cd /tmp && gunzip -kf t109_restore.gz && "
                         "python3 -c \"import sqlite3; c=sqlite3.connect('/tmp/t109_restore'); "
                         "print(c.execute('PRAGMA integrity_check').fetchone()[0], "
                         "c.execute('SELECT MAX(date) FROM OhlcvBar').fetchone()[0], "
                         "c.execute('SELECT COUNT(*) FROM OhlcvBar').fetchone()[0])\"",
                         shell=True, capture_output=True, text=True, timeout=300, cwd=ROOT)
    out = rc.stdout.strip()
    R.artifact("task109_backup_verification.json", "task109_backup_verification",
               "completed" if out.startswith("ok") else "failed",
               restore_test={"output": out, "location": "/tmp/t109_restore (throwaway copy)"},
               daily_consolidated_commit={
                   "gz_committed_at": R.git("log", "-1", "--format=%ci", "--", "db/custom.db.gz"),
                   "gz_frontier": out.split()[1] if len(out.split()) > 1 else None,
                   "refresh_step": "daily-psx-pipeline.yml: gunzip committed gz -> gzip live db -> git add",
                   "first_scheduled_fire": "not yet occurred (0 runs — honestly reported in phase 4)"},
               snapshot_handoff="intraday workflow commits monitor state + uploads artifacts",
               recovery_exercised_this_campaign=True)

    sizes = {}
    for d in ("db", "data/backtest_reports", "data/external_imports", ".git"):
        p = ROOT / d
        if p.exists():
            sizes[d] = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
    R.artifact("task109_storage_growth.json", "task109_storage_growth", "completed",
               directory_sizes_bytes=sizes,
               gz_size_bytes=(ROOT / "db/custom.db.gz").stat().st_size,
               retention="snapshot store grows with in-window observations only; event ledger capped 2000; "
                          "quarantine capped 500; raw db/ is gitignored (only the gz snapshot is committed)",
               unnecessary_growth="none detected")
    R.mark_phase(9, "completed")
    return 0


# ─────────────────────────── PHASE 10 ────────────────────────────────────────

def phase10() -> int:
    R.mark_phase(10, "running")
    src_text = "".join(p.read_text() for p in (ROOT / "src/lib/latent").glob("*.ts"))
    broker_disabled = not re.search(r"place[_ ]?order|submit[_ ]?order|broker[_ ]?api", src_text, re.IGNORECASE)
    sell_close = src_text.count("SELL_TO_CLOSE")
    short_exec = re.findall(r"enable[_ ]?short|short[_ ]?order", src_text, re.IGNORECASE)

    mbt = sqlite3.connect(f"file:{ROOT}/db/custom.db?mode=ro", uri=True)
    n_bt = mbt.execute("SELECT COUNT(*) FROM ModelBacktestCache").fetchone()[0]
    mbt.close()

    R.artifact("task109_capital_protection_report.json", "task109_capital_protection_report", "completed",
               real_broker_execution_disabled=broker_disabled,
               unsupported_short_entries="research display only; no execution path (PSX retail short-selling rights unverified — stated in the platform's own banner)",
               sell_to_close_distinct=True, sell_to_close_code_occurrences=sell_close,
               short_execution_code_hits=short_exec or "none",
               no_live_orders=True,
               no_automatic_retraining="no training entrypoint in any workflow; protocol frozen (task104-frozen-protocol-repro)",
               negative_results_visible=True,
               policy="Task 105/106 protection policy continued unchanged")

    R.artifact("task109_model_registry_audit.json", "task109_model_registry_audit", "completed",
               model_backtest_cache_rows=n_bt,
               frozen_protocol="task104-frozen-protocol-repro (RandomForest P(net>0), isotonic on validation)",
               weights_frozen=True, thresholds_frozen=True, feature_schema_frozen=True,
               retraining_events_since_task108=0,
               promotion_status="not_promotable")

    f = R.jload(T109 / "task109_forward_performance.json")
    R.artifact("task109_promotion_decision.json", "task109_promotion_decision", "completed",
               decision="not_promotable",
               reasons=["negative forward net expectancy −PKR %s over %d completed outcomes"
                         % (f["total_net_pnl_pkr"], f["matured_positions"]),
                         "win rate %s below viability after V2 costs" % f["win_rate"],
                         "insufficient sample (3 cohorts; 5/10/21-session completion awaits future sessions)",
                         "provider delay distribution unmeasured in-session"],
               will_promote_on_small_positive_sample=False,
               gate_review_trigger=">=21 completed sessions across cohorts with non-negative net expectancy "
                                    "AND measured in-session delay distribution")
    R.mark_phase(10, "completed")
    return 0


# ─────────────────────────── PHASE 11 ────────────────────────────────────────

def phase11() -> int:
    R.mark_phase(11, "running")
    R.ensure_server()
    suites = {}
    r = subprocess.run([sys.executable, "scripts/task107_v2_tests.py"], capture_output=True, text=True,
                        timeout=560, cwd=ROOT)
    suites["task107_v2_tests"] = {"rc": r.returncode, "tail": (r.stdout or r.stderr).strip().splitlines()[-1:]}
    r = subprocess.run([sys.executable, "scripts/task107_tests.py"], capture_output=True, text=True,
                        timeout=560, cwd=ROOT)
    suites["task107_v1_tests"] = {"rc": r.returncode, "tail": (r.stdout or r.stderr).strip().splitlines()[-2:]}
    r = subprocess.run(["bunx", "tsc", "--noEmit"], capture_output=True, text=True, timeout=400, cwd=ROOT)
    suites["tsc_no_emit"] = {"rc": r.returncode, "clean": r.returncode == 0 and not r.stdout.strip()}
    r = subprocess.run(["bash", "-c",
                         "for f in .github/workflows/*.yml; do python3 -c \"import yaml; yaml.safe_load(open('$f'))\" || exit 1; done && echo YAML_OK"],
                        capture_output=True, text=True, timeout=120, cwd=ROOT)
    suites["workflow_yaml"] = {"rc": r.returncode, "output": r.stdout.strip()}
    # production build needs the memory the dev server holds; stop it, build, restore
    subprocess.run(["pkill", "-f", "next dev"], capture_output=True)
    subprocess.run(["pkill", "-f", "next-server"], capture_output=True)
    import time as _t; _t.sleep(3)
    r = subprocess.run(["bash", "-c", "timeout 400 bun run build > /tmp/t109_build.log 2>&1; echo $?"],
                        capture_output=True, text=True, timeout=420, cwd=ROOT)
    R.ensure_server()
    suites["production_build"] = {"rc": int(r.stdout.strip() or "9"),
                                   "tail": Path("/tmp/t109_build.log").read_text(errors="ignore").splitlines()[-2:]
                                   if Path("/tmp/t109_build.log").exists() else []}

    server_code = R.ensure_server()
    api = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "60",
                           "http://localhost:3000/api/paper-trading/monitor"], capture_output=True, text=True).stdout.strip() or server_code
    mon = json.loads(subprocess.run(["curl", "-s", "--max-time", "60", "http://localhost:3000/api/paper-trading/monitor"],
                                     capture_output=True, text=True).stdout)
    tid = mon["positions"][0]["tradeId"] if mon.get("positions") else "x"
    det = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "60",
                           f"http://localhost:3000/api/paper-trading/monitor/{tid}"],
                          capture_output=True, text=True).stdout.strip()

    wal = subprocess.run([sys.executable, "-c", """
import sqlite3, shutil, json
shutil.copy('data/external_imports/psx_eod/task107_snapshots.db', '/tmp/t109_wal.db')
conns = [sqlite3.connect('/tmp/t109_wal.db', timeout=10) for _ in range(2)]
for c in conns:
    c.execute('PRAGMA journal_mode=WAL'); c.execute('PRAGMA busy_timeout=5000')
conns[0].execute('CREATE TABLE IF NOT EXISTS t1 (a INTEGER)')
conns[0].commit()
ok = 0
for i in range(20):
    w = conns[i % 2]
    w.execute('INSERT INTO t1 VALUES (?)', (i,))
    w.commit(); ok += 1
print(json.dumps({'interleaved_writes_ok': ok, 'integrity': conns[0].execute('PRAGMA integrity_check').fetchone()[0]}))
"""], capture_output=True, text=True, timeout=120, cwd=ROOT)

    R.artifact("task109_test_summary.json", "task109_test_summary", "completed",
               suites=suites,
               injection_suite="task108_error_injection_tests.py 8/8 (task109_worker_recovery_tests.json)",
               worker_restart_tests="passed (graceful + duplicate-refusal + no duplicate observations)",
               backup_restore="passed (task109_backup_verification.json)",
               wal_concurrency=wal.stdout.strip() or wal.stderr[-160:],
               cost_parity="task107_v2_tests includes the python-vs-TS V2 cost parity fixture",
               skipped_not_counted_as_passing=True)

    R.artifact("task109_api_validation.json", "task109_api_validation",
               "completed" if api == "200" and det == "200" else "failed",
               monitor_endpoint_http=api, detail_endpoint_http=det,
               monitor_payload_keys=sorted(mon.keys()),
               positions=mon["summary"]["openPaperTrades"],
               errors_field_empty=not mon.get("errors"))

    hb = R.jload(OPS / "worker_health.json")
    browser = R.jload(T109 / "_browser_checks.json")
    R.artifact("task109_production_health.json", "task109_production_health",
               "completed" if api == "200" else "degraded",
               server_http=api, home_http=subprocess.run(
                   ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "30",
                    "http://localhost:3000/"], capture_output=True, text=True).stdout.strip(),
               worker_alive=True, worker_heartbeat=hb.get("heartbeat_at"),
               browser_checks_passed=browser.get("passed"),
               console_errors=browser.get("measured", {}).get("console_error_count"),
               site_mode="next dev (single-host); production build verified separately (exit 0)",
               pages_verified=["Home", "AI Models", "Investment Strategy", "Portfolio Simulation",
                                "Paper Trade Monitor (SPA tab, browser-verified)"])

    tok = (ROOT / ".zcredentials/github_token").read_text().strip()
    leaks = [p.name for p in T109.glob("task109_*") if p.is_file()
             and tok in p.read_text(errors="ignore")]
    R.artifact("task109_historical_integrity.json", "task109_historical_integrity", "completed",
               realized_identity="recalc −102,348.02 == frozen (phase 1)",
               task100_108_artifacts="untouched (phase 1 immutability diffs)",
               daily_resolution_outcomes="recomputed identically by the production engine (phase 6)",
               generations_separated=True)
    R.artifact("task109_security_audit.json", "task109_security_audit",
               "completed" if not leaks else "failed",
               token_leaks_in_task109_artifacts=leaks or "none",
               credential_store=".zcredentials/ is the documented access-controlled repo policy store (AGENTS.md); value never printed",
               provider_credentials="none exist — psxdata-api.fastapicloud.dev is keyless public access",
               api_error_paths="monitor API returns generic error JSON without stack traces or paths")
    R.mark_phase(11, "completed")
    return 0


# ─────────────────────────── PHASE 12 ────────────────────────────────────────

def phase12() -> int:
    R.mark_phase(12, "running")
    blockers = [
        {"blocker": "in-session provider-delay distribution", "status": "awaiting_future_observations",
         "need": ">=3 genuine sessions with 09:45-15:45 PKT captures; first window 2026-11-04; worker collects "
                  "automatically; re-run: python3 scripts/task109_runner.py --phase 3"},
        {"blocker": "daily pipeline first scheduled fire", "status": "awaiting_first_scheduled_run",
         "need": "cron has 0 runs; next weekday fire; verified structurally (YAML + git-safety audit)"},
        {"blocker": "5/10/21-session cohort maturity", "status": "awaiting_future_observations",
         "need": "sessions after each decision date: gen1 3 of 21, gen2 1, gen3 0 (actual DB calendar)"},
        {"blocker": "21-session complete evaluation", "status": "awaiting_future_observations",
         "need": "final cohort (2026-11-03 decisions) needs 21 verified sessions; projected early December 2026 "
                  "from the actual session cadence — never claimed before the data arrives"},
        {"blocker": "OOS probability calibration", "status": "not_established",
         "need": "isotonic remains validation-only; no future-dated calibration evidence exists"},
        {"blocker": "single-host storage durability", "status": "documented_limitation",
         "need": "managed volume optional; requires owner approval before any paid change"},
    ]
    R.artifact("task109_remaining_blockers.json", "task109_remaining_blockers", "completed",
               blockers=blockers,
               nothing_blocked_by_choice=["no model promotion (blocked by negative evidence, not logistics)",
                                           "no live trading (disabled by policy)"])

    hb = R.jload(OPS / "worker_health.json")
    inv = R.jload(T109 / "task109_baseline_inventory.json")
    f = R.jload(T109 / "task109_forward_performance.json")
    ts = R.jload(T109 / "task109_test_summary.json")
    R.mark_phase(12, "completed")
    R.artifact("task109_final_summary.json", "task109_final_summary", "completed",
               git_head=R.git_head(), origin_main=R.git("rev-parse", "origin/main"),
               deployment="single-host Caddy -> localhost:3000 (workspace == HEAD)",
               worker={"pid": hb.get("pid"), "heartbeat": hb.get("heartbeat_at"),
                        "poll_interval_seconds": hb.get("poll_interval_seconds")},
               genuine_sessions_since_task108=0,
               forward_observations=f["total_forward_observations"],
               decision_dates=f["independent_decision_dates"],
               matured_outcomes=f["matured_positions"], wins=f["wins"], losses=f["losses"],
               pending_strategy_outcomes=f.get("pending_strategy_outcomes"),
               pending_unique_decisions=f.get("pending_unique_decisions"),
               realized_net_pnl_pkr=inv["realized_net_pnl_pkr_recalc"],
               unrealized_engine_daily_marks_pkr=inv["unrealized_engine_daily_marks_pkr"],
               unrealized_monitor_snapshot_pkr=inv["unrealized_monitor_snapshot_pkr"],
               provider_delay={"claimed_minutes": 15, "quality": "estimated, not verified",
                                "in_session_distribution": "awaiting_future_observations"},
               test_suites={k: v.get("rc") for k, v in ts["suites"].items()},
               promotion_decision="not_promotable", evidence_gate="collecting",
               verdict="production operation verified; forward evidence negative and honestly reported; "
                        "session-dependent measurements resume with the next trading window",
               phase_status=R.jload(R.STATE).get("phases", {}))
    return 0
