import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ALL_MODELS } from "@/lib/latent/ensemble";
import { gateUser } from "@/lib/latent/access-control";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/models/registry — unified model registry with verified statuses.
// Combines ALL_MODELS (58 canonical) + Task 84 unified metrics + reconciliation.

export async function GET(req: NextRequest | Request) {
  // Task 121: permission gate + admin-controlled visibility filtering.
  const __g = await gateUser(req, { permission: "tab.ai_model_signals" });
  if (__g instanceof Response) return __g;
  const hidden = new Set((await db.modelAccessConfig.findMany({ where: { userVisible: false } })).map((c) => c.modelId));
  const stripped = new Set((await db.modelAccessConfig.findMany({ where: { detailsVisible: false } })).map((c) => c.modelId));
  const applyVisibility = (entry: any) => {
    if (!entry) return entry;
    if (hidden.has(entry.name)) return null;
    if (stripped.has(entry.name)) {
      const { metrics, dirAcc5d, mae5d, rmse5d, r2_5d, rocAuc, n5d, task94Evidence, task98Evidence, blockerReason, task98DataEnriched, ...rest } = entry;
      return { ...rest, metrics: null, detailsRestricted: true };
    }
    return entry;
  };
  try {
    const readJson = async (p: string) => {
      try { return JSON.parse(await fs.readFile(path.join(process.cwd(), p), "utf-8")); }
      catch { return null; }
    };
    const [t84Metrics, recon, t94Repro, t94Recovery, t94Foundations, t95Foundations, t95Caveats,
      t98Metrics, t98Pillars, t98Meta] = await Promise.all([
      readJson("data/backtest_reports/task84/task84_metrics.json"),
      readJson("data/backtest_reports/task84/task84_registry_reconciliation.json"),
      readJson("data/backtest_reports/task94/task94_model_metric_reproduction.json"),
      readJson("data/backtest_reports/task94/task94_model_recovery.json"),
      readJson("data/backtest_reports/task94/task94_foundation_results.json"),
      readJson("data/backtest_reports/task95/task95_foundation_model_results.json"),
      readJson("data/backtest_reports/task95/task95_model_metric_caveat_resolution.json"),
      readJson("data/backtest_reports/task98/task98_metrics.json"),
      readJson("data/backtest_reports/task98/task98_gm_pillars.json"),
      readJson("data/backtest_reports/task98/task98_meta_label_cg.json"),
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
    // Task 95 Phase 6/3.2 overlay (evidence-based, applied after Task 94):
    // - Moirai: official uni2ts pipeline recovered in Task 95 (smoke forecasts generated from
    //   real OHLCV) — status upgraded from dependency_blocked to operational, OOS eval still pending.
    // - PatchTST / Transformer-LSTM: Task 95 re-ran the identical recovery inference; h=10d/21d
    //   metrics reproduce exactly, h=5d stored metrics could NOT be reproduced — the recomputed
    //   (reproducible) cells are displayed with an explicit small-sample caveat.
    if (t95Foundations?.models?.["Moirai (Salesforce)"]) {
      statusOverrides["Moirai (Salesforce)"] = { status: t95Foundations.models["Moirai (Salesforce)"].identity };
    }
    if (t95Caveats?.runs) {
      // Task 95 root-cause fix: Task 94's recovery loader left the output head randomly
      // initialized (checkpoint keys fc.* vs model head.*), invalidating ALL stored recovery
      // metrics for these two models. The Task 95 recomputed cells (fixed loader, deterministic,
      // fully loaded) are the authoritative metrics — override every horizon.
      const byModel: Record<string, any> = {};
      for (const r of t95Caveats.runs as any[]) {
        if (r.final_status !== "metric_mismatch" || !r.recomputed) continue;
        const rec = r.recomputed;
        byModel[r.model] = byModel[r.model] || {};
        byModel[r.model][`${r.h}d`] = { n: rec.n, directional_accuracy: rec.dir_acc, mae: rec.mae, rmse: rec.rmse, r2: rec.r2 };
      }
      for (const [name, metrics] of Object.entries(byModel)) {
        const m5 = metrics["5d"];
        statusOverrides[name] = { status: "official_pretrained_inference_oos_evaluated", metrics };
        if (m5) {
          statusOverrides[name].metrics = metrics;
        }
      }
    }
    // Task 98 overlay (2026-10-31): resolves the last 6 non-evaluated canonical models.
    // - ARIMA / Prophet: root-caused API bugs (statsmodels `disp` kwarg removed; Prophet
    //   requires tz-naive ds), re-evaluated OOS on the task83 batch1 layout —
    //   scripts/task98_fix_failed_models.py.
    // - GM pillars: backtested on their production signal definitions (Track A, canonical);
    //   AskAnalyst data-enriched variants (filings events, quarterly fundamentals, breadth
    //   regime) recorded separately as Track B — scripts/task98_gm_pillars.py.
    // - Meta-Label CG (X): proper OOF pipeline (TimeSeriesSplit(5) component probabilities
    //   feeding a LightGBM meta learner) — scripts/task98_meta_label_cg.py.
    if (t98Metrics?.allResults) {
      for (const [name, r] of Object.entries(t98Metrics.allResults as Record<string, any>)) {
        if (r?.status && r.status !== "failed_after_attempts") {
          statusOverrides[name] = { status: r.status, metrics: r.metrics || undefined };
        }
      }
    }
    if (t98Pillars?.trackA_production) {
      for (const [name, r] of Object.entries(t98Pillars.trackA_production as Record<string, any>)) {
        if (r?.status) statusOverrides[name] = { status: r.status, metrics: r.metrics || undefined };
      }
    }
    if (t98Meta?.allResults?.["Meta-Label CG (X)"]?.status) {
      const r = t98Meta.allResults["Meta-Label CG (X)"];
      statusOverrides["Meta-Label CG (X)"] = { status: r.status, metrics: r.metrics || undefined };
    }
    const task98Enriched: Record<string, any> = t98Pillars?.trackB_data_enriched || {};
    const applyOverride = (entry: any) => {
      const ov = statusOverrides[entry.name];
      if (!ov) return entry;
      const enriched = task98Enriched[entry.name];
      return { ...entry, verifiedStatus: ov.status, metrics: ov.metrics || entry.metrics,
        dirAcc5d: ov.metrics?.["5d"]?.directional_accuracy ?? entry.dirAcc5d,
        mae5d: ov.metrics?.["5d"]?.mae ?? entry.mae5d,
        rmse5d: ov.metrics?.["5d"]?.rmse ?? entry.rmse5d,
        r2_5d: ov.metrics?.["5d"]?.r2 ?? entry.r2_5d,
        n5d: ov.metrics?.["5d"]?.n ?? entry.n5d,
        task94Evidence: true,
        task98Evidence: true,
        blockerReason: null,
        task98DataEnriched: enriched ? {
          status: enriched.status, metrics: enriched.metrics,
          signalSource: enriched.signal_source || null,
        } : undefined };
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
    // Task 99: merge the two reference RNN-LSTM supplemental implementations
    // (github.com/jiewwantan/RNN_LSTM_trading_model — independent PSX adaptation).
    // Canonical ALL_MODELS and Task 84 supplemental/alias handling are untouched;
    // counts (supplementalCount / uniqueImplementationCount) include the entries
    // automatically because they are appended before the response is built.
    const t99Reg = await readJson("data/backtest_reports/task99/task99_model_registry.json");
    if (t99Reg?.supplemental_models) {
      for (const m of t99Reg.supplemental_models as any[]) {
        supplemental.push({
          name: m.name,
          id: m.id,
          verifiedStatus: m.verifiedStatus,
          status: m.status,
          metrics: m.metrics,
          dirAcc5d: m.dirAcc5d ?? null,
          mae5d: m.mae5d ?? null,
          supplemental: true,
          task99: {
            source_reference: m.source_reference,
            license_status: m.license_status,
            architecture: m.architecture,
            config: m.config,
            param_count: m.param_count,
            epochs_trained: m.epochs_trained,
            best_val_mae: m.best_val_mae,
            checkpoint_available: m.checkpoint_available,
            checkpoint_sha16: m.checkpoint_sha16,
            psx_adaptation: m.psx_adaptation,
            training_samples: m.training_samples,
            validation_samples: m.validation_samples,
            test_samples: m.test_samples,
            symbols: m.symbols,
            training_duration_chunks: m.training_duration_chunks,
            in_final_consensus: m.in_final_consensus,
            evaluation_policy: m.evaluation_policy,
          },
        });
      }
    }
    // Task 101: merge the cost-aware trade-outcome models (supplemental).
    // psx_cost_aware_trade_classifier: P(realized net trade > 0 after full
    // psx_user_schedule_v2 costs) on 11,521 production-engine-labeled trades;
    // psx_net_expectancy_meta_model: net-return/excursion regressors (Targets C/D).
    // Both are shadow-only until matured positive-expectancy evidence exists.
    const t101Reg = await readJson("data/backtest_reports/task101/task101_model_registry.json");
    if (t101Reg?.supplemental_models) {
      for (const m of t101Reg.supplemental_models as any[]) {
        supplemental.push({
          name: m.name,
          id: m.id,
          verifiedStatus: m.verifiedStatus,
          status: m.status,
          metrics: m.metrics,
          dirAcc5d: m.dirAcc5d ?? null,
          mae5d: m.mae5d ?? null,
          supplemental: true,
          task101: {
            family: m.family,
            cost_profile: m.cost_profile,
            label_engine: m.label_engine,
            n_labeled_trades: m.n_labeled_trades,
            positive_rate_train: m.positive_rate_train,
            frozen_rule: m.frozen_rule,
            final_test_summary: m.final_test_summary,
            promotion_status: m.promotion_status,
            evaluation_policy: m.evaluation_policy,
          },
        });
      }
    }
    const visibleCanonical = canonical94.map(applyVisibility).filter(Boolean);
    const visibleSupplemental = supplemental.map(applyOverride).map(applyVisibility).filter(Boolean);
    const visibleAliases = aliases.map(applyVisibility).filter(Boolean);
    return NextResponse.json({
      available: true,
      canonicalCount: visibleCanonical.length,
      supplementalCount: visibleSupplemental.length,
      aliasCount: visibleAliases.length,
      uniqueImplementationCount: visibleCanonical.length + visibleSupplemental.length,
      totalCount: visibleCanonical.length + visibleSupplemental.length + visibleAliases.length,
      aliases: visibleAliases,
      reconciliation: recon ? { registry: recon.registry_count, task83: recon.task83_count, inBoth: recon.in_both } : null,
      canonical: visibleCanonical,
      supplemental: visibleSupplemental,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message }, { status: 500 });
  }
}
