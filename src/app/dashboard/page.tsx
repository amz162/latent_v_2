// Task 121 — authenticated user dashboard. The server verifies the session,
// account status and expiry BEFORE anything renders; anonymous or suspended
// visitors are redirected to /login. This page is a real URL, but the SPA
// views inside remain client-side — every backing API enforces the same
// permissions server-side, so URL access alone grants nothing.
import { redirect } from "next/navigation";
import { AppShell } from "@/components/latent/AppShell";
import { requireUserPageRedirect } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireUserPageRedirect();
  if (ctx.status !== "ACTIVE") redirect("/login?error=account_suspended");
  return <AppShell initialView="dashboard" />;
}
