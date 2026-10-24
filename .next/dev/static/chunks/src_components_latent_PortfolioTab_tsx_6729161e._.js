(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/latent/PortfolioTab.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PortfolioTab",
    ()=>PortfolioTab
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/skeleton.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$latent$2f$StockSearch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/latent/StockSearch.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-stocks.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$company$2d$results$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-company-results.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-up.js [app-client] (ecmascript) <export default as ArrowUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-down.js [app-client] (ecmascript) <export default as ArrowDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trending-up.js [app-client] (ecmascript) <export default as TrendingUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trending-down.js [app-client] (ecmascript) <export default as TrendingDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/briefcase.js [app-client] (ecmascript) <export default as Briefcase>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/minus.js [app-client] (ecmascript) <export default as Minus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wallet.js [app-client] (ecmascript) <export default as Wallet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calculator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calculator$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/calculator.js [app-client] (ecmascript) <export default as Calculator>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2d$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CalendarClock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/calendar-clock.js [app-client] (ecmascript) <export default as CalendarClock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eye.js [app-client] (ecmascript) <export default as Eye>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/sonner/dist/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
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
;
;
;
function computeCloseMetrics(buyPrice, shares, sellPrice, addedAt) {
    const buyCost = buyPrice * shares;
    const sellValue = sellPrice * shares;
    // Broker commission = 0.15% × sell value, applied on both sides (buy + sell).
    // Using sellValue as the base for both sides per spec ("0.15% × sell value (both sides)").
    const commission = 0.0015 * sellValue * 2;
    const holdingDays = Math.max(0, Math.floor((Date.now() - new Date(addedAt).getTime()) / (1000 * 60 * 60 * 24)));
    const holdingMonths = Math.floor(holdingDays / 30);
    // CGT: 15% for ≤12 months (short-term), 0% for >12 months (long-term)
    const taxRate = holdingDays <= 365 ? 0.15 : 0;
    const grossPnl = sellValue - buyCost;
    // CGT only on positive profit (no tax credit for losses)
    const cgt = grossPnl > 0 ? grossPnl * taxRate : 0;
    const netPnl = grossPnl - commission - cgt;
    const netPnlPct = buyCost > 0 ? netPnl / buyCost * 100 : 0;
    return {
        sellPrice,
        buyCost,
        sellValue,
        commission,
        holdingDays,
        holdingMonths,
        taxRate,
        cgt,
        grossPnl,
        netPnl,
        netPnlPct
    };
}
// ─── Issue 15: batched LIVE quote fetcher for portfolio holdings ────────────
// Hits our own /api/psx/live/batch endpoint, which server-side calls
// `getLiveQuote` (60s in-memory cache per symbol) for each portfolio symbol
// in parallel via Promise.all. Returns the latest LIVE PSX price for each
// symbol, plus isLoading / refresh / lastUpdated for the UI.
//
// Used by PortfolioTab to:
//   - render per-position live P&L (green/red) on open holdings (Issue 15)
//   - compute the total portfolio P&L summary card (Issue 15)
//   - show per-row live price on watch-only items (free upgrade)
//   - skeleton-while-loading + manual Refresh button + 60s auto-refresh
//
// Implementation note: setState is only called inside async .then callbacks
// (NOT synchronously in the effect body) to avoid React 19's
// `react-hooks/set-state-in-effect` cascading-render warning. The "loading"
// state is derived from `state.key !== key` (data is stale until the new
// fetch for the current symbol-set resolves) plus an explicit `loading`
// flag set inside the `refresh` event handler.
function usePortfolioLiveQuotes(symbols) {
    _s();
    const key = symbols.join(",");
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        key: "",
        prices: {},
        lastUpdated: null,
        loading: false
    });
    const [refreshTick, setRefreshTick] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePortfolioLiveQuotes.useEffect": ()=>{
            if (!key) return;
            let cancelled = false;
            const symbolsList = key.split(",");
            fetch(`/api/psx/live/batch?symbols=${encodeURIComponent(symbolsList.join(","))}`).then({
                "usePortfolioLiveQuotes.useEffect": (r)=>r.ok ? r.json() : null
            }["usePortfolioLiveQuotes.useEffect"]).then({
                "usePortfolioLiveQuotes.useEffect": (d)=>{
                    if (cancelled) return;
                    if (d && d.prices && typeof d.prices === "object") {
                        setState({
                            key,
                            prices: d.prices,
                            lastUpdated: new Date(d.fetchedAt || Date.now()),
                            loading: false
                        });
                    } else {
                        // Even if no prices resolved, mark this key as "fetched" so
                        // isLoading flips to false and rows show "no live price" instead
                        // of a skeleton.
                        setState({
                            key,
                            prices: {},
                            lastUpdated: new Date(),
                            loading: false
                        });
                    }
                }
            }["usePortfolioLiveQuotes.useEffect"]).catch({
                "usePortfolioLiveQuotes.useEffect": ()=>{
                    if (cancelled) return;
                    // Keep stale prices if any; mark this key as attempted so the
                    // skeleton goes away.
                    setState({
                        "usePortfolioLiveQuotes.useEffect": (s)=>({
                                key,
                                prices: s.key === key ? s.prices : {},
                                lastUpdated: new Date(),
                                loading: false
                            })
                    }["usePortfolioLiveQuotes.useEffect"]);
                }
            }["usePortfolioLiveQuotes.useEffect"]);
            return ({
                "usePortfolioLiveQuotes.useEffect": ()=>{
                    cancelled = true;
                }
            })["usePortfolioLiveQuotes.useEffect"];
        }
    }["usePortfolioLiveQuotes.useEffect"], [
        key,
        refreshTick
    ]);
    // Auto-refresh every 60s — matches getLiveQuote's 60s cache TTL so the
    // dashboard P&L stays current without manual button clicks.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePortfolioLiveQuotes.useEffect": ()=>{
            if (!key) return;
            const id = setInterval({
                "usePortfolioLiveQuotes.useEffect.id": ()=>setRefreshTick({
                        "usePortfolioLiveQuotes.useEffect.id": (t)=>t + 1
                    }["usePortfolioLiveQuotes.useEffect.id"])
            }["usePortfolioLiveQuotes.useEffect.id"], 60_000);
            return ({
                "usePortfolioLiveQuotes.useEffect": ()=>clearInterval(id)
            })["usePortfolioLiveQuotes.useEffect"];
        }
    }["usePortfolioLiveQuotes.useEffect"], [
        key
    ]);
    const refresh = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "usePortfolioLiveQuotes.useCallback[refresh]": ()=>{
            setRefreshTick({
                "usePortfolioLiveQuotes.useCallback[refresh]": (t)=>t + 1
            }["usePortfolioLiveQuotes.useCallback[refresh]"]);
            setState({
                "usePortfolioLiveQuotes.useCallback[refresh]": (s)=>({
                        ...s,
                        loading: true
                    })
            }["usePortfolioLiveQuotes.useCallback[refresh]"]);
        }
    }["usePortfolioLiveQuotes.useCallback[refresh]"], []);
    // Derive public state:
    //   - prices: valid only when state.key === key (otherwise stale → empty)
    //   - isLoading: true if we have no data yet for the current key OR a
    //     refresh is explicitly in progress
    const hasData = state.key === key;
    const prices = hasData ? state.prices : {};
    const lastUpdated = hasData ? state.lastUpdated : null;
    const isLoading = !!key && (!hasData || state.loading);
    return {
        prices,
        isLoading,
        refresh,
        lastUpdated
    };
}
_s(usePortfolioLiveQuotes, "7ZyCuNzOIxSJVHlMdh8nAxMRDq8=");
function PortfolioTab() {
    _s1();
    const portfolio = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[portfolio]": (s)=>s.portfolio
    }["PortfolioTab.useLatentStore[portfolio]"]);
    const addPosition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[addPosition]": (s)=>s.addPortfolioPosition
    }["PortfolioTab.useLatentStore[addPosition]"]);
    const removePosition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[removePosition]": (s)=>s.removePortfolioPosition
    }["PortfolioTab.useLatentStore[removePosition]"]);
    const reorder = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[reorder]": (s)=>s.reorderPortfolio
    }["PortfolioTab.useLatentStore[reorder]"]);
    const setView = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[setView]": (s)=>s.setView
    }["PortfolioTab.useLatentStore[setView]"]);
    const pushNotification = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[pushNotification]": (s)=>s.pushNotification
    }["PortfolioTab.useLatentStore[pushNotification]"]);
    const closePositionFromPortfolio = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioTab.useLatentStore[closePositionFromPortfolio]": (s)=>s.closePositionFromPortfolio
    }["PortfolioTab.useLatentStore[closePositionFromPortfolio]"]);
    const [addOpen, setAddOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedSymbol, setSelectedSymbol] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [selectedName, setSelectedName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [selectedSector, setSelectedSector] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(undefined);
    const [buyPrice, setBuyPrice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [shares, setShares] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    // ─── Issue 13: Close-trade dialog state ───
    const [closeTarget, setCloseTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [closeSellPrice, setCloseSellPrice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [closePriceLoading, setClosePriceLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [closeSubmitting, setCloseSubmitting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const handleAdd = ()=>{
        if (!selectedSymbol) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Pick a stock first");
            return;
        }
        // Issue 19 behavior: until the user specifies shares (volume), the stock
        // is added as "watch only" (no P&L tracking). This is intentional — the
        // user can add shares later. We do not move it to "holdings" until
        // both buyPrice AND shares are provided.
        //
        // Issue 32: if the symbol is already in the portfolio:
        //   (a) existing is watch-only + user enters NO shares → toast
        //       "already in watchlist" (don't add a duplicate).
        //   (b) existing is a holding + user enters NO shares → toast "already
        //       in holdings" (don't add a duplicate).
        //   (c) existing is watch-only + user enters shares → upgrade to holding
        //       (store action handles it).
        //   (d) existing is a holding + user enters shares → average the buy
        //       price (store action appends to buyLots + recomputes weighted avg).
        const name = selectedName || selectedSymbol;
        const existingPos = portfolio.find((p)=>p.symbol === selectedSymbol);
        const hasSharesInput = !!shares && parseInt(shares) > 0;
        if (existingPos) {
            const isHolding = existingPos.shares > 0 && existingPos.buyPrice !== null && existingPos.buyPrice !== undefined;
            if (!hasSharesInput) {
                // No shares entered → watch-only attempt.
                if (isHolding) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(`${selectedSymbol} is already in your holdings — enter shares + buy price to average in, or close the existing position first.`);
                } else {
                    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(`${selectedSymbol} is already in your watchlist.`);
                }
                // Don't close the dialog — let the user adjust inputs.
                return;
            }
            // User entered shares + the stock is already in the portfolio.
            if (!buyPrice) {
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Enter a buy price to average in / upgrade from watchlist.");
                return;
            }
            // Call the store action — it will average (case d) or upgrade (case c).
            addPosition({
                symbol: selectedSymbol,
                name,
                sector: selectedSector || undefined,
                buyPrice: parseFloat(buyPrice),
                shares: parseInt(shares)
            });
            const newPrice = parseFloat(buyPrice);
            const newShares = parseInt(shares);
            if (isHolding) {
                // Case d: averaging. Show the new lot + new weighted-avg.
                const oldShares = existingPos.shares;
                const oldPrice = existingPos.buyPrice;
                const totalShares = oldShares + newShares;
                const totalCost = oldPrice * oldShares + newPrice * newShares;
                const newAvg = totalCost / totalShares;
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(`${selectedSymbol} averaged in: added ${newShares} sh @ ${newPrice.toFixed(2)} (lot ${(existingPos.buyLots?.length ?? 0) + 1}). New avg: ${newAvg.toFixed(2)} across ${totalShares} shares.`);
            } else {
                // Case c: upgrade from watchlist.
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(`${selectedSymbol} moved from watchlist to holdings: ${newShares} sh @ ${newPrice.toFixed(2)}.`);
            }
        } else {
            // New entry (symbol not in portfolio yet).
            addPosition({
                symbol: selectedSymbol,
                name,
                sector: selectedSector || undefined,
                buyPrice: buyPrice ? parseFloat(buyPrice) : null,
                shares: shares ? parseInt(shares) : 0
            });
            pushNotification({
                type: "info",
                title: "Stock added to portfolio",
                body: `${selectedSymbol} added${shares ? ` (${shares} shares${buyPrice ? ` @ PKR ${buyPrice}` : ""})` : " (watch only)"}`,
                linkView: "portfolio"
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(`${selectedSymbol} added to portfolio${shares ? " with " + shares + " shares" : " (watch only)"}`);
        }
        setAddOpen(false);
        setSelectedSymbol("");
        setSelectedName("");
        setSelectedSector(undefined);
        setBuyPrice("");
        setShares("");
    };
    const sorted = [
        ...portfolio
    ].sort((a, b)=>a.order - b.order);
    // ─── Issue 10: separate HOLDINGS from WATCHLIST ─────────────────────────
    // A position is a "holding" ONLY if it has shares > 0 AND a non-null
    // buyPrice (a real, open position). Watch-only items (shares=0 OR
    // buyPrice=null) do NOT count toward the holdings summary / total P&L.
    // The store distinguishes via the shares/buyPrice fields — see
    // PortfolioPosition shape in src/lib/latent/store.ts.
    const isHolding = (p)=>p.shares > 0 && p.buyPrice !== null && p.buyPrice !== undefined;
    // Pre-compute (position, sortedIdx) pairs so each rendered row knows its
    // original index in `sorted` for the reorder controls (moveUp/moveDown).
    const holdingsWithIdx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[holdingsWithIdx]": ()=>sorted.map({
                "PortfolioTab.useMemo[holdingsWithIdx]": (p, idx)=>({
                        p,
                        idx
                    })
            }["PortfolioTab.useMemo[holdingsWithIdx]"]).filter({
                "PortfolioTab.useMemo[holdingsWithIdx]": ({ p })=>isHolding(p)
            }["PortfolioTab.useMemo[holdingsWithIdx]"])
    }["PortfolioTab.useMemo[holdingsWithIdx]"], [
        sorted
    ]);
    const watchlistWithIdx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[watchlistWithIdx]": ()=>sorted.map({
                "PortfolioTab.useMemo[watchlistWithIdx]": (p, idx)=>({
                        p,
                        idx
                    })
            }["PortfolioTab.useMemo[watchlistWithIdx]"]).filter({
                "PortfolioTab.useMemo[watchlistWithIdx]": ({ p })=>!isHolding(p)
            }["PortfolioTab.useMemo[watchlistWithIdx]"])
    }["PortfolioTab.useMemo[watchlistWithIdx]"], [
        sorted
    ]);
    const holdings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[holdings]": ()=>holdingsWithIdx.map({
                "PortfolioTab.useMemo[holdings]": ({ p })=>p
            }["PortfolioTab.useMemo[holdings]"])
    }["PortfolioTab.useMemo[holdings]"], [
        holdingsWithIdx
    ]);
    const watchlist = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[watchlist]": ()=>watchlistWithIdx.map({
                "PortfolioTab.useMemo[watchlist]": ({ p })=>p
            }["PortfolioTab.useMemo[watchlist]"])
    }["PortfolioTab.useMemo[watchlist]"], [
        watchlistWithIdx
    ]);
    // Issue 15: fetch LIVE prices via getLiveQuote (batched server-side) for
    // all portfolio symbols — both holdings and watchlist. Used for per-row
    // live P&L on holdings and per-row live price on watch-only items.
    const symbols = sorted.map((p)=>p.symbol);
    const { prices: livePrices, isLoading: pricesLoading, refresh: refreshPrices, lastUpdated: pricesLastUpdated } = usePortfolioLiveQuotes(symbols);
    // ─── Issue 13: open the Close dialog and fetch the latest price ───
    // Pre-fills the sell price input with the cached live quote (getLiveQuote
    // via /api/psx/live/batch) for the symbol, then re-fetches a fresh quote
    // server-side for the dialog so the user has the most recent fill.
    // Preserves the close-trade flow: CGT + broker commission calc, holding
    // period detection, closed-trade record push to the Tracker.
    const openCloseDialog = (p)=>{
        if (!p.buyPrice || !p.shares) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("This stock has no shares to close");
            return;
        }
        const target = {
            symbol: p.symbol,
            name: p.name,
            sector: p.sector,
            buyPrice: p.buyPrice,
            shares: p.shares,
            addedAt: p.addedAt,
            buyLots: p.buyLots
        };
        setCloseTarget(target);
        // Pre-fill with cached live price if available (from /api/psx/live/batch)
        const cached = livePrices[p.symbol];
        setCloseSellPrice(typeof cached === "number" ? cached.toFixed(2) : p.buyPrice.toFixed(2));
        // Re-fetch a fresh live quote for the close-trade dialog so the user has
        // the most recent fill price (uses getLiveQuote's 60s cache server-side).
        setClosePriceLoading(true);
        fetch(`/api/psx/live?symbol=${encodeURIComponent(p.symbol)}`).then((r)=>r.ok ? r.json() : null).then((d)=>{
            if (!d) return;
            if (typeof d.price === "number" && d.price > 0) {
                setCloseSellPrice(d.price.toFixed(2));
            } else if (typeof d.close === "number" && d.close > 0) {
                setCloseSellPrice(d.close.toFixed(2));
            }
        }).catch(()=>{
        // ignore — user can manually enter the sell price
        }).finally(()=>setClosePriceLoading(false));
    };
    // Compute close metrics reactively from current sellPrice input
    const closeCalc = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[closeCalc]": ()=>{
            if (!closeTarget) return null;
            const sp = parseFloat(closeSellPrice.replace(/[,\s]/g, ""));
            if (!Number.isFinite(sp) || sp <= 0) return null;
            return computeCloseMetrics(closeTarget.buyPrice, closeTarget.shares, sp, closeTarget.addedAt);
        }
    }["PortfolioTab.useMemo[closeCalc]"], [
        closeTarget,
        closeSellPrice
    ]);
    const confirmCloseTrade = ()=>{
        if (!closeTarget || !closeCalc) {
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].error("Enter a valid sell price to close");
            return;
        }
        setCloseSubmitting(true);
        const t = closeTarget;
        const c = closeCalc;
        const closedTrade = {
            id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            symbol: t.symbol,
            name: t.name,
            sector: t.sector ?? null,
            // Issue 33: ALL P&L numbers (buyCost, grossPnl, netPnl, netPnlPct) are
            // computed from the weighted-AVG buyPrice × totalShares. ONE closed-
            // trade entry is created per close, regardless of how many buy lots
            // the position had. The per-lot breakdown is preserved on `buyLots`
            // for display only (the closed-trade row shows "AVG · N lots").
            buyPrice: t.buyPrice,
            shares: t.shares,
            sellPrice: c.sellPrice,
            buyCost: c.buyCost,
            sellValue: c.sellValue,
            commission: c.commission,
            cgt: c.cgt,
            grossPnl: c.grossPnl,
            netPnl: c.netPnl,
            netPnlPct: c.netPnlPct,
            holdingDays: c.holdingDays,
            taxRate: c.taxRate,
            closedAt: new Date().toISOString(),
            buyLots: t.buyLots
        };
        closePositionFromPortfolio(t.symbol, closedTrade);
        pushNotification({
            type: "info",
            title: `${t.symbol} closed — Net P&L PKR ${Math.round(c.netPnl).toLocaleString()}`,
            body: `Sold ${t.shares} sh @ ${c.sellPrice.toFixed(2)} · commission PKR ${Math.round(c.commission).toLocaleString()} · CGT PKR ${Math.round(c.cgt).toLocaleString()} (${(c.taxRate * 100).toFixed(0)}% bracket) · holding ${c.holdingDays}d. Position reset to watch-only.`,
            linkView: "tracker"
        });
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].success(`${t.symbol} closed — Net P&L PKR ${Math.round(c.netPnl).toLocaleString()} (${c.netPnlPct >= 0 ? "+" : ""}${c.netPnlPct.toFixed(2)}%). Position reset to watch-only.`);
        setCloseTarget(null);
        setCloseSellPrice("");
        setCloseSubmitting(false);
    };
    // ─── Issue 15: Holdings-only totals (watchlist does NOT count) ──────────
    // Per-position: current value = shares × livePrice, P&L = (livePrice −
    // buyPrice) × shares, P&L% = ((livePrice − buyPrice)/buyPrice) × 100.
    // Totals: sum of all holdings' cost/value/P&L → portfolio summary cards.
    const totalCost = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[totalCost]": ()=>holdings.reduce({
                "PortfolioTab.useMemo[totalCost]": (sum, p)=>sum + p.shares * p.buyPrice
            }["PortfolioTab.useMemo[totalCost]"], 0)
    }["PortfolioTab.useMemo[totalCost]"], [
        holdings
    ]);
    const totalValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "PortfolioTab.useMemo[totalValue]": ()=>holdings.reduce({
                "PortfolioTab.useMemo[totalValue]": (sum, p)=>{
                    const live = livePrices[p.symbol];
                    if (typeof live === "number") return sum + p.shares * live;
                    // Fallback to MOCK_STOCKS price when fetch hasn't resolved or failed
                    const stock = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MOCK_STOCKS"].find({
                        "PortfolioTab.useMemo[totalValue].stock": (s)=>s.symbol === p.symbol
                    }["PortfolioTab.useMemo[totalValue].stock"]);
                    return stock ? sum + p.shares * stock.price : sum;
                }
            }["PortfolioTab.useMemo[totalValue]"], 0)
    }["PortfolioTab.useMemo[totalValue]"], [
        holdings,
        livePrices
    ]);
    const totalPnL = totalValue - totalCost;
    const totalPnLPct = totalCost > 0 ? totalPnL / totalCost * 100 : 0;
    const hasLivePrices = Object.keys(livePrices).length > 0;
    const moveUp = (idx)=>{
        if (idx === 0) return;
        reorder(idx, idx - 1);
    };
    const moveDown = (idx)=>{
        if (idx === sorted.length - 1) return;
        reorder(idx, idx + 1);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "px-4 md:px-6 py-6 max-w-5xl mx-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between mb-6 flex-wrap gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-2xl font-bold text-[#F4F7FB]",
                                children: "Portfolio & Watchlist"
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 500,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm text-[#94A3B8] mt-1",
                                children: "Add stocks, drag-to-reorder, optional buy price triggers P&L tracking + suggestions."
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 501,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 499,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                        open: addOpen,
                        onOpenChange: setAddOpen,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTrigger"], {
                                asChild: true,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    className: "bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                            className: "h-4 w-4 mr-1.5"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 508,
                                            columnNumber: 17
                                        }, this),
                                        "Add stock"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 507,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 506,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                                className: "bg-[#131829] border-white/[0.12]",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                            className: "text-[#F4F7FB]",
                                            children: "Add to portfolio"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 514,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 513,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "space-y-4 py-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                                        className: "text-[#94A3B8]",
                                                        children: "Select stock (any of 1000+ PSX-listed companies)"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 518,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$latent$2f$StockSearch$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StockSearch"], {
                                                        value: selectedSymbol,
                                                        onChange: (sym, company)=>{
                                                            setSelectedSymbol(sym);
                                                            setSelectedName(company?.label || "");
                                                            // Issue 27: fall back to classifySector(symbol) when the
                                                            // upstream company.sector is missing (e.g. pypsx not
                                                            // configured → /api/psx/companies returns no sectors).
                                                            setSelectedSector(company?.sector || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$company$2d$results$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classifySector"])(sym));
                                                            // Don't pre-fill buy price — user must explicitly enter it.
                                                            setBuyPrice("");
                                                        },
                                                        placeholder: "Search any PSX stock by symbol or name..."
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 521,
                                                        columnNumber: 19
                                                    }, this),
                                                    selectedSymbol && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[11px] text-[#94A3B8] mt-1",
                                                        children: [
                                                            "Selected: ",
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "font-mono font-semibold text-[#00E676]",
                                                                children: selectedSymbol
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 537,
                                                                columnNumber: 33
                                                            }, this),
                                                            selectedName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-[#64748B]",
                                                                children: [
                                                                    " — ",
                                                                    selectedName
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 538,
                                                                columnNumber: 40
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 536,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 517,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid grid-cols-2 gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                                                className: "text-[#94A3B8]",
                                                                children: "Buy price (optional)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 544,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: buyPrice,
                                                                onChange: (e)=>setBuyPrice(e.target.value),
                                                                placeholder: "e.g. 285",
                                                                type: "number",
                                                                className: "bg-[#0A0E1A] border-white/[0.12] text-[#F4F7FB] font-mono"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 545,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 543,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "space-y-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                                                className: "text-[#94A3B8]",
                                                                children: "Shares (optional — required for P&L tracking)"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 554,
                                                                columnNumber: 21
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                                value: shares,
                                                                onChange: (e)=>setShares(e.target.value),
                                                                placeholder: "e.g. 100",
                                                                type: "number",
                                                                className: "bg-[#0A0E1A] border-white/[0.12] text-[#F4F7FB] font-mono"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 557,
                                                                columnNumber: 21
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 553,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 542,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-[#64748B] leading-relaxed",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[#94A3B8] font-semibold",
                                                        children: "Issue 19 behavior:"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 567,
                                                        columnNumber: 19
                                                    }, this),
                                                    ' ',
                                                    "The stock is ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[#00E676] font-semibold",
                                                        children: "not moved to holdings"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 568,
                                                        columnNumber: 32
                                                    }, this),
                                                    " until you specify the number of shares. Leaving shares empty adds the stock as a",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[#FBBF24] font-semibold",
                                                        children: " watch-only item"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 570,
                                                        columnNumber: 19
                                                    }, this),
                                                    " (no P&L tracking). You can add shares later."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 566,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                onClick: handleAdd,
                                                disabled: !selectedSymbol,
                                                className: "w-full bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold",
                                                children: selectedSymbol ? `Add ${selectedSymbol}${shares ? ` (${shares} shares)` : " (watch only)"}` : "Add to portfolio"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 572,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 516,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 512,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 505,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 498,
                columnNumber: 9
            }, this),
            sorted.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-end gap-2 mb-2",
                        children: [
                            pricesLastUpdated && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-[10px] text-[#64748B] font-mono",
                                children: [
                                    "Live prices updated ",
                                    pricesLastUpdated.toLocaleTimeString()
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 592,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "outline",
                                size: "sm",
                                onClick: refreshPrices,
                                disabled: pricesLoading,
                                className: "border-white/[0.12] text-[#94A3B8] h-7",
                                children: [
                                    pricesLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                        className: "h-3 w-3 mr-1.5 animate-spin"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 604,
                                        columnNumber: 19
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                        className: "h-3 w-3 mr-1.5"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 606,
                                        columnNumber: 19
                                    }, this),
                                    "Refresh prices"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 596,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 590,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-2 md:grid-cols-4 gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                className: "bg-[#131829] border-white/[0.08]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                    className: "p-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                            children: "Holdings"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 615,
                                            columnNumber: 19
                                        }, this),
                                        pricesLoading && !hasLivePrices ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                            className: "h-7 w-12 bg-white/[0.04] mt-1"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 617,
                                            columnNumber: 21
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xl font-bold text-[#F4F7FB] font-mono",
                                            children: holdings.length
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 619,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-[#64748B] mt-0.5",
                                            children: [
                                                watchlist.length,
                                                " watch-only"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 621,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 614,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 613,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                className: "bg-[#131829] border-white/[0.08]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                    className: "p-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                            children: "Cost basis"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 629,
                                            columnNumber: 19
                                        }, this),
                                        pricesLoading && !hasLivePrices ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                            className: "h-7 w-24 bg-white/[0.04] mt-1"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 631,
                                            columnNumber: 21
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xl font-bold text-[#F4F7FB] font-mono",
                                            children: [
                                                "PKR ",
                                                totalCost.toLocaleString()
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 633,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-[#64748B] mt-0.5",
                                            children: "total invested"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 637,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 628,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 627,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                className: "bg-[#131829] border-white/[0.08]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                    className: "p-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                            children: "Market value"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 643,
                                            columnNumber: 19
                                        }, this),
                                        pricesLoading && !hasLivePrices ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                            className: "h-7 w-24 bg-white/[0.04] mt-1"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 645,
                                            columnNumber: 21
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xl font-bold text-[#F4F7FB] font-mono",
                                            children: [
                                                "PKR ",
                                                totalValue.toLocaleString()
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 647,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-[#64748B] mt-0.5",
                                            children: "live"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 651,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 642,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 641,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                className: `bg-[#131829] ${totalPnL >= 0 ? "border-[#00E676]/30" : "border-[#FF5C5C]/30"}`,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                    className: "p-4",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] uppercase tracking-wider text-[#64748B]",
                                            children: "Total P&L"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 657,
                                            columnNumber: 19
                                        }, this),
                                        pricesLoading && !hasLivePrices ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                            className: "h-7 w-32 bg-white/[0.04] mt-1"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 659,
                                            columnNumber: 21
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: `text-xl font-bold font-mono ${totalPnL >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                            children: [
                                                totalPnL >= 0 ? "+" : "",
                                                totalPnL.toLocaleString(),
                                                " (",
                                                totalPnLPct.toFixed(2),
                                                "%)"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 661,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-[10px] text-[#64748B] mt-0.5",
                                            children: "overall"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 665,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 656,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 655,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 611,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 589,
                columnNumber: 11
            }, this),
            sorted.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                className: "bg-[#131829] border-white/[0.08]",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                    className: "p-12 text-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$briefcase$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Briefcase$3e$__["Briefcase"], {
                            className: "h-12 w-12 text-[#00E676]/30 mx-auto mb-3"
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 676,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            className: "font-semibold text-[#F4F7FB] mb-1",
                            children: "No stocks in your portfolio yet"
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 677,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-xs text-[#94A3B8] mb-4",
                            children: "Add stocks to track them. Specify buy price + shares to enable live P&L tracking and hold/sell/buy-more suggestions."
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 678,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            onClick: ()=>setAddOpen(true),
                            className: "bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881]",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                    className: "h-4 w-4 mr-1.5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 685,
                                    columnNumber: 17
                                }, this),
                                "Add your first stock"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 681,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 675,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 674,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 mb-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                        className: "h-4 w-4 text-[#00E676]"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 695,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-sm font-semibold uppercase tracking-wider text-[#F4F7FB]",
                                        children: "Holdings"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 696,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                        variant: "outline",
                                        className: "text-[9px] py-0 h-4 border-white/[0.12] text-[#94A3B8]",
                                        children: [
                                            holdings.length,
                                            " open"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 697,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] text-[#64748B] ml-1",
                                        children: "real positions · live P&L tracked"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 700,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 694,
                                columnNumber: 15
                            }, this),
                            holdings.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-white/[0.06] bg-[#131829] p-6 text-center",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                        className: "h-8 w-8 text-[#64748B]/40 mx-auto mb-2"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 705,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-[#94A3B8] mb-1",
                                        children: "No open positions yet"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 706,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[10px] text-[#64748B]",
                                        children: "Add a stock with shares + buy price to start tracking live P&L."
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 707,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 704,
                                columnNumber: 17
                            }, this) : pricesLoading && !hasLivePrices ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2",
                                children: holdings.map((p, idx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                        className: "h-20 w-full bg-[#131829] border border-white/[0.06]"
                                    }, `${p.symbol}-${idx}-sk`, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 714,
                                        columnNumber: 21
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 712,
                                columnNumber: 17
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2 max-h-[480px] overflow-y-auto pr-1 latent-scroll",
                                children: holdingsWithIdx.map(({ p, idx }, i)=>{
                                    const livePrice = livePrices[p.symbol];
                                    const mockStock = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MOCK_STOCKS"].find((s)=>s.symbol === p.symbol);
                                    const currentPrice = typeof livePrice === "number" ? livePrice : mockStock ? mockStock.price : null;
                                    const pnl = currentPrice !== null ? (currentPrice - p.buyPrice) * p.shares : 0;
                                    const pnlPct = currentPrice !== null ? (currentPrice - p.buyPrice) / p.buyPrice * 100 : 0;
                                    const isProfit = pnl > 0;
                                    const isLoss = pnl < 0;
                                    const currentValue = currentPrice !== null ? p.shares * currentPrice : null;
                                    const suggestion = currentPrice === null ? "Live price unavailable — check quote source" : isProfit && pnlPct > 15 ? "Take partial profit — book 30-50% of position" : isProfit ? "Hold — trend still intact" : isLoss && pnlPct < -10 ? "Consider averaging down on next dip — improve cost basis" : isLoss ? "Hold — within normal volatility. Stop-loss not hit." : "Hold — at breakeven";
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                        className: `bg-[#131829] border-white/[0.08] ${isProfit ? "border-l-[#00E676]/60" : isLoss ? "border-l-[#FF5C5C]/60" : ""}`,
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                            className: "p-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center gap-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex flex-col gap-0.5",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    onClick: ()=>moveUp(idx),
                                                                    disabled: idx === 0,
                                                                    className: `text-[#64748B] hover:text-[#F4F7FB] ${idx === 0 ? "opacity-30 cursor-not-allowed" : ""}`,
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__["ArrowUp"], {
                                                                        className: "h-3.5 w-3.5"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 770,
                                                                        columnNumber: 33
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 765,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    onClick: ()=>moveDown(idx),
                                                                    disabled: idx === sorted.length - 1,
                                                                    className: `text-[#64748B] hover:text-[#F4F7FB] ${idx === sorted.length - 1 ? "opacity-30 cursor-not-allowed" : ""}`,
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__["ArrowDown"], {
                                                                        className: "h-3.5 w-3.5"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 777,
                                                                        columnNumber: 33
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 772,
                                                                    columnNumber: 31
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 764,
                                                            columnNumber: 29
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "h-10 w-10 rounded-lg bg-[#00E676]/10 flex items-center justify-center font-mono font-bold text-[#00E676] text-sm",
                                                            children: p.symbol.slice(0, 4)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 782,
                                                            columnNumber: 29
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                            onClick: ()=>{
                                                                setView("signals_v2");
                                                                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(`Opening analysis for ${p.symbol}...`);
                                                            },
                                                            className: "flex-1 text-left hover:opacity-80",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "flex items-center gap-2",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                            className: "font-bold text-[#F4F7FB]",
                                                                            children: p.symbol
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                            lineNumber: 795,
                                                                            columnNumber: 33
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                            variant: "outline",
                                                                            className: `text-[9px] py-0 h-4 ${isProfit ? "border-[#00E676]/40 text-[#00E676]" : isLoss ? "border-[#FF5C5C]/40 text-[#FF5C5C]" : "border-white/[0.12] text-[#94A3B8]"}`,
                                                                            children: isProfit ? "PROFIT" : isLoss ? "LOSS" : "BREAK EVEN"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                            lineNumber: 796,
                                                                            columnNumber: 33
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 794,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-[11px] text-[#94A3B8] truncate max-w-[300px]",
                                                                    children: p.name
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 800,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-[10px] text-[#64748B] mt-0.5 font-mono",
                                                                    children: (p.buyLots?.length ?? 0) > 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-[#FBBF24] font-semibold",
                                                                                children: [
                                                                                    "Avg ",
                                                                                    p.buyPrice.toFixed(2)
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                lineNumber: 805,
                                                                                columnNumber: 37
                                                                            }, this),
                                                                            " × ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: p.shares.toLocaleString()
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                lineNumber: 808,
                                                                                columnNumber: 37
                                                                            }, this),
                                                                            " = ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                children: [
                                                                                    "PKR ",
                                                                                    Math.round(p.buyPrice * p.shares).toLocaleString()
                                                                                ]
                                                                            }, void 0, true, {
                                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                lineNumber: 810,
                                                                                columnNumber: 37
                                                                            }, this),
                                                                            " ",
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                className: "text-[#64748B]/70",
                                                                                children: "· breakeven"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                lineNumber: 812,
                                                                                columnNumber: 37
                                                                            }, this)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 804,
                                                                        columnNumber: 35
                                                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        children: [
                                                                            "Buy: ",
                                                                            p.buyPrice.toFixed(2),
                                                                            " × ",
                                                                            p.shares.toLocaleString(),
                                                                            " = PKR ",
                                                                            Math.round(p.buyPrice * p.shares).toLocaleString()
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 815,
                                                                        columnNumber: 35
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 802,
                                                                    columnNumber: 31
                                                                }, this),
                                                                (p.buyLots?.length ?? 0) > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "mt-1 space-y-0.5",
                                                                    children: p.buyLots.map((lot, li)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "text-[9px] font-mono text-[#64748B] flex items-center gap-1.5",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "inline-flex items-center justify-center min-w-[36px] h-3 px-1 rounded bg-white/[0.04] text-[#64748B]",
                                                                                    children: [
                                                                                        "Lot ",
                                                                                        li + 1
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                    lineNumber: 825,
                                                                                    columnNumber: 39
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    children: lot.price.toFixed(2)
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                    lineNumber: 828,
                                                                                    columnNumber: 39
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "text-[#64748B]/60",
                                                                                    children: "×"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                    lineNumber: 829,
                                                                                    columnNumber: 39
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    children: lot.shares.toLocaleString()
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                    lineNumber: 830,
                                                                                    columnNumber: 39
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    className: "text-[#64748B]/60",
                                                                                    children: "="
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                    lineNumber: 831,
                                                                                    columnNumber: 39
                                                                                }, this),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                                    children: [
                                                                                        "PKR ",
                                                                                        Math.round(lot.price * lot.shares).toLocaleString()
                                                                                    ]
                                                                                }, void 0, true, {
                                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                                    lineNumber: 832,
                                                                                    columnNumber: 39
                                                                                }, this)
                                                                            ]
                                                                        }, li, true, {
                                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                            lineNumber: 824,
                                                                            columnNumber: 37
                                                                        }, this))
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 822,
                                                                    columnNumber: 33
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 787,
                                                            columnNumber: 29
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-right shrink-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-sm font-mono font-bold text-[#F4F7FB]",
                                                                    children: currentPrice !== null ? currentPrice.toLocaleString() : "—"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 841,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-[10px] text-[#64748B]",
                                                                    children: currentPrice !== null ? "live" : "no live price"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 844,
                                                                    columnNumber: 31
                                                                }, this),
                                                                currentPrice !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: `text-xs font-mono font-bold ${isProfit ? "text-[#00E676]" : isLoss ? "text-[#FF5C5C]" : "text-[#94A3B8]"}`,
                                                                    children: [
                                                                        pnl >= 0 ? "+" : "",
                                                                        pnl.toLocaleString(),
                                                                        " (",
                                                                        pnlPct.toFixed(1),
                                                                        "%)"
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 848,
                                                                    columnNumber: 33
                                                                }, this),
                                                                currentValue !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "text-[9px] text-[#64748B] font-mono mt-0.5",
                                                                    children: [
                                                                        "val PKR ",
                                                                        currentValue.toLocaleString()
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 853,
                                                                    columnNumber: 33
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 840,
                                                            columnNumber: 29
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-1 shrink-0 ml-2",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    onClick: ()=>openCloseDialog(p),
                                                                    className: "text-[#64748B] hover:text-[#00E676] px-1.5 py-1 rounded-md hover:bg-[#00E676]/10 transition-colors",
                                                                    title: "Close trade — sell all shares and lock in P&L",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                                                        className: "h-4 w-4"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 866,
                                                                        columnNumber: 33
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 861,
                                                                    columnNumber: 31
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                    onClick: ()=>{
                                                                        removePosition(p.symbol);
                                                                        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(`${p.symbol} removed from portfolio`);
                                                                    },
                                                                    className: "text-[#64748B] hover:text-[#FF5C5C] px-1.5 py-1 rounded-md hover:bg-[#FF5C5C]/10 transition-colors",
                                                                    title: "Remove from portfolio",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                                        className: "h-4 w-4"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 876,
                                                                        columnNumber: 33
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 868,
                                                                    columnNumber: 31
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 860,
                                                            columnNumber: 29
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 762,
                                                    columnNumber: 27
                                                }, this),
                                                suggestion && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "mt-3 pt-3 border-t border-white/[0.06] flex items-start gap-2",
                                                    children: [
                                                        isProfit ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                                                            className: "h-3 w-3 text-[#00E676] mt-0.5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 884,
                                                            columnNumber: 43
                                                        }, this) : isLoss ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingDown$3e$__["TrendingDown"], {
                                                            className: "h-3 w-3 text-[#FF5C5C] mt-0.5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 885,
                                                            columnNumber: 41
                                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$minus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Minus$3e$__["Minus"], {
                                                            className: "h-3 w-3 text-[#94A3B8] mt-0.5"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 886,
                                                            columnNumber: 32
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-[10px] uppercase tracking-wider text-[#64748B] font-semibold",
                                                                    children: "Suggestion:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 888,
                                                                    columnNumber: 33
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-xs text-[#94A3B8] ml-1.5",
                                                                    children: suggestion
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 891,
                                                                    columnNumber: 33
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 887,
                                                            columnNumber: 31
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 883,
                                                    columnNumber: 29
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 761,
                                            columnNumber: 25
                                        }, this)
                                    }, `${p.symbol}-${i}`, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 757,
                                        columnNumber: 23
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 721,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 693,
                        columnNumber: 13
                    }, this),
                    watchlist.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 mb-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__["Eye"], {
                                        className: "h-4 w-4 text-[#FBBF24]"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 907,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        className: "text-sm font-semibold uppercase tracking-wider text-[#F4F7FB]",
                                        children: "Watchlist"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 908,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                        variant: "outline",
                                        className: "text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24]",
                                        children: [
                                            watchlist.length,
                                            " watching"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 909,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] text-[#64748B] ml-1",
                                        children: "watch-only — not counted in holdings P&L"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 912,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 906,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-2 max-h-96 overflow-y-auto pr-1 latent-scroll",
                                children: watchlistWithIdx.map(({ p, idx }, i)=>{
                                    const livePrice = livePrices[p.symbol];
                                    const mockStock = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MOCK_STOCKS"].find((s)=>s.symbol === p.symbol);
                                    const currentPrice = typeof livePrice === "number" ? livePrice : mockStock ? mockStock.price : null;
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                                        className: "bg-[#131829] border-white/[0.08] border-l-[#FBBF24]/40",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                                            className: "p-4",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex flex-col gap-0.5",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>moveUp(idx),
                                                                disabled: idx === 0,
                                                                className: `text-[#64748B] hover:text-[#F4F7FB] ${idx === 0 ? "opacity-30 cursor-not-allowed" : ""}`,
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUp$3e$__["ArrowUp"], {
                                                                    className: "h-3.5 w-3.5"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 940,
                                                                    columnNumber: 33
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 935,
                                                                columnNumber: 31
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                onClick: ()=>moveDown(idx),
                                                                disabled: idx === sorted.length - 1,
                                                                className: `text-[#64748B] hover:text-[#F4F7FB] ${idx === sorted.length - 1 ? "opacity-30 cursor-not-allowed" : ""}`,
                                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowDown$3e$__["ArrowDown"], {
                                                                    className: "h-3.5 w-3.5"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 947,
                                                                    columnNumber: 33
                                                                }, this)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 942,
                                                                columnNumber: 31
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 934,
                                                        columnNumber: 29
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-10 w-10 rounded-lg bg-[#FBBF24]/10 flex items-center justify-center font-mono font-bold text-[#FBBF24] text-sm",
                                                        children: p.symbol.slice(0, 4)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 952,
                                                        columnNumber: 29
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>{
                                                            setView("signals_v2");
                                                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(`Opening analysis for ${p.symbol}...`);
                                                        },
                                                        className: "flex-1 text-left hover:opacity-80",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex items-center gap-2",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                        className: "font-bold text-[#F4F7FB]",
                                                                        children: p.symbol
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 965,
                                                                        columnNumber: 33
                                                                    }, this),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                        variant: "outline",
                                                                        className: "text-[9px] py-0 h-4 border-[#FBBF24]/40 text-[#FBBF24]",
                                                                        children: "WATCHING"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 966,
                                                                        columnNumber: 33
                                                                    }, this)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 964,
                                                                columnNumber: 31
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-[11px] text-[#94A3B8] truncate max-w-[300px]",
                                                                children: p.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 970,
                                                                columnNumber: 31
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-[10px] text-[#64748B] mt-0.5",
                                                                children: [
                                                                    "Added ",
                                                                    new Date(p.addedAt).toLocaleDateString(),
                                                                    " · no position yet"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 971,
                                                                columnNumber: 31
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 957,
                                                        columnNumber: 29
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-right shrink-0",
                                                        children: [
                                                            pricesLoading && currentPrice === null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                                                className: "h-5 w-16 bg-white/[0.04] ml-auto"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 979,
                                                                columnNumber: 33
                                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-sm font-mono font-bold text-[#F4F7FB]",
                                                                children: currentPrice !== null ? currentPrice.toLocaleString() : "—"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 981,
                                                                columnNumber: 33
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-[10px] text-[#64748B]",
                                                                children: currentPrice !== null ? "live" : "no live price"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                lineNumber: 985,
                                                                columnNumber: 31
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 977,
                                                        columnNumber: 29
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>{
                                                            removePosition(p.symbol);
                                                            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$sonner$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["toast"].info(`${p.symbol} removed from watchlist`);
                                                        },
                                                        className: "text-[#64748B] hover:text-[#FF5C5C] px-1.5 py-1 rounded-md hover:bg-[#FF5C5C]/10 transition-colors shrink-0 ml-2",
                                                        title: "Remove from watchlist",
                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                                            className: "h-4 w-4"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 999,
                                                            columnNumber: 31
                                                        }, this)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 991,
                                                        columnNumber: 29
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 932,
                                                columnNumber: 27
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 931,
                                            columnNumber: 25
                                        }, this)
                                    }, `${p.symbol}-${i}-w`, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 927,
                                        columnNumber: 23
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 916,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 905,
                        columnNumber: 15
                    }, this)
                ]
            }, void 0, true),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-lg bg-[#0A0E1A] border border-white/[0.06] p-3 text-[11px] text-[#64748B] leading-relaxed mt-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[#94A3B8] font-semibold",
                        children: "Tip:"
                    }, void 0, false, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 1013,
                        columnNumber: 11
                    }, this),
                    " Click any stock in your portfolio to open its full analysis (fundamentals + technicals + AI model call). Drag the up/down arrows to reorder your list. Buy price is optional — leave empty for watch-only stocks."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 1012,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PortfolioNewsDigest, {
                symbols: portfolio.length > 0 ? portfolio.map((p)=>p.symbol) : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MOCK_STOCKS"].slice(0, 4).map((s)=>s.symbol)
            }, void 0, false, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 1017,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: !!closeTarget,
                onOpenChange: (open)=>{
                    if (!open) {
                        setCloseTarget(null);
                        setCloseSellPrice("");
                    }
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "bg-[#131829] border-white/[0.12] max-w-lg",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                className: "text-[#F4F7FB] flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                        className: "h-4 w-4 text-[#00E676]"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 1035,
                                        columnNumber: 17
                                    }, this),
                                    "Close trade — ",
                                    closeTarget?.symbol
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                lineNumber: 1034,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1033,
                            columnNumber: 13
                        }, this),
                        closeTarget && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-4 py-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-md bg-[#0A0E1A] border border-white/[0.06] p-3",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "font-bold text-[#F4F7FB]",
                                                        children: closeTarget.symbol
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 1045,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[11px] text-[#94A3B8] truncate max-w-[260px]",
                                                        children: closeTarget.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 1046,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 1044,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-right",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-[11px] text-[#64748B]",
                                                        children: "Buy price × shares"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 1049,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "font-mono text-sm text-[#F4F7FB]",
                                                        children: [
                                                            closeTarget.buyPrice.toFixed(2),
                                                            " × ",
                                                            closeTarget.shares.toLocaleString()
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                        lineNumber: 1050,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                lineNumber: 1048,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                        lineNumber: 1043,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1042,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            className: "text-[#94A3B8] flex items-center gap-1.5",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calculator$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Calculator$3e$__["Calculator"], {
                                                    className: "h-3 w-3"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1060,
                                                    columnNumber: 21
                                                }, this),
                                                "Sell price (PKR per share)",
                                                closePriceLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                    className: "h-3 w-3 animate-spin text-[#00E676]"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1062,
                                                    columnNumber: 43
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1059,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-center gap-1.5 bg-[#0A0E1A] border border-white/[0.08] rounded-md px-3 py-2 focus-within:border-[#00E676]/40",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-xs text-[#64748B] font-mono",
                                                    children: "Rs."
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1065,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                    value: closeSellPrice,
                                                    onChange: (e)=>setCloseSellPrice(e.target.value),
                                                    onKeyDown: (e)=>{
                                                        if (e.key === "Enter") confirmCloseTrade();
                                                    },
                                                    placeholder: "0.00",
                                                    inputMode: "decimal",
                                                    autoFocus: true,
                                                    className: "h-7 border-0 bg-transparent p-0 text-sm font-mono text-[#F4F7FB] focus-visible:ring-0"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1066,
                                                    columnNumber: 21
                                                }, this),
                                                typeof livePrices[closeTarget.symbol] === "number" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-[10px] text-[#64748B] ml-auto",
                                                    children: [
                                                        "live: ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "font-mono text-[#94A3B8]",
                                                            children: livePrices[closeTarget.symbol].toFixed(2)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1079,
                                                            columnNumber: 31
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1078,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1064,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[10px] text-[#64748B] leading-relaxed",
                                            children: [
                                                "Auto-filled from the latest OHLCV close via ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                                                    className: "text-[#00E676]",
                                                    children: [
                                                        "/api/psx/ohlcv/",
                                                        closeTarget.symbol
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1084,
                                                    columnNumber: 65
                                                }, this),
                                                ". You can override it if you have a different fill price."
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1083,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1058,
                                    columnNumber: 17
                                }, this),
                                closeCalc ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-md border border-white/[0.06] bg-[#0A0E1A] divide-y divide-white/[0.04]",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CloseRow, {
                                            label: "Buy cost",
                                            value: `PKR ${Math.round(closeCalc.buyCost).toLocaleString()}`,
                                            sub: `${closeTarget.buyPrice.toFixed(2)} × ${closeTarget.shares.toLocaleString()}`
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1092,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CloseRow, {
                                            label: "Sell value",
                                            value: `PKR ${Math.round(closeCalc.sellValue).toLocaleString()}`,
                                            sub: `${closeCalc.sellPrice.toFixed(2)} × ${closeTarget.shares.toLocaleString()}`
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1093,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CloseRow, {
                                            label: "Gross P&L",
                                            value: `PKR ${Math.round(closeCalc.grossPnl).toLocaleString()}`,
                                            sub: `${closeCalc.grossPnl >= 0 ? "+" : ""}${(closeCalc.grossPnl / Math.max(1, closeCalc.buyCost) * 100).toFixed(2)}%`,
                                            valueClass: closeCalc.grossPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1094,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CloseRow, {
                                            label: "Broker commission",
                                            value: `PKR ${Math.round(closeCalc.commission).toLocaleString()}`,
                                            sub: "0.15% × sell value × 2 (buy + sell)",
                                            valueClass: "text-[#FF5C5C]"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1100,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CloseRow, {
                                            label: `CGT (${(closeCalc.taxRate * 100).toFixed(0)}% bracket)`,
                                            value: `PKR ${Math.round(closeCalc.cgt).toLocaleString()}`,
                                            sub: closeCalc.taxRate > 0 ? `Short-term: held ${closeCalc.holdingDays}d (≤12mo)` : `Long-term: held ${closeCalc.holdingDays}d (>12mo, exempt)`,
                                            valueClass: "text-[#FF5C5C]"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1106,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "p-3 flex items-center justify-between bg-white/[0.02]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold",
                                                            children: "Net P&L"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1116,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "text-[10px] text-[#64748B] mt-0.5",
                                                            children: "gross − commission − CGT"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1117,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1115,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-right",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: `text-lg font-mono font-bold ${closeCalc.netPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                            children: [
                                                                closeCalc.netPnl >= 0 ? "+" : "",
                                                                "PKR ",
                                                                Math.round(Math.abs(closeCalc.netPnl)).toLocaleString()
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1120,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: `text-[10px] font-mono ${closeCalc.netPnl >= 0 ? "text-[#00E676]" : "text-[#FF5C5C]"}`,
                                                            children: [
                                                                closeCalc.netPnlPct >= 0 ? "+" : "",
                                                                closeCalc.netPnlPct.toFixed(2),
                                                                "% net"
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1123,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1119,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1114,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1091,
                                    columnNumber: 19
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-md border border-white/[0.06] bg-[#0A0E1A] p-3 text-xs text-[#64748B] text-center",
                                    children: "Enter a valid sell price to see the calculation."
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1130,
                                    columnNumber: 19
                                }, this),
                                closeCalc && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-md bg-[#0A0E1A] border border-[#FBBF24]/20 p-2.5 flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$calendar$2d$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CalendarClock$3e$__["CalendarClock"], {
                                            className: "h-3.5 w-3.5 text-[#FBBF24] shrink-0"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1138,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[11px] text-[#94A3B8]",
                                            children: [
                                                "Holding period: ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "font-mono text-[#F4F7FB]",
                                                    children: [
                                                        closeCalc.holdingDays,
                                                        " days"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1140,
                                                    columnNumber: 39
                                                }, this),
                                                " (~",
                                                closeCalc.holdingMonths,
                                                " months) →",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: `ml-1 font-semibold ${closeCalc.taxRate > 0 ? "text-[#FF5C5C]" : "text-[#00E676]"}`,
                                                    children: closeCalc.taxRate > 0 ? "Short-term (15% CGT)" : "Long-term (0% CGT)"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1141,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1139,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1137,
                                    columnNumber: 19
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 pt-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            onClick: confirmCloseTrade,
                                            disabled: !closeCalc || closeSubmitting,
                                            className: "flex-1 bg-[#00E676] text-[#0A0E1A] hover:bg-[#22E881] font-semibold disabled:opacity-50",
                                            children: [
                                                closeSubmitting ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                                    className: "h-4 w-4 mr-1.5 animate-spin"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1155,
                                                    columnNumber: 23
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                    className: "h-4 w-4 mr-1.5"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1157,
                                                    columnNumber: 23
                                                }, this),
                                                "Confirm close"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1149,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            onClick: ()=>{
                                                setCloseTarget(null);
                                                setCloseSellPrice("");
                                            },
                                            variant: "outline",
                                            className: "border-white/[0.12] text-[#94A3B8] hover:text-[#F4F7FB]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                    className: "h-4 w-4 mr-1.5"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1169,
                                                    columnNumber: 21
                                                }, this),
                                                "Cancel"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1161,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1148,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[10px] text-[#64748B] leading-relaxed",
                                    children: [
                                        "Closing this trade will sell all ",
                                        closeTarget.shares.toLocaleString(),
                                        " shares and reset the position to ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#FBBF24] font-semibold",
                                            children: "watch-only"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1176,
                                            columnNumber: 22
                                        }, this),
                                        " (shares removed, buy price cleared). The closed trade is sent to the ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[#00E676] font-semibold",
                                            children: "Tracker"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1177,
                                            columnNumber: 51
                                        }, this),
                                        " for your P&L history."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1174,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1040,
                            columnNumber: 15
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 1032,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 1026,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
        lineNumber: 497,
        columnNumber: 5
    }, this);
}
_s1(PortfolioTab, "EsuZrbV9PTci6jXNpZWzGPvRdQY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        usePortfolioLiveQuotes
    ];
});
_c = PortfolioTab;
// ─── Issue 13: small sub-component for close-trade rows ────────────────────
function CloseRow({ label, value, sub, valueClass = "text-[#F4F7FB]" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-3 flex items-center justify-between",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[11px] uppercase tracking-wider text-[#94A3B8]",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 1203,
                        columnNumber: 9
                    }, this),
                    sub && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[10px] text-[#64748B] mt-0.5 font-mono",
                        children: sub
                    }, void 0, false, {
                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                        lineNumber: 1204,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 1202,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `text-sm font-mono font-semibold ${valueClass}`,
                children: value
            }, void 0, false, {
                fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                lineNumber: 1206,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
        lineNumber: 1201,
        columnNumber: 5
    }, this);
}
_c1 = CloseRow;
function PortfolioNewsDigest({ symbols }) {
    _s2();
    const [digest, setDigest] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const setView = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioNewsDigest.useLatentStore[setView]": (s)=>s.setView
    }["PortfolioNewsDigest.useLatentStore[setView]"]);
    const pushNotification = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"])({
        "PortfolioNewsDigest.useLatentStore[pushNotification]": (s)=>s.pushNotification
    }["PortfolioNewsDigest.useLatentStore[pushNotification]"]);
    const loadDigest = async ()=>{
        if (symbols.length === 0) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/portfolio/news-digest?symbols=${symbols.join(",")}&limit=2`);
            if (!res.ok) {
                const err = await res.json().catch(()=>({}));
                throw new Error(err.detail || err.error || `Failed (${res.status})`);
            }
            const data = await res.json();
            setDigest(data.digest || []);
            const total = data.totalInterpreted || 0;
            if (total > 0) {
                pushNotification({
                    type: "news",
                    title: `${total} news items interpreted`,
                    body: `Auto-analyzed news for ${symbols.length} portfolio stock${symbols.length === 1 ? "" : "s"}`,
                    linkView: "portfolio"
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load news digest");
        } finally{
            setLoading(false);
        }
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "PortfolioNewsDigest.useEffect": ()=>{
            loadDigest();
        }
    }["PortfolioNewsDigest.useEffect"], [
        symbols.join(",")
    ]);
    const impactColor = (i)=>i === "positive" ? "text-[#00E676]" : i === "negative" ? "text-[#FF5C5C]" : "text-[#94A3B8]";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "bg-[#131829] border-white/[0.08] mt-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
            className: "p-5",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center justify-between mb-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "font-semibold text-[#F4F7FB] flex items-center gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"], {
                                            className: "h-4 w-4 text-[#00E676]"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1284,
                                            columnNumber: 15
                                        }, this),
                                        "Auto-News Digest for Your Portfolio"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1283,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-[#94A3B8] mt-0.5",
                                    children: "For each stock below: news fetched from AskAnalyst + GLM-4 interprets impact in layman terms."
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1287,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1282,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            variant: "outline",
                            size: "sm",
                            onClick: loadDigest,
                            disabled: loading,
                            className: "border-white/[0.12] text-[#94A3B8] h-7",
                            children: [
                                loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                    className: "h-3 w-3 mr-1.5 animate-spin"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1299,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                    className: "h-3 w-3 mr-1.5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1301,
                                    columnNumber: 15
                                }, this),
                                "Refresh"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1291,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 1281,
                    columnNumber: 9
                }, this),
                loading && digest.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: [
                        1,
                        2,
                        3
                    ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$skeleton$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                            className: "h-24 w-full bg-white/[0.04]"
                        }, i, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1309,
                            columnNumber: 35
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 1308,
                    columnNumber: 11
                }, this),
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-md bg-[#FF5C5C]/[0.07] border border-[#FF5C5C]/20 p-3 text-xs text-[#FF5C5C]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "font-semibold",
                            children: "Error:"
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1315,
                            columnNumber: 13
                        }, this),
                        " ",
                        error
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 1314,
                    columnNumber: 11
                }, this),
                !loading && !error && digest.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-4",
                    children: digest.map((entry, di)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-l-2 border-[#00E676]/30 pl-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 mb-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "h-7 w-7 rounded-md bg-[#00E676]/10 flex items-center justify-center font-mono font-bold text-[#00E676] text-[10px]",
                                            children: entry.symbol.slice(0, 4)
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1324,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-semibold text-[#F4F7FB] text-sm",
                                            children: entry.symbol
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1327,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-[11px] text-[#94A3B8] truncate flex-1",
                                            children: entry.stockName
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1328,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            variant: "outline",
                                            className: "text-[9px] py-0 h-4 border-white/[0.12] text-[#64748B]",
                                            children: [
                                                entry.newsCount,
                                                " news"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1329,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1323,
                                    columnNumber: 17
                                }, this),
                                entry.interpretedItems.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-[#64748B] italic ml-9",
                                    children: [
                                        "No recent news from AskAnalyst for ",
                                        entry.symbol,
                                        "."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1335,
                                    columnNumber: 19
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2",
                                    children: entry.interpretedItems.map((item, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-md bg-[#0A0E1A] border border-white/[0.06] p-3",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center justify-between gap-2 mb-1.5",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-xs font-semibold text-[#F4F7FB] line-clamp-2 flex-1",
                                                            children: item.title || "(no headline)"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1343,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-1.5 shrink-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: `text-[10px] uppercase font-bold ${impactColor(item.impact)}`,
                                                                    children: item.impact
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 1347,
                                                                    columnNumber: 29
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                    variant: "outline",
                                                                    className: `text-[9px] py-0 h-4 ${item.impactStrength === "strong" ? "border-[#FF5C5C]/40 text-[#FF5C5C]" : item.impactStrength === "moderate" ? "border-amber-400/40 text-amber-400" : "border-white/[0.12] text-[#94A3B8]"}`,
                                                                    children: item.impactStrength
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 1350,
                                                                    columnNumber: 29
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1346,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1342,
                                                    columnNumber: 25
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-[#94A3B8] leading-relaxed mb-1.5",
                                                    children: item.laymanExplanation
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1359,
                                                    columnNumber: 25
                                                }, this),
                                                item.shortTermOutlook && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-[11px] text-[#64748B] italic",
                                                    children: [
                                                        "Outlook: ",
                                                        item.shortTermOutlook
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1363,
                                                    columnNumber: 27
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "flex items-center gap-1.5 flex-wrap",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "text-[10px] text-[#64748B] uppercase",
                                                                    children: "Affected:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                    lineNumber: 1369,
                                                                    columnNumber: 29
                                                                }, this),
                                                                item.affectedStocks.slice(0, 3).map((s, ai)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                                        onClick: ()=>setView("signals_v2"),
                                                                        className: "text-[10px] font-mono text-[#00E676] hover:underline",
                                                                        children: s
                                                                    }, `${s}-${ai}`, false, {
                                                                        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                                        lineNumber: 1371,
                                                                        columnNumber: 31
                                                                    }, this))
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1368,
                                                            columnNumber: 27
                                                        }, this),
                                                        item.link && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                            href: item.link,
                                                            target: "_blank",
                                                            rel: "noopener noreferrer",
                                                            className: "text-[10px] text-[#64748B] hover:text-[#F4F7FB]",
                                                            children: "Source ↗"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                            lineNumber: 1381,
                                                            columnNumber: 29
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                                    lineNumber: 1367,
                                                    columnNumber: 25
                                                }, this)
                                            ]
                                        }, i, true, {
                                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                            lineNumber: 1341,
                                            columnNumber: 23
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                                    lineNumber: 1339,
                                    columnNumber: 19
                                }, this)
                            ]
                        }, `${entry.symbol}-${di}`, true, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1322,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 1320,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-md bg-[#0A0E1A] border border-white/[0.06] p-2.5 mt-3 text-[10px] text-[#64748B]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-[#94A3B8] font-semibold",
                            children: "Manual URL paste:"
                        }, void 0, false, {
                            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                            lineNumber: 1401,
                            columnNumber: 11
                        }, this),
                        " For ultra-fast news from any source, paste the URL in the Fundamental News tab — that feature stays as an extra layer on top of this auto-digest."
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/latent/PortfolioTab.tsx",
                    lineNumber: 1400,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/latent/PortfolioTab.tsx",
            lineNumber: 1280,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/latent/PortfolioTab.tsx",
        lineNumber: 1279,
        columnNumber: 5
    }, this);
}
_s2(PortfolioNewsDigest, "W5rwqXUZEDKubHjoiqU3lLNf9e4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLatentStore"]
    ];
});
_c2 = PortfolioNewsDigest;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PortfolioTab");
__turbopack_context__.k.register(_c1, "CloseRow");
__turbopack_context__.k.register(_c2, "PortfolioNewsDigest");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_components_latent_PortfolioTab_tsx_6729161e._.js.map