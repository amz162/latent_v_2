import { NextResponse } from "next/server";

// Master PSX symbol list — ALL 1000+ listed companies with names + sectors.
// Primary source: pypsx GET /symbols (needs PYPSX_API_KEY_ID/SECRET). Fallback:
// psxdata GET /stocks (1048 symbols, no names) — label = symbol.
// Used by every StockSearch component (Signals, AI Models, Pattern Finder,
// Portfolio, Technical Analysis) so the symbol universe is the full 1000+,
// not a 360-stock subset.
export const dynamic = "force-dynamic";

const PYPSX_BASE = process.env.PYPSX_API_BASE || "https://paper-api.pypsx.com";
const PSXDATA_BASE = "https://psxdata-api.fastapicloud.dev";

interface CacheEntry { value: any; expiresAt: number; }
let cache: CacheEntry | null = null;
const TTL = 6 * 3600_000; // 6 hours — the listed-company set rarely changes

async function fetchPypsxSymbols(): Promise<{ value: string; label: string; sector?: string }[] | null> {
  const keyId = process.env.PYPSX_API_KEY_ID;
  const keySecret = process.env.PYPSX_API_SECRET_KEY;
  if (!keyId || !keySecret) return null;
  try {
    const r = await fetch(`${PYPSX_BASE}/symbols`, {
      headers: { "PYPSX-API-KEY-ID": keyId, "PYPSX-API-SECRET-KEY": keySecret, Accept: "application/json" },
      signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    const arr: any[] = Array.isArray(j?.symbols) ? j.symbols : Array.isArray(j) ? j : [];
    if (!arr.length) return null;
    return arr.map((s: any, i: number) => ({
      id: i + 1,
      value: String(s.symbol || s.value || "").toUpperCase(),
      label: String(s.name || s.label || s.symbol || ""),
      sector: s.sector ?? undefined,
    })).filter((c) => c.value);
  } catch {
    return null;
  }
}

async function fetchPsxdataStocks(): Promise<{ value: string; label: string; sector?: string }[] | null> {
  try {
    const r = await fetch(`${PSXDATA_BASE}/stocks`, {
      headers: { Accept: "application/json", "User-Agent": "LatentBot/1.0" },
      signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    const arr: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
    if (!arr.length) return null;
    return arr.map((s: any, i: number) => ({
      id: i + 1,
      value: String(s).toUpperCase(),
      label: String(s),
    })).filter((c) => c.value);
  } catch {
    return null;
  }
}

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ companies: cache.value, source: cache.value?.[0]?.sector ? "pypsx+psxdata" : "psxdata", cached: true });
  }
  // Merge pypsx /symbols (506 with names+sectors) + psxdata /stocks (1048) so
  // StockSearch shows the FULL 1000+ universe — pypsx for the names, psxdata
  // to top up the rest (label = symbol where no name is available).
  const [pypsx, psxdata] = await Promise.all([fetchPypsxSymbols(), fetchPsxdataStocks()]);
  let source = "psxdata";
  const byValue = new Map<string, { id: number; value: string; label: string; sector?: string }>();
  let id = 1;
  if (pypsx) { source = "pypsx+psxdata"; for (const c of pypsx) { if (!byValue.has(c.value)) byValue.set(c.value, { id: id++, ...c }); } }
  if (psxdata) { for (const c of psxdata) { if (!byValue.has(c.value)) byValue.set(c.value, { id: id++, value: c.value, label: c.value }); } }
  let companies = Array.from(byValue.values());
  if (!companies.length) {
    return NextResponse.json({ error: "Failed to fetch symbol list" }, { status: 502 });
  }
  cache = { value: companies, expiresAt: Date.now() + TTL };
  return NextResponse.json({ companies, source, count: companies.length, cached: false });
}
