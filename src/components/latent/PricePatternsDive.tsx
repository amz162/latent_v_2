"use client";

// ============================================================================
// Tab 2 — Company Stock Pattern (Price Pattern Finder).
// Per-stock statistical price patterns computed from (date, open, close,
// volume) ONLY — no indicators, no candlesticks, no intraday range.
//
// UI per spec:
//   * pattern cards sorted by confidence (sample size always visible,
//     never fewer than 2 occurrences)
//   * chart overlay of evidence dates for the selected pattern
//   * key price zones drawn on the chart (NEVER called support/resistance)
//   * monthly seasonality heatmap
//   * "how often it worked" bar per pattern
//   * unusual historical events + AI-reviewed notes (from the same data)
// Everything is labelled "Historical pattern, informational only, not
// investment advice".
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type {
  PricePatternReportResponse,
  PriceZone,
  SeasonalityInfo,
  StatPattern,
} from "@/lib/latent/price-patterns";
import {
  ArrowLeft,
  ShieldAlert,
  Database,
  Clock,
  Sparkles,
  ChevronDown,
  Layers,
  Zap,
  History,
  Info,
  Eye,
  CalendarDays,
  Activity,
  Sigma,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────
// shared bits
// ──────────────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string }> = {
  seasonality: { label: "Seasonality", color: "#00E676" },
  volume_spike_up: { label: "Volume surge · up day", color: "#FBBF24" },
  volume_spike_down: { label: "Volume surge · down day", color: "#FB923C" },
  accumulation: { label: "Buying pressure", color: "#10B981" },
  distribution: { label: "Selling pressure", color: "#F87171" },
  price_zone: { label: "Key price zone", color: "#94A3B8" },
  gap_up: { label: "Gap-up behaviour", color: "#2DD4BF" },
  gap_down: { label: "Gap-down behaviour", color: "#14B8A6" },
  post_52w_high: { label: "Post 52-week high", color: "#C084FC" },
  post_52w_low: { label: "Post 52-week low", color: "#A78BFA" },
};

const CONF_META: Record<string, { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "border-[#00E676]/40 text-[#00E676] bg-[#00E676]/10" },
  medium: { label: "Medium confidence", cls: "border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/10" },
  low: { label: "Low confidence", cls: "border-white/20 text-[#94A3B8] bg-white/5" },
};

const CONF_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const SCROLLBAR = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent";

const fmtRs = (v: number) => `Rs. ${v >= 100 ? v.toFixed(0) : v.toFixed(2)}`;
const fmtSigned = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const fmtSigned1 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ──────────────────────────────────────────────────────────────────────────
// main component
// ──────────────────────────────────────────────────────────────────────────

export function PricePatternsDive({
  data,
  onBack,
}: {
  data: PricePatternReportResponse;
  onBack: () => void;
}) {
  // defensive client-side guard: ≥2 occurrences, confidence-sorted
  const patterns = useMemo(
    () =>
      data.patterns
        .filter((p) => p.occurrences >= 2)
        .sort(
          (a, b) =>
            CONF_RANK[a.confidence] - CONF_RANK[b.confidence] || b.occurrences - a.occurrences
        ),
    [data]
  );

  const [selectedId, setSelectedId] = useState<string | null>(patterns[0]?.id ?? null);
  const [showZones, setShowZones] = useState(true);
  const [showAllMarkers, setShowAllMarkers] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // NOTE: when the symbol changes, PatternFinder remounts this component
  // (key={data.symbol}), so all of this state resets automatically — no
  // state-resetting effect needed.

  const selected = patterns.find((p) => p.id === selectedId) ?? null;

  const markerColor = TYPE_META[selected?.type ?? ""]?.color ?? "#FBBF24";
  const markerDates = useMemo(() => {
    const all = showAllMarkers
      ? patterns.flatMap((p) => p.evidence_dates)
      : selected?.evidence_dates ?? [];
    return all.slice(0, 800);
  }, [showAllMarkers, selected, patterns]);

  const counts = useMemo(
    () => ({
      high: patterns.filter((p) => p.confidence === "high").length,
      medium: patterns.filter((p) => p.confidence === "medium").length,
      low: patterns.filter((p) => p.confidence === "low").length,
    }),
    [patterns]
  );

  const scrollToChart = () =>
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <Card className="bg-[#131829] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                  className="h-7 px-2 text-xs border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="font-mono text-xl font-bold text-[#F4F7FB]">{data.symbol}</span>
                <span className="text-sm text-[#94A3B8] truncate">— {data.company}</span>
                <Badge
                  variant="outline"
                  className="text-[9px] border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/[0.06]"
                >
                  PRICE PATTERNS
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] text-[#94A3B8]">
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3 w-3 text-[#00E676]" />
                  {data.coverage.bars.toLocaleString()} trading days
                </span>
                <span className="text-[#3B4354]">·</span>
                <span>
                  {data.coverage.firstDate} → {data.coverage.lastDate} ({data.coverage.years} yrs)
                </span>
                <span className="text-[#3B4354]">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(data.computedAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                {data.cached ? (
                  <Badge variant="outline" className="text-[9px] border-[#00E676]/40 text-[#00E676] bg-[#00E676]/[0.06]">
                    <Database className="h-2.5 w-2.5 mr-0.5" />
                    From precomputed database cache
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/[0.06]">
                    Freshly computed just now
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-[#F4F7FB]">{patterns.length}</div>
              <div className="text-[10px] text-[#64748B] uppercase tracking-wide">patterns found</div>
              <div className="text-[10px] text-[#94A3B8] mt-1">
                {counts.high} high · {counts.medium} med · {counts.low} low
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECP-style disclaimer banner ── */}
      <div className="rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/[0.06] px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-[#FBBF24] shrink-0 mt-0.5" />
        <div className="text-xs text-[#CBD5E1] leading-relaxed">
          <span className="font-semibold text-[#FBBF24]">
            Historical pattern, informational only, not investment advice.
          </span>{" "}
          These patterns are computed from this stock&apos;s own price and volume history (open, close,
          volume — no intraday range). &quot;Buying pressure&quot; or &quot;selling pressure&quot; is
          inferred from price and volume — never confirmed. Nothing here is a recommendation to buy
          or sell, and past behaviour does not guarantee future results.
        </div>
      </div>

      {/* ── Empty state ── */}
      {patterns.length === 0 ? (
        <Card className="bg-[#131829] border-white/[0.08]">
          <CardContent className="p-6 text-center">
            <Sigma className="h-8 w-8 text-[#64748B] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#F4F7FB] mb-1">
              No patterns detected for {data.symbol} yet
            </p>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              The statistical detectors did not find any pattern that repeated at least twice with the
              minimum history each detector requires. This is normal for short or very quiet price
              histories.
            </p>
            {data.coverage.skipped.length > 0 && (
              <div className="mt-4 text-left max-w-md mx-auto space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-[#64748B] text-center">
                  What was skipped and why
                </p>
                {data.coverage.skipped.map((s, i) => (
                  <p key={i} className="text-[10px] text-[#64748B]">
                    • <span className="text-[#94A3B8]">{s.type}</span> — {s.reason}
                  </p>
                ))}
              </div>
            )}
            <p className="text-[10px] text-[#64748B] mt-4">{data.disclaimer}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          {/* ════════ LEFT: chart + heatmap + zones + events ════════ */}
          <div className="lg:col-span-3 space-y-4">
            {/* Price chart with evidence-date overlay + key price zones */}
            <div ref={chartRef}>
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
                      <Eye className="h-4 w-4 text-[#00E676]" />
                      Price chart — evidence dates overlay
                    </CardTitle>
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-[11px] text-[#94A3B8] cursor-pointer">
                        <Switch checked={showZones} onCheckedChange={setShowZones} className="scale-90" />
                        Key price zones
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-[#94A3B8] cursor-pointer">
                        <Switch
                          checked={showAllMarkers}
                          onCheckedChange={setShowAllMarkers}
                          className="scale-90"
                        />
                        All patterns ({markerDates.length})
                      </label>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    {showAllMarkers ? (
                      <>Showing evidence dates of <span className="text-[#94A3B8]">all {patterns.length} patterns</span> (up to 800 dots).</>
                    ) : selected ? (
                      <>
                        Dots mark the {selected.evidence_dates.length} evidence dates of:{" "}
                        <span className="font-semibold" style={{ color: markerColor }}>
                          {selected.title}
                        </span>
                      </>
                    ) : (
                      "Select a pattern card to overlay its evidence dates."
                    )}
                  </p>
                </CardHeader>
                <CardContent className="pb-3">
                  <PatternChart
                    dates={data.chart.dates}
                    closes={data.chart.closes}
                    zones={showZones ? data.zones.slice(0, 4) : []}
                    markers={markerDates}
                    markerColor={markerColor}
                  />
                  <p className="text-[10px] text-[#64748B] mt-2">
                    Closing prices only (open/close/volume data — high/low are not recorded in the
                    upstream price feed). {data.disclaimer}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Seasonality heatmap */}
            {data.seasonality && data.seasonality.years.length > 0 ? (
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#00E676]" />
                    Monthly seasonality heatmap
                  </CardTitle>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Each cell = that month&apos;s return (month-end close vs previous month-end close).
                    Amber outline = month flagged as a repeating pattern (same direction in ≥ 4 of 5+
                    years).
                  </p>
                </CardHeader>
                <CardContent>
                  <SeasonalityHeatmap seasonality={data.seasonality} />
                  <p className="text-[10px] text-[#64748B] mt-2">{data.disclaimer}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-4 text-xs text-[#64748B]">
                  <CalendarDays className="h-4 w-4 mb-2 text-[#64748B]" />
                  Seasonality needs at least 5 calendar years of data — this stock does not have
                  enough history yet.
                </CardContent>
              </Card>
            )}

            {/* Key price zones */}
            <Card className="bg-[#131829] border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#FBBF24]" />
                  Key price zones ({data.zones.length})
                </CardTitle>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Price bands where closing prices repeatedly clustered (2%-wide bins). Volume ratio =
                  average volume inside the zone vs the stock&apos;s overall norm.
                </p>
              </CardHeader>
              <CardContent>
                {data.zones.length === 0 ? (
                  <p className="text-xs text-[#64748B]">
                    No price zone had enough visits to be worth reporting for this stock.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[#64748B] border-b border-white/[0.06]">
                          <th className="text-left py-1.5 pr-2 font-medium">Zone</th>
                          <th className="text-right py-1.5 px-2 font-medium">Visits</th>
                          <th className="text-right py-1.5 px-2 font-medium">Days in zone</th>
                          <th className="text-right py-1.5 px-2 font-medium">Volume</th>
                          <th className="text-right py-1.5 px-2 font-medium">Turned back ≤10d</th>
                          <th className="text-right py-1.5 pl-2 font-medium">Broke through ≤10d</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.zones.map((z, i) => (
                          <tr key={i} className="border-b border-white/[0.04] last:border-0">
                            <td className="py-1.5 pr-2 font-mono text-[#F4F7FB] whitespace-nowrap">
                              Rs {z.lo.toFixed(z.lo >= 100 ? 0 : 1)} – {z.hi.toFixed(z.hi >= 100 ? 0 : 1)}
                            </td>
                            <td className="text-right px-2 text-[#94A3B8]">{z.episodes}</td>
                            <td className="text-right px-2 text-[#94A3B8]">{z.daysInZone}</td>
                            <td className="text-right px-2 text-[#94A3B8]">{z.volRatio.toFixed(2)}×</td>
                            <td className="text-right px-2 text-[#94A3B8]">{z.reversalRate}%</td>
                            <td className="text-right pl-2 text-[#94A3B8]">{z.breakoutRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[10px] text-[#64748B] mt-2">{data.disclaimer}</p>
              </CardContent>
            </Card>

            {/* Unusual events + AI notes */}
            <Card className="bg-[#131829] border-white/[0.08]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#F4F7FB] flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#FB923C]" />
                  Notable events in this stock&apos;s history
                </CardTitle>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Extreme days, gaps, streaks and 52-week extremes found by the statistical scan.
                </p>
              </CardHeader>
              <CardContent>
                {data.unusual.length === 0 ? (
                  <p className="text-xs text-[#64748B]">Nothing extreme on record for this stock.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {data.unusual.map((u, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px]">
                        <Badge
                          variant="outline"
                          className="text-[9px] shrink-0 border-white/15 text-[#94A3B8] bg-white/5"
                        >
                          {u.date}
                        </Badge>
                        <span className="text-[#CBD5E1] leading-relaxed">{u.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {data.llmNotes.length > 0 && (
                  <div className="mt-3 rounded-md border border-[#00E676]/20 bg-[#00E676]/[0.05] p-3">
                    <p className="text-[11px] font-semibold text-[#00E676] flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI-reviewed notes on this history
                    </p>
                    <ul className="space-y-1">
                      {data.llmNotes.map((note, i) => (
                        <li key={i} className="text-[11px] text-[#CBD5E1] leading-relaxed">
                          • {note}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[9px] text-[#64748B] mt-2">
                      Generated from the same price and volume data shown above — the AI only
                      rephrases the statistics; it does not add numbers or advice.
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-[#64748B] mt-2">{data.disclaimer}</p>
              </CardContent>
            </Card>

            {/* Methodology */}
            <Card className="bg-[#131829] border-white/[0.08]">
              <CardContent className="p-4">
                <Collapsible>
                  <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-semibold text-[#F4F7FB] group">
                    <span className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-[#64748B]" />
                      How are these patterns detected?
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#64748B] group-data-[state=open]:rotate-180 transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2 text-[11px] text-[#94A3B8] leading-relaxed">
                    <p>
                      All statistics are computed in code from this stock&apos;s daily{" "}
                      <span className="text-[#F4F7FB]">date, open, close and volume</span> only —
                      no technical indicators, no candlesticks, no intraday range (the upstream feed
                      has no high/low). The AI model only explains the finished statistics in
                      simple words; it never does the math and never gives advice.
                    </p>
                    <ul className="space-y-1.5 list-disc pl-4">
                      <li>
                        <span className="text-[#F4F7FB]">Seasonality:</span> average return and win
                        rate per calendar month; flagged only when the month moved the same way in
                        at least 4 of 5+ years.
                      </li>
                      <li>
                        <span className="text-[#F4F7FB]">Volume surges:</span> days when volume ran
                        ≥ 2.5 standard deviations above its 20-day average, checked against the
                        price move that day and over the next 5 and 20 trading days.
                      </li>
                      <li>
                        <span className="text-[#F4F7FB]">Buying / selling pressure:</span> month-long
                        windows where price was flat-or-rising (or flat-or-falling) while volume
                        built ≥ 15% — pressure is inferred from price and volume, never confirmed.
                      </li>
                      <li>
                        <span className="text-[#F4F7FB]">Key price zones:</span> closing prices
                        clustered into 2%-wide bands; each zone&apos;s visits, volume, and how often
                        price turned back vs broke through within 10 days.
                      </li>
                      <li>
                        <span className="text-[#F4F7FB]">Gaps:</span> days the open sat ≥ 1% away
                        from the previous close, and how often price returned to the pre-gap close.
                      </li>
                      <li>
                        <span className="text-[#F4F7FB]">Post-event drift:</span> average 5/20-day
                        moves after volume surges and new 52-week highs/lows.
                      </li>
                    </ul>
                    <p>
                      Rules: no pattern is ever shown with fewer than{" "}
                      <span className="text-[#F4F7FB]">2 occurrences</span>; the sample size is
                      always displayed; confidence (high / medium / low) is based on the sample size.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>

          {/* ════════ RIGHT: pattern cards (sorted by confidence) ════════ */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-[#F4F7FB]">
                Patterns — sorted by confidence
              </h3>
              <span className="text-[10px] text-[#64748B]">
                high → medium → low · sample size always shown
              </span>
            </div>
            <div className={`space-y-3 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:pr-1.5 ${SCROLLBAR}`}>
              {patterns.map((p) => (
                <PatternCard
                  key={p.id}
                  pattern={p}
                  selected={p.id === selectedId}
                  onSelect={() => {
                    setSelectedId(p.id);
                    setShowAllMarkers(false);
                    scrollToChart();
                  }}
                />
              ))}
              <p className="text-[10px] text-[#64748B] pt-1 px-1">
                Reports are precomputed nightly and stored in the database — the AI explanation is
                generated once per stock, never re-run for the same data.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// pattern card
// ──────────────────────────────────────────────────────────────────────────

function PatternCard({
  pattern,
  selected,
  onSelect,
}: {
  pattern: StatPattern & { explanation?: string };
  selected: boolean;
  onSelect: () => void;
}) {
  const [openEv, setOpenEv] = useState(false);
  const meta = TYPE_META[pattern.type] ?? { label: pattern.type, color: "#94A3B8" };
  const conf = CONF_META[pattern.confidence] ?? CONF_META.low;

  const isSeasonality = pattern.type === "seasonality";
  const baseN = isSeasonality
    ? Number(pattern.details["Years on record"] ?? pattern.occurrences)
    : pattern.occurrences;
  const workedN = isSeasonality
    ? pattern.occurrences
    : Math.round((pattern.occurrences * pattern.success_rate) / 100);

  const years = pattern.years_seen;
  const ev = pattern.evidence_dates;

  return (
    <Card
      className={`bg-[#131829] transition-colors ${
        selected ? "border-[#FBBF24]/50 ring-1 ring-[#FBBF24]/20" : "border-white/[0.08]"
      }`}
    >
      <CardContent className="p-4">
        {/* header */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge variant="outline" className={`text-[9px] border ${conf.cls}`}>
            {conf.label}
          </Badge>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium"
            style={{ color: meta.color }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
          </span>
          <span className="text-[10px] text-[#64748B] ml-auto font-mono">{pattern.period}</span>
        </div>

        <h4 className="text-sm font-semibold text-[#F4F7FB] leading-snug mb-2">{pattern.title}</h4>

        {/* "how often it worked" bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-[#94A3B8]">How often it worked</span>
            <span className="font-mono font-semibold text-[#F4F7FB]">{pattern.success_rate}%</span>
          </div>
          <Progress value={pattern.success_rate} className="h-2 bg-white/[0.07] [&>div]:bg-[#00E676]" />
          <p className="text-[10px] text-[#64748B] mt-1.5">
            {isSeasonality
              ? `Matched in ${workedN} of ${baseN} years on record`
              : `Worked in ${workedN} of ${baseN} occurrences`}
            {" · "}
            <span className="text-[#94A3B8]">Sample size: {pattern.occurrences}</span>
          </p>
        </div>

        {/* AI layman explanation */}
        {pattern.explanation ? (
          <div className="rounded-md border border-[#00E676]/20 bg-[#00E676]/[0.05] p-2.5 mb-2">
            <p className="text-[10px] font-semibold text-[#00E676] flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3" /> In simple terms
            </p>
            <p className="text-[11px] text-[#CBD5E1] leading-relaxed">{pattern.explanation}</p>
          </div>
        ) : (
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 mb-2">
            <p className="text-[10px] font-semibold text-[#94A3B8] flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3" /> In simple terms
            </p>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Plain-language explanation will appear after the next nightly refresh of this report.
            </p>
          </div>
        )}

        {/* statistical description */}
        <p className="text-[11px] text-[#94A3B8] leading-relaxed mb-2">{pattern.description}</p>

        {/* extra details grid */}
        {pattern.details && Object.keys(pattern.details).length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
            {Object.entries(pattern.details).map(([k, v], i) => (
              <div key={i} className="text-[10px] flex flex-col min-w-0">
                <span className="text-[#64748B] truncate" title={k}>{k}</span>
                <span className="text-[#CBD5E1] truncate" title={String(v)}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* years seen + avg move */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#64748B] mb-2">
          <span
            className={`font-mono font-semibold ${
              pattern.avg_move_pct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"
            }`}
          >
            Avg move {fmtSigned(pattern.avg_move_pct)}
          </span>
          {years.length > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 flex-wrap">
                <History className="h-3 w-3" />
                Years seen:
                {years.slice(0, 6).map((y) => (
                  <span key={y} className="font-mono text-[#94A3B8]">{y}</span>
                ))}
                {years.length > 6 && <span className="text-[#94A3B8]">+{years.length - 6} more</span>}
              </span>
            </>
          )}
        </div>

        {/* evidence dates */}
        {ev.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#64748B]">Evidence dates:</span>
              {ev.slice(0, 3).map((d) => (
                <span key={d} className="text-[10px] font-mono text-[#94A3B8]">{d}</span>
              ))}
              {ev.length > 3 && (
                <button
                  onClick={() => setOpenEv((o) => !o)}
                  className="text-[10px] text-[#FBBF24] hover:underline underline-offset-2"
                >
                  {openEv ? "hide" : `+${ev.length - 3} more`}
                </button>
              )}
            </div>
            {openEv && (
              <div className={`mt-1.5 max-h-36 overflow-y-auto pr-1 text-[10px] font-mono text-[#64748B] leading-relaxed ${SCROLLBAR}`}>
                {ev.join(" · ")}
              </div>
            )}
          </div>
        )}

        {/* actions */}
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSelect}
            className={`h-7 text-[11px] ${
              selected
                ? "border-[#FBBF24]/50 text-[#FBBF24]"
                : "border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Eye className="h-3 w-3 mr-1" />
            {selected ? "On chart" : "Show on chart"}
          </Button>
          <span className="text-[9px] text-[#64748B] text-right leading-tight">
            Historical pattern, informational only,
            <br />
            not investment advice.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// price chart (pure SVG — close line + zone bands + evidence markers)
// ──────────────────────────────────────────────────────────────────────────

function nearestIndex(dates: string[], target: string): number {
  if (!dates.length) return -1;
  let lo = 0, hi = dates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const t = Date.parse(target);
    const a = Date.parse(dates[lo - 1]);
    const b = Date.parse(dates[lo]);
    if (Math.abs(t - a) <= Math.abs(b - t)) return lo - 1;
  }
  return lo;
}

function PatternChart({
  dates,
  closes,
  zones,
  markers,
  markerColor,
}: {
  dates: string[];
  closes: number[];
  zones: PriceZone[];
  markers: string[];
  markerColor: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  const [hover, setHover] = useState<{ idx: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(320, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!closes.length) return null;

  const H = 360, padL = 8, padR = 62, padT = 14, padB = 24;
  const W = Math.max(width, 320);
  const iW = Math.max(1, W - padL - padR);
  const iH = H - padT - padB;

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pad = Math.max((max - min) * 0.06, max * 0.004, 0.01);
  const yMin = min - pad;
  const yMax = max + pad;

  const x = (i: number) => padL + (i * iW) / Math.max(1, closes.length - 1);
  const y = (p: number) => padT + (1 - (p - yMin) / (yMax - yMin)) * iH;

  // close path
  let path = "";
  for (let i = 0; i < closes.length; i++) {
    path += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(closes[i]).toFixed(1)}`;
  }

  // year gridlines
  const yearTicks: { i: number; label: string }[] = [];
  for (let i = 1; i < dates.length; i++) {
    if (dates[i].slice(0, 4) !== dates[i - 1].slice(0, 4)) {
      yearTicks.push({ i, label: dates[i].slice(0, 4) });
    }
  }

  // y ticks (5)
  const yTicks: number[] = [];
  for (let t = 0; t <= 4; t++) yTicks.push(yMin + ((yMax - yMin) * t) / 4);

  // markers snapped to nearest chart index
  const markerPts = markers
    .map((d) => {
      const idx = nearestIndex(dates, d);
      return idx >= 0 ? { idx, cx: x(idx), cy: y(closes[idx]) } : null;
    })
    .filter(Boolean) as { idx: number; cx: number; cy: number }[];

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    if (mx < padL || mx > W - padR) {
      setHover(null);
      return;
    }
    const idx = Math.round(((mx - padL) / iW) * (closes.length - 1));
    if (idx >= 0 && idx < closes.length) {
      setHover({ idx, px: x(idx), py: y(closes[idx]) });
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        className="block"
      >
        {/* key price zones */}
        {zones.map((z, i) => {
          const yTop = y(z.hi);
          const yBot = y(z.lo);
          return (
            <g key={i}>
              <rect
                x={padL}
                y={yTop}
                width={iW}
                height={Math.max(2, yBot - yTop)}
                fill="#FBBF24"
                opacity={0.08}
              />
              <line x1={padL} y1={yTop} x2={W - padR} y2={yTop} stroke="#FBBF24" strokeWidth={0.5} opacity={0.35} strokeDasharray="4 4" />
              <line x1={padL} y1={yBot} x2={W - padR} y2={yBot} stroke="#FBBF24" strokeWidth={0.5} opacity={0.35} strokeDasharray="4 4" />
              <text x={W - padR + 4} y={(yTop + yBot) / 2 + 3} fontSize={9} fill="#FBBF24" opacity={0.9}>
                {z.lo.toFixed(z.lo >= 100 ? 0 : 1)}–{z.hi.toFixed(z.hi >= 100 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        {/* y gridlines + labels */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#FFFFFF" strokeWidth={0.5} opacity={0.06} />
            <text x={W - padR + 4} y={y(v) + 3} fontSize={9} fill="#64748B">
              {v.toFixed(v >= 100 ? 0 : 1)}
            </text>
          </g>
        ))}

        {/* year gridlines + labels */}
        {yearTicks.map((t, i) => (
          <g key={i}>
            <line x1={x(t.i)} y1={padT} x2={x(t.i)} y2={H - padB} stroke="#FFFFFF" strokeWidth={0.5} opacity={0.08} />
            <text x={x(t.i)} y={H - padB + 12} fontSize={9} fill="#64748B" textAnchor="middle">
              {t.label}
            </text>
          </g>
        ))}

        {/* close line */}
        <path d={path} fill="none" stroke="#00E676" strokeWidth={1.6} strokeLinejoin="round" />

        {/* evidence markers */}
        {markerPts.map((m, i) => (
          <circle key={i} cx={m.cx} cy={m.cy} r={3} fill={markerColor} opacity={0.8} stroke="#0A0E1A" strokeWidth={0.5}>
            <title>{dates[m.idx]} · close {fmtRs(closes[m.idx])}</title>
          </circle>
        ))}

        {/* hover crosshair */}
        {hover && (
          <g>
            <line x1={hover.px} y1={padT} x2={hover.px} y2={H - padB} stroke="#94A3B8" strokeWidth={0.7} opacity={0.5} strokeDasharray="3 3" />
            <circle cx={hover.px} cy={hover.py} r={3.5} fill="#F4F7FB" />
          </g>
        )}
      </svg>

      {/* hover tooltip */}
      {hover && (
        <div
          className="absolute pointer-events-none bg-[#0A0E1A] border border-white/15 rounded px-2 py-1 text-[10px] leading-tight shadow-xl z-10"
          style={{
            left: `${(hover.px / W) * 100}%`,
            top: 4,
            transform: hover.px / W > 0.6 ? "translateX(-110%)" : "translateX(10px)",
          }}
        >
          <div className="font-mono text-[#94A3B8]">{dates[hover.idx]}</div>
          <div className="font-mono text-[#F4F7FB]">{fmtRs(closes[hover.idx])}</div>
        </div>
      )}

      {/* legend */}
      <div className="flex items-center gap-4 flex-wrap mt-1 text-[10px] text-[#64748B]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#00E676] inline-block" /> Close price
        </span>
        {zones.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 bg-[#FBBF24]/15 border border-[#FBBF24]/40 inline-block" /> Key price zones
          </span>
        )}
        {markers.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: markerColor }} />{" "}
            Evidence dates ({markers.length})
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// seasonality heatmap
// ──────────────────────────────────────────────────────────────────────────

function heatColor(v: number | null): string {
  if (v === null) return "transparent";
  const t = Math.min(1, Math.abs(v) / 8); // clip at ±8%
  if (v >= 0) return `rgba(0, 230, 118, ${(0.08 + 0.5 * t).toFixed(2)})`;
  return `rgba(255, 92, 92, ${(0.08 + 0.5 * t).toFixed(2)})`;
}

function SeasonalityHeatmap({ seasonality }: { seasonality: SeasonalityInfo }) {
  const { years, grid, months } = seasonality;
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[540px]">
        {/* header row */}
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "48px repeat(12, minmax(38px, 1fr))" }}>
          <div />
          {MONTH_SHORT.map((m, i) => {
            const info = months[i];
            const flagged = info?.flaggedUp || info?.flaggedDown;
            return (
              <div
                key={m}
                className={`text-center text-[9px] font-semibold py-0.5 rounded ${
                  flagged ? "text-[#FBBF24] ring-1 ring-[#FBBF24]/60 bg-[#FBBF24]/[0.07]" : "text-[#64748B]"
                }`}
                title={flagged ? `${m}: repeating pattern — same direction in ≥ 4 of 5+ years` : m}
              >
                {m}
                {flagged ? (info?.flaggedUp ? " ▲" : " ▼") : ""}
              </div>
            );
          })}
        </div>
        {/* year rows */}
        {years.map((year, yi) => (
          <div
            key={year}
            className="grid gap-[3px] mt-[3px]"
            style={{ gridTemplateColumns: "48px repeat(12, minmax(38px, 1fr))" }}
          >
            <div className="text-[10px] font-mono text-[#94A3B8] leading-6">{year}</div>
            {MONTH_SHORT.map((_, mi) => {
              const v = grid[yi]?.[mi] ?? null;
              const info = months[mi];
              const flagged = info?.flaggedUp || info?.flaggedDown;
              return (
                <div
                  key={mi}
                  title={v === null ? `${MONTH_SHORT[mi]} ${year}: no data` : `${MONTH_SHORT[mi]} ${year}: ${fmtSigned1(v)}`}
                  className={`text-center text-[9px] font-mono leading-[22px] rounded ${
                    flagged ? "ring-1 ring-[#FBBF24]/50" : ""
                  } ${v === null ? "bg-white/[0.02] text-[#3B4354]" : "text-[#F4F7FB]"}`}
                  style={{ backgroundColor: v === null ? undefined : heatColor(v) }}
                >
                  {v === null ? "·" : fmtSigned1(v).replace("+", "").replace("-", "") === "0.0" ? "0" : v > 0 ? `${v.toFixed(1)}` : `${v.toFixed(1)}`}
                </div>
              );
            })}
          </div>
        ))}
        {/* average row */}
        <div
          className="grid gap-[3px] mt-[6px]"
          style={{ gridTemplateColumns: "48px repeat(12, minmax(38px, 1fr))" }}
        >
          <div className="text-[9px] uppercase text-[#64748B] leading-6">Avg</div>
          {MONTH_SHORT.map((_, mi) => {
            const info = months[mi];
            if (!info || !info.yearsSampled) {
              return <div key={mi} className="text-center text-[9px] leading-[22px] text-[#3B4354]">·</div>;
            }
            return (
              <div
                key={mi}
                title={`${MONTH_SHORT[mi]}: avg ${fmtSigned(info.avg)}%, positive in ${info.winRate}% of ${info.yearsSampled} years`}
                className={`text-center text-[9px] font-mono font-semibold leading-[22px] rounded ${
                  info.flaggedUp || info.flaggedDown ? "ring-1 ring-[#FBBF24]/50 text-[#FBBF24]" : "text-[#F4F7FB]"
                }`}
                style={{ backgroundColor: heatColor(info.avg) }}
              >
                {info.avg.toFixed(1)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
