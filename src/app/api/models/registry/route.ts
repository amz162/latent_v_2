import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ALL_MODELS } from "@/lib/latent/ensemble";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/models/registry — unified model registry with verified statuses.
// Combines ALL_MODELS (58 canonical) + Task 84 unified metrics + reconciliation.

export async function GET() {
  try {
    const readJson = async (p: string) => {
      try { return JSON.parse(await fs.readFile(path.join(process.cwd(), p), "utf-8")); }
      catch { return null; }
    };
    const [t84Metrics, recon] = await Promise.all([
      readJson("data/backtest_reports/task84/task84_metrics.json"),
      readJson("data/backtest_reports/task84/task84_registry_reconciliation.json"),
    ]);
    const allResults = t84Metrics?.allResults || {};
    // Build registry: one entry per ALL_MODELS item, enriched with Task 84 status + metrics
    const canonical = ALL_MODELS.map((m: any) => {
      // Find matching metrics entry (try exact name, then name without suffixes)
      const exact = allResults[m.name];
      const altName = m.name.replace(" (CL)", "").replace(" (CL-2)", "").replace(" (PI)", "").replace(" (CG)", "").replace(" (GM)", "").replace(" (X)", "");
      const alt = !exact ? allResults[altName] || allResults[m.name + " (Task79)"] : null;
      const r = exact || alt;
      const status = r?.status || (m.trained ? "previously_trained_artifact" : "not_evaluated");
      const metrics = r?.metrics || null;
      const m5 = (metrics && metrics["5d"]) || {};
      return {
        name: m.name,
        tier: m.tier,
        tierLabel: m.tierLabel,
        category: m.category,
        uiTrainedFlag: m.trained,
        verifiedStatus: status,
        metrics: metrics,
        dirAcc5d: m5.directional_accuracy ?? null,
        mae5d: m5.mae ?? null,
        rmse5d: m5.rmse ?? null,
        r2_5d: m5.r2 ?? null,
        rocAuc: m5.roc_auc ?? null,
        n5d: m5.n ?? null,
        elapsed: r?.elapsed_s ?? null,
        isAlias: status?.includes("alias"),
        aliasParent: r?.parent ?? null,
        blockerReason: r?.statusReason || r?.error || null,
      };
    });
    // Supplemental entries (in Task 84 but not in ALL_MODELS)
    const canonicalNames = new Set(ALL_MODELS.map((m: any) => m.name));
    const supplemental = Object.entries(allResults)
      .filter(([name]) => !canonicalNames.has(name))
      .map(([name, r]: any) => ({
        name, verifiedStatus: r.status || "evaluated",
        metrics: r.metrics, dirAcc5d: r.metrics?.["5d"]?.directional_accuracy ?? null,
        mae5d: r.metrics?.["5d"]?.mae ?? null, supplemental: true,
      }));
    return NextResponse.json({
      available: true,
      canonicalCount: ALL_MODELS.length,
      supplementalCount: supplemental.length,
      totalCount: ALL_MODELS.length + supplemental.length,
      reconciliation: recon ? { registry: recon.registry_count, task83: recon.task83_count, inBoth: recon.in_both } : null,
      canonical,
      supplemental,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message }, { status: 500 });
  }
}
