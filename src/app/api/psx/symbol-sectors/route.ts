import { NextResponse } from "next/server";
import { getSymbolSectorMap } from "@/lib/latent/psxdata";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // cold build fans out 38 sector fetches

/**
 * GET /api/psx/symbol-sectors
 *
 * Returns the full symbol → sector map built from psxdata's 38 PSX sectors
 * (each sector's constituent stocks fetched in parallel). Cached server-side
 * for 6 hours — the sector taxonomy rarely changes.
 *
 * Why this exists: pypsx (the only source that attaches a `sector` field
 * per symbol) needs API keys that aren't configured in this env, so
 * /api/psx/companies falls back to the psxdata symbol list which has NO
 * sector. Without this map, the Tracker donut would lump every stock
 * into "Others". With it, the donut shows the REAL category per stock
 * (Commercial Banks, Cement, Oil & Gas, …) and only genuinely
 * unidentified stocks fall back to "Others".
 *
 * Response: { map: { "ENGRO": "CONGLOMERATE", "HBL": "COMMERCIAL BANKS", ... },
 *             count, cached, computedAt }
 */
export async function GET() {
  try {
    const map = await getSymbolSectorMap();
    return NextResponse.json({
      map,
      count: Object.keys(map).length,
      source: "psxdata",
      cached: true,
      computedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, map: {} }, { status: 502 });
  }
}
