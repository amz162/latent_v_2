import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/backtest/walk-forward
//
// Serves data/backtest_reports/walk_forward_latest.json — the structured
// walk-forward ML forecast evaluation produced ONLY by:
//
//   python3 scripts/walk_forward_backtesting.py
//
// (5 classical models × 3 forecast horizons × 8 canonical stocks, per-sample
// expanding-window retraining on data[date < sample.date], per-horizon dropna,
// realized outcomes from future OHLCV. NO data leakage. R² can be negative —
// that's honest.)
//
// This artifact is SEPARATE from data/ml_predictions_multi.json (which we must
// NOT modify). The script writes ONLY to:
//   - data/walk_forward_backtesting.json (legacy format, kept for backward compat)
//   - data/backtest_reports/walk_forward_latest.json (NEW structured schema v1.0)
//
// If the artifact is missing / malformed / outdated, return available:false with
// a clear error + instructions. Never fabricate metrics. Never use the current
// stored prediction for a historical ML prediction. Never silently turn an
// unavailable metric into zero.
// ─────────────────────────────────────────────────────────────────────────────

export interface WFHorizonMetrics {
  status: "completed" | "unavailable";
  reason?: string;
  mae?: number | null;
  rmse?: number | null;
  r2?: number | null;  // can be NEGATIVE — that's honest
  directional_accuracy?: number | null;
  n_observations?: number;
  baseline?: {
    definition?: string;
    mae?: number | null;
    rmse?: number | null;
    r2?: number | null;
  };
}

export interface WFModel {
  name: string;
  implementation_type: "trained-ml" | "technical-rule" | "untrained";
  horizons: Record<string, WFHorizonMetrics>;
}

export interface WFReportResponse {
  available: boolean;
  schema_version?: string;
  evaluation_status?: "completed" | "partial" | "failed";
  evaluation_method?: string;
  generated_at?: string;
  data_cutoff?: string | null;
  training_window?: { start: string | null; end: string | null };
  evaluation_date_range?: { start: string | null; end: string | null };
  evaluated_symbols?: string[];
  universe_size?: number;
  forecast_horizons?: number[];
  n_eligible_samples?: number;
  n_matured_outcomes?: Record<string, number>;
  models?: WFModel[];
  baseline?: { definition?: string; notes?: string };
  limitations?: string[];
  unevaluated?: Array<{ model: string; horizon: number; reason: string }>;
  ml_integrity?: Record<string, string>;
  trading_metrics?: {
    individual?: Record<string, any>;
    ensemble?: Record<string, any>;
  };
  error?: string;
  how_to_generate?: string;
}

const HOW_TO_GENERATE =
  "Generate the report with: python3 scripts/walk_forward_backtesting.py " +
  "(writes data/backtest_reports/walk_forward_latest.json; does NOT touch " +
  "data/ml_predictions_multi.json).";

function isValidReport(r: any): boolean {
  if (!r || typeof r !== "object") return false;
  if (typeof r.schema_version !== "string") return false;
  if (typeof r.evaluation_method !== "string") return false;
  if (typeof r.generated_at !== "string") return false;
  if (!Array.isArray(r.models)) return false;
  return true;
}

export async function GET() {
  const reportPath = path.join(
    process.cwd(),
    "data",
    "backtest_reports",
    "walk_forward_latest.json",
  );

  try {
    const raw = await fs.readFile(reportPath, "utf8");
    let report: any;
    try {
      report = JSON.parse(raw);
    } catch {
      return NextResponse.json({
        available: false,
        error:
          "Walk-forward report artifact exists but is malformed JSON. " +
          "Regenerate with: python3 scripts/walk_forward_backtesting.py",
        how_to_generate: HOW_TO_GENERATE,
      } as WFReportResponse);
    }

    if (!isValidReport(report)) {
      return NextResponse.json({
        available: false,
        error:
          "Walk-forward report artifact is structurally invalid " +
          "(missing schema_version / evaluation_method / generated_at / models). " +
          "Regenerate with: python3 scripts/walk_forward_backtesting.py",
        how_to_generate: HOW_TO_GENERATE,
      } as WFReportResponse);
    }

    // Pass through the structured report. The UI is responsible for rendering
    // each model × horizon's metrics honestly — including negative R² values
    // and explicit "unavailable" statuses.
    const response: WFReportResponse = {
      available: true,
      schema_version: report.schema_version,
      evaluation_status: report.evaluation_status,
      evaluation_method: report.evaluation_method,
      generated_at: report.generated_at,
      data_cutoff: report.data_cutoff ?? null,
      training_window: report.training_window ?? { start: null, end: null },
      evaluation_date_range: report.evaluation_date_range ?? {
        start: null,
        end: null,
      },
      evaluated_symbols: Array.isArray(report.evaluated_symbols)
        ? report.evaluated_symbols
        : [],
      universe_size: report.universe_size ?? 0,
      forecast_horizons: Array.isArray(report.forecast_horizons)
        ? report.forecast_horizons
        : [],
      n_eligible_samples: report.n_eligible_samples ?? 0,
      n_matured_outcomes: report.n_matured_outcomes ?? {},
      models: Array.isArray(report.models) ? report.models : [],
      baseline: report.baseline ?? {},
      limitations: Array.isArray(report.limitations) ? report.limitations : [],
      unevaluated: Array.isArray(report.unevaluated) ? report.unevaluated : [],
      ml_integrity: report.ml_integrity ?? {},
      trading_metrics: report.trading_metrics ?? {},
      how_to_generate: HOW_TO_GENERATE,
    };

    return NextResponse.json(response);
  } catch {
    // File missing — honest empty state. Do NOT fabricate metrics.
    return NextResponse.json({
      available: false,
      error:
        "No completed walk-forward evaluation is available yet. " +
        "The data/backtest_reports/walk_forward_latest.json artifact does not exist.",
      how_to_generate: HOW_TO_GENERATE,
      models: [] as WFModel[],
      evaluated_symbols: [] as string[],
      forecast_horizons: [] as number[],
    } as WFReportResponse);
  }
}
