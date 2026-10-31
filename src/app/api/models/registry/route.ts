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
    const [t84Metrics, recon, t94Repro, t94Recovery, t94Foundations] = await Promise.all([
      readJson("data/backtest_reports/task84/task84_metrics.json"),
      readJson("data/backtest_reports/task84/task84_registry_reconciliation.json"),
      readJson("data/backtest_reports/task94/task94_model_metric_reproduction.json"),
      readJson("data/backtest_reports/task94/task94_model_recovery.json"),
      readJson("data/backtest_reports/task94/task94_foundation_results.json"),
    ]);
    const allResults = t84Metrics?.allResults || {};
    // Task 94 Phase 10: overlay corrected training/evaluation statuses from the
    // Task 94 evidence artifacts. Only models with NEW evidence since Task 84
    // are overridden; all other statuses already reproduce from Task 84 data.
    const statusOverrides: Record<string, { status: string; metrics?: any }> = {};
    for (const m of ["PatchTST", "Transformer-LSTM"] as const) {
      const h = (t94Recovery as any)?.[m]?.["5d"];
      if (h?.status) statusOverrides[m] = { status: h.status, metrics: { "5d": { n: h.n_predictions, directional_accuracy: h.overall_dir_acc, mae: h.per_horizon?.["5"]?.mae, rmse: h.per_horizon?.["5"]?.rmse, r2: h.per_horizon?.["5"]?.r2 } } };
    }
    if (t94Foundations?.models) {
      const fm: Record<string, any> = t94Foundations.models;
      for (const [name, blk] of Object.entries(fm)) {
        if (blk?.status && !statusOverrides[name]) {
          const fr = blk?.final_result || {};
          const m5 = blk?.metrics?.["5d"] || (fr?.dir_acc != null ? { n: fr.n, directional_accuracy: fr.dir_acc, mae: fr.mae, rmse: fr.rmse, r2: fr.r2, ci95: fr.ci95 } : null);
          statusOverrides[name] = { status: blk.status, metrics: m5 ? { "5d": m5 } : undefined };
        }
      }
    }
    const applyOverride = (entry: any) => {
      const ov = statusOverrides[entry.name];
      if (!ov) return entry;
      return { ...entry, verifiedStatus: ov.status, metrics: ov.metrics || entry.metrics,
        dirAcc5d: ov.metrics?.["5d"]?.directional_accuracy ?? entry.dirAcc5d,
        mae5d: ov.metrics?.["5d"]?.mae ?? entry.mae5d,
        rmse5d: ov.metrics?.["5d"]?.rmse ?? entry.rmse5d,
        r2_5d: ov.metrics?.["5d"]?.r2 ?? entry.r2_5d,
        n5d: ov.metrics?.["5d"]?.n ?? entry.n5d,
        task94Evidence: true };
    };
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
    const canonical94 = canonical.map(applyOverride);
    // Supplemental entries (in Task 84 but not in ALL_MODELS).
    // Task 94 Phase 9: alias entries of canonical models (resolved in
    // task94_registry_reconciliation.json: 'Kalman Filter'→'Kalman',
    // 'Logistic Regression (PI)'→'Logistic (PI)') must NOT double-count as
    // supplemental implementations. They stay visible under `aliases`
    // (nothing silently omitted) but are excluded from supplementalCount.
    const canonicalNames = new Set(ALL_MODELS.map((m: any) => m.name));
    const stripTags = (s: string) =>
      s.replace(/\s*\((CL|CL-2|PI|CG|GM|X)\)\s*$/i, "").replace(/\s+filter$/i, "").trim().toLowerCase();
    const canonicalByNorm = new Map<string, string>();
    for (const m of ALL_MODELS as any[]) canonicalByNorm.set(stripTags(m.name), m.name);
    const supplemental: any[] = [];
    const aliases: any[] = [];
    for (const [name, r] of Object.entries(allResults)) {
      if (canonicalNames.has(name)) continue;
      const parent = canonicalByNorm.get(stripTags(name)) || null;
      const entry: any = {
        name, verifiedStatus: (r as any).status || "evaluated",
        metrics: (r as any).metrics,
        dirAcc5d: (r as any).metrics?.["5d"]?.directional_accuracy ?? null,
        mae5d: (r as any).metrics?.["5d"]?.mae ?? null, supplemental: true,
      };
      if (parent) { entry.isAlias = true; entry.aliasParent = parent; aliases.push(entry); }
      else supplemental.push(entry);
    }
    return NextResponse.json({
      available: true,
      canonicalCount: ALL_MODELS.length,
      supplementalCount: supplemental.length,
      aliasCount: aliases.length,
      uniqueImplementationCount: ALL_MODELS.length + supplemental.length,
      totalCount: ALL_MODELS.length + supplemental.length + aliases.length,
      aliases,
      reconciliation: recon ? { registry: recon.registry_count, task83: recon.task83_count, inBoth: recon.in_both } : null,
      canonical: canonical94,
      supplemental: supplemental.map(applyOverride),
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message }, { status: 500 });
  }
}
