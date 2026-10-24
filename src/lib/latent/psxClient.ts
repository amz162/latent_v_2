/**
 * psxClient — consolidated client for the FREE psxdata REST API
 * (https://psxdata-api.fastapicloud.dev). No API key required.
 *
 * This is the single source of truth for: all symbols, KSE-100 constituents,
 * sectors, daily historical OHLCV, live quotes, and the screener (live board).
 *
 * Live/ticker data is ALWAYS fetched from this API at request time (cached
 * briefly). A one-time backup of daily history is stored in the OhlcvBar table
 * (for the backtest engine to run on ALL stocks locally).
 *
 * Docs: https://psxdata.mintlify.app/
 */

const BASE_URL = "https://psxdata-api.fastapicloud.dev";

// ─── tiny in-memory cache ────────────────────────────────────────────────────
interface CacheEntry<T> { value: T; expiresAt: number; }
const cache = new Map<string, CacheEntry<any>>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

async function fetchJson(path: string, timeoutMs = 15000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "LatentBot/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json; // psxdata wraps arrays in { data: [...] }
  } catch {
    return null;
  }
}

// ─── Public types ────────────────────────────────────────────────────────────
export interface PsxQuote {
  symbol: string; price: number; market_cap: number | null;
  pe_ratio: number | null; dividend_yield: number | null;
  free_float: number | null; volume_avg_30d: number | null;
  change_1y_pct: number | null; ldcp: number | null;
  change: number | null; change_pct: number | null;
}

export interface PsxOhlcvBar {
  date: string;       // YYYY-MM-DD
  open: number; high: number; low: number; close: number;
  volume: number; is_anomaly?: boolean;
}

export interface PsxIndexConstituent {
  symbol: string; current_index: number; idx_weight: number;
  idx_point: number; market_cap_m: number; freefloat_m: number; shares_m: number | null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** All ~1048 PSX symbols (stocks, TFCs, sukuk, etc.). Cached 1h. */
export async function listSymbols(): Promise<string[]> {
  return cached("symbols", 3600_000, async () => {
    const d = await fetchJson(`/stocks`);
    return Array.isArray(d) ? d.filter((s: any) => typeof s === "string") : [];
  });
}

/** KSE-100 (or other index) constituents with weights. Cached 1h. */
export async function getIndexConstituents(index = "KSE100"): Promise<PsxIndexConstituent[]> {
  return cached(`index:${index}`, 3600_000, async () => {
    const d = await fetchJson(`/indices/${encodeURIComponent(index)}`);
    return Array.isArray(d) ? (d as PsxIndexConstituent[]) : [];
  });
}

/** Sector list. Cached 1h. */
export async function getSectors(): Promise<any[]> {
  return cached("sectors", 3600_000, async () => {
    const d = await fetchJson(`/sectors`);
    return Array.isArray(d) ? d : [];
  });
}

/** Screener = live board for all stocks (price, P/E, yield, etc.). Cached 60s. */
export async function getScreener(): Promise<PsxQuote[]> {
  return cached("screener", 60_000, async () => {
    const d = await fetchJson(`/screener`, 30000);
    return Array.isArray(d) ? (d as PsxQuote[]) : [];
  });
}

/** Live quote for one symbol. Cached 60s (matches the upstream 15-min board). */
export async function getQuote(symbol: string): Promise<PsxQuote | null> {
  const sym = symbol.toUpperCase().replace(/XD$/, "");
  return cached(`quote:${sym}`, 60_000, async () => {
    const d = await fetchJson(`/stocks/${encodeURIComponent(sym)}/quote`);
    if (!d || typeof d.price !== "number") return null;
    if (typeof d.symbol === "string" && d.symbol.toUpperCase().endsWith("XD")) d.symbol = d.symbol.slice(0, -2);
    return d as PsxQuote;
  });
}

/**
 * Daily historical OHLCV for a symbol. `start`/`end` are YYYY-MM-DD.
 * Cached 10 min (history doesn't change intraday beyond the latest bar).
 */
export async function getHistorical(
  symbol: string,
  start?: string,
  end?: string,
): Promise<PsxOhlcvBar[]> {
  const sym = symbol.toUpperCase().replace(/XD$/, "");
  const q = start ? `?start=${start}${end ? `&end=${end}` : ""}` : "";
  return cached(`hist:${sym}:${start || ""}:${end || ""}`, 600_000, async () => {
    const d = await fetchJson(`/stocks/${encodeURIComponent(sym)}/historical${q}`, 30000);
    return Array.isArray(d) ? (d as PsxOhlcvBar[]) : [];
  });
}

/** Fundamentals for a symbol. Cached 1h. */
export async function getFundamentals(symbol: string): Promise<any[] | null> {
  const sym = symbol.toUpperCase().replace(/XD$/, "");
  return cached(`fund:${sym}`, 3600_000, async () => {
    const d = await fetchJson(`/stocks/${encodeURIComponent(sym)}/fundamentals`);
    return Array.isArray(d) ? d : null;
  });
}

export const PSXDATA_BASE_URL = BASE_URL;
