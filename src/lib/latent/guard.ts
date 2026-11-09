// Task 121 — route-handler guards. Wrap an existing handler to require an
// authenticated ACTIVE user with an optional permission; AuthError responses
// (401/403/429/503) are converted uniformly. The handler receives the resolved
// UserContext so routes can read plan/limits/usage without re-querying.
import type { NextRequest } from "next/server";
import { requireUser, AuthError, type UserContext } from "./access-control";

type Handler = (
  req: NextRequest,
  segment: unknown,
  user: UserContext
) => Promise<Response>;

/**
 * Gate: any authenticated ACTIVE user (optionally with a permission key).
 * Usage:
 *   export const GET = withUser("feature.market_data", async (req) => { ... });
 *   export const GET = withUser<{ params: Promise<{ symbol: string }> }>(
 *     "feature.signal_data", async (req, { params }) => { ... });
 */
export function withUser(permission: string | null, handler: Handler) {
  return async (req: NextRequest, segment?: unknown): Promise<Response> => {
    try {
      const user = await requireUser(req, permission ?? undefined);
      return await handler(req, segment, user);
    } catch (e) {
      if (e instanceof AuthError) {
        return Response.json({ ok: false, error: e.code, message: e.message }, { status: e.status });
      }
      throw e;
    }
  };
}
