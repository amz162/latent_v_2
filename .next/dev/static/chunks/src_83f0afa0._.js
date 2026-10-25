(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/latent/store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getBuyLots",
    ()=>getBuyLots,
    "mergeBuyLots",
    ()=>mergeBuyLots,
    "useLatentStore",
    ()=>useLatentStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
"use client";
;
;
function getBuyLots(p) {
    if (p.buys && p.buys.length) return p.buys;
    if (p.buyPrice && p.shares > 0) return [
        {
            price: p.buyPrice,
            shares: p.shares,
            at: p.addedAt
        }
    ];
    return [];
}
function mergeBuyLots(existing, incoming) {
    const now = new Date().toISOString();
    let lots = existing ? getBuyLots(existing) : [];
    if (existing && lots.length === 0 && existing.shares > 0) {
        // Legacy heal — see comment above.
        lots = [
            {
                price: incoming.price,
                shares: existing.shares,
                at: existing.addedAt
            }
        ];
    }
    return [
        ...lots,
        {
            price: incoming.price,
            shares: incoming.shares,
            at: now
        }
    ];
}
const useLatentStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set)=>({
        view: "landing",
        selectedSignalId: null,
        selectedSymbol: null,
        selectedBrokerId: null,
        userId: null,
        userEmail: "",
        userName: "",
        riskProfile: null,
        plan: null,
        trades: [],
        portfolio: [],
        closedTrades: [],
        notifications: [],
        setView: (v)=>set({
                view: v
            }),
        selectSignal: (id)=>set({
                selectedSignalId: id,
                view: "signal_detail"
            }),
        selectSymbol: (symbol)=>set({
                selectedSymbol: symbol
            }),
        selectBroker: (id)=>set({
                selectedBrokerId: id
            }),
        setUser: (id, email, name = "")=>set({
                userId: id,
                userEmail: email,
                userName: name
            }),
        setRiskProfile: (rp)=>set({
                riskProfile: rp
            }),
        setPlan: (p)=>set({
                plan: p
            }),
        setTrades: (t)=>set({
                trades: t
            }),
        addTrade: (t)=>set((s)=>({
                    trades: [
                        ...s.trades,
                        t
                    ]
                })),
        // ─── Issue 28-B: one row per symbol + weighted-average cost basis ───
        // Handles three cases by looking up an existing position with the same
        // symbol:
        //   (a) not found → create (status "open"; records the initial buy lot
        //       in `buys` when BOTH buyPrice AND shares are provided).
        //   (b) found + incoming has shares > 0 → append {price, shares, at} as
        //       an additional buy lot, set shares = total and buyPrice = the
        //       weighted average ((Σ price×shares)/(Σ shares)). This also
        //       converts a watch-only entry into a holding (remove-from-
        //       watchlist + add-to-portfolio in one step). Existing
        //       order/addedAt are kept; name/sector are filled from the
        //       incoming payload only if currently empty.
        //   (c) found + incoming has no shares → no-op (the UI blocks duplicate
        //       watch-only adds; this keeps the store safe from any caller).
        addPortfolioPosition: (p)=>set((s)=>{
                const existing = s.portfolio.find((x)=>x.symbol === p.symbol);
                const now = new Date().toISOString();
                // Case (a): new symbol → create the position.
                if (!existing) {
                    const hasLot = p.shares > 0 && p.buyPrice !== null && p.buyPrice !== undefined;
                    return {
                        portfolio: [
                            ...s.portfolio,
                            {
                                ...p,
                                addedAt: now,
                                order: s.portfolio.length,
                                status: "open",
                                buys: hasLot ? [
                                    {
                                        price: p.buyPrice,
                                        shares: p.shares,
                                        at: now
                                    }
                                ] : []
                            }
                        ]
                    };
                }
                // Case (c): already tracked and the incoming payload carries no
                // usable lot (no shares, or no price) → nothing to do.
                if (p.shares <= 0 || p.buyPrice === null || p.buyPrice === undefined) {
                    return {};
                }
                // Case (b): merge as an additional buy lot + weighted-average price.
                // mergeBuyLots() back-fills legacy positions persisted before `buys`
                // existed (buyPrice × shares synthesized; unpriced legacy shares
                // inherit the incoming price — see the helper's comment).
                const lots = mergeBuyLots(existing, {
                    price: p.buyPrice,
                    shares: p.shares
                });
                const totalShares = lots.reduce((n, l)=>n + l.shares, 0);
                const totalCost = lots.reduce((n, l)=>n + l.price * l.shares, 0);
                const avgPrice = totalShares > 0 ? totalCost / totalShares : p.buyPrice;
                return {
                    portfolio: s.portfolio.map((x)=>x.symbol === p.symbol ? {
                            ...x,
                            name: x.name || p.name,
                            sector: x.sector ?? p.sector ?? null,
                            shares: totalShares,
                            buyPrice: avgPrice,
                            buys: lots,
                            status: "open",
                            closePrice: null,
                            closedAt: null
                        } : x)
                };
            }),
        removePortfolioPosition: (symbol)=>set((s)=>({
                    portfolio: s.portfolio.filter((p)=>p.symbol !== symbol).map((p, i)=>({
                            ...p,
                            order: i
                        }))
                })),
        closePortfolioPosition: (symbol, closePrice)=>set((s)=>({
                    portfolio: s.portfolio.map((p)=>p.symbol === symbol ? {
                            ...p,
                            status: "closed",
                            closePrice,
                            closedAt: new Date().toISOString()
                        } : p)
                })),
        reopenPortfolioPosition: (symbol)=>set((s)=>({
                    portfolio: s.portfolio.map((p)=>p.symbol === symbol ? {
                            ...p,
                            status: "open",
                            closePrice: null,
                            closedAt: null
                        } : p)
                })),
        reorderPortfolio: (from, to)=>set((s)=>{
                const arr = [
                    ...s.portfolio
                ].sort((a, b)=>a.order - b.order);
                const [moved] = arr.splice(from, 1);
                arr.splice(to, 0, moved);
                return {
                    portfolio: arr.map((p, i)=>({
                            ...p,
                            order: i
                        }))
                };
            }),
        // Issue 13: record a closed trade (kept separately so the Tracker can
        // show closed-trade history) AND reset the portfolio position to
        // watch-only (shares=0, buyPrice=null, buys cleared) — the stock
        // remains in the portfolio so the user can re-add a position later.
        // The ClosedTrade carries the averaged buyPrice + a `buys` snapshot.
        addClosedTrade: (t)=>set((s)=>({
                    closedTrades: [
                        t,
                        ...s.closedTrades
                    ].slice(0, 200)
                })),
        closePositionFromPortfolio: (symbol, closedTrade)=>set((s)=>({
                    closedTrades: [
                        closedTrade,
                        ...s.closedTrades
                    ].slice(0, 200),
                    portfolio: s.portfolio.map((p)=>p.symbol === symbol ? {
                            ...p,
                            shares: 0,
                            buyPrice: null,
                            buys: [],
                            status: "open"
                        } : p)
                })),
        pushNotification: (n)=>set((s)=>({
                    notifications: [
                        {
                            ...n,
                            id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                            createdAt: new Date().toISOString(),
                            read: false
                        },
                        ...s.notifications
                    ].slice(0, 50)
                })),
        markNotificationRead: (id)=>set((s)=>({
                    notifications: s.notifications.map((n)=>n.id === id ? {
                            ...n,
                            read: true
                        } : n)
                })),
        clearNotifications: ()=>set({
                notifications: []
            }),
        reset: ()=>set({
                view: "landing",
                selectedSignalId: null,
                selectedSymbol: null,
                selectedBrokerId: null,
                userId: null,
                userEmail: "",
                userName: "",
                riskProfile: null,
                plan: null,
                trades: [],
                portfolio: [],
                closedTrades: [],
                notifications: []
            })
    }), {
    name: "latent-store-v2",
    // Issue 28-B: bumped 0 → 1 — migrate merges duplicate symbols that
    // legacy localStorage data may contain (from before the one-row-per-
    // symbol rule), combining their buy lots at the weighted-average price
    // so no stock ever shows twice. Runs exactly once per stored state.
    version: 1,
    migrate: (persisted)=>{
        const s = persisted ?? {};
        if (!Array.isArray(s.portfolio)) return s;
        const merged = [];
        for (const p of s.portfolio){
            if (!p || typeof p.symbol !== "string") continue;
            const idx = merged.findIndex((m)=>m.symbol === p.symbol);
            if (idx === -1) {
                merged.push(p);
                continue;
            }
            const cur = merged[idx];
            const curLots = getBuyLots(cur);
            const newLots = getBuyLots(p);
            if (curLots.length === 0 && newLots.length > 0) {
                // current entry is watch-only, incoming is a holding → keep the holding
                merged[idx] = p;
            } else if (curLots.length > 0 && newLots.length > 0) {
                // two holdings → merge lots + weighted-average buyPrice
                const lots = [
                    ...curLots,
                    ...newLots
                ];
                const totalShares = lots.reduce((n, l)=>n + l.shares, 0);
                const totalCost = lots.reduce((n, l)=>n + l.price * l.shares, 0);
                merged[idx] = {
                    ...cur,
                    shares: totalShares,
                    buyPrice: totalShares > 0 ? totalCost / totalShares : cur.buyPrice,
                    buys: lots
                };
            }
        // else: keep `cur` (cur is the holding / first watch-only entry)
        }
        return {
            ...s,
            portfolio: merged.map((p, i)=>({
                    ...p,
                    order: i
                }))
        };
    },
    partialize: (s)=>({
            userId: s.userId,
            userEmail: s.userEmail,
            userName: s.userName,
            riskProfile: s.riskProfile,
            plan: s.plan,
            portfolio: s.portfolio,
            closedTrades: s.closedTrades
        })
}));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/latent/mock-stocks.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MOCK_BROKERS",
    ()=>MOCK_BROKERS,
    "MOCK_STOCKS",
    ()=>MOCK_STOCKS,
    "getStockBySymbol",
    ()=>getStockBySymbol
]);
const MOCK_STOCKS = [
    {
        symbol: "ENGRO",
        name: "Engro Corporation Limited",
        sector: "Conglomerate",
        price: 285.40,
        changePct: 2.34,
        peRatio: 8.2,
        pbRatio: 1.4,
        dividendYield: 7.8,
        marketCapBn: 363.5,
        volumeToday: 1240000
    },
    {
        symbol: "HUBC",
        name: "Hub Power Company Limited",
        sector: "Power",
        price: 124.80,
        changePct: 1.12,
        peRatio: 6.1,
        pbRatio: 1.1,
        dividendYield: 11.2,
        marketCapBn: 158.8,
        volumeToday: 2100000
    },
    {
        symbol: "LUCK",
        name: "Lucky Cement Limited",
        sector: "Cement",
        price: 892.50,
        changePct: -0.85,
        peRatio: 9.7,
        pbRatio: 1.6,
        dividendYield: 4.5,
        marketCapBn: 285.0,
        volumeToday: 480000
    },
    {
        symbol: "SYS",
        name: "Systems Limited",
        sector: "Technology",
        price: 412.20,
        changePct: 4.18,
        peRatio: 14.5,
        pbRatio: 5.2,
        dividendYield: 2.1,
        marketCapBn: 65.4,
        volumeToday: 920000
    },
    {
        symbol: "MEBL",
        name: "Meezan Bank Limited",
        sector: "Banking",
        price: 268.30,
        changePct: 1.78,
        peRatio: 7.4,
        pbRatio: 2.1,
        dividendYield: 6.5,
        marketCapBn: 314.6,
        volumeToday: 1850000
    },
    {
        symbol: "PSO",
        name: "Pakistan State Oil Company Limited",
        sector: "Energy",
        price: 198.70,
        changePct: -1.42,
        peRatio: 5.8,
        pbRatio: 0.9,
        dividendYield: 8.9,
        marketCapBn: 86.2,
        volumeToday: 670000
    },
    {
        symbol: "OGDC",
        name: "Oil & Gas Development Company Limited",
        sector: "Energy",
        price: 142.10,
        changePct: 0.65,
        peRatio: 5.2,
        pbRatio: 0.8,
        dividendYield: 12.4,
        marketCapBn: 612.0,
        volumeToday: 3200000
    },
    {
        symbol: "PPL",
        name: "Pakistan Petroleum Limited",
        sector: "Energy",
        price: 118.40,
        changePct: 0.92,
        peRatio: 5.6,
        pbRatio: 0.9,
        dividendYield: 10.8,
        marketCapBn: 314.0,
        volumeToday: 1450000
    }
];
const MOCK_BROKERS = [
    {
        id: "broker_singular",
        name: "Singular Securities",
        commissionPct: 0.08,
        settlementDays: 2,
        logoColor: "#00E676"
    },
    {
        id: "broker_arif_habib",
        name: "Arif Habib Limited",
        commissionPct: 0.12,
        settlementDays: 2,
        logoColor: "#22E881"
    },
    {
        id: "broker_foundation",
        name: "Foundation Securities",
        commissionPct: 0.10,
        settlementDays: 2,
        logoColor: "#4ADE80"
    }
];
function getStockBySymbol(symbol) {
    return MOCK_STOCKS.find((s)=>s.symbol === symbol);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/latent/plan-synthesizer.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "classifyRiskBucket",
    ()=>classifyRiskBucket,
    "synthesizePlan",
    ()=>synthesizePlan
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-stocks.ts [app-client] (ecmascript)");
;
function classifyRiskBucket(input) {
    // Composite score: weighted sum of risk tolerance, time horizon (longer = more aggressive), and monthly capacity
    const horizonScore = Math.min(10, Math.max(1, Math.floor(input.timeHorizon / 3))); // 1yr=1, 5yr=2, 10yr=3, 30yr=10
    const capacityScore = Math.min(10, Math.max(1, Math.floor(input.monthlyContribution / 5000))); // 5K=1, 50K=10
    const composite = input.riskTolerance * 0.5 + horizonScore * 0.3 + capacityScore * 0.2;
    if (composite < 3.5) return "conservative";
    if (composite < 5.5) return "moderate";
    if (composite < 7.5) return "growth";
    return "aggressive";
}
// Bucket-specific target allocation by horizon
const BUCKET_ALLOCATIONS = {
    conservative: {
        DIVIDEND: 60,
        GROWTH: 15,
        SWING: 10,
        DAY: 0,
        CASH: 15
    },
    moderate: {
        DIVIDEND: 45,
        GROWTH: 25,
        SWING: 15,
        DAY: 0,
        CASH: 15
    },
    growth: {
        DIVIDEND: 30,
        GROWTH: 35,
        SWING: 25,
        DAY: 5,
        CASH: 5
    },
    aggressive: {
        DIVIDEND: 15,
        GROWTH: 40,
        SWING: 30,
        DAY: 10,
        CASH: 5
    }
};
// Stock selection per horizon (defensible logic: liquidity + sector diversification)
const STOCKS_BY_HORIZON = {
    DIVIDEND: [
        "HUBC",
        "OGDC",
        "PPL"
    ],
    GROWTH: [
        "LUCK",
        "SYS",
        "ENGRO"
    ],
    SWING: [
        "MEBL",
        "ENGRO",
        "LUCK"
    ],
    DAY: [
        "SYS",
        "MEBL"
    ]
};
const STOCK_THESES = {
    HUBC: "11.2% dividend yield, predictable cash flows, utility-like stability",
    OGDC: "12.4% dividend yield, government backing, energy exposure",
    PPL: "10.8% dividend yield, discounted valuation, energy sector",
    LUCK: "Cement cyclical low, P/E 33% below 5-year average, rate cut beneficiary",
    SYS: "Pakistan IT sector leader, 24% revenue growth, USD revenue exposure",
    ENGRO: "Conglomerate diversification, 7.8% yield, fertilizer margins expanding",
    MEBL: "Islamic banking growth (30% YoY), best-in-class ADR, sector tailwind"
};
function synthesizePlan(userId, input) {
    const bucket = classifyRiskBucket(input);
    const allocations = BUCKET_ALLOCATIONS[bucket];
    const planAllocations = [];
    // For each horizon bucket with non-zero allocation, pick stocks
    Object.entries(allocations).forEach(([horizon, pct])=>{
        if (horizon === "CASH" || pct === 0) return;
        const stocksInHorizon = STOCKS_BY_HORIZON[horizon] || [];
        // Equal-weight within horizon
        const perStockPct = pct / stocksInHorizon.length;
        stocksInHorizon.forEach((symbol)=>{
            const stock = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MOCK_STOCKS"].find((s)=>s.symbol === symbol);
            if (!stock) return;
            planAllocations.push({
                symbol,
                name: stock.name,
                allocationPct: parseFloat(perStockPct.toFixed(2)),
                horizon: horizon,
                thesis: STOCK_THESES[symbol] || "Allocation based on risk profile and horizon"
            });
        });
    });
    // Build entry ladder — spread monthly contribution over 3 months to reduce timing risk
    const ladder = [];
    const ladderSplit = [
        0.5,
        0.3,
        0.2
    ]; // 50% / 30% / 20% across 3 months
    for(let month = 1; month <= 3; month++){
        const amount = Math.floor(input.monthlyContribution * ladderSplit[month - 1]);
        ladder.push({
            month,
            amount,
            instructions: `Deploy PKR ${amount.toLocaleString()} across allocation targets. ${month === 1 ? "Initial deployment — take all positions at current prices." : month === 2 ? "Second tranche — average down any positions that have pulled back 5%+ from initial entry." : "Final tranche — top up underweight positions, hold cash for opportunistic adds."}`
        });
    }
    // Rebalancing rules
    const rebalancingRules = [
        "Review plan monthly on the 1st.",
        "Rebalance if any single stock exceeds target allocation by more than 25% (e.g., 10% target → 12.5%+ actual).",
        "Rebalance if any sector exposure exceeds 40% of plan value.",
        "Stop-loss review: any position down 15% from entry triggers manual review.",
        "Goal horizon review every 6 months — if horizon shortened by 1+ years, de-risk toward conservative bucket.",
        "Quarterly: update risk profile questionnaire — life events (marriage, job change, home purchase) may shift bucket."
    ];
    // Expected return projection (annualized, conservative)
    const expectedReturns = {
        conservative: 12,
        moderate: 16,
        growth: 22,
        aggressive: 28
    };
    return {
        id: `plan_${userId}_${Date.now()}`,
        userId,
        profileBucket: bucket,
        allocation: planAllocations,
        entryLadder: ladder,
        rebalancingRules,
        expectedReturnPct: expectedReturns[bucket],
        riskScore: input.riskTolerance
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/latent/mock-company-results.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Pattern detection engine — no mock data, real data fetched on-demand
__turbopack_context__.s([
    "MOCK_COMPANY_RESULTS",
    ()=>MOCK_COMPANY_RESULTS,
    "classifySector",
    ()=>classifySector,
    "computeCAGR",
    ()=>computeCAGR,
    "computeSlope",
    ()=>computeSlope,
    "computeStdDev",
    ()=>computeStdDev,
    "detectPatterns",
    ()=>detectPatterns,
    "generateQuarterlySummary",
    ()=>generateQuarterlySummary,
    "getSectorCauseSummary",
    ()=>getSectorCauseSummary,
    "groupByCompany",
    ()=>groupByCompany
]);
const MOCK_COMPANY_RESULTS = [];
// ────────────────────────────────────────────────────────────────────────────
// Issue 11: Sector-specific seasonal cause summaries
// Maps PSX ticker symbols → sector → per-quarter cause explanation. Falls back
// to a generic Pakistan-monsoon narrative when symbol is unknown.
// ────────────────────────────────────────────────────────────────────────────
const SECTOR_SYMBOL_MAP = [
    {
        sector: "Cement",
        symbols: [
            "LUCK",
            "DGKC",
            "MLCF",
            "FCCL",
            "KOHC",
            "ACPL",
            "PIOC",
            "CHCC",
            "GWLC",
            "DCL",
            "BEST",
            "FECT",
            "INCE",
            "DGIC"
        ]
    },
    {
        sector: "Fertilizer",
        symbols: [
            "ENGRO",
            "EFERT",
            "FFBL",
            "FATIMA",
            "DAWH"
        ]
    },
    {
        sector: "Oil & Gas",
        symbols: [
            "OGDC",
            "PPL",
            "POL",
            "MARI",
            "EPL"
        ]
    },
    {
        sector: "Power",
        symbols: [
            "HUBC",
            "NPL",
            "KAPCO",
            "JPGL",
            "SPWL",
            "NCPL",
            "KEL",
            "LPL"
        ]
    },
    {
        sector: "Banking",
        symbols: [
            "MEBL",
            "BAFL",
            "MCB",
            "UBL",
            "HBL",
            "ABL",
            "BOP",
            "BAHL",
            "SCBPL",
            "SNBL",
            "AKBL",
            "BISE",
            "AICL",
            "MEBB"
        ]
    },
    {
        sector: "Technology",
        symbols: [
            "SYS",
            "AVN",
            "TRSM",
            "HUMNL",
            "PTC",
            "AVANT"
        ]
    },
    {
        sector: "Oil Marketing",
        symbols: [
            "PSO",
            "APL",
            "SNGP",
            "SPL",
            "SSGC"
        ]
    },
    {
        sector: "Refinery/Petrochemical",
        symbols: [
            "LOTCHEM",
            "ATRL",
            "NRL",
            "PRL",
            "BYCO",
            "SHEZ",
            "EPCL"
        ]
    }
];
function classifySector(symbol) {
    if (!symbol) return "Conglomerate";
    const up = symbol.toUpperCase();
    for (const m of SECTOR_SYMBOL_MAP)if (m.symbols.includes(up)) return m.sector;
    return "Conglomerate";
}
const SECTOR_CAUSES = {
    Cement: {
        1: "Pakistan's Q1 (Jul–Sep) is monsoon season — heavy rains disrupt construction sites, clinker transport, and outdoor pours. Cement dispatches typically dip 15–20% as builders delay pours; LUCK/DGKC/MLCF all see the seasonal trough here.",
        2: "Q2 (Oct–Dec) is post-monsoon recovery — dry, cool weather drives peak construction season. Cement demand rises 20%+ as North-bound infrastructure projects resume and rural housing ramps up; dispatch numbers lift sharply.",
        3: "Q3 (Jan–Mar) — winter peak construction continues in the south while the north slows from cold. Companies push hard on dispatches to hit FY targets; LUCK often books the year's largest profit here.",
        4: "Q4 (Apr–Jun) — pre-monsoon slowdown as heat builds, water scarcity affects curing, and builders wrap up before rains. Companies finalize annual results; dispatches moderate, final dividends declared here."
    },
    Fertilizer: {
        1: "Pakistan's Q1 (Jul–Sep) — Kharif harvest ending softens urea offtake as sowing winds down. ENGRO/EFERT see weaker demand, but inventory builds for the next sowing season.",
        2: "Q2 (Oct–Dec) — Rabi sowing peak. Urea demand spikes as wheat cultivation starts across Punjab and Sindh. Fertilizer companies book some of their highest dispatches of the year here.",
        3: "Q3 (Jan–Mar) — mid-Rabi. Top-dressing applications continue, urea offtake stays firm. ENGRO/EFERT often book strong profits; this is also when interim dividends are announced.",
        4: "Q4 (Apr–Jun) — transition from Rabi harvest to Kharif sowing prep; urea demand moderate. Companies finalize annual results, declare final dividends, and reposition inventory for the next sowing cycle."
    },
    "Oil & Gas": {
        1: "Pakistan's Q1 (Jul–Sep) — summer gas consumption peaks (ACs, industry) but wellhead production from OGDC/PPL/MARI stays steady. Royalty flows and gas tariffs support revenue; this is a high-cash quarter.",
        2: "Q2 (Oct–Dec) — winter gas consumption peaks as heating loads rise and CNG/power demand increases. OGDC/PPL typically book strong profits; gas infrastructure stays near full utilization.",
        3: "Q3 (Jan–Mar) — winter demand continues in the north, gas consumption stays high. Companies often declare interim dividends here; production plateaus at mature fields but new wells add incremental flow.",
        4: "Q4 (Apr–Jun) — transition to summer; residential heating demand drops, but power-sector gas offtake rises as AC load grows. Companies finalize annual results and declare final dividends."
    },
    Power: {
        1: "Pakistan's Q1 (Jul–Sep) — mild weather means lower heating/cooling demand; HUBC and other IPPs see lower dispatches as grid load eases. Capacity payments still flow, but merchant profits moderate.",
        2: "Q2 (Oct–Dec) — winter heating demand lifts power offtake; IPPs run at higher capacity factors. HUBC typically books stronger revenue and profits here.",
        3: "Q3 (Jan–Mar) — winter peak demand continues in the north; power sector stays at high utilization. Companies often declare interim dividends here as cash builds.",
        4: "Q4 (Apr–Jun) — summer cooling demand begins ramping up as AC load rises; power demand approaches annual peak. Companies finalize annual results and declare final dividends."
    },
    Banking: {
        1: "Pakistan's Q1 (Jul–Sep) — banks see lower fee income as post-budget slowdown hits corporate activity. ADR spreads stay healthy, but loan growth is tepid; MEBL's fee line typically softens here.",
        2: "Q2 (Oct–Dec) — post-monsoon pickup in trade financing and corporate lending; banks see stronger fee income and FX income from imports. MEBL typically books stronger profits here.",
        3: "Q3 (Jan–Mar) — mid-fiscal-year. Banks push lending targets. Many banks declare interim dividends here; MEBL's quarterly profit often peaks as fee income and ADR spreads combine.",
        4: "Q4 (Apr–Jun) — fiscal year-end. Banks finalize annual results, declare final dividends + bonus shares, and clean up balance sheets. MEBL often pays its largest dividend here, plus a stock bonus."
    },
    Technology: {
        1: "Pakistan's Q1 (Jul–Sep) — new software/IT contracts typically start at the beginning of the fiscal year. SYS and peers ramp up revenue recognition as client budgets open; deals inked in Q4 start billing.",
        2: "Q2 (Oct–Dec) — delivery milestones hit on multi-quarter engagements; revenue scales up as resources ramp. Tech firms often see their highest quarterly revenue of the year here as project execution peaks.",
        3: "Q3 (Jan–Mar) — continued execution; client renewals and contract extensions come in. SYS often books strong profits here; interim dividends (if any) declared.",
        4: "Q4 (Apr–Jun) — year-end push to recognize deferred revenue and lock in new multi-year deals before fiscal close. Tech firms accelerate bookings; final dividends and bonuses declared."
    },
    "Oil Marketing": {
        1: "Pakistan's Q1 (Jul–Sep) — monsoon disruptions hit fuel logistics and retail offtake. PSO and APL see moderate demand; inventory builds as imports arrive but dispatch lags in wet weather.",
        2: "Q2 (Oct–Dec) — winter demand lifts furnace oil (for power) and HSD; oil marketing companies see higher volumes as industrial activity resumes. PSO often books strong gross profits here.",
        3: "Q3 (Jan–Mar) — peak winter fuel demand continues; PSO/APL dispatches stay high. Companies often declare interim dividends here as receivables clear from circular-debt flow.",
        4: "Q4 (Apr–Jun) — year-end inventory build as companies prep for summer driving season and AC-driven power demand. Companies finalize annual results and declare final dividends."
    },
    "Refinery/Petrochemical": {
        1: "Pakistan's Q1 (Jul–Sep) — monsoon season softens fuel demand; refinery throughput dips slightly as logistics and downstream offtake slow. LOTCHEM/ATRL see moderate margins.",
        2: "Q2 (Oct–Dec) — winter heating and post-monsoon industrial activity lift furnace oil and diesel demand; refinery utilization rises. Crack spreads typically stay healthy.",
        3: "Q3 (Jan–Mar) — winter peak demand for heating fuels; refinery margins stay firm. Companies often declare interim dividends here.",
        4: "Q4 (Apr–Jun) — summer AC-driven power demand lifts furnace oil offtake; refineries prep for higher throughput. Companies finalize annual results and declare final dividends."
    },
    Conglomerate: {
        1: "Pakistan's Q1 (Jul–Sep) coincides with monsoon season — heavy rains disrupt construction, transport, and outdoor activity, while the Kharif-harvest ending softens fertilizer and agri-input offtake. Summer heat also curbs industrial output, so most cyclical sectors see weaker demand.",
        2: "Q2 (Oct–Dec) brings post-monsoon recovery: dry cool weather drives peak construction (cement, steel lift), Rabi sowing boosts fertilizer demand, and Eid/festive spending lifts consumer goods. Banks also see stronger fee income — that seasonal tailwind is why volumes jump.",
        3: "Q3 (Jan–Mar) is mid-fiscal-year. Winter peak continues for construction and industry, companies push hard to meet annual targets, and many declare interim dividends here — that's why this quarter often books the year's largest profits.",
        4: "Q4 (Apr–Jun) is fiscal year-end. Companies finalize annual results, declare final dividends, and clean up balance sheets. Meanwhile summer heat and pre-monsoon conditions start slowing construction and agri-input demand — making this a natural transition quarter."
    }
};
function getSectorCauseSummary(sector, quarter) {
    const causes = SECTOR_CAUSES[sector] || SECTOR_CAUSES.Conglomerate;
    return causes[quarter];
}
// ============================================================
// Issue 9: Discriminating pattern-detection algorithm
// ============================================================
//
// Goal: surface genuinely informative patterns — both bullish AND bearish —
// and stop labelling almost every stock as "all quarters profitable".
//
// Each detected pattern carries:
//   * strength:   Strong / Moderate / Weak  — magnitude + run-length tier
//   * confidence: 0-100, scaled to strength (Strong: 78-95, Moderate: 58-78, Weak: 40-58)
//   * supportingData: structured {label,value} pairs so the user can verify the claim
//   * affectedQuarters: the periods that triggered the pattern
//   * laymanSummary: plain-English version
//
// Patterns are only emitted when their threshold genuinely holds — bearish
// patterns get symmetric treatment to bullish ones, so a deteriorating
// business shows red flags just as clearly as a healthy one shows green ones.
// ============================================================
function _conf(s, base = 0) {
    const floor = s === "Strong" ? 78 : s === "Moderate" ? 58 : 40;
    const cap = s === "Strong" ? 95 : s === "Moderate" ? 78 : 58;
    return Math.max(floor, Math.min(cap, floor + base));
}
function _fmtNumShort(n) {
    if (!isFinite(n)) return "—";
    const sign = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (a >= 1e9) return `${sign}Rs ${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${sign}Rs ${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${sign}Rs ${(a / 1e3).toFixed(1)}K`;
    return `${sign}Rs ${a.toFixed(0)}`;
}
function detectPatterns(r) {
    if (r.length < 4) return [];
    const out = [];
    const first = r[0];
    const last = r[r.length - 1];
    // ---------- 1. EPS growth / decline streak (consecutive YoY) ----------
    {
        // Longest run ending at the latest quarter where YoY EPS growth > 10%
        let bullRun = 0;
        for(let i = r.length - 1; i >= 0; i--){
            if (r[i].metrics.epsYoYGrowth > 10) bullRun++;
            else break;
        }
        let bearRun = 0;
        for(let i = r.length - 1; i >= 0; i--){
            if (r[i].metrics.epsYoYGrowth < -10) bearRun++;
            else break;
        }
        if (bullRun >= 3) {
            const slice = r.slice(-bullRun);
            const avg = slice.reduce((a, x)=>a + x.metrics.epsYoYGrowth, 0) / slice.length;
            const s = bullRun >= 5 ? "Strong" : bullRun >= 4 ? "Moderate" : "Weak";
            out.push({
                type: "EPS_GROWTH_STREAK",
                label: "EPS Growth Streak",
                severity: "positive",
                strength: s,
                confidence: _conf(s, bullRun * 2),
                detail: `${bullRun} consecutive quarters of YoY EPS growth > 10% (avg ${avg.toFixed(1)}%).`,
                supportingData: [
                    {
                        label: "Streak length",
                        value: `${bullRun} qtrs`
                    },
                    {
                        label: "Avg YoY growth",
                        value: `${avg.toFixed(1)}%`
                    },
                    {
                        label: "Latest EPS YoY",
                        value: `${last.metrics.epsYoYGrowth.toFixed(1)}%`
                    }
                ],
                affectedQuarters: slice.map((x)=>x.period),
                laymanSummary: "Profits rising YoY, quarter after quarter — strong earnings momentum."
            });
        }
        if (bearRun >= 3) {
            const slice = r.slice(-bearRun);
            const avg = slice.reduce((a, x)=>a + x.metrics.epsYoYGrowth, 0) / slice.length;
            const s = bearRun >= 5 ? "Strong" : bearRun >= 4 ? "Moderate" : "Weak";
            out.push({
                type: "EPS_DECLINE_STREAK",
                label: "EPS Decline Streak",
                severity: "negative",
                strength: s,
                confidence: _conf(s, bearRun * 2),
                detail: `${bearRun} consecutive quarters of YoY EPS decline > 10% (avg ${avg.toFixed(1)}%).`,
                supportingData: [
                    {
                        label: "Streak length",
                        value: `${bearRun} qtrs`
                    },
                    {
                        label: "Avg YoY decline",
                        value: `${avg.toFixed(1)}%`
                    },
                    {
                        label: "Latest EPS YoY",
                        value: `${last.metrics.epsYoYGrowth.toFixed(1)}%`
                    }
                ],
                affectedQuarters: slice.map((x)=>x.period),
                laymanSummary: "Profits falling YoY, quarter after quarter — an earnings recession."
            });
        }
    }
    // ---------- 2. Margin expansion / contraction (>=4 qtr trend) ----------
    {
        const ms = r.map((x)=>x.metrics.netMargin);
        if (ms.length >= 4) {
            const win = ms.slice(-Math.min(ms.length, 6));
            const slope = computeSlope(win);
            const delta = win[win.length - 1] - win[0];
            if (slope >= 0.75 && delta >= 2) {
                const s = slope >= 3 ? "Strong" : slope >= 1.5 ? "Moderate" : "Weak";
                out.push({
                    type: "MARGIN_EXPANSION",
                    label: "Margin Expansion",
                    severity: "positive",
                    strength: s,
                    confidence: _conf(s, Math.floor(Math.abs(delta))),
                    detail: `Net margin expanded from ${win[0].toFixed(1)}% to ${win[win.length - 1].toFixed(1)}% (+${delta.toFixed(1)}pp) over the last ${win.length} quarters.`,
                    supportingData: [
                        {
                            label: "Start margin",
                            value: `${win[0].toFixed(1)}%`
                        },
                        {
                            label: "Latest margin",
                            value: `${win[win.length - 1].toFixed(1)}%`
                        },
                        {
                            label: "Change",
                            value: `+${delta.toFixed(1)}pp`
                        },
                        {
                            label: "Slope",
                            value: `${slope.toFixed(2)}pp/qtr`
                        }
                    ],
                    affectedQuarters: [
                        r[ms.length - win.length].period,
                        last.period
                    ],
                    laymanSummary: "Company keeps more profit per rupee of sales — improving cost efficiency or pricing power."
                });
            } else if (slope <= -0.75 && delta <= -2) {
                const s = slope <= -3 ? "Strong" : slope <= -1.5 ? "Moderate" : "Weak";
                out.push({
                    type: "MARGIN_CONTRACTION",
                    label: "Margin Contraction",
                    severity: "negative",
                    strength: s,
                    confidence: _conf(s, Math.floor(Math.abs(delta))),
                    detail: `Net margin compressed from ${win[0].toFixed(1)}% to ${win[win.length - 1].toFixed(1)}% (${delta.toFixed(1)}pp) over the last ${win.length} quarters.`,
                    supportingData: [
                        {
                            label: "Start margin",
                            value: `${win[0].toFixed(1)}%`
                        },
                        {
                            label: "Latest margin",
                            value: `${win[win.length - 1].toFixed(1)}%`
                        },
                        {
                            label: "Change",
                            value: `${delta.toFixed(1)}pp`
                        },
                        {
                            label: "Slope",
                            value: `${slope.toFixed(2)}pp/qtr`
                        }
                    ],
                    affectedQuarters: [
                        r[ms.length - win.length].period,
                        last.period
                    ],
                    laymanSummary: "Company keeps less profit per rupee of sales — rising cost pressure or pricing weakness."
                });
            }
        }
    }
    // ---------- 3. Revenue acceleration / deceleration (QoQ trend) ----------
    if (r.length >= 5) {
        const rates = [];
        for(let i = r.length - 4; i <= r.length - 1; i++){
            if (r[i - 1] && r[i - 1].metrics.revenue > 0) {
                const rate = (r[i].metrics.revenue - r[i - 1].metrics.revenue) / r[i - 1].metrics.revenue * 100;
                rates.push({
                    period: r[i].period,
                    rate
                });
            }
        }
        if (rates.length >= 3) {
            let acc = true;
            for(let i = 1; i < rates.length; i++){
                if (rates[i].rate <= rates[i - 1].rate + 2) {
                    acc = false;
                    break;
                }
            }
            let dec = true;
            for(let i = 1; i < rates.length; i++){
                if (rates[i].rate >= rates[i - 1].rate - 2) {
                    dec = false;
                    break;
                }
            }
            if (acc) {
                const spread = rates[rates.length - 1].rate - rates[0].rate;
                const s = spread >= 15 ? "Strong" : spread >= 8 ? "Moderate" : "Weak";
                out.push({
                    type: "REVENUE_ACCELERATION",
                    label: "Revenue Acceleration",
                    severity: "positive",
                    strength: s,
                    confidence: _conf(s, Math.floor(spread)),
                    detail: `QoQ revenue growth accelerating: ${rates.map((rt)=>rt.rate.toFixed(1) + "%").join(" -> ")} over the last ${rates.length} quarters.`,
                    supportingData: rates.map((rt, i)=>({
                            label: `QoQ #${i + 1} (${rt.period})`,
                            value: `${rt.rate.toFixed(1)}%`
                        })),
                    affectedQuarters: rates.map((rt)=>rt.period),
                    laymanSummary: "Sales growth is speeding up — demand momentum strengthening."
                });
            } else if (dec) {
                const spread = rates[0].rate - rates[rates.length - 1].rate;
                const s = spread >= 15 ? "Strong" : spread >= 8 ? "Moderate" : "Weak";
                out.push({
                    type: "REVENUE_DECELERATION",
                    label: "Revenue Deceleration",
                    severity: "negative",
                    strength: s,
                    confidence: _conf(s, Math.floor(spread)),
                    detail: `QoQ revenue growth decelerating: ${rates.map((rt)=>rt.rate.toFixed(1) + "%").join(" -> ")} over the last ${rates.length} quarters.`,
                    supportingData: rates.map((rt, i)=>({
                            label: `QoQ #${i + 1} (${rt.period})`,
                            value: `${rt.rate.toFixed(1)}%`
                        })),
                    affectedQuarters: rates.map((rt)=>rt.period),
                    laymanSummary: "Sales growth is slowing down — demand momentum fading."
                });
            }
        }
    }
    // ---------- 4. Earnings turnaround / reversal (loss <-> profit) ----------
    {
        const earlyPAT = first.metrics.profitAfterTax;
        const lastPAT = last.metrics.profitAfterTax;
        if (earlyPAT < 0 && lastPAT > 0) {
            const swing = lastPAT - earlyPAT;
            const s = swing >= 1e9 ? "Strong" : swing >= 5e8 ? "Moderate" : "Weak";
            out.push({
                type: "EARNINGS_TURNAROUND",
                label: "Earnings Turnaround",
                severity: "positive",
                strength: s,
                confidence: _conf(s, Math.floor(Math.log10(Math.max(1, swing)))),
                detail: `Moved from a loss of ${_fmtNumShort(earlyPAT)} (${first.period}) to a profit of ${_fmtNumShort(lastPAT)} (${last.period}).`,
                supportingData: [
                    {
                        label: "Earliest PAT",
                        value: _fmtNumShort(earlyPAT)
                    },
                    {
                        label: "Latest PAT",
                        value: _fmtNumShort(lastPAT)
                    },
                    {
                        label: "Swing",
                        value: `+${_fmtNumShort(swing)}`
                    }
                ],
                affectedQuarters: [
                    first.period,
                    last.period
                ],
                laymanSummary: "Recovered from a loss to a profit — a fundamental inflection point."
            });
        } else if (earlyPAT > 0 && lastPAT < 0) {
            const swing = earlyPAT - lastPAT;
            const s = swing >= 1e9 ? "Strong" : swing >= 5e8 ? "Moderate" : "Weak";
            out.push({
                type: "EARNINGS_REVERSAL",
                label: "Earnings Reversal",
                severity: "negative",
                strength: s,
                confidence: _conf(s, Math.floor(Math.log10(Math.max(1, swing)))),
                detail: `Moved from a profit of ${_fmtNumShort(earlyPAT)} (${first.period}) to a loss of ${_fmtNumShort(lastPAT)} (${last.period}).`,
                supportingData: [
                    {
                        label: "Earliest PAT",
                        value: _fmtNumShort(earlyPAT)
                    },
                    {
                        label: "Latest PAT",
                        value: _fmtNumShort(lastPAT)
                    },
                    {
                        label: "Swing",
                        value: `-${_fmtNumShort(swing)}`
                    }
                ],
                affectedQuarters: [
                    first.period,
                    last.period
                ],
                laymanSummary: "Slipped from profit to loss — a fundamental deterioration."
            });
        }
    }
    // ---------- 5. Dividend growth streak / cut (>=4 fiscal years) ----------
    // Group by FY; pick the latest DPS per FY (since DPS is declared at year-end).
    {
        const fyMap = new Map();
        for (const x of r){
            const m = x.period.match(/FY\s?(\d+)/i);
            const fy = m ? m[1] : x.period.replace(/.*FY/, "");
            const cur = fyMap.get(fy);
            if (!cur || new Date(x.periodEnd).getTime() > new Date(cur.periodEnd).getTime()) {
                fyMap.set(fy, x);
            }
        }
        const fyYears = Array.from(fyMap.entries()).sort((a, b)=>a[0].localeCompare(b[0]));
        const divPayingYears = fyYears.filter(([, q])=>q.metrics.dividendPerShare > 0);
        if (divPayingYears.length >= 4) {
            const dpsSeries = divPayingYears.map(([, q])=>q.metrics.dividendPerShare);
            const nonDecreasing = dpsSeries.every((d, i)=>i === 0 || d >= dpsSeries[i - 1] - 0.01);
            const strictlyIncreasing = dpsSeries.every((d, i)=>i === 0 || d > dpsSeries[i - 1] + 0.01);
            const firstDPS = dpsSeries[0];
            const lastDPS = dpsSeries[dpsSeries.length - 1];
            const growthPct = firstDPS > 0 ? (lastDPS - firstDPS) / firstDPS * 100 : 0;
            if (nonDecreasing && growthPct >= 0) {
                const s = divPayingYears.length >= 5 && strictlyIncreasing && growthPct >= 50 ? "Strong" : divPayingYears.length >= 4 && strictlyIncreasing ? "Moderate" : "Weak";
                out.push({
                    type: "DIVIDEND_GROWTH_STREAK",
                    label: "Dividend Growth Streak",
                    severity: "positive",
                    strength: s,
                    confidence: _conf(s, divPayingYears.length * 3),
                    detail: `${divPayingYears.length} consecutive fiscal years of dividends${strictlyIncreasing ? " with increases" : " (non-decreasing)"}. DPS: Rs.${firstDPS.toFixed(2)} -> Rs.${lastDPS.toFixed(2)} (+${growthPct.toFixed(1)}%).`,
                    supportingData: [
                        {
                            label: "Years paying",
                            value: `${divPayingYears.length}`
                        },
                        {
                            label: "First DPS",
                            value: `Rs.${firstDPS.toFixed(2)}`
                        },
                        {
                            label: "Latest DPS",
                            value: `Rs.${lastDPS.toFixed(2)}`
                        },
                        {
                            label: "Growth",
                            value: `+${growthPct.toFixed(1)}%`
                        }
                    ],
                    affectedQuarters: divPayingYears.map(([, q])=>q.period),
                    laymanSummary: "Dividends paid every year, with no cuts — a shareholder-friendly, reliable payout."
                });
            } else {
                // Find the largest YoY DPS cut
                let biggestCut = {
                    fy: "",
                    period: "",
                    from: 0,
                    to: 0,
                    cutPct: 0
                };
                for(let i = 1; i < dpsSeries.length; i++){
                    const from = dpsSeries[i - 1];
                    const to = dpsSeries[i];
                    if (from > 0 && to < from) {
                        const cutPct = (from - to) / from * 100;
                        if (cutPct > biggestCut.cutPct) {
                            biggestCut = {
                                fy: divPayingYears[i][0],
                                period: divPayingYears[i][1].period,
                                from,
                                to,
                                cutPct
                            };
                        }
                    }
                }
                if (biggestCut.cutPct >= 5) {
                    const s = biggestCut.cutPct >= 50 ? "Strong" : biggestCut.cutPct >= 25 ? "Moderate" : "Weak";
                    out.push({
                        type: "DIVIDEND_CUT",
                        label: "Dividend Cut",
                        severity: "negative",
                        strength: s,
                        confidence: _conf(s, Math.floor(biggestCut.cutPct / 5)),
                        detail: `DPS cut from Rs.${biggestCut.from.toFixed(2)} to Rs.${biggestCut.to.toFixed(2)} (-${biggestCut.cutPct.toFixed(1)}%) in FY${biggestCut.fy} (${biggestCut.period}).`,
                        supportingData: [
                            {
                                label: "Before cut",
                                value: `Rs.${biggestCut.from.toFixed(2)}`
                            },
                            {
                                label: "After cut",
                                value: `Rs.${biggestCut.to.toFixed(2)}`
                            },
                            {
                                label: "Cut size",
                                value: `-${biggestCut.cutPct.toFixed(1)}%`
                            },
                            {
                                label: "When",
                                value: `FY${biggestCut.fy}`
                            }
                        ],
                        affectedQuarters: divPayingYears.map(([, q])=>q.period),
                        laymanSummary: "Management reduced the dividend — a red flag for cash flow or earnings confidence."
                    });
                }
            }
        }
    }
    // ---------- 6. Long-term CAGR thresholds (>=3 yrs of data) ----------
    if (r.length >= 12) {
        const years = (new Date(last.periodEnd).getTime() - new Date(first.periodEnd).getTime()) / (365 * 24 * 60 * 60 * 1000);
        if (years >= 2.5) {
            if (first.metrics.eps > 0 && last.metrics.eps > 0) {
                const epsCAGR = computeCAGR(first.metrics.eps, last.metrics.eps, years);
                if (epsCAGR >= 5) {
                    const s = epsCAGR >= 20 ? "Strong" : epsCAGR >= 12 ? "Moderate" : "Weak";
                    out.push({
                        type: "EPS_CAGR",
                        label: "EPS CAGR",
                        severity: "positive",
                        strength: s,
                        confidence: _conf(s, Math.floor(epsCAGR / 2)),
                        detail: `EPS CAGR of ${epsCAGR.toFixed(1)}% over ${years.toFixed(1)} years (Rs.${first.metrics.eps.toFixed(2)} -> Rs.${last.metrics.eps.toFixed(2)}).`,
                        supportingData: [
                            {
                                label: "Period",
                                value: `${years.toFixed(1)} yrs`
                            },
                            {
                                label: "First EPS",
                                value: `Rs.${first.metrics.eps.toFixed(2)}`
                            },
                            {
                                label: "Latest EPS",
                                value: `Rs.${last.metrics.eps.toFixed(2)}`
                            },
                            {
                                label: "CAGR",
                                value: `${epsCAGR.toFixed(1)}%`
                            }
                        ],
                        affectedQuarters: [
                            first.period,
                            last.period
                        ],
                        laymanSummary: "Per-share profit compounding nicely over multiple years."
                    });
                } else if (epsCAGR <= -3) {
                    const s = epsCAGR <= -15 ? "Strong" : epsCAGR <= -8 ? "Moderate" : "Weak";
                    out.push({
                        type: "EPS_NEGATIVE_CAGR",
                        label: "EPS Erosion",
                        severity: "negative",
                        strength: s,
                        confidence: _conf(s, Math.floor(-epsCAGR / 2)),
                        detail: `EPS contracted at ${epsCAGR.toFixed(1)}% CAGR over ${years.toFixed(1)} years (Rs.${first.metrics.eps.toFixed(2)} -> Rs.${last.metrics.eps.toFixed(2)}).`,
                        supportingData: [
                            {
                                label: "Period",
                                value: `${years.toFixed(1)} yrs`
                            },
                            {
                                label: "First EPS",
                                value: `Rs.${first.metrics.eps.toFixed(2)}`
                            },
                            {
                                label: "Latest EPS",
                                value: `Rs.${last.metrics.eps.toFixed(2)}`
                            },
                            {
                                label: "CAGR",
                                value: `${epsCAGR.toFixed(1)}%`
                            }
                        ],
                        affectedQuarters: [
                            first.period,
                            last.period
                        ],
                        laymanSummary: "Per-share profit eroding year after year — a structural decline."
                    });
                }
            }
            if (first.metrics.revenue > 0 && last.metrics.revenue > 0) {
                const revCAGR = computeCAGR(first.metrics.revenue, last.metrics.revenue, years);
                if (revCAGR >= 10) {
                    const s = revCAGR >= 25 ? "Strong" : revCAGR >= 15 ? "Moderate" : "Weak";
                    out.push({
                        type: "REVENUE_CAGR",
                        label: "Revenue CAGR",
                        severity: "positive",
                        strength: s,
                        confidence: _conf(s, Math.floor(revCAGR / 2)),
                        detail: `Revenue CAGR of ${revCAGR.toFixed(1)}% over ${years.toFixed(1)} years.`,
                        supportingData: [
                            {
                                label: "Period",
                                value: `${years.toFixed(1)} yrs`
                            },
                            {
                                label: "First rev",
                                value: _fmtNumShort(first.metrics.revenue)
                            },
                            {
                                label: "Latest rev",
                                value: _fmtNumShort(last.metrics.revenue)
                            },
                            {
                                label: "CAGR",
                                value: `${revCAGR.toFixed(1)}%`
                            }
                        ],
                        affectedQuarters: [
                            first.period,
                            last.period
                        ],
                        laymanSummary: "Top-line compounding strongly over multiple years."
                    });
                } else if (revCAGR <= -3) {
                    const s = revCAGR <= -15 ? "Strong" : revCAGR <= -8 ? "Moderate" : "Weak";
                    out.push({
                        type: "REVENUE_NEGATIVE_CAGR",
                        label: "Revenue Erosion",
                        severity: "negative",
                        strength: s,
                        confidence: _conf(s, Math.floor(-revCAGR / 2)),
                        detail: `Revenue contracted at ${revCAGR.toFixed(1)}% CAGR over ${years.toFixed(1)} years.`,
                        supportingData: [
                            {
                                label: "Period",
                                value: `${years.toFixed(1)} yrs`
                            },
                            {
                                label: "First rev",
                                value: _fmtNumShort(first.metrics.revenue)
                            },
                            {
                                label: "Latest rev",
                                value: _fmtNumShort(last.metrics.revenue)
                            },
                            {
                                label: "CAGR",
                                value: `${revCAGR.toFixed(1)}%`
                            }
                        ],
                        affectedQuarters: [
                            first.period,
                            last.period
                        ],
                        laymanSummary: "Sales shrinking year after year — a shrinking business."
                    });
                }
            }
        }
    }
    // ---------- 7. Earnings volatility (>=6 qtrs) ----------
    if (r.length >= 6) {
        const eg = r.map((x)=>x.metrics.epsYoYGrowth).filter((v)=>isFinite(v));
        if (eg.length >= 6) {
            const sd = computeStdDev(eg);
            if (sd >= 18) {
                const s = sd >= 40 ? "Strong" : sd >= 25 ? "Moderate" : "Weak";
                out.push({
                    type: "HIGH_VOLATILITY",
                    label: "High Earnings Volatility",
                    severity: "negative",
                    strength: s,
                    confidence: _conf(s, Math.floor(sd / 5)),
                    detail: `YoY EPS growth has a std-dev of ${sd.toFixed(1)}pp over the last ${eg.length} quarters — unpredictable earnings.`,
                    supportingData: [
                        {
                            label: "Std dev",
                            value: `${sd.toFixed(1)}pp`
                        },
                        {
                            label: "Sample",
                            value: `${eg.length} qtrs`
                        },
                        {
                            label: "Avg growth",
                            value: `${(eg.reduce((a, b)=>a + b, 0) / eg.length).toFixed(1)}%`
                        }
                    ],
                    affectedQuarters: [
                        first.period,
                        last.period
                    ],
                    laymanSummary: "Profits swing wildly quarter-to-quarter — unpredictable earnings warrant a lower multiple."
                });
            }
        }
    }
    // ---------- 8. Sustainable high-payout (multi-quarter, with growth) ----------
    if (r.length >= 4) {
        const last4 = r.slice(-4);
        const allSustainable = last4.every((x)=>x.metrics.dividendPerShare > 0 && x.metrics.dividendPayoutRatio >= 40 && x.metrics.dividendPayoutRatio <= 85);
        const allGrowing = last4.every((x)=>x.metrics.epsYoYGrowth > 0);
        if (allSustainable && allGrowing) {
            const avgPayout = last4.reduce((a, x)=>a + x.metrics.dividendPayoutRatio, 0) / last4.length;
            const avgGrowth = last4.reduce((a, x)=>a + x.metrics.epsYoYGrowth, 0) / last4.length;
            const s = avgGrowth >= 20 ? "Strong" : avgGrowth >= 10 ? "Moderate" : "Weak";
            out.push({
                type: "SUSTAINABLE_PAYOUT",
                label: "Sustainable High Payout",
                severity: "positive",
                strength: s,
                confidence: _conf(s, Math.floor(avgGrowth / 2)),
                detail: `Last ${last4.length} quarters: ${avgPayout.toFixed(1)}% avg payout with ${avgGrowth.toFixed(1)}% avg EPS YoY growth — dividend covered by growing earnings.`,
                supportingData: [
                    {
                        label: "Avg payout",
                        value: `${avgPayout.toFixed(1)}%`
                    },
                    {
                        label: "Avg EPS YoY",
                        value: `${avgGrowth.toFixed(1)}%`
                    },
                    {
                        label: "Window",
                        value: `${last4.length} qtrs`
                    }
                ],
                affectedQuarters: last4.map((x)=>x.period),
                laymanSummary: "Pays a healthy dividend AND profits are still growing — sustainable shareholder returns."
            });
        }
    }
    // ---------- 9. Stagnant sales + falling profits ----------
    if (r.length >= 4) {
        const last4 = r.slice(-4);
        const revs = last4.map((x)=>x.metrics.revenue);
        const minRev = Math.min(...revs);
        const maxRev = Math.max(...revs);
        const revSpread = minRev > 0 ? (maxRev - minRev) / minRev * 100 : 0;
        const pat0 = last4[0].metrics.profitAfterTax;
        const patN = last4[last4.length - 1].metrics.profitAfterTax;
        const patChange = Math.abs(pat0) > 0 ? (patN - pat0) / Math.abs(pat0) * 100 : 0;
        if (revSpread < 8 && patChange < -15) {
            const s = patChange < -40 ? "Strong" : patChange < -25 ? "Moderate" : "Weak";
            out.push({
                type: "STAGNANT_SALES_PROF_DECLINE",
                label: "Stagnant Sales, Falling Profits",
                severity: "negative",
                strength: s,
                confidence: _conf(s, Math.floor(-patChange / 5)),
                detail: `Revenue range only ${revSpread.toFixed(1)}% (flat) but profit fell ${patChange.toFixed(1)}% over the last ${last4.length} quarters.`,
                supportingData: [
                    {
                        label: "Rev spread",
                        value: `${revSpread.toFixed(1)}%`
                    },
                    {
                        label: "PAT change",
                        value: `${patChange.toFixed(1)}%`
                    },
                    {
                        label: "Window",
                        value: `${last4.length} qtrs`
                    }
                ],
                affectedQuarters: last4.map((x)=>x.period),
                laymanSummary: "Sales are flat while profits fall — classic cost-pressure squeeze."
            });
        }
    }
    // === Issue 12 (preserved): Enhanced seasonal pattern detection ===
    // 12.1 — Same-calendar-quarter YoY revenue growth/decline across years
    if (r.length >= 8) {
        const byQ = {
            1: [],
            2: [],
            3: [],
            4: []
        };
        for (const x of r){
            const mo = new Date(x.periodEnd).getMonth() + 1;
            const q = mo >= 7 && mo <= 9 ? 1 : mo >= 10 && mo <= 12 ? 2 : mo >= 1 && mo <= 3 ? 3 : 4;
            byQ[q].push(x);
        }
        for (const qNum of [
            1,
            2,
            3,
            4
        ]){
            const qs = byQ[qNum];
            if (qs.length < 3) continue;
            qs.sort((a, b)=>new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());
            let pos = 0, neg = 0;
            for (const x of qs){
                if (x.metrics.revenueYoYGrowth > 5) pos++;
                else if (x.metrics.revenueYoYGrowth < -5) neg++;
            }
            // Issue 9: tighten the seasonal threshold so that borderline quarters
            // (barely 50/50 split) don't trigger. Require a clear majority and a
            // minimum count of supporting years.
            const posFrac = pos / qs.length;
            const negFrac = neg / qs.length;
            if (pos >= 4 && posFrac >= 0.6 && pos > neg + 1) {
                const s = posFrac >= 0.8 ? "Strong" : posFrac >= 0.7 ? "Moderate" : "Weak";
                out.push({
                    type: `SEASONAL_QUARTER_${qNum}_STRENGTH`,
                    label: `Q${qNum} is a seasonally strong quarter`,
                    severity: "positive",
                    strength: s,
                    confidence: _conf(s, pos * 4),
                    detail: `Q${qNum} shows YoY revenue growth in ${pos} of ${qs.length} years (${(posFrac * 100).toFixed(0)}%) — a recurring seasonal upswing.`,
                    supportingData: [
                        {
                            label: "Years up",
                            value: `${pos}/${qs.length}`
                        },
                        {
                            label: "Share",
                            value: `${(posFrac * 100).toFixed(0)}%`
                        },
                        {
                            label: "Quarter",
                            value: `Q${qNum}`
                        }
                    ],
                    affectedQuarters: qs.map((x)=>x.period),
                    laymanSummary: `Q${qNum} reliably books higher sales every year — the company's strongest recurring season.`
                });
            } else if (neg >= 4 && negFrac >= 0.6 && neg > pos + 1) {
                const s = negFrac >= 0.8 ? "Strong" : negFrac >= 0.7 ? "Moderate" : "Weak";
                out.push({
                    type: `SEASONAL_QUARTER_${qNum}_WEAKNESS`,
                    label: `Q${qNum} is a seasonally weak quarter`,
                    severity: "negative",
                    strength: s,
                    confidence: _conf(s, neg * 4),
                    detail: `Q${qNum} shows YoY revenue decline in ${neg} of ${qs.length} years (${(negFrac * 100).toFixed(0)}%) — a recurring seasonal slowdown.`,
                    supportingData: [
                        {
                            label: "Years down",
                            value: `${neg}/${qs.length}`
                        },
                        {
                            label: "Share",
                            value: `${(negFrac * 100).toFixed(0)}%`
                        },
                        {
                            label: "Quarter",
                            value: `Q${qNum}`
                        }
                    ],
                    affectedQuarters: qs.map((x)=>x.period),
                    laymanSummary: `Q${qNum} reliably books lower sales every year — a seasonal trough to expect.`
                });
            }
        }
    }
    return out;
}
function groupByCompany(r) {
    const m = new Map();
    for (const x of r){
        if (!m.has(x.symbol)) m.set(x.symbol, []);
        m.get(x.symbol).push(x);
    }
    return Array.from(m.entries()).map(([s, rs])=>({
            symbol: s,
            company: rs[0].company,
            results: rs.sort((a, b)=>new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
        }));
}
function computeCAGR(s, e, y) {
    if (s <= 0 || e <= 0 || y <= 0) return 0;
    return (Math.pow(e / s, 1 / y) - 1) * 100;
}
function computeStdDev(v) {
    if (v.length < 2) return 0;
    const m = v.reduce((a, b)=>a + b, 0) / v.length;
    return Math.sqrt(v.reduce((s, x)=>s + (x - m) ** 2, 0) / v.length);
}
function computeSlope(v) {
    const n = v.length;
    if (n < 2) return 0;
    const xs = Array.from({
        length: n
    }, (_, i)=>i);
    const mX = xs.reduce((a, b)=>a + b, 0) / n;
    const mY = v.reduce((a, b)=>a + b, 0) / n;
    let num = 0, den = 0;
    for(let i = 0; i < n; i++){
        num += (xs[i] - mX) * (v[i] - mY);
        den += (xs[i] - mX) ** 2;
    }
    return den > 0 ? num / den : 0;
}
function generateQuarterlySummary(r, symbol) {
    if (r.length < 4) return [];
    const sector = classifySector(symbol);
    const byQ = {
        1: [],
        2: [],
        3: [],
        4: []
    };
    const byY = new Map();
    for (const x of r){
        const mo = new Date(x.periodEnd).getMonth() + 1;
        let q = mo >= 7 && mo <= 9 ? 1 : mo >= 10 && mo <= 12 ? 2 : mo >= 1 && mo <= 3 ? 3 : 4;
        byQ[q].push(x);
        const fy = x.period.replace(/.*FY/, "");
        if (!byY.has(fy)) byY.set(fy, []);
        byY.get(fy).push(x);
    }
    const sums = [];
    for (const qNum of [
        1,
        2,
        3,
        4
    ]){
        const qs = byQ[qNum];
        if (!qs.length) continue;
        let tr = 0, tv = 0;
        for (const [_, yr] of Array.from(byY.entries())){
            const yt = yr.reduce((s, x)=>s + x.metrics.revenue, 0);
            const qr = yr.find((x)=>{
                const m = new Date(x.periodEnd).getMonth() + 1;
                return m >= 7 && m <= 9 && qNum === 1 || m >= 10 && m <= 12 && qNum === 2 || m >= 1 && m <= 3 && qNum === 3 || m >= 4 && m <= 6 && qNum === 4;
            });
            if (qr && yt > 0) {
                tr += qr.metrics.revenue / yt;
                tv++;
            }
        }
        const arP = tv > 0 ? tr / tv * 100 : 25;
        let tp = 0, tpv = 0;
        for (const [_, yr] of Array.from(byY.entries())){
            const yt = yr.reduce((s, x)=>s + x.metrics.profitAfterTax, 0);
            const qr = yr.find((x)=>{
                const m = new Date(x.periodEnd).getMonth() + 1;
                return m >= 7 && m <= 9 && qNum === 1 || m >= 10 && m <= 12 && qNum === 2 || m >= 1 && m <= 3 && qNum === 3 || m >= 4 && m <= 6 && qNum === 4;
            });
            if (qr && yt > 0) {
                tp += qr.metrics.profitAfterTax / yt;
                tpv++;
            }
        }
        const apP = tpv > 0 ? tp / tpv * 100 : 25;
        const am = qs.reduce((s, x)=>s + x.metrics.netMargin, 0) / qs.length;
        let tp_;
        if (arP < 22) tp_ = "low";
        else if (arP > 28) tp_ = "peak";
        else if (qNum === 1) tp_ = "low";
        else if (qNum === 4) tp_ = "peak";
        else if (qNum === 2) tp_ = "rising";
        else tp_ = "moderate";
        const pq = qNum === 1 ? 4 : qNum - 1;
        const pqs = byQ[pq] || [];
        const par = pqs.length > 0 ? pqs.reduce((s, x)=>s + x.metrics.revenue, 0) / pqs.length : 0;
        const car = qs.reduce((s, x)=>s + x.metrics.revenue, 0) / qs.length;
        const st = par > 0 ? car > par * 1.03 ? "up" : car < par * 0.97 ? "down" : "flat" : "flat";
        const ppr = pqs.length > 0 ? pqs.reduce((s, x)=>s + x.metrics.profitAfterTax, 0) / pqs.length : 0;
        const cap = qs.reduce((s, x)=>s + x.metrics.profitAfterTax, 0) / qs.length;
        const pt = ppr > 0 ? cap > ppr * 1.03 ? "up" : cap < ppr * 0.97 ? "down" : "flat" : "flat";
        const sd = st === "up" ? "go UP" : st === "down" ? "go DOWN" : "stay FLAT";
        const pd = pt === "up" ? "go UP" : pt === "down" ? "go DOWN" : "stay FLAT";
        const ml = qNum === 1 ? "Jul-Sep" : qNum === 2 ? "Oct-Dec" : qNum === 3 ? "Jan-Mar" : "Apr-Jun";
        let s = "";
        switch(tp_){
            case "low":
                s = `In Q${qNum}, sales typically ${sd} from the previous quarter. This is the off-season — lower volumes. Profits usually ${pd} too.`;
                break;
            case "rising":
                s = `In Q${qNum}, sales ${sd} strongly — the seasonal tailwind kicks in. Profits ${pd} as the company scales up.`;
                break;
            case "peak":
                s = `In Q${qNum}, sales ${sd} and often peak for the year. The company books its largest profit. Management often declares dividends here.`;
                break;
            case "moderate":
                s = `In Q${qNum}, sales ${sd} — stabilizing at moderate levels. Profits ${pd}. Transition quarter.`;
                break;
        }
        const cs = getSectorCauseSummary(sector, qNum);
        sums.push({
            quarter: qNum,
            quarterLabel: `Q${qNum}`,
            monthsLabel: ml,
            avgRevenuePctOfTotal: arP,
            avgProfitPctOfTotal: apP,
            avgNetMargin: am,
            typicalPattern: tp_,
            summary: s,
            causeSummary: cs
        });
    }
    return sums;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$latent$2f$AppShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/latent/AppShell.tsx [app-client] (ecmascript)");
"use client";
;
;
function Home() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$latent$2f$AppShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AppShell"], {}, void 0, false, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_83f0afa0._.js.map