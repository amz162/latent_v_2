import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/backtest/walk-forward/trading-robustness
// Task 60 — READ-ONLY endpoint serving the trading-robustness artifact
// (per-model/horizon/strategy/cost breakdown + date-block bootstrap CIs +
// cost reconciliation + selection-bias warnings). Distinct from the Task 59
// trading report (aggregate metrics) + the Task 56 robustness report
// (forecast-quality uncertainty). Does NOT modify any existing artifacts.

export async function GET(req: Request) {
  const __g = await guardUser(req, "feature.backtest_reports");
  if (__g) return __g;
  const artifactPath = path.join(process.cwd(), "data", "backtest_reports", "walk_forward_trading_robustness.json");
  try {
    const raw = await fs.readFile(artifactPath, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json({ available: true, ...data });
  } catch {
    return NextResponse.json({
      available: false,
      note: "Trading-robustness artifact not found. Run: bun scripts/walk_forward_trading_robustness.ts (requires the completed pilot25 run + OHLCV DB).",
    });
  }
}
