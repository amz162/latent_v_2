import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, isBetaActive, sameOrigin } from "@/lib/latent/beta-access";
import { errorResponse } from "@/lib/latent/error-codes";
import { rateLimit, clientKey } from "@/lib/latent/rate-limit";

// Task 117 Part I4 — beta feedback.
//
// Six fixed categories, bounded free-text, no free-form identity fields.
// Validation is server-side; rate limits apply per session and per IP hash.
// The acknowledgment is returned ONLY after the row is actually persisted.
// Exports happen via the operator CLI (scripts/task117_beta_admin.py) and
// strip profile identity by default.

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "confusing_info",
  "incorrect_company_data",
  "stale_prices",
  "broken_interface",
  "missing_feature",
  "general",
] as const;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return errorResponse("profile_validation_error");
  const gate = await isBetaActive();
  if (!gate.active) return errorResponse("profile_validation_error", { betaDisabled: true });

  const session = await getSession(req);
  if (!session) return errorResponse("invitation_invalid"); // feedback is for beta participants

  const ipKey = clientKey(req);
  const perSession = rateLimit("feedback_session", session.profileId, 5, 24 * 60 * 60 * 1000);
  const perIp = rateLimit("feedback_ip", ipKey, 10, 24 * 60 * 60 * 1000);
  if (!perSession.allowed || !perIp.allowed) {
    return errorResponse("rate_limited", { retryAfterSec: Math.max(perSession.retryAfterSec, perIp.retryAfterSec) });
  }

  let body: { category?: unknown; message?: unknown; route?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse("profile_validation_error");
  }

  const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category)
    ? body.category
    : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!category) return errorResponse("profile_validation_error", { field: "category" });
  if (message.length < 3 || message.length > 2000) {
    return errorResponse("profile_validation_error", { field: "message" });
  }
  const route = typeof body.route === "string" && body.route.length <= 200 ? body.route : null;

  // light spam heuristic: links-heavy or repeated-character floods are rejected
  const linkCount = (message.match(/https?:\/\//g) ?? []).length;
  const repeated = /(.)\1{40,}/.test(message);
  if (linkCount > 3 || repeated) return errorResponse("profile_validation_error", { field: "message" });

  try {
    const row = await db.betaFeedback.create({
      data: { profileId: session.profileId, category, message, route },
    });
    // acknowledge only after the row exists
    return Response.json({ received: true, id: row.id, message: "Thank you — your feedback has been saved. The operator reviews it manually." });
  } catch (err) {
    console.error("[beta/feedback POST] database error (no detail emitted to client)");
    return errorResponse("database_unavailable");
  }
}
