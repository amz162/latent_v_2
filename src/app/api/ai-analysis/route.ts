// ============================================================================
// Task 111 — AI Fundamental + Technical Analysis API (list).
// Serves the LLM research-signal records for the current shadow generation.
// RESEARCH ONLY: these are LLM research signals, never trading orders.
// ============================================================================
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

const SIG_DIR = path.join(process.cwd(), "data", "backtest_reports", "task111", "signals");

export async function GET(req: Request) {
  const __g = await guardUser(req, "tab.llm_signals");
  if (__g) return __g;
  try {
    const files = (await fs.readdir(SIG_DIR)).filter((f) => f.endsWith(".json") && !f.endsWith(".evidence.json"));
    const rows: Array<{
      symbol: string; finalSignal: string; llmState: string; llmConviction: number | null;
      evidenceQuality: number; dataCutoff: string; decisionTimestamp: string; provider: string; model: string;
      rrStatus: string | null; rrTp2: number | null; staleSkipped: boolean;
    }> = [];
    for (const f of files) {
      try {
        const d = JSON.parse(await fs.readFile(path.join(SIG_DIR, f), "utf8"));
        rows.push({
          symbol: d.symbol,
          finalSignal: d.finalSignal,
          llmState: d.llmState,
          llmConviction: d.llmConvictionScore,
          evidenceQuality: d.evidenceQualityScore,
          dataCutoff: d.dataCutoff,
          decisionTimestamp: d.decisionTimestamp,
          provider: d.provider,
          model: d.model,
          rrStatus: d.riskReward?.risk_reward_status ?? null,
          rrTp2: d.riskReward?.rr_to_tp2 ?? null,
          staleSkipped: Boolean(d.staleSkipped),
        });
      } catch {
        /* skip unreadable record */
      }
    }
    rows.sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
    return NextResponse.json({
      status: "research_only",
      notice: "RESEARCH ONLY — NOT AN APPROVED LIVE TRADING SIGNAL",
      generation: "task111-llm-multisource-gen1",
      count: rows.length,
      signals: rows,
    });
  } catch {
    return NextResponse.json({ error: "no task111 signal store found", status: "unavailable" }, { status: 404 });
  }
}
