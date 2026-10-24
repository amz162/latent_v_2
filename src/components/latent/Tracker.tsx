"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useLatentStore } from "@/lib/latent/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Briefcase,
  Download,
  Brain,
  Target,
  Wallet,
  Play,
  RotateCcw,
  Clock,
  PieChart as PieChartIcon,
  History,
  RefreshCw,
  Calendar,
  PiggyBank,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { classifySector } from "@/lib/latent/mock-company-results";

// The 8 PSX stocks covered by our AI model signal engine — still used by the
// Signal Tracker stats cards (4 top cards). The Investment Simulator (Issue 13)
// no longer uses these — it pulls ALL ~284 final-consensus signals from
// /api/signals/all and runs the backtest on the OhlcvBar DB (100 KSE-100 stocks).
const COVERED_SYMBOLS = ["ENGRO", "HUBC", "LUCK", "SYS", "MEBL", "PSO", "OGDC", "PPL"];

// Issue 13 — Investment Simulator: time-period input is a number + a unit
// (day / month / year). The unit is converted to trading days by the
// /api/backtest/investment-simulator endpoint (day=1, month=21, year=252).
type PeriodUnit = "day" | "month" | "year";
const PERIOD_UNITS: { value: PeriodUnit; label: string }[] = [
  { value: "day", label: "days" },
  { value: "month", label: "months" },
  { value: "year", label: "years" },
];

// Subset of /api/ai-model-signals/[symbol] response shape that we consume.
interface BacktestStats {
  totalTrades?: number;
  wins?: number;
  winRate?: number;
  avgReturnPct?: number;
  maxReturnPct?: number;
  minReturnPct?: number;
  stars?: number;
  buySignals?: number;
  sellSignals?: number;
  correctBuys?: number;
  correctSells?: number;
}

interface FinalConsensus {
  signal: "BUY" | "SELL" | "HOLD";
  direction: "LONG" | "SHORT";
  confidence: number;
  agreement: number;
  predictedPriceRange: { min: number; max: number };
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
}

interface AiSignalResponse {
  symbol: string;
  stockName: string;
  currentPrice: number;
  finalConsensus: FinalConsensus;
  backtesting: Record<string, BacktestStats>;
  ensembleBacktesting: Record<string, BacktestStats>;
  trainedModelCount: number;
  totalModelCount: number;
  trainedAt: string;
  cached: boolean;
}

interface StockSignal {
  symbol: string;
  stockName: string;
  direction: "LONG" | "SHORT";
  signal: "BUY" | "SELL" | "HOLD";
  entry: number;
  target: number;
  sl: number;
  retPct: number;
  confidence: number;
  agreement: number;
  currentPrice: number;
}

// Issue 14: Signal History row — matches /api/signals/all StockSignalSummary.
// The endpoint already overlays LIVE prices and evaluates the TP1/TP2/TP3/SL
// outcome server-side (lib/latent/liveQuote.ts#evaluateOutcome) — the client
// just displays it.
type SignalOutcome = "TP3_HIT" | "TP2_HIT" | "TP1_HIT" | "SL_HIT" | "ACTIVE";
interface SignalHistoryRow {
  symbol: string;
  stockName: string;
  signal: "BUY" | "SELL";
  direction: "LONG" | "SHORT";
  confidence: number;
  currentPrice: number; // LIVE (psxdata-api) — already swapped in by the API
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskReward: number; // |tp3 - entry| / |entry - sl|
  avgReturn: number;
  livePrice: number | null;
  outcome: SignalOutcome;
  pnlPct: number; // signed P&L vs entry in the signal's direction (live)
  ensembleBuyCount: number;
  ensembleSellCount: number;
  ensembleHoldCount: number;
  modelBuyCount: number;
  modelSellCount: number;
  modelHoldCount: number;
}

function fmtPct(v: number, withSign = false): string {
  const sign = withSign && v > 0 ? "+" : "";
  return `${sign}${Number(v).toFixed(2)}%`;
}

function fmtPkr(v: number): string {
  return `Rs. ${Math.round(v).toLocaleString("en-PK")}`;
}

export function Tracker() {
  const [aiSignals, setAiSignals] = useState<AiSignalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  // Issue 13: removed `timeframe` state — the per-symbol signals fetch now
  // always uses ?timeframe=1m (the API ignores it anyway per the original
  // comment). The Investment Simulator uses /api/backtest/investment-simulator
  // directly (which derives numDays from the user's time-period input).
  const timeframe = "1m" as const;
  const portfolio = useLatentStore((s) => s.portfolio);
  const closedTrades = useLatentStore((s) => s.closedTrades);

  // ─── Issue 14: Signal History — final ensemble consensus for ALL ~361 stocks
  // (not just the 8 hardcoded COVERED_SYMBOLS). The /api/signals/all endpoint
  // returns the same finalConsensus value used by the Signals tab, with a LIVE
  // price overlay and the TP1/TP2/TP3/SL outcome already evaluated server-side.
  const [signalHistory, setSignalHistory] = useState<SignalHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<"ALL" | "TP" | "SL" | "ACTIVE">("ALL");
  const [confFilter, setConfFilter] = useState<number>(0);
  const [historySort, setHistorySort] = useState<"rr" | "conf" | "pnl">("rr");

  // Issue 18: fetch /api/psx/companies once on mount so we can look up each
  // portfolio position's sector for the pie chart. Positions added before the
  // store had a sector field (legacy localStorage entries) won't have sector
  // info — this map fills the gap.
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/psx/companies")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.companies) return;
        const m: Record<string, string> = {};
        for (const c of d.companies) {
          if (c?.value && c?.sector) m[String(c.value).toUpperCase()] = c.sector;
        }
        setSectorMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      COVERED_SYMBOLS.map((sym) =>
        fetch(`/api/ai-model-signals/${sym}?refresh=1&timeframe=${timeframe}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    )
      .then((results) => {
        if (cancelled) return;
        const valid = (results.filter(Boolean) as AiSignalResponse[]);
        setAiSignals(valid);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  // Issue 14: fetch the Signal History dataset (all ~361 ensemble signals, with
  // LIVE price + outcome). Cached 120s server-side; the `?refresh=1` query is
  // used by the manual "Refresh" button so the user can force a fresh fetch.
  const refreshHistory = (force = false) => {
    setHistoryLoading(true);
    setHistoryError(null);
    const qs = force ? "?refresh=1" : "";
    fetch(`/api/signals/all${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.signals) setSignalHistory(j.signals as SignalHistoryRow[]);
        else setHistoryError("Signal history unavailable");
      })
      .catch(() => setHistoryError("Failed to load signal history"))
      .finally(() => setHistoryLoading(false));
  };
  useEffect(() => {
    let cancelled = false;
    fetch("/api/signals/all")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        if (j?.signals) setSignalHistory(j.signals as SignalHistoryRow[]);
        else setHistoryError("Signal history unavailable");
      })
      .catch(() => {
        if (!cancelled) setHistoryError("Failed to load signal history");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Issue 14: filter + sort the Signal History rows by outcome, min confidence,
  // and the chosen sort key (R:R / confidence / live P&L).
  const filteredHistory = useMemo(() => {
    let rows = signalHistory.filter((s) => s.confidence >= confFilter);
    if (outcomeFilter === "TP") {
      rows = rows.filter(
        (s) => s.outcome === "TP1_HIT" || s.outcome === "TP2_HIT" || s.outcome === "TP3_HIT"
      );
    } else if (outcomeFilter === "SL") {
      rows = rows.filter((s) => s.outcome === "SL_HIT");
    } else if (outcomeFilter === "ACTIVE") {
      rows = rows.filter((s) => s.outcome === "ACTIVE");
    } else {
      // Default: show only HIT signals (TP/SL hit) — ACTIVE signals stay in the Signals tab
      rows = rows.filter((s) => s.outcome && s.outcome !== "ACTIVE");
    }
    rows = [...rows].sort((a, b) => {
      if (historySort === "conf") return b.confidence - a.confidence;
      if (historySort === "pnl") return b.pnlPct - a.pnlPct;
      return b.riskReward - a.riskReward;
    });
    return rows;
  }, [signalHistory, confFilter, outcomeFilter, historySort]);

  // Lookup helper for human-readable timeframe label (kept for the report download)
  const timeframeLabel = "1 month";
  const timeframeShort = "1M";

  // Ensemble-level backtesting stats — these are global (same across symbols)
  // so we just use the first available response as the source of truth.
  const ensStats = useMemo(() => {
    if (aiSignals.length === 0) return null;
    const eb = aiSignals[0]?.ensembleBacktesting || {};
    return {
      fc: (eb["FINAL_CONSENSUS"] || {}) as BacktestStats,
      mv: (eb["MAJORITY_VOTE"] || {}) as BacktestStats,
      pw: (eb["PROBABILITY_WEIGHTED"] || {}) as BacktestStats,
      tw: (eb["TIER_WEIGHTED"] || {}) as BacktestStats,
    };
  }, [aiSignals]);

  // Per-model backtesting rows — top 6 by win rate.
  const modelBacktest = useMemo(() => {
    if (aiSignals.length === 0) return [];
    const bt = aiSignals[0]?.backtesting || {};
    return Object.entries(bt)
      .map(([name, s]) => ({ name, ...s }))
      .filter((m) => typeof m.winRate === "number")
      .sort((a, b) => (b.winRate || 0) - (a.winRate || 0))
      .slice(0, 6);
  }, [aiSignals]);

  // Per-stock signals from finalConsensus — KEPT (used by the Signal Tracker
  // stats cards and the report download). The Investment Simulator (Issue 13)
  // no longer uses these — it pulls from /api/signals/all (all ~284 stocks)
  // via the /api/backtest/investment-simulator endpoint.
  const stockSignals: StockSignal[] = useMemo(() => {
    return aiSignals
      .map((s) => {
        const fc = s.finalConsensus;
        if (!fc || !fc.entry || fc.signal === "HOLD") return null;
        const target = fc.predictedPriceRange?.max || fc.tp3 || fc.entry;
        const retPct = ((target - fc.entry) / fc.entry) * 100;
        return {
          symbol: s.symbol,
          stockName: s.stockName,
          direction: fc.direction,
          signal: fc.signal as "BUY" | "SELL" | "HOLD",
          entry: fc.entry,
          target,
          sl: fc.sl,
          retPct,
          confidence: fc.confidence,
          agreement: fc.agreement,
          currentPrice: s.currentPrice,
        } as StockSignal;
      })
      .filter(Boolean) as StockSignal[];
  }, [aiSignals]);

  // ─── Issue 13 — Investment Simulator (redesigned) ──────────────────────
  // Uses /api/backtest/investment-simulator which:
  //  - Trades on ALL final-consensus signals (~284) from /api/signals/all
  //    (not just the 8 hardcoded COVERED_SYMBOLS).
  //  - Chooses stocks RANDOMLY (seeded shuffle for determinism).
  //  - Trades on ALL stock data in the OhlcvBar DB (100 KSE-100 stocks).
  //  - Each trade uses the final-ensemble-consensus signal (entry/SL/TP1/2/3).
  //  - Holds for the user's time-period input (day/month/year → trading days).
  //  - Optional monthly SIP adds to the total capital pool.
  interface SimTrade {
    tradeNo: number;
    symbol: string;
    side: "BUY" | "SELL";
    direction: "LONG" | "SHORT";
    entryDate: number;
    entryPrice: number;
    exitDate: number;
    exitPrice: number;
    exitReason: "TP1_HIT" | "TP2_HIT" | "TP3_HIT" | "SL_HIT" | "TIME_UP";
    sl: number;
    tp1: number;
    tp2: number;
    tp3: number;
    shares: number;
    notional: number;
    netPnl: number;
    netPnlPct: number;
    isWin: boolean;
  }
  interface SimMetrics {
    startingCapital: number;
    amountPerTrade: number;
    totalTrades: number;
    numDays: number;
    winTrades: number;
    lossTrades: number;
    winRate: number;
    avgWinPct: number;
    avgLossPct: number;
    grossProfit: number;
    grossLoss: number;
    totalCosts: number;
    grossBeforeCosts: number;
    netPnL: number;
    finalValue: number;
    roiPct: number;
    maxDrawdownPct: number;
    profitFactor: number;
    sharpe: number;
    sortino: number;
    equityCurve: { tradeNo: number; value: number }[];
  }
  interface SimConfig {
    initialCapital: number;
    periodValue: number;
    periodUnit: PeriodUnit;
    monthlySip: number;
    numDays: number;
    numMonths: number;
    totalSipContribution: number;
    totalCapital: number;
    amountPerTrade: number;
    numSignalsAvailable: number;
    numTrades: number;
    minConfidence: number; // Issue 40: user-configurable confidence floor
    tradeDirection: "all" | "buy" | "sell"; // Issue 41: trade direction filter
    seed: number;
  }
  interface SimResponse {
    config: SimConfig;
    metrics: SimMetrics;
    trades: SimTrade[];
    rows: SimTrade[]; // alias — the API returns both `trades` and `rows`
    // Flat aliases the API also returns at the top level:
    initialAmount: number;
    finalAmount: number;
    totalPnl: number;
    totalReturnPct: number;
    wins: number;
    losses: number;
    cached?: boolean;
  }

  const [simCapital, setSimCapital] = useState<string>("100000");
  const [simPeriodValue, setSimPeriodValue] = useState<string>("3");
  const [simPeriodUnit, setSimPeriodUnit] = useState<PeriodUnit>("month");
  const [simMonthlySip, setSimMonthlySip] = useState<string>("0");
  // Issue 40: new user-configurable inputs — no of trades + min confidence.
  const [simNumTrades, setSimNumTrades] = useState<string>("40");
  const [simMinConfidence, setSimMinConfidence] = useState<string>("0");
  // Issue 41: trade direction filter — All / Buy only / Sell only.
  const [simTradeDirection, setSimTradeDirection] = useState<"all" | "buy" | "sell">("all");
  const [simResult, setSimResult] = useState<SimResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const runSimulation = async () => {
    const capital = parseFloat(simCapital.replace(/[,\s]/g, ""));
    const periodValue = parseInt(simPeriodValue, 10);
    const monthlySip = parseFloat(simMonthlySip.replace(/[,\s]/g, "")) || 0;
    const numTrades = parseInt(simNumTrades, 10);
    const minConfidence = parseInt(simMinConfidence, 10);
    if (!Number.isFinite(capital) || capital <= 0) {
      toast.error("Enter a valid capital amount");
      return;
    }
    if (!Number.isFinite(periodValue) || periodValue <= 0) {
      toast.error("Enter a valid time period");
      return;
    }
    if (!Number.isFinite(numTrades) || numTrades <= 0) {
      toast.error("Enter a valid number of trades");
      return;
    }
    if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 100) {
      toast.error("Min confidence must be 0–100");
      return;
    }
    setSimLoading(true);
    try {
      const qs =
        `capital=${encodeURIComponent(simCapital)}` +
        `&periodValue=${encodeURIComponent(simPeriodValue)}` +
        `&periodUnit=${encodeURIComponent(simPeriodUnit)}` +
        `&monthlySip=${encodeURIComponent(simMonthlySip)}` +
        `&numTrades=${encodeURIComponent(simNumTrades)}` +
        `&minConfidence=${encodeURIComponent(simMinConfidence)}` +
        `&tradeDirection=${encodeURIComponent(simTradeDirection)}`;
      const r = await fetch(`/api/backtest/investment-simulator?${qs}`);
      const j = await r.json();
      if (j.error) {
        toast.error(j.error);
        return;
      }
      setSimResult(j as SimResponse);
      toast.success(
        `Simulated ${j.config.numTrades} trades over ${j.config.numDays} days — ROI ${j.metrics.roiPct}%`
      );
    } catch (e) {
      toast.error("Simulation failed");
    } finally {
      setSimLoading(false);
    }
  };

  const resetSimulation = () => {
    setSimResult(null);
  };

  // Aggregate top-card stats — uses ensembleBacktesting.FINAL_CONSENSUS.
  const signalStats = useMemo(() => {
    const fc = ensStats?.fc;
    if (!fc) return null;
    const total = fc.totalTrades ?? 0;
    const wins = fc.wins ?? Math.round((total * (fc.winRate || 0)) / 100);
    const losses = total - wins;
    const winRate = fc.winRate ?? 0;
    const avgReturn = fc.avgReturnPct ?? 0;
    const best = fc.maxReturnPct ?? 0;
    const worst = fc.minReturnPct ?? 0;
    return { total, wins, losses, winRate, avgReturn, best, worst };
  }, [ensStats]);

  // Portfolio tracker — only positions with buyPrice != null && shares > 0
  // are tracked. Closed positions remain in the list and contribute to P&L.
  // Issue 23: keep closed trades visible + reflect them in top card stats.
  //
  // Issue 26: fetch LIVE prices for ALL portfolio holdings (not just the 8
  // COVERED_SYMBOLS). Hits /api/psx/live/batch (server wraps getLiveQuote
  // with a 60s in-memory cache). Auto-refreshes every 60s to match the cache
  // TTL. Symbols with no fetchable quote are simply omitted from the response
  // (the row falls back to "no live price").
  const portfolioSymbols = useMemo(
    () => portfolio.filter((p) => p.buyPrice !== null && p.shares > 0).map((p) => p.symbol),
    [portfolio]
  );
  const portfolioSymbolsKey = portfolioSymbols.join(",");
  const [livePriceBatch, setLivePriceBatch] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!portfolioSymbolsKey) {
      setLivePriceBatch({});
      return;
    }
    let cancelled = false;
    const symbolsList = Array.from(new Set(portfolioSymbols));
    const doFetch = () =>
      fetch(`/api/psx/live/batch?symbols=${encodeURIComponent(symbolsList.join(","))}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d?.prices) return;
          setLivePriceBatch(d.prices as Record<string, number>);
        })
        .catch(() => {});
    doFetch();
    const id = setInterval(doFetch, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [portfolioSymbolsKey]);

  const livePriceMap = useMemo(() => {
    const m: Record<string, number> = {};
    // 1) Seed with the 8 COVERED_SYMBOLS' currentPrice (used by the Signal Tracker tab cards)
    for (const s of aiSignals) {
      if (s.symbol && typeof s.currentPrice === "number") m[s.symbol] = s.currentPrice;
    }
    // 2) Overlay true LIVE prices for ALL portfolio holdings (covers non-KSE-100 too)
    for (const [sym, price] of Object.entries(livePriceBatch)) {
      if (typeof price === "number" && price > 0) m[sym] = price;
    }
    return m;
  }, [aiSignals, livePriceBatch]);

  const portfolioPositions = useMemo(
    () => portfolio.filter((p) => p.buyPrice !== null && p.shares > 0),
    [portfolio]
  );

  const portfolioStats = useMemo(() => {
    let totalValue = 0;
    let totalInvested = 0;
    let totalPnl = 0;
    let openCount = 0;
    let hasLiveForOpen = false;
    let hasAnyPnl = false;

    // Open positions (from portfolio store, shares > 0)
    for (const p of portfolioPositions) {
      const buy = (p.buyPrice as number) || 0;
      const invested = buy * p.shares;
      totalInvested += invested;
      openCount++;
      const live = livePriceMap[p.symbol];
      if (typeof live === "number") {
        const val = live * p.shares;
        totalValue += val;
        totalPnl += val - invested;
        hasLiveForOpen = true;
        hasAnyPnl = true;
      }
    }

    // Issue 18: closed trades from the close flow (closedTrades in store)
    // add their net P&L to the totals. They have no remaining market value
    // (shares were sold), but their net P&L contributes to total P&L.
    let closedCount = 0;
    let closedWins = 0;
    let closedNetPnl = 0;
    for (const t of closedTrades) {
      closedCount++;
      closedNetPnl += t.netPnl;
      if (t.netPnl > 0) closedWins++;
    }
    totalPnl += closedNetPnl;
    if (closedCount > 0) hasAnyPnl = true;

    const roiPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const winRate = closedCount > 0 ? (closedWins / closedCount) * 100 : null;

    return {
      total: openCount + closedCount,
      totalValue,
      totalInvested,
      totalPnl,
      roiPct,
      openCount,
      closedCount,
      closedWins,
      winRate,
      hasLiveForOpen,
      hasAnyPnl,
    };
  }, [portfolioPositions, livePriceMap, closedTrades]);

  // Issue 18: sector-wise holding distribution for the pie chart.
  // For each open position: value = (livePrice || buyPrice) × shares.
  // Sector is taken from position.sector (stored at add-time) or from the
  // sectorMap fetched on mount, else falls back to "Other".
  const sectorData = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of portfolioPositions) {
      const live = livePriceMap[p.symbol];
      const buy = (p.buyPrice as number) || 0;
      const price = typeof live === "number" ? live : buy;
      if (price <= 0 || p.shares <= 0) continue;
      const value = price * p.shares;
      // Issue 27: 3-tier sector lookup so a holding's sector is always set:
      //  1) the position's stored sector (set at Add time from StockSearch),
      //  2) the sectorMap (from /api/psx/companies, now overlays classifySector),
      //  3) classifySector(symbol) — covers ~80 common PSX stocks (Cement /
      //     Oil & Gas / Refinery / Banking / etc.); unmapped → "Other".
      // Issue 28+29: treat the legacy "Conglomerate" string (from old
      // localStorage entries or mock-stocks.ts) as INVALID — fall through to
      // the next tier so we never display "Conglomerate" as a chart slice.
      // "Other" is the only fallback for unmapped symbols.
      const stored = p.sector && p.sector.trim();
      const sector =
        (stored && stored !== "Conglomerate" ? stored : "") ||
        sectorMap[p.symbol] ||
        classifySector(p.symbol);
      m.set(sector, (m.get(sector) || 0) + value);
    }
    const total = Array.from(m.values()).reduce((s, v) => s + v, 0);
    if (total <= 0) return [] as { sector: string; value: number; pct: number }[];
    return Array.from(m.entries())
      .map(([sector, value]) => ({ sector, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [portfolioPositions, livePriceMap, sectorMap]);

  const handleDownload = () => {
    if (!signalStats) return;
    const lines = [
      "Latent.pk — Tracker Report (Real Backtest Data)",
      "Generated: " + new Date().toISOString(),
      "Source: /api/ai-model-signals/[symbol]?refresh=1",
      "Covered: " + COVERED_SYMBOLS.join(", "),
      `Timeframe: ${timeframeLabel}`,
      "",
      `=== SIGNAL TRACKER (Last ${timeframeLabel} Backtest) ===`,
      `Total signals: ${signalStats.total}`,
      `Win rate: ${signalStats.winRate}%`,
      `Avg return: ${fmtPct(signalStats.avgReturn, true)}`,
      `Best trade: ${fmtPct(signalStats.best, true)}`,
      `Worst trade: ${fmtPct(signalStats.worst)}`,
      "",
      "=== PER-STOCK SIGNALS (FINAL CONSENSUS) ===",
      ...stockSignals.map((s) => `${s.symbol} ${s.signal} entry=${s.entry} target=${s.target} ret=${fmtPct(s.retPct, true)} conf=${s.confidence}%`),
      "",
      "=== PORTFOLIO TRACKER (OPEN POSITIONS) ===",
      ...portfolioPositions.map((p) => {
        const side = (p.status || "open") === "open" ? "open" : "closed";
        const close = typeof p.closePrice === "number" ? p.closePrice : null;
        return `${p.symbol} | ${side} | buy: ${p.buyPrice || "—"} | shares: ${p.shares}${close !== null ? ` | close: ${close}` : ""}`;
      }),
      "",
      "=== CLOSED TRADES (FROM PORTFOLIO CLOSE FLOW) ===",
      ...closedTrades.map(
        (t) =>
          `${t.symbol} | buy: ${t.buyPrice} × ${t.shares} = ${Math.round(t.buyCost)} | sell: ${t.sellPrice.toFixed(2)} × ${t.shares} = ${Math.round(t.sellValue)} | commission: ${Math.round(t.commission)} | CGT: ${Math.round(t.cgt)} (${(t.taxRate * 100).toFixed(0)}%) | net P&L: ${Math.round(t.netPnl)} (${t.netPnlPct >= 0 ? "+" : ""}${t.netPnlPct.toFixed(2)}%) | holding: ${t.holdingDays}d | closed: ${t.closedAt}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `latent-tracker-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Tracker report downloaded");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-48 bg-white/[0.04]" />
        <Skeleton className="h-32 w-full bg-white/[0.04]" />
        <Skeleton className="h-64 w-full bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#F4F7FB]">Tracker</h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Real backtest stats across {COVERED_SYMBOLS.length} PSX stocks — signal tracker (model performance) + portfolio tracker (your P&amp;L).
            </p>
          </div>
          <Button
            onClick={handleDownload}
            className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Generate report
          </Button>
        </div>

        <Tabs defaultValue="signal">
          <TabsList className="bg-[#131829] border border-white/[0.08] p-1 h-auto">
            <TabsTrigger value="signal" className="data-[state=active]:bg-[#00E676]/10 data-[state=active]:text-[#00E676] text-[#94A3B8] text-xs gap-1.5">
              <Zap className="h-3 w-3" /> Signal Tracker
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="data-[state=active]:bg-[#00E676]/10 data-[state=active]:text-[#00E676] text-[#94A3B8] text-xs gap-1.5">
              <Briefcase className="h-3 w-3" /> Portfolio Tracker
            </TabsTrigger>
          </TabsList>

          {/* Signal Tracker */}
          <TabsContent value="signal" className="mt-4">
            {!signalStats ? (
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-12 text-center">
                  <Brain className="h-12 w-12 text-[#00E676]/30 mx-auto mb-3" />
                  <h3 className="font-semibold text-[#F4F7FB] mb-1">Backtest data unavailable</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Run <code className="text-[#00E676]">python3 scripts/train_all_with_backtesting.py</code> to populate model predictions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ─── Issue 17: Investment simulator moved to the TOP ─── */}
                <Card className="bg-[#131829] border-[#00E676]/20 mb-5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wallet className="h-3.5 w-3.5 text-[#00E676]" />
                      <h3 className="font-semibold text-[#F4F7FB] text-sm">Investment simulator</h3>
                      <Badge variant="outline" className="text-[8px] py-0 h-3.5 border-[#00E676]/30 text-[#00E676]/80 ml-1">
                        TOP
                      </Badge>
                    </div>
                    <p className="text-xs text-[#94A3B8] mb-3">
                      Enter capital, no of trades, time period (day/month/year), monthly SIP, min confidence, and trade direction. The simulator takes exactly the no of trades you specify from the Final Ensemble Consensus signals (filtered by confidence + direction), goes back to the time period you give, enters each trade at a real historical bar (with date), and adds monthly SIP after each month. Results show per-trade entry/exit dates.
                    </p>

                    {/* Issue 41: restructured — "Time period" as a section heading
                        with the number + unit dropdown under it. Trade direction
                        filter (All / Buy only / Sell only) added. */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {/* Investment amount */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-[#64748B]">Investment (PKR)</label>
                        <Input value={simCapital} onChange={e => setSimCapital(e.target.value)} onKeyDown={e => e.key === "Enter" && runSimulation()} placeholder="100000" inputMode="decimal" className="h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]" />
                      </div>
                      {/* No of trades */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-[#64748B]">No of trades</label>
                        <Input value={simNumTrades} onChange={e => setSimNumTrades(e.target.value)} onKeyDown={e => e.key === "Enter" && runSimulation()} placeholder="40" inputMode="numeric" className="h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]" />
                      </div>
                      {/* Monthly SIP */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-[#64748B]">Monthly SIP (PKR)</label>
                        <Input value={simMonthlySip} onChange={e => setSimMonthlySip(e.target.value)} onKeyDown={e => e.key === "Enter" && runSimulation()} placeholder="0" inputMode="decimal" className="h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]" />
                      </div>
                      {/* Min confidence */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase tracking-wider text-[#64748B]">Min confidence (0-100)</label>
                        <Input value={simMinConfidence} onChange={e => setSimMinConfidence(e.target.value)} onKeyDown={e => e.key === "Enter" && runSimulation()} placeholder="0" inputMode="numeric" className="h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]" />
                      </div>
                    </div>

                    {/* Time period — section heading + number + dropdown */}
                    <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.08] p-3 mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3 w-3 text-[#00E676]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F4F7FB]">Time period</span>
                        <span className="text-[10px] text-[#64748B]">· go back this many periods from today</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={simPeriodValue} onChange={e => setSimPeriodValue(e.target.value)} onKeyDown={e => e.key === "Enter" && runSimulation()} placeholder="3" inputMode="numeric" className="h-9 w-24 bg-[#131829] border-white/[0.08] text-sm font-mono text-[#F4F7FB]" />
                        <select value={simPeriodUnit} onChange={e => setSimPeriodUnit(e.target.value as PeriodUnit)} className="h-9 flex-1 bg-[#131829] border border-white/[0.08] rounded-md text-sm font-mono text-[#F4F7FB] px-3">
                          <option value="day">day(s)</option>
                          <option value="month">month(s)</option>
                          <option value="year">year(s)</option>
                        </select>
                      </div>
                    </div>

                    {/* Trade direction — All / Buy only / Sell only */}
                    <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.08] p-3 mb-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Activity className="h-3 w-3 text-[#00E676]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F4F7FB]">Trade direction</span>
                        <span className="text-[10px] text-[#64748B]">· simulate only these signals</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setSimTradeDirection("all")} className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${simTradeDirection === "all" ? "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40" : "bg-[#131829] text-[#94A3B8] border border-white/[0.08] hover:text-[#F4F7FB]"}`}>
                          All trades
                        </button>
                        <button onClick={() => setSimTradeDirection("buy")} className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${simTradeDirection === "buy" ? "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40" : "bg-[#131829] text-[#94A3B8] border border-white/[0.08] hover:text-[#F4F7FB]"}`}>
                          Buy only
                        </button>
                        <button onClick={() => setSimTradeDirection("sell")} className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${simTradeDirection === "sell" ? "bg-[#FF5C5C]/15 text-[#FF5C5C] border border-[#FF5C5C]/40" : "bg-[#131829] text-[#94A3B8] border border-white/[0.08] hover:text-[#F4F7FB]"}`}>
                          Sell only
                        </button>
                      </div>
                    </div>
                    {/* Simulate + Reset buttons */}
                    <div className="flex items-center gap-2 mb-4">
                      {/* Issue 43: button is disabled while simulating + shows
                          a spinner + "Simulating..." text so the user knows
                          the simulation is running (it takes ~30-60s with the
                          date-based window filtering). */}
                      <Button
                        onClick={runSimulation}
                        disabled={simLoading}
                        className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold h-9 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {simLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Simulating...
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                            Simulate
                          </>
                        )}
                      </Button>
                      {simResult && (
                        <Button onClick={resetSimulation} variant="outline" disabled={simLoading} className="border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB] h-9 disabled:opacity-60">
                          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reset
                        </Button>
                      )}
                      <div className="text-[10px] text-[#64748B] ml-auto self-center">
                        {simLoading ? (
                          <span className="text-[#00E676] animate-pulse">Running simulation... please wait</span>
                        ) : simResult ? (
                          <span>Final Ensemble Consensus · {simResult.config.numTrades} trades</span>
                        ) : (
                          <span>Final Ensemble Consensus signals</span>
                        )}
                      </div>
                    </div>

                    {/* Issue 43: loading overlay — shows a progress message while
                        the simulation runs so the user sees feedback. */}
                    {simLoading && (
                      <div className="rounded-lg border border-[#00E676]/20 bg-[#00E676]/[0.04] p-4 mb-4 flex items-center gap-3">
                        <Loader2 className="h-5 w-5 text-[#00E676] animate-spin shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-[#00E676]">Simulation in progress...</div>
                          <div className="text-[11px] text-[#94A3B8]">
                            Fetching Final Ensemble Consensus signals, filtering by confidence ≥ {simMinConfidence} + direction: {simTradeDirection}, picking {simNumTrades} trades within the last {simPeriodValue} {simPeriodUnit}(s), walking through real OHLCV bars.
                          </div>
                        </div>
                      </div>
                    )}

                    {simResult && (
                      <>
                        {/* Summary line */}
                        <div className="rounded-lg border border-white/[0.06] bg-[#0A0E1A] p-3 mb-3">
                          <p className="text-sm text-[#F4F7FB] leading-relaxed">
                            If you invested{" "}
                            <span className="font-mono font-bold text-[#00E676]">{fmtPkr(simResult.initialAmount)}</span>{" "}
                            across{" "}
                            <span className="font-mono font-bold text-[#F4F7FB]">{simResult.rows.length} trades</span>, your
                            final amount would be{" "}
                            <span className={`font-mono font-bold ${simResult.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                              {fmtPkr(simResult.finalAmount)}
                            </span>{" "}
                            (
                            <span className={`font-mono font-bold ${simResult.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                              {simResult.totalPnl >= 0 ? "+" : ""}
                              {simResult.totalReturnPct.toFixed(2)}% {simResult.totalPnl >= 0 ? "gain" : "loss"}
                            </span>
                            )
                          </p>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px]">
                            <span className="text-[#94A3B8]">
                              Total P&amp;L:{" "}
                              <span className={`font-mono font-semibold ${simResult.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                                {simResult.totalPnl >= 0 ? "+" : ""}{fmtPkr(simResult.totalPnl)}
                              </span>
                            </span>
                            <span className="text-[#94A3B8]">
                              Wins: <span className="font-mono text-[#00E676]">{simResult.wins}</span>
                            </span>
                            <span className="text-[#94A3B8]">
                              Losses: <span className="font-mono text-[#FF5C5C]">{simResult.losses}</span>
                            </span>
                            <span className="text-[#94A3B8]">
                              Win rate:{" "}
                              <span className="font-mono text-[#F4F7FB]">
                                {simResult.rows.length > 0
                                  ? ((simResult.wins / simResult.rows.length) * 100).toFixed(1)
                                  : 0}
                                %
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Trade-by-trade table */}
                        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-md border border-white/[0.06]">
                          <table className="w-full text-sm whitespace-nowrap">
                            <thead className="sticky top-0 bg-[#131829]">
                              <tr className="text-[10px] uppercase tracking-wider text-[#64748B] border-b border-white/[0.06]">
                                <th className="text-left py-2 px-3 font-semibold">#</th>
                                <th className="text-left py-2 px-3 font-semibold">Symbol</th>
                                <th className="text-left py-2 px-3 font-semibold">Side</th>
                                <th className="text-left py-2 px-3 font-semibold">Entry date</th>
                                <th className="text-right py-2 px-3 font-semibold">Entry price</th>
                                <th className="text-left py-2 px-3 font-semibold">Exit date</th>
                                <th className="text-right py-2 px-3 font-semibold">Exit price</th>
                                <th className="text-left py-2 px-3 font-semibold">Exit reason</th>
                                <th className="text-right py-2 px-3 font-semibold">P&amp;L (PKR)</th>
                                <th className="text-right py-2 px-3 font-semibold">P&amp;L %</th>
                                <th className="text-left py-2 px-3 font-semibold">Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {simResult.rows.map((r) => {
                                const fmtDate = (ms: number) =>
                                  ms > 0
                                    ? new Date(ms).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })
                                    : "—";
                                // Issue 45: SIP rows render distinctly (amber highlight + PiggyBank icon)
                                const isSip = (r as any).rowType === "SIP";
                                if (isSip) {
                                  return (
                                    <tr key={`sip-${r.tradeNo}`} className="border-b border-[#FBBF24]/20 bg-[#FBBF24]/[0.05]">
                                      <td className="py-2 px-3 font-mono text-[#FBBF24]">{r.tradeNo}</td>
                                      <td className="py-2 px-3 font-mono font-semibold text-[#FBBF24] flex items-center gap-1.5">
                                        <PiggyBank className="h-3 w-3" /> SIP DEPOSIT
                                      </td>
                                      <td className="py-2 px-3">
                                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/10">
                                          SIP
                                        </Badge>
                                      </td>
                                      <td className="py-2 px-3 text-left font-mono text-[#94A3B8]">{fmtDate(r.entryDate)}</td>
                                      <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">—</td>
                                      <td className="py-2 px-3 text-left font-mono text-[#94A3B8]">—</td>
                                      <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">—</td>
                                      <td className="py-2 px-3 text-left text-[11px] text-[#FBBF24] font-semibold">
                                        Month end — {(r as any).monthLabel || "SIP added"}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-semibold text-[#FBBF24]">
                                        +{fmtPkr((r as any).sipAmount || r.notional || 0)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">—</td>
                                      <td className="py-2 px-3 text-left">
                                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24]">
                                          DEPOSIT
                                        </Badge>
                                      </td>
                                    </tr>
                                  );
                                }
                                return (
                                  <tr key={r.tradeNo} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                    <td className="py-2 px-3 font-mono text-[#64748B]">{r.tradeNo}</td>
                                    <td className="py-2 px-3 font-mono font-semibold text-[#F4F7FB]">{r.symbol}</td>
                                    <td className="py-2 px-3">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] py-0 h-4 ${r.side === "BUY" ? "border-[#00E676]/40 text-[#00E676]" : "border-[#FF5C5C]/40 text-[#FF5C5C]"}`}
                                      >
                                        {r.side}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-left font-mono text-[#94A3B8]">{fmtDate(r.entryDate)}</td>
                                    <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">{r.entryPrice.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-left font-mono text-[#94A3B8]">{fmtDate(r.exitDate)}</td>
                                    <td className="py-2 px-3 text-right font-mono text-[#94A3B8]">{r.exitPrice.toFixed(2)}</td>
                                    <td className="py-2 px-3 text-left text-[11px] text-[#94A3B8]">{r.exitReason}</td>
                                    <td className={`py-2 px-3 text-right font-mono font-semibold ${r.netPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                                      {r.netPnl >= 0 ? "+" : ""}{fmtPkr(r.netPnl)}
                                    </td>
                                    <td className={`py-2 px-3 text-right font-mono font-semibold ${r.netPnlPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                                      {fmtPct(r.netPnlPct, true)}
                                    </td>
                                    <td className="py-2 px-3 text-left">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] py-0 h-4 ${r.isWin ? "border-[#00E676]/40 text-[#00E676]" : "border-[#FF5C5C]/40 text-[#FF5C5C]"}`}
                                      >
                                        {r.isWin ? "WIN" : "LOSS"}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Issue 13: removed the "Backtest" timeframe selector (TIMEFRAMES)
                    from the portfolio tracker — per user spec "portfolio tracker
                    remove backtest". The Investment Simulator above is the
                    replacement simulation UI. */}
                <div className="flex items-center gap-2 text-[11px] text-[#64748B] ml-auto flex-wrap">
                    <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#00E676]/40 text-[#00E676]">
                      LIVE
                    </Badge>
                    <span>
                      Last {timeframeLabel} backtest · {aiSignals.length} stocks · final consensus ensemble · {stockSignals.length} actionable signals
                    </span>
                  </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <Card className="bg-gradient-to-br from-[#00E676]/[0.07] to-[#131829] border-[#00E676]/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Total signals</span>
                        <Zap className="h-3 w-3 text-[#00E676]" />
                      </div>
                      <div className="text-3xl font-bold text-[#F4F7FB] font-mono">{signalStats.total}</div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        {signalStats.wins}W / {signalStats.losses}L · ensemble final consensus
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Win rate</span>
                        <Trophy className="h-3 w-3 text-[#00E676]" />
                      </div>
                      <div className="text-3xl font-bold text-[#00E676] font-mono">{signalStats.winRate}%</div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">across {signalStats.total} closed trades</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Avg return</span>
                        <TrendingUp className="h-3 w-3 text-[#00E676]" />
                      </div>
                      <div className={`text-3xl font-bold font-mono ${signalStats.avgReturn >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                        {fmtPct(signalStats.avgReturn, true)}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">per trade, last {timeframeLabel}</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Best / worst</span>
                        <Target className="h-3 w-3 text-[#00E676]" />
                      </div>
                      <div className="flex items-baseline gap-2 font-mono">
                        <span className="text-lg font-bold text-[#00E676]">{fmtPct(signalStats.best, true)}</span>
                        <span className="text-[#64748B] text-xs">/</span>
                        <span className="text-lg font-bold text-[#FF5C5C]">{fmtPct(signalStats.worst)}</span>
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">best trade / worst trade</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Issue 14: Signal History — final ensemble consensus for ALL
                    ~361 stocks (not the hardcoded 8). Fetches /api/signals/all,
                    which already overlays LIVE prices + evaluates the TP1/TP2/TP3
                    /SL outcome server-side. Filters: outcome, min confidence,
                    plus sort by R:R / confidence / live P&L. */}
                <Card className="bg-[#131829] border-white/[0.08] mb-5">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-white/[0.06]">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold text-[#F4F7FB] flex items-center gap-1.5">
                            <History className="h-4 w-4 text-[#00E676]" />
                            Signal History
                          </h3>
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            Final ensemble consensus across {signalHistory.length} PSX stocks · live price overlay · TP/SL outcome evaluated
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refreshHistory(true)}
                          disabled={historyLoading}
                          className="border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB] h-8"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1.5 ${historyLoading ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                      </div>

                      {/* Filters */}
                      <div className="flex flex-wrap items-end gap-3 mt-3">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Outcome</label>
                          <select
                            value={outcomeFilter}
                            onChange={(e) => setOutcomeFilter(e.target.value as "ALL" | "TP" | "SL" | "ACTIVE")}
                            className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs w-[110px]"
                          >
                            <option value="ALL">All</option>
                            <option value="TP">TP hit</option>
                            <option value="SL">SL hit</option>
                            <option value="ACTIVE">Active</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">Sort by</label>
                          <select
                            value={historySort}
                            onChange={(e) => setHistorySort(e.target.value as "rr" | "conf" | "pnl")}
                            className="bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs w-[150px]"
                          >
                            <option value="rr">R:R (high → low)</option>
                            <option value="conf">Confidence (high → low)</option>
                            <option value="pnl">Live P&amp;L % (high → low)</option>
                          </select>
                        </div>
                        <div className="flex-1 min-w-[180px]">
                          <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">
                            Min confidence: <span className="text-[#00E676] font-mono">{confFilter}%</span>
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={confFilter}
                            onChange={(e) => setConfFilter(parseInt(e.target.value))}
                            className="w-full accent-[#00E676] h-1"
                          />
                        </div>
                        <div className="text-[10px] text-[#64748B] ml-auto self-center">
                          {filteredHistory.length} of {signalHistory.length} signals
                        </div>
                      </div>
                    </div>

                    {historyError ? (
                      <div className="p-6 text-center text-xs text-[#FF5C5C]">{historyError}</div>
                    ) : historyLoading ? (
                      <div className="p-6 space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-8 w-full bg-white/[0.04]" />
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-[#131829]">
                            <tr className="text-[10px] uppercase tracking-wider text-[#64748B] border-b border-white/[0.06]">
                              <th className="text-left py-2 px-3 font-semibold">Symbol</th>
                              <th className="text-left py-2 px-3 font-semibold">Side</th>
                              <th className="text-right py-2 px-3 font-semibold">Entry</th>
                              <th className="text-right py-2 px-3 font-semibold">Live</th>
                              <th className="text-right py-2 px-3 font-semibold">SL</th>
                              <th className="text-right py-2 px-3 font-semibold">TP1</th>
                              <th className="text-right py-2 px-3 font-semibold">TP2</th>
                              <th className="text-right py-2 px-3 font-semibold">TP3</th>
                              <th className="text-right py-2 px-3 font-semibold">R:R</th>
                              <th className="text-right py-2 px-3 font-semibold">Conf.</th>
                              <th className="text-left py-2 px-3 font-semibold">Outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistory.length === 0 && (
                              <tr>
                                <td colSpan={11} className="py-6 text-center text-[#64748B] text-xs">
                                  No signals match the current filters.
                                </td>
                              </tr>
                            )}
                            {filteredHistory.map((s) => {
                              const isBuy = s.signal === "BUY";
                              const outcomeClass =
                                s.outcome === "TP3_HIT"
                                  ? "bg-[#00E676]/15 border-[#00E676]/40 text-[#00E676]"
                                  : s.outcome === "TP2_HIT"
                                  ? "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]"
                                  : s.outcome === "TP1_HIT"
                                  ? "bg-[#00E676]/8 border-[#00E676]/25 text-[#00E676]/90"
                                  : s.outcome === "SL_HIT"
                                  ? "bg-[#FF5C5C]/15 border-[#FF5C5C]/40 text-[#FF5C5C]"
                                  : "bg-white/[0.04] border-white/[0.12] text-[#94A3B8]";
                              const pnlColor = s.pnlPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]";
                              return (
                                <tr key={s.symbol} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                  <td className="py-2.5 px-3 font-mono font-semibold text-[#F4F7FB]">
                                    {s.symbol}
                                    {s.stockName && s.stockName !== s.symbol && (
                                      <div className="text-[9px] text-[#64748B] font-normal truncate max-w-[120px]">{s.stockName}</div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className={`text-[9px] py-0 h-4 ${isBuy ? "border-[#00E676]/40 text-[#00E676]" : "border-[#FF5C5C]/40 text-[#FF5C5C]"}`}>
                                      {s.signal}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#94A3B8]">{s.entry.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#F4F7FB]">
                                    {s.livePrice != null ? s.livePrice.toFixed(2) : <span className="text-[#64748B]">—</span>}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#FF5C5C]/80">{s.sl.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#00E676]/80">{s.tp1.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#00E676]/90">{s.tp2.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#00E676]">{s.tp3.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#94A3B8]">{s.riskReward.toFixed(2)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-[#94A3B8]">{s.confidence}%</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className={`text-[9px] py-0 h-4 border ${outcomeClass}`}>
                                      {s.outcome.replace("_", " ")}
                                      <span className={`ml-1 font-mono ${pnlColor}`}>
                                        {s.pnlPct >= 0 ? "+" : ""}{s.pnlPct.toFixed(2)}%
                                      </span>
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Portfolio Tracker */}
          <TabsContent value="portfolio" className="mt-4">
            {portfolioPositions.length === 0 && closedTrades.length === 0 ? (
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-12 text-center">
                  <Briefcase className="h-12 w-12 text-[#00E676]/30 mx-auto mb-3" />
                  <h3 className="font-semibold text-[#F4F7FB] mb-1">No portfolio positions yet</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Add stocks with buy prices and share counts to see your live P&amp;L, win rate, and ROI% here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Total value</span>
                        <Briefcase className="h-3 w-3 text-[#00E676]" />
                      </div>
                      <div className="text-2xl font-bold text-[#F4F7FB] font-mono">
                        {portfolioStats.hasAnyPnl ? fmtPkr(portfolioStats.totalValue) : "—"}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        invested {fmtPkr(portfolioStats.totalInvested)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Total P&amp;L</span>
                        {portfolioStats.totalPnl >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-[#00E676]" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-[#FF5C5C]" />
                        )}
                      </div>
                      <div className={`text-2xl font-bold font-mono ${portfolioStats.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                        {portfolioStats.hasAnyPnl ? `${portfolioStats.totalPnl >= 0 ? "+" : ""}${fmtPkr(portfolioStats.totalPnl)}` : "—"}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        ROI{" "}
                        <span className={portfolioStats.roiPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}>
                          {portfolioStats.hasAnyPnl ? `${portfolioStats.roiPct >= 0 ? "+" : ""}${portfolioStats.roiPct.toFixed(2)}%` : "—"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Win rate</span>
                        <Trophy className="h-3 w-3 text-[#00E676]" />
                      </div>
                      {portfolioStats.winRate !== null ? (
                        <div className="text-2xl font-bold text-[#00E676] font-mono">
                          {portfolioStats.winRate.toFixed(1)}%
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-[#94A3B8] font-mono">—</div>
                      )}
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        {portfolioStats.closedCount > 0
                          ? `${portfolioStats.closedWins}/${portfolioStats.closedCount} closed`
                          : "no closed trades yet"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#131829] border-white/[0.08]">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Positions</span>
                        <Activity className="h-3 w-3 text-[#00E676]" />
                      </div>
                      <div className="text-2xl font-bold text-[#F4F7FB] font-mono">{portfolioStats.total}</div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        <span className="text-amber-400">{portfolioStats.openCount} open</span>
                        {" · "}
                        <span className="text-[#94A3B8]">{portfolioStats.closedCount} closed</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Issue 18: SVG pie chart — sector-wise holding distribution */}
                <Card className="bg-[#131829] border-white/[0.08] mb-5">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-1.5 mb-3">
                      <PieChartIcon className="h-4 w-4 text-[#00E676]" />
                      <h3 className="font-semibold text-[#F4F7FB] text-sm">Sector-wise holding distribution</h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] mb-4">
                      Breakdown of your open positions by sector, weighted by current market value
                      (live price × shares). Useful for spotting concentration risk (e.g., 80% Cement, 20% Oil &amp; Gas).
                    </p>
                    {sectorData.length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#64748B]">
                        No open positions with a market value yet — add buy prices + share counts to populate the chart.
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row items-center gap-6">
                        <SectorPieChart data={sectorData} />
                        <div className="flex-1 w-full space-y-2">
                          {sectorData.map((d, i) => (
                            <div key={d.sector} className="flex items-center justify-between text-xs gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-3 w-3 rounded-sm shrink-0"
                                  style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                                />
                                <span className="text-[#F4F7FB] font-semibold truncate">{d.sector}</span>
                              </div>
                              <div className="flex items-center gap-3 font-mono shrink-0">
                                <span className="text-[#94A3B8]">{fmtPkr(d.value)}</span>
                                <span className="text-[#00E676] font-semibold w-14 text-right">
                                  {d.pct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Issue 18: Open positions card (Close/Reopen removed — closing is now done from PortfolioTab) */}
                <Card className="bg-[#131829] border-white/[0.08] mb-5">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-white/[0.06]">
                      <h3 className="font-semibold text-[#F4F7FB]">Open positions ({portfolioPositions.length})</h3>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Live P&amp;L based on current PSX prices for covered stocks · to close a position, use the
                        wallet-icon close flow in the <span className="text-[#00E676]">Portfolio</span> tab.
                      </p>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {portfolioPositions.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#64748B]">
                          No open positions yet. Add stocks with shares &gt; 0 to start tracking.
                        </div>
                      ) : (
                        portfolioPositions.map((p) => (
                          <PortfolioRow
                            key={p.symbol}
                            position={p}
                            livePrice={livePriceMap[p.symbol]}
                            sectorLabel={(() => {
                              const s = p.sector && p.sector.trim();
                              return (s && s !== "Conglomerate" ? s : "") ||
                                sectorMap[p.symbol] ||
                                classifySector(p.symbol);
                            })()}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Issue 18: Closed trades card (from close flow in PortfolioTab) */}
                <Card className="bg-[#131829] border-white/[0.08]">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-white/[0.06]">
                      <h3 className="font-semibold text-[#F4F7FB]">Closed trades ({closedTrades.length})</h3>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Each row is a trade closed via the Portfolio tab&apos;s close flow — recorded with buy/sell
                        prices, broker commission (0.15% × sell × 2), CGT (15% if ≤12mo, 0% if &gt;12mo),
                        and net P&amp;L.
                      </p>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {closedTrades.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#64748B]">
                          No closed trades yet. Close a position from the Portfolio tab to see it here.
                        </div>
                      ) : (
                        closedTrades.map((t) => <ClosedTradeRow key={t.id} trade={t} />)
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed mt-6">
          <span className="text-[#94A3B8] font-semibold">Tracker note:</span> Signal tracker
          stats are sourced live from <code className="text-[#00E676]">/api/ai-model-signals/[symbol]?refresh=1&amp;timeframe={timeframe}</code> —
          the ensemble final consensus backtest across {COVERED_SYMBOLS.length} covered PSX stocks. Notifications fire
          when a tracked signal hits TP or SL. Portfolio tracker shows open positions and closed trades from the
          Portfolio tab close flow; the pie chart visualises sector concentration.
        </div>
      </main>
  );
}

// ─── Issue 18: SVG-based donut pie chart for sector distribution ──────────
// Issue 28+29: distinct-hue colors for the sector pie chart.
// Each entry is a DIFFERENT hue family — no two are shades of the same color,
// and none are pastel/light shades (all 600-level Tailwind-equivalent, fully
// saturated so the slices are clearly visible against the dark background).
// Cycled via `i % SECTOR_COLORS.length` so adjacent slices never share a hue.
const SECTOR_COLORS = [
  "#DC2626", // bright red (red family — slice 0)
  "#059669", // bright emerald (green family — slice 1)
  "#7C3AED", // bright violet (purple family — slice 2)
  "#D97706", // bright amber (orange family — slice 3)
  "#0D9488", // bright teal (teal family — slice 4)
  "#DB2777", // bright pink (pink family — slice 5)
  "#CA8A04", // bright yellow (yellow family — slice 6)
  "#EA580C", // bright orange (orange family — slice 7)
  "#16A34A", // bright green (green family — slice 8)
  "#BE185D", // bright rose (magenta family — slice 9)
  "#65A30D", // bright lime (yellow-green family — slice 10)
  "#92400E", // bright amber-brown (brown family — slice 11)
];

function SectorPieChart({ data }: { data: { sector: string; value: number; pct: number }[] }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 65;
  const innerR = 30; // donut hole

  // Issue 26: Single-slice (100%) degenerate case — SVG arc spec omits the
  // slice when start === end (because the path's start and end points are
  // identical, the arc is "zero-length" and skipped). Render the donut as
  // two concentric <circle> elements instead so a 1-stock portfolio still
  // shows a full ring instead of an empty box.
  if (data.length === 1 && data[0].pct >= 99.999) {
    const d = data[0];
    const color = SECTOR_COLORS[0];
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="shrink-0"
        role="img"
        aria-label={`Sector distribution: ${d.sector} ${d.pct.toFixed(0)}%`}
      >
        <circle cx={cx} cy={cy} r={r} fill={color} stroke="#0A0E1A" strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={innerR} fill="#0A0E1A" />
        <title>{`${d.sector}: ${d.pct.toFixed(1)}% (${fmtPkr(d.value)})`}</title>
      </svg>
    );
  }

  // SVG arc paths for each sector slice. Cumulative angle is computed
  // functionally from the preceding slices' percentages (no mutation) to
  // satisfy react-hooks/immutability.
  const slices = data.map((d, i) => {
    const cumulativeBeforePct = data.slice(0, i).reduce((s, x) => s + x.pct, 0);
    const startAngle = -Math.PI / 2 + (cumulativeBeforePct / 100) * 2 * Math.PI;
    const angleSpan = (d.pct / 100) * 2 * Math.PI;
    const endAngle = startAngle + angleSpan;

    // Outer arc endpoints
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    // Inner arc endpoints (donut)
    const xi1 = cx + innerR * Math.cos(startAngle);
    const yi1 = cy + innerR * Math.sin(startAngle);
    const xi2 = cx + innerR * Math.cos(endAngle);
    const yi2 = cy + innerR * Math.sin(endAngle);

    const largeArc = angleSpan > Math.PI ? 1 : 0;
    // Donut slice path: outer arc forward + line in + inner arc backward + close
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1} Z`;
    return { path, color: SECTOR_COLORS[i % SECTOR_COLORS.length], ...d };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`Sector distribution: ${data.map((d) => `${d.sector} ${d.pct.toFixed(0)}%`).join(", ")}`}
    >
      {slices.map((s, i) => (
        <path
          key={i}
          d={s.path}
          fill={s.color}
          stroke="#0A0E1A"
          strokeWidth={1.5}
        >
          <title>{`${s.sector}: ${s.pct.toFixed(1)}% (${fmtPkr(s.value)})`}</title>
        </path>
      ))}
    </svg>
  );
}

// ─── Issue 18: Open position row (no Close/Reopen buttons) ──────────────────
// Closing is now done from PortfolioTab.tsx (Issue 13's close flow). This row
// just shows the position info + live P&L (when available).
interface PortfolioRowProps {
  position: {
    symbol: string;
    name: string;
    sector?: string | null;
    buyPrice: number | null;
    shares: number;
    status: "open" | "closed";
    closePrice?: number | null;
    closedAt?: string | null;
  };
  livePrice?: number;
  sectorLabel?: string;
}

function PortfolioRow({ position, livePrice, sectorLabel }: PortfolioRowProps) {
  const buy = (position.buyPrice as number) || 0;
  const referencePrice: number | null = typeof livePrice === "number" ? livePrice : null;
  const positionValue = referencePrice !== null ? referencePrice * position.shares : null;
  const invested = buy * position.shares;
  const pnl = positionValue !== null ? positionValue - invested : null;
  const pnlPct = pnl !== null && invested > 0 ? (pnl / invested) * 100 : null;
  const isWin = pnl !== null && pnl > 0;
  const isLoss = pnl !== null && pnl < 0;

  return (
    <div className="p-4 hover:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-[#00E676]/10 text-[#00E676]">
            {position.symbol.slice(0, 4)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#F4F7FB] text-sm">{position.symbol}</span>
              <Badge variant="outline" className="text-[9px] py-0 h-4 border-amber-500/40 text-amber-400">
                OPEN
              </Badge>
              {sectorLabel && (
                <Badge variant="outline" className="text-[8px] py-0 h-3.5 border-white/[0.12] text-[#94A3B8] uppercase">
                  {sectorLabel}
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
              Buy: {buy > 0 ? buy.toFixed(2) : "—"} · {position.shares.toLocaleString()} shares
              {typeof livePrice === "number" && (
                <span className="text-[#64748B]"> · Live: {livePrice.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          {pnl !== null ? (
            <>
              <div className={`text-sm font-mono font-semibold ${isWin ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`}>
                {pnl >= 0 ? "+" : ""}{fmtPkr(pnl)}
              </div>
              <div className="text-[10px] text-[#94A3B8] font-mono">
                {pnlPct !== null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-mono text-[#64748B]">—</div>
              <div className="text-[10px] text-[#64748B]">no live price</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Issue 18: Closed trade row (from the Portfolio close flow) ────────────
interface ClosedTradeRowProps {
  trade: {
    id: string;
    symbol: string;
    name: string;
    buyPrice: number;        // weighted-avg buy price (used for ALL P&L calc)
    shares: number;          // total shares across all lots
    sellPrice: number;
    buyCost: number;
    sellValue: number;
    commission: number;
    cgt: number;
    grossPnl: number;
    netPnl: number;
    netPnlPct: number;
    holdingDays: number;
    taxRate: number;
    closedAt: string;
    // Issue 33: per-lot history — when length > 1 the row shows "AVG · N lots".
    buyLots?: { price: number; shares: number; addedAt: string }[];
  };
}

function ClosedTradeRow({ trade }: ClosedTradeRowProps) {
  const isWin = trade.netPnl > 0;
  const isLoss = trade.netPnl < 0;
  // Issue 33: an "averaged close" is one where the position had multiple buy
  // lots before close. The P&L numbers use the weighted-avg buyPrice × total
  // shares — ONE closed-trade entry per close (not one per lot).
  const lotCount = trade.buyLots?.length ?? 0;
  const isAveraged = lotCount > 1;
  return (
    <div className="p-4 hover:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-white/[0.04] text-[#94A3B8]">
            {trade.symbol.slice(0, 4)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#F4F7FB] text-sm">{trade.symbol}</span>
              <Badge variant="outline" className="text-[9px] py-0 h-4 border-white/[0.16] text-[#94A3B8] bg-white/[0.04]">
                CLOSED
              </Badge>
              {isAveraged && (
                <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/[0.06]" title={`Averaged from ${lotCount} buy lots — P&L computed on weighted-avg buy price`}>
                  AVG · {lotCount} LOTS
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
              {/* When averaged, label clearly that this is the avg buy price (the
                  breakeven) — not one of the lot prices. P&L is computed on this. */}
              {isAveraged ? (
                <>
                  <span className="text-[#FBBF24] font-semibold">Avg {trade.buyPrice.toFixed(2)}</span>
                  {" × "}
                  <span>{trade.shares.toLocaleString()}</span>
                  {" → Sell "}
                  <span>{trade.sellPrice.toFixed(2)}</span>
                  {" · held "}
                  <span>{trade.holdingDays}d</span>
                </>
              ) : (
                <>
                  Buy {trade.buyPrice.toFixed(2)} × {trade.shares.toLocaleString()} → Sell {trade.sellPrice.toFixed(2)} · held {trade.holdingDays}d
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-mono font-semibold ${isWin ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`}>
            {trade.netPnl >= 0 ? "+" : ""}{fmtPkr(trade.netPnl)}
          </div>
          <div className={`text-[10px] font-mono ${isWin ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`}>
            {trade.netPnlPct >= 0 ? "+" : ""}{trade.netPnlPct.toFixed(2)}% net
          </div>
        </div>
      </div>
      {/* Inline breakdown */}
      <div className="mt-2 text-[10px] text-[#64748B] flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Gross:{" "}
          <span className={`font-mono ${trade.grossPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
            {trade.grossPnl >= 0 ? "+" : ""}{fmtPkr(trade.grossPnl)}
          </span>
        </span>
        <span>
          Commission: <span className="text-[#FF5C5C] font-mono">-{fmtPkr(trade.commission)}</span>
        </span>
        <span>
          CGT ({(trade.taxRate * 100).toFixed(0)}%):{" "}
          <span className="text-[#FF5C5C] font-mono">-{fmtPkr(trade.cgt)}</span>
        </span>
        <span className="text-[#475569]">
          · closed {new Date(trade.closedAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
      {/* Issue 33: per-lot breakdown when the close was averaged — for transparency
          so the user can see how the avg was derived. The P&L numbers above are
          still computed on the avg, not per-lot. */}
      {isAveraged && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-0.5">
          <div className="text-[9px] uppercase tracking-wider text-[#64748B] font-semibold mb-1">
            Buy lots (avg → {trade.buyPrice.toFixed(2)})
          </div>
          {trade.buyLots!.map((lot, li) => (
            <div key={li} className="text-[9px] font-mono text-[#64748B] flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center min-w-[36px] h-3 px-1 rounded bg-white/[0.04] text-[#64748B]">
                Lot {li + 1}
              </span>
              <span>{lot.price.toFixed(2)}</span>
              <span className="text-[#64748B]/60">×</span>
              <span>{lot.shares.toLocaleString()}</span>
              <span className="text-[#64748B]/60">=</span>
              <span>PKR {Math.round(lot.price * lot.shares).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
