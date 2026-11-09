// Task 121 — user logout. Rotates the profile's session token hash so the
// old cookie can never be replayed, then clears the cookie. The profile row
// (identity) is kept — but it is unreachable until the operator issues a new
// invitation, because the invitation code is the only credential. Documented
// in the admin guide; admins can also invalidate sessions from the Users tab.
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { BETA_COOKIE, clearSessionCookie, sameOrigin, sha256 } from "@/lib/latent/beta-access";
import { audit } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: "cross_origin_blocked" }, { status: 403 });
  }
  const token = req.cookies.get(BETA_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const profile = await db.betaProfile.findUnique({ where: { sessionTokenHash: sha256(token) } });
    if (profile) {
      // rotate: the presented token becomes permanently invalid
      await db.betaProfile.update({
        where: { id: profile.id },
        data: { sessionTokenHash: sha256(crypto.randomBytes(32).toString("hex")) },
      });
      await audit({
        actorType: "user",
        actorId: profile.id,
        action: "user.logout",
        targetType: "session",
        targetId: profile.id,
        route: "/api/user/logout",
      });
    }
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req);
  return res;
}
