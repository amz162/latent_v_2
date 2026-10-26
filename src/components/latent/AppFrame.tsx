"use client";

// AppFrame — single layout for the whole app.
//
// Issue: "why you switch the side menu into top nav again ..? change the top
// nav into side menu, when person click on explore the platform then show
// the side menu."
//
// Behaviour:
//   - On the marketing landing page (view === "landing") AND during the
//     guided onboarding flow (view === "onboarding") we render the child
//     full-screen with NO sidebar / NO topbar — those views have their own
//     bespoke chrome (HomeV2 has its own header; Onboarding is a focused
//     wizard). This matches "show the side menu only AFTER the person clicks
//     Explore the Platform".
//   - For every other view we render the shadcn SidebarProvider layout:
//     a persistent AppSidebar (11 nav items) + a SidebarInset containing the
//     slim AppTopbar (utilities only — no nav tabs) + the routed view +
//     a sticky compliance footer pinned to the bottom.
//
// Every view component used to render its own <AppNav /> top nav. That has
// been removed from each view — AppFrame is the single source of the header
// so the side menu can never silently revert to a top tab strip again.

import { type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { useLatentStore } from "@/lib/latent/store";

export function AppFrame({ children }: { children: ReactNode }) {
  const view = useLatentStore((s) => s.view);

  // Pre-platform views render raw — their own full-page chrome.
  if (view === "landing" || view === "onboarding") {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen bg-[#0A0E1A]">
        <AppTopbar />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
