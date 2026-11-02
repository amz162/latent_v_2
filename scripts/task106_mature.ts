/**
 * Task 106 Phase 6 — outcome-maturation pathway (production engine).
 * Reads a pending-entry ledger, fills entries at the first session AFTER the
 * decision date, and matures an observation ONLY when the trade terminal state
 * is genuinely known:
 *   - terminal exit (SL* or TP3) within available bars  -> matured (full net)
 *   - TIME_UP with 21 full sessions available            -> matured (full net)
 *   - fewer than 21 sessions and no terminal exit        -> pending (MTM only)
 * MTM values are UNREALIZED and never counted as wins.
 * Usage: bun scripts/task106_mature.ts <ledger_in.json> <out.json> [fixture_json]
 * Prints one JSON line {n, matured, pending_mtm, unrealized_total}.
 */
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { simulateStrategy } from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2 } from "@/lib/latent/trading-costs";

const db = new PrismaClient({ log: ["error"] });
const [, , ledgerPath, outPath, fixturePath] = process.argv;
const CAPITAL = 100_000;

interface LedgerEntry {
  decision_id: string; symbol: string; decision_date: string;
  levels: { sl: number; tp1: number; tp2: number; tp3: number };
}

async function barsFor(symbol: string): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
  const rows = await db.ohlcvBar.findMany({
    where: { symbol }, orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true } });
  return rows;
}

async function main() {
  const ledger: LedgerEntry[] = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  const out: any[] = [];
  let matured = 0, pending = 0, unfilled = 0;
  let unrealizedTotal = 0, realizedTotal = 0;

  for (const e of ledger) {
    const bars = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, "utf8"))[e.symbol] : await barsFor(e.symbol);
    const idx = bars.findIndex((b) => b.date > e.decision_date);
    if (idx < 0 || idx >= bars.length) {
      out.push({ decision_id: e.decision_id, status: "awaiting_entry_bar", entry: null, outcomes: {} });
      unfilled++; continue;
    }
    const entryBar = bars[idx];
    const scanBars = bars.slice(idx, idx + 21);
    const sessionsAvailable = scanBars.length;
    const entry = entryBar.open;
    const outcomes: any = {};
    let entryUnrealized = 0, entryRealized = 0, allResolved = true;

    for (const strat of ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"] as const) {
      const quantity = Math.max(0, Math.floor(CAPITAL / entry));
      if (quantity === 0) { outcomes[strat] = { status: "no_fill_below_one_share" }; continue; }
      const r = simulateStrategy(strat, {
        symbol: e.symbol, direction: "BUY", entryPrice: entry,
        sl: e.levels.sl, tp1: e.levels.tp1, tp2: e.levels.tp2, tp3: e.levels.tp3,
        quantity }, scanBars, PSX_USER_SCHEDULE_V2);
      const remainingQty = quantity - r.legs.reduce((s, l) => s + l.quantity, 0);
      const terminal = r.exitReason.startsWith("SL") || r.exitReason === "TP3";
      const fullHorizonKnown = sessionsAvailable >= 21;
      if (terminal || fullHorizonKnown) {
        // remaining qty exits at the last close for TIME_UP (engine already did);
        // for early terminal the position is fully closed by definition
        const status = terminal ? "matured_terminal_exit" : "matured_time_up";
        outcomes[strat] = { status, entry, quantity, exit_reason: r.exitReason,
          realized_net_pnl: r.netPnl, net_return_pct: r.netPnl / (entry * quantity) * 100,
          sessions_used: sessionsAvailable, hold: r.nBarsExamined };
        if (terminal) { matured++; entryRealized += r.netPnl; }
        else { matured++; entryRealized += r.netPnl; }
      } else {
        allResolved = false;
        const mtm = remainingQty > 0 ? (scanBars[scanBars.length - 1].close - entry) * remainingQty : 0;
        outcomes[strat] = { status: "pending_mtm", entry, quantity, sessions_available: sessionsAvailable,
          resolved_legs: r.legs.map((l) => ({ exit_date: l.exitDate, price: l.exitPrice, qty: l.quantity, net: l.netPnl })),
          realized_net_pnl: r.legs.reduce((s, l) => s + l.netPnl, 0),
          unrealized_mtm_pkr: Math.round(mtm * 100) / 100,
          note: "unrealized; NEVER counted as a win; matures when sessions 10..21 arrive" };
        pending++; entryUnrealized += mtm + r.legs.reduce((s, l) => s + l.netPnl, 0);
      }
    }
    unrealizedTotal += entryUnrealized; realizedTotal += entryRealized;
    out.push({ decision_id: e.decision_id, symbol: e.symbol, decision_date: e.decision_date,
      entry_date: entryBar.date, entry, status: allResolved ? "matured" : "pending_mtm",
      data_provenance: "db/custom.db (psxdata source, Task 106 refresh)", outcomes,
      maturity_evaluation_date: new Date().toISOString().slice(0, 10) });
  }
  const summary = { n: ledger.length, matured, pending_mtm: pending, unfilled,
    realized_total_pkr: Math.round(realizedTotal * 100) / 100,
    unrealized_total_pkr: Math.round(unrealizedTotal * 100) / 100,
    note: "MTM is hypothetical unrealized value, not evidence of edge" };
  fs.writeFileSync(outPath, JSON.stringify({ generated_at: new Date().toISOString(),
    engine: "production simulateStrategy (strategy-engine.ts)", cost_profile: "psx_user_schedule_v2",
    summary, observations: out }, null, 1));
  console.log(JSON.stringify(summary));
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
