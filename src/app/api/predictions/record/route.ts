import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// POST /api/predictions/record
// Task 66 — Record an immutable prospective prediction snapshot.
// Idempotent: uses dedupKey (unique) to prevent duplicates.
// NEVER overwrites the original prediction after its outcome becomes known.

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { symbol, modelId, modelVersion, predictionTs, signal, predictedReturn,
            predictedProb, confidenceType, entryPrice, horizon, dataCutoff, kind } = body;

    if (!symbol || !modelId || !predictionTs || !signal) {
      return NextResponse.json({ error: "Missing required fields: symbol, modelId, predictionTs, signal" }, { status: 400 });
    }

    // Dedup key: symbol + modelId + horizon + predictionTs (horizon-aware idempotency — Task 67 Phase 2)
    const horizon = body.horizon ? `${body.horizon}d` : "unknown";
    const dedupKey = `${symbol}|${modelId}|${horizon}|${predictionTs}`;

    // Try to create — if dedupKey exists, return the existing record (idempotent)
    const existing = await db.predictionHistory.findUnique({ where: { dedupKey } });
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, dedupKey, idempotent: true, message: "Prediction already recorded (idempotent)" });
    }

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
        horizon: horizon ?? null,
        dataCutoff: dataCutoff || null,
        kind: kind || "prospective",
      },
    });

    return NextResponse.json({ ok: true, id: record.id, dedupKey, idempotent: false });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to record prediction" }, { status: 500 });
  }
}
