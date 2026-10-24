(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/latent/Tracker.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tracker",
    ()=>Tracker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/skeleton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/tabs.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trending-up.js [app-client] (ecmascript) <export default as TrendingUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trending-down.js [app-client] (ecmascript) <export default as TrendingDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/activity.js [app-client] (ecmascript) <export default as Activity>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/briefcase.js [app-client] (ecmascript) <export default as Briefcase>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$brain$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Brain$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/brain.js [app-client] (ecmascript) <export default as Brain>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/target.js [app-client] (ecmascript) <export default as Target>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wallet.js [app-client] (ecmascript) <export default as Wallet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/rotate-ccw.js [app-client] (ecmascript) <export default as RotateCcw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock.js [app-client] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$pie$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PieChart$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chart-pie.js [app-client] (ecmascript) <export default as PieChart>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$history$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__History$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/history.js [app-client] (ecmascript) <export default as History>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$piggy$2d$bank$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PiggyBank$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/piggy-bank.js [app-client] (ecmascript) <export default as PiggyBank>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$company$2d$results$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-company-results.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
// The 8 PSX stocks covered by our AI model signal engine — still used by the
// Signal Tracker stats cards (4 top cards). The Investment Simulator (Issue 13)
// no longer uses these — it pulls ALL ~284 final-consensus signals from
// /api/signals/all and runs the backtest on the OhlcvBar DB (100 KSE-100 stocks).
const COVERED_SYMBOLS = [
    "ENGRO",
    "HUBC",
    "LUCK",
    "SYS",
    "MEBL",
    "PSO",
    "OGDC",
    "PPL"
];
const PERIOD_UNITS = [
    {
        value: "day",
        label: "days"
    },
    {
        value: "month",
        label: "months"
    },
    {
        value: "year",
        label: "years"
    }
];
function fmtPct(v, withSign = false) {
    const sign = withSign && v > 0 ? "+" : "";
    return `${sign}${Number(v).toFixed(2)}%`;
}
function fmtPkr(v) {
    return `Rs. ${Math.round(v).toLocaleString("en-PK")}`;
}
function Tracker() {
    _s();
    const [aiSignals, setAiSignals] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    // Issue 13: removed `timeframe` state — the per-symbol signals fetch now
    // always uses ?timeframe=1m (the API ignores it anyway per the original
    // comment). The Investment Simulator uses /api/backtest/investment-simulator
    // directly (which derives numDays from the user's time-period input).
    const timeframe = "1m";
    const portfolio = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "Tracker.useLatentStore[portfolio]": (s)=>s.portfolio
    }["Tracker.useLatentStore[portfolio]"]);
    const closedTrades = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "Tracker.useLatentStore[closedTrades]": (s)=>s.closedTrades
    }["Tracker.useLatentStore[closedTrades]"]);
    // ─── Issue 14: Signal History — final ensemble consensus for ALL ~361 stocks
    // (not just the 8 hardcoded COVERED_SYMBOLS). The /api/signals/all endpoint
    // returns the same finalConsensus value used by the Signals tab, with a LIVE
    // price overlay and the TP1/TP2/TP3/SL outcome already evaluated server-side.
    const [signalHistory, setSignalHistory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [historyLoading, setHistoryLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [historyError, setHistoryError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [outcomeFilter, setOutcomeFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("ALL");
    const [confFilter, setConfFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [historySort, setHistorySort] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("rr");
    // Issue 18: fetch /api/psx/companies once on mount so we can look up each
    // portfolio position's sector for the pie chart. Positions added before the
    // store had a sector field (legacy localStorage entries) won't have sector
    // info — this map fills the gap.
    const [sectorMap, setSectorMap] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Tracker.useEffect": ()=>{
            let cancelled = false;
            fetch("/api/psx/companies").then({
                "Tracker.useEffect": (r)=>r.ok ? r.json() : null
            }["Tracker.useEffect"]).then({
                "Tracker.useEffect": (d)=>{
                    if (cancelled || !d?.companies) return;
                    const m = {};
                    for (const c of d.companies){
                        if (c?.value && c?.sector) m[String(c.value).toUpperCase()] = c.sector;
                    }
                    setSectorMap(m);
                }
            }["Tracker.useEffect"]).catch({
                "Tracker.useEffect": ()=>{}
            }["Tracker.useEffect"]);
            return ({
                "Tracker.useEffect": ()=>{
                    cancelled = true;
                }
            })["Tracker.useEffect"];
        }
    }["Tracker.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Tracker.useEffect": ()=>{
            let cancelled = false;
            Promise.all(COVERED_SYMBOLS.map({
                "Tracker.useEffect": (sym)=>fetch(`/api/ai-model-signals/${sym}?refresh=1&timeframe=${timeframe}`).then({
                        "Tracker.useEffect": (r)=>r.json()
                    }["Tracker.useEffect"]).catch({
                        "Tracker.useEffect": ()=>null
                    }["Tracker.useEffect"])
            }["Tracker.useEffect"])).then({
                "Tracker.useEffect": (results)=>{
                    if (cancelled) return;
                    const valid = results.filter(Boolean);
                    setAiSignals(valid);
                }
            }["Tracker.useEffect"]).finally({
                "Tracker.useEffect": ()=>{
                    if (!cancelled) setLoading(false);
                }
            }["Tracker.useEffect"]);
            return ({
                "Tracker.useEffect": ()=>{
                    cancelled = true;
                }
            })["Tracker.useEffect"];
        }
    }["Tracker.useEffect"], [
        timeframe
    ]);
    // Issue 14: fetch the Signal History dataset (all ~361 ensemble signals, with
    // LIVE price + outcome). Cached 120s server-side; the `?refresh=1` query is
    // used by the manual "Refresh" button so the user can force a fresh fetch.
    const refreshHistory = (force = false)=>{
        setHistoryLoading(true);
        setHistoryError(null);
        const qs = force ? "?refresh=1" : "";
        fetch(`/api/signals/all${qs}`).then((r)=>r.ok ? r.json() : null).then((j)=>{
            if (j?.signals) setSignalHistory(j.signals);
            else setHistoryError("Signal history unavailable");
        }).catch(()=>setHistoryError("Failed to load signal history")).finally(()=>setHistoryLoading(false));
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Tracker.useEffect": ()=>{
            let cancelled = false;
            fetch("/api/signals/all").then({
                "Tracker.useEffect": (r)=>r.ok ? r.json() : null
            }["Tracker.useEffect"]).then({
                "Tracker.useEffect": (j)=>{
                    if (cancelled) return;
                    if (j?.signals) setSignalHistory(j.signals);
                    else setHistoryError("Signal history unavailable");
                }
            }["Tracker.useEffect"]).catch({
                "Tracker.useEffect": ()=>{
                    if (!cancelled) setHistoryError("Failed to load signal history");
                }
            }["Tracker.useEffect"]).finally({
                "Tracker.useEffect": ()=>{
                    if (!cancelled) setHistoryLoading(false);
                }
            }["Tracker.useEffect"]);
            return ({
                "Tracker.useEffect": ()=>{
                    cancelled = true;
                }
            })["Tracker.useEffect"];
        }
    }["Tracker.useEffect"], []);
    // Issue 14: filter + sort the Signal History rows by outcome, min confidence,
    // and the chosen sort key (R:R / confidence / live P&L).
    const filteredHistory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[filteredHistory]": ()=>{
            let rows = signalHistory.filter({
                "Tracker.useMemo[filteredHistory].rows": (s)=>s.confidence >= confFilter
            }["Tracker.useMemo[filteredHistory].rows"]);
            if (outcomeFilter === "TP") {
                rows = rows.filter({
                    "Tracker.useMemo[filteredHistory]": (s)=>s.outcome === "TP1_HIT" || s.outcome === "TP2_HIT" || s.outcome === "TP3_HIT"
                }["Tracker.useMemo[filteredHistory]"]);
            } else if (outcomeFilter === "SL") {
                rows = rows.filter({
                    "Tracker.useMemo[filteredHistory]": (s)=>s.outcome === "SL_HIT"
                }["Tracker.useMemo[filteredHistory]"]);
            } else if (outcomeFilter === "ACTIVE") {
                rows = rows.filter({
                    "Tracker.useMemo[filteredHistory]": (s)=>s.outcome === "ACTIVE"
                }["Tracker.useMemo[filteredHistory]"]);
            } else {
                // Default: show only HIT signals (TP/SL hit) — ACTIVE signals stay in the Signals tab
                rows = rows.filter({
                    "Tracker.useMemo[filteredHistory]": (s)=>s.outcome && s.outcome !== "ACTIVE"
                }["Tracker.useMemo[filteredHistory]"]);
            }
            rows = [
                ...rows
            ].sort({
                "Tracker.useMemo[filteredHistory]": (a, b)=>{
                    if (historySort === "conf") return b.confidence - a.confidence;
                    if (historySort === "pnl") return b.pnlPct - a.pnlPct;
                    return b.riskReward - a.riskReward;
                }
            }["Tracker.useMemo[filteredHistory]"]);
            return rows;
        }
    }["Tracker.useMemo[filteredHistory]"], [
        signalHistory,
        confFilter,
        outcomeFilter,
        historySort
    ]);
    // Lookup helper for human-readable timeframe label (kept for the report download)
    const timeframeLabel = "1 month";
    const timeframeShort = "1M";
    // Ensemble-level backtesting stats — these are global (same across symbols)
    // so we just use the first available response as the source of truth.
    const ensStats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[ensStats]": ()=>{
            if (aiSignals.length === 0) return null;
            const eb = aiSignals[0]?.ensembleBacktesting || {};
            return {
                fc: eb["FINAL_CONSENSUS"] || {},
                mv: eb["MAJORITY_VOTE"] || {},
                pw: eb["PROBABILITY_WEIGHTED"] || {},
                tw: eb["TIER_WEIGHTED"] || {}
            };
        }
    }["Tracker.useMemo[ensStats]"], [
        aiSignals
    ]);
    // Per-model backtesting rows — top 6 by win rate.
    const modelBacktest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[modelBacktest]": ()=>{
            if (aiSignals.length === 0) return [];
            const bt = aiSignals[0]?.backtesting || {};
            return Object.entries(bt).map({
                "Tracker.useMemo[modelBacktest]": ([name, s])=>({
                        name,
                        ...s
                    })
            }["Tracker.useMemo[modelBacktest]"]).filter({
                "Tracker.useMemo[modelBacktest]": (m)=>typeof m.winRate === "number"
            }["Tracker.useMemo[modelBacktest]"]).sort({
                "Tracker.useMemo[modelBacktest]": (a, b)=>(b.winRate || 0) - (a.winRate || 0)
            }["Tracker.useMemo[modelBacktest]"]).slice(0, 6);
        }
    }["Tracker.useMemo[modelBacktest]"], [
        aiSignals
    ]);
    // Per-stock signals from finalConsensus — KEPT (used by the Signal Tracker
    // stats cards and the report download). The Investment Simulator (Issue 13)
    // no longer uses these — it pulls from /api/signals/all (all ~284 stocks)
    // via the /api/backtest/investment-simulator endpoint.
    const stockSignals = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[stockSignals]": ()=>{
            return aiSignals.map({
                "Tracker.useMemo[stockSignals]": (s)=>{
                    const fc = s.finalConsensus;
                    if (!fc || !fc.entry || fc.signal === "HOLD") return null;
                    const target = fc.predictedPriceRange?.max || fc.tp3 || fc.entry;
                    const retPct = (target - fc.entry) / fc.entry * 100;
                    return {
                        symbol: s.symbol,
                        stockName: s.stockName,
                        direction: fc.direction,
                        signal: fc.signal,
                        entry: fc.entry,
                        target,
                        sl: fc.sl,
                        retPct,
                        confidence: fc.confidence,
                        agreement: fc.agreement,
                        currentPrice: s.currentPrice
                    };
                }
            }["Tracker.useMemo[stockSignals]"]).filter(Boolean);
        }
    }["Tracker.useMemo[stockSignals]"], [
        aiSignals
    ]);
    const [simCapital, setSimCapital] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("100000");
    const [simPeriodValue, setSimPeriodValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("3");
    const [simPeriodUnit, setSimPeriodUnit] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("month");
    const [simMonthlySip, setSimMonthlySip] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("0");
    // Issue 40: new user-configurable inputs — no of trades + min confidence.
    const [simNumTrades, setSimNumTrades] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("40");
    const [simMinConfidence, setSimMinConfidence] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("0");
    // Issue 41: trade direction filter — All / Buy only / Sell only.
    const [simTradeDirection, setSimTradeDirection] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("all");
    const [simResult, setSimResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [simLoading, setSimLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const runSimulation = async ()=>{
        const capital = parseFloat(simCapital.replace(/[,\s]/g, ""));
        const periodValue = parseInt(simPeriodValue, 10);
        const monthlySip = parseFloat(simMonthlySip.replace(/[,\s]/g, "")) || 0;
        const numTrades = parseInt(simNumTrades, 10);
        const minConfidence = parseInt(simMinConfidence, 10);
        if (!Number.isFinite(capital) || capital <= 0) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Enter a valid capital amount");
            return;
        }
        if (!Number.isFinite(periodValue) || periodValue <= 0) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Enter a valid time period");
            return;
        }
        if (!Number.isFinite(numTrades) || numTrades <= 0) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Enter a valid number of trades");
            return;
        }
        if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 100) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Min confidence must be 0–100");
            return;
        }
        setSimLoading(true);
        try {
            const qs = `capital=${encodeURIComponent(simCapital)}` + `&periodValue=${encodeURIComponent(simPeriodValue)}` + `&periodUnit=${encodeURIComponent(simPeriodUnit)}` + `&monthlySip=${encodeURIComponent(simMonthlySip)}` + `&numTrades=${encodeURIComponent(simNumTrades)}` + `&minConfidence=${encodeURIComponent(simMinConfidence)}` + `&tradeDirection=${encodeURIComponent(simTradeDirection)}`;
            const r = await fetch(`/api/backtest/investment-simulator?${qs}`);
            const j = await r.json();
            if (j.error) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error(j.error);
                return;
            }
            setSimResult(j);
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(`Simulated ${j.config.numTrades} trades over ${j.config.numDays} days — ROI ${j.metrics.roiPct}%`);
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Simulation failed");
        } finally{
            setSimLoading(false);
        }
    };
    const resetSimulation = ()=>{
        setSimResult(null);
    };
    // Aggregate top-card stats — uses ensembleBacktesting.FINAL_CONSENSUS.
    const signalStats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[signalStats]": ()=>{
            const fc = ensStats?.fc;
            if (!fc) return null;
            const total = fc.totalTrades ?? 0;
            const wins = fc.wins ?? Math.round(total * (fc.winRate || 0) / 100);
            const losses = total - wins;
            const winRate = fc.winRate ?? 0;
            const avgReturn = fc.avgReturnPct ?? 0;
            const best = fc.maxReturnPct ?? 0;
            const worst = fc.minReturnPct ?? 0;
            return {
                total,
                wins,
                losses,
                winRate,
                avgReturn,
                best,
                worst
            };
        }
    }["Tracker.useMemo[signalStats]"], [
        ensStats
    ]);
    // Portfolio tracker — only positions with buyPrice != null && shares > 0
    // are tracked. Closed positions remain in the list and contribute to P&L.
    // Issue 23: keep closed trades visible + reflect them in top card stats.
    //
    // Issue 26: fetch LIVE prices for ALL portfolio holdings (not just the 8
    // COVERED_SYMBOLS). Hits /api/psx/live/batch (server wraps getLiveQuote
    // with a 60s in-memory cache). Auto-refreshes every 60s to match the cache
    // TTL. Symbols with no fetchable quote are simply omitted from the response
    // (the row falls back to "no live price").
    const portfolioSymbols = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[portfolioSymbols]": ()=>portfolio.filter({
                "Tracker.useMemo[portfolioSymbols]": (p)=>p.buyPrice !== null && p.shares > 0
            }["Tracker.useMemo[portfolioSymbols]"]).map({
                "Tracker.useMemo[portfolioSymbols]": (p)=>p.symbol
            }["Tracker.useMemo[portfolioSymbols]"])
    }["Tracker.useMemo[portfolioSymbols]"], [
        portfolio
    ]);
    const portfolioSymbolsKey = portfolioSymbols.join(",");
    const [livePriceBatch, setLivePriceBatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Tracker.useEffect": ()=>{
            if (!portfolioSymbolsKey) {
                setLivePriceBatch({});
                return;
            }
            let cancelled = false;
            const symbolsList = Array.from(new Set(portfolioSymbols));
            const doFetch = {
                "Tracker.useEffect.doFetch": ()=>fetch(`/api/psx/live/batch?symbols=${encodeURIComponent(symbolsList.join(","))}`).then({
                        "Tracker.useEffect.doFetch": (r)=>r.ok ? r.json() : null
                    }["Tracker.useEffect.doFetch"]).then({
                        "Tracker.useEffect.doFetch": (d)=>{
                            if (cancelled || !d?.prices) return;
                            setLivePriceBatch(d.prices);
                        }
                    }["Tracker.useEffect.doFetch"]).catch({
                        "Tracker.useEffect.doFetch": ()=>{}
                    }["Tracker.useEffect.doFetch"])
            }["Tracker.useEffect.doFetch"];
            doFetch();
            const id = setInterval(doFetch, 60_000);
            return ({
                "Tracker.useEffect": ()=>{
                    cancelled = true;
                    clearInterval(id);
                }
            })["Tracker.useEffect"];
        }
    }["Tracker.useEffect"], [
        portfolioSymbolsKey
    ]);
    const livePriceMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[livePriceMap]": ()=>{
            const m = {};
            // 1) Seed with the 8 COVERED_SYMBOLS' currentPrice (used by the Signal Tracker tab cards)
            for (const s of aiSignals){
                if (s.symbol && typeof s.currentPrice === "number") m[s.symbol] = s.currentPrice;
            }
            // 2) Overlay true LIVE prices for ALL portfolio holdings (covers non-KSE-100 too)
            for (const [sym, price] of Object.entries(livePriceBatch)){
                if (typeof price === "number" && price > 0) m[sym] = price;
            }
            return m;
        }
    }["Tracker.useMemo[livePriceMap]"], [
        aiSignals,
        livePriceBatch
    ]);
    const portfolioPositions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[portfolioPositions]": ()=>portfolio.filter({
                "Tracker.useMemo[portfolioPositions]": (p)=>p.buyPrice !== null && p.shares > 0
            }["Tracker.useMemo[portfolioPositions]"])
    }["Tracker.useMemo[portfolioPositions]"], [
        portfolio
    ]);
    const portfolioStats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[portfolioStats]": ()=>{
            let totalValue = 0;
            let totalInvested = 0;
            let totalPnl = 0;
            let openCount = 0;
            let hasLiveForOpen = false;
            let hasAnyPnl = false;
            // Open positions (from portfolio store, shares > 0)
            for (const p of portfolioPositions){
                const buy = p.buyPrice || 0;
                const invested = buy * p.shares;
                totalInvested += invested;
                openCount++;
                const live = livePriceMap[p.symbol];
                if (typeof live === "number") {
                    const val = live * p.shares;
                    totalValue += val;
                    totalPnl += val - invested;
                    hasLiveForOpen = true;
                    hasAnyPnl = true;
                }
            }
            // Issue 18: closed trades from the close flow (closedTrades in store)
            // add their net P&L to the totals. They have no remaining market value
            // (shares were sold), but their net P&L contributes to total P&L.
            let closedCount = 0;
            let closedWins = 0;
            let closedNetPnl = 0;
            for (const t of closedTrades){
                closedCount++;
                closedNetPnl += t.netPnl;
                if (t.netPnl > 0) closedWins++;
            }
            totalPnl += closedNetPnl;
            if (closedCount > 0) hasAnyPnl = true;
            const roiPct = totalInvested > 0 ? totalPnl / totalInvested * 100 : 0;
            const winRate = closedCount > 0 ? closedWins / closedCount * 100 : null;
            return {
                total: openCount + closedCount,
                totalValue,
                totalInvested,
                totalPnl,
                roiPct,
                openCount,
                closedCount,
                closedWins,
                winRate,
                hasLiveForOpen,
                hasAnyPnl
            };
        }
    }["Tracker.useMemo[portfolioStats]"], [
        portfolioPositions,
        livePriceMap,
        closedTrades
    ]);
    // Issue 18: sector-wise holding distribution for the pie chart.
    // For each open position: value = (livePrice || buyPrice) × shares.
    // Sector is taken from position.sector (stored at add-time) or from the
    // sectorMap fetched on mount, else falls back to "Other".
    const sectorData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "Tracker.useMemo[sectorData]": ()=>{
            const m = new Map();
            for (const p of portfolioPositions){
                const live = livePriceMap[p.symbol];
                const buy = p.buyPrice || 0;
                const price = typeof live === "number" ? live : buy;
                if (price <= 0 || p.shares <= 0) continue;
                const value = price * p.shares;
                // Issue 27: 3-tier sector lookup so a holding's sector is always set:
                //  1) the position's stored sector (set at Add time from StockSearch),
                //  2) the sectorMap (from /api/psx/companies, now overlays classifySector),
                //  3) classifySector(symbol) — covers ~80 common PSX stocks (Cement /
                //     Oil & Gas / Refinery / Banking / etc.); unmapped → "Other".
                // Issue 28+29: treat the legacy "Conglomerate" string (from old
                // localStorage entries or mock-stocks.ts) as INVALID — fall through to
                // the next tier so we never display "Conglomerate" as a chart slice.
                // "Other" is the only fallback for unmapped symbols.
                const stored = p.sector && p.sector.trim();
                const sector = (stored && stored !== "Conglomerate" ? stored : "") || sectorMap[p.symbol] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$company$2d$results$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySector"])(p.symbol);
                m.set(sector, (m.get(sector) || 0) + value);
            }
            const total = Array.from(m.values()).reduce({
                "Tracker.useMemo[sectorData].total": (s, v)=>s + v
            }["Tracker.useMemo[sectorData].total"], 0);
            if (total <= 0) return [];
            return Array.from(m.entries()).map({
                "Tracker.useMemo[sectorData]": ([sector, value])=>({
                        sector,
                        value,
                        pct: value / total * 100
                    })
            }["Tracker.useMemo[sectorData]"]).sort({
                "Tracker.useMemo[sectorData]": (a, b)=>b.value - a.value
            }["Tracker.useMemo[sectorData]"]);
        }
    }["Tracker.useMemo[sectorData]"], [
        portfolioPositions,
        livePriceMap,
        sectorMap
    ]);
    const handleDownload = ()=>{
        if (!signalStats) return;
        const lines = [
            "Latent.pk — Tracker Report (Real Backtest Data)",
            "Generated: " + new Date().toISOString(),
            "Source: /api/ai-model-signals/[symbol]?refresh=1",
            "Covered: " + COVERED_SYMBOLS.join(", "),
            `Timeframe: ${timeframeLabel}`,
            "",
            `=== SIGNAL TRACKER (Last ${timeframeLabel} Backtest) ===`,
            `Total signals: ${signalStats.total}`,
            `Win rate: ${signalStats.winRate}%`,
            `Avg return: ${fmtPct(signalStats.avgReturn, true)}`,
            `Best trade: ${fmtPct(signalStats.best, true)}`,
            `Worst trade: ${fmtPct(signalStats.worst)}`,
            "",
            "=== PER-STOCK SIGNALS (FINAL CONSENSUS) ===",
            ...stockSignals.map((s)=>`${s.symbol} ${s.signal} entry=${s.entry} target=${s.target} ret=${fmtPct(s.retPct, true)} conf=${s.confidence}%`),
            "",
            "=== PORTFOLIO TRACKER (OPEN POSITIONS) ===",
            ...portfolioPositions.map((p)=>{
                const side = (p.status || "open") === "open" ? "open" : "closed";
                const close = typeof p.closePrice === "number" ? p.closePrice : null;
                return `${p.symbol} | ${side} | buy: ${p.buyPrice || "—"} | shares: ${p.shares}${close !== null ? ` | close: ${close}` : ""}`;
            }),
            "",
            "=== CLOSED TRADES (FROM PORTFOLIO CLOSE FLOW) ===",
            ...closedTrades.map((t)=>`${t.symbol} | buy: ${t.buyPrice} × ${t.shares} = ${Math.round(t.buyCost)} | sell: ${t.sellPrice.toFixed(2)} × ${t.shares} = ${Math.round(t.sellValue)} | commission: ${Math.round(t.commission)} | CGT: ${Math.round(t.cgt)} (${(t.taxRate * 100).toFixed(0)}%) | net P&L: ${Math.round(t.netPnl)} (${t.netPnlPct >= 0 ? "+" : ""}${t.netPnlPct.toFixed(2)}%) | holding: ${t.holdingDays}d | closed: ${t.closedAt}`)
        ];
        const blob = new Blob([
            lines.join("\n")
        ], {
            type: "text/plain"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `latent-tracker-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success("Tracker report downloaded");
    };
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "max-w-6xl mx-auto p-6 space-y-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                    className: "h-10 w-48 bg-white/[0.04]"
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 684,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                    className: "h-32 w-full bg-white/[0.04]"
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 685,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                    className: "h-64 w-full bg-white/[0.04]"
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 686,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/latent/Tracker.tsx",
            lineNumber: 683,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "px-4 md:px-6 py-6 max-w-6xl mx-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between mb-6 flex-wrap gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-2xl font-bold text-[#F4F7FB]",
                                children: "Tracker"
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 695,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-[#94A3B8] mt-1",
                                children: [
                                    "Real backtest stats across ",
                                    COVERED_SYMBOLS.length,
                                    " PSX stocks — signal tracker (model performance) + portfolio tracker (your P&L)."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 696,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 694,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        onClick: handleDownload,
                        className: "bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                className: "h-4 w-4 mr-1.5"
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 704,
                                columnNumber: 13
                            }, this),
                            "Generate report"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 700,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 693,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tabs"], {
                defaultValue: "signal",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsList"], {
                        className: "bg-[#131829] border border-white/[0.08] p-1 h-auto",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "signal",
                                className: "data-[state=active]:bg-[#00E676]/10 data-[state=active]:text-[#00E676] text-[#94A3B8] text-xs gap-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 712,
                                        columnNumber: 15
                                    }, this),
                                    " Signal Tracker"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 711,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsTrigger"], {
                                value: "portfolio",
                                className: "data-[state=active]:bg-[#00E676]/10 data-[state=active]:text-[#00E676] text-[#94A3B8] text-xs gap-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__["Briefcase"], {
                                        className: "h-3 w-3"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 715,
                                        columnNumber: 15
                                    }, this),
                                    " Portfolio Tracker"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 714,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 710,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                        value: "signal",
                        className: "mt-4",
                        children: !signalStats ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                            className: "bg-[#131829] border-white/[0.08]",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                className: "p-12 text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$brain$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Brain$3e$__["Brain"], {
                                        className: "h-12 w-12 text-[#00E676]/30 mx-auto mb-3"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 724,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "font-semibold text-[#F4F7FB] mb-1",
                                        children: "Backtest data unavailable"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 725,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-[#94A3B8]",
                                        children: [
                                            "Run ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                                                className: "text-[#00E676]",
                                                children: "python3 scripts/train_all_with_backtesting.py"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 727,
                                                columnNumber: 25
                                            }, this),
                                            " to populate model predictions."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 726,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 723,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/Tracker.tsx",
                            lineNumber: 722,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                    className: "bg-[#131829] border-[#00E676]/20 mb-5",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                        className: "p-4",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-1.5 mb-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                                        className: "h-3.5 w-3.5 text-[#00E676]"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 737,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "font-semibold text-[#F4F7FB] text-sm",
                                                        children: "Investment simulator"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 738,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                        variant: "outline",
                                                        className: "text-[8px] py-0 h-3.5 border-[#00E676]/30 text-[#00E676]/80 ml-1",
                                                        children: "TOP"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 739,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 736,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-[#94A3B8] mb-3",
                                                children: "Enter capital, no of trades, time period (day/month/year), monthly SIP, min confidence, and trade direction. The simulator takes exactly the no of trades you specify from the Final Ensemble Consensus signals (filtered by confidence + direction), goes back to the time period you give, enters each trade at a real historical bar (with date), and adds monthly SIP after each month. Results show per-trade entry/exit dates."
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 743,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col gap-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Investment (PKR)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 753,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: simCapital,
                                                                onChange: (e)=>setSimCapital(e.target.value),
                                                                onKeyDown: (e)=>e.key === "Enter" && runSimulation(),
                                                                placeholder: "100000",
                                                                inputMode: "decimal",
                                                                className: "h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 754,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 752,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col gap-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "No of trades"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 758,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: simNumTrades,
                                                                onChange: (e)=>setSimNumTrades(e.target.value),
                                                                onKeyDown: (e)=>e.key === "Enter" && runSimulation(),
                                                                placeholder: "40",
                                                                inputMode: "numeric",
                                                                className: "h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 759,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 757,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col gap-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Monthly SIP (PKR)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 763,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: simMonthlySip,
                                                                onChange: (e)=>setSimMonthlySip(e.target.value),
                                                                onKeyDown: (e)=>e.key === "Enter" && runSimulation(),
                                                                placeholder: "0",
                                                                inputMode: "decimal",
                                                                className: "h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 764,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 762,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col gap-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Min confidence (0-100)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 768,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: simMinConfidence,
                                                                onChange: (e)=>setSimMinConfidence(e.target.value),
                                                                onKeyDown: (e)=>e.key === "Enter" && runSimulation(),
                                                                placeholder: "0",
                                                                inputMode: "numeric",
                                                                className: "h-9 bg-[#0A0E1A] border-white/[0.08] text-sm font-mono text-[#F4F7FB]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 769,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 767,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 750,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-lg bg-[#0A0E1A] border border-white/[0.08] p-3 mb-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-1.5 mb-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 776,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[11px] font-semibold uppercase tracking-wider text-[#F4F7FB]",
                                                                children: "Time period"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 777,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] text-[#64748B]",
                                                                children: "· go back this many periods from today"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 778,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 775,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: simPeriodValue,
                                                                onChange: (e)=>setSimPeriodValue(e.target.value),
                                                                onKeyDown: (e)=>e.key === "Enter" && runSimulation(),
                                                                placeholder: "3",
                                                                inputMode: "numeric",
                                                                className: "h-9 w-24 bg-[#131829] border-white/[0.08] text-sm font-mono text-[#F4F7FB]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 781,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                                value: simPeriodUnit,
                                                                onChange: (e)=>setSimPeriodUnit(e.target.value),
                                                                className: "h-9 flex-1 bg-[#131829] border border-white/[0.08] rounded-md text-sm font-mono text-[#F4F7FB] px-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: "day",
                                                                        children: "day(s)"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 783,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: "month",
                                                                        children: "month(s)"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 784,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                        value: "year",
                                                                        children: "year(s)"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 785,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 782,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 780,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 774,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-lg bg-[#0A0E1A] border border-white/[0.08] p-3 mb-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-1.5 mb-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__["Activity"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 793,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[11px] font-semibold uppercase tracking-wider text-[#F4F7FB]",
                                                                children: "Trade direction"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 794,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] text-[#64748B]",
                                                                children: "· simulate only these signals"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 795,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 792,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-1.5",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>setSimTradeDirection("all"),
                                                                className: `px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${simTradeDirection === "all" ? "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40" : "bg-[#131829] text-[#94A3B8] border border-white/[0.08] hover:text-[#F4F7FB]"}`,
                                                                children: "All trades"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 798,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>setSimTradeDirection("buy"),
                                                                className: `px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${simTradeDirection === "buy" ? "bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/40" : "bg-[#131829] text-[#94A3B8] border border-white/[0.08] hover:text-[#F4F7FB]"}`,
                                                                children: "Buy only"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 801,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>setSimTradeDirection("sell"),
                                                                className: `px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors ${simTradeDirection === "sell" ? "bg-[#FF5C5C]/15 text-[#FF5C5C] border border-[#FF5C5C]/40" : "bg-[#131829] text-[#94A3B8] border border-white/[0.08] hover:text-[#F4F7FB]"}`,
                                                                children: "Sell only"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 804,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 797,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 791,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-2 mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        onClick: runSimulation,
                                                        disabled: simLoading,
                                                        className: "bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold h-9 disabled:opacity-60 disabled:cursor-not-allowed",
                                                        children: simLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                                    className: "h-3.5 w-3.5 mr-1.5 animate-spin"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                    lineNumber: 822,
                                                                    columnNumber: 29
                                                                }, this),
                                                                "Simulating..."
                                                            ]
                                                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                                    className: "h-3.5 w-3.5 mr-1.5"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                    lineNumber: 827,
                                                                    columnNumber: 29
                                                                }, this),
                                                                "Simulate"
                                                            ]
                                                        }, void 0, true)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 815,
                                                        columnNumber: 23
                                                    }, this),
                                                    simResult && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                        onClick: resetSimulation,
                                                        variant: "outline",
                                                        disabled: simLoading,
                                                        className: "border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB] h-9 disabled:opacity-60",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__["RotateCcw"], {
                                                                className: "h-3.5 w-3.5 mr-1.5"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 834,
                                                                columnNumber: 27
                                                            }, this),
                                                            "Reset"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 833,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#64748B] ml-auto self-center",
                                                        children: simLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-[#00E676] animate-pulse",
                                                            children: "Running simulation... please wait"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                            lineNumber: 839,
                                                            columnNumber: 27
                                                        }, this) : simResult ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: [
                                                                "Final Ensemble Consensus · ",
                                                                simResult.config.numTrades,
                                                                " trades"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                            lineNumber: 841,
                                                            columnNumber: 27
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            children: "Final Ensemble Consensus signals"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                            lineNumber: 843,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 837,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 810,
                                                columnNumber: 21
                                            }, this),
                                            simLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "rounded-lg border border-[#00E676]/20 bg-[#00E676]/[0.04] p-4 mb-4 flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                        className: "h-5 w-5 text-[#00E676] animate-spin shrink-0"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 852,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-sm font-semibold text-[#00E676]",
                                                                children: "Simulation in progress..."
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 854,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-[11px] text-[#94A3B8]",
                                                                children: [
                                                                    "Fetching Final Ensemble Consensus signals, filtering by confidence ≥ ",
                                                                    simMinConfidence,
                                                                    " + direction: ",
                                                                    simTradeDirection,
                                                                    ", picking ",
                                                                    simNumTrades,
                                                                    " trades within the last ",
                                                                    simPeriodValue,
                                                                    " ",
                                                                    simPeriodUnit,
                                                                    "(s), walking through real OHLCV bars."
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 855,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 853,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 851,
                                                columnNumber: 23
                                            }, this),
                                            simResult && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "rounded-lg border border-white/[0.06] bg-[#0A0E1A] p-3 mb-3",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "text-sm text-[#F4F7FB] leading-relaxed",
                                                                children: [
                                                                    "If you invested",
                                                                    " ",
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "font-mono font-bold text-[#00E676]",
                                                                        children: fmtPkr(simResult.initialAmount)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 868,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    " ",
                                                                    "across",
                                                                    " ",
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "font-mono font-bold text-[#F4F7FB]",
                                                                        children: [
                                                                            simResult.rows.length,
                                                                            " trades"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 870,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    ", your final amount would be",
                                                                    " ",
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: `font-mono font-bold ${simResult.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                                        children: fmtPkr(simResult.finalAmount)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 872,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    " ",
                                                                    "(",
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: `font-mono font-bold ${simResult.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                                        children: [
                                                                            simResult.totalPnl >= 0 ? "+" : "",
                                                                            simResult.totalReturnPct.toFixed(2),
                                                                            "% ",
                                                                            simResult.totalPnl >= 0 ? "gain" : "loss"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 876,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    ")"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 866,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex flex-wrap items-center gap-4 mt-2 text-[11px]",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-[#94A3B8]",
                                                                        children: [
                                                                            "Total P&L:",
                                                                            " ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: `font-mono font-semibold ${simResult.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                                                children: [
                                                                                    simResult.totalPnl >= 0 ? "+" : "",
                                                                                    fmtPkr(simResult.totalPnl)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 885,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 883,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-[#94A3B8]",
                                                                        children: [
                                                                            "Wins: ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "font-mono text-[#00E676]",
                                                                                children: simResult.wins
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 890,
                                                                                columnNumber: 37
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 889,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-[#94A3B8]",
                                                                        children: [
                                                                            "Losses: ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "font-mono text-[#FF5C5C]",
                                                                                children: simResult.losses
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 893,
                                                                                columnNumber: 39
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 892,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "text-[#94A3B8]",
                                                                        children: [
                                                                            "Win rate:",
                                                                            " ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "font-mono text-[#F4F7FB]",
                                                                                children: [
                                                                                    simResult.rows.length > 0 ? (simResult.wins / simResult.rows.length * 100).toFixed(1) : 0,
                                                                                    "%"
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 897,
                                                                                columnNumber: 31
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 895,
                                                                        columnNumber: 29
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 882,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 865,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "overflow-x-auto max-h-80 overflow-y-auto rounded-md border border-white/[0.06]",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                                            className: "w-full text-sm whitespace-nowrap",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                                    className: "sticky top-0 bg-[#131829]",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                        className: "text-[10px] uppercase tracking-wider text-[#64748B] border-b border-white/[0.06]",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "#"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 912,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "Symbol"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 913,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "Side"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 914,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "Entry date"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 915,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-right py-2 px-3 font-semibold",
                                                                                children: "Entry price"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 916,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "Exit date"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 917,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-right py-2 px-3 font-semibold",
                                                                                children: "Exit price"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 918,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "Exit reason"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 919,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-right py-2 px-3 font-semibold",
                                                                                children: "P&L (PKR)"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 920,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-right py-2 px-3 font-semibold",
                                                                                children: "P&L %"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 921,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                                className: "text-left py-2 px-3 font-semibold",
                                                                                children: "Result"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 922,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 911,
                                                                        columnNumber: 31
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                    lineNumber: 910,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                                    children: simResult.rows.map((r)=>{
                                                                        const fmtDate = (ms)=>ms > 0 ? new Date(ms).toLocaleDateString("en-PK", {
                                                                                month: "short",
                                                                                day: "numeric",
                                                                                year: "numeric"
                                                                            }) : "—";
                                                                        // Issue 45: SIP rows render distinctly (amber highlight + PiggyBank icon)
                                                                        const isSip = r.rowType === "SIP";
                                                                        if (isSip) {
                                                                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                                className: "border-b border-[#FBBF24]/20 bg-[#FBBF24]/[0.05]",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 font-mono text-[#FBBF24]",
                                                                                        children: r.tradeNo
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 936,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 font-mono font-semibold text-[#FBBF24] flex items-center gap-1.5",
                                                                                        children: [
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$piggy$2d$bank$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PiggyBank$3e$__["PiggyBank"], {
                                                                                                className: "h-3 w-3"
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                                lineNumber: 938,
                                                                                                columnNumber: 41
                                                                                            }, this),
                                                                                            " SIP DEPOSIT"
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 937,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3",
                                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                                            variant: "outline",
                                                                                            className: "text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/10",
                                                                                            children: "SIP"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                            lineNumber: 941,
                                                                                            columnNumber: 41
                                                                                        }, this)
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 940,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-left font-mono text-[#94A3B8]",
                                                                                        children: fmtDate(r.entryDate)
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 945,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-right font-mono text-[#94A3B8]",
                                                                                        children: "—"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 946,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-left font-mono text-[#94A3B8]",
                                                                                        children: "—"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 947,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-right font-mono text-[#94A3B8]",
                                                                                        children: "—"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 948,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-left text-[11px] text-[#FBBF24] font-semibold",
                                                                                        children: [
                                                                                            "Month end — ",
                                                                                            r.monthLabel || "SIP added"
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 949,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-right font-mono font-semibold text-[#FBBF24]",
                                                                                        children: [
                                                                                            "+",
                                                                                            fmtPkr(r.sipAmount || r.notional || 0)
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 952,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-right font-mono text-[#94A3B8]",
                                                                                        children: "—"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 955,
                                                                                        columnNumber: 39
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                        className: "py-2 px-3 text-left",
                                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                                            variant: "outline",
                                                                                            className: "text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24]",
                                                                                            children: "DEPOSIT"
                                                                                        }, void 0, false, {
                                                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                            lineNumber: 957,
                                                                                            columnNumber: 41
                                                                                        }, this)
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 956,
                                                                                        columnNumber: 39
                                                                                    }, this)
                                                                                ]
                                                                            }, `sip-${r.tradeNo}`, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 935,
                                                                                columnNumber: 37
                                                                            }, this);
                                                                        }
                                                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                            className: "border-b border-white/[0.04] hover:bg-white/[0.02]",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 font-mono text-[#64748B]",
                                                                                    children: r.tradeNo
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 966,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 font-mono font-semibold text-[#F4F7FB]",
                                                                                    children: r.symbol
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 967,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3",
                                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                                        variant: "outline",
                                                                                        className: `text-[9px] py-0 h-4 ${r.side === "BUY" ? "border-[#00E676]/40 text-[#00E676]" : "border-[#FF5C5C]/40 text-[#FF5C5C]"}`,
                                                                                        children: r.side
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 969,
                                                                                        columnNumber: 39
                                                                                    }, this)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 968,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 text-left font-mono text-[#94A3B8]",
                                                                                    children: fmtDate(r.entryDate)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 976,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 text-right font-mono text-[#94A3B8]",
                                                                                    children: r.entryPrice.toFixed(2)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 977,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 text-left font-mono text-[#94A3B8]",
                                                                                    children: fmtDate(r.exitDate)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 978,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 text-right font-mono text-[#94A3B8]",
                                                                                    children: r.exitPrice.toFixed(2)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 979,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 text-left text-[11px] text-[#94A3B8]",
                                                                                    children: r.exitReason
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 980,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: `py-2 px-3 text-right font-mono font-semibold ${r.netPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                                                    children: [
                                                                                        r.netPnl >= 0 ? "+" : "",
                                                                                        fmtPkr(r.netPnl)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 981,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: `py-2 px-3 text-right font-mono font-semibold ${r.netPnlPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                                                    children: fmtPct(r.netPnlPct, true)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 984,
                                                                                    columnNumber: 37
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                    className: "py-2 px-3 text-left",
                                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                                        variant: "outline",
                                                                                        className: `text-[9px] py-0 h-4 ${r.isWin ? "border-[#00E676]/40 text-[#00E676]" : "border-[#FF5C5C]/40 text-[#FF5C5C]"}`,
                                                                                        children: r.isWin ? "WIN" : "LOSS"
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 988,
                                                                                        columnNumber: 39
                                                                                    }, this)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 987,
                                                                                    columnNumber: 37
                                                                                }, this)
                                                                            ]
                                                                        }, r.tradeNo, true, {
                                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                            lineNumber: 965,
                                                                            columnNumber: 35
                                                                        }, this);
                                                                    })
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                    lineNumber: 925,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                            lineNumber: 909,
                                                            columnNumber: 27
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 908,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 735,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 734,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-[11px] text-[#64748B] ml-auto flex-wrap",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            variant: "outline",
                                            className: "text-[9px] py-0 h-4 border-[#00E676]/40 text-[#00E676]",
                                            children: "LIVE"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1011,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: [
                                                "Last ",
                                                timeframeLabel,
                                                " backtest · ",
                                                aiSignals.length,
                                                " stocks · final consensus ensemble · ",
                                                stockSignals.length,
                                                " actionable signals"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1014,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1010,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-gradient-to-br from-[#00E676]/[0.07] to-[#131829] border-[#00E676]/20",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Total signals"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1023,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1024,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1022,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-3xl font-bold text-[#F4F7FB] font-mono",
                                                        children: signalStats.total
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1026,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            signalStats.wins,
                                                            "W / ",
                                                            signalStats.losses,
                                                            "L · ensemble final consensus"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1027,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1021,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1020,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Win rate"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1035,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1036,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1034,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-3xl font-bold text-[#00E676] font-mono",
                                                        children: [
                                                            signalStats.winRate,
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1038,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            "across ",
                                                            signalStats.total,
                                                            " closed trades"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1039,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1033,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1032,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Avg return"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1045,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1046,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1044,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: `text-3xl font-bold font-mono ${signalStats.avgReturn >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                        children: fmtPct(signalStats.avgReturn, true)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1048,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            "per trade, last ",
                                                            timeframeLabel
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1051,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1043,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1042,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Best / worst"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1057,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__["Target"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1058,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1056,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-baseline gap-2 font-mono",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-lg font-bold text-[#00E676]",
                                                                children: fmtPct(signalStats.best, true)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1061,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[#64748B] text-xs",
                                                                children: "/"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1062,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-lg font-bold text-[#FF5C5C]",
                                                                children: fmtPct(signalStats.worst)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1063,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1060,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: "best trade / worst trade"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1065,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1055,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1054,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1019,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                    className: "bg-[#131829] border-white/[0.08] mb-5",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                        className: "p-0",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-4 border-b border-white/[0.06]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between gap-3 flex-wrap",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                        className: "font-semibold text-[#F4F7FB] flex items-center gap-1.5",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$history$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__History$3e$__["History"], {
                                                                                className: "h-4 w-4 text-[#00E676]"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1081,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            "Signal History"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1080,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "text-xs text-[#94A3B8] mt-0.5",
                                                                        children: [
                                                                            "Final ensemble consensus across ",
                                                                            signalHistory.length,
                                                                            " PSX stocks · live price overlay · TP/SL outcome evaluated"
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1084,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1079,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                                size: "sm",
                                                                variant: "outline",
                                                                onClick: ()=>refreshHistory(true),
                                                                disabled: historyLoading,
                                                                className: "border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB] h-8",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                                                        className: `h-3 w-3 mr-1.5 ${historyLoading ? "animate-spin" : ""}`
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1095,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    "Refresh"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1088,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1078,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-wrap items-end gap-3 mt-3",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                        className: "text-[10px] uppercase tracking-wider text-[#64748B] block mb-1",
                                                                        children: "Outcome"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1103,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                                        value: outcomeFilter,
                                                                        onChange: (e)=>setOutcomeFilter(e.target.value),
                                                                        className: "bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs w-[110px]",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "ALL",
                                                                                children: "All"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1109,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "TP",
                                                                                children: "TP hit"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1110,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "SL",
                                                                                children: "SL hit"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1111,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "ACTIVE",
                                                                                children: "Active"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1112,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1104,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1102,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                        className: "text-[10px] uppercase tracking-wider text-[#64748B] block mb-1",
                                                                        children: "Sort by"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1116,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                                                        value: historySort,
                                                                        onChange: (e)=>setHistorySort(e.target.value),
                                                                        className: "bg-[#0A0E1A] border border-white/[0.12] rounded px-2 py-1 text-[#F4F7FB] text-xs w-[150px]",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "rr",
                                                                                children: "R:R (high → low)"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1122,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "conf",
                                                                                children: "Confidence (high → low)"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1123,
                                                                                columnNumber: 29
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                                                value: "pnl",
                                                                                children: "Live P&L % (high → low)"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1124,
                                                                                columnNumber: 29
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1117,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1115,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex-1 min-w-[180px]",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                                        className: "text-[10px] uppercase tracking-wider text-[#64748B] block mb-1",
                                                                        children: [
                                                                            "Min confidence: ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-[#00E676] font-mono",
                                                                                children: [
                                                                                    confFilter,
                                                                                    "%"
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1129,
                                                                                columnNumber: 45
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1128,
                                                                        columnNumber: 27
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                                        type: "range",
                                                                        min: 0,
                                                                        max: 100,
                                                                        step: 5,
                                                                        value: confFilter,
                                                                        onChange: (e)=>setConfFilter(parseInt(e.target.value)),
                                                                        className: "w-full accent-[#00E676] h-1"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1131,
                                                                        columnNumber: 27
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1127,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-[10px] text-[#64748B] ml-auto self-center",
                                                                children: [
                                                                    filteredHistory.length,
                                                                    " of ",
                                                                    signalHistory.length,
                                                                    " signals"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1141,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1101,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1077,
                                                columnNumber: 21
                                            }, this),
                                            historyError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-6 text-center text-xs text-[#FF5C5C]",
                                                children: historyError
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1148,
                                                columnNumber: 23
                                            }, this) : historyLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-6 space-y-2",
                                                children: [
                                                    1,
                                                    2,
                                                    3,
                                                    4,
                                                    5
                                                ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                                        className: "h-8 w-full bg-white/[0.04]"
                                                    }, i, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1152,
                                                        columnNumber: 27
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1150,
                                                columnNumber: 23
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "overflow-x-auto max-h-96 overflow-y-auto",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                                                    className: "w-full text-sm",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                                            className: "sticky top-0 bg-[#131829]",
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B] border-b border-white/[0.06]",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-left py-2 px-3 font-semibold",
                                                                        children: "Symbol"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1160,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-left py-2 px-3 font-semibold",
                                                                        children: "Side"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1161,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "Entry"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1162,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "Live"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1163,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "SL"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1164,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "TP1"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1165,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "TP2"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1166,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "TP3"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1167,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "R:R"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1168,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-right py-2 px-3 font-semibold",
                                                                        children: "Conf."
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1169,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                                        className: "text-left py-2 px-3 font-semibold",
                                                                        children: "Outcome"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1170,
                                                                        columnNumber: 31
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1159,
                                                                columnNumber: 29
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                            lineNumber: 1158,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                                            children: [
                                                                filteredHistory.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                        colSpan: 11,
                                                                        className: "py-6 text-center text-[#64748B] text-xs",
                                                                        children: "No signals match the current filters."
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1176,
                                                                        columnNumber: 33
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                    lineNumber: 1175,
                                                                    columnNumber: 31
                                                                }, this),
                                                                filteredHistory.map((s)=>{
                                                                    const isBuy = s.signal === "BUY";
                                                                    const outcomeClass = s.outcome === "TP3_HIT" ? "bg-[#00E676]/15 border-[#00E676]/40 text-[#00E676]" : s.outcome === "TP2_HIT" ? "bg-[#00E676]/10 border-[#00E676]/30 text-[#00E676]" : s.outcome === "TP1_HIT" ? "bg-[#00E676]/8 border-[#00E676]/25 text-[#00E676]/90" : s.outcome === "SL_HIT" ? "bg-[#FF5C5C]/15 border-[#FF5C5C]/40 text-[#FF5C5C]" : "bg-white/[0.04] border-white/[0.12] text-[#94A3B8]";
                                                                    const pnlColor = s.pnlPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]";
                                                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                                                        className: "border-b border-white/[0.04] hover:bg-white/[0.02]",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 font-mono font-semibold text-[#F4F7FB]",
                                                                                children: [
                                                                                    s.symbol,
                                                                                    s.stockName && s.stockName !== s.symbol && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "text-[9px] text-[#64748B] font-normal truncate max-w-[120px]",
                                                                                        children: s.stockName
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                        lineNumber: 1199,
                                                                                        columnNumber: 39
                                                                                    }, this)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1196,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                                    variant: "outline",
                                                                                    className: `text-[9px] py-0 h-4 ${isBuy ? "border-[#00E676]/40 text-[#00E676]" : "border-[#FF5C5C]/40 text-[#FF5C5C]"}`,
                                                                                    children: s.signal
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 1203,
                                                                                    columnNumber: 37
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1202,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#94A3B8]",
                                                                                children: s.entry.toFixed(2)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1207,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#F4F7FB]",
                                                                                children: s.livePrice != null ? s.livePrice.toFixed(2) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "text-[#64748B]",
                                                                                    children: "—"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 1209,
                                                                                    columnNumber: 85
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1208,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#FF5C5C]/80",
                                                                                children: s.sl.toFixed(2)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1211,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#00E676]/80",
                                                                                children: s.tp1.toFixed(2)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1212,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#00E676]/90",
                                                                                children: s.tp2.toFixed(2)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1213,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#00E676]",
                                                                                children: s.tp3.toFixed(2)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1214,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#94A3B8]",
                                                                                children: s.riskReward.toFixed(2)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1215,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3 text-right font-mono text-[#94A3B8]",
                                                                                children: [
                                                                                    s.confidence,
                                                                                    "%"
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1216,
                                                                                columnNumber: 35
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                                                className: "py-2.5 px-3",
                                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                                    variant: "outline",
                                                                                    className: `text-[9px] py-0 h-4 border ${outcomeClass}`,
                                                                                    children: [
                                                                                        s.outcome.replace("_", " "),
                                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                            className: `ml-1 font-mono ${pnlColor}`,
                                                                                            children: [
                                                                                                s.pnlPct >= 0 ? "+" : "",
                                                                                                s.pnlPct.toFixed(2),
                                                                                                "%"
                                                                                            ]
                                                                                        }, void 0, true, {
                                                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                            lineNumber: 1220,
                                                                                            columnNumber: 39
                                                                                        }, this)
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                    lineNumber: 1218,
                                                                                    columnNumber: 37
                                                                                }, this)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1217,
                                                                                columnNumber: 35
                                                                            }, this)
                                                                        ]
                                                                    }, s.symbol, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1195,
                                                                        columnNumber: 33
                                                                    }, this);
                                                                })
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                                            lineNumber: 1173,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1157,
                                                    columnNumber: 25
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1156,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1076,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1075,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true)
                    }, void 0, false, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 720,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$tabs$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TabsContent"], {
                        value: "portfolio",
                        className: "mt-4",
                        children: portfolioPositions.length === 0 && closedTrades.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                            className: "bg-[#131829] border-white/[0.08]",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                className: "p-12 text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__["Briefcase"], {
                                        className: "h-12 w-12 text-[#00E676]/30 mx-auto mb-3"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1243,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "font-semibold text-[#F4F7FB] mb-1",
                                        children: "No portfolio positions yet"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1244,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-[#94A3B8]",
                                        children: "Add stocks with buy prices and share counts to see your live P&L, win rate, and ROI% here."
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1245,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1242,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/Tracker.tsx",
                            lineNumber: 1241,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "grid grid-cols-2 md:grid-cols-4 gap-3 mb-5",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Total value"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1256,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__["Briefcase"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1257,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1255,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-2xl font-bold text-[#F4F7FB] font-mono",
                                                        children: portfolioStats.hasAnyPnl ? fmtPkr(portfolioStats.totalValue) : "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1259,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            "invested ",
                                                            fmtPkr(portfolioStats.totalInvested)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1262,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1254,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1253,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Total P&L"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1270,
                                                                columnNumber: 25
                                                            }, this),
                                                            portfolioStats.totalPnl >= 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1272,
                                                                columnNumber: 27
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingDown$3e$__["TrendingDown"], {
                                                                className: "h-3 w-3 text-[#FF5C5C]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1274,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1269,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: `text-2xl font-bold font-mono ${portfolioStats.totalPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                        children: portfolioStats.hasAnyPnl ? `${portfolioStats.totalPnl >= 0 ? "+" : ""}${fmtPkr(portfolioStats.totalPnl)}` : "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1277,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            "ROI",
                                                            " ",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: portfolioStats.roiPct >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]",
                                                                children: portfolioStats.hasAnyPnl ? `${portfolioStats.roiPct >= 0 ? "+" : ""}${portfolioStats.roiPct.toFixed(2)}%` : "—"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1282,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1280,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1268,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1267,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Win rate"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1291,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1292,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1290,
                                                        columnNumber: 23
                                                    }, this),
                                                    portfolioStats.winRate !== null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-2xl font-bold text-[#00E676] font-mono",
                                                        children: [
                                                            portfolioStats.winRate.toFixed(1),
                                                            "%"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1295,
                                                        columnNumber: 25
                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-2xl font-bold text-[#94A3B8] font-mono",
                                                        children: "—"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1299,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: portfolioStats.closedCount > 0 ? `${portfolioStats.closedWins}/${portfolioStats.closedCount} closed` : "no closed trades yet"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1301,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1289,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1288,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                            className: "bg-[#131829] border-white/[0.08]",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                                className: "p-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between mb-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                                                children: "Positions"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1311,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$activity$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Activity$3e$__["Activity"], {
                                                                className: "h-3 w-3 text-[#00E676]"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1312,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1310,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-2xl font-bold text-[#F4F7FB] font-mono",
                                                        children: portfolioStats.total
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1314,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[10px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-amber-400",
                                                                children: [
                                                                    portfolioStats.openCount,
                                                                    " open"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1316,
                                                                columnNumber: 25
                                                            }, this),
                                                            " · ",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[#94A3B8]",
                                                                children: [
                                                                    portfolioStats.closedCount,
                                                                    " closed"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1318,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1315,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1309,
                                                columnNumber: 21
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1308,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1252,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                    className: "bg-[#131829] border-white/[0.08] mb-5",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                        className: "p-5",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-1.5 mb-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$pie$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PieChart$3e$__["PieChart"], {
                                                        className: "h-4 w-4 text-[#00E676]"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1328,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "font-semibold text-[#F4F7FB] text-sm",
                                                        children: "Sector-wise holding distribution"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1329,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1327,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-[#94A3B8] mb-4",
                                                children: "Breakdown of your open positions by sector, weighted by current market value (live price × shares). Useful for spotting concentration risk (e.g., 80% Cement, 20% Oil & Gas)."
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1331,
                                                columnNumber: 21
                                            }, this),
                                            sectorData.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-center py-8 text-xs text-[#64748B]",
                                                children: "No open positions with a market value yet — add buy prices + share counts to populate the chart."
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1336,
                                                columnNumber: 23
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex flex-col md:flex-row items-center gap-6",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SectorPieChart, {
                                                        data: sectorData
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1341,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex-1 w-full space-y-2",
                                                        children: sectorData.map((d, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-center justify-between text-xs gap-3",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center gap-2 min-w-0",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "h-3 w-3 rounded-sm shrink-0",
                                                                                style: {
                                                                                    background: SECTOR_COLORS[i % SECTOR_COLORS.length]
                                                                                }
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1346,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-[#F4F7FB] font-semibold truncate",
                                                                                children: d.sector
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1350,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1345,
                                                                        columnNumber: 31
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "flex items-center gap-3 font-mono shrink-0",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-[#94A3B8]",
                                                                                children: fmtPkr(d.value)
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1353,
                                                                                columnNumber: 33
                                                                            }, this),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-[#00E676] font-semibold w-14 text-right",
                                                                                children: [
                                                                                    d.pct.toFixed(1),
                                                                                    "%"
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                                lineNumber: 1354,
                                                                                columnNumber: 33
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                        lineNumber: 1352,
                                                                        columnNumber: 31
                                                                    }, this)
                                                                ]
                                                            }, d.sector, true, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1344,
                                                                columnNumber: 29
                                                            }, this))
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1342,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1340,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1326,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1325,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                    className: "bg-[#131829] border-white/[0.08] mb-5",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                        className: "p-0",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-4 border-b border-white/[0.06]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "font-semibold text-[#F4F7FB]",
                                                        children: [
                                                            "Open positions (",
                                                            portfolioPositions.length,
                                                            ")"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1370,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xs text-[#94A3B8] mt-0.5",
                                                        children: [
                                                            "Live P&L based on current PSX prices for covered stocks · to close a position, use the wallet-icon close flow in the ",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[#00E676]",
                                                                children: "Portfolio"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                                lineNumber: 1373,
                                                                columnNumber: 55
                                                            }, this),
                                                            " tab."
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1371,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1369,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "divide-y divide-white/[0.04]",
                                                children: portfolioPositions.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "p-6 text-center text-xs text-[#64748B]",
                                                    children: "No open positions yet. Add stocks with shares > 0 to start tracking."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1378,
                                                    columnNumber: 25
                                                }, this) : portfolioPositions.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PortfolioRow, {
                                                        position: p,
                                                        livePrice: livePriceMap[p.symbol],
                                                        sectorLabel: (()=>{
                                                            const s = p.sector && p.sector.trim();
                                                            return (s && s !== "Conglomerate" ? s : "") || sectorMap[p.symbol] || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$company$2d$results$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySector"])(p.symbol);
                                                        })()
                                                    }, p.symbol, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1383,
                                                        columnNumber: 27
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1376,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1368,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1367,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                    className: "bg-[#131829] border-white/[0.08]",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                        className: "p-0",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "p-4 border-b border-white/[0.06]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                        className: "font-semibold text-[#F4F7FB]",
                                                        children: [
                                                            "Closed trades (",
                                                            closedTrades.length,
                                                            ")"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1404,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-xs text-[#94A3B8] mt-0.5",
                                                        children: "Each row is a trade closed via the Portfolio tab's close flow — recorded with buy/sell prices, broker commission (0.15% × sell × 2), CGT (15% if ≤12mo, 0% if >12mo), and net P&L."
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1405,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1403,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "divide-y divide-white/[0.04]",
                                                children: closedTrades.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "p-6 text-center text-xs text-[#64748B]",
                                                    children: "No closed trades yet. Close a position from the Portfolio tab to see it here."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1413,
                                                    columnNumber: 25
                                                }, this) : closedTrades.map((t)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ClosedTradeRow, {
                                                        trade: t
                                                    }, t.id, false, {
                                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                                        lineNumber: 1417,
                                                        columnNumber: 49
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1411,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1402,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1401,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true)
                    }, void 0, false, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1239,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 709,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed mt-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[#94A3B8] font-semibold",
                        children: "Tracker note:"
                    }, void 0, false, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1428,
                        columnNumber: 11
                    }, this),
                    " Signal tracker stats are sourced live from ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                        className: "text-[#00E676]",
                        children: [
                            "/api/ai-model-signals/[symbol]?refresh=1&timeframe=",
                            timeframe
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1429,
                        columnNumber: 39
                    }, this),
                    " — the ensemble final consensus backtest across ",
                    COVERED_SYMBOLS.length,
                    " covered PSX stocks. Notifications fire when a tracked signal hits TP or SL. Portfolio tracker shows open positions and closed trades from the Portfolio tab close flow; the pie chart visualises sector concentration."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 1427,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/latent/Tracker.tsx",
        lineNumber: 692,
        columnNumber: 5
    }, this);
}
_s(Tracker, "a3BcKj1AM2I9y4EvyTaR2vHoItw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"]
    ];
});
_c = Tracker;
// ─── Issue 18: SVG-based donut pie chart for sector distribution ──────────
// Issue 28+29: distinct-hue colors for the sector pie chart.
// Each entry is a DIFFERENT hue family — no two are shades of the same color,
// and none are pastel/light shades (all 600-level Tailwind-equivalent, fully
// saturated so the slices are clearly visible against the dark background).
// Cycled via `i % SECTOR_COLORS.length` so adjacent slices never share a hue.
const SECTOR_COLORS = [
    "#DC2626",
    "#059669",
    "#7C3AED",
    "#D97706",
    "#0D9488",
    "#DB2777",
    "#CA8A04",
    "#EA580C",
    "#16A34A",
    "#BE185D",
    "#65A30D",
    "#92400E"
];
function SectorPieChart({ data }) {
    const size = 160;
    const cx = size / 2;
    const cy = size / 2;
    const r = 65;
    const innerR = 30; // donut hole
    // Issue 26: Single-slice (100%) degenerate case — SVG arc spec omits the
    // slice when start === end (because the path's start and end points are
    // identical, the arc is "zero-length" and skipped). Render the donut as
    // two concentric <circle> elements instead so a 1-stock portfolio still
    // shows a full ring instead of an empty box.
    if (data.length === 1 && data[0].pct >= 99.999) {
        const d = data[0];
        const color = SECTOR_COLORS[0];
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            viewBox: `0 0 ${size} ${size}`,
            width: size,
            height: size,
            className: "shrink-0",
            role: "img",
            "aria-label": `Sector distribution: ${d.sector} ${d.pct.toFixed(0)}%`,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                    cx: cx,
                    cy: cy,
                    r: r,
                    fill: color,
                    stroke: "#0A0E1A",
                    strokeWidth: 1.5
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 1483,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                    cx: cx,
                    cy: cy,
                    r: innerR,
                    fill: "#0A0E1A"
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 1484,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                    children: `${d.sector}: ${d.pct.toFixed(1)}% (${fmtPkr(d.value)})`
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 1485,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/latent/Tracker.tsx",
            lineNumber: 1475,
            columnNumber: 7
        }, this);
    }
    // SVG arc paths for each sector slice. Cumulative angle is computed
    // functionally from the preceding slices' percentages (no mutation) to
    // satisfy react-hooks/immutability.
    const slices = data.map((d, i)=>{
        const cumulativeBeforePct = data.slice(0, i).reduce((s, x)=>s + x.pct, 0);
        const startAngle = -Math.PI / 2 + cumulativeBeforePct / 100 * 2 * Math.PI;
        const angleSpan = d.pct / 100 * 2 * Math.PI;
        const endAngle = startAngle + angleSpan;
        // Outer arc endpoints
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        // Inner arc endpoints (donut)
        const xi1 = cx + innerR * Math.cos(startAngle);
        const yi1 = cy + innerR * Math.sin(startAngle);
        const xi2 = cx + innerR * Math.cos(endAngle);
        const yi2 = cy + innerR * Math.sin(endAngle);
        const largeArc = angleSpan > Math.PI ? 1 : 0;
        // Donut slice path: outer arc forward + line in + inner arc backward + close
        const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1} Z`;
        return {
            path,
            color: SECTOR_COLORS[i % SECTOR_COLORS.length],
            ...d
        };
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: `0 0 ${size} ${size}`,
        width: size,
        height: size,
        className: "shrink-0",
        role: "img",
        "aria-label": `Sector distribution: ${data.map((d)=>`${d.sector} ${d.pct.toFixed(0)}%`).join(", ")}`,
        children: slices.map((s, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: s.path,
                fill: s.color,
                stroke: "#0A0E1A",
                strokeWidth: 1.5,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("title", {
                    children: `${s.sector}: ${s.pct.toFixed(1)}% (${fmtPkr(s.value)})`
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 1533,
                    columnNumber: 11
                }, this)
            }, i, false, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 1526,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/latent/Tracker.tsx",
        lineNumber: 1517,
        columnNumber: 5
    }, this);
}
_c1 = SectorPieChart;
function PortfolioRow({ position, livePrice, sectorLabel }) {
    const buy = position.buyPrice || 0;
    const referencePrice = typeof livePrice === "number" ? livePrice : null;
    const positionValue = referencePrice !== null ? referencePrice * position.shares : null;
    const invested = buy * position.shares;
    const pnl = positionValue !== null ? positionValue - invested : null;
    const pnlPct = pnl !== null && invested > 0 ? pnl / invested * 100 : null;
    const isWin = pnl !== null && pnl > 0;
    const isLoss = pnl !== null && pnl < 0;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4 hover:bg-white/[0.02]",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center justify-between gap-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-3 min-w-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "h-9 w-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-[#00E676]/10 text-[#00E676]",
                            children: position.symbol.slice(0, 4)
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/Tracker.tsx",
                            lineNumber: 1572,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-semibold text-[#F4F7FB] text-sm",
                                            children: position.symbol
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1577,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            variant: "outline",
                                            className: "text-[9px] py-0 h-4 border-amber-500/40 text-amber-400",
                                            children: "OPEN"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1578,
                                            columnNumber: 15
                                        }, this),
                                        sectorLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            variant: "outline",
                                            className: "text-[8px] py-0 h-3.5 border-white/[0.12] text-[#94A3B8] uppercase",
                                            children: sectorLabel
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1582,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1576,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-[11px] text-[#94A3B8] mt-0.5 truncate",
                                    children: [
                                        "Buy: ",
                                        buy > 0 ? buy.toFixed(2) : "—",
                                        " · ",
                                        position.shares.toLocaleString(),
                                        " shares",
                                        typeof livePrice === "number" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#64748B]",
                                            children: [
                                                " · Live: ",
                                                livePrice.toFixed(2)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/Tracker.tsx",
                                            lineNumber: 1590,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1587,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/latent/Tracker.tsx",
                            lineNumber: 1575,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 1571,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "text-right shrink-0",
                    children: pnl !== null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `text-sm font-mono font-semibold ${isWin ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`,
                                children: [
                                    pnl >= 0 ? "+" : "",
                                    fmtPkr(pnl)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1598,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-[#94A3B8] font-mono",
                                children: pnlPct !== null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1601,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm font-mono text-[#64748B]",
                                children: "—"
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1607,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-[#64748B]",
                                children: "no live price"
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1608,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true)
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/Tracker.tsx",
                    lineNumber: 1595,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/latent/Tracker.tsx",
            lineNumber: 1570,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/latent/Tracker.tsx",
        lineNumber: 1569,
        columnNumber: 5
    }, this);
}
_c2 = PortfolioRow;
function ClosedTradeRow({ trade }) {
    const isWin = trade.netPnl > 0;
    const isLoss = trade.netPnl < 0;
    // Issue 33: an "averaged close" is one where the position had multiple buy
    // lots before close. The P&L numbers use the weighted-avg buyPrice × total
    // shares — ONE closed-trade entry per close (not one per lot).
    const lotCount = trade.buyLots?.length ?? 0;
    const isAveraged = lotCount > 1;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4 hover:bg-white/[0.02]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-3 min-w-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "h-9 w-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-white/[0.04] text-[#94A3B8]",
                                children: trade.symbol.slice(0, 4)
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1653,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-semibold text-[#F4F7FB] text-sm",
                                                children: trade.symbol
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1658,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                variant: "outline",
                                                className: "text-[9px] py-0 h-4 border-white/[0.16] text-[#94A3B8] bg-white/[0.04]",
                                                children: "CLOSED"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1659,
                                                columnNumber: 15
                                            }, this),
                                            isAveraged && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                variant: "outline",
                                                className: "text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24] bg-[#FBBF24]/[0.06]",
                                                title: `Averaged from ${lotCount} buy lots — P&L computed on weighted-avg buy price`,
                                                children: [
                                                    "AVG · ",
                                                    lotCount,
                                                    " LOTS"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                                lineNumber: 1663,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1657,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-[11px] text-[#94A3B8] mt-0.5 truncate",
                                        children: isAveraged ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[#FBBF24] font-semibold",
                                                    children: [
                                                        "Avg ",
                                                        trade.buyPrice.toFixed(2)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1673,
                                                    columnNumber: 19
                                                }, this),
                                                " × ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: trade.shares.toLocaleString()
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1675,
                                                    columnNumber: 19
                                                }, this),
                                                " → Sell ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: trade.sellPrice.toFixed(2)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1677,
                                                    columnNumber: 19
                                                }, this),
                                                " · held ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: [
                                                        trade.holdingDays,
                                                        "d"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                                    lineNumber: 1679,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                            children: [
                                                "Buy ",
                                                trade.buyPrice.toFixed(2),
                                                " × ",
                                                trade.shares.toLocaleString(),
                                                " → Sell ",
                                                trade.sellPrice.toFixed(2),
                                                " · held ",
                                                trade.holdingDays,
                                                "d"
                                            ]
                                        }, void 0, true)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/Tracker.tsx",
                                        lineNumber: 1668,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1656,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1652,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-right shrink-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `text-sm font-mono font-semibold ${isWin ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`,
                                children: [
                                    trade.netPnl >= 0 ? "+" : "",
                                    fmtPkr(trade.netPnl)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1690,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `text-[10px] font-mono ${isWin ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`,
                                children: [
                                    trade.netPnlPct >= 0 ? "+" : "",
                                    trade.netPnlPct.toFixed(2),
                                    "% net"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1693,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1689,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 1651,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 text-[10px] text-[#64748B] flex flex-wrap items-center gap-x-3 gap-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Gross:",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: `font-mono ${trade.grossPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                children: [
                                    trade.grossPnl >= 0 ? "+" : "",
                                    fmtPkr(trade.grossPnl)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1702,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1700,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Commission: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[#FF5C5C] font-mono",
                                children: [
                                    "-",
                                    fmtPkr(trade.commission)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1707,
                                columnNumber: 23
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1706,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "CGT (",
                            (trade.taxRate * 100).toFixed(0),
                            "%):",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[#FF5C5C] font-mono",
                                children: [
                                    "-",
                                    fmtPkr(trade.cgt)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/Tracker.tsx",
                                lineNumber: 1711,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1709,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[#475569]",
                        children: [
                            "· closed ",
                            new Date(trade.closedAt).toLocaleDateString("en-PK", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                            })
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1713,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 1699,
                columnNumber: 7
            }, this),
            isAveraged && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-2 pt-2 border-t border-white/[0.04] space-y-0.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[9px] uppercase tracking-wider text-[#64748B] font-semibold mb-1",
                        children: [
                            "Buy lots (avg → ",
                            trade.buyPrice.toFixed(2),
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/Tracker.tsx",
                        lineNumber: 1722,
                        columnNumber: 11
                    }, this),
                    trade.buyLots.map((lot, li)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-[9px] font-mono text-[#64748B] flex items-center gap-1.5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "inline-flex items-center justify-center min-w-[36px] h-3 px-1 rounded bg-white/[0.04] text-[#64748B]",
                                    children: [
                                        "Lot ",
                                        li + 1
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1727,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: lot.price.toFixed(2)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1730,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[#64748B]/60",
                                    children: "×"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1731,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: lot.shares.toLocaleString()
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1732,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[#64748B]/60",
                                    children: "="
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1733,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: [
                                        "PKR ",
                                        Math.round(lot.price * lot.shares).toLocaleString()
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/Tracker.tsx",
                                    lineNumber: 1734,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, li, true, {
                            fileName: "[project]/src/components/latent/Tracker.tsx",
                            lineNumber: 1726,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/Tracker.tsx",
                lineNumber: 1721,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/latent/Tracker.tsx",
        lineNumber: 1650,
        columnNumber: 5
    }, this);
}
_c3 = ClosedTradeRow;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "Tracker");
__turbopack_context__.k.register(_c1, "SectorPieChart");
__turbopack_context__.k.register(_c2, "PortfolioRow");
__turbopack_context__.k.register(_c3, "ClosedTradeRow");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_components_latent_Tracker_tsx_a9fde877._.js.map