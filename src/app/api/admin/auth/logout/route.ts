// Task 121 — admin logout: revokes the presented session server-side.
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/latent/beta-access";
import { adminLogout, clearAdminSessionCookie } from "@/lib/latent/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "cross_origin_blocked" }, { status: 403 });
  }
  await adminLogout(req);
  const res = NextResponse.json({ ok: true });
  clearAdminSessionCookie(res, req);
  return res;
}
