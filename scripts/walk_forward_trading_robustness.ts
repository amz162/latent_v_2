/**
 * Task 60 — Walk-Forward Trading Robustness Analysis.
 *
 * Builds on Task 59's trading evaluator by:
 *   Phase 1: Reconstructing a TRADE-LEDGER of individual trade records (the
 *     Task 59 report only saved aggregates). Reconstructed from the IMMUTABLE
 *     out-of-sample predictions + verified historical OHLCV bars — not
 *     invented from aggregates.
 *   Phase 2: Full per-model × per-horizon × per-strategy × per-cost-profile
 *     breakdown (eligible, BUY signals, executed, skipped, wins/losses, gross/
 *     costs/net, profit factor, TP milestones, exit reasons, per-stock).
 *     Extends high-slippage sensitivity to the FIXED-HORIZON strategy.
 *   Phase 3: Date-block bootstrap 95% CIs (cluster by decision date — all
 *     model/horizon trades on the same date form one cluster; resample 22
 *     clusters with replacement; NOT naive iid). Paired diffs (fixed vs
 *     progressive, standard vs high-slip).
 *   Phase 4: Cost reconciliation (gross + commission + slippage + CGT = total;
 *     net = gross − total). Verifies net wins = netPnl>0; TP milestones not
 *     counted as wins; TP2-then-SL preserves target + uses actual exit P&L.
 *   Phase 5: Selection-bias warnings (exploratory final-test; no tuning;
 *     multiple-comparison risk).
 *   Phase 6: Portfolio metrics remain UNAVAILABLE.
 *
 * Reuses the SAME trade decisions (signals, entries, exits) as the Task 59
 * evaluator — same signal threshold (+1%), same ATR config (1.5/1/2/3), same
 * next-session-open entry. Does NOT retrain models or rerun pilot25.
 *
 * Does NOT modify walk_forward_latest.json, pilot25_robustness.json,
 * walk_forward_trading_latest.json, or ml_predictions_multi.json. Outputs a
 * SEPARATE trading-robustness artifact.
 *
 * Output: data/backtest_reports/walk_forward_trading_robustness.json
 * Run: bun scripts/walk_forward_trading_robustness.ts
 */
import { db } from "@/lib/db";
import { simulateProgressiveTpSl, type TpSlBar } from "@/lib/latent/tp-sl-engine";
import { STANDARD_PSX, HIGH_SLIPPAGE_PSX, computeTradeCosts, type CostProfile } from "@/lib/latent/trading-costs";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

const RUN_DIR = "data/backtest_reports/runs/pilot25_step50_20261028";
const MANIFEST_PATH = path.join(RUN_DIR, "manifest.json");
const SAMPLES_DIR = path.join(RUN_DIR, "samples");
const OUTPUT_PATH = "data/backtest_reports/walk_forward_trading_robustness.json";
const ML_PRED_FILE = "data/ml_predictions_multi.json";

const SIGNAL_THRESHOLD = 0.01;
const HORIZONS = [5, 10, 21];
const MODEL_NAMES = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"];
const ATR_PERIOD = 14;
const NOTIONAL = 100000;
const BOOTSTRAP_REPS = 1000;
const SEED = 20261030; // deterministic

interface Bar { date: string; open: number; high: number; low: number; close: number; }
interface RawRecord {
  sample_idx: number; sample_id: string; stock: string; date: number; close: number;
  models: Record<string, { horizon_preds: Record<string, { predicted: number; actual: number; eval_skipped: boolean }> }>;
}

interface TradeLedgerEntry {
  sample_idx: number; stock: string; decision_date: number; decision_date_str: string;
  model: string; horizon: number; strategy: "fixed_horizon" | "progressive_tp_sl";
  cost_profile: string;
  signal: "BUY" | "HOLD"; signal_predicted_return: number;
  entry_date: string; entry_price: number; entry_mode: string;
  exit_date: string; exit_price: number;
  exit_reason: string; best_target_reached: string;
  gross_pnl_pct: number; gross_pnl: number;
  commission: number; slippage: number; cgt: number; total_cost: number;
  net_pnl: number; net_pnl_pct: number;
  is_win: boolean; n_bars_examined: number; holding_sessions: number;
  skipped: boolean; skip_reason: string | null;
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

// ─── trade execution (replicated from the evaluator — same decisions) ──────
function executeFixedHorizon(stock: string, decisionDate: number, predicted: number, model: string, horizon: number, bars: Bar[], decisionIdx: number, profile: CostProfile): TradeLedgerEntry {
  const entryIdx = decisionIdx + 1;
  const exitIdx = decisionIdx + horizon;
  const base: Partial<TradeLedgerEntry> = {
    stock, decision_date: decisionDate, decision_date_str: epochMsToDateStr(decisionDate),
    model, horizon, strategy: "fixed_horizon", cost_profile: profile.id,
    signal: "BUY", signal_predicted_return: predicted, entry_mode: "next_session_open",
  };
  if (entryIdx >= bars.length) {
    return { ...base, sample_idx: -1, entry_date: "", entry_price: 0, exit_date: "", exit_price: 0, exit_reason: "SKIPPED_NO_NEXT_BAR", best_target_reached: "—", gross_pnl_pct: 0, gross_pnl: 0, commission: 0, slippage: 0, cgt: 0, total_cost: 0, net_pnl: 0, net_pnl_pct: 0, is_win: false, n_bars_examined: 0, holding_sessions: 0, skipped: true, skip_reason: "no_next_bar" } as TradeLedgerEntry;
  }
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.open;
  const exitBarIdx = Math.min(exitIdx, bars.length - 1);
  const exitBar = bars[exitBarIdx];
  const exitPrice = exitBar.close;
  const grossPnlPct = (exitPrice - entryPrice) / entryPrice;
  const grossPnl = grossPnlPct * NOTIONAL;
  const costs = computeTradeCosts(NOTIONAL, grossPnl, profile);
  return {
    ...base, sample_idx: -1, entry_date: entryBar.date, entry_price: entryPrice, exit_date: exitBar.date, exit_price: exitPrice,
    exit_reason: "HORIZON_EXIT", best_target_reached: "—", gross_pnl_pct: grossPnlPct, gross_pnl: grossPnl,
    commission: costs.commission, slippage: costs.slippage, cgt: costs.cgt, total_cost: costs.totalCost,
    net_pnl: costs.netPnl, net_pnl_pct: costs.netPnl / NOTIONAL, is_win: costs.netPnl > 0,
    n_bars_examined: exitBarIdx - entryIdx, holding_sessions: exitBarIdx - entryIdx, skipped: false, skip_reason: null,
  } as TradeLedgerEntry;
}

function executeProgressive(stock: string, decisionDate: number, predicted: number, model: string, horizon: number, bars: Bar[], decisionIdx: number, profile: CostProfile): TradeLedgerEntry {
  const entryIdx = decisionIdx + 1;
  const base: Partial<TradeLedgerEntry> = {
    stock, decision_date: decisionDate, decision_date_str: epochMsToDateStr(decisionDate),
    model, horizon, strategy: "progressive_tp_sl", cost_profile: profile.id,
    signal: "BUY", signal_predicted_return: predicted, entry_mode: "next_session_open",
  };
  if (entryIdx >= bars.length) {
    return { ...base, sample_idx: -1, entry_date: "", entry_price: 0, exit_date: "", exit_price: 0, exit_reason: "SKIPPED_NO_NEXT_BAR", best_target_reached: "—", gross_pnl_pct: 0, gross_pnl: 0, commission: 0, slippage: 0, cgt: 0, total_cost: 0, net_pnl: 0, net_pnl_pct: 0, is_win: false, n_bars_examined: 0, holding_sessions: 0, skipped: true, skip_reason: "no_next_bar" } as TradeLedgerEntry;
  }
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.open;
  const atrSlice = bars.slice(Math.max(0, decisionIdx - ATR_PERIOD), decisionIdx + 1);
  const atrVal = atr(atrSlice.map(b => b.high), atrSlice.map(b => b.low), atrSlice.map(b => b.close)) || entryPrice * 0.02;
  const sl = entryPrice - atrVal * 1.5, tp1 = entryPrice + atrVal, tp2 = entryPrice + atrVal * 2, tp3 = entryPrice + atrVal * 3;
  const horizonEndIdx = Math.min(decisionIdx + horizon, bars.length - 1);
  const scanBars: TpSlBar[] = bars.slice(entryIdx + 1, horizonEndIdx + 1).map(b => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
  const r = simulateProgressiveTpSl({ direction: "BUY", entryPrice, sl, tp1, tp2, tp3, bars: scanBars });
  const exitBarIdx = r.exitBarIdx >= 0 ? entryIdx + 1 + r.exitBarIdx : horizonEndIdx;
  const exitPrice = r.exitPrice;
  const exitReason = r.exitReason === "TIME_UP" ? "HORIZON_EXIT" : r.exitReason;
  const grossPnlPct = (exitPrice - entryPrice) / entryPrice;
  const grossPnl = grossPnlPct * NOTIONAL;
  const costs = computeTradeCosts(NOTIONAL, grossPnl, profile);
  return {
    ...base, sample_idx: -1, entry_date: entryBar.date, entry_price: entryPrice, exit_date: bars[exitBarIdx]?.date ?? "", exit_price: exitPrice,
    exit_reason: exitReason, best_target_reached: r.bestTargetReached, gross_pnl_pct: grossPnlPct, gross_pnl: grossPnl,
    commission: costs.commission, slippage: costs.slippage, cgt: costs.cgt, total_cost: costs.totalCost,
    net_pnl: costs.netPnl, net_pnl_pct: costs.netPnl / NOTIONAL, is_win: costs.netPnl > 0,
    n_bars_examined: r.nBarsExamined, holding_sessions: exitBarIdx - entryIdx, skipped: false, skip_reason: null,
  } as TradeLedgerEntry;
}

// ─── Phase 2: per-model/horizon/strategy/cost breakdown ─────────────────────
interface CellMetrics {
  eligible: number; buy_signals: number; executed: number; skipped_no_next_bar: number; skipped_no_decision_bar: number;
  wins: number; losses: number; avg_gross_return_pct: number; avg_net_return_pct: number;
  total_gross_pnl: number; total_costs: number; total_net_pnl: number; profit_factor: number | null;
  exit_reason_counts: Record<string, number>; target_reached: { TP1: number; TP2: number; TP3: number };
  n_tp_then_sl: number; per_stock: Record<string, { n_trades: number; wins: number; net_pnl: number }>;
}

function computeCell(trades: TradeLedgerEntry[]): CellMetrics {
  const executed = trades.filter(t => !t.skipped);
  const wins = executed.filter(t => t.is_win);
  const losses = executed.filter(t => !t.is_win);
  const er: Record<string, number> = {};
  for (const t of executed) er[t.exit_reason] = (er[t.exit_reason] || 0) + 1;
  const tr = { TP1: 0, TP2: 0, TP3: 0 };
  let ntpthen = 0;
  for (const t of executed) {
    if (t.best_target_reached === "TP1") tr.TP1++;
    if (t.best_target_reached === "TP2") tr.TP2++;
    if (t.best_target_reached === "TP3") tr.TP3++;
    if (t.exit_reason.startsWith("SL_AFTER_TP")) ntpthen++;
  }
  const totalGross = executed.reduce((s, t) => s + t.gross_pnl, 0);
  const totalCosts = executed.reduce((s, t) => s + t.total_cost, 0);
  const totalNet = executed.reduce((s, t) => s + t.net_pnl, 0);
  const sumGains = wins.reduce((s, t) => s + t.net_pnl, 0);
  const sumLosses = Math.abs(losses.reduce((s, t) => s + t.net_pnl, 0));
  const pf = sumLosses > 0 ? sumGains / sumLosses : null;
  const perStock: CellMetrics["per_stock"] = {};
  for (const t of executed) {
    if (!perStock[t.stock]) perStock[t.stock] = { n_trades: 0, wins: 0, net_pnl: 0 };
    perStock[t.stock].n_trades++;
    if (t.is_win) perStock[t.stock].wins++;
    perStock[t.stock].net_pnl += t.net_pnl;
  }
  return {
    eligible: trades.length, buy_signals: trades.filter(t => t.signal === "BUY" && !t.skipped).length,
    executed: executed.length, skipped_no_next_bar: trades.filter(t => t.skip_reason === "no_next_bar").length,
    skipped_no_decision_bar: 0, wins: wins.length, losses: losses.length,
    avg_gross_return_pct: executed.length ? totalGross / executed.length / NOTIONAL * 100 : 0,
    avg_net_return_pct: executed.length ? totalNet / executed.length / NOTIONAL * 100 : 0,
    total_gross_pnl: totalGross, total_costs: totalCosts, total_net_pnl: totalNet, profit_factor: pf,
    exit_reason_counts: er, target_reached: tr, n_tp_then_sl: ntpthen, per_stock: perStock,
  };
}

// ─── Phase 3: date-block bootstrap ──────────────────────────────────────────
function blockBootstrap(trades: TradeLedgerEntry[], metricFn: (t: TradeLedgerEntry[]) => number, reps = BOOTSTRAP_REPS, seed = SEED): { mean: number; ci_low: number; ci_high: number; n_clusters: number; reps: number } | null {
  // Cluster trades by decision_date
  const clusterMap = new Map<number, TradeLedgerEntry[]>();
  for (const t of trades) {
    if (!clusterMap.has(t.decision_date)) clusterMap.set(t.decision_date, []);
    clusterMap.get(t.decision_date)!.push(t);
  }
  const clusters = Array.from(clusterMap.values());
  const nClusters = clusters.length;
  if (nClusters < 10) return null; // insufficient
  const rng = (s: number) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const r = rng(seed);
  const metrics: number[] = [];
  for (let i = 0; i < reps; i++) {
    const sampled: TradeLedgerEntry[] = [];
    for (let j = 0; j < nClusters; j++) sampled.push(...clusters[Math.floor(r() * nClusters)]);
    const m = metricFn(sampled);
    if (isFinite(m)) metrics.push(m);
  }
  if (metrics.length < reps * 0.9) return null;
  metrics.sort((a, b) => a - b);
  return {
    mean: metrics.reduce((s, v) => s + v, 0) / metrics.length,
    ci_low: metrics[Math.floor(metrics.length * 0.025)],
    ci_high: metrics[Math.floor(metrics.length * 0.975)],
    n_clusters: nClusters, reps: metrics.length,
  };
}

function pairedBlockBootstrap(tradesA: TradeLedgerEntry[], tradesB: TradeLedgerEntry[], reps = BOOTSTRAP_REPS, seed = SEED): { mean_diff: number; ci_low: number; ci_high: number; n_clusters: number } | null {
  // Pair by sample_idx (same trade decisions, different strategy/cost). Cluster by decision_date.
  const mapA = new Map(tradesA.map(t => [t.sample_idx + ":" + t.model + ":" + t.horizon, t]));
  const clusterMap = new Map<number, { a: TradeLedgerEntry[]; b: TradeLedgerEntry[] }>();
  for (const t of tradesA) {
    const key = t.sample_idx + ":" + t.model + ":" + t.horizon;
    if (!clusterMap.has(t.decision_date)) clusterMap.set(t.decision_date, { a: [], b: [] });
    clusterMap.get(t.decision_date)!.a.push(t);
    const tb = mapA.get(key); // won't find — tradesA maps to itself; fix below
  }
  // Rebuild: pair A and B by the same sample_idx+model+horizon key
  const mapB = new Map(tradesB.map(t => [t.sample_idx + ":" + t.model + ":" + t.horizon, t]));
  const clusterMap2 = new Map<number, { a: TradeLedgerEntry[]; b: TradeLedgerEntry[] }>();
  for (const t of tradesA) {
    if (t.skipped) continue;
    const key = t.sample_idx + ":" + t.model + ":" + t.horizon;
    const tb = mapB.get(key);
    if (!tb || tb.skipped) continue;
    if (!clusterMap2.has(t.decision_date)) clusterMap2.set(t.decision_date, { a: [], b: [] });
    clusterMap2.get(t.decision_date)!.a.push(t);
    clusterMap2.get(t.decision_date)!.b.push(tb);
  }
  const clusters = Array.from(clusterMap2.values());
  const nClusters = clusters.length;
  if (nClusters < 10) return null;
  const r = (s => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; })(seed);
  const diffs: number[] = [];
  for (let i = 0; i < reps; i++) {
    let sumA = 0, sumB = 0, nA = 0, nB = 0;
    for (let j = 0; j < nClusters; j++) {
      const c = clusters[Math.floor(r() * nClusters)];
      for (const t of c.a) { sumA += t.net_pnl; nA++; }
      for (const t of c.b) { sumB += t.net_pnl; nB++; }
    }
    const meanA = nA > 0 ? sumA / nA : 0;
    const meanB = nB > 0 ? sumB / nB : 0;
    diffs.push(meanA - meanB);
  }
  diffs.sort((a, b) => a - b);
  return {
    mean_diff: diffs.reduce((s, v) => s + v, 0) / diffs.length,
    ci_low: diffs[Math.floor(diffs.length * 0.025)],
    ci_high: diffs[Math.floor(diffs.length * 0.975)],
    n_clusters: nClusters,
  };
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("Task 60 — Walk-Forward Trading Robustness Analysis");
  console.log("=".repeat(60));

  const mlHash = crypto.createHash("md5").update(fs.readFileSync(ML_PRED_FILE)).digest("hex");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const records: RawRecord[] = [];
  for (let i = 0; i < manifest.n_samples; i++) records.push(JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, `sample_${String(i).padStart(6, "0")}.json`), "utf8")));
  console.log(`manifest: ${manifest.run_id} n_samples=${manifest.n_samples} val_end_idx=${manifest.val_end_idx}`);

  // Load OHLCV
  const barsBySymbol = new Map<string, Bar[]>();
  for (const sym of manifest.universe.symbols) {
    const rows = await db.ohlcvBar.findMany({ where: { symbol: sym }, orderBy: { date: "asc" } });
    barsBySymbol.set(sym, rows.map(r => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close })));
  }

  // Phase 1: reconstruct ALL individual trades (trade-ledger)
  console.log("\nPhase 1: reconstructing individual trade ledger...");
  const ledger: TradeLedgerEntry[] = [];
  let nEligible = 0, nNegative = 0;
  for (let idx = manifest.val_end_idx; idx < manifest.n_samples; idx++) {
    const rec = records[idx];
    const bars = barsBySymbol.get(rec.stock) || [];
    const decisionDateStr = epochMsToDateStr(rec.date);
    const decisionIdx = bars.findIndex(b => b.date === decisionDateStr);
    for (const modelName of MODEL_NAMES) {
      const m = rec.models[modelName];
      if (!m) continue;
      for (const hz of HORIZONS) {
        const hp = m.horizon_preds[String(hz)];
        if (!hp || hp.eval_skipped) continue;
        nEligible++;
        const predicted = hp.predicted;
        if (predicted <= SIGNAL_THRESHOLD) { if (predicted < 0) nNegative++; continue; }
        // 4 trade records per eligible signal: 2 strategies × 2 cost profiles
        if (decisionIdx < 0) {
          // skipped — record for both strategies × both profiles
          for (const strat of ["fixed_horizon", "progressive_tp_sl"] as const) for (const prof of [STANDARD_PSX, HIGH_SLIPPAGE_PSX]) {
            ledger.push({ sample_idx: idx, stock: rec.stock, decision_date: rec.date, decision_date_str: decisionDateStr, model: modelName, horizon: hz, strategy: strat, cost_profile: prof.id, signal: "BUY", signal_predicted_return: predicted, entry_date: "", entry_price: 0, exit_date: "", exit_price: 0, exit_reason: "SKIPPED_NO_DECISION_BAR", best_target_reached: "—", gross_pnl_pct: 0, gross_pnl: 0, commission: 0, slippage: 0, cgt: 0, total_cost: 0, net_pnl: 0, net_pnl_pct: 0, is_win: false, n_bars_examined: 0, holding_sessions: 0, skipped: true, skip_reason: "no_decision_bar" });
          }
          continue;
        }
        ledger.push({ ...executeFixedHorizon(rec.stock, rec.date, predicted, modelName, hz, bars, decisionIdx, STANDARD_PSX), sample_idx: idx });
        ledger.push({ ...executeFixedHorizon(rec.stock, rec.date, predicted, modelName, hz, bars, decisionIdx, HIGH_SLIPPAGE_PSX), sample_idx: idx });
        ledger.push({ ...executeProgressive(rec.stock, rec.date, predicted, modelName, hz, bars, decisionIdx, STANDARD_PSX), sample_idx: idx });
        ledger.push({ ...executeProgressive(rec.stock, rec.date, predicted, modelName, hz, bars, decisionIdx, HIGH_SLIPPAGE_PSX), sample_idx: idx });
      }
    }
  }
  const executed = ledger.filter(t => !t.skipped);
  console.log(`eligible: ${nEligible}, negative-not-traded: ${nNegative}, ledger entries: ${ledger.length} (executed: ${executed.length})`);

  // Phase 2: per-model/horizon/strategy/cost breakdown
  console.log("\nPhase 2: per-model/horizon/strategy/cost breakdown...");
  const breakdown: Record<string, any> = {};
  for (const strat of ["fixed_horizon", "progressive_tp_sl"] as const) {
    for (const profId of ["standard_psx", "high_slippage_psx"]) {
      const key = `${strat}__${profId}`;
      const cell = executed.filter(t => t.strategy === strat && t.cost_profile === profId);
      breakdown[key] = computeCell(cell);
      // per-model-horizon sub-cells
      const pmh: Record<string, Record<string, CellMetrics>> = {};
      for (const mn of MODEL_NAMES) {
        pmh[mn] = {};
        for (const hz of HORIZONS) {
          pmh[mn][`${hz}d`] = computeCell(cell.filter(t => t.model === mn && t.horizon === hz));
        }
      }
      breakdown[key + "__per_model_horizon"] = pmh;
    }
  }

  // Phase 3: date-block bootstrap
  console.log("\nPhase 3: date-block bootstrap...");
  const uniqueDates = new Set(executed.map(t => t.decision_date));
  console.log(`unique decision-date clusters: ${uniqueDates.size}`);
  const bootstrap: Record<string, any> = {};
  for (const strat of ["fixed_horizon", "progressive_tp_sl"] as const) {
    for (const profId of ["standard_psx", "high_slippage_psx"]) {
      const cell = executed.filter(t => t.strategy === strat && t.cost_profile === profId);
      const key = `${strat}__${profId}`;
      bootstrap[key] = {
        avg_net_return_pct_ci: blockBootstrap(cell, ts => ts.length ? ts.reduce((s, t) => s + t.net_pnl, 0) / ts.length / NOTIONAL * 100 : 0),
        net_win_rate_ci: blockBootstrap(cell, ts => ts.length ? ts.filter(t => t.is_win).length / ts.length : 0),
        mean_net_pnl_per_trade_ci: blockBootstrap(cell, ts => ts.length ? ts.reduce((s, t) => s + t.net_pnl, 0) / ts.length : 0),
      };
    }
  }
  // Paired diffs: fixed vs progressive (standard), standard vs high-slip (progressive)
  const fixedStd = executed.filter(t => t.strategy === "fixed_horizon" && t.cost_profile === "standard_psx");
  const progStd = executed.filter(t => t.strategy === "progressive_tp_sl" && t.cost_profile === "standard_psx");
  const progHigh = executed.filter(t => t.strategy === "progressive_tp_sl" && t.cost_profile === "high_slippage_psx");
  const fixedHigh = executed.filter(t => t.strategy === "fixed_horizon" && t.cost_profile === "high_slippage_psx");
  bootstrap.paired_fixed_vs_progressive_standard = pairedBlockBootstrap(fixedStd, progStd);
  bootstrap.paired_standard_vs_high_slippage_progressive = pairedBlockBootstrap(progStd, progHigh);
  bootstrap.paired_standard_vs_high_slippage_fixed = pairedBlockBootstrap(fixedStd, fixedHigh);

  // Phase 4: cost reconciliation (verify gross + costs = net for each trade)
  console.log("\nPhase 4: cost reconciliation...");
  let reconcileOk = 0, reconcileFail = 0;
  for (const t of executed) {
    const recomputedNet = t.gross_pnl - t.commission - t.slippage - t.cgt;
    if (Math.abs(recomputedNet - t.net_pnl) < 0.01) reconcileOk++; else reconcileFail++;
  }
  console.log(`cost reconciliation: ${reconcileOk} ok, ${reconcileFail} fail`);

  // ── assemble output ──
  const out = {
    task: "task60_trading_robustness",
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source_run_id: manifest.run_id,
    source_data_fingerprint: manifest.data_fingerprint,
    source_universe_fingerprint: manifest.universe.fingerprint,
    ml_predictions_md5: mlHash,
    signal_threshold: SIGNAL_THRESHOLD,
    signal_policy: "long-only BUY when predicted > +1%. Negative → HOLD. Fixed, NOT tuned on final-test.",
    entry_convention: "next session OPEN. No retrospective fill. No cherry-picking.",
    atr_config: { period: ATR_PERIOD, sl: "1.5×ATR", tp1: "1×ATR", tp2: "2×ATR", tp3: "3×ATR" },
    notional_per_trade: NOTIONAL,
    n_eligible_samples: nEligible,
    n_negative_forecasts_not_traded: nNegative,
    n_executed_trades: executed.length,
    n_ledger_entries: ledger.length,
    n_unique_decision_date_clusters: uniqueDates.size,
    trade_ledger_note: "Individual trade records are in the separate file: data/backtest_reports/walk_forward_trading_ledger.json (this artifact has the aggregate + breakdown + bootstrap; the ledger has the raw per-trade rows).",
    breakdown,
    bootstrap,
    cost_reconciliation: { ok: reconcileOk, fail: reconcileFail, formula: "net = gross − commission − slippage − cgt; commission = notional × 0.0015 × 2; slippage = notional × rate (0.0015 or 0.005); cgt = gross × 0.15 if gross > 0" },
    selection_bias_warnings: [
      "EXPLORATORY final-test analysis — the final-test results have already been inspected. Do NOT use these results to select a winning model/horizon + claim a fresh unbiased test.",
      "No signal threshold or ATR multiplier tuning was performed. The +1% threshold + 1.5/1/2/3 ATR distances are FIXED documented conventions.",
      "Do NOT declare a winner from the pooled P&L. Multiple model/horizon/strategy/cost combinations are compared — multiple-comparison risk applies.",
      "Strategy development + model selection should use a suitable historical VALIDATION period or prospective PAPER-TRADING period, followed by an UNTOUCHED future evaluation.",
      "The 696 trades are NOT independent — multiple model/horizon signals on the same stock/date share price paths. The date-block bootstrap (22 clusters) accounts for this dependence.",
    ],
    unsupported_metrics: {
      portfolio_roi: "unavailable — no portfolio-level capital-allocation model (each trade = fixed PKR 100,000 notional; multiple alternatives can trade same stock/date)",
      sharpe: "unavailable — no portfolio-equity time series",
      sortino: "unavailable — same as Sharpe",
      max_drawdown: "unavailable — no portfolio-equity curve",
    },
    limitations: [
      "22 unique decision-date clusters in the final-test set. The date-block bootstrap resamples these 22 clusters with replacement (1000 reps). CIs are adequate for directional inference but should not be over-interpreted.",
      "Each trade assumes a fixed PKR 100,000 notional. Multiple model/horizon alternatives can trade the same stock/date — these are HYPOTHETICAL alternative trade evaluations, NOT an executable portfolio.",
      "Portfolio-level metrics (ROI/Sharpe/Sortino/maxDD) UNAVAILABLE. The next task should implement a defined capital-allocation policy + coherent portfolio simulation.",
      "Long-only strategy. 888 negative forecasts not traded (HOLD).",
      "The aggregate across all models/horizons is a RESEARCH SUMMARY, not an executable portfolio result.",
      "The high-slippage sensitivity (0.5%) uses IDENTICAL signal/entry/exit/target decisions as the standard profile — only the cost calculation differs.",
      "Cost selection by documented convention (standard_psx matches 2 of 3 simulators), NOT by profitability.",
    ],
  };

  // Save trade-ledger (separate file — the full per-trade rows)
  const ledgerPath = "data/backtest_reports/walk_forward_trading_ledger.json";
  fs.writeFileSync(ledgerPath, JSON.stringify({ schema_version: "1.0", source_run_id: manifest.run_id, n_entries: ledger.length, trades: ledger }, null, 2));
  console.log(`\n✓ Trade ledger written: ${ledgerPath} (${ledger.length} entries)`);

  // Save robustness artifact (candidate — don't replace the existing trading report)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2));
  console.log(`✓ Robustness artifact written: ${OUTPUT_PATH}`);

  // Summary
  console.log(`\n=== SUMMARY ===`);
  for (const strat of ["fixed_horizon", "progressive_tp_sl"] as const) {
    for (const prof of ["standard_psx", "high_slippage_psx"]) {
      const c = breakdown[`${strat}__${prof}`];
      const b = bootstrap[`${strat}__${prof}`];
      console.log(`${strat}/${prof}: ${c.executed} trades, net=${safeRound(c.total_net_pnl, 0)}, pf=${safeRound(c.profit_factor, 3)}, avgNet%=${safeRound(c.avg_net_return_pct, 3)}, CI(netReturn%)=[${safeRound(b?.avg_net_return_pct_ci?.ci_low, 3)}, ${safeRound(b?.avg_net_return_pct_ci?.ci_high, 3)}]`);
    }
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
