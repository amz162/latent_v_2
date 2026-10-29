/**
 * Latent.pk — Task 66 — Data freshness check for prospective paper-trading.
 * Verifies the latest OHLCV date + data provider status before allowing
 * new prediction snapshots or paper-trade entries.
 */
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

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
 *
 * Task 77 FIX: this previously returned a hard-coded `available: true` even
 * while its own details admitted `isStatic: true` + `usesMock: true`. That was
 * dishonest — it caused the prospective workflow to report status=ACTIVE with
 * zero trades. Now it actually verifies:
 *   1. The inference script (scripts/generate_live_predictions.py) exists.
 *   2. Genuine prospective predictions are recorded in PredictionHistory.
 *   3. OHLCV data is available in the database.
 * Returns `available: false` with a real reason when any check fails (fail closed).
 */
export interface InferenceAvailability {
  available: boolean;
  reason: string;
  details: {
    inferenceScript: { exists: boolean; path: string };
    recordedPredictions: { genuineCount: number; latestCutoff: string | null; latestCreatedAt: string | null };
    ohlcvLatest: string | null;
    mlPredictionsFile: { exists: boolean; isStatic: boolean };
    signalsApi: { usesMock: boolean };
    fallbackEngine: { available: boolean; kind: "technical-rule" };
  };
}

export async function checkInferenceAvailability(): Promise<InferenceAvailability> {
  // Check 1: inference script exists
  const scriptPath = path.join(process.cwd(), "scripts", "generate_live_predictions.py");
  const scriptExists = fs.existsSync(scriptPath);

  // Check 2: genuine prospective predictions recorded in PredictionHistory
  const genuineCount = await db.predictionHistory.count({ where: { kind: "prospective" } });
  const latestPred = await db.predictionHistory.findFirst({
    where: { kind: "prospective" },
    orderBy: { createdAt: "desc" },
  });

  // Check 3: OHLCV availability
  const latestBar = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" } });

  const blockers: string[] = [];
  if (!scriptExists) blockers.push("inference script (generate_live_predictions.py) not found");
  if (genuineCount === 0) blockers.push("no genuine prospective predictions recorded in PredictionHistory");
  if (!latestBar) blockers.push("no OHLCV data in database");

  const available = blockers.length === 0;
  const reason = available
    ? `Inference path available: ${genuineCount} genuine prospective predictions recorded (latest cutoff ${latestPred?.dataCutoff ?? "?"}, OHLCV latest ${latestBar?.date}).`
    : `Unavailable — ${blockers.join("; ")}.`;

  return {
    available,
    reason,
    details: {
      inferenceScript: { exists: scriptExists, path: "scripts/generate_live_predictions.py" },
      recordedPredictions: {
        genuineCount,
        latestCutoff: latestPred?.dataCutoff ?? null,
        latestCreatedAt: latestPred?.createdAt?.toISOString() ?? null,
      },
      ohlcvLatest: latestBar?.date ?? null,
      // The static ml_predictions_multi.json file still exists but is NOT live
      // inference — honestly noted (it is a pre-computed snapshot, not a live run).
      mlPredictionsFile: { exists: true, isStatic: true },
      signalsApi: { usesMock: true },
      fallbackEngine: { available: true, kind: "technical-rule" },
    },
  };
}
