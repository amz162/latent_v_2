#!/usr/bin/env python3
"""Task 93: Full metric reproduction for all 58 canonical models.

Cross-references the canonical ALL_MODELS list (from src/lib/latent/ensemble.ts)
with the per-model metrics stored in task84_metrics.json (the authoritative
metrics report). For each canonical model, extracts the h=5d/10d/21d OOS metrics
(mae, rmse, r2, directional_accuracy, n) and writes a reproduction report.

Models not present in task84 are reported as 'metrics_missing'.
"""
import json, re, sys
from pathlib import Path

ENS_TS = Path("/home/z/my-project/src/lib/latent/ensemble.ts")
T84 = Path("/home/z/my-project/data/backtest_reports/task84/task84_metrics.json")
WF  = Path("/home/z/my-project/data/backtest_reports/walk_forward_latest.json")
T89 = Path("/home/z/my-project/data/backtest_reports/task89/batch_logs")
T92 = Path("/home/z/my-project/data/backtest_reports/task92")  # foundation model results
T93 = Path("/home/z/my-project/data/backtest_reports/task93")
OUT = Path("/home/z/my-project/data/backtest_reports/task93/task93_full_metric_reproduction.json")

# Aliases: canonical registry name -> task84 / other-report variant name
NAME_ALIASES = {
    "Kalman Filter": "Kalman",
    "Logistic Regression (PI)": "Logistic (PI)",
}


def extract_all_models(ts_text):
    """Extract canonical ALL_MODELS names from ensemble.ts."""
    # Find ALL_MODELS block by position (more reliable than regex with special chars)
    i = ts_text.find("export const ALL_MODELS")
    if i < 0:
        return []
    j = ts_text.find("];", i)
    if j < 0:
        return []
    body = ts_text[i:j]
    # Each entry: { name: "...", ... }
    names = re.findall(r'name:\s*"([^"]+)"', body)
    return names


def load_t84_metrics():
    d = json.load(open(T84))
    return d.get("allResults", {})


def load_wf_metrics():
    d = json.load(open(WF))
    out = {}
    for m in d.get("models", []):
        out[m["name"]] = m
    return out


def load_t89_metrics():
    """Pull task89 batch1_fixes metrics (Kalman Filter etc)."""
    out = {}
    for f in T89.glob("*.json"):
        d = json.load(open(f))
        if isinstance(d, dict):
            for k, v in d.items():
                if isinstance(v, dict) and "metrics" in v:
                    out[k] = v
    return out


def load_foundation_metrics():
    """Pull Chronos, Lag-Llama, Moirai, Time-LLM, FinGPT results from task92/task93."""
    out = {}
    # task93 chronos
    f = T93 / "task93_chronos_results.json"
    if f.exists():
        d = json.load(open(f))
        out["Chronos (Amazon)"] = {
            "status": d["status"],
            "h5d": {
                "mae": d["mae"], "rmse": d["rmse"], "r2": d["r2"],
                "directional_accuracy": d["dir_acc"],
                "n": d["n"],
                "ci95": d["ci95"],
                "zero_baseline_mae": d["zero_baseline_mae"],
                "mean_baseline_mae": d["mean_baseline_mae"],
                "beats_mean_baseline": d["beats_mean_baseline"],
            },
            "source": "task93/task93_chronos_results.json (expanded from task92 n=172)",
        }
    f = T93 / "task93_lag_llama_results.json"
    if f.exists():
        d = json.load(open(f))
        out["Lag-Llama"] = {
            "status": d["status"],
            "h5d": {
                "mae": d["mae"], "rmse": d["rmse"], "r2": d["r2"],
                "directional_accuracy": d["dir_acc"],
                "n": d["n"],
                "ci95": d["ci95"],
                "zero_baseline_mae": d["zero_baseline_mae"],
                "mean_baseline_mae": d["mean_baseline_mae"],
                "beats_mean_baseline": d["beats_mean_baseline"],
            },
            "source": "task93/task93_lag_llama_results.json",
        }
    # task92 chronos/lag_llama/moirai/time-llm/fingpt statuses (for any model not in task93)
    for sub in ["chronos.json", "lag_llama.json", "moirai.json", "time_llm.json", "fingpt.json"]:
        f = T92 / "batch_logs" / sub
        if f.exists():
            d = json.load(open(f))
            model = d.get("model")
            if model and model not in out:
                out[model] = {
                    "status": d.get("status"),
                    "source": f"task92/batch_logs/{sub}",
                    "note": d.get("note", ""),
                }
    return out


def main():
    ts_text = ENS_TS.read_text()
    canonical = extract_all_models(ts_text)
    print(f"Canonical ALL_MODELS: {len(canonical)}")

    t84 = load_t84_metrics()
    wf = load_wf_metrics()
    fm  = load_foundation_metrics()
    t89 = load_t89_metrics()

    print(f"task84 allResults: {len(t84)}")
    print(f"walk_forward_latest models: {len(wf)}")
    print(f"foundation model results: {len(fm)}")
    print(f"task89 batch logs: {len(t89)}")

    # Cross-reference
    rows = []
    n_with_metrics = 0
    n_missing = 0
    for name in canonical:
        alias = NAME_ALIASES.get(name, name)
        # Try direct + alias match in task84
        t84_entry = t84.get(name) or t84.get(alias)
        wf_entry  = wf.get(name) or wf.get(alias)
        fm_entry  = fm.get(name) or fm.get(alias)
        t89_entry = t89.get(name) or t89.get(alias)

        entry = {
            "name": name,
            "alias_used": alias if alias != name else None,
            "in_task84": t84_entry is not None,
            "in_walk_forward": wf_entry is not None,
            "in_foundation_results": fm_entry is not None,
            "in_task89": t89_entry is not None,
            "status": None,
            "metrics_h5d": None,
            "metrics_h10d": None,
            "metrics_h21d": None,
            "source": None,
        }

        if t84_entry:
            entry["status"] = t84_entry.get("status")
            m = t84_entry.get("metrics") or {}
            entry["metrics_h5d"] = m.get("5d")
            entry["metrics_h10d"] = m.get("10d")
            entry["metrics_h21d"] = m.get("21d")
            entry["source"] = "task84_metrics.json"
            n_with_metrics += 1
        elif wf_entry:
            entry["status"] = "trained_oos_evaluated"
            hz = wf_entry.get("horizons", {})
            entry["metrics_h5d"] = hz.get("5")
            entry["metrics_h10d"] = hz.get("10")
            entry["metrics_h21d"] = hz.get("21")
            entry["source"] = "walk_forward_latest.json"
            n_with_metrics += 1
        elif t89_entry:
            entry["status"] = t89_entry.get("status")
            m = t89_entry.get("metrics") or {}
            entry["metrics_h5d"] = m.get("5d")
            entry["metrics_h10d"] = m.get("10d")
            entry["metrics_h21d"] = m.get("21d")
            entry["source"] = "task89/batch_logs"
            n_with_metrics += 1
        elif fm_entry:
            entry["status"] = fm_entry.get("status")
            entry["metrics_h5d"] = fm_entry.get("h5d")
            entry["source"] = fm_entry.get("source")
            n_with_metrics += 1
        else:
            # Document known blockers honestly
            BLOCKED = {
                "PatchTST": ("resource_blocked", "PyTorch transformer — blocked by 4GB RAM CPU-only sandbox (task82 audit)"),
                "Transformer-LSTM": ("resource_blocked", "PyTorch hybrid — blocked by 4GB RAM CPU-only sandbox (task82 audit)"),
            }
            if name in BLOCKED:
                entry["status"], entry["source"] = BLOCKED[name]
                entry["source"] = f"task82_model_registry_audit.json — {entry['source']}"
            else:
                entry["status"] = "metrics_missing"
                entry["source"] = None
                n_missing += 1

        rows.append(entry)

    # Summary stats
    h5_with_dir_acc = [r for r in rows if r["metrics_h5d"] and "directional_accuracy" in (r["metrics_h5d"] or {})]
    h5_dir_accs = [(r["name"], r["metrics_h5d"]["directional_accuracy"]) for r in h5_with_dir_acc]
    h5_dir_accs.sort(key=lambda x: -(x[1] or 0))

    # Count blocked (resource_blocked) separately from missing
    n_blocked = sum(1 for r in rows if r["status"] == "resource_blocked")

    report = {
        "task": "Task 93.3 — Full metric reproduction for all canonical ALL_MODELS",
        "canonical_count": len(canonical),
        "with_metrics_count": n_with_metrics,
        "resource_blocked_count": n_blocked,
        "missing_count": n_missing,
        "coverage_pct": round(n_with_metrics / len(canonical) * 100, 1),
        "blocked_pct": round(n_blocked / len(canonical) * 100, 1),
        "sources": {
            "task84": "data/backtest_reports/task84/task84_metrics.json (60 model entries)",
            "walk_forward_latest": "data/backtest_reports/walk_forward_latest.json (5 trained-ML models, per-horizon OOS)",
            "foundation_task92_93": "data/backtest_reports/task92 + task93 (Chronos, Lag-Llama, Moirai, Time-LLM, FinGPT)",
            "task89_batch_logs": "data/backtest_reports/task89/batch_logs (Kalman Filter — added later)",
        },
        "models": rows,
        "h5d_dir_acc_leaderboard": [
            {"name": n, "dir_acc": da} for n, da in h5_dir_accs[:15]
        ],
        "h5d_dir_acc_tailboard": [
            {"name": n, "dir_acc": da} for n, da in h5_dir_accs[-10:]
        ],
        "notes": [
            "task84_metrics.json is the authoritative per-model OOS metrics source.",
            "walk_forward_latest.json adds per-horizon baselines for the 5 trained-ML models.",
            "Foundation models (Chronos, Lag-Llama) are sourced from task92/task93 expanded evaluations.",
            "Kalman Filter sourced from task89/batch_logs/batch1_fixes.json (added later in pipeline).",
            "PatchTST + Transformer-LSTM remain resource_blocked (PyTorch not available in 4GB CPU sandbox).",
            "X-Tier strategies store TP1-hit rate in the 'directional_accuracy' field — these are precision rates, NOT direction accuracy. Low values (0.03-0.07) reflect rare-trigger strategies with high precision when they fire, NOT poor directional skill.",
        ],
    }
    OUT.write_text(json.dumps(report, indent=2))

    print()
    print("=" * 70)
    print(f"Canonical ALL_MODELS: {len(canonical)}")
    print(f"With metrics        : {n_with_metrics}")
    print(f"Resource blocked    : {n_blocked}")
    print(f"Missing             : {n_missing}")
    print(f"Coverage            : {report['coverage_pct']}% (blocked: {report['blocked_pct']}%)")
    print("=" * 70)
    print("\nResource-blocked models (documented in task82 audit):")
    for r in rows:
        if r["status"] == "resource_blocked":
            print(f"  - {r['name']}")
    print("\nMissing models (truly no metrics anywhere):")
    for r in rows:
        if r["status"] == "metrics_missing":
            print(f"  - {r['name']}")
    print("\nTop 5 by h=5d dir_acc:")
    for n, da in h5_dir_accs[:5]:
        print(f"  {n:35s}  {da}")
    print("\nBottom 5 by h=5d dir_acc:")
    for n, da in h5_dir_accs[-5:]:
        print(f"  {n:35s}  {da}")
    print(f"\nWrote: {OUT}")


if __name__ == "__main__":
    main()
