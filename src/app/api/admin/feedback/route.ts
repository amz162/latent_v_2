// Task 121 — feedback triage. Admin sees ALL feedback; normal users can only
// submit their own (no read API for users). Status transitions are audited.
import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const PAGE = 25;
const STATUSES = ["new", "triaged", "resolved"];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [total, rows] = await Promise.all([
      db.betaFeedback.count({ where }),
      db.betaFeedback.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    ]);

    // profile existence map (deleted profiles are labeled, not hidden)
    const ids = [...new Set(rows.map((r) => r.profileId).filter((x): x is string => !!x))];
    const profiles = ids.length ? await db.betaProfile.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
    const alive = new Set(profiles.map((p) => p.id));

    return NextResponse.json({
      total, page, pageSize: PAGE,
      feedback: rows.map((r) => ({
        id: r.id, category: r.category, message: r.message, route: r.route,
        status: r.status, createdAt: r.createdAt,
        profileId: r.profileId,
        profileExists: r.profileId ? alive.has(r.profileId) : false,
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
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    if (!STATUSES.includes(status)) return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    const row = await db.betaFeedback.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    await db.betaFeedback.update({ where: { id }, data: { status } });
    await audit({
      actorType: "admin", actorId: admin.adminId, action: "feedback.triaged",
      targetType: "feedback", targetId: id,
      before: { status: row.status }, after: { status },
      correlationId: admin.correlationId, route: "/api/admin/feedback",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
