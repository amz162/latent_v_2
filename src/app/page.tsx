// Task 121 — entry point. Role routing happens SERVER-side from the session
// cookies: an admin session lands on the admin panel, an authenticated user
// lands on their dashboard, anonymous visitors see the public landing page.
// The role is never taken from any browser-supplied value.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/latent/AppShell";
import { db } from "@/lib/db";
import { BETA_COOKIE, sha256 } from "@/lib/latent/beta-access";
import { ADMIN_COOKIE } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export default async function Home() {
  const store = await cookies();
  const adminToken = store.get(ADMIN_COOKIE)?.value;
  if (adminToken && /^[a-f0-9]{64}$/.test(adminToken)) {
    const session = await db.adminSession.findUnique({
      where: { tokenHash: sha256(adminToken) },
      include: { admin: true },
    });
    if (session && !session.revokedAt && session.expiresAt.getTime() > Date.now() && session.admin.isActive) {
      redirect("/admin");
    }
  }
  const betaToken = store.get(BETA_COOKIE)?.value;
  if (betaToken && /^[a-f0-9]{64}$/.test(betaToken)) {
    const profile = await db.betaProfile.findUnique({
      where: { sessionTokenHash: sha256(betaToken) },
    });
    if (profile) {
      const access = await db.profileAccess.findUnique({ where: { profileId: profile.id } });
      if (
        access &&
        access.status === "ACTIVE" &&
        (!access.accessExpiresAt || access.accessExpiresAt.getTime() > Date.now())
      ) {
        redirect("/dashboard");
      }
    }
  }
  return <AppShell />;
}
