/**
 * liveQuote — batch live PSX quote fetcher for the signal engine.
 *
 * Source: https://psxdata-api.fastapicloud.dev/stocks/{sym}/quote
 * (the same upstream used by /api/psx/live). Each per-symbol quote is cached
 * in-memory for 60s so a 280-stock batch doesn't hammer the upstream.
 *
 * Used by /api/signals/all to overlay LIVE prices on the ensemble-consensus
 * signals (issues 2, 3, 14) and to evaluate whether each signal has hit
 * TP1/TP2/TP3 or SL against the current live price (issue 14).
 */

const BASE_URL = "https://psxdata-api.fastapicloud.dev";
const QUOTE_TTL_MS = 60_000; // 60s per-quote cache
const PER_REQ_TIMEOUT_MS = 5_000;

interface QuoteCacheEntry { value: number | null; expiresAt: number; }
const quoteCache = new Map<string, QuoteCacheEntry>();

export async function getLiveQuote(symbol: string): Promise<number | null> {
  const sym = symbol.toUpperCase().replace(/XD$/, "");
  const now = Date.now();
  const hit = quoteCache.get(sym);
  if (hit && hit.expiresAt > now) return hit.value;

  let value: number | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_REQ_TIMEOUT_MS);
    const res = await fetch(`${BASE_URL}/stocks/${encodeURIComponent(sym)}/quote`, {
      headers: { "User-Agent": "LatentBot/1.0", Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      const d = j?.data ?? j;
      if (d && typeof d.price === "number" && d.price > 0) value = d.price;
    }
  } catch {
    value = null;
  }
  quoteCache.set(sym, { value, expiresAt: now + QUOTE_TTL_MS });
  return value;
}

/**
 * Batch-fetch live quotes for many symbols with bounded concurrency.
 * Returns a Map<symbol, price>. Failed/missing quotes are omitted.
 */
export async function batchGetLiveQuotes(
  symbols: string[],
  concurrency = 25
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const uniq = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  let idx = 0;
  async function worker() {
    while (idx < uniq.length) {
      const cur = uniq[idx++];
      const p = await getLiveQuote(cur);
      if (p != null) out.set(cur, p);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, uniq.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

// ─── Signal outcome evaluation (issue 14: TP1/TP2/TP3-tier hit or SL hit) ────
export type SignalOutcome =
  | "TP3_HIT"
  | "TP2_HIT"
  | "TP1_HIT"
  | "SL_HIT"
  | "ACTIVE";

export interface OutcomeInput {
  signal: "BUY" | "SELL";
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  livePrice: number;
}

/**
 * TP rule (per user issue 14):
 *   BUY  : price ≥ TP3 → TP3 ; TP2 ≤ price < TP3 → TP2 ; TP1 ≤ price < TP2 → TP1 ;
 *          price ≤ SL → SL_HIT ; else ACTIVE.
 *   SELL : mirror — price ≤ TP3 → TP3 ; TP3 < price ≤ TP2 → TP2 ; TP2 < price ≤ TP1 → TP1 ;
 *          price ≥ SL → SL_HIT ; else ACTIVE.
 */
export function evaluateOutcome(o: OutcomeInput): { outcome: SignalOutcome; pnlPct: number } {
  const { signal, entry, sl, tp1, tp2, tp3, livePrice } = o;
  if (!entry || !livePrice) return { outcome: "ACTIVE", pnlPct: 0 };

  const dir = signal === "BUY" ? 1 : -1;
  // Live P&L (unrealized move vs entry — used only for ACTIVE signals).
  const livePnlPct = ((livePrice - entry) / entry) * 100 * dir;

  let outcome: SignalOutcome = "ACTIVE";
  let exitPrice = livePrice; // the price the trade would have closed at
  if (signal === "BUY") {
    if (livePrice >= tp3) { outcome = "TP3_HIT"; exitPrice = tp3; }
    else if (livePrice >= tp2) { outcome = "TP2_HIT"; exitPrice = tp2; }
    else if (livePrice >= tp1) { outcome = "TP1_HIT"; exitPrice = tp1; }
    if (livePrice <= sl) { outcome = "SL_HIT"; exitPrice = sl; }
  } else {
    // SELL / SHORT — TPs are below entry, SL above
    if (livePrice <= tp3) { outcome = "TP3_HIT"; exitPrice = tp3; }
    else if (livePrice <= tp2) { outcome = "TP2_HIT"; exitPrice = tp2; }
    else if (livePrice <= tp1) { outcome = "TP1_HIT"; exitPrice = tp1; }
    if (livePrice >= sl) { outcome = "SL_HIT"; exitPrice = sl; }
  }
  // Outcome-based P&L: the REALIZED move to the outcome level. TP hits → the
  // TP gain (positive); SL hits → ALWAYS the SL-distance LOSS (forced negative
  // — even for malformed signals where sl is on the wrong side of entry, SL
  // is still a loss by definition); ACTIVE → the unrealized live move. Fixes
  // the "SL 0.00%" / "SL positive" cases (the user spec: "when sl it must be
  // negative due to sl").
  const rawOutcomePct = ((exitPrice - entry) / entry) * 100 * dir;
  const pnlPct = outcome === "ACTIVE" ? livePnlPct : outcome === "SL_HIT" ? -Math.abs(rawOutcomePct) : rawOutcomePct;
  return { outcome, pnlPct };
}
