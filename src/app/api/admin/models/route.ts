// Task 121 — AI model inventory management. Merges the code registry
// (ensemble.ts ALL_MODELS — trained/untrained status comes ONLY from code +
// validation artifacts) with DB visibility config. The admin UI cannot mark a
// model trained/profitable and cannot promote anything: such fields do not
// exist in this table by construction.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Meta = { name: string; tier: string; tierLabel: string; category: string; trained: boolean; untrainedReason?: string };

async function inventory(): Promise<Meta[]> {
  const mod = (await import("@/lib/latent/ensemble")) as { ALL_MODELS: Meta[] };
  return mod.ALL_MODELS;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const metas = await inventory();
    for (const m of metas) {
      await db.modelAccessConfig.upsert({
        where: { modelId: m.name },
        create: { modelId: m.name },
        update: {},
      });
    }
    const configs = await db.modelAccessConfig.findMany();
    const cfgMap = new Map(configs.map((c) => [c.modelId, c]));
    return NextResponse.json({
      models: metas.map((m) => {
        const c = cfgMap.get(m.name);
        return {
          modelId: m.name, tier: m.tier, tierLabel: m.tierLabel, category: m.category,
          trained: m.trained, untrainedReason: m.untrainedReason ?? null,
          userVisible: c?.userVisible ?? true,
          detailsVisible: c?.detailsVisible ?? true,
          updatedAt: c?.updatedAt ?? null,
        };
      }),
      note: "trained status and validation gates are code/artifact-derived and read-only here",
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
    const modelId = String(body.modelId ?? "");
    const metas = await inventory();
    if (!metas.some((m) => m.name === modelId)) {
      return NextResponse.json({ ok: false, error: "unknown_model" }, { status: 404 });
    }
    const before = await db.modelAccessConfig.findUnique({ where: { modelId } });
    const data: Record<string, unknown> = { updatedBy: admin.adminId };
    for (const k of ["userVisible", "detailsVisible"] as const) {
      if (typeof body[k] === "boolean") data[k] = body[k];
    }
    await db.modelAccessConfig.upsert({
      where: { modelId },
      create: { modelId, ...(data as { userVisible?: boolean; detailsVisible?: boolean }) },
      update: data,
    });
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "model.visibility_changed",
      targetType: "model", targetId: modelId,
      before: before ? { userVisible: before.userVisible, detailsVisible: before.detailsVisible } : null,
      after: data,
      correlationId: admin.correlationId, route: "/api/admin/models",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
