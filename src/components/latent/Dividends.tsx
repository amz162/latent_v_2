"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AppNav } from "./AppNav";
import { StockSearch } from "./StockSearch";
import { useLatentStore } from "@/lib/latent/store";
import {
  Coins, Bell, BellRing, Loader2, CalendarClock,
  TrendingUp, History, ArrowDownWideNarrow, ArrowUpWideNarrow,
  Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// Issue 12 — Dividends tab overhaul:
// 1. Show ALL stocks' LATEST dividends — fetched from a live bulk source
//    (psxdata screener → 196+ payers across the full PSX universe), not a
//    hardcoded subset. Each row has: symbol, company, dividend amount per
//    share (derived from price × yield), yield %, ex-date (latest DPS period
//    end via askanalyst incomestatement for top-K high yielders), sector.
// 2. Removed the "Dividends tracked" counter stat card — just show the list.
// 3. Sort control (button-group): Latest (default), Highest amount, Lowest
//    amount.

interface DividendRow {
  symbol: string;
  company: string;
  amount: number;       // PKR per share
  yieldPct: number;     // %
  exDate: string | null; // ISO date — sort key for "Latest"
  sector: string | null;
  source: "screener" | "screener+financials";
}

type SortMode = "latest" | "highest" | "lowest";

// Issue 15: per-stock dividend history item — derived from the quarterly
// financial-results endpoint (/api/psx/financial-results/[symbol]) which
// returns metrics.dividendPerShare per period. Kept unchanged.
interface DividendHistoryItem {
  symbol: string;
  company: string;
  period: string;       // e.g. "Q1 FY24"
  periodEnd: string;    // ISO date — sort key
  dps: number;          // PKR per share
  payoutRatio: number;  // %
  eps: number;          // PKR per share (context for the payout)
}

export function Dividends() {
  const [filterSymbol, setFilterSymbol] = useState("");
  const [alerts, setAlerts] = useState<Set<string>>(new Set());
  const [dividends, setDividends] = useState<DividendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<boolean>(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const pushNotification = useLatentStore((s) => s.pushNotification);

  // Issue 15: per-stock dividend history (DPS by quarter from financial
  // results endpoint). Populated when the user selects a stock via
  // StockSearch. Kept unchanged from prior implementation.
  const [historyItems, setHistoryItems] = useState<DividendHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyCompany, setHistoryCompany] = useState<string>("");

  // Fetch ALL dividend-paying stocks from the live bulk source.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => setLoading(true));
    fetch("/api/dividends/all")
      .then((r) => {
        if (!r.ok) throw new Error(`Upstream ${r.status}`);
        return r.json();
      })
      .then((d: { dividends: DividendRow[]; fetchedAt?: string; cached?: boolean }) => {
        if (cancelled) return;
        setDividends(d.dividends || []);
        setFetchedAt(d.fetchedAt || null);
        setCached(Boolean(d.cached));
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dividends");
        setDividends([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Issue 15: when the user selects a stock via StockSearch, fetch its full
  // dividend history (DPS per quarter) from /api/psx/financial-results/[symbol].
  useEffect(() => {
    if (!filterSymbol) {
      Promise.resolve().then(() => {
        setHistoryItems([]);
        setHistoryError(null);
        setHistoryCompany("");
        setHistoryLoading(false);
      });
      return;
    }
    let cancelled = false;
    Promise.resolve().then(() => setHistoryLoading(true));
    Promise.resolve().then(() => setHistoryError(null));
    fetch(`/api/psx/financial-results/${encodeURIComponent(filterSymbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setHistoryItems([]);
          setHistoryError("No financial-results data for this symbol");
          return;
        }
        const company: string = d.company || filterSymbol;
        setHistoryCompany(company);
        const items: DividendHistoryItem[] = (d.results || [])
          .filter((r: any) => r?.metrics?.dividendPerShare && r.metrics.dividendPerShare > 0)
          .map((r: any) => ({
            symbol: filterSymbol.toUpperCase(),
            company,
            period: r.period || "",
            periodEnd: r.periodEnd || "",
            dps: Number(r.metrics.dividendPerShare) || 0,
            payoutRatio: Number(r.metrics.dividendPayoutRatio) || 0,
            eps: Number(r.metrics.eps) || 0,
          }))
          .sort((a, b) => (b.periodEnd || "").localeCompare(a.periodEnd || ""));
        setHistoryItems(items);
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryItems([]);
        setHistoryError(err instanceof Error ? err.message : "Failed to load dividend history");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterSymbol]);

  // Issue 16: bell icon should only render when the row's last-date-to-buy
  // (exDate) is in the FUTURE. Past dates get no bell.
  const isFutureDate = (iso: string | null): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (isNaN(t)) return false;
    return t > Date.now();
  };

  const toggleAlert = (symbol: string) => {
    setAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
        toast.info(`Alert cleared for ${symbol}`);
      } else {
        next.add(symbol);
        pushNotification({
          type: "info",
          title: `Alert set: ${symbol} dividend`,
          body: `We'll notify you before ${symbol}'s "Last date to buy/hold" so you can position for the dividend.`,
          linkView: "dividends",
        });
        toast.success(`Alert set for ${symbol} dividend`);
      }
      return next;
    });
  };

  // Apply StockSearch filter
  const filtered = filterSymbol
    ? dividends.filter(
        (d) =>
          d.symbol.toUpperCase() === filterSymbol.toUpperCase() ||
          d.company.toLowerCase().includes(filterSymbol.toLowerCase())
      )
    : dividends;

  // Sort the dividend list based on the selected sort mode.
  // - latest:   by exDate desc (rows with exDate first, then by amount desc
  //             as a tie-break so null-date rows still get a sensible order)
  // - highest:  by amount desc
  // - lowest:   by amount asc
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "highest") {
      arr.sort((a, b) => b.amount - a.amount);
    } else if (sortMode === "lowest") {
      arr.sort((a, b) => a.amount - b.amount);
    } else {
      // "latest"
      arr.sort((a, b) => {
        const aT = a.exDate ? new Date(a.exDate).getTime() : 0;
        const bT = b.exDate ? new Date(b.exDate).getTime() : 0;
        if (aT === bT) return b.amount - a.amount; // tie-break
        return bT - aT;
      });
    }
    return arr;
  }, [filtered, sortMode]);

  const maxDividend = dividends.length > 0
    ? Math.max(...dividends.map((d) => d.amount))
    : 0;
  const maxDividendSymbol = dividends.length > 0
    ? dividends.find((d) => d.amount === maxDividend)?.symbol
    : "—";
  const avgYield = dividends.length > 0
    ? dividends.reduce((s, d) => s + d.yieldPct, 0) / dividends.length
    : 0;
  const highestYield = dividends.length > 0
    ? Math.max(0, ...dividends.map((d) => d.yieldPct))
    : 0;
  const highestYieldSymbol = dividends.length > 0
    ? dividends.find((d) => d.yieldPct === highestYield && d.yieldPct > 0)?.symbol
    : "—";

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-PK", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <AppNav />
      <main className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#F4F7FB] flex items-center gap-2">
            <Coins className="h-6 w-6 text-[#00E676]" />
            Dividends
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            All dividend-paying PSX-listed companies ({dividends.length || "—"} stocks) —
            sourced live from the psxdata screener (price × yield = amount per share),
            enriched with the latest DPS announcement date via askanalyst.com.pk
            for the top yielders. Cached 1 hour server-side.
          </p>
        </div>

        {/* StockSearch — filter to a specific company */}
        <Card className="bg-[#131829] border-white/[0.08] mb-5">
          <CardContent className="p-4">
            <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1.5">
              Search company dividends (any of {dividends.length || 196}+ paying PSX stocks)
            </label>
            <StockSearch
              value={filterSymbol}
              onChange={(sym) => setFilterSymbol(sym)}
              placeholder="Search any PSX stock to view its dividend..."
            />
            {filterSymbol && (
              <p className="text-[11px] text-[#94A3B8] mt-2">
                Filtering dividends for:{" "}
                <span className="font-mono font-semibold text-[#00E676]">{filterSymbol}</span>
                <button
                  onClick={() => setFilterSymbol("")}
                  className="ml-2 text-[#64748B] hover:text-[#F4F7FB] underline"
                >
                  show all
                </button>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Issue 15: per-stock dividend history panel — shown when a symbol
            is selected via StockSearch. Lists ALL previous dividend
            announcements for that stock, latest first to oldest. Unchanged. */}
        {filterSymbol && (
          <Card className="bg-[#131829] border-[#00E676]/20 mb-5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-[#F4F7FB] flex items-center gap-2">
                    <History className="h-4 w-4 text-[#00E676]" />
                    Dividend history — {filterSymbol.toUpperCase()}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    All previous dividend announcements for{" "}
                    <span className="font-semibold text-[#F4F7FB]">{historyCompany || filterSymbol}</span>,
                    latest first to oldest · sourced from quarterly financial results.
                  </p>
                </div>
                {historyItems.length > 0 && (
                  <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#00E676]/40 text-[#00E676]">
                    {historyItems.length} DIVIDEND PAYOUTS
                  </Badge>
                )}
              </div>

              {historyLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 bg-white/[0.04]" />)}
                </div>
              ) : historyError ? (
                <div className="rounded-md bg-[#FF5C5C]/[0.07] border border-[#FF5C5C]/20 p-3 text-xs text-[#FF5C5C]">
                  <span className="font-semibold">Error:</span> {historyError}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="text-center py-6">
                  <Coins className="h-8 w-8 text-[#00E676]/30 mx-auto mb-2" />
                  <p className="text-xs text-[#94A3B8]">
                    No previous dividend payouts found for {filterSymbol.toUpperCase()}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {historyItems.map((h, i) => (
                    <div
                      key={`${h.period}-${h.periodEnd}-${i}`}
                      className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-3 flex items-center gap-3"
                    >
                      <div className="h-9 w-9 rounded-md bg-[#00E676]/10 flex items-center justify-center font-mono font-bold text-[#00E676] text-[10px] shrink-0">
                        {h.symbol.slice(0, 4)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#F4F7FB] text-sm">{h.period}</span>
                          <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24] uppercase flex items-center gap-1">
                            <CalendarClock className="h-2.5 w-2.5" />
                            {formatDate(h.periodEnd)}
                          </Badge>
                          {h.payoutRatio > 0 && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 border-white/[0.12] text-[#94A3B8]">
                              payout {h.payoutRatio.toFixed(0)}%
                            </Badge>
                          )}
                          {i === 0 && (
                            <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#00E676]/40 text-[#00E676] uppercase">
                              LATEST
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
                          {h.company}
                          {h.eps > 0 && (
                            <span className="text-[#64748B] ml-1.5">· EPS PKR {h.eps.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-bold text-[#00E676]">PKR {h.dps.toFixed(2)}</div>
                        <div className="text-[10px] text-[#64748B]">per share</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2.5 mt-3 text-[10px] text-[#64748B]">
                <span className="text-[#94A3B8] font-semibold">Source:</span> Quarterly financial
                results via <code className="text-[#00E676]">/api/psx/financial-results/{filterSymbol}</code> —
                filtered to quarters with DPS &gt; 0, sorted by period end (latest first).
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sort control (button-group) + summary stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 bg-white/[0.04]" />)}
          </div>
        ) : error ? null : (
          <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:flex-1">
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Maximum dividend</div>
                  <div className="text-2xl font-bold text-[#00E676] font-mono">PKR {maxDividend.toFixed(2)}</div>
                  <div className="text-[10px] text-[#94A3B8]">{maxDividendSymbol}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Highest yield</div>
                  <div className="text-2xl font-bold text-[#F4F7FB] font-mono">
                    {highestYield > 0 ? `${highestYield.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">{highestYield > 0 ? highestYieldSymbol : "—"}</div>
                </CardContent>
              </Card>
              <Card className="bg-[#131829] border-white/[0.08] col-span-2 md:col-span-1">
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Avg yield</div>
                  <div className="text-2xl font-bold text-[#F4F7FB] font-mono">
                    {avgYield > 0 ? `${avgYield.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">{dividends.length} payers</div>
                </CardContent>
              </Card>
            </div>

            {/* Sort control — button-group per issue 12 */}
            <div className="md:w-auto w-full">
              <label className="text-[10px] uppercase tracking-wider text-[#64748B] block mb-1.5">
                Sort by
              </label>
              <ToggleGroup
                type="single"
                value={sortMode}
                onValueChange={(v: string) => {
                  if (v) setSortMode(v as SortMode);
                }}
                variant="outline"
                className="w-full md:w-auto bg-[#0A0E1A] border border-white/[0.08] rounded-md"
              >
                <ToggleGroupItem
                  value="latest"
                  aria-label="Sort by latest ex-date"
                  className="data-[state=on]:bg-[#00E676]/15 data-[state=on]:text-[#00E676] data-[state=on]:border-[#00E676]/30 text-[#94A3B8] hover:text-[#F4F7FB] flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Latest
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="highest"
                  aria-label="Sort by highest amount"
                  className="data-[state=on]:bg-[#00E676]/15 data-[state=on]:text-[#00E676] data-[state=on]:border-[#00E676]/30 text-[#94A3B8] hover:text-[#F4F7FB] flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                >
                  <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                  Highest
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="lowest"
                  aria-label="Sort by lowest amount"
                  className="data-[state=on]:bg-[#00E676]/15 data-[state=on]:text-[#00E676] data-[state=on]:border-[#00E676]/30 text-[#94A3B8] hover:text-[#F4F7FB] flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                >
                  <ArrowUpWideNarrow className="h-3.5 w-3.5" />
                  Lowest
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        )}

        {/* Dividend list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 bg-white/[0.04]" />)}
          </div>
        ) : error ? (
          <div className="rounded-md bg-[#FF5C5C]/[0.07] border border-[#FF5C5C]/20 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#FF5C5C] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-[#FF5C5C]">Failed to load dividends</div>
              <div className="text-xs text-[#94A3B8] mt-1">{error}</div>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  fetch("/api/dividends/all")
                    .then((r) => r.json())
                    .then((d) => {
                      setDividends(d.dividends || []);
                      setFetchedAt(d.fetchedAt || null);
                      setCached(Boolean(d.cached));
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
                className="text-xs text-[#00E676] hover:underline mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Coins className="h-10 w-10 text-[#00E676]/30 mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">
              {filterSymbol
                ? `No dividend announcements found for ${filterSymbol}.`
                : "No dividend announcements available."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1
                          [scrollbar-color:#00E67633_transparent]
                          [scrollbar-width:thin]
                          [&::-webkit-scrollbar]:w-1.5
                          [&::-webkit-scrollbar-thumb]:bg-white/[0.1]
                          [&::-webkit-scrollbar-thumb]:rounded-full
                          [&::-webkit-scrollbar-track]:bg-transparent">
            {sorted.map((d) => {
              const isAlerted = alerts.has(d.symbol);
              const showBell = isFutureDate(d.exDate);
              return (
                <Card
                  key={`${d.symbol}-${d.source}`}
                  className={`bg-[#131829] ${
                    isAlerted ? "border-[#FBBF24]/40" : "border-white/[0.08]"
                  } hover:border-[#00E676]/30 transition-colors`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Symbol */}
                      <div className="h-12 w-12 rounded-lg bg-[#00E676]/10 flex items-center justify-center font-mono font-bold text-[#00E676] shrink-0">
                        {d.symbol.slice(0, 4)}
                      </div>

                      {/* Main */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#F4F7FB]">{d.symbol}</span>
                          {d.sector && (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 h-4 border-white/[0.12] text-[#94A3B8] uppercase truncate max-w-[200px]"
                              title={d.sector}
                            >
                              {d.sector}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[9px] py-0 h-4 uppercase flex items-center gap-1 ${
                              showBell
                                ? "border-[#FBBF24]/40 text-[#FBBF24]"
                                : d.exDate
                                ? "border-white/[0.12] text-[#64748B]"
                                : "border-white/[0.08] text-[#475569]"
                            }`}
                          >
                            <CalendarClock className="h-2.5 w-2.5" />
                            Last date to buy/hold: {formatDate(d.exDate)}
                          </Badge>
                          {d.source === "screener+financials" && (
                            <Badge
                              variant="outline"
                              className="text-[8px] py-0 h-3.5 border-[#00E676]/30 text-[#00E676]/80"
                            >
                              LIVE
                            </Badge>
                          )}
                          {d.exDate && !showBell && (
                            <Badge
                              variant="outline"
                              className="text-[8px] py-0 h-3.5 border-white/[0.12] text-[#64748B] uppercase"
                            >
                              PAST
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-[#94A3B8] mt-0.5 truncate">{d.company}</div>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-bold text-[#F4F7FB]">
                          PKR {d.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#64748B]">per share</div>
                      </div>

                      {/* Yield */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <div className="text-sm font-mono font-bold text-[#00E676]">
                          {d.yieldPct.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-[#64748B]">yield</div>
                      </div>

                      {/* Bell alert — only on future ex-dates */}
                      {showBell ? (
                        <button
                          onClick={() => toggleAlert(d.symbol)}
                          title={isAlerted ? `Alert active — click to remove` : `Set alert for ${d.symbol} dividend`}
                          className={`shrink-0 h-9 w-9 rounded-md flex items-center justify-center transition-colors ${
                            isAlerted
                              ? "bg-[#FBBF24]/15 text-[#FBBF24] hover:bg-[#FBBF24]/25"
                              : "text-[#64748B] hover:text-[#F4F7FB] hover:bg-white/[0.04]"
                          }`}
                          aria-label={isAlerted ? "Remove dividend alert" : "Set dividend alert"}
                          aria-pressed={isAlerted}
                        >
                          {isAlerted ? (
                            <BellRing className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <div
                          className="shrink-0 h-9 w-9 rounded-md flex items-center justify-center text-[#475569]/40"
                          title="Last date to buy/hold is in the past — alert not available"
                          aria-hidden="true"
                        >
                          <Bell className="h-4 w-4 opacity-30" />
                        </div>
                      )}
                    </div>

                    {/* Alert active banner — only when bell is shown AND alert is set */}
                    {showBell && isAlerted && (
                      <div className="mt-3 pt-3 border-t border-[#FBBF24]/20 flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-[#FBBF24]" />
                        <span className="text-[10px] uppercase tracking-wider text-[#FBBF24] font-semibold">
                          Alert active:
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">
                          You&apos;ll be notified before {d.symbol}&apos;s last date to buy/hold ({formatDate(d.exDate)}) so you can position for the dividend.
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Loading banner during live fetch */}
        {loading && (
          <div className="rounded-md bg-[#0A0E1A] border border-[#00E676]/20 p-3 mt-4 flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 text-[#00E676] animate-spin" />
            <span className="text-[11px] text-[#94A3B8]">
              Fetching all dividend-paying stocks from psxdata screener + askanalyst...
            </span>
          </div>
        )}

        <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed mt-6">
          <span className="text-[#94A3B8] font-semibold">Dividends note:</span>{" "}
          Live bulk source: <code className="text-[#00E676]">/api/dividends/all</code> —
          fetches ALL dividend-paying PSX stocks (~196 of 750) from the psxdata
          screener, derives the per-share amount as <span className="text-[#94A3B8]">price × dividend_yield / 100</span>,
          and enriches the top {TOP_K_ENRICH_LABEL} highest yielders with the latest DPS
          quarter-end (via askanalyst incomestatement) as the ex-date proxy. Cached
          server-side for 1 hour.
          {fetchedAt && (
            <span className="block mt-1.5">
              <span className="text-[#94A3B8] font-semibold">Last fetch:</span>{" "}
              {formatDate(fetchedAt)}
              {cached && " (served from cache)"}
            </span>
          )}
          <span className="block mt-1.5">
            Sort options: <span className="text-[#00E676]">Latest</span> (by ex-date, newest first — rows
            without an ex-date come after, by amount),{" "}
            <span className="text-[#00E676]">Highest</span> (by amount per share, descending),{" "}
            <span className="text-[#00E676]">Lowest</span> (by amount, ascending).
          </span>
        </div>
      </main>
    </div>
  );
}

// Constant for the footer note (mirrors the API's TOP_K_ENRICH).
const TOP_K_ENRICH_LABEL = "40";
