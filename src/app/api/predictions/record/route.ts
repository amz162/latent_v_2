import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// POST /api/predictions/record
// Task 66/68/69 — Record an immutable prospective prediction snapshot.
// Idempotent: uses dedupKey (symbol|modelId|horizon|dataCutoff) to prevent duplicates.
// Protected: requires PREDICTION_INGEST_TOKEN env var (server-side only, never exposed to browser).
// NEVER overwrites the original prediction after its outcome becomes known.

const SUPPORTED_HORIZONS = [5, 10, 21];

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function POST(req: Request) {
  try {
    // Task 69: ingestion-token protection (fail closed if not configured)
    const expectedToken = process.env.PREDICTION_INGEST_TOKEN;
    if (!expectedToken) {
      return NextResponse.json({ error: "Server not configured for prediction ingestion (PREDICTION_INGEST_TOKEN not set)" }, { status: 503 });
    }
    const providedToken = req.headers.get("x-ingest-token") || "";
    if (!providedToken || !safeCompare(providedToken, expectedToken)) {
      return NextResponse.json({ error: "Unauthorized: invalid or missing ingestion token" }, { status: 401 });
    }

    const body = await req.json();
    const { symbol, modelId, modelVersion, predictionTs, signal, predictedReturn,
            predictedProb, confidenceType, entryPrice, horizon, kind } = body;
    const dataCutoff: string | undefined = body.dataCutoff;

    // Task 69: validate required fields
    if (!symbol || !modelId || !predictionTs || !signal) {
      return NextResponse.json({ error: "Missing required fields: symbol, modelId, predictionTs, signal" }, { status: 400 });
    }
    if (!dataCutoff || dataCutoff === "unknown") {
      return NextResponse.json({ error: "Missing or invalid dataCutoff — must be a real market-data date (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!horizon || !SUPPORTED_HORIZONS.includes(Number(horizon))) {
      return NextResponse.json({ error: `Invalid horizon: must be one of ${SUPPORTED_HORIZONS.join(", ")}` }, { status: 400 });
    }
    if (predictedReturn != null && !Number.isFinite(predictedReturn)) {
      return NextResponse.json({ error: "predictedReturn must be finite" }, { status: 400 });
    }
    if (entryPrice != null && (entryPrice <= 0 || !Number.isFinite(entryPrice))) {
      return NextResponse.json({ error: "entryPrice must be positive and finite" }, { status: 400 });
    }
    const validSignals = ["BUY", "HOLD", "SELL"];
    if (!validSignals.includes(signal)) {
      return NextResponse.json({ error: `Invalid signal: must be one of ${validSignals.join(", ")}` }, { status: 400 });
    }

    // Task 68 FIX: dedupKey uses dataCutoff (not wall-clock predictionTs) so re-running
    // on the same data cutoff is idempotent. A genuinely new data cutoff creates new records.
    const hzStr = `${horizon}d`;
    const dedupKey = `${symbol}|${modelId}|${hzStr}|${dataCutoff}`;

    // Try to create — if dedupKey exists, return the existing record (idempotent)
    const existing = await db.predictionHistory.findUnique({ where: { dedupKey } });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, dedupKey, idempotent: true, message: "Prediction already recorded (idempotent)" });
    }

    // Task 69: handle concurrent duplicate requests (unique-constraint conflict)
    try {
      const record = await db.predictionHistory.create({
        data: {
          dedupKey,
          symbol: symbol.toUpperCase(),
          modelId,
          modelVersion: modelVersion || "unknown",
          predictionTs: String(predictionTs),
          signal,
          predictedReturn: predictedReturn ?? null,
          predictedProb: predictedProb ?? null,
          confidenceType: confidenceType || "heuristic",
          entryPrice: entryPrice ?? null,
          horizon: Number(horizon),
          dataCutoff,
          kind: "prospective", // always prospective from the trusted server-side path
        },
      });
      return NextResponse.json({ ok: true, id: record.id, dedupKey, idempotent: false });
    } catch (createErr: any) {
      // Unique constraint violation = concurrent duplicate — return the existing record
      if (createErr?.code === "P2002") {
        const existingRetry = await db.predictionHistory.findUnique({ where: { dedupKey } });
        if (existingRetry) {
          return NextResponse.json({ ok: true, id: existingRetry.id, dedupKey, idempotent: true, message: "Prediction already recorded (concurrent duplicate)" });
        }
      }
      throw createErr;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to record prediction" }, { status: 500 });
  }
}
