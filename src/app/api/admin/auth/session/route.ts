// Task 121 — admin session check (used by the admin panel client to render).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAdmin(req);
    return NextResponse.json({ ok: true, username: ctx.username, adminId: ctx.adminId });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}
