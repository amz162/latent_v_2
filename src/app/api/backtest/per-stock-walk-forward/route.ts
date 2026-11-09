import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { guardUser } from "@/lib/latent/access-control";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
// GET /api/backtest/per-stock-walk-forward — per-symbol per-model walk-forward matrix
export async function GET(req: Request) {
  const __g = await guardUser(req, "feature.backtest_reports");
  if (__g) return __g;
  try {
    const p = path.join(process.cwd(), "data/backtest_reports/task87/task87_per_stock_walk_forward.json");
    const raw = await fs.readFile(p, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ available: true, ...data, generatedAt: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message, cells: [], count: 0 }, { status: 500 });
  }
}
