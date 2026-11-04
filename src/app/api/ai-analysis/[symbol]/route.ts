// ============================================================================
// Task 111 — AI Fundamental + Technical Analysis API (per symbol).
// Returns the immutable LLM research-signal record for the requested symbol.
// The record was produced by the deterministic evidence->LLM->validation->R:R
// pipeline and stored under data/backtest_reports/task111/signals/.
// ============================================================================
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const SIG_DIR = path.join(process.cwd(), "data", "backtest_reports", "task111", "signals");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  try {
    const rec = JSON.parse(await fs.readFile(path.join(SIG_DIR, `${symbol}.json`), "utf8"));
    return NextResponse.json({
      status: "research_only",
      notice: "RESEARCH ONLY — NOT AN APPROVED LIVE TRADING SIGNAL",
      generation: rec.generationId ?? "task111-llm-multisource-gen1",
      signal: rec,
    });
  } catch {
    return NextResponse.json(
      {
        error: "no_llm_research_signal_for_symbol",
        symbol,
        status: "unavailable",
        notice: "No validated LLM research signal exists for this symbol (missing, stale or rejected evidence is never fabricated).",
      },
      { status: 404 }
    );
  }
}
