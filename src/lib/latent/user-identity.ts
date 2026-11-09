// Task 121 — session-derived legacy-user identity. The legacy MVP layer
// (User/RiskProfile/Plan/Trade) previously trusted client-supplied emails and
// userIds (spoofable). Now every legacy row is keyed to the authenticated
// beta session via a deterministic internal email — the client cannot select
// another user's data because the identity never comes from the request body.
import { db } from "@/lib/db";
import type { UserContext } from "./access-control";

export async function getOrCreateSessionUser(
  ctx: UserContext,
  displayName?: string | null
): Promise<{ id: string; email: string; name: string | null }> {
  const email = `beta-${ctx.profileId}@users.latent.internal`;
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { email, name: displayName ?? null } });
  } else if (displayName && !user.name) {
    user = await db.user.update({ where: { id: user.id }, data: { name: displayName } });
  }
  return { id: user.id, email: user.email, name: user.name };
}
