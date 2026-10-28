import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/backtest/walk-forward/trading
//
// Task 59 — READ-ONLY endpoint serving the genuine walk-forward trading
// evaluation artifact (data/backtest_reports/walk_forward_trading_latest.json).
//
// This is a GENUINE out-of-sample ML trading simulation driven by the stored
// pilot25 predictions + historical OHLCV bars, with realistic execution
// (next-session open entry), progressive TP/SL handling (via the shared
// tp-sl-engine), trading costs (standard_psx profile), and honest net-P&L
// reporting. It is DISTINCT from:
//   (a) the forecast-quality evaluation (/api/backtest/walk-forward — R²/MAE/DirAcc),
//   (b) the signal-stats current-signal replay (/api/backtest/signal-stats),
//   (c) the backtest.ts technical-rule strategy (/api/backtest/ensembles, /api/backtest/run).
//
// The trading evaluation is NEVER started from an API request — it is
// invoked explicitly from the local environment:
//   bun scripts/walk_forward_trading_evaluator.ts
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const artifactPath = path.join(
    process.cwd(),
    "data",
    "backtest_reports",
    "walk_forward_trading_latest.json"
  );
  try {
    const raw = await fs.readFile(artifactPath, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json({ available: true, ...data });
  } catch {
    return NextResponse.json({
      available: false,
      note:
        "Walk-forward trading artifact not found. Run: bun scripts/walk_forward_trading_evaluator.ts " +
        "(requires the completed pilot25 run at data/backtest_reports/runs/pilot25_step50_20261028/ + " +
        "the OHLCV DB). This artifact does NOT modify walk_forward_latest.json, pilot25_robustness.json, " +
        "or ml_predictions_multi.json.",
    });
  }
}
