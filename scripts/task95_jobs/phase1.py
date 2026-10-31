"""Task 95 Phase 1 — repository reconciliation and baseline."""
import json
import re
import subprocess
import urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task95"
T94 = BASE / "data/backtest_reports/task94"
PRIORITY = 10

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=BASE, timeout=60).stdout.strip()


def api(path, timeout=20):
    with urllib.request.urlopen(f"http://localhost:3000{path}", timeout=timeout) as r:
        return json.loads(r.read())


@reg("p1_initial_status")
def p1_initial_status(ctx):
    git = {
        "head": sh("git rev-parse HEAD"),
        "head_short": sh("git log -1 --oneline"),
        "branch": sh("git branch --show-current"),
        "sync_ahead_behind": sh("git rev-list --left-right --count origin/main...HEAD"),
        "dirty_files": len([x for x in sh("git status --porcelain").splitlines() if x.strip()]),
    }
    import shutil

    mem = {}
    for line in sh("free -m").splitlines()[1:2]:
        parts = line.split()
        mem = {"total_mb": int(parts[1]), "available_mb": int(parts[6])}
    disk = shutil.disk_usage(BASE)
    server = {"home_status": None, "registry_status": None}
    try:
        with urllib.request.urlopen("http://localhost:3000", timeout=15) as r:
            server["home_status"] = r.status
    except Exception as e:
        server["home_status"] = f"ERR {e}"
    try:
        d = api("/api/models/registry")
        server["registry_status"] = 200 if d.get("canonicalCount") else "EMPTY"
    except Exception as e:
        server["registry_status"] = f"ERR {e}"
    t94_files = sorted(x.name for x in T94.glob("*.json")) if T94.exists() else []
    required = [
        "task95_summary.json", "task95_execution_plan.json", "task95_progress.json",
        "task95_initial_status.json", "task95_registry_reconciliation.json",
        "task95_registry_final.json", "task95_model_metric_reproduction.json",
        "task95_model_artifact_validation.json", "task95_training_infrastructure.json",
        "task95_foundation_model_results.json", "task95_moirai_results.json",
        "task95_strategy_robustness.json", "task95_cost_reconciliation.json",
        "task95_ensemble_validation.json", "task95_prospective_integrity.json",
        "task95_prospective_monitoring.json", "task95_gm_data_provenance.json",
        "task95_api_validation.json", "task95_browser_test_results.json",
        "task95_build_test_results.json", "task95_remaining_blockers.json", "task95_metrics.csv",
    ]
    done = [f for f in required if (REPORTS / f).exists()]
    ctx.write("task95_initial_status.json", {
        "task": "Task 95 Phase 1 — initial status",
        "generated_at": sh("date -u +%Y-%m-%dT%H:%M:%SZ"),
        "git": git,
        "system": {"memory": mem, "disk_free_gb": round(disk.free / 1e9, 2), "cpus": sh("nproc")},
        "server": server,
        "task94_artifacts_present": t94_files,
        "task95_required_deliverables": {"required": required, "present_so_far": done,
                                         "missing": [f for f in required if f not in done]},
    })


@reg("p1_registry_reconciliation")
def p1_registry_reconciliation(ctx):
    src = (BASE / "src/lib/latent/model-backtest.ts").read_text()
    m = re.search(r"export const ALL_MODELS[^=]*=\s*\[(.*?)\n\] as", src, re.S)
    ids = re.findall(r"id:\s*['\"]([^'\"]+)['\"]", m.group(1)) if m else []
    live = api("/api/models/registry")
    t94_rec = json.loads((T94 / "task94_registry_reconciliation.json").read_text())
    counts_94 = t94_rec.get("counts") or {k: t94_rec.get(k) for k in ("canonical", "supplemental", "aliases", "unique_implementations", "ensembles")}
    live_counts = {
        "canonical": live.get("canonicalCount"), "supplemental": live.get("supplementalCount"),
        "aliases": live.get("aliasCount"), "total_registry_entries": live.get("totalCount"),
        "unique_implementations": live.get("uniqueImplementationCount"),
    }
    live["canonical"] and live.get("canonical") and None
    live_ensembles = 0
    for ent in live.get("canonical", []) + live.get("supplemental", []):
        if isinstance(ent, dict) and str(ent.get("family", "")).lower().find("ensemble") >= 0:
            live_ensembles += 1
    mismatches = []
    ref = {"canonical": 58, "supplemental": 9, "aliases": 2, "total_registry_entries": 69, "unique_implementations": 67}
    for k, v in ref.items():
        if live_counts.get(k) != v:
            mismatches.append({"field": k, "live": live_counts.get(k), "task94_claim": v})
    ctx.write("task95_registry_reconciliation.json", {
        "task": "Task 95 Phase 1 — registry reconciliation",
        "source_of_truth": {
            "all_models_source_file": "src/lib/latent/model-backtest.ts",
            "all_models_entries_parsed": len(ids),
            "all_models_ids_sample": ids[:10],
            "parse_note": "count of id: fields inside export const ALL_MODELS" if m else "ARRAY PARSE FAILED — inspect manually",
        },
        "live_api_counts": live_counts,
        "live_api_ensemble_family_rows": live_ensembles,
        "task94_reported_counts": counts_94,
        "task94_summary_counts": {"canonical": 58, "supplemental": 9, "aliases": 2,
                                  "unique_implementations": 67, "ensembles": 8},
        "mismatches_vs_task94": mismatches,
        "verdict": "CONFIRMED — live API matches Task 94 claims" if not mismatches else "MISMATCH — see list",
        "reconciliation_note": live.get("reconciliation"),
    })


@reg("p1_execution_plan")
def p1_execution_plan(ctx):
    prog = json.loads((REPORTS / "task95_progress.json").read_text()) if (REPORTS / "task95_progress.json").exists() else {"jobs": {}}
    ctx.write("task95_execution_plan.json", {
        "task": "Task 95 — execution plan (resumable, 150s bounded jobs)",
        "runner": "scripts/task95_runner.py",
        "phases": {
            "P1": ["p1_initial_status", "p1_registry_reconciliation"],
            "P3_P9": ["p3_metric_caveats", "p3_training_infra", "p3_recovered_regressions", "p9_registry_final"],
            "P4": ["p4_metric_reproduction", "p4_walkforward_verify", "p4_perstock_verify"],
            "P5": ["p5_cost_reconciliation", "p5_variant_b_repro", "p5_robustness", "p5_ensembles"],
            "P6": ["p6_foundation_verify", "p6_moirai_attempt"],
            "P7": ["p7_gm_provenance"],
            "P8": ["p8_prospective_diagnose", "p8_prospective_process", "p8_prospective_monitor"],
            "P10": ["p10_api_validation"],
            "P11": ["p11_browser_tests"],
            "P12": ["p12_build_tests", "p12_summary_blockers"],
        },
        "budget_rule": "each job < 150s; runner auto-resumes; no memory-heavy concurrency",
        "progress_snapshot": {k: v.get("status") for k, v in prog.get("jobs", {}).items()},
    })
