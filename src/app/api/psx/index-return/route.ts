import { NextResponse } from "next/server";
import { getHistorical } from "@/lib/latent/psxdata";

export const dynamic = "force-dynamic";
export const maxDuration = 20;
export const revalidate = 3600; // 1h

/**
 * GET /api/psx/index-return?symbol=KSE100
 *
 * Returns the trailing ~1-year return of a PSX index (default KSE-100)
 * computed from the daily historical close series.
 *
 * Used as a sensible default for the SIP calculator's expected-return.
 *
 * Response:
 *   {
 *     symbol: "KSE100",
 *     returnPct: 18.42,         // trailing-1Y % return
 *     latestClose: 165930.99,
 *     latestDate: "2026-10-21",
 *     yearAgoClose: 140120.55,
 *     yearAgoDate: "2025-10-21",
 *     source: "psxdata",
 *   }
 *
 * On any failure, returns { returnPct: 15, source: "fallback", ... } so the
 * SIP calculator can still ship a sane default.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "KSE100").toUpperCase();
  const FALLBACK = 15;

  try {
    const series = await getHistorical(symbol);
    if (!series || !Array.isArray(series) || series.length === 0) {
      return NextResponse.json(
        {
          symbol,
          returnPct: FALLBACK,
          source: "fallback",
          reason: "no historical data",
        },
        { status: 200 }
      );
    }

    // Normalize entries: each must have a date string and a numeric close.
    type Bar = { date: string; close: number; ts: number };
    const bars: Bar[] = [];
    for (const b of series) {
      if (!b || typeof b.date !== "string") continue;
      const close = typeof b.close === "number" ? b.close : parseFloat(b.close);
      if (!isFinite(close)) continue;
      const ts = Date.parse(b.date);
      if (isNaN(ts)) continue;
      bars.push({ date: b.date, close, ts });
    }

    if (bars.length < 2) {
      return NextResponse.json(
        {
          symbol,
          returnPct: FALLBACK,
          source: "fallback",
          reason: "insufficient bars",
        },
        { status: 200 }
      );
    }

    // Sort ascending by date so we can pick latest + ~1Y-ago bars.
    bars.sort((a, b) => a.ts - b.ts);

    const latest = bars[bars.length - 1];
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const targetTs = latest.ts - oneYearMs;

    // Pick the bar whose date is closest to (latest.date - 365d), preferring
    // a slightly earlier date over a later one if equidistant.
    let candidate = bars[0];
    let bestDelta = Infinity;
    for (const b of bars) {
      if (b.ts > latest.ts) continue; // ignore future bars just in case
      const delta = Math.abs(b.ts - targetTs);
      if (delta < bestDelta) {
        bestDelta = delta;
        candidate = b;
      }
    }

    if (!candidate || candidate.close <= 0 || latest.close <= 0) {
      return NextResponse.json(
        {
          symbol,
          returnPct: FALLBACK,
          source: "fallback",
          reason: "invalid closes",
        },
        { status: 200 }
      );
    }

    const returnPct = ((latest.close - candidate.close) / candidate.close) * 100;
    // Clamp to a sane range to avoid absurd values from data anomalies.
    const clamped = Math.max(-90, Math.min(500, returnPct));

    return NextResponse.json({
      symbol,
      returnPct: Math.round(clamped * 100) / 100,
      latestClose: latest.close,
      latestDate: latest.date,
      yearAgoClose: candidate.close,
      yearAgoDate: candidate.date,
      barCount: bars.length,
      source: "psxdata",
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        symbol,
        returnPct: FALLBACK,
        source: "fallback",
        reason: e?.message || "fetch error",
      },
      { status: 200 }
    );
  }
}
