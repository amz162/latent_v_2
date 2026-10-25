/**
 * psxdata API client — minimal version for production build.
 * Fetches from https://psxdata-api.fastapicloud.dev with caching.
 */

const BASE_URL = "https://psxdata-api.fastapicloud.dev";

const cache = new Map<string, { value: any; expiresAt: number }>();

async function fetchJson(path: string, timeoutMs: number = 15000): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Accept": "application/json", "User-Agent": "LatentBot/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch { return null; }
}

export interface PsxQuote {
  symbol: string; price: number; market_cap: number | null;
  pe_ratio: number | null; dividend_yield: number | null;
  free_float: number | null; volume_avg_30d: number | null;
  change_1y_pct: number | null; ldcp: number | null;
  change: number | null; change_pct: number | null;
}

export async function getQuote(symbol: string): Promise<PsxQuote | null> {
  const data = await fetchJson(`/stocks/${encodeURIComponent(symbol.toUpperCase())}/quote`);
  if (!data || typeof data.price !== "number") return null;
  if (typeof data.symbol === "string" && data.symbol.toUpperCase().endsWith("XD"))
    data.symbol = data.symbol.slice(0, -2);
  return data;
}

export async function getHistorical(symbol: string): Promise<any[] | null> {
  const data = await fetchJson(`/stocks/${encodeURIComponent(symbol.toUpperCase())}/historical`, 30000);
  return Array.isArray(data) ? data : null;
}

export async function getAllStocks(): Promise<string[]> {
  const data = await fetchJson(`/stocks`);
  return Array.isArray(data) ? data : [];
}

export async function getSectors(): Promise<any[]> {
  const data = await fetchJson(`/sectors`);
  return Array.isArray(data) ? data : [];
}

export async function getSectorStocks(sectorName: string): Promise<string[]> {
  const data = await fetchJson(`/sectors/${encodeURIComponent(sectorName)}/stocks`);
  return Array.isArray(data) ? data : [];
}

export async function getIndices(): Promise<string[]> {
  const data = await fetchJson(`/indices`);
  return Array.isArray(data) ? data : [];
}

export async function getIndexConstituents(indexName: string): Promise<any[]> {
  const data = await fetchJson(`/indices/${encodeURIComponent(indexName)}`);
  return Array.isArray(data) ? data : [];
}

export async function getScreener(): Promise<any[]> {
  const data = await fetchJson(`/screener`, 30000);
  return Array.isArray(data) ? data : [];
}

export async function getFundamentals(symbol: string): Promise<any[] | null> {
  const data = await fetchJson(`/stocks/${encodeURIComponent(symbol.toUpperCase())}/fundamentals`);
  return Array.isArray(data) ? data : null;
}

export async function getHealth(): Promise<{ status: string } | null> {
  const data = await fetchJson(`/health`, 5000);
  return data && typeof data.status === "string" ? data : null;
}

// ─── Symbol → sector map (real PSX taxonomy) ─────────────────────────────
// Issue: "is the category mentioned or you know show that category in
// graph. if you don't identify the category then put that in others."
//
// pypsx (which carries per-symbol sector) needs API keys that aren't
// configured in this env, so /api/psx/companies falls back to the psxdata
// symbol list — which has NO sector field. Without this map every stock
// landed in "Others" in the Tracker donut.
//
// This function fetches all 38 PSX sectors, then for each sector fetches
// its constituent stocks (parallelised), and builds { SYMBOL: sectorName }.
// Cached for 6 hours — the sector taxonomy rarely changes. A stock that
// appears in NO sector (rare: newly listed, PSM/CDC oddities) is simply
// absent from the map → callers fall back to "Others" for it.
let symbolSectorCache: { value: Record<string, string>; expiresAt: number } | null = null;
const SYMBOL_SECTOR_TTL = 6 * 3600_000;

export async function getSymbolSectorMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (symbolSectorCache && symbolSectorCache.expiresAt > now) {
    return symbolSectorCache.value;
  }
  const sectors = await getSectors();
  if (!sectors.length) return symbolSectorCache?.value ?? {};
  // Fan out the per-sector stock lists in parallel. 38 concurrent fetches
  // is light for a one-shot 6-hour-cached build.
  const sectorStockLists = await Promise.all(
    sectors.map(async (s) => {
      const name = s?.sector_name || s?.name || s?.sector;
      if (!name) return null;
      const stocks = await getSectorStocks(String(name));
      return { name: String(name), stocks };
    })
  );
  const map: Record<string, string> = {};
  for (const entry of sectorStockLists) {
    if (!entry) continue;
    for (const sym of entry.stocks) {
      if (typeof sym === "string" && sym) {
        map[sym.toUpperCase()] = entry.name;
      }
    }
  }
  symbolSectorCache = { value: map, expiresAt: now + SYMBOL_SECTOR_TTL };
  return map;
}
