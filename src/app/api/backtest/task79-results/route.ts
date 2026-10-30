import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { reconcileCounts } from "@/lib/latent/prospective-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/backtest/task79-results — Task 78 historical strategy + Task 79 new models + audit + DB counts.

export async function GET() {
  try {
    const readJson = async (p: string) => {
      try { return JSON.parse(await fs.readFile(path.join(process.cwd(), p), "utf-8")); }
      catch { return null; }
    };
    const [t78Strat, t79Models, t79Audit, counts] = await Promise.all([
      readJson("data/backtest_reports/task78_strategy_results_v1.json"),
      readJson("data/backtest_reports/task79_model_results.json"),
      readJson("data/backtest_reports/task79_model_research_audit.json"),
      reconcileCounts(),
    ]);
    return NextResponse.json({
      available: true,
      generated_at: new Date().toISOString(),
      task78_historical_strategy: t78Strat ? {
        buyCandidates: t78Strat.buyCandidates, resultRows: t78Strat.resultRows,
        overallByStrategy: t78Strat.overallByStrategy, perCellCount: t78Strat.perCell?.length ?? 0,
        limitations: t78Strat.limitations,
      } : null,
      task79_new_models: t79Models ? {
        experiment_id: t79Models.experiment_id, model_version: t79Models.model_version,
        new_models: t79Models.new_models, artifacts: Object.keys(t79Models.artifacts ?? {}).length,
        live_predictions: t79Models.live_predictions_total, models: t79Models.models,
        honest_disclosure: t79Models.honest_disclosure,
      } : null,
      task79_research_audit: t79Audit ? {
        total_bars: t79Audit.total_bars, date_range: t79Audit.date_range,
        stale_symbols: t79Audit.stale_symbols, target_distributions: t79Audit.target_distributions,
        existing_model_weaknesses_summary: t79Audit.existing_model_weaknesses_summary,
        new_model_rationale: t79Audit.new_model_rationale,
      } : null,
      prospective_counts: counts,
    });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message }, { status: 500 });
  }
}
