// Task 121 — plans & limits: read + update plan metadata, numeric limits and
// plan-level permission rows. Plan changes apply immediately (guards read the
// DB per request). isDefault is exclusive — only one default plan.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const LIMIT_KEYS = ["maxDailyLlmRequests", "maxDailyReportExports", "maxDailySimulatorRuns", "maxDailyApiRequests", "accountExpiryDays"] as const;

function sanitizeLimits(raw: unknown): Record<string, number | null> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const out: Record<string, number | null> = {};
  for (const k of LIMIT_KEYS) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100_000) out[k] = v;
    else return null;
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [plans, registry] = await Promise.all([
      db.accessPlan.findMany({ include: { planPermissions: true, _count: { select: { profiles: true } } }, orderBy: { sortOrder: "asc" } }),
      db.permissionRegistry.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    return NextResponse.json({
      plans: plans.map((p) => ({
        key: p.key, label: p.label, isEnabled: p.isEnabled, isDefault: p.isDefault,
        sortOrder: p.sortOrder, limits: JSON.parse(p.limitsJson || "{}"),
        profileCount: p._count.profiles,
        permissions: p.planPermissions.map((pp) => ({ permissionKey: pp.permissionKey, effect: pp.effect })),
      })),
      registry: registry.map((r) => ({ key: r.key, label: r.label, category: r.category })),
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
    const plan = await db.accessPlan.findUnique({ where: { key }, include: { planPermissions: true } });
    if (!plan) return NextResponse.json({ ok: false, error: "unknown_plan" }, { status: 404 });

    const before = { label: plan.label, isEnabled: plan.isEnabled, isDefault: plan.isDefault, limits: JSON.parse(plan.limitsJson || "{}") };
    const data: Record<string, unknown> = {};

    if (typeof body.label === "string" && body.label.trim().length >= 1 && body.label.length <= 40) {
      data.label = body.label.trim();
    }
    if (typeof body.isEnabled === "boolean") {
      // never disable the default plan while it is the default
      if (!body.isEnabled && plan.isDefault) {
        return NextResponse.json({ ok: false, error: "cannot_disable_default_plan" }, { status: 400 });
      }
      data.isEnabled = body.isEnabled;
    }
    if (body.isDefault === true) {
      data.isDefault = true;
      data.isEnabled = true;
    }
    const limits = sanitizeLimits(body.limits);
    if (limits) data.limitsJson = JSON.stringify(limits);

    if (Object.keys(data).length) {
      await db.accessPlan.update({ where: { key }, data });
    }
    if (body.isDefault === true) {
      await db.accessPlan.updateMany({ where: { isDefault: true, key: { not: key } }, data: { isDefault: false } });
    }

    // plan permission updates: { permissions: [{permissionKey, effect|null}] }
    const perms = body.permissions;
    if (Array.isArray(perms)) {
      for (const p of perms as Array<{ permissionKey?: unknown; effect?: unknown }>) {
        const pk = typeof p.permissionKey === "string" ? p.permissionKey : "";
        if (!pk) continue;
        const entry = await db.permissionRegistry.findUnique({ where: { key: pk } });
        if (!entry) continue;
        const existing = plan.planPermissions.find((x) => x.permissionKey === pk);
        if (p.effect === null || p.effect === "reset") {
          if (existing) await db.planPermission.delete({ where: { id: existing.id } });
        } else if (p.effect === "ALLOW" || p.effect === "DENY") {
          await db.planPermission.upsert({
            where: { planKey_permissionKey: { planKey: key, permissionKey: pk } },
            create: { planKey: key, permissionKey: pk, effect: p.effect },
            update: { effect: p.effect },
          });
        }
      }
    }

    const after = await db.accessPlan.findUnique({ where: { key }, include: { planPermissions: true } });
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "plan.updated",
      targetType: "plan", targetId: key,
      before, after: after ? { label: after.label, isEnabled: after.isEnabled, isDefault: after.isDefault, limits: JSON.parse(after.limitsJson || "{}"), permissions: after.planPermissions.map((p) => `${p.permissionKey}:${p.effect}`) } : null,
      correlationId: admin.correlationId, route: "/api/admin/plans",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
