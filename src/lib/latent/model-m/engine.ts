/**
 * Task 129 — Model M engine: data-quality → evidence → GLM-4.6 decision →
 * append-only history.
 *
 * Composition (nothing here duplicates the existing research stack):
 *   - buildEvidenceBundle() (Task 111) builds the point-in-time-safe evidence
 *     package from VERIFIED platform data: OHLCV, golden-cross SMA7/30, ATR14
 *     risk levels, volatility, PIT-safe price patterns, quarterly results,
 *     company/national/international news. Unavailable sources are reported
 *     as unavailable — never as neutral evidence.
 *   - runStockSignal() (Task 111) runs GLM-4.6 with strict output validation,
 *     a deterministic risk/reward engine (the LLM never computes levels or
 *     costs) and the capital-protection policy. Provider failure yields a
 *     controlled llm_unavailable state — no fabricated signal.
 *   - This engine adds: the Model M data-quality classification
 *     (VERIFIED/PARTIAL/STALE/UNAVAILABLE/FAILED), the technical-indicator
 *     section, the monthly price-pattern section, content-only evidence-hash
 *     persistence with (symbol, cutoff) dedup, SELL long-only semantics, and
 *     the append-only analysis history (a newer analysis never replaces an
 *     older one).
 *
 * Research-only: no real-money execution, no shorts, no leverage.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { buildEvidenceBundle, primeMarketEvidence, type EvidenceBundle } from "@/lib/latent/llm/evidence-builder";
import { runStockSignal, type Task111SignalRecord } from "@/lib/latent/llm/stock-signal-engine";
import { evidenceHash, stableStringify } from "@/lib/latent/llm/llm-provider";
import { buildTechnicalSection, atr14, type TechnicalSection, type AnalysisBar } from "./technical";
import { analyzeMonthlyPatterns, type MarketPatternSummary } from "./patterns";

export const MODEL_M_SCHEMA_VERSION = "model_m_evidence_v1";
export const MODEL_M_ENGINE_VERSION = "task129-model-m-v1";
export const EVIDENCE_DIR = path.join(
  process.cwd(), "data", "backtest_reports", "task129", "model_m_evidence"
);

export type DataQuality = "VERIFIED" | "PARTIAL" | "STALE" | "UNAVAILABLE" | "FAILED";
export type ModelMDecision = "BUY" | "SELL" | "HOLD" | "NO_TRADE" | "SELL_RESEARCH_ONLY";

export interface FilingsSummary {
  status: "VERIFIED" | "UNAVAILABLE";
  count: number;
  fetchedAt: string | null;
  items: Array<{ date: string | null; description: string; pdf: string | null }>;
  note: string;
}

/**
 * PSX announcements / corporate actions (Phase 6.6) from the approved
 * askanalyst filings snapshot. Timestamps preserved (item date + fetched_at).
 * Unavailable data is reported as unavailable — never fabricated.
 */
async function loadFilings(symbol: string): Promise<FilingsSummary> {
  try {
    const p = path.join(process.cwd(), "data", "askanalyst", "filings", `${symbol}.json`);
    if (!fs.existsSync(p)) {
      return { status: "UNAVAILABLE", count: 0, fetchedAt: null, items: [],
        note: "no filings snapshot for this symbol (source: askanalyst filings registry)" };
    }
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
      data?: Array<{ date?: string; description?: string; pdf?: string }>;
      fetched_at?: string;
    };
    const items = (raw.data ?? []).slice(0, 10).map((f) => ({
      date: f.date ?? null,
      description: String(f.description ?? "").slice(0, 400),
      pdf: f.pdf ?? null,
    }));
    return {
      status: items.length ? "VERIFIED" : "UNAVAILABLE",
      count: raw.data?.length ?? 0,
      fetchedAt: raw.fetched_at ?? null,
      items,
      note: items.length
        ? `most recent ${items.length} of ${raw.data?.length ?? 0} announcements (source: PSX filings via askanalyst)`
        : "filings snapshot exists but is empty",
    };
  } catch (e) {
    return { status: "UNAVAILABLE", count: 0, fetchedAt: null, items: [],
      note: `filings snapshot unreadable: ${String((e as Error)?.message ?? e).slice(0, 80)}` };
  }
}

export interface DataQualityReport {
  status: DataQuality;
  symbol: string;
  latestBarDate: string | null;
  globalFrontierDate: string | null;
  barsCount: number;
  sessionsBehindFrontier: number;
  lastSchedulerRun: {
    runKey: string; status: string; finishedAt: string | null;
    dataCutoffDate: string | null; symbolsUpdated: number; symbolsFailed: number;
  } | null;
  symbolAffectedByLastFailure: boolean;
  freshnessNote: string;
  sections: Record<string, { status: DataQuality; note: string }>;
}

function businessDaysBehind(latest: string | null, frontier: string | null): number {
  if (!latest || !frontier) return Number.POSITIVE_INFINITY;
  // conservative calendar-day approximation (sessions ⊆ calendar days)
  const a = Date.parse(latest + "T00:00:00Z");
  const b = Date.parse(frontier + "T00:00:00Z");
  if (!isFinite(a) || !isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export async function getDataQuality(symbol: string): Promise<DataQualityReport> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = await db.ohlcvBar.findMany({
    where: { symbol: sym },
    orderBy: { date: "desc" },
    take: 1,
    select: { date: true },
  });
  const barsCount = await db.ohlcvBar.count({ where: { symbol: sym } });
  const frontierRow = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  const latest = rows[0]?.date ?? null;
  const frontier = frontierRow?.date ?? null;

  const lastRunRow = await db.schedulerRun.findFirst({
    where: { jobName: { in: ["eod_pipeline", "eod_recover"] }, status: { in: ["COMPLETED", "PARTIAL", "FAILED"] } },
    orderBy: { startedAt: "desc" },
    select: { runKey: true, status: true, finishedAt: true, dataCutoffDate: true, symbolsUpdated: true, symbolsFailed: true, failedSymbols: true },
  });
  let symbolAffected = false;
  if (lastRunRow?.failedSymbols) {
    try {
      const failed = JSON.parse(lastRunRow.failedSymbols) as Array<{ symbol: string }>;
      symbolAffected = failed.some((f) => f.symbol === sym);
    } catch { /* malformed record — ignore */ }
  }

  const behind = businessDaysBehind(latest, frontier);
  let status: DataQuality;
  if (!latest || barsCount === 0) status = "UNAVAILABLE";
  else if (symbolAffected && lastRunRow?.status === "FAILED") status = "FAILED";
  else if (latest === frontier) status = "VERIFIED";
  else if (behind <= 3) status = "PARTIAL";
  else status = "STALE";

  const sections: DataQualityReport["sections"] = {
    market_data: { status: status === "UNAVAILABLE" ? "UNAVAILABLE" : status, note: latest ? `latest bar ${latest}; global frontier ${frontier}` : "no bars stored" },
    scheduler: {
      status: lastRunRow ? (lastRunRow.status === "FAILED" ? "FAILED" : lastRunRow.status === "PARTIAL" ? "PARTIAL" : "VERIFIED") : "UNAVAILABLE",
      note: lastRunRow ? `${lastRunRow.runKey} → ${lastRunRow.status} at ${lastRunRow.finishedAt ?? "?"}` : "no scheduler run recorded yet",
    },
  };

  return {
    status, symbol: sym, latestBarDate: latest, globalFrontierDate: frontier,
    barsCount, sessionsBehindFrontier: Number.isFinite(behind) ? behind : -1,
    lastSchedulerRun: lastRunRow ? { runKey: lastRunRow.runKey, status: lastRunRow.status, finishedAt: lastRunRow.finishedAt?.toISOString() ?? null, dataCutoffDate: lastRunRow.dataCutoffDate, symbolsUpdated: lastRunRow.symbolsUpdated, symbolsFailed: lastRunRow.symbolsFailed } : null,
    symbolAffectedByLastFailure: symbolAffected,
    freshnessNote:
      status === "VERIFIED" ? "price data is at the global frontier"
        : status === "PARTIAL" ? `price data is ${behind} calendar day(s) behind the frontier`
          : status === "STALE" ? `price data is ${behind} calendar day(s) behind the frontier — fresh analysis is BLOCKED`
            : status === "FAILED" ? "the symbol failed in the latest scheduler run — data may be incomplete"
              : "no price data available for this symbol",
    sections,
  };
}

export interface ModelMEvidencePackage {
  schemaVersion: string;
  packageId: string;
  symbol: string;
  dataCutoff: string;
  decisionTimestamp: string;
  contentHash: string;
  evidence: unknown;         // LLMEvidence (Task 111)
  technical: TechnicalSection | null;
  monthlyPatterns: MarketPatternSummary;
  filings: FilingsSummary;
  qualityFlags: string[];
}

function buildPackageId(symbol: string, cutoff: string, hash: string): string {
  return `mmev_${symbol}_${cutoff}_${hash.slice(0, 8)}`;
}

async function persistEvidencePackage(
  pkg: Omit<ModelMEvidencePackage, "packageId" | "contentHash">,
  fullContent: unknown,
  hashBasis: unknown
): Promise<ModelMEvidencePackage> {
  // Content-only hash: computed over the DATA content (hashBasis) — the
  // decision timestamp is deliberately EXCLUDED so the hash is verifiable
  // from the persisted file alone.
  const contentHash = crypto.createHash("sha256").update(stableStringify(hashBasis)).digest("hex");

  // Dedup by (symbol, analysis cutoff) — the Task 129 contract. Retrieval
  // metadata (news retrievedAt etc.) legitimately differs between fetches,
  // so cutoff identity — not byte identity — decides reuse; the hash still
  // verifies the persisted content exactly.
  const existing = await db.modelMEvidencePackage.findFirst({
    where: { symbol: pkg.symbol, dataCutoff: pkg.dataCutoff },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return { ...pkg, packageId: existing.packageId, contentHash: existing.contentHash };
  }
  const packageId = buildPackageId(pkg.symbol, pkg.dataCutoff, contentHash);

  const dir = path.join(EVIDENCE_DIR, pkg.symbol);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${packageId}.json`);
  fs.writeFileSync(filePath, JSON.stringify({ ...pkg, packageId, contentHash, content: fullContent }, null, 1));

  await db.modelMEvidencePackage.upsert({
    where: { packageId },
    create: {
      packageId, symbol: pkg.symbol, dataCutoff: pkg.dataCutoff, contentHash,
      schemaVersion: MODEL_M_SCHEMA_VERSION,
      filePath: path.relative(process.cwd(), filePath),
      categories: JSON.stringify(["ohlcv_db", "technical_local", "price_patterns", "financials_snapshot", "news", "market_context"]),
      qualityFlags: JSON.stringify(pkg.qualityFlags),
    },
    update: {},
  });
  return { ...pkg, packageId, contentHash };
}

export interface ModelMAnalysisResult {
  blocked: false;
  dataQuality: DataQualityReport;
  technical: TechnicalSection | null;
  monthlyPatterns: MarketPatternSummary;
  fundamentals: {
    quarters: unknown;
    resultPatterns: unknown;
    pitPatterns: unknown;
    news: { company: unknown; national: unknown; international: unknown };
    filings: FilingsSummary;
  };
  evidence: { packageId: string; contentHash: string; filePath: string | null; qualityScore: number; qualityParts: Record<string, number>; missingSources: string[]; dataQualityFlags: string[] };
  decision: {
    decision: ModelMDecision;
    signalClass: string;
    researchOnly: true;
    analysisTimestamp: string;
    dataCutoff: string;
    entryPrice: number | null;
    entryCondition: string | null;
    stopLoss: number | null;
    tp1: number | null;
    tp2: number | null;
    tp3: number | null;
    riskRewardTp1: number | null;
    atr14: number | null;
    reasoning: string;
    llmState: string;
    llmModel: string | null;
    noTradeReasons: string[];
    sellNote: string | null;
    warnings: string[];
  };
  analysisId: string;
  runRecord: Pick<Task111SignalRecord, "finalSignalReason" | "evidenceQualityScore" | "parseErrors" | "capitalProtection" | "analysisHorizon">;
}

export type ModelMRunOutcome =
  | { blocked: true; reason: string; dataQuality: DataQualityReport }
  | { error: true; reason: string }
  | ModelMAnalysisResult;

function num(v: number | undefined | null): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

export interface ModelMEvidenceBuild {
  dataQuality: DataQualityReport;
  technical: TechnicalSection | null;
  monthlyPatterns: MarketPatternSummary;
  pkg: ModelMEvidencePackage;
  warnings: string[];
  bundle: EvidenceBundle;
  atr14Value: number | null;
  filings: FilingsSummary;
}

/**
 * Build (and persist) the Model M evidence package for one symbol WITHOUT
 * calling the LLM. Used by the scheduled cache refresh (stage "modelm_cache")
 * and as the first half of runModelMAnalysis. Deduplicated by
 * (symbol, dataCutoff, contentHash) — unchanged data is never re-packaged.
 */
export async function buildModelMEvidence(symbol: string): Promise<ModelMEvidenceBuild | { error: string }> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const dq = await getDataQuality(sym);
  const frontier = dq.globalFrontierDate ?? dq.latestBarDate ?? new Date().toISOString().slice(0, 10);

  // market context breadth computed over the pilot-25 shadow universe (labeled)
  const pilot = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL", "WTL", "KEL",
    "TRG", "UNITY", "BOP", "CNERGY", "HASCOL", "MLCF", "BYCO", "PAEL", "PIBTL",
    "LOTCHEM", "PRL", "TELE", "ANL", "HUMNL", "FCCL"];
  let above = 0, counted = 0;
  for (const p of pilot) {
    const bars = await db.ohlcvBar.findMany({
      where: { symbol: p }, orderBy: { date: "desc" }, take: 31, select: { close: true },
    });
    if (bars.length < 31) continue;
    const sma30 = bars.slice(0, 30).reduce((a, b) => a + b.close, 0) / 30;
    if (bars[0].close > sma30) above++;
    counted++;
  }
  const universeSize = await db.ohlcvBar.findMany({ select: { symbol: true }, distinct: ["symbol"] });

  await primeMarketEvidence();
  const bundle: EvidenceBundle | { error: string } = await buildEvidenceBundle(sym, {
    asOfSession: frontier,
    universeSize: universeSize.length,
    pctAboveMa30: counted > 0 ? Math.round((above / counted) * 100) : 0,
    breadthNote: counted > 0 ? `${above}/${counted} pilot-25 symbols above their SMA30` : "breadth unavailable",
  });
  if ("error" in bundle) {
    return { error: `evidence build failed: ${bundle.error}` };
  }

  const analysisTs = new Date().toISOString();
  const bars = bundle.bars as AnalysisBar[];
  const technical = buildTechnicalSection(bars);
  const monthlyPatterns = analyzeMonthlyPatterns(bars);
  const atr = atr14(bars);
  const filings = await loadFilings(sym);

  const warnings: string[] = [...(bundle.evidence.dataQualityFlags ?? [])];
  if (bundle.quarters.length > 0 && !bundle.quarters.some((q) => {
    const rec = q as unknown as Record<string, unknown>;
    return rec.fetchedAt || rec.fetched_at;
  })) {
    warnings.push("financial_publication_timestamps_not_pit_verified");
  }
  if (dq.status === "PARTIAL") warnings.push("market_data_behind_frontier");
  if (dq.symbolAffectedByLastFailure) warnings.push("symbol_failed_in_latest_scheduler_run");
  if (filings.status === "UNAVAILABLE") warnings.push("psx_announcements_unavailable");
  // dedupe: the Task 111 evidence may already carry some of these flags
  const dedupedWarnings = [...new Set(warnings)];

  const fullContent = {
    schemaVersion: MODEL_M_SCHEMA_VERSION, symbol: sym,
    dataCutoff: bundle.evidence.dataCutoff, decisionTimestamp: analysisTs,
    evidence: bundle.evidence, technical, monthlyPatterns, filings, qualityFlags: dedupedWarnings,
  };
  // hash basis = full content minus the decision timestamp (content-only hash)
  const { decisionTimestamp: _excluded, ...hashBasis } = fullContent;
  const pkg = await persistEvidencePackage(
    {
      schemaVersion: MODEL_M_SCHEMA_VERSION,
      symbol: sym,
      dataCutoff: bundle.evidence.dataCutoff,
      decisionTimestamp: analysisTs,
      evidence: bundle.evidence,
      technical,
      monthlyPatterns,
      filings,
      qualityFlags: dedupedWarnings,
    },
    fullContent,
    hashBasis
  );

  return { dataQuality: dq, technical, monthlyPatterns, pkg, warnings: dedupedWarnings, bundle, atr14Value: atr, filings };
}

export async function runModelMAnalysis(
  symbol: string,
  opts: { allowStale?: boolean; analysisHorizon?: "5d" | "10d" | "21d"; trigger?: string } = {}
): Promise<ModelMRunOutcome> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const dq = await getDataQuality(sym);

  // Fresh analysis requires valid data — STALE/UNAVAILABLE/FAILED block it.
  if (!opts.allowStale && (dq.status === "STALE" || dq.status === "UNAVAILABLE" || dq.status === "FAILED")) {
    return { blocked: true, reason: `fresh analysis refused: ${dq.freshnessNote}`, dataQuality: dq };
  }

  const built = await buildModelMEvidence(sym);
  if ("error" in built) {
    return { error: true, reason: built.error };
  }
  const { dataQuality: dq2, technical, monthlyPatterns, pkg, warnings, bundle, atr14Value: atr, filings } = built;
  const analysisTs = pkg.decisionTimestamp;

  const record = await runStockSignal(bundle.evidence, bundle.bars, {
    analysisHorizon: opts.analysisHorizon ?? "10d",
    generationId: "task129-model-m-gen1",
  });

  // ── Model M decision mapping (long-only; SELL semantics) ─────────────────
  let decision: ModelMDecision = record.finalSignal as ModelMDecision;
  let sellNote: string | null = null;
  if (record.finalSignal === "SELL_TO_CLOSE") {
    const openLong = await db.prospectivePaperTrade.count({
      where: { symbol: sym, state: "open", direction: "BUY", isDemo: false },
    });
    if (openLong > 0) {
      decision = "SELL";
      sellNote = `open long position(s) detected (${openLong}) — SELL closes/reduces the existing long; never opens a short.`;
    } else {
      decision = "SELL_RESEARCH_ONLY";
      sellNote = "SELL cannot execute: no open long position exists. Short selling is not permitted by policy — the bearish view is recorded as a research decision only.";
    }
  } else if (record.finalSignal === "BEARISH_RESEARCH_ONLY") {
    decision = "SELL_RESEARCH_ONLY";
    sellNote = "bearish research view — no execution path (long-only policy; no open long to close).";
  }

  const rr = record.riskReward;
  const reasoning = record.finalSignalReason || record.llmOutput?.decision_reason || "";

  // ── append-only history (never overwrites an older analysis) ─────────────
  const created = await db.modelMAnalysis.create({
    data: {
      symbol: sym,
      decision,
      engineVersion: MODEL_M_ENGINE_VERSION,
      analysisTs: new Date(analysisTs),
      dataCutoff: bundle.evidence.dataCutoff,
      dataFreshness: dq.status,
      entryPrice: num(rr?.entryReference),
      entryCondition: rr && Number.isFinite(rr.entryReference) ? "entry reference = verified cutoff close; execution (if ever) would be research-only" : null,
      stopLoss: num(rr?.stopLoss),
      tp1: num(rr?.targets?.tp1),
      tp2: num(rr?.targets?.tp2),
      tp3: num(rr?.targets?.tp3),
      riskReward: num(rr?.rr_to_tp1),
      atr14: num(atr),
      reasoning,
      evidencePackageId: pkg.packageId,
      evidenceHash: pkg.contentHash,
      indicatorSnapshot: JSON.stringify(technical?.indicators ?? null),
      fundamentalSnapshot: JSON.stringify({ quarters: bundle.quarters.slice(-8), patterns: bundle.patterns }),
      patternFindings: JSON.stringify(monthlyPatterns),
      newsRefs: JSON.stringify(bundle.news),
      modelInfo: JSON.stringify({
        model: record.model, provider: record.provider, promptVersion: record.promptVersion,
        schemaVersion: record.outputSchemaVersion, engineVersion: MODEL_M_ENGINE_VERSION,
        trigger: opts.trigger ?? "manual",
      }),
      warnings: JSON.stringify(warnings),
      decisionJson: JSON.stringify(record),
    },
  });

  return {
    blocked: false,
    dataQuality: dq,
    technical,
    monthlyPatterns,
    fundamentals: {
      quarters: bundle.quarters.slice(-12),
      resultPatterns: bundle.patterns,
      pitPatterns: bundle.pitPatterns,
      news: bundle.news,
      filings,
    },
    evidence: {
      packageId: pkg.packageId,
      contentHash: pkg.contentHash,
      filePath: null,
      qualityScore: record.evidenceQualityScore,
      qualityParts: record.evidenceQualityParts,
      missingSources: bundle.evidence.missingSources ?? [],
      dataQualityFlags: warnings,
    },
    decision: {
      decision,
      signalClass: record.signalClass,
      researchOnly: true,
      analysisTimestamp: record.decisionTimestamp,
      dataCutoff: record.dataCutoff,
      entryPrice: num(rr?.entryReference),
      entryCondition: rr && Number.isFinite(rr.entryReference) ? "verified cutoff close" : null,
      stopLoss: num(rr?.stopLoss),
      tp1: num(rr?.targets?.tp1),
      tp2: num(rr?.targets?.tp2),
      tp3: num(rr?.targets?.tp3),
      riskRewardTp1: num(rr?.rr_to_tp1),
      atr14: num(atr),
      reasoning,
      llmState: record.llmState,
      llmModel: record.model,
      noTradeReasons: rr?.noTradeReasons ?? [],
      sellNote,
      warnings,
    },
    analysisId: created.id,
    runRecord: {
      finalSignalReason: record.finalSignalReason,
      evidenceQualityScore: record.evidenceQualityScore,
      parseErrors: record.parseErrors,
      capitalProtection: record.capitalProtection,
      analysisHorizon: record.analysisHorizon,
    },
  };
}

export async function getAnalysisHistory(symbol: string, limit = 20) {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = await db.modelMAnalysis.findMany({
    where: { symbol: sym },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, decision: true, analysisTs: true, dataCutoff: true, dataFreshness: true,
      entryPrice: true, stopLoss: true, tp1: true, tp2: true, tp3: true, riskReward: true,
      atr14: true, reasoning: true, evidencePackageId: true, evidenceHash: true,
      engineVersion: true, modelInfo: true, warnings: true,
    },
  });
  return rows.map((r) => ({ ...r, analysisTs: r.analysisTs.toISOString() }));
}

export async function getUniverseFreshness(limit = 40) {
  const frontierRow = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  const frontier = frontierRow?.date ?? null;
  const latest = await db.ohlcvBar.groupBy({
    by: ["symbol"], _max: { date: true }, _count: { _all: true },
    orderBy: { symbol: "asc" },
  });
  const lastRun = await db.schedulerRun.findFirst({
    where: { jobName: { in: ["eod_pipeline", "eod_recover"] } },
    orderBy: { startedAt: "desc" },
    select: { runKey: true, status: true, finishedAt: true, dataCutoffDate: true },
  });
  return {
    frontier,
    lastSchedulerRun: lastRun,
    symbols: latest.slice(0, limit).map((s) => {
      const behind = businessDaysBehind(s._max.date, frontier);
      const status: DataQuality = !s._max.date ? "UNAVAILABLE" : s._max.date === frontier ? "VERIFIED" : behind <= 3 ? "PARTIAL" : "STALE";
      return { symbol: s.symbol, latestBarDate: s._max.date, bars: s._count._all, status };
    }),
    totalSymbols: latest.length,
  };
}
