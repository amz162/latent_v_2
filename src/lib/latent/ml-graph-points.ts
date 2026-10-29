/**
 * Task 74 — Pure, deterministic core for the Trained-ML Out-of-Sample
 * actual-vs-predicted PRICE graph.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Before Task 74 the verification + price logic lived inline inside
 * /api/backtest/model-graph/ml/route.ts and could not be unit-tested without a
 * live database. Task 74 extracts that logic into pure functions that accept
 * plain arrays / maps (no Prisma, no filesystem) so deterministic fixtures can
 * prove the behaviour.
 *
 * WHAT IT GUARANTEES (and what it deliberately does NOT do)
 * --------------------------------------------------------
 *  - predictedPrice = decisionClose × (1 + predictedForwardReturn)  — the
 *    ORIGINAL stored forecast is never modified or recalibrated.
 *  - The MAIN chart's actual-price series is the OBSERVED OHLCV close at the
 *    target trading session (verifiedActualClose), NOT the calculated price.
 *  - The calculated actual price (decisionClose × (1 + actualReturn)) is kept
 *    ONLY as a validation field; it must agree with the observed close within
 *    VERIFY_TOLERANCE for a point to be "verified".
 *  - A point enters the verified comparison series (GraphResult.points) ONLY
 *    when ALL of these hold:
 *      1. the sample status is "evaluated"
 *      2. the requested model + horizon exist and were not eval_skipped
 *      3. decisionClose is finite and strictly positive
 *      4. predictedReturn and actualReturn are finite
 *      5. the decision bar exists in the chronological per-symbol bar list
 *      6. a future bar exists at decisionBarIdx + horizon (session-indexed,
 *         NOT calendar-day offset — matches walk_forward_backtesting.py's
 *         `ste.iloc[i + horizon]`)
 *      7. the calculated actual price agrees with the observed close within
 *         VERIFY_TOLERANCE
 *    Any other record becomes a diagnostic (mismatch / unavailable_target) or
 *    is counted as omitted / duplicate — it NEVER enters `points`.
 *  - A missing target date is NEVER replaced with the decision date.
 *  - Duplicate (decision_date, model, horizon) records do not produce
 *    duplicate chart observations.
 *  - Counts reconcile:
 *      n_candidates == n_valid_points + n_omitted + n_duplicates
 *      n_valid_points == n_verified + n_mismatch + n_unavailable_target
 *
 * This module does NOT touch the database, the filesystem, or any protected
 * artifact. It contains NO prediction logic — it only consumes predictions
 * that already exist in the sample records passed to it.
 */

// ─── Input / output types ───────────────────────────────────────────────────

/** A chronological OHLCV bar — only the fields the graph needs. */
export type BarDateClose = { date: string; close: number };

/** The subset of a walk-forward sample record that the graph consumes. */
export interface SampleRecord {
  sample_idx: number;
  stock: string;
  /** decision-date epoch milliseconds (UTC). */
  date: number;
  /** decision-session close price (PKR). */
  close: number;
  status: string;
  models?: Record<
    string,
    {
      horizon_preds?: Record<
        string,
        { predicted: number; actual: number; eval_skipped?: boolean }
      >;
    }
  >;
}

/** A VERIFIED chart point — the only kind that enters the comparison series. */
export interface GraphPoint {
  decision_date: string;
  target_date: string;
  decision_close: number;
  predicted_return: number;
  predicted_price: number;
  actual_return: number;
  /** Observed OHLCV close at the target session — the main actual-price series. */
  actual_price: number;
  /** decisionClose × (1 + actualReturn) — validation check vs observed close. */
  calculated_actual_price: number;
  verified_actual_close: number;
  /** predicted_price − actual_price (signed). */
  error: number;
  verification: "verified";
}

/** A diagnostic record — mismatch or unavailable_target. Never charted. */
export interface DiagnosticPoint {
  decision_date: string;
  target_date: string | null;
  decision_close: number | null;
  predicted_price: number | null;
  calculated_actual_price: number | null;
  actual_return: number | null;
  status: "mismatch" | "unavailable_target";
  reason: string;
}

export interface GraphResult {
  n_candidates: number;
  n_valid_points: number;
  n_verified: number;
  n_mismatch: number;
  n_unavailable_target: number;
  n_omitted: number;
  n_duplicates: number;
  /** Verified comparison series ONLY. */
  points: GraphPoint[];
  /** mismatch + unavailable_target diagnostics. */
  diagnostics: DiagnosticPoint[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Absolute (PKR) tolerance for accepting a calculated actual price as matching
 * the observed OHLCV close. The calculated price is decisionClose × (1+r) where
 * r = (close[i+h] − close[i]) / close[i], so mathematically it equals close[i+h]
 * exactly; the tolerance only absorbs IEEE-754 float rounding (~1e-13) and any
 * stored rounding of the close. 0.01 PKR is far above float noise yet tight
 * enough to catch a genuine mismatch (e.g. wrong bar / wrong symbol).
 */
export const VERIFY_TOLERANCE = 0.01;

export const SUPPORTED_MODELS = [
  "XGBoost",
  "LightGBM",
  "CatBoost",
  "Random Forest",
  "Ridge Regression",
] as const;

export const SUPPORTED_HORIZONS = [5, 10, 21] as const;

export const SUPPORTED_PERIODS = ["validation", "final-test"] as const;

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Convert UTC epoch-ms to a tz-stable "YYYY-MM-DD" string (matches DB date). */
export function epochMsToDateStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

/** predictedPrice = decisionClose × (1 + predictedForwardReturn). */
export function computePredictedPrice(
  decisionClose: number,
  predictedReturn: number
): number {
  return decisionClose * (1 + predictedReturn);
}

/** calculated actual price = decisionClose × (1 + actualReturn) — VALIDATION only. */
export function computeCalculatedActualPrice(
  decisionClose: number,
  actualReturn: number
): number {
  return decisionClose * (1 + actualReturn);
}

/** A price is valid iff finite and strictly positive. */
export function isValidPrice(x: unknown): boolean {
  return typeof x === "number" && Number.isFinite(x) && x > 0;
}

/** A return is valid iff finite (returns may be negative or zero). */
export function isValidReturn(x: unknown): boolean {
  return typeof x === "number" && Number.isFinite(x);
}

/**
 * Resolve the target trading-session date + observed close, using SESSION
 * indexing over the per-symbol chronological bar list (NOT calendar days).
 *
 * Mirrors walk_forward_backtesting.py's `ste.iloc[i + horizon]`.
 *
 * Returns { targetDate: null, verifiedActualClose: null } when the decision
 * bar is absent OR when there is no future bar at decisionBarIdx + horizon OR
 * when that bar's close is not a finite number.
 */
export function resolveTargetSession(
  barDates: string[],
  barCloseMap: Map<string, number>,
  decisionDateStr: string,
  horizon: number
):
  | { targetDate: string; verifiedActualClose: number }
  | { targetDate: null; verifiedActualClose: null } {
  const idx = barDates.indexOf(decisionDateStr);
  if (idx < 0) return { targetDate: null, verifiedActualClose: null };
  const targetIdx = idx + horizon;
  if (targetIdx < 0 || targetIdx >= barDates.length) {
    return { targetDate: null, verifiedActualClose: null };
  }
  const targetDate = barDates[targetIdx];
  const close = barCloseMap.get(targetDate);
  if (close == null || !Number.isFinite(close)) {
    return { targetDate: null, verifiedActualClose: null };
  }
  return { targetDate, verifiedActualClose: close };
}

/**
 * Classify a VALID point (one that already passed all structural pre-checks)
 * into verified / mismatch / unavailable_target.
 */
export function classifyValidPoint(
  target:
    | { targetDate: string; verifiedActualClose: number }
    | { targetDate: null; verifiedActualClose: null },
  calculatedActualPrice: number,
  tolerance: number = VERIFY_TOLERANCE
): "verified" | "mismatch" | "unavailable_target" {
  if (target.targetDate === null) return "unavailable_target";
  const diff = Math.abs(calculatedActualPrice - target.verifiedActualClose);
  return diff <= tolerance ? "verified" : "mismatch";
}

/**
 * Derive the period sample-index range from a manifest-like split descriptor.
 * `valEndIdx` is the index of the first final-test sample; validation = [0, valEndIdx),
 * final-test = [valEndIdx, nSamples).
 */
export function periodRangeFor(
  period: "validation" | "final-test",
  valEndIdx: number,
  nSamples: number
): { startIdx: number; endIdx: number } {
  if (period === "validation") return { startIdx: 0, endIdx: valEndIdx };
  return { startIdx: valEndIdx, endIdx: nSamples };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build the verified comparison series + diagnostics from deterministic inputs.
 *
 * @param candidates  Sample records already sliced to the selected period range
 *                     (ALL symbols — the builder filters by `symbol` itself so
 *                     that n_candidates reflects the symbol pool within the
 *                     period).
 * @param symbol       Uppercase PSX ticker to graph.
 * @param model        One of SUPPORTED_MODELS.
 * @param horizon      One of SUPPORTED_HORIZONS.
 * @param bars         Chronological OHLCV bars for `symbol` (date ascending).
 * @param opts.tolerance  Override VERIFY_TOLERANCE (mainly for tests).
 */
export function buildGraphPoints(
  candidates: SampleRecord[],
  symbol: string,
  model: string,
  horizon: number,
  bars: BarDateClose[],
  opts: { tolerance?: number } = {}
): GraphResult {
  const tolerance = opts.tolerance ?? VERIFY_TOLERANCE;
  const sym = symbol.toUpperCase();
  const barDates = bars.map((b) => b.date);
  const barCloseMap = new Map(bars.map((b) => [b.date, b.close]));

  const points: GraphPoint[] = [];
  const diagnostics: DiagnosticPoint[] = [];
  const seen = new Set<string>();

  let nCandidates = 0;
  let nOmitted = 0;
  let nDuplicates = 0;
  let nUnavailable = 0;
  let nMismatch = 0;

  for (const rec of candidates) {
    if (!rec || rec.stock !== sym) continue;
    nCandidates++;

    // ── Structural pre-checks → omitted (with reason) if any fail ────────
    if (rec.status !== "evaluated") {
      nOmitted++;
      continue;
    }
    if (!isValidPrice(rec.close)) {
      nOmitted++;
      continue;
    }
    const modelData = rec.models?.[model];
    if (!modelData) {
      nOmitted++;
      continue;
    }
    const hp = modelData.horizon_preds?.[String(horizon)];
    if (!hp || hp.eval_skipped) {
      nOmitted++;
      continue;
    }
    const predictedReturn = hp.predicted;
    const actualReturn = hp.actual;
    if (!isValidReturn(predictedReturn) || !isValidReturn(actualReturn)) {
      nOmitted++;
      continue;
    }

    const decisionClose = rec.close;
    const decisionDateStr = epochMsToDateStr(rec.date);
    const predictedPrice = computePredictedPrice(decisionClose, predictedReturn);
    const calculatedActualPrice = computeCalculatedActualPrice(
      decisionClose,
      actualReturn
    );

    if (!isValidPrice(predictedPrice) || !isValidPrice(calculatedActualPrice)) {
      nOmitted++;
      continue;
    }

    // ── Dedup by (decision_date, model, horizon) ────────────────────────
    const dedupKey = `${decisionDateStr}|${model}|${horizon}`;
    if (seen.has(dedupKey)) {
      nDuplicates++;
      continue;
    }
    seen.add(dedupKey);

    // ── Target-session resolution + classification ──────────────────────
    const target = resolveTargetSession(
      barDates,
      barCloseMap,
      decisionDateStr,
      horizon
    );
    const cls = classifyValidPoint(target, calculatedActualPrice, tolerance);

    // Narrow the target union by targetDate presence (TS cannot infer this from
    // classifyValidPoint's string return, so we guard explicitly). When a target
    // bar was resolved, targetDate is a string and verifiedActualClose is a
    // finite number; otherwise both are null.
    if (target.targetDate !== null && target.verifiedActualClose !== null) {
      const observed = target.verifiedActualClose;
      if (cls === "verified") {
        points.push({
          decision_date: decisionDateStr,
          target_date: target.targetDate,
          decision_close: decisionClose,
          predicted_return: predictedReturn,
          predicted_price: predictedPrice,
          actual_return: actualReturn,
          actual_price: observed, // OBSERVED OHLCV close — main series
          calculated_actual_price: calculatedActualPrice, // validation only
          verified_actual_close: observed,
          error: predictedPrice - observed,
          verification: "verified",
        });
      } else {
        // cls === "mismatch" — target resolved but calculated ≠ observed
        nMismatch++;
        diagnostics.push({
          decision_date: decisionDateStr,
          target_date: target.targetDate,
          decision_close: decisionClose,
          predicted_price: predictedPrice,
          calculated_actual_price: calculatedActualPrice,
          actual_return: actualReturn,
          status: "mismatch",
          reason: `calculated actual ${calculatedActualPrice.toFixed(4)} vs observed close ${observed.toFixed(4)} (diff > ${tolerance} PKR)`,
        });
      }
    } else {
      // unavailable_target — no decision bar or no future bar at decisionIdx + horizon
      nUnavailable++;
      diagnostics.push({
        decision_date: decisionDateStr,
        target_date: null,
        decision_close: decisionClose,
        predicted_price: predictedPrice,
        calculated_actual_price: calculatedActualPrice,
        actual_return: actualReturn,
        status: "unavailable_target",
        reason:
          "decision bar not found in OHLCV DB or no future bar at decisionIdx + horizon",
      });
    }
  }

  const nVerified = points.length;
  const nValid = nVerified + nMismatch + nUnavailable;

  return {
    n_candidates: nCandidates,
    n_valid_points: nValid,
    n_verified: nVerified,
    n_mismatch: nMismatch,
    n_unavailable_target: nUnavailable,
    n_omitted: nOmitted,
    n_duplicates: nDuplicates,
    points,
    diagnostics,
  };
}
