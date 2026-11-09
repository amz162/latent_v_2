"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLatentStore } from "@/lib/latent/store";
import { permissionForView } from "@/lib/latent/view-acl";
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
import { PaperTradeMonitor } from "./PaperTradeMonitor";
import { GoldenCrossView } from "./GoldenCrossView";
import { AiStockAnalysisView } from "./AiStockAnalysisView";
import { LlmSignalsView } from "./LlmSignalsView";
import { ModelPerformanceReportView } from "./ModelPerformanceReportView";
import { VolatilityAnalyticsView } from "./VolatilityAnalyticsView";
import { useI18n } from "@/lib/latent/i18n";

// Task 121: the view switch is presentation-only. On mount (and every 5
// minutes) the shell re-derives the server-resolved auth context from
// /api/me; a view whose backing permission is not in the effective set
// renders an access notice INSTEAD of the feature. The same permissions are
// enforced by every backing API, so editing this client code or localStorage
// cannot expose restricted data.

function AccessNotice({ view, authenticated }: { view: string; authenticated: boolean }) {
  const t = useI18n((s) => s.t);
  const setView = useLatentStore((s) => s.setView);
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-white/10 bg-[#111726] p-6 text-center">
        <div className="text-3xl mb-3" aria-hidden>🔒</div>
        <h2 className="text-lg font-semibold text-[#F4F7FB] mb-2">
          {authenticated ? "Feature not available on your plan" : "Sign in required"}
        </h2>
        <p className="text-sm text-[#94A3B8] mb-5">
          {authenticated
            ? "Your account does not have permission for this section. Ask your administrator to enable it."
            : "Sign in with your invitation code to use the Latent.pk research platform."}
        </p>
        <div className="flex items-center justify-center gap-3">
          {authenticated ? (
            <button
              onClick={() => setView("dashboard")}
              className="px-4 py-2 rounded-lg bg-[#00E676] text-[#0A0E1A] text-sm font-medium hover:opacity-90"
            >
              {t("nav.dashboard")}
            </button>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg bg-[#00E676] text-[#0A0E1A] text-sm font-medium hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
        <p className="mt-4 text-[10px] font-mono text-[#64748B]">view: {view}</p>
      </div>
    </div>
  );
}

export function AppShell({ initialView }: { initialView?: string }) {
  const view = useLatentStore((s) => s.view);
  const setView = useLatentStore((s) => s.setView);
  const auth = useLatentStore((s) => s.auth);
  const setAuth = useLatentStore((s) => s.setAuth);

  // Resolve the server-side auth context; re-check periodically so admin
  // permission revocations take effect without a re-login.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const d = await res.json();
        if (alive) {
          setAuth({
            loaded: true,
            authenticated: !!d.authenticated,
            isAdmin: !!d.isAdmin,
            status: d.status ?? null,
            planKey: d.plan?.key ?? null,
            planLabel: d.plan?.label ?? null,
            permissions: Array.isArray(d.permissions) ? d.permissions : [],
            usage: d.usage ?? null,
          });
        }
      } catch {
        if (alive) setAuth({ loaded: true });
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [setAuth]);

  useEffect(() => {
    if (initialView) setView(initialView as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const perm = permissionForView(view);
  const allow =
    !auth.loaded ||
    auth.isAdmin ||
    perm === null ||
    (auth.authenticated && auth.status === "ACTIVE" && auth.permissions.includes(perm));

  const content = (() => {
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
      case "paper_monitor":
        return <PaperTradeMonitor />;
      case "golden_cross":
        return <GoldenCrossView />;
      case "volatility_analytics":
        return <VolatilityAnalyticsView />;
      case "ai_analysis":
        return <AiStockAnalysisView />;
      case "llm_signals":
        return <LlmSignalsView />;
      case "model_report":
        return <ModelPerformanceReportView />;
      case "calculators":
        return <Calculators />;
      case "pattern_finder":
        return <PricePatternFinder />;
      case "pattern_finder_financial":
        return <PatternFinder />;
      default:
        return <HomeV2 />;
    }
  })();

  return (
    <AppFrame>
      {allow ? content : <AccessNotice view={view} authenticated={auth.authenticated} />}
    </AppFrame>
  );
}
