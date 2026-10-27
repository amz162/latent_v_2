"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Issue 15 / Issue 28: batched LIVE quote fetcher for portfolio holdings ──
// Hits our own /api/psx/live/batch endpoint, which server-side calls
// `getLiveQuote` (60s in-memory cache per symbol) for each portfolio symbol
// in parallel via Promise.all. Returns the latest LIVE PSX price for each
// symbol, plus isLoading / refresh / lastUpdated for the UI.
//
// Shared by:
//   - PortfolioTab (per-position live P&L, watch-only live price, summary card)
//   - Tracker portfolio tab (livePriceMap → P&L math, sector pie, refresh UI)
//
// Implementation note: setState is only called inside async .then callbacks
// (NOT synchronously in the effect body) to avoid React 19's
// `react-hooks/set-state-in-effect` cascading-render warning. The "loading"
// state is derived from `state.key !== key` (data is stale until the new
// fetch for the current symbol-set resolves) plus an explicit `loading`
// flag set inside the `refresh` event handler.
export function usePortfolioLiveQuotes(symbols: string[]): {
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
