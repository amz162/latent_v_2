// Task 121 — audit log viewer (read-only). Append-only by construction: this
// API and every other code path only ever CREATE audit rows — there is no
// update or delete anywhere. Filterable + paginated.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, authErrorResponse } from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const PAGE = 50;

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const actorType = url.searchParams.get("actorType") ?? "";
    const result = url.searchParams.get("result") ?? "";
    const targetType = url.searchParams.get("targetType") ?? "";
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const where: Record<string, unknown> = {};
    if (action) where.action = { contains: action };
    if (actorType) where.actorType = actorType;
    if (result) where.result = result;
    if (targetType) where.targetType = targetType;
    if (q) where.OR = [{ action: { contains: q } }, { targetId: { contains: q } }, { actorId: { contains: q } }];

    const [total, rows] = await Promise.all([
      db.adminAuditLog.count({ where }),
      db.adminAuditLog.findMany({
        where, orderBy: { ts: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      }),
    ]);

    return NextResponse.json({
      total, page, pageSize: PAGE,
      entries: rows.map((r) => ({
        id: r.id, ts: r.ts, actorType: r.actorType, actorId: r.actorId,
        action: r.action, targetType: r.targetType, targetId: r.targetId,
        before: r.beforeJson ? JSON.parse(r.beforeJson) : null,
        after: r.afterJson ? JSON.parse(r.afterJson) : null,
        result: r.result, failureReason: r.failureReason,
        correlationId: r.correlationId, route: r.route,
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
