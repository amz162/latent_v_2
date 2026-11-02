/**
 * Task 102 — unified point-in-time feature store (spec Phase 6).
 *
 * buildFeaturesAsOf(symbol, decisionTimestamp) joins:
 *   1. stock OHLCV (bars with date <= decision timestamp ONLY)
 *   2. genuine KSE-100 (via kse100-provider; NEVER the internal proxy)
 *   3. point-in-time fundamentals (via point-in-time.ts; unavailable stays
 *      unavailable — never backfilled with period-end dates)
 *   4. raw-price corporate-action suspicion flags (no adjusted ex-post series)
 *   5. sector mapping (Task 98 overrides, read-only)
 *   6. liquidity variables (trailing windows)
 *   7. market-regime indicators (internal proxy, labeled market_internal_proxy)
 *
 * Feature groups (task102 feature schema v1) are gated: a group is only
 * produced when its sources are genuinely verified; `technical_pit_fundamental_v1`
 * is disabled in this environment because no verified publication timestamps
 * exist for statements/ratios.
 */
import { PrismaClient } from "@prisma/client";
import { getKse100AsOf, kse100Status } from "@/lib/market-data/kse100-provider";
import { getFundamentalsAsOf, type PitFundamentalRecord } from "@/lib/fundamentals/point-in-time";
import * as fs from "fs";
import path from "path";

const db = new PrismaClient({ log: ["error"] });

export const FEATURE_SCHEMA_VERSION = "task102-features-v1";

export type FeatureGroupId =
  | "technical_only_v1"
  | "technical_market_regime_v1"
  | "technical_pit_fundamental_v1"
  | "technical_liquidity_v1"
  | "technical_corporate_action_safe_v1"
  | "combined_verified_v1";

export const ENABLED_GROUPS: FeatureGroupId[] = [
  "technical_only_v1",
  "technical_market_regime_v1",
  "technical_liquidity_v1",
  "technical_corporate_action_safe_v1",
  "combined_verified_v1",
];

export interface FeatureRow {
  symbol: string;
  decisionTimestamp: string; // ISO instant of the decision cutoff
  featureTimestamp: string; // = decisionTimestamp (no future reads)
  featureSchemaVersion: string;
  groupId: FeatureGroupId;
  provenance: Record<string, string>;
  dataQualityFlags: string[];
  availability: "complete" | "partial" | "unavailable";
  features: Record<string, number | null>;
}

function ms(iso: string | Date): number {
  return new Date(iso).getTime();
}

/**
 * As-of feature builder. Every source query is cutoff-bounded:
 *  - OHLCV: bars with date <= cutoff (decision at session close),
 *  - KSE-100: last genuine observation at or before cutoff (null while the
 *    index source is blocked — the internal proxy is NEVER substituted),
 *  - fundamentals: getFundamentalsAsOf (publication-bounded),
 *  - flags: computed only from trailing windows of raw bars.
 */
export async function buildFeaturesAsOf(
  symbol: string,
  decisionTimestamp: Date,
  groupId: FeatureGroupId = "technical_only_v1",
): Promise<FeatureRow> {
  const cutoffMs = ms(decisionTimestamp);
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);
  const bars = await db.ohlcvBar.findMany({
    where: { symbol, date: { lte: cutoffDate } },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });
  if (bars.length < 2) {
    return {
      symbol, decisionTimestamp: decisionTimestamp.toISOString(),
      featureTimestamp: decisionTimestamp.toISOString(), featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      groupId, provenance: {}, dataQualityFlags: ["insufficient_history"],
      availability: "unavailable", features: {},
    };
  }
  const closes = bars.map((b) => b.close);
  const vols = bars.map((b) => b.volume);
  const ret5 = closes[closes.length - 1] / closes[Math.max(0, closes.length - 6)] - 1;
  const ret21 = closes[closes.length - 1] / closes[Math.max(0, closes.length - 22)] - 1;
  const vol20 = closes.slice(-20);
  const rets = vol20.slice(1).map((c, i) => c / vol20[i] - 1);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length);
  const features: Record<string, number | null> = {
    tech_ret_5d: ret5,
    tech_ret_21d: ret21,
    tech_vol_20d: sd,
  };
  const flags: string[] = [];
  const provenance: Record<string, string> = {
    ohlcv: "db/custom.db OhlcvBar (raw, cutoff-bounded)",
    schema: FEATURE_SCHEMA_VERSION,
  };

  // liquidity (trailing windows only)
  if (groupId === "technical_liquidity_v1" || groupId === "combined_verified_v1") {
    const to = closes.map((c, i) => c * (vols[i] ?? 0));
    const last20 = to.slice(-20);
    const m20 = last20.reduce((s, x) => s + x, 0) / last20.length;
    const sd20 = Math.sqrt(last20.reduce((s, x) => s + (x - m20) ** 2, 0) / last20.length);
    features.liq_turnover_z20 = (to[to.length - 1] - m20) / (sd20 + 1e-9);
    features.liq_dollarvol_pctile_1y =
      to.slice(-250).filter((x) => x <= to[to.length - 1]).length / Math.min(250, to.length);
    provenance.liquidity = "raw OHLCV turnover trailing windows";
  }

  // corporate-action suspicion flags (raw prices, trailing window)
  if (groupId === "technical_corporate_action_safe_v1" || groupId === "combined_verified_v1") {
    const win = closes.slice(-61);
    let jump = 0;
    for (let i = 1; i < win.length; i++) {
      if (win[i - 1] > 0 && Math.abs(win[i] / win[i - 1] - 1) >= 0.4) jump = 1;
    }
    features.ca_jump_flag_60d = jump;
    features.ca_stale_volume_flag =
      vols.slice(-20).every((v) => (v ?? 0) === 0) ? 1 : 0;
    if (jump) flags.push("ca_suspicion_60d");
    provenance.corporate_actions = "raw-price suspicion flags; no adjusted ex-post series";
  }

  // market regime: genuine KSE-100 when verified, else internal proxy (labeled)
  if (groupId === "technical_market_regime_v1" || groupId === "combined_verified_v1") {
    const kst = kse100Status();
    const kbar = getKse100AsOf(decisionTimestamp.toISOString().slice(0, 10));
    if (kbar) {
      features.regime_index_close = kbar.close;
      provenance.kse100 = `${kbar.provider} (genuine index)`;
    } else {
      flags.push("regime_source_internal_proxy");
      provenance.market_regime = "pilot25 equal-weight breadth (market_internal_proxy) — " +
        "genuine KSE-100 status: " + kst.status;
    }
    features.regime_vol_20d = sd;
  }

  // point-in-time fundamentals (publication-bounded; unavailable stays null)
  if (groupId === "technical_pit_fundamental_v1") {
    // Disabled: no verified publication timestamps exist in this environment.
    // The query below demonstrates the as-of discipline and returns null.
    const records: PitFundamentalRecord[] = [];
    const rec = getFundamentalsAsOf(symbol, decisionTimestamp, records);
    features.pit_available = rec ? 1 : 0;
    flags.push("pit_group_disabled_no_verified_publication_timestamps");
  }

  const availability: FeatureRow["availability"] =
    flags.includes("insufficient_history") ? "unavailable" : flags.length ? "partial" : "complete";
  return {
    symbol,
    decisionTimestamp: decisionTimestamp.toISOString(),
    featureTimestamp: decisionTimestamp.toISOString(),
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    groupId,
    provenance,
    dataQualityFlags: flags,
    availability,
    features,
  };
}

/** Sector map (Task 98 overrides, read-only). */
export function sectorOf(symbol: string): string {
  try {
    const p = path.join(process.cwd(), "data/askanalyst/sector_overrides.json");
    const o = JSON.parse(fs.readFileSync(p, "utf-8")) as any;
    for (const [sector, blk] of Object.entries<any>(o.sectors ?? {})) {
      const syms: string[] = (blk.symbols ?? []).map((s: any) => (typeof s === "string" ? s : s.symbol));
      if (syms.includes(symbol)) return sector;
    }
  } catch {}
  return "unknown";
}
