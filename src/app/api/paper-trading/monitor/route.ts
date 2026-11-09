import { NextResponse } from "next/server";
import { buildMonitorPayload } from "@/lib/latent/paperMonitor";
import { guardUser } from "@/lib/latent/access-control";

// Task 107 v2 — Paper Trade Monitor API.
// GET /api/paper-trading/monitor
// Returns every open paper position (from the production maturity engine)
// with the latest DELAYED provider snapshot price, its estimated source
// market timestamp, the real retrieval timestamp, the ~15-minute provider
// delay, SL/TP1-3 levels, best target reached, and separate realized vs
// unrealized P&L (estimated net via computeTradeCostsV2, psx_user_schedule_v2).
// Snapshot semantics: observed crossings only (observation_resolution_limited).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const __g = await guardUser(req, "tab.paper_monitor");
  if (__g) return __g;
  try {
    const payload = await buildMonitorPayload();
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: "monitor_unavailable", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
