import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// pypsx PAPER API (https://paper-api.pypsx.com) — REAL intraday OHLCV candles
// from the exchange's 1-minute candle database (coverage from 2025-10-20).
// Auth: PYPSX-API-KEY-ID + PYPSX-API-SECRET-KEY headers (read from .env).
//
// Intervals: 1m (via GET /intraday/{symbol}), 5m/15m/1h (via
// GET /api/v1/market/historical-intraday?symbol=X&interval=I&from=...&to=...).
// 30m is not a native pypsx interval — mapped to 15m.

const BASE = process.env.PYPSX_API_BASE || "https://paper-api.pypsx.com";

function toEpochMs(date: unknown): number {
  if (typeof date === "number" && !isNaN(date)) return date * (date < 1e12 ? 1000 : 1);
  if (typeof date === "string") {
    const t = Date.parse(date);
    if (!isNaN(t)) return t;
  }
  return NaN;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sym = (url.searchParams.get("symbol") || "").toUpperCase().replace(/XD$/, "");
  const interval = url.searchParams.get("interval") || "5m"; // 1m|5m|15m|30m|1h
  const days = parseInt(url.searchParams.get("days") || "5", 10) || 5;
  if (!sym) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const keyId = process.env.PYPSX_API_KEY_ID;
  const keySecret = process.env.PYPSX_API_SECRET_KEY;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: "pypsx API key not configured", message: "Set PYPSX_API_KEY_ID + PYPSX_API_SECRET_KEY in .env", interval, symbol: sym },
      { status: 401 }
    );
  }
  const headers: Record<string, string> = {
    "PYPSX-API-KEY-ID": keyId,
    "PYPSX-API-SECRET-KEY": keySecret,
    Accept: "application/json",
  };

  // Build the from/to window (PKT = +05:00). Use the last `days` days.
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "+05:00");
  // Shift to PKT for the request window
  const pktOffset = 5 * 3600000;
  const fmtPkt = (d: Date) => {
    const pk = new Date(d.getTime() + pktOffset);
    return pk.toISOString().replace(/\.\d{3}Z$/, "+05:00");
  };
  const fromStr = fmtPkt(from);
  const toStr = fmtPkt(to);

  try {
    // 1m → /intraday/{symbol} (object candles: {timestamp, datetime, open, high, low, close, volume})
    if (interval === "1m") {
      const r = await fetch(`${BASE}/intraday/${encodeURIComponent(sym)}`, {
        headers, signal: AbortSignal.timeout(20000), cache: "no-store",
      });
      if (r.status === 401 || r.status === 403) {
        return NextResponse.json({ error: "pypsx auth failed", symbol: sym, interval }, { status: 401 });
      }
      if (r.ok) {
        const j = await r.json();
        const arr: any[] = Array.isArray(j?.data) ? j.data : [];
        const bars = arr
          .map((d: any) => ({
            date: toEpochMs(d.datetime ?? d.timestamp),
            open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close),
            volume: Number(d.volume || 0),
          }))
          .filter((x) => !isNaN(x.date) && !isNaN(x.close))
          .sort((a, b) => a.date - b.date);
        return NextResponse.json({
          symbol: sym, source: "pypsx (real 1m intraday)", interval, rowsCount: bars.length, ohlcv: bars,
        });
      }
    }

    // 5m/15m/30m/1h → /api/v1/market/historical-intraday (array candles: [datetime, o, h, l, c, v])
    const apiInterval = interval === "30m" ? "15m" : interval; // 30m not native → 15m
    const r = await fetch(
      `${BASE}/api/v1/market/historical-intraday?symbol=${encodeURIComponent(sym)}&interval=${apiInterval}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`,
      { headers, signal: AbortSignal.timeout(20000), cache: "no-store" }
    );
    if (r.status === 401 || r.status === 403) {
      return NextResponse.json({ error: "pypsx auth failed", symbol: sym, interval }, { status: 401 });
    }
    if (r.ok) {
      const j = await r.json();
      const results: any[] = Array.isArray(j?.results) ? j.results : [];
      const candles = results[0]?.candles ?? [];
      const bars = (candles as any[])
        .map((c: any) => ({
          date: toEpochMs(c[0]),
          open: Number(c[1]), high: Number(c[2]), low: Number(c[3]), close: Number(c[4]),
          volume: Number(c[5] || 0),
        }))
        .filter((x) => !isNaN(x.date) && !isNaN(x.close))
        .sort((a, b) => a.date - b.date);
      return NextResponse.json({
        symbol: sym,
        source: `pypsx (real ${apiInterval} intraday${interval === "30m" ? " · 30m→15m" : ""})`,
        interval, rowsCount: bars.length, ohlcv: bars,
        gaps: j?.gaps || [], note: j?.note || null,
      });
    }
    return NextResponse.json(
      { error: `pypsx intraday fetch failed (HTTP ${r.status})`, symbol: sym, interval },
      { status: 502 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "intraday fetch error", symbol: sym, interval }, { status: 502 });
  }
}
