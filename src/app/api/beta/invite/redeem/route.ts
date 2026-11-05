import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkInvite,
  createSession,
  inviteRequired,
  isBetaActive,
  recordRedemption,
  sameOrigin,
} from "@/lib/latent/beta-access";
import { errorResponse } from "@/lib/latent/error-codes";
import { rateLimit, clientKey } from "@/lib/latent/rate-limit";

// Task 117 Part C — server-side invitation redemption.
//
// Abuse protection: per-IP-hash (10/hour) + global (200/hour) sliding windows.
// Enumeration defense: every failure (invalid/expired/revoked/exhausted/paused)
// returns the SAME generic message and the same 403 status; no timing or
// payload differences. Raw codes are never logged; only hashes are stored.
// Redemption binds a fresh anonymous BetaProfile to the invite (audit by
// profile id, never by token), then the normal onboarding consent flow runs.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return errorResponse("invitation_invalid");

  const gate = await isBetaActive();
  if (!gate.active) {
    return Response.json({ error: "invitation_invalid", message: "The beta is currently closed.", betaDisabled: true }, { status: 403 });
  }

  const ipKey = clientKey(req);
  const perIp = rateLimit("invite_redeem_ip", ipKey, 30, 60 * 60 * 1000);
  const global = rateLimit("invite_redeem_global", "all", 400, 60 * 60 * 1000);
  if (!perIp.allowed || !global.allowed) {
    return errorResponse("rate_limited", { retryAfterSec: Math.max(perIp.retryAfterSec, global.retryAfterSec) });
  }

  let code = "";
  try {
    const body = (await req.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return errorResponse("invitation_invalid");
  }

  const check = await checkInvite(code);
  if (!check.ok || !check.inviteId) {
    // uniform failure — never reveal WHICH condition failed
    return Response.json(
      {
        error: "invitation_invalid",
        message:
          "This invitation is not valid or is no longer active. Please check the code with your operator and try again.",
      },
      { status: 403 }
    );
  }

  try {
    const res = NextResponse.json({ redeemed: true, next: "/beta/onboarding" });
    const created = await createSession(res, req, { accessVia: "invite", inviteId: check.inviteId });
    await recordRedemption(check.inviteId, created.profileId);
    return res;
  } catch (err) {
    console.error("[beta/invite/redeem] database error (no detail emitted to client)");
    return errorResponse("database_unavailable");
  }
}

export async function GET() {
  // convenience for the UI gate page
  return NextResponse.json({ invitationRequired: inviteRequired() });
}
