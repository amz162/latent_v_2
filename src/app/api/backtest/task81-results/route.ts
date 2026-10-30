import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
// GET /api/backtest/task81-results — v2 cost-corrected historical strategy comparison
// (3 risk variants × 3 strategies × 2 tax profiles × 5 models × 3 horizons × 2 periods)
export async function GET() {
  try {
    const p = path.join(process.cwd(), "data", "backtest_reports", "task81_cost_rr_results_v1.json");
    const raw = await fs.readFile(p, "utf8");
    const data = JSON.parse(raw);
    return NextResponse.json({
      available: true,
      generated_at: new Date().toISOString(),
      costProfile: "psx_user_schedule_v2",
      candidatesTotal: data.candidatesTotal,
      resultRows: data.resultRows,
      cells: data.cells,
      overall: data.overall,
      perCell: data.perCell,
      limitations: data.limitations,
    });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message }, { status: 500 });
  }
}
