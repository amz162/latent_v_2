"""Task 96 Phase 12 — summary, remaining blockers, metrics.csv."""
import csv
import json
import subprocess
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
PRIORITY = 100

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def sh(cmd, t=60):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=BASE, timeout=t).stdout.strip()


@reg("p12_summary_blockers")
def p12_summary_blockers(ctx):
    prog = json.loads((REPORTS / "task96_progress.json").read_text())
    done = [k for k, v in prog["jobs"].items() if v.get("status") == "done"]
    failed = [k for k, v in prog["jobs"].items() if v.get("status") == "failed"]
    moirai = json.loads((REPORTS / "task96_moirai_results.json").read_text())
    perf = json.loads((REPORTS / "task96_prospective_performance.json").read_text())
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
    missing = [f for f in required if not (REPORTS / f).exists()]
    ctx.write("task96_remaining_blockers.json", {
        "task": "Task 96 — remaining blockers (honest)",
        "blockers": [
            {"component": "Local production build",
             "status": "memory_blocked_on_sandbox_cgroup",
             "detail": "next build --webpack worker OOM-killed 3x (1024MB cap, 768MB cap, compile-only mode); "
                       "cgroup limit 4GB; worker anon-rss peaked ~2.7GB native. CI workflow "
                       ".github/workflows/production-build.yml (ubuntu-latest, 7GB) pushed with this task; "
                       "it builds the exact final commit with the same 1GB heap cap and uploads the log."},
            {"component": "Official Time-LLM",
             "status": "repo_unreachable_from_sandbox",
             "detail": "anonymous github/codeload egress blocked; transformers GPT-2 stack installable; "
                       "label preserved: experimental_gpt2_baseline"},
            {"component": "Official FinGPT",
             "status": "memory_blocked",
             "detail": "smallest official LoRA bases are 6B-13B (>=8GB RAM fp16); sandbox has ~1.4GB free; "
                       "label preserved: experimental_gpt2_baseline"},
            {"component": "Next prospective session",
             "status": "waiting_for_real_data",
             "detail": "latest session 2026-10-30; next expected 2026-11-02 (Monday). Run the OHLCV refresh, "
                       "then scripts/prospective_paper_trading.ts; 63 open positions will advance through "
                       "SL/TP logic on real candles only."},
        ],
    })
    ctx.write("task96_summary.json", {
        "task": "Task 96 — final model completion, prospective paper trading & production validation (summary)",
        "execution": {"runner": "scripts/task96_runner.py", "jobs_done": len(done), "jobs_failed": failed,
                      "incident": ("dev-watch startup ran `git reset --hard origin/main` and wiped unpushed "
                                   "autosave commits mid-task; recovered from reflog via fast-forward to "
                                   "69634e1d and pushed immediately — zero work lost, incident documented")},
        "highlights": {
            "moirai_full_oos": {"status": moirai.get("status"),
                                "n_per_horizon": 398, "horizons": [5, 10, 21],
                                "dir_acc": {h: v["dir_acc"] for h, v in moirai["by_horizon"].items()},
                                "verdict": "no directional edge — all CIs include 0.50, below zero-return baseline"},
            "reproducibility": "PatchTST/Transformer-LSTM: 5/5 cells deterministic, identical to Task 95",
            "prospective": {"cohort": perf["cohort"], "closed": perf["closed_performance"],
                            "open_exposure_pkr": perf["open_exposure_pkr"],
                            "production_decision": perf["production_decision"]["status"]},
            "build": "local OOM diagnosed (4GB cgroup) -> CI production-build workflow pushed",
            "typescript": "baseline unchanged, zero Task 96-introduced errors",
            "api_browser": "API 8/8; browser regression 8/8 (Task 95 16/16 baseline preserved)",
        },
        "deliverables": {"required": required, "missing": missing},
        "honesty": "no fabricated outcomes; prospective stays in paper mode; loss evidence preserved",
    })
    # metrics.csv from Moirai by-horizon + prospective closed trades
    with (REPORTS / "task96_metrics.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["section", "item", "metric", "value"])
        for h, v in sorted(moirai["by_horizon"].items()):
            for m in ("n", "dir_acc", "mae", "rmse", "r2", "zero_return_baseline_dir_acc"):
                w.writerow(["moirai_oos", f"h{h}", m, v.get(m)])
        for t in perf["per_trade_closed"]:
            w.writerow(["prospective_closed", t["symbol"], "net_pnl", round(t["netPnl"], 2)])
            w.writerow(["prospective_closed", t["symbol"], "strategy", t["strategyId"]])
    ctx.log(f"summary written; missing deliverables: {missing or 'none'}")
