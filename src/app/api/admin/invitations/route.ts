// Task 121 — invitation management. Raw tokens are generated server-side and
// returned to the admin EXACTLY ONCE at creation; only sha256 hashes are
// stored (same primitive as the Task 117 operator CLI, now behind the admin
// session). Every lifecycle event lands in InvitationEvent + AdminAuditLog.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
  getPlatformSettings,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";
import { checkInvite, generateInviteToken, sha256 } from "@/lib/latent/beta-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [invites, events, settings] = await Promise.all([
      db.betaInvite.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
      db.invitationEvent.findMany({ orderBy: { ts: "desc" }, take: 100 }),
      getPlatformSettings(),
    ]);
    return NextResponse.json({
      invitations: invites.map((i) => ({
        id: i.id, label: i.label, status: i.status,
        maxRedemptions: i.maxRedemptions, redemptionCount: i.redemptionCount,
        createdAt: i.createdAt, expiresAt: i.expiresAt, redeemedAt: i.redeemedAt,
        redeemedProfiles: JSON.parse(i.redeemedProfileIds || "[]").length,
        exhausted: i.redemptionCount >= i.maxRedemptions,
        expired: !!i.expiresAt && i.expiresAt.getTime() < Date.now(),
        tokenPreview: sha256(i.tokenHash).slice(0, 0) + undefined, // never expose any token material
      })),
      events: events.map((e) => ({ ts: e.ts, inviteId: e.inviteId, event: e.event, actorType: e.actorType, detail: e.detailJson ? JSON.parse(e.detailJson) : null })),
      globallyPaused: settings.invitations_paused,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    assertSameOrigin(req);
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const now = new Date();

    if (action === "create") {
      const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : null;
      const maxRedemptions = Math.min(Math.max(Number(body.maxRedemptions ?? 1) || 1, 1), 500);
      const expiresInDays = Number(body.expiresInDays ?? 0);
      const expiresAt = expiresInDays > 0 && expiresInDays <= 365 ? new Date(now.getTime() + expiresInDays * 86_400_000) : null;
      const token = generateInviteToken();
      const invite = await db.betaInvite.create({
        data: { tokenHash: sha256(token), label, maxRedemptions, expiresAt },
      });
      await db.invitationEvent.create({
        data: { inviteId: invite.id, event: "created", actorType: "admin", actorId: admin.adminId, detailJson: JSON.stringify({ label, maxRedemptions, hasExpiry: !!expiresAt }) },
      });
      await audit({
        actorType: "admin", actorId: admin.adminId, action: "invitation.created",
        targetType: "invite", targetId: invite.id,
        after: { label, maxRedemptions, hasExpiry: !!expiresAt },
        correlationId: admin.correlationId, route: "/api/admin/invitations",
      });
      // The ONLY place the raw token is ever returned. Not stored, not logged.
      return NextResponse.json({ ok: true, token, inviteId: invite.id, expiresAt });
    }

    const inviteId = String(body.inviteId ?? "");
    if (action === "revoke") {
      const invite = await db.betaInvite.findUnique({ where: { id: inviteId } });
      if (!invite) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      await db.betaInvite.update({ where: { id: inviteId }, data: { status: "revoked" } });
      await db.invitationEvent.create({ data: { inviteId, event: "revoked", actorType: "admin", actorId: admin.adminId } });
      await audit({ actorType: "admin", actorId: admin.adminId, action: "invitation.revoked", targetType: "invite", targetId: inviteId, before: { status: invite.status }, after: { status: "revoked" }, correlationId: admin.correlationId, route: "/api/admin/invitations" });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const invite = await db.betaInvite.findUnique({ where: { id: inviteId } });
      if (!invite) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      if (invite.redemptionCount > 0) {
        return NextResponse.json({ ok: false, error: "has_redemptions_use_revoke" }, { status: 400 });
      }
      await db.betaInvite.delete({ where: { id: inviteId } });
      await db.invitationEvent.create({ data: { inviteId, event: "deleted", actorType: "admin", actorId: admin.adminId } });
      await audit({ actorType: "admin", actorId: admin.adminId, action: "invitation.deleted", targetType: "invite", targetId: inviteId, before: { label: invite.label }, correlationId: admin.correlationId, route: "/api/admin/invitations" });
      return NextResponse.json({ ok: true });
    }

    if (action === "pause_all" || action === "resume_all") {
      const paused = action === "pause_all";
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
      const settings = await getPlatformSettings();
      await db.platformSetting.upsert({
        where: { key: "invitations_paused" },
        create: { key: "invitations_paused", valueJson: JSON.stringify(paused), description: "When true, ALL invitation redemptions are paused (superset of BetaConfig).", updatedBy: admin.adminId },
        update: { valueJson: JSON.stringify(paused), updatedBy: admin.adminId },
      });
      // keep the legacy runtime gate in sync so the CLI and redemption flow agree
      await db.betaConfig.upsert({
        where: { id: 1 },
        create: { id: 1, registrationsPaused: paused, reason },
        update: { registrationsPaused: paused, reason },
      });
      await db.invitationEvent.create({ data: { inviteId: "*", event: paused ? "paused" : "resumed", actorType: "admin", actorId: admin.adminId, detailJson: JSON.stringify({ reason }) } });
      await audit({ actorType: "admin", actorId: admin.adminId, action: paused ? "invitation.paused_all" : "invitation.resumed_all", targetType: "setting", targetId: "invitations_paused", before: { paused: settings.invitations_paused }, after: { paused, reason }, correlationId: admin.correlationId, route: "/api/admin/invitations" });
      return NextResponse.json({ ok: true });
    }

    if (action === "validate") {
      // dry-run a code WITHOUT consuming a redemption (no profile created)
      const code = typeof body.code === "string" ? body.code : "";
      const check = await checkInvite(code);
      return NextResponse.json({ ok: true, valid: check.ok, rejection: check.rejection ?? null });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (e) {
    return authErrorResponse(e);
  }
}
