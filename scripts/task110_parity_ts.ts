/**
 * Task 110 — parity harness (TS side). Runs the golden-cross engine for fixed
 * symbols/configs and dumps results for comparison against the Python engine.
 * Usage: bun scripts/task110_parity_ts.ts /tmp/task110_parity_ts.json
 */
import { Database } from "bun:sqlite";
import { computeGoldenCross, runGoldenCrossPortfolio, barIsValid } from "../src/lib/latent/golden-cross";

const dbPath = new URL("../db/custom.db", import.meta.url).pathname;
const db = new Database(dbPath, { readonly: true });

const SYMBOLS = ["HUBC", "SYS", "LUCK"];
const CONFIGS = [
  { sizingPct: 0.2, taxProfile: "ATL_15" as const },
  { sizingPct: 0.1, taxProfile: "NON_ATL_30" as const },
];

const cal = db
  .query<{ date: string }, [number]>("SELECT date FROM OhlcvBar GROUP BY date HAVING COUNT(*) >= 10 ORDER BY date")
  .all(10);
const sessions = cal.map((r) => r.date);

const out: Record<string, unknown> = { sessions: sessions.length, symbols: {} };

for (const sym of SYMBOLS) {
  const rows = db
    .query<{ date: string; open: number; high: number; low: number; close: number }, [string]>(
      "SELECT date, open, high, low, close FROM OhlcvBar WHERE symbol=? ORDER BY date"
    )
    .all(sym);
  const bars = rows.map((r) => ({ ...r, valid: barIsValid(r) }));
  const ind = computeGoldenCross(bars);
  const barIndex: Record<string, number> = {};
  bars.forEach((b, k) => {
    if (b.valid) barIndex[b.date] = k;
  });
  const perSymbol: Record<string, unknown> = {
    bars: bars.length,
    lastMa7: ind.ma7[ind.ma7.length - 1],
    lastMa30: ind.ma30[ind.ma30.length - 1],
    lastClose: ind.closes[ind.closes.length - 1],
    goldens: ind.signals.filter((s) => s === "GOLDEN").length,
    deaths: ind.signals.filter((s) => s === "DEATH").length,
  };
  for (const cfg of CONFIGS) {
    const r = runGoldenCrossPortfolio({ [sym]: ind }, sessions, { [sym]: barIndex }, {
      sizingMode: "pct_equity",
      sizingPct: cfg.sizingPct,
      maxPositions: 5,
      initialCapital: 100000,
      taxProfile: cfg.taxProfile,
    });
    perSymbol[`p${cfg.sizingPct}_${cfg.taxProfile}`] = {
      finalEquity: r.account.finalEquity,
      trades: r.account.trades,
      realizedNetPnl: r.account.realizedNetPnl,
      roiPct: r.account.roiPct,
      firstTrade: r.trades[0] ?? null,
      lastTrade: r.trades[r.trades.length - 1] ?? null,
    };
  }
  out.symbols[sym] = perSymbol;
}

const dest = process.argv[2] || "/tmp/task110_parity_ts.json";
await Bun.write(dest, JSON.stringify(out, null, 1));
console.log("wrote", dest);
