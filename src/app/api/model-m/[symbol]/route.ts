// ============================================================================
// Task 129 — Model M API (per symbol).
//
// GET  /api/model-m/[symbol]  → data-quality report + latest analysis +
//                               analysis history + evidence coverage.
// POST /api/model-m/[symbol]  → run a fresh GLM-4.6 analysis. REFUSED with a
//                               clear reason when the underlying price data is
//                               STALE / UNAVAILABLE / FAILED (the UI shows the
//                               cached analysis with the stale badge instead).
//
// Every analysis is APPEND-ONLY history: a new run never replaces an older
// one. Research-only — never an order, never a short, never real money.
// Permission: tab.model_m (the GLM call also honours the platform LLM master
// switch through the Task 111 engine's provider path).
// ============================================================================
import { NextResponse } from "next/server";
import { guardUser } from "@/lib/latent/access-control";
import {
  getDataQuality,
  getAnalysisHistory,
  runModelMAnalysis,
  EVIDENCE_DIR,
  MODEL_M_ENGINE_VERSION,
} from "@/lib/latent/model-m/engine";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RESEARCH_NOTICE = {
  status: "research_only",
  notice: "RESEARCH ONLY — NOT AN APPROVED LIVE TRADING SIGNAL",
};

function latestDecisionFile(symbol: string): unknown | null {
  try {
    const dir = path.join(EVIDENCE_DIR, symbol);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (!files.length) return null;
    return JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), "utf8"));
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const __g = await guardUser(req, "tab.model_m");
  if (__g) return __g;
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!symbol) return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  try {
    const dataQuality = await getDataQuality(symbol);
    const history = await getAnalysisHistory(symbol, 20);
    const latest = history[0] ?? null;
    const evidencePackage = latest?.evidencePackageId ? latestDecisionFile(symbol) : null;
    return NextResponse.json({
      ...RESEARCH_NOTICE,
      engineVersion: MODEL_M_ENGINE_VERSION,
      dataQuality,
      latestAnalysis: latest,
      historyCount: history.length,
      history,
      evidencePackage: evidencePackage
        ? { packageId: (evidencePackage as { packageId?: string }).packageId ?? null,
            contentHash: (evidencePackage as { contentHash?: string }).contentHash ?? null,
            qualityFlags: (evidencePackage as { qualityFlags?: string[] }).qualityFlags ?? [] }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error)?.message ?? e) }, { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const __g = await guardUser(req, "tab.model_m");
  if (__g) return __g;
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!symbol) return NextResponse.json({ error: "invalid symbol" }, { status: 400 });

  let body: { horizon?: "5d" | "10d" | "21d" } = {};
  try {
    body = await req.json();
  } catch { /* empty body is fine */ }
  const horizon = body.horizon === "5d" || body.horizon === "21d" ? body.horizon : "10d";

  try {
    const result = await runModelMAnalysis(symbol, { analysisHorizon: horizon, trigger: "user_request" });
    if ("blocked" in result && result.blocked) {
      return NextResponse.json({
        ...RESEARCH_NOTICE,
        blocked: true,
        reason: result.reason,
        dataQuality: result.dataQuality,
      }, { status: 409 });
    }
    if ("error" in result && result.error) {
      return NextResponse.json({ ...RESEARCH_NOTICE, error: result.reason }, { status: 503 });
    }
    return NextResponse.json({ ...RESEARCH_NOTICE, result });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error)?.message ?? e) }, { status: 500 }
    );
  }
}
