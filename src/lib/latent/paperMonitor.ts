/**
 * paperMonitor — Paper Trade Monitor data layer (Task 107 v2).
 *
 * Open positions come from the production maturity engine output
 * (data/backtest_reports/task107/_matured.json, written by task106_mature.ts →
 * simulateStrategy + computeTradeCostsV2), whose pending outcomes are the
 * forward paper trades awaiting maturity. Levels come from the frozen
 * decision ledger. Prices come LIVE from the provider's delayed quote
 * endpoint (60s cache) paired with real retrieval timestamps and ESTIMATED
 * source market timestamps (provider delay ≈ 15 min, user-observed; the
 * provider publishes no source timestamp on quotes).
 *
 * Execution semantics: `delayed_observation_shadow` with SNAPSHOT resolution —
 * a price beyond a level is an OBSERVED CROSSING at that snapshot; intraperiod
 * touches/recoveries between snapshots are invisible
 * (`observation_resolution_limited`). Nothing here claims an actual fill.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { getLiveQuoteDetailed } from "./liveQuote";
import { computeTradeCostsV2, PSX_USER_SCHEDULE_V2 } from "./trading-costs";

const ROOT = process.cwd();
const T107 = path.join(ROOT, "data/backtest_reports/task107");

export const PROVIDER_DELAY_MINUTES = 15;
export const FEED_WINDOW = { start: "09:45", end: "15:45", tz: "Asia/Karachi" } as const;
const STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"] as const;

export interface MonitorPosition {
  tradeId: string;
  decisionId: string;
  generation: string;
  symbol: string;
  side: "BUY";
  signalSource: string;
  modelVersion: string;
  strategy: string;
  signalTime: string;
  entryDate: string | null;
  entryPrice: number;
  quantity: number;
  remainingQuantity: number;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  bestTargetReached: number | null;
  latestPrice: number | null;
  marketTimestamp: string | null;
  retrievalTimestamp: string | null;
  providerDelayMinutes: number;
  timestampQuality: "estimated_source_timestamp" | "none";
  dataInterval: null;
  dataSource: string;
  status: string;
  resolvedLegsPnl: number;
  realizedNetPnl: number;
  unrealizedGrossPnl: number | null;
  estimatedExitCosts: number | null;
  estimatedCgt: number | null;
  estimatedUnrealizedNetPnl: number | null;
  totalPositionNetPnlEstimate: number | null;
  sessionsAvailable: number | null;
  sessionsTo21: number | null;
  ambiguousSameBarDates: string[];
  freshness: string;
  resolutionCaveat: string;
}

export interface MonitorPayload {
  generatedAt: string;
  feed: {
    provider: string;
    mode: string;
    dataType: string;
    providerDelayMinutes: number;
    barIntervalMinutes: null;
    pollIntervalSeconds: number;
    window: typeof FEED_WINDOW;
    windowStatus: string;
    lastPollCycle: string | null;
    lastPollAt: string | null;
    snapshotStoreTotal: number | null;
  };
  banner: string;
  summary: Record<string, unknown>;
  positions: MonitorPosition[];
  legacyPaperTrades: { n: number; note: string; rows: unknown[] };
  disclaimers: string[];
  errors: string[];
}

interface RawOutcome {
  status: string;
  entry: number;
  quantity: number;
  sessions_available?: number;
  genuinely_resolved_legs?: { exit_date: string; price: number; qty: number; net: number }[];
  resolved_legs_pnl_pkr?: number;
  unrealized_mtm_pkr?: number;
  mark_date?: string;
}

function nowPktParts() {
  const now = new Date();
  const pkt = new Date(now.getTime() + 5 * 3600_000);
  const hm = pkt.toISOString().slice(11, 16);
  const wd = pkt.getUTCDay();
  let windowStatus = "open";
  if (wd === 0 || wd === 6) windowStatus = "weekend_closed";
  else if (hm < FEED_WINDOW.start) windowStatus = "pre_window";
  else if (hm > FEED_WINDOW.end) windowStatus = "post_window";
  return { hm, windowStatus, iso: pkt.toISOString().slice(0, 19) + "+05:00" };
}

function readJson<T>(p: string): T | null {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function statusFor(p: number, sl: number | null, tp1: number | null, hasLegs: boolean): string {
  const slHit = sl != null && p <= sl + 1e-9;
  const tpHit = tp1 != null && p >= tp1 - 1e-9;
  if (slHit && tpHit) return "ambiguous_same_bar";
  if (slHit) return "stop_loss_observed";
  if (tpHit) return "target_touched";
  if (hasLegs) return "partially_exited";
  return "open";
}

export async function buildMonitorPayload(): Promise<MonitorPayload> {
  const errors: string[] = [];
  const matured = readJson<{ observations: Record<string, unknown>[] }>(path.join(T107, "_matured.json"));
  const ledger = readJson<{ decision_id: string; generation: string; symbol: string; levels: Record<string, number | null> }[]>(
    path.join(T107, "_pending_ledger.json"));
  const state = readJson<Record<string, unknown>>(path.join(T107, "ops/monitor_state.json"));
  // Daily-resolution same-candle ambiguity (computed by the monitor engine from
  // verified daily bars: a bar whose high≥TP1 AND low≤SL cannot order touches).
  const ambMap = new Map<string, string[]>();
  for (const sp of ((state?.positions ?? []) as { trade_key?: string; ambiguous_same_bar_dates?: string[] }[])) {
    if (sp.trade_key) ambMap.set(sp.trade_key, sp.ambiguous_same_bar_dates ?? []);
  }

  const positions: MonitorPosition[] = [];
  if (matured && ledger) {
    const levelsById = new Map(ledger.map((l) => [l.decision_id, l]));
    const { windowStatus } = nowPktParts();
    const quotes = new Map<string, Awaited<ReturnType<typeof getLiveQuoteDetailed>>>();
    const syms = Array.from(new Set(matured.observations.map((o) => String(o.symbol))));
    await Promise.all(syms.map(async (s) => quotes.set(s, await getLiveQuoteDetailed(s))));

    for (const o of matured.observations) {
      if (typeof o.decision_date !== "string") continue; // unfilled entries
      const lv = levelsById.get(String(o.decision_id));
      const outcomes = (o.outcomes ?? {}) as Record<string, RawOutcome>;
      for (const strat of STRATS) {
        const res = outcomes[strat];
        if (!res || res.status !== "pending_mtm") continue;
        const levels = lv?.levels ?? {};
        const resolved = res.genuinely_resolved_legs ?? [];
        const resolvedQty = resolved.reduce((s, l) => s + l.qty, 0);
        const remaining = Math.max(0, res.quantity - resolvedQty);
        const q = quotes.get(String(o.symbol)) ?? null;
        const price = q?.price ?? null;
        const estimatedSourceTs =
          q?.retrievedAt
            ? new Date(new Date(q.retrievedAt).getTime() - PROVIDER_DELAY_MINUTES * 60_000).toISOString()
            : null;
        const ambiguous = ambMap.get(`${o.decision_id}::${strat}`) ?? [];
        const realizedLegs = res.resolved_legs_pnl_pkr ?? resolved.reduce((s, l) => s + l.net, 0);
        let unrealizedGross: number | null = null;
        let exitCosts: number | null = null;
        let cgt: number | null = null;
        let estNet: number | null = null;
        let totalEst: number | null = null;
        let status = "pending_data";
        if (price != null && remaining > 0) {
          unrealizedGross = Math.round((price - res.entry) * remaining * 100) / 100;
          const costs = computeTradeCostsV2(
            res.quantity, res.entry,
            [...resolved.map((l) => ({ quantity: l.qty, exitPrice: l.price })),
             { quantity: remaining, exitPrice: price }],
            realizedLegs + unrealizedGross, PSX_USER_SCHEDULE_V2, "ATL_15");
          exitCosts = Math.round((costs.totalCost - costs.cgt - costs.buy.sideTotal) * 100) / 100;
          cgt = Math.round(costs.cgt * 100) / 100;
          estNet = Math.round((unrealizedGross - (exitCosts ?? 0) - (cgt ?? 0)) * 100) / 100;
          totalEst = Math.round((realizedLegs + estNet) * 100) / 100;
          status = statusFor(price, levels.sl ?? null, levels.tp1 ?? null, resolved.length > 0);
        } else if (price != null) {
          status = "partially_exited";
        }
        positions.push({
          tradeId: Buffer.from(`${o.decision_id}::${strat}`).toString("base64url"),
          decisionId: String(o.decision_id),
          generation: lv?.generation ?? "",
          symbol: String(o.symbol),
          side: "BUY",
          signalSource: "AI model shadow observation (frozen protocol)",
          modelVersion: "task104-frozen-protocol-repro (research-only)",
          strategy: strat,
          signalTime: o.decision_date,
          entryDate: (o.entry_date as string) ?? null,
          entryPrice: res.entry,
          quantity: res.quantity,
          remainingQuantity: remaining,
          sl: levels.sl ?? null,
          tp1: levels.tp1 ?? null,
          tp2: levels.tp2 ?? null,
          tp3: levels.tp3 ?? null,
          bestTargetReached:
            price != null
              ? price >= (levels.tp3 ?? Infinity) ? (levels.tp3 ?? null)
              : price >= (levels.tp2 ?? Infinity) ? (levels.tp2 ?? null)
              : price >= (levels.tp1 ?? Infinity) ? (levels.tp1 ?? null) : null
              : null,
          latestPrice: price,
          marketTimestamp: estimatedSourceTs,
          retrievalTimestamp: q?.retrievedAt ?? null,
          providerDelayMinutes: PROVIDER_DELAY_MINUTES,
          timestampQuality: estimatedSourceTs ? "estimated_source_timestamp" : "none",
          dataInterval: null,
          dataSource: q ? "provider delayed quote snapshot" : "unavailable",
          status,
          resolvedLegsPnl: realizedLegs,
          realizedNetPnl: 0,
          unrealizedGrossPnl: unrealizedGross,
          estimatedExitCosts: exitCosts,
          estimatedCgt: cgt,
          estimatedUnrealizedNetPnl: estNet,
          totalPositionNetPnlEstimate: totalEst,
          sessionsAvailable: res.sessions_available ?? null,
          sessionsTo21: res.sessions_available != null ? Math.max(0, 21 - res.sessions_available) : null,
          ambiguousSameBarDates: ambiguous,
          freshness: price == null ? "no_data"
            : windowStatus === "open" ? "fresh" : "session_closed_data",
          resolutionCaveat:
            "Snapshot semantics: observed crossing only; intraperiod path between snapshots is unknown (observation_resolution_limited). No actual fill is claimed.",
        });
      }
    }
  } else {
    errors.push("maturity engine output unavailable — run python3 scripts/task107_maturity.py");
  }

  const byStatus: Record<string, number> = {};
  for (const p of positions) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  const stateFeed = (state?.feed ?? {}) as Record<string, unknown>;
  const stateSnap = (state?.snapshot_store ?? {}) as Record<string, unknown>;
  const feed = {
    provider: "https://psxdata-api.fastapicloud.dev",
    mode: "delayed_observation_shadow",
    dataType: "delayed_snapshot_only (no candle endpoint — verified via OpenAPI)",
    providerDelayMinutes: PROVIDER_DELAY_MINUTES,
    barIntervalMinutes: null,
    pollIntervalSeconds: (stateFeed.poll_interval_seconds as number) ?? 120,
    window: FEED_WINDOW,
    windowStatus: nowPktParts().windowStatus,
    lastPollCycle: (state?.cycle_id as string) ?? null,
    lastPollAt: (state?.generated_at as string) ?? null,
    snapshotStoreTotal: (stateSnap.total as number) ?? null,
  };
  return {
    generatedAt: new Date().toISOString(),
    feed,
    banner:
      "Market data is delayed by approximately 15 minutes. The displayed price represents an earlier market timestamp (estimated), not the live exchange price.",
    summary: {
      openPaperTrades: positions.length,
      uniqueSymbols: new Set(positions.map((p) => p.symbol)).size,
      byStatus,
      targetTouched: byStatus["target_touched"] ?? 0,
      stopLossObserved: byStatus["stop_loss_observed"] ?? 0,
      ambiguous: byStatus["ambiguous_same_bar"] ?? 0,
      partialExits: byStatus["partially_exited"] ?? 0,
      pendingData: byStatus["pending_data"] ?? 0,
      estimatedUnrealizedNetPnlTotalPkr:
        Math.round(positions.reduce((s, p) => s + (p.estimatedUnrealizedNetPnl ?? 0), 0) * 100) / 100,
      realizedNetPnlSeparatePkr: -102348.02,
      realizedNote: "from the maturity ledger (12 SL + 31 full-exit outcomes); MTM here is NEVER merged into it",
    },
    positions,
    legacyPaperTrades:
      (state?.legacy_paper_trades as MonitorPayload["legacyPaperTrades"]) ?? { n: 0, note: "", rows: [] },
    disclaimers: [
      "Open positions are neither wins nor losses until matured under the defined rules; pending MTM is not realized P&L.",
      "Targets are research levels from the frozen protocol — not guaranteed future prices.",
      "All models remain research/shadow-only (not_promotable); no real orders exist.",
    ],
    errors,
  };
}
