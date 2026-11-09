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
import { VIEW_PERMISSION } from "@/lib/latent/view-acl";
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
  RadioTower,
  TrendingUp,
  Waves,
  ListChecks,
  FileBarChart,
} from "lucide-react";

// Sidebar items: Dashboard prepended at the top; research tabs (LLM Signals,
// Model Performance) appended after Volatility Analytics. Order otherwise
// matches the old top tab strip.
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
  { view: "paper_monitor", key: "nav.paper_monitor", icon: RadioTower },
  { view: "golden_cross", key: "nav.golden_cross", icon: TrendingUp },
  { view: "volatility_analytics", key: "nav.volatility_analytics", icon: Waves },
  { view: "llm_signals", key: "nav.llm_signals", icon: ListChecks },
  { view: "model_report", key: "nav.model_report", icon: FileBarChart },
];

export function AppSidebar() {
  const view = useLatentStore((s) => s.view);
  const setView = useLatentStore((s) => s.setView);
  const t = useI18n((s) => s.t);
  const auth = useLatentStore((s) => s.auth);

  // Server-resolved permissions decide what is NAVIGABLE. Until /api/me has
  // answered we render nothing (no flash of restricted tabs); admins see all.
  const can = (key: string | null) =>
    !!key && (auth.isAdmin || auth.permissions.includes(key));
  const items = !auth.loaded
    ? []
    : NAV_ITEMS.filter((item) => can(VIEW_PERMISSION[item.view]));

  const signOut = async () => {
    try {
      await fetch("/api/user/logout", { method: "POST" });
    } catch {
      // cookie clearing happens server-side; proceed with local reset either way
    }
    window.location.href = "/";
  };

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
          {items.map((item) => {
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
          {auth.loaded && items.length === 0 && (
            <div className="px-3 py-2 text-[10px] text-[#64748B] font-mono">
              no authorized tabs
            </div>
          )}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer: plan indicator + profile + sign out. Profile self-service
          reuses the existing secure /beta/onboarding surface. */}
      <SidebarFooter className="mt-auto">
        {auth.loaded && auth.authenticated && !auth.isAdmin && (
          <div className="px-3 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#00E676] border border-[#00E676]/30 rounded px-1.5 py-0.5">
              {auth.planLabel ?? auth.planKey ?? "user"}
            </span>
            <a
              href="/beta/onboarding"
              className="text-[10px] text-[#94A3B8] hover:text-[#F4F7FB]"
            >
              Profile
            </a>
          </div>
        )}
        {auth.loaded && (auth.authenticated || auth.isAdmin) && (
          <div className="px-3 pb-2">
            <button
              onClick={signOut}
              className="w-full text-left text-[11px] text-[#94A3B8] hover:text-[#FF5C5C]"
            >
              Sign out
            </button>
          </div>
        )}
        <div className="px-3 py-2 text-[10px] text-[#64748B] font-mono">
          latent.pk · v0.2
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
