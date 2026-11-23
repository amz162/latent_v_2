// ============================================================================
// Task 129 — Model M API (universe level).
// GET /api/model-m            → universe freshness list (search + statuses).
// Permission: tab.model_m (enforced identically server-side).
// ============================================================================
import { NextResponse } from "next/server";
import { guardUser } from "@/lib/latent/access-control";
import { getUniverseFreshness } from "@/lib/latent/model-m/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const __g = await guardUser(req, "tab.model_m");
  if (__g) return __g;
  try {
    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 40) || 40));
    const data = await getUniverseFreshness(limit);
    return NextResponse.json({
      status: "research_only",
      notice: "RESEARCH ONLY — NOT AN APPROVED LIVE TRADING SIGNAL",
      ...data,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error)?.message ?? e), notice: "universe freshness unavailable" },
      { status: 500 }
    );
  }
}
