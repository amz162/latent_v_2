// ============================================================================
// Task 111 / Phase 3 — Multi-source point-in-time evidence builder.
//
// Builds the `latent_psx_llm_evidence_v1` package per symbol from VERIFIED
// platform data only:
//   - OhlcvBar DB history (same source as every research dashboard)
//   - golden-cross.ts SMA7/30 + crossover state (same functions as the GC tab)
//   - risk-levels.ts ATR14 + deterministic SL/TP policy
//   - volatility: documented inline estimators (20d realized, BBW 20/2)
//   - price-patterns.ts via the PIT-safe wrapper (never future candles)
//   - quarterly financial-results snapshots + deterministic pattern finder
//   - news intelligence (company + national + international, cached)
// Raw database dumps are NEVER sent to the LLM — only this structured package.
// Every numeric fact carries a source reference and timestamp. Unavailable
// data is reported as unavailable — it is never converted into neutral
// evidence, and missing news is never treated as positive news.
// ============================================================================
import { db } from "@/lib/db";
import { barIsValid, computeGoldenCross, MA_FAST, MA_SLOW, type Bar } from "../golden-cross";
import { computeRiskLevels, type RiskLevelBar } from "../risk-levels";
import { findPricePatternsPIT, type PITPatternResult } from "../technical/price-pattern-finder";
import { fetchFinancialResults, type ParsedQuarter } from "../financial-results";
import { findCompanyFinancialPatterns, type PatternFinderResult } from "../fundamentals/company-pattern-finder";
import {
  fetchCompanyNews,
  fetchMarketNews,
  newsMarketView,
  NEWS_SOURCE_REGISTRY,
  type NewsItem,
} from "../news/market-news-intelligence";
import {
  EVIDENCE_SCHEMA_VERSION,
  type CategorizedEvidence,
  type EvidenceStatus,
  type LLMEvidence,
  type SourceCategory,
  type SourceRef,
} from "./schemas";

export interface MarketContext {
  asOfSession: string;
  universeSize: number;
  pctAboveMa30: number;
  breadthNote: string;
}

export interface EvidenceBundle {
  evidence: LLMEvidence;
  bars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  quarters: ParsedQuarter[];
  patterns: PatternFinderResult;
  pitPatterns: PITPatternResult;
  news: { company: NewsItem[]; national: NewsItem[]; international: NewsItem[] };
}

/** Per-run cache so market-wide news + sector map are fetched once. */
const runCache: {
  national?: NewsItem[];
  international?: NewsItem[];
  nationalStatus?: { status: string; error?: string };
  internationalStatus?: { status: string; error?: string };
  sectorMap?: Record<string, string>;
} = {};

export async function primeMarketEvidence(): Promise<void> {
  if (!runCache.national) {
    const nat = await fetchMarketNews("national");
    runCache.national = nat.items;
    runCache.nationalStatus = nat.status;
  }
  if (!runCache.international) {
    const intl = await fetchMarketNews("international");
    runCache.international = intl.items;
    runCache.internationalStatus = intl.status;
  }
  if (!runCache.sectorMap) {
    try {
      const { getSymbolSectorMap } = await import("../psxdata");
      const res = await getSymbolSectorMap();
      runCache.sectorMap = (res as { map?: Record<string, string> }).map ?? {};
    } catch {
      runCache.sectorMap = {};
    }
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

function pctChange(series: number[], back: number): number | null {
  if (series.length <= back) return null;
  const a = series[series.length - 1 - back];
  const b = series[series.length - 1];
  if (!(a > 0)) return null;
  return ((b - a) / a) * 100;
}

export async function buildEvidenceBundle(symbol: string, marketContext: MarketContext): Promise<EvidenceBundle | { error: string }> {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const decisionTimestamp = new Date().toISOString();

  // ── 1. OHLCV history (verified platform DB) ──────────────────────────────
  const rows = await db.ohlcvBar.findMany({
    where: { symbol: sym },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });
  const bars = rows
    .map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      valid: barIsValid(r),
    }))
    .filter((b) => b.valid);
  if (bars.length < MA_SLOW + 10) {
    return { error: `insufficient_history (${bars.length} valid bars)` };
  }
  const last = bars[bars.length - 1];
  const gcBars: Bar[] = bars.map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, valid: true }));
  const gc = computeGoldenCross(gcBars);
  const closes = bars.map((b) => b.close);

  // ── 2. Technical evidence (local, deterministic, documented) ─────────────
  const rlBars: RiskLevelBar[] = bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close }));
  const rl = computeRiskLevels(rlBars, last.date, "BUY");
  const n20 = closes.slice(-21);
  const ma20 = mean(n20.slice(0, 20));
  const sd20 = stdev(n20.slice(0, 20));
  const bbw = ma20 > 0 ? ((2 * 2 * sd20) / ma20) * 100 : null; // (2*2sd)/mid, %
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  const realizedVol20 = rets.length >= 20 ? stdev(rets.slice(-20)) * Math.sqrt(252) * 100 : null;
  const realizedVol60 = rets.length >= 60 ? stdev(rets.slice(-60)) * Math.sqrt(252) * 100 : null;
  const ma7Now = gc.ma7[gc.ma7.length - 1] ?? null;
  const ma30Now = gc.ma30[gc.ma30.length - 1] ?? null;
  const lastCrossIdx = (() => {
    for (let i = gc.signals.length - 1; i >= 0; i--) if (gc.signals[i]) return i;
    return -1;
  })();
  const lastCross = lastCrossIdx >= 0 ? { type: gc.signals[lastCrossIdx], date: gc.dates[lastCrossIdx] ?? "", sessionsAgo: gc.signals.length - 1 - lastCrossIdx } : null;

  const technicalEvidence: CategorizedEvidence = {
    status: "verified",
    summary: `Local deterministic indicators (golden-cross.ts + risk-levels.ts policy): SMA7=${ma7Now?.toFixed(2) ?? "n/a"}, SMA30=${ma30Now?.toFixed(2) ?? "n/a"}, price ${ma7Now && ma30Now ? (ma7Now > ma30Now ? "above" : "below") + " SMA30" : "n/a"}, ATR14=${rl?.atr14?.toFixed(2) ?? "n/a"}, BBW(20,2)=${bbw?.toFixed(2) ?? "n/a"}%, last cross=${lastCross ? `${lastCross.type} ${lastCross.sessionsAgo} sessions ago` : "none in window"}.`,
    metrics: [
      { name: "sma7", value: ma7Now, asOf: last.date, note: `golden-cross.ts MA_FAST=${MA_FAST}` },
      { name: "sma30", value: ma30Now, asOf: last.date, note: `golden-cross.ts MA_SLOW=${MA_SLOW}` },
      { name: "atr14", value: rl?.atr14 ?? null, asOf: last.date, note: "risk-levels.ts atr14-1.5-1-2-3 policy" },
      { name: "bbw_20_2_pct", value: bbw, asOf: last.date, note: "20-session SMA, 2 stdev, width=(upper-lower)/mid" },
      { name: "realized_vol_20d_ann_pct", value: realizedVol20, asOf: last.date, note: "ln-return stdev x sqrt(252), annualized once" },
      { name: "realized_vol_60d_ann_pct", value: realizedVol60, asOf: last.date, note: "ln-return stdev x sqrt(252), annualized once" },
      { name: "change_5d_pct", value: pctChange(closes, 5), asOf: last.date },
      { name: "change_20d_pct", value: pctChange(closes, 20), asOf: last.date },
      { name: "change_60d_pct", value: pctChange(closes, 60), asOf: last.date },
    ],
    sources: ["src:ohlcv_db", "src:technical_local"],
  };

  // ── 3. Price patterns (PIT-safe wrapper over the live engine) ────────────
  const engineBars = bars.map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
  const pitPatterns = findPricePatternsPIT(sym, engineBars, bars.length - 1);
  const pricePatternEvidence: CategorizedEvidence = {
    status: pitPatterns.insufficient ? "insufficient_history" : "verified",
    summary:
      `Deterministic pattern engine over ${pitPatterns.bars_used} bars (future excluded: ${pitPatterns.future_bars_excluded}): ` +
      (pitPatterns.candidates.length
        ? pitPatterns.candidates.slice(0, 6).map((c) => `${c.pattern_name}[${c.confirmation_status.replace("_", " ")}]`).join("; ")
        : "no qualifying patterns"),
    metrics: pitPatterns.candidates.slice(0, 8).map((c) => ({
      name: `pattern:${c.pattern_type}:${c.confirmation_status}`,
      value: c.avg_move_pct,
      unit: "%",
      asOf: c.end_date,
      note: `occurrences=${c.occurrences}, success_rate=${c.success_rate_pct}%, strength=${c.strength}`,
    })),
    sources: ["src:price_patterns"],
  };

  // ── 4. Fundamentals (quarterly snapshots; PIT honestly limited) ──────────
  const fin = await fetchFinancialResults(sym);
  const quarters: ParsedQuarter[] = fin?.results ?? [];
  const patterns = findCompanyFinancialPatterns(sym, quarters, decisionTimestamp);
  let fundamentalEvidence: CategorizedEvidence;
  if (!quarters.length) {
    fundamentalEvidence = {
      status: "unavailable",
      summary: "No verified quarterly financial-result snapshot for this symbol. Missing fundamentals are NOT evidence of stability.",
      metrics: [],
      sources: [],
    };
  } else {
    const q = quarters[quarters.length - 1];
    const prev = quarters[quarters.length - 2] ?? null;
    fundamentalEvidence = {
      status: "partially_verified",
      summary: `Latest verified quarter ${q.period} (period end ${q.periodEnd}): revenue ${q.metrics.revenue.toLocaleString()}, PAT ${q.metrics.profitAfterTax.toLocaleString()}, EPS ${q.metrics.eps}, net margin ${q.metrics.netMargin?.toFixed(1) ?? "n/a"}%. Filing publication timestamps are NOT point-in-time verified (Task 102/111) — usable for CURRENT research only, disabled for historical as-of backtesting.`,
      metrics: [
        { name: "revenue_latest", value: q.metrics.revenue, asOf: q.periodEnd },
        { name: "profit_after_tax_latest", value: q.metrics.profitAfterTax, asOf: q.periodEnd },
        { name: "eps_latest", value: q.metrics.eps, asOf: q.periodEnd },
        { name: "revenue_yoy_pct", value: q.metrics.revenueYoYGrowth ?? null, asOf: q.periodEnd },
        { name: "gross_margin_pct", value: q.metrics.grossMargin ?? null, asOf: q.periodEnd },
        { name: "net_margin_pct", value: q.metrics.netMargin ?? null, asOf: q.periodEnd },
        { name: "dividend_per_share_latest", value: q.metrics.dividendPerShare ?? null, asOf: q.periodEnd },
        { name: "quarters_available", value: quarters.length, asOf: last.date, note: "verified snapshot quarters" },
        ...(prev ? [{ name: "sequential_revenue_change_pct", value: prev.metrics.revenue > 0 ? ((q.metrics.revenue - prev.metrics.revenue) / prev.metrics.revenue) * 100 : null, asOf: q.periodEnd }] : []),
      ],
      sources: ["src:financials_snapshot"],
    };
  }
  const financialPatternEvidence: CategorizedEvidence = {
    status: patterns.insufficient_history ? "insufficient_history" : "partially_verified",
    summary: patterns.insufficient_history
      ? patterns.notes[0]
      : `${patterns.patterns.length} deterministic pattern(s): ${patterns.patterns.map((p) => `${p.pattern_type}(${p.direction})`).join("; ")}`,
    metrics: patterns.patterns.slice(0, 8).map((p) => ({ name: `fp:${p.pattern_type}`, value: p.strength, asOf: p.period_end, note: `direction=${p.direction}, n=${p.observation_count}` })),
    sources: patterns.patterns.length ? ["src:financials_snapshot"] : [],
  };

  // ── 5. News (company cached per symbol; market-wide cached per run) ──────
  const company = await fetchCompanyNews(sym);
  const national = runCache.national ?? [];
  const international = runCache.international ?? [];
  const natView = newsMarketView(national, "national");
  const intlView = newsMarketView(international, "international");
  const highMatCompany = company.items.filter((i) => i.materiality === "high").length;
  const companyNewsEvidence: CategorizedEvidence = {
    status: company.items.length ? "partially_verified" : "unavailable",
    summary: company.items.length
      ? `${company.items.length} recent company item(s) via askanalyst (publication dates ${company.items.filter((i) => i.publishedAt).length}/${company.items.length} day-verified): ${company.items.slice(0, 3).map((i) => `[${i.sentiment}/${i.materiality}] ${i.headline}`).join(" | ")}`
      : "No recent company news retrieved. No news found is NOT equivalent to positive news.",
    metrics: [
      { name: "company_news_count", value: company.items.length, asOf: decisionTimestamp },
      { name: "company_news_high_materiality", value: highMatCompany, asOf: decisionTimestamp },
      { name: "company_news_injection_flagged", value: company.items.filter((i) => i.injectionFlagged).length, asOf: decisionTimestamp, note: "untrusted text flagged; never executed" },
    ],
    sources: company.items.length ? ["src:news_company"] : [],
  };
  const nationalNewsEvidence: CategorizedEvidence = {
    status: natView.status === "unavailable" ? "unavailable" : "partially_verified",
    summary:
      natView.status === "unavailable"
        ? `National macro/news snapshot unavailable${runCache.nationalStatus?.error ? ` (${runCache.nationalStatus.error})` : ""}. Treated as MISSING, not neutral.`
        : `National snapshot (${national.length} items, ${natView.highMateriality} high-materiality): ${national.slice(0, 3).map((i) => `[${i.sentiment}] ${i.headline}`).join(" | ")}`,
    metrics: [{ name: "national_news_count", value: national.length, asOf: decisionTimestamp }],
    sources: national.length ? ["src:news_national"] : [],
  };
  const internationalNewsEvidence: CategorizedEvidence = {
    status: intlView.status === "unavailable" ? "unavailable" : "partially_verified",
    summary:
      intlView.status === "unavailable"
        ? `International macro/news snapshot unavailable${runCache.internationalStatus?.error ? ` (${runCache.internationalStatus.error})` : ""}. Treated as MISSING, not neutral.`
        : `International snapshot (${international.length} items, ${intlView.highMateriality} high-materiality): ${international.slice(0, 3).map((i) => `[${i.sentiment}] ${i.headline}`).join(" | ")}`,
    metrics: [{ name: "international_news_count", value: international.length, asOf: decisionTimestamp }],
    sources: international.length ? ["src:news_international"] : [],
  };

  // ── 6. Volatility + market context ───────────────────────────────────────
  const volatilityContext: CategorizedEvidence = {
    status: realizedVol20 != null ? "verified" : "insufficient_history",
    summary: `Realized-only research context: 20d ann. vol ${realizedVol20?.toFixed(1) ?? "n/a"}%, 60d ${realizedVol60?.toFixed(1) ?? "n/a"}%, BBW ${bbw?.toFixed(2) ?? "n/a"}%. No implied volatility exists for PSX (no listed options market data) — realized vol is NEVER implied vol.`,
    metrics: [
      { name: "realized_vol_20d_ann_pct", value: realizedVol20, asOf: last.date },
      { name: "realized_vol_60d_ann_pct", value: realizedVol60, asOf: last.date },
      { name: "bbw_20_2_pct", value: bbw, asOf: last.date },
    ],
    sources: ["src:volatility_local", "src:ohlcv_db"],
  };
  const marketContextEvidence: CategorizedEvidence = {
    status: "verified",
    summary: marketContext.breadthNote,
    metrics: [
      { name: "universe_pct_above_ma30", value: marketContext.pctAboveMa30, asOf: marketContext.asOfSession },
      { name: "universe_size", value: marketContext.universeSize, asOf: marketContext.asOfSession },
    ],
    sources: ["src:market_context", "src:ohlcv_db"],
  };

  // ── 7. Source registry + refs ────────────────────────────────────────────
  const ref = (
    id: string,
    category: SourceCategory,
    publisher: string,
    pitSafe: boolean,
    url: string | null = null,
    publishedAt: string | null = null,
    retrievedAt: string | null = decisionTimestamp
  ): SourceRef => ({ id, category, publisher, url, publishedAt, retrievedAt, pitSafeForHistorical: pitSafe });
  const sourceRefs: SourceRef[] = [
    ref("src:ohlcv_db", "ohlcv_db", "Latent.pk OhlcvBar (psxdata/pypsx ingest)", true),
    ref("src:technical_local", "technical_local", "golden-cross.ts + risk-levels.ts (deterministic, policy atr14-1.5-1-2-3)", true),
    ref("src:price_patterns", "price_patterns", "price-patterns.ts deterministic engine (PIT wrapper)", true),
    ref("src:volatility_local", "volatility_local", "realized-variance estimators (realized ONLY; no implied vol exists for PSX)", true),
    ref("src:financials_snapshot", "financials_snapshot", "data/financials quarterly snapshots (askanalyst results API)", false, null, null, quarters.length ? decisionTimestamp : null),
    ref("src:news_company", "news_company", "AskAnalyst company news API", false),
    ref("src:news_national", "news_national", NEWS_SOURCE_REGISTRY[1].publisher, false),
    ref("src:news_international", "news_international", NEWS_SOURCE_REGISTRY[2].publisher, false),
    ref("src:market_context", "market_context", "universe breadth (OhlcvBar + golden-cross.ts)", true),
  ];

  const missingSources: string[] = [];
  if (!quarters.length) missingSources.push("verified quarterly financial statements");
  if (!company.items.length) missingSources.push("company news");
  if (natView.status === "unavailable") missingSources.push("national macro news");
  if (intlView.status === "unavailable") missingSources.push("international macro news");

  const companyName = quarters.length ? quarters[quarters.length - 1].company || sym : sym;
  const sector = runCache.sectorMap?.[sym] ?? "unknown";

  const evidence: LLMEvidence = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    symbol: sym,
    companyName,
    sector,
    decisionTimestamp,
    dataCutoff: last.date,
    priceContext: {
      lastClose: last.close,
      lastCloseDate: last.date,
      change5dPct: pctChange(closes, 5),
      change20dPct: pctChange(closes, 20),
      change60dPct: pctChange(closes, 60),
      seriesTail: bars.slice(-10).map((b) => ({ date: b.date, close: b.close })),
    },
    fundamentalEvidence,
    financialPatternEvidence,
    companyNewsEvidence,
    nationalNewsEvidence,
    internationalNewsEvidence,
    technicalEvidence,
    pricePatternEvidence,
    volatilityContext,
    marketContext: marketContextEvidence,
    dataQualityFlags: [
      ...(quarters.length ? ["financial_publication_timestamps_not_pit_verified"] : ["fundamentals_unavailable"]),
      ...(company.items.some((i) => i.injectionFlagged) ? ["news_injection_flagged"] : []),
      ...(company.items.some((i) => !i.publishedAt) ? ["company_news_publication_dates_partial"] : []),
      "llm_analysis_current_only_no_historical_asof_use",
    ],
    missingSources,
    historicalUseAllowed: false,
    sourceRefs,
  };

  return { evidence, bars: engineBars, quarters, patterns, pitPatterns, news: { company: company.items, national, international } };
}
