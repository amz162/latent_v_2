// ============================================================================
// Price Pattern Finder — LLM explanation layer.
//
// The LLM NEVER does math: it receives ONLY the JSON produced by the pure
// statistics engine (price-patterns.ts) and writes layman explanations plus
// notes about anything unusual in the stock's history. It must not invent
// numbers and must not give buy/sell advice. Results are persisted in the
// PricePatternReport table so the LLM is never re-run for the same data.
// ============================================================================

import ZAI from "z-ai-web-dev-sdk";
import type { ChatMessage } from "z-ai-web-dev-sdk";
import type { DetectionResult } from "./price-patterns";

export interface LlmExplanations {
  /** pattern id -> layman explanation */
  patterns: Record<string, string>;
  unusual_notes: string[];
}

const SYSTEM_PROMPT = `You explain statistically detected HISTORICAL price-and-volume patterns on the Pakistan Stock Exchange to a retail investor with no financial background. You are given a JSON of already-computed statistics — your job is only to put them into plain words.

STRICT RULES:
1. Use ONLY the numbers, dates and facts present in the JSON. NEVER invent, estimate, extrapolate or re-round any number. If a number is not in the JSON, do not mention it.
2. NEVER give buy, sell or hold advice or any kind of recommendation. Never say what the stock "will" or "should" do. Write only about the PAST.
3. Do NOT use technical-indicator jargon (no RSI, MACD, moving averages, candlesticks, ATR, support, resistance). Call price levels "price zones" only.
4. When discussing volume-price behaviour, say "buying pressure" or "selling pressure" and make clear it is INFERRED from price and volume — never say buyers or sellers are confirmed.
5. For each pattern write 2-4 short, simple sentences: what the pattern means in everyday words, why it may have happened (hedged language such as "often", "typically", "may reflect"), and what it historically showed. Words a non-finance person understands.
6. Review "unusual_events" too. If anything clearly stands out in the stock's history (a very large one-day move, extreme volume, a long streak, a big gap, etc.), write 1-3 short notes in "unusual_notes" quoting the exact dates and numbers from the JSON. If nothing stands out, return an empty array.
7. Everything is informational only — never frame anything as a reason to act.

Output ONLY valid JSON, no markdown fences:
{"patterns":[{"id":"<id from input>","explanation":"<2-4 simple sentences>"}],"unusual_notes":["<note>"]}
Include an entry for EVERY pattern id in the input.`;

/** Strips advisory sentences if the model slips one in. */
function sanitize(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const bad =
    /(you should (buy|sell|hold|avoid)|we recommend|buy now|sell now|strong (buy|sell)|a (good|great|bad) (time )?(to|for) (buy|sell)|consider (buying|selling)|go long|short (the|this)|act now|don't miss)/i;
  const kept = sentences.filter((s) => !bad.test(s));
  return (kept.length ? kept : sentences).join(" ").trim();
}

function parseJsonFromLlm(raw: string): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try {
        return JSON.parse(fence[1]);
      } catch {
        /* fall through */
      }
    }
    const brace = raw.match(/\{[\s\S]*\}/);
    if (brace) {
      try {
        return JSON.parse(brace[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

/**
 * Generate layman explanations for the detected patterns.
 * Returns null if the LLM call fails (caller stores null and retries nightly).
 */
export async function explainPricePatterns(
  symbol: string,
  company: string,
  detection: DetectionResult
): Promise<LlmExplanations | null> {
  if (!detection.patterns.length) return { patterns: {}, unusual_notes: [] };

  try {
    const payload = {
      stock: `${symbol} (${company})`,
      data_coverage: {
        trading_days: detection.coverage.bars,
        from: detection.coverage.firstDate,
        to: detection.coverage.lastDate,
      },
      patterns: detection.patterns.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        historical_stats: p.description,
        period: p.period,
        sample_size: p.occurrences,
        years_seen: p.years_seen,
        success_rate_pct: p.success_rate,
        avg_move_pct: p.avg_move_pct,
        confidence: p.confidence,
        evidence_dates: p.evidence_dates.slice(0, 6),
        total_evidence_dates: p.evidence_dates.length,
        extra_details: p.details,
      })),
      unusual_events: detection.unusual,
    };

    const userMessage =
      `Explain the following historical price-pattern statistics for this stock. ` +
      `Write one entry per pattern id, plus notes for anything unusual in the history, following the system rules exactly.\n\n` +
      `JSON INPUT:\n${JSON.stringify(payload)}`;

    const zai = await ZAI.create();
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ];
    const completion = await zai.chat.completions.create({
      messages,
      temperature: 0.3,
      max_tokens: 2400,
    });

    const raw: string = completion?.choices?.[0]?.message?.content || "";
    const parsed = parseJsonFromLlm(raw);
    if (!parsed || !Array.isArray(parsed.patterns)) return null;

    const map: Record<string, string> = {};
    for (const entry of parsed.patterns) {
      if (entry && typeof entry.id === "string" && typeof entry.explanation === "string" && entry.explanation.trim()) {
        map[entry.id] = sanitize(entry.explanation);
      }
    }
    const notes: string[] = Array.isArray(parsed.unusual_notes)
      ? parsed.unusual_notes.filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0).map(sanitize)
      : [];

    if (!Object.keys(map).length) return null;
    return { patterns: map, unusual_notes: notes };
  } catch (err) {
    console.error(`[price-pattern-llm] explanation failed for ${symbol}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
