// Task 121 — user-management report export (CSV). Admin-only. Contains NO
// tokens, hashes, cookies or secrets — operational metadata only.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, audit, authErrorResponse } from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const profiles = await db.betaProfile.findMany({
      include: { access: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const feedbackCounts = await db.betaFeedback.groupBy({ by: ["profileId"], _count: true });
    const fbMap = new Map(feedbackCounts.map((f) => [f.profileId, f._count]));

    const header = ["profile_id", "created_at", "access_via", "invite_id", "profile_complete", "status", "plan", "access_expires_at", "last_seen_at", "feedback_count"];
    const lines = [header.join(",")];
    for (const p of profiles) {
      lines.push([
        p.id, p.createdAt.toISOString(), p.accessVia, p.inviteId ?? "", p.profileComplete,
        p.access?.status ?? "ACTIVE", p.access?.planKey ?? "BASIC",
        p.access?.accessExpiresAt?.toISOString() ?? "", p.access?.lastSeenAt?.toISOString() ?? "",
        fbMap.get(p.id) ?? 0,
      ].map(csvCell).join(","));
    }

    await audit({
      actorType: "admin", actorId: admin.adminId, action: "report.users_exported",
      targetType: "report", targetId: "users.csv",
      after: { rows: profiles.length },
      correlationId: admin.correlationId, route: "/api/admin/export/users",
    });

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="latent_users_${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
