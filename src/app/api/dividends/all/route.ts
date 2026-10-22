import { NextResponse } from "next/server";
import { getScreener } from "@/lib/latent/psxdata";
import { cacheGetJSON, cacheSetJSON } from "@/lib/latent/cache";

// GET /api/dividends/all
// Bulk source of the LATEST dividend per share for ALL PSX-listed stocks
// that currently pay a dividend (~196 of 750 stocks). Combines:
//   * psxdata screener (one bulk call → symbol, price, dividend_yield)
//     → derive amount_per_share = price × dividend_yield / 100
//   * askanalyst.com.pk companylistwithsymbols → company names
//   * askanalyst.com.pk incomestatement (bounded-concurrency top-K enrichment)
//     → latest DPS quarter's periodEnd as ex-date / announcement-date proxy
// Cached in-memory (Redis-compatible) for 1 hour to avoid re-hitting the
// upstream APIs on every page load.
//
// Response shape:
// {
//   dividends: [{
//     symbol, company, amount, yieldPct, exDate, sector, source
//   }, ...],
//   count, fetchedAt, cached
// }

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const revalidate = 600;

const CACHE_KEY = "dividends:all:v1";
const CACHE_TTL = 3600; // 1 hour
const TOP_K_ENRICH = 40; // how many highest-yielders to enrich with ex-date
const ENRICH_CONCURRENCY = 6;

interface DividendRow {
  symbol: string;
  company: string;
  amount: number;       // PKR per share (derived)
  yieldPct: number;     // % per share
  exDate: string | null; // ISO date (latest DPS period end) — sort key for "Latest"
  sector: string | null;
  source: "screener" | "screener+financials";
}

interface ScreenerStock {
  symbol: string;
  sector: number | null;
  listed_in: string;
  market_cap: number | null;
  price: number;
  pe_ratio: number | null;
  dividend_yield: number;
  free_float: number | null;
  volume_avg_30d: number | null;
  change_1y_pct: number | null;
}

interface CompanyInfo {
  symbol: string;
  name: string;
  sector?: string;
}

// ---- helpers ---------------------------------------------------------------

// Fetch the master company list (askanalyst.com.pk) → symbol → company name.
async function fetchCompanies(): Promise<Map<string, CompanyInfo>> {
  try {
    const res = await fetch(
      "https://api.askanalyst.com.pk/api/companylistwithsymbols",
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      }
    );
    if (!res.ok) return new Map();
    const arr = (await res.json()) as any[];
    const m = new Map<string, CompanyInfo>();
    for (const c of arr || []) {
      const sym = String(c.symbol || c.value || "").toUpperCase().trim();
      if (!sym) continue;
      m.set(sym, {
        symbol: sym,
        name: String(c.label || c.name || sym),
        sector: c.sector,
      });
    }
    return m;
  } catch {
    return new Map();
  }
}

// Convert askanalyst incomestatement period labels ("Mar-09", "Jun-2023",
// "2023", ISO "YYYY-MM-DD") into an ISO date string usable as a sort key.
function periodToISO(periodStr: string): string | null {
  const p = String(periodStr || "").trim();
  if (!p) return null;
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  // Pure year → fiscal-year end (Pakistan standard = June 30)
  if (/^\d{4}$/.test(p)) return `${p}-06-30`;
  // "Mon-YY" → end-of-month ISO date
  const months: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  const m = p.match(/^([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const mon = months[m[1]];
    if (mon) {
      let yr = parseInt(m[2], 10);
      if (m[2].length === 2) yr = yr > 50 ? 1900 + yr : 2000 + yr;
      return `${yr}-${String(mon).padStart(2, "0")}-30`;
    }
  }
  return null;
}

// Fetch a stock's latest DPS quarter's period end via askanalyst
// incomestatement endpoint. Returns the ISO date of the latest quarter where
// DPS > 0. Used as ex-date / announcement-date proxy.
async function fetchLatestDpsDate(
  symbol: string
): Promise<{ dps: number; periodEnd: string } | null> {
  try {
    const r = await fetch(
      `https://api.askanalyst.com.pk/api/incomestatement/${encodeURIComponent(symbol)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      }
    );
    if (!r.ok) return null;
    const data = (await r.json()) as any;
    const quarter = data?.quarter;
    if (!Array.isArray(quarter)) return null;
    // Find DPS row
    const dpsRow = quarter.find((row: any) => {
      const lbl = String(row?.label || "").toLowerCase();
      return lbl.includes("dps") || lbl.includes("dividend per share");
    });
    if (!dpsRow || !Array.isArray(dpsRow.data)) return null;
    // Iterate from the end (latest first); first non-zero DPS wins.
    for (let i = dpsRow.data.length - 1; i >= 0; i--) {
      const cell = dpsRow.data[i];
      const n = parseFloat(String(cell?.value ?? "").replace(/,/g, ""));
      if (!isNaN(n) && n > 0) {
        const periodStr = String(cell?.year || cell?.period || "");
        const iso = periodToISO(periodStr);
        if (iso) return { dps: n, periodEnd: iso };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Run an async mapper over an array with bounded concurrency.
async function mapBounded<T, R>(
  items: T[],
  fn: (x: T, idx: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        try {
          results[idx] = await fn(items[idx], idx);
        } catch {
          // leave undefined → caller must null-check
          results[idx] = undefined as unknown as R;
        }
      }
    }
  );
  await Promise.all(workers);
  return results;
}

// ---- route handler ---------------------------------------------------------

export async function GET() {
  try {
    // 1. In-memory cache (1h)
    const cached = await cacheGetJSON<{
      dividends: DividendRow[];
      count: number;
      fetchedAt: string;
    }>(CACHE_KEY);
    if (cached && cached.dividends?.length) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // 2. Bulk screener fetch (one call → ALL ~750 stocks with price + yield)
    const stocks = await getScreener();
    if (!stocks || stocks.length === 0) {
      return NextResponse.json(
        { error: "Screener returned no data" },
        { status: 502 }
      );
    }

    // 3. Filter to dividend payers (yield > 0 AND a parseable price > 0)
    const payers = (stocks as ScreenerStock[]).filter(
      (s) =>
        typeof s.dividend_yield === "number" &&
        s.dividend_yield > 0 &&
        typeof s.price === "number" &&
        s.price > 0
    );
    if (payers.length === 0) {
      return NextResponse.json(
        { error: "No dividend-paying stocks found in screener" },
        { status: 502 }
      );
    }

    // 4. Company names (so the UI can show a human-readable label)
    const companiesMap = await fetchCompanies();

    // 5. Build the base list of all dividend-paying stocks
    const rows: DividendRow[] = payers.map((s) => {
      const sym = String(s.symbol || "").toUpperCase();
      const info = companiesMap.get(sym);
      const yieldPct = s.dividend_yield;
      const amount = +((s.price * yieldPct) / 100).toFixed(2);
      return {
        symbol: sym,
        company: info?.name || sym,
        amount,
        yieldPct: +yieldPct.toFixed(2),
        exDate: null,
        sector: info?.sector || null,
        source: "screener",
      };
    });

    // 6. Enrich top-K highest-yielders with the latest DPS announcement date
    // (bounded-concurrency so we stay well under the 30s route max-duration).
    const topK = [...rows]
      .sort((a, b) => b.yieldPct - a.yieldPct)
      .slice(0, TOP_K_ENRICH);
    const enriched = await mapBounded(
      topK,
      async (r) => {
        const e = await fetchLatestDpsDate(r.symbol);
        return { symbol: r.symbol, e };
      },
      ENRICH_CONCURRENCY
    );
    for (const item of enriched) {
      if (!item?.e?.periodEnd) continue;
      const row = rows.find((rr) => rr.symbol === item.symbol);
      if (row) {
        row.exDate = item.e.periodEnd;
        row.source = "screener+financials";
      }
    }

    const result = {
      dividends: rows,
      count: rows.length,
      fetchedAt: new Date().toISOString(),
      source: "psxdata screener + askanalyst incomestatement (top-K ex-date enrichment)",
    };

    await cacheSetJSON(CACHE_KEY, result, CACHE_TTL);
    return NextResponse.json({ ...result, cached: false });
  } catch (err: any) {
    console.error("[/api/dividends/all] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch dividends" },
      { status: 502 }
    );
  }
}
