// ============================================================================
// Task 111 / Phase 8 — Point-in-time-safe price-pattern finder.
//
// The existing deterministic engine (price-patterns.ts, used by the live
// Pattern Finder tab) remains the SINGLE source of pattern math. This wrapper
// guarantees the point-in-time rule: given an as-of decision index, it feeds
// the engine ONLY bars up to that index (never future candles), and emits
// structured candidate patterns with explicit confirmation semantics.
// ============================================================================
import { analyzePricePatterns, type EngineBar, type PricePatternAnalysis } from "../price-patterns";

export interface CandidatePattern {
  pattern_name: string;
  pattern_type: string;
  start_date: string;
  end_date: string;
  key_prices: { reference: string; value: number }[];
  occurrences: number;
  avg_move_pct: number;
  success_rate_pct: number;
  confirmation_status: "confirmed_historical" | "unconfirmed_candidate" | "insufficient_history";
  detection_rule: string;
  strength: "low" | "medium" | "high";
  data_quality_state: "verified" | "insufficient_history";
  evidence_dates: string[];
}

export interface PITPatternResult {
  symbol: string;
  as_of_date: string;
  bars_used: number;
  future_bars_excluded: number;
  candidates: CandidatePattern[];
  keyZones: { kind: string; low: number | null; high: number | null; note: string }[];
  insufficient: boolean;
  message?: string;
}

/**
 * Analyze patterns using only bars[0..asOfIndex] (inclusive). The decision at
 * asOfIndex can never see bars after it. Historical manifestations inside the
 * engine's statistics are marked `confirmed_historical`; the LATEST
 * manifestation (possibly still forming at the decision date) is only an
 * `unconfirmed_candidate`.
 */
export function findPricePatternsPIT(symbol: string, bars: EngineBar[], asOfIndex: number): PITPatternResult {
  const sliced = bars.slice(0, Math.max(1, Math.min(asOfIndex + 1, bars.length)));
  const futureExcluded = bars.length - sliced.length;
  const analysis: PricePatternAnalysis = analyzePricePatterns(symbol, sliced);
  const asOfDate = sliced[sliced.length - 1]?.date ?? "";
  const candidates: CandidatePattern[] = analysis.patterns.map((p) => {
    // The engine reports historical manifestation statistics. Anything whose
    // most recent evidence date equals the as-of session is still forming.
    const lastEv = p.evidence_dates[p.evidence_dates.length - 1] ?? "";
    const stillForming = lastEv >= asOfDate;
    return {
      pattern_name: p.title,
      pattern_type: p.type,
      start_date: p.evidence_dates[0] ?? analysis.dataStart,
      end_date: lastEv || analysis.dataEnd,
      key_prices: [{ reference: "avg_move_pct", value: p.avg_move_pct }],
      occurrences: p.occurrences,
      avg_move_pct: p.avg_move_pct,
      success_rate_pct: p.success_rate,
      confirmation_status: analysis.insufficient
        ? "insufficient_history"
        : stillForming
          ? "unconfirmed_candidate"
          : "confirmed_historical",
      detection_rule: `deterministic engine price-patterns.ts (${p.type}) over ${sliced.length} bars ending ${asOfDate}; future bars excluded: ${futureExcluded}`,
      strength: p.confidence,
      data_quality_state: analysis.insufficient ? "insufficient_history" : "verified",
      evidence_dates: p.evidence_dates,
    };
  });
  return {
    symbol,
    as_of_date: asOfDate,
    bars_used: sliced.length,
    future_bars_excluded: futureExcluded,
    candidates,
    keyZones: (analysis.keyZones ?? []).slice(0, 6).map((z) => ({
      kind: String((z as { kind?: string }).kind ?? "zone"),
      low: (z as { low?: number | null }).low ?? null,
      high: (z as { high?: number | null }).high ?? null,
      note: String((z as { note?: string; description?: string }).note ?? (z as { description?: string }).description ?? "").slice(0, 160),
    })),
    insufficient: analysis.insufficient,
    message: analysis.message,
  };
}
