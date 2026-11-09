// ============================================================================
// Task 112 — LLM signal-history export API (read-only).
// ?format=csv|json ; applies the same filters as the list API. Exports
// preserve timestamps, source references, model versions and research-only
// labels exactly as persisted.
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import { applyFilter, loadAllRecords, type SignalFilter } from "@/lib/latent/llm/signal-history";
import { gateUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

const CSV_FIELDS = [
  "signalId", "symbol", "companyName", "decision", "llmState", "llmSignal",
  "llmConvictionScore", "evidenceQualityScore", "calibratedNetPositiveProbability",
  "decisionTimestamp", "dataCutoff", "provider", "model", "promptVersion",
  "evidenceSchemaVersion", "outputSchemaVersion", "evidenceHash", "validationStatus",
  "rejectionReason", "forwardCohortId", "generationId", "riskPolicyVersion",
  "researchStatus", "provenance", "recordType", "mockRecord", "staleSkipped",
  "llmFailureReason", "finalSignalReason",
] as const;

export async function GET(req: NextRequest) {
  const __task121_gate = await gateUser(req, {"permission": "feature.reports_export", "usage": "report_export"});
  if (__task121_gate instanceof Response) return __task121_gate;
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
  const format = sp.get("format") === "csv" ? "csv" : "json";
  const records = applyFilter(await loadAllRecords(), filter);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  if (format === "csv") {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [CSV_FIELDS.join(",")];
    for (const r of records) {
      lines.push(CSV_FIELDS.map((f) => esc((r as unknown as Record<string, unknown>)[f])).join(","));
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="llm_signal_history_${stamp}.csv"`,
      },
    });
  }
  return new NextResponse(
    JSON.stringify(
      {
        status: "research_only",
        notice: "SHADOW / RESEARCH ONLY — NOT AN ORDER",
        exported_at: new Date().toISOString(),
        filter,
        count: records.length,
        records,
      },
      null,
      1
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="llm_signal_history_${stamp}.json"`,
      },
    }
  );
}
