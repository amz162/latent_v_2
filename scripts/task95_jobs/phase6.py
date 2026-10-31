"""Task 95 Phase 6 — foundation model completeness (Chronos, Lag-Llama, Moirai, Time-LLM, FinGPT)."""
import json
import subprocess
import shutil
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task95"
T94 = BASE / "data/backtest_reports/task94"
PRIORITY = 60

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def sh(cmd, t=120):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=BASE, timeout=t)


@reg("p6_foundation_verify")
def p6_foundation_verify(ctx):
    f94 = json.loads((T94 / "task94_foundation_results.json").read_text())
    repro = json.loads((REPORTS / "task95_model_metric_reproduction.json").read_text())
    chron_ok = repro["chronos_raw_reproduction"]["all_match"]
    chron_cmp = repro["chronos_raw_reproduction"]["comparison"]
    models = {
        "Chronos (Amazon)": {
            "identity": "official_pretrained_inference_oos_evaluated",
            "checkpoint": "amazon/chronos-t5-tiny", "package": "chronos-forecasting 2.3.2",
            "n": chron_cmp["n"]["stored"], "dir_acc": chron_cmp["dir_acc"]["stored"],
            "task95_verification": "metrics recomputed from 400 raw prediction records — all match",
            "limitations": "zero-shot inference, CPU, NOT fine-tuned; dir_acc 0.4775 CI includes 0.50 — no proven edge",
        },
        "Lag-Llama": {
            "identity": "official_pretrained_inference_insufficient_samples",
            "checkpoint": f94.get("models", {}).get("Lag-Llama", {}).get("checkpoint", "official lag-llama checkpoint"),
            "n": 60,
            "task95_verification": "summary-only artifact (no raw prediction arrays persisted) — raw recompute infeasible",
            "limitations": "n=60 below reliability threshold; no directional edge may be claimed",
        },
        "Moirai (Salesforce)": {"identity": "dependency_blocked_after_attempts",
                                "task95_action": "see task95_moirai_results.json for the bounded re-attempt"},
        "Time-LLM": {"identity": "experimental_gpt2_baseline",
                     "note": "kept experimental unless a faithful official implementation is executed"},
        "FinGPT": {"identity": "experimental_gpt2_baseline",
                   "note": "21-sample proxy NOT promoted; official checkpoint + timestamped corpus required"},
    }
    ctx.write("task95_foundation_model_results.json", {
        "task": "Task 95 Phase 6 — foundation model completeness",
        "models": models,
        "chronos_raw_reproduction_match": chron_ok,
        "reporting_rule": "official vs experimental identity preserved; no fabricated training claims; "
                          "sample counts and CIs displayed; unavailable metrics stay unavailable",
    })


@reg("p6_moirai_attempt")
def p6_moirai_attempt(ctx):
    result = {"task": "Task 95 Phase 6.3 — bounded Moirai separate-env re-attempt",
              "recipe_source": "task94_moirai_diagnostic.json (separate venv, torch<2.5, NumPy>=2.0)"}
    venv = BASE / ".moirai-venv"
    steps = []
    # step 0: prerequisites
    disk_free_gb = shutil.disk_usage(BASE).free / 1e9
    hf_cache = Path.home() / ".cache/huggingface/hub/models--Salesforce--moirai-1.1-R-small"
    result["prerequisites"] = {"disk_free_gb": round(disk_free_gb, 2), "hf_checkpoint_cached": hf_cache.exists()}
    steps.append("prerequisites checked")
    try:
        # step 1: venv + pinned deps (bounded; uv caches make retries cheap)
        if not (venv / "bin/python").exists():
            r = sh(f"uv venv {venv} --python 3.12", t=60)
            steps.append(f"venv created rc={r.returncode}")
        r = sh(f"uv pip install --python {venv}/bin/python "
               f"'torch==2.4.1' 'numpy>=2.0' 'uni2ts' 'lightning' 'gluonts==0.14.4' 'pandas<2.2' "
               f"--index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple",
               t=135)
        result["install"] = {"rc": r.returncode, "tail": (r.stdout or r.stderr).strip().splitlines()[-4:]}
        steps.append(f"deps installed rc={r.returncode}")
    except subprocess.TimeoutExpired:
        result["install"] = {"rc": "timeout", "note": "install exceeded 135s — resumable: rerun job (uv caches downloads)"}
        steps.append("install timeout")
    except Exception as e:
        result["install"] = {"rc": "error", "error": str(e)[:300]}
        steps.append("install error")
    # step 2: try import chain (only if install fully succeeded)
    try:
        if (venv / "bin/python").exists() and result.get("install", {}).get("rc") == 0:
            probe = sh(f"{venv}/bin/python -c \"import uni2ts, gluonts, lightning, numpy, torch; "
                       f"print('uni2ts', uni2ts.__version__ if hasattr(uni2ts,'__version__') else 'ok'); "
                       f"print('numpy', numpy.__version__); print('torch', torch.__version__)\"", t=60)
            result["import_probe"] = {"rc": probe.returncode, "out": probe.stdout.strip()[:300],
                                      "err": probe.stderr.strip().splitlines()[-3:] if probe.returncode else []}
            steps.append(f"import probe rc={probe.returncode}")
    except Exception as e:
        result["import_probe"] = {"error": str(e)[:200]}
    result["steps"] = steps
    if result.get("import_probe", {}).get("rc") == 0:
        result["status"] = "env_recovered — inference attempt required next (resumable job)"
    elif result.get("install", {}).get("rc") == "timeout":
        result["status"] = "install_in_progress — rerun p6_moirai_attempt to resume from uv cache"
    else:
        result["status"] = "dependency_blocked_after_attempts (Task 95 attempt documented)"
    ctx.write("task95_moirai_results.json", result)
    ctx.log(f"moirai attempt: {result['status']}")
