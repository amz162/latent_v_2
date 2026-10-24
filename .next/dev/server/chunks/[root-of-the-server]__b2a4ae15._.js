module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: [
        'query'
    ]
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[project]/src/lib/latent/backtest.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runBacktest",
    ()=>runBacktest
]);
/**
 * backtest.ts — trade-by-trade simulation engine for the Latent.pk backtest.
 *
 * Issue 1 (AI Models Portfolio Simulation) spec:
 *  - BUY signals only (no SELL) — caller filters.
 *  - EXACTLY numTrades trades per ensemble (not less, not more). If the ensemble
 *    has fewer BUY signals, sample WITH REPLACEMENT to reach numTrades.
 *  - TP rule: check TP3 first, then TP2, then TP1. Hold for TP3 (the max target)
 *    or SL or time-up. Best TP = the highest TP reached before exit.
 *    • price >= tp3 → Best TP = TP3 (exit at TP3, win)
 *    • tp2 <= price < tp3 → Best TP = TP2 (label only; keep holding for TP3)
 *    • tp1 <= price < tp2 → Best TP = TP1 (label only)
 *    • SL hit (price <= sl) before TP3 → exit at SL (loss); Best TP = highest reached
 *    • else time-up → exit at last close; Best TP = highest reached
 *  - Per-trade: #, Symbol, Signal, Entry, Close, SL, Best TP, TP1, TP2, TP3,
 *    Invested, Result (✓W/✗L), P&L, Portfolio (running equity).
 *  - Per-ensemble metrics: Starting Capital, Amount Per Trade, Total Trades
 *    (BUY only) + natural count, Days (+trades/day), Win Rate, Win/Loss,
 *    Avg Win %, Avg Loss %, Gross Profit, Gross Loss, Total Costs (50bps+CGT),
 *    Gross Before Costs, Net P&L, Final Portfolio Value, ROI, Max Drawdown
 *    (PKR + %), Profit Factor, Sharpe/Sortino. All currency in PKR.
 *
 * Used by issue 1 (ensembles — each ensemble's OWN signals) and issue 2
 * (investment-simulator — final-consensus signals, BUY+SELL).
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
const COMMISSION_RATE = 0.0015;
const SLIPPAGE_RATE = 0.005;
const CGT_RATE = 0.15;
function atr(highs, lows, closes, period = 14) {
    if (closes.length < period + 1) {
        const ranges = highs.map((h, i)=>h - lows[i]).filter((x)=>x >= 0);
        return ranges.length ? ranges.reduce((s, v)=>s + v, 0) / ranges.length : 0;
    }
    const trs = [];
    for(let i = 1; i < closes.length; i++){
        trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    const slice = trs.slice(-period);
    return slice.reduce((s, v)=>s + v, 0) / slice.length;
}
function simulateOne(symbol, direction, bars, _startIdx, numDays, levels) {
    if (bars.length < numDays + 5) return null;
    // METHODOLOGY (Issue 6 fix): the signal's entry/SL/TP are ABSOLUTE levels
    // (relative to the price at signal generation). To test them meaningfully,
    // we find a historical bar where close ≈ the signal's entry level (a real
    // moment price was at that level) and walk forward from THERE with the
    // ensemble's absolute SL/TP. This is why the prior version showed ~36%
    // (random entry bar + absolute levels = levels never reached). Now the
    // entry matches the price path, so SL/TP are meaningful.
    const entry = levels?.entry && levels.entry > 0 ? levels.entry : null;
    let entryIdx;
    let entryPrice;
    let sl, tp1, tp2, tp3;
    if (entry) {
        const band = entry * 0.015; // ±1.5% of the signal's entry level
        const candidates = [];
        for(let i = 2; i < bars.length - numDays - 2; i++){
            if (Math.abs(bars[i].close - entry) <= band) candidates.push(i);
        }
        if (candidates.length === 0) {
            // Pattern #2 (per user): fall back to a random bar + re-derive SL/TP from
            // the ensemble's RELATIVE distances (sl_dist = |entry−sl|, tp_dist) applied
            // to that bar's close — so a BUY ensemble with no real entry bar (price
            // never visited the signal's level) STILL takes trades. Each BUY ensemble
            // runs exactly numTrades trades on the selected stock.
            const maxStart = bars.length - numDays - 2;
            if (maxStart < 2) return null;
            entryIdx = 2 + Math.floor(Math.random() * (maxStart - 1));
            entryPrice = bars[entryIdx].close;
            const atrSliceF = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
            const atrValF = atr(atrSliceF.map((b)=>b.high), atrSliceF.map((b)=>b.low), atrSliceF.map((b)=>b.close)) || entryPrice * 0.02;
            const slDist = levels.sl && levels.sl > 0 ? Math.abs(entry - levels.sl) : atrValF * 1.5;
            const tp1Dist = levels.tp1 && levels.tp1 > 0 ? Math.abs(levels.tp1 - entry) : atrValF;
            const tp2Dist = levels.tp2 && levels.tp2 > 0 ? Math.abs(levels.tp2 - entry) : 2 * atrValF;
            const tp3Dist = levels.tp3 && levels.tp3 > 0 ? Math.abs(levels.tp3 - entry) : 3 * atrValF;
            sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
            tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
            tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
            tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;
        } else {
            entryIdx = candidates[Math.floor(Math.random() * candidates.length)];
            entryPrice = entry;
            // ATR at entry (only used to fill any missing SL/TP)
            const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
            const atrVal = atr(atrSlice.map((b)=>b.high), atrSlice.map((b)=>b.low), atrSlice.map((b)=>b.close)) || entry * 0.02;
            const r = atrVal * 1.5;
            sl = levels.sl && levels.sl > 0 ? levels.sl : direction === "BUY" ? entry - r : entry + r;
            tp1 = levels.tp1 && levels.tp1 > 0 ? levels.tp1 : direction === "BUY" ? entry + 1 * atrVal : entry - 1 * atrVal;
            tp2 = levels.tp2 && levels.tp2 > 0 ? levels.tp2 : direction === "BUY" ? entry + 2 * atrVal : entry - 2 * atrVal;
            tp3 = levels.tp3 && levels.tp3 > 0 ? levels.tp3 : direction === "BUY" ? entry + 3 * atrVal : entry - 3 * atrVal;
        }
    } else {
        // No entry level provided — random start + ATR-derived levels (fallback)
        const maxStart = bars.length - numDays - 2;
        if (maxStart < 2) return null;
        entryIdx = 2 + Math.floor(Math.random() * (maxStart - 1));
        entryPrice = bars[entryIdx].close;
        const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
        const atrVal = atr(atrSlice.map((b)=>b.high), atrSlice.map((b)=>b.low), atrSlice.map((b)=>b.close)) || entryPrice * 0.02;
        const r = atrVal * 1.5;
        sl = direction === "BUY" ? entryPrice - r : entryPrice + r;
        tp1 = direction === "BUY" ? entryPrice + 1 * atrVal : entryPrice - 1 * atrVal;
        tp2 = direction === "BUY" ? entryPrice + 2 * atrVal : entryPrice - 2 * atrVal;
        tp3 = direction === "BUY" ? entryPrice + 3 * atrVal : entryPrice - 3 * atrVal;
    }
    const entryBar = bars[entryIdx];
    const end = Math.min(bars.length - 1, entryIdx + numDays);
    // TP rule (check TP3 → TP2 → TP1): scan the hold window. Exit at TP3 (best)
    // if reached; else SL if hit; else time-up. Best TP = highest reached up to exit.
    let tp3Idx = -1, tp2Idx = -1, tp1Idx = -1, slIdx = -1;
    for(let i = entryIdx + 1; i <= end; i++){
        const b = bars[i];
        if (direction === "BUY") {
            if (tp3Idx < 0 && b.high >= tp3) tp3Idx = i;
            if (tp2Idx < 0 && b.high >= tp2) tp2Idx = i;
            if (tp1Idx < 0 && b.high >= tp1) tp1Idx = i;
            if (slIdx < 0 && b.low <= sl) slIdx = i;
        } else {
            if (tp3Idx < 0 && b.low <= tp3) tp3Idx = i;
            if (tp2Idx < 0 && b.low <= tp2) tp2Idx = i;
            if (tp1Idx < 0 && b.low <= tp1) tp1Idx = i;
            if (slIdx < 0 && b.high >= sl) slIdx = i;
        }
    }
    // TP rule (Issue 2): check TP3 → TP2 → TP1 → SL → time. Exit at the HIGHEST
    // TP reached (TP3 if any bar hit it, else TP2, else TP1), at the first bar
    // where that TP was hit. If NO TP reached, exit at SL (if hit); else time-up.
    // "If price goes down (SL touched) then price goes up again → re-apply the TP
    // rule" → a TP reached at ANY point takes precedence over an SL touch
    // (checked in priority order TP3 > TP2 > TP1 before SL).
    let exitIdx, exitPrice, exitReason;
    if (tp3Idx >= 0) {
        exitIdx = tp3Idx;
        exitPrice = tp3;
        exitReason = "TP3";
    } else if (tp2Idx >= 0) {
        exitIdx = tp2Idx;
        exitPrice = tp2;
        exitReason = "TP2";
    } else if (tp1Idx >= 0) {
        exitIdx = tp1Idx;
        exitPrice = tp1;
        exitReason = "TP1";
    } else if (slIdx >= 0) {
        exitIdx = slIdx;
        exitPrice = sl;
        exitReason = "SL";
    } else {
        exitIdx = end;
        exitPrice = bars[end].close;
        exitReason = "TIME";
    }
    // Best TP = the exit TP (for TP exits) or the highest TP reached up to the
    // SL/time exit bar (label only); null if no TP was ever reached.
    let bestTp = null;
    if (exitReason === "TP3" || exitReason === "TP2" || exitReason === "TP1") {
        bestTp = exitReason;
    } else {
        if (tp3Idx >= 0 && tp3Idx <= exitIdx) bestTp = "TP3";
        else if (tp2Idx >= 0 && tp2Idx <= exitIdx) bestTp = "TP2";
        else if (tp1Idx >= 0 && tp1Idx <= exitIdx) bestTp = "TP1";
    }
    const exitDate = bars[exitIdx].date;
    const holdingDays = Math.max(1, Math.round((Date.parse(exitDate) - Date.parse(entryBar.date)) / 86400000));
    const grossPnlPct = direction === "BUY" ? (exitPrice - entryPrice) / entryPrice * 100 : (entryPrice - exitPrice) / entryPrice * 100;
    return {
        symbol,
        direction,
        entryDate: entryBar.date,
        entryPrice,
        exitDate,
        exitPrice,
        exitReason,
        bestTp,
        sl,
        tp1,
        tp2,
        tp3,
        holdingDays,
        grossPnlPct,
        netPnlPkr: 0,
        costPkr: 0,
        invested: 0,
        portfolio: 0,
        confidence: levels?.confidence ?? 0
    };
}
function aggregate(trades, startingCapital, amountPerTrade, numDays, monthlySip, periodUnit, sipTotal, naturalBuyCount) {
    let equity = startingCapital + sipTotal;
    let peak = equity;
    let grossProfit = 0, grossLoss = 0, wins = 0, losses = 0, totalCosts = 0;
    const winAmounts = [], lossAmounts = [], retSeries = [];
    let maxDdPkr = 0;
    for(let i = 0; i < trades.length; i++){
        const t = trades[i];
        const grossPnl = t.grossPnlPct / 100 * amountPerTrade;
        const commission = amountPerTrade * COMMISSION_RATE * 2;
        const slippage = amountPerTrade * SLIPPAGE_RATE;
        const cgt = grossPnl > 0 ? grossPnl * CGT_RATE : 0;
        const cost = commission + slippage + cgt;
        const netPnl = grossPnl - cost;
        t.costPkr = cost;
        t.netPnlPkr = netPnl;
        t.invested = amountPerTrade;
        equity += netPnl;
        t.portfolio = equity;
        if (equity > peak) peak = equity;
        const ddPkr = peak - equity;
        if (ddPkr > maxDdPkr) maxDdPkr = ddPkr;
        // Win/loss by NET P&L (consistent with isWin) — fixes the glitch where a
        // trade with a tiny gross gain but net loss (after costs) was counted as a
        // win in winRate but shown as a loss in the trade-by-trade view.
        if (netPnl > 0) {
            wins++;
            winAmounts.push(netPnl);
        } else {
            losses++;
            lossAmounts.push(netPnl);
        }
        // Gross profit/loss still use the GROSS P&L (before costs).
        if (grossPnl > 0) grossProfit += grossPnl;
        else grossLoss += Math.abs(grossPnl);
        totalCosts += cost;
        retSeries.push(netPnl / amountPerTrade);
    }
    const grossBeforeCosts = grossProfit - grossLoss;
    const netPnl = grossBeforeCosts - totalCosts;
    const finalPortfolioValue = startingCapital + sipTotal + netPnl;
    const roi = startingCapital > 0 ? netPnl / startingCapital * 100 : 0;
    // Max drawdown % (relative to peak)
    let maxDdPct = 0;
    let p2 = startingCapital + sipTotal;
    let runEquity = p2;
    for (const t of trades){
        runEquity += t.netPnlPkr;
        if (runEquity > p2) p2 = runEquity;
        const dd = p2 > 0 ? (p2 - runEquity) / p2 * 100 : 0;
        if (dd > maxDdPct) maxDdPct = dd;
    }
    const avgWin = winAmounts.length ? winAmounts.reduce((s, v)=>s + v, 0) / winAmounts.length : 0;
    const avgLoss = lossAmounts.length ? lossAmounts.reduce((s, v)=>s + v, 0) / lossAmounts.length : 0;
    const mean = retSeries.length ? retSeries.reduce((s, v)=>s + v, 0) / retSeries.length : 0;
    const std = retSeries.length > 1 ? Math.sqrt(retSeries.reduce((s, v)=>s + (v - mean) ** 2, 0) / (retSeries.length - 1)) : 0;
    const downside = retSeries.filter((v)=>v < 0);
    const dstd = downside.length > 1 ? Math.sqrt(downside.reduce((s, v)=>s + v * v, 0) / downside.length) : 0;
    return {
        startingCapital,
        amountPerTrade,
        totalTrades: trades.length,
        naturalBuyCount,
        numDays,
        tradesPerDay: numDays > 0 ? Math.round(trades.length / numDays) : trades.length,
        winTrades: wins,
        lossTrades: losses,
        winRate: trades.length ? wins / trades.length * 100 : 0,
        avgWinPct: amountPerTrade > 0 ? avgWin / amountPerTrade * 100 : 0,
        avgLossPct: amountPerTrade > 0 ? avgLoss / amountPerTrade * 100 : 0,
        grossProfit,
        grossLoss,
        totalCosts,
        grossBeforeCosts,
        netPnl,
        finalPortfolioValue,
        roi,
        maxDrawdownPct: maxDdPct,
        maxDrawdownPkr: maxDdPkr,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
        sharpe: std > 0 ? mean / std * Math.sqrt(252) : 0,
        sortino: dstd > 0 ? mean / dstd * Math.sqrt(252) : 0,
        monthlySip,
        periodUnit
    };
}
// Single-stock window trade: enter at a given bar within a numDays-day window
// [W, W+numDays], use the signal's RELATIVE distances (sl_dist, tp_dist) applied
// to that bar's close (#2 pattern), hold until TP3/TP2/TP1/SL or the window end.
// This matches the user's reinterpretation: numDays = the period over which
// numTrades trades are taken (e.g. 10 trades in 5 days), NOT the per-trade hold.
function simulateWindowTrade(symbol, direction, bars, entryIdx, windowEndIdx1, levels) {
    if (entryIdx < 0 || entryIdx >= bars.length || windowEndIdx1 >= bars.length) return null;
    const entryBar = bars[entryIdx];
    const entryPrice = entryBar.close; // #2 pattern: enter at the bar's close
    const atrSlice = bars.slice(Math.max(0, entryIdx - 13), entryIdx + 1);
    const atrVal = atr(atrSlice.map((b)=>b.high), atrSlice.map((b)=>b.low), atrSlice.map((b)=>b.close)) || entryPrice * 0.02;
    const sigEntry = levels.entry && levels.entry > 0 ? levels.entry : entryPrice;
    const slDist = levels.sl && levels.sl > 0 ? Math.abs(sigEntry - levels.sl) : atrVal * 1.5;
    const tp1Dist = levels.tp1 && levels.tp1 > 0 ? Math.abs(levels.tp1 - sigEntry) : atrVal;
    const tp2Dist = levels.tp2 && levels.tp2 > 0 ? Math.abs(levels.tp2 - sigEntry) : 2 * atrVal;
    const tp3Dist = levels.tp3 && levels.tp3 > 0 ? Math.abs(levels.tp3 - sigEntry) : 3 * atrVal;
    const sl = direction === "BUY" ? entryPrice - slDist : entryPrice + slDist;
    const tp1 = direction === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
    const tp2 = direction === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
    const tp3 = direction === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;
    const end = Math.min(bars.length - 1, windowEndIdx1);
    let tp3Idx = -1, tp2Idx = -1, tp1Idx = -1, slIdx = -1;
    for(let i = entryIdx + 1; i <= end; i++){
        const b = bars[i];
        if (direction === "BUY") {
            if (tp3Idx < 0 && b.high >= tp3) tp3Idx = i;
            if (tp2Idx < 0 && b.high >= tp2) tp2Idx = i;
            if (tp1Idx < 0 && b.high >= tp1) tp1Idx = i;
            if (slIdx < 0 && b.low <= sl) slIdx = i;
        } else {
            if (tp3Idx < 0 && b.low <= tp3) tp3Idx = i;
            if (tp2Idx < 0 && b.low <= tp2) tp2Idx = i;
            if (tp1Idx < 0 && b.low <= tp1) tp1Idx = i;
            if (slIdx < 0 && b.high >= sl) slIdx = i;
        }
    }
    let exitIdx, exitPrice, exitReason;
    if (tp3Idx >= 0) {
        exitIdx = tp3Idx;
        exitPrice = tp3;
        exitReason = "TP3";
    } else if (tp2Idx >= 0) {
        exitIdx = tp2Idx;
        exitPrice = tp2;
        exitReason = "TP2";
    } else if (tp1Idx >= 0) {
        exitIdx = tp1Idx;
        exitPrice = tp1;
        exitReason = "TP1";
    } else if (slIdx >= 0) {
        exitIdx = slIdx;
        exitPrice = sl;
        exitReason = "SL";
    } else {
        exitIdx = end;
        exitPrice = bars[end].close;
        exitReason = "TIME";
    }
    let bestTp = null;
    if ([
        "TP3",
        "TP2",
        "TP1"
    ].includes(exitReason)) bestTp = exitReason;
    else {
        if (tp3Idx >= 0 && tp3Idx <= exitIdx) bestTp = "TP3";
        else if (tp2Idx >= 0 && tp2Idx <= exitIdx) bestTp = "TP2";
        else if (tp1Idx >= 0 && tp1Idx <= exitIdx) bestTp = "TP1";
    }
    const exitDate = bars[exitIdx].date;
    const holdingDays = Math.max(1, Math.round((Date.parse(exitDate) - Date.parse(entryBar.date)) / 86400000));
    const grossPnlPct = direction === "BUY" ? (exitPrice - entryPrice) / entryPrice * 100 : (entryPrice - exitPrice) / entryPrice * 100;
    return {
        symbol,
        direction,
        entryDate: entryBar.date,
        entryPrice,
        exitDate,
        exitPrice,
        exitReason,
        bestTp,
        sl,
        tp1,
        tp2,
        tp3,
        holdingDays,
        grossPnlPct,
        netPnlPkr: 0,
        costPkr: 0,
        invested: 0,
        portfolio: 0,
        confidence: levels?.confidence ?? 0
    };
}
async function runBacktest(input) {
    const { startingCapital, amountPerTrade, numTrades, numDays, signals, monthlySip = 0, periodUnit = "day", naturalCount } = input;
    const naturalBuyCount = naturalCount ?? signals.length;
    const trades = [];
    const singleStock = signals.length > 0 && signals.every((s)=>s.symbol === signals[0].symbol);
    if (singleStock) {
        // ── Single-stock REAL-history mode ──
        // numDays > 0 → window = the LAST numDays real bars (= [today − numDays, today],
        //   e.g. 5 days → 18–23 Oct). numTrades trades at REAL bars within this window.
        // numDays == 0 (optional, not given) → pick any start day, scan to the latest bar.
        // Each trade enters at the bar's REAL close + uses the ensemble's SL/TP
        // distances (re-derived), holds until TP3/TP2/TP1/SL or the window end.
        const sig = signals[0];
        try {
            const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
                where: {
                    symbol: sig.symbol
                },
                orderBy: {
                    date: "asc"
                }
            });
            if (rows.length >= 10) {
                const bars = rows.map((r)=>({
                        date: r.date,
                        open: r.open,
                        high: r.high,
                        low: r.low,
                        close: r.close
                    }));
                const lastIdx = bars.length - 1; // the latest bar (≈ "today" / live day)
                let windowStart, windowEnd;
                if (numDays > 0) {
                    // REAL recent window: last numDays bars = [today − numDays, today]
                    windowEnd = lastIdx;
                    windowStart = Math.max(2, lastIdx - numDays + 1);
                } else {
                    // numDays not given → any start day, scan to the latest bar
                    windowEnd = lastIdx;
                    windowStart = 2 + Math.floor(Math.random() * Math.max(1, lastIdx - 10));
                }
                const levels = {
                    entry: sig.entry,
                    sl: sig.sl,
                    tp1: sig.tp1,
                    tp2: sig.tp2,
                    tp3: sig.tp3,
                    confidence: sig.confidence
                };
                const span = Math.max(1, windowEnd - windowStart + 1);
                for(let i = 0; i < numTrades; i++){
                    // random REAL bar within [windowStart, windowEnd] (with replacement → exactly numTrades)
                    const entryIdx = windowStart + Math.floor(Math.random() * span);
                    const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, windowEnd, levels);
                    if (t) trades.push(t);
                }
            }
        } catch  {}
    } else {
        // ── ALL-stocks mode: windowed real-history simulation ──
        // Issue 42: trades are executed ONLY within the user's time period.
        // If numDays = 63 (3 months), the window = [today − 63 trading days, today]
        // in CALENDAR dates. Each trade enters at a REAL bar whose DATE falls
        // within this calendar window. Stocks with stale data (latest bar is
        // months/years old) are skipped — only stocks with recent bars trade.
        let picks;
        if (signals.length >= numTrades) {
            const shuffled = [
                ...signals
            ].sort(()=>Math.random() - 0.5);
            picks = shuffled.slice(0, numTrades);
        } else if (signals.length > 0) {
            picks = Array.from({
                length: numTrades
            }, ()=>signals[Math.floor(Math.random() * signals.length)]);
        } else {
            picks = [];
        }
        // Compute the calendar date window: [today − numDays × 1.5, today].
        // 1.5 = approx conversion from trading days to calendar days (weekends +
        // holidays). For numDays = 63 (3 months), this gives ~94 calendar days.
        const todayMs = Date.now();
        const calendarWindowMs = numDays > 0 ? numDays * 1.5 * 86400000 : 0;
        const windowStartMs = todayMs - calendarWindowMs;
        let idx = 0;
        async function worker() {
            while(idx < picks.length){
                const sig = picks[idx++];
                try {
                    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
                        where: {
                            symbol: sig.symbol
                        },
                        orderBy: {
                            date: "asc"
                        }
                    });
                    if (rows.length < 10) continue;
                    const bars = rows.map((r)=>({
                            date: r.date,
                            open: r.open,
                            high: r.high,
                            low: r.low,
                            close: r.close
                        }));
                    // Issue 42: filter bars to only those within the calendar window.
                    // This ensures the trade's entry DATE is within the user's time period.
                    let windowBars;
                    let windowEndIdx1;
                    if (numDays > 0) {
                        windowBars = bars.filter((b)=>{
                            const barMs = Date.parse(b.date);
                            return barMs >= windowStartMs && barMs <= todayMs;
                        });
                        if (windowBars.length < 3) continue; // skip stocks with too few bars in the window
                        // Map windowBars indices back to the full bars array for simulateWindowTrade.
                        // Find the start + end indices in the original bars array.
                        const firstWindowDate = windowBars[0].date;
                        const lastWindowDate = windowBars[windowBars.length - 1].date;
                        windowEndIdx1 = bars.findIndex((b)=>b.date === lastWindowDate);
                        const windowStartIdx = bars.findIndex((b)=>b.date === firstWindowDate);
                        if (windowStartIdx < 0 || windowEndIdx1 < 0) continue;
                        const span = Math.max(1, windowEndIdx1 - windowStartIdx + 1);
                        const entryIdx = windowStartIdx + Math.floor(Math.random() * span);
                        const levels = {
                            entry: sig.entry,
                            sl: sig.sl,
                            tp1: sig.tp1,
                            tp2: sig.tp2,
                            tp3: sig.tp3,
                            confidence: sig.confidence
                        };
                        const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, windowEndIdx1, levels);
                        if (t) trades.push(t);
                    } else {
                        // numDays = 0 → any start (full history)
                        const lastIdx = bars.length - 1;
                        const entryIdx = 2 + Math.floor(Math.random() * Math.max(1, lastIdx - 2));
                        const levels = {
                            entry: sig.entry,
                            sl: sig.sl,
                            tp1: sig.tp1,
                            tp2: sig.tp2,
                            tp3: sig.tp3,
                            confidence: sig.confidence
                        };
                        const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, lastIdx, levels);
                        if (t) trades.push(t);
                    }
                } catch  {}
            }
        }
        await Promise.all(Array.from({
            length: 6
        }, ()=>worker()));
        // Fallback: if we don't have enough trades yet, pick more signals.
        while(trades.length < numTrades && signals.length > 0){
            const sig = signals[Math.floor(Math.random() * signals.length)];
            try {
                const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
                    where: {
                        symbol: sig.symbol
                    },
                    orderBy: {
                        date: "asc"
                    }
                });
                if (rows.length < 10) continue;
                const bars = rows.map((r)=>({
                        date: r.date,
                        open: r.open,
                        high: r.high,
                        low: r.low,
                        close: r.close
                    }));
                if (numDays > 0) {
                    const windowBars = bars.filter((b)=>{
                        const barMs = Date.parse(b.date);
                        return barMs >= windowStartMs && barMs <= todayMs;
                    });
                    if (windowBars.length < 3) continue;
                    const firstWindowDate = windowBars[0].date;
                    const lastWindowDate = windowBars[windowBars.length - 1].date;
                    windowEndIdx = bars.findIndex((b)=>b.date === lastWindowDate);
                    const windowStartIdx = bars.findIndex((b)=>b.date === firstWindowDate);
                    if (windowStartIdx < 0 || windowEndIdx < 0) continue;
                    const span = Math.max(1, windowEndIdx - windowStartIdx + 1);
                    const entryIdx = windowStartIdx + Math.floor(Math.random() * span);
                    const levels = {
                        entry: sig.entry,
                        sl: sig.sl,
                        tp1: sig.tp1,
                        tp2: sig.tp2,
                        tp3: sig.tp3,
                        confidence: sig.confidence
                    };
                    const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, windowEndIdx, levels);
                    if (t) trades.push(t);
                } else {
                    const lastIdx = bars.length - 1;
                    const entryIdx = 2 + Math.floor(Math.random() * Math.max(1, lastIdx - 2));
                    const levels = {
                        entry: sig.entry,
                        sl: sig.sl,
                        tp1: sig.tp1,
                        tp2: sig.tp2,
                        tp3: sig.tp3,
                        confidence: sig.confidence
                    };
                    const t = simulateWindowTrade(sig.symbol, sig.signal, bars, entryIdx, lastIdx, levels);
                    if (t) trades.push(t);
                }
            } catch  {}
            if (trades.length >= numTrades) break;
        }
    }
    let sipTotal = 0;
    if (monthlySip > 0) {
        const months = Math.max(1, Math.round(numDays / 21));
        sipTotal = monthlySip * months;
    }
    const metrics = aggregate(trades, startingCapital, amountPerTrade, numDays, monthlySip, periodUnit, sipTotal, naturalBuyCount);
    const equityCurve = trades.map((t, i)=>({
            trade: i + 1,
            equity: t.portfolio
        }));
    return {
        trades,
        metrics,
        equityCurve,
        generatedAt: new Date().toISOString()
    };
}
}),
"[project]/src/app/api/backtest/investment-simulator/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic,
    "maxDuration",
    ()=>maxDuration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$backtest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/backtest.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
const maxDuration = 120; // Issue 43: increased from 30 to 120 — the date-based window filtering (Issue 42) makes the simulation take longer
const UNIT_DAYS = {
    day: 1,
    month: 21,
    year: 252
};
function toEpochMs(date) {
    const t = Date.parse(date);
    return isNaN(t) ? 0 : t;
}
async function GET(req) {
    const url = new URL(req.url);
    const capital = parseFloat(url.searchParams.get("capital") || "100000") || 100000;
    const periodValue = parseInt(url.searchParams.get("periodValue") || "3", 10) || 3;
    const periodUnit = url.searchParams.get("periodUnit") || "month";
    const monthlySip = parseFloat(url.searchParams.get("monthlySip") || "0") || 0;
    // Issue 40: numTrades + minConfidence now user-configurable (was hardcoded
    // to 40 trades + no confidence filter). The user wants to control how many
    // trades to take + filter signals by minimum confidence score.
    const numTradesRaw = parseInt(url.searchParams.get("numTrades") || "40", 10);
    const numTrades = Math.min(500, Math.max(1, Number.isFinite(numTradesRaw) ? numTradesRaw : 40));
    const minConfidence = Math.min(100, Math.max(0, parseInt(url.searchParams.get("minConfidence") || "0", 10) || 0));
    // Issue 41: trade direction filter — "all" (default), "buy" (BUY only),
    // "sell" (SELL only). Lets the user simulate only BUY or only SELL signals.
    const tradeDirection = url.searchParams.get("tradeDirection") || "all";
    const numDays = periodValue * (UNIT_DAYS[periodUnit] || 21);
    const numMonths = periodUnit === "month" ? periodValue : periodUnit === "year" ? periodValue * 12 : Math.max(1, Math.round(numDays / 21));
    const totalSipContribution = monthlySip * numMonths;
    const totalCapital = capital + totalSipContribution;
    const amountPerTrade = totalCapital / 10; // 10 concurrent positions worth
    const seed = Date.now();
    // Load final-consensus signals (all ~284 stocks)
    let signals = [];
    try {
        const r = await fetch("http://127.0.0.1:3000/api/signals/all", {
            cache: "no-store"
        });
        if (r.ok) {
            const j = await r.json();
            signals = (j.signals || []).map((s)=>({
                    symbol: s.symbol,
                    signal: s.signal,
                    confidence: s.confidence
                }));
        }
    } catch  {}
    // Issue 40: filter by minimum confidence (user-configurable). Caps
    // confidence at 100 defensively (Issue 40 fix in ensemble.ts).
    signals = signals.filter((s)=>typeof s.confidence === "number" && s.confidence >= minConfidence);
    // Issue 41: filter by trade direction (all/buy/sell).
    if (tradeDirection === "buy") {
        signals = signals.filter((s)=>s.signal === "BUY");
    } else if (tradeDirection === "sell") {
        signals = signals.filter((s)=>s.signal === "SELL");
    }
    // Filter to backed-up symbols (have DB history)
    let numSignalsAvailable = signals.length;
    try {
        const backed = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
            select: {
                symbol: true
            },
            distinct: [
                "symbol"
            ]
        });
        const set = new Set(backed.map((b)=>b.symbol));
        const filtered = signals.filter((s)=>set.has(s.symbol));
        if (filtered.length > 0) {
            signals = filtered;
            numSignalsAvailable = signals.length;
        }
    } catch  {}
    if (signals.length === 0) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: `No signals available with confidence ≥ ${minConfidence}`
        }, {
            status: 503
        });
    }
    // Seeded shuffle (deterministic per seed, random not alphabetical)
    let s = seed;
    const rng = ()=>{
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
    const shuffled = [
        ...signals
    ].sort(()=>rng() - 0.5);
    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$backtest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runBacktest"])({
        startingCapital: capital,
        amountPerTrade,
        numTrades: Math.min(numTrades, shuffled.length),
        numDays,
        monthlySip,
        periodUnit,
        signals: shuffled
    });
    // Map to the UI's SimResponse schema
    const trades = result.trades.map((t, i)=>{
        const reasonMap = {
            TP3: "TP3_HIT",
            TP2: "TP2_HIT",
            TP1: "TP1_HIT",
            SL: "SL_HIT",
            TIME: "TIME_UP",
            NO_DATA: "TIME_UP"
        };
        const shares = t.entryPrice > 0 ? amountPerTrade / t.entryPrice : 0;
        const netPnl = t.netPnlPkr;
        const netPnlPct = amountPerTrade > 0 ? netPnl / amountPerTrade * 100 : 0;
        return {
            tradeNo: i + 1,
            symbol: t.symbol,
            side: t.direction,
            direction: t.direction === "BUY" ? "LONG" : "SHORT",
            entryDate: toEpochMs(t.entryDate),
            entryPrice: t.entryPrice,
            exitDate: t.exitDate ? toEpochMs(t.exitDate) : 0,
            exitPrice: t.exitPrice ?? 0,
            exitReason: reasonMap[t.exitReason] || "TIME_UP",
            sl: t.sl,
            tp1: t.tp1,
            tp2: t.tp2,
            tp3: t.tp3,
            shares,
            notional: amountPerTrade,
            netPnl,
            netPnlPct,
            isWin: netPnl > 0
        };
    });
    const m = result.metrics;
    const metrics = {
        startingCapital: m.startingCapital,
        amountPerTrade: m.amountPerTrade,
        totalTrades: m.totalTrades,
        numDays: m.days,
        winTrades: m.winTrades,
        lossTrades: m.lossTrades,
        winRate: m.winRate,
        avgWinPct: m.amountPerTrade > 0 ? m.avgWinPkr / m.amountPerTrade * 100 : 0,
        avgLossPct: m.amountPerTrade > 0 ? m.avgLossPkr / m.amountPerTrade * 100 : 0,
        grossProfit: m.grossProfit,
        grossLoss: m.grossLoss,
        totalCosts: m.totalCosts,
        grossBeforeCosts: m.grossBeforeCosts,
        netPnL: m.netPnl,
        finalValue: m.finalPortfolioValue,
        roiPct: m.roi,
        maxDrawdownPct: m.maxDrawdown,
        profitFactor: m.profitFactor,
        sharpe: m.sharpe,
        sortino: m.sortino,
        equityCurve: result.equityCurve.map((p)=>({
                tradeNo: p.trade,
                value: p.equity
            }))
    };
    const config = {
        initialCapital: capital,
        periodValue,
        periodUnit,
        monthlySip,
        numDays,
        numMonths,
        totalSipContribution,
        totalCapital,
        amountPerTrade,
        numSignalsAvailable,
        numTrades: result.trades.length,
        minConfidence,
        tradeDirection,
        seed
    };
    // Flat aliases — subagent 4's results render reads these top-level fields
    // (initialAmount, finalAmount, totalPnl, totalReturnPct, wins, losses, rows)
    // in addition to the nested config/metrics/trades.
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        config,
        metrics,
        trades,
        // flat aliases for the render:
        initialAmount: capital,
        finalAmount: metrics.finalValue,
        totalPnl: metrics.netPnL,
        totalReturnPct: metrics.roiPct,
        wins: metrics.winTrades,
        losses: metrics.lossTrades,
        rows: trades,
        cached: false
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b2a4ae15._.js.map