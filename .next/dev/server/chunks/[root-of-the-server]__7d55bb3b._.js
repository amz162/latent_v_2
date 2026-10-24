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
"[project]/src/lib/latent/liveQuote.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "batchGetLiveQuotes",
    ()=>batchGetLiveQuotes,
    "evaluateOutcome",
    ()=>evaluateOutcome,
    "getLiveQuote",
    ()=>getLiveQuote
]);
/**
 * liveQuote — batch live PSX quote fetcher for the signal engine.
 *
 * Source: https://psxdata-api.fastapicloud.dev/stocks/{sym}/quote
 * (the same upstream used by /api/psx/live). Each per-symbol quote is cached
 * in-memory for 60s so a 280-stock batch doesn't hammer the upstream.
 *
 * Used by /api/signals/all to overlay LIVE prices on the ensemble-consensus
 * signals (issues 2, 3, 14) and to evaluate whether each signal has hit
 * TP1/TP2/TP3 or SL against the current live price (issue 14).
 */ const BASE_URL = "https://psxdata-api.fastapicloud.dev";
const QUOTE_TTL_MS = 60_000; // 60s per-quote cache
const PER_REQ_TIMEOUT_MS = 5_000;
const quoteCache = new Map();
async function getLiveQuote(symbol) {
    const sym = symbol.toUpperCase().replace(/XD$/, "");
    const now = Date.now();
    const hit = quoteCache.get(sym);
    if (hit && hit.expiresAt > now) return hit.value;
    let value = null;
    try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), PER_REQ_TIMEOUT_MS);
        const res = await fetch(`${BASE_URL}/stocks/${encodeURIComponent(sym)}/quote`, {
            headers: {
                "User-Agent": "LatentBot/1.0",
                Accept: "application/json"
            },
            signal: controller.signal,
            cache: "no-store"
        });
        clearTimeout(timer);
        if (res.ok) {
            const j = await res.json();
            const d = j?.data ?? j;
            if (d && typeof d.price === "number" && d.price > 0) value = d.price;
        }
    } catch  {
        value = null;
    }
    quoteCache.set(sym, {
        value,
        expiresAt: now + QUOTE_TTL_MS
    });
    return value;
}
async function batchGetLiveQuotes(symbols, concurrency = 25) {
    const out = new Map();
    const uniq = Array.from(new Set(symbols.map((s)=>s.toUpperCase())));
    let idx = 0;
    async function worker() {
        while(idx < uniq.length){
            const cur = uniq[idx++];
            const p = await getLiveQuote(cur);
            if (p != null) out.set(cur, p);
        }
    }
    const workers = Array.from({
        length: Math.min(concurrency, uniq.length)
    }, ()=>worker());
    await Promise.all(workers);
    return out;
}
function evaluateOutcome(o) {
    const { signal, entry, sl, tp1, tp2, tp3, livePrice } = o;
    if (!entry || !livePrice) return {
        outcome: "ACTIVE",
        pnlPct: 0
    };
    // Signed P&L vs entry in the signal's direction (BUY: +when price up; SELL: +when price down)
    const pnlPct = signal === "BUY" ? (livePrice - entry) / entry * 100 : (entry - livePrice) / entry * 100;
    let outcome = "ACTIVE";
    if (signal === "BUY") {
        if (livePrice >= tp3) outcome = "TP3_HIT";
        else if (livePrice >= tp2) outcome = "TP2_HIT";
        else if (livePrice >= tp1) outcome = "TP1_HIT";
        if (livePrice <= sl) outcome = "SL_HIT";
    } else {
        // SELL / SHORT — TPs are below entry, SL above
        if (livePrice <= tp3) outcome = "TP3_HIT";
        else if (livePrice <= tp2) outcome = "TP2_HIT";
        else if (livePrice <= tp1) outcome = "TP1_HIT";
        if (livePrice >= sl) outcome = "SL_HIT";
    }
    return {
        outcome,
        pnlPct
    };
}
}),
"[project]/src/app/api/psx/live/batch/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$liveQuote$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/liveQuote.ts [app-route] (ecmascript)");
;
;
const dynamic = "force-dynamic";
async function GET(req) {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols") || "";
    const symbols = symbolsParam.split(",").map((s)=>s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            prices: {},
            fetchedAt: new Date().toISOString(),
            source: "batch-empty"
        });
    }
    // Dedupe (a user could in theory have duplicate positions on the same
    // symbol — we only need to fetch each symbol once).
    const uniq = Array.from(new Set(symbols));
    // Fetch all live quotes in parallel — getLiveQuote's 60s cache handles
    // deduplication across requests.
    const entries = await Promise.all(uniq.map(async (sym)=>{
        const price = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$liveQuote$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getLiveQuote"])(sym);
        return [
            sym,
            price
        ];
    }));
    const prices = {};
    let resolved = 0;
    for (const [sym, price] of entries){
        if (typeof price === "number" && price > 0) {
            prices[sym] = price;
            resolved++;
        }
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        prices,
        fetchedAt: new Date().toISOString(),
        source: "psxdata-api",
        requested: uniq.length,
        resolved
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__7d55bb3b._.js.map