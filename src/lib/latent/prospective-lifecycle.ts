/**
 * Task 77 — Prospective paper-trade lifecycle service (Phases 3 + 4).
 *
 * Wires the Task 76 Prisma models (ProspectivePaperTrade, PaperTradeLeg,
 * PredictionOutcome, PredictionRiskLevels) into a real daily workflow that:
 *   1. Validates freshness + inference availability.
 *   2. Reads eligible BUY predictions + their immutable risk levels.
 *   3. Creates idempotent trade records (3 strategies × each eligible prediction).
 *   4. Enters at the next eligible symbol-specific session open (strictly after
 *      the prediction's effective cutoff). If the next session hasn't occurred,
 *      the trade stays pending_entry — no fabricated entry.
 *   5. Advances open positions chronologically through newly available OHLCV
 *      bars using the Task 76 strategy engine (unchanged). Closes on SL/TP3/
 *      scale-out exit OR horizon timeout (full window). Partial windows keep
 *      the trade open (mark-to-market for unrealized P&L only).
 *   6. Records exit legs (quantity, fill, costs, P&L per leg) idempotently.
 *   7. Matures forecast outcomes (PredictionOutcome) once the horizon target
 *      session close exists — independent of whether a trade closed. HOLD
 *      forecasts mature too (forecast quality ≠ trade outcome).
 *   8. Reconciles counts, cash, P&L, books + returns a truthful status.
 *
 * Idempotency: DB unique constraints (sourcePredictionId+strategyId+bookId on
 * trades; tradeId+legIdx on legs; predictionId on outcomes) are the FINAL
 * protection against concurrent/repeated runs. Re-running is safe + produces
 * the same state. No PredictionHistory record is ever modified except its
 * outcomeStatus (pending→matured) which is the designed lifecycle transition.
 *
 * Books: each (model, horizon, strategy, costProfile) is a separate shadow
 * book with its own PKR 1M capital, 10% max per position, max 10 positions,
 * no leverage. Books are NEVER combined into a fictional funded account.
 */

import { db } from "@/lib/db";
import { checkDataFreshness, checkInferenceAvailability } from "./data-freshness";
import {
  simulateStrategy,
  STRATEGIES,
  STRATEGY_POLICY_VERSION,
  type StrategyId,
  type StrategyBar,
  type StrategySignal,
} from "./strategy-engine";
import { STANDARD_PSX } from "./trading-costs";

// ─── Portfolio config (matches portfolio-config.ts + the prospective policy) ──
const INITIAL_CAPITAL = 1_000_000;
const MAX_POSITION_FRACTION = 0.10;
const ALLOCATION = INITIAL_CAPITAL * MAX_POSITION_FRACTION; // PKR 100,000 per position
const MAX_CONCURRENT_POSITIONS = 10;
const COST_PROFILE = STANDARD_PSX;

export type LifecycleStatus = "BLOCKED" | "READY" | "ACTIVE" | "EVALUATING" | "COMPLETED";

export interface BookSummary {
  bookId: string;
  strategyId: string;
  modelId: string;
  horizon: number;
  positions: number;
  closed: number;
  cash: number;
  realizedNetPnl: number;
  unrealizedPnl: number;
  allocatedCash: number;
  openMarketValue: number; // Phase 2B: sum(open quantity × latest close)
  markedEquity: number;   // Phase 2B: cash + openMarketValue
  netAssetChange: number; // Phase 2B: markedEquity − INITIAL_CAPITAL
}

export interface LifecycleCounts {
  predictionsTotal: number;
  buyPredictions: number;
  buyPredictionsWithRiskLevels: number;
  tradesTotal: number;
  tradesByState: { pending_entry: number; open: number; closed: number; skipped: number };
  tradesByStrategy: Record<string, number>;
  tradesGenuine: number;
  tradesDemo: number;
  outcomesTotal: number;
  outcomesByStatus: { pending: number; matured: number; unavailable: number };
  legsTotal: number;
}

export interface LifecycleResult {
  status: LifecycleStatus;
  blockReason: string | null;
  freshness: Awaited<ReturnType<typeof checkDataFreshness>>;
  inference: Awaited<ReturnType<typeof checkInferenceAvailability>>;
  counts: LifecycleCounts;
  books: BookSummary[];
  generatedAt: string;
  latestOhlcv: string | null;
  runStats: {
    tradesCreated: number;
    tradesEntered: number;
    tradesClosed: number;
    outcomesCreated: number;
    outcomesMatured: number;
  };
  policy: {
    direction: "long_only";
    strategies: string[];
    strategyPolicyVersion: string;
    costProfile: string;
    initialCapital: number;
    maxConcurrentPositions: number;
    maxPositionSizeFraction: number;
    noLeverage: boolean;
    onePositionPerStock: boolean;
    entryConvention: "next_session_open";
    signalThreshold: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Index of the first bar strictly after `afterDate` (the next session). -1 if none. */
function nextSessionIdx(bars: { date: string }[], afterDate: string): number {
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].date > afterDate) return i;
  }
  return -1;
}

/**
 * Resolve the effective cutoff bar index for a prediction. The prediction's
 * dataCutoff is the GLOBAL latest OHLCV date (set by generate_live_predictions.py);
 * some symbols are stale (their latest bar is earlier). Use the declared cutoff
 * if its bar exists; otherwise fall back to the symbol's latest bar — the real
 * data the prediction was made on (entryPrice = that bar's close).
 */
function resolveCutoffIdx(bars: { date: string }[], declaredCutoff: string | null | undefined): number {
  if (!declaredCutoff) return bars.length - 1; // fallback: latest bar
  const idx = bars.findIndex((b) => b.date === declaredCutoff);
  return idx >= 0 ? idx : bars.length - 1; // fallback: latest bar
}

// ─── Main lifecycle ──────────────────────────────────────────────────────────

export async function runLifecycle(opts: { dryRun?: boolean } = {}): Promise<LifecycleResult> {
  const generatedAt = new Date().toISOString();

  // 1. Freshness + inference
  const freshness = await checkDataFreshness(3);
  const inference = await checkInferenceAvailability();
  const blocked = !inference.available;
  const blockReason = blocked ? inference.reason : null;

  // 2. Load eligible BUY predictions + risk levels
  const buyPreds = await db.predictionHistory.findMany({ where: { signal: "BUY" } });
  const riskLevelsMap = new Map<string, NonNullable<Awaited<ReturnType<typeof db.predictionRiskLevels.findUnique>>>>();
  for (const p of buyPreds) {
    const rl = await db.predictionRiskLevels.findUnique({ where: { predictionId: p.id } });
    if (rl) riskLevelsMap.set(p.id, rl);
  }

  // Group by symbol (load bars once per symbol)
  const symbols = [...new Set(buyPreds.map((p) => p.symbol))];
  const barsBySymbol = new Map<string, { date: string; open: number; high: number; low: number; close: number }[]>();
  for (const sym of symbols) {
    const bars = await db.ohlcvBar.findMany({
      where: { symbol: sym },
      orderBy: { date: "asc" },
      select: { date: true, open: true, high: true, low: true, close: true },
    });
    barsBySymbol.set(sym, bars);
  }

  let tradesCreated = 0, tradesEntered = 0, tradesClosed = 0;

  // 3-6. Create / enter / advance / close trades
  for (const pred of buyPreds) {
    const rl = riskLevelsMap.get(pred.id);
    if (!rl) continue; // no risk levels → can't trade (kept out of the ledger)
    if (!pred.horizon) continue;
    const bars = barsBySymbol.get(pred.symbol);
    if (!bars || bars.length === 0) continue;

    const cutoffIdx = resolveCutoffIdx(bars, rl.effectiveCutoff);
    const entryIdx = nextSessionIdx(bars, bars[cutoffIdx].date);
    const canEnter = entryIdx >= 0;

    for (const strat of STRATEGIES) {
      const bookId = `book_${pred.modelId}_${pred.horizon}d_${strat.id}_${COST_PROFILE.id}`;

      // Idempotent: find or create
      let trade = await db.prospectivePaperTrade.findUnique({
        where: { sourcePredictionId_strategyId_bookId: { sourcePredictionId: pred.id, strategyId: strat.id, bookId } },
      });
      if (!trade) {
        trade = await db.prospectivePaperTrade.create({
          data: {
            sourcePredictionId: pred.id,
            strategyId: strat.id,
            policyVersion: STRATEGY_POLICY_VERSION,
            bookId,
            modelId: pred.modelId,
            horizon: pred.horizon,
            symbol: pred.symbol,
            direction: "BUY",
            state: "pending_entry",
            sl: rl.sl, tp1: rl.tp1, tp2: rl.tp2, tp3: rl.tp3,
            isDemo: false,
          },
        });
        tradesCreated++;
      }

      // Enter if possible
      if (trade.state === "pending_entry") {
        if (!canEnter) continue; // no next-session bar yet — stay pending
        const entryBar = bars[entryIdx];
        if (!entryBar || !entryBar.open || entryBar.open <= 0) {
          await db.prospectivePaperTrade.update({
            where: { id: trade.id },
            data: { state: "skipped", skipReason: "missing-or-invalid-entry-open" },
          });
          continue;
        }
        const entryPrice = entryBar.open;
        const quantity = Math.max(1, Math.floor(ALLOCATION / entryPrice));
        const allocatedCash = quantity * entryPrice;
        // Phase 2A: enforce book constraints at entry (not just policy metadata).
        const openInBook = await db.prospectivePaperTrade.findMany({
          where: { bookId, state: "open" },
          select: { symbol: true, allocatedCash: true },
        });
        if (openInBook.length >= MAX_CONCURRENT_POSITIONS) {
          await db.prospectivePaperTrade.update({ where: { id: trade.id }, data: { state: "skipped", skipReason: "max-concurrent-positions-reached" }});
          continue;
        }
        if (openInBook.some((t) => t.symbol === pred.symbol)) {
          await db.prospectivePaperTrade.update({ where: { id: trade.id }, data: { state: "skipped", skipReason: "one-position-per-stock-per-book" }});
          continue;
        }
        const cashUsed = openInBook.reduce((s, t) => s + (t.allocatedCash ?? 0), 0);
        if (INITIAL_CAPITAL - cashUsed < allocatedCash) {
          await db.prospectivePaperTrade.update({ where: { id: trade.id }, data: { state: "skipped", skipReason: "insufficient-cash" }});
          continue;
        }
        trade = await db.prospectivePaperTrade.update({
          where: { id: trade.id },
          data: {
            state: "open",
            entryDate: entryBar.date,
            entryPrice,
            quantity,
            allocatedCash: quantity * entryPrice,
            activeStopFinal: rl.sl,
          },
        });
        tradesEntered++;
      }

      // Advance open trades
      if (trade.state === "open" && trade.entryDate && trade.entryPrice && trade.quantity) {
        const entryBarIdx = bars.findIndex((b) => b.date === trade.entryDate);
        if (entryBarIdx < 0) continue;
        const h = pred.horizon;
        // Phase 2C: scan window = entry session through t+horizon (inclusive, h bars).
        // The entry bar IS the first strategy bar (SL/TP can be hit on the entry
        // session itself via a gap). Target = t+h matches the forecast outcome.
        const scanEnd = Math.min(bars.length, entryBarIdx + h);
        const scanBars: StrategyBar[] = bars
          .slice(entryBarIdx, scanEnd)
          .map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));

        const signal: StrategySignal = {
          symbol: pred.symbol,
          direction: "BUY",
          entryPrice: trade.entryPrice,
          sl: trade.sl!,
          tp1: trade.tp1!,
          tp2: trade.tp2!,
          tp3: trade.tp3!,
          quantity: trade.quantity,
        };
        const result = simulateStrategy(strat.id as StrategyId, signal, scanBars, COST_PROFILE);

        // Close only on a real exit OR timeout with the full horizon examined.
        // A TIME_UP on a partial window means the trade stays open (more bars needed).
        const fullHorizonExamined = result.nBarsExamined >= h;
        const shouldClose = result.exitReason !== "TIME_UP" || fullHorizonExamined;
        if (!shouldClose) continue; // stay open

        await db.$transaction(async (tx) => {
          for (let li = 0; li < result.legs.length; li++) {
            const leg = result.legs[li];
            await tx.paperTradeLeg.upsert({
              where: { tradeId_legIdx: { tradeId: trade.id, legIdx: li } },
              create: {
                tradeId: trade.id, legIdx: li, exitDate: leg.exitDate, exitPrice: leg.exitPrice,
                exitReason: leg.exitReason, quantity: leg.quantity, grossPnl: leg.grossPnl,
                commission: leg.commission, slippage: leg.slippage, cgt: leg.cgt,
                totalCost: leg.totalCost, netPnl: leg.netPnl,
              },
              update: {}, // idempotent — never overwrite an existing leg
            });
          }
          await tx.prospectivePaperTrade.update({
            where: { id: trade.id },
            data: {
              state: "closed",
              exitReason: result.exitReason,
              grossPnl: result.grossPnl,
              totalCosts: result.totalCost,
              netPnl: result.netPnl,
              isWin: result.isWin,
              activeStopFinal: result.activeStopFinal,
            },
          });
        });
        tradesClosed++;
      }
    }
  }

  // 7. Mature forecast outcomes (Phase 4) — ALL predictions (BUY + HOLD)
  let outcomesCreated = 0, outcomesMatured = 0;
  const allPreds = await db.predictionHistory.findMany();
  // Extend bars cache for HOLD-prediction symbols not already loaded
  const holdSymbols = [...new Set(allPreds.filter(p => p.signal !== "BUY").map(p => p.symbol))];
  for (const sym of holdSymbols) {
    if (!barsBySymbol.has(sym)) {
      const bars = await db.ohlcvBar.findMany({
        where: { symbol: sym }, orderBy: { date: "asc" },
        select: { date: true, open: true, high: true, low: true, close: true },
      });
      barsBySymbol.set(sym, bars);
    }
  }
  for (const pred of allPreds) {
    if (!pred.horizon) continue;
    let outcome = await db.predictionOutcome.findUnique({ where: { predictionId: pred.id } });
    if (!outcome) {
      outcome = await db.predictionOutcome.create({ data: { predictionId: pred.id, outcomeStatus: "pending" } });
      outcomesCreated++;
    }
    if (outcome.outcomeStatus === "matured") continue; // never re-mature

    const bars = barsBySymbol.get(pred.symbol);
    if (!bars || bars.length === 0) continue;
    // The decision reference = the cutoff bar (the bar the prediction was made on).
    // Use entryPrice (= cutoff close) to find it; fall back to the symbol's latest bar.
    const cutoffIdx = resolveCutoffIdx(bars, pred.dataCutoff);
    const targetIdx = cutoffIdx + pred.horizon;
    if (targetIdx >= bars.length) continue; // target session doesn't exist yet → pending
    const targetBar = bars[targetIdx];
    const decisionRef = pred.entryPrice ?? bars[cutoffIdx].close;
    if (!decisionRef || !targetBar.close) continue;
    const actualReturn = (targetBar.close - decisionRef) / decisionRef;
    await db.predictionOutcome.update({
      where: { predictionId: pred.id },
      data: {
        targetDate: targetBar.date,
        observedClose: targetBar.close,
        actualReturn,
        maturityTs: Date.now().toString(),
        outcomeStatus: "matured",
      },
    });
    // Sync the PredictionHistory outcomeStatus (the designed lifecycle transition)
    if (pred.outcomeStatus !== "matured") {
      await db.predictionHistory.update({ where: { id: pred.id }, data: { outcomeStatus: "matured" } });
    }
    outcomesMatured++;
  }

  // 8. Reconcile counts + books
  const counts = await reconcileCounts();
  const books = await reconcileBooks();

  // Determine truthful status (Phase 2D/2E):
  //   BLOCKED    — required data/inference unavailable
  //   ACTIVE     — OPEN positions are actually being managed (not just pending_entry)
  //   EVALUATING — mature forecast outcomes exist but skill evidence insufficient
  //   READY      — valid setup, no eligible next-session entry yet (or only pending_entry)
  // Do NOT mark ACTIVE solely because pending_entry > 0 — pending entries waiting for
  // future sessions (especially stale symbols) are not an active managed lifecycle.
  const status: LifecycleStatus = blocked
    ? "BLOCKED"
    : counts.tradesByState.open > 0
    ? "ACTIVE"
    : counts.outcomesByStatus.matured > 0
    ? "EVALUATING"
    : "READY";

  const latestBar = await db.ohlcvBar.findFirst({ orderBy: { date: "desc" }, select: { date: true } });

  return {
    status,
    blockReason,
    freshness,
    inference,
    counts,
    books,
    generatedAt,
    latestOhlcv: latestBar?.date ?? null,
    runStats: { tradesCreated, tradesEntered, tradesClosed, outcomesCreated, outcomesMatured },
    policy: {
      direction: "long_only",
      strategies: STRATEGIES.map((s) => s.id),
      strategyPolicyVersion: STRATEGY_POLICY_VERSION,
      costProfile: COST_PROFILE.id,
      initialCapital: INITIAL_CAPITAL,
      maxConcurrentPositions: MAX_CONCURRENT_POSITIONS,
      maxPositionSizeFraction: MAX_POSITION_FRACTION,
      noLeverage: true,
      onePositionPerStock: true,
      entryConvention: "next_session_open",
      signalThreshold: 0.01,
    },
  };
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export async function reconcileCounts(): Promise<LifecycleCounts> {
  const predictionsTotal = await db.predictionHistory.count();
  const buyPredictions = await db.predictionHistory.count({ where: { signal: "BUY" } });
  const buyPredictionsWithRiskLevels = await db.predictionRiskLevels.count();
  const tradesTotal = await db.prospectivePaperTrade.count();
  const tradesGenuine = await db.prospectivePaperTrade.count({ where: { isDemo: false } });
  const tradesDemo = await db.prospectivePaperTrade.count({ where: { isDemo: true } });
  const pe = await db.prospectivePaperTrade.count({ where: { state: "pending_entry" } });
  const op = await db.prospectivePaperTrade.count({ where: { state: "open" } });
  const cl = await db.prospectivePaperTrade.count({ where: { state: "closed" } });
  const sk = await db.prospectivePaperTrade.count({ where: { state: "skipped" } });
  const tradesByStrategyRaw = await db.prospectivePaperTrade.groupBy({ by: ["strategyId"], _count: { _all: true } });
  const tradesByStrategy: Record<string, number> = {};
  for (const s of tradesByStrategyRaw) tradesByStrategy[s.strategyId] = s._count._all;
  const outcomesTotal = await db.predictionOutcome.count();
  const opPend = await db.predictionOutcome.count({ where: { outcomeStatus: "pending" } });
  const opMat = await db.predictionOutcome.count({ where: { outcomeStatus: "matured" } });
  const opUn = await db.predictionOutcome.count({ where: { outcomeStatus: "unavailable" } });
  const legsTotal = await db.paperTradeLeg.count();
  return {
    predictionsTotal, buyPredictions, buyPredictionsWithRiskLevels,
    tradesTotal, tradesByState: { pending_entry: pe, open: op, closed: cl, skipped: sk },
    tradesByStrategy, tradesGenuine, tradesDemo,
    outcomesTotal, outcomesByStatus: { pending: opPend, matured: opMat, unavailable: opUn },
    legsTotal,
  };
}

export async function reconcileBooks(): Promise<BookSummary[]> {
  const trades = await db.prospectivePaperTrade.findMany();
  // Phase 2B: load the latest OHLCV close per symbol for unrealized mark-to-market.
  const openSymbols = [...new Set(trades.filter((t) => t.state === "open" && t.symbol).map((t) => t.symbol))];
  const latestCloseBySymbol = new Map<string, number>();
  for (const sym of openSymbols) {
    const lb = await db.ohlcvBar.findFirst({ where: { symbol: sym }, orderBy: { date: "desc" }, select: { close: true } });
    if (lb) latestCloseBySymbol.set(sym, lb.close);
  }
  const byBook = new Map<string, typeof trades>();
  for (const t of trades) {
    if (!byBook.has(t.bookId)) byBook.set(t.bookId, []);
    byBook.get(t.bookId)!.push(t);
  }
  const books: BookSummary[] = [];
  for (const [bookId, ts] of byBook) {
    const first = ts[0];
    const open = ts.filter((t) => t.state === "open");
    const closed = ts.filter((t) => t.state === "closed");
    const allocatedCash = open.reduce((s, t) => s + (t.allocatedCash ?? 0), 0);
    const realizedNetPnl = closed.reduce((s, t) => s + (t.netPnl ?? 0), 0);
    // Phase 2B: unrealized P&L from the latest observed OHLCV close (NOT the active
    // stop or zero). For BUY: (latestClose − entryPrice) × quantity. Uses null/
    // unavailable when the mark is absent.
    let unrealizedPnl = 0;
    let openMarketValue = 0;
    for (const t of open) {
      const mark = latestCloseBySymbol.get(t.symbol);
      if (mark != null && t.entryPrice != null && t.quantity != null) {
        unrealizedPnl += (mark - t.entryPrice) * t.quantity;
        openMarketValue += mark * t.quantity;
      }
    }
    // Cash: starting capital − open allocated principal + realized net (closed trades
    // already net of all entry+exit costs + CGT). Entry costs on open positions are
    // captured when the trade closes (in the legs' totalCost); while open, the
    // principal is the main cash deduction.
    const cash = INITIAL_CAPITAL - allocatedCash + realizedNetPnl;
    const markedEquity = cash + openMarketValue;
    const netAssetChange = markedEquity - INITIAL_CAPITAL;
    books.push({
      bookId, strategyId: first.strategyId, modelId: first.modelId, horizon: first.horizon ?? 0,
      positions: open.length, closed: closed.length,
      cash, realizedNetPnl, unrealizedPnl, allocatedCash, openMarketValue, markedEquity, netAssetChange,
    });
  }
  return books;
}
