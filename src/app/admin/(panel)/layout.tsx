// Task 121 — guarded admin layout (route group (panel)). Every page under
// /admin except /admin/login renders through here: the server verifies the
// AdminSession against the database BEFORE any child renders. A user session
// (BetaProfile cookie) grants nothing here — the planes are separate cookies
// and separate tables.
import type { ReactNode } from "react";
import { AdminShell } from "@/components/latent/admin/AdminShell";
import { requireAdminPageRedirect } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPageRedirect();
  return <AdminShell username={admin.username}>{children}</AdminShell>;
}
