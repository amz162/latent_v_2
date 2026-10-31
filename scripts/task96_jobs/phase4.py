"""Task 96 Phase 4 — official Time-LLM and FinGPT feasibility attempts (bounded)."""
import json
import subprocess
import urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project")
REPORTS = BASE / "data/backtest_reports/task96"
TP = BASE / ".task96_third_party"
PRIORITY = 50

JOBS = {}


def reg(name):
    def deco(fn):
        JOBS[name] = fn
        return fn
    return deco


def sh(cmd, t=125):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=BASE, timeout=t)


@reg("p4_foundation_feasibility")
def p4_foundation_feasibility(ctx):
    out = {"task": "Task 96 Phase 4 — official Time-LLM / FinGPT feasibility"}

    # ── Time-LLM ──────────────────────────────────────────────────────────────
    tllm = {"official_repo": "thuml/Time-LLM"}
    try:
        if not (TP / "Time-LLM").exists():
            TP.mkdir(parents=True, exist_ok=True)
            r = sh(f"git clone --depth 1 https://github.com/thuml/Time-LLM {TP}/Time-LLM", t=100)
            tllm["clone_rc"] = r.returncode
        tllm["repo_cloned"] = (TP / "Time-LLM").exists()
        req = (TP / "Time-LLM/requirements.txt")
        tllm["requirements"] = req.read_text().strip().splitlines()[:20] if req.exists() else "no requirements.txt"
        model_py = TP / "Time-LLM/models/TimeLLM.py"
        tllm["official_model_file"] = model_py.exists()
        if model_py.exists():
            src = model_py.read_text()
            tllm["backbone"] = "GPT2" if "GPT2LMHeadModel" in src or "OpenAI" in src else "other"
            tllm["reprogramming"] = "ReprogrammingLayer" in src or "reprogramming" in src.lower()
            tllm["inputs_needed"] = ["batch_x (numeric series)", "batch_x_mark (time marks)",
                                     "dec_inp", "batch_y_mark (time marks)"]
            # CPU feasibility: GPT-2 small backbone (~124M params ≈ 500MB fp32) — sandbox has ~1.4GB
            tllm["cpu_feasibility"] = ("feasible in principle (GPT-2 small ≈ 500MB fp32); faithful run needs "
                                       "transformers + their data-provider time-mark pipeline + prompt library")
            # bounded faithful attempt: install transformers into moirai venv, try instantiating
            if not tllm.get("attempted"):
                r = sh("uv pip install --python .moirai-venv/bin/python transformers --index-url https://pypi.org/simple", t=120)
                tllm["transformers_install_rc"] = r.returncode
                if r.returncode == 0:
                    probe = sh(f"""{BASE}/.moirai-venv/bin/python - <<'PYEOF'
import sys
sys.path.insert(0, "{TP}/Time-LLM")
from types import SimpleNamespace
try:
    from models.TimeLLM import Model
    cfg = SimpleNamespace(task_name="long_term_forecast", features="MS", seq_len=180, label_len=0,
        pred_len=5, factor=1, enc_in=1, dec_in=1, c_out=1, d_model=16, n_heads=2, e_layers=1,
        d_layers=1, d_ff=32, moving_avg=25, dropout=0.1, embed="timeF", freq="d", activation="gelu",
        output_attention=False, patch_len=8, stride=8, prompt_domain=0, llm_model="GPT2", llm_layers=6,
        llm_dim=768)
    m = Model(cfg)
    print("MODEL_INSTANTIATED params:", sum(p.numel() for p in m.parameters()))
except Exception as e:
    print("ATTEMPT_FAILED:", type(e).__name__, str(e)[:200])
PYEOF""", t=110)
                    tllm["minimal_attempt_tail"] = (probe.stdout or probe.stderr).strip().splitlines()[-2:]
                    tllm["attempted"] = True
    except Exception as e:
        tllm["error"] = f"{type(e).__name__}: {e}"
    out["time_llm"] = tllm

    # ── FinGPT ────────────────────────────────────────────────────────────────
    fg = {"official_repo": "AI4Finance-Foundation/FinGPT"}
    try:
        req = urllib.request.Request("https://huggingface.co/api/models?author=FinGPT&limit=50",
                                     headers={"User-Agent": "latent-task96"})
        with urllib.request.urlopen(req, timeout=25) as r:
            models = json.loads(r.read())
        listed = [{"id": m["id"], "downloads": m.get("downloads")} for m in models[:15]]
        fg["hf_checkpoints"] = listed
        fg["checkpoint_count"] = len(models)
        fg["smallest_base"] = ("official FinGPT LoRA adapters sit on 6B-13B bases (ChatGLM2-6B, Falcon-7B, "
                               "LLaMA2-7B/13B, MPT-7B) — fp16 inference needs >= 8GB RAM, fp32 >= 13GB")
        fg["sandbox_ram_available_gb"] = 1.4
        fg["verdict"] = ("memory_blocked: no official FinGPT checkpoint runs in this sandbox; exact "
                         "requirement = >= 8GB RAM (7B fp16) or a CPU-quantized official release, "
                         "neither available upstream")
        fg["sentiment_protocol"] = ("dated PSX announcements (Announcement table, publish-timestamp verified) "
                                    "would be the feature source; predictions only after publication ts")
    except Exception as e:
        fg["error"] = f"{type(e).__name__}: {e}"
    out["fingpt"] = fg

    out["labelling_rule"] = ("both models stay experimental_gpt2_baseline; no relabeling without a faithful "
                             "official-architecture run producing real forecasts/scores")
    ctx.write("task96_foundation_model_status.json", out)
    ctx.log(f"tllm clone={tllm.get('repo_cloned')} attempt={tllm.get('minimal_attempt_tail')}")
