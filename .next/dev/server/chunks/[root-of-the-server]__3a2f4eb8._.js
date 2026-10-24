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
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

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
function simulateWindowTrade(symbol, direction, bars, entryIdx, windowEndIdx, levels) {
    if (entryIdx < 0 || entryIdx >= bars.length || windowEndIdx >= bars.length) return null;
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
    const end = Math.min(bars.length - 1, windowEndIdx);
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
        // ── ALL-stocks mode: find-entry-bar + #2 fallback, hold numDays ──
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
                    if (rows.length < numDays + 5) continue;
                    const bars = rows.map((r)=>({
                            date: r.date,
                            open: r.open,
                            high: r.high,
                            low: r.low,
                            close: r.close
                        }));
                    const t = simulateOne(sig.symbol, sig.signal, bars, 2, numDays, {
                        entry: sig.entry,
                        sl: sig.sl,
                        tp1: sig.tp1,
                        tp2: sig.tp2,
                        tp3: sig.tp3,
                        confidence: sig.confidence
                    });
                    if (t) trades.push(t);
                } catch  {}
            }
        }
        await Promise.all(Array.from({
            length: 6
        }, ()=>worker()));
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
                if (rows.length < numDays + 5) continue;
                const bars = rows.map((r)=>({
                        date: r.date,
                        open: r.open,
                        high: r.high,
                        low: r.low,
                        close: r.close
                    }));
                const t = simulateOne(sig.symbol, sig.signal, bars, 2, numDays, {
                    entry: sig.entry,
                    sl: sig.sl,
                    tp1: sig.tp1,
                    tp2: sig.tp2,
                    tp3: sig.tp3
                });
                if (t) trades.push(t);
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
"[project]/src/lib/latent/ensemble.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Latent.pk — AI Model Signals: Ensemble computation + tier structure
__turbopack_context__.s([
    "ALL_MODELS",
    ()=>ALL_MODELS,
    "TIER_WEIGHTS",
    ()=>TIER_WEIGHTS,
    "computeFinalConsensus",
    ()=>computeFinalConsensus,
    "majorityVoteEnsemble",
    ()=>majorityVoteEnsemble,
    "probabilityWeightedEnsemble",
    ()=>probabilityWeightedEnsemble,
    "tierWeightedEnsemble",
    ()=>tierWeightedEnsemble
]);
const ALL_MODELS = [
    {
        name: "PatchTST",
        tier: "TIER_1",
        tierLabel: "Tier 1: SOTA Deep Learning",
        category: "Transformer-based time-series",
        trained: true
    },
    {
        name: "N-BEATS",
        tier: "TIER_1",
        tierLabel: "Tier 1: SOTA Deep Learning",
        category: "Deep residual stacks",
        trained: true
    },
    {
        name: "TimesNet",
        tier: "TIER_1",
        tierLabel: "Tier 1: SOTA Deep Learning",
        category: "2D variation of 1D time series",
        trained: true
    },
    {
        name: "Informer",
        tier: "TIER_1",
        tierLabel: "Tier 1: SOTA Deep Learning",
        category: "Efficient attention",
        trained: true
    },
    {
        name: "Chronos (Amazon)",
        tier: "TIER_2",
        tierLabel: "Tier 2: Foundation Models",
        category: "T5-tokenized foundation",
        trained: false,
        untrainedReason: "Requires chronos-forecasting package"
    },
    {
        name: "Lag-Llama",
        tier: "TIER_2",
        tierLabel: "Tier 2: Foundation Models",
        category: "Open-source foundation",
        trained: false,
        untrainedReason: "Requires custom repo"
    },
    {
        name: "Moirai (Salesforce)",
        tier: "TIER_2",
        tierLabel: "Tier 2: Foundation Models",
        category: "Universal forecasting",
        trained: false,
        untrainedReason: "Requires uni2ts"
    },
    {
        name: "Time-LLM",
        tier: "TIER_2",
        tierLabel: "Tier 2: Foundation Models",
        category: "LLM-reformatted",
        trained: false,
        untrainedReason: "Requires LLM pipeline"
    },
    {
        name: "XGBoost",
        tier: "TIER_3",
        tierLabel: "Tier 3: Classical ML",
        category: "Gradient-boosted trees regressor",
        trained: true
    },
    {
        name: "LightGBM",
        tier: "TIER_3",
        tierLabel: "Tier 3: Classical ML",
        category: "Light GBT regressor",
        trained: true
    },
    {
        name: "CatBoost",
        tier: "TIER_3",
        tierLabel: "Tier 3: Classical ML",
        category: "Categorical-boosted regressor",
        trained: true
    },
    {
        name: "Random Forest",
        tier: "TIER_3",
        tierLabel: "Tier 3: Classical ML",
        category: "Decision tree ensemble",
        trained: true
    },
    {
        name: "LSTM",
        tier: "TIER_3",
        tierLabel: "Tier 3: Classical ML",
        category: "LSTM neural net (PyTorch)",
        trained: true
    },
    {
        name: "CNN-LSTM",
        tier: "TIER_4",
        tierLabel: "Tier 4: Hybrid + Specialized",
        category: "CNN+LSTM hybrid",
        trained: true
    },
    {
        name: "Transformer-LSTM",
        tier: "TIER_4",
        tierLabel: "Tier 4: Hybrid + Specialized",
        category: "Transformer+LSTM hybrid",
        trained: true
    },
    {
        name: "TabNet",
        tier: "TIER_4",
        tierLabel: "Tier 4: Hybrid + Specialized",
        category: "Attention-based tabular",
        trained: false,
        untrainedReason: "Data type issue"
    },
    {
        name: "FinGPT",
        tier: "TIER_4",
        tierLabel: "Tier 4: Hybrid + Specialized",
        category: "LLM fine-tuned for finance",
        trained: false,
        untrainedReason: "Requires BloombergGPT"
    },
    // CL Tier: Classical/Linear models
    {
        name: "ARIMA",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "ARIMA classic baseline for daily price series",
        trained: true
    },
    {
        name: "Holt-Winters",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Exponential smoothing trend/seasonality",
        trained: true
    },
    {
        name: "GARCH",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Volatility forecast model",
        trained: true
    },
    {
        name: "Ridge Regression",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Linear regression on indicators (RSI, MACD, MA, volume)",
        trained: true
    },
    {
        name: "Kalman Filter",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Real-time state estimation filter",
        trained: true
    },
    {
        name: "Prophet",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Facebook Prophet trend/seasonality forecasting",
        trained: true
    },
    {
        name: "GRU",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Small GRU (1-2 layers, daily data)",
        trained: true
    },
    {
        name: "XGBoost (CL)",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Best accuracy-per-cost (copied from Tier 3)",
        trained: true
    },
    {
        name: "LightGBM (CL)",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Light GBT (copied from Tier 3)",
        trained: true
    },
    {
        name: "Random Forest (CL)",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Decision tree ensemble (copied from Tier 3)",
        trained: true
    },
    {
        name: "LSTM (CL)",
        tier: "TIER_CL",
        tierLabel: "CL Tier: Classical/Linear",
        category: "Small LSTM (copied from Tier 3)",
        trained: true
    },
    // CL-2 Tier: 7 CPU classifiers + logistic meta, support/ATR SL rule,
    // TP1-before-SL-in-5-days target, calibrated exp_win_rate confidence.
    {
        name: "LightGBM-A (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "LightGBM classifier (config A: 100 trees, depth 3)",
        trained: true
    },
    {
        name: "LightGBM-B (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "LightGBM classifier (config B: 60 trees, depth 5)",
        trained: true
    },
    {
        name: "HistGBM (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "sklearn HistGradientBoosting classifier",
        trained: true
    },
    {
        name: "ExtraTrees (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "ExtraTrees classifier",
        trained: true
    },
    {
        name: "RandomForest (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "RandomForest classifier",
        trained: true
    },
    {
        name: "Logistic (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "Logistic regression baseline",
        trained: true
    },
    {
        name: "MLP (CL-2)",
        tier: "TIER_CL_2",
        tierLabel: "CL-2 Tier: Calibrated Classifier Ensemble",
        category: "Small MLP (32-unit hidden layer)",
        trained: true
    },
    // PI Tier: 4 models (Linear/Logistic Regression, Pattern Matcher KNN, Neural Network)
    // + logistic meta-ensemble. Same support/ATR SL rule + TP1-before-SL target as CL-2.
    {
        name: "Linear Regression (PI)",
        tier: "TIER_PI",
        tierLabel: "PI Tier: Pattern & Indicator Models",
        category: "Linear regression on 20 indicators (predicts realized 5-day return)",
        trained: true
    },
    {
        name: "Logistic Regression (PI)",
        tier: "TIER_PI",
        tierLabel: "PI Tier: Pattern & Indicator Models",
        category: "Logistic regression (predicts P(TP1 hit before SL) in 5 days)",
        trained: true
    },
    {
        name: "Pattern Matcher KNN (PI)",
        tier: "TIER_PI",
        tierLabel: "PI Tier: Pattern & Indicator Models",
        category: "KNN classifier (k=15, distance-weighted) — pattern matching",
        trained: true
    },
    {
        name: "Neural Network (PI)",
        tier: "TIER_PI",
        tierLabel: "PI Tier: Pattern & Indicator Models",
        category: "MLPClassifier (64-32 hidden, tanh) — distinct from CL-2's MLP",
        trained: true
    },
    // GM Tier: 4-Pillar Weighted Framework (Technical 35% + Announcements 30%
    // + Fundamental 20% + Macro 15%). Rule-based, not ML. Each pillar is shown
    // as a separate "model" card for transparency; the combined signal is the
    // GM_MODEL ensemble entry. ATR rule: SL=1.5×ATR, TP1/2/3=1.5/3/4.5×ATR;
    // exits: 50%@TP1+BE, 30%@TP2, 20% trailing 20-EMA.
    {
        name: "Technical Engine (GM)",
        tier: "TIER_GM",
        tierLabel: "GM Tier: 4-Pillar Weighted Framework",
        category: "MA Trend + RSI/MACD + Bollinger Bands + OBV (35% weight)",
        trained: true
    },
    {
        name: "Announcements Engine (GM)",
        tier: "TIER_GM",
        tierLabel: "GM Tier: 4-Pillar Weighted Framework",
        category: "YoY EPS growth + dividend yield + EPS surprise (30% weight)",
        trained: true
    },
    {
        name: "Fundamental Engine (GM)",
        tier: "TIER_GM",
        tierLabel: "GM Tier: 4-Pillar Weighted Framework",
        category: "P/E + gross/net margin + interest coverage (20% weight)",
        trained: true
    },
    {
        name: "Macro Engine (GM)",
        tier: "TIER_GM",
        tierLabel: "GM Tier: 4-Pillar Weighted Framework",
        category: "KSE-100 trend + KIBOR + USD/PKR + Brent (15% weight)",
        trained: true
    },
    // CG Tier: 2 swing-trading models (LightGBM primary + XGBoost challenger)
    // with triple-barrier labels, 10-day horizon, 1R/2R/3R TPs, walk-forward CV,
    // and full cost model (brokerage + taxes + slippage + 15% CGT on gains).
    // CG-Ensemble = probability averaging of the 2 models + decile calibration.
    {
        name: "LightGBM (CG)",
        tier: "TIER_CG",
        tierLabel: "CG Tier: Swing-Trading Classifier Ensemble",
        category: "LightGBM primary classifier — triple-barrier, 10-day horizon, TP1=1R",
        trained: true
    },
    {
        name: "XGBoost (CG)",
        tier: "TIER_CG",
        tierLabel: "CG Tier: Swing-Trading Classifier Ensemble",
        category: "XGBoost challenger — same target/horizon as LightGBM (CG)",
        trained: true
    },
    // X Tier: NEW — 10 complementary strategies + LightGBM meta-labeling ensemble
    // with proper chronological methodology (3-way split, purge+embargo, untouched OOS test,
    // Platt+isotonic calibration). 90% precision achieved on untouched test, but
    // negative net expectancy due to entry gaps + costs (honest report).
    {
        name: "Trend Multi-TF (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Multi-timeframe trend (price > EMA20 > EMA50 > SMA200 + EMA separation > 0.5%)",
        trained: true
    },
    {
        name: "Breakout RelVol (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Breakout + relative volume (close > 20-day high AND vol > 1.5× 50d avg)",
        trained: true
    },
    {
        name: "Trend Pullback (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Trend pullback to EMA20 (price > EMA50, low touches EMA20 within 2%)",
        trained: true
    },
    {
        name: "RSI Divergence (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "RSI bullish divergence (price lower-low + RSI higher-low + RSI<35)",
        trained: true
    },
    {
        name: "BB Mean Reversion (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Bollinger Band mean reversion (below lower band + range-bound)",
        trained: true
    },
    {
        name: "Vol Contraction (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Volatility contraction-then-expansion (BB width pattern)",
        trained: true
    },
    {
        name: "Relative Strength (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Relative strength (stock 50d return > KSE-100 50d return + 2%)",
        trained: true
    },
    {
        name: "Market Regime (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Market regime filter (KSE-100 50d return > 2% → bull regime)",
        trained: true
    },
    {
        name: "Meta-Label CG (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Meta-label of CG-Ensemble predictions (raw_prob >= 0.55)",
        trained: true
    },
    {
        name: "Triple Barrier Dyn (X)",
        tier: "TIER_X",
        tierLabel: "X Tier: 10-Strategy Meta-Labeling Ensemble",
        category: "Triple-barrier dynamic (ATR/price < 5% + price > EMA50 = low-vol uptrend)",
        trained: true
    },
    // Gian Tier: Square-root support/resistance with odd-number rule.
    {
        name: "Gian-Ensemble (GIAN)",
        tier: "TIER_GIAN",
        tierLabel: "Gian Tier: Square-Root S/R Strategy",
        category: "Square-root support/resistance with odd-number rule (BUY near S1/S2/S3, SELL near R1/R2/R3)",
        trained: true
    },
    // Gian-Extender: Fixed GANN grid (Linear GANN 2.0 Pine Script by Adib Noorani)
    {
        name: "Gian-Extender (GIAN-EXT)",
        tier: "TIER_GIAN",
        tierLabel: "Gian Tier: Square-Root S/R Strategy",
        category: "Fixed GANN square-of-9 levels (1, 9, 25, 49, 81, 121, 169, 225, 289, 361, 441, 529, 625, ...)",
        trained: true
    },
    // M-Ensemble: Historical price-touch support/resistance with ATR clustering
    {
        name: "M-Ensemble (M)",
        tier: "TIER_GIAN",
        tierLabel: "Gian Tier: Square-Root S/R Strategy",
        category: "Historical price-touch S/R with ATR clustering (scan all highs/lows, cluster within 1×ATR, pick top 3)",
        trained: true
    }
];
const TIER_WEIGHTS = {
    TIER_1: 0.30,
    TIER_2: 0.20,
    TIER_3: 0.25,
    TIER_4: 0.10,
    TIER_CL: 0.15,
    TIER_CL_2: 0.20,
    TIER_PI: 0.20,
    TIER_GM: 0.20,
    TIER_CG: 0.20,
    TIER_X: 0.20,
    TIER_GIAN: 0.20
};
function avg(arr, fallback = 0) {
    return arr.length > 0 ? arr.reduce((s, v)=>s + v, 0) / arr.length : fallback;
}
function emptyEnsemble(method, label) {
    return {
        method,
        methodLabel: label,
        signal: "HOLD",
        direction: "LONG",
        confidence: 0,
        predictedPrice: 0,
        entry: 0,
        sl: 0,
        tp1: 0,
        tp2: 0,
        tp3: 0,
        modelCount: 0,
        buyCount: 0,
        sellCount: 0,
        holdCount: 0
    };
}
function majorityVoteEnsemble(preds) {
    const trained = preds.filter((p)=>p.trained && p.signal);
    const buyCount = trained.filter((p)=>p.signal === "BUY").length;
    const sellCount = trained.filter((p)=>p.signal === "SELL").length;
    const holdCount = trained.filter((p)=>p.signal === "HOLD").length;
    let signal = "HOLD";
    let direction = "LONG";
    if (buyCount > sellCount && buyCount > holdCount) {
        signal = "BUY";
        direction = "LONG";
    } else if (sellCount > buyCount && sellCount > holdCount) {
        signal = "SELL";
        direction = "SHORT";
    }
    const entry = trained[0]?.entry || trained[0]?.currentPrice || 0;
    const tp1s = trained.filter((p)=>p.tp1).map((p)=>p.tp1);
    const tp2s = trained.filter((p)=>p.tp2).map((p)=>p.tp2);
    const tp3s = trained.filter((p)=>p.tp3).map((p)=>p.tp3);
    const sls = trained.filter((p)=>p.sl).map((p)=>p.sl);
    const allTPs = [
        ...tp1s,
        ...tp2s,
        ...tp3s
    ];
    const confidence = trained.length > 0 ? Math.round(Math.max(buyCount, sellCount, holdCount) / trained.length * 100) : 0;
    return {
        method: "MAJORITY_VOTE",
        methodLabel: "A. Majority Vote",
        signal,
        direction,
        confidence,
        predictedPrice: avg(allTPs),
        entry,
        sl: avg(sls, entry),
        tp1: avg(tp1s, entry),
        tp2: avg(tp2s, entry),
        tp3: avg(tp3s, entry),
        modelCount: trained.length,
        buyCount,
        sellCount,
        holdCount
    };
}
function probabilityWeightedEnsemble(preds) {
    const trained = preds.filter((p)=>p.trained && p.avgReturn !== undefined);
    if (!trained.length) return emptyEnsemble("PROBABILITY_WEIGHTED", "B. Probability-Weighted");
    const avgRet = trained.reduce((s, p)=>s + p.avgReturn, 0) / trained.length;
    let signal = "HOLD";
    let direction = "LONG";
    if (avgRet > 0.01) {
        signal = "BUY";
        direction = "LONG";
    } else if (avgRet < -0.01) {
        signal = "SELL";
        direction = "SHORT";
    }
    const entry = trained[0]?.entry || trained[0]?.currentPrice || 0;
    const tp1s = trained.filter((p)=>p.tp1).map((p)=>p.tp1);
    const tp2s = trained.filter((p)=>p.tp2).map((p)=>p.tp2);
    const tp3s = trained.filter((p)=>p.tp3).map((p)=>p.tp3);
    const sls = trained.filter((p)=>p.sl).map((p)=>p.sl);
    return {
        method: "PROBABILITY_WEIGHTED",
        methodLabel: "B. Probability-Weighted",
        signal,
        direction,
        confidence: Math.round(Math.abs(avgRet) * 1000),
        predictedPrice: avg([
            ...tp1s,
            ...tp2s,
            ...tp3s
        ]),
        entry,
        sl: avg(sls, entry),
        tp1: avg(tp1s, entry),
        tp2: avg(tp2s, entry),
        tp3: avg(tp3s, entry),
        modelCount: trained.length,
        buyCount: trained.filter((p)=>p.signal === "BUY").length,
        sellCount: trained.filter((p)=>p.signal === "SELL").length,
        holdCount: trained.filter((p)=>p.signal === "HOLD").length
    };
}
function tierWeightedEnsemble(preds) {
    const trained = preds.filter((p)=>p.trained && p.avgReturn !== undefined);
    if (!trained.length) return emptyEnsemble("TIER_WEIGHTED", "C. Tier-Weighted");
    let weightedSum = 0, weightTotal = 0;
    for (const p of trained){
        const tw = TIER_WEIGHTS[p.tier] || 0.25;
        weightedSum += p.avgReturn * tw;
        weightTotal += tw;
    }
    const wr = weightTotal > 0 ? weightedSum / weightTotal : 0;
    let signal = "HOLD";
    let direction = "LONG";
    if (wr > 0.01) {
        signal = "BUY";
        direction = "LONG";
    } else if (wr < -0.01) {
        signal = "SELL";
        direction = "SHORT";
    }
    const entry = trained[0]?.entry || trained[0]?.currentPrice || 0;
    const tp1s = trained.filter((p)=>p.tp1).map((p)=>p.tp1);
    const tp2s = trained.filter((p)=>p.tp2).map((p)=>p.tp2);
    const tp3s = trained.filter((p)=>p.tp3).map((p)=>p.tp3);
    const sls = trained.filter((p)=>p.sl).map((p)=>p.sl);
    return {
        method: "TIER_WEIGHTED",
        methodLabel: "C. Tier-Weighted",
        signal,
        direction,
        confidence: Math.round(Math.abs(wr) * 1000),
        predictedPrice: avg([
            ...tp1s,
            ...tp2s,
            ...tp3s
        ]),
        entry,
        sl: avg(sls, entry),
        tp1: avg(tp1s, entry),
        tp2: avg(tp2s, entry),
        tp3: avg(tp3s, entry),
        modelCount: trained.length,
        buyCount: trained.filter((p)=>p.signal === "BUY").length,
        sellCount: trained.filter((p)=>p.signal === "SELL").length,
        holdCount: trained.filter((p)=>p.signal === "HOLD").length
    };
}
function computeFinalConsensus(ens) {
    const buyV = ens.filter((e)=>e.signal === "BUY").length;
    const sellV = ens.filter((e)=>e.signal === "SELL").length;
    const holdV = ens.filter((e)=>e.signal === "HOLD").length;
    let signal = "HOLD";
    let direction = "LONG";
    if (buyV >= 2) {
        signal = "BUY";
        direction = "LONG";
    } else if (sellV >= 2) {
        signal = "SELL";
        direction = "SHORT";
    }
    const entry = ens[0]?.entry || 0;
    const predictedPrices = ens.map((e)=>e.predictedPrice).filter((p)=>p > 0);
    return {
        signal,
        direction,
        confidence: ens.length > 0 ? Math.round(ens.reduce((s, e)=>s + e.confidence, 0) / ens.length) : 0,
        agreement: Math.round(Math.max(buyV, sellV, holdV) / ens.length * 100),
        predictedPriceRange: {
            min: predictedPrices.length ? Math.min(...predictedPrices) : entry,
            max: predictedPrices.length ? Math.max(...predictedPrices) : entry
        },
        entry,
        sl: avg(ens.map((e)=>e.sl), entry),
        tp1: avg(ens.map((e)=>e.tp1), entry),
        tp2: avg(ens.map((e)=>e.tp2), entry),
        tp3: avg(ens.map((e)=>e.tp3), entry)
    };
}
}),
"[project]/src/app/api/backtest/ensembles/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$backtest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/backtest.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$ensemble$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/ensemble.ts [app-route] (ecmascript)");
;
;
;
;
;
;
const dynamic = "force-dynamic";
const maxDuration = 30;
// Issue 1: 13 ENSEMBLE MODELS, each running on ITS OWN per-stock BUY signal —
// NOT the Final Consensus. 3 base (computed from per-model predictions via the
// ensemble.ts functions) + 7 stored per-ensemble predictions + 3 gian = 13.
const ENSEMBLES = [
    {
        key: "majority",
        name: "MAJORITY_VOTE",
        label: "A. Majority Vote",
        baseFn: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$ensemble$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["majorityVoteEnsemble"]
    },
    {
        key: "probability",
        name: "PROBABILITY_WEIGHTED",
        label: "B. Probability-Weighted",
        baseFn: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$ensemble$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["probabilityWeightedEnsemble"]
    },
    {
        key: "tier",
        name: "TIER_WEIGHTED",
        label: "C. Tier-Weighted",
        baseFn: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$ensemble$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["tierWeightedEnsemble"]
    },
    {
        key: "cl_ensemble_predictions",
        name: "CL_ENSEMBLE",
        label: "D. CL-Ensemble (LGB70+Log30)"
    },
    {
        key: "cl_extender_predictions",
        name: "CL_EXTENDER",
        label: "E. CL-Extender (8-model weighted)"
    },
    {
        key: "cl2_ensemble_predictions",
        name: "CL2_ENSEMBLE",
        label: "F. CL-2 Ensemble (7 classifiers)"
    },
    {
        key: "pi_ensemble_predictions",
        name: "PI_ENSEMBLE",
        label: "G. PI-Ensemble (4 models)"
    },
    {
        key: "gm_model_predictions",
        name: "GM_MODEL",
        label: "H. GM-Model (4-Pillar)"
    },
    {
        key: "cg_ensemble_predictions",
        name: "CG_ENSEMBLE",
        label: "I. CG-Ensemble (swing-trader)"
    },
    {
        key: "x_ensemble_predictions",
        name: "X_ENSEMBLE",
        label: "J. X-Ensemble (10-strategy meta)"
    },
    {
        key: "gian_ensemble_predictions",
        name: "GIAN_ENSEMBLE",
        label: "K. Gian-Ensemble (S/R)"
    },
    {
        key: "gian_extender_predictions",
        name: "GIAN_EXTENDER",
        label: "L. Gian-Extender (GANN grid)"
    },
    {
        key: "m_ensemble_predictions",
        name: "M_ENSEMBLE",
        label: "M. M-Ensemble (price-touch S/R)"
    }
];
// Build per-stock predictions for a symbol (same logic as /api/signals/all +
// /api/ai-model-signals/[symbol]) — used to compute the 3 base ensembles.
function buildPredictionsForSymbol(symbol, multi) {
    const models = multi?.models;
    if (!models) return [];
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$ensemble$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ALL_MODELS"].map((meta)=>{
        const lookupName = meta.name.replace(" (CL)", "");
        const nk = lookupName.replace(/\s+/g, "");
        const md = models[lookupName] || models[nk] || models[meta.name];
        if (!md?.trained) return {
            ...meta,
            trained: false
        };
        const p = md.predictions?.[symbol];
        if (!p) return {
            ...meta,
            trained: true
        };
        return {
            ...meta,
            trained: true,
            direction: p.direction,
            signal: p.signal,
            confidence: p.confidence,
            currentPrice: p.currentPrice,
            entry: p.entry,
            sl: p.sl,
            tp1: p.tp1,
            tp2: p.tp2,
            tp3: p.tp3,
            avgReturn: p.avgReturn
        };
    });
}
// Build a BUY signal list for a BASE ensemble (majority/probability/tier) by
// computing the ensemble per stock from per-model predictions.
function buildBaseSignals(baseFn, multi, backedSet, buyOnly = true) {
    const models = multi?.models;
    if (!models) return [];
    const symbolSet = new Set();
    for (const m of Object.values(models)){
        if (!m?.trained) continue;
        const preds = m.predictions || {};
        for (const sym of Object.keys(preds))symbolSet.add(sym);
    }
    const out = [];
    for (const sym of symbolSet){
        if (backedSet && !backedSet.has(sym)) continue;
        const preds = buildPredictionsForSymbol(sym, multi);
        const ens = baseFn(preds);
        // buyOnly (ALL stocks) → BUY only; single-stock → return ALL (BUY/SELL/HOLD) so the loop can check direction + skip SELL/HOLD
        if (buyOnly && ens.signal !== "BUY") continue;
        if (!ens.entry || ens.entry <= 0) continue;
        out.push({
            symbol: sym,
            signal: ens.signal,
            confidence: ens.confidence,
            entry: ens.entry,
            sl: ens.sl,
            tp1: ens.tp1,
            tp2: ens.tp2,
            tp3: ens.tp3
        });
    }
    return out;
}
function toEpochMs(date) {
    const t = Date.parse(date);
    return isNaN(t) ? 0 : t;
}
// Technical fallback signal for a stock NOT in the 361-stock ML universe (e.g.
// TISL) — computes EMA(20/50) trend + RSI(14) + ATR(14) SL/TP from the DB OHLCV.
// Used when a single stock is selected and an ensemble has no ML prediction for
// it, so EVERY ensemble still takes trades on the selected stock.
async function computeTechnicalSignal(sym) {
    let bars = [];
    try {
        const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
            where: {
                symbol: sym
            },
            orderBy: {
                date: "asc"
            },
            take: 400
        });
        bars = rows.map((r)=>({
                date: r.date,
                open: r.open,
                high: r.high,
                low: r.low,
                close: r.close,
                volume: r.volume
            }));
    } catch  {}
    if (bars.length < 30) return null;
    const closes = bars.map((b)=>b.close);
    const entry = closes[closes.length - 1];
    const trs = [];
    for(let i = 1; i < bars.length; i++)trs.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)));
    const atrVal = trs.slice(-14).reduce((s, v)=>s + v, 0) / Math.min(14, trs.length || 1) || entry * 0.02;
    const ema = (period)=>{
        const k = 2 / (period + 1);
        let e = closes[0];
        for(let i = 1; i < closes.length; i++)e = closes[i] * k + e * (1 - k);
        return e;
    };
    const ema20 = ema(20), ema50 = ema(50);
    let g = 0, l = 0;
    for(let i = closes.length - 14; i < closes.length; i++){
        if (i < 1) continue;
        const ch = closes[i] - closes[i - 1];
        if (ch > 0) g += ch;
        else l -= ch;
    }
    const ag = g / 14, al = l / 14;
    const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    let signal = "BUY";
    if (ema20 < ema50 && rsi > 30) signal = "SELL";
    else if (rsi > 70) signal = "SELL";
    return {
        symbol: sym,
        signal,
        confidence: 50,
        entry,
        sl: signal === "BUY" ? entry - 1.5 * atrVal : entry + 1.5 * atrVal,
        tp1: signal === "BUY" ? entry + atrVal : entry - atrVal,
        tp2: signal === "BUY" ? entry + 2 * atrVal : entry - 2 * atrVal,
        tp3: signal === "BUY" ? entry + 3 * atrVal : entry - 3 * atrVal
    };
}
async function GET(req) {
    const url = new URL(req.url);
    const capital = parseFloat(url.searchParams.get("capital") || "100000") || 100000;
    const numTrades = Math.min(2000, Math.max(1, parseInt(url.searchParams.get("numTrades") || "40", 10) || 40));
    const numDays = Math.min(120, Math.max(0, parseInt(url.searchParams.get("numDays") || "0", 10) || 0)); // 0 = optional (not given → any start day)
    // Ranking: by win rate (default) or net P&L — user-selectable in the UI.
    const rankBy = url.searchParams.get("rankBy") || "winRate";
    // Optional stock filter — if set, each ensemble simulates ONLY that stock's
    // signal (across all ensembles). Default (empty) = ALL stocks.
    const symbolFilter = (url.searchParams.get("symbol") || "").toUpperCase().replace(/XD$/, "");
    // Issue 1: amount per trade = starting capital (all-in per trade, fixed —
    // each trade invests the full capital; P&L summed, not compounded).
    const amountPerTrade = capital;
    // Load ml_predictions_multi.json (per-ensemble predictions)
    let multi = null;
    try {
        multi = JSON.parse(await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readFile(__TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), "data", "ml_predictions_multi.json"), "utf-8"));
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "ml_predictions_multi.json not found"
        }, {
            status: 503
        });
    }
    // Backed-up symbols (DB)
    let backedSet = null;
    try {
        const backed = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
            select: {
                symbol: true
            },
            distinct: [
                "symbol"
            ]
        });
        backedSet = new Set(backed.map((b)=>b.symbol));
        // Issue 34: safety net — if the DB is empty (e.g. someone ran `bun run
        // db:push` without the .gz restore step, OR the sandbox reset it), the
        // backedSet would be empty → every ensemble's `buildFromPreds` would
        // drop ALL signals (because `backedSet.has(sym)` is false for every
        // symbol) → 0 ensembles with metrics → the Portfolio Simulation UI shows
        // "Simulated 0 ensembles". When this happens, fall back to NOT filtering
        // by backedSet (treat backedSet as null = no filter) so the simulation
        // still runs on every BUY signal in the JSON. The simulation will use
        // the JSON's stored entry/SL/TP values (which are based on real OHLCV
        // history from training time, not real-time bars), so the per-trade
        // walk-forward simulation can't actually walk through DB bars — but at
        // least the user sees RESULTS instead of "0 ensembles".
        if (backedSet.size === 0) {
            backedSet = null;
        }
    } catch  {}
    // Build per-ensemble signal lists (each ensemble uses its OWN per-stock
    // predictions from ml_predictions_multi.json — NOT the final consensus).
    // buyOnly=true (ALL stocks) → BUY signals only; buyOnly=false (single stock)
    // → each ensemble's ACTUAL signal (BUY or SELL) so every ensemble trades.
    const buildFromPreds = (preds, buyOnly = true)=>{
        if (!preds) return [];
        const out = [];
        for (const [sym, p] of Object.entries(preds)){
            const pp = p;
            if (buyOnly ? pp.signal !== "BUY" : false) continue; // BUY only for ALL-stocks; single-stock returns ALL (BUY/SELL/HOLD) so the loop can check direction
            if (typeof pp.entry !== "number" || pp.entry <= 0) continue;
            if (backedSet && !backedSet.has(sym)) continue;
            out.push({
                symbol: sym,
                signal: pp.signal,
                confidence: pp.confidence ?? 0,
                entry: pp.entry,
                sl: pp.sl,
                tp1: pp.tp1,
                tp2: pp.tp2,
                tp3: pp.tp3
            });
        }
        return out;
    };
    const results = [];
    // Lazy technical-fallback signal for a selected stock not in the ML universe
    // (so every ensemble still trades on the selected stock).
    let techSignalCache = undefined;
    const getTechSignal = async ()=>{
        if (techSignalCache !== undefined) return techSignalCache;
        techSignalCache = symbolFilter ? await computeTechnicalSignal(symbolFilter) : null;
        return techSignalCache;
    };
    for (const ens of ENSEMBLES){
        // Each ensemble runs on ITS OWN per-stock signal predictions (not final consensus).
        // Base ensembles (majority/probability/tier) are COMPUTED from per-model predictions;
        // the others are read from their stored per-ensemble predictions.
        const buyOnly = !symbolFilter; // ALL → BUY only; single → ALL signals (loop checks direction)
        const signals = ens.baseFn ? buildBaseSignals(ens.baseFn, multi, backedSet, buyOnly) : buildFromPreds(multi?.[ens.key], buyOnly);
        // Optional stock filter — simulate only the chosen stock (across all ensembles)
        let stockSignals = symbolFilter ? signals.filter((s)=>s.symbol === symbolFilter) : signals;
        // Single-stock: trade ONLY if the ensemble's signal is BUY (per user: SELL/HOLD → don't count their signal).
        let filtered = symbolFilter ? stockSignals.filter((s)=>s.signal === "BUY") : stockSignals;
        // If the ensemble is SELL/HOLD (or has no prediction) on the selected stock,
        // use the technical BUY fallback so EVERY ensemble still trades (all BUY).
        // The SELL/HOLD signal itself is NOT counted — a BUY technical trade is taken instead.
        if (filtered.length === 0 && symbolFilter) {
            const tech = await getTechSignal();
            if (tech && tech.signal === "BUY") filtered = [
                tech
            ];
        }
        if (filtered.length === 0) {
            results.push({
                ensembleName: ens.name,
                ensembleLabel: ens.label,
                metrics: null,
                trades: []
            });
            continue;
        }
        try {
            const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$backtest$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["runBacktest"])({
                startingCapital: capital,
                amountPerTrade,
                numTrades,
                numDays,
                naturalCount: filtered.length,
                signals: filtered
            });
            const m = res.metrics;
            results.push({
                ensembleName: ens.name,
                ensembleLabel: ens.label,
                metrics: {
                    startingCapital: m.startingCapital,
                    amountPerTrade: m.amountPerTrade,
                    totalTrades: m.totalTrades,
                    naturalBuyCount: m.naturalBuyCount,
                    numDays: m.numDays,
                    tradesPerDay: m.tradesPerDay,
                    winTrades: m.winTrades,
                    lossTrades: m.lossTrades,
                    winRate: m.winRate,
                    avgWinPct: m.avgWinPct,
                    avgLossPct: m.avgLossPct,
                    grossProfit: m.grossProfit,
                    grossLoss: m.grossLoss,
                    totalCosts: m.totalCosts,
                    grossBeforeCosts: m.grossBeforeCosts,
                    netPnL: m.netPnl,
                    finalValue: m.finalPortfolioValue,
                    roiPct: m.roi,
                    maxDrawdownPct: m.maxDrawdownPct,
                    maxDrawdownPkr: m.maxDrawdownPkr,
                    profitFactor: m.profitFactor,
                    sharpe: m.sharpe,
                    sortino: m.sortino
                },
                trades: res.trades.map((t, i)=>({
                        tradeNo: i + 1,
                        symbol: t.symbol,
                        signal: t.direction,
                        side: t.direction,
                        entryDate: toEpochMs(t.entryDate),
                        entryPrice: t.entryPrice,
                        close: t.exitPrice ?? 0,
                        exitDate: t.exitDate ? toEpochMs(t.exitDate) : 0,
                        exitPrice: t.exitPrice ?? 0,
                        exitReason: t.exitReason,
                        bestTp: t.bestTp,
                        confidence: t.confidence,
                        sl: t.sl,
                        tp1: t.tp1,
                        tp2: t.tp2,
                        tp3: t.tp3,
                        invested: t.invested || amountPerTrade,
                        netPnl: t.netPnlPkr,
                        netPnlPct: amountPerTrade > 0 ? t.netPnlPkr / amountPerTrade * 100 : 0,
                        portfolio: t.portfolio,
                        isWin: t.netPnlPkr > 0
                    }))
            });
        } catch (e) {
            results.push({
                ensembleName: ens.name,
                ensembleLabel: ens.label,
                metrics: null,
                trades: [],
                error: e?.message
            });
        }
    }
    // Rank by the user-selected metric (win rate default, or net P&L) — ensembles with metrics first, sorted desc.
    const withMetrics = results.filter((r)=>r.metrics).sort((a, b)=>rankBy === "netPnl" ? b.metrics.netPnL - a.metrics.netPnL : b.metrics.winRate - a.metrics.winRate);
    const top5 = withMetrics.slice(0, 5);
    const rest = withMetrics.slice(5);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        capital,
        amountPerTrade,
        totalEnsembles: results.filter((r)=>r.metrics).length,
        numDays,
        numTrades,
        top5,
        rest,
        cached: false
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3a2f4eb8._.js.map