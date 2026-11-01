#!/usr/bin/env python3
"""Task 99 — build the supplemental model registry entries.

Produces data/backtest_reports/task99/task99_model_registry.json with the two
reference-model entries. The registry API route (src/app/api/models/registry)
merges these into its `supplemental` array; the canonical 58 ALL_MODELS and
existing supplemental/alias handling are untouched. Status is only
trained_oos_evaluated when the predictions + evaluation artifacts exist.
"""
from __future__ import annotations
import json
import time
from pathlib import Path

BASE = Path("data/backtest_reports/task99")
REF_URL = "https://github.com/jiewwantan/RNN_LSTM_trading_model"


def status_for(mid: str, tag: str) -> tuple[str, dict]:
    preds = BASE / "predictions" / f"preds_{mid}__reference_full_config__{tag}.json"
    if not preds.exists():
        ck = BASE / "checkpoints" / f"{mid}__reference_full_config__{tag}.json"
        if ck.exists():
            return "training", {}
        return "not_trained", {}
    results_fn = "task99_lstm_results.json" if "cnn" not in mid else "task99_cnn_lstm_results.json"
    res_path = BASE / results_fn
    if not res_path.exists():
        return "trained_artifact_only", {}
    res = json.loads(res_path.read_text())
    tm = res["test_metrics"]
    metrics = {f"{h}d": {"n": tm[h]["n"], "mae": tm[h]["mae"], "rmse": tm[h]["rmse"],
                         "r2": tm[h]["r2"], "directional_accuracy": tm[h]["directional_accuracy"],
                         "mae_ci95": tm[h]["mae_ci95"]} for h in ("5", "10", "21") if h in tm}
    return "trained_oos_evaluated", metrics


def main() -> None:
    ck_lstm = json.loads((BASE / "checkpoints" / "jw_reference_lstm__reference_full_config__pilot25_h5_10_21.json").read_text()) \
        if (BASE / "checkpoints" / "jw_reference_lstm__reference_full_config__pilot25_h5_10_21.json").exists() else {}
    ck_cnn = json.loads((BASE / "checkpoints" / "jw_reference_cnn_lstm__reference_full_config__pilot25_h5_10_21.json").read_text()) \
        if (BASE / "checkpoints" / "jw_reference_cnn_lstm__reference_full_config__pilot25_h5_10_21.json").exists() else {}
    ds = json.loads((BASE / "models" / "dataset_pilot25_h5_10_21.json").read_text())
    entries = []
    for mid, disp, kind, ck in (
        ("jw_reference_lstm", "Reference LSTM — PSX Adaptation",
         "Stacked LSTM 256(seq)→Dropout(0.25)→LSTM(64)→Dropout(0.25)→Dense(3); RMSprop(0.01); MAE loss", ck_lstm),
        ("jw_reference_cnn_lstm", "Reference CNN-LSTM — PSX Adaptation",
         "Conv1D(256,k8)→Conv1D(256,k6)→Dropout(0.25)→MaxPool1D(3)→LSTM(128)→Dropout(0.25)→Dense(3); Adagrad(0.01); MAE loss", ck_cnn),
    ):
        status, metrics = status_for(mid, "pilot25_h5_10_21")
        entries.append({
            "id": mid, "name": disp, "supplemental": True,
            "source_reference": REF_URL,
            "license_status": "no LICENSE in reference repo — independent PyTorch implementation, no code/weights copied",
            "psx_adaptation": {"seq_len": ds["seq_len"], "horizons": ds["horizons"],
                               "targets": "forward returns 5d/10d/21d (output_dim=3)",
                               "market_context": "excluded — no genuine KSE-100 series in DB",
                               "features": ds["n_features"],
                               "feature_schema": ds["feature_schema_version"]},
            "architecture": kind,
            "config": "reference_full_config (exact reference layer widths)",
            "param_count": ck.get("param_count"),
            "epochs_trained": ck.get("epoch"),
            "best_val_mae": ck.get("best_val_mae"),
            "checkpoint_sha16": ck.get("checkpoint_sha16"),
            "training_samples": ds["counts"]["train"],
            "validation_samples": ds["counts"]["val"],
            "test_samples": ds["counts"]["test"],
            "symbols": len(ds["symbols_eligible"]),
            "training_duration_chunks": "~110s resumable CPU chunks (150s sandbox limit)",
            "checkpoint_available": bool(ck),
            "in_final_consensus": False,
            "evaluation_policy": "paper/shadow until OOS evidence justifies promotion",
            "verifiedStatus": status, "status": status,
            "metrics": metrics,
            "dirAcc5d": (metrics.get("5d") or {}).get("directional_accuracy"),
            "mae5d": (metrics.get("5d") or {}).get("mae"),
        })
    out = {"task": 99, "canonical_registry_untouched": True,
           "supplemental_models": entries, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    (BASE / "task99_model_registry.json").write_text(json.dumps(out, indent=2))
    for e in entries:
        print(e["id"], "->", e["verifiedStatus"])
    if not all(e["verifiedStatus"] == "trained_oos_evaluated" for e in entries):
        raise SystemExit(1)  # keep the runner job pending until both models are evaluated


if __name__ == "__main__":
    main()
