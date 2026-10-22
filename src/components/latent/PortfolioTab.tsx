"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppNav } from "./AppNav";
import { StockSearch } from "./StockSearch";
import { useLatentStore, type PortfolioPosition } from "@/lib/latent/store";
import { MOCK_STOCKS } from "@/lib/latent/mock-stocks";
import {
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Briefcase,
  Minus,
  Trash2,
  Wallet,
  Calculator,
  CalendarClock,
  Check,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface CompanyInfo { id: number; value: string; label: string; sector?: string; image?: string; }

// ─── Issue 13: Close-trade calculation helpers ─────────────────────────────
// Pakistan capital-gains tax on PSX equities (2024 budget):
//   - holding period ≤ 12 months → 15% CGT on profit (short-term)
//   - holding period > 12 months → 0% CGT (long-term, exempt)
// Losses are not taxed (no tax credit) — CGT applies only on positive profit.
// Broker commission: 0.15% × sell value × 2 (both sides — buy + sell).
interface CloseTarget {
  symbol: string;
  name: string;
  sector?: string | null;
  buyPrice: number;
  shares: number;
  addedAt: string;
}

interface CloseCalc {
  sellPrice: number;
  buyCost: number;
  sellValue: number;
  commission: number;
  holdingDays: number;
  holdingMonths: number;
  taxRate: number; // 0.15 short-term, 0 long-term
  cgt: number;
  grossPnl: number;
  netPnl: number;
  netPnlPct: number;
}

function computeCloseMetrics(
  buyPrice: number,
  shares: number,
  sellPrice: number,
  addedAt: string
): CloseCalc {
  const buyCost = buyPrice * shares;
  const sellValue = sellPrice * shares;
  // Broker commission = 0.15% × sell value, applied on both sides (buy + sell).
  // Using sellValue as the base for both sides per spec ("0.15% × sell value (both sides)").
  const commission = 0.0015 * sellValue * 2;
  const holdingDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(addedAt).getTime()) / (1000 * 60 * 60 * 24))
  );
  const holdingMonths = Math.floor(holdingDays / 30);
  // CGT: 15% for ≤12 months (short-term), 0% for >12 months (long-term)
  const taxRate = holdingDays <= 365 ? 0.15 : 0;
  const grossPnl = sellValue - buyCost;
  // CGT only on positive profit (no tax credit for losses)
  const cgt = grossPnl > 0 ? grossPnl * taxRate : 0;
  const netPnl = grossPnl - commission - cgt;
  const netPnlPct = buyCost > 0 ? (netPnl / buyCost) * 100 : 0;
  return {
    sellPrice,
    buyCost,
    sellValue,
    commission,
    holdingDays,
    holdingMonths,
    taxRate,
    cgt,
    grossPnl,
    netPnl,
    netPnlPct,
  };
}

// ─── Issue 15: batched LIVE quote fetcher for portfolio holdings ────────────
// Hits our own /api/psx/live/batch endpoint, which server-side calls
// `getLiveQuote` (60s in-memory cache per symbol) for each portfolio symbol
// in parallel via Promise.all. Returns the latest LIVE PSX price for each
// symbol, plus isLoading / refresh / lastUpdated for the UI.
//
// Used by PortfolioTab to:
//   - render per-position live P&L (green/red) on open holdings (Issue 15)
//   - compute the total portfolio P&L summary card (Issue 15)
//   - show per-row live price on watch-only items (free upgrade)
//   - skeleton-while-loading + manual Refresh button + 60s auto-refresh
//
// Implementation note: setState is only called inside async .then callbacks
// (NOT synchronously in the effect body) to avoid React 19's
// `react-hooks/set-state-in-effect` cascading-render warning. The "loading"
// state is derived from `state.key !== key` (data is stale until the new
// fetch for the current symbol-set resolves) plus an explicit `loading`
// flag set inside the `refresh` event handler.
function usePortfolioLiveQuotes(symbols: string[]): {
  prices: Record<string, number>;
  isLoading: boolean;
  refresh: () => void;
  lastUpdated: Date | null;
} {
  const key = symbols.join(",");
  const [state, setState] = useState<{
    key: string;
    prices: Record<string, number>;
    lastUpdated: Date | null;
    loading: boolean;
  }>({ key: "", prices: {}, lastUpdated: null, loading: false });
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const symbolsList = key.split(",");
    fetch(`/api/psx/live/batch?symbols=${encodeURIComponent(symbolsList.join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && d.prices && typeof d.prices === "object") {
          setState({
            key,
            prices: d.prices as Record<string, number>,
            lastUpdated: new Date(d.fetchedAt || Date.now()),
            loading: false,
          });
        } else {
          // Even if no prices resolved, mark this key as "fetched" so
          // isLoading flips to false and rows show "no live price" instead
          // of a skeleton.
          setState({ key, prices: {}, lastUpdated: new Date(), loading: false });
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Keep stale prices if any; mark this key as attempted so the
        // skeleton goes away.
        setState((s) => ({ key, prices: s.key === key ? s.prices : {}, lastUpdated: new Date(), loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, refreshTick]);

  // Auto-refresh every 60s — matches getLiveQuote's 60s cache TTL so the
  // dashboard P&L stays current without manual button clicks.
  useEffect(() => {
    if (!key) return;
    const id = setInterval(() => setRefreshTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [key]);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
    setState((s) => ({ ...s, loading: true }));
  }, []);

  // Derive public state:
  //   - prices: valid only when state.key === key (otherwise stale → empty)
  //   - isLoading: true if we have no data yet for the current key OR a
  //     refresh is explicitly in progress
  const hasData = state.key === key;
  const prices = hasData ? state.prices : {};
  const lastUpdated = hasData ? state.lastUpdated : null;
  const isLoading = !!key && (!hasData || state.loading);
  return { prices, isLoading, refresh, lastUpdated };
}

export function PortfolioTab() {
  const portfolio = useLatentStore((s) => s.portfolio);
  const addPosition = useLatentStore((s) => s.addPortfolioPosition);
  const removePosition = useLatentStore((s) => s.removePortfolioPosition);
  const reorder = useLatentStore((s) => s.reorderPortfolio);
  const setView = useLatentStore((s) => s.setView);
  const pushNotification = useLatentStore((s) => s.pushNotification);
  const closePositionFromPortfolio = useLatentStore((s) => s.closePositionFromPortfolio);

  const [addOpen, setAddOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | undefined>(undefined);
  const [buyPrice, setBuyPrice] = useState<string>("");
  const [shares, setShares] = useState<string>("");

  // ─── Issue 13: Close-trade dialog state ───
  const [closeTarget, setCloseTarget] = useState<CloseTarget | null>(null);
  const [closeSellPrice, setCloseSellPrice] = useState<string>("");
  const [closePriceLoading, setClosePriceLoading] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const handleAdd = () => {
    if (!selectedSymbol) {
      toast.error("Pick a stock first");
      return;
    }
    // Issue 19 behavior: until the user specifies shares (volume), the stock
    // is added as "watch only" (no P&L tracking). This is intentional — the
    // user can add shares later. We do not move it to "holdings" until
    // both buyPrice AND shares are provided.
    const name = selectedName || selectedSymbol;
    addPosition({
      symbol: selectedSymbol,
      name,
      sector: selectedSector || undefined,
      buyPrice: buyPrice ? parseFloat(buyPrice) : null,
      shares: shares ? parseInt(shares) : 0,
    });
    pushNotification({
      type: "info",
      title: "Stock added to portfolio",
      body: `${selectedSymbol} added${shares ? ` (${shares} shares${buyPrice ? ` @ PKR ${buyPrice}` : ""})` : " (watch only)"}`,
      linkView: "portfolio",
    });
    toast.success(`${selectedSymbol} added to portfolio${shares ? " with " + shares + " shares" : " (watch only)"}`);
    setAddOpen(false);
    setSelectedSymbol("");
    setSelectedName("");
    setSelectedSector(undefined);
    setBuyPrice("");
    setShares("");
  };

  const sorted = [...portfolio].sort((a, b) => a.order - b.order);

  // ─── Issue 10: separate HOLDINGS from WATCHLIST ─────────────────────────
  // A position is a "holding" ONLY if it has shares > 0 AND a non-null
  // buyPrice (a real, open position). Watch-only items (shares=0 OR
  // buyPrice=null) do NOT count toward the holdings summary / total P&L.
  // The store distinguishes via the shares/buyPrice fields — see
  // PortfolioPosition shape in src/lib/latent/store.ts.
  const isHolding = (p: PortfolioPosition) =>
    p.shares > 0 && p.buyPrice !== null && p.buyPrice !== undefined;
  // Pre-compute (position, sortedIdx) pairs so each rendered row knows its
  // original index in `sorted` for the reorder controls (moveUp/moveDown).
  const holdingsWithIdx = useMemo(
    () =>
      sorted
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => isHolding(p)),
    [sorted]
  );
  const watchlistWithIdx = useMemo(
    () =>
      sorted
        .map((p, idx) => ({ p, idx }))
        .filter(({ p }) => !isHolding(p)),
    [sorted]
  );
  const holdings = useMemo(() => holdingsWithIdx.map(({ p }) => p), [holdingsWithIdx]);
  const watchlist = useMemo(() => watchlistWithIdx.map(({ p }) => p), [watchlistWithIdx]);

  // Issue 15: fetch LIVE prices via getLiveQuote (batched server-side) for
  // all portfolio symbols — both holdings and watchlist. Used for per-row
  // live P&L on holdings and per-row live price on watch-only items.
  const symbols = sorted.map((p) => p.symbol);
  const {
    prices: livePrices,
    isLoading: pricesLoading,
    refresh: refreshPrices,
    lastUpdated: pricesLastUpdated,
  } = usePortfolioLiveQuotes(symbols);

  // ─── Issue 13: open the Close dialog and fetch the latest price ───
  // Pre-fills the sell price input with the cached live quote (getLiveQuote
  // via /api/psx/live/batch) for the symbol, then re-fetches a fresh quote
  // server-side for the dialog so the user has the most recent fill.
  // Preserves the close-trade flow: CGT + broker commission calc, holding
  // period detection, closed-trade record push to the Tracker.
  const openCloseDialog = (p: PortfolioPosition) => {
    if (!p.buyPrice || !p.shares) {
      toast.error("This stock has no shares to close");
      return;
    }
    const target: CloseTarget = {
      symbol: p.symbol,
      name: p.name,
      sector: p.sector,
      buyPrice: p.buyPrice as number,
      shares: p.shares,
      addedAt: p.addedAt,
    };
    setCloseTarget(target);
    // Pre-fill with cached live price if available (from /api/psx/live/batch)
    const cached = livePrices[p.symbol];
    setCloseSellPrice(
      typeof cached === "number"
        ? cached.toFixed(2)
        : (p.buyPrice as number).toFixed(2)
    );

    // Re-fetch a fresh live quote for the close-trade dialog so the user has
    // the most recent fill price (uses getLiveQuote's 60s cache server-side).
    setClosePriceLoading(true);
    fetch(`/api/psx/live?symbol=${encodeURIComponent(p.symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (typeof d.price === "number" && d.price > 0) {
          setCloseSellPrice(d.price.toFixed(2));
        } else if (typeof d.close === "number" && d.close > 0) {
          setCloseSellPrice(d.close.toFixed(2));
        }
      })
      .catch(() => {
        // ignore — user can manually enter the sell price
      })
      .finally(() => setClosePriceLoading(false));
  };

  // Compute close metrics reactively from current sellPrice input
  const closeCalc = useMemo<CloseCalc | null>(() => {
    if (!closeTarget) return null;
    const sp = parseFloat(closeSellPrice.replace(/[,\s]/g, ""));
    if (!Number.isFinite(sp) || sp <= 0) return null;
    return computeCloseMetrics(
      closeTarget.buyPrice,
      closeTarget.shares,
      sp,
      closeTarget.addedAt
    );
  }, [closeTarget, closeSellPrice]);

  const confirmCloseTrade = () => {
    if (!closeTarget || !closeCalc) {
      toast.error("Enter a valid sell price to close");
      return;
    }
    setCloseSubmitting(true);
    const t = closeTarget;
    const c = closeCalc;
    const closedTrade = {
      id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      symbol: t.symbol,
      name: t.name,
      sector: t.sector ?? null,
      buyPrice: t.buyPrice,
      shares: t.shares,
      sellPrice: c.sellPrice,
      buyCost: c.buyCost,
      sellValue: c.sellValue,
      commission: c.commission,
      cgt: c.cgt,
      grossPnl: c.grossPnl,
      netPnl: c.netPnl,
      netPnlPct: c.netPnlPct,
      holdingDays: c.holdingDays,
      taxRate: c.taxRate,
      closedAt: new Date().toISOString(),
    };
    closePositionFromPortfolio(t.symbol, closedTrade);
    pushNotification({
      type: "info",
      title: `${t.symbol} closed — Net P&L PKR ${Math.round(c.netPnl).toLocaleString()}`,
      body: `Sold ${t.shares} sh @ ${c.sellPrice.toFixed(2)} · commission PKR ${Math.round(c.commission).toLocaleString()} · CGT PKR ${Math.round(c.cgt).toLocaleString()} (${(c.taxRate * 100).toFixed(0)}% bracket) · holding ${c.holdingDays}d. Position reset to watch-only.`,
      linkView: "tracker",
    });
    toast.success(
      `${t.symbol} closed — Net P&L PKR ${Math.round(c.netPnl).toLocaleString()} (${c.netPnlPct >= 0 ? "+" : ""}${c.netPnlPct.toFixed(2)}%). Position reset to watch-only.`
    );
    setCloseTarget(null);
    setCloseSellPrice("");
    setCloseSubmitting(false);
  };

  // ─── Issue 15: Holdings-only totals (watchlist does NOT count) ──────────
  // Per-position: current value = shares × livePrice, P&L = (livePrice −
  // buyPrice) × shares, P&L% = ((livePrice − buyPrice)/buyPrice) × 100.
  // Totals: sum of all holdings' cost/value/P&L → portfolio summary cards.
  const totalCost = useMemo(
    () => holdings.reduce((sum, p) => sum + p.shares * (p.buyPrice as number), 0),
    [holdings]
  );
  const totalValue = useMemo(
    () =>
      holdings.reduce((sum, p) => {
        const live = livePrices[p.symbol];
        if (typeof live === "number") return sum + p.shares * live;
        // Fallback to MOCK_STOCKS price when fetch hasn't resolved or failed
        const stock = MOCK_STOCKS.find((s) => s.symbol === p.symbol);
        return stock ? sum + p.shares * stock.price : sum;
      }, 0),
    [holdings, livePrices]
  );
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const hasLivePrices = Object.keys(livePrices).length > 0;

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    reorder(idx, idx - 1);
  };
  const moveDown = (idx: number) => {
    if (idx === sorted.length - 1) return;
    reorder(idx, idx + 1);
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <AppNav />
      <main className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#F4F7FB]">Portfolio & Watchlist</h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              Add stocks, drag-to-reorder, optional buy price triggers P&L tracking + suggestions.
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold">
                <Plus className="h-4 w-4 mr-1.5" />
                Add stock
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#131829] border-white/[0.12]">
              <DialogHeader>
                <DialogTitle className="text-[#F4F7FB]">Add to portfolio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">
                    Select stock (any of 1000+ PSX-listed companies)
                  </Label>
                  <StockSearch
                    value={selectedSymbol}
                    onChange={(sym: string, company?: CompanyInfo) => {
                      setSelectedSymbol(sym);
                      setSelectedName(company?.label || "");
                      setSelectedSector(company?.sector);
                      // Don't pre-fill buy price — user must explicitly enter it.
                      setBuyPrice("");
                    }}
                    placeholder="Search any PSX stock by symbol or name..."
                  />
                  {selectedSymbol && (
                    <div className="text-[11px] text-[#94A3B8] mt-1">
                      Selected: <span className="font-mono font-semibold text-[#00E676]">{selectedSymbol}</span>
                      {selectedName && <span className="text-[#64748B]"> — {selectedName}</span>}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Buy price (optional)</Label>
                    <Input
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="e.g. 285"
                      type="number"
                      className="bg-[#0A0E1A] border-white/[0.12] text-[#F4F7FB] font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">
                      Shares (optional — required for P&L tracking)
                    </Label>
                    <Input
                      value={shares}
                      onChange={(e) => setShares(e.target.value)}
                      placeholder="e.g. 100"
                      type="number"
                      className="bg-[#0A0E1A] border-white/[0.12] text-[#F4F7FB] font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  <span className="text-[#94A3B8] font-semibold">Issue 19 behavior:</span>{' '}
                  The stock is <span className="text-[#00E676] font-semibold">not moved to holdings</span> until
                  you specify the number of shares. Leaving shares empty adds the stock as a
                  <span className="text-[#FBBF24] font-semibold"> watch-only item</span> (no P&L tracking). You can add shares later.
                </p>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedSymbol}
                  className="w-full bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold"
                >
                  {selectedSymbol
                    ? `Add ${selectedSymbol}${shares ? ` (${shares} shares)` : " (watch only)"}`
                    : "Add to portfolio"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ─── Portfolio summary — Holdings only (Issue 10 + 15) ─────────────── */}
        {/* Watch-only items do NOT count toward cost basis / market value / P&L. */}
        {sorted.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-end gap-2 mb-2">
              {pricesLastUpdated && (
                <span className="text-[10px] text-[#64748B] font-mono">
                  Live prices updated {pricesLastUpdated.toLocaleTimeString()}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshPrices}
                disabled={pricesLoading}
                className="border-white/[0.12] text-[#94A3B8] h-7"
              >
                {pricesLoading ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                )}
                Refresh prices
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Holdings count (real positions only) */}
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Holdings</div>
                  {pricesLoading && !hasLivePrices ? (
                    <Skeleton className="h-7 w-12 bg-white/[0.04] mt-1" />
                  ) : (
                    <div className="text-xl font-bold text-[#F4F7FB] font-mono">{holdings.length}</div>
                  )}
                  <div className="text-[10px] text-[#64748B] mt-0.5">
                    {watchlist.length} watch-only
                  </div>
                </CardContent>
              </Card>
              {/* Cost basis — sum of (shares × buyPrice) over holdings */}
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Cost basis</div>
                  {pricesLoading && !hasLivePrices ? (
                    <Skeleton className="h-7 w-24 bg-white/[0.04] mt-1" />
                  ) : (
                    <div className="text-xl font-bold text-[#F4F7FB] font-mono">
                      PKR {totalCost.toLocaleString()}
                    </div>
                  )}
                  <div className="text-[10px] text-[#64748B] mt-0.5">total invested</div>
                </CardContent>
              </Card>
              {/* Market value — sum of (shares × livePrice) over holdings */}
              <Card className="bg-[#131829] border-white/[0.08]">
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Market value</div>
                  {pricesLoading && !hasLivePrices ? (
                    <Skeleton className="h-7 w-24 bg-white/[0.04] mt-1" />
                  ) : (
                    <div className="text-xl font-bold text-[#F4F7FB] font-mono">
                      PKR {totalValue.toLocaleString()}
                    </div>
                  )}
                  <div className="text-[10px] text-[#64748B] mt-0.5">live</div>
                </CardContent>
              </Card>
              {/* Total P&L = market value − cost basis */}
              <Card className={`bg-[#131829] ${totalPnL >= 0 ? "border-[#00E676]/30" : "border-[#FF5C5C]/30"}`}>
                <CardContent className="p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#64748B]">Total P&L</div>
                  {pricesLoading && !hasLivePrices ? (
                    <Skeleton className="h-7 w-32 bg-white/[0.04] mt-1" />
                  ) : (
                    <div className={`text-xl font-bold font-mono ${totalPnL >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                      {totalPnL >= 0 ? "+" : ""}{totalPnL.toLocaleString()} ({totalPnLPct.toFixed(2)}%)
                    </div>
                  )}
                  <div className="text-[10px] text-[#64748B] mt-0.5">overall</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Empty state — no stocks at all */}
        {sorted.length === 0 ? (
          <Card className="bg-[#131829] border-white/[0.08]">
            <CardContent className="p-12 text-center">
              <Briefcase className="h-12 w-12 text-[#00E676]/30 mx-auto mb-3" />
              <h3 className="font-semibold text-[#F4F7FB] mb-1">No stocks in your portfolio yet</h3>
              <p className="text-xs text-[#94A3B8] mb-4">
                Add stocks to track them. Specify buy price + shares to enable live P&L tracking and hold/sell/buy-more suggestions.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                className="bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881]"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add your first stock
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ─── Holdings section (Issue 10) — real positions with live P&L ─── */}
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4 text-[#00E676]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F4F7FB]">Holdings</h2>
                <Badge variant="outline" className="text-[9px] py-0 h-4 border-white/[0.12] text-[#94A3B8]">
                  {holdings.length} open
                </Badge>
                <span className="text-[10px] text-[#64748B] ml-1">real positions · live P&amp;L tracked</span>
              </div>

              {holdings.length === 0 ? (
                <div className="rounded-lg border border-white/[0.06] bg-[#131829] p-6 text-center">
                  <Wallet className="h-8 w-8 text-[#64748B]/40 mx-auto mb-2" />
                  <p className="text-xs text-[#94A3B8] mb-1">No open positions yet</p>
                  <p className="text-[10px] text-[#64748B]">
                    Add a stock with shares + buy price to start tracking live P&amp;L.
                  </p>
                </div>
              ) : pricesLoading && !hasLivePrices ? (
                <div className="space-y-2">
                  {holdings.map((p, idx) => (
                    <Skeleton
                      key={`${p.symbol}-${idx}-sk`}
                      className="h-20 w-full bg-[#131829] border border-white/[0.06]"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 latent-scroll">
                  {holdingsWithIdx.map(({ p, idx }, i) => {
                    const livePrice = livePrices[p.symbol];
                    const mockStock = MOCK_STOCKS.find((s) => s.symbol === p.symbol);
                    const currentPrice: number | null =
                      typeof livePrice === "number"
                        ? livePrice
                        : mockStock
                          ? mockStock.price
                          : null;
                    const pnl =
                      currentPrice !== null
                        ? (currentPrice - (p.buyPrice as number)) * p.shares
                        : 0;
                    const pnlPct =
                      currentPrice !== null
                        ? ((currentPrice - (p.buyPrice as number)) / (p.buyPrice as number)) * 100
                        : 0;
                    const isProfit = pnl > 0;
                    const isLoss = pnl < 0;
                    const currentValue =
                      currentPrice !== null ? p.shares * currentPrice : null;
                    const suggestion =
                      currentPrice === null
                        ? "Live price unavailable — check quote source"
                        : isProfit && pnlPct > 15
                          ? "Take partial profit — book 30-50% of position"
                          : isProfit
                            ? "Hold — trend still intact"
                            : isLoss && pnlPct < -10
                              ? "Consider averaging down on next dip — improve cost basis"
                              : isLoss
                                ? "Hold — within normal volatility. Stop-loss not hit."
                                : "Hold — at breakeven";

                    return (
                      <Card
                        key={`${p.symbol}-${i}`}
                        className={`bg-[#131829] border-white/[0.08] ${isProfit ? "border-l-[#00E676]/60" : isLoss ? "border-l-[#FF5C5C]/60" : ""}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Reorder controls */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveUp(idx)}
                                disabled={idx === 0}
                                className={`text-[#64748B] hover:text-[#F4F7FB] ${idx === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moveDown(idx)}
                                disabled={idx === sorted.length - 1}
                                className={`text-[#64748B] hover:text-[#F4F7FB] ${idx === sorted.length - 1 ? "opacity-30 cursor-not-allowed" : ""}`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Symbol */}
                            <div className="h-10 w-10 rounded-lg bg-[#00E676]/10 flex items-center justify-center font-mono font-bold text-[#00E676] text-sm">
                              {p.symbol.slice(0, 4)}
                            </div>

                            {/* Main */}
                            <button
                              onClick={() => {
                                setView("signals_v2");
                                toast.info(`Opening analysis for ${p.symbol}...`);
                              }}
                              className="flex-1 text-left hover:opacity-80"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#F4F7FB]">{p.symbol}</span>
                                <Badge variant="outline" className={`text-[9px] py-0 h-4 ${isProfit ? "border-[#00E676]/40 text-[#00E676]" : isLoss ? "border-[#FF5C5C]/40 text-[#FF5C5C]" : "border-white/[0.12] text-[#94A3B8]"}`}>
                                  {isProfit ? "PROFIT" : isLoss ? "LOSS" : "BREAK EVEN"}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-[#94A3B8] truncate max-w-[300px]">{p.name}</div>
                              <div className="text-[10px] text-[#64748B] mt-0.5 font-mono">
                                Buy: {p.buyPrice} × {p.shares} = PKR {((p.buyPrice as number) * p.shares).toLocaleString()}
                              </div>
                            </button>

                            {/* Price + P&L (Issue 15) */}
                            <div className="text-right shrink-0">
                              <div className="text-sm font-mono font-bold text-[#F4F7FB]">
                                {currentPrice !== null ? currentPrice.toLocaleString() : "—"}
                              </div>
                              <div className="text-[10px] text-[#64748B]">
                                {currentPrice !== null ? "live" : "no live price"}
                              </div>
                              {currentPrice !== null && (
                                <div className={`text-xs font-mono font-bold ${isProfit ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`}>
                                  {pnl >= 0 ? "+" : ""}{pnl.toLocaleString()} ({pnlPct.toFixed(1)}%)
                                </div>
                              )}
                              {currentValue !== null && (
                                <div className="text-[9px] text-[#64748B] font-mono mt-0.5">
                                  val PKR {currentValue.toLocaleString()}
                                </div>
                              )}
                            </div>

                            {/* Close / Remove */}
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <button
                                onClick={() => openCloseDialog(p)}
                                className="text-[#64748B] hover:text-[#00E676] px-1.5 py-1 rounded-md hover:bg-[#00E676]/10 transition-colors"
                                title="Close trade — sell all shares and lock in P&L"
                              >
                                <Wallet className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  removePosition(p.symbol);
                                  toast.info(`${p.symbol} removed from portfolio`);
                                }}
                                className="text-[#64748B] hover:text-[#FF5C5C] px-1.5 py-1 rounded-md hover:bg-[#FF5C5C]/10 transition-colors"
                                title="Remove from portfolio"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Suggestion */}
                          {suggestion && (
                            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-start gap-2">
                              {isProfit ? <TrendingUp className="h-3 w-3 text-[#00E676] mt-0.5" /> :
                               isLoss ? <TrendingDown className="h-3 w-3 text-[#FF5C5C] mt-0.5" /> :
                               <Minus className="h-3 w-3 text-[#94A3B8] mt-0.5" />}
                              <div>
                                <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">
                                  Suggestion:
                                </span>
                                <span className="text-xs text-[#94A3B8] ml-1.5">{suggestion}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ─── Watchlist section (Issue 10) — watch-only, NOT in holdings ─── */}
            {watchlist.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-[#FBBF24]" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F4F7FB]">Watchlist</h2>
                  <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24]">
                    {watchlist.length} watching
                  </Badge>
                  <span className="text-[10px] text-[#64748B] ml-1">
                    watch-only — not counted in holdings P&amp;L
                  </span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 latent-scroll">
                  {watchlistWithIdx.map(({ p, idx }, i) => {
                    const livePrice = livePrices[p.symbol];
                    const mockStock = MOCK_STOCKS.find((s) => s.symbol === p.symbol);
                    const currentPrice: number | null =
                      typeof livePrice === "number"
                        ? livePrice
                        : mockStock
                          ? mockStock.price
                          : null;
                    return (
                      <Card
                        key={`${p.symbol}-${i}-w`}
                        className="bg-[#131829] border-white/[0.08] border-l-[#FBBF24]/40"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Reorder */}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => moveUp(idx)}
                                disabled={idx === 0}
                                className={`text-[#64748B] hover:text-[#F4F7FB] ${idx === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => moveDown(idx)}
                                disabled={idx === sorted.length - 1}
                                className={`text-[#64748B] hover:text-[#F4F7FB] ${idx === sorted.length - 1 ? "opacity-30 cursor-not-allowed" : ""}`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Symbol (amber accent for watch-only) */}
                            <div className="h-10 w-10 rounded-lg bg-[#FBBF24]/10 flex items-center justify-center font-mono font-bold text-[#FBBF24] text-sm">
                              {p.symbol.slice(0, 4)}
                            </div>

                            {/* Main */}
                            <button
                              onClick={() => {
                                setView("signals_v2");
                                toast.info(`Opening analysis for ${p.symbol}...`);
                              }}
                              className="flex-1 text-left hover:opacity-80"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#F4F7FB]">{p.symbol}</span>
                                <Badge variant="outline" className="text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24]">
                                  WATCHING
                                </Badge>
                              </div>
                              <div className="text-[11px] text-[#94A3B8] truncate max-w-[300px]">{p.name}</div>
                              <div className="text-[10px] text-[#64748B] mt-0.5">
                                Added {new Date(p.addedAt).toLocaleDateString()} · no position yet
                              </div>
                            </button>

                            {/* Live price (no P&L — watch-only) */}
                            <div className="text-right shrink-0">
                              {pricesLoading && currentPrice === null ? (
                                <Skeleton className="h-5 w-16 bg-white/[0.04] ml-auto" />
                              ) : (
                                <div className="text-sm font-mono font-bold text-[#F4F7FB]">
                                  {currentPrice !== null ? currentPrice.toLocaleString() : "—"}
                                </div>
                              )}
                              <div className="text-[10px] text-[#64748B]">
                                {currentPrice !== null ? "live" : "no live price"}
                              </div>
                            </div>

                            {/* Remove */}
                            <button
                              onClick={() => {
                                removePosition(p.symbol);
                                toast.info(`${p.symbol} removed from watchlist`);
                              }}
                              className="text-[#64748B] hover:text-[#FF5C5C] px-1.5 py-1 rounded-md hover:bg-[#FF5C5C]/10 transition-colors shrink-0 ml-2"
                              title="Remove from watchlist"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <div className="rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed mt-6">
          <span className="text-[#94A3B8] font-semibold">Tip:</span> Click any stock in your portfolio to open its full analysis (fundamentals + technicals + AI model call). Drag the up/down arrows to reorder your list. Buy price is optional — leave empty for watch-only stocks.
        </div>

        {/* Auto-News Digest — fetched from AskAnalyst + interpreted by GLM-4 */}
        <PortfolioNewsDigest
          symbols={
            portfolio.length > 0
              ? portfolio.map((p) => p.symbol)
              : MOCK_STOCKS.slice(0, 4).map((s) => s.symbol)
          }
        />

        {/* ─── Issue 13: Close-trade dialog ─── */}
        <Dialog open={!!closeTarget} onOpenChange={(open) => {
          if (!open) {
            setCloseTarget(null);
            setCloseSellPrice("");
          }
        }}>
          <DialogContent className="bg-[#131829] border-white/[0.12] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#F4F7FB] flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#00E676]" />
                Close trade — {closeTarget?.symbol}
              </DialogTitle>
            </DialogHeader>
            {closeTarget && (
              <div className="space-y-4 py-2">
                {/* Header info */}
                <div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#F4F7FB]">{closeTarget.symbol}</div>
                      <div className="text-[11px] text-[#94A3B8] truncate max-w-[260px]">{closeTarget.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-[#64748B]">Buy price × shares</div>
                      <div className="font-mono text-sm text-[#F4F7FB]">
                        {closeTarget.buyPrice.toFixed(2)} × {closeTarget.shares.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sell price input */}
                <div className="space-y-2">
                  <Label className="text-[#94A3B8] flex items-center gap-1.5">
                    <Calculator className="h-3 w-3" />
                    Sell price (PKR per share)
                    {closePriceLoading && <Loader2 className="h-3 w-3 animate-spin text-[#00E676]" />}
                  </Label>
                  <div className="flex items-center gap-1.5 bg-[#0A0E1A] border border-white/[0.08] rounded-md px-3 py-2 focus-within:border-[#00E676]/40">
                    <span className="text-xs text-[#64748B] font-mono">Rs.</span>
                    <Input
                      value={closeSellPrice}
                      onChange={(e) => setCloseSellPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmCloseTrade();
                      }}
                      placeholder="0.00"
                      inputMode="decimal"
                      autoFocus
                      className="h-7 border-0 bg-transparent p-0 text-sm font-mono text-[#F4F7FB] focus-visible:ring-0"
                    />
                    {typeof livePrices[closeTarget.symbol] === "number" && (
                      <span className="text-[10px] text-[#64748B] ml-auto">
                        live: <span className="font-mono text-[#94A3B8]">{livePrices[closeTarget.symbol]!.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#64748B] leading-relaxed">
                    Auto-filled from the latest OHLCV close via <code className="text-[#00E676]">/api/psx/ohlcv/{closeTarget.symbol}</code>.
                    You can override it if you have a different fill price.
                  </p>
                </div>

                {/* Calculation breakdown */}
                {closeCalc ? (
                  <div className="rounded-md border border-white/[0.06] bg-[#0A0E1A] divide-y divide-white/[0.04]">
                    <CloseRow label="Buy cost" value={`PKR ${Math.round(closeCalc.buyCost).toLocaleString()}`} sub={`${closeTarget.buyPrice.toFixed(2)} × ${closeTarget.shares.toLocaleString()}`} />
                    <CloseRow label="Sell value" value={`PKR ${Math.round(closeCalc.sellValue).toLocaleString()}`} sub={`${closeCalc.sellPrice.toFixed(2)} × ${closeTarget.shares.toLocaleString()}`} />
                    <CloseRow
                      label="Gross P&L"
                      value={`PKR ${Math.round(closeCalc.grossPnl).toLocaleString()}`}
                      sub={`${closeCalc.grossPnl >= 0 ? "+" : ""}${((closeCalc.grossPnl / Math.max(1, closeCalc.buyCost)) * 100).toFixed(2)}%`}
                      valueClass={closeCalc.grossPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}
                    />
                    <CloseRow
                      label="Broker commission"
                      value={`PKR ${Math.round(closeCalc.commission).toLocaleString()}`}
                      sub="0.15% × sell value × 2 (buy + sell)"
                      valueClass="text-[#FF5C5C]"
                    />
                    <CloseRow
                      label={`CGT (${(closeCalc.taxRate * 100).toFixed(0)}% bracket)`}
                      value={`PKR ${Math.round(closeCalc.cgt).toLocaleString()}`}
                      sub={closeCalc.taxRate > 0
                        ? `Short-term: held ${closeCalc.holdingDays}d (≤12mo)`
                        : `Long-term: held ${closeCalc.holdingDays}d (>12mo, exempt)`}
                      valueClass="text-[#FF5C5C]"
                    />
                    <div className="p-3 flex items-center justify-between bg-white/[0.02]">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">Net P&L</div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">gross − commission − CGT</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-mono font-bold ${closeCalc.netPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                          {closeCalc.netPnl >= 0 ? "+" : ""}PKR {Math.round(Math.abs(closeCalc.netPnl)).toLocaleString()}
                        </div>
                        <div className={`text-[10px] font-mono ${closeCalc.netPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`}>
                          {closeCalc.netPnlPct >= 0 ? "+" : ""}{closeCalc.netPnlPct.toFixed(2)}% net
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-white/[0.06] bg-[#0A0E1A] p-3 text-xs text-[#64748B] text-center">
                    Enter a valid sell price to see the calculation.
                  </div>
                )}

                {/* Holding period banner */}
                {closeCalc && (
                  <div className="rounded-md bg-[#0A0E1A] border border-[#FBBF24]/20 p-2.5 flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-[#FBBF24] shrink-0" />
                    <span className="text-[11px] text-[#94A3B8]">
                      Holding period: <span className="font-mono text-[#F4F7FB]">{closeCalc.holdingDays} days</span> (~{closeCalc.holdingMonths} months) →
                      <span className={`ml-1 font-semibold ${closeCalc.taxRate > 0 ? "text-[#FF5C5C]" : "text-[#00E676]"}`}>
                        {closeCalc.taxRate > 0 ? "Short-term (15% CGT)" : "Long-term (0% CGT)"}
                      </span>
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={confirmCloseTrade}
                    disabled={!closeCalc || closeSubmitting}
                    className="flex-1 bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold disabled:opacity-50"
                  >
                    {closeSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1.5" />
                    )}
                    Confirm close
                  </Button>
                  <Button
                    onClick={() => {
                      setCloseTarget(null);
                      setCloseSellPrice("");
                    }}
                    variant="outline"
                    className="border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB]"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                </div>

                <p className="text-[10px] text-[#64748B] leading-relaxed">
                  Closing this trade will sell all {closeTarget.shares.toLocaleString()} shares and reset the position
                  to <span className="text-[#FBBF24] font-semibold">watch-only</span> (shares removed, buy price cleared).
                  The closed trade is sent to the <span className="text-[#00E676] font-semibold">Tracker</span> for
                  your P&L history.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

// ─── Issue 13: small sub-component for close-trade rows ────────────────────
function CloseRow({
  label,
  value,
  sub,
  valueClass = "text-[#F4F7FB]",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="p-3 flex items-center justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[#94A3B8]">{label}</div>
        {sub && <div className="text-[10px] text-[#64748B] mt-0.5 font-mono">{sub}</div>}
      </div>
      <div className={`text-sm font-mono font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Per-Stock News Digest panel (auto-fetched + LLM-interpreted news for portfolio)
// ────────────────────────────────────────────────────────────────────────────

interface InterpretedNewsItem {
  title?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
  symbol: string;
  impact: "positive" | "negative" | "neutral";
  impactStrength: "weak" | "moderate" | "strong";
  laymanExplanation: string;
  shortTermOutlook: string;
  affectedStocks: string[];
}

interface NewsDigestEntry {
  symbol: string;
  stockName: string;
  newsCount: number;
  interpretedItems: InterpretedNewsItem[];
}

function PortfolioNewsDigest({ symbols }: { symbols: string[] }) {
  const [digest, setDigest] = useState<NewsDigestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setView = useLatentStore((s) => s.setView);
  const pushNotification = useLatentStore((s) => s.pushNotification);

  const loadDigest = async () => {
    if (symbols.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/news-digest?symbols=${symbols.join(",")}&limit=2`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setDigest(data.digest || []);
      const total = data.totalInterpreted || 0;
      if (total > 0) {
        pushNotification({
          type: "news",
          title: `${total} news items interpreted`,
          body: `Auto-analyzed news for ${symbols.length} portfolio stock${symbols.length === 1 ? "" : "s"}`,
          linkView: "portfolio",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load news digest");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDigest();
  }, [symbols.join(",")]);

  const impactColor = (i: string) =>
    i === "positive" ? "text-[#00E676]" : i === "negative" ? "text-[#FF5C5C]" : "text-[#94A3B8]";

  return (
    <Card className="bg-[#131829] border-white/[0.08] mt-4">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#F4F7FB] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#00E676]" />
              Auto-News Digest for Your Portfolio
            </h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              For each stock below: news fetched from AskAnalyst + GLM-4 interprets impact in layman terms.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDigest}
            disabled={loading}
            className="border-white/[0.12] text-[#94A3B8] h-7"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1.5" />
            )}
            Refresh
          </Button>
        </div>

        {loading && digest.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full bg-white/[0.04]" />)}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-[#FF5C5C]/[0.07] border border-[#FF5C5C]/20 p-3 text-xs text-[#FF5C5C]">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {!loading && !error && digest.length > 0 && (
          <div className="space-y-4">
            {digest.map((entry, di) => (
              <div key={`${entry.symbol}-${di}`} className="border-l-2 border-[#00E676]/30 pl-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-md bg-[#00E676]/10 flex items-center justify-center font-mono font-bold text-[#00E676] text-[10px]">
                    {entry.symbol.slice(0, 4)}
                  </div>
                  <span className="font-semibold text-[#F4F7FB] text-sm">{entry.symbol}</span>
                  <span className="text-[11px] text-[#94A3B8] truncate flex-1">{entry.stockName}</span>
                  <Badge variant="outline" className="text-[9px] py-0 h-4 border-white/[0.12] text-[#64748B]">
                    {entry.newsCount} news
                  </Badge>
                </div>

                {entry.interpretedItems.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic ml-9">
                    No recent news from AskAnalyst for {entry.symbol}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entry.interpretedItems.map((item, i) => (
                      <div key={i} className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-[#F4F7FB] line-clamp-2 flex-1">
                            {item.title || "(no headline)"}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] uppercase font-bold ${impactColor(item.impact)}`}>
                              {item.impact}
                            </span>
                            <Badge variant="outline" className={`text-[9px] py-0 h-4 ${
                              item.impactStrength === "strong" ? "border-[#FF5C5C]/40 text-[#FF5C5C]" :
                              item.impactStrength === "moderate" ? "border-amber-400/40 text-amber-400" :
                              "border-white/[0.12] text-[#94A3B8]"
                            }`}>
                              {item.impactStrength}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#94A3B8] leading-relaxed mb-1.5">
                          {item.laymanExplanation}
                        </p>
                        {item.shortTermOutlook && (
                          <p className="text-[11px] text-[#64748B] italic">
                            Outlook: {item.shortTermOutlook}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-[#64748B] uppercase">Affected:</span>
                            {item.affectedStocks.slice(0, 3).map((s, ai) => (
                              <button
                                key={`${s}-${ai}`}
                                onClick={() => setView("signals_v2")}
                                className="text-[10px] font-mono text-[#00E676] hover:underline"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#64748B] hover:text-[#F4F7FB]"
                            >
                              Source ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2.5 mt-3 text-[10px] text-[#64748B]">
          <span className="text-[#94A3B8] font-semibold">Manual URL paste:</span> For
          ultra-fast news from any source, paste the URL in the Fundamental News tab — that
          feature stays as an extra layer on top of this auto-digest.
        </div>
      </CardContent>
    </Card>
  );
}
