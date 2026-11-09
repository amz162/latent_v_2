// Task 121 — tab & feature management: the global master switch per registry
// entry. globalEnabled=false denies the tab for EVERY user (admins bypass);
// per-user and per-plan grants are managed in Permissions / Plans.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const registry = await db.permissionRegistry.findMany({ orderBy: { sortOrder: "asc" } });
    const planPerms = await db.planPermission.findMany({ where: { effect: "ALLOW" } });
    const grants = new Map<string, string[]>();
    for (const pp of planPerms) {
      const list = grants.get(pp.permissionKey) ?? [];
      list.push(pp.planKey);
      grants.set(pp.permissionKey, list);
    }
    const profileCounts = await db.profilePermission.groupBy({
      by: ["permissionKey"], where: { effect: "ALLOW" }, _count: true,
    });
    const overrides = new Map(profileCounts.map((r) => [r.permissionKey, r._count]));
    return NextResponse.json({
      entries: registry.map((r) => ({
        key: r.key, category: r.category, label: r.label, description: r.description,
        globalEnabled: r.globalEnabled, defaultEffect: r.defaultEffect, isCore: r.isCore,
        interactKey: r.interactKey,
        planGrants: grants.get(r.key) ?? [],
        userAllowOverrides: overrides.get(r.key) ?? 0,
        updatedAt: r.updatedAt,
      })),
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
    const key = String(body.key ?? "");
    const entry = await db.permissionRegistry.findUnique({ where: { key } });
    if (!entry) return NextResponse.json({ ok: false, error: "unknown_permission" }, { status: 404 });
    if (typeof body.globalEnabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });
    }
    if (entry.isCore && body.globalEnabled === false) {
      return NextResponse.json({ ok: false, error: "core_permission" }, { status: 400 });
    }
    await db.permissionRegistry.update({ where: { key }, data: { globalEnabled: body.globalEnabled } });
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "tab.global_toggled",
      targetType: entry.category, targetId: key,
      before: { globalEnabled: entry.globalEnabled },
      after: { globalEnabled: body.globalEnabled },
      correlationId: admin.correlationId, route: "/api/admin/tabs",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
