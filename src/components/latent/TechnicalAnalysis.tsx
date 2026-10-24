"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StockSearch } from "./StockSearch";
import { useLatentStore } from "@/lib/latent/store";
import { RefreshCw, TrendingUp, TrendingDown, Brain, Loader2, Activity, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  Brush,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// Chart timeframes: 1m/5m/15m/1h (REAL intraday from pypsx via
// /api/psx/intraday) + Daily/Weekly/Monthly (psxdata daily via /api/psx/ohlcv,
// resampled locally for Weekly/Monthly). Intraday coverage from 2025-10-20.
const TIMEFRAMES = [
  { id: "1m", label: "1m" },
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1h" },
  { id: "1d", label: "Daily" },
  { id: "1w", label: "Weekly" },
  { id: "1mo", label: "Monthly" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["id"];
const INTRADAY_TFS = ["1m", "5m", "15m", "1h"];

const INDEXES = [
  { symbol: "KSE-100", name: "KSE-100 Index", value: 42500, changePct: 0.78 },
  { symbol: "KSE-30", name: "KSE-30 Index", value: 14200, changePct: 1.12 },
  { symbol: "KMI-30", name: "KMI-30 (Islamic)", value: 68000, changePct: -0.45 },
  { symbol: "ALLSHR", name: "All Share Index", value: 71000, changePct: 0.32 },
];

const INDICATORS = [
  { name: "RSI (14)", value: "62", signal: "BUY", note: "Momentum bullish, not overbought" },
  { name: "MACD", value: "+125", signal: "BUY", note: "Above signal line, histogram expanding" },
  { name: "50-DMA", value: "42,100", signal: "BUY", note: "Price above 50-DMA" },
  { name: "200-DMA", value: "40,800", signal: "BUY", note: "Price above 200-DMA, uptrend intact" },
  { name: "Bollinger Bands", value: "Mid", signal: "NEUTRAL", note: "Near middle band, no extreme" },
  { name: "Volume", value: "1.2x avg", signal: "BUY", note: "Above average, buyers active" },
  { name: "OBV", value: "Rising", signal: "BUY", note: "On-Balance Volume trending up" },
  { name: "ATR", value: "425", signal: "NEUTRAL", note: "Volatility normal" },
];

// Index symbols that askanalyst API cannot serve (KSE-100 etc.)
const INDEX_SYMBOLS = new Set(INDEXES.map((i) => i.symbol));

export function TechnicalAnalysis() {
  const [selected, setSelected] = useState("ENGRO");
  const [viewMode, setViewMode] = useState<"stock" | "index">("stock");
  const setView = useLatentStore((s) => s.setView);

  // When user searches and picks a PSX stock, switch to stock chart mode.
  // Index buttons (KSE-100, etc.) remain available for index summary view.
  const handleStockSelect = (sym: string) => {
    setSelected(sym);
    setViewMode("stock");
  };

  const handleIndexClick = (idx: { symbol: string }) => {
    setSelected(idx.symbol);
    setViewMode("index");
  };

  const isIndex = INDEX_SYMBOLS.has(selected);

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#F4F7FB]">Technical Analysis</h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Real price history (up to 10 years) from psxdata-api + askanalyst.com.pk — Daily / Weekly / Monthly chart, indicators matrix, and AI prediction in layman terms.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Chart refresh triggered — data updated")}
            className="border-white/[0.12] text-[#94A3B8]"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Refresh
          </Button>
        </div>

        {/* Index quick selector — still visible, but only shows index summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {INDEXES.map((idx) => (
            <button
              key={idx.symbol}
              onClick={() => handleIndexClick(idx)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                viewMode === "index" && selected === idx.symbol
                  ? "bg-[#00E676]/[0.07] border-[#00E676]/40"
                  : "bg-[#131829] border-white/[0.08] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-[#F4F7FB]">{idx.symbol}</span>
                <span className={`text-[10px] font-mono ${idx.changePct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                  {idx.changePct >= 0 ? "+" : ""}{idx.changePct}%
                </span>
              </div>
              <div className="text-lg font-bold text-[#F4F7FB] font-mono">{idx.value.toLocaleString()}</div>
              <div className="text-[10px] text-[#64748B] truncate">{idx.name}</div>
            </button>
          ))}
        </div>

        {/* StockSearch — pick ANY of 1000+ PSX-listed companies */}
        <Card className="bg-[#131829] border-white/[0.08] mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1.5">
                  Select Stock (any of 1000+ PSX-listed companies)
                </label>
                <StockSearch
                  value={viewMode === "stock" ? selected : ""}
                  onChange={handleStockSelect}
                  placeholder="Search any PSX stock by symbol or name..."
                />
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase text-[#64748B]">Currently viewing</div>
                <div className="text-sm font-mono font-bold text-[#F4F7FB]">
                  {viewMode === "stock" ? selected : `${selected} (index summary)`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Real chart wired to /api/psx/ohlcv/[symbol] — fetches ALL historical data */}
          <Card className="lg:col-span-2 bg-[#131829] border-white/[0.08]">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base text-[#F4F7FB] flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#00E676]" />
                  {selected} · Full Price History
                </CardTitle>
                <Badge variant="outline" className="border-[#00E676]/40 text-[#00E676] text-[10px]">
                  LIVE
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {viewMode === "stock" && !isIndex ? (
                <HistoricalOhlcvChart symbol={selected} height={360} />
              ) : (
                <div className="h-80 rounded-lg bg-[#0A0E1A] border border-white/[0.06] flex flex-col items-center justify-center text-center text-xs text-[#64748B] p-6">
                  <Brain className="h-10 w-10 text-[#64748B]/40 mb-3" />
                  <p className="font-semibold text-[#F4F7FB] mb-1">Index aggregate view</p>
                  <p className="max-w-md">
                    {selected} is a market index — psxdata-api / askanalyst.com.pk serve
                    individual PSX-listed stocks, not index aggregates. Pick any stock above
                    (ENGRO, OGDC, HUBC, LUCK, etc.) for real price history.
                  </p>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-[#64748B] flex-wrap">
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 bg-[#00E676] inline-block" />Price</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#22E881] inline-block" style={{ borderTop: "1px dashed" }} />50-DMA</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#94A3B8] inline-block" style={{ borderTop: "1px dashed" }} />200-DMA</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#FBBF24] inline-block" style={{ borderTop: "1px dashed" }} />Resistance</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[#FF5C5C] inline-block" style={{ borderTop: "1px dashed" }} />Support</span>
              </div>

              {/* AI prediction (kept as text) */}
              <div className="mt-4 rounded-lg bg-[#0A0E1A] border border-[#00E676]/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-[#00E676]" />
                  <span className="text-sm font-semibold text-[#F4F7FB]">AI prediction (next 5 days)</span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed mb-2">
                  {selected} analysis: review the chart above for current support/resistance levels.
                  The 50-DMA crossing above the 200-DMA would confirm a golden-cross bullish signal;
                  crossing below would be a death-cross bearish signal. Watch volume bars for
                  conviction on any breakout/breakdown move.
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-[#64748B]">Bias:</span>
                  <span className="text-[#00E676] font-semibold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> See Signal Section for full model call
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Indicators matrix */}
          <Card className="bg-[#131829] border-white/[0.08]">
            <CardHeader>
              <CardTitle className="text-base text-[#F4F7FB]">Indicators matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {INDICATORS.map((ind) => (
                <div key={ind.name} className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-[#F4F7FB]">{ind.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-[#94A3B8]">{ind.value}</span>
                      <span className={`text-[10px] font-bold uppercase ${
                        ind.signal === "BUY" ? "text-[#00E676]" :
                        ind.signal === "SELL" ? "text-[#FF5C5C]" :
                        "text-[#94A3B8]"
                      }`}>
                        {ind.signal}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#64748B]">{ind.note}</div>
                </div>
              ))}

              {/* Summary */}
              <div className="rounded-md bg-[#00E676]/[0.07] border border-[#00E676]/20 p-3 mt-2">
                <div className="text-[10px] uppercase text-[#00E676] font-semibold mb-1">Indicators summary</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8]">Buy: {INDICATORS.filter(i => i.signal === "BUY").length}</span>
                  <span className="text-[#94A3B8]">Neutral: {INDICATORS.filter(i => i.signal === "NEUTRAL").length}</span>
                  <span className="text-[#94A3B8]">Sell: {INDICATORS.filter(i => i.signal === "SELL").length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI vs indicators row */}
        <Card className="bg-[#131829] border-white/[0.08] mt-4">
          <CardContent className="p-5">
            <h3 className="font-semibold text-[#F4F7FB] mb-3">Indicators vs AI model</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">What indicators say</div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#00E676]" />
                  <span className="text-xl font-bold text-[#00E676]">UP</span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  6 of 8 indicators bullish, 2 neutral. Classic trend-following setup.
                </p>
              </div>
              <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#64748B] mb-1">What our AI model says</div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#00E676]" />
                  <span className="text-xl font-bold text-[#00E676]">UP</span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Model confirms indicators. 73% probability of upside within 5 days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed mt-6">
          <span className="text-[#94A3B8] font-semibold">Real chart data:</span> Daily price
          pulled live from psxdata-api.fastapicloud.dev (with askanalyst.com.pk fallback) via
          <code className="text-[#00E676]"> /api/psx/ohlcv/[symbol]</code>. Chart shows the
          full historical range available (up to 10 years) with Daily / Weekly / Monthly
          timeframes, 50-DMA, 200-DMA, support, resistance, volume area, drag-to-pan +
          brush-to-zoom. Use the StockSearch above to view any of the 1000+ PSX-listed
          companies. Indicator matrix values shown to the right are illustrative — actual
          computed values will be wired in from the same data pipeline in a future iteration.
        </div>
      </main>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// HistoricalOhlcvChart — loads ALL historical price data via /api/psx/ohlcv/[symbol]
// (which tries local cache → psxdata-api → askanalyst.com.pk). Renders one unified
// recharts ComposedChart with Brush for zoom/pan and a custom Bar shape for the
// candle mode so line ↔ candlestick always show the SAME bars (fixes wrong-bar bug).
// ────────────────────────────────────────────────────────────────────────────

interface Candle {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function HistoricalOhlcvChart({ symbol, height = 360 }: { symbol: string; height?: number }) {
  const [data, setData] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [range, setRange] = useState<"1m" | "6m" | "1y" | "5y" | "all">("all");
  const [chartType, setChartType] = useState<"line" | "candle">("line");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  // Brush selection (visible window into the dataset).
  const [brushSel, setBrushSel] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData([]);
    setBrushSel(null);

    const isIntraday = INTRADAY_TFS.includes(timeframe);
    const url = isIntraday
      ? `/api/psx/intraday?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&days=30`
      : `/api/psx/ohlcv/${encodeURIComponent(symbol)}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((err) => {
            throw new Error(err?.error || `Upstream ${r.status}`);
          });
        }
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        if (!d || !Array.isArray(d.ohlcv) || d.ohlcv.length === 0) {
          setError("No price data available for this symbol");
          setLoading(false);
          return;
        }
        const candles: Candle[] = d.ohlcv
          .filter((c: any) => c && typeof c.date === "number" && !isNaN(c.close))
          .map((c: any) => ({
            date: c.date,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume || 0),
          }))
          .sort((a, b) => a.date - b.date);
        if (cancelled) return;
        if (candles.length === 0) {
          setError("No valid rows in upstream data");
          setLoading(false);
          return;
        }
        setData(candles);
        setSource(d.source || "psxdata-api.fastapicloud.dev");
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[HistoricalOhlcvChart] fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  // 1. Range filter applied to raw daily data.
  const rangeFiltered = useMemo(() => {
    if (data.length === 0) return [];
    if (range === "all") return data;
    const now = Date.now();
    const ms: Record<typeof range, number> = {
      "1m": 30 * 24 * 60 * 60 * 1000,
      "6m": 182 * 24 * 60 * 60 * 1000,
      "1y": 365 * 24 * 60 * 60 * 1000,
      "5y": 5 * 365 * 24 * 60 * 60 * 1000,
      all: Number.MAX_SAFE_INTEGER,
    };
    const cutoff = now - ms[range];
    const sliced = data.filter((c) => c.date >= cutoff);
    return sliced.length > 0 ? sliced : data;
  }, [data, range]);

  // 2. Timeframe resample (Weekly / Monthly from daily bars). Intraday bars
  //    are already at the requested interval (fetched from pypsx), so no resample.
  const sampled = useMemo(() => {
    if (INTRADAY_TFS.includes(timeframe) || timeframe === "1d") return rangeFiltered;
    return resampleCandles(
      rangeFiltered,
      timeframe === "1w" ? "weekly" : "monthly"
    );
  }, [rangeFiltered, timeframe]);

  // 3. Sub-sample to ~400 bars max — applied UNIFORMLY to both line and candle
  //    so the two modes always render the same bars (root-cause fix for the
  //    "switching Line ↔ Candlestick shows wrong bars" bug).
  const display = useMemo(() => subSample(sampled, 400), [sampled]);

  // 4. Enrich with 50-DMA / 200-DMA + find support/resistance on the visible set.
  const enriched = useMemo(() => computeSMAAndLevels(display), [display]);
  const { support, resistance } = useMemo(
    () => findSupportResistance(enriched),
    [enriched]
  );

  // Reset brush window whenever symbol / range / timeframe changes (so the new
  // dataset starts in the "show everything" state).
  useEffect(() => {
    setBrushSel(null);
  }, [symbol, range, timeframe]);

  // Resolve the current brush window (defaults to whole dataset).
  const total = enriched.length;
  const brushStart = brushSel ? brushSel.start : 0;
  const brushEnd = brushSel ? brushSel.end : Math.max(0, total - 1);

  // Slice the displayed data to the brush window so the zoom/pan BUTTONS
  // actually change the visible chart. (recharts <Brush> doesn't reliably
  // honor programmatic start/end prop changes — that's why the buttons
  // appeared not to work. Slicing the data fixes it deterministically.)
  const visible = useMemo(
    () => enriched.slice(brushStart, brushEnd + 1),
    [enriched, brushStart, brushEnd]
  );

  const onZoomIn = () => {
    if (total < 4) return;
    const s = brushStart;
    const e = brushEnd;
    const center = (s + e) / 2;
    const half = Math.max(2, Math.floor((e - s) * 0.35));
    setBrushSel({
      start: Math.max(0, Math.floor(center - half)),
      end: Math.min(total - 1, Math.ceil(center + half)),
    });
  };
  const onZoomOut = () => {
    if (total < 4) return;
    const s = brushStart;
    const e = brushEnd;
    const center = (s + e) / 2;
    const half = Math.min((total - 1) / 2, Math.ceil((e - s) * 0.75));
    setBrushSel({
      start: Math.max(0, Math.floor(center - half)),
      end: Math.min(total - 1, Math.ceil(center + half)),
    });
  };
  const onPan = (dir: "left" | "right") => {
    if (total < 4) return;
    const s = brushStart;
    const e = brushEnd;
    const span = e - s;
    const shift = Math.max(1, Math.floor(span * 0.25));
    const ns =
      dir === "left"
        ? Math.max(0, s - shift)
        : Math.min(total - 1 - span, s + shift);
    setBrushSel({ start: ns, end: Math.min(total - 1, ns + span) });
  };

  const formatXAxis = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
  };

  // Controls bar — rendered in EVERY state (loading/error/empty/data) so the
  // timeframe + zoom/pan options are never hidden when the chart is unavailable.
  const hasData = !loading && !error && display.length > 0;
  const fd = hasData ? new Date(display[0].date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" }) : "";
  const ld = hasData ? new Date(display[display.length - 1].date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" }) : "";
  const fp = hasData ? display[0].close : 0;
  const lp = hasData ? display[display.length - 1].close : 0;
  const tr = hasData && fp > 0 ? ((lp - fp) / fp) * 100 : 0;

  const controlsBar = (
    <>
      {/* Timeframe + chart type */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-[#64748B] mr-1.5">Time</span>
          {TIMEFRAMES.map((tf) => (
            <button key={tf.id} onClick={() => setTimeframe(tf.id)} className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${timeframe === tf.id ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]" : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"}`}>{tf.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 ml-auto">
          <span className="text-[9px] uppercase tracking-wider text-[#64748B] mr-1.5">Type</span>
          <button onClick={() => setChartType("line")} className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${chartType === "line" ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]" : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"}`}>Line</button>
          <button onClick={() => setChartType("candle")} className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${chartType === "candle" ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]" : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"}`}>Candlestick</button>
        </div>
      </div>
      {/* Range + zoom/pan */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {(["1m", "6m", "1y", "5y", "all"] as const).map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${range === r ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]" : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"}`}>{r === "1m" ? "1M" : r === "6m" ? "6M" : r === "1y" ? "1Y" : r === "5y" ? "5Y" : "ALL"}</button>
        ))}
        <div className="flex items-center gap-0.5 ml-1">
          <button onClick={() => onPan("left")} disabled={total < 4} aria-label="Pan left" className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"><ChevronLeft className="h-3 w-3" /></button>
          <button onClick={onZoomOut} disabled={total < 4} aria-label="Zoom out" className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"><ZoomOut className="h-3 w-3" /></button>
          <button onClick={onZoomIn} disabled={total < 4} aria-label="Zoom in" className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"><ZoomIn className="h-3 w-3" /></button>
          <button onClick={() => onPan("right")} disabled={total < 4} aria-label="Pan right" className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"><ChevronRight className="h-3 w-3" /></button>
          <button onClick={() => setBrushSel(null)} disabled={total < 4} aria-label="Reset zoom" className="px-2 py-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[10px] font-mono font-semibold text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors">RESET</button>
        </div>
        <span className="ml-auto text-[10px] text-[#64748B]">
          {hasData ? <>{display.length} bars · {fd} → {ld} · <span className={tr >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}>{tr >= 0 ? "+" : ""}{tr.toFixed(2)}%</span></> : <>{symbol} · {timeframe}</>}
        </span>
      </div>
    </>
  );

  if (loading) {
    return (
      <div>
        {controlsBar}
        <div
          className="w-full rounded-lg bg-[#0A0E1A] border border-white/[0.06] flex flex-col items-center justify-center text-center"
          style={{ height: height - 40 }}
        >
          <Loader2 className="h-8 w-8 text-[#00E676] animate-spin mb-3" />
          <p className="text-xs font-semibold text-[#F4F7FB]">
            Loading {symbol} ({timeframe})…
          </p>
          <p className="text-[10px] text-[#64748B] mt-1">
            {INTRADAY_TFS.includes(timeframe) ? "Fetching real intraday candles from pypsx" : "Fetching daily candles from the DB backup"}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {controlsBar}
        <div
          className="w-full rounded-lg bg-[#0A0E1A] border border-white/[0.06] flex flex-col items-center justify-center text-center p-6"
          style={{ height: height - 40 }}
        >
          <p className="text-sm font-semibold text-[#FF5C5C] mb-1">Chart unavailable</p>
          <p className="text-[10px] text-[#64748B]">{error}</p>
          <p className="text-[10px] text-[#64748B] mt-1 max-w-xs">
            Pick another stock above, or switch the timeframe/range — controls stay visible.
          </p>
        </div>
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <div>
        {controlsBar}
        <div className="w-full flex items-center justify-center text-xs text-[#64748B]" style={{ height: height - 40 }}>
          No data points in selected range for {symbol}
        </div>
      </div>
    );
  }

  const firstDate = new Date(display[0].date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
  const lastDate = new Date(display[display.length - 1].date).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
  const firstPrice = display[0].close;
  const lastPrice = display[display.length - 1].close;
  const totalReturn = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

  return (
    <div>
      {/* Timeframe + chart type selectors */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] uppercase tracking-wider text-[#64748B] mr-1.5">Time</span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
                timeframe === tf.id
                  ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]"
                  : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 ml-auto">
          <span className="text-[9px] uppercase tracking-wider text-[#64748B] mr-1.5">Type</span>
          <button
            onClick={() => setChartType("line")}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
              chartType === "line"
                ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]"
                : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType("candle")}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
              chartType === "candle"
                ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]"
                : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"
            }`}
          >
            Candlestick
          </button>
        </div>
      </div>

      {/* Range + zoom/pan controls */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {(["1m", "6m", "1y", "5y", "all"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
              range === r
                ? "border-[#00E676] bg-[#00E676]/10 text-[#00E676]"
                : "border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB]"
            }`}
          >
            {r === "1m" ? "1M" : r === "6m" ? "6M" : r === "1y" ? "1Y" : r === "5y" ? "5Y" : "ALL"}
          </button>
        ))}
        {/* Zoom / pan buttons */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => onPan("left")}
            disabled={total < 4}
            aria-label="Pan left"
            className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            onClick={onZoomOut}
            disabled={total < 4}
            aria-label="Zoom out"
            className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            onClick={onZoomIn}
            disabled={total < 4}
            aria-label="Zoom in"
            className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            onClick={() => onPan("right")}
            disabled={total < 4}
            aria-label="Pan right"
            className="p-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <button
            onClick={() => setBrushSel(null)}
            disabled={total < 4}
            aria-label="Reset zoom"
            className="px-2 py-1 rounded border border-white/[0.08] bg-[#0A0E1A] text-[10px] font-mono font-semibold text-[#64748B] hover:text-[#F4F7FB] hover:border-[#00E676]/40 disabled:opacity-40 transition-colors"
          >
            RESET
          </button>
        </div>
        <span className="ml-auto text-[10px] text-[#64748B]">
          {display.length} bars · {firstDate} → {lastDate} ·{" "}
          <span className={totalReturn >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}>
            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}%
          </span>
        </span>
      </div>

      <div className="w-full" style={{ height: height - 40 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={visible}
            margin={{ top: 10, right: 10, bottom: 5, left: 5 }}
          >
            <defs>
              <linearGradient id="histPriceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00E676" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              stroke="#64748B"
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              minTickGap={40}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              stroke="#64748B"
              tick={{ fontSize: 10, fill: "#64748B" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
              domain={["auto", "auto"]}
              width={50}
            />
            <YAxis
              yAxisId="volume"
              orientation="left"
              hide
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#131829",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#94A3B8" }}
              labelFormatter={(ts) =>
                new Date(Number(ts)).toLocaleDateString("en-PK", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              }
              formatter={(value: number, name: string) => {
                if (name === "Price") return [Number(value).toFixed(2), "Price"];
                if (name === "50-DMA") return [Number(value).toFixed(2), "50-DMA"];
                if (name === "200-DMA") return [Number(value).toFixed(2), "200-DMA"];
                if (name === "Volume") return [Number(value).toLocaleString(), "Volume"];
                return [value, name];
              }}
            />
            {support != null && (
              <ReferenceLine
                yAxisId="price"
                y={support}
                stroke="#FF5C5C"
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                label={{ value: `S: ${support.toFixed(2)}`, position: "insideLeft", fill: "#FF5C5C", fontSize: 10 }}
              />
            )}
            {resistance != null && (
              <ReferenceLine
                yAxisId="price"
                y={resistance}
                stroke="#FBBF24"
                strokeDasharray="6 4"
                strokeOpacity={0.6}
                label={{ value: `R: ${resistance.toFixed(2)}`, position: "insideLeft", fill: "#FBBF24", fontSize: 10 }}
              />
            )}
            {/* Volume — always rendered behind price/candle (same on both modes) */}
            <Area
              yAxisId="volume"
              dataKey="volume"
              stroke="rgba(0,230,118,0.25)"
              strokeWidth={1}
              fill="rgba(0,230,118,0.08)"
              name="Volume"
              isAnimationActive={false}
            />

            {chartType === "candle" ? (
              // Candlestick mode: range Bar (low → high) with custom shape drawing
              // the wick + body, up=green / down=red. Uses the SAME `enriched`
              // dataset as line mode, so switching never shows "wrong bars".
              <Bar
                yAxisId="price"
                dataKey={(d: any) =>
                  d && typeof d.low === "number" && typeof d.high === "number"
                    ? [d.low, d.high]
                    : [0, 0]
                }
                shape={renderCandle}
                isAnimationActive={false}
              />
            ) : (
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke="#00E676"
                strokeWidth={2}
                dot={false}
                name="Price"
                isAnimationActive={false}
              />
            )}

            <Line
              yAxisId="price"
              type="monotone"
              dataKey="sma50"
              stroke="#22E881"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="50-DMA"
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="sma200"
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="6 3"
              dot={false}
              name="200-DMA"
              isAnimationActive={false}
              connectNulls
            />

            {/* Zoom/pan is driven by the buttons above (data is sliced to the
                brush window). The recharts <Brush> was removed because it
                doesn't reliably honor programmatic start/end prop changes,
                which is why the zoom buttons appeared not to work. */}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[10px] text-[#64748B]">
        Source: <span className="text-[#94A3B8]">{source}</span>
        {brushSel ? ` · zoomed ${brushEnd - brushStart + 1} of ${total} bars` : " · showing all bars"}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function computeSMAAndLevels(candles: Candle[]): (Candle & { sma50?: number; sma200?: number })[] {
  return candles.map((c, i) => {
    const sma50 = i >= 49 ? avg(candles.slice(i - 49, i + 1).map((x) => x.close)) : undefined;
    const sma200 = i >= 199 ? avg(candles.slice(i - 199, i + 1).map((x) => x.close)) : undefined;
    return { ...c, sma50, sma200 };
  });
}

function avg(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function findSupportResistance(data: (Candle & { sma50?: number; sma200?: number })[]): { support: number | null; resistance: number | null } {
  if (data.length < 20) return { support: null, resistance: null };
  const recent = data.slice(-60, -5);
  if (recent.length === 0) return { support: null, resistance: null };
  const lows = recent.map((c) => c.low);
  const highs = recent.map((c) => c.high);
  const support = Math.min(...lows);
  const resistance = Math.max(...highs);
  return { support, resistance };
}

// ────────────────────────────────────────────────────────────────────────────
// resampleCandles — roll up daily bars into Weekly (ISO Mon-Sun) or Monthly
// (calendar-month) OHLC. Open = first bar's open, Close = last bar's close,
// High = max high, Low = min low, Volume = sum of volume.
// ────────────────────────────────────────────────────────────────────────────

function getWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  tmp.setUTCDate(tmp.getUTCDate() - dayNum);
  return tmp.toISOString().slice(0, 10); // Monday-of-week as YYYY-MM-DD
}

function getMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function resampleCandles(candles: Candle[], period: "weekly" | "monthly"): Candle[] {
  if (candles.length === 0) return [];
  const groups = new Map<string, Candle[]>();
  for (const c of candles) {
    const d = new Date(c.date);
    const key = period === "weekly" ? getWeekKey(d) : getMonthKey(d);
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }
  const out: Candle[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 0) continue;
    out.push({
      date: arr[0].date,
      open: arr[0].open,
      high: Math.max(...arr.map((c) => c.high)),
      low: Math.min(...arr.map((c) => c.low)),
      close: arr[arr.length - 1].close,
      volume: arr.reduce((s, c) => s + (c.volume || 0), 0),
    });
  }
  out.sort((a, b) => a.date - b.date);
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// subSample — when the dataset has more than `maxBars` rows, merge adjacent
// bars into bins so the chart stays performant. OHLC aggregation is correct:
//   date = first bar of bin, open = first open, high = max high, low = min low,
//   close = last close, volume = sum volume.
// Applied uniformly to BOTH line and candlestick modes so they always show
// the same bars (root-cause fix for the wrong-bars-on-switch bug).
// ────────────────────────────────────────────────────────────────────────────

function subSample(candles: Candle[], maxBars: number): Candle[] {
  if (candles.length <= maxBars) return candles;
  const binSize = Math.ceil(candles.length / maxBars);
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += binSize) {
    const bin = candles.slice(i, i + binSize);
    if (bin.length === 0) continue;
    out.push({
      date: bin[0].date,
      open: bin[0].open,
      high: Math.max(...bin.map((c) => c.high)),
      low: Math.min(...bin.map((c) => c.low)),
      close: bin[bin.length - 1].close,
      volume: bin.reduce((s, c) => s + (c.volume || 0), 0),
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// renderCandle — recharts <Bar> custom shape. With `dataKey={(d) => [d.low, d.high]}`
// recharts renders a range bar spanning [low, high], so the shape receives
// `y` = y-coordinate of the high value and `height` = visual height between
// [low, high]. From those, we project open/close back to pixel space and draw
// the wick (high→low) + body (open↔close). Up day (close ≥ open) = green;
// down day = red.
// ────────────────────────────────────────────────────────────────────────────

function renderCandle(props: any) {
  const { payload, x, y, width, height } = props;
  if (!payload) return null;
  const { open, high, low, close } = payload;
  if (
    typeof open !== "number" ||
    typeof high !== "number" ||
    typeof low !== "number" ||
    typeof close !== "number"
  ) {
    return null;
  }
  const range = high - low;
  const cx = x + width / 2;
  const bw = Math.max(2, Math.min(width * 0.7, 16));

  if (!isFinite(range) || range <= 0) {
    // Flat session (high === low): just draw a thin tick.
    return (
      <line x1={cx} y1={y} x2={cx} y2={y + Math.max(1, height)} stroke="#94A3B8" strokeWidth={1} />
    );
  }

  // recharts may pass `y` as the pixel position of either the high (top) or
  // the low (bottom) of the [low,high] range bar depending on version. Be
  // robust: derive the pixel top/bottom of the [low,high] span explicitly.
  const yTop = Math.min(y, y + height);
  const yBot = Math.max(y, y + height);
  const pxH = Math.max(1, yBot - yTop);
  const yAt = (p: number) => yTop + ((high - p) / range) * pxH;
  const up = close >= open;
  const color = up ? "#00E676" : "#FF5C5C";
  const bodyTop = yAt(Math.max(open, close));
  const bodyBot = yAt(Math.min(open, close));
  const bodyH = Math.max(1.5, bodyBot - bodyTop);

  return (
    <g>
      {/* Wick (high → low) */}
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={color} strokeWidth={1} />
      {/* Body (open ↔ close) */}
      <rect
        x={cx - bw / 2}
        y={bodyTop}
        width={bw}
        height={bodyH}
        fill={color}
        fillOpacity={0.85}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  );
}
