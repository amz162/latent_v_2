#!/usr/bin/env python3
"""Task 94 Phase 1 — Git + Registry Reconciliation + Execution Plan.

Reconciles:
  - ALL_MODELS canonical list (from src/lib/latent/ensemble.ts)
  - Task 84 allResults (60 supplemental/metrics entries)
  - Task 82 model_registry_audit (58 canonical with statuses)
  - Walk-forward latest (5 trained-ML models)
  - Foundation model results (task92/task93)
  - Task 84 registry reconciliation (49 in_both, 9 registry_only, 11 task83_supplemental)

Generates:
  - task94_registry_initial.json
  - task94_registry_reconciliation.json
  - task94_execution_plan.json
"""
import json, re, subprocess
from pathlib import Path
from collections import defaultdict

ROOT = Path("/home/z/my-project")
ENS_TS = ROOT / "src/lib/latent/ensemble.ts"
T84 = ROOT / "data/backtest_reports/task84/task84_metrics.json"
T82 = ROOT / "data/backtest_reports/task82_model_registry_audit.json"
T84_RECON = ROOT / "data/backtest_reports/task84/task84_registry_reconciliation.json"
WF = ROOT / "data/backtest_reports/walk_forward_latest.json"
T92 = ROOT / "data/backtest_reports/task92"
T93 = ROOT / "data/backtest_reports/task93"
OUT = ROOT / "data/backtest_reports/task94"


def git_head():
    return subprocess.check_output(
        ["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True
    ).strip()


def git_origin_main():
    try:
        return subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "origin/main"], text=True
        ).strip()
    except Exception:
        return None


def extract_all_models(ts_text):
    i = ts_text.find("export const ALL_MODELS")
    if i < 0: return []
    j = ts_text.find("];", i)
    if j < 0: return []
    body = ts_text[i:j]
    # Each entry: { name: "...", tier: "...", ... }
    names = []
    tiers = []
    cats = []
    trained_flags = []
    untrained_reasons = []
    for entry_match in re.finditer(r'\{\s*name:\s*"([^"]+)"[^}]*\}', body):
        entry = entry_match.group(0)
        name = entry_match.group(1)
        tier_m = re.search(r'tier:\s*"([^"]+)"', entry)
        cat_m = re.search(r'category:\s*"([^"]+)"', entry)
        trained_m = re.search(r'trained:\s*(true|false)', entry)
        reason_m = re.search(r'untrainedReason:\s*"([^"]+)"', entry)
        names.append(name)
        tiers.append(tier_m.group(1) if tier_m else None)
        cats.append(cat_m.group(1) if cat_m else None)
        trained_flags.append(trained_m.group(1) == "true" if trained_m else None)
        untrained_reasons.append(reason_m.group(1) if reason_m else None)
    return names, tiers, cats, trained_flags, untrained_reasons


def load_json(p):
    try: return json.load(open(p))
    except Exception: return None


def main():
    head = git_head()
    origin = git_origin_main()
    ts_text = ENS_TS.read_text()
    names, tiers, cats, trained_flags, reasons = extract_all_models(ts_text)

    t84 = load_json(T84) or {}
    t82 = load_json(T82) or {}
    t84_recon = load_json(T84_RECON) or {}
    wf = load_json(WF) or {}
    t84_all = t84.get("allResults", {}) or {}

    # Walk-forward model set
    wf_models = {m["name"]: m for m in (wf.get("models") or [])}

    # Foundation model results from task92/task93
    foundation_results = {}
    for sub in ["chronos.json", "lag_llama.json", "moirai.json", "time_llm.json", "fingpt.json"]:
        f = T92 / "batch_logs" / sub
        if f.exists():
            d = load_json(f)
            if d and "model" in d:
                foundation_results[d["model"]] = {"source": f"task92/batch_logs/{sub}", **d}
    # task93 newer chronos/lag_llama overrides
    for sub in ["task93_chronos_results.json", "task93_lag_llama_results.json"]:
        f = T93 / sub
        if f.exists():
            d = load_json(f)
            if d and "model" in d:
                foundation_results[d["model"]] = {"source": f"task93/{sub}", **d}

    # Task 82 audit statuses
    t82_audit = {m["name"]: m for m in (t82.get("models") or [])}

    # Build canonical list with cross-references
    NAME_ALIASES = {
        "Kalman Filter": "Kalman",
        "Logistic Regression (PI)": "Logistic (PI)",
    }
    canonical = []
    for i, name in enumerate(names):
        alias = NAME_ALIASES.get(name, name)
        t84_entry = t84_all.get(name) or t84_all.get(alias)
        wf_entry = wf_models.get(name) or wf_models.get(alias)
        foundation_entry = foundation_results.get(name)
        audit_entry = t82_audit.get(name)
        canonical.append({
            "name": name,
            "tier": tiers[i],
            "category": cats[i],
            "registry_trained_flag": trained_flags[i],
            "registry_untrained_reason": reasons[i],
            "alias_used": alias if alias != name else None,
            "in_task84_allResults": t84_entry is not None,
            "in_walk_forward_latest": wf_entry is not None,
            "in_foundation_results": foundation_entry is not None,
            "in_task82_audit": audit_entry is not None,
            "task82_final_status": audit_entry.get("finalStatus") if audit_entry else None,
            "task82_status_reason": audit_entry.get("statusReason") if audit_entry else None,
            "task84_status": t84_entry.get("status") if t84_entry else None,
            "foundation_status": foundation_entry.get("status") if foundation_entry else None,
        })

    # Compute supplemental models (in task84 but not in canonical ALL_MODELS)
    canonical_names = set(names) | set(NAME_ALIASES.values())
    supplemental = []
    for k, v in t84_all.items():
        if k not in canonical_names:
            supplemental.append({
                "name": k,
                "status": v.get("status"),
                "in_walk_forward_latest": k in wf_models,
                "metrics_present": "metrics" in v,
            })

    # Counts
    n_canonical = len(canonical)
    n_supplemental = len(supplemental)
    # Ensembles — count distinct aggregators in task84 with 'Vote'/'Weighted'/'Ensemble'/'Consensus'/'Meta' in name
    ensemble_keywords = ("Vote", "Weighted", "Consensus", "Ensemble", "Extender", "Meta-Label")
    ensembles_in_canonical = [c for c in canonical if any(kw in c["name"] for kw in ensemble_keywords)]
    ensembles_in_supplemental = [s for s in supplemental if any(kw in s["name"] for kw in ensemble_keywords)]
    n_ensembles = len(ensembles_in_canonical) + len(ensembles_in_supplemental)
    # Trained base ML models (exclude rule-based + ensembles + foundation models)
    rule_keywords = ("GM", "X)", "GIAN", "M-Ensemble")
    foundation_names = {"Chronos (Amazon)", "Lag-Llama", "Moirai (Salesforce)", "Time-LLM", "FinGPT"}
    base_ml_models = []
    for c in canonical:
        if any(kw in c["name"] for kw in ensemble_keywords): continue
        if any(kw in c["name"] for kw in rule_keywords): continue
        if c["name"] in foundation_names: continue
        base_ml_models.append(c)
    n_base_ml = len(base_ml_models)

    # Registry initial snapshot
    registry_initial = {
        "task": "Task 94 Phase 1 — Registry Initial Snapshot",
        "git_head_at_start": head,
        "git_origin_main_at_start": origin,
        "canonical_count": n_canonical,
        "supplemental_count": n_supplemental,
        "ensemble_total": n_ensembles,
        "base_ml_models_count": n_base_ml,
        "foundation_model_count": len(foundation_names),
        "rule_based_count": n_canonical - n_base_ml - n_ensembles - len(foundation_names),
        "tiers_present": sorted(set(t for t in tiers if t)),
        "canonical_models": [c["name"] for c in canonical],
        "supplemental_models": [s["name"] for s in supplemental],
    }

    # Registry reconciliation
    registry_recon = {
        "task": "Task 94 Phase 1 — Registry Reconciliation",
        "git_head": head,
        "canonical_count": n_canonical,
        "supplemental_count": n_supplemental,
        "total_unique_implementations": n_canonical + n_supplemental,
        "ensemble_total_in_registry_and_supplemental": n_ensembles,
        "base_ml_unique_count": n_base_ml,
        "task84_reconciliation_reference": {
            "registry_count": t84_recon.get("registry_count"),
            "task83_count": t84_recon.get("task83_count"),
            "in_both": t84_recon.get("in_both"),
            "registry_only_count": len(t84_recon.get("registry_only", [])),
            "task83_supplemental_count": len(t84_recon.get("task83_supplemental", [])),
        },
        "alias_resolutions": NAME_ALIASES,
        "double_count_risks_addressed": [
            "Aliases resolved: 'Kalman Filter' → 'Kalman', 'Logistic Regression (PI)' → 'Logistic (PI)'",
            "Ensembles counted as aggregators (not base ML): " + ", ".join([c["name"] for c in ensembles_in_canonical]),
            "Rule-based components (GM/X/GIAN/M-Ensemble) excluded from base_ml count",
            "Foundation models counted separately (Chronos, Lag-Llama, Moirai, Time-LLM, FinGPT)",
            "Horizons and symbols NOT counted as separate models",
        ],
        "canonical_full": canonical,
        "supplemental_full": supplemental,
        "ensemble_models": [c["name"] for c in ensembles_in_canonical] + [s["name"] for s in ensembles_in_supplemental],
        "base_ml_models": [c["name"] for c in base_ml_models],
        "foundation_models_in_registry": sorted(foundation_names & set(names)),
        "rule_based_models": [c["name"] for c in canonical if any(kw in c["name"] for kw in rule_keywords)],
    }

    # Execution plan for Phases 2-12
    execution_plan = {
        "task": "Task 94 Phase 1 — Execution Plan",
        "git_head_at_start": head,
        "budget_seconds_per_call": 150,
        "phases": [
            {"phase": 1, "name": "Git/registry reconciliation + execution plan + runner scaffold", "status": "in_progress", "jobs": ["registry_initial", "registry_reconciliation", "execution_plan"]},
            {"phase": 2, "name": "PatchTST + Transformer-LSTM recovery + all-model metric reproduction", "status": "pending", "jobs": ["patchtst_recovery", "transformer_lstm_recovery", "metric_reproduction_all"]},
            {"phase": 3, "name": "Foundation models: Moirai, Lag-Llama, Chronos, Time-LLM, FinGPT", "status": "pending", "jobs": ["moirai_official_inference", "lag_llama_expand", "chronos_expand", "time_llm_official", "fingpt_official"]},
            {"phase": 4, "name": "Ensemble verification + Majority Vote robustness", "status": "pending", "jobs": ["ensemble_validation_all", "majority_vote_robustness"]},
            {"phase": 5, "name": "Cost-aware strategy profitability + Variant B validation", "status": "pending", "jobs": ["cost_reconciliation", "variant_b_independent_validation"]},
            {"phase": 6, "name": "Prospective paper-trade engine + 114 pending records", "status": "pending", "jobs": ["prospective_processor", "prospective_monitoring"]},
            {"phase": 7, "name": "GM data/announcements/fundamentals/macro provenance", "status": "pending", "jobs": ["gm_data_provenance", "macro_data_status"]},
            {"phase": 8, "name": "Full walk-forward + per-stock evaluation", "status": "pending", "jobs": ["walk_forward_expansion", "per_stock_evaluation"]},
            {"phase": 9, "name": "Backend API + registry integrity", "status": "pending", "jobs": ["api_validation", "registry_route_check"]},
            {"phase": 10, "name": "Dashboard maintenance + evidence updates", "status": "pending", "jobs": ["dashboard_status_update"]},
            {"phase": 11, "name": "Browser/API/production verification", "status": "pending", "jobs": ["browser_tests", "github_actions_check"]},
            {"phase": 12, "name": "Tests/performance/build/final validation + push", "status": "pending", "jobs": ["lint", "typecheck", "build_smoke", "final_push"]},
        ],
        "checkpoint_resume_strategy": [
            "Each phase saves progress.json with completed jobs",
            "Failed jobs recorded with cause + retry plan",
            "Resumable jobs use incremental processing",
            "Heavy models split into per-symbol/per-date chunks ≤150s each",
            "One failed model never stops remaining jobs",
        ],
        "iron_rules_preserved": [
            "No fabrication of predictions/signals/fills/prices",
            "No modification of protected Task 81-93 artifacts",
            "No force-push or reset/rebase",
            "No mislabeling of experimental vs official foundation models",
            "No claims of statistical significance without sufficient matured evidence",
            "ACTIVE is operational status, NOT proof of skill",
            "Preserve webpack/OOM fix (NODE_OPTIONS=--max-old-space-size=1024)",
        ],
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "task94_registry_initial.json").write_text(json.dumps(registry_initial, indent=2))
    (OUT / "task94_registry_reconciliation.json").write_text(json.dumps(registry_recon, indent=2))
    (OUT / "task94_execution_plan.json").write_text(json.dumps(execution_plan, indent=2))

    print("=" * 70)
    print("TASK 94 PHASE 1 — REGISTRY RECONCILIATION")
    print("=" * 70)
    print(f"\nGit HEAD:           {head[:10]}")
    print(f"Git origin/main:    {(origin or 'unknown')[:10]}")
    print(f"\nCanonical ALL_MODELS:    {n_canonical}")
    print(f"Supplemental entries:    {n_supplemental}")
    print(f"Total unique impls:      {n_canonical + n_supplemental}")
    print(f"Base ML models:          {n_base_ml}")
    print(f"Ensembles:               {n_ensembles}")
    print(f"Foundation models:       {len(foundation_names)}")
    print(f"Rule-based components:   {n_canonical - n_base_ml - n_ensembles - len(foundation_names)}")
    print(f"\nAlias resolutions: {NAME_ALIASES}")
    print(f"\nOutputs written:")
    for f in ["task94_registry_initial.json", "task94_registry_reconciliation.json", "task94_execution_plan.json"]:
        p = OUT / f
        print(f"  {p} ({p.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
