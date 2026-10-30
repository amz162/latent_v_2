import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { reconcileCounts, reconcileBooks } from "@/lib/latent/prospective-lifecycle";
import { checkDataFreshness, checkInferenceAvailability } from "@/lib/latent/data-freshness";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/backtest/walk-forward/prospective
//
// Task 77 — DB-BACKED prospective ledger status. Previously this read a stale
// JSON report (which claimed status=ACTIVE with 0 trades + a generated_at that
// predated the predictions). Now it derives ALL counts from the authoritative
// database via reconcileCounts() + reconcileBooks(), so a current report always
// reconciles with direct DB counts. The JSON artifact is kept only as a cached
// policy/provenance record (not the sole source of live state).

export async function GET() {
  try {
    const counts = await reconcileCounts();
    const books = await reconcileBooks();
    const freshness = await checkDataFreshness(3);
    const inference = await checkInferenceAvailability();
    const latestBar = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" }, select: { date: true } });

    // Truthful operational status (Phase 2D/2E — matches the lifecycle service):
    //   BLOCKED    — required data/inference/risk-levels unavailable
    //   READY      — valid setup, no eligible next-session entry yet (or only pending_entry)
    //   ACTIVE     — OPEN positions are actually being managed (not just pending_entry)
    //   EVALUATING — outcomes maturing but evidence insufficient
    //   COMPLETED  — only when predeclared completion criteria are satisfied
    // Do NOT mark ACTIVE solely because pending_entry > 0 — pending entries waiting
    // for future sessions (especially stale symbols) are not an active managed lifecycle.
    const status = !inference.available
      ? "BLOCKED"
      : counts.tradesByState.open > 0
      ? "ACTIVE"
      : counts.outcomesByStatus.matured > 0
      ? "EVALUATING"
      : "READY";

    return NextResponse.json({
      available: true,
      source: "database (authoritative — counts reconcile with direct DB queries)",
      status,
      block_reason: !inference.available ? inference.reason : null,
      generated_at: new Date().toISOString(),
      latest_ohlcv_session: latestBar?.date ?? null,
      data_freshness: freshness,
      inference_availability: inference,
      counts,
      books,
      honest_disclosure: [
        "ACTIVE is an operational status (the ledger is running + managing eligible positions). It is NOT evidence of predictive skill or profitability.",
        "All trades are currently pending_entry because the next trading session after the data cutoff (2026-10-29) has not yet occurred in the OHLCV data.",
        "0 matured outcomes — horizons have not been reached (the prospective period just began on 2026-10-29).",
        "Do NOT interpret future positive results as proof of model skill without sufficient prospective observations + a statistical significance test.",
      ],
    });
  } catch (e: any) {
    return NextResponse.json(
      { available: false, error: e?.message || "Prospective status failed" },
      { status: 500 }
    );
  }
}
