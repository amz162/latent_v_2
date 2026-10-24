"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Signal, Plan, RiskProfileInput, Trade } from "./types";

export type LatentView =
  | "landing"
  | "onboarding"
  | "dashboard"
  | "fundamental_news"
  | "technical_analysis"
  | "signals_v2"
  | "portfolio"
  | "strategy"
  | "dividends"
  | "tracker"
  | "signal_detail"
  | "execute"
  | "ai_model_signals"
  | "calculators"
  | "pattern_finder";

// Issue 32: a single portfolio position can have multiple buy lots (when the
// user averages in by buying more shares at a different price). `buyLots`
// keeps the per-lot history so the UI can display "1st buy 400 × 100",
// "2nd buy 500 × 50", etc. The flat `buyPrice`/`shares` fields are kept as
// the weighted-average buy price + total shares for backward-compat with
// every consumer that already reads `p.buyPrice`/`p.shares`.
export interface BuyLot {
  price: number;
  shares: number;
  addedAt: string;
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  sector?: string | null;
  buyPrice: number | null;        // weighted-average buy price (breakeven)
  shares: number;                  // total shares across all lots
  addedAt: string;
  order: number;
  status: "open" | "closed";
  closePrice?: number | null;
  closedAt?: string | null;
  buyLots?: BuyLot[];              // individual buy lots (for averaging display)
}

// Issue 13: a closed trade is recorded when a user closes a portfolio
// position via the close-trade flow in PortfolioTab. The position itself is
// reset to "watch-only" (shares=0, buyPrice=null) but the closed-trade record
// persists so the Tracker's Portfolio tab can show closed trades history.
export interface ClosedTrade {
  id: string;
  symbol: string;
  name: string;
  sector?: string | null;
  buyPrice: number;            // weighted-avg buy price (breakeven) — used for ALL P&L calc
  shares: number;              // total shares across all lots
  sellPrice: number;
  buyCost: number;             // = avgPrice × totalShares (= sum of lot costs)
  sellValue: number;
  commission: number;
  cgt: number;
  grossPnl: number;
  netPnl: number;
  netPnlPct: number;
  holdingDays: number;
  taxRate: number; // 0.15 for ≤12mo, 0 for >12mo
  closedAt: string;
  // Issue 33: per-lot history (kept so the closed-trade row can show "AVG · N lots"
  // when the position was averaged before close). The P&L numbers above are
  // computed on the WEIGHTED-AVG buyPrice × totalShares — NOT per-lot. One
  // closed-trade entry = one close action, regardless of how many buy lots
  // the position had.
  buyLots?: BuyLot[];
}

export interface AppNotification {
  id: string;
  type: "signal" | "tp_hit" | "sl_hit" | "news" | "info";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  linkView?: LatentView;
  linkSignalId?: string;
}

interface LatentState {
  view: LatentView;
  selectedSignalId: string | null;
  selectedSymbol: string | null;
  selectedBrokerId: string | null;

  userId: string | null;
  userEmail: string;
  userName: string;
  riskProfile: RiskProfileInput | null;
  plan: Plan | null;
  trades: Trade[];
  portfolio: PortfolioPosition[];
  closedTrades: ClosedTrade[];

  notifications: AppNotification[];

  setView: (v: LatentView) => void;
  selectSignal: (id: string) => void;
  selectSymbol: (symbol: string) => void;
  selectBroker: (id: string) => void;
  setUser: (id: string, email: string, name?: string) => void;
  setRiskProfile: (rp: RiskProfileInput) => void;
  setPlan: (p: Plan) => void;
  setTrades: (t: Trade[]) => void;
  addTrade: (t: Trade) => void;

  addPortfolioPosition: (p: Omit<PortfolioPosition, "addedAt" | "order" | "status">) => void;
  removePortfolioPosition: (symbol: string) => void;
  closePortfolioPosition: (symbol: string, closePrice: number) => void;
  reopenPortfolioPosition: (symbol: string) => void;
  reorderPortfolio: (from: number, to: number) => void;

  addClosedTrade: (t: ClosedTrade) => void;
  closePositionFromPortfolio: (symbol: string, closedTrade: ClosedTrade) => void;

  pushNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  reset: () => void;
}

export const useLatentStore = create<LatentState>()(
  persist(
    (set) => ({
      view: "landing",
      selectedSignalId: null,
      selectedSymbol: null,
      selectedBrokerId: null,

      userId: null,
      userEmail: "",
      userName: "",
      riskProfile: null,
      plan: null,
      trades: [],
      portfolio: [],
      closedTrades: [],

      notifications: [],

      setView: (v) => set({ view: v }),
      selectSignal: (id) => set({ selectedSignalId: id, view: "signal_detail" }),
      selectSymbol: (symbol) => set({ selectedSymbol: symbol }),
      selectBroker: (id) => set({ selectedBrokerId: id }),
      setUser: (id, email, name = "") => set({ userId: id, userEmail: email, userName: name }),
      setRiskProfile: (rp) => set({ riskProfile: rp }),
      setPlan: (p) => set({ plan: p }),
      setTrades: (t) => set({ trades: t }),
      addTrade: (t) => set((s) => ({ trades: [...s.trades, t] })),

      // Issue 32: smart add — if the symbol already exists in the portfolio,
      // UPDATE the existing entry (don't create a duplicate). Three cases:
      //   (a) existing is a holding (shares>0) + user enters shares → average:
      //       append a new buy lot, recompute weighted-avg buyPrice + sum shares.
      //   (b) existing is watch-only (shares=0) + user enters shares → upgrade
      //       to a holding: set buyPrice/shares, create first buy lot, status=open.
      //   (c) existing is watch-only + user enters NO shares → no-op (the UI
      //       shows an "already in watchlist" toast before calling this).
      //   (d) existing is a holding + user enters NO shares → no-op (UI shows
      //       an "already in holdings" toast before calling this).
      // If the symbol is NOT in the portfolio, create a new entry (legacy
      // behavior).
      addPortfolioPosition: (p) =>
        set((s) => {
          const existingIdx = s.portfolio.findIndex((x) => x.symbol === p.symbol);
          if (existingIdx === -1) {
            // New entry.
            const newLots: BuyLot[] | undefined =
              p.buyPrice !== null && p.shares > 0
                ? [{ price: p.buyPrice, shares: p.shares, addedAt: new Date().toISOString() }]
                : undefined;
            return {
              portfolio: [
                ...s.portfolio,
                {
                  ...p,
                  addedAt: new Date().toISOString(),
                  order: s.portfolio.length,
                  status: "open" as const,
                  buyLots: newLots,
                },
              ],
            };
          }
          // Existing entry — UPDATE in place (preserve order + addedAt).
          const existing = s.portfolio[existingIdx];
          // No shares entered → no-op (UI handles the toast).
          if (!p.shares || p.shares <= 0) {
            return s; // no state change
          }
          // User entered shares + buyPrice → either average (case a) or upgrade (case b).
          const newPrice = p.buyPrice ?? 0;
          const newLot: BuyLot = {
            price: newPrice,
            shares: p.shares,
            addedAt: new Date().toISOString(),
          };
          // If the existing position is watch-only OR has no buyLots → start
          // fresh buyLots with the new lot (this is case b: upgrade from watch).
          // If the existing is a holding with buyLots → append (case a: average).
          const existingLots: BuyLot[] = existing.buyLots ?? [];
          // Filter out any zero-share lots from when it was watch-only (defensive).
          const cleanExistingLots = existingLots.filter((l) => l.shares > 0);
          const mergedLots: BuyLot[] = [...cleanExistingLots, newLot];
          // Recompute totals.
          const totalShares = mergedLots.reduce((sum, l) => sum + l.shares, 0);
          const totalCost = mergedLots.reduce((sum, l) => sum + l.price * l.shares, 0);
          const avgPrice = totalShares > 0 ? totalCost / totalShares : null;
          // Preserve the original addedAt (so the position keeps its place in
          // the sorted order). Update name/sector if the new add provides them.
          const merged: PortfolioPosition = {
            ...existing,
            name: p.name || existing.name,
            sector: p.sector || existing.sector,
            buyPrice: avgPrice,
            shares: totalShares,
            buyLots: mergedLots,
            status: "open" as const,
            // Reset close fields (in case the position was previously closed).
            closePrice: null,
            closedAt: null,
          };
          const newPortfolio = [...s.portfolio];
          newPortfolio[existingIdx] = merged;
          return { portfolio: newPortfolio };
        }),
      removePortfolioPosition: (symbol) =>
        set((s) => ({
          portfolio: s.portfolio
            .filter((p) => p.symbol !== symbol)
            .map((p, i) => ({ ...p, order: i })),
        })),
      closePortfolioPosition: (symbol, closePrice) =>
        set((s) => ({
          portfolio: s.portfolio.map((p) =>
            p.symbol === symbol
              ? { ...p, status: "closed" as const, closePrice, closedAt: new Date().toISOString() }
              : p
          ),
        })),
      reopenPortfolioPosition: (symbol) =>
        set((s) => ({
          portfolio: s.portfolio.map((p) =>
            p.symbol === symbol
              ? { ...p, status: "open" as const, closePrice: null, closedAt: null }
              : p
          ),
        })),
      reorderPortfolio: (from, to) =>
        set((s) => {
          const arr = [...s.portfolio].sort((a, b) => a.order - b.order);
          const [moved] = arr.splice(from, 1);
          arr.splice(to, 0, moved);
          return { portfolio: arr.map((p, i) => ({ ...p, order: i })) };
        }),

      // Issue 13: record a closed trade (kept separately so the Tracker can
      // show closed-trade history) AND reset the portfolio position to
      // watch-only (shares=0, buyPrice=null) — the stock remains in the
      // portfolio so the user can re-add a position later.
      addClosedTrade: (t) =>
        set((s) => ({ closedTrades: [t, ...s.closedTrades].slice(0, 200) })),
      closePositionFromPortfolio: (symbol, closedTrade) =>
        set((s) => ({
          closedTrades: [closedTrade, ...s.closedTrades].slice(0, 200),
          portfolio: s.portfolio.map((p) =>
            p.symbol === symbol
              ? // Issue 32: clear buyLots too so the user starts fresh when
                // re-adding a position after closing. Stock stays in the
                // portfolio as watch-only (shares=0, buyPrice=null, buyLots=[]).
                { ...p, shares: 0, buyPrice: null, buyLots: [], status: "open" as const }
              : p
          ),
        })),

      pushNotification: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications,
          ].slice(0, 50),
        })),
      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      clearNotifications: () => set({ notifications: [] }),

      reset: () =>
        set({
          view: "landing",
          selectedSignalId: null,
          selectedSymbol: null,
          selectedBrokerId: null,
          userId: null,
          userEmail: "",
          userName: "",
          riskProfile: null,
          plan: null,
          trades: [],
          portfolio: [],
          closedTrades: [],
          notifications: [],
        }),
    }),
    {
      name: "latent-store-v2",
      partialize: (s) => ({
        userId: s.userId,
        userEmail: s.userEmail,
        userName: s.userName,
        riskProfile: s.riskProfile,
        plan: s.plan,
        portfolio: s.portfolio,
        closedTrades: s.closedTrades,
      }),
    }
  )
);
