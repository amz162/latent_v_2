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
  // Task 52: deterministic universe selector metadata + per-stock diagnostics
  universe?: {
    mode: "canonical8" | "pilot25" | "pilot50" | "full_db" | string;
    criteria?: string;
    candidate_count?: number;
    included_count?: number;
    excluded_count?: number;
    exclusions?: Array<{ symbol: string; reason: string; bars: number; min_required: number }>;
    eligible_count?: number;
    target_count?: number;
    min_bars_required?: number | null;
    data_source?: string;
  };
  per_stock_results?: Record<string, {
    samples_count: number;
    models: Record<string, Record<string, any>>;
  }>;
  forecast_horizons?: number[];
  // Task 51 Phase 5: explicit sample-count metadata
  n_eligible_samples?: number;
  n_unique_stock_date_samples?: number | null;
  n_model_fits?: number | null;
  n_unique_prediction_dates?: number | null;
  sampling_interval_sessions?: number | null;
  n_evaluated_models?: number | null;
  n_evaluated_horizons?: number | null;
  n_matured_outcomes?: Record<string, number>;
  n_incomplete_or_excluded_outcomes?: Record<string, number>;
  models?: WFModel[];
  // Task 51 Phase 3: baselines (zero-return + training-only-mean + constant-mean)
  baselines?: any;
  baseline?: { definition?: string; notes?: string };  // legacy alias
  limitations?: string[];
  unevaluated?: Array<{ model: string; horizon: number; reason: string }>;
  ml_integrity?: Record<string, string>;
  trading_metrics?: {
    individual?: Record<string, any>;
    ensemble?: Record<string, any>;
    label?: string;
    definition?: string;
    net_trading_pnl?: string;
    net_trading_pnl_reason?: string;
  };
  // Task 51 Phase 2: WIN_RATE_WEIGHTED ensemble methodology
  win_rate_weighted_ensemble_methodology?: any;
  // Task 51 Phase 1: per-sample maturity metadata summary
  sample_maturity_metadata_summary?: any;
  // Task 54: resumable-run metadata (run id, point-in-time cutoff, fingerprints)
  run?: {
    architecture?: string;
    run_id?: string;
    manifest_path?: string;
    chunk_size_requested?: number;
    point_in_time_selection?: string;
    universe_selection_cutoff?: string | null;
    universe_fingerprint?: string;
    data_fingerprint?: string;
    sample_records_dir?: string;
    promotion_rule?: string;
  } | null;
  error?: string;
  how_to_generate?: string;
}

const HOW_TO_GENERATE =
  "Generate the report with: python3 scripts/walk_forward_backtesting.py " +
  "(writes data/backtest_reports/walk_forward_latest.json; does NOT touch " +
  "data/ml_predictions_multi.json). Universe modes: WALK_FORWARD_UNIVERSE=" +
  "canonical8 (default) | pilot25 | pilot50 | full_db.";

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
    // Task 51: pass through the new schema v1.1 fields (sample metadata,
    // baselines, win_rate_weighted methodology, sample-maturity metadata).
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
      // Task 52: universe selector metadata + per-stock results
      universe: report.universe ?? null,
      per_stock_results: report.per_stock_results ?? {},
      forecast_horizons: Array.isArray(report.forecast_horizons)
        ? report.forecast_horizons
        : [],
      // Task 51 Phase 5: explicit sample-count metadata
      n_eligible_samples: report.n_eligible_samples ?? 0,
      n_unique_stock_date_samples: report.n_unique_stock_date_samples ?? null,
      n_model_fits: report.n_model_fits ?? null,
      n_unique_prediction_dates: report.n_unique_prediction_dates ?? null,
      sampling_interval_sessions: report.sampling_interval_sessions ?? null,
      n_evaluated_models: report.n_evaluated_models ?? null,
      n_evaluated_horizons: report.n_evaluated_horizons ?? null,
      n_matured_outcomes: report.n_matured_outcomes ?? {},
      n_incomplete_or_excluded_outcomes:
        report.n_incomplete_or_excluded_outcomes ?? {},
      models: Array.isArray(report.models) ? report.models : [],
      // Task 51 Phase 3: baselines (zero-return + training-only-mean + constant-mean)
      baselines: report.baselines ?? report.baseline ?? {},
      baseline: report.baseline ?? {},  // legacy alias for backward compat
      limitations: Array.isArray(report.limitations) ? report.limitations : [],
      unevaluated: Array.isArray(report.unevaluated) ? report.unevaluated : [],
      ml_integrity: report.ml_integrity ?? {},
      trading_metrics: report.trading_metrics ?? {},
      // Task 51 Phase 2: WIN_RATE_WEIGHTED ensemble methodology (frozen validation weights)
      win_rate_weighted_ensemble_methodology:
        report.win_rate_weighted_ensemble_methodology ?? null,
      // Task 51 Phase 1: per-sample maturity metadata summary
      sample_maturity_metadata_summary:
        report.sample_maturity_metadata_summary ?? null,
      // Task 54: resumable-run metadata (progress endpoint: /api/backtest/walk-forward/status)
      run: report.run ?? null,
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
