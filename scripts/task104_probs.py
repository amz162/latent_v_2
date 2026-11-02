#!/usr/bin/env python3
"""Task 104 — deterministic reproduction of per-sample model probabilities.
Reuses the FROZEN Task 101 pipeline (task101_phases._rebuild_grid_with_features
+ cls_fit101): chronological 50/15/35 split with 21-session purge, 22 frozen
features, train-median NaN fill, train-only StandardScaler, per-strategy
RandomForest P(net>0), isotonic calibration fitted on validation ONLY,
threshold = validation q70 quantile. Emits probabilities per sample and the
self-consistent thresholds; reconciliation against the reported aggregates is
done in task104_analysis.py (never tuned to match).
Checkpointed: grid cached to task104_grid_cache.json."""
from __future__ import annotations
import json, sys, time
import numpy as np
from pathlib import Path
sys.path.insert(0, "/home/z/my-project/scripts")   # task101 pipeline expects this ROOT
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task103_lib as L104  # noqa: E402  (portable helpers, task104 paths)
import task101_lib as T101  # noqa: E402
import task101_phases as P101  # noqa: E402
from sklearn.isotonic import IsotonicRegression

T104 = Path(__file__).resolve().parent.parent / "data/backtest_reports/task104"
T104.mkdir(parents=True, exist_ok=True)
OUT = T104 / "task104_probabilities.json"
GRID_CACHE = T104 / "task104_grid_cache.json"
STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"]


def y_for(lab_row: dict, strat: str) -> int:
    return int(lab_row["strategies"][strat]["positiveNet"])


def main() -> None:
    t0 = time.time()
    if GRID_CACHE.exists():
        cached = json.loads(GRID_CACHE.read_text())
        joined, X = cached["rows"], None
        X = {p: np.array(cached["X"][p], dtype=np.float64) for p in cached["X"]}
    else:
        joined, X, Xs, feat_names, _lab = P101._features_and_labels()
        GRID_CACHE.write_text(json.dumps(
            {"rows": joined, "X": {p: X[p].tolist() for p in X}}))
    labels = json.loads((T101.LABELS_DIR / "labels.json").read_text())["labels"]
    lab = {r["sample_id"]: r for r in labels}
    rows = joined
    X = {p: np.array([r["features"] for r in rows if r["partition"] == p], dtype=np.float64)
          for p in ("train", "validation", "final_test")} if "features" in rows[0] else None
    if X is None:
        raise SystemExit("grid cache lacks features")
    _med = np.nanmedian(X["train"], axis=0)
    _med = np.where(np.isfinite(_med), _med, 0.0)
    X = {p: np.where(np.isfinite(X[p]), X[p], _med) for p in X}
    from sklearn.preprocessing import StandardScaler
    sc = StandardScaler().fit(X["train"])
    Xs = {p: sc.transform(X[p]) for p in X}

    # partition membership per sample (aligned with X blocks)
    idx = {"train": 0, "validation": 0, "final_test": 0}
    order = []
    for r in rows:
        order.append((r["sample_id"], r["partition"]))
    counts = {p: sum(1 for _, q in order if q == p)
               for p in ("train", "validation", "final_test")}
    for p in counts:
        assert Xs[p].shape[0] == counts[p], (p, Xs[p].shape, counts[p])

    out_rows = []
    per_strategy = {}
    for strat in STRATS:
        y = {p: np.array([y_for(lab[sid], strat) for sid, q in order if q == p])
              for p in ("train", "validation", "final_test")}
        m = P101.cls_fit101("RandomForest", Xs["train"], y["train"])
        p_raw = {p: m.predict_proba(Xs[p])[:, 1] for p in Xs}
        iso = IsotonicRegression(out_of_bounds="clip").fit(p_raw["validation"], y["validation"])
        p_cal = {p: iso.predict(p_raw[p]) for p in p_raw}
        thr_q70 = float(np.quantile(p_cal["validation"], 0.70))
        per_strategy[strat] = {"thr_q70": thr_q70,
            "auc_val": _auc(y["validation"], p_cal["validation"]),
            "auc_test": _auc(y["final_test"], p_cal["final_test"]),
            "brier_val_cal": float(np.mean((p_cal["validation"] - y["validation"]) ** 2)),
            "brier_test_cal": float(np.mean((p_cal["final_test"] - y["final_test"]) ** 2)),
            "n_val": int(len(y["validation"])), "n_test": int(len(y["final_test"]))}
        i = {"train": 0, "validation": 0, "final_test": 0}
        for sid, part in order:
            out_rows.append({"sample_id": sid, "partition": part, "strategy": strat,
                              "p_raw": float(p_raw[part][i[part]]),
                              "p_cal": float(p_cal[part][i[part]]),
                              "y_net_positive": int(y[part][i[part]])})
            i[part] += 1
    OUT.write_text(json.dumps({
        "generated_at": L104.NOW(),
        "status": "completed",
        "provenance": "deterministic reproduction via the persisted Task 101 pipeline "
                       "(task101_phases._rebuild_grid_with_features + cls_fit101 RandomForest "
                       "P(net>0), isotonic on validation, q70 threshold on validation "
                       "probabilities); NOT tuned to match reported aggregates",
        "frozen_rule_strategy": "max_tp_step_trailing",
        "per_strategy": per_strategy,
        "n_samples": len(rows),
        "partition_counts": counts,
        "rows": out_rows}, default=float))
    print(f"probs done {time.time()-t0:.0f}s: {len(rows)} samples; thresholds="
          f"{ {k: round(v['thr_q70'], 4) for k, v in per_strategy.items()} }")


def _auc(y, p):
    y = np.asarray(y); p = np.asarray(p)
    pos, neg = y == 1, y == 0
    if not pos.any() or not neg.any():
        return None
    order = np.argsort(p)
    ranks = np.empty(len(p)); ranks[order] = np.arange(1, len(p) + 1)
    # average ranks for ties
    sp = p[order]
    i = 0
    while i < len(sp):
        j = i
        while j + 1 < len(sp) and sp[j + 1] == sp[i]:
            j += 1
        if j > i:
            ranks[order[i:j + 1]] = (i + 1 + j + 1) / 2.0
        i = j + 1
    r_pos = ranks[pos].sum()
    return float((r_pos - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * neg.sum()))


if __name__ == "__main__":
    main()
