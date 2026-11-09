// ============================================================================
// Task 112 — LLM Signals list API (read-only).
// Serves the append-only signal-history store with filters + pagination.
// Every persisted decision state is visible: BUY / HOLD / NO_TRADE /
// SELL_TO_CLOSE / BEARISH_RESEARCH_ONLY / llm_unavailable / rejected / stale.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { querySignals, type SignalFilter } from "@/lib/latent/llm/signal-history";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const __g = await guardUser(req, "tab.llm_signals");
  if (__g) return __g;
  const sp = req.nextUrl.searchParams;
  const filter: SignalFilter = {
    symbol: sp.get("symbol") || undefined,
    company: sp.get("company") || undefined,
    decision: sp.get("decision") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    provider: sp.get("provider") || undefined,
    promptVersion: sp.get("promptVersion") || undefined,
    cohort: sp.get("cohort") || undefined,
    freshness: sp.get("freshness") || undefined,
    validationStatus: sp.get("validationStatus") || undefined,
    evidenceCompleteness: sp.get("evidenceCompleteness") || undefined,
    q: sp.get("q") || undefined,
    includeMock: sp.get("includeMock") === "1",
    recordType: (sp.get("recordType") as "REAL_LLM_DECISION" | "MOCK_PIPELINE_CHECK" | null) || undefined,
  };
  const page = Math.max(1, Number(sp.get("page") || "1"));
  const pageSize = Math.min(200, Math.max(5, Number(sp.get("pageSize") || "25")));
  try {
    const result = await querySignals(filter, page, pageSize);
    return NextResponse.json({
      status: "research_only",
      notice: "SHADOW / RESEARCH ONLY — NOT AN ORDER",
      ...result,
    });
  } catch (e) {
    return NextResponse.json({ error: `signal_history_unavailable: ${String(e).slice(0, 120)}` }, { status: 500 });
  }
}
