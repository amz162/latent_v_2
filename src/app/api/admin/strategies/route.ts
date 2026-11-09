// Task 121 — strategy visibility management. Merges the CODE registry
// (STRATEGY_INVENTORY — the immutable method definitions) with the DB config
// (StrategyConfig — display-only admin controls). Visibility changes NEVER
// touch calculations, validation status, or the blocked pairs/Kalman policy.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Meta = { strategyId: string; strategyName: string; role: string; family: string; votesInFusion: boolean; methodVersion: string; restrictions: string };

async function inventory(): Promise<Meta[]> {
  const mod = (await import("@/lib/latent/strategies/engine")) as { STRATEGY_INVENTORY: Meta[] };
  return mod.STRATEGY_INVENTORY;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const metas = await inventory();
    // lazy-sync config rows for any new code-registered strategy
    for (const m of metas) {
      await db.strategyConfig.upsert({
        where: { strategyId: m.strategyId },
        create: { strategyId: m.strategyId },
        update: {},
      });
    }
    const configs = await db.strategyConfig.findMany();
    const cfgMap = new Map(configs.map((c) => [c.strategyId, c]));
    return NextResponse.json({
      strategies: metas.map((m) => {
        const c = cfgMap.get(m.strategyId);
        return {
          strategyId: m.strategyId,
          strategyName: m.strategyName,
          role: m.role,
          family: m.family,
          votesInFusion: m.votesInFusion,
          methodVersion: m.methodVersion,
          restrictions: m.restrictions,
          userVisible: c?.userVisible ?? true,
          availabilityEnabled: c?.availabilityEnabled ?? true,
          readOnly: c?.readOnly ?? false,
          updatedAt: c?.updatedAt ?? null,
        };
      }),
      note: "display-only controls — calculations, validation status and the pairs/Kalman long-only block are code-level and cannot be changed here",
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
    const strategyId = String(body.strategyId ?? "");
    const metas = await inventory();
    const meta = metas.find((m) => m.strategyId === strategyId);
    if (!meta) return NextResponse.json({ ok: false, error: "unknown_strategy" }, { status: 404 });

    const before = await db.strategyConfig.findUnique({ where: { strategyId } });
    const data: Record<string, unknown> = { updatedBy: admin.adminId };
    for (const k of ["userVisible", "availabilityEnabled", "readOnly"] as const) {
      if (typeof body[k] === "boolean") data[k] = body[k];
    }
    await db.strategyConfig.upsert({
      where: { strategyId },
      create: { strategyId, ...(data as { userVisible?: boolean; availabilityEnabled?: boolean; readOnly?: boolean }) },
      update: data,
    });
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "strategy.updated",
      targetType: "strategy", targetId: strategyId,
      before: before ? { userVisible: before.userVisible, availabilityEnabled: before.availabilityEnabled, readOnly: before.readOnly } : null,
      after: data,
      correlationId: admin.correlationId, route: "/api/admin/strategies",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
