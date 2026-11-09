// Task 121 — admin login. Separate identity plane from users; no public
// registration path exists anywhere. Rate limiting + durable lockout +
// uniform failure shape (no username enumeration). Session token is stored
// hashed; the raw token lives only in the HttpOnly admin cookie.
import { NextRequest, NextResponse } from "next/server";
import { adminLogin, setAdminSessionCookie } from "@/lib/latent/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let username = "";
  let password = "";
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown };
    username = typeof body.username === "string" ? body.username : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  try {
    const result = await adminLogin(req, username, password);
    const res = NextResponse.json(
      result.ok
        ? { ok: true, username: result.username }
        : { ok: false, error: result.code, message: result.message },
      { status: result.status }
    );
    if (result.ok && result.token) {
      setAdminSessionCookie(res, req, result.token);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.message === "cross_origin_blocked") {
      return NextResponse.json({ ok: false, error: "cross_origin_blocked" }, { status: 403 });
    }
    console.error("[admin/login] error (no detail emitted)");
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
