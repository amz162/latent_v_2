"use client";

// Task 129 — Model M research tab.
//
// Composition per symbol: data-quality strip (VERIFIED / PARTIAL / STALE /
// UNAVAILABLE / FAILED) → GLM-4.6 evidence-based decision (research-only,
// long-only; SELL never opens a short) → Technical Analysis → Fundamental
// Analysis (financials, company/national/international news, results, PSX
// announcements) → Pattern Analysis (market-price monthly + company results)
// → evidence package (id + content hash) → append-only analysis history.
//
// Fresh analysis is refused server-side when the underlying price data is
// stale/unavailable — the cached analysis is then shown with the stale badge,
// never presented as current. Every number shown carries its data window and
// status; missing sources are disclosed, never treated as positive evidence.

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockSearch } from "./StockSearch";

type Quality = "VERIFIED" | "PARTIAL" | "STALE" | "UNAVAILABLE" | "FAILED";

const QUALITY_STYLES: Record<Quality, string> = {
  VERIFIED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PARTIAL: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  STALE: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  UNAVAILABLE: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  FAILED: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const DECISION_STYLES: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  HOLD: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  SELL: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  NO_TRADE: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  SELL_RESEARCH_ONLY: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

interface QualityReport {
  status: Quality;
  symbol: string;
  latestBarDate: string | null;
  globalFrontierDate: string | null;
  barsCount: number;
  sessionsBehindFrontier: number;
  freshnessNote: string;
  sections: Record<string, { status: Quality; note: string }>;
  lastSchedulerRun: { runKey: string; status: string; finishedAt: string | null; dataCutoffDate: string | null } | null;
}

interface IndicatorResultView { name: string; value: number | null; window: number | null; asOf: string | null; complete: boolean; interpretation: string }

interface AnalysisPayload {
  dataQuality: QualityReport;
  technical: {
    indicators: IndicatorResultView[];
    supports: number[];
    resistances: number[];
    volume: IndicatorResultView | null;
    trendStrength: IndicatorResultView | null;
    volatility: IndicatorResultView | null;
    recentPriceAction: Array<{ date: string; close: number; chgPct: number | null; volume: number }>;
    asOf: string | null;
  } | null;
  monthlyPatterns: {
    months: Array<{ month: number; samples: number; avgReturnPct: number | null; medianReturnPct: number | null; stdevReturnPct: number | null; positiveFreq: number | null; avgVolRatio: number | null; avgVolatilityPct: number | null; sufficient: boolean }>;
    historyYears: number;
    firstDate: string | null;
    lastDate: string | null;
    caveat: string;
    bestMonth: { month: number; avgReturnPct: number; samples: number } | null;
    worstMonth: { month: number; avgReturnPct: number; samples: number } | null;
  };
  fundamentals: {
    quarters: Array<Record<string, unknown>>;
    resultPatterns: { patterns?: Array<Record<string, unknown>> } | Record<string, unknown>;
    news: { company: Array<Record<string, unknown>>; national: Array<Record<string, unknown>>; international: Array<Record<string, unknown>> };
    filings: { status: string; count: number; fetchedAt: string | null; items: Array<{ date: string | null; description: string; pdf: string | null }>; note: string };
  };
  evidence: { packageId: string; contentHash: string; qualityScore: number; qualityParts: Record<string, number>; missingSources: string[]; dataQualityFlags: string[] };
  decision: {
    decision: string;
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
  runRecord: { evidenceQualityScore: number; capitalProtection: { triggered: string[] }; analysisHorizon: string };
}

interface HistoryRow {
  id: string;
  decision: string;
  analysisTs: string;
  dataCutoff: string;
  dataFreshness: string;
  entryPrice: number | null;
  stopLoss: number | null;
  tp1: number | null;
  evidencePackageId: string | null;
  evidenceHash: string | null;
}

interface GetResponse {
  dataQuality: QualityReport;
  latestAnalysis: HistoryRow | null;
  history: HistoryRow[];
  historyCount: number;
  evidencePackage: { packageId: string | null; contentHash: string | null; qualityFlags?: string[] } | null;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));

function QualityBadge({ status }: { status: string }) {
  const s = (QUALITY_STYLES[status as Quality] ?? QUALITY_STYLES.UNAVAILABLE);
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${s}`}>{status}</span>;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export function ModelMView() {
  const [symbol, setSymbol] = useState<string>("");
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [evidencePkg, setEvidencePkg] = useState<GetResponse["evidencePackage"]>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blockNotice, setBlockNotice] = useState<string | null>(null);

  const loadSymbol = useCallback(async (sym: string) => {
    if (!sym) return;
    setLoading(true); setErr(null); setBlockNotice(null); setAnalysis(null);
    try {
      const r = await fetch(`/api/model-m/${sym}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setQuality(j.dataQuality);
      setHistory(j.history ?? []);
      setEvidencePkg(j.evidencePackage ?? null);
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (symbol) loadSymbol(symbol); }, [symbol, loadSymbol]);

  const requestAnalysis = useCallback(async () => {
    if (!symbol) return;
    setAnalyzing(true); setErr(null); setBlockNotice(null);
    try {
      const r = await fetch(`/api/model-m/${symbol}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon: "10d" }),
      });
      const j = await r.json();
      if (r.status === 409) {
        setBlockNotice(j.reason || "fresh analysis refused — data not current");
        if (j.dataQuality) setQuality(j.dataQuality);
        return;
      }
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const res = j.result as AnalysisPayload;
      setAnalysis(res);
      setQuality(res.dataQuality);
      // refresh history after an append
      const g = await fetch(`/api/model-m/${symbol}`, { cache: "no-store" });
      const gj = await g.json();
      if (g.ok) { setHistory(gj.history ?? []); setEvidencePkg(gj.evidencePackage ?? null); }
    } catch (e) {
      setErr(String((e as Error).message));
    } finally {
      setAnalyzing(false);
    }
  }, [symbol]);

  const canRequest = !!quality && quality.status !== "UNAVAILABLE" && quality.status !== "FAILED";
  const d = analysis?.decision ?? null;
  const t = analysis?.technical ?? null;

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 md:p-6 max-w-5xl w-full mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Model M</h1>
          <p className="text-xs text-muted-foreground mt-1">
            GLM-4.6 evidence-based research decisions · long-only · RESEARCH ONLY — never an order ·
            stale data blocks fresh analysis
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">task129</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <StockSearch
            value={symbol}
            onChange={(s) => setSymbol(s)}
            placeholder="Search by ticker or company name…"
          />
          {quality && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <QualityBadge status={quality.status} />
              <span className="text-muted-foreground">{quality.freshnessNote}</span>
              <span className="text-muted-foreground">· latest bar {fmtDate(quality.latestBarDate)} · frontier {fmtDate(quality.globalFrontierDate)} · {quality.barsCount} bars</span>
              {quality.lastSchedulerRun && (
                <span className="text-muted-foreground">· last scheduler run {quality.lastSchedulerRun.runKey} → {quality.lastSchedulerRun.status} ({fmtDate(quality.lastSchedulerRun.finishedAt)})</span>
              )}
            </div>
          )}
          {quality && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(quality.sections).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <QualityBadge status={v.status} /> {k}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={requestAnalysis}
              disabled={!canRequest || analyzing || loading}
              className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analyzing ? "Analyzing with GLM-4.6…" : "Request fresh analysis"}
            </button>
            {!canRequest && quality && (
              <span className="text-[11px] text-amber-500">
                fresh analysis unavailable for {quality.status.toLowerCase()} data
              </span>
            )}
          </div>
          {blockNotice && <p className="mt-2 text-xs text-amber-500">{blockNotice}</p>}
          {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
          {loading && <p className="mt-2 text-xs text-muted-foreground">Loading…</p>}
        </CardContent>
      </Card>

      {/* ── Decision ── */}
      {d && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Decision
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${DECISION_STYLES[d.decision] ?? DECISION_STYLES.NO_TRADE}`}>
                {d.decision}
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {d.researchOnly ? "research-only" : ""} · model {d.llmModel ?? "—"} · llm {d.llmState} · analysis {fmtDate(d.analysisTimestamp)} · cutoff {fmtDate(d.dataCutoff)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-xs">
              <div className="rounded border p-2"><div className="text-muted-foreground text-[10px]">Entry ref</div><div className="font-semibold">{fmt(d.entryPrice)}</div><div className="text-[10px] text-muted-foreground">{d.entryCondition ?? "unavailable"}</div></div>
              <div className="rounded border p-2"><div className="text-muted-foreground text-[10px]">Stop loss</div><div className="font-semibold">{fmt(d.stopLoss)}</div><div className="text-[10px] text-muted-foreground">ATR(14) {fmt(d.atr14)} policy</div></div>
              <div className="rounded border p-2"><div className="text-muted-foreground text-[10px]">TP1 / TP2 / TP3</div><div className="font-semibold">{fmt(d.tp1)} / {fmt(d.tp2)} / {fmt(d.tp3)}</div><div className="text-[10px] text-muted-foreground">entry + 1/2/3×ATR</div></div>
              <div className="rounded border p-2"><div className="text-muted-foreground text-[10px]">Risk/reward → TP1</div><div className="font-semibold">{d.riskRewardTp1 == null ? "unavailable" : `1 : ${fmt(d.riskRewardTp1)}`}</div><div className="text-[10px] text-muted-foreground">deterministic engine</div></div>
            </div>
            {d.reasoning && <p className="text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">Reasoning: </span>{d.reasoning}</p>}
            {d.sellNote && <p className="text-xs text-orange-400">{d.sellNote}</p>}
            {d.noTradeReasons.length > 0 && <p className="text-xs text-muted-foreground">NO_TRADE gates: {d.noTradeReasons.join("; ")}</p>}
            {d.warnings.length > 0 && (
              <p className="text-xs text-amber-500">Warnings: {d.warnings.join(" · ")}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Evidence quality score (deterministic): {analysis?.evidence.qualityScore}/100 · analysis id {analysis?.analysisId}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Technical ── */}
      {t && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Technical Analysis <span className="text-[10px] font-normal text-muted-foreground">as of {fmtDate(t.asOf)} · verified OhlcvBar history</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Indicator</th><th className="py-1 pr-3">Value</th><th className="py-1 pr-3">Window</th><th className="py-1 pr-3">Complete</th><th className="py-1">Interpretation</th></tr></thead>
                <tbody>
                  {t.indicators.map((i) => (
                    <tr key={i.name} className="border-t">
                      <td className="py-1 pr-3 font-medium">{i.name}</td>
                      <td className="py-1 pr-3">{fmt(i.value, 4)}</td>
                      <td className="py-1 pr-3">{i.window ?? "—"} bars</td>
                      <td className="py-1 pr-3">{i.complete ? "yes" : "no"}</td>
                      <td className="py-1 text-muted-foreground">{i.interpretation}</td>
                    </tr>
                  ))}
                  {t.volume && <tr className="border-t"><td className="py-1 pr-3 font-medium">Volume vs 20d avg</td><td className="py-1 pr-3">{fmt(t.volume.value)}</td><td className="py-1 pr-3">21 bars</td><td className="py-1 pr-3">{t.volume.complete ? "yes" : "no"}</td><td className="py-1 text-muted-foreground">{t.volume.interpretation}</td></tr>}
                  {t.trendStrength && <tr className="border-t"><td className="py-1 pr-3 font-medium">Trend strength</td><td className="py-1 pr-3">{fmt(t.trendStrength.value)}%</td><td className="py-1 pr-3">25 bars</td><td className="py-1 pr-3">{t.trendStrength.complete ? "yes" : "no"}</td><td className="py-1 text-muted-foreground">{t.trendStrength.interpretation}</td></tr>}
                  {t.volatility && <tr className="border-t"><td className="py-1 pr-3 font-medium">Realized volatility (20d)</td><td className="py-1 pr-3">{fmt(t.volatility.value, 4)}</td><td className="py-1 pr-3">21 bars</td><td className="py-1 pr-3">{t.volatility.complete ? "yes" : "no"}</td><td className="py-1 text-muted-foreground">{t.volatility.interpretation}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 md:grid-cols-2 text-xs">
              <div className="rounded border p-2">
                <div className="font-medium mb-1">Support zones (swing clusters, 120 bars)</div>
                <div className="text-muted-foreground">{t.supports.length ? t.supports.map((s) => s.toFixed(2)).join(" · ") : "none detected"}</div>
              </div>
              <div className="rounded border p-2">
                <div className="font-medium mb-1">Resistance zones (swing clusters, 120 bars)</div>
                <div className="text-muted-foreground">{t.resistances.length ? t.resistances.map((s) => s.toFixed(2)).join(" · ") : "none detected"}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="font-medium mb-1 text-xs">Recent price action (last 10 sessions)</div>
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Date</th><th className="py-1 pr-3">Close</th><th className="py-1 pr-3">Δ%</th><th className="py-1">Volume</th></tr></thead>
                <tbody>
                  {t.recentPriceAction.map((r) => (
                    <tr key={r.date} className="border-t">
                      <td className="py-1 pr-3">{r.date}</td>
                      <td className="py-1 pr-3">{fmt(r.close)}</td>
                      <td className={`py-1 pr-3 ${(r.chgPct ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmt(r.chgPct)}</td>
                      <td className="py-1">{r.volume.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Fundamental ── */}
      {analysis && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Fundamental Analysis</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* 6.1 financials */}
            <div>
              <div className="text-sm font-medium mb-1">6.1 Company financials <span className="text-[10px] text-muted-foreground">(quarterly snapshots; period + availability labeled; publication timestamps NOT PIT-verified — disclosed)</span></div>
              {analysis.fundamentals.quarters.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Period</th><th className="py-1 pr-3">Revenue</th><th className="py-1 pr-3">Profit</th><th className="py-1 pr-3">EPS</th><th className="py-1">Period end</th></tr></thead>
                    <tbody>
                      {analysis.fundamentals.quarters.map((q, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1 pr-3">{String(q.period ?? "—")}</td>
                          <td className="py-1 pr-3">{q.revenue != null ? Number(q.revenue).toLocaleString() : "—"}</td>
                          <td className="py-1 pr-3">{q.profit != null ? Number(q.profit).toLocaleString() : "—"}</td>
                          <td className="py-1 pr-3">{q.eps != null ? String(q.eps) : "—"}</td>
                          <td className="py-1">{String(q.periodEnd ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-xs text-muted-foreground">UNAVAILABLE — no quarterly financials snapshot for this symbol.</p>}
            </div>
            {/* 6.2/6.3/6.4 news */}
            <div className="grid gap-2 md:grid-cols-3">
              {([["6.2 Company news", analysis.fundamentals.news.company], ["6.3 National news (Pakistan macro)", analysis.fundamentals.news.national], ["6.4 International news", analysis.fundamentals.news.international]] as const).map(([label, items]) => (
                <div key={label} className="rounded border p-2">
                  <div className="text-xs font-medium mb-1">{label}</div>
                  {items && items.length ? (
                    <ul className="space-y-1">
                      {items.slice(0, 4).map((n, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">
                          <span className="text-foreground">{String((n as { title?: string }).title ?? "—")}</span>
                          {` · ${fmtDate(String((n as { publishedAt?: string }).publishedAt ?? ""))} · ${String((n as { publisher?: string }).publisher ?? "")}`}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[11px] text-muted-foreground">UNAVAILABLE — missing news is never treated as positive evidence.</p>}
                </div>
              ))}
            </div>
            {/* 6.5 results patterns */}
            <div>
              <div className="text-sm font-medium mb-1">6.5 Company results patterns</div>
              <p className="text-[11px] text-muted-foreground">
                {(() => {
                  const p = analysis.fundamentals.resultPatterns as { patterns?: unknown[] };
                  const n = Array.isArray(p?.patterns) ? p!.patterns!.length : 0;
                  return n > 0
                    ? `${n} recurring result pattern(s) detected by the deterministic engine (see Pattern Analysis below for market reaction).`
                    : "No recurring result pattern available (insufficient quarterly history or no results snapshot).";
                })()}
              </p>
            </div>
            {/* 6.6 announcements */}
            <div>
              <div className="text-sm font-medium mb-1">6.6 PSX announcements <span className="text-[10px] text-muted-foreground">{analysis.fundamentals.filings.note}{analysis.fundamentals.filings.fetchedAt ? ` · fetched ${fmtDate(analysis.fundamentals.filings.fetchedAt)}` : ""}</span></div>
              {analysis.fundamentals.filings.items.length ? (
                <ul className="space-y-1">
                  {analysis.fundamentals.filings.items.slice(0, 6).map((f, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">
                      <span className="text-foreground font-medium">{fmtDate(f.date)}</span> — {f.description.slice(0, 160)}{f.description.length > 160 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">UNAVAILABLE — {analysis.fundamentals.filings.note}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Patterns ── */}
      {analysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Pattern Analysis
              <span className="text-[10px] font-normal text-muted-foreground"> · {analysis.monthlyPatterns.historyYears} years of history ({fmtDate(analysis.monthlyPatterns.firstDate) || "?"} → {fmtDate(analysis.monthlyPatterns.lastDate) || fmtDate(analysis.dataQuality.latestBarDate)})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm font-medium">7.1 Market price patterns (calendar months)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Month</th><th className="py-1 pr-2">n</th><th className="py-1 pr-2">Avg %</th><th className="py-1 pr-2">Median %</th><th className="py-1 pr-2">σ %</th><th className="py-1 pr-2">Positive</th><th className="py-1 pr-2">Vol ratio</th><th className="py-1">Sample ok</th></tr></thead>
                <tbody>
                  {analysis.monthlyPatterns.months.map((m) => (
                    <tr key={m.month} className={`border-t ${m.sufficient ? "" : "opacity-50"}`}>
                      <td className="py-1 pr-2 font-medium">{MONTH_NAMES[m.month - 1]}</td>
                      <td className="py-1 pr-2">{m.samples}</td>
                      <td className="py-1 pr-2">{m.sufficient ? fmt(m.avgReturnPct) : "—"}</td>
                      <td className="py-1 pr-2">{m.sufficient ? fmt(m.medianReturnPct) : "—"}</td>
                      <td className="py-1 pr-2">{m.sufficient ? fmt(m.stdevReturnPct) : "—"}</td>
                      <td className="py-1 pr-2">{m.sufficient && m.positiveFreq != null ? `${Math.round(m.positiveFreq * 100)}%` : "—"}</td>
                      <td className="py-1 pr-2">{fmt(m.avgVolRatio)}</td>
                      <td className="py-1">{m.sufficient ? "yes" : `no (n<3)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">{analysis.monthlyPatterns.caveat}</p>
            <div className="text-sm font-medium">7.2 Company results patterns</div>
            <p className="text-[11px] text-muted-foreground">
              Quarterly-results behavior is computed by the deterministic results-pattern engine on the snapshot quarters
              (period-labeled above). Publication timestamps are NOT point-in-time verified and this is disclosed on every
              package (financial_publication_timestamps_not_pit_verified); market reactions are therefore reported as
              observations, never as tradeable seasonality.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Evidence ── */}
      {analysis && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Evidence package & coverage</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px]">package {analysis.evidence.packageId}</Badge>
              <Badge variant="outline" className="text-[10px]">sha256 {analysis.evidence.contentHash.slice(0, 16)}…</Badge>
              <Badge variant="outline" className="text-[10px]">quality {analysis.evidence.qualityScore}/100</Badge>
            </div>
            {analysis.evidence.missingSources.length > 0 && (
              <p className="text-amber-500">Missing sources: {analysis.evidence.missingSources.join(" · ")}</p>
            )}
            {analysis.evidence.dataQualityFlags.length > 0 && (
              <p className="text-amber-500">Quality flags: {analysis.evidence.dataQualityFlags.join(" · ")}</p>
            )}
            {evidencePkg?.contentHash && (
              <p className="text-muted-foreground">Cached package hash: {evidencePkg.contentHash.slice(0, 16)}… (content-only hash, deduplicated by symbol + data cutoff)</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── History ── */}
      {quality && history.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Analysis history <span className="text-[10px] font-normal text-muted-foreground">append-only — older analyses are never replaced</span></CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Analysis</th><th className="py-1 pr-2">Decision</th><th className="py-1 pr-2">Data</th><th className="py-1 pr-2">Cutoff</th><th className="py-1 pr-2">Entry</th><th className="py-1 pr-2">SL</th><th className="py-1 pr-2">TP1</th><th className="py-1">Evidence</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="py-1 pr-2">{fmtDate(h.analysisTs)}</td>
                      <td className="py-1 pr-2 font-medium">{h.decision}</td>
                      <td className="py-1 pr-2"><QualityBadge status={h.dataFreshness} /></td>
                      <td className="py-1 pr-2">{fmtDate(h.dataCutoff)}</td>
                      <td className="py-1 pr-2">{fmt(h.entryPrice)}</td>
                      <td className="py-1 pr-2">{fmt(h.stopLoss)}</td>
                      <td className="py-1 pr-2">{fmt(h.tp1)}</td>
                      <td className="py-1 text-muted-foreground">{h.evidenceHash ? h.evidenceHash.slice(0, 8) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground pb-4">
        Research-only boundary: no real-money orders, no short selling, no leverage. The GLM-4.6 output is
        validated against a strict schema and reconciled by a deterministic risk/reward engine — the model never
        computes prices, costs or final levels. Confidence is shown only as the deterministic evidence-quality score;
        no fabricated probabilities.
      </p>
    </div>
  );
}
