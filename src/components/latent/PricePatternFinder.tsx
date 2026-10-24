"use client";

// Task 47 — Price Pattern Finder (main "Pattern Finder" view)
// Sub-experience 1 (default): PRICE patterns — statistical detectors over the
//   OhlcvBar corpus + LLM layman explanations (/api/price-patterns/[symbol]).
// Sub-experience 2: the original quarterly FINANCIAL pattern finder
//   (src/components/latent/PatternFinder.tsx), still importable + hosted at
//   its own view ("pattern_finder_financial") so its full-screen layout with
//   AppNav stays intact — the tab button just switches the store view.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AppNav } from "./AppNav";
import { StockSearch } from "./StockSearch";
import { PatternFinder } from "./PatternFinder";
import { useLatentStore } from "@/lib/latent/store";
import type {
  PricePatternAnalysis,
  PricePattern,
  SeasonalityMonth,
  KeyZone,
} from "@/lib/latent/price-patterns";
import {
  Search,
  RefreshCw,
  Loader2,
  CalendarDays,
  BarChart3,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ShieldCheck,
  Info,
  AlertTriangle,
  History,
  GitBranch,
} from "lucide-react";
import { toast } from "sonner";

const POPULAR = ["ENGRO", "OGDC", "LUCK", "HUBC", "SYS", "MEBL", "PSO", "PPL"];

const TYPE_META: Record<string, { label: string; color: string }> = {
  seasonality: { label: "Seasonality", color: "#2DD4BF" },
  volume_spike: { label: "Volume", color: "#FBBF24" },
  pressure: { label: "Pressure", color: "#F472B6" },
  key_zone: { label: "Key Zones", color: "#00E676" },
  gap: { label: "Gaps", color: "#A78BFA" },
  drift: { label: "Post-event", color: "#FB923C" },
};

const CONF_META: Record<string, string> = {
  high: "border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]",
  medium: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
  low: "border-white/[0.12] bg-white/[0.05] text-[#94A3B8]",
};

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface LlmSummary {
  overallSummary: string;
  notableObservations: string[];
  patternExplanations: Record<string, string>;
}

type ApiResult = PricePatternAnalysis & {
  companyName?: string;
  llmSummary: LlmSummary | null;
  llmError?: string | null;
  suggestions?: string[];
  cached?: boolean;
  computedAt?: string;
  latencyMs?: number;
};

function fmtPct(n: number, digits = 1): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}%` : `${s}%`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function confidenceOf(occurrences: number): "high" | "medium" | "low" {
  if (occurrences >= 12) return "high";
  if (occurrences >= 6) return "medium";
  return "low";
}

export function PricePatternFinder() {
  const setView = useLatentStore((s) => s.setView);
  const [symbol, setSymbol] = useState<string>("");
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showEvidence, setShowEvidence] = useState(true);
  const reqIdRef = useRef(0);

  const fetchPatterns = useCallback(async (sym: string, force = false) => {
    if (!sym) return;
    const reqId = ++reqIdRef.current;
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/price-patterns/${encodeURIComponent(sym)}${force ? "?refresh=1" : ""}`);
      const json = await res.json();
      if (reqId !== reqIdRef.current) return;
      if (!res.ok) {
        setData(null);
        setError(json?.error || `Could not load patterns for ${sym}`);
        return;
      }
      setData(json as ApiResult);
      if (force) toast.success(`Patterns recomputed for ${sym}`);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      setData(null);
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (symbol) void fetchPatterns(symbol);
  }, [symbol, fetchPatterns]);

  const onSelect = (sym: string) => {
    setSymbol(sym.toUpperCase());
    setData(null);
    setTypeFilter("all");
  };

  const filteredPatterns = useMemo(() => {
    if (!data) return [];
    return typeFilter === "all" ? data.patterns : data.patterns.filter((p) => p.type === typeFilter);
  }, [data, typeFilter]);

  const availableTypes = useMemo(() => {
    const set = new Set((data?.patterns || []).map((p) => p.type));
    return [...set];
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full px-4 md:px-6 py-6 max-w-6xl mx-auto">
        {/* View header + experience switch */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#F4F7FB] flex items-center gap-2">
              <Search className="h-6 w-6 text-[#00E676]" /> Pattern Finder
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Recurring price-history patterns for any PSX stock — monthly seasonality, volume events, key price zones, gaps and post-event behavior, explained in plain English.
            </p>
          </div>
          <div className="flex items-center gap-1 bg-[#131829] border border-white/[0.08] rounded-lg p-1">
            <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#00E676]/10 text-[#00E676]">Price Patterns</span>
            <button
              onClick={() => setView("pattern_finder_financial")}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-white/[0.04] transition-colors"
            >
              Financial Patterns
            </button>
          </div>
        </div>

        {!symbol && <SearchHero onSelect={onSelect} />}

        {symbol && (
          <>
            {/* Stock picker + header row */}
            <Card className="bg-[#131829] border-white/[0.06] mb-5">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5 block">Stock</label>
                    <StockSearch value={symbol} onChange={(s) => s && onSelect(s)} placeholder="Search another stock…" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void fetchPatterns(symbol)}
                      disabled={loading || refreshing}
                      className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#00E676]/85 font-semibold"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                      Analyze
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void fetchPatterns(symbol, true)}
                      disabled={loading || refreshing}
                      className="border-white/[0.12] bg-transparent text-[#F4F7FB] hover:bg-white/[0.05]"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin text-[#00E676]" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </div>

                {loading && (
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-6 w-64 bg-white/[0.06]" />
                    <Skeleton className="h-4 w-96 max-w-full bg-white/[0.06]" />
                  </div>
                )}

                {!loading && data && !data.insufficient && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div>
                      <span className="text-xl font-bold text-[#F4F7FB] font-mono">{data.symbol}</span>
                      <span className="text-sm text-[#94A3B8] ml-2">{data.companyName && data.companyName !== data.symbol ? data.companyName : ""}</span>
                    </div>
                    <Badge variant="outline" className="border-white/[0.12] text-[#94A3B8] gap-1">
                      <History className="h-3 w-3" /> {data.dataStart} → {data.dataEnd} · {data.totalBars.toLocaleString()} trading days
                    </Badge>
                    {data.cached && (
                      <Badge variant="outline" className="border-[#FBBF24]/30 text-[#FBBF24] text-[10px]">
                        cached {data.computedAt ? new Date(data.computedAt).toLocaleString() : ""}
                      </Badge>
                    )}
                    {data.llmSummary && (
                      <Badge className="bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 text-[10px] gap-1">
                        <Sparkles className="h-3 w-3" /> AI explanations
                      </Badge>
                    )}
                    {!data.llmSummary && data.llmError && (
                      <Badge variant="outline" className="border-white/[0.12] text-[#64748B] text-[10px]">engine-only (LLM unavailable — press Refresh to retry)</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {error && <ErrorCard message={error} suggestions={(data as ApiResult | null)?.suggestions || []} onSelect={onSelect} />}

            {loading && <LoadingSkeletons />}

            {!loading && data && data.insufficient && (
              <Card className="bg-[#131829] border-[#FBBF24]/25 mb-5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-[#FBBF24] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-[#F4F7FB] font-medium">Not enough data for {data.symbol}</p>
                      <p className="text-sm text-[#94A3B8] mt-1">{data.message}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(data.suggestions || POPULAR).map((s) => (
                          <button key={s} onClick={() => onSelect(s)} className="px-2.5 py-1 rounded-md text-xs font-mono bg-white/[0.05] border border-white/[0.08] text-[#94A3B8] hover:text-[#00E676] hover:border-[#00E676]/40 transition-colors">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && data && !data.insufficient && (
              <div className="space-y-5">
                {data.llmSummary?.overallSummary && (
                  <Card className="bg-[#131829] border-[#00E676]/20">
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-[#00E676]" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#00E676]">Plain-English overview</span>
                        <span className="text-[10px] text-[#64748B]">(AI summary of the engine's findings — historical observation, not advice)</span>
                      </div>
                      <p className="text-sm text-[#F4F7FB] leading-relaxed">{data.llmSummary.overallSummary}</p>
                      {data.llmSummary.notableObservations.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {data.llmSummary.notableObservations.map((o, i) => (
                            <li key={i} className="text-xs text-[#94A3B8] flex items-start gap-2">
                              <Info className="h-3.5 w-3.5 text-[#FBBF24] shrink-0 mt-0.5" /> {o}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                )}

                {data.patterns.length === 0 ? (
                  <Card className="bg-[#131829] border-white/[0.06]">
                    <CardContent className="p-6 text-sm text-[#94A3B8]">
                      No recurring patterns met the minimum sample size (2+ occurrences) for this stock — its history is likely too short or too irregular. Try a heavily traded symbol like {POPULAR.slice(0, 3).join(", ")}.
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Filters + evidence toggle */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label={`All (${data.patterns.length})`} color="#94A3B8" />
                        {availableTypes.map((t) => (
                          <FilterChip
                            key={t}
                            active={typeFilter === t}
                            onClick={() => setTypeFilter(t)}
                            label={`${TYPE_META[t]?.label ?? t} (${data.patterns.filter((p) => p.type === t).length})`}
                            color={TYPE_META[t]?.color ?? "#94A3B8"}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setShowEvidence((v) => !v)}
                        className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${showEvidence ? "border-[#00E676]/40 text-[#00E676] bg-[#00E676]/10" : "border-white/[0.12] text-[#64748B] hover:text-[#94A3B8]"}`}
                      >
                        Evidence on chart: {showEvidence ? "ON" : "OFF"}
                      </button>
                    </div>

                    {/* Pattern cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {filteredPatterns.map((p) => (
                        <PatternCard key={p.key} pattern={p} llmText={data.llmSummary?.patternExplanations?.[p.key]} />
                      ))}
                    </div>
                    {filteredPatterns.length === 0 && (
                      <p className="text-sm text-[#64748B] text-center py-4">No patterns of this type for {data.symbol}.</p>
                    )}

                    {/* Seasonality heatmap */}
                    {data.seasonality && <SeasonalityHeatmap months={data.seasonality} symbol={data.symbol} />}

                    {/* Price chart with overlays */}
                    <PatternChart data={data} showEvidence={showEvidence} filteredPatterns={filteredPatterns} />

                    {/* Key price zones + pressure/gaps */}
                    {data.keyZones.length > 0 && <KeyZonesPanel zones={data.keyZones} />}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {data.pressure && <PressurePanel data={data.pressure} />}
                      {data.gaps && <GapStatsPanel gaps={data.gaps} />}
                    </div>

                    {data.drift && data.drift.length > 0 && <DriftCards drift={data.drift} />}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Compliance footer (sticky to viewport bottom on short pages) */}
      <footer className="mt-auto w-full border-t border-white/[0.06] bg-[#0D1220]">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#00E676] shrink-0" />
            <span className="text-xs font-medium text-[#F4F7FB]">Historical pattern, informational only, not investment advice</span>
          </div>
          <p className="text-[10px] text-[#64748B] leading-relaxed sm:ml-auto sm:text-right">
            Price-pattern statistics are computed from past PSX trading data (open/close/volume). Past behavior may not repeat. Latent.pk is an analytics tool, not an SECP-licensed investment adviser — consult a licensed adviser before making decisions.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SearchHero({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <Card className="bg-[#131829] border-white/[0.06]">
      <CardContent className="p-6 md:p-8">
        <label className="text-[10px] uppercase tracking-wider text-[#64748B] mb-2 block">Pick a stock to find its recurring price patterns</label>
        <StockSearch value="" onChange={(s) => s && onSelect(s)} placeholder="Search stock by symbol or name…" autoFocus />
        <div className="flex flex-wrap gap-2 mt-4">
          {POPULAR.map((s) => (
            <button key={s} onClick={() => onSelect(s)} className="px-3 py-1.5 rounded-md text-xs font-mono bg-white/[0.05] border border-white/[0.08] text-[#94A3B8] hover:text-[#00E676] hover:border-[#00E676]/40 transition-colors">
              {s}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          {[
            { icon: CalendarDays, title: "Monthly seasonality", desc: "Which calendar months historically moved up or down — and how consistently." },
            { icon: Activity, title: "Volume & pressure events", desc: "Unusual volume days, buying/selling pressure (inferred from price + volume) and what followed." },
            { icon: Layers, title: "Zones, gaps & drift", desc: "Key price zones where closes cluster, gap-fill behavior, and returns after 52-week extremes." },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border border-white/[0.06] bg-[#0D1220] p-4">
              <c.icon className="h-4 w-4 text-[#00E676] mb-2" />
              <p className="text-sm font-medium text-[#F4F7FB]">{c.title}</p>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#64748B] mt-5 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#00E676]" /> Historical pattern, informational only, not investment advice.
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message, suggestions, onSelect }: { message: string; suggestions: string[]; onSelect: (s: string) => void }) {
  return (
    <Card className="bg-[#131829] border-[#FF5C5C]/30 mb-5">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[#FF5C5C] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[#F4F7FB] font-medium">{message}</p>
            {suggestions.length > 0 && (
              <>
                <p className="text-xs text-[#64748B] mt-1">Try one of these heavily traded symbols:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => onSelect(s)} className="px-2.5 py-1 rounded-md text-xs font-mono bg-white/[0.05] border border-white/[0.08] text-[#94A3B8] hover:text-[#00E676] hover:border-[#00E676]/40 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeletons() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="bg-[#131829] border-white/[0.06]">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-40 bg-white/[0.06]" />
              <Skeleton className="h-3 w-full bg-white/[0.06]" />
              <Skeleton className="h-3 w-4/5 bg-white/[0.06]" />
              <Skeleton className="h-2 w-full bg-white/[0.06]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-[#131829] border-white/[0.06]">
        <CardContent className="p-4">
          <Skeleton className="h-40 w-full bg-white/[0.06]" />
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 ${active ? "bg-white/[0.08] text-[#F4F7FB] border-white/[0.2]" : "border-white/[0.08] text-[#64748B] hover:text-[#94A3B8]"}`}
    >
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </button>
  );
}

function PatternCard({ pattern: p, llmText }: { pattern: PricePattern; llmText?: string }) {
  const meta = TYPE_META[p.type] ?? { label: p.type, color: "#94A3B8" };
  const barColor = p.success_rate >= 60 ? "#00E676" : p.success_rate >= 40 ? "#FBBF24" : "#FF5C5C";
  const positive = p.avg_move_pct >= 0;
  const desc = llmText || p.description;
  return (
    <Card className="bg-[#131829] border-white/[0.06] hover:border-white/[0.12] transition-colors">
      <CardContent className="p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] gap-1 border-white/[0.12]" style={{ color: meta.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </Badge>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${CONF_META[p.confidence]}`}>
              {p.confidence} confidence
            </Badge>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#F4F7FB] leading-snug">{p.title}</h3>
          <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">{desc}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-[#0D1220] border border-white/[0.05] px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-[#64748B]">Sample size</p>
            <p className="text-sm font-semibold text-[#F4F7FB]">{p.occurrences} <span className="text-[10px] font-normal text-[#64748B]">events</span></p>
          </div>
          <div className="rounded-md bg-[#0D1220] border border-white/[0.05] px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-[#64748B]">Years seen</p>
            <p className="text-sm font-semibold text-[#F4F7FB]">{p.years_seen}</p>
          </div>
          <div className="rounded-md bg-[#0D1220] border border-white/[0.05] px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-wider text-[#64748B]">Avg move</p>
            <p className={`text-sm font-semibold ${positive ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>{fmtPct(p.avg_move_pct)}</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-[#64748B] mb-1">
            <span>How often it worked</span>
            <span className="font-semibold" style={{ color: barColor }}>{p.success_rate.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, Math.min(100, p.success_rate))}%`, backgroundColor: barColor }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-auto pt-1 border-t border-white/[0.05]">
          <span>Period: {p.period}</span>
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-[#00E676]" /> Historical pattern — informational only</span>
        </div>
      </CardContent>
    </Card>
  );
}

function seasonalityColor(avg: number, positive: boolean): string {
  const intensity = Math.min(0.55, Math.max(0.1, Math.abs(avg) / 5));
  return positive ? `rgba(0, 230, 118, ${intensity.toFixed(2)})` : `rgba(255, 92, 92, ${intensity.toFixed(2)})`;
}

function SeasonalityHeatmap({ months, symbol }: { months: SeasonalityMonth[]; symbol: string }) {
  const flagged = months.filter((m) => m.flagged);
  return (
    <Card className="bg-[#131829] border-white/[0.06]">
      <CardHeader className="pb-3 px-4 md:px-5 pt-4">
        <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[#2DD4BF]" /> Monthly seasonality — {symbol}
          <span className="text-[10px] font-normal text-[#64748B]">(avg close-to-close return per calendar month, all years)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-5 pb-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {months.map((m) => {
            const positive = m.avgReturnPct >= 0;
            return (
              <div
                key={m.month}
                className={`rounded-lg border p-2.5 text-center ${m.flagged ? "border-[#00E676]/70 ring-1 ring-[#00E676]/50" : "border-white/[0.06]"}`}
                style={{ backgroundColor: m.samples ? seasonalityColor(m.avgReturnPct, positive) : "rgba(255,255,255,0.02)" }}
                title={m.samples ? `${MONTH_ABBR[m.month]}: avg ${fmtPct(m.avgReturnPct)}, positive in ${Math.round((m.winRate / 100) * m.samples)} of ${m.samples} years` : "No data"}
              >
                <p className="text-[10px] font-semibold text-[#F4F7FB]">{MONTH_ABBR[m.month]}</p>
                <p className={`text-xs font-bold mt-0.5 ${m.samples ? (positive ? "text-[#EAFFEF]" : "text-[#FFE9E9]") : "text-[#64748B]"}`}>
                  {m.samples ? fmtPct(m.avgReturnPct) : "—"}
                </p>
                <p className="text-[9px] text-[#F4F7FB]/70 mt-0.5">{m.samples ? `win ${m.winRate.toFixed(0)}%` : ""}</p>
                <p className="text-[9px] text-[#F4F7FB]/60">n={m.samples}</p>
                {m.flagged && <p className="text-[8px] font-semibold text-[#00E676] mt-1 uppercase tracking-wide">recurring</p>}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-[#64748B]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "rgba(0,230,118,0.45)" }} /> positive avg month</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "rgba(255,92,92,0.45)" }} /> negative avg month</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm ring-1 ring-[#00E676]" /> recurring (same direction in ≥4 of last 5 years)</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chart ────────────────────────────────────────────────────────────────────

const VB_W = 1000;
const VB_H = 340;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

function PatternChart({
  data,
  showEvidence,
  filteredPatterns,
}: {
  data: ApiResult;
  showEvidence: boolean;
  filteredPatterns: PricePattern[];
}) {
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chart = data.chart;

  const model = useMemo(() => {
    if (chart.length < 2) return null;
    const closes = chart.map((c) => c.close);
    let min = Math.min(...closes);
    let max = Math.max(...closes);
    const zones = (data.keyZones || []).slice(0, 5).map((z) => ({ ...z, show: z.high >= min && z.low <= max }));
    for (const z of zones) {
      if (z.show) {
        min = Math.min(min, z.low);
        max = Math.max(max, z.high);
      }
    }
    const pad = (max - min) * 0.05 || 1;
    min -= pad;
    max += pad;
    const plotW = VB_W - PAD.left - PAD.right;
    const plotH = VB_H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (i / (chart.length - 1)) * plotW;
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;
    const line = chart.map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(c.close).toFixed(2)}`).join(" ");
    const area = `${line} L${x(chart.length - 1).toFixed(2)},${(VB_H - PAD.bottom).toFixed(2)} L${PAD.left},${(VB_H - PAD.bottom).toFixed(2)} Z`;
    const dateIdx = new Map<string, number>();
    chart.forEach((c, i) => dateIdx.set(c.date, i));
    const evidencePatterns = filteredPatterns
      .filter((p) => showEvidence && p.evidence_dates.length > 0)
      .slice(0, 3)
      .map((p) => ({
        pattern: p,
        color: TYPE_META[p.type]?.color ?? "#94A3B8",
        points: p.evidence_dates
          .map((d) => {
            const i = dateIdx.get(d);
            return i !== undefined ? { i, x: x(i), y: y(chart[i].close) } : null;
          })
          .filter((v): v is { i: number; x: number; y: number } => v !== null),
      }))
      .filter((g) => g.points.length > 0);
    const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
    return { min, max, x, y, line, area, zones, evidencePatterns, gridValues, plotW, plotH, dateIdx };
  }, [chart, data.keyZones, filteredPatterns, showEvidence]);

  if (!model || chart.length < 2) return null;

  const xLabelIdxs = [0, Math.floor(chart.length * 0.2), Math.floor(chart.length * 0.4), Math.floor(chart.length * 0.6), Math.floor(chart.length * 0.8), chart.length - 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((e.clientX - rect.left) / rect.width) * VB_W;
    const frac = (vx - PAD.left) / model.plotW;
    const i = Math.round(frac * (chart.length - 1));
    if (i >= 0 && i < chart.length) setHover({ i, x: model.x(i) });
  };

  const hoverPoint = hover ? chart[hover.i] : null;

  return (
    <Card className="bg-[#131829] border-white/[0.06]">
      <CardHeader className="pb-2 px-4 md:px-5 pt-4">
        <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2 flex-wrap">
          <GitBranch className="h-4 w-4 text-[#00E676]" /> Price history with pattern overlays
          <span className="text-[10px] font-normal text-[#64748B]">daily closes (last ~2 years) · green bands = key price zones · dots = pattern evidence dates</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 md:px-3 pb-4">
        <div className="overflow-x-auto custom-scroll">
          <div className="min-w-[720px] relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="w-full h-auto select-none"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              role="img"
              aria-label={`Daily closing price for ${data.symbol} with key price zones and pattern evidence markers`}
            >
              <defs>
                <linearGradient id="ppArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E676" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Key price zone bands */}
              {model.zones.filter((z) => z.show).map((z, idx) => {
                const yTop = model.y(z.high);
                const yBot = model.y(z.low);
                return (
                  <g key={`zone-${idx}`}>
                    <rect x={PAD.left} y={yTop} width={VB_W - PAD.left - PAD.right} height={Math.max(2, yBot - yTop)} fill="#00E676" opacity="0.07" />
                    <line x1={PAD.left} x2={VB_W - PAD.right} y1={yTop} y2={yTop} stroke="#00E676" strokeOpacity="0.25" strokeDasharray="4 4" strokeWidth="1" />
                    <line x1={PAD.left} x2={VB_W - PAD.right} y1={yBot} y2={yBot} stroke="#00E676" strokeOpacity="0.25" strokeDasharray="4 4" strokeWidth="1" />
                    <text x={VB_W - PAD.right - 4} y={yTop + 11} textAnchor="end" fontSize="9" fill="#00E676" opacity="0.85">
                      zone Rs.{z.low.toFixed(0)}-{z.high.toFixed(0)} · {z.touches} touches
                    </text>
                  </g>
                );
              })}

              {/* Grid + y labels */}
              {model.gridValues.map((v, i) => (
                <g key={`grid-${i}`}>
                  <line x1={PAD.left} x2={VB_W - PAD.right} y1={model.y(v)} y2={model.y(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  <text x={PAD.left - 6} y={model.y(v) + 3} textAnchor="end" fontSize="10" fill="#64748B">
                    {v.toFixed(v >= 1000 ? 0 : 1)}
                  </text>
                </g>
              ))}

              {/* Price area + line */}
              <path d={model.area} fill="url(#ppArea)" />
              <path d={model.line} fill="none" stroke="#00E676" strokeWidth="1.6" strokeLinejoin="round" />

              {/* Evidence markers */}
              {model.evidencePatterns.map((g, gi) => (
                <g key={`ev-${gi}`}>
                  {g.points.map((pt, pi) => (
                    <circle key={pi} cx={pt.x} cy={pt.y} r="3.2" fill={g.color} stroke="#0A0E1A" strokeWidth="1" opacity="0.9" />
                  ))}
                </g>
              ))}

              {/* X labels */}
              {xLabelIdxs.map((i) => (
                <text key={`x-${i}`} x={model.x(i)} y={VB_H - 8} textAnchor="middle" fontSize="10" fill="#64748B">
                  {chart[i].date.slice(0, 7)}
                </text>
              ))}

              {/* Hover guide */}
              {hover && (
                <g>
                  <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={VB_H - PAD.bottom} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                  <circle cx={hover.x} cy={model.y(chart[hover.i].close)} r="3.5" fill="#F4F7FB" stroke="#0A0E1A" strokeWidth="1" />
                </g>
              )}
            </svg>

            {hover && hoverPoint && (
              <div
                className="absolute pointer-events-none bg-[#0A0E1A] border border-white/[0.12] rounded-md px-2.5 py-1.5 text-[10px] shadow-xl z-10"
                style={{ left: `${(hover.x / VB_W) * 100}%`, top: 8, transform: "translateX(-50%)" }}
              >
                <p className="text-[#64748B] font-mono">{hoverPoint.date}</p>
                <p className="text-[#F4F7FB] font-semibold">Rs. {hoverPoint.close.toFixed(2)}</p>
                <p className="text-[#64748B]">vol {fmtNum(hoverPoint.volume)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        {model.evidencePatterns.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-2 px-2">
            {model.evidencePatterns.map((g, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                {g.pattern.title.length > 44 ? `${g.pattern.title.slice(0, 44)}…` : g.pattern.title}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[#64748B] mt-2 px-2">
          Zones are computed from close-price clustering over the last 3 years; markers show the most recent dates where the top detected patterns manifested. Hover for daily detail.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Panels ───────────────────────────────────────────────────────────────────

function KeyZonesPanel({ zones }: { zones: KeyZone[] }) {
  return (
    <Card className="bg-[#131829] border-white/[0.06]">
      <CardHeader className="pb-3 px-4 md:px-5 pt-4">
        <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#00E676]" /> Key price zones
          <span className="text-[10px] font-normal text-[#64748B]">(price bands where closing prices clustered most often — last 3 years)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-5 pb-4">
        <div className="max-h-80 overflow-y-auto custom-scroll pr-1 space-y-2">
          {zones.map((z, i) => (
            <div key={i} className="rounded-lg border border-white/[0.06] bg-[#0D1220] p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-mono font-semibold text-[#F4F7FB]">Rs. {z.low.toFixed(2)} – {z.high.toFixed(2)}</span>
                <Badge variant="outline" className="text-[10px] border-[#00E676]/30 text-[#00E676]">{z.touches} touches</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-center">
                <div><p className="text-[9px] uppercase tracking-wider text-[#64748B]">Visits</p><p className="text-xs font-semibold text-[#F4F7FB]">{z.visits}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-[#64748B]">Moved up & away</p><p className="text-xs font-semibold text-[#00E676]">{z.bounces}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-[#64748B]">Moved down through</p><p className="text-xs font-semibold text-[#FF5C5C]">{z.rejections}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-[#64748B]">Touch-day volume</p><p className="text-xs font-semibold text-[#F4F7FB]">{z.volumeVsAvg >= 1 ? `+${Math.round((z.volumeVsAvg - 1) * 100)}%` : `−${Math.round((1 - z.volumeVsAvg) * 100)}%`} vs normal</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#64748B] mt-3">Zones are statistical clusters of past closing prices — a historical observation, not a prediction of where the price will stop.</p>
      </CardContent>
    </Card>
  );
}

interface PressureSummaryUi {
  buyingDays: number;
  sellingDays: number;
  buyingAvgNext5Pct: number;
  sellingAvgNext5Pct: number;
  buyingHitRate: number;
  sellingHitRate: number;
  recentBuying: { date: string; volumeRatio: number; dayMovePct: number; next5MovePct: number | null }[];
  recentSelling: { date: string; volumeRatio: number; dayMovePct: number; next5MovePct: number | null }[];
}

function PressurePanel({ data: p }: { data: PressureSummaryUi }) {
  const rows = [
    { kind: "buying" as const, icon: ArrowUpRight, color: "#00E676", days: p.buyingDays, avg: p.buyingAvgNext5Pct, hit: p.buyingHitRate, recent: p.recentBuying, label: "Buying pressure", sub: "heavy volume + price flat or up" },
    { kind: "selling" as const, icon: ArrowDownRight, color: "#FF5C5C", days: p.sellingDays, avg: p.sellingAvgNext5Pct, hit: p.sellingHitRate, recent: p.recentSelling, label: "Selling pressure", sub: "heavy volume + price flat or down" },
  ];
  return (
    <Card className="bg-[#131829] border-white/[0.06]">
      <CardHeader className="pb-3 px-4 md:px-5 pt-4">
        <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#F472B6]" /> Buying / selling pressure
          <span className="text-[10px] font-normal text-[#64748B]">(inferred from price + volume)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-5 pb-4 space-y-3">
        {rows.map((r) => (
          <div key={r.kind} className="rounded-lg border border-white/[0.06] bg-[#0D1220] p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className={`text-sm font-medium flex items-center gap-1.5 ${r.kind === "buying" ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                <r.icon className="h-4 w-4" /> {r.label}
              </span>
              <span className="text-[10px] text-[#64748B]">{r.days} days ({r.sub})</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-center">
              <div><p className="text-[9px] uppercase tracking-wider text-[#64748B]">Avg next-5-day move</p><p className={`text-sm font-semibold ${r.avg >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>{fmtPct(r.avg)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-[#64748B]">Followed through</p><p className="text-sm font-semibold text-[#F4F7FB]">{r.hit.toFixed(0)}%</p></div>
            </div>
            {r.recent.length > 0 && (
              <p className="text-[10px] text-[#64748B] mt-2">
                Recent: {r.recent.slice(0, 4).map((d) => d.date).join(" · ")}
              </p>
            )}
          </div>
        ))}
        <p className="text-[10px] text-[#64748B]">Pressure days = volume ≥30% above its recent norm. This is a price + volume inference, not a confirmation of actual buyer/seller activity.</p>
      </CardContent>
    </Card>
  );
}

function GapStatsPanel({ gaps }: { gaps: NonNullable<PricePatternAnalysis["gaps"]> }) {
  const cells = [
    { label: "Gap-up openings", value: String(gaps.gapUps), sub: `avg gap ${fmtPct(gaps.avgGapUpPct)}`, color: "#00E676" },
    { label: "Gap-up fill rate", value: `${gaps.gapUpFillRate.toFixed(0)}%`, sub: `${gaps.gapUpFilled} of ${gaps.gapUps} filled`, color: "#F4F7FB" },
    { label: "Gap-down openings", value: String(gaps.gapDowns), sub: `avg gap ${fmtPct(gaps.avgGapDownPct)}`, color: "#FF5C5C" },
    { label: "Gap-down fill rate", value: `${gaps.gapDownFillRate.toFixed(0)}%`, sub: `${gaps.gapDownFilled} of ${gaps.gapDowns} filled`, color: "#F4F7FB" },
  ];
  return (
    <Card className="bg-[#131829] border-white/[0.06]">
      <CardHeader className="pb-3 px-4 md:px-5 pt-4">
        <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#A78BFA]" /> Gap behavior
          <span className="text-[10px] font-normal text-[#64748B]">(|open vs prior close| ≥ 0.5%)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 md:px-5 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {cells.map((c) => (
            <div key={c.label} className="rounded-lg border border-white/[0.06] bg-[#0D1220] p-3 text-center">
              <p className="text-[9px] uppercase tracking-wider text-[#64748B]">{c.label}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: c.color }}>{c.value}</p>
              <p className="text-[9px] text-[#64748B]">{c.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#64748B] mt-3">"Filled" = the closing price returned to the pre-gap close within {gaps.windowDays} trading days (close-based check).</p>
      </CardContent>
    </Card>
  );
}

function DriftCards({ drift }: { drift: NonNullable<PricePatternAnalysis["drift"]> }) {
  const titles: Record<string, string> = {
    volume_spike: "After a heavy-volume day",
    high_52w: "After a 52-week-high close",
    low_52w: "After a 52-week-low close",
  };
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2 mb-3">
        <GitBranch className="h-4 w-4 text-[#FB923C]" /> Post-event drift
        <span className="text-[10px] font-normal text-[#64748B]">(average price path after historical events — observation, not advice)</span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {drift.map((d) => (
          <Card key={d.trigger} className="bg-[#131829] border-white/[0.06]">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-[#F4F7FB]">{titles[d.trigger]}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5">{d.count} occurrences</p>
              <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                <div className="rounded-md bg-[#0D1220] border border-white/[0.05] py-2">
                  <p className="text-[9px] uppercase tracking-wider text-[#64748B]">Next 5 days</p>
                  <p className={`text-sm font-bold ${d.avg5dPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>{fmtPct(d.avg5dPct)}</p>
                  <p className="text-[9px] text-[#64748B]">up {d.hit5d.toFixed(0)}% of time</p>
                </div>
                <div className="rounded-md bg-[#0D1220] border border-white/[0.05] py-2">
                  <p className="text-[9px] uppercase tracking-wider text-[#64748B]">Next 20 days</p>
                  <p className={`text-sm font-bold ${d.avg20dPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>{fmtPct(d.avg20dPct)}</p>
                  <p className="text-[9px] text-[#64748B]">up {d.hit20d.toFixed(0)}% of time</p>
                </div>
              </div>
              <p className="text-[9px] text-[#64748B] mt-2">Historical pattern — informational only</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Financial patterns tab lives at its own full-screen view (reuses the
// original component untouched, including its own AppNav).
export { PatternFinder as FinancialPatternFinder };
