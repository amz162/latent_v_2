// Task 130: company results harvest → DB (stage: company_results).
// Fetches income statements from the askanalyst API for every listed symbol
// that also exists in the OhlcvBar universe, parses annual + quarterly
// periods, and upserts CompanyResult rows keyed (symbol, periodEnd, source).
// Honest behavior: symbols absent from askanalyst's company list or with
// failed fetches are counted and skipped — nothing is fabricated. rawJson
// keeps the full period record for auditability.

import { PrismaClient } from "@prisma/client";

const ASKAANALYST = "https://api.askanalyst.com.pk/api";
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) latent-research-sandbox" };
const RATE_DELAY_MS = 350;

const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

interface PeriodRow { label: string; unit?: string; data: { year: string; value: string }[] }
interface IncomeResponse { annual?: PeriodRow[]; quarter?: PeriodRow[] }

function num(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.replace(/,/g, "").trim();
  if (!s || s === "-") return null;
  const f = parseFloat(s);
  return Number.isNaN(f) ? null : f;
}

function pick(rows: PeriodRow[], ...labels: string[]): PeriodRow | undefined {
  for (const want of labels) {
    const hit = rows.find((r) => r.label.toLowerCase() === want.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

/** "Sep-24" → "2024-09"; annual year "2023" → "FY2023". */
function periodKey(year: string): string {
  const m = year.trim().match(/^([A-Za-z]{3})-(\d{2})$/);
  if (m && MONTHS[m[1]]) return `20${m[2]}-${String(MONTHS[m[1]]).padStart(2, "0")}`;
  const y = year.trim();
  return /^\d{4}$/.test(y) ? `FY${y}` : y.replace(/\s+/g, "-").slice(0, 32);
}

function quarterOf(periodEnd: string): string | null {
  const m = periodEnd.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const q = Math.ceil(parseInt(m[2], 10) / 3); // PSX: Jan-Mar Q1 … Oct-Dec Q4
  return `Q${q}`;
}

async function main() {
  const db = new PrismaClient();
  const runKey = process.env.HARVEST_RUN_KEY ?? "eod_harvest:manual";
  const only = process.argv.includes("--symbols")
    ? process.argv[process.argv.indexOf("--symbols") + 1].split(",").map((s) => s.trim())
    : null;
  const started = new Date();
  const summary: Record<string, unknown> = { runKey, startedAt: started.toISOString() };

  try {
    // universe = askanalyst company list ∩ OhlcvBar symbols (or --symbols)
    let symbols: string[];
    if (only) {
      symbols = only;
    } else {
      const res = await fetch(`${ASKAANALYST}/companylistwithsymbols`, { headers: UA, cache: "no-store" });
      if (!res.ok) throw new Error(`companylistwithsymbols HTTP ${res.status}`);
      const list = (await res.json()) as Record<string, unknown>[];
      const aaSyms = new Set(
        list.map((c) => String(c.symbol ?? c.Symbol ?? c.sym ?? "").trim().toUpperCase()).filter(Boolean),
      );
      const dbRows = await db.ohlcvBar.findMany({ distinct: ["symbol"], select: { symbol: true } });
      const dbSyms = new Set(dbRows.map((r) => r.symbol.toUpperCase()));
      symbols = [...aaSyms].filter((s) => dbSyms.has(s)).sort();
      summary.askanalyst_listed = aaSyms.size;
      summary.db_symbols = dbSyms.size;
    }
    summary.symbols_targeted = symbols.length;

    let inserted = 0, updated = 0, symbolOk = 0, symbolEmpty = 0, symbolFail = 0;
    const failedSymbols: string[] = [];

    for (const sym of symbols) {
      try {
        const res = await fetch(`${ASKAANALYST}/incomestatement/${encodeURIComponent(sym)}`, {
          headers: UA, cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const inc = (await res.json()) as IncomeResponse;
        const sections: { rows: PeriodRow[]; kind: string }[] = [
          { rows: inc.annual ?? [], kind: "annual" },
          { rows: inc.quarter ?? [], kind: "quarter" },
        ];
        let symRows = 0;
        for (const { rows, kind } of sections) {
          if (!rows.length) continue;
          const revenue = pick(rows, "Net sales", "Mark-up/interest revenue"); // bank fallback
          const gross = pick(rows, "Gross profit");
          const op = pick(rows, "Operating profit");
          const net = pick(rows, "Profit after tax a/t company owners", "Profit after tax");
          const eps = pick(rows, "EPS - Basic");
          const unit = revenue?.unit ?? rows[0]?.unit ?? null;
          const periods = revenue?.data ?? rows[0]?.data ?? [];
          for (const p of periods) {
            const periodEnd = periodKey(p.year);
            if (!periodEnd) continue;
            const raw = {
              kind, unit,
              revenue: revenue?.data.find((x) => x.year === p.year) ?? null,
              grossProfit: gross?.data.find((x) => x.year === p.year) ?? null,
              operatingProfit: op?.data.find((x) => x.year === p.year) ?? null,
              netProfit: net?.data.find((x) => x.year === p.year) ?? null,
              eps: eps?.data.find((x) => x.year === p.year) ?? null,
            };
            const data = {
              periodLabel: p.year,
              fiscalYear: kind === "annual" ? p.year : null,
              quarter: kind === "quarter" ? quarterOf(periodEnd) : null,
              revenue: num(revenue?.data.find((x) => x.year === p.year)?.value),
              grossProfit: num(gross?.data.find((x) => x.year === p.year)?.value),
              operatingProfit: num(op?.data.find((x) => x.year === p.year)?.value),
              netProfit: num(net?.data.find((x) => x.year === p.year)?.value),
              eps: num(eps?.data.find((x) => x.year === p.year)?.value),
              rawJson: JSON.stringify(raw),
              fetchedAt: new Date(),
              runKey,
            };
            const existing = await db.companyResult.findFirst({
              where: { symbol: sym, periodEnd, source: "askanalyst" },
              select: { id: true },
            });
            if (existing) {
              await db.companyResult.update({ where: { id: existing.id }, data });
              updated++;
            } else {
              await db.companyResult.create({ data: { symbol: sym, periodEnd, source: "askanalyst", ...data } });
              inserted++;
            }
            symRows++;
          }
        }
        if (symRows > 0) symbolOk++; else symbolEmpty++;
      } catch (e) {
        symbolFail++;
        failedSymbols.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`);
      }
      await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
    }

    summary.companyResults = { inserted, updated, symbolOk, symbolEmpty, symbolFail };
    if (failedSymbols.length) summary.failedSymbols = failedSymbols.slice(0, 20);
    summary.finishedAt = new Date().toISOString();
    summary.ok = symbolFail < Math.max(1, Math.floor(symbols.length / 3)); // majority failure = stage failure
    console.log(JSON.stringify(summary));
    await db.$disconnect();
    process.exit(summary.ok ? 0 : 1);
  } catch (e) {
    summary.ok = false;
    summary.error = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify(summary));
    await db.$disconnect();
    process.exit(1);
  }
}

main();
