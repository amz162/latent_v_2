import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export async function GET() {
  const p = path.join(process.cwd(), "data", "backtest_reports", "prospective_paper_trading_latest.json");
  try { const raw = await fs.readFile(p, "utf8"); return NextResponse.json({ available: true, ...JSON.parse(raw) }); }
  catch { return NextResponse.json({ available: false, note: "Run: bun scripts/prospective_paper_trading.ts" }); }
}
