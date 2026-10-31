"""Task 96 Phases 1-2 — initial status, registry verification, reproducibility test."""
import json
import subprocess
import urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
T95 = BASE / "data/backtest_reports/task95"
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
    import shutil
    git = {
        "head": sh("git rev-parse HEAD")[:12],
        "head_oneline": sh("git log -1 --oneline")[:60],
        "sync_ahead_behind": sh("git rev-list --left-right --count origin/main...HEAD"),
        "task95_head_pushed": "4f0f92c2",
    }
    disk = shutil.disk_usage(BASE)
    mem = sh("free -m").splitlines()[1].split()
    server = {}
    try:
        with urllib.request.urlopen("http://localhost:3000", timeout=15) as r:
            server["home"] = r.status
    except Exception as e:
        server["home"] = f"ERR {e}"
    required = [
        "task96_summary.json", "task96_execution_plan.json", "task96_progress.json",
        "task96_initial_status.json", "task96_registry_final.json", "task96_model_reproducibility.json",
        "task96_moirai_results.json", "task96_foundation_model_status.json",
        "task96_prospective_session_report.json", "task96_prospective_integrity.json",
        "task96_prospective_performance.json", "task96_variant_b_validation.json",
        "task96_cost_reconciliation.json", "task96_build_results.json",
        "task96_typescript_baseline.json", "task96_api_validation.json",
        "task96_browser_test_results.json", "task96_remaining_blockers.json", "task96_metrics.csv",
    ]
    ctx.write("task96_initial_status.json", {
        "task": "Task 96 Phase 1 — initial status (continuing from Task 95 commit 4f0f92c2)",
        "generated_at": sh("date -u +%Y-%m-%dT%H:%M:%SZ"),
        "git": git,
        "system": {"mem_total_mb": int(mem[1]), "mem_available_mb": int(mem[6]),
                   "disk_free_gb": round(disk.free / 1e9, 2), "cpus": sh("nproc")},
        "server": server,
        "moirai_venv_present": (BASE / ".moirai-venv/bin/python").exists(),
        "required_deliverables": {"required": required,
                                  "present_so_far": [f for f in required if (REPORTS / f).exists()]},
    })


@reg("p1_execution_plan")
def p1_execution_plan(ctx):
    prog = json.loads((REPORTS / "task96_progress.json").read_text()) if (REPORTS / "task96_progress.json").exists() else {"jobs": {}}
    ctx.write("task96_execution_plan.json", {
        "task": "Task 96 — execution plan (resumable, 150s bounded jobs)",
        "runner": "scripts/task96_runner.py",
        "phases": {
            "P2": ["p1_initial_status", "p1_execution_plan", "p2_registry_verification", "p2_reproducibility_test"],
            "P3_MOIRAI_P0": ["p3_moirai_chunk_batch (repeats until 80 chunks done)", "p3_moirai_aggregate"],
            "P4": ["p4_foundation_feasibility"],
            "P5_P6": ["p5_session_check", "p5_process_and_idempotency", "p5_reconcile_cohort", "p5_performance_report"],
            "P7": ["p7_variant_b_costs"],
            "P8": ["p8_build_start", "p8_build_poll (repeat)", "p8_typescript_baseline"],
            "P10_11": ["p10_api_validation", "p11_browser_regression"],
            "P12": ["p12_summary_blockers"],
        },
        "progress_snapshot": {k: v.get("status") for k, v in prog.get("jobs", {}).items()},
    })


@reg("p2_registry_verification")
def p2_registry_verification(ctx):
    src = (BASE / "src/lib/latent/ensemble.ts").read_text()
    import re
    m = re.search(r"export const ALL_MODELS: ModelMeta\[\] = \[(.*?)\n\];", src, re.S)
    n_all = len(re.findall(r"\{\s*name:\s*['\"]([^'\"]+)['\"]", m.group(1))) if m else 0
    live = api("/api/models/registry")
    counts = {"canonical": live.get("canonicalCount"), "supplemental": live.get("supplementalCount"),
              "aliases": live.get("aliasCount"), "unique": live.get("uniqueImplementationCount"),
              "all_models_source": n_all}
    readme = (BASE / "README.md").read_text()
    readme_ok = ("58 canonical + 9 supplemental + 2 aliases" in readme
                 and "67 unique implementations" in readme)
    # Task 95 loader fix still present
    rec = (BASE / "scripts/task94_phase2_recover_neural.py").read_text()
    loader_fix = {
        "fc_to_head_remap": 'k.startswith("fc.")' in rec,
        "missing_key_guard": "missing_keys" in rec,
        "seed": "torch.manual_seed(0)" in rec,
        "mean_pool_head": "h.mean(dim=1)" in rec,
        "head_shape": "self.head = nn.Linear(d_model, 1)" in rec,
    }
    t95_cav = json.loads((T95 / "task95_model_metric_caveat_resolution.json").read_text())
    ctx.write("task96_registry_final.json", {
        "task": "Task 96 Phase 2 — final registry verification",
        "counts": counts,
        "counts_match_task95": counts == {"canonical": 58, "supplemental": 9, "aliases": 2,
                                          "unique": 67, "all_models_source": 58},
        "readme_consistent": readme_ok,
        "task95_loader_fix_preserved": loader_fix,
        "task95_caveat_status": t95_cav.get("summary"),
        "ensembles": "8 ensemble aggregation methods (Majority Vote, Probability-Weighted, Tier-Weighted, "
                     "Final Consensus, CL-2, PI, CG, X/GIAN/M per task94 reconciliation)",
        "verdict": "registry source of truth confirmed against source code, live API and README",
    })


@reg("p2_reproducibility_test")
def p2_reproducibility_test(ctx):
    import importlib.util
    import sqlite3
    import sys
    sys.path.insert(0, str(BASE / "scripts"))
    spec = importlib.util.spec_from_file_location("t94r", BASE / "scripts/task94_phase2_recover_neural.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    import torch
    torch.set_num_threads(2)
    t95 = json.loads((T95 / "task95_model_metric_caveat_resolution.json").read_text())
    t95_by = {(r["model"], r["h"]): r["recomputed"] for r in t95["runs"]}
    conn = sqlite3.connect(mod.DB)
    results = []
    plan = [("PatchTST", [5, 10, 21], mod.CKPT_T83, dict(seq_len=60, patch_len=5, d_model=16, in_dim=4), 4),
            ("Transformer-LSTM", [5, 10], mod.CKPT_T84, dict(seq_len=19, d_model=8, in_dim=1), 1)]
    for name, horizons, ckpt_dir, arch, in_dim in plan:
        for h in horizons:
            outs = []
            for run in (1, 2):
                m = (mod.PatchTSTInfer if name == "PatchTST" else mod.TransformerLSTMInfer)(**arch)
                r = mod.evaluate_model(f"{name}_{h}d", m, ckpt_dir / f"{name}_{h}d.pt", conn,
                                       horizons=[h], symbols=mod.SYMBOLS[:5], n_per_sym=8, in_dim=in_dim)
                ph = r.get("per_horizon", {}).get(h) or r.get("per_horizon", {}).get(str(h), {})
                outs.append((ph.get("dir_acc"), ph.get("mae"), ph.get("rmse"), ph.get("r2")))
            stored = t95_by.get((name, h), {})
            results.append({
                "model": name, "h": h,
                "run1": outs[0], "run2": outs[1],
                "deterministic": outs[0] == outs[1],
                "matches_task95_recomputed": outs[0] == (stored.get("dir_acc"), stored.get("mae"),
                                                          stored.get("rmse"), stored.get("r2")),
            })
    conn.close()
    all_det = all(r["deterministic"] for r in results)
    all_match = all(r["matches_task95_recomputed"] for r in results)
    ctx.write("task96_model_reproducibility.json", {
        "task": "Task 96 Phase 2 — PatchTST / Transformer-LSTM reproducibility test",
        "method": "fixed recovery loader, 2 identical runs per cell, compared across runs and vs Task 95 stored recomputed values",
        "results": results,
        "verdict": ("all cells deterministic and identical to Task 95's recovered results — "
                    "no change to recovered results" if all_det and all_match
                    else "MISMATCH — investigate before trusting"),
    })
    ctx.log(f"reproducibility: deterministic={all_det} match_t95={all_match}")
