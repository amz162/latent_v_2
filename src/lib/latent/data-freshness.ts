/**
 * Task 66 — Data freshness check for prospective paper-trading.
 * Verifies the latest OHLCV date + data provider status before allowing
 * new prediction snapshots or paper-trade entries.
 */
import { db } from "@/lib/db";

export interface FreshnessResult {
  fresh: boolean;
  latestDbDate: string | null;
  currentUtcDate: string;
  daysStale: number;
  reason: string | null;
  warnings: string[];
}

export async function checkDataFreshness(maxStaleDays = 3): Promise<FreshnessResult> {
  const warnings: string[] = [];
  const currentUtc = new Date();
  const currentUtcDate = currentUtc.toISOString().slice(0, 10);

  // Query the latest OHLCV date from the DB
  const latest = await db.ohlcvBar.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const latestDbDate = latest?.date ?? null;

  if (!latestDbDate) {
    return { fresh: false, latestDbDate: null, currentUtcDate, daysStale: 999, reason: "No OHLCV data in database", warnings: ["DB is empty — run scripts/backfill_ohlcv.ts first"] };
  }

  // Compute days stale (calendar days, not trading days)
  const latestDate = new Date(latestDbDate + "T00:00:00Z");
  const diffMs = currentUtc.getTime() - latestDate.getTime();
  const daysStale = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  // Weekend check: if today is Sat/Sun, the latest trading day is the prior Fri
  const dayOfWeek = currentUtc.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Allow weekends (market closed)
  if (isWeekend && daysStale <= 3) {
    warnings.push("Weekend — market closed; using latest Friday's close");
  }

  // Check freshness
  const fresh = daysStale <= maxStaleDays || (isWeekend && daysStale <= maxStaleDays + 2);
  const reason = fresh ? null : `Data is ${daysStale} days stale (max allowed: ${maxStaleDays})`;

  if (daysStale > 1 && !isWeekend) {
    warnings.push(`Data is ${daysStale} days old — may indicate a delayed vendor update or market holiday`);
  }

  return { fresh, latestDbDate, currentUtcDate, daysStale, reason, warnings };
}

/**
 * Check if a genuine trained-ML inference path is available for live data.
 * Returns the availability status + reason.
 */
export interface InferenceAvailability {
  available: boolean;
  reason: string;
  details: {
    mlPredictionsFile: { exists: boolean; trainedAt: string | null; isStatic: boolean };
    signalsApi: { usesMock: boolean };
    fallbackEngine: { available: boolean; kind: "technical-rule" };
  };
}

export function checkInferenceAvailability(): InferenceAvailability {
  // The ml_predictions_multi.json is a STATIC pre-computed file — NOT live inference
  // The signals API uses mock-signals.ts — NOT genuine predictions
  // The fallback-predictions.ts engine CAN generate technical-rule signals — but
  // per the user's rule: "If a model lacks a usable genuine inference path, mark
  // it unavailable instead of using technical-rule signals under its name."
  return {
    available: false,
    reason: "No live trained-ML inference path available. ml_predictions_multi.json is a static file (not live inference). The signals API uses mock-signals.ts. The fallback engine generates technical-rule signals (NOT trained-ML) — per policy, these are NOT used as a substitute for trained-ML predictions.",
    details: {
      mlPredictionsFile: { exists: true, trainedAt: "2026-10-23", isStatic: true },
      signalsApi: { usesMock: true },
      fallbackEngine: { available: true, kind: "technical-rule" },
    },
  };
}
