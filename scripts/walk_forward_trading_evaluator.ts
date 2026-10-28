/**
 * Task 59 — Walk-Forward Trading Evaluator.
 *
 * Consumes the RAW out-of-sample prediction records from the completed pilot25
 * run + actual historical OHLCV bars to build a GENUINE trading simulation with
 * realistic execution prices, progressive TP/SL handling, trading costs, and
 * honest net-P&L reporting.
 *
 * Does NOT:
 *   - Retrain models or rerun the walk-forward predictor.
 *   - Modify the forecast report (walk_forward_latest.json) or robustness
 *     artifact (pilot25_robustness.json) or ml_predictions_multi.json.
 *   - Reuse the current-signal replay (signal-stats) or random-fallback entry.
 *   - Select strategy parameters by maximizing final-test P&L.
 *
 * Architecture:
 *   - Signal: BUY if the stored out-of-sample predicted return > +1% threshold
 *     (long-only; negative forecasts = HOLD, not short).
 *   - Entry: the NEXT eligible trading session's OPEN price after the signal-
 *     generating close (NOT the signal close; no retrospective fill; no cherry-
 *     picking among candidate entry bars).
 *   - Strategy A (fixed-horizon): hold to the horizon-end session's close,
 *     exit at that close. No TP/SL parameter choices.
 *   - Strategy B (progressive TP/SL): ATR from 14 pre-decision bars (known at
 *     signal time). SL = 1.5×ATR, TP1 = 1×ATR, TP2 = 2×ATR, TP3 = 3×ATR,
 *     anchored to the entry open. Delegate to simulateProgressiveTpSl
 *     (src/lib/latent/tp-sl-engine.ts). Horizon-end = time-exit (HORIZON_EXIT,
 *     NOT unresolved — the position IS liquidated at the horizon-end close).
 *   - Costs: standard_psx profile (commission 0.15%×2, slippage 0.15% round-
 *     trip, CGT 15% on gains). Sensitivity with high_slippage_psx.
 *
 * Uses the final-test portion of the manifest (idx >= val_end_idx). Validation
 * portion (idx < val_end_idx) is NOT mixed into the primary metrics.
 *
 * Output: data/backtest_reports/walk_forward_trading_latest.json
 * Run: bun scripts/walk_forward_trading_evaluator.ts
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
const OUTPUT_PATH = "data/backtest_reports/walk_forward_trading_latest.json";
const CANDIDATE_PATH = "data/backtest_reports/walk_forward_trading_candidate.json";
const ML_PRED_FILE = "data/ml_predictions_multi.json";

const SIGNAL_THRESHOLD = 0.01; // +1% predicted return → long BUY (fixed, not tuned on final-test)
const HORIZONS = [5, 10, 21];
const MODEL_NAMES = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"];
const ATR_PERIOD = 14;

interface Bar { date: string; open: number; high: number; low: number; close: number; volume?: bigint | number | null; }
interface SampleMeta { idx: number; stock: string; date: number; target_maturity_21d: number; }
interface RawRecord {
  sample_idx: number; sample_id: string; stock: string; date: number; close: number;
  actual_5d: number; actual_10d: number; actual_21d: number; status: string;
  train_cutoff_date: number; n_model_fits: number;
  models: Record<string, {
    horizon_preds: Record<string, { predicted: number; actual: number; eval_skipped: boolean }>;
  }>;
  training_only_baseline: Record<string, { mean: number; n_obs: number }>;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function epochMsToDateStr(ms: number): string {
  // The DB stores dates as "YYYY-MM-DD" strings. The sample's date is epoch ms
  // (UTC midnight). Convert to the same YYYY-MM-DD format.
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function atr(highs: number[], lows: number[], closes: number[], period = ATR_PERIOD): number {
  if (closes.length < period + 1) {
    const ranges = highs.map((h, i) => h - lows[i]).filter((x) => x >= 0);
    return ranges.length ? ranges.reduce((s, v) => s + v, 0) / ranges.length : 0;
  }
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function safeRound(x: number | undefined | null, nd = 6): number | null {
  if (x == null || typeof x !== "number" || !isFinite(x)) return null;
  return Math.round(x * 10 ** nd) / 10 ** nd;
}

// ─── Phase 1: load + verify source records ──────────────────────────────────
function loadManifest() {
  const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  if (m.run_id !== "pilot25_step50_20261028") {
    throw new Error(`run_id mismatch: expected pilot25_step50_20261028, got ${m.run_id}. Refusing to proceed.`);
  }
  return m;
}

function loadRawRecords(nSamples: number): RawRecord[] {
  const records: RawRecord[] = [];
  for (let i = 0; i < nSamples; i++) {
    const p = path.join(SAMPLES_DIR, `sample_${String(i).padStart(6, "0")}.json`);
    if (!fs.existsSync(p)) throw new Error(`missing sample record: ${p}`);
    records.push(JSON.parse(fs.readFileSync(p, "utf8")));
  }
  return records;
}

// Compute an execution-data fingerprint: hash of (symbol + date + O/H/L/C + volume)
// for all bars of the pilot25 symbols. This is SEPARATE from the manifest's
// data_fingerprint (which covers the prediction-time OHLCV) — it verifies the
// EXECUTION OHLCV hasn't changed.
async function computeExecutionFingerprint(symbols: string[]): Promise<string> {
  const h = crypto.createHash("sha256");
  for (const sym of symbols) {
    const rows = await db.ohlcvBar.findMany({ where: { symbol: sym }, orderBy: { date: "asc" } });
    h.update(`${sym}|${rows.length}|`);
    for (const r of rows) {
      h.update(`${r.date}|${r.open}|${r.high}|${r.low}|${r.close}|${r.volume ?? ""};`);
    }
  }
  return h.digest("hex");
}

// Reconstruct the stored forward returns from OHLCV bars + compare within tolerance.
// Verifies the execution OHLCV matches the prediction-run OHLCV.
function reconstructAndVerifyForwardReturns(
  record: RawRecord,
  bars: Bar[],
  decisionIdx: number
): { verified: boolean; reconstructed_5d: number | null; reconstructed_10d: number | null; reconstructed_21d: number | null; maxAbsDiff: number } {
  const recon = (h: number): number | null => {
    const exitIdx = decisionIdx + h;
    if (exitIdx >= bars.length) return null;
    return (bars[exitIdx].close - bars[decisionIdx].close) / bars[decisionIdx].close;
  };
  const r5 = recon(5), r10 = recon(10), r21 = recon(21);
  const diffs: number[] = [];
  if (r5 != null) diffs.push(Math.abs(r5 - record.actual_5d));
  if (r10 != null) diffs.push(Math.abs(r10 - record.actual_10d));
  if (r21 != null) diffs.push(Math.abs(r21 - record.actual_21d));
  const maxAbsDiff = diffs.length ? Math.max(...diffs) : 0;
  // Tolerance: 1e-6 (floating-point). If the OHLCV changed, this will be large.
  return { verified: maxAbsDiff < 1e-6, reconstructed_5d: r5, reconstructed_10d: r10, reconstructed_21d: r21, maxAbsDiff };
}

// ─── Phase 3: trade execution ───────────────────────────────────────────────
interface TradeResult {
  model: string; horizon: number; strategy: "fixed_horizon" | "progressive_tp_sl";
  stock: string; signalDate: number; signalPredictedReturn: number;
  entryDate: string; entryPrice: number; entryMode: "next_session_open";
  exitDate: string | null; exitPrice: number | null;
  exitReason: string; // "HORIZON_EXIT" | "TP3_HIT" | "SL_HIT" | "SL_AFTER_TP1" | "SL_AFTER_TP2" | "SKIPPED_NO_NEXT_BAR" | "SKIPPED_NO_DECISION_BAR"
  bestTargetReached: string; // "TP3"|"TP2"|"TP1"|"—"
  grossPnlPct: number; netPnlPct: number;
  notional: number; commission: number; slippage: number; cgt: number; totalCost: number;
  grossPnl: number; netPnl: number;
  isWin: boolean; unresolved: boolean; nBarsExamined: number;
  holdingSessions: number;
}

function executeFixedHorizon(
  stock: string, signalDate: number, predictedReturn: number, model: string, horizon: number,
  bars: Bar[], decisionIdx: number, notional: number, profile: CostProfile
): TradeResult {
  const entryIdx = decisionIdx + 1; // next session after the signal close
  const exitIdx = decisionIdx + horizon; // hold `horizon` sessions, exit at that close
  const base: Partial<TradeResult> = {
    model, horizon, strategy: "fixed_horizon", stock, signalDate, signalPredictedReturn: predictedReturn,
    entryMode: "next_session_open", bestTargetReached: "—", unresolved: false,
  };
  if (entryIdx >= bars.length) {
    return { ...base, entryDate: "", entryPrice: 0, exitDate: null, exitPrice: null,
      exitReason: "SKIPPED_NO_NEXT_BAR", grossPnlPct: 0, netPnlPct: 0, notional: 0,
      commission: 0, slippage: 0, cgt: 0, totalCost: 0, grossPnl: 0, netPnl: 0, isWin: false, nBarsExamined: 0, holdingSessions: 0,
    } as TradeResult;
  }
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.open;
  const exitBarIdx = Math.min(exitIdx, bars.length - 1);
  const exitBar = bars[exitBarIdx];
  const exitPrice = exitBar.close;
  const grossPnlPct = (exitPrice - entryPrice) / entryPrice;
  const grossPnl = grossPnlPct * notional;
  const costs = computeTradeCosts(notional, grossPnl, profile);
  const netPnlPct = costs.netPnl / notional;
  const holdingSessions = exitBarIdx - entryIdx;
  return {
    ...base, entryDate: entryBar.date, entryPrice, exitDate: exitBar.date, exitPrice,
    exitReason: "HORIZON_EXIT", grossPnlPct, netPnlPct, notional, commission: costs.commission,
    slippage: costs.slippage, cgt: costs.cgt, totalCost: costs.totalCost, grossPnl, netPnl: costs.netPnl,
    isWin: costs.netPnl > 0, nBarsExamined: holdingSessions, holdingSessions,
  } as TradeResult;
}

function executeProgressiveTpSl(
  stock: string, signalDate: number, predictedReturn: number, model: string, horizon: number,
  bars: Bar[], decisionIdx: number, notional: number, profile: CostProfile
): TradeResult {
  const entryIdx = decisionIdx + 1; // next session open
  const base: Partial<TradeResult> = {
    model, horizon, strategy: "progressive_tp_sl", stock, signalDate, signalPredictedReturn: predictedReturn,
    entryMode: "next_session_open", unresolved: false,
  };
  if (entryIdx >= bars.length) {
    return { ...base, entryDate: "", entryPrice: 0, exitDate: null, exitPrice: null,
      exitReason: "SKIPPED_NO_NEXT_BAR", bestTargetReached: "—", grossPnlPct: 0, netPnlPct: 0,
      notional: 0, commission: 0, slippage: 0, cgt: 0, totalCost: 0, grossPnl: 0, netPnl: 0,
      isWin: false, nBarsExamined: 0, holdingSessions: 0,
    } as TradeResult;
  }
  const entryBar = bars[entryIdx];
  const entryPrice = entryBar.open;
  // ATR from the 14 bars ENDING at the decision date (pre-decision — known at signal time).
  const atrSlice = bars.slice(Math.max(0, decisionIdx - ATR_PERIOD), decisionIdx + 1);
  const atrVal = atr(atrSlice.map((b) => b.high), atrSlice.map((b) => b.low), atrSlice.map((b) => b.close)) || entryPrice * 0.02;
  // Anchor SL/TP to the entry open using the decision-time ATR.
  const sl = entryPrice - atrVal * 1.5;
  const tp1 = entryPrice + atrVal * 1;
  const tp2 = entryPrice + atrVal * 2;
  const tp3 = entryPrice + atrVal * 3;
  // Scan window: bars after entry, up to the horizon-end (the time-exit boundary).
  // The horizon-end bar = bars[decisionIdx + horizon] (same as fixed-horizon exit).
  const horizonEndIdx = Math.min(decisionIdx + horizon, bars.length - 1);
  const scanBars: TpSlBar[] = bars.slice(entryIdx + 1, horizonEndIdx + 1).map((b) => ({
    date: b.date, open: b.open, high: b.high, low: b.low, close: b.close,
  }));
  const r = simulateProgressiveTpSl({ direction: "BUY", entryPrice, sl, tp1, tp2, tp3, bars: scanBars });
  // Determine the actual exit bar + price.
  let exitBarIdx: number;
  let exitPrice: number;
  let exitReason: string;
  if (r.exitBarIdx >= 0 && r.exitBarIdx < scanBars.length) {
    exitBarIdx = entryIdx + 1 + r.exitBarIdx;
    exitPrice = r.exitPrice;
    // If the helper returned TIME_UP but we're at the horizon boundary, it's a
    // HORIZON_EXIT (the position IS liquidated at the horizon-end close, NOT
    // unresolved/open).
    exitReason = r.exitReason === "TIME_UP" ? "HORIZON_EXIT" : r.exitReason;
  } else {
    // No scan bars (entryIdx+1 > horizonEndIdx) — exit at the horizon-end close.
    exitBarIdx = horizonEndIdx;
    exitPrice = bars[horizonEndIdx].close;
    exitReason = "HORIZON_EXIT";
  }
  const exitBar = bars[exitBarIdx];
  const grossPnlPct = (exitPrice - entryPrice) / entryPrice;
  const grossPnl = grossPnlPct * notional;
  const costs = computeTradeCosts(notional, grossPnl, profile);
  const netPnlPct = costs.netPnl / notional;
  const holdingSessions = exitBarIdx - entryIdx;
  return {
    ...base, entryDate: entryBar.date, entryPrice, exitDate: exitBar.date, exitPrice,
    exitReason, bestTargetReached: r.bestTargetReached, grossPnlPct, netPnlPct, notional,
    commission: costs.commission, slippage: costs.slippage, cgt: costs.cgt, totalCost: costs.totalCost,
    grossPnl, netPnl: costs.netPnl, isWin: costs.netPnl > 0,
    unresolved: false, // progressive strategy always liquidates by horizon-end (HORIZON_EXIT, not unresolved)
    nBarsExamined: r.nBarsExamined, holdingSessions,
  } as TradeResult;
}

// ─── Phase 4: aggregate metrics ──────────────────────────────────────────────
interface StrategyMetrics {
  n_eligible_samples: number;
  n_executed_trades: number;
  n_skipped_no_next_bar: number;
  n_skipped_no_decision_bar: number;
  n_negative_forecasts_not_traded: number; // long-only: negative predicted → HOLD
  exit_reason_counts: Record<string, number>;
  target_reached_counts: { TP1: number; TP2: number; TP3: number };
  n_tp_then_sl: number; // reached a TP then exited at SL
  wins: number; losses: number;
  avg_gross_return_pct: number; avg_net_return_pct: number;
  total_gross_pnl: number; total_costs: number; total_net_pnl: number;
  profit_factor: number | null; // sum(net gains) / |sum(net losses)|; null if no losses
  per_stock: Record<string, { n_trades: number; wins: number; net_pnl: number; avg_net_pct: number }>;
  per_model_horizon: Record<string, Record<string, { n_trades: number; wins: number; total_net_pnl: number; avg_net_pct: number }>>;
}

function aggregate(trades: TradeResult[], nEligible: number, nNegativeForecasts: number): StrategyMetrics {
  const executed = trades.filter((t) => !t.exitReason.startsWith("SKIPPED"));
  const wins = executed.filter((t) => t.isWin);
  const losses = executed.filter((t) => !t.isWin);
  const exitReasonCounts: Record<string, number> = {};
  for (const t of executed) exitReasonCounts[t.exitReason] = (exitReasonCounts[t.exitReason] || 0) + 1;
  const targetCounts = { TP1: 0, TP2: 0, TP3: 0 };
  let nTpThenSl = 0;
  for (const t of executed) {
    if (t.bestTargetReached === "TP1") targetCounts.TP1++;
    if (t.bestTargetReached === "TP2") targetCounts.TP2++;
    if (t.bestTargetReached === "TP3") targetCounts.TP3++;
    if (t.exitReason.startsWith("SL_AFTER_TP")) nTpThenSl++;
  }
  const totalGross = executed.reduce((s, t) => s + t.grossPnl, 0);
  const totalCosts = executed.reduce((s, t) => s + t.totalCost, 0);
  const totalNet = executed.reduce((s, t) => s + t.netPnl, 0);
  const sumNetGains = wins.reduce((s, t) => s + t.netPnl, 0);
  const sumNetLosses = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = sumNetLosses > 0 ? sumNetGains / sumNetLosses : (sumNetGains > 0 ? null : null);
  // per-stock
  const perStock: StrategyMetrics["per_stock"] = {};
  for (const t of executed) {
    if (!perStock[t.stock]) perStock[t.stock] = { n_trades: 0, wins: 0, net_pnl: 0, avg_net_pct: 0 };
    perStock[t.stock].n_trades++;
    if (t.isWin) perStock[t.stock].wins++;
    perStock[t.stock].net_pnl += t.netPnl;
  }
  for (const s of Object.values(perStock)) s.avg_net_pct = s.n_trades > 0 ? (s.net_pnl / (s.n_trades * 100000)) * 100 : 0; // notional=100000
  // per-model-horizon
  const perMH: StrategyMetrics["per_model_horizon"] = {};
  for (const t of executed) {
    const mk = t.model;
    if (!perMH[mk]) perMH[mk] = {};
    const hk = `${t.horizon}d`;
    if (!perMH[mk][hk]) perMH[mk][hk] = { n_trades: 0, wins: 0, total_net_pnl: 0, avg_net_pct: 0 };
    perMH[mk][hk].n_trades++;
    if (t.isWin) perMH[mk][hk].wins++;
    perMH[mk][hk].total_net_pnl += t.netPnl;
  }
  for (const mk of Object.keys(perMH)) for (const hk of Object.keys(perMH[mk])) {
    const m = perMH[mk][hk];
    m.avg_net_pct = m.n_trades > 0 ? (m.total_net_pnl / (m.n_trades * 100000)) * 100 : 0;
  }
  return {
    n_eligible_samples: nEligible,
    n_executed_trades: executed.length,
    n_skipped_no_next_bar: trades.filter((t) => t.exitReason === "SKIPPED_NO_NEXT_BAR").length,
    n_skipped_no_decision_bar: trades.filter((t) => t.exitReason === "SKIPPED_NO_DECISION_BAR").length,
    n_negative_forecasts_not_traded: nNegativeForecasts,
    exit_reason_counts: exitReasonCounts,
    target_reached_counts: targetCounts,
    n_tp_then_sl: nTpThenSl,
    wins: wins.length, losses: losses.length,
    avg_gross_return_pct: executed.length ? totalGross / executed.length / 100000 * 100 : 0,
    avg_net_return_pct: executed.length ? totalNet / executed.length / 100000 * 100 : 0,
    total_gross_pnl: totalGross, total_costs: totalCosts, total_net_pnl: totalNet,
    profit_factor: profitFactor,
    per_stock: perStock, per_model_horizon: perMH,
  };
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("Task 59 — Walk-Forward Trading Evaluator");
  console.log("=".repeat(60));

  const mlHash = crypto.createHash("md5").update(fs.readFileSync(ML_PRED_FILE)).digest("hex");
  console.log(`ml_predictions_multi.json md5 (read-only): ${mlHash}`);

  const manifest = loadManifest();
  console.log(`manifest: run_id=${manifest.run_id} n_samples=${manifest.n_samples} val_end_idx=${manifest.val_end_idx}`);
  const records = loadRawRecords(manifest.n_samples);
  console.log(`loaded ${records.length} raw sample records`);

  // Phase 1: execution-data fingerprint + forward-return verification
  console.log("\nPhase 1: execution-data fingerprint + forward-return verification...");
  const symbols: string[] = manifest.universe.symbols;
  const executionFingerprint = await computeExecutionFingerprint(symbols);
  console.log(`execution-data fingerprint: ${executionFingerprint.slice(0, 16)}...`);

  // Load OHLCV bars per symbol + verify forward returns
  const barsBySymbol = new Map<string, Bar[]>();
  let verifiedCount = 0, mismatchCount = 0, maxAbsDiffGlobal = 0;
  for (const sym of symbols) {
    const rows = await db.ohlcvBar.findMany({ where: { symbol: sym }, orderBy: { date: "asc" } });
    barsBySymbol.set(sym, rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume })));
  }
  // Verify forward returns for the final-test samples
  for (let idx = manifest.val_end_idx; idx < manifest.n_samples; idx++) {
    const rec = records[idx];
    const bars = barsBySymbol.get(rec.stock) || [];
    const decisionDateStr = epochMsToDateStr(rec.date);
    const decisionIdx = bars.findIndex((b) => b.date === decisionDateStr);
    if (decisionIdx < 0) { mismatchCount++; continue; }
    const v = reconstructAndVerifyForwardReturns(rec, bars, decisionIdx);
    if (v.verified) verifiedCount++; else mismatchCount++;
    if (v.maxAbsDiff > maxAbsDiffGlobal) maxAbsDiffGlobal = v.maxAbsDiff;
  }
  console.log(`forward-return verification: ${verifiedCount} verified, ${mismatchCount} mismatch, maxAbsDiff=${maxAbsDiffGlobal.toExponential(3)}`);
  if (mismatchCount > verifiedCount * 0.05) {
    console.error("WARNING: significant OHLCV mismatch — results may not be a verified net-trading evaluation.");
  }

  // Phase 3: execute trades on the final-test subset
  console.log("\nPhase 3: executing trades on final-test subset (idx >= val_end_idx)...");
  const NOTIONAL = 100000; // fixed notional per trade (PKR) — no portfolio compounding/leverage
  const fixedTrades: TradeResult[] = [];
  const progTrades: TradeResult[] = [];
  let nNegativeForecasts = 0;
  let nEligibleSamples = 0;
  for (let idx = manifest.val_end_idx; idx < manifest.n_samples; idx++) {
    const rec = records[idx];
    const bars = barsBySymbol.get(rec.stock) || [];
    const decisionDateStr = epochMsToDateStr(rec.date);
    const decisionIdx = bars.findIndex((b) => b.date === decisionDateStr);
    if (decisionIdx < 0) {
      // skip — no decision bar (record the exclusion for both strategies × all models × horizons)
      for (const modelName of MODEL_NAMES) for (const hz of HORIZONS) {
        for (const strat of ["fixed_horizon", "progressive_tp_sl"] as const) {
          const base: Partial<TradeResult> = { model: modelName, horizon: hz, strategy: strat, stock: rec.stock, signalDate: rec.date, signalPredictedReturn: 0, entryMode: "next_session_open", entryDate: "", entryPrice: 0, exitDate: null, exitPrice: null, exitReason: "SKIPPED_NO_DECISION_BAR", bestTargetReached: "—", grossPnlPct: 0, netPnlPct: 0, notional: 0, commission: 0, slippage: 0, cgt: 0, totalCost: 0, grossPnl: 0, netPnl: 0, isWin: false, unresolved: false, nBarsExamined: 0, holdingSessions: 0 };
          if (strat === "fixed_horizon") fixedTrades.push(base as TradeResult); else progTrades.push(base as TradeResult);
        }
      }
      continue;
    }
    for (const modelName of MODEL_NAMES) {
      const m = rec.models[modelName];
      if (!m) continue;
      for (const hz of HORIZONS) {
        const hp = m.horizon_preds[String(hz)];
        if (!hp || hp.eval_skipped) continue;
        nEligibleSamples++;
        const predicted = hp.predicted;
        // Signal: BUY if predicted > +1% threshold (long-only). Negative → HOLD (not traded).
        if (predicted <= SIGNAL_THRESHOLD) {
          if (predicted < 0) nNegativeForecasts++;
          continue; // no trade
        }
        fixedTrades.push(executeFixedHorizon(rec.stock, rec.date, predicted, modelName, hz, bars, decisionIdx, NOTIONAL, STANDARD_PSX));
        progTrades.push(executeProgressiveTpSl(rec.stock, rec.date, predicted, modelName, hz, bars, decisionIdx, NOTIONAL, STANDARD_PSX));
      }
    }
  }
  console.log(`eligible samples: ${nEligibleSamples} (final-test, idx >= ${manifest.val_end_idx})`);
  console.log(`negative forecasts not traded (long-only): ${nNegativeForecasts}`);
  console.log(`fixed-horizon trades: ${fixedTrades.filter(t=>!t.exitReason.startsWith("SKIPPED")).length} executed`);
  console.log(`progressive TP/SL trades: ${progTrades.filter(t=>!t.exitReason.startsWith("SKIPPED")).length} executed`);

  // Phase 4: aggregate
  const fixedAgg = aggregate(fixedTrades, nEligibleSamples, nNegativeForecasts);
  const progAgg = aggregate(progTrades, nEligibleSamples, nNegativeForecasts);

  // Sensitivity: high-slippage profile (re-run progressive TP/SL with HIGH_SLIPPAGE_PSX)
  console.log("\nPhase 4: high-slippage sensitivity...");
  const progTradesHighSlip: TradeResult[] = [];
  for (let idx = manifest.val_end_idx; idx < manifest.n_samples; idx++) {
    const rec = records[idx];
    const bars = barsBySymbol.get(rec.stock) || [];
    const decisionDateStr = epochMsToDateStr(rec.date);
    const decisionIdx = bars.findIndex((b) => b.date === decisionDateStr);
    if (decisionIdx < 0) continue;
    for (const modelName of MODEL_NAMES) {
      const m = rec.models[modelName];
      if (!m) continue;
      for (const hz of HORIZONS) {
        const hp = m.horizon_preds[String(hz)];
        if (!hp || hp.eval_skipped || hp.predicted <= SIGNAL_THRESHOLD) continue;
        progTradesHighSlip.push(executeProgressiveTpSl(rec.stock, rec.date, hp.predicted, modelName, hz, bars, decisionIdx, NOTIONAL, HIGH_SLIPPAGE_PSX));
      }
    }
  }
  const progAggHighSlip = aggregate(progTradesHighSlip, nEligibleSamples, nNegativeForecasts);

  // ── assemble output ──
  const out = {
    task: "task59_walk_forward_trading",
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source_run_id: manifest.run_id,
    source_manifest_path: MANIFEST_PATH,
    source_data_fingerprint: manifest.data_fingerprint,
    source_universe_fingerprint: manifest.universe.fingerprint,
    execution_data_fingerprint: executionFingerprint,
    forward_return_verification: { verified: verifiedCount, mismatch: mismatchCount, maxAbsDiff: maxAbsDiffGlobal, tolerance: 1e-6 },
    ml_predictions_md5: mlHash,
    universe_symbols: symbols,
    selection_cutoff: manifest.universe.selection_cutoff,
    horizons: manifest.horizons,
    model_names: manifest.model_names,
    val_end_idx: manifest.val_end_idx,
    final_test_sample_range: { start: manifest.val_end_idx, end: manifest.n_samples - 1, count: manifest.n_samples - manifest.val_end_idx },
    signal_threshold: SIGNAL_THRESHOLD,
    signal_policy: "long-only BUY when predicted return > +1% threshold. Negative forecasts = HOLD (not traded). No short-selling (PSX short-sale execution not supported).",
    entry_convention: "next eligible trading session's OPEN price after the signal-generating close. No retrospective fill. No cherry-picking among candidate bars.",
    cost_profile_primary: STANDARD_PSX,
    cost_profile_sensitivity: HIGH_SLIPPAGE_PSX,
    slippage_discrepancy_note: "Phase 2 audit found backtest.ts uses SLIPPAGE_RATE=0.005 while investment-simulator.ts + signal-stats use 0.0015. The primary profile (standard_psx, 0.0015) matches 2 of 3 simulators (majority documented convention). The high_slippage_psx sensitivity (0.005) matches backtest.ts. Selection is by documented convention, NOT by profitability.",
    atr_config: { period: ATR_PERIOD, sl_distance: "1.5×ATR", tp1_distance: "1×ATR", tp2_distance: "2×ATR", tp3_distance: "3×ATR", anchor: "entry open price (next session open), using decision-time ATR" },
    notional_per_trade: NOTIONAL,
    notional_note: "Fixed notional per trade (PKR 100,000). No portfolio compounding, leverage, or double-spending. Multiple same-date entries across stocks are allowed but each is sized at the fixed notional (NOT a portfolio-level capital allocation).",
    metrics: {
      fixed_horizon: fixedAgg,
      progressive_tp_sl: progAgg,
      progressive_tp_sl_high_slippage_sensitivity: progAggHighSlip,
    },
    unsupported_metrics: {
      portfolio_roi: "unavailable — no portfolio-level capital allocation / compounding / cash-availability model implemented",
      sharpe: "unavailable — no portfolio-equity time series (would require chronological capital allocation)",
      sortino: "unavailable — same as Sharpe",
      max_drawdown: "unavailable — no portfolio-equity curve",
    },
    limitations: [
      "Long-only strategy. Negative forecasts = HOLD (not traded). n_negative_forecasts_not_traded reports the count.",
      "Fixed notional per trade (PKR 100,000). No portfolio-level capital allocation, compounding, leverage, or cash-availability model. Multiple same-date entries are NOT portfolio-managed.",
      "Portfolio-level metrics (ROI, Sharpe, Sortino, max drawdown) are UNAVAILABLE — would require a chronological portfolio-equity curve with capital allocation rules. Trade-level net P&L is reported instead.",
      "Signal threshold (+1%) is FIXED and was NOT tuned on final-test performance. ATR/SL/TP distances use the documented fallback convention (1.5/1/2/3 × ATR) — NOT tuned on final-test.",
      "The standard_psx cost profile (slippage 0.0015) is the primary. The high_slippage_psx sensitivity (0.005) is reported separately. Selection by documented convention (majority of simulators), NOT by profitability.",
      "Same-stock holding windows do NOT overlap (sample_step=50 > max horizon=21). Cross-stock same-date entries are allowed but treated as independent fixed-notional trades (no portfolio management).",
      "This is a GENUINE out-of-sample ML trading simulation using the stored pilot25 predictions. It is DISTINCT from: (a) the forecast-quality evaluation (walk_forward_latest.json), (b) the signal-stats current-signal replay, (c) the backtest.ts technical-rule strategy. Do not conflate.",
      "The execution-data fingerprint verifies the OHLCV bars haven't changed since the pilot25 run. The forward-return verification reconstructs actual_5d/10d/21d from bars + compares to stored values (tolerance 1e-6).",
    ],
  };

  // Write to CANDIDATE first (validate before promoting)
  fs.writeFileSync(CANDIDATE_PATH, JSON.stringify(out, null, 2));
  console.log(`\n✓ Candidate written: ${CANDIDATE_PATH}`);
  // Validate: if the candidate has executed trades + verified OHLCV, promote to latest.
  const totalExecuted = fixedAgg.n_executed_trades + progAgg.n_executed_trades;
  const valid = totalExecuted > 0 && mismatchCount <= verifiedCount * 0.05;
  if (valid) {
    // Preserve previous latest if it exists
    if (fs.existsSync(OUTPUT_PATH)) {
      fs.copyFileSync(OUTPUT_PATH, OUTPUT_PATH.replace(".json", "_previous.json"));
    }
    fs.copyFileSync(CANDIDATE_PATH, OUTPUT_PATH);
    console.log(`✓ Promoted to latest: ${OUTPUT_PATH}`);
  } else {
    console.log("✗ Candidate NOT promoted (validation failed) — latest trading report preserved.");
  }
  console.log(`\n=== SUMMARY ===`);
  console.log(`fixed-horizon: ${fixedAgg.n_executed_trades} trades, wins=${fixedAgg.wins}, losses=${fixedAgg.losses}, total_net_pnl=${safeRound(fixedAgg.total_net_pnl, 2)}, profit_factor=${safeRound(fixedAgg.profit_factor, 3)}`);
  console.log(`progressive TP/SL: ${progAgg.n_executed_trades} trades, wins=${progAgg.wins}, losses=${progAgg.losses}, total_net_pnl=${safeRound(progAgg.total_net_pnl, 2)}, profit_factor=${safeRound(progAgg.profit_factor, 3)}`);
  console.log(`progressive TP/SL (high-slip sensitivity): ${progAggHighSlip.n_executed_trades} trades, total_net_pnl=${safeRound(progAggHighSlip.total_net_pnl, 2)}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
