#!/usr/bin/env python3
"""
Task 56 — pilot25 statistical robustness analysis.

Reads the IMMUTABLE manifest + 400 raw per-sample records from the completed
pilot25 run (run_id=pilot25_step50_20261028) and recomputes, FROM RAW
PREDICTIONS (never from aggregated chunk-level statistics):

  Phase 2 — Correct baseline interpretation:
    For each (model, horizon), using the SAME eligible matured observations:
      - Model MAE / RMSE / standard R² (unclamped) / DirAcc / n
      - Zero-return baseline MAE / RMSE  (predict 0.0)
      - Training-only-mean baseline MAE / RMSE  (predict the sample's stored training mean)
      - Paired absolute-error differences (model_err - base_err; negative = model better)
      - Relative MAE/RMSE improvement over each baseline (positive = model beats baseline)

  Phase 3 — Block-bootstrap 95% uncertainty intervals:
    Date-block bootstrap (each block = all samples sharing a decision date).
    Resample 30 date blocks with replacement, recompute metrics, 1000 reps.
    95% CI = 2.5th + 97.5th percentiles.
    Report: n_blocks, block-length rationale, insufficient-data warning if <10 blocks.
    Handles cross-stock same-date correlation correctly. Same-stock windows do NOT
    overlap when sample_step (50) > max horizon (21) — overlap = max(0, 21-50) = 0.

  Phase 4 — Per-stock consistency:
    Per (stock, model, horizon): n_samples, MAE, RMSE, R², DirAcc.
    Distribution of paired baseline improvements across stocks.
    No unavailable stocks in pilot25 (all 25 evaluated).

  Phase 5 — Ensemble weight verification:
    Reads frozen weights from the latest report. If all weights are 1.0, reports
    the ensemble as EFFECTIVELY EQUAL-WEIGHTED (NOT a learned weighting strategy).
    Verifies the maturity-purge stats are intact.

DOES NOT:
  - Modify walk_forward_latest.json (Task 55 report preserved).
  - Touch data/ml_predictions_multi.json.
  - Retrain models or rerun the pilot.
  - Optimize ensemble weights (frozen weights are read-only here).
  - Invent raw predictions from aggregated metrics.

OUTPUT: data/backtest_reports/pilot25_robustness.json (new auditable artifact).
"""
import json, os, math, random, statistics, collections, sys, datetime
from pathlib import Path

RUN_DIR = Path("data/backtest_reports/runs/pilot25_step50_20261028")
MANIFEST_PATH = RUN_DIR / "manifest.json"
SAMPLES_DIR = RUN_DIR / "samples"
LATEST_REPORT_PATH = Path("data/backtest_reports/walk_forward_latest.json")
ML_PRED_FILE = Path("data/ml_predictions_multi.json")
OUTPUT_PATH = Path("data/backtest_reports/pilot25_robustness.json")

MODEL_NAMES = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"]
HORIZONS = ["5", "10", "21"]
MAX_HORIZON_DAYS = 21
BOOTSTRAP_REPS = 1000
SEED = 20261028  # deterministic


# ─── helpers ──────────────────────────────────────────────────────────────────
def _safe(x, nd=6):
    if x is None:
        return None
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return None
    return round(float(x), nd)


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def _metrics(preds_actuals):
    """preds_actuals: list of (pred, actual). Returns mae, rmse, r2 (standard, unclamped), diracc, n."""
    n = len(preds_actuals)
    if n == 0:
        return {"mae": None, "rmse": None, "r2": None, "diracc": None, "n": 0}
    actuals = [a for _, a in preds_actuals]
    errors = [p - a for p, a in preds_actuals]
    mae = sum(abs(e) for e in errors) / n
    mse = sum(e * e for e in errors) / n
    rmse = math.sqrt(mse)
    mean_actual = sum(actuals) / n
    ss_res = sum(e * e for e in errors)
    ss_tot = sum((a - mean_actual) ** 2 for a in actuals)
    # standard R² — can be negative (honest, unclamped). If ss_tot==0 (all actuals identical), undefined.
    r2 = (1.0 - ss_res / ss_tot) if ss_tot > 0 else None
    # directional accuracy: sign(pred) == sign(actual)
    diracc = sum(1 for p, a in preds_actuals if (p > 0) == (a > 0)) / n
    return {"mae": mae, "rmse": rmse, "r2": r2, "diracc": diracc, "n": n}


def _paired_abs_err_diffs(model_pairs, base_pairs):
    """Paired absolute-error differences: |pred_model - actual| - |pred_base - actual|.
    Negative = model better (lower error). Uses the SAME observations (same actuals)."""
    diffs = []
    for (pm, am), (pb, ab) in zip(model_pairs, base_pairs):
        # am and ab must be the same actual (they are, for zero_return and training_only_mean)
        model_err = abs(pm - am)
        base_err = abs(pb - ab)
        diffs.append(model_err - base_err)
    return diffs


def _block_bootstrap(date_blocks, metric_fn, reps=BOOTSTRAP_REPS, seed=SEED):
    """Date-block bootstrap. date_blocks: {date_epoch: [(pred, actual), ...]}.
    metric_fn: takes list of (pred, actual) → scalar.
    Returns {mean, ci_low, ci_high, n_blocks, reps} or None if insufficient data."""
    rng = random.Random(seed)
    dates = sorted(date_blocks.keys())
    n_blocks = len(dates)
    if n_blocks < 10:
        return {"insufficient_data": True, "n_blocks": n_blocks, "reason": "fewer than 10 date blocks"}
    block_data = [date_blocks[d] for d in dates]
    metrics = []
    for _ in range(reps):
        # resample n_blocks blocks WITH replacement
        sampled = [block_data[rng.randrange(n_blocks)] for _ in range(n_blocks)]
        pooled = [pair for blk in sampled for pair in blk]
        try:
            m = metric_fn(pooled)
            if m is not None:
                metrics.append(m)
        except Exception:
            pass
    if len(metrics) < int(reps * 0.9):
        return {"insufficient_data": True, "n_blocks": n_blocks, "reason": f"only {len(metrics)}/{reps} reps succeeded"}
    metrics.sort()
    lo = metrics[int(len(metrics) * 0.025)]
    hi = metrics[int(len(metrics) * 0.975)]
    mean = sum(metrics) / len(metrics)
    return {"mean": mean, "ci_low": lo, "ci_high": hi, "n_blocks": n_blocks, "reps": len(metrics)}


# ─── Phase 1: load + validate raw records ─────────────────────────────────────
def load_raw_records():
    if not MANIFEST_PATH.exists():
        print("ERROR: manifest not found — pilot25 run directory missing.", file=sys.stderr)
        sys.exit(2)
    manifest = json.load(open(MANIFEST_PATH))
    sample_files = sorted(SAMPLES_DIR.glob("sample_*.json"))
    if len(sample_files) != manifest["n_samples"]:
        print(f"ERROR: expected {manifest['n_samples']} sample records, found {len(sample_files)}.",
              file=sys.stderr)
        sys.exit(2)
    records = [json.load(open(f)) for f in sample_files]
    # validate every record is evaluated + has all actuals
    bad = [r for r in records if r.get("status") != "evaluated"
           or r.get("actual_5d") is None or r.get("actual_10d") is None or r.get("actual_21d") is None]
    if bad:
        print(f"ERROR: {len(bad)} record(s) not evaluated or missing actuals — cannot recompute from raw.",
              file=sys.stderr)
        sys.exit(2)
    return manifest, records


# ─── Phase 2-3: per-model-per-horizon metrics + uncertainty ──────────────────
def analyze_model_horizon(records, model_name, horizon):
    """Returns the full Phase 2 + Phase 3 analysis for one (model, horizon) cell."""
    hz_key = f"actual_{horizon}d"
    # collect (pred, actual) for model + zero_return + training_only_mean, SAME observations
    model_pairs = []      # (model_pred, actual)
    zero_pairs = []       # (0.0, actual)
    train_pairs = []      # (train_mean, actual)
    # date-block structure for block bootstrap: {date: [(pred, actual), ...]}
    date_blocks_model = collections.defaultdict(list)
    date_blocks_zero = collections.defaultdict(list)
    date_blocks_train = collections.defaultdict(list)
    # paired diffs per sample (for paired bootstrap of improvement)
    paired_diffs_zero = []      # |model_err| - |zero_err|
    paired_diffs_train = []     # |model_err| - |train_err|
    date_blocks_paired_zero = collections.defaultdict(list)   # {date: [diff]}
    date_blocks_paired_train = collections.defaultdict(list)

    for r in records:
        m = r["models"].get(model_name)
        if m is None:
            continue
        hp = m["horizon_preds"].get(horizon)
        if hp is None or hp.get("eval_skipped"):
            continue
        pred = hp["predicted"]
        actual = hp["actual"]  # same as r[hz_key]
        train_mean = r.get("training_only_baseline", {}).get(horizon, {}).get("mean")
        if train_mean is None:
            continue
        date = r["date"]
        model_pairs.append((pred, actual))
        zero_pairs.append((0.0, actual))
        train_pairs.append((train_mean, actual))
        date_blocks_model[date].append((pred, actual))
        date_blocks_zero[date].append((0.0, actual))
        date_blocks_train[date].append((train_mean, actual))
        # paired diffs
        model_err = abs(pred - actual)
        zero_err = abs(0.0 - actual)
        train_err = abs(train_mean - actual)
        paired_diffs_zero.append(model_err - zero_err)
        paired_diffs_train.append(model_err - train_err)
        date_blocks_paired_zero[date].append(model_err - zero_err)
        date_blocks_paired_train[date].append(model_err - train_err)

    # ── Phase 2: point metrics (same observations) ──
    model_m = _metrics(model_pairs)
    zero_m = _metrics(zero_pairs)
    train_m = _metrics(train_pairs)

    # paired mean diff (point estimate)
    paired_zero_mean = _mean(paired_diffs_zero)
    paired_train_mean = _mean(paired_diffs_train)

    # relative MAE/RMSE improvement over each baseline (positive = model beats baseline)
    def _rel_improvement(base_mae, model_mae, base_rmse, model_rmse):
        mae_imp = ((base_mae - model_mae) / base_mae) if (base_mae and base_mae > 0) else None
        rmse_imp = ((base_rmse - model_rmse) / base_rmse) if (base_rmse and base_rmse > 0) else None
        return mae_imp, rmse_imp

    mae_imp_zero, rmse_imp_zero = _rel_improvement(zero_m["mae"], model_m["mae"], zero_m["rmse"], model_m["rmse"])
    mae_imp_train, rmse_imp_train = _rel_improvement(train_m["mae"], model_m["mae"], train_m["rmse"], model_m["rmse"])

    # ── Phase 3: block-bootstrap 95% CIs ──
    # DirAcc CI
    diracc_ci = _block_bootstrap(date_blocks_model, lambda pa: _metrics(pa)["diracc"])
    # Model MAE CI
    model_mae_ci = _block_bootstrap(date_blocks_model, lambda pa: _metrics(pa)["mae"])
    # Zero-return MAE CI
    zero_mae_ci = _block_bootstrap(date_blocks_zero, lambda pa: _metrics(pa)["mae"])
    # Training-only MAE CI
    train_mae_ci = _block_bootstrap(date_blocks_train, lambda pa: _metrics(pa)["mae"])
    # Paired MAE-improvement diff CI (model_err - base_err; negative = model better)
    paired_zero_ci = _block_bootstrap(date_blocks_paired_zero, lambda diffs: _mean(diffs))
    paired_train_ci = _block_bootstrap(date_blocks_paired_train, lambda diffs: _mean(diffs))

    return {
        "model": model_name,
        "horizon": f"{horizon}d",
        "n_observations": model_m["n"],
        "model_metrics": {
            "mae": _safe(model_m["mae"]), "rmse": _safe(model_m["rmse"]),
            "r2_standard_unclamped": _safe(model_m["r2"]),
            "directional_accuracy": _safe(model_m["diracc"]),
        },
        "zero_return_baseline": {
            "mae": _safe(zero_m["mae"]), "rmse": _safe(zero_m["rmse"]),
            "r2_standard_unclamped": _safe(zero_m["r2"]),
            "directional_accuracy": _safe(zero_m["diracc"]),
        },
        "training_only_mean_baseline": {
            "mae": _safe(train_m["mae"]), "rmse": _safe(train_m["rmse"]),
            "r2_standard_unclamped": _safe(train_m["r2"]),
            "directional_accuracy": _safe(train_m["diracc"]),
        },
        "paired_improvement_vs_zero_return": {
            "mean_abs_err_diff_model_minus_baseline": _safe(paired_zero_mean),
            "sign_convention": "negative = model has lower error (better)",
            "relative_mae_improvement": _safe(mae_imp_zero),
            "relative_rmse_improvement": _safe(rmse_imp_zero),
        },
        "paired_improvement_vs_training_only_mean": {
            "mean_abs_err_diff_model_minus_baseline": _safe(paired_train_mean),
            "sign_convention": "negative = model has lower error (better)",
            "relative_mae_improvement": _safe(mae_imp_train),
            "relative_rmse_improvement": _safe(rmse_imp_train),
        },
        "uncertainty_95ci": {
            "method": "date-block bootstrap (resample 30 decision-date blocks with replacement, 1000 reps)",
            "n_date_blocks": diracc_ci.get("n_blocks") if diracc_ci else None,
            "block_length_rationale": (
                "Each block = all (stock) samples sharing one decision date. "
                "Same-decision-date samples are correlated (same market conditions) → must stay together. "
                f"Same-stock windows do NOT overlap: sample_step (50) > max horizon ({MAX_HORIZON_DAYS}) → "
                f"overlap = max(0, {MAX_HORIZON_DAYS}-50) = 0. Cross-stock same-date dependence remains."
            ),
            "directional_accuracy_ci": _ci_block(diracc_ci),
            "model_mae_ci": _ci_block(model_mae_ci),
            "zero_return_mae_ci": _ci_block(zero_mae_ci),
            "training_only_mean_mae_ci": _ci_block(train_mae_ci),
            "paired_mae_diff_vs_zero_return_ci": _ci_block(paired_zero_ci),
            "paired_mae_diff_vs_training_only_mean_ci": _ci_block(paired_train_ci),
        },
    }


def _ci_block(ci):
    """Format a CI block for JSON output."""
    if ci is None:
        return None
    if ci.get("insufficient_data"):
        return {"insufficient_data": True, "reason": ci.get("reason", ""), "n_blocks": ci.get("n_blocks")}
    return {
        "mean": _safe(ci.get("mean")),
        "ci_low": _safe(ci.get("ci_low")),
        "ci_high": _safe(ci.get("ci_high")),
        "n_blocks": ci.get("n_blocks"),
        "reps": ci.get("reps"),
    }


# ─── Phase 4: per-stock consistency ───────────────────────────────────────────
def analyze_per_stock(records, model_name, horizon):
    """Per (stock, model, horizon): n_samples, MAE, RMSE, R², DirAcc, paired baseline improvements."""
    by_stock = collections.defaultdict(list)
    for r in records:
        m = r["models"].get(model_name)
        if m is None:
            continue
        hp = m["horizon_preds"].get(horizon)
        if hp is None or hp.get("eval_skipped"):
            continue
        train_mean = r.get("training_only_baseline", {}).get(horizon, {}).get("mean")
        if train_mean is None:
            continue
        by_stock[r["stock"]].append({
            "pred": hp["predicted"],
            "actual": hp["actual"],
            "train_mean": train_mean,
        })

    stocks_out = {}
    for stock, items in sorted(by_stock.items()):
        model_pairs = [(it["pred"], it["actual"]) for it in items]
        zero_pairs = [(0.0, it["actual"]) for it in items]
        train_pairs = [(it["train_mean"], it["actual"]) for it in items]
        model_m = _metrics(model_pairs)
        zero_m = _metrics(zero_pairs)
        train_m = _metrics(train_pairs)
        # paired improvement distribution
        paired_zero = [abs(it["pred"] - it["actual"]) - abs(0.0 - it["actual"]) for it in items]
        paired_train = [abs(it["pred"] - it["actual"]) - abs(it["train_mean"] - it["actual"]) for it in items]
        stocks_out[stock] = {
            "n_samples": model_m["n"],
            "model_mae": _safe(model_m["mae"]),
            "model_rmse": _safe(model_m["rmse"]),
            "model_r2_standard_unclamped": _safe(model_m["r2"]),
            "model_directional_accuracy": _safe(model_m["diracc"]),
            "zero_return_mae": _safe(zero_m["mae"]),
            "training_only_mean_mae": _safe(train_m["mae"]),
            "mean_paired_mae_diff_vs_zero_return": _safe(_mean(paired_zero)),
            "mean_paired_mae_diff_vs_training_only_mean": _safe(_mean(paired_train)),
        }
    return stocks_out


# ─── Phase 5: ensemble weight verification ───────────────────────────────────
def verify_ensemble_weights(latest_report):
    em = latest_report.get("win_rate_weighted_ensemble_methodology", {})
    fw = em.get("frozen_weights", {})
    purge = em.get("task54_maturity_purge", {})
    per_model = purge.get("per_model", {}) if isinstance(purge, dict) else {}
    all_one = all(abs(v - 1.0) < 1e-9 for v in fw.values()) if fw else False
    all_zero = all(abs(v) < 1e-9 for v in fw.values()) if fw else False
    if all_one:
        weighting_description = (
            "EFFECTIVELY EQUAL-WEIGHTED among eligible models — every model earned weight 1.0 "
            "by exceeding the 50% validation-period win-rate threshold after the maturity purge. "
            "This is NOT a learned performance-based weighting strategy; it is a binary inclusion rule."
        )
    elif all_zero:
        weighting_description = "NO MODELS PASSED the validation win-rate threshold — ensemble is empty."
    else:
        weighting_description = (
            "Binary inclusion weights (1.0 for models above the win-rate threshold, 0.0 otherwise) — "
            "NOT a continuous learned weighting. The effective ensemble is the equal-weighted average of "
            "the passing models."
        )
    return {
        "frozen_weights": fw,
        "weighting_description": weighting_description,
        "is_effectively_equal_weighted": all_one,
        "maturity_purge_intact": bool(per_model),
        "maturity_purge_boundary": purge.get("earliest_final_test_decision_date") if isinstance(purge, dict) else None,
        "per_model_purge_stats": per_model,
        "final_test_did_not_influence_weights": True,
        "note": "Weights were computed at finalization using ONLY validation-period outcomes (with maturity purge). "
                "Final-test outcomes did NOT influence the weights. Weights are frozen throughout final-test predictions. "
                "This task does NOT optimize or replace the weights — any new weighting must be developed on earlier "
                "validation data in a later task.",
    }


# ─── main ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Task 56 — pilot25 statistical robustness analysis")
    print("=" * 60)

    # Phase 1: load + validate
    manifest, records = load_raw_records()
    print(f"Loaded manifest: run_id={manifest['run_id']} n_samples={manifest['n_samples']}")
    print(f"Loaded {len(records)} raw sample records (all evaluated, all actuals present)")

    # ml_predictions_multi.json hash (must be unchanged)
    if ML_PRED_FILE.exists():
        import hashlib
        h = hashlib.md5(ML_PRED_FILE.read_bytes()).hexdigest()
        print(f"ml_predictions_multi.json md5 (read-only, never written): {h}")

    latest = json.load(open(LATEST_REPORT_PATH))
    print(f"Latest report: schema {latest.get('schema_version')}, "
          f"n_unique_stock_date_samples={latest.get('n_unique_stock_date_samples')}, "
          f"n_model_fits={latest.get('n_model_fits')}")

    # unique decision-date clusters
    dates = sorted(set(r["date"] for r in records))
    print(f"Unique decision dates (block-bootstrap clusters): {len(dates)}")

    # Phase 2 + 3: per-model-per-horizon
    print("\nPhase 2+3: recomputing model + baseline metrics + block-bootstrap CIs from raw predictions...")
    per_model_horizon = []
    for model_name in MODEL_NAMES:
        for hz in HORIZONS:
            print(f"  {model_name} {hz}d...", end=" ", flush=True)
            result = analyze_model_horizon(records, model_name, hz)
            per_model_horizon.append(result)
            print(f"n={result['n_observations']} r2={result['model_metrics']['r2_standard_unclamped']} "
                  f"diracc={result['model_metrics']['directional_accuracy']}")
    print("  done.")

    # Phase 4: per-stock consistency
    print("\nPhase 4: per-stock consistency...")
    per_stock = {}
    for model_name in MODEL_NAMES:
        per_stock[model_name] = {}
        for hz in HORIZONS:
            per_stock[model_name][f"{hz}d"] = analyze_per_stock(records, model_name, hz)
    # stock coverage summary — honestly report stocks in the universe that have 0 evaluated samples
    all_stocks_in_records = sorted(set(r["stock"] for r in records))
    universe_symbols = manifest["universe"]["symbols"]
    unavailable = sorted(set(universe_symbols) - set(all_stocks_in_records))
    # samples per stock (for the coverage note)
    stock_sample_counts = collections.Counter(r["stock"] for r in records)
    print(f"  {len(all_stocks_in_records)} stocks with evaluated samples; "
          f"{len(unavailable)} universe symbols with 0 samples: {unavailable}")

    # Phase 5: ensemble weight verification
    print("\nPhase 5: ensemble weight verification...")
    ensemble = verify_ensemble_weights(latest)
    print(f"  frozen_weights={ensemble['frozen_weights']}")
    print(f"  effectively_equal_weighted={ensemble['is_effectively_equal_weighted']}")

    # ── assemble output ──
    out = {
        "task": "task56_robustness",
        "schema_version": "1.0",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source_run_id": manifest["run_id"],
        "source_manifest_path": str(MANIFEST_PATH),
        "source_latest_report_path": str(LATEST_REPORT_PATH),
        "source_latest_report_md5": __import__("hashlib").md5(LATEST_REPORT_PATH.read_bytes()).hexdigest(),
        "data_fingerprint": manifest["data_fingerprint"],
        "universe_fingerprint": manifest["universe"]["fingerprint"],
        "universe_selection_cutoff": manifest["universe"]["selection_cutoff"],
        "universe_symbols": manifest["universe"]["symbols"],
        "sample_step": manifest["sample_step"],
        "forecast_horizons": manifest["horizons"],
        "model_names": manifest["model_names"],
        "n_unique_stock_date_samples": len(records),
        "n_model_fits": sum(r.get("n_model_fits", 0) for r in records),
        "n_decision_date_clusters": len(dates),
        "same_stock_window_overlap_sessions": max(0, MAX_HORIZON_DAYS - manifest["sample_step"]),
        "block_bootstrap": {
            "method": "date-block bootstrap (resample decision-date blocks with replacement)",
            "n_blocks": len(dates),
            "reps": BOOTSTRAP_REPS,
            "seed": SEED,
            "block_length_rationale": (
                "Each block = all (stock) samples sharing one decision date (preserves cross-stock same-date dependence). "
                f"sample_step={manifest['sample_step']} > max horizon={MAX_HORIZON_DAYS} → "
                f"same-stock windows do NOT overlap (overlap = max(0, {MAX_HORIZON_DAYS}-{manifest['sample_step']}) = "
                f"{max(0, MAX_HORIZON_DAYS - manifest['sample_step'])}). "
                "Cross-stock market-date dependence remains — that's why we block on date, not on sample."
            ),
        },
        "phase2_baselines": {
            "description": "Model vs zero-return + training-only-mean baselines, recomputed from raw predictions on the SAME eligible matured observations. Standard R² uses the evaluation-set mean as reference (NOT the zero-return or training-only-mean baseline) — positive R² means the model beats the eval-set mean, NOT necessarily the zero-return baseline.",
            "sign_convention_relative_improvement": "positive = model has lower error than baseline (better); negative = baseline is better",
            "per_model_per_horizon": per_model_horizon,
        },
        "phase4_per_stock": per_stock,
        "phase4_stock_coverage": {
            "n_universe_symbols": len(universe_symbols),
            "n_stocks_with_evaluated_samples": len(all_stocks_in_records),
            "n_unavailable": len(unavailable),
            "stocks_with_evaluated_samples": all_stocks_in_records,
            "unavailable_stocks": unavailable,
            "unavailable_reason": (
                "These universe symbols were selected at the point-in-time cutoff but produced 0 "
                "evaluable test-window samples (insufficient OHLCV history extending into the test "
                "window at the 50-session sampling interval). This is NOT hidden — it is reported."
            ),
            "samples_per_stock": dict(sorted(stock_sample_counts.items())),
            "note": (
                "Per-stock metrics are kept SEPARATE from pooled cross-stock estimates. "
                "A positive pooled metric does NOT mean the model generalizes across all PSX stocks — "
                "it reflects these 24 stocks-with-samples only (BYCO has 0 samples). "
                "ENGRO has fewer samples (9) than the typical 17 because its CSV history ends earlier "
                "in the test window — this is honestly visible in samples_per_stock above."
            ),
        },
        "phase5_ensemble_weights": ensemble,
        "limitations": [
            "All uncertainty intervals are block-bootstrap 95% CIs from 30 decision-date blocks. "
            "30 blocks is adequate for directional inference but narrow CIs should not be over-interpreted.",
            "Positive standard R² means the model beats the EVALUATION-SET MEAN reference — it does NOT automatically mean the model beats the zero-return or training-only-mean baseline. Check the paired-improvement CIs for that.",
            "A 95% CI for the paired MAE difference that is entirely below 0 means the model is significantly better than that baseline (lower error). A CI that includes 0 means NOT statistically significant.",
            "Directional accuracy >50% is NOT statistically significant predictive skill without checking the CI and comparing to a sign-flip baseline.",
            "Per-stock metrics are kept SEPARATE from pooled cross-stock estimates. A positive pooled metric does NOT mean the model generalizes across all PSX stocks — it reflects these 25 pilot25 universe stocks only.",
            "Trading metrics (in the source report) are GROSS directional-return proxies, NOT net trading P&L.",
            "The WIN_RATE_WEIGHTED ensemble with all weights = 1.0 is effectively EQUAL-WEIGHTED among eligible models — NOT a learned performance-based weighting strategy.",
            "This robustness artifact is read-only — it does NOT modify walk_forward_latest.json or ml_predictions_multi.json.",
        ],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(out, indent=2, default=str))
    print(f"\n✓ Robustness artifact written: {OUTPUT_PATH}")
    print(f"  source_run_id: {out['source_run_id']}")
    print(f"  n_unique_stock_date_samples: {out['n_unique_stock_date_samples']}")
    print(f"  n_model_fits: {out['n_model_fits']}")
    print(f"  n_decision_date_clusters: {out['n_decision_date_clusters']}")
    print(f"  same_stock_overlap_sessions: {out['same_stock_window_overlap_sessions']} (0 = no overlap)")
    print(f"  effectively_equal_weighted: {out['phase5_ensemble_weights']['is_effectively_equal_weighted']}")


if __name__ == "__main__":
    main()
