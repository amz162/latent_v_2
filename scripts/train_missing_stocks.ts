// Issue 2 — Extended training: cover ALL DB stocks (including new / low-data
// PSX listings) with per-model + per-ensemble predictions, then backtest ALL
// models + ensembles over the FULL universe. Results are saved PERMANENTLY in
// the SQLite DB (ModelPredictionCache + ModelBacktestCache) so the AI Models
// tab never shows "No prediction" again and repeat visits never recompute.
//
//   bun run scripts/train_missing_stocks.ts                    # predictions for missing stocks + full backtests
//   bun run scripts/train_missing_stocks.ts --preds-only       # skip backtests
//   bun run scripts/train_missing_stocks.ts --bt-only          # skip predictions
//   bun run scripts/train_missing_stocks.ts --limit 50         # cap symbols processed
//   bun run scripts/train_missing_stocks.ts --force            # recompute prediction caches that already exist
import { db } from "../src/lib/db";
import { promises as fs } from "fs";
import path from "path";
import {
  buildSymbolFallbackPredictions,
  ALL_FALLBACK_MODEL_KEYS,
  STORED_ENSEMBLE_KEYS,
} from "../src/lib/latent/fallback-predictions";
import { runAllBacktests, ALL_MODEL_KEYS, ALL_ENSEMBLE_KEYS, ENSEMBLE_LABELS, type BacktestStockInput } from "../src/lib/latent/model-backtest";

const args = process.argv.slice(2);
const getArg = (name: string): number | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Math.max(1, Number(args[i + 1]) || 0) : null;
};
const LIMIT = getArg("--limit") ?? 0; // 0 = no limit
const PREDS_ONLY = args.includes("--preds-only");
const BT_ONLY = args.includes("--bt-only");
const FORCE = args.includes("--force");
const DO_PREDS = !BT_ONLY;
const DO_BT = !PREDS_ONLY;

interface MultiFile {
  models?: Record<string, { trained?: boolean; predictions?: Record<string, unknown> }>;
  [k: string]: unknown;
}

async function loadMulti(): Promise<MultiFile | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "ml_predictions_multi.json"), "utf-8"));
  } catch {
    return null;
  }
}

async function main() {
  const t0 = Date.now();
  console.log(`[extend-train] start (preds=${DO_PREDS}, backtests=${DO_BT}, limit=${LIMIT || "all"}, force=${FORCE})`);

  // 1. Load all DB symbols + bar counts
  const grouped = await db.ohlcvBar.groupBy({ by: ["symbol"], _count: { date: true } });
  const allSymbols = grouped.map((g) => ({ symbol: g.symbol, count: g._count.date })).sort((a, b) => b.count - a.count);
  console.log(`[extend-train] DB symbols: ${allSymbols.length}`);

  // 2. Which (model, symbol) pairs are missing from the Python training file?
  const multi = await loadMulti();
  const fileModels: Record<string, Record<string, unknown>> = {};
  if (multi?.models) {
    for (const [mk, md] of Object.entries(multi.models)) {
      fileModels[mk] = (md?.predictions || {}) as Record<string, unknown>;
    }
  }
  const missingPairs = new Map<string, Set<string>>(); // symbol → missing model keys
  for (const { symbol } of allSymbols) {
    const missing = new Set<string>();
    for (const mk of ALL_FALLBACK_MODEL_KEYS) {
      if (!fileModels[mk]?.[symbol]) missing.add(mk);
    }
    if (missing.size > 0) missingPairs.set(symbol, missing);
  }
  console.log(`[extend-train] symbols missing ≥1 model prediction: ${missingPairs.size} / ${allSymbols.length}`);

  // 3. Build + persist fallback predictions for every symbol that needs them
  if (DO_PREDS) {
    let done = 0,
      skippedShort = 0,
      skippedFresh = 0,
      errors = 0;
    const symbolsToProcess = allSymbols.filter(({ symbol }) => missingPairs.has(symbol));
    for (const { symbol, count } of symbolsToProcess) {
      if (LIMIT > 0 && done >= LIMIT) break;
      try {
        if (!FORCE) {
          const existing = await db.modelPredictionCache.findUnique({ where: { symbol } });
          if (existing) {
            skippedFresh++;
            continue;
          }
        }
        const bars = await db.ohlcvBar.findMany({
          where: { symbol },
          orderBy: { date: "asc" },
          select: { date: true, close: true, volume: true },
        });
        const result = buildSymbolFallbackPredictions(
          bars.map((b) => ({ date: b.date, close: b.close, volume: b.volume }))
        );
        if (!result) {
          skippedShort++;
          continue;
        }
        await db.modelPredictionCache.upsert({
          where: { symbol },
          create: {
            symbol,
            predictionsJson: JSON.stringify({ models: result.models, ensembles: result.ensembles }),
            dataSourceDate: result.dataSourceDate,
          },
          update: {
            predictionsJson: JSON.stringify({ models: result.models, ensembles: result.ensembles }),
            dataSourceDate: result.dataSourceDate,
            computedAt: new Date(),
          },
        });
        done++;
        if (done % 100 === 0) console.log(`[extend-train] predictions: ${done} symbols cached (bars: ${count})`);
      } catch (e) {
        errors++;
        console.warn(`[extend-train] ${symbol} prediction error:`, e instanceof Error ? e.message : e);
      }
    }
    console.log(
      `[extend-train] predictions done: cached=${done}, alreadyCached=${skippedFresh}, tooShort=${skippedShort}, errors=${errors} in ${((Date.now() - t0) / 1000).toFixed(1)}s`
    );
  }

  // 4. Backtest ALL models + ensembles over the FULL universe
  if (DO_BT) {
    const bt0 = Date.now();
    console.log(`[extend-train] loading bars for backtest universe...`);
    const symbols = allSymbols.filter((s) => s.count >= 40).map((s) => s.symbol);
    const stocks: BacktestStockInput[] = [];
    for (const symbol of symbols) {
      const bars = await db.ohlcvBar.findMany({
        where: { symbol },
        orderBy: { date: "asc" },
        select: { date: true, close: true, volume: true },
      });
      if (bars.length < 40) continue;
      stocks.push({
        symbol,
        dates: bars.map((b) => b.date),
        closes: bars.map((b) => b.close),
        vols: bars.map((b) => b.volume || 0),
      });
    }
    console.log(`[extend-train] backtesting ${stocks.length} stocks × ${ALL_MODEL_KEYS.length} models + ${ALL_ENSEMBLE_KEYS.length} ensembles...`);
    const t = Date.now();
    const result = runAllBacktests(stocks);
    console.log(
      `[extend-train] backtest finished in ${((Date.now() - t) / 1000).toFixed(1)}s — ${result.totalDecisionPoints} decision points, ${result.stocksCovered} stocks traded`
    );

    // persist per-model backtests
    let mw = 0;
    for (const key of ALL_MODEL_KEYS) {
      const stats = result.models[key];
      await db.modelBacktestCache.upsert({
        where: { key },
        create: { key, kind: "model", label: key, payloadJson: JSON.stringify(stats), coveredSymbols: stats.coveredSymbols },
        update: { kind: "model", label: key, payloadJson: JSON.stringify(stats), coveredSymbols: stats.coveredSymbols, computedAt: new Date() },
      });
      mw++;
    }
    // persist per-ensemble backtests
    for (const key of ALL_ENSEMBLE_KEYS) {
      const stats = result.ensembles[key];
      await db.modelBacktestCache.upsert({
        where: { key },
        create: { key, kind: "ensemble", label: ENSEMBLE_LABELS[key] || key, payloadJson: JSON.stringify(stats), coveredSymbols: stats.coveredSymbols },
        update: { kind: "ensemble", label: ENSEMBLE_LABELS[key] || key, payloadJson: JSON.stringify(stats), coveredSymbols: stats.coveredSymbols, computedAt: new Date() },
      });
    }
    // quick summary of the top ensembles
    const topEns = ALL_ENSEMBLE_KEYS.map((k) => ({ k, wr: result.ensembles[k].winRate, n: result.ensembles[k].totalTrades }))
      .sort((a, b) => b.wr - a.wr)
      .slice(0, 5);
    console.log(`[extend-train] top ensembles: ${topEns.map((e) => `${e.k}=${e.wr.toFixed(1)}% (${e.n} trades)`).join(", ")}`);
    console.log(`[extend-train] backtests persisted: ${mw} models + ${ALL_ENSEMBLE_KEYS.length} ensembles in ${((Date.now() - bt0) / 1000).toFixed(1)}s`);
  }

  // 5. Coverage summary
  const cached = await db.modelPredictionCache.count();
  const bts = await db.modelBacktestCache.count();
  console.log(`[extend-train] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s — ModelPredictionCache rows: ${cached}, ModelBacktestCache rows: ${bts}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("[extend-train] fatal:", e);
  process.exit(1);
});
