"use client";

// Task 112 — "LLM Signals" research tab.
// Shows EVERY persisted LLM decision (including NO_TRADE, llm_unavailable,
// rejected and stale-evidence records) from the append-only signal-history
// store, with filters, search, pagination, a detail drawer and CSV/JSON export.
// SHADOW / RESEARCH ONLY — nothing here is an order.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SignalRow {
  signalId: string;
  symbol: string;
  companyName: string | null;
  decision: string | null;
  llmState: string;
  llmSignal: string | null;
  llmConvictionScore: number | null;
  evidenceQualityScore: number | null;
  decisionTimestamp: string | null;
  dataCutoff: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  evidenceSchemaVersion: string | null;
  evidenceHash: string | null;
  validationStatus: string;
  researchStatus: string;
  rejectionReason: string | null;
  forwardCohortId: string | null;
  riskPolicyVersion: string | null;
  provenance: string;
  mockRecord: boolean;
  staleSkipped: boolean;
  finalSignalReason: string | null;
}

interface Paged {
  records: SignalRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  facets: {
    decisions: Record<string, number>;
    states: Record<string, number>;
    providers: string[];
    promptVersions: string[];
    cohorts: string[];
    symbols: string[];
    lastUpdatedAt: string | null;
  };
}

interface Detail {
  signal: SignalRow & {
    parseErrors: string[] | null;
    llmFailureReason: string | null;
    generationId: string | null;
    llmOutput: {
      analysis_horizon: string;
      fundamental_view: string;
      financial_pattern_view: string;
      national_news_view: string;
      international_news_view: string;
      company_news_view: string;
      technical_view: string;
      price_pattern_view: string;
      bullish_evidence: string[];
      bearish_evidence: string[];
      conflicting_evidence: string[];
      missing_evidence: string[];
      main_risks: string[];
      invalidation_conditions: string[];
      decision_reason: string;
      source_references: string[];
      limitations: string[];
    } | null;
    riskReward: {
      executionAssumption: string;
      entryReference: number | null;
      stopLoss: number | null;
      targets: { tp1: number | null; tp2: number | null; tp3: number | null };
      rr_to_tp1: number | null;
      rr_to_tp2: number | null;
      rr_to_tp3: number | null;
      risk_reward_status: string;
      positionQty: number;
      positionNotional: number;
      netGainAtTp1: number | null;
      netGainAtTp2: number | null;
      netGainAtTp3: number | null;
      netLossAtStop: number | null;
      costsAtTp2: { total_cost: number | null } | null;
      costSchedule: string;
      noTrade: boolean;
      noTradeReasons: string[];
    } | null;
    capitalProtection: { policyId: string; triggered: string[] } | null;
  };
  freshness: "fresh" | "stale";
  evidence: {
    fundamentalEvidence: { status: string; summary: string; metrics: Array<{ name: string; value: number | null; asOf: string | null; note?: string }> } | null;
    companyNewsEvidence: { status: string; summary: string } | null;
    nationalNewsEvidence: { status: string; summary: string } | null;
    internationalNewsEvidence: { status: string; summary: string } | null;
    technicalEvidence: { status: string; summary: string; metrics: Array<{ name: string; value: number | null; asOf: string | null; note?: string }> } | null;
    pricePatternEvidence: { status: string; summary: string } | null;
    volatilityContext: { status: string; summary: string } | null;
    sourceRefs: Array<{ id: string; publisher: string; retrievedAt: string | null; publishedAt: string | null }>;
  } | null;
  evidenceNote: string;
}

const PKT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});

function pkt(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!isFinite(t)) return iso;
  return `${PKT.format(new Date(t))} PKT`;
}

function ageOf(cutoff: string | null): string {
  if (!cutoff) return "—";
  const days = Math.floor((Date.now() - Date.parse(cutoff + "T17:00:00Z")) / 86400000);
  if (!isFinite(days)) return "—";
  return days <= 0 ? "today" : `${days}d old`;
}

function decisionBadge(r: SignalRow) {
  const d = r.decision ?? "—";
  if (r.mockRecord) return "border-purple-500/60 bg-purple-500/10 text-purple-700 dark:text-purple-300";
  if (r.llmState !== "ok") return "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (d === "BUY") return "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (d === "HOLD") return "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-400";
  if (d === "SELL_TO_CLOSE") return "border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-400";
  if (d === "BEARISH_RESEARCH_ONLY") return "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-400";
  return "border-zinc-500/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
}

const EMPTY_FILTERS = { q: "", symbol: "", decision: "", from: "", to: "", provider: "", promptVersion: "", cohort: "", freshness: "", validationStatus: "", evidenceCompleteness: "", includeMock: false };

export function LlmSignalsView() {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, k === "includeMock" ? "1" : String(v));
    });
    return p;
  }, [filters]);

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    setErr(null);
    try {
      const p = new URLSearchParams(qs);
      p.set("page", String(pg));
      p.set("pageSize", "25");
      const r = await fetch(`/api/llm-signals?${p}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const openDetail = useCallback(async (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/llm-signals/${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setDetail(j);
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const setF = (k: keyof typeof EMPTY_FILTERS, v: string | boolean) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const rr = detail?.signal.riskReward ?? null;
  const out = detail?.signal.llmOutput ?? null;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
        SHADOW / RESEARCH ONLY — NOT AN ORDER
      </div>
      <div>
        <h1 className="text-xl font-semibold">LLM Signals — complete decision history</h1>
        <p className="text-xs text-muted-foreground">
          Every persisted GLM-4.6 research decision: BUY, HOLD, NO_TRADE, llm_unavailable, rejected and stale-evidence
          records. Times shown in Pakistan time (PKT). Records are append-only and immutable.
          {data?.facets.lastUpdatedAt ? ` Last decision: ${pkt(data.facets.lastUpdatedAt)}.` : ""}
        </p>
      </div>

      {/* filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="min-w-[9rem] flex-1">
            <label className="text-[11px] text-muted-foreground">Search symbol / company</label>
            <Input value={filters.q} onChange={(e) => setF("q", e.target.value)} placeholder="e.g. HUBC or Hubco" className="h-8" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Decision</label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={filters.decision} onChange={(e) => setF("decision", e.target.value)}>
              <option value="">All</option>
              {["BUY", "HOLD", "NO_TRADE", "SELL_TO_CLOSE", "BEARISH_RESEARCH_ONLY", "llm_unavailable"].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">From (UTC date)</label>
            <Input type="date" className="h-8 w-[9.5rem]" value={filters.from} onChange={(e) => setF("from", e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">To (UTC date)</label>
            <Input type="date" className="h-8 w-[9.5rem]" value={filters.to} onChange={(e) => setF("to", e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Provider/model</label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={filters.provider} onChange={(e) => setF("provider", e.target.value)}>
              <option value="">All</option>
              {(data?.facets.providers ?? []).map((p) => <option key={p} value={p.split("/")[0]}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Freshness</label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={filters.freshness} onChange={(e) => setF("freshness", e.target.value)}>
              <option value="">All</option>
              <option value="fresh">fresh</option>
              <option value="stale">stale</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Validation</label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={filters.validationStatus} onChange={(e) => setF("validationStatus", e.target.value)}>
              <option value="">All</option>
              <option value="valid">valid</option>
              <option value="rejected">rejected</option>
              <option value="llm_unavailable">llm_unavailable</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Evidence</label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={filters.evidenceCompleteness} onChange={(e) => setF("evidenceCompleteness", e.target.value)}>
              <option value="">All</option>
              <option value="complete">complete</option>
              <option value="partial">partial</option>
              <option value="missing">missing</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Cohort</label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={filters.cohort} onChange={(e) => setF("cohort", e.target.value)}>
              <option value="">All</option>
              {(data?.facets.cohorts ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={filters.includeMock} onChange={(e) => setF("includeMock", e.target.checked)} />
            include mock pipeline checks
          </label>
          <button
            className="h-8 rounded-md border px-3 text-xs hover:bg-muted"
            onClick={() => { setFilters({ ...EMPTY_FILTERS }); setPage(1); }}
          >
            Reset
          </button>
          <div className="flex gap-1">
            <a className="h-8 rounded-md border px-3 text-xs leading-8 hover:bg-muted" href={`/api/llm-signals/export?format=csv&${qs}`}>CSV</a>
            <a className="h-8 rounded-md border px-3 text-xs leading-8 hover:bg-muted" href={`/api/llm-signals/export?format=json&${qs}`}>JSON</a>
          </div>
        </CardContent>
      </Card>

      {/* states */}
      {loading && <p className="text-sm text-muted-foreground">Loading signal history…</p>}
      {err && <p className="text-sm text-rose-600">API failure: {err} — no decisions are hidden or fabricated while the API is unavailable.</p>}
      {!loading && !err && data && data.total === 0 && (
        <p className="text-sm text-muted-foreground">No signals match the current filters. Adjust the filters or reset them.</p>
      )}

      {/* table */}
      {!loading && !err && data && data.total > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{data.total} records</span>
              {Object.entries(data.facets.decisions).map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[10px]">{k}: {v}</Badge>
              ))}
              {Object.entries(data.facets.states).filter(([k]) => k !== "ok").map(([k, v]) => (
                <Badge key={k} variant="outline" className="text-[10px] border-amber-500/50">{k}: {v}</Badge>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1.5 pr-2">Symbol</th>
                    <th className="pr-2">Company</th>
                    <th className="pr-2">Decision</th>
                    <th className="pr-2">Decided (PKT)</th>
                    <th className="pr-2">Evidence as-of</th>
                    <th className="pr-2">Age</th>
                    <th className="pr-2">Model</th>
                    <th className="pr-2">Prompt</th>
                    <th className="pr-2">Cohort</th>
                    <th className="pr-2">Validation</th>
                    <th className="pr-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r) => (
                    <tr key={r.signalId} className="cursor-pointer border-b border-border/50 hover:bg-muted/40" onClick={() => openDetail(r.signalId)}>
                      <td className="py-1.5 pr-2 font-semibold">{r.symbol}</td>
                      <td className="max-w-[10rem] truncate pr-2" title={r.companyName ?? ""}>{r.companyName ?? "—"}</td>
                      <td className="pr-2"><Badge variant="outline" className={decisionBadge(r)}>{r.mockRecord ? "MOCK" : r.decision ?? r.llmState}</Badge></td>
                      <td className="whitespace-nowrap pr-2">{pkt(r.decisionTimestamp)}</td>
                      <td className="whitespace-nowrap pr-2">{r.dataCutoff ?? "—"}</td>
                      <td className="pr-2">{ageOf(r.dataCutoff)}</td>
                      <td className="whitespace-nowrap pr-2">{r.provider}/{r.model}</td>
                      <td className="whitespace-nowrap pr-2">{r.promptVersion ?? "—"}</td>
                      <td className="max-w-[10rem] truncate pr-2" title={r.forwardCohortId ?? ""}>{r.forwardCohortId ?? "—"}</td>
                      <td className="pr-2">{r.validationStatus}</td>
                      <td className="pr-2">{r.researchStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Page {data.page} / {data.pages}</span>
              <div className="flex gap-1">
                <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* detail drawer */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailId(null)}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-background p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Signal detail</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setDetailId(null)}>Close</button>
            </div>
            {detailLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {detailErr && <p className="text-sm text-rose-600">{detailErr}</p>}
            {detail && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={decisionBadge(detail.signal)}>{detail.signal.mockRecord ? "MOCK" : detail.signal.decision ?? detail.signal.llmState}</Badge>
                  <span className="font-semibold">{detail.signal.symbol}</span>
                  <span className="text-xs text-muted-foreground">{detail.signal.companyName}</span>
                  <Badge variant="outline" className="border-amber-500/50 text-[10px]">{detail.freshness}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Decided: <b>{pkt(detail.signal.decisionTimestamp)}</b></div>
                  <div>Evidence as-of: <b>{detail.signal.dataCutoff ?? "—"}</b> ({ageOf(detail.signal.dataCutoff)})</div>
                  <div>Provider: <b>{detail.signal.provider}/{detail.signal.model}</b></div>
                  <div>Prompt: <b>{detail.signal.promptVersion ?? "—"}</b></div>
                  <div>Evidence schema: <b>{detail.signal.evidenceSchemaVersion ?? "—"}</b></div>
                  <div>Evidence hash: <b className="break-all">{detail.signal.evidenceHash ?? "—"}</b></div>
                  <div>Forward cohort: <b>{detail.signal.forwardCohortId ?? "—"}</b></div>
                  <div>Risk policy: <b>{detail.signal.riskPolicyVersion ?? "—"}</b></div>
                </div>

                {detail.signal.llmState !== "ok" && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                    <b>llm_unavailable / rejected:</b> {detail.signal.rejectionReason ?? detail.signal.llmFailureReason ?? "unknown"}
                    {detail.signal.parseErrors?.length ? <div>validation errors: {detail.signal.parseErrors.join(", ")}</div> : null}
                    <div className="mt-1">No signal was fabricated; no technical rule was substituted for the LLM.</div>
                  </div>
                )}

                {out && (
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-sm">LLM analysis</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      <p className="leading-relaxed">{detail.signal.finalSignalReason}</p>
                      {out.bullish_evidence?.length ? <div><b className="text-emerald-600">Positive evidence:</b> <ul className="list-disc pl-4">{out.bullish_evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
                      {out.bearish_evidence?.length ? <div><b className="text-rose-600">Negative evidence:</b> <ul className="list-disc pl-4">{out.bearish_evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
                      {out.conflicting_evidence?.length ? <div><b>Conflicting:</b> {out.conflicting_evidence.join(" · ")}</div> : null}
                      {out.missing_evidence?.length ? <div><b className="text-muted-foreground">Missing (never fabricated):</b> {out.missing_evidence.join(" · ")}</div> : null}
                      {out.main_risks?.length ? <div><b>Main risks:</b> {out.main_risks.join(" · ")}</div> : null}
                      {out.invalidation_conditions?.length ? <div><b>Invalidation:</b> {out.invalidation_conditions.join(" · ")}</div> : null}
                      {out.limitations?.length ? <div className="text-muted-foreground"><b>Limitations:</b> {out.limitations.join(" · ")}</div> : null}
                      <div className="text-muted-foreground">Sources cited: {out.source_references?.join(", ") || "—"}</div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md border p-2 text-xs">
                    <div className="text-muted-foreground">LLM conviction</div>
                    <div className="text-base font-semibold">{detail.signal.llmConvictionScore ?? "—"}</div>
                    <div className="text-[10px] text-amber-600">Not a calibrated win probability.</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs">
                    <div className="text-muted-foreground">Evidence quality (deterministic)</div>
                    <div className="text-base font-semibold">{detail.signal.evidenceQualityScore ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">engine-computed data-quality score</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs">
                    <div className="text-muted-foreground">Calibrated net-positive probability</div>
                    <div className="text-base font-semibold">Not available</div>
                    <div className="text-[10px] text-muted-foreground">insufficient matured forward outcomes</div>
                  </div>
                </div>

                {detail.evidence?.technicalEvidence && (
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Technical evidence (same platform functions)</CardTitle></CardHeader>
                    <CardContent className="text-xs">
                      <p>{detail.evidence.technicalEvidence.summary}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {detail.evidence.technicalEvidence.metrics.filter((m) => ["sma7", "sma30", "atr14", "realized_vol_20d_ann_pct", "bbw_20_2_pct"].includes(m.name)).map((m) => (
                          <span key={m.name} className="rounded border px-1.5 py-0.5">{m.name}: <b>{m.value != null ? Number(m.value).toFixed(2) : "—"}</b> <span className="text-muted-foreground">@{m.asOf}</span></span>
                        ))}
                      </div>
                      {detail.evidence.pricePatternEvidence && <p className="mt-1 text-muted-foreground">{detail.evidence.pricePatternEvidence.summary}</p>}
                      {detail.evidence.volatilityContext && <p className="mt-1 text-muted-foreground">{detail.evidence.volatilityContext.summary}</p>}
                    </CardContent>
                  </Card>
                )}

                {detail.evidence?.fundamentalEvidence && (
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Fundamental evidence</CardTitle></CardHeader>
                    <CardContent className="text-xs">
                      <p>{detail.evidence.fundamentalEvidence.summary}</p>
                      <p className="mt-1 text-[10px] text-amber-600">
                        Financial information is CURRENT-ANALYSIS CONTEXT: no verified historical publication timestamp
                        exists, so fundamentals are never used for point-in-time historical claims.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {detail.evidence && (
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-sm">News evidence</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-xs">
                      <p><b>Company:</b> {detail.evidence.companyNewsEvidence?.summary ?? "unavailable"}</p>
                      <p><b>National:</b> {detail.evidence.nationalNewsEvidence?.summary ?? "unavailable"}</p>
                      <p><b>International:</b> {detail.evidence.internationalNewsEvidence?.summary ?? "unavailable"}</p>
                      <div className="text-[11px] text-muted-foreground">
                        <b>Validated sources:</b>
                        <ul className="list-disc pl-4">
                          {(detail.evidence.sourceRefs ?? []).map((s) => (
                            <li key={s.id}>{s.id} — {s.publisher} · published {s.publishedAt ?? "unverified"} · retrieved {s.retrievedAt ? pkt(s.retrievedAt) : "—"}</li>
                          ))}
                        </ul>
                        Only validated source references are shown; citations are never invented.
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!detail.evidence && <p className="text-xs text-muted-foreground">{detail.evidenceNote}</p>}

                {rr && (
                  <Card>
                    <CardHeader className="pb-1"><CardTitle className="text-sm">Deterministic trade-risk panel (hypothetical research levels)</CardTitle></CardHeader>
                    <CardContent className="text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div>Entry ref: <b>{rr.entryReference?.toFixed(2) ?? "—"}</b><div className="text-[10px] text-muted-foreground">{rr.executionAssumption}</div></div>
                        <div>Stop: <b>{rr.stopLoss?.toFixed(2) ?? "—"}</b></div>
                        <div>TP1/2/3: <b>{rr.targets?.tp1?.toFixed(2) ?? "—"} / {rr.targets?.tp2?.toFixed(2) ?? "—"} / {rr.targets?.tp3?.toFixed(2) ?? "—"}</b></div>
                        <div>Net R:R (TP2): <b>{rr.rr_to_tp2 != null ? rr.rr_to_tp2.toFixed(2) : rr.risk_reward_status}</b></div>
                        <div>Whole shares: <b>{rr.positionQty ?? "—"}</b></div>
                        <div>Position value: <b>{rr.positionNotional != null ? Math.round(rr.positionNotional).toLocaleString() : "—"} PKR</b></div>
                        <div>Est. costs (TP2 exit): <b>{rr.costsAtTp2?.total_cost != null ? Math.round(rr.costsAtTp2.total_cost).toLocaleString() + " PKR" : "—"}</b></div>
                        <div>Policy: <b>{detail.signal.riskPolicyVersion ?? "task111"}</b> · {rr.costSchedule?.split(" ")[0]}</div>
                        <div>Gate: <b>{rr.noTrade ? "NO_TRADE" : "pass"}</b></div>
                      </div>
                      {rr.noTradeReasons?.length ? <p className="mt-1 text-amber-600">Risk warnings: {rr.noTradeReasons.join("; ")}</p> : null}
                      {detail.signal.capitalProtection?.triggered?.length ? <p className="text-amber-600">Capital protection: {detail.signal.capitalProtection.triggered.join(", ")}</p> : null}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Hypothetical research levels from the deterministic policy — NOT actual fills or orders. The LLM
                        cannot calculate or override these values.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
