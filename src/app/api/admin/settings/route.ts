// Task 121 — platform settings. Whitelisted keys with type validation; the
// security-critical beta gates (BETA_ONBOARDING_ENABLED env, BetaConfig) stay
// separate so a setting change can never weaken authentication itself.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse, getPlatformSettings,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BOOL_KEYS = ["maintenance_mode", "feature_pause", "llm_requests_enabled", "feedback_enabled", "invitations_paused"];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [settings, rows, plans] = await Promise.all([
      getPlatformSettings(),
      db.platformSetting.findMany(),
      db.accessPlan.findMany({ where: { isEnabled: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    const meta = new Map(rows.map((r) => [r.key, { updatedAt: r.updatedAt, updatedBy: r.updatedBy, description: r.description }]));
    return NextResponse.json({
      settings,
      meta: Object.fromEntries([...meta.entries()].map(([k, v]) => [k, v])),
      plans: plans.map((p) => ({ key: p.key, label: p.label, isDefault: p.isDefault })),
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
    const value = body.value;

    let valueJson: string;
    if (BOOL_KEYS.includes(key)) {
      if (typeof value !== "boolean") return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });
      valueJson = JSON.stringify(value);
    } else if (key === "registration_default_plan") {
      const planKey = String(value ?? "");
      const plan = await db.accessPlan.findUnique({ where: { key: planKey } });
      if (!plan || !plan.isEnabled) return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
      valueJson = JSON.stringify(planKey);
    } else {
      return NextResponse.json({ ok: false, error: "unknown_setting" }, { status: 400 });
    }

    const before = await db.platformSetting.findUnique({ where: { key } });
    await db.platformSetting.upsert({
      where: { key },
      create: { key, valueJson, description: before?.description ?? "", updatedBy: admin.adminId },
      update: { valueJson, updatedBy: admin.adminId },
    });
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "setting.changed",
      targetType: "setting", targetId: key,
      before: before ? { value: JSON.parse(before.valueJson) } : null,
      after: { value: JSON.parse(valueJson) },
      correlationId: admin.correlationId, route: "/api/admin/settings",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
