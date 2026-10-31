#!/usr/bin/env python3
"""Task 94 Phase 8 — Full walk-forward & per-stock evaluation.

Reuses valid Task 87 per-stock cells (360), adds ONLY genuine new evidence:
  - Chronos expanded per-symbol cells (task94 batch predictions, real OOS inference)
  - PatchTST / Transformer-LSTM aggregate-only rows (per-symbol split not saved — honest)
Emits data/backtest_reports/task94/task94_per_stock_walk_forward.json
Bounded: runs in seconds; idempotent.
"""
import json, os, statistics, sys
from collections import defaultdict

ROOT = "/home/z/my-project"
T87 = f"{ROOT}/data/backtest_reports/task87/task87_per_stock_walk_forward.json"
CHRON = ""
OUT = f"{ROOT}/data/backtest_reports/task94/task94_per_stock_walk_forward.json"
LOGD = f"{ROOT}/data/backtest_reports/task94/batch_logs"
os.makedirs(LOGD, exist_ok=True)

def load(p):
    with open(p) as f: return json.load(f)

report = {"task": "Task 94 Phase 8 — per-stock walk-forward (reuse + genuine new evidence)",
          "provenance_policy": "task87 cells reused unchanged; new cells only from persisted OOS predictions; no fabricated cells",
          "reused": {}, "new_cells": [], "aggregate_only": [], "validation": {}, "summary": {}}

# ---------- 1. Validate + reuse Task 87 cells ----------
t87 = load(T87)
cells = t87.get("cells", [])
valid = []
problems = []
for c in cells:
    if all(k in c for k in ("symbol", "model", "horizon", "n")) and isinstance(c.get("n"), int) and c["n"] > 0:
        valid.append(c)
    else:
        problems.append(c)
syms = sorted({c["symbol"] for c in valid})
mods = sorted({c["model"] for c in valid})
hors = sorted({str(c["horizon"]) for c in valid})
report["reused"] = {"source": "data/backtest_reports/task87/task87_per_stock_walk_forward.json",
                    "cells_total": len(cells), "cells_valid": len(valid), "cells_invalid": len(problems),
                    "unique_symbols": len(syms), "unique_models": len(mods), "horizons": hors,
                    "models": mods}
# metric sanity: dir_acc in [0,1], mae >= 0
bad = [c for c in valid if not (0 <= c.get("dir_acc", -1) <= 1) or c.get("mae", -1) < 0]
report["validation"] = {"metric_range_violations": len(bad), "notes": "dir_acc must be in [0,1], mae >= 0"}

# ---------- 2. Genuine new per-symbol cells: Chronos expanded ----------
chron_path = f"{ROOT}/data/backtest_reports/task94/batch_logs/chronos_expanded_predictions.json"
if os.path.exists(chron_path):
    ch = load(chron_path)
    res = ch.get("result", {})
    horizon = res.get("horizon") or res.get("horizon_days") or 5
    preds = ch.get("predictions", [])
    by_sym = defaultdict(list)
    for p in preds:
        if p.get("symbol") and p.get("actual_return") is not None and p.get("pred_return") is not None:
            by_sym[p["symbol"]].append(p)
    new_cells = []
    for sym, rows in sorted(by_sym.items()):
        n = len(rows)
        dir_acc = sum(1 for r in rows if r.get("dir_correct") in (1, True)) / n
        maes = [abs(r["pred_return"] - r["actual_return"]) for r in rows]
        mean_a = statistics.mean(r["actual_return"] for r in rows)
        sse = sum((r["pred_return"] - r["actual_return"]) ** 2 for r in rows)
        sst = sum((r["actual_return"] - mean_a) ** 2 for r in rows) or 1e-12
        new_cells.append({"symbol": sym, "model": "Chronos-T5-Tiny (official pretrained inference)",
                          "horizon": horizon, "n": n, "mae": round(statistics.mean(maes), 6),
                          "r2": round(1 - sse / sst, 4), "dir_acc": round(dir_acc, 4),
                          "provenance": "task94_phase3_expanded_batch_inference"})
    report["new_cells"] = new_cells
    report["summary"]["chronos_expansion"] = {
        "source": "batch_logs/chronos_expanded_predictions.json", "n_predictions": len(preds),
        "symbols": sorted(by_sym.keys()), "aggregate_dir_acc": res.get("dir_acc"),
        "note": "per-symbol cells are thin (n~50) — indicative only, never promoted alone"}

# ---------- 3. Aggregate-only entries for recovered models (honest: no per-symbol split) ----------
rec = load(f"{ROOT}/data/backtest_reports/task94/task94_model_recovery.json")
for m in ("PatchTST", "Transformer-LSTM"):
    blk = rec.get(m, {})
    for hz, h in sorted(blk.items()):
        if not isinstance(h, dict) or "n_predictions" not in h: continue
        report["aggregate_only"].append({
            "model": m, "horizon": int(str(hz).rstrip('d')), "n": h["n_predictions"],
            "dir_acc": h.get("overall_dir_acc"), "ci95": h.get("overall_ci95"),
            "symbols_count": len(h.get("symbols") or []),
            "provenance": "task94_phase2_official_pretrained_inference_recovery",
            "per_symbol_split_saved": False,
            "honest_note": "checkpoint inference evaluated at aggregate level only; per-symbol cells would require re-running inference per symbol — not fabricated"})

# ---------- 4. Summary ----------
all_syms = set(syms) | {c["symbol"] for c in report["new_cells"]}
report["summary"]["unique_symbols_total"] = len(all_syms)
report["summary"]["reused_cells"] = len(valid)
report["summary"]["new_genuine_cells"] = len(report["new_cells"])
report["summary"]["aggregate_only_rows"] = len(report["aggregate_only"])
report["summary"]["missing_cells_policy"] = ("cells absent from Task 87 remain absent (models/symbols without saved OOS predictions); "
                                             "full_db universes not fabricated; validation vs final-test kept as in source artifacts")

with open(OUT, "w") as f:
    json.dump(report, f, indent=2)
with open(f"{LOGD}/phase8_run.json", "w") as f:
    json.dump({"ran": True, "reused": len(valid), "new": len(report["new_cells"]),
               "aggregate_only": len(report["aggregate_only"])}, f, indent=2)
print(f"PHASE8 OK: reused={len(valid)} new_chronos={len(report['new_cells'])} aggregate_only={len(report['aggregate_only'])} -> {OUT}")
