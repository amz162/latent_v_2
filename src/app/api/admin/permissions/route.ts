// Task 121 — permissions manager: registry + plans + per-user overrides.
// POST changes are transactional and audited; revocation takes effect
// immediately because the guards resolve permissions per request (no cache).
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const profileId = url.searchParams.get("profileId");

    const [registry, plans] = await Promise.all([
      db.permissionRegistry.findMany({ orderBy: { sortOrder: "asc" } }),
      db.accessPlan.findMany({ include: { planPermissions: true }, orderBy: { sortOrder: "asc" } }),
    ]);

    let profile: { profileId: string; planKey: string; status: string } | null = null;
    let overrides: Array<{ permissionKey: string; effect: string; setByAdminId: string | null; updatedAt: Date }> = [];
    if (profileId) {
      const p = await db.betaProfile.findUnique({ where: { id: profileId }, include: { access: true } });
      if (!p) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
      profile = { profileId: p.id, planKey: p.access?.planKey ?? "BASIC", status: p.access?.status ?? "ACTIVE" };
      overrides = (await db.profilePermission.findMany({ where: { profileId } })).map((o) => ({
        permissionKey: o.permissionKey, effect: o.effect, setByAdminId: o.setByAdminId, updatedAt: o.updatedAt,
      }));
    }

    const history = await db.adminAuditLog.findMany({
      where: { action: { in: ["permission.set", "permission.reset", "tab.global_toggled"] } },
      orderBy: { ts: "desc" }, take: 30,
    });

    return NextResponse.json({
      registry: registry.map((r) => ({
        key: r.key, category: r.category, label: r.label, description: r.description,
        globalEnabled: r.globalEnabled, defaultEffect: r.defaultEffect, isCore: r.isCore,
        interactKey: r.interactKey,
      })),
      plans: plans.map((p) => ({
        key: p.key, label: p.label, isEnabled: p.isEnabled, isDefault: p.isDefault,
        permissions: p.planPermissions.map((pp) => ({ permissionKey: pp.permissionKey, effect: pp.effect })),
      })),
      profile,
      overrides,
      history: history.map((h) => ({ ts: h.ts, action: h.action, actorId: h.actorId, targetId: h.targetId, before: h.beforeJson ? JSON.parse(h.beforeJson) : null, after: h.afterJson ? JSON.parse(h.afterJson) : null })),
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
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    const permissionKey = typeof body.permissionKey === "string" ? body.permissionKey : "";

    const entry = await db.permissionRegistry.findUnique({ where: { key: permissionKey } });
    if (!entry) return NextResponse.json({ ok: false, error: "unknown_permission" }, { status: 400 });

    const existing = await db.profilePermission.findUnique({
      where: { profileId_permissionKey: { profileId, permissionKey } },
    });
    const before = existing ? { effect: existing.effect } : null;
    const effect = body.effect; // "ALLOW" | "DENY" | null (reset)

    if (effect === null || effect === "reset") {
      await db.$transaction([
        db.profilePermission.deleteMany({ where: { profileId, permissionKey } }),
      ]);
      await audit({
        actorType: "admin", actorId: admin.adminId, action: "permission.reset",
        targetType: "user", targetId: profileId,
        before, after: { permissionKey, effect: "(plan default)" },
        correlationId: admin.correlationId, route: "/api/admin/permissions",
      });
      return NextResponse.json({ ok: true, effect: null });
    }
    if (effect !== "ALLOW" && effect !== "DENY") {
      return NextResponse.json({ ok: false, error: "invalid_effect" }, { status: 400 });
    }
    await db.$transaction([
      db.profilePermission.upsert({
        where: { profileId_permissionKey: { profileId, permissionKey } },
        create: { profileId, permissionKey, effect, setByAdminId: admin.adminId },
        update: { effect, setByAdminId: admin.adminId },
      }),
    ]);
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "permission.set",
      targetType: "user", targetId: profileId,
      before, after: { permissionKey, effect },
      correlationId: admin.correlationId, route: "/api/admin/permissions",
    });
    return NextResponse.json({ ok: true, effect });
  } catch (e) {
    return authErrorResponse(e);
  }
}
