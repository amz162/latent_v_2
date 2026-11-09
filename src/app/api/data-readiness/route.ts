/**
 * Task 103 — data-readiness API (spec Phase 8).
 * Reports last successful refreshes, latest verified trading date, per-source
 * freshness (KSE-100, fundamentals, filings, corporate actions, intraday),
 * source failures and feature availability. `unknown` / `unavailable` are
 * explicit states, never inferred.
 */
import { NextResponse } from "next/server";
import * as fs from "fs";
import path from "path";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

const T103 = path.join(process.cwd(), "data/backtest_reports/task103");

function readJson(name: string): any | null {
  try {
    const p = path.join(T103, name);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
  } catch {
    return null;
  }
}

function freshness(of: { status: string | null; source: string | null; last: string | null }) {
  return { status: of.status ?? "unknown", source: of.source ?? null, last: of.last ?? null };
}

export async function GET(req: Request) {
  const __g = await guardUser(req, "feature.backtest_reports");
  if (__g) return __g;
  const audit = readJson("task103_market_data_audit.json");
  const kse = readJson("task103_kse100_coverage.json");
  const fund = readJson("task103_fundamental_coverage.json");
  const ca = readJson("task103_corporate_actions_coverage.json");
  const intr = readJson("task103_intraday_coverage.json");
  const health = readJson("task103_data_pipeline_health.json");
  const runs = readJson("task103_pipeline_runs.json");

  const lastRun = Array.isArray(runs?.runs) ? runs.runs[runs.runs.length - 1] : null;

  const featureAvailability = {
    technical_only_v1: "available",
    technical_market_regime_v1: "available_internal_proxy",
    technical_pit_fundamental_v1: "unavailable",
    technical_liquidity_v1: "available",
    technical_corporate_action_safe_v1: "available_flags_only",
    technical_intraday_v1: "unavailable",
    combined_verified_v1: "available",
  };

  return NextResponse.json({
    asOf: new Date().toISOString(),
    marketData: {
      latestVerifiedTradingDate: audit?.date_range?.[1] ?? "unknown",
      nSymbols: audit?.n_symbols ?? null,
      nBars: audit?.n_bars ?? null,
      lastSuccessfulRefresh: lastRun?.last_successful_run ?? null,
    },
    sources: {
      kse100: freshness({ status: kse?.status ?? null, source: null,
                           last: kse?.generated_at ?? null }),
      fundamentals: freshness({ status: fund?.status ?? null, source: "askanalyst_ingest",
                                 last: fund?.generated_at ?? null }),
      filings: freshness({ status: fund ? "partially_verified" : null,
                            source: "psx_dps_announcements (day precision)",
                            last: fund?.generated_at ?? null }),
      corporateActions: freshness({ status: ca?.status ?? null, source: null,
                                     last: ca?.generated_at ?? null }),
      intraday: freshness({ status: intr?.status ?? null, source: null,
                             last: intr?.generated_at ?? null }),
    },
    sourceFailures: [
      ...(kse?.provider_states ?? []).filter((p: any) => p.status !== "verified_access")
        .map((p: any) => ({ provider: p.provider, status: p.status,
                             reason: p.failure_reason ?? null })),
    ],
    featureAvailability,
    scheduler: health?.scheduler_reality ?? { deployed_recurring_service: "unknown" },
    note: "genuine KSE-100 is blocked_external_data; internal proxy is a DIFFERENT source and "
        + "is never reported here as the index. All statuses are explicit.",
  });
}
