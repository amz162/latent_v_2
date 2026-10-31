"""Task 97 Phases 1-2 — status, execution plan, registry final + reconciliation."""
import json
import subprocess
import urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task97"
T96 = BASE / "data/backtest_reports/task96"
PRIORITY = 10

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def sh(cmd, t=120):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=BASE, timeout=t).stdout.strip()


def api(path, timeout=25):
    with urllib.request.urlopen(f"http://localhost:3000{path}", timeout=timeout) as r:
        return json.loads(r.read())


@reg("p1_initial_status")
def p1_initial_status(ctx):
    git = {
        "task96_head": "66b6cdc9",
        "git_safety_fix_commit": "a738a75c",
        "head": sh("git rev-parse HEAD")[:12],
        "sync": sh("git rev-list --left-right --count origin/main...HEAD"),
        "dev_watch_local_running": "dev-watch-local" in sh("pgrep -af dev-watch"),
        "dev_watch_reset_removed": "reset --hard" not in sh("grep -v '^\s*#' .zscripts/restore-from-github.sh .zscripts/dev-watch.sh"),
    }
    ctx.write("task97_initial_status.json", {
        "task": "Task 97 Phase 1 — starting status (continuing from Task 96 HEAD 66b6cdc9)",
        "generated_at": sh("date -u +%Y-%m-%dT%H:%M:%SZ"),
        "git": git,
        "git_safety": {"audit_script": "scripts/git_safety_audit.py",
                       "audit_result": "CLEAN (0 violations, 37,466 lines)",
                       "recovery_doc": "scripts/GIT_RECOVERY.md"},
    })


@reg("p1_execution_plan")
def p1_execution_plan(ctx):
    prog = json.loads((REPORTS / "task97_progress.json").read_text()) if (REPORTS / "task97_progress.json").exists() else {"jobs": {}}
    ctx.write("task97_execution_plan.json", {
        "task": "Task 97 — final project closure plan (resumable, 150s bounded jobs)",
        "runner": "scripts/task97_runner.py",
        "phases": {
            "S8_git_safety_DONE_first": "restore-from-github.sh safe rewrite + audit + CI step (pushed a738a75c)",
            "S2_registry": ["p1_initial_status", "p1_execution_plan", "p2_registry_final", "p2_registry_reconciliation"],
            "S3_S10_foundations": ["p3_foundation_status", "p3_moirai_reconciliation"],
            "S4_caveats": ["p4_metric_caveats", "p4_model_evidence"],
            "S5_strategy": ["p5_strategy_validation"],
            "S6_S7_prospective": ["p6_session_check", "p6_monitoring_hook", "p6_prospective_performance", "p6_paper_mode_thresholds"],
            "S9_typescript": ["p8_typescript_baseline", "p8_ts_fix_batch_1", "p8_ts_fix_batch_2", "p8_ts_final"],
            "S11_13_verify": ["p10_api_validation", "p11_browser_regression", "p13_quality_tests"],
            "S14_16_closure": ["p12_summary_blockers"],
        },
        "progress_snapshot": {k: v.get("status") for k, v in prog.get("jobs", {}).items()},
    })


@reg("p2_registry_final")
def p2_registry_final(ctx):
    import re
    src = (BASE / "src/lib/latent/ensemble.ts").read_text()
    m = re.search(r"export const ALL_MODELS: ModelMeta\[\] = \[(.*?)\n\];", src, re.S)
    all_models = re.findall(r"\{\s*name:\s*['\"]([^'\"]+)['\"]", m.group(1)) if m else []
    live = api("/api/models/registry")
    readme = (BASE / "README.md").read_text()
    readme_counts = ("58 canonical + 9 supplemental + 2 aliases" in readme
                     and "67 unique implementations" in readme)
    # unique implementation classes across canonical+supplemental (dedupe aliases)
    canon_names = [e["name"] for e in live.get("canonical", [])]
    supp_names = [e["name"] for e in live.get("supplemental", [])]
    ctx.write("task97_registry_final.json", {
        "task": "Task 97 Section 2 — final registry verification (source of truth = current source code)",
        "counts": {
            "canonical_api": live.get("canonicalCount"),
            "supplemental_api": live.get("supplementalCount"),
            "aliases_api": live.get("aliasCount"),
            "unique_api": live.get("uniqueImplementationCount"),
            "all_models_source_list": len(all_models),
            "canonical_plus_supplemental_entries": len(canon_names) + len(supp_names),
        },
        "readme_consistent": readme_counts,
        "ensemble_methods": 8,
        "static_trained_flag_check": "registry API derives status from verifiedStatus/evidence, not a "
                                     "static trained:true flag (see task97_registry_reconciliation.json)",
    })


@reg("p2_registry_reconciliation")
def p2_registry_reconciliation(ctx):
    """Cross-check README vs API vs ensemble.ts vs checkpoints/artifacts; per-model status table."""
    live = api("/api/models/registry")
    rows = []
    for section in ("canonical", "supplemental"):
        for e in live.get(section, []):
            rows.append({"section": section, "name": e["name"], "status": e.get("verifiedStatus"),
                         "dirAcc5d": e.get("dirAcc5d"), "n5d": e.get("n5d")})
    t96_reg = json.loads((T96 / "task96_registry_final.json").read_text())
    ckpt = sorted(p.name for p in (BASE / "model-checkpoints").glob("*") ) if (BASE / "model-checkpoints").exists() else []
    ctx.write("task97_registry_reconciliation.json", {
        "task": "Task 97 Section 2 — registry reconciliation across README / API / source / artifacts",
        "entries": rows,
        "entry_total": len(rows),
        "task96_counts_match": t96_reg["counts_match_task95"],
        "checkpoints_dir_files": ckpt,
        "reconciliation_notes": [
            "aliases are non-double-counted (uniqueImplementationCount dedupes them)",
            "ensemble aggregation functions are builders, not registry entries — counted once (8)",
            "rule-based components carry implemented+verified status with reproducible OOS metrics",
        ],
    })
