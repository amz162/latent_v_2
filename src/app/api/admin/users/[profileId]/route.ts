// Task 121 — single-user detail: profile, access, overrides, usage, feedback
// (own only — feedback rows where profileId matches), recent audit trail.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, authErrorResponse, getUsageToday } from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { profileId } = await params;
    const profile = await db.betaProfile.findUnique({
      where: { id: profileId },
      include: { access: true },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

    const [overrides, usage, feedback, auditRows, invite] = await Promise.all([
      db.profilePermission.findMany({ where: { profileId } }),
      getUsageToday(profileId),
      db.betaFeedback.findMany({ where: { profileId }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.adminAuditLog.findMany({
        where: { targetType: "user", targetId: profileId },
        orderBy: { ts: "desc" }, take: 20,
      }),
      profile.inviteId ? db.betaInvite.findUnique({ where: { id: profile.inviteId } }) : null,
    ]);

    return NextResponse.json({
      profile: {
        profileId: profile.id,
        createdAt: profile.createdAt,
        accessVia: profile.accessVia,
        inviteId: profile.inviteId,
        inviteLabel: invite?.label ?? null,
        profileComplete: profile.profileComplete,
        consentAcceptedAt: profile.consentAcceptedAt,
        risk: {
          experienceLevel: profile.experienceLevel,
          objective: profile.objective,
          timeHorizon: profile.timeHorizon,
          lossReaction: profile.lossReaction,
          volatilityComfort: profile.volatilityComfort,
          capitalRange: profile.capitalRange,
        },
      },
      access: profile.access ? {
        status: profile.access.status,
        planKey: profile.access.planKey,
        statusReason: profile.access.statusReason,
        accessExpiresAt: profile.access.accessExpiresAt,
        lastSeenAt: profile.access.lastSeenAt,
        createdAt: profile.access.createdAt,
      } : null,
      overrides: overrides.map((o) => ({ permissionKey: o.permissionKey, effect: o.effect, setByAdminId: o.setByAdminId, updatedAt: o.updatedAt })),
      usage,
      feedback,
      audit: auditRows.map((r) => ({ ts: r.ts, action: r.action, actorType: r.actorType, result: r.result, failureReason: r.failureReason, before: r.beforeJson ? JSON.parse(r.beforeJson) : null, after: r.afterJson ? JSON.parse(r.afterJson) : null })),
      viewer: admin.username,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
