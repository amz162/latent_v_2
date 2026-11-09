// Task 121 — user context endpoint. The ONLY source of identity/permissions
// for the SPA. Values are resolved server-side; the client renders from this
// and can never assert permissions of its own.
import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  getPlatformSettings,
  getUsageToday,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx) {
    return NextResponse.json({
      authenticated: false,
      isAdmin: false,
      loginUrl: "/login",
      adminLoginUrl: "/admin/login",
    });
  }
  const settings = await getPlatformSettings();
  if (ctx.kind === "admin") {
    return NextResponse.json({
      authenticated: true,
      isAdmin: true,
      username: ctx.username,
    });
  }
  const profile = await db.betaProfile.findUnique({
    where: { id: ctx.profileId },
    select: { profileComplete: true, createdAt: true },
  });
  const usage = ctx.status === "ACTIVE" ? await getUsageToday(ctx.profileId) : null;
  return NextResponse.json({
    authenticated: true,
    isAdmin: false,
    profileId: ctx.profileId,
    status: ctx.status,
    plan: { key: ctx.planKey, label: ctx.planLabel, limits: ctx.limits },
    permissions: Array.from(ctx.permissions),
    usage,
    maintenance: settings.maintenance_mode,
    featurePause: settings.feature_pause,
    profileComplete: profile?.profileComplete ?? false,
    memberSince: profile?.createdAt ?? null,
  });
}
