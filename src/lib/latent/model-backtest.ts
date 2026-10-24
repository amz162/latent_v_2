// Latent.pk — Extended-universe backtest engine (Issue 2).
//
// Walk-forward simulation of ALL 65 models + 13 ensembles over the FULL DB
// universe (the original 674 ML-trained stocks + the ~200 fallback-covered
// stocks), so the Backtesting Report reflects every stock — including new /
// low-data PSX listings.
//
// Method (close-based, because DB high/low are NULL):
// - Decision points every 21 bars (~monthly) for stocks with ≥300 bars,
//   every 10 bars for shorter histories — over the last ~3 years of data.
// - At each point every model emits a signal via the SAME strategy engines
//   used for its live fallback prediction (src/lib/latent/fallback-predictions.ts).
// - Trade: enter at that bar's close; TP = model's predicted move; SL =
//   slAtr × ATR(14); whichever close-level is touched first within 21 bars,
//   else timeout exit. Signed return recorded in the trade's direction.
// - Ensembles D–M combine the per-model signals exactly like the runtime
//   ensemble builders do (weighted return blends, ±0.01 threshold).
//
// Pure TypeScript, no imports from Prisma — shared by the bun script only.

import {
  computeIndicatorSeries,
  featuresAt,
  strategySignal,
  strategyConfigFor,
  type IndicatorSeries,
} from "./fallback-predictions";
import { ALL_MODELS, TIER_WEIGHTS, type Tier } from "./ensemble";

export interface BacktestStockInput {
  symbol: string;
  dates: string[]; // YYYY-MM-DD, ascending
  closes: number[];
  vols: number[];
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  avgReturnPct: number;
  maxReturnPct: number;
  minReturnPct: number;
  profitFactor: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  stars: number;
  buySignals: number;
  sellSignals: number;
  coveredSymbols: number;
}

export const ALL_MODEL_KEYS: string[] = [
  "XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression", "ARIMA",
  "Holt-Winters", "GARCH", "Prophet", "Kalman Filter", "GRU", "Chronos (Amazon)",
  "Lag-Llama", "Moirai (Salesforce)", "Time-LLM", "LSTM", "CNN-LSTM",
  "Transformer-LSTM", "PatchTST", "N-BEATS", "TimesNet", "Informer",
  "LightGBM-A (CL-2)", "LightGBM-B (CL-2)", "HistGBM (CL-2)", "ExtraTrees (CL-2)",
  "RandomForest (CL-2)", "Logistic (CL-2)", "MLP (CL-2)",
  "Linear Regression (PI)", "Logistic Regression (PI)", "Pattern Matcher KNN (PI)",
  "Neural Network (PI)",
  "Technical Engine (GM)", "Announcements Engine (GM)", "Fundamental Engine (GM)",
  "Macro Engine (GM)",
  "LightGBM (CG)", "XGBoost (CG)",
  "Trend Multi-TF (X)", "Breakout RelVol (X)", "Trend Pullback (X)",
  "RSI Divergence (X)", "BB Mean Reversion (X)", "Vol Contraction (X)",
  "Relative Strength (X)", "Market Regime (X)", "Meta-Label CG (X)",
  "Triple Barrier Dyn (X)",
  "Gian-Ensemble (GIAN)", "Gian-Extender (GIAN-EXT)", "M-Ensemble (M)",
  "XGBoost (CL)", "LightGBM (CL)", "Random Forest (CL)",
  "Trend Multi-TF", "Breakout RelVol", "Trend Pullback", "RSI Divergence",
  "BB Mean Reversion", "Vol Contraction", "Relative Strength", "Market Regime",
  "Meta-Label CG", "Triple Barrier Dyn",
];

export const ALL_ENSEMBLE_KEYS: string[] = [
  "majority_vote", "probability_weighted", "tier_weighted",
  "cl_ensemble", "cl_extender", "cl2_ensemble", "pi_ensemble", "gm_model",
  "cg_ensemble", "x_ensemble", "gian_ensemble", "gian_extender", "m_ensemble",
];

export const ENSEMBLE_LABELS: Record<string, string> = {
  majority_vote: "A. Majority Vote",
  probability_weighted: "B. Probability-Weighted",
  tier_weighted: "C. Tier-Weighted",
  cl_ensemble: "D. CL-Ensemble (LGB70+Log30)",
  cl_extender: "E. CL-Extender (8-model weighted)",
  cl2_ensemble: "F. CL-2 Ensemble (7 classifiers + logistic meta)",
  pi_ensemble: "G. PI-Ensemble (4 models)",
  gm_model: "H. GM-Model Ensembler (4-Pillar)",
  cg_ensemble: "I. CG-Ensemble (triple-barrier, cost-aware)",
  x_ensemble: "J. X-Ensemble (10 strategies + meta-labeling)",
  gian_ensemble: "K. Gian-Ensemble (Square-root S/R)",
  gian_extender: "L. Gian-Extender (GANN square-of-9)",
  m_ensemble: "M. M-Ensemble (price-touch S/R + ATR)",
};

// model key → tier (for the tier-weighted ensemble simulation)
const MODEL_TIER: Record<string, Tier> = {};
for (const m of ALL_MODELS) {
  MODEL_TIER[m.name] = m.tier;
  const stripped = m.name.replace(" (CL)", "");
  MODEL_TIER[stripped] = m.tier;
  const noX = m.name.replace(" (X)", "");
  MODEL_TIER[noX] = m.tier;
}
function tierOf(key: string): Tier {
  return MODEL_TIER[key] || "TIER_3";
}

const ENSEMBLE_MEMBER_KEYS: Record<string, string[]> = {
  cl_ensemble: ["LightGBM (CL)", "Ridge Regression"],
  cl_extender: [
    "XGBoost (CL)", "LightGBM (CL)", "Random Forest (CL)", "ARIMA",
    "Holt-Winters", "GARCH", "Prophet", "Kalman Filter",
  ],
  cl2_ensemble: [
    "LightGBM-A (CL-2)", "LightGBM-B (CL-2)", "HistGBM (CL-2)",
    "ExtraTrees (CL-2)", "RandomForest (CL-2)", "Logistic (CL-2)", "MLP (CL-2)",
  ],
  pi_ensemble: [
    "Linear Regression (PI)", "Logistic Regression (PI)",
    "Pattern Matcher KNN (PI)", "Neural Network (PI)",
  ],
  gm_model: [
    "Technical Engine (GM)", "Announcements Engine (GM)",
    "Fundamental Engine (GM)", "Macro Engine (GM)",
  ],
  cg_ensemble: ["LightGBM (CG)", "XGBoost (CG)"],
  x_ensemble: [
    "Trend Multi-TF (X)", "Breakout RelVol (X)", "Trend Pullback (X)",
    "RSI Divergence (X)", "BB Mean Reversion (X)", "Vol Contraction (X)",
    "Relative Strength (X)", "Market Regime (X)", "Meta-Label CG (X)",
    "Triple Barrier Dyn (X)",
  ],
  gian_ensemble: ["Gian-Ensemble (GIAN)"],
  gian_extender: ["Gian-Extender (GIAN-EXT)"],
  m_ensemble: ["M-Ensemble (M)"],
};
const ENSEMBLE_WEIGHTS: Record<string, number[]> = {
  cl_ensemble: [0.7, 0.3],
  gm_model: [0.35, 0.3, 0.2, 0.15],
  cg_ensemble: [0.5, 0.5],
};

interface Acc {
  count: number;
  wins: number;
  grossWin: number;
  grossLoss: number;
  sum: number;
  sumSq: number;
  min: number;
  max: number;
  buy: number;
  sell: number;
  stocks: Set<string>;
  // drawdown ledger (chronological via month string sort)
  months: string[];
  rets: number[];
}

function newAcc(): Acc {
  return {
    count: 0, wins: 0, grossWin: 0, grossLoss: 0, sum: 0, sumSq: 0,
    min: Infinity, max: -Infinity, buy: 0, sell: 0, stocks: new Set(), months: [], rets: [],
  };
}

function starsFor(winRate: number): number {
  if (winRate >= 80) return 5;
  if (winRate >= 60) return 4;
  if (winRate >= 40) return 3;
  if (winRate >= 25) return 2;
  return 1;
}

function finalize(acc: Acc): BacktestStats {
  const n = acc.count;
  if (n === 0) {
    return {
      totalTrades: 0, wins: 0, winTrades: 0, lossTrades: 0, winRate: 0,
      avgReturnPct: 0, maxReturnPct: 0, minReturnPct: 0, profitFactor: 0,
      sharpe: 0, sortino: 0, maxDrawdownPct: 0, stars: 1, buySignals: 0,
      sellSignals: 0, coveredSymbols: 0,
    };
  }
  const mean = acc.sum / n;
  const variance = Math.max(0, acc.sumSq / n - mean * mean);
  const sd = Math.sqrt(variance);
  // downside deviation (returns below 0)
  let dSum = 0,
    dCount = 0;
  for (const r of acc.rets) {
    if (r < 0) {
      dSum += r * r;
      dCount++;
    }
  }
  const dsd = dCount > 0 ? Math.sqrt(dSum / dCount) : 0;
  const ann = Math.sqrt(12); // ~monthly decision cadence
  const sharpe = sd > 0 ? (mean / sd) * ann : 0;
  const sortino = dsd > 0 ? (mean / dsd) * ann : 0;

  // max drawdown on the compounded equity curve (chronological by month)
  const order = acc.rets.map((r, i) => ({ m: acc.months[i], r })).sort((a, b) => (a.m < b.m ? -1 : 1));
  let eq = 1,
    peak = 1,
    maxDD = 0;
  for (const t of order) {
    eq *= 1 + t.r / 100;
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? (peak - eq) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  const winRate = (acc.wins / n) * 100;
  return {
    totalTrades: n,
    wins: acc.wins,
    winTrades: acc.wins,
    lossTrades: n - acc.wins,
    winRate: Math.round(winRate * 100) / 100,
    avgReturnPct: Math.round(mean * 100) / 100,
    maxReturnPct: Math.round(acc.max * 100) / 100,
    minReturnPct: Math.round(acc.min * 100) / 100,
    profitFactor: Math.round((acc.grossLoss > 0 ? acc.grossWin / acc.grossLoss : acc.grossWin > 0 ? 99 : 0) * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    sortino: Math.round(sortino * 100) / 100,
    maxDrawdownPct: Math.round(maxDD * 10000) / 100,
    stars: starsFor(winRate),
    buySignals: acc.buy,
    sellSignals: acc.sell,
    coveredSymbols: acc.stocks.size,
  };
}

// Ensemble blended return at a decision point from per-model signals.
function ensembleAt(
  ensKey: string,
  modelRets: Record<string, number>, // modelKey → signed predictedReturn (0 for HOLD)
  modelSignals: Record<string, string>
): { signal: "BUY" | "SELL" | "HOLD"; ret: number } {
  if (ensKey === "majority_vote") {
    let buy = 0,
      sell = 0,
      hold = 0;
    let buySum = 0,
      sellSum = 0;
    for (const k of ALL_MODEL_KEYS) {
      const s = modelSignals[k];
      if (s === "BUY") {
        buy++;
        buySum += modelRets[k] || 0;
      } else if (s === "SELL") {
        sell++;
        sellSum += modelRets[k] || 0;
      } else hold++;
    }
    if (buy > sell && buy > hold) return { signal: "BUY", ret: buySum / buy };
    if (sell > buy && sell > hold) return { signal: "SELL", ret: sellSum / sell };
    return { signal: "HOLD", ret: 0 };
  }
  if (ensKey === "probability_weighted") {
    let sum = 0;
    for (const k of ALL_MODEL_KEYS) sum += modelRets[k] || 0;
    const avg = sum / ALL_MODEL_KEYS.length;
    return { signal: avg > 0.01 ? "BUY" : avg < -0.01 ? "SELL" : "HOLD", ret: avg };
  }
  if (ensKey === "tier_weighted") {
    let wsum = 0,
      acc2 = 0;
    for (const k of ALL_MODEL_KEYS) {
      const tw = TIER_WEIGHTS[tierOf(k)] || 0.25;
      acc2 += (modelRets[k] || 0) * tw;
      wsum += tw;
    }
    const wr = wsum > 0 ? acc2 / wsum : 0;
    return { signal: wr > 0.01 ? "BUY" : wr < -0.01 ? "SELL" : "HOLD", ret: wr };
  }
  if (ensKey === "gian_ensemble" || ensKey === "gian_extender" || ensKey === "m_ensemble") {
    const key = ENSEMBLE_MEMBER_KEYS[ensKey][0];
    const r = modelRets[key] || 0;
    const s = modelSignals[key] || "HOLD";
    return { signal: s as "BUY" | "SELL" | "HOLD", ret: r };
  }
  const members = ENSEMBLE_MEMBER_KEYS[ensKey];
  if (!members) return { signal: "HOLD", ret: 0 };
  const weights = ENSEMBLE_WEIGHTS[ensKey];
  let acc2 = 0,
    wsum = 0;
  for (let i = 0; i < members.length; i++) {
    const w = weights ? weights[i] ?? 1 / members.length : 1 / members.length;
    acc2 += (modelRets[members[i]] || 0) * w;
    wsum += w;
  }
  const ret = wsum > 0 ? acc2 / wsum : 0;
  return { signal: ret > 0.01 ? "BUY" : ret < -0.01 ? "SELL" : "HOLD", ret };
}

export interface AllBacktestOutput {
  models: Record<string, BacktestStats>;
  ensembles: Record<string, BacktestStats>;
  stocksCovered: number;
  totalDecisionPoints: number;
}

export function runAllBacktests(
  stocks: BacktestStockInput[],
  opts?: { maxBars?: number }
): AllBacktestOutput {
  const modelAcc: Record<string, Acc> = {};
  const ensAcc: Record<string, Acc> = {};
  for (const k of ALL_MODEL_KEYS) modelAcc[k] = newAcc();
  for (const k of ALL_ENSEMBLE_KEYS) ensAcc[k] = newAcc();

  let totalPoints = 0;
  let stocksCovered = 0;

  for (const stock of stocks) {
    // Sanitize: drop corrupt rows (close <= 0 / non-finite) that would poison
    // return math with NaN — some PSX symbols have bad data days.
    const datesAll = stock.dates;
    const closesAll = stock.closes;
    const volsAll = stock.vols;
    const keep: number[] = [];
    for (let i = 0; i < closesAll.length; i++) {
      if (Number.isFinite(closesAll[i]) && closesAll[i] > 0) keep.push(i);
    }
    if (keep.length < 40) continue;
    const dates = keep.map((i) => datesAll[i]);
    const closes = keep.map((i) => closesAll[i]);
    const vols = keep.map((i) => volsAll[i]);
    const n = closes.length;
    const m = n;
    const series: IndicatorSeries = computeIndicatorSeries(closes, vols);

    // decision points: monthly for long histories, bi-weekly for short
    const step = m >= 300 ? 21 : 10;
    const start = Math.max(m >= 300 ? 40 : 15, m - 756);
    let stockTraded = false;

    for (let i = start; i <= m - 2; i += step) {
      const f = featuresAt(series, i);
      // per-model signals at this point (65 × O(1))
      const modelRets: Record<string, number> = {};
      const modelSignals: Record<string, string> = {};
      const modelCfgs: Record<string, ReturnType<typeof strategyConfigFor>> = {};
      for (const key of ALL_MODEL_KEYS) {
        const sig = strategySignal(key, f);
        modelRets[key] = sig.predictedReturn;
        modelSignals[key] = sig.signal;
        modelCfgs[key] = strategyConfigFor(key);
      }
      totalPoints++;

      const horizon = Math.min(21, m - 1 - i);
      if (horizon < 3) continue;

      // simulate a trade for one (key, signal, ret, slAtr) tuple
      const simTrade = (
        acc: Acc,
        signal: "BUY" | "SELL",
        retPred: number,
        slAtr: number
      ) => {
        const dir = signal === "SELL" ? -1 : 1;
        const entry = closes[i];
        const tp = entry * (1 + dir * Math.max(0.008, Math.min(0.3, Math.abs(retPred))));
        const sl = entry * (1 - dir * slAtr * f.atrPct);
        let exit = closes[i + horizon];
        for (let j = i + 1; j <= i + horizon; j++) {
          const c = closes[j];
          if (dir === 1 ? c >= tp : c <= tp) {
            exit = tp;
            break;
          }
          if (dir === 1 ? c <= sl : c >= sl) {
            exit = sl;
            break;
          }
        }
        const retPct = ((exit / entry - 1) * 100) * dir;
        acc.count++;
        acc.sum += retPct;
        acc.sumSq += retPct * retPct;
        if (retPct > acc.max) acc.max = retPct;
        if (retPct < acc.min) acc.min = retPct;
        if (retPct > 0) {
          acc.wins++;
          acc.grossWin += retPct;
        } else {
          acc.grossLoss += -retPct;
        }
        if (signal === "BUY") acc.buy++;
        else acc.sell++;
        acc.months.push(dates[i].slice(0, 7));
        acc.rets.push(retPct);
        acc.stocks.add(stock.symbol);
        stockTraded = true;
      };

      // models
      for (const key of ALL_MODEL_KEYS) {
        const sig = modelSignals[key];
        if (sig === "HOLD") continue;
        simTrade(modelAcc[key], sig as "BUY" | "SELL", modelRets[key], modelCfgs[key].slAtr);
      }
      // ensembles
      for (const ensKey of ALL_ENSEMBLE_KEYS) {
        const { signal, ret } = ensembleAt(ensKey, modelRets, modelSignals);
        if (signal === "HOLD") continue;
        const slAtr =
          ensKey === "gian_ensemble" || ensKey === "gian_extender" || ensKey === "m_ensemble"
            ? 1.8
            : ensKey === "cg_ensemble"
              ? 1.3
              : 1.5;
        simTrade(ensAcc[ensKey], signal as "BUY" | "SELL", ret, slAtr);
      }
    }
    if (stockTraded) stocksCovered++;
  }

  const models: Record<string, BacktestStats> = {};
  for (const k of ALL_MODEL_KEYS) models[k] = finalize(modelAcc[k]);
  const ensembles: Record<string, BacktestStats> = {};
  for (const k of ALL_ENSEMBLE_KEYS) ensembles[k] = finalize(ensAcc[k]);

  return { models, ensembles, stocksCovered, totalDecisionPoints: totalPoints };
}
