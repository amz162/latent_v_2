"use client";

import { useLatentStore } from "@/lib/latent/store";
import { HomeV2 } from "./HomeV2";
import { Onboarding } from "./Onboarding";
import { Dashboard } from "./Dashboard";
import { FundamentalNews } from "./FundamentalNews";
import { TechnicalAnalysis } from "./TechnicalAnalysis";
import { SignalSection } from "./SignalSection";
import { PortfolioTab } from "./PortfolioTab";
import { InvestmentStrategy } from "./InvestmentStrategy";
import { Dividends } from "./Dividends";
import { Tracker } from "./Tracker";
import { SignalDetail } from "./SignalDetail";
import { ExecuteFlow } from "./ExecuteFlow";
import { AiModelSignals } from "./AiModelSignals";
import { Calculators } from "./Calculators";
import { PatternFinder } from "./PatternFinder";
import { AppNav } from "./AppNav";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

// Views that are FULLSCREEN — own hero + own footer; sidebar not shown.
const FULLSCREEN = new Set<string>(["landing", "onboarding"]);

function renderView(view: string) {
  switch (view) {
    case "dashboard":           return <Dashboard />;
    case "fundamental_news":    return <FundamentalNews />;
    case "technical_analysis":  return <TechnicalAnalysis />;
    case "signals_v2":          return <SignalSection />;
    case "portfolio":           return <PortfolioTab />;
    case "strategy":            return <InvestmentStrategy />;
    case "dividends":           return <Dividends />;
    case "tracker":             return <Tracker />;
    case "signal_detail":       return <SignalDetail />;
    case "execute":             return <ExecuteFlow />;
    case "ai_model_signals":    return <AiModelSignals />;
    case "calculators":         return <Calculators />;
    case "pattern_finder":      return <PatternFinder />;
    default:                    return <Dashboard />;
  }
}

export function AppShell() {
  const view = useLatentStore((s) => s.view);

  // Landing + onboarding keep their own full-screen layout (no sidebar).
  if (view === "onboarding") return <Onboarding />;
  if (view === "landing") return <HomeV2 />;
  void FULLSCREEN; // marker — preserved for clarity; landing/onboarding handled above.

  // In-app layout: SidebarProvider wraps the sidebar + main inset in a
  // horizontal flex row; AppNav lives INSIDE the SidebarInset as the inset's
  // sticky header (shadcn's recommended pattern). Root wrapper is
  // `min-h-screen flex flex-col` so a future sticky footer (mt-auto) will
  // pin to the bottom across all views (sticky-footer rule).
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0E1A]">
      <SidebarProvider className="flex-1 min-h-0">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0 flex flex-col p-0">
          <AppNav />
          <main className="flex-1 min-h-0 w-full overflow-y-auto">
            {renderView(view)}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
