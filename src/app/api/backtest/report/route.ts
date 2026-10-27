import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/backtest/report
//
// Serves data/backtest_report.json — THE single source of performance truth,
// produced ONLY by `python3 scripts/backtest_all_models.py` (purged
// walk-forward, point-in-time liquidity universe, top-10 equal-weight,
// 0.8% round-trip cost, real compounded equity curve).
//
// The report contains a "results" dict keyed by registry model name:
//   { profit_factor, expectancy_pct, cagr_pct, sharpe, max_drawdown_pct,
//     position_win_rate_pct, n_positions, n_periods, ... }
//
// Models that are NOT in the registry (deep-learning / foundation / legacy
// statistical models) are UNMEASURED: this endpoint explicitly lists them as
// such so the UI never shows their old (leaky 20%-holdout) numbers.
// ─────────────────────────────────────────────────────────────────────────────

// Legacy display names (from the old holdout-based generator) mapped onto
// registry entries. Everything else in the old `backtesting` /
// `ensemble_backtesting` blocks is unmeasured.
const LEGACY_NAME_MAP: Record<string, string> = {
  histgbm: "HistGBM (CL-2)",
  lightgbm: "LightGBM",
  xgboost: "XGBoost",
  random_forest: "Random Forest",
  extra_trees: "ExtraTrees (CL-2)",
  ridge: "Ridge Regression",
  logistic: "Logistic (CL-2)",
  momentum_rule: "momentum_rule (baseline)",
};

export interface WFRow {
  key: string;
  name: string;
  legacyName?: string;
  role: string;
  status: "measured" | "insufficient_data" | "unmeasured";
  profitFactor: number | null;
  expectancyPct: number | null;
  cagrPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  positionWinRatePct: number | null;
  nPositions: number | null;
  nPeriods: number | null;
  totalReturnPct: number | null;
  avgWinPct?: number | null;
  avgLossPct?: number | null;
  note?: string;
}

async function readMultiLegacyNames(): Promise<string[]> {
  try {
    const p = path.join(process.cwd(), "data", "ml_predictions_multi.json");
    const raw = JSON.parse(await fs.readFile(p, "utf8"));
    const names = new Set<string>();
    for (const k of Object.keys(raw?.backtesting || {})) names.add(k);
    for (const k of Object.keys(raw?.ensemble_backtesting || {})) names.add(k);
    return Array.from(names);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const p = path.join(process.cwd(), "data", "backtest_report.json");
    const report = JSON.parse(await fs.readFile(p, "utf8"));
    const results: Record<string, any> = report?.results || {};
    const legacyToKey: Record<string, string> = {};
    for (const [k, legacy] of Object.entries(LEGACY_NAME_MAP)) legacyToKey[legacy] = k;

    // Registry rows, sorted by profit factor (baseline kept visible).
    const measured: WFRow[] = Object.entries(results)
      .filter(([, r]) => r?.status === "measured")
      .map(([k, r]) => ({
        key: k,
        name: k === "momentum_rule" ? "Momentum Rule (baseline)" : k.replace(/_/g, " "),
        legacyName: LEGACY_NAME_MAP[k],
        role: r.role || "challenger",
        status: "measured" as const,
        profitFactor: r.profit_factor,
        expectancyPct: r.expectancy_pct,
        cagrPct: r.cagr_pct,
        sharpe: r.sharpe,
        maxDrawdownPct: r.max_drawdown_pct,
        positionWinRatePct: r.position_win_rate_pct,
        nPositions: r.n_positions,
        nPeriods: r.n_periods,
        totalReturnPct: r.total_return_pct,
        avgWinPct: r.avg_win_pct,
        avgLossPct: r.avg_loss_pct,
        note: r.note,
      }))
      .sort((a, b) => (b.profitFactor ?? 0) - (a.profitFactor ?? 0));

    const insufficient: WFRow[] = Object.entries(results)
      .filter(([, r]) => r?.status && r.status !== "measured")
      .map(([k, r]) => ({
        key: k,
        name: k.replace(/_/g, " "),
        legacyName: LEGACY_NAME_MAP[k],
        role: r.role || "challenger",
        status: r.status,
        profitFactor: null, expectancyPct: null, cagrPct: null, sharpe: null,
        maxDrawdownPct: null, positionWinRatePct: null, nPositions: r.n_positions ?? null,
        nPeriods: r.n_periods ?? null, totalReturnPct: null,
      }));

    // Every legacy model/ensemble not in the registry = unmeasured.
    const legacyNames = await readMultiLegacyNames();
    const unmeasured: WFRow[] = legacyNames
      .filter((n) => !(n in legacyToKey))
      .sort()
      .map((n) => ({
        key: n,
        name: n.replace(/_/g, " "),
        role: "unmeasured",
        status: "unmeasured" as const,
        profitFactor: null, expectancyPct: null, cagrPct: null, sharpe: null,
        maxDrawdownPct: null, positionWinRatePct: null, nPositions: null,
        nPeriods: null, totalReturnPct: null,
      }));

    return NextResponse.json({
      available: true,
      generatedAt: report.generated_at,
      generatedBy: report.generated_by,
      sourceOfTruth: report.source_of_truth === true,
      methodology: report.methodology || {},
      assumptions: report.assumptions || {},
      data: report.data || {},
      universe: report.universe || {},
      rows: measured,
      insufficient,
      unmeasured,
      ranking: report.ranking || measured.map((r) => r.key),
    });
  } catch {
    return NextResponse.json({
      available: false,
      error: "No backtest report found. Generate it with: python3 scripts/backtest_all_models.py",
      rows: [] as WFRow[],
      insufficient: [] as WFRow[],
      unmeasured: [] as WFRow[],
    });
  }
}
