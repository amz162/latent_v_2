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
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
;
;
;
const dynamic = "force-dynamic";
const maxDuration = 60;
const UNIT_DAYS = {
    day: 1,
    month: 21,
    year: 252
};
// The 13 ensemble prediction keys in the JSON (matches the ENSEMBLES list
// in /api/backtest/ensembles/route.ts).
const ENS_KEYS = [
    "majority_vote_predictions",
    "probability_weighted_predictions",
    "tier_weighted_predictions",
    "cl_ensemble_predictions",
    "cl_extender_predictions",
    "cl2_ensemble_predictions",
    "pi_ensemble_predictions",
    "gm_model_predictions",
    "cg_ensemble_predictions",
    "x_ensemble_predictions",
    "gian_ensemble_predictions",
    "gian_extender_predictions",
    "m_ensemble_predictions"
];
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
    const numTradesRaw = parseInt(url.searchParams.get("numTrades") || "40", 10);
    const numTrades = Math.min(500, Math.max(1, Number.isFinite(numTradesRaw) ? numTradesRaw : 40));
    const minConfidence = Math.min(100, Math.max(0, parseInt(url.searchParams.get("minConfidence") || "0", 10) || 0));
    const tradeDirection = url.searchParams.get("tradeDirection") || "all";
    const numDays = periodValue * (UNIT_DAYS[periodUnit] || 21);
    const numMonths = periodUnit === "month" ? periodValue : periodUnit === "year" ? periodValue * 12 : Math.max(1, Math.round(numDays / 21));
    const totalSipContribution = monthlySip * numMonths;
    const totalCapital = capital + totalSipContribution;
    const amountPerTrade = totalCapital / 10;
    const seed = Date.now();
    // ── Issue 44: read JSON directly + compute final consensus inline ──
    // This replaces the slow HTTP self-call to /api/signals/all (5-10s).
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
    // Compute the final consensus per stock from the 13 stored ensemble predictions.
    // Final consensus: BUY if ≥2 ensembles are BUY, SELL if ≥2 are SELL, else HOLD.
    // Entry/SL/TP from the first ensemble that has a BUY/SELL signal.
    const allSymbols = new Set();
    for (const k of ENS_KEYS){
        const preds = multi[k];
        if (preds && typeof preds === "object") {
            for (const sym of Object.keys(preds))allSymbols.add(sym);
        }
    }
    let signals = [];
    for (const sym of allSymbols){
        let buyVotes = 0, sellVotes = 0, holdVotes = 0;
        let entry = 0, sl = 0, tp1 = 0, tp2 = 0, tp3 = 0, confidence = 0;
        let found = false;
        for (const k of ENS_KEYS){
            const preds = multi[k];
            if (!preds || typeof preds !== "object") continue;
            const p = preds[sym];
            if (!p || typeof p !== "object") continue;
            const sig = p.signal;
            if (sig === "BUY") buyVotes++;
            else if (sig === "SELL") sellVotes++;
            else holdVotes++;
            // Take entry/SL/TP from the first ensemble that has a non-zero entry.
            if (!found && typeof p.entry === "number" && p.entry > 0) {
                entry = p.entry;
                sl = p.sl || 0;
                tp1 = p.tp1 || 0;
                tp2 = p.tp2 || 0;
                tp3 = p.tp3 || 0;
                confidence = Math.min(100, p.confidence || 0); // Issue 40: cap at 100
                found = true;
            }
        }
        // Final consensus
        let finalSignal = "HOLD";
        if (buyVotes >= 2 && buyVotes > sellVotes) finalSignal = "BUY";
        else if (sellVotes >= 2 && sellVotes > buyVotes) finalSignal = "SELL";
        if (finalSignal === "HOLD") continue; // skip HOLD — only simulate actionable signals
        if (!found || entry <= 0) continue;
        signals.push({
            symbol: sym,
            signal: finalSignal,
            confidence,
            entry,
            sl,
            tp1,
            tp2,
            tp3
        });
    }
    // Filter by min confidence
    signals = signals.filter((s)=>s.confidence >= minConfidence);
    // Filter by trade direction
    if (tradeDirection === "buy") signals = signals.filter((s)=>s.signal === "BUY");
    else if (tradeDirection === "sell") signals = signals.filter((s)=>s.signal === "SELL");
    const numSignalsAvailable = signals.length;
    if (signals.length === 0) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: `No signals available with confidence ≥ ${minConfidence} and direction: ${tradeDirection}`
        }, {
            status: 503
        });
    }
    // Seeded RNG (deterministic per seed)
    let s = seed;
    const rng = ()=>{
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
    // ── Issue 45: SEQUENTIAL month-by-month simulation ──
    // User picks 3 months + SIP 5000 → go back 3 months (e.g. July 1), take
    // trades sequentially from July 1 → when July ends, add SIP 5000 to the
    // balance + insert a SIP row → continue with August → repeat.
    // If a trade can't be found for a stock (no bars in the month), switch to
    // another stock + try again.
    const todayDate = new Date();
    const calendarWindowDays = numDays > 0 ? Math.ceil(numDays * 1.5) : 3650;
    const startDate = new Date(todayDate.getTime() - calendarWindowDays * 86400000);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = todayDate.toISOString().split("T")[0];
    // Build the list of month boundaries in the window:
    // e.g. 3 months ending Oct 2026 → [Jul 2026, Aug 2026, Sep 2026, Oct 2026]
    const months = [];
    {
        const start = new Date(startDate);
        const end = new Date(todayDate);
        // Move start to the 1st of its month
        const mStart = new Date(start.getFullYear(), start.getMonth(), 1);
        while(mStart <= end){
            const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0); // last day of month
            const mEndClamped = mEnd > end ? end : mEnd;
            months.push({
                start: mStart.toISOString().split("T")[0],
                end: mEndClamped.toISOString().split("T")[0],
                label: mStart.toLocaleDateString("en-PK", {
                    month: "long",
                    year: "numeric"
                })
            });
            mStart.setMonth(mStart.getMonth() + 1);
        }
    }
    const trades = [];
    let tradeCount = 0; // count of actual TRADE rows (not SIP rows)
    // Helper: find a trade for a stock in a given month. Returns a Trade or null.
    // `fromDateStr` = the earliest date the ENTRY must be on/after (so trades are
    // sequential — each new trade enters AFTER the previous trade's exit).
    async function findTradeInMonth(month, fromDateStr) {
        // Try up to 8 different stocks (rotate through the shuffled signals)
        for(let attempt = 0; attempt < 8; attempt++){
            const sig = signals[Math.floor(rng() * signals.length)];
            try {
                // Fetch bars for this stock in the month (plus the entry-from constraint)
                const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].ohlcvBar.findMany({
                    where: {
                        symbol: sig.symbol,
                        date: {
                            gte: month.start,
                            lte: month.end
                        }
                    },
                    orderBy: {
                        date: "asc"
                    }
                });
                if (rows.length < 3) continue;
                const bars = rows.map((r)=>({
                        date: r.date,
                        open: r.open,
                        high: r.high,
                        low: r.low,
                        close: r.close
                    }));
                // Find the first bar on/after fromDateStr (sequential entry)
                let entryIdx = bars.findIndex((b)=>b.date >= fromDateStr);
                if (entryIdx < 0 || entryIdx >= bars.length - 1) continue; // need at least 1 bar after entry
                const entryBar = bars[entryIdx];
                const entryPrice = entryBar.close;
                const sigEntry = sig.entry > 0 ? sig.entry : entryPrice;
                const slDist = sig.sl > 0 ? Math.abs(sigEntry - sig.sl) : entryPrice * 0.03;
                const tp1Dist = sig.tp1 > 0 ? Math.abs(sig.tp1 - sigEntry) : entryPrice * 0.03;
                const tp2Dist = sig.tp2 > 0 ? Math.abs(sig.tp2 - sigEntry) : entryPrice * 0.06;
                const tp3Dist = sig.tp3 > 0 ? Math.abs(sig.tp3 - sigEntry) : entryPrice * 0.09;
                const sl = sig.signal === "BUY" ? entryPrice - slDist : entryPrice + slDist;
                const tp1 = sig.signal === "BUY" ? entryPrice + tp1Dist : entryPrice - tp1Dist;
                const tp2 = sig.signal === "BUY" ? entryPrice + tp2Dist : entryPrice - tp2Dist;
                const tp3 = sig.signal === "BUY" ? entryPrice + tp3Dist : entryPrice - tp3Dist;
                const windowEndIdx = bars.length - 1;
                let exitIdx = windowEndIdx, exitPrice = bars[windowEndIdx].close, exitReason = "TIME_UP";
                for(let j = entryIdx + 1; j <= windowEndIdx; j++){
                    const b = bars[j];
                    if (sig.signal === "BUY") {
                        if (b.high >= tp3) {
                            exitIdx = j;
                            exitPrice = tp3;
                            exitReason = "TP3_HIT";
                            break;
                        }
                        if (b.high >= tp2) {
                            exitIdx = j;
                            exitPrice = tp2;
                            exitReason = "TP2_HIT";
                            break;
                        }
                        if (b.high >= tp1) {
                            exitIdx = j;
                            exitPrice = tp1;
                            exitReason = "TP1_HIT";
                            break;
                        }
                        if (b.low <= sl) {
                            exitIdx = j;
                            exitPrice = sl;
                            exitReason = "SL_HIT";
                            break;
                        }
                    } else {
                        if (b.low <= tp3) {
                            exitIdx = j;
                            exitPrice = tp3;
                            exitReason = "TP3_HIT";
                            break;
                        }
                        if (b.low <= tp2) {
                            exitIdx = j;
                            exitPrice = tp2;
                            exitReason = "TP2_HIT";
                            break;
                        }
                        if (b.low <= tp1) {
                            exitIdx = j;
                            exitPrice = tp1;
                            exitReason = "TP1_HIT";
                            break;
                        }
                        if (b.high >= sl) {
                            exitIdx = j;
                            exitPrice = sl;
                            exitReason = "SL_HIT";
                            break;
                        }
                    }
                }
                const grossPnlPct = sig.signal === "BUY" ? (exitPrice - entryPrice) / entryPrice * 100 : (entryPrice - exitPrice) / entryPrice * 100;
                const commission = amountPerTrade * 0.0015 * 2;
                const cgt = grossPnlPct > 0 ? grossPnlPct / 100 * amountPerTrade * 0.15 : 0;
                const grossPnl = grossPnlPct / 100 * amountPerTrade;
                const netPnl = grossPnl - commission - cgt;
                const shares = entryPrice > 0 ? amountPerTrade / entryPrice : 0;
                const exitDateStr = bars[exitIdx].date;
                return {
                    trade: {
                        tradeNo: 0,
                        symbol: sig.symbol,
                        side: sig.signal,
                        direction: sig.signal === "BUY" ? "LONG" : "SHORT",
                        entryDate: toEpochMs(entryBar.date),
                        entryPrice,
                        exitDate: toEpochMs(exitDateStr),
                        exitPrice,
                        exitReason,
                        sl,
                        tp1,
                        tp2,
                        tp3,
                        shares,
                        notional: amountPerTrade,
                        netPnl,
                        netPnlPct: amountPerTrade > 0 ? netPnl / amountPerTrade * 100 : 0,
                        isWin: netPnl > 0,
                        rowType: "TRADE",
                        monthLabel: month.label
                    },
                    exitDateStr
                };
            } catch  {}
        }
        return null; // couldn't find a trade in this month
    }
    // Distribute numTrades across the months proportionally.
    // e.g. 12 trades over 3 months (Jul, Aug, Sep) → ~4 trades/month.
    const tradesPerMonth = Math.max(1, Math.ceil(numTrades / months.length));
    for(let mIdx = 0; mIdx < months.length && tradeCount < numTrades; mIdx++){
        const month = months[mIdx];
        let nextEntryDate = month.start; // sequential: first trade enters at the month's start
        let monthTradeCount = 0;
        // Take tradesPerMonth trades in this month (or until numTrades reached)
        while(monthTradeCount < tradesPerMonth && tradeCount < numTrades){
            const found = await findTradeInMonth(month, nextEntryDate);
            if (!found) break; // no more trades possible in this month → move to next month
            found.trade.tradeNo = trades.length + 1;
            trades.push(found.trade);
            tradeCount++;
            monthTradeCount++;
            // Next trade must enter AFTER this trade's exit (sequential)
            nextEntryDate = found.exitDateStr;
        }
        // After the month ends → add the SIP (if monthlySip > 0 and not the last month)
        if (monthlySip > 0 && mIdx < months.length - 1) {
            trades.push({
                tradeNo: trades.length + 1,
                symbol: "—",
                side: "SIP",
                direction: "DEPOSIT",
                entryDate: toEpochMs(month.end),
                entryPrice: 0,
                exitDate: toEpochMs(month.end),
                exitPrice: 0,
                exitReason: "SIP_DEPOSIT",
                sl: 0,
                tp1: 0,
                tp2: 0,
                tp3: 0,
                shares: 0,
                notional: monthlySip,
                netPnl: monthlySip,
                netPnlPct: 0,
                isWin: true,
                rowType: "SIP",
                sipAmount: monthlySip,
                monthLabel: month.label
            });
        }
    }
    // Compute metrics — only count TRADE rows in win/loss stats (SIP rows are
    // deposits, not trades). The SIP amounts contribute to the final balance.
    const tradeRows = trades.filter((t)=>t.rowType === "TRADE");
    const sipRows = trades.filter((t)=>t.rowType === "SIP");
    const totalTrades = tradeRows.length;
    const winTrades = tradeRows.filter((t)=>t.isWin).length;
    const lossTrades = totalTrades - winTrades;
    const winRate = totalTrades > 0 ? winTrades / totalTrades * 100 : 0;
    const grossProfit = tradeRows.filter((t)=>t.netPnl > 0).reduce((s, t)=>s + t.netPnl, 0);
    const grossLoss = Math.abs(tradeRows.filter((t)=>t.netPnl <= 0).reduce((s, t)=>s + t.netPnl, 0));
    const totalCosts = tradeRows.reduce((s, t)=>s + (t.notional * 0.003 + (t.netPnl > 0 ? Math.abs(t.netPnl) * 0.15 / 1.15 : 0)), 0);
    const tradePnL = tradeRows.reduce((s, t)=>s + t.netPnl, 0);
    const sipTotalActual = sipRows.reduce((s, t)=>s + (t.sipAmount || 0), 0);
    const netPnL = tradePnL; // netPnL = trading P&L only (SIP shown separately)
    const finalValue = capital + sipTotalActual + tradePnL;
    const roiPct = capital > 0 ? netPnL / capital * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
    const retSeries = tradeRows.map((t)=>t.netPnlPct / 100);
    const mean = retSeries.length ? retSeries.reduce((s, v)=>s + v, 0) / retSeries.length : 0;
    const std = retSeries.length > 1 ? Math.sqrt(retSeries.reduce((s, v)=>s + (v - mean) ** 2, 0) / (retSeries.length - 1)) : 0;
    const sharpe = std > 0 ? mean / std * Math.sqrt(252) : 0;
    const downside = retSeries.filter((v)=>v < 0);
    const dstd = downside.length > 1 ? Math.sqrt(downside.reduce((s, v)=>s + v * v, 0) / downside.length) : 0;
    const sortino = dstd > 0 ? mean / dstd * Math.sqrt(252) : 0;
    // Equity curve — walks through ALL rows (trades + SIP) so the balance
    // grows when the SIP is deposited at each month end.
    let equity = capital;
    const equityCurve = trades.map((t, i)=>{
        equity += t.rowType === "SIP" ? t.sipAmount || 0 : t.netPnl;
        return {
            tradeNo: i + 1,
            value: equity
        };
    });
    // Max drawdown
    let peak = capital;
    let maxDdPct = 0;
    for (const t of equityCurve){
        if (t.value > peak) peak = t.value;
        const dd = peak > 0 ? (peak - t.value) / peak * 100 : 0;
        if (dd > maxDdPct) maxDdPct = dd;
    }
    const config = {
        initialCapital: capital,
        periodValue,
        periodUnit,
        monthlySip,
        numDays,
        numMonths,
        totalSipContribution: sipTotalActual,
        totalCapital: capital + sipTotalActual,
        amountPerTrade,
        numSignalsAvailable,
        numTrades: totalTrades,
        minConfidence,
        tradeDirection,
        seed
    };
    const metrics = {
        startingCapital: capital,
        amountPerTrade,
        totalTrades,
        numDays,
        winTrades,
        lossTrades,
        winRate: Math.round(winRate * 10) / 10,
        avgWinPct: trades.filter((t)=>t.isWin).length > 0 ? trades.filter((t)=>t.isWin).reduce((s, t)=>s + t.netPnlPct, 0) / trades.filter((t)=>t.isWin).length : 0,
        avgLossPct: trades.filter((t)=>!t.isWin).length > 0 ? trades.filter((t)=>!t.isWin).reduce((s, t)=>s + t.netPnlPct, 0) / trades.filter((t)=>!t.isWin).length : 0,
        grossProfit,
        grossLoss,
        totalCosts,
        grossBeforeCosts: grossProfit - grossLoss,
        netPnL,
        finalValue,
        roiPct: Math.round(roiPct * 100) / 100,
        maxDrawdownPct: Math.round(maxDdPct * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        sharpe: Math.round(sharpe * 100) / 100,
        sortino: Math.round(sortino * 100) / 100,
        days: numDays,
        equityCurve
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        config,
        metrics,
        trades,
        // Flat aliases for the UI render
        initialAmount: capital,
        finalAmount: finalValue,
        totalPnl: netPnL,
        totalReturnPct: roiPct,
        wins: winTrades,
        losses: lossTrades,
        rows: trades,
        cached: false
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__89641587._.js.map