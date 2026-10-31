#!/usr/bin/env python3
"""Task 93: Ensemble verification script.

Verifies the Majority Vote ensemble claim from task87_ensemble_validation.json:
  - dir_acc=0.565 @ h=5d, n=400, CI=[0.5164, 0.6136]

Checks:
  1. Wilson CI math is correct
  2. Aggregate dir_acc lies within the range of the 5 constituent models' dir_acc
  3. Per-stock matrix shape is consistent (24 syms × 5 models × 3 horizons = 360)
  4. Cross-checks with walk_forward_latest.json model-level dir_acc at h=5
  5. Saves a verification report
"""
import json, math
from pathlib import Path
import numpy as np

OUT = Path("/home/z/my-project/data/backtest_reports/task93/task93_ensemble_verification.json")


def wilson_ci(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z*z/n
    center = (p + z*z/(2*n)) / denom
    half = z * math.sqrt(p*(1-p)/n + z*z/(4*n*n)) / denom
    return (round(center - half, 4), round(center + half, 4))


def wilson_ci_pct(dir_acc, n, z=1.96):
    """Compute Wilson CI from a proportion."""
    return wilson_ci(int(round(dir_acc * n)), n, z)


def main():
    t87 = json.load(open("/home/z/my-project/data/backtest_reports/task87/task87_ensemble_validation.json"))
    wf  = json.load(open("/home/z/my-project/data/backtest_reports/walk_forward_latest.json"))

    mv = t87["majority_vote"]
    psm = t87["per_stock_matrix"]

    # 1. Re-compute Wilson CIs
    ci_checks = {}
    for h, hd in mv.items():
        n = hd["n"]
        da = hd["dir_acc"]
        stored_ci = hd["ci95"]
        recomputed = wilson_ci_pct(da, n)
        match = (abs(recomputed[0] - stored_ci[0]) < 0.005 and
                 abs(recomputed[1] - stored_ci[1]) < 0.005)
        ci_checks[h] = {
            "n": n,
            "dir_acc": da,
            "stored_ci95": stored_ci,
            "recomputed_ci95": recomputed,
            "match": match,
        }

    # 2. Cross-check per_stock_matrix structure
    n_symbols = len(set(r["symbol"] for r in psm))
    n_models  = len(set(r["model"]  for r in psm))
    n_hoz     = len(set(r["horizon"] for r in psm))
    expected_cells = n_symbols * n_models * n_hoz
    matrix_consistent = (len(psm) == expected_cells == 360 and
                         n_symbols == 24 and n_models == 5 and n_hoz == 3)

    # 3. Cross-check individual model dir_acc at h=5 from walk_forward_latest.json
    wf_models = {m["name"]: m for m in wf["models"]}
    h5_individual = {}
    for name, m in wf_models.items():
        h5 = (m.get("horizons") or {}).get("5", {})
        h5_individual[name] = {
            "n": h5.get("n_observations"),
            "dir_acc": h5.get("directional_accuracy"),
        }

    # 4. Range check: ensemble dir_acc must be within range of individual model dir_acc
    h5_dir_accs = [v["dir_acc"] for v in h5_individual.values() if v["dir_acc"] is not None]
    h5_min = min(h5_dir_accs)
    h5_max = max(h5_dir_accs)
    h5_ens = mv["5d"]["dir_acc"]
    within_range = (h5_min <= h5_ens <= h5_max)

    # 5. Save report
    report = {
        "verification_target": "Majority Vote ensemble (task87_ensemble_validation.json)",
        "claims_verified": {
            "h5d": {
                "claimed_dir_acc": 0.565,
                "claimed_ci95": [0.5164, 0.6136],
                "claimed_n": 400,
                "stored_dir_acc": mv["5d"]["dir_acc"],
                "stored_ci95": mv["5d"]["ci95"],
                "recomputed_ci95": ci_checks["5d"]["recomputed_ci95"],
                "ci_math_match": ci_checks["5d"]["match"],
                "beats_050_stored": mv["5d"]["beats_050"],
                "individual_model_dir_acc_h5": h5_individual,
                "individual_min": h5_min,
                "individual_max": h5_max,
                "ensemble_within_individual_range": within_range,
            },
            "h10d": {
                "claimed_dir_acc": 0.5025,
                "stored_dir_acc": mv["10d"]["dir_acc"],
                "ci_math_match": ci_checks["10d"]["match"],
                "beats_050_stored": mv["10d"]["beats_050"],
            },
            "h21d": {
                "claimed_dir_acc": 0.48,
                "stored_dir_acc": mv["21d"]["dir_acc"],
                "ci_math_match": ci_checks["21d"]["match"],
                "beats_050_stored": mv["21d"]["beats_050"],
            },
        },
        "per_stock_matrix": {
            "n_cells": len(psm),
            "n_symbols": n_symbols,
            "n_models": n_models,
            "n_horizons": n_hoz,
            "expected_cells": expected_cells,
            "consistent_360_cells": matrix_consistent,
        },
        "overall_verdict": {
            "ci_math_correct": all(c["match"] for c in ci_checks.values()),
            "matrix_consistent": matrix_consistent,
            "ensemble_within_individual_range": within_range,
            "h5d_beats_050": mv["5d"]["beats_050"],
            "h10d_beats_050": mv["10d"]["beats_050"],
            "h21d_beats_050": mv["21d"]["beats_050"],
            "claim_verified": (
                all(c["match"] for c in ci_checks.values()) and
                matrix_consistent and
                within_range
            ),
        },
        "honesty_notes": [
            "The dir_acc=0.565 @ h=5d with CI=[0.5164, 0.6136] is statistically defensible: CI excludes 0.50.",
            "At h=10d, dir_acc=0.5025 with CI=[0.4535, 0.5515] — CI includes 0.50, NOT significant.",
            "At h=21d, dir_acc=0.48 with CI=[0.431, 0.529] — CI includes 0.50, NOT significant.",
            "Statistical significance holds ONLY at h=5d.",
            "This is OOS directional accuracy on a hold-out final-test split, not trading P&L.",
        ],
    }
    OUT.write_text(json.dumps(report, indent=2))

    print("=" * 70)
    print("ENSEMBLE VERIFICATION REPORT")
    print("=" * 70)
    print(f"\nh=5d  dir_acc={mv['5d']['dir_acc']}  CI={mv['5d']['ci95']}  beats_050={mv['5d']['beats_050']}")
    print(f"      recomputed CI={ci_checks['5d']['recomputed_ci95']}  match={ci_checks['5d']['match']}")
    print(f"\nh=10d dir_acc={mv['10d']['dir_acc']}  CI={mv['10d']['ci95']}  beats_050={mv['10d']['beats_050']}")
    print(f"      recomputed CI={ci_checks['10d']['recomputed_ci95']}  match={ci_checks['10d']['match']}")
    print(f"\nh=21d dir_acc={mv['21d']['dir_acc']}  CI={mv['21d']['ci95']}  beats_050={mv['21d']['beats_050']}")
    print(f"      recomputed CI={ci_checks['21d']['recomputed_ci95']}  match={ci_checks['21d']['match']}")

    print(f"\nIndividual model dir_acc @ h=5d:")
    for name, info in h5_individual.items():
        print(f"  {name:20s}: n={info['n']}  dir_acc={info['dir_acc']}")
    print(f"\n  min={h5_min}  max={h5_max}  ensemble={h5_ens}  within_range={within_range}")

    print(f"\nper_stock_matrix: {len(psm)} cells = {n_symbols} syms × {n_models} models × {n_hoz} horizons")
    print(f"  consistent_360_cells = {matrix_consistent}")

    print(f"\nOVERALL VERDICT:")
    print(f"  CI math correct         : {report['overall_verdict']['ci_math_correct']}")
    print(f"  matrix consistent       : {report['overall_verdict']['matrix_consistent']}")
    print(f"  ensemble within range   : {report['overall_verdict']['ensemble_within_individual_range']}")
    print(f"  CLAIM VERIFIED          : {report['overall_verdict']['claim_verified']}")
    print(f"\nWrote: {OUT}")


if __name__ == "__main__":
    main()
