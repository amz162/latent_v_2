// ============================================================================
// Price Pattern Finder — server-side service shared by the GET (on-demand)
// and precompute (nightly batch) routes. DB-first: reports are computed once,
// stored in PricePatternReport and served from SQLite afterwards, so the LLM
// layer never runs twice for the same data.
// ============================================================================

import { db } from "@/lib/db";
import { MOCK_STOCKS } from "@/lib/latent/mock-stocks";
import {
  detectPricePatterns,
  PATTERN_DISCLAIMER,
  type DetectionResult,
  type PriceBar,
  type PricePatternReportResponse,
} from "@/lib/latent/price-patterns";
import { explainPricePatterns, type LlmExplanations } from "@/lib/latent/price-pattern-llm";

/** A report is "fresh" for 20 hours — the nightly pass refreshes everything. */
export const FRESH_MS = 20 * 60 * 60 * 1000;

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/XD$/, "");
}

export function companyName(sym: string): string {
  return MOCK_STOCKS.find((s) => s.symbol === sym)?.name || sym;
}

export async function loadPriceBars(sym: string): Promise<PriceBar[]> {
  const rows = await db.ohlcvBar.findMany({
    where: { symbol: sym },
    orderBy: { date: "asc" },
    select: { date: true, open: true, close: true, volume: true },
  });
  return rows.map((r) => ({
    date: r.date.slice(0, 10),
    open: r.open ?? 0,
    close: r.close,
    volume: r.volume ?? 0,
  }));
}

export interface ReportFreshness {
  computedAt: Date;
  llmJson: string | null;
  patternCount: number;
}

export function isFreshReport(report: ReportFreshness | null): boolean {
  if (!report) return false;
  if (Date.now() - report.computedAt.getTime() > FRESH_MS) return false;
  // Detection found patterns but the LLM pass failed → retry sooner (on-demand
  // or next nightly batch) instead of serving stats-only for 20 hours.
  if (report.patternCount > 0 && !report.llmJson) return false;
  return true;
}

/** Run detection + LLM once and persist the result (upsert). */
export async function computeAndSaveReport(
  sym: string,
  bars?: PriceBar[]
): Promise<{ detection: DetectionResult; llm: LlmExplanations | null }> {
  const priceBars = bars ?? (await loadPriceBars(sym));
  const detection = detectPricePatterns(priceBars);
  const llm =
    detection.patterns.length > 0
      ? await explainPricePatterns(sym, companyName(sym), detection)
      : { patterns: {}, unusual_notes: [] };

  const detectionJson = JSON.stringify({
    coverage: detection.coverage,
    patterns: detection.patterns,
    zones: detection.zones,
    seasonality: detection.seasonality,
    unusual: detection.unusual,
  });
  const llmJson = llm ? JSON.stringify(llm) : null;

  await db.pricePatternReport.upsert({
    where: { symbol: sym },
    update: {
      computedAt: new Date(),
      detectionJson,
      llmJson,
      barsCount: detection.coverage.bars,
      firstDate: detection.coverage.firstDate,
      lastDate: detection.coverage.lastDate,
      patternCount: detection.patterns.length,
    },
    create: {
      symbol: sym,
      computedAt: new Date(),
      detectionJson,
      llmJson,
      barsCount: detection.coverage.bars,
      firstDate: detection.coverage.firstDate,
      lastDate: detection.coverage.lastDate,
      patternCount: detection.patterns.length,
    },
  });

  return { detection, llm };
}

/** Downsample the close series so the chart payload stays light. */
export function downsampleForChart(
  bars: PriceBar[],
  maxPoints = 1200
): { dates: string[]; closes: number[] } {
  const n = bars.length;
  if (n <= maxPoints) {
    return { dates: bars.map((b) => b.date.slice(0, 10)), closes: bars.map((b) => b.close) };
  }
  const step = Math.ceil(n / maxPoints);
  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 0; i < n; i += step) {
    dates.push(bars[i].date.slice(0, 10));
    closes.push(bars[i].close);
  }
  if ((n - 1) % step !== 0) {
    dates.push(bars[n - 1].date.slice(0, 10));
    closes.push(bars[n - 1].close);
  }
  return { dates, closes };
}

/** Merge detection + LLM + chart into the client-facing response shape. */
export function buildReportResponse(
  sym: string,
  detection: DetectionResult,
  llm: LlmExplanations | null,
  bars: PriceBar[],
  cached: boolean,
  computedAt: Date
): PricePatternReportResponse {
  return {
    symbol: sym,
    company: companyName(sym),
    cached,
    computedAt: computedAt.toISOString(),
    coverage: detection.coverage,
    patterns: detection.patterns
      .filter((p) => p.occurrences >= 2)
      .map((p) => ({ ...p, explanation: llm?.patterns[p.id] || undefined })),
    zones: detection.zones,
    seasonality: detection.seasonality,
    unusual: detection.unusual,
    llmNotes: llm?.unusual_notes ?? [],
    chart: downsampleForChart(bars),
    disclaimer: PATTERN_DISCLAIMER,
  };
}
