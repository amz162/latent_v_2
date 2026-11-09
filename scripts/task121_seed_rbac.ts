// Task 121 — idempotent RBAC seed: permission registry, access plans, plan
// permissions, platform settings, BetaConfig row. Safe to re-run (upserts).
// Run: bun scripts/task121_seed_rbac.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ---- permission registry (every managed tab + feature) ----

interface RegistryEntry {
  key: string;
  category: "tab" | "feature";
  label: string;
  description: string;
  sortOrder: number;
  defaultEffect: "ALLOW" | "DENY";
  interactKey?: string;
  isCore?: boolean;
}

const REGISTRY: RegistryEntry[] = [
  { key: "tab.dashboard", category: "tab", label: "Dashboard", description: "Main overview: consensus signals, track record.", sortOrder: 1, defaultEffect: "ALLOW" },
  { key: "tab.fundamental_news", category: "tab", label: "News & Fundamentals", description: "Market news feed with AI interpretation.", sortOrder: 2, defaultEffect: "DENY" },
  { key: "tab.technical_analysis", category: "tab", label: "Technical Analysis", description: "Index levels and indicator matrix.", sortOrder: 3, defaultEffect: "DENY" },
  { key: "tab.signals_v2", category: "tab", label: "Strategy Signals", description: "BUY/SELL signal list from the model ensemble.", sortOrder: 4, defaultEffect: "DENY" },
  { key: "tab.signal_detail", category: "tab", label: "Strategy Details", description: "Per-stock deep-dive (sub-view of Strategy Signals).", sortOrder: 5, defaultEffect: "DENY" },
  { key: "tab.execute", category: "tab", label: "Simulated Execution", description: "Paper execution flow (shadow only, never real money).", sortOrder: 6, defaultEffect: "DENY" },
  { key: "tab.ai_model_signals", category: "tab", label: "AI Models", description: "Model inventory, ensemble signals and backtest graphs.", sortOrder: 7, defaultEffect: "DENY" },
  { key: "tab.calculators", category: "tab", label: "Calculators & Tools", description: "CGT, dividend tax, SIP and position-size calculators.", sortOrder: 8, defaultEffect: "DENY" },
  { key: "tab.pattern_finder", category: "tab", label: "Price Pattern Finder", description: "Technical price patterns per symbol.", sortOrder: 9, defaultEffect: "DENY", interactKey: "feature.llm_interact" },
  { key: "tab.pattern_finder_financial", category: "tab", label: "Results Pattern Finder", description: "Quarterly-results patterns (sub-view).", sortOrder: 10, defaultEffect: "DENY" },
  { key: "tab.portfolio", category: "tab", label: "Portfolio Simulator", description: "Personal watchlist/positions simulator.", sortOrder: 11, defaultEffect: "DENY", interactKey: "feature.research_backtest" },
  { key: "tab.strategy", category: "tab", label: "Strategy Planner", description: "Goal-based investment planning wizard.", sortOrder: 12, defaultEffect: "DENY" },
  { key: "tab.dividends", category: "tab", label: "Dividends", description: "Dividend announcements and calendar.", sortOrder: 13, defaultEffect: "DENY" },
  { key: "tab.tracker", category: "tab", label: "Accuracy Tracker", description: "Signal/portfolio accuracy and simulations.", sortOrder: 14, defaultEffect: "DENY", interactKey: "feature.research_backtest" },
  { key: "tab.paper_monitor", category: "tab", label: "Paper Trade Monitor", description: "Shadow paper-trade lifecycle monitor (task 107).", sortOrder: 15, defaultEffect: "DENY" },
  { key: "tab.golden_cross", category: "tab", label: "Golden Cross Scanner", description: "MA7/MA30 crossover scanner.", sortOrder: 16, defaultEffect: "DENY" },
  { key: "tab.volatility_analytics", category: "tab", label: "Volatility Analytics", description: "Realized-vol research analytics.", sortOrder: 17, defaultEffect: "DENY" },
  { key: "tab.llm_signals", category: "tab", label: "LLM Signals", description: "Frozen GLM-4.6 shadow signal history (research-only).", sortOrder: 18, defaultEffect: "DENY", interactKey: "feature.llm_interact" },
  { key: "tab.model_report", category: "tab", label: "Model Performance", description: "Model/strategy performance report (task 113/114).", sortOrder: 19, defaultEffect: "DENY", interactKey: "feature.reports_export" },

  { key: "feature.profile", category: "feature", label: "Manage Own Profile", description: "Self-service profile and account settings.", sortOrder: 20, defaultEffect: "ALLOW", isCore: true },
  { key: "feature.feedback", category: "feature", label: "Submit Feedback", description: "Submit own feedback to the operators.", sortOrder: 21, defaultEffect: "ALLOW" },
  { key: "feature.market_data", category: "feature", label: "Live Market Data", description: "PSX quotes, indices, screener and company data.", sortOrder: 22, defaultEffect: "ALLOW" },
  { key: "feature.signal_data", category: "feature", label: "Per-Symbol Signal Data", description: "Model/ensemble prediction data for individual symbols.", sortOrder: 23, defaultEffect: "DENY" },
  { key: "feature.llm_interact", category: "feature", label: "AI Explanations & News Interpretation", description: "On-demand LLM analysis (daily limit applies).", sortOrder: 24, defaultEffect: "DENY" },
  { key: "feature.research_backtest", category: "feature", label: "Run Backtests & Simulations", description: "On-demand backtest/simulator compute (daily limit applies).", sortOrder: 25, defaultEffect: "DENY" },
  { key: "feature.backtest_reports", category: "feature", label: "View Backtesting Reports", description: "Read walk-forward and backtest research artifacts.", sortOrder: 26, defaultEffect: "DENY" },
  { key: "feature.reports_export", category: "feature", label: "Export Reports", description: "Download CSV/JSON/PDF exports (daily limit applies).", sortOrder: 27, defaultEffect: "DENY" },
  { key: "feature.beta_research", category: "feature", label: "Beta Research Dashboard", description: "The /beta research dashboard and insight API.", sortOrder: 28, defaultEffect: "ALLOW" },
];

// ---- plans ----

interface PlanSpec {
  key: string;
  label: string;
  sortOrder: number;
  isDefault: boolean;
  limits: Record<string, number | null>;
  allow: string[];
}

const BASIC_ALLOW = [
  "tab.dashboard", "feature.market_data", "feature.feedback", "feature.profile", "feature.beta_research",
];
const STANDARD_ALLOW = [
  ...BASIC_ALLOW,
  "tab.fundamental_news", "tab.technical_analysis", "tab.signals_v2", "tab.signal_detail",
  "tab.ai_model_signals", "tab.llm_signals", "tab.model_report", "tab.calculators",
  "tab.pattern_finder", "tab.pattern_finder_financial", "tab.dividends", "tab.strategy",
  "feature.signal_data", "feature.backtest_reports", "feature.llm_interact", "feature.reports_export",
];
const PREMIUM_ALLOW = [
  ...STANDARD_ALLOW,
  "tab.tracker", "tab.paper_monitor", "tab.golden_cross", "tab.volatility_analytics",
  "tab.portfolio", "tab.execute", "feature.research_backtest",
];

const PLANS: PlanSpec[] = [
  {
    key: "BASIC", label: "Basic", sortOrder: 1, isDefault: true,
    limits: { maxDailyLlmRequests: null, maxDailyReportExports: null, maxDailySimulatorRuns: null, maxDailyApiRequests: null, accountExpiryDays: null },
    allow: BASIC_ALLOW,
  },
  {
    key: "STANDARD", label: "Standard", sortOrder: 2, isDefault: false,
    limits: { maxDailyLlmRequests: 20, maxDailyReportExports: 5, maxDailySimulatorRuns: null, maxDailyApiRequests: null, accountExpiryDays: null },
    allow: STANDARD_ALLOW,
  },
  {
    key: "PREMIUM", label: "Premium", sortOrder: 3, isDefault: false,
    limits: { maxDailyLlmRequests: 50, maxDailyReportExports: 20, maxDailySimulatorRuns: 10, maxDailyApiRequests: null, accountExpiryDays: null },
    allow: PREMIUM_ALLOW,
  },
];

const SETTINGS: Array<{ key: string; value: unknown; description: string }> = [
  { key: "maintenance_mode", value: false, description: "When true, only admins can use the platform (503 for users)." },
  { key: "feature_pause", value: false, description: "When true, expensive on-demand compute (LLM, backtests) is paused." },
  { key: "llm_requests_enabled", value: true, description: "Master switch for on-demand LLM analysis endpoints." },
  { key: "feedback_enabled", value: true, description: "When false, new feedback submissions are rejected." },
  { key: "invitations_paused", value: false, description: "When true, ALL invitation redemptions are paused (superset of BetaConfig)." },
  { key: "registration_default_plan", value: "BASIC", description: "Plan assigned to newly redeemed profiles." },
];

async function main() {
  console.log("== Task 121 RBAC seed ==");
  for (const e of REGISTRY) {
    await db.permissionRegistry.upsert({
      where: { key: e.key },
      create: {
        key: e.key, category: e.category, label: e.label, description: e.description,
        sortOrder: e.sortOrder, defaultEffect: e.defaultEffect,
        interactKey: e.interactKey ?? null, isCore: e.isCore ?? false, globalEnabled: true,
      },
      update: {
        label: e.label, description: e.description, sortOrder: e.sortOrder,
        interactKey: e.interactKey ?? null, isCore: e.isCore ?? false,
        // never overwrite admin-set globalEnabled / defaultEffect on re-seed
      },
    });
  }
  console.log(`registry: ${REGISTRY.length} entries`);

  for (const p of PLANS) {
    await db.accessPlan.upsert({
      where: { key: p.key },
      create: { key: p.key, label: p.label, sortOrder: p.sortOrder, isDefault: p.isDefault, limitsJson: JSON.stringify(p.limits) },
      update: { label: p.label, sortOrder: p.sortOrder },
    });
    const existing = new Set(
      (await db.planPermission.findMany({ where: { planKey: p.key }, select: { permissionKey: true } })).map((r) => r.permissionKey)
    );
    for (const key of p.allow) {
      if (!existing.has(key)) {
        await db.planPermission.create({ data: { planKey: p.key, permissionKey: key, effect: "ALLOW" } });
      }
    }
    // remove stale ALLOW rows for keys no longer in the plan definition
    for (const key of existing) {
      if (!p.allow.includes(key)) {
        await db.planPermission.deleteMany({ where: { planKey: p.key, permissionKey: key, effect: "ALLOW" } });
      }
    }
  }
  console.log(`plans: ${PLANS.length}`);

  for (const s of SETTINGS) {
    await db.platformSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, valueJson: JSON.stringify(s.value), description: s.description },
      update: { description: s.description }, // never overwrite admin-chosen values
    });
  }
  console.log(`settings: ${SETTINGS.length}`);

  await db.betaConfig.upsert({
    where: { id: 1 },
    create: { id: 1, betaDisabled: false, registrationsPaused: false },
    update: {},
  });
  console.log("betaConfig row: ensured (id=1)");

  // backfill ProfileAccess for any existing beta profiles (idempotent)
  const profiles = await db.betaProfile.findMany({ select: { id: true }, take: 1000 });
  let created = 0;
  for (const p of profiles) {
    const existing = await db.profileAccess.findUnique({ where: { profileId: p.id } });
    if (!existing) {
      await db.profileAccess.create({ data: { profileId: p.id, planKey: "BASIC" } });
      created++;
    }
  }
  console.log(`profile access backfill: ${created} created (${profiles.length} profiles scanned)`);
  console.log("== seed complete ==");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
