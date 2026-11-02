/**
 * Task 104 — Phase 3: capital-constrained PKR 100,000 portfolio simulator.
 *
 * Account-level ledger (NOT per-signal independent 100k trades):
 *  - initial/available cash, invested capital, open positions, realized P/L,
 *    unrealized P/L, fees/taxes/slippage, total equity, daily mark-to-market
 *    equity, peak equity, drawdown, exposure, cash utilization.
 * No leverage: cash never negative; whole shares only (fractional shares not
 * supported by instrument rules); no future information; cash reused only
 * after leg exits; exit legs never double-counted.
 *
 * Trades replay through the PRODUCTION engine at the ACTUAL accepted size
 * (simulateStrategy + computeTradeCostsV2): entry timing, SL-first same-candle
 * priority, gap-aware fills, TP1/2/3 handling, trailing steps, scale-out legs,
 * TIME_UP, holding periods and costs are exact production semantics.
 * Same-session ordering: exits processed before entries (conservative — an
 * exit fill never funds an entry that happened earlier in the day).
 *
 * Sizing scenarios (spec Phase 3.2): A equal-allocation max 3/5/10; B fixed
 * fraction 5/10/20/25%; C risk-at-stop 0.5/1/2% with caps max-10 concurrent /
 * max-100% exposure (spec line truncated — documented defaults).
 * Filter none | q70 (frozen shadow rule p>=0.4282 applied ONLY on the
 * validation+final_test partitions where the model is out-of-sample; train
 * trades bypass the filter — disclosed).
 *
 * Slice runs: bun scripts/task104_portfolio_sim.ts --slice 0:15
 */
import * as fs from "fs";
import { PrismaClient } from "@prisma/client";
import { simulateStrategy, type StrategyId, type StrategyBar } from "@/lib/latent/strategy-engine";
import { PSX_USER_SCHEDULE_V2, computeTradeCostsV2 } from "@/lib/latent/trading-costs";

const db = new PrismaClient({ log: ["error"] });
const T104 = "data/backtest_reports/task104";
const TAX: "ATL_15" | "NON_ATL_30" = "ATL_15";
const CAPITAL = 100_000;
const Q70_THR = 0.4282;
const RESULTS = `${T104}/task104_portfolio_results.json`;

const STRATS = ["fixed_first_hit", "max_tp_step_trailing", "scale_out_50_25_25"] as const;
const SIZINGS: Record<string, any> = {
  A_eq3: { kind: "equal", maxConcurrent: 3 }, A_eq5: { kind: "equal", maxConcurrent: 5 },
  A_eq10: { kind: "equal", maxConcurrent: 10 },
  B_5: { kind: "fraction", f: 0.05 }, B_10: { kind: "fraction", f: 0.10 },
  B_20: { kind: "fraction", f: 0.20 }, B_25: { kind: "fraction", f: 0.25 },
  C_r0_5: { kind: "risk", r: 0.005, maxConcurrent: 10 },
  C_r1: { kind: "risk", r: 0.01, maxConcurrent: 10 },
  C_r2: { kind: "risk", r: 0.02, maxConcurrent: 10 },
};
const FILTERS = ["none", "q70"] as const;

function scenarioList() {
  const out: { id: string; strategy: string; sizing: string; filter: string }[] = [];
  for (const s of STRATS) for (const z of Object.keys(SIZINGS)) for (const f of FILTERS)
    out.push({ id: `${s}__${z}__${f}`, strategy: s, sizing: z, filter: f });
  return out;
}

async function main() {
  const t0 = Date.now();
  const recon = JSON.parse(fs.readFileSync(`${T104}/task104_engine_recon.json`, "utf-8")).trades;
  const probs = JSON.parse(fs.readFileSync(`${T104}/task104_probabilities.json`, "utf-8"));
  const pmap = new Map<string, Map<string, { part: string; p: number }>>();
  const thrByStrategy: Record<string, number> = {};
  for (const r of probs.rows) {
    if (!pmap.has(r.strategy)) pmap.set(r.strategy, new Map());
    pmap.get(r.strategy)!.set(r.sample_id, { part: r.partition, p: r.p_cal });
  }
  for (const [s, agg] of Object.entries(probs.per_strategy as Record<string, any>))
    thrByStrategy[s] = agg.thr_q70;

  const barsCache = new Map<string, any[]>();
  async function barsFor(sym: string) {
    if (!barsCache.has(sym)) {
      const rows = await db.ohlcvBar.findMany({
        where: { symbol: sym }, orderBy: { date: "asc" },
        select: { date: true, open: true, high: true, low: true, close: true } });
      barsCache.set(sym, rows as any);
    }
    return barsCache.get(sym)!;
  }
  const closeMap = new Map<string, Map<string, number>>();
  const calRows = await db.ohlcvBar.findMany({
    distinct: ["date"], orderBy: { date: "asc" }, select: { date: true } });
  const calendar: string[] = calRows.map((r) => r.date);
  const calIdx = new Map(calendar.map((d, i) => [d, i]));

  // candidates sorted by entry date then sample order (deterministic)
  const cand = recon.slice().sort((a, b) =>
    a.entry_date === b.entry_date ? (a.sample_id < b.sample_id ? -1 : 1)
      : (a.entry_date < b.entry_date ? -1 : 1));
  const lastExitDate = cand.reduce((m, t) => {
    let best = m;
    for (const s of Object.values(t.strategies) as any[]) {
      if (s.exit_date && s.exit_date > best) best = s.exit_date;
    }
    return best;
  }, cand[0]?.entry_date ?? calendar[0]);
  const lastDay = calendar.findIndex((d) => d >= (lastExitDate > "" ? lastExitDate : calendar[calendar.length - 1]));
  const horizonEnd = lastDay >= 0 ? lastDay : calendar.length - 1;

  const [from, to] = (() => {
    const idx = process.argv.indexOf("--slice");
    const all = scenarioList();
    if (idx < 0 || !process.argv[idx + 1]) return [0, all.length] as [number, number];
    const [i, n] = process.argv[idx + 1].split(":").map(Number);
    return [i * n, Math.min(all.length, (i + 1) * n)] as [number, number];
  })();
  const all = scenarioList();
  const prior = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, "utf-8")) : null;
  const results: any = prior?.results ?? {};

  for (let si = from; si < to; si++) {
    const sc = all[si];
    const sz = SIZINGS[sc.sizing];
    let cash = CAPITAL, peak = CAPITAL, maxDD = 0, minEquity = CAPITAL;
    let invested = 0, fees = 0, taxes = 0, slip = 0, realized = 0;
    let taken = 0, skipFunds = 0, skipSlots = 0, skipFilter = 0, skipTiny = 0;
    let maxConcurrentSeen = 0, expSum = 0, expN = 0, cashUtilSum = 0;
    const open: any[] = [];              // live positions (entry -> all legs done)
    const equityCurve: { d: string; eq: number }[] = [];
    const closedNet: number[] = [];
    const closeFor = async (sym: string, date: string) => {
      if (!closeMap.has(sym)) {
        const bars = await barsFor(sym);
        closeMap.set(sym, new Map(bars.map((b) => [b.date, b.close])));
      }
      const m = closeMap.get(sym)!;
      return m.get(date) ?? NaN;
    };

    // precompute candidate scanBars lazily per symbol/entryIdx
    let ci = 0;
    for (let day = 0; day <= horizonEnd; day++) {
      const d = calendar[day];
      // 1) exits due today (legs with exit_date <= d), then mark
      for (const p of open) {
        if (p.done) continue;
        while (p.pendingLegs.length && p.pendingLegs[0].exit_date <= d) {
          const leg = p.pendingLegs.shift()!;
          const isLast = p.pendingLegs.length === 0;
          cash += leg.quantity * leg.exit_price - (isLast ? p.totalCost : 0);
          invested -= leg.quantity * p.entry_price;
          if (isLast) {
            p.done = true;
            realized += p.netPnl;
            closedNet.push(p.netPnl);
          }
        }
      }
      for (let k = open.length - 1; k >= 0; k--) if (open[k].done) open.splice(k, 1);
      // 2) entries
      while (ci < cand.length && cand[ci].entry_date === d) {
        const t = cand[ci++];
        const rs = t.strategies[sc.strategy];
        if (sc.filter === "q70") {
          const info = pmap.get(sc.strategy)?.get(t.sample_id);
          const thr = thrByStrategy[sc.strategy] ?? Q70_THR;
          if (info && (info.part === "validation" || info.part === "final_test")
              && info.p < thr) { skipFilter++; continue; }
        }
        if (open.length >= (sz.maxConcurrent ?? Infinity)) { skipSlots++; continue; }
        const bars = await barsFor(t.symbol);
        const cutIdx = bars.findIndex((b) => b.date === t.decision_date);
        const entryIdx = cutIdx + 1;
        if (entryIdx <= 0 || entryIdx >= bars.length) continue;
        const equity = cash + invested;
        let alloc = 0;
        if (sz.kind === "equal") alloc = Math.min(cash, equity / sz.maxConcurrent);
        else if (sz.kind === "fraction") alloc = Math.min(cash, equity * sz.f);
        else {
          const slDist = Math.max((t.entry_price - t.sl) / t.entry_price, 1e-9);
          alloc = Math.min(cash, (equity * sz.r) / slDist);
        }
        const qty = Math.floor(alloc / t.entry_price);
        if (qty < 1) { skipTiny++; skipFunds++; continue; }
        const notional = qty * t.entry_price;
        if (notional > cash) { skipFunds++; continue; }
        const scanEnd = Math.min(bars.length, entryIdx + 21);
        const scanBars: StrategyBar[] = bars.slice(entryIdx, scanEnd).map((b) => ({
          date: b.date, open: b.open, high: b.high, low: b.low, close: b.close }));
        const r = simulateStrategy(sc.strategy as StrategyId,
          { symbol: t.symbol, direction: "BUY", entryPrice: t.entry_price, sl: t.sl,
            tp1: t.tp1, tp2: t.tp2, tp3: t.tp3, quantity: qty }, scanBars, PSX_USER_SCHEDULE_V2);
        const legs = r.legs.map((l) => ({ quantity: l.quantity, exitPrice: l.exitPrice }));
        const v2 = computeTradeCostsV2(qty, t.entry_price, legs, r.grossPnl,
                                        PSX_USER_SCHEDULE_V2, TAX);
        cash -= notional;
        invested += notional;
        taken++;
        fees += v2.totalCost - v2.cgt;
        taxes += v2.cgt;
        slip += v2.slippage;
        open.push({ sym: t.symbol, qty, entry_price: t.entry_price, sample: t.sample_id,
          pendingLegs: r.legs.map((l) => ({ exit_date: l.exitDate, quantity: l.quantity,
                                             exit_price: l.exitPrice })),
          totalCost: v2.totalCost, netPnl: v2.netPnl, done: false,
          exit_date: r.legs.length ? r.legs[r.legs.length - 1].exitDate : d });
        maxConcurrentSeen = Math.max(maxConcurrentSeen, open.length);
      }
      // 3) mark-to-market close
      let mtm = cash;
      for (const p of open) {
        let c = await closeFor(p.sym, d);
        if (Number.isNaN(c)) {         // suspended: last known close
          c = p.lastClose ?? p.entry_price;
        } else p.lastClose = c;
        mtm += p.qty * c;
      }
      invested = open.reduce((s, p) => s + p.qty * p.entry_price, 0);
      peak = Math.max(peak, mtm);
      maxDD = Math.min(maxDD, mtm / peak - 1);
      minEquity = Math.min(minEquity, mtm);
      expSum += open.length ? (invested / mtm) : 0; expN++;
      cashUtilSum += invested / CAPITAL;
      if (day % 5 === 0 || day === horizonEnd) equityCurve.push({ d, eq: +mtm.toFixed(2) });
    }
    const finalEquity = cash + invested;
    results[sc.id] = {
      strategy: sc.strategy, sizing: sc.sizing, filter: sc.filter,
      initial_cash: CAPITAL, final_equity: +finalEquity.toFixed(2),
      ending_cash: +cash.toFixed(2), roi_pct: +((finalEquity / CAPITAL - 1) * 100).toFixed(4),
      realized_pnl: +realized.toFixed(2), unrealized_pnl: +(finalEquity - CAPITAL - realized).toFixed(2),
      total_fees_excl_cgt: +fees.toFixed(2), total_cgt: +taxes.toFixed(2), total_slippage: +slip.toFixed(2),
      n_trades_taken: taken, n_wins: closedNet.filter((x) => x > 0).length,
      win_rate_pct: closedNet.length ? +(100 * closedNet.filter((x) => x > 0).length / closedNet.length).toFixed(2) : null,
      n_skipped_filter: skipFilter, n_skipped_slots: skipSlots, n_skipped_funds: skipFunds,
      n_skipped_below_one_share: skipTiny,
      max_concurrent_positions: maxConcurrentSeen,
      avg_exposure_pct: expN ? +((expSum / expN) * 100).toFixed(2) : 0,
      avg_cash_utilization_pct: +((cashUtilSum / (horizonEnd + 1)) * 100).toFixed(2),
      peak_equity: +peak.toFixed(2), min_equity: +minEquity.toFixed(2),
      max_drawdown_pct: +(maxDD * 100).toFixed(2),
      first_entry: cand.length ? cand[0].entry_date : null,
      horizon_end: calendar[horizonEnd],
      equity_curve_5d: equityCurve,
    };
    console.log(`${sc.id}: taken=${taken} final=${finalEquity.toFixed(0)} roi=${((finalEquity / CAPITAL - 1) * 100).toFixed(2)}%`);
  }
  results.__meta = {
    initial_capital: CAPITAL, tax_profile: TAX, cost_profile: "psx_user_schedule_v2",
    engine: "strategy-engine.ts at actual accepted size", q70_threshold: Q70_THR,
    filter_rule: "per-strategy reproduced RF q70 threshold, applied only to validation+final_test partitions; train bypasses (disclosed)",
    scenario_count: all.length, slices_completed: Object.keys(results).filter((k) => k !== "__meta").length,
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(RESULTS, JSON.stringify({ results }, null, 1));
  console.log(`slice ${from}:${to} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
