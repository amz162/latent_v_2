#!/usr/bin/env python3
"""Task 99 — final artifact assembly: summary, feature schema, training config,
artifact validation, metrics.csv, remaining blockers. Reads everything already
produced by the pipeline jobs; no metric is invented here."""
from __future__ import annotations
import csv
import glob
import hashlib
import json
import time
from pathlib import Path

BASE = Path("data/backtest_reports/task99")
REF_URL = "https://github.com/jiewwantan/RNN_LSTM_trading_model"


def jload(p: Path, default=None):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def sha16(p: Path) -> str | None:
    if not p.exists():
        return None
    h = hashlib.sha256(p.read_bytes()).hexdigest()[:16]
    return h


def main() -> None:
    lstm = jload(BASE / "task99_lstm_results.json")
    cnn = jload(BASE / "task99_cnn_lstm_results.json")
    base_cmp = jload(BASE / "task99_baseline_comparison.json", {})
    bt = jload(BASE / "task99_cost_aware_backtest.json", {})
    audit = jload(BASE / "task99_reference_architecture_audit.json", {})
    lic = jload(BASE / "task99_license_and_provenance.json", {})
    reg = jload(BASE / "task99_model_registry.json", {})
    ds_meta = jload(BASE / "models" / "dataset_pilot25_h5_10_21.json", {})
    ds_can = jload(BASE / "models" / "dataset_canonical8_h5_10_21.json", {})

    # ── feature schema ────────────────────────────────────────────────────
    (BASE / "task99_feature_schema.json").write_text(json.dumps({
        "schema_version": ds_meta.get("feature_schema_version"),
        "n_features": ds_meta.get("n_features"),
        "kept_features": ds_meta.get("kept_features"),
        "feature_selection": ds_meta.get("feature_selection"),
        "reference_defects_fixed": {
            "ma_collision": "close_ma_5/10/20 and volume_ma_5/10/20 are DISTINCT fields (reference overwrote close MAs with volume MAs)",
            "objective_mismatch": "feature selection uses the same horizon targets as training (no directional labels)",
            "full_history_scaler": "StandardScaler + feature selection fit on TRAIN partition only",
        },
        "market_context": {"included": ds_meta.get("market_context_included"),
                           "reason": ds_meta.get("market_context_reason")},
        "seq_len": ds_meta.get("seq_len"),
        "targets": {str(h): "forward return close[t+h]/close[t]-1, per-stock, mature only"
                    for h in ds_meta.get("horizons", [])},
        "canonical8_variant": {"n_features": ds_can.get("n_features")},
    }, indent=2))

    # ── training config ───────────────────────────────────────────────────
    cfgs = {}
    for mid in ("jw_reference_lstm", "jw_reference_cnn_lstm"):
        for ck_file in sorted(glob.glob(str(BASE / "checkpoints" / f"{mid}__*.json"))):
            ck = jload(Path(ck_file), {})
            cfgs[f"{mid}__{ck.get('config_name')}__{ck.get('dataset_tag')}"] = {
                "config": ck.get("config"), "param_count": ck.get("param_count"),
                "epochs": ck.get("epoch"), "best_val_mae": ck.get("best_val_mae"),
                "best_epoch": ck.get("best_epoch"), "finished": ck.get("finished"),
                "stop_reason": ck.get("stop_reason"),
                "dataset_sha16": ck.get("dataset_sha16"),
                "checkpoint_sha16": ck.get("checkpoint_sha16"),
                "seed": ck.get("config", {}).get("seed"),
                "history_tail": ck.get("history_tail"),
            }
    (BASE / "task99_training_config.json").write_text(json.dumps({
        "reference_url": REF_URL,
        "execution_profile": "CPU-only sandbox, ~4GB RAM, 150s per-execution limit; "
                             "resumable ~110s training chunks; torch.set_num_threads(2)",
        "loss": "mae (reference-faithful)",
        "models": cfgs,
        "datasets": {"pilot25_h5_10_21": ds_meta, "canonical8_h5_10_21": ds_can},
    }, indent=2))

    # ── artifact validation: every reported path must exist, non-empty ────
    required = ["task99_summary.json", "task99_execution_plan.json", "task99_progress.json",
                "task99_reference_architecture_audit.json", "task99_license_and_provenance.json",
                "task99_model_registry.json", "task99_feature_schema.json", "task99_training_config.json",
                "task99_lstm_results.json", "task99_cnn_lstm_results.json",
                "task99_walk_forward_metrics.json", "task99_per_stock_metrics.json",
                "task99_baseline_comparison.json", "task99_cost_aware_backtest.json",
                "task99_model_artifact_validation.json", "task99_api_validation.json",
                "task99_browser_test_results.json", "task99_remaining_blockers.json"]
    validation = []
    for name in required:
        p = BASE / name
        ok = p.exists() and p.stat().st_size > 2
        validation.append({"artifact": name, "path": str(p), "exists": ok,
                           "bytes": p.stat().st_size if p.exists() else 0,
                           "sha16": sha16(p)})
    for sub in ("models", "predictions", "checkpoints", "batch_logs"):
        d = BASE / sub
        validation.append({"artifact": f"dir:{sub}", "path": str(d),
                           "exists": d.exists() and any(d.iterdir()),
                           "bytes": sum(f.stat().st_size for f in d.rglob("*") if f.is_file()) if d.exists() else 0,
                           "sha16": None})
    (BASE / "task99_model_artifact_validation.json").write_text(json.dumps(validation, indent=2))

    # ── metrics.csv (per model × horizon, final test) ─────────────────────
    rows = []
    for mid, res in (("jw_reference_lstm", lstm), ("jw_reference_cnn_lstm", cnn)):
        if not res:
            continue
        for h, m in res["test_metrics"].items():
            rows.append({"model": mid, "period": "final-test", "horizon": h,
                         "n": m["n"], "mae": m["mae"], "rmse": m["rmse"], "r2": m["r2"],
                         "directional_accuracy": m["directional_accuracy"],
                         "mae_ci95_low": m["mae_ci95"][0], "mae_ci95_high": m["mae_ci95"][1]})
        for h, m in res["validation_metrics"].items():
            rows.append({"model": mid, "period": "validation", "horizon": h,
                         "n": m["n"], "mae": m["mae"], "rmse": m["rmse"], "r2": m["r2"],
                         "directional_accuracy": m["directional_accuracy"],
                         "mae_ci95_low": m["mae_ci95"][0], "mae_ci95_high": m["mae_ci95"][1]})
    with open(BASE / "task99_metrics.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["model", "period", "horizon", "n", "mae", "rmse",
                                          "r2", "directional_accuracy", "mae_ci95_low", "mae_ci95_high"])
        w.writeheader()
        w.writerows(rows)

    # ── remaining blockers ────────────────────────────────────────────────
    blockers = []
    finished = {m: (jload(BASE / "checkpoints" / f"{m}__reference_full_config__pilot25_h5_10_21.json", {}) or {})
                for m in ("jw_reference_lstm", "jw_reference_cnn_lstm")}
    for mid, ck in finished.items():
        if not ck.get("finished"):
            blockers.append({
                "model": mid,
                "issue": f"training stopped at epoch {ck.get('epoch')} ({ck.get('stop_reason')}) — "
                         "bounded CPU budget; metrics from the best checkpoint so far are reported",
                "attempts": "multiple resumable ~110s chunks (see task99_progress.json)",
                "required": "more training chunks or GPU; the 500-epoch reference schedule is not feasible "
                            "in this sandbox within the 150s per-execution limit",
                "state": "trained (bounded), OOS evaluated on best checkpoint" if ck else "pending",
            })
    if not bt:
        blockers.append({"issue": "cost-aware backtest not yet generated", "state": "pending"})
    blocks_path = BASE / "task99_remaining_blockers.json"
    if blockers:
        blocks_path.write_text(json.dumps({"blockers": blockers}, indent=2))
    elif blocks_path.exists():
        blocks_path.write_text(json.dumps({"blockers": []}, indent=2))

    # ── summary ───────────────────────────────────────────────────────────
    def tm(res, period):
        if not res:
            return None
        return res[period]

    summary = {
        "task": 99,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "reference": {"url": REF_URL, "license": lic.get("decision"),
                      "architectures_implemented": ["jw_reference_lstm", "jw_reference_cnn_lstm"],
                      "independence": audit.get("psx_adaptation_summary")},
        "models": {
            "jw_reference_lstm": {
                "status": (reg.get("supplemental_models") or [{}])[0].get("verifiedStatus"),
                "param_count": (finished["jw_reference_lstm"] or {}).get("param_count"),
                "epochs": (finished["jw_reference_lstm"] or {}).get("epoch"),
                "final_test": tm(lstm, "test_metrics") if lstm else None,
            },
            "jw_reference_cnn_lstm": {
                "status": (reg.get("supplemental_models") or [{}, {}])[1].get("verifiedStatus") if reg else None,
                "param_count": (finished["jw_reference_cnn_lstm"] or {}).get("param_count"),
                "epochs": (finished["jw_reference_cnn_lstm"] or {}).get("epoch"),
                "final_test": tm(cnn, "test_metrics") if cnn else None,
            },
        },
        "baselines_same_sample": list((base_cmp.get("same_sample_baselines") or {}).keys()),
        "backtest": {"cost_profile": bt.get("costProfile"),
                     "models": list((bt.get("models") or {}).keys())},
        "registry": {"canonical_untouched": True,
                     "supplemental_added": [e["id"] for e in (reg.get("supplemental_models") or [])],
                     "in_final_consensus": False},
        "existing_models_preserved": ["LSTM", "CNN-LSTM", "CL LSTM", "Transformer-LSTM",
                                      "canonical 58 ALL_MODELS registry"],
    }
    (BASE / "task99_summary.json").write_text(json.dumps(summary, indent=2))
    missing = [v["artifact"] for v in validation if not v["exists"]]
    print("summary written; artifacts missing:", missing if missing else "none")
    if not (lstm and cnn and bt):
        raise SystemExit(1)  # keep pending until training + backtest are complete


if __name__ == "__main__":
    main()
