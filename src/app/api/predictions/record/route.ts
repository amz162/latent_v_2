import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/predictions/record
// Prospective, IMMUTABLE prediction record (Priority 7). Stores a prediction
// BEFORE its outcome is known; outcomes are filled later (via /resolve) only
// after maturity. The dedup key (symbol|modelId|modelVersion|predictionTs)
// guarantees repeated API requests never create duplicate prediction events.
//
// Body:
//   symbol, modelId, modelVersion, predictionTs (epoch ms), signal (BUY/SELL/HOLD),
//   predictedReturn?, predictedProb?, confidenceType? ("heuristic"|"calibrated"),
//   entryPrice?, horizon?, dataCutoff? (ISO date), kind?
//   ("prospective"|"simulated"|"out-of-sample"|"technical-rule")
//
// Returns the upserted record (created or the existing one if dedup hit).

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const {
    symbol, modelId, modelVersion, predictionTs, signal,
    predictedReturn, predictedProb, confidenceType = "heuristic",
    entryPrice, horizon, dataCutoff, kind = "prospective",
  } = body || {};
  if (!symbol || !modelId || !modelVersion || !predictionTs || !signal) {
    return NextResponse.json({ error: "Missing required fields: symbol, modelId, modelVersion, predictionTs, signal" }, { status: 400 });
  }
  const dedupKey = `${symbol}|${modelId}|${modelVersion}|${predictionTs}`;
  try {
    const rec = await db.predictionHistory.upsert({
      where: { dedupKey },
      create: {
        dedupKey,
        symbol: String(symbol).toUpperCase(),
        modelId: String(modelId),
        modelVersion: String(modelVersion),
        predictionTs: String(predictionTs),
        signal: String(signal).toUpperCase(),
        predictedReturn: predictedReturn != null ? Number(predictedReturn) : null,
        predictedProb: predictedProb != null ? Number(predictedProb) : null,
        confidenceType: String(confidenceType),
        entryPrice: entryPrice != null ? Number(entryPrice) : null,
        horizon: horizon != null ? Number(horizon) : null,
        dataCutoff: dataCutoff != null ? String(dataCutoff) : null,
        kind: String(kind),
        outcomeStatus: "pending",
      },
      update: {
        // On dedup hit, do NOT overwrite the original forecast — only refresh
        // non-essential fields. The forecast is immutable once stored.
        confidenceType: String(confidenceType),
      },
    });
    return NextResponse.json({ ok: true, dedupKey, id: rec.id, created: rec.createdAt === rec.updatedAt });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Record failed" }, { status: 500 });
  }
}

// GET /api/predictions/record?symbol=X&modelId=Y&status=pending
// Query the prediction history (does NOT alter records).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  const modelId = url.searchParams.get("modelId");
  const status = url.searchParams.get("status"); // pending | matured | unavailable
  const where: any = {};
  if (symbol) where.symbol = symbol;
  if (modelId) where.modelId = modelId;
  if (status) where.outcomeStatus = status;
  try {
    const rows = await db.predictionHistory.findMany({
      where,
      orderBy: { predictionTs: "desc" },
      take: Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100)),
    });
    return NextResponse.json({ count: rows.length, predictions: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Query failed" }, { status: 500 });
  }
}
