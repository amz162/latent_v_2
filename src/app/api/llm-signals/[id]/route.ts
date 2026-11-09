// ============================================================================
// Task 112 — LLM Signals detail API (read-only).
// Returns the immutable signal record plus its retained evidence package
// (when one exists for the symbol). No record mutation, no fabrication:
// if evidence was not retained the response says so explicitly.
// ============================================================================
import { NextResponse } from "next/server";
import { findRecord, findEvidence, freshnessOf } from "@/lib/latent/llm/signal-history";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const __g = await guardUser(_req, "tab.llm_signals");
  if (__g) return __g;
  const { id } = await params;
  const record = await findRecord(id);
  if (!record) {
    return NextResponse.json({ error: "signal_not_found", signalId: id }, { status: 404 });
  }
  const evidence = await findEvidence(record.symbol ?? "");
  return NextResponse.json({
    status: "research_only",
    notice: "SHADOW / RESEARCH ONLY — NOT AN ORDER",
    signal: record,
    freshness: freshnessOf(record),
    evidence: evidence,
    evidenceNote: evidence
      ? "Evidence package retained for this symbol (current-generation snapshot; llm_analysis_current_only)."
      : "Evidence package not retained for this record (generation-cache-only history entry); the signal record itself remains immutable.",
  });
}
