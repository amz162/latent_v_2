import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
// GET /api/backtest/walk-forward/portfolio — Task 61 portfolio simulation artifact
export async function GET() {
  const p = path.join(process.cwd(), "data", "backtest_reports", "walk_forward_portfolio_latest.json");
  try { const raw = await fs.readFile(p, "utf8"); return NextResponse.json({ available: true, ...JSON.parse(raw) }); }
  catch { return NextResponse.json({ available: false, note: "Portfolio artifact not found. Run: bun scripts/walk_forward_portfolio_simulator.ts" }); }
}
