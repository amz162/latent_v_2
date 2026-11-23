import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHistorical } from "@/lib/latent/psxClient";
import { guardAdminOrInternal } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — incremental refresh of ~908 stocks

// GET /api/cron/refresh-ohlcv
// Incremental refresh: for each backed-up symbol, fetch the latest daily bars
// from the psxdata API + append only NEW bars (date > latest in DB). Idempotent
// — re-running only adds new bars, skips up-to-date stocks. Called daily by
// the instrumentation scheduler at 5 PM PKT (after market close).
//
// Task 129 hardening (data-integrity requirements):
//   - every candidate bar passes OHLC envelope / positivity / volume / date
//     validation BEFORE it can be inserted (invalid bars are counted with
//     reasons and NEVER persisted);
//   - an empty provider response is counted as provider_empty, not success;
//   - per-bar insert errors are recorded (previously silently swallowed).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateBar(b: { date: string; open: number; high: number; low: number; close: number; volume: number }): string[] {
  const problems: string[] = [];
  if (!DATE_RE.test(String(b.date))) problems.push("invalid_date_format");
  const { open, high, low, close, volume } = b;
  for (const [k, v] of [["open", open], ["high", high], ["low", low], ["close", close]] as const) {
    if (!Number.isFinite(v) || v <= 0) problems.push(`non_positive_${k}`);
  }
  if (Number.isFinite(high) && Number.isFinite(low) && high < low) problems.push("high_below_low");
  if (
    Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(open) && Number.isFinite(close) &&
    (high < Math.max(open, close) - 1e-9 || low > Math.min(open, close) + 1e-9)
  ) problems.push("ohlc_envelope");
  if (!Number.isFinite(volume) || volume < 0) problems.push("invalid_volume");
  return problems;
}

export async function GET(req: Request) {
  const __task121_gate = await guardAdminOrInternal(req);
  if (__task121_gate) return __task121_gate;

  const start = Date.now();
  const symbols = await db.ohlcvBar.findMany({
    select: { symbol: true },
    distinct: ["symbol"],
  });

  let updated = 0, skipped = 0, providerEmpty = 0, errors = 0, newBars = 0, rejected = 0;
  const rejectionSamples: { symbol: string; date: string; problems: string[] }[] = [];
  const errorSamples: { symbol: string; error: string }[] = [];

  for (const { symbol } of symbols) {
    try {
      const hist = await getHistorical(symbol);
      if (!hist || hist.length === 0) { providerEmpty++; skipped++; continue; }

      // Get the latest date already in the DB for this symbol
      const latest = await db.ohlcvBar.findFirst({
        where: { symbol },
        orderBy: { date: "desc" },
        select: { date: true },
      });

      // Filter to only NEW bars (date > latest in DB, or all if no DB data)
      const newBarsForSym: any[] = latest
        ? hist.filter((b: any) => b.date > latest.date)
        : hist;

      if (newBarsForSym.length === 0) { skipped++; continue; }

      let symUpdated = false;
      for (const raw of newBarsForSym) {
        const b = {
          date: String(raw.date ?? ""),
          open: Number(raw.open), high: Number(raw.high),
          low: Number(raw.low), close: Number(raw.close),
          volume: Number(raw.volume || 0),
        };
        const problems = validateBar(b);
        if (problems.length > 0) {
          rejected++;
          if (rejectionSamples.length < 20) rejectionSamples.push({ symbol, date: b.date, problems });
          continue; // never persist an invalid bar
        }
        try {
          await db.ohlcvBar.upsert({
            where: { symbol_date: { symbol, date: b.date } },
            create: {
              symbol, date: b.date,
              open: b.open, high: b.high, low: b.low, close: b.close,
              volume: b.volume, source: "psxdata",
            },
            update: {}, // don't update existing bars
          });
          newBars++;
          symUpdated = true;
        } catch (e: unknown) {
          errors++;
          if (errorSamples.length < 20) {
            errorSamples.push({ symbol, error: String((e as Error)?.message ?? e).slice(0, 140) });
          }
        }
      }
      if (symUpdated) updated++;
    } catch (e: unknown) {
      errors++;
      if (errorSamples.length < 20) {
        errorSamples.push({ symbol, error: String((e as Error)?.message ?? e).slice(0, 140) });
      }
    }
  }

  const totalBars = await db.ohlcvBar.count();
  return NextResponse.json({
    refreshed: true,
    stocksChecked: symbols.length,
    stocksUpdated: updated,
    stocksSkipped: skipped,
    providerEmptySymbols: providerEmpty, // provider returned no bars — NOT a success signal
    errors,
    errorSamples,
    newBarsAdded: newBars,
    barsRejected: rejected,
    rejectionSamples,
    totalBarsInDB: totalBars,
    latencyMs: Date.now() - start,
  });
}
