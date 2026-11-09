// ============================================================================
// Task 111 — small read-only API serving the volatility-overlay research
// summary and the option-market availability status (from the committed
// task111 artifacts). Additive: no existing behavior is modified.
// ============================================================================
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

const T111 = path.join(process.cwd(), "data", "backtest_reports", "task111");

async function readArtifact(name: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(path.join(T111, name), "utf8"));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const __g = await guardUser(req, "tab.llm_signals");
  if (__g) return __g;
  const [overlays, optionAudit, drawdown] = await Promise.all([
    readArtifact("task111_volatility_overlay_backtest.json"),
    readArtifact("task111_option_availability_audit.json"),
    readArtifact("task111_drawdown_comparison.json"),
  ]);
  return NextResponse.json({
    status: overlays ? "completed" : "unavailable",
    overlays,
    optionAvailability: optionAudit,
    drawdownComparison: drawdown,
    notice: "RESEARCH ONLY — overlays are simulated protective rules, not guarantees; realized vol is never implied vol",
  });
}
