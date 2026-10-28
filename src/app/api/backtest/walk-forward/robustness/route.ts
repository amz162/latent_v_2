import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/backtest/walk-forward/robustness
//
// Task 56 — READ-ONLY endpoint serving the pilot25 statistical robustness
// artifact (data/backtest_reports/pilot25_robustness.json).
//
// This artifact is produced by scripts/pilot25_robustness_analysis.py, which
// recomputes metrics FROM RAW per-sample predictions (never from aggregated
// chunk-level statistics) and adds:
//   - Phase 2: model vs zero-return + training-only-mean baselines on the SAME
//     eligible matured observations, with paired absolute-error differences.
//   - Phase 3: date-block bootstrap 95% CIs (block on decision date, preserving
//     cross-stock same-date dependence; same-stock windows do NOT overlap when
//     sample_step >= max horizon).
//   - Phase 4: per-stock consistency (n samples, MAE, RMSE, R², DirAcc per
//     stock; unavailable stocks honestly reported).
//   - Phase 5: ensemble-weight verification (all-1.0 weights = effectively
//     equal-weighted, NOT learned weighting).
//
// The artifact is LINKED to the completed pilot25 run via source_run_id +
// data_fingerprint + universe_fingerprint. It does NOT modify
// walk_forward_latest.json or ml_predictions_multi.json.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const artifactPath = path.join(
    process.cwd(),
    "data",
    "backtest_reports",
    "pilot25_robustness.json"
  );
  try {
    const raw = await fs.readFile(artifactPath, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json({
      available: true,
      ...data,
    });
  } catch {
    return NextResponse.json({
      available: false,
      note:
        "Robustness artifact not found. Run: python3 scripts/pilot25_robustness_analysis.py " +
        "(requires the completed pilot25 run at " +
        "data/backtest_reports/runs/pilot25_step50_20261028/). " +
        "This artifact does NOT modify walk_forward_latest.json or ml_predictions_multi.json.",
    });
  }
}
