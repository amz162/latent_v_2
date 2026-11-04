/**
 * Task 110 — 7/30 SMA Crossover — Golden Cross Research Strategy (TS engine).
 *
 * Reference implementation for the Golden Cross dashboard. Mirrors
 * scripts/task110_lib.py + task110_phases_research.py rule-for-rule (parity is
 * tested by scripts/task110_parity). Key conventions:
 *  - MA_n(t) = mean of the last n VALID closes ending at t (invalid bars are
 *    skipped; window counts valid sessions only; no zero-fill).
 *  - No first-row signal: a crossover needs two consecutive valid MA relations.
 *    Golden: prev MA7 <= prev MA30 AND cur MA7 > cur MA30 (equality = "at").
 *    Death:  prev MA7 >= prev MA30 AND cur MA7 < cur MA30.
 *  - Execution: signal after completed close at session t fills at the OPEN of
 *    the immediately next global session (>= MIN_SESSION_SYMBOLS bars across
 *    the DB); if the symbol has no valid bar that session the signal lapses
 *    (never fabricated). No same-close execution. Zero synthetic slippage
 *    (V2 profile); costs via the production computeTradeCostsV2.
 *  - Portfolio: cash-constrained, whole shares, no leverage, no shorts (a
 *    death cross while flat does nothing), buys skipped when cash/max
 *    positions are exhausted. MTM is never realized.
 *  - RESEARCH ONLY: this module must never be wired to order execution.
 */
import {
  computeSideCosts,
  computeTradeCostsV2,
  PSX_USER_SCHEDULE_V2,
  type TaxProfile,
} from "./trading-costs";

export const GC_STRATEGY_ID = "golden_cross_7_30_v1";
export const GC_STATUS = "research_only";
export const MA_FAST = 7;
export const MA_SLOW = 30;
export const MIN_SESSION_SYMBOLS = 10;

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  valid: boolean;
}

export function barIsValid(b: { open: number; high: number; low: number; close: number }): boolean {
  return b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0 && b.high >= b.low;
}

export function smaSeries(closes: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  const win: number[] = [];
  for (const c of closes) {
    if (c == null) {
      out.push(null);
      continue;
    }
    win.push(c);
    if (win.length > n) win.shift();
    out.push(win.length === n ? win.reduce((a, b) => a + b, 0) / n : null);
  }
  return out;
}

export type Relation = -1 | 0 | 1 | null;

export function maRelations(ma7: (number | null)[], ma30: (number | null)[]): Relation[] {
  return ma7.map((a, i) => {
    const b = ma30[i];
    if (a == null || b == null) return null;
    return a > b ? 1 : a === b ? 0 : -1;
  });
}

export function detectCrossovers(rel: Relation[]): ("GOLDEN" | "DEATH" | null)[] {
  return rel.map((cur, t) => {
    const prev = t > 0 ? rel[t - 1] : null;
    if (prev == null || cur == null) return null;
    if (prev <= 0 && cur === 1) return "GOLDEN";
    if (prev >= 0 && cur === -1) return "DEATH";
    return null;
  });
}

export interface GcIndicators {
  dates: string[];
  closes: (number | null)[];
  opens: (number | null)[];
  ma7: (number | null)[];
  ma30: (number | null)[];
  rel: Relation[];
  signals: ("GOLDEN" | "DEATH" | null)[];
}

export function computeGoldenCross(bars: Bar[]): GcIndicators {
  const dates = bars.map((b) => b.date);
  const closes = bars.map((b) => (b.valid ? b.close : null));
  const opens = bars.map((b) => (b.valid ? b.open : null));
  const ma7 = smaSeries(closes, MA_FAST);
  const ma30 = smaSeries(closes, MA_SLOW);
  const rel = maRelations(ma7, ma30);
  const signals = detectCrossovers(rel);
  return { dates, closes, opens, ma7, ma30, rel, signals };
}

export interface GcPosition {
  shares: number;
  entryPx: number;
  entryDate: string;
  signalDate: string;
  entrySideCost: number;
}

export interface GcTradeRow {
  signalDate: string;
  executionDate: string;
  symbol: string;
  side: "BUY→SELL";
  signalReason: string;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  grossPnl: number;
  totalCosts: number;
  netPnl: number;
  returnPct: number;
  holdingSessions: number;
  winLoss: "WIN" | "LOSS";
  closingReason: string;
}

export interface GcDailyRow {
  date: string;
  symbol: string;
  signal: string;
  action: string;
  positionAfter: number;
  cashBalance: number;
  investedCapital: number;
  realizedPnlCum: number;
  unrealizedPnl: number;
  costsToday: number;
  totalNetPnl: number;
  portfolioEquity: number;
  currentDrawdown: number;
}

export interface GcPortfolioResult {
  config: {
    sizingMode: "pct_equity" | "equal_alloc";
    sizingPct: number;
    maxPositions: number;
    initialCapital: number;
    taxProfile: TaxProfile;
    execution: string;
    start: string;
    end: string;
    sessions: number;
  };
  account: {
    initialCapital: number;
    finalCash: number;
    openPositionValue: number;
    finalEquity: number;
    realizedNetPnl: number;
    unrealizedPnl: number;
    totalNetPnl: number;
    roiPct: number;
    maxDrawdown: number;
    trades: number;
    wins: number;
    losses: number;
    winRatePct: number | null;
    avgWin: number | null;
    avgLoss: number | null;
    profitFactor: number | null;
    expectancyPerTrade: number | null;
    totalCosts: number;
    longestLossStreak: number;
  };
  openPositions: Array<{
    symbol: string;
    shares: number;
    entryDate: string;
    entryPrice: number;
    lastClose: number | null;
    marketValue: number;
    entryCosts: number;
    unrealizedPnl: number;
  }>;
  unfilled: Array<{ date: string; symbol: string; reason: string }>;
  daily: GcDailyRow[];
  trades: GcTradeRow[];
}

const TAX_RATES: Record<TaxProfile, number> = { ATL_15: 0.15, NON_ATL_30: 0.3 };

/**
 * Cash-constrained portfolio simulation. `seriesBySymbol` maps each symbol to
 * its GcIndicators; `sessions` is the global PSX session calendar (provider
 * data decided); `barIndex[sym][date]` gives the bar position of a VALID bar.
 */
export function runGoldenCrossPortfolio(
  seriesBySymbol: Record<string, GcIndicators>,
  sessions: string[],
  barIndex: Record<string, Record<string, number>>,
  opts: {
    sizingMode?: "pct_equity" | "equal_alloc";
    sizingPct?: number;
    maxPositions?: number;
    initialCapital?: number;
    taxProfile?: TaxProfile;
  } = {}
): GcPortfolioResult {
  const sizingMode = opts.sizingMode ?? "pct_equity";
  const sizingPct = opts.sizingPct ?? 0.2;
  const maxPositions = opts.maxPositions ?? 5;
  const initialCapital = opts.initialCapital ?? 100_000;
  const taxProfile = opts.taxProfile ?? "ATL_15";
  const uni = Object.keys(seriesBySymbol).sort();

  const sidx = new Map(sessions.map((d, i) => [d, i]));
  const startI = (() => {
    for (let i = 40; i < sessions.length; i++) {
      let n = 0;
      for (const s of uni) {
        const p = barIndex[s]?.[sessions[i]];
        if (p != null && seriesBySymbol[s].ma30[p] != null) n++;
      }
      if (n >= Math.min(5, uni.length)) return i;
    }
    return 40;
  })();

  const mark = (sym: string, i: number): number | null => {
    const ind = seriesBySymbol[sym];
    const lk = barIndex[sym] ?? {};
    while (i >= 0) {
      const p = lk[sessions[i]];
      if (p != null) return ind.closes[p];
      i--;
    }
    return null;
  };

  let cash = initialCapital;
  const pos = new Map<string, GcPosition>();
  let pending: Array<{ symbol: string; signal: "GOLDEN" | "DEATH"; signalDate: string }> = [];
  let realized = 0;
  const trades: GcTradeRow[] = [];
  const daily: GcDailyRow[] = [];
  const unfilled: Array<{ date: string; symbol: string; reason: string }> = [];
  let peak = initialCapital;
  let maxDd = 0;
  let totalBuyValue = 0;

  for (let i = startI; i < sessions.length; i++) {
    const d = sessions[i];
    let costsToday = 0;
    const actions: string[] = [];
    const sells = pending.filter((e) => e.signal === "DEATH").sort((a, b) => a.symbol.localeCompare(b.symbol));
    const buys = pending.filter((e) => e.signal === "GOLDEN").sort((a, b) => a.symbol.localeCompare(b.symbol));
    pending = [];
    for (const e of sells) {
      const s = e.symbol;
      const p = pos.get(s);
      if (!p) continue;
      const bp = barIndex[s]?.[d];
      if (bp == null) continue; // no valid bar that session -> no fabricated fill
      const px = seriesBySymbol[s].opens[bp];
      if (px == null) continue;
      const gross = (px - p.entryPx) * p.shares;
      const tc = computeTradeCostsV2(p.shares, p.entryPx, [{ quantity: p.shares, exitPrice: px }], gross, PSX_USER_SCHEDULE_V2, taxProfile);
      const sellSide = computeSideCosts(p.shares, px, PSX_USER_SCHEDULE_V2);
      const cgt = gross > 0 ? gross * TAX_RATES[taxProfile] : 0;
      // cash flows split entry/exit so no cost is charged twice: buy-side was
      // deducted at entry; here only sell-side + CGT leave the account.
      cash += px * p.shares - sellSide.sideTotal - cgt;
      realized += tc.netPnl;
      costsToday += sellSide.sideTotal + cgt;
      const hold = i - (sidx.get(p.entryDate) ?? i);
      trades.push({
        signalDate: p.signalDate,
        executionDate: p.entryDate,
        symbol: s,
        side: "BUY→SELL",
        signalReason: "GOLDEN_7_30",
        entryPrice: p.entryPx,
        exitPrice: px,
        shares: p.shares,
        grossPnl: round2(gross),
        totalCosts: round2(tc.totalCost),
        netPnl: round2(tc.netPnl),
        returnPct: round4((100 * tc.netPnl) / (p.entryPx * p.shares)),
        holdingSessions: hold,
        winLoss: tc.netPnl > 0 ? "WIN" : "LOSS",
        closingReason: "DEATH_CROSS",
      });
      pos.delete(s);
      actions.push(`SELL ${s} ${p.shares}@${px}`);
    }
    for (const e of buys) {
      const s = e.symbol;
      if (pos.has(s)) continue;
      if (pos.size >= maxPositions) {
        unfilled.push({ date: d, symbol: s, reason: "UNFILLED_MAX_POSITIONS" });
        continue;
      }
      const bp = barIndex[s]?.[d];
      if (bp == null) {
        unfilled.push({ date: d, symbol: s, reason: "UNFILLED_NO_NEXT_SESSION_BAR" });
        continue;
      }
      const px = seriesBySymbol[s].opens[bp];
      if (px == null) {
        unfilled.push({ date: d, symbol: s, reason: "UNFILLED_NO_NEXT_SESSION_BAR" });
        continue;
      }
      let equity = cash;
      for (const [x, p] of pos) equity += (mark(x, i - 1) ?? p.entryPx) * p.shares;
      const budget = sizingMode === "pct_equity" ? equity * sizingPct : equity / maxPositions;
      const sh = Math.floor(budget / px);
      const sc = computeSideCosts(sh, px, PSX_USER_SCHEDULE_V2);
      if (sh <= 0 || px * sh + sc.sideTotal > cash) {
        unfilled.push({ date: d, symbol: s, reason: "UNFILLED_INSUFFICIENT_CASH" });
        continue;
      }
      cash -= px * sh + sc.sideTotal;
      totalBuyValue += px * sh;
      costsToday += sc.sideTotal;
      pos.set(s, { shares: sh, entryPx: px, entryDate: d, signalDate: e.signalDate, entrySideCost: sc.sideTotal });
      actions.push(`BUY ${s} ${sh}@${px}`);
    }
    const sigsToday: string[] = [];
    for (const s of uni) {
      const bp = barIndex[s]?.[d];
      if (bp == null) continue;
      const x = seriesBySymbol[s].signals[bp];
      if (x) {
        pending.push({ symbol: s, signal: x, signalDate: d });
        sigsToday.push(`${x}:${s}`);
      }
    }
    let invested = 0;
    let entryVal = 0;
    for (const [s, p] of pos) {
      const mp = mark(s, i) ?? p.entryPx;
      invested += mp * p.shares;
      entryVal += p.entryPx * p.shares;
    }
    const equity = cash + invested;
    peak = Math.max(peak, equity);
    const dd = equity - peak;
    maxDd = Math.min(maxDd, dd);
    daily.push({
      date: d,
      symbol: "PORTFOLIO",
      signal: sigsToday.join(";"),
      action: actions.join(";"),
      positionAfter: pos.size,
      cashBalance: round2(cash),
      investedCapital: round2(invested),
      realizedPnlCum: round2(realized),
      unrealizedPnl: round2(invested - entryVal),
      costsToday: round2(costsToday),
      totalNetPnl: round2(equity - initialCapital),
      portfolioEquity: round2(equity),
      currentDrawdown: round2(dd),
    });
  }

  const lastI = sessions.length - 1;
  const openPositions = [...pos.entries()].map(([s, p]) => {
    const mp = mark(s, lastI) ?? p.entryPx;
    return {
      symbol: s,
      shares: p.shares,
      entryDate: p.entryDate,
      entryPrice: p.entryPx,
      lastClose: mark(s, lastI),
      marketValue: round2(mp * p.shares),
      entryCosts: round2(p.entrySideCost),
      unrealizedPnl: round2((mp - p.entryPx) * p.shares),
    };
  });
  const unrealNet = openPositions.reduce((a, o) => a + o.unrealizedPnl - o.entryCosts, 0);
  const finalEquity = cash + openPositions.reduce((a, o) => a + o.marketValue, 0);
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl <= 0);
  const grossWin = wins.reduce((a, t) => a + t.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.netPnl, 0));
  let streak = 0;
  let worst = 0;
  for (const t of trades) {
    streak = t.netPnl <= 0 ? streak + 1 : 0;
    worst = Math.max(worst, streak);
  }
  return {
    config: {
      sizingMode,
      sizingPct,
      maxPositions,
      initialCapital,
      taxProfile,
      execution: "signal at close t -> next global session open; unfilled otherwise",
      start: sessions[startI],
      end: sessions[lastI],
      sessions: sessions.length - startI,
    },
    account: {
      initialCapital,
      finalCash: round2(cash),
      openPositionValue: round2(openPositions.reduce((a, o) => a + o.marketValue, 0)),
      finalEquity: round2(finalEquity),
      realizedNetPnl: round2(realized),
      unrealizedPnl: round2(unrealNet),
      totalNetPnl: round2(finalEquity - initialCapital),
      roiPct: round3((100 * (finalEquity - initialCapital)) / initialCapital),
      maxDrawdown: round2(maxDd),
      trades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRatePct: trades.length ? round2((100 * wins.length) / trades.length) : null,
      avgWin: wins.length ? round2(grossWin / wins.length) : null,
      avgLoss: losses.length ? round2(grossLoss / losses.length) : null,
      profitFactor: grossLoss > 0 ? round4(grossWin / grossLoss) : null,
      expectancyPerTrade: trades.length ? round2((finalEquity - initialCapital) / trades.length) : null,
      totalCosts: round2(trades.reduce((a, t) => a + t.totalCosts, 0)),
      longestLossStreak: worst,
    },
    openPositions,
    unfilled,
    daily,
    trades,
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
