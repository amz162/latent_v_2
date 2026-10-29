import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/backtest/model-graph/ml
// Task 72 — Genuine trained-ML actual-vs-predicted PRICE graph.
// Reads raw walk-forward sample records (not strategySignal) + verifies
// actual future closes against the OHLCV database.
// predictedPrice = decisionClose × (1 + predictedForwardReturn)
// actualPrice = decisionClose × (1 + actualForwardReturn) — verified against DB

const RUN_DIR = "data/backtest_reports/runs/pilot25_step50_20261028";
const MANIFEST_PATH = path.join(RUN_DIR, "manifest.json");
const SAMPLES_DIR = path.join(RUN_DIR, "samples");
const SUPPORTED_MODELS = ["XGBoost", "LightGBM", "CatBoost", "Random Forest", "Ridge Regression"];
const SUPPORTED_HORIZONS = [5, 10, 21];

function epochMsToDateStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const model = url.searchParams.get("model") || "XGBoost";
    const horizon = parseInt(url.searchParams.get("horizon") || "5", 10);
    const period = url.searchParams.get("period") || "final-test"; // validation | final-test

    if (!symbol) return NextResponse.json({ available: false, error: "Missing symbol" }, { status: 400 });
    if (!SUPPORTED_MODELS.includes(model)) return NextResponse.json({ available: false, error: `Unsupported model: ${model}` }, { status: 400 });
    if (!SUPPORTED_HORIZONS.includes(horizon)) return NextResponse.json({ available: false, error: `Unsupported horizon: ${horizon}` }, { status: 400 });

    // Read manifest for val_end_idx + universe
    const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
    const valEndIdx = manifest.val_end_idx;
    const nSamples = manifest.n_samples;

    // Determine sample range based on period
    const startIdx = period === "validation" ? 0 : valEndIdx;
    const endIdx = period === "validation" ? valEndIdx : nSamples;

    // Load OHLCV bars for the symbol from DB (for target-date verification)
    const dbBars = await db.ohlcvBar.findMany({
      where: { symbol }, orderBy: { date: "asc" },
      select: { date: true, close: true },
    });
    const barDates = dbBars.map(b => b.date);
    const barCloseMap = new Map(dbBars.map(b => [b.date, b.close]));

    // Read sample records in the selected period
    const points: any[] = [];
    let nOmitted = 0;

    for (let i = startIdx; i < endIdx; i++) {
      const samplePath = path.join(SAMPLES_DIR, `sample_${String(i).padStart(6, "0")}.json`);
      try {
        const rec = JSON.parse(await fs.readFile(samplePath, "utf8"));
        if (rec.stock !== symbol) continue;
        if (rec.status !== "evaluated") { nOmitted++; continue; }

        const modelData = rec.models?.[model];
        if (!modelData) { nOmitted++; continue; }

        const hzKey = String(horizon);
        const hp = modelData.horizon_preds?.[hzKey];
        if (!hp || hp.eval_skipped) { nOmitted++; continue; }

        const decisionClose = rec.close;
        const predictedReturn = hp.predicted;
        const actualReturn = hp.actual;
        const decisionDateStr = epochMsToDateStr(rec.date);

        // Find target date: decision_date + horizon trading sessions
        const decisionBarIdx = barDates.indexOf(decisionDateStr);
        let targetDateStr: string | null = null;
        let verifiedActualClose: number | null = null;

        if (decisionBarIdx >= 0 && decisionBarIdx + horizon < barDates.length) {
          targetDateStr = barDates[decisionBarIdx + horizon];
          verifiedActualClose = barCloseMap.get(targetDateStr) ?? null;
        }

        // Compute prices
        const predictedPrice = decisionClose * (1 + predictedReturn);
        const actualPrice = decisionClose * (1 + actualReturn);

        // Verify: the computed actual price should match the DB's future close
        let verificationStatus = "unverified";
        if (verifiedActualClose != null) {
          const computedActualClose = decisionClose * (1 + actualReturn);
          const diff = Math.abs(computedActualClose - verifiedActualClose);
          verificationStatus = diff < 0.01 ? "verified" : "mismatch";
        }

        points.push({
          decision_date: decisionDateStr,
          target_date: targetDateStr,
          decision_close: decisionClose,
          predicted_return: predictedReturn,
          predicted_price: predictedPrice,
          actual_return: actualReturn,
          actual_price: actualPrice,
          verified_actual_close: verifiedActualClose,
          verification: verificationStatus,
          status: "evaluated",
        });
      } catch { nOmitted++; }
    }

    return NextResponse.json({
      available: true,
      source_run_id: manifest.run_id,
      schema_version: "1.0",
      model, horizon, symbol, period,
      n_points: points.length,
      n_omitted: nOmitted,
      points,
      methodology: "predictedPrice = decisionClose × (1 + predictedForwardReturn). actualPrice = decisionClose × (1 + actualForwardReturn). Target date = decision_date + horizon trading sessions (queried from OHLCV DB, NOT calendar days).",
      data_source: `Raw walk-forward sample records from ${RUN_DIR}/samples/. NOT strategySignal. NOT prospective PredictionHistory.`,
      limitations: [
        "Historical out-of-sample predictions from the pilot25 walk-forward evaluation (Task 55). NOT live forecasts.",
        "These are genuinely trained-ML predictions — NOT technical-rule strategySignal outputs.",
        "The graph shows predicted vs actual TARGET PRICES at the forecast horizon, not intraday paths.",
        "Sparse decision dates reflect the 50-session sampling cadence — gaps are real, not missing data.",
        "Do NOT claim predictive skill from a graph's visual appearance.",
      ],
    });
  } catch (e: any) {
    return NextResponse.json({ available: false, error: e?.message || "Failed to load ML graph data" }, { status: 500 });
  }
}
