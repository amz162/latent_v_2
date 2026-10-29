import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import {
  buildGraphPoints,
  periodRangeFor,
  SUPPORTED_HORIZONS,
  SUPPORTED_MODELS,
  SUPPORTED_PERIODS,
  VERIFY_TOLERANCE,
  type SampleRecord,
} from "@/lib/latent/ml-graph-points";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/backtest/model-graph/ml
// Task 72/74 — Genuine trained-ML actual-vs-predicted PRICE graph.
// Reads raw walk-forward sample records (NOT strategySignal) and verifies each
// point's actual price against the OBSERVED OHLCV close at the target session.
//
// Only VERIFIED points enter the comparison series (`points`). Mismatch and
// unavailable-target records are returned separately as `diagnostics` and are
// NEVER charted as verified observations.
//
// predictedPrice = decisionClose × (1 + predictedForwardReturn)   [unchanged forecast]
// actualPrice    = observed OHLCV close at decision_date + horizon trading sessions
//                  (session-indexed over the per-symbol chronological bar list —
//                   matches walk_forward_backtesting.py's `ste.iloc[i + horizon]`).
// calculated_actual_price = decisionClose × (1 + actualReturn) is kept ONLY as a
//                  validation check against the observed close.

const RUN_DIR = "data/backtest_reports/runs/pilot25_step50_20261028";
const MANIFEST_PATH = path.join(RUN_DIR, "manifest.json");
const SAMPLES_DIR = path.join(RUN_DIR, "samples");

function isString(v: unknown): v is string {
  return typeof v === "string";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const model = url.searchParams.get("model") || "XGBoost";
    const horizon = parseInt(url.searchParams.get("horizon") || "5", 10);
    const period = url.searchParams.get("period") || "final-test";

    if (!symbol) {
      return NextResponse.json(
        { available: false, error: "Missing symbol" },
        { status: 400 }
      );
    }
    if (!SUPPORTED_MODELS.includes(model as never)) {
      return NextResponse.json(
        {
          available: false,
          error: `Unsupported model: ${model}. Supported: ${SUPPORTED_MODELS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!SUPPORTED_HORIZONS.includes(horizon as never)) {
      return NextResponse.json(
        {
          available: false,
          error: `Unsupported horizon: ${horizon}. Supported: ${SUPPORTED_HORIZONS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!SUPPORTED_PERIODS.includes(period as never)) {
      return NextResponse.json(
        {
          available: false,
          error: `Unsupported period: ${period}. Supported: ${SUPPORTED_PERIODS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Read manifest for val_end_idx + n_samples + run_id.
    const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
    const valEndIdx = manifest.val_end_idx;
    const nSamples = manifest.n_samples;
    const { startIdx, endIdx } = periodRangeFor(
      period as "validation" | "final-test",
      valEndIdx,
      nSamples
    );

    // Load chronological OHLCV bars for the symbol (for observed-close lookup).
    const dbBars = await db.ohlcvBar.findMany({
      where: { symbol },
      orderBy: { date: "asc" },
      select: { date: true, close: true },
    });
    const bars = dbBars.map((b) => ({ date: b.date, close: b.close }));

    // Read sample records in the selected period range (fail safely per file).
    const candidates: SampleRecord[] = [];
    let nCorrupt = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const samplePath = path.join(
        SAMPLES_DIR,
        `sample_${String(i).padStart(6, "0")}.json`
      );
      try {
        const raw = JSON.parse(await fs.readFile(samplePath, "utf8"));
        if (raw && typeof raw === "object" && isString(raw.stock)) {
          candidates.push(raw as SampleRecord);
        } else {
          nCorrupt++;
        }
      } catch {
        nCorrupt++;
      }
    }

    // Delegate ALL verification / counting / classification to the pure builder.
    const result = buildGraphPoints(
      candidates,
      symbol,
      model,
      horizon,
      bars
    );

    // Reconciliation invariant (asserted for honesty):
    //   n_candidates == n_valid_points + n_omitted + n_duplicates
    //   n_valid_points == n_verified + n_mismatch + n_unavailable_target
    const reconcileCandidates =
      result.n_valid_points + result.n_omitted + result.n_duplicates;
    const reconcileValid =
      result.n_verified + result.n_mismatch + result.n_unavailable_target;

    return NextResponse.json({
      available: true,
      status:
        result.n_verified > 0
          ? "ok"
          : result.n_candidates > 0
            ? "no-verified-points"
            : "no-candidates",
      source_run_id: manifest.run_id,
      schema_version: "2.0",
      model,
      horizon,
      symbol,
      period,
      n_candidates: result.n_candidates,
      n_valid_points: result.n_valid_points,
      n_verified: result.n_verified,
      n_mismatch: result.n_mismatch,
      n_unavailable_target: result.n_unavailable_target,
      n_omitted: result.n_omitted,
      n_duplicates: result.n_duplicates,
      n_corrupt_files: nCorrupt,
      // Verified comparison series ONLY — safe to chart.
      points: result.points,
      // Diagnostics — mismatch + unavailable_target. Never charted as verified.
      diagnostics: result.diagnostics,
      reconcile: {
        candidates: `${result.n_candidates} == ${reconcileCandidates} (${
          result.n_candidates === reconcileCandidates ? "OK" : "BROKEN"
        })`,
        valid: `${result.n_valid_points} == ${reconcileValid} (${
          result.n_valid_points === reconcileValid ? "OK" : "BROKEN"
        })`,
      },
      tolerance_pkr: VERIFY_TOLERANCE,
      methodology:
        "predictedPrice = decisionClose × (1 + predictedForwardReturn) [ORIGINAL forecast, unmodified]. " +
        "actualPrice = OBSERVED OHLCV close at target session (decision_date + horizon trading sessions, " +
        "session-indexed over per-symbol chronological bars — matches walk_forward_backtesting.py ste.iloc[i+horizon]). " +
        "calculated_actual_price = decisionClose × (1 + actualReturn) is a VALIDATION check only; a point is " +
        "'verified' iff |calculated − observed| <= tolerance. 'points' contains VERIFIED records only; " +
        "mismatch / unavailable_target records are in 'diagnostics' and are never charted.",
      data_source: `Raw walk-forward sample records from ${RUN_DIR}/samples/. NOT strategySignal. NOT prospective PredictionHistory.`,
      limitations: [
        "Historical out-of-sample predictions from the pilot25 walk-forward evaluation (Task 55). NOT live forecasts.",
        "These are genuinely trained-ML predictions — NOT technical-rule strategySignal outputs.",
        "The graph shows predicted vs actual TARGET PRICES at the forecast horizon, not intraday paths.",
        "Sparse decision dates reflect the 50-session sampling cadence — gaps are real, not missing data.",
        "Only VERIFIED points (observed close agrees with calculated actual within tolerance) are plotted. " +
          "Mismatches and missing-target records appear in the diagnostics table, never as verified observations.",
        "Do NOT claim predictive skill from a graph's visual appearance.",
      ],
    });
  } catch (e: any) {
    return NextResponse.json(
      { available: false, error: e?.message || "Failed to load ML graph data" },
      { status: 500 }
    );
  }
}
