// Task 121 — user management: paginated/searchable list + all admin actions.
// Every action is authorized server-side (requireAdmin), audited, and takes
// effect immediately (no caches between this table and the API guards).
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
  getUsageToday, getPlatformSettings,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/latent/beta-access";

export const dynamic = "force-dynamic";
const PAGE = 20;

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = url.searchParams.get("status") ?? "";
    const plan = url.searchParams.get("plan") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const accessWhere: Record<string, unknown> = {};
    if (status) accessWhere.status = status;
    if (plan) accessWhere.planKey = plan;

    // search: profile id prefix or invite id prefix
    const profileWhere: Record<string, unknown> = {};
    if (q) {
      const or: Array<Record<string, unknown>> = [{ id: { startsWith: q } }, { inviteId: { startsWith: q } }];
      if (/^[A-Za-z0-9-]{8,64}$/.test(q.toUpperCase())) or.push({ sessionTokenHash: sha256(q.toUpperCase()) });
      profileWhere.OR = or;
    }
    if (Object.keys(accessWhere).length) profileWhere.access = { is: accessWhere };

    const [total, profiles] = await Promise.all([
      db.betaProfile.count({ where: profileWhere }),
      db.betaProfile.findMany({
        where: profileWhere,
        include: { access: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE,
        take: PAGE,
      }),
    ]);

    const ids = profiles.map((p) => p.id);
    const [feedbackCounts, plans, settings] = await Promise.all([
      db.betaFeedback.groupBy({ by: ["profileId"], where: { profileId: { in: ids } }, _count: true }),
      db.accessPlan.findMany({ orderBy: { sortOrder: "asc" } }),
      getPlatformSettings(),
    ]);
    const fbMap = new Map(feedbackCounts.map((f) => [f.profileId, f._count]));

    return NextResponse.json({
      total,
      page,
      pageSize: PAGE,
      plans: plans.map((p) => ({ key: p.key, label: p.label, isEnabled: p.isEnabled, isDefault: p.isDefault })),
      defaultPlan: settings.registration_default_plan,
      users: profiles.map((p) => ({
        profileId: p.id,
        createdAt: p.createdAt,
        accessVia: p.accessVia,
        inviteId: p.inviteId,
        profileComplete: p.profileComplete,
        status: p.access?.status ?? "ACTIVE",
        planKey: p.access?.planKey ?? "BASIC",
        accessExpiresAt: p.access?.accessExpiresAt ?? null,
        lastSeenAt: p.access?.lastSeenAt ?? null,
        suspendedReason: p.access?.statusReason ?? null,
        feedbackCount: fbMap.get(p.id) ?? 0,
      })),
      viewer: admin.username,
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
    const profileId = typeof body.profileId === "string" ? body.profileId : "";

    const load = async () => {
      const profile = await db.betaProfile.findUnique({ where: { id: profileId }, include: { access: true } });
      if (!profile) throw new Error("user_not_found");
      return profile;
    };
    const aud = (a: string, before: unknown, after: unknown, extra?: Partial<Parameters<typeof audit>[0]>) =>
      audit({
        actorType: "admin", actorId: admin.adminId, action: a,
        targetType: "user", targetId: profileId,
        before, after, correlationId: admin.correlationId, route: "/api/admin/users", ...extra,
      });

    switch (action) {
      case "suspend": {
        const profile = await load();
        const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
        if (profile.access) {
          await db.profileAccess.update({
            where: { profileId }, data: { status: "SUSPENDED", statusReason: reason },
          });
        } else {
          await db.profileAccess.create({ data: { profileId, status: "SUSPENDED", statusReason: reason } });
        }
        await aud("user.suspend", { status: profile.access?.status ?? "ACTIVE" }, { status: "SUSPENDED", reason });
        return NextResponse.json({ ok: true });
      }
      case "reactivate": {
        const profile = await load();
        await db.profileAccess.update({
          where: { profileId }, data: { status: "ACTIVE", statusReason: null },
        });
        await aud("user.reactivate", { status: profile.access?.status ?? "ACTIVE" }, { status: "ACTIVE" });
        return NextResponse.json({ ok: true });
      }
      case "reset_sessions": {
        const profile = await load();
        await db.betaProfile.update({
          where: { id: profileId },
          data: { sessionTokenHash: sha256(crypto.randomBytes(32).toString("hex")) },
        });
        await aud("user.session_invalidated", { hadSession: true }, { rotated: true });
        return NextResponse.json({ ok: true });
      }
      case "set_plan": {
        const profile = await load();
        const planKey = String(body.planKey ?? "");
        const plan = await db.accessPlan.findUnique({ where: { key: planKey } });
        if (!plan || !plan.isEnabled) return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
        if (profile.access) {
          await db.profileAccess.update({ where: { profileId }, data: { planKey } });
        } else {
          await db.profileAccess.create({ data: { profileId, planKey } });
        }
        await aud("user.plan_changed", { planKey: profile.access?.planKey ?? "BASIC" }, { planKey });
        return NextResponse.json({ ok: true });
      }
      case "set_expiry": {
        const profile = await load();
        const raw = body.accessExpiresAt;
        let expiry: Date | null = null;
        if (typeof raw === "string" && raw.length) {
          const d = new Date(raw);
          if (isNaN(d.getTime())) return NextResponse.json({ ok: false, error: "invalid_date" }, { status: 400 });
          expiry = d;
        }
        if (profile.access) {
          await db.profileAccess.update({ where: { profileId }, data: { accessExpiresAt: expiry } });
        } else {
          await db.profileAccess.create({ data: { profileId, accessExpiresAt: expiry } });
        }
        await aud("user.expiry_changed", { accessExpiresAt: profile.access?.accessExpiresAt ?? null }, { accessExpiresAt: expiry });
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        if (body.confirm !== "DELETE") {
          return NextResponse.json({ ok: false, error: "confirm_required" }, { status: 400 });
        }
        const profile = await load();
        const summary = {
          accessVia: profile.accessVia, inviteId: profile.inviteId,
          status: profile.access?.status ?? "ACTIVE", planKey: profile.access?.planKey ?? "BASIC",
          createdAt: profile.createdAt,
        };
        await db.betaProfile.delete({ where: { id: profileId } }); // cascades ProfileAccess + ProfilePermission
        await aud("user.deleted", summary, null, { failureReason: undefined });
        return NextResponse.json({ ok: true });
      }
      case "usage": {
        const profile = await load();
        const usage = await getUsageToday(profileId);
        await audit({
          actorType: "admin", actorId: admin.adminId, action: "admin.usage.viewed",
          targetType: "user", targetId: profileId, correlationId: admin.correlationId,
          route: "/api/admin/users", after: usage,
        });
        return NextResponse.json({ ok: true, usage });
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "user_not_found") {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }
    return authErrorResponse(err);
  }
}
