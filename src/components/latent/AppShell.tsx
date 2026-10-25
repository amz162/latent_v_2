"use client";

import { useLatentStore } from "@/lib/latent/store";
import { AppFrame } from "./AppFrame";
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
import { PricePatternFinder } from "./PricePatternFinder";

export function AppShell() {
  const view = useLatentStore((s) => s.view);

  // AppFrame wraps the routed view: landing + onboarding render raw (their
  // own full-page chrome); every other view is wrapped in the
  // SidebarProvider → AppSidebar + SidebarInset → AppTopbar layout so the
  // side menu is the persistent navigation, not a top tab strip.
  return (
    <AppFrame>
      {(() => {
        switch (view) {
          case "landing":
            return <HomeV2 />;
          case "onboarding":
            return <Onboarding />;
          case "dashboard":
            return <Dashboard />;
          case "fundamental_news":
            return <FundamentalNews />;
          case "technical_analysis":
            return <TechnicalAnalysis />;
          case "signals_v2":
            return <SignalSection />;
          case "portfolio":
            return <PortfolioTab />;
          case "strategy":
            return <InvestmentStrategy />;
          case "dividends":
            return <Dividends />;
          case "tracker":
            return <Tracker />;
          case "signal_detail":
            return <SignalDetail />;
          case "execute":
            return <ExecuteFlow />;
          case "ai_model_signals":
            return <AiModelSignals />;
          case "calculators":
            return <Calculators />;
          case "pattern_finder":
            return <PricePatternFinder />;
          case "pattern_finder_financial":
            return <PatternFinder />;
          default:
            return <HomeV2 />;
        }
      })()}
    </AppFrame>
  );
}
