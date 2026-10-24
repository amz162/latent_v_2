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
"[project]/src/app/api/psx/companies/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
const dynamic = "force-dynamic";
const PYPSX_BASE = process.env.PYPSX_API_BASE || "https://paper-api.pypsx.com";
const PSXDATA_BASE = "https://psxdata-api.fastapicloud.dev";
let cache = null;
const TTL = 6 * 3600_000; // 6 hours — the listed-company set rarely changes
async function fetchPypsxSymbols() {
    const keyId = process.env.PYPSX_API_KEY_ID;
    const keySecret = process.env.PYPSX_API_SECRET_KEY;
    if (!keyId || !keySecret) return null;
    try {
        const r = await fetch(`${PYPSX_BASE}/symbols`, {
            headers: {
                "PYPSX-API-KEY-ID": keyId,
                "PYPSX-API-SECRET-KEY": keySecret,
                Accept: "application/json"
            },
            signal: AbortSignal.timeout(20000),
            cache: "no-store"
        });
        if (!r.ok) return null;
        const j = await r.json();
        const arr = Array.isArray(j?.symbols) ? j.symbols : Array.isArray(j) ? j : [];
        if (!arr.length) return null;
        return arr.map((s, i)=>({
                id: i + 1,
                value: String(s.symbol || s.value || "").toUpperCase(),
                label: String(s.name || s.label || s.symbol || ""),
                sector: s.sector ?? undefined
            })).filter((c)=>c.value);
    } catch  {
        return null;
    }
}
async function fetchPsxdataStocks() {
    try {
        const r = await fetch(`${PSXDATA_BASE}/stocks`, {
            headers: {
                Accept: "application/json",
                "User-Agent": "LatentBot/1.0"
            },
            signal: AbortSignal.timeout(20000),
            cache: "no-store"
        });
        if (!r.ok) return null;
        const j = await r.json();
        const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
        if (!arr.length) return null;
        return arr.map((s, i)=>({
                id: i + 1,
                value: String(s).toUpperCase(),
                label: String(s)
            })).filter((c)=>c.value);
    } catch  {
        return null;
    }
}
async function GET() {
    if (cache && cache.expiresAt > Date.now()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            companies: cache.value,
            source: cache.value?.[0]?.sector ? "pypsx+psxdata" : "psxdata",
            cached: true
        });
    }
    // Merge pypsx /symbols (506 with names+sectors) + psxdata /stocks (1048) so
    // StockSearch shows the FULL 1000+ universe — pypsx for the names, psxdata
    // to top up the rest (label = symbol where no name is available).
    const [pypsx, psxdata] = await Promise.all([
        fetchPypsxSymbols(),
        fetchPsxdataStocks()
    ]);
    let source = "psxdata";
    const byValue = new Map();
    let id = 1;
    if (pypsx) {
        source = "pypsx+psxdata";
        for (const c of pypsx){
            if (!byValue.has(c.value)) byValue.set(c.value, {
                id: id++,
                ...c
            });
        }
    }
    if (psxdata) {
        for (const c of psxdata){
            if (!byValue.has(c.value)) byValue.set(c.value, {
                id: id++,
                value: c.value,
                label: c.value
            });
        }
    }
    let companies = Array.from(byValue.values());
    if (!companies.length) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Failed to fetch symbol list"
        }, {
            status: 502
        });
    }
    cache = {
        value: companies,
        expiresAt: Date.now() + TTL
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        companies,
        source,
        count: companies.length,
        cached: false
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f0208d85._.js.map