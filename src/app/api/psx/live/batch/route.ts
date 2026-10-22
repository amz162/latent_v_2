import { NextResponse } from "next/server";
import { getLiveQuote } from "@/lib/latent/liveQuote";

// ─── Issue 15: batched live quote endpoint for portfolio holdings ────────────
// GET /api/psx/live/batch?symbols=PPL,ENGRO,HUBC
// Returns: { prices: { PPL: 118.5, ENGRO: 285.4, ... }, fetchedAt: <ISO> }
//
// Server-side wrapper around `getLiveQuote` (60s in-memory cache per symbol).
// Each per-symbol quote is fetched in parallel via Promise.all; getLiveQuote's
// cache means a refresh within 60s is essentially free. Symbols with no
// fetchable quote are simply omitted from the returned `prices` map (caller
// falls back to MOCK_STOCKS or shows "—").
//
// Used by `usePortfolioLiveQuotes` in src/components/latent/PortfolioTab.tsx
// to render live P&L for open holdings.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolsParam = url.searchParams.get("symbols") || "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({
      prices: {} as Record<string, number>,
      fetchedAt: new Date().toISOString(),
      source: "batch-empty",
    });
  }

  // Dedupe (a user could in theory have duplicate positions on the same
  // symbol — we only need to fetch each symbol once).
  const uniq = Array.from(new Set(symbols));

  // Fetch all live quotes in parallel — getLiveQuote's 60s cache handles
  // deduplication across requests.
  const entries = await Promise.all(
    uniq.map(async (sym) => {
      const price = await getLiveQuote(sym);
      return [sym, price] as const;
    })
  );

  const prices: Record<string, number> = {};
  let resolved = 0;
  for (const [sym, price] of entries) {
    if (typeof price === "number" && price > 0) {
      prices[sym] = price;
      resolved++;
    }
  }

  return NextResponse.json({
    prices,
    fetchedAt: new Date().toISOString(),
    source: "psxdata-api",
    requested: uniq.length,
    resolved,
  });
}
