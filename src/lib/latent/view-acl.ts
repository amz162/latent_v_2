// Task 121 — client-side mapping of SPA views to permission-registry keys.
// This file only decides WHAT TO RENDER. The actual security boundary is
// server-side (src/lib/latent/access-control.ts): every backing API enforces
// the same permission, so tampering with this map (or localStorage) cannot
// unlock content — restricted views simply render a notice and their APIs
// return 403.
import type { LatentView } from "@/lib/latent/store";

export const VIEW_PERMISSION: Record<LatentView, string | null> = {
  landing: null, // public marketing page
  onboarding: null, // requires authentication (any ACTIVE user), no tab permission
  dashboard: "tab.dashboard",
  fundamental_news: "tab.fundamental_news",
  technical_analysis: "tab.technical_analysis",
  signals_v2: "tab.signals_v2",
  signal_detail: "tab.signal_detail",
  execute: "tab.execute",
  portfolio: "tab.portfolio",
  strategy: "tab.strategy",
  dividends: "tab.dividends",
  tracker: "tab.tracker",
  ai_model_signals: "tab.ai_model_signals",
  paper_monitor: "tab.paper_monitor",
  golden_cross: "tab.golden_cross",
  volatility_analytics: "tab.volatility_analytics",
  ai_analysis: "tab.llm_signals", // research view lives under the LLM Signals permission
  llm_signals: "tab.llm_signals",
  model_report: "tab.model_report",
  calculators: "tab.calculators",
  pattern_finder: "tab.pattern_finder",
  pattern_finder_financial: "tab.pattern_finder_financial",
  // legacy view ids still referenced by old setView() calls
  plan: "tab.strategy",
  track_record: "tab.dashboard",
  signals: "tab.signals_v2",
};

export function permissionForView(view: LatentView): string | null {
  return VIEW_PERMISSION[view] ?? null;
}
