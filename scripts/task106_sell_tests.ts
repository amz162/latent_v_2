/**
 * Task 106 Phase 2 — sell-semantics regression tests (production modules).
 * Proves a bearish prediction can NEVER create an unsupported short position
 * and is never inverted into a BUY prediction. Prints one JSON line.
 */
import * as fs from "fs";
import { classifySellAction, SHORT_SELLING_COMPLIANCE, evaluatePolicyState } from "@/lib/latent/trading-policy";
import { simulateStrategy, type StrategyBar } from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2 } from "@/lib/latent/trading-costs";

const out: any = { cases: [], failed: [] as string[] };
function t(name: string, cond: boolean, detail = "") {
  out.cases.push({ name, passed: cond, detail });
  if (!cond) out.failed.push(`${name} ${detail}`);
}

// exhaustive: no input combination yields SHORT_ENTRY while compliance unverified
for (const signal of ["BUY", "SELL", "HOLD"] as const) {
  for (const holds of [true, false]) {
    for (const sim of [true, false]) {
      const r = classifySellAction({ signal, holdsExistingLongPosition: holds, isSimulationOnly: sim });
      t(`no_short_entry:${signal}/${holds}/${sim}`, r.action !== "SHORT_ENTRY", r.action);
      if (signal === "SELL") t(`never_inverted_to_buy:${holds}/${sim}`, r.action !== "LONG_CANDIDATE");
    }
  }
}

// explicit mappings
t("sell_to_close_allowed", classifySellAction({ signal: "SELL", holdsExistingLongPosition: true }).action === "SELL_TO_CLOSE");
t("bearish_sim_research_only", classifySellAction({ signal: "SELL", holdsExistingLongPosition: false, isSimulationOnly: true }).action === "BEARISH_RESEARCH_ONLY");
t("bearish_production_no_trade", classifySellAction({ signal: "SELL", holdsExistingLongPosition: false, isSimulationOnly: false }).action === "NO_TRADE");
t("compliance_unverified_status", SHORT_SELLING_COMPLIANCE.status === "compliance_unverified" && !SHORT_SELLING_COMPLIANCE.verified_execution_pathway);

// policy: everything still no_trade / not promotable
t("policy_still_no_trade", evaluatePolicyState({ hasPositiveNetExpectancy: false, maturedForwardTrades: 0 }).state === "no_trade");
t("policy_never_auto_promotes", evaluatePolicyState({ hasPositiveNetExpectancy: true, maturedForwardTrades: 100000 }).state === "no_trade");

// historical short-side RESEARCH simulation is preserved (hypothetical, labeled)
const bars: StrategyBar[] = Array.from({ length: 20 }, (_, i) => ({
  date: `2026-01-${String(i + 5).padStart(2, "0")}`, open: 100, high: 102,
  low: 97 - i, close: 100 - i }));
const r = simulateStrategy("fixed_first_hit",
  { symbol: "TST", direction: "SELL", entryPrice: 100, sl: 110, tp1: 90, tp2: 85, tp3: 80, quantity: 100 },
  bars, PSX_USER_SCHEDULE_V2);
t("short_research_sim_preserved", r.exitReason === "TP3" && r.grossPnl > 0);

out.verdict = out.failed.length === 0 ? "PASS" : "FAIL";
fs.writeFileSync("data/backtest_reports/task106/_sell_tests_raw.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ fixtures: out.cases.length, failed: out.failed.length, verdict: out.verdict }));
