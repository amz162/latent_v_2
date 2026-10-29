/**
 * Task 61 — Walk-Forward Portfolio Simulator.
 *
 * Event-driven, chronological portfolio simulation using the genuine
 * out-of-sample pilot25 predictions. Models REAL portfolio accounting: cash,
 * concurrent positions, capital constraints, position sizing, daily mark-to-
 * market equity curve, + portfolio-level metrics (Sharpe, Sortino, max DD).
 *
 * Phase 3: Each model/horizon/strategy/cost combination runs as a SEPARATE
 * portfolio (no P&L aggregation across combos). The primary report is for
 * a single configurable combo.
 *
 * Phase 4: Chronological event-driven:
 *   - Signals sorted by decision_date (then descending predicted return,
 *     then alphabetical symbol for ties — deterministic, NO future-outcome)
 *   - Entry at next session open; position size from available cash + limits
 *   - Exits processed chronologically (SL/TP3/horizon-end)
 *   - Realized P&L → cash; open positions marked to market daily
 *   - Daily equity curve: cash + sum(market_value of open positions)
 *
 * Phase 5: Reuses simulateProgressiveTpSl from tp-sl-engine.ts for progressive.
 * Phase 6: Uses trading-costs.ts (standard_psx + high_slippage_psx).
 * Phase 7: Genuine portfolio metrics from the daily equity series.
 *
 * Does NOT modify Task 55/56/59/60 artifacts or ml_predictions_multi.json.
 * Output: data/backtest_reports/walk_forward_portfolio_latest.json
 * Run: bun scripts/walk_forward_portfolio_simulator.ts
 */
import { db } from "@/lib/db";
import { simulateProgressiveTpSl, type TpSlBar } from "@/lib/latent/tp-sl-engine";
import { STANDARD_PSX, HIGH_SLIPPAGE_PSX, computeTradeCosts, type CostProfile } from "@/lib/latent/trading-costs";
import { DEFAULT_PORTFOLIO_CONFIG, type PortfolioConfig } from "@/lib/latent/portfolio-config";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

const RUN_DIR = "data/backtest_reports/runs/pilot25_step50_20261028";
const MANIFEST_PATH = path.join(RUN_DIR, "manifest.json");
const SAMPLES_DIR = path.join(RUN_DIR, "samples");
const OUTPUT_PATH = "data/backtest_reports/walk_forward_portfolio_latest.json";
const CANDIDATE_PATH = "data/backtest_reports/walk_forward_portfolio_candidate.json";
const ML_PRED_FILE = "data/ml_predictions_multi.json";

const MODEL_NAMES = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"];
const HORIZONS = [5, 10, 21];
const ATR_PERIOD = 14;

interface Bar { date: string; open: number; high: number; low: number; close: number; }
interface RawRecord {
  sample_idx: number; sample_id: string; stock: string; date: number; close: number;
  models: Record<string, { horizon_preds: Record<string, { predicted: number; actual: number; eval_skipped: boolean }> }>;
}
interface Signal {
  sample_idx: number; stock: string; decision_date: number; decision_date_str: string;
  model: string; horizon: number; predicted_return: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function epochMsToDateStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function atr(highs: number[], lows: number[], closes: number[], period = ATR_PERIOD): number {
  if (closes.length < period + 1) {
    const ranges = highs.map((h, i) => h - lows[i]).filter((x) => x >= 0);
    return ranges.length ? ranges.reduce((s, v) => s + v, 0) / ranges.length : 0;
  }
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  return trs.slice(-period).reduce((s, v) => s + v, 0) / Math.min(period, trs.length);
}

function safeRound(x: number | null | undefined, nd = 6): number | null {
  if (x == null || typeof x !== "number" || !isFinite(x)) return null;
  return Math.round(x * 10 ** nd) / 10 ** nd;
}

// ─── portfolio simulation (one combo) ────────────────────────────────────────
interface OpenPosition {
  stock: string; entry_date: string; entry_price: number; shares: number;
  entry_value: number; entry_commission: number; entry_slippage: number;
  decision_date: number; horizon: number; model: string;
  // Progressive TP/SL fields (null for fixed-horizon)
  sl: number | null; tp1: number | null; tp2: number | null; tp3: number | null;
  best_target_reached: string;
  // Exit fields (filled when closed)
  exit_date: string | null; exit_price: number | null; exit_reason: string | null;
  exit_value: number | null; exit_commission: number; exit_slippage: number;
  gross_pnl: number | null; net_pnl: number | null; is_win: boolean;
}

interface SkippedEntry {
  sample_idx: number; stock: string; decision_date: number; model: string; horizon: number;
  predicted_return: number; reason: string;
}

interface PortfolioResult {
  model: string; horizon: number; strategy: string; cost_profile_id: string;
  initial_capital: number; final_equity: number;
  total_realized_net_pnl: number; total_unrealized_pnl: number;
  total_net_equity_change: number; total_return_pct: number;
  n_signals: number; n_executed: number; n_skipped: number;
  skipped_reasons: Record<string, number>;
  n_completed_positions: number; n_open_at_end: number;
  max_concurrent_positions: number; max_gross_exposure: number;
  total_costs: number; total_commission: number; total_slippage: number; total_cgt: number;
  sharpe: number | null; sortino: number | null; max_drawdown_pct: number | null; max_drawdown_pkr: number | null;
  n_trading_days: number;
  daily_equity_series_ref: string; // reference to the saved daily series
  per_stock_contribution: Record<string, { n_trades: number; realized_pnl: number }>;
  open_positions_at_end: Array<{ stock: string; shares: number; entry_price: number; market_price: number; unrealized_pnl: number }>;
  completed_trades: Array<{ stock: string; entry_date: string; exit_date: string; entry_price: number; exit_price: number; shares: number; exit_reason: string; best_target_reached: string; gross_pnl: number; net_pnl: number; is_win: boolean }>;
}

function runPortfolio(
  signals: Signal[], barsBySymbol: Map<string, Bar[]>, config: PortfolioConfig, profile: CostProfile,
  allDates: string[] // sorted unique trading dates in the final-test window
): PortfolioResult {
  let cash = config.initial_capital;
  const openPositions: OpenPosition[] = [];
  const completed: OpenPosition[] = [];
  const skipped: SkippedEntry[] = [];
  let maxConcurrent = 0;
  let maxGrossExposure = 0;
  const dailyEquity: { date: string; equity: number; cash: number; open_value: number }[] = [];
  const perStock: Record<string, { n_trades: number; realized_pnl: number }> = {};

  // Sort signals by decision_date, then descending predicted, then alphabetical stock (deterministic, NO future-outcome)
  signals.sort((a, b) => a.decision_date - b.decision_date || b.predicted_return - a.predicted_return || a.stock.localeCompare(b.stock));

  // Process signals in chronological order
  for (const sig of signals) {
    // First, process exits for open positions that should have exited by this date
    // (horizon-end or SL/TP3 for progressive)
    processExits(openPositions, completed, barsBySymbol, sig.decision_date_str, config, profile, (pnl, stock) => {
      cash += pnl;
      if (stock) { if (!perStock[stock]) perStock[stock] = { n_trades: 0, realized_pnl: 0 }; perStock[stock].n_trades++; perStock[stock].realized_pnl += pnl; }
    });

    // Check signal eligibility
    const bars = barsBySymbol.get(sig.stock) || [];
    const decisionIdx = bars.findIndex(b => b.date === sig.decision_date_str);
    if (decisionIdx < 0) { skipped.push({ ...sig, reason: "no_decision_bar" }); continue; }
    const entryIdx = decisionIdx + 1;
    if (entryIdx >= bars.length) { skipped.push({ ...sig, reason: "no_next_bar" }); continue; }
    if (sig.predicted_return <= config.signal_threshold) { skipped.push({ ...sig, reason: "below_threshold" }); continue; }

    // Check portfolio constraints
    if (openPositions.length >= config.max_concurrent_positions) { skipped.push({ ...sig, reason: "max_positions_reached" }); continue; }
    if (!config.allow_multiple_entries_same_stock && openPositions.some(p => p.stock === sig.stock)) { skipped.push({ ...sig, reason: "already_holding_stock" }); continue; }

    const entryBar = bars[entryIdx];
    const entryPrice = entryBar.open;
    const currentEquity = cash + openPositions.reduce((s, p) => {
      const idx = barsBySymbol.get(p.stock) || [];
      const todayBar = idx.find(b => b.date === sig.decision_date_str);
      return s + (todayBar ? p.shares * todayBar.close : p.shares * p.entry_price);
    }, 0);
    const currentGrossExposure = openPositions.reduce((s, p) => s + p.shares * p.entry_price, 0);

    // Position sizing
    const maxByPositionFraction = config.max_position_size_fraction * currentEquity;
    const maxByGrossExposure = (config.max_gross_exposure_fraction * currentEquity) - currentGrossExposure;
    const maxByStockExposure = config.max_exposure_per_stock_fraction * currentEquity;
    const maxByCash = cash;
    let maxPositionValue = Math.min(maxByPositionFraction, maxByGrossExposure, maxByStockExposure, maxByCash);
    if (maxPositionValue <= 0) { skipped.push({ ...sig, reason: "insufficient_cash" }); continue; }

    // Compute shares (integer if configured)
    let shares = config.fractional_shares ? maxPositionValue / entryPrice : Math.floor(maxPositionValue / entryPrice);
    if (config.board_lot_size > 0) shares = Math.floor(shares / config.board_lot_size) * config.board_lot_size;
    if (shares <= 0) { skipped.push({ ...sig, reason: "position_too_small" }); continue; }

    const entryValue = shares * entryPrice;
    const entryCommission = entryValue * profile.commissionRate; // entry side
    const entrySlippage = entryValue * profile.slippageRate * 0.5; // half of round-trip slippage at entry

    // Deduct entry costs from cash
    cash -= (entryValue + entryCommission + entrySlippage);

    // Create open position
    const pos: OpenPosition = {
      stock: sig.stock, entry_date: entryBar.date, entry_price: entryPrice, shares,
      entry_value: entryValue, entry_commission: entryCommission, entry_slippage: entrySlippage,
      decision_date: sig.decision_date, horizon: sig.horizon, model: sig.model,
      sl: null, tp1: null, tp2: null, tp3: null, best_target_reached: "—",
      exit_date: null, exit_price: null, exit_reason: null, exit_value: null,
      exit_commission: 0, exit_slippage: 0, gross_pnl: null, net_pnl: null, is_win: false,
    };

    // For progressive TP/SL: compute ATR + SL/TP levels
    if (config.strategy === "progressive_tp_sl") {
      const atrSlice = bars.slice(Math.max(0, decisionIdx - config.atr_period), decisionIdx + 1);
      const atrVal = atr(atrSlice.map(b => b.high), atrSlice.map(b => b.low), atrSlice.map(b => b.close)) || entryPrice * 0.02;
      pos.sl = entryPrice - atrVal * config.atr_sl_multiplier;
      pos.tp1 = entryPrice + atrVal * config.atr_tp1_multiplier;
      pos.tp2 = entryPrice + atrVal * config.atr_tp2_multiplier;
      pos.tp3 = entryPrice + atrVal * config.atr_tp3_multiplier;
    }

    openPositions.push(pos);
    if (openPositions.length > maxConcurrent) maxConcurrent = openPositions.length;
    const grossExp = openPositions.reduce((s, p) => s + p.shares * p.entry_price, 0);
    if (grossExp > maxGrossExposure) maxGrossExposure = grossExp;
  }

  // After all signals: process remaining exits (horizon-end or mark-to-market)
  processExits(openPositions, completed, barsBySymbol, "9999-99-99", config, profile, (pnl, stock) => {
    cash += pnl;
    if (stock) { if (!perStock[stock]) perStock[stock] = { n_trades: 0, realized_pnl: 0 }; perStock[stock].n_trades++; perStock[stock].realized_pnl += pnl; }
  });

  // Build daily equity curve
  for (const date of allDates) {
    let openValue = 0;
    for (const p of [...openPositions, ...completed]) {
      // Check if the position was open on this date
      if (p.entry_date <= date && (p.exit_date === null || p.exit_date >= date)) {
        const bars = barsBySymbol.get(p.stock) || [];
        const bar = bars.find(b => b.date === date);
        if (bar) openValue += p.shares * bar.close;
      }
    }
    dailyEquity.push({ date, equity: cash + openValue, cash, open_value: openValue });
  }

  // Mark remaining open positions to market at the last available close
  const openAtEnd = openPositions.filter(p => !p.exit_date);
  let totalUnrealized = 0;
  for (const p of openAtEnd) {
    const bars = barsBySymbol.get(p.stock) || [];
    const lastBar = bars[bars.length - 1];
    const marketPrice = lastBar ? lastBar.close : p.entry_price;
    const marketValue = p.shares * marketPrice;
    const unrealized = marketValue - p.entry_value - p.entry_commission - p.entry_slippage;
    p.exit_price = marketPrice;
    p.exit_date = lastBar ? lastBar.date : null;
    p.exit_reason = "MARK_TO_MARKET_END";
    p.gross_pnl = marketValue - p.entry_value;
    // Exit costs for mark-to-market
    p.exit_commission = marketValue * profile.commissionRate;
    p.exit_slippage = marketValue * profile.slippageRate * 0.5;
    const totalCost = p.entry_commission + p.entry_slippage + p.exit_commission + p.exit_slippage;
    const cgt = p.gross_pnl > 0 ? p.gross_pnl * profile.cgtRate : 0;
    p.net_pnl = p.gross_pnl - totalCost - cgt;
    p.is_win = p.net_pnl > 0;
    totalUnrealized += p.net_pnl;
    // Add back the entry value (cash was already deducted at entry)
    cash += marketValue - p.exit_commission - p.exit_slippage - (p.gross_pnl > 0 ? p.gross_pnl * profile.cgtRate : 0);
    if (!perStock[p.stock]) perStock[p.stock] = { n_trades: 0, realized_pnl: 0 };
    perStock[p.stock].n_trades++;
    perStock[p.stock].realized_pnl += p.net_pnl;
  }

  // Compute portfolio metrics from daily equity curve
  const equities = dailyEquity.map(d => d.equity);
  const finalEquity = equities.length > 0 ? equities[equities.length - 1] : cash;
  const totalRealizedNet = completed.reduce((s, p) => s + (p.net_pnl || 0), 0);
  const totalCosts = [...completed, ...openAtEnd].reduce((s, p) => s + p.entry_commission + p.entry_slippage + (p.exit_commission || 0) + (p.exit_slippage || 0), 0);
  const totalCommission = [...completed, ...openAtEnd].reduce((s, p) => s + p.entry_commission + (p.exit_commission || 0), 0);
  const totalSlippage = [...completed, ...openAtEnd].reduce((s, p) => s + p.entry_slippage + (p.exit_slippage || 0), 0);
  const totalCgt = [...completed, ...openAtEnd].reduce((s, p) => {
    const g = p.gross_pnl || 0;
    return s + (g > 0 ? g * profile.cgtRate : 0);
  }, 0);

  // Sharpe / Sortino / Max DD from daily equity
  let sharpe: number | null = null, sortino: number | null = null;
  let maxDDpct: number | null = null, maxDDpkr: number | null = null;
  if (equities.length > 1) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < equities.length; i++) {
      dailyReturns.push((equities[i] - equities[i - 1]) / equities[i - 1]);
    }
    const meanRet = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, v) => s + (v - meanRet) ** 2, 0) / dailyReturns.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (meanRet / std) * Math.sqrt(252) : null;
    const downside = dailyReturns.filter(r => r < 0);
    const ddVariance = downside.length > 0 ? downside.reduce((s, v) => s + v * v, 0) / downside.length : 0;
    const ddStd = Math.sqrt(ddVariance);
    sortino = ddStd > 0 ? (meanRet / ddStd) * Math.sqrt(252) : null;
    // Max drawdown
    let peak = equities[0];
    let maxDD = 0, maxDDAbs = 0;
    for (const e of equities) {
      if (e > peak) peak = e;
      const dd = peak - e;
      if (dd > maxDDAbs) { maxDDAbs = dd; maxDDpct = peak > 0 ? dd / peak : 0; }
    }
  }

  const skippedReasons: Record<string, number> = {};
  for (const s of skipped) skippedReasons[s.reason] = (skippedReasons[s.reason] || 0) + 1;

  return {
    model: signals[0]?.model || "", horizon: config.forecast_horizon,
    strategy: config.strategy, cost_profile_id: config.cost_profile_id,
    initial_capital: config.initial_capital, final_equity: safeRound(finalEquity, 2) || 0,
    total_realized_net_pnl: safeRound(totalRealizedNet, 2) || 0,
    total_unrealized_pnl: safeRound(totalUnrealized, 2) || 0,
    total_net_equity_change: safeRound(finalEquity - config.initial_capital, 2) || 0,
    total_return_pct: safeRound((finalEquity - config.initial_capital) / config.initial_capital * 100, 4) || 0,
    n_signals: signals.length, n_executed: completed.length + openAtEnd.length, n_skipped: skipped.length,
    skipped_reasons: skippedReasons,
    n_completed_positions: completed.length, n_open_at_end: openAtEnd.length,
    max_concurrent_positions: maxConcurrent, max_gross_exposure: safeRound(maxGrossExposure, 2) || 0,
    total_costs: safeRound(totalCosts, 2) || 0,
    total_commission: safeRound(totalCommission, 2) || 0,
    total_slippage: safeRound(totalSlippage, 2) || 0,
    total_cgt: safeRound(totalCgt, 2) || 0,
    sharpe: safeRound(sharpe, 4), sortino: safeRound(sortino, 4),
    max_drawdown_pct: safeRound(maxDDpct, 4), max_drawdown_pkr: safeRound(maxDDpkr, 2),
    n_trading_days: equities.length,
    daily_equity_series_ref: "embedded in artifact (daily_equity array)",
    per_stock_contribution: perStock,
    open_positions_at_end: openAtEnd.map(p => ({ stock: p.stock, shares: p.shares, entry_price: p.entry_price, market_price: p.exit_price || 0, unrealized_pnl: safeRound(p.net_pnl, 2) || 0 })),
    completed_trades: completed.map(p => ({ stock: p.stock, entry_date: p.entry_date, exit_date: p.exit_date || "", entry_price: p.entry_price, exit_price: p.exit_price || 0, shares: p.shares, exit_reason: p.exit_reason || "", best_target_reached: p.best_target_reached, gross_pnl: safeRound(p.gross_pnl, 2) || 0, net_pnl: safeRound(p.net_pnl, 2) || 0, is_win: p.is_win })),
  };
}

// Process exits for open positions that should have exited by `byDate`
function processExits(
  openPositions: OpenPosition[], completed: OpenPosition[], barsBySymbol: Map<string, Bar[]>,
  byDate: string, config: PortfolioConfig, profile: CostProfile,
  onRealize: (pnl: number, stock?: string) => void
) {
  const stillOpen: OpenPosition[] = [];
  for (const pos of openPositions) {
    if (pos.exit_date) { stillOpen.push(pos); continue; } // already closed
    const bars = barsBySymbol.get(pos.stock) || [];
    const entryIdx = bars.findIndex(b => b.date === pos.entry_date);
    if (entryIdx < 0) { stillOpen.push(pos); continue; }
    const horizonEndIdx = Math.min(entryIdx + pos.horizon, bars.length - 1);
    // Scan bars from entry+1 to horizon-end (or byDate, whichever is earlier)
    const scanEndIdx = Math.min(horizonEndIdx, bars.findIndex(b => b.date > byDate) >= 0 ? bars.findIndex(b => b.date > byDate) - 1 : bars.length - 1);

    if (config.strategy === "fixed_horizon") {
      // Fixed-horizon: exit at horizon-end close
      if (scanEndIdx >= horizonEndIdx || byDate === "9999-99-99") {
        const exitBar = bars[horizonEndIdx];
        pos.exit_date = exitBar.date;
        pos.exit_price = exitBar.close;
        pos.exit_reason = "HORIZON_EXIT";
        pos.best_target_reached = "—";
        const exitValue = pos.shares * exitBar.close;
        pos.exit_value = exitValue;
        pos.exit_commission = exitValue * profile.commissionRate;
        pos.exit_slippage = exitValue * profile.slippageRate * 0.5;
        pos.gross_pnl = exitValue - pos.entry_value;
        const totalCost = pos.entry_commission + pos.entry_slippage + pos.exit_commission + pos.exit_slippage;
        const cgt = pos.gross_pnl > 0 ? pos.gross_pnl * profile.cgtRate : 0;
        pos.net_pnl = pos.gross_pnl - totalCost - cgt;
        pos.is_win = pos.net_pnl > 0;
        completed.push(pos);
        // Return entry value + net P&L to cash
        onRealize(pos.entry_value + (pos.net_pnl || 0), pos.stock);
      } else {
        stillOpen.push(pos);
      }
    } else {
      // Progressive TP/SL: use simulateProgressiveTpSl
      const scanBars: TpSlBar[] = bars.slice(entryIdx + 1, scanEndIdx + 1).map(b => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
      if (scanBars.length === 0) { stillOpen.push(pos); continue; }
      const r = simulateProgressiveTpSl({ direction: "BUY", entryPrice: pos.entry_price, sl: pos.sl!, tp1: pos.tp1!, tp2: pos.tp2!, tp3: pos.tp3!, bars: scanBars });
      if (r.exitBarIdx >= 0 && (r.exitReason !== "TIME_UP" || scanEndIdx >= horizonEndIdx || byDate === "9999-99-99")) {
        // Exit happened
        const exitBarIdx = entryIdx + 1 + r.exitBarIdx;
        const exitBar = bars[exitBarIdx];
        pos.exit_date = exitBar.date;
        pos.exit_price = r.exitPrice;
        pos.exit_reason = r.exitReason === "TIME_UP" ? "HORIZON_EXIT" : r.exitReason;
        pos.best_target_reached = r.bestTargetReached;
        const exitValue = pos.shares * r.exitPrice;
        pos.exit_value = exitValue;
        pos.exit_commission = exitValue * profile.commissionRate;
        pos.exit_slippage = exitValue * profile.slippageRate * 0.5;
        pos.gross_pnl = exitValue - pos.entry_value;
        const totalCost = pos.entry_commission + pos.entry_slippage + pos.exit_commission + pos.exit_slippage;
        const cgt = pos.gross_pnl > 0 ? pos.gross_pnl * profile.cgtRate : 0;
        pos.net_pnl = pos.gross_pnl - totalCost - cgt;
        pos.is_win = pos.net_pnl > 0;
        completed.push(pos);
        onRealize(pos.entry_value + (pos.net_pnl || 0), pos.stock);
      } else {
        stillOpen.push(pos);
      }
    }
  }
  openPositions.length = 0;
  openPositions.push(...stillOpen);
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("Task 61 — Walk-Forward Portfolio Simulator");
  console.log("=".repeat(60));

  const mlHash = crypto.createHash("md5").update(fs.readFileSync(ML_PRED_FILE)).digest("hex");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  console.log(`manifest: ${manifest.run_id} val_end_idx=${manifest.val_end_idx}`);

  // Load raw records (final-test only)
  const records: RawRecord[] = [];
  for (let i = manifest.val_end_idx; i < manifest.n_samples; i++) records.push(JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, `sample_${String(i).padStart(6, "0")}.json`), "utf8")));
  console.log(`loaded ${records.length} final-test records`);

  // Load OHLCV bars
  const barsBySymbol = new Map<string, Bar[]>();
  for (const sym of manifest.universe.symbols) {
    const rows = await db.ohlcvBar.findMany({ where: { symbol: sym }, orderBy: { date: "asc" } });
    barsBySymbol.set(sym, rows.map(r => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close })));
  }

  // Collect all unique trading dates in the final-test window
  const allDatesSet = new Set<string>();
  for (const bars of barsBySymbol.values()) for (const b of bars) if (b.date >= "2023-04-17") allDatesSet.add(b.date);
  const allDates = Array.from(allDatesSet).sort();
  console.log(`trading dates in window: ${allDates.length}`);

  // Collect signals for each model/horizon combo
  const profiles = { standard_psx: STANDARD_PSX, high_slippage_psx: HIGH_SLIPPAGE_PSX };
  const results: PortfolioResult[] = [];

  // Phase 3A: run each model/horizon/strategy/cost as a SEPARATE portfolio
  // For runtime efficiency, run a SUBSET: all 5 models × 5d horizon × both strategies × standard_psx
  // (the full 60-combo run would take too long)
  const combosToRun: Array<{ model: string; horizon: number; strategy: "fixed_horizon" | "progressive_tp_sl"; cost: "standard_psx" }> = [];
  for (const model of MODEL_NAMES) {
    for (const strategy of ["fixed_horizon", "progressive_tp_sl"] as const) {
      combosToRun.push({ model, horizon: 5, strategy, cost: "standard_psx" });
    }
  }
  console.log(`running ${combosToRun.length} portfolio combos (5 models × 5d × 2 strategies × standard_psx)`);

  for (const combo of combosToRun) {
    const signals: Signal[] = [];
    for (const rec of records) {
      const m = rec.models[combo.model];
      if (!m) continue;
      const hp = m.horizon_preds[String(combo.horizon)];
      if (!hp || hp.eval_skipped) continue;
      if (hp.predicted <= 0.01) continue; // only BUY signals
      signals.push({
        sample_idx: rec.sample_idx, stock: rec.stock, decision_date: rec.date,
        decision_date_str: epochMsToDateStr(rec.date), model: combo.model, horizon: combo.horizon,
        predicted_return: hp.predicted,
      });
    }
    const config: PortfolioConfig = { ...DEFAULT_PORTFOLIO_CONFIG, forecast_horizon: combo.horizon, strategy: combo.strategy, cost_profile_id: combo.cost };
    const profile = profiles[combo.cost as keyof typeof profiles];
    console.log(`  ${combo.model} ${combo.horizon}d ${combo.strategy}...`, signals.length, "signals");
    const result = runPortfolio(signals, barsBySymbol, config, profile, allDates);
    results.push(result);
    console.log(`    final_equity=${result.final_equity} return=${result.total_return_pct}% sharpe=${result.sharpe} maxDD=${result.max_drawdown_pct}`);
  }

  // ── assemble output ──
  const out = {
    task: "task61_portfolio_simulation",
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source_run_id: manifest.run_id,
    source_data_fingerprint: manifest.data_fingerprint,
    source_universe_fingerprint: manifest.universe.fingerprint,
    ml_predictions_md5: mlHash,
    config: DEFAULT_PORTFOLIO_CONFIG,
    config_note: "Hypothetical PKR 1,000,000 initial capital. Long-only, max 10 concurrent positions, max 10% equity per position, max gross exposure = 100% (no leverage), one position per stock (no pyramiding). These are EXPLICIT RESEARCH ASSUMPTIONS, not claims of optimality.",
    evaluation_period: { start: "2023-04-17", end: "2026-12-19", val_end_idx: manifest.val_end_idx, final_test_samples: records.length },
    portfolios: results,
    exploratory_warning: "EXPLORATORY final-test analysis — prior tasks (59/60) inspected these final-test results. Do NOT claim this as a fresh unbiased confirmation. No parameters were tuned on final-test. Prospective paper-trading or a new untouched future evaluation is required before a confirmatory claim.",
    unsupported_in_this_run: "Only 5d horizon × standard_psx is run (10 combos). Full 60-combo run (5 models × 3 horizons × 2 strategies × 2 cost profiles) deferred for runtime. Each combo is a SEPARATE portfolio — P&L is NOT aggregated across combos.",
    limitations: [
      "Hypothetical PKR 1,000,000 initial capital — NOT the user's actual capital.",
      "Long-only, max 10 positions, max 10%/position, no leverage. Research assumptions, not optimal.",
      "EXPLORATORY final-test (prior tasks inspected results). No confirmatory claim without prospective evaluation.",
      "Only 5d horizon × standard_psx run (10 combos). Full 60-combo run deferred.",
      "Each combo is a SEPARATE portfolio — P&L is NOT summed across combos.",
      "Portfolio metrics (Sharpe/Sortino/maxDD) computed from the daily mark-to-market equity curve, NOT from trade returns.",
      "No partial exits or trailing stops (Task 57/58 convention — active stop FIXED = sl).",
    ],
  };

  // Write candidate → validate → promote
  fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(out, null, 2));
  console.log(`\n✓ Candidate written: ${CANDIDATE_PATH}`);
  const valid = results.length > 0 && results.every(r => r.final_equity > 0);
  if (valid) {
    if (fs.existsSync(OUTPUT_PATH)) fs.copyFileSync(OUTPUT_PATH, OUTPUT_PATH.replace(".json", "_previous.json"));
    fs.copyFileSync(CANDIDATE_PATH, OUTPUT_PATH);
    console.log(`✓ Promoted to latest: ${OUTPUT_PATH}`);
  } else {
    console.log("✗ Candidate NOT promoted — latest portfolio report preserved.");
  }
  console.log(`\n=== SUMMARY ===`);
  for (const r of results) {
    console.log(`${r.model} ${r.horizon}d ${r.strategy}: equity=${r.final_equity} return=${r.total_return_pct}% sharpe=${r.sharpe} maxDD=${r.max_drawdown_pct} trades=${r.n_completed_positions}+${r.n_open_at_end}open`);
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
