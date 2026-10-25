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
  | "pattern_finder"
  | "pattern_finder_financial";

// Issue 28-B: an individual buy within a position. A position can hold
// multiple buy lots; its `buyPrice` is always the weighted average of the
// lots ((Σ price×shares)/(Σ shares)) and `shares` is the lot total.
export interface BuyLot {
  price: number;
  shares: number;
  at: string;
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  sector?: string | null;
  buyPrice: number | null;
  shares: number;
  addedAt: string;
  order: number;
  status: "open" | "closed";
  closePrice?: number | null;
  closedAt?: string | null;
  // Issue 28-B: individual buy lots (weighted-average cost tracking).
  // Optional so positions persisted before this field existed still parse —
  // use getBuyLots() for a legacy-safe read.
  buys?: BuyLot[];
}

// Issue 28-B: legacy-safe read of a position's buy lots. Positions persisted
// before the `buys` field existed are back-filled from buyPrice × shares.
export function getBuyLots(p: PortfolioPosition): BuyLot[] {
  if (p.buys && p.buys.length) return p.buys;
  if (p.buyPrice && p.shares > 0) return [{ price: p.buyPrice, shares: p.shares, at: p.addedAt }];
  return [];
}

// Issue 28-B: pure lot-merge used by BOTH the store action and the UI toast
// preview so the two can never drift. Handles the legacy heal: positions
// recorded with shares but NO buy price (pre-28-B data) inherit the incoming
// price for those shares — the share count is never silently dropped.
export function mergeBuyLots(
  existing: PortfolioPosition | undefined,
  incoming: { price: number; shares: number }
): BuyLot[] {
  const now = new Date().toISOString();
  let lots = existing ? getBuyLots(existing) : [];
  if (existing && lots.length === 0 && existing.shares > 0) {
    // Legacy heal — see comment above.
    lots = [{ price: incoming.price, shares: existing.shares, at: existing.addedAt }];
  }
  return [...lots, { price: incoming.price, shares: incoming.shares, at: now }];
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
  buyPrice: number;
  shares: number;
  sellPrice: number;
  buyCost: number;
  sellValue: number;
  commission: number;
  cgt: number;
  grossPnl: number;
  netPnl: number;
  netPnlPct: number;
  holdingDays: number;
  taxRate: number; // 0.15 for ≤12mo, 0 for >12mo
  closedAt: string;
  // Issue 28-B: snapshot of the buy lots that made up the (averaged)
  // position at close time — buyPrice above is the weighted average of
  // these lots. Optional: older records don't have it.
  buys?: BuyLot[];
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

      // ─── Issue 28-B: one row per symbol + weighted-average cost basis ───
      // Handles three cases by looking up an existing position with the same
      // symbol:
      //   (a) not found → create (status "open"; records the initial buy lot
      //       in `buys` when BOTH buyPrice AND shares are provided).
      //   (b) found + incoming has shares > 0 → append {price, shares, at} as
      //       an additional buy lot, set shares = total and buyPrice = the
      //       weighted average ((Σ price×shares)/(Σ shares)). This also
      //       converts a watch-only entry into a holding (remove-from-
      //       watchlist + add-to-portfolio in one step). Existing
      //       order/addedAt are kept; name/sector are filled from the
      //       incoming payload only if currently empty.
      //   (c) found + incoming has no shares → no-op (the UI blocks duplicate
      //       watch-only adds; this keeps the store safe from any caller).
      addPortfolioPosition: (p) =>
        set((s) => {
          const existing = s.portfolio.find((x) => x.symbol === p.symbol);
          const now = new Date().toISOString();

          // Case (a): new symbol → create the position.
          if (!existing) {
            const hasLot = p.shares > 0 && p.buyPrice !== null && p.buyPrice !== undefined;
            return {
              portfolio: [
                ...s.portfolio,
                {
                  ...p,
                  addedAt: now,
                  order: s.portfolio.length,
                  status: "open" as const,
                  buys: hasLot ? [{ price: p.buyPrice as number, shares: p.shares, at: now }] : [],
                },
              ],
            };
          }

          // Case (c): already tracked and the incoming payload carries no
          // usable lot (no shares, or no price) → nothing to do.
          if (p.shares <= 0 || p.buyPrice === null || p.buyPrice === undefined) {
            return {};
          }

          // Case (b): merge as an additional buy lot + weighted-average price.
          // mergeBuyLots() back-fills legacy positions persisted before `buys`
          // existed (buyPrice × shares synthesized; unpriced legacy shares
          // inherit the incoming price — see the helper's comment).
          const lots = mergeBuyLots(existing, { price: p.buyPrice, shares: p.shares });
          const totalShares = lots.reduce((n, l) => n + l.shares, 0);
          const totalCost = lots.reduce((n, l) => n + l.price * l.shares, 0);
          const avgPrice = totalShares > 0 ? totalCost / totalShares : p.buyPrice;

          return {
            portfolio: s.portfolio.map((x) =>
              x.symbol === p.symbol
                ? {
                    ...x,
                    name: x.name || p.name,
                    sector: x.sector ?? p.sector ?? null,
                    shares: totalShares,
                    buyPrice: avgPrice,
                    buys: lots,
                    status: "open" as const,
                    closePrice: null,
                    closedAt: null,
                  }
                : x
            ),
          };
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
      // watch-only (shares=0, buyPrice=null, buys cleared) — the stock
      // remains in the portfolio so the user can re-add a position later.
      // The ClosedTrade carries the averaged buyPrice + a `buys` snapshot.
      addClosedTrade: (t) =>
        set((s) => ({ closedTrades: [t, ...s.closedTrades].slice(0, 200) })),
      closePositionFromPortfolio: (symbol, closedTrade) =>
        set((s) => ({
          closedTrades: [closedTrade, ...s.closedTrades].slice(0, 200),
          portfolio: s.portfolio.map((p) =>
            p.symbol === symbol
              ? { ...p, shares: 0, buyPrice: null, buys: [], status: "open" as const }
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
      // Issue 28-B: bumped 0 → 1 — migrate merges duplicate symbols that
      // legacy localStorage data may contain (from before the one-row-per-
      // symbol rule), combining their buy lots at the weighted-average price
      // so no stock ever shows twice. Runs exactly once per stored state.
      version: 1,
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<LatentState>;
        if (!Array.isArray(s.portfolio)) return s as LatentState;
        const merged: PortfolioPosition[] = [];
        for (const p of s.portfolio) {
          if (!p || typeof p.symbol !== "string") continue;
          const idx = merged.findIndex((m) => m.symbol === p.symbol);
          if (idx === -1) {
            merged.push(p);
            continue;
          }
          const cur = merged[idx];
          const curLots = getBuyLots(cur);
          const newLots = getBuyLots(p);
          if (curLots.length === 0 && newLots.length > 0) {
            // current entry is watch-only, incoming is a holding → keep the holding
            merged[idx] = p;
          } else if (curLots.length > 0 && newLots.length > 0) {
            // two holdings → merge lots + weighted-average buyPrice
            const lots = [...curLots, ...newLots];
            const totalShares = lots.reduce((n, l) => n + l.shares, 0);
            const totalCost = lots.reduce((n, l) => n + l.price * l.shares, 0);
            merged[idx] = {
              ...cur,
              shares: totalShares,
              buyPrice: totalShares > 0 ? totalCost / totalShares : cur.buyPrice,
              buys: lots,
            };
          }
          // else: keep `cur` (cur is the holding / first watch-only entry)
        }
        return {
          ...s,
          portfolio: merged.map((p, i) => ({ ...p, order: i })),
        } as LatentState;
      },
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
