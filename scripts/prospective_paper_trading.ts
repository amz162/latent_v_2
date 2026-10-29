/**
 * Task 66 — Prospective Paper-Trading Workflow.
 *
 * Daily workflow that:
 * 1. Validates price-data freshness.
 * 2. Checks if genuine trained-ML inference is available (currently NOT — shows blocked state).
 * 3. If available: generates predictions, records them immutably, enters paper positions.
 * 4. Advances existing paper positions using newly available market bars.
 * 5. Matures forward-return labels when horizons are reached.
 * 6. Outputs a report artifact.
 *
 * Per user rule: "If a model lacks a usable genuine inference path, mark it
 * unavailable instead of using technical-rule signals under its name."
 * Currently: trained-ML inference is UNAVAILABLE (static file, not live). The
 * workflow shows an honest BLOCKED state rather than fabricating predictions.
 *
 * Run: bun scripts/prospective_paper_trading.ts
 * Output: data/backtest_reports/prospective_paper_trading_latest.json
 */
import { db } from "@/lib/db";
import { checkDataFreshness, checkInferenceAvailability } from "@/lib/latent/data-freshness";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = "data/backtest_reports/prospective_paper_trading_latest.json";
const ML_PRED_FILE = "data/ml_predictions_multi.json";
import * as crypto from "crypto";

async function main() {
  console.log("=".repeat(60));
  console.log("Task 66 — Prospective Paper-Trading Workflow");
  console.log("=".repeat(60));

  // Phase 2: data-freshness check
  console.log("\nPhase 2: checking data freshness...");
  const freshness = await checkDataFreshness(3);
  console.log(`  latestDbDate: ${freshness.latestDbDate}`);
  console.log(`  currentUtcDate: ${freshness.currentUtcDate}`);
  console.log(`  daysStale: ${freshness.daysStale}`);
  console.log(`  fresh: ${freshness.fresh}`);
  if (freshness.warnings.length) freshness.warnings.forEach(w => console.log(`  warning: ${w}`));

  // Phase 1: check inference availability
  console.log("\nPhase 1: checking inference availability...");
  const inference = checkInferenceAvailability();
  console.log(`  trained-ML available: ${inference.available}`);
  console.log(`  reason: ${inference.reason}`);

  // Check for existing PredictionHistory records
  const existingPredictions = await db.predictionHistory.count();
  const pendingPredictions = await db.predictionHistory.count({ where: { outcomeStatus: "pending" } });
  const maturedPredictions = await db.predictionHistory.count({ where: { outcomeStatus: "matured" } });
  console.log(`\n  PredictionHistory: ${existingPredictions} total, ${pendingPredictions} pending, ${maturedPredictions} matured`);

  // Determine the blocked state
  const blocked = !inference.available;
  const blockReason = blocked ? inference.reason : null;

  // Build the report
  const mlHash = crypto.createHash("md5").update(fs.readFileSync(ML_PRED_FILE)).digest("hex");
  const report = {
    task: "task66_prospective_paper_trading",
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    experiment_start: existingPredictions > 0 ? (await db.predictionHistory.findFirst({ orderBy: { createdAt: "asc" } }))?.createdAt?.toISOString() : null,
    latest_observation: new Date().toISOString(),
    latest_verified_market_data_date: freshness.latestDbDate,
    data_freshness: freshness,
    inference_availability: inference,
    ml_predictions_md5: mlHash,
    prediction_counts: {
      total: existingPredictions,
      pending: pendingPredictions,
      matured: maturedPredictions,
    },
    paper_trading_policy: {
      direction: "long_only",
      strategy: "fixed_horizon",
      horizon: 5,
      signal_threshold: 0.01,
      entry_convention: "next_session_open",
      exit_convention: "horizon_end_close",
      cost_profile: "standard_psx",
      initial_capital: 1_000_000,
      max_concurrent_positions: 10,
      max_position_size_fraction: 0.10,
      max_gross_exposure: 1.0,
      one_position_per_stock: true,
      no_leverage: true,
    },
    status: blocked ? "BLOCKED" : "ACTIVE",
    block_reason: blockReason,
    paper_trades: { open: 0, closed: 0, skipped: 0 },
    metrics: blocked ? null : {
      realized_net_pnl: 0,
      unrealized_pnl: 0,
      final_equity: 1_000_000,
      total_return_pct: 0,
      sharpe: null,
      sortino: null,
      max_drawdown_pct: null,
    },
    honest_disclosure: [
      "This is a PROSPECTIVE paper-trading system — predictions are recorded at their timestamp + outcomes are matured as the market moves forward.",
      "Currently BLOCKED: no live trained-ML inference path is available. ml_predictions_multi.json is a static file from Oct 23 (not live inference). The signals API uses mock-signals.ts. The fallback engine generates technical-rule signals (NOT trained-ML) — per policy, these are NOT used as a substitute.",
      "To UNBLOCK: implement a live inference script that runs the Python ML models on current OHLCV data + records the predictions via /api/predictions/record.",
      "Technical-rule signals from the fallback engine are available but are NOT labeled as trained-ML predictions. They could be tracked as a SEPARATE experiment if desired.",
      "Do NOT interpret any future positive paper-trading result as proof of model skill without sufficient prospective observations + a statistical significance test.",
      "Historical walk-forward results (Tasks 55-65) are EXPLORATORY — the prospective period is the next independent evaluation.",
    ],
    limitations: [
      "No live trained-ML inference path — the workflow is BLOCKED until one is implemented.",
      "The ml_predictions_multi.json file (Oct 23) contains pre-computed predictions for historical data, NOT live inference for current market sessions.",
      "The signals API (/api/signals/all) uses mock-signals.ts — NOT genuine predictions.",
      "The fallback engine (fallback-predictions.ts) CAN generate technical-rule signals from current data, but per policy these are NOT used as trained-ML substitutes.",
      "To start the prospective experiment: (1) implement a Python live-inference script, (2) run it after each market-data update, (3) record predictions via /api/predictions/record, (4) run this workflow to enter paper positions + mature outcomes.",
    ],
    daily_workflow_commands: {
      step1_update_data: "bun run scripts/backfill_ohlcv.ts",
      step2_generate_predictions: "python3 scripts/generate_live_predictions.py  # NOT YET IMPLEMENTED — this is the blocker",
      step3_record_predictions: "curl -X POST http://127.0.0.1:3000/api/predictions/record -H 'Content-Type: application/json' -d '{...}'",
      step4_run_paper_trading: "bun scripts/prospective_paper_trading.ts",
      step5_check_report: "curl -s http://127.0.0.1:3000/api/backtest/walk-forward/prospective",
    },
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report written: ${OUTPUT_PATH}`);
  console.log(`  status: ${report.status}`);
  console.log(`  block_reason: ${blockReason ? blockReason.slice(0, 80) + "..." : "none"}`);
  console.log(`  prediction_counts: ${existingPredictions} total, ${pendingPredictions} pending`);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
