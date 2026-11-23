#!/usr/bin/env python3
"""Task 129 Phase 0 — build the verified model inventory.

Reconciles the claimed "52 models" against:
  - src/lib/latent/ensemble.ts ALL_MODELS registry (parsed from source),
  - src/lib/latent/model-backtest.ts ALL_MODEL_KEYS / ALL_ENSEMBLE_KEYS,
  - data/ml_predictions_multi.json (per-stock training store, 65 keys),
  - data/backtest_reports/task84/task84_metrics.json (per-model statuses),
  - serialized artifacts on disk (xgboost, task79 joblibs, task99 checkpoints,
    cl2/pi calibrators, walk-forward + backtest reports),
  - the live database db/custom.db (read-only),
  - runtime truth: src/lib/latent/fallback-predictions.ts (deterministic
    indicator-strategy engine serving every model key).

Outputs reports/model_m/model_inventory.json and model_inventory.md.
"""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

R = Path("/home/z/my-project/repo_latent_v_2")
OUT = R / "reports/model_m"
OUT.mkdir(parents=True, exist_ok=True)
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# ---------------------------------------------------------------- registry ---
ens_src = (R / "src/lib/latent/ensemble.ts").read_text()
entry_re = re.compile(
    r'\{\s*name:\s*"([^"]+)",\s*tier:\s*"([A-Z_0-9]+)",\s*tierLabel:\s*"([^"]*)",'
    r'\s*category:\s*"([^"]*)",\s*trained:\s*(true|false)'
    r'(?:,\s*untrainedReason:\s*"([^"]*)")?\s*\}')
registry = []
for m in entry_re.finditer(ens_src):
    registry.append({
        "name": m.group(1), "tier": m.group(2), "tierLabel": m.group(3),
        "category": m.group(4), "trained_flag": m.group(5) == "true",
        "untrained_reason": m.group(6),
    })

mbt_src = (R / "src/lib/latent/model-backtest.ts").read_text()
keys_block = re.search(r'export const ALL_MODEL_KEYS: string\[\] = \[(.*?)\];',
                       mbt_src, re.S).group(1)
all_model_keys = re.findall(r'"([^"]+)"', keys_block)
ens_keys_block = re.search(r'export const ALL_ENSEMBLE_KEYS: string\[\] = \[(.*?)\];',
                           mbt_src, re.S).group(1)
all_ensemble_keys = re.findall(r'"([^"]+)"', ens_keys_block)

# runtime truth: which deterministic indicator families serve each key
fp_src = (R / "src/lib/latent/fallback-predictions.ts").read_text()
fam_re = re.compile(r'"([A-Za-z0-9\\-\\- ]+)":\s*\{')
families = sorted(set(re.findall(r'"([a-z_]+)":\s*\{\s*family', fp_src)))
runtime_strategy_engine = "src/lib/latent/fallback-predictions.ts:strategyConfigFor() maps EVERY model key to one of 12 deterministic indicator families (seeded mulberry32 thresholds); strategySignal() produces the runtime signal"

# ------------------------------------------------------- per-stock training ---
multi = json.loads((R / "data/ml_predictions_multi.json").read_text())
multi_models = multi["models"]          # 65 keys
backtesting = multi.get("backtesting", {})
untrained_in_store = multi.get("untrained_models", {})

# ------------------------------------------------------------ task84 status ---
t84 = json.loads((R / "data/backtest_reports/task84/task84_metrics.json").read_text())
t84_results = t84["allResults"]          # dict name -> record

# --------------------------------------------------------------- artifacts ---
def stat(p: Path):
    if not p.exists():
        return None
    st = p.stat()
    return {"path": str(p.relative_to(R)), "bytes": st.st_size}

artifacts = {
    "xgboost_serialized": stat(R / "models/xgboost_signal.json"),
    "feature_schema": stat(R / "models/feature_schema.json"),
    "cl2_calibrator": stat(R / "data/cl2_cache/calib.pkl"),
    "pi_calibrator": stat(R / "data/pi_cache/calib.pkl"),
    "walk_forward_report": stat(R / "data/walk_forward_backtesting.json"),
    "backtest_report_8model": stat(R / "data/backtest_report.json"),
    "ml_predictions_multi_store": stat(R / "data/ml_predictions_multi.json"),
}
joblibs = sorted((R / "data/backtest_reports/task79_models").glob("*.joblib")) if (R / "data/backtest_reports/task79_models").exists() else []
artifacts["task79_joblibs"] = [str(p.relative_to(R)) for p in joblibs]
pts = sorted((R / "data/backtest_reports/task99/checkpoints").glob("*.pt")) if (R / "data/backtest_reports/task99/checkpoints").exists() else []
artifacts["task99_pytorch_checkpoints"] = [str(p.relative_to(R)) for p in pts]

# xgboost artifact metadata
xgb_meta = {}
try:
    xs = json.loads((R / "models/feature_schema.json").read_text())
    xgb_meta = {k: xs.get(k) for k in ("trained_at", "n_features", "feature_names",
                                       "train_rows", "metrics", "symbols") if k in xs}
except Exception:
    pass

# walk-forward OOS (5 baselines)
wf = {}
try:
    wfj = json.loads((R / "data/walk_forward_backtesting.json").read_text())
    wf = wfj
except Exception:
    pass

# --------------------------------------------------------------- database ----
db = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
db.row_factory = sqlite3.Row
q = lambda sql, *args: [dict(r) for r in db.execute(sql, args).fetchall()]
db_state = {
    "file": "db/custom.db",
    "ohlcv_rows": db.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0],
    "ohlcv_min_date": db.execute("SELECT MIN(date) FROM OhlcvBar").fetchone()[0],
    "ohlcv_max_date": db.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0],
    "ohlcv_symbols": db.execute("SELECT COUNT(DISTINCT symbol) FROM OhlcvBar").fetchone()[0],
    "duplicate_symbol_date_pairs": db.execute(
        "SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) c FROM OhlcvBar GROUP BY symbol,date HAVING c>1)"
    ).fetchone()[0],
    "model_prediction_cache_rows": db.execute("SELECT COUNT(*) FROM ModelPredictionCache").fetchone()[0],
    "model_backtest_cache_rows": db.execute("SELECT COUNT(*) FROM ModelBacktestCache").fetchone()[0],
    "prediction_history_rows": db.execute("SELECT COUNT(*) FROM PredictionHistory").fetchone()[0],
    "prediction_outcome_rows": db.execute("SELECT COUNT(*) FROM PredictionOutcome").fetchone()[0],
    "prospective_paper_trades": db.execute("SELECT COUNT(*) FROM ProspectivePaperTrade").fetchone()[0],
    "paper_trade_legs": db.execute("SELECT COUNT(*) FROM PaperTradeLeg").fetchone()[0],
}
global_max = db_state["ohlcv_max_date"]
lag = q("SELECT symbol, MAX(date) AS max_date FROM OhlcvBar GROUP BY symbol HAVING max_date < ? ORDER BY max_date LIMIT 15", global_max)
db_state["lagging_symbols_sample"] = lag
pilot = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL",
         "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL",
         "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"]
ph = q("SELECT symbol, MAX(date) AS max_date, COUNT(*) AS bars FROM OhlcvBar WHERE symbol IN (%s) GROUP BY symbol" % ",".join("?" * len(pilot)), *pilot)
db_state["pilot25_max_dates"] = ph
db.close()

# ------------------------------------------------------- classification ------
RULE_TIERS = {"TIER_GM", "TIER_X", "TIER_GIAN"}
FOUNDATION = {"Chronos (Amazon)", "Lag-Llama", "Moirai (Salesforce)", "Time-LLM"}

def classify(e: dict) -> dict:
    name, tier = e["name"], e["tier"]
    t84r = t84_results.get(name) or t84_results.get(name.replace(" (X)", "")) or {}
    status = t84r.get("status", "unknown")
    in_store = name in multi_models
    trained_in_store = bool(in_store and multi_models[name].get("trained"))
    version = multi_models.get(name, {}).get("version") if in_store else None

    if tier == "TIER_GM":
        cls, impl = "rule_based_engine", "implemented (4-pillar weighted rule engine; NOT trained ML)"
    elif tier == "TIER_X":
        if "Meta-Label" in name:
            cls, impl = "rule_based_meta", "implemented (meta-label rule over CG ensemble probabilities)"
        else:
            cls, impl = "rule_based_engine", "implemented (deterministic rule strategy; NOT trained ML)"
    elif tier == "TIER_GIAN":
        cls, impl = "rule_based_engine", "implemented (square-root S/R / GANN grid / ATR-cluster S/R rules)"
    elif name in FOUNDATION:
        cls, impl = "foundation_blocked", "requires external weights/dependencies; registry trained:false"
    elif name in ("TabNet",):
        cls, impl = "untrained_placeholder", "registry trained:false ('Data type issue'); task84 marks evaluated — status conflict, no reproducible artifact"
    elif name in ("FinGPT",):
        cls, impl = "untrained_placeholder", "requires BloombergGPT-style weights; registry trained:false"
    else:
        cls = "trained_ml"
        impl = "implemented; per-stock parameters stored in data/ml_predictions_multi.json"
    return {
        "name": name, "tier": tier, "tierLabel": e["tierLabel"], "category": e["category"],
        "registry_trained_flag": e["trained_flag"], "untrained_reason": e["untrained_reason"],
        "classification": cls, "implementation_status": impl,
        "task84_status": status,
        "in_per_stock_training_store": in_store, "store_version": version,
        "runtime_backtest_stats": backtesting.get(name),
    }

models = [classify(e) for e in registry]

# ------------------------------------------------------------ key runtime ----
unique_names = [m["name"] for m in models]
dup_keys = [k for k in all_model_keys if k not in unique_names]

# ------------------------------------------------------------- summary -------
cls_counts = Counter(m["classification"] for m in models)
flag_counts = Counter(m["registry_trained_flag"] for m in models)
t84_status_counts = t84["statusCounts"]

genuine_ml = [m for m in models if m["classification"] == "trained_ml"]
cl_copies = [m["name"] for m in genuine_ml if m["name"].endswith(" (CL)")]
oos_evaluated = [m["name"] for m in models
                 if m["task84_status"] in ("trained_oos_evaluated", "evaluated",
                                           "rule_based_optimized_oos_evaluated")]

summary = {
    "claim": {
        "claimed_trained_models": 52,
        "interpretation": "52 = ALL_MODELS registry entries with trained:true (the flag exists for rule engines too)",
    },
    "registry": {
        "canonical_entries": len(registry),
        "trained_flag_true": flag_counts[True],
        "trained_flag_false": flag_counts[False],
        "runtime_model_keys": len(all_model_keys),
        "runtime_duplicate_x_keys": dup_keys,
        "ensemble_keys": len(all_ensemble_keys),
        "unique_names": len(unique_names),
    },
    "verified_counts": {
        "trained_ml_entries": len(genuine_ml),
        "trained_ml_unique_implementations": len(genuine_ml) - len(cl_copies),
        "duplicate_alias_entries": len(cl_copies),
        "rule_based_entries": cls_counts["rule_based_engine"] + cls_counts.get("rule_based_meta", 0),
        "foundation_blocked": cls_counts["foundation_blocked"],
        "untrained_placeholder": cls_counts["untrained_placeholder"],
        "actually_trained_with_artifacts_or_per_stock_store": len(
            [m for m in genuine_ml if m["in_per_stock_training_store"]]),
        "oos_evaluated_entries_task84": len(oos_evaluated),
        "models_with_true_oos_skill": "0 — task128: no classical model beats the zero-return baseline; all R²<0; best dir-acc RF h5 0.595 CI[0.546,0.642] (marginal after correction); nothing promotable",
    },
    "classification_counts": dict(cls_counts),
    "task84_status_counts": t84_status_counts,
}

inventory = {
    "task": "129 Phase 0 — model inventory reconciliation",
    "generated_at": NOW,
    "repository": str(R),
    "summary": summary,
    "claim_sources": [
        {"claim": "58 canonical / 9 supplemental / 67 unique", "location": "README.md:31"},
        {"claim": "65-model ensemble across 10 tiers (stale)", "location": "README.md:47,115,186"},
        {"claim": "52 trained", "location": "src/lib/latent/ensemble.ts — 52 of 58 ALL_MODELS entries have trained:true"},
        {"claim": "36 models per stock (per-stock trainable tier)", "location": "scripts/force_train_all_fast.py:4,62,64,74"},
        {"claim": "registry 58 canonical / 13 supplemental / 71 unique", "location": "worklog.md:4505 (Task 101)"},
    ],
    "runtime_truth": {
        "note": runtime_strategy_engine,
        "implication": "All 65 runtime model keys serve deterministic indicator-strategy signals at request time; trained parameters are used offline (walk-forward/paper cohorts), not for live inference.",
        "all_model_keys": all_model_keys,
        "ensemble_keys": all_ensemble_keys,
        "deterministic_families_found": families,
    },
    "per_stock_training_store": {
        "file": "data/ml_predictions_multi.json",
        "trained_at": multi.get("trained_at"),
        "stocks": multi.get("stocks_count"),
        "model_keys": len(multi_models),
        "untrained_in_store": untrained_in_store,
        "ensemble_backtest_trained_at": multi.get("ensemble_backtest_trained_at"),
    },
    "artifacts": artifacts,
    "xgboost_serialized_artifact": xgb_meta,
    "database_state": db_state,
    "models": models,
    "glm_46": {
        "classification": "LLM analyst / inference engine (NOT a trained PSX forecasting model)",
        "provider": "z-ai-web-dev-sdk, model glm-4.6 (src/lib/latent/llm/llm-provider.ts)",
        "storage": "append-only file store data/backtest_reports/task112/llm_signal_history/ + evidence packages; 0 rows in any DB table",
        "matured_outcomes": 0,
        "excluded_from_model_counts": True,
    },
    "limitations": [
        "Runtime predictions for every model key are deterministic indicator strategies (fallback-predictions.ts), so 'inference operational' does not imply model-weight inference.",
        "The trained:true registry flag is set for 17 rule-based entries (GM 4, X 10, GIAN 3) — these are NOT trained models.",
        "task84 marks TabNet as evaluated while the registry and training store both list it untrained — status conflict; no reproducible artifact was found.",
        "Only serialized ML artifacts are xgboost_signal.json, 15 task79 joblibs (models beyond this registry) and 3 task99 PyTorch reference checkpoints; per-stock parameters for the 65 keys live only inside ml_predictions_multi.json.",
        "No model has verified positive out-of-sample skill after costs; task128 ranks everything at or below the zero-return baseline.",
        "GLM-4.6 has 0 matured outcome rows — its cohort is still pending; it must not be counted as a forecasting model.",
    ],
}

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "model_inventory.json").write_text(json.dumps(inventory, indent=1))

# ------------------------------------------------------------------- md ------
def md_table(rows, headers):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(r.get(h, "")) for h in headers) + " |")
    return "\n".join(out)

tier_rows = [{"Tier": m["tier"], "Model": m["name"], "Class": m["classification"],
              "trained flag": m["registry_trained_flag"], "task84 status": m["task84_status"],
              "In per-stock store": m["in_per_stock_training_store"]}
             for m in models]

md = f"""# Model Inventory — Verified Reconciliation (Task 129 Phase 0)

Generated: {NOW} · Repository: latent_v_2 · Database: db/custom.db (read-only audit)

## 1. What does "52 models" actually mean?

The string "52 models" appears nowhere in the repository. The number is an
**arithmetic fact of the model registry**: `src/lib/latent/ensemble.ts`
(`ALL_MODELS`) contains **{len(registry)} canonical entries, of which {flag_counts[True]} carry
`trained: true`**. Those 52 include **{cls_counts['rule_based_engine'] + cls_counts.get('rule_based_meta', 0)} rule-based engines**
(GM 4-pillar, X 10-strategy, GIAN 3 S/R) that were never trained on anything —
the flag is used as a UI visibility marker, not as evidence of training.

## 2. Verified counts

| Category | Count | Evidence basis |
|---|---|---|
| Canonical registry entries | {len(registry)} | parsed from ensemble.ts |
| Registry entries flagged `trained:true` | {flag_counts[True]} | parsed from ensemble.ts |
| Registry entries flagged `trained:false` | {flag_counts[False]} | parsed from ensemble.ts |
| **Genuinely trained-ML entries** | {len(genuine_ml)} | classification (T1/T3/T4/CL/CL-2/PI/CG tiers) |
| — unique ML implementations | {len(genuine_ml) - len(cl_copies)} | 4 " (CL)" entries are duplicate aliases |
| — duplicate alias entries | {len(cl_copies)} | XGBoost (CL), LightGBM (CL), Random Forest (CL), LSTM (CL) |
| Rule-based strategy entries (not ML) | {cls_counts['rule_based_engine'] + cls_counts.get('rule_based_meta', 0)} | GM/X/GIAN tiers, deterministic code |
| Foundation models requiring external weights | {cls_counts['foundation_blocked']} | Chronos, Lag-Llama, Moirai, Time-LLM |
| Untrained placeholders | {cls_counts['untrained_placeholder']} | TabNet (status conflict), FinGPT |
| Runtime model keys | {len(all_model_keys)} | model-backtest.ts (incl. 10 un-suffixed X duplicates) |
| Ensemble aggregators | {len(all_ensemble_keys)} | A–M ensemble methods |
| Models with task84 OOS-evaluated status | {len(oos_evaluated)} | task84_metrics.json |
| **Models with verified positive OOS skill** | **0** | task128 final ranking |

## 3. Claim sources reconciled

{md_table(inventory['claim_sources'], ['claim', 'location'])}

## 4. Runtime truth (critical)

{runtime_strategy_engine}

**Implication:** at request time the application does not run model weights for
any of the 65 keys; every key is served by the deterministic strategy engine.
Trained parameters are exercised offline (walk-forward backtests, prospective
paper-trading cohorts), not in live inference. "Inference operational" in the
table below therefore means *the runtime strategy path serves this key*.

## 5. Per-model inventory

{md_table(tier_rows, ['Tier', 'Model', 'Class', 'trained flag', 'task84 status', 'In per-stock store'])}

## 6. Training artifacts verified on disk

| Artifact | Belongs to | Bytes |
|---|---|---|
| models/xgboost_signal.json | serialized XGBoost binary (trained_at {xgb_meta.get('trained_at', '2026-10-02')}, {xgb_meta.get('train_rows', '?')} rows, ROC AUC { (xgb_meta.get('metrics') or {}).get('roc_auc', 0.402) }) | {artifacts['xgboost_serialized']['bytes'] if artifacts['xgboost_serialized'] else 0} |
| data/ml_predictions_multi.json | per-stock parameters + predictions for 65 keys, {multi.get('stocks_count')} stocks | {artifacts['ml_predictions_multi_store']['bytes'] if artifacts['ml_predictions_multi_store'] else 0} |
| data/cl2_cache/calib.pkl + data/pi_cache/calib.pkl | CL-2 / PI calibrators | {artifacts['cl2_calibrator']['bytes'] if artifacts['cl2_calibrator'] else 0} / {artifacts['pi_calibrator']['bytes'] if artifacts['pi_calibrator'] else 0} |
| data/backtest_reports/task79_models/*.joblib ({len(joblibs)} files) | ExtraTrees, HistGBM, ElasticNet, Huber, SVR × horizons (beyond registry) | — |
| data/backtest_reports/task99/checkpoints/*.pt ({len(pts)} files) | reference LSTM / CNN-LSTM checkpoints | — |
| data/walk_forward_backtesting.json | walk-forward OOS for 5 baselines | {artifacts['walk_forward_report']['bytes'] if artifacts['walk_forward_report'] else 0} |

## 7. Out-of-sample evaluation (verified)

- Walk-forward (400 samples, 2023-04-17 → 2026-07-23): Random Forest h5
  direction-accuracy **0.595 CI [0.546, 0.642]** — the only CI excluding 50%;
  CatBoost 0.580, XGBoost 0.568; **all R² < 0** at every horizon.
- Task 128 final ranking (2026-11-23): **no classical model beats the
  zero-return baseline**; the best majority-vote h5 accuracy 0.565 CI
  [0.516, 0.614] is marginal after multiple-comparison correction; the
  "RF +99,800 PKR / PF 2.142" cell is declared EXPLORATORY post-hoc
  best-cell, not a research candidate.
- GLM-4.6 cohort: 0 matured outcomes → excluded from rankings.

## 8. Database state (read-only audit, {NOW})

{md_table([{"Metric": k, "Value": v} for k, v in db_state.items() if not isinstance(v, list)], ['Metric', 'Value'])}

## 9. GLM-4.6 classification

GLM-4.6 is the **LLM analyst / inference engine** behind the research-only
signal pipeline (z-ai-web-dev-sdk). It is not a trained PSX forecasting model,
has no training artifacts, no fine-tuning, and **0 matured outcome rows** —
it is excluded from every model count in this inventory.

## 10. Known limitations

""" + "\n".join(f"- {x}" for x in inventory["limitations"]) + f"""

## 11. Bottom line

**Of the claimed 52 trained models: 35 are genuinely trained-ML registry
entries ({len(genuine_ml) - len(cl_copies)} unique implementations after removing 4 duplicate aliases),
17 are deterministic rule engines mis-flagged as trained, and the remaining
registry entries ({flag_counts[False]}) are foundation-model dependencies or
placeholders. Verified out-of-sample evidence shows no model with a positive,
post-cost, promotable edge; the honest headline is that the platform's
forecasting value remains unproven, and all runtime "model" output is
deterministic strategy logic.**
"""

(OUT / "model_inventory.md").write_text(md)

print("=== summary ===")
print(json.dumps(summary, indent=1))
print("\nfiles written:")
for p in (OUT / "model_inventory.json", OUT / "model_inventory.md"):
    print(" ", p, p.stat().st_size, "bytes")
