"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { BrandMark } from "./BrandMark";
import { useLatentStore, type LatentView } from "@/lib/latent/store";
import { useI18n } from "@/lib/latent/i18n";
import {
  LayoutDashboard,
  Newspaper,
  BarChart3,
  Zap,
  Brain,
  Calculator,
  Search,
  Briefcase,
  Target,
  Coins,
  Activity,
} from "lucide-react";

// 11 sidebar items (Dashboard added at the top — was previously only reachable
// via the BrandMark logo click in the top bar). Order matches the old top tab
// strip with Dashboard prepended for prominence.
const NAV_ITEMS: { view: LatentView; key: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { view: "dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { view: "fundamental_news", key: "nav.fundamental_news", icon: Newspaper },
  { view: "technical_analysis", key: "nav.technical_analysis", icon: BarChart3 },
  { view: "signals_v2", key: "nav.signals", icon: Zap },
  { view: "ai_model_signals", key: "nav.ai_model_signals", icon: Brain },
  { view: "calculators", key: "nav.calculators", icon: Calculator },
  { view: "pattern_finder", key: "nav.pattern_finder", icon: Search },
  { view: "portfolio", key: "nav.portfolio", icon: Briefcase },
  { view: "strategy", key: "nav.strategy", icon: Target },
  { view: "dividends", key: "nav.dividends", icon: Coins },
  { view: "tracker", key: "nav.tracker", icon: Activity },
];

export function AppSidebar() {
  const view = useLatentStore((s) => s.view);
  const setView = useLatentStore((s) => s.setView);
  const t = useI18n((s) => s.t);

  return (
    <Sidebar
      collapsible="icon"
      className="bg-[#0A0E1A] border-r border-white/[0.06]"
    >
      <SidebarHeader className="border-b border-white/[0.06] px-3 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView("dashboard")}
            className="hover:opacity-80 shrink-0 data-[state=open]:opacity-80"
            aria-label="Go to dashboard"
          >
            <BrandMark size="sm" />
          </button>
          {/* Desktop collapse trigger (the shadcn SidebarTrigger auto-renders
              a Sheet-trigger on mobile, so we keep it inside the header). */}
          <SidebarTrigger className="hidden lg:flex text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-white/[0.04]" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              view === item.view ||
              (view === "signal_detail" && item.view === "signals_v2") ||
              (view === "execute" && item.view === "signals_v2");
            return (
              <SidebarMenuItem key={item.view}>
                <SidebarMenuButton
                  isActive={active}
                  onClick={() => setView(item.view)}
                  tooltip={t(item.key)}
                  className={
                    active
                      ? "bg-[#00E676]/10 text-[#00E676] hover:bg-[#00E676]/15"
                      : "text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-white/[0.04]"
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs whitespace-nowrap">{t(item.key)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer slot — preserved for a future global sticky footer.
          `mt-auto` pins it to the bottom of the sidebar (sticky-footer rule). */}
      <SidebarFooter className="mt-auto">
        <div className="px-3 py-2 text-[10px] text-[#64748B] font-mono">
          latent.pk · v0.2
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
