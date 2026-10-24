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
"[project]/src/lib/latent/mock-signals.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MOCK_SIGNALS",
    ()=>MOCK_SIGNALS,
    "getActiveSignals",
    ()=>getActiveSignals,
    "getSignalById",
    ()=>getSignalById
]);
// Helper: ISO strings for "today + N days"
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}
const MOCK_SIGNALS = [
    // 1. SWING trade on ENGRO
    {
        id: "sig_engro_swing_001",
        symbol: "ENGRO",
        stockName: "Engro Corporation Limited",
        direction: "LONG",
        horizon: "SWING",
        entryPrice: 285.40,
        targetPrice: 312.00,
        stopLoss: 273.00,
        confidenceScore: 78,
        setupScore: 82,
        status: "ACTIVE",
        createdAt: daysAgo(1),
        expiresAt: daysFromNow(7),
        explanation: {
            summary: "Engro just broke out above its 6-month resistance at 282 with above-average volume. The setup combines a clean technical breakout with improving fertilizer margins (DCP prices up 12% QoQ) and a 7.8% dividend yield cushion. Risk/reward is 2.6:1 to target.",
            technicalLayman: "The chart shows Engro's price has been stuck below PKR 282 for the past 6 months. Yesterday it broke above that ceiling on heavy buying — when price breaks a ceiling that's held for months, it usually means buyers have overpowered sellers. Volume was 1.8× the 30-day average, which confirms the move is real, not a fake-out. The next ceiling is around 312, where profit-taking historically appeared.",
            technicalTerms: [
                {
                    term: "Resistance breakout",
                    meaning: "When price pushes above a level that has repeatedly blocked it from rising further. Think of it as a ceiling finally breaking.",
                    current: "Price broke above PKR 282 (6-month ceiling) yesterday",
                    impact: "Bullish — usually signals new buying conviction"
                },
                {
                    term: "Volume",
                    meaning: "How many shares changed hands. High volume on a move up confirms real conviction; low volume means weak hands.",
                    current: "1.24M shares vs 0.69M average (1.8× normal)",
                    impact: "Bullish — confirms the breakout is genuine"
                },
                {
                    term: "RSI (14)",
                    meaning: "Relative Strength Index — a 0-100 score of how fast price has risen recently. Above 70 = 'overbought' (might pull back); below 30 = 'oversold' (might bounce).",
                    current: "68 — strong but not yet overbought",
                    impact: "Neutral-positive — room to run before pullback"
                },
                {
                    term: "Stop-loss",
                    meaning: "A price below which you automatically exit if the trade goes against you. Caps your downside.",
                    current: "PKR 273 — 4.4% below entry",
                    impact: "Risk management — limits loss if breakout fails"
                }
            ],
            fundamentalLayman: "Engro is a conglomerate (multiple businesses under one company) with dominant positions in fertilizers, foods (Olper's), and petrochemicals. Recent quarter results were strong: revenue up 18% YoY and profit up 24% YoY, driven by higher fertilizer prices and volumes. The company pays a PKR 22/share dividend (7.8% yield) — meaning even if the stock goes nowhere for a year, you collect PKR 22/share just for holding.",
            fundamentalFactors: [
                {
                    label: "Revenue growth (YoY)",
                    value: "+18%",
                    impact: "positive"
                },
                {
                    label: "Profit growth (YoY)",
                    value: "+24%",
                    impact: "positive"
                },
                {
                    label: "P/E ratio",
                    value: "8.2 (vs sector 9.5)",
                    impact: "positive"
                },
                {
                    label: "Dividend yield",
                    value: "7.8%",
                    impact: "positive"
                },
                {
                    label: "Debt-to-equity",
                    value: "1.4 (manageable)",
                    impact: "neutral"
                }
            ],
            newsLayman: "Three news items are pushing this stock: (1) The government announced a PKR 50bn fertilizer subsidy for Rabi season — this directly benefits Engro's urea business. (2) International DAP prices are up 12% QoQ, expanding Engro's margin per ton. (3) Engro's board approved a new PKR 8bn buyback, signaling management thinks the stock is undervalued at current levels.",
            newsItems: [
                {
                    headline: "Govt announces PKR 50bn Rabi fertilizer subsidy",
                    source: "Business Recorder",
                    impact: "positive",
                    affectedStocks: [
                        "ENGRO",
                        "FATIMA",
                        "FFBL"
                    ]
                },
                {
                    headline: "International DAP prices rise 12% QoQ",
                    source: "Mettis Global",
                    impact: "positive",
                    affectedStocks: [
                        "ENGRO",
                        "FFBL",
                        "FATIMA"
                    ]
                },
                {
                    headline: "Engro board approves PKR 8bn share buyback",
                    source: "PSX Notice",
                    impact: "positive",
                    affectedStocks: [
                        "ENGRO"
                    ]
                }
            ],
            actionLayman: "Action: BUY ENGRO between 283-287. Target 312 (+9.4%). Stop-loss 273 (-4.4%). This is a swing trade — expect to hold 2-4 weeks. Don't chase above 290; the breakout gap is already priced in. Allocate ~30% of swing bucket to this trade.",
            riskFactors: [
                "Pak Rupee depreciation could increase input costs (gas, Phos acid)",
                "Government may withdraw fertilizer subsidy if IMF pressures build",
                "General market selloff could drag fundamentals-irrelevant",
                "Cement/steel sector rotation could pull funds away from fertilizers short-term"
            ]
        }
    },
    // 2. DIVIDEND trade on HUBC
    {
        id: "sig_hubc_div_002",
        symbol: "HUBC",
        stockName: "Hub Power Company Limited",
        direction: "LONG",
        horizon: "DIVIDEND",
        entryPrice: 124.80,
        targetPrice: 138.00,
        stopLoss: 118.00,
        confidenceScore: 84,
        setupScore: 88,
        status: "ACTIVE",
        createdAt: daysAgo(2),
        expiresAt: daysFromNow(120),
        explanation: {
            summary: "HUBC is yielding 11.2% — the highest among KSE-100 power utilities — and just announced its interim dividend of PKR 7/share. The stock trades at 6.1× earnings, a 30% discount to its 5-year average P/E of 8.7. This is a buy-and-hold for income investors: collect 11.2% cash yield while waiting for the price to re-rate to fair value.",
            technicalLayman: "HUBC has been in a slow downtrend since June, bottoming at 118 last week. The price has now reclaimed its 50-day moving average (123) — a sign the downtrend is exhausting. For dividend trades, we don't need explosive technicals; we need a floor. The 118 level has held twice in 2024, making it a strong support.",
            technicalTerms: [
                {
                    term: "50-day moving average",
                    meaning: "The average closing price over the past 50 trading days. When price is above it, the short-term trend is up; below, it's down.",
                    current: "Price 124.8 vs 50-DMA 123.0 — just reclaimed",
                    impact: "Mildly bullish — downtrend may be ending"
                },
                {
                    term: "Support level",
                    meaning: "A price floor where buyers have repeatedly stepped in. Strong supports tend to hold again.",
                    current: "PKR 118 — held twice in 2024",
                    impact: "Bullish — defines our stop-loss level"
                },
                {
                    term: "Dividend yield",
                    meaning: "Annual dividend ÷ current share price. Tells you the cash return just for holding, ignoring price moves.",
                    current: "11.2% — far above bank deposit rates of ~10%",
                    impact: "Strongly bullish for income investors"
                },
                {
                    term: "P/E ratio",
                    meaning: "Price ÷ annual earnings per share. Lower P/E = cheaper stock (more earnings per rupee of price).",
                    current: "6.1× — 30% below 5-year average of 8.7×",
                    impact: "Bullish — stock is historically cheap"
                }
            ],
            fundamentalLayman: "HUBC is a power producer — it operates the Hub Power Plant and has stakes in Thar coal projects. The business is utility-like: predictable cash flows, long-term contracts with the government, and a mandate to distribute 70-90% of profit as dividend. The PKR 7/share interim dividend was declared last week. Latest quarterly profit was PKR 9.4/share — at current price, that's annualized earnings yield of 30%, with most of it coming back as dividend.",
            fundamentalFactors: [
                {
                    label: "Interim dividend",
                    value: "PKR 7/share (5.6% interim yield)",
                    impact: "positive"
                },
                {
                    label: "Quarterly EPS",
                    value: "PKR 9.4 (vs 7.2 last year)",
                    impact: "positive"
                },
                {
                    label: "P/E ratio",
                    value: "6.1× (30% below 5yr avg)",
                    impact: "positive"
                },
                {
                    label: "Payout ratio",
                    value: "85% (high)",
                    impact: "positive"
                },
                {
                    label: "Thar Coal extension",
                    value: "Project on track, expected cash flow accretion from 2026",
                    impact: "positive"
                }
            ],
            newsLayman: "Two tailwinds: (1) NEPRA approved HUBC's tariff adjustment for coal cost pass-through — this protects margins from international coal price spikes. (2) The PKR/USD has stabilized around 280-285, reducing the rupee impact on HUBC's USD-denominated receivables from the government.",
            newsItems: [
                {
                    headline: "NEPRA approves coal cost pass-through tariff for Hub Power",
                    source: "Dawn Business",
                    impact: "positive",
                    affectedStocks: [
                        "HUBC",
                        "KAPCO",
                        "NPL"
                    ]
                },
                {
                    headline: "PKR/USD stabilizes at 282, reducing currency pressure on power sector",
                    source: "Mettis Global",
                    impact: "positive",
                    affectedStocks: [
                        "HUBC",
                        "HUBC",
                        "KAPCO",
                        "NPL",
                        "MFFL"
                    ]
                }
            ],
            actionLayman: "Action: BUY HUBC at current levels (124-126) for the dividend income portfolio. This is a long-term hold — 6-18 months. Target 138 (fair-value re-rating) plus 11.2% annual cash dividend. Stop-loss 118 (recent support). Don't worry about daily price moves — the dividend is what pays you here.",
            riskFactors: [
                "Government circular debt could delay receivables collection",
                "Coal price spike could compress margins if tariff adjustment lags",
                "Currency depreciation cycle could resume if IMF program slips",
                "New CPEC coal plants could compete for capacity factor"
            ]
        }
    },
    // 3. DAY trade on SYS
    {
        id: "sig_sys_day_003",
        symbol: "SYS",
        stockName: "Systems Limited",
        direction: "LONG",
        horizon: "DAY",
        entryPrice: 412.20,
        targetPrice: 425.00,
        stopLoss: 406.00,
        confidenceScore: 71,
        setupScore: 76,
        status: "ACTIVE",
        createdAt: daysAgo(0),
        expiresAt: daysFromNow(1),
        explanation: {
            summary: "SYS gapped up 4.2% at open on heavy volume after announcing a $12M US contract win. Momentum is strong, RSI at 72 is overbought but momentum trades often run further than expected. This is a fast in-and-out — entry near open, exit at +3% or close.",
            technicalLayman: "The stock opened at 412, up 4.2% from yesterday's close. This 'gap up' on high volume signals big news. The first 30 minutes of trading saw 580K shares change hands (vs full-day average of 920K). The risk: overbought RSI at 72 means a pullback is likely. The opportunity: momentum stocks often overshoot on news days.",
            technicalTerms: [
                {
                    term: "Gap up",
                    meaning: "When today's opening price is higher than yesterday's high. Often signals overnight news.",
                    current: "Opened at 412, yesterday's high was 405",
                    impact: "Bullish — news catalyst confirmed"
                },
                {
                    term: "Volume spike",
                    meaning: "Unusually high trading in the first hour. Confirms news-driven interest.",
                    current: "580K shares in 30 min vs 4hr-average of 920K",
                    impact: "Bullish — institutional interest likely"
                },
                {
                    term: "RSI (14)",
                    meaning: "Momentum indicator 0-100. Above 70 = overbought (risks pullback), below 30 = oversold.",
                    current: "72 — overbought",
                    impact: "Caution — exit discipline required"
                },
                {
                    term: "VWAP",
                    meaning: "Volume-Weighted Average Price — the average price weighted by volume traded today. Price above VWAP = buyers in control.",
                    current: "VWAP is 414, price is 412 (below VWAP)",
                    impact: "Mildly bearish — sellers currently winning intraday"
                }
            ],
            fundamentalLayman: "Systems Limited is Pakistan's largest listed IT company — it does software development and BPO for global clients. Today's news: they won a $12M contract with a US healthcare company, which is +6% of last year's revenue. This adds visibility for FY26 earnings.",
            fundamentalFactors: [
                {
                    label: "New contract",
                    value: "$12M / +6% of FY25 revenue",
                    impact: "positive"
                },
                {
                    label: "Revenue (FY25)",
                    value: "$190M, +24% YoY",
                    impact: "positive"
                },
                {
                    label: "P/E ratio",
                    value: "14.5× (high for KSE, normal for IT)",
                    impact: "neutral"
                },
                {
                    label: "Client concentration",
                    value: "Top 5 clients = 40% of revenue (concentration risk)",
                    impact: "negative"
                }
            ],
            newsLayman: "Today's announcement: SYS won a 3-year $12M contract with a US healthcare system. The stock is reacting to this catalyst today. The contract is incremental but signals continued US client acquisition momentum.",
            newsItems: [
                {
                    headline: "Systems Limited wins $12M US healthcare contract",
                    source: "PSX Announcement",
                    impact: "positive",
                    affectedStocks: [
                        "SYS",
                        "AVN",
                        "TRSM"
                    ]
                },
                {
                    headline: "USD/PKR stable at 282, supporting IT export margins",
                    source: "Mettis Global",
                    impact: "positive",
                    affectedStocks: [
                        "SYS",
                        "AVN",
                        "TRSM",
                        "PICT"
                    ]
                }
            ],
            actionLayman: "Action: BUY SYS near current price 410-414. Exit at 425 (+3.1%) or by market close today, whichever first. Stop-loss 406 (-1.5%). This is a day trade — do NOT hold overnight. Set a price alert at 425 and exit immediately when hit.",
            riskFactors: [
                "Overbought RSI means high risk of intraday pullback",
                "Profit-taking could start at 420 (round number)",
                "Tech sector sentiment is volatile — single bad headline could reverse",
                "Holding overnight defeats the purpose of a day trade"
            ]
        }
    },
    // 4. GROWTH trade on LUCK
    {
        id: "sig_luck_growth_004",
        symbol: "LUCK",
        stockName: "Lucky Cement Limited",
        direction: "LONG",
        horizon: "GROWTH",
        entryPrice: 892.50,
        targetPrice: 1180.00,
        stopLoss: 820.00,
        confidenceScore: 81,
        setupScore: 85,
        status: "ACTIVE",
        createdAt: daysAgo(3),
        expiresAt: daysFromNow(365),
        explanation: {
            summary: "LUCK is the largest cement producer in Pakistan. PSX cement stocks are at cyclical lows (P/E 9.7 vs 5-year avg 14.5). Two structural drivers: (1) PSDP allocation for FY26 is up 27% — infrastructure spending directly drives cement demand. (2) Interest rates peaked at 22% and are now cutting — rate cuts directly lift cement demand (housing starts) and lift cement valuations (lower discount rate). Multi-bagger candidate over 18-24 months.",
            technicalLayman: "LUCK bottomed at 720 in June, has been base-building for 6 months between 800-950. The 200-day moving average at 875 is now sloping up — a long-term trend change signal. Price just reclaimed 890, the upper end of the base. This is a 'cup-and-handle' formation on the weekly chart — historically bullish over 6-12 month horizons.",
            technicalTerms: [
                {
                    term: "200-day moving average",
                    meaning: "Long-term trend indicator. Price above 200-DMA with rising slope = long-term bull trend resuming.",
                    current: "Price 892 vs 200-DMA 875, slope turning up",
                    impact: "Bullish — long-term trend resuming"
                },
                {
                    term: "Base building",
                    meaning: "When a stock trades in a range for months after a downtrend. Indicates sellers exhausted, accumulators stepping in.",
                    current: "6-month base 800-950",
                    impact: "Bullish — accumulation phase"
                },
                {
                    term: "P/E ratio vs sector",
                    meaning: "When a stock's P/E is below both its own history and the sector, it's 'cheap' fundamentally.",
                    current: "9.7× vs 5-yr avg 14.5× (33% below)",
                    impact: "Strongly bullish — cyclical low"
                },
                {
                    term: "Cup and handle",
                    meaning: "Chart pattern: rounded bottom (cup) followed by small pullback (handle). Often precedes upside breakout.",
                    current: "Weekly cup complete, handle forming at 880-900",
                    impact: "Bullish — breakout pending"
                }
            ],
            fundamentalLayman: "Lucky Cement is the largest cement producer in Pakistan with 18M tons annual capacity. The cement sector has been in a downturn since 2022 (high interest rates crushed housing demand). That's now reversing: SBP cut policy rate from 22% to 17% and is expected to cut further. Each 100bps cut lifts cement demand by ~5% (housing sensitivity) and lifts cement stock valuations by ~15% (lower discount rate).",
            fundamentalFactors: [
                {
                    label: "Capacity utilization",
                    value: "78% (vs 5yr avg 85%)",
                    impact: "negative"
                },
                {
                    label: "P/E ratio",
                    value: "9.7× (vs 5yr avg 14.5×)",
                    impact: "positive"
                },
                {
                    label: "PSDP allocation (FY26)",
                    value: "+27% YoY (infrastructure demand)",
                    impact: "positive"
                },
                {
                    label: "Interest rate trajectory",
                    value: "Cutting cycle, -500bps since Jun 2024",
                    impact: "positive"
                },
                {
                    label: "Coal prices (key input)",
                    value: "Down 12% YoY, margin tailwind",
                    impact: "positive"
                }
            ],
            newsLayman: "Three macro tailwinds: (1) SBP cut policy rate by another 100bps to 17% last week — directly benefits cement demand and valuations. (2) Federal PSDP allocation for FY26 announced at PKR 1.4 trillion, up 27% YoY — infrastructure spending drives cement offtake. (3) International coal prices (key input) down 12% YoY, expanding cement margins.",
            newsItems: [
                {
                    headline: "SBP cuts policy rate by 100bps to 17%",
                    source: "SBP Monetary Policy",
                    impact: "positive",
                    affectedStocks: [
                        "LUCK",
                        "DGKC",
                        "MLCF",
                        "CHCC",
                        "FCCL",
                        "HUBC",
                        "ENGRO"
                    ]
                },
                {
                    headline: "Federal PSDP FY26 allocation up 27% YoY at PKR 1.4T",
                    source: "Business Recorder",
                    impact: "positive",
                    affectedStocks: [
                        "LUCK",
                        "DGKC",
                        "MLCF",
                        "CHCC",
                        "FCCL",
                        "PSO",
                        "OGDC"
                    ]
                },
                {
                    headline: "International coal prices down 12% YoY",
                    source: "Mettis Global",
                    impact: "positive",
                    affectedStocks: [
                        "LUCK",
                        "DGKC",
                        "MLCF",
                        "FCCL"
                    ]
                }
            ],
            actionLayman: "Action: BUY LUCK in 3 tranches: 50% at 880-900, 30% on dips to 860, 20% on breakout above 950. Target 1180 (+32%). Stop-loss 820 (-8.1%). This is a 12-18 month growth trade — patient capital. Don't check it daily; check it monthly.",
            riskFactors: [
                "Cement demand lags rate cuts by 6-9 months — patience required",
                "Government may divert PSDP funds if fiscal deficit widens",
                "New capacity additions (CHCC expansion) could pressure prices",
                "Construction slowdown in northern region specifically impacts LUCK's base"
            ]
        }
    },
    // 5. SWING trade on MEBL (already triggered — has open trade)
    {
        id: "sig_mebl_swing_005",
        symbol: "MEBL",
        stockName: "Meezan Bank Limited",
        direction: "LONG",
        horizon: "SWING",
        entryPrice: 268.30,
        targetPrice: 295.00,
        stopLoss: 258.00,
        confidenceScore: 75,
        setupScore: 79,
        status: "TRIGGERED",
        createdAt: daysAgo(5),
        expiresAt: daysFromNow(14),
        explanation: {
            summary: "MEBL pulled back to its 50-DMA at 266 last week, formed a bullish reversal candle on Friday, and confirmed on Monday with a +1.8% close at 268. Bank fundamentals are strong: Q3 EPS up 19% YoY, NIM expansion continued, ADR ratio 87% (best in industry). This trade triggered at 268.30 — entry window closed.",
            technicalLayman: "MEBL had a clean 3-week pullback from 282 to 266 — a 5.7% retracement. The 50-DMA at 266 has been a reliable support all year (held 4 times). The reversal candle on Friday with a long lower wick signals buyers stepped in at the close. Monday's confirmation (+1.8%) completes the setup.",
            technicalTerms: [
                {
                    term: "50-DMA support",
                    meaning: "The 50-day moving average acting as a price floor. Has held multiple times = strong support.",
                    current: "266 — held 4× in 2024",
                    impact: "Bullish — support confirmed again"
                },
                {
                    term: "Reversal candle",
                    meaning: "A single day's price action that signals a change in direction. Long lower wick = buyers bought the dip intraday.",
                    current: "Friday's candle: low 263, close 266 (long lower wick)",
                    impact: "Bullish — reversal pattern"
                },
                {
                    term: "Confirmation",
                    meaning: "The day after a setup where price moves in the expected direction. Confirms the setup wasn't a false signal.",
                    current: "Monday +1.8% to 268 — confirmed",
                    impact: "Bullish — setup is live"
                }
            ],
            fundamentalLayman: "Meezan Bank is Pakistan's largest Islamic bank. Q3 results: profit up 19% YoY, NIMs expanded 30bps to 6.2%, ADR (advance-to-deposit) ratio at 87% (highest in industry — efficient capital deployment). Islamic banking is structurally growing at 30% YoY in Pakistan as more Pakistanis shift from conventional to Shariah-compliant products.",
            fundamentalFactors: [
                {
                    label: "Q3 EPS",
                    value: "PKR 11.8 (vs 9.9 last year)",
                    impact: "positive"
                },
                {
                    label: "NIM",
                    value: "6.2% (expanded 30bps)",
                    impact: "positive"
                },
                {
                    label: "ADR ratio",
                    value: "87% (industry-best)",
                    impact: "positive"
                },
                {
                    label: "P/E",
                    value: "7.4× (below 5yr avg 8.2×)",
                    impact: "positive"
                },
                {
                    label: "Dividend yield",
                    value: "6.5%",
                    impact: "positive"
                }
            ],
            newsLayman: "Islamic banking growth accelerated in Q3 — SBP data shows 30% YoY deposit growth in Islamic banking vs 13% for conventional. MEBL gaining market share. Also: Meezan's MMB (Meezan Mutual Benefit) digital banking app crossed 8M users, the highest for any Islamic bank in Pakistan.",
            newsItems: [
                {
                    headline: "Islamic banking deposits grow 30% YoY (SBP data)",
                    source: "SBP Quarterly",
                    impact: "positive",
                    affectedStocks: [
                        "MEBL",
                        "BIPL",
                        "BAFL"
                    ]
                },
                {
                    headline: "Meezan's MMB app crosses 8M users",
                    source: "PSX Notice",
                    impact: "positive",
                    affectedStocks: [
                        "MEBL"
                    ]
                }
            ],
            actionLayman: "Action: This signal TRIGGERED at 268.30 on Monday. Entry window closed. If you're already in: hold to target 295, trail stop-loss to 262 now. If you missed entry: don't chase — wait for the next pullback to 263-266.",
            riskFactors: [
                "SBP further rate cuts could compress NIMs across banking sector",
                "Asset quality deterioration if macroeconomic slowdown deepens",
                "Islamic banking competition intensifying (BankIslah, Dubai Islamic)",
                "Currency depreciation cycle could resume if IMF program slips"
            ]
        }
    }
];
function getSignalById(id) {
    return MOCK_SIGNALS.find((s)=>s.id === id);
}
function getActiveSignals() {
    return MOCK_SIGNALS;
}
}),
"[project]/src/lib/latent/mock-trades.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MOCK_TRADES",
    ()=>MOCK_TRADES
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$signals$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-signals.ts [app-route] (ecmascript)");
;
// Generate 50+ historical closed trades across horizons and market regimes
// Some are linked to active signals; others are historical signals now closed.
// All numbers are realistic for KSE-100 stocks (price range 80-900 PKR).
const HISTORICAL_SYMBOLS = [
    "ENGRO",
    "HUBC",
    "LUCK",
    "SYS",
    "MEBL",
    "PSO",
    "OGDC",
    "PPL"
];
const HORIZONS = [
    "DAY",
    "SWING",
    "DIVIDEND",
    "GROWTH"
];
function seedRandom(seed) {
    let s = seed;
    return ()=>{
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
}
const rand = seedRandom(42);
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}
function pickPrice(symbol) {
    const base = {
        ENGRO: 285,
        HUBC: 124,
        LUCK: 892,
        SYS: 412,
        MEBL: 268,
        PSO: 198,
        OGDC: 142,
        PPL: 118
    };
    return base[symbol] * (0.85 + rand() * 0.3);
}
const MOCK_TRADES = [];
// Generate 50 historical closed trades
for(let i = 0; i < 50; i++){
    const symbol = HISTORICAL_SYMBOLS[Math.floor(rand() * HISTORICAL_SYMBOLS.length)];
    const horizon = HORIZONS[Math.floor(rand() * HORIZONS.length)];
    const entryPrice = pickPrice(symbol);
    // 62% win rate (above market, defensible for a good signal algorithm)
    const isWin = rand() < 0.62;
    const isBreakeven = !isWin && rand() < 0.15;
    // Time horizon affects hold duration
    const baseDays = horizon === "DAY" ? 1 : horizon === "SWING" ? 14 : horizon === "DIVIDEND" ? 180 : 365;
    const holdDays = Math.max(1, Math.floor(baseDays * (0.5 + rand() * 1.5)));
    // Win/loss magnitude
    const winPct = horizon === "DAY" ? 2 + rand() * 4 : horizon === "SWING" ? 5 + rand() * 8 : 10 + rand() * 25;
    const lossPct = horizon === "DAY" ? 1 + rand() * 2 : horizon === "SWING" ? 3 + rand() * 5 : 5 + rand() * 12;
    const pnlPct = isBreakeven ? 0 : isWin ? winPct : -lossPct;
    const exitPrice = entryPrice * (1 + pnlPct / 100);
    const shares = Math.floor((50000 + rand() * 200000) / entryPrice);
    const pnlPkr = (exitPrice - entryPrice) * shares;
    const entryDateOffset = 30 + i * 7; // staggered entries over the past year
    const entryDate = daysAgo(entryDateOffset + holdDays);
    const exitDate = daysAgo(entryDateOffset);
    const status = isBreakeven ? "CLOSED_BREAKEVEN" : isWin ? "CLOSED_WIN" : "CLOSED_LOSS";
    MOCK_TRADES.push({
        id: `trade_hist_${i}`,
        signalId: `signal_hist_${i}`,
        symbol,
        direction: "LONG",
        horizon,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        exitPrice: parseFloat(exitPrice.toFixed(2)),
        entryDate,
        exitDate,
        status,
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlPkr: parseFloat(pnlPkr.toFixed(0)),
        timeToCloseDays: holdDays
    });
}
// Add open trades from active signals
for (const signal of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$signals$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MOCK_SIGNALS"]){
    if (signal.status !== "TRIGGERED") continue;
    const entryPrice = signal.entryPrice;
    const currentPrice = signal.entryPrice * (1 + (rand() - 0.4) * 0.08);
    const pnlPct = (currentPrice - entryPrice) / entryPrice * 100;
    const shares = Math.floor(150000 / entryPrice);
    const pnlPkr = (currentPrice - entryPrice) * shares;
    MOCK_TRADES.push({
        id: `trade_open_${signal.id}`,
        signalId: signal.id,
        symbol: signal.symbol,
        direction: signal.direction,
        horizon: signal.horizon,
        entryPrice: parseFloat(entryPrice.toFixed(2)),
        exitPrice: null,
        entryDate: daysAgo(Math.floor(rand() * 14) + 1),
        exitDate: null,
        status: "OPEN",
        pnlPct: parseFloat(pnlPct.toFixed(2)),
        pnlPkr: parseFloat(pnlPkr.toFixed(0)),
        timeToCloseDays: null
    });
}
}),
"[project]/src/lib/latent/mock-stocks.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
        sector: "Fertilizer",
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
        sector: "Oil Marketing",
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
        sector: "Oil & Gas",
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
        sector: "Oil & Gas",
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
}),
"[project]/src/app/api/cron/check-tp-sl/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$trades$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-trades.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/mock-stocks.ts [app-route] (ecmascript)");
;
;
;
;
;
;
const dynamic = "force-dynamic";
const maxDuration = 30;
async function GET(req) {
    const startTime = Date.now();
    const authHeader = req.headers.get("authorization");
    const expectedAuth = process.env.CRON_SECRET;
    // In production, require auth
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Unauthorized"
        }, {
            status: 401
        });
    }
    try {
        // Fetch open trades from DB (real tracked trades from /api/execute)
        const dbTrades = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.findMany({
            where: {
                status: "OPEN"
            }
        });
        // Also include mock open trades for demo purposes
        const mockOpenTrades = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$trades$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MOCK_TRADES"].filter((t)=>t.status === "OPEN");
        const allOpenTrades = [
            ...dbTrades.map((t)=>({
                    id: t.id,
                    symbol: t.symbol,
                    entryPrice: t.entryPrice,
                    targetPrice: null,
                    stopLoss: null
                })),
            ...mockOpenTrades.map((t)=>({
                    id: t.id,
                    symbol: t.symbol,
                    entryPrice: t.entryPrice,
                    targetPrice: t.targetPrice || null,
                    stopLoss: t.stopLoss || null
                }))
        ];
        if (allOpenTrades.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                checkedAt: new Date().toISOString(),
                openTrades: 0,
                tpHits: [],
                slHits: [],
                latencyMs: Date.now() - startTime,
                message: "No open trades to monitor."
            });
        }
        // For each unique symbol, fetch current price + load TP/SL from predictions
        const symbolsToCheck = Array.from(new Set(allOpenTrades.map((t)=>t.symbol)));
        const priceChecks = [];
        for (const symbol of symbolsToCheck){
            // Get current price from mock-stocks (fallback) or live API
            let currentPrice = null;
            const mockStock = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$mock$2d$stocks$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MOCK_STOCKS"].find((s)=>s.symbol === symbol);
            if (mockStock) {
                currentPrice = mockStock.price;
            }
            // Try live price from askanalyst.com.pk (best effort — don't fail if it errors)
            if (!currentPrice) {
                try {
                    const now = Date.now();
                    const from = now - 7 * 24 * 60 * 60 * 1000; // last 7 days
                    const res = await fetch(`https://api.askanalyst.com.pk/api/technicalchart/day/${from}/${now}/${symbol}`, {
                        headers: {
                            "User-Agent": "LatentBot/1.0"
                        }
                    });
                    if (res.ok) {
                        const text = await res.text();
                        const lines = text.split("\n").filter((l)=>l.trim());
                        // Find last non-zero-volume row
                        for(let i = lines.length - 1; i >= 1; i--){
                            const parts = lines[i].split(",");
                            if (parts.length < 6) continue;
                            const close = Number(parts[4]);
                            const volume = Number(parts[5]);
                            if (close && volume > 0) {
                                currentPrice = close;
                                break;
                            }
                        }
                    }
                } catch (err) {
                    console.warn(`[check-tp-sl] Failed to fetch live price for ${symbol}:`, err);
                }
            }
            if (!currentPrice) continue;
            // Load TP/SL from predictions file
            let targetPrice = null;
            let stopLoss = null;
            try {
                const predPath = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), "data", "ml_predictions.json");
                const predContent = await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readFile(predPath, "utf-8");
                const predictions = JSON.parse(predContent);
                const pred = predictions.predictions?.[symbol];
                if (pred) {
                    targetPrice = pred.targetPrice;
                    stopLoss = pred.stopLoss;
                }
            } catch  {
            // Skip if predictions file not available
            }
            // Check TP/SL hits
            const symbolTrades = allOpenTrades.filter((t)=>t.symbol === symbol);
            const tpHits = [];
            const slHits = [];
            for (const trade of symbolTrades){
                const tp = trade.targetPrice || targetPrice;
                const sl = trade.stopLoss || stopLoss;
                if (!tp || !sl) continue;
                // TP hit: current price >= target
                if (currentPrice >= tp) {
                    tpHits.push({
                        tradeId: trade.id,
                        symbol,
                        entryPrice: trade.entryPrice,
                        targetPrice: tp,
                        currentPrice
                    });
                }
                // SL hit: current price <= stop-loss
                if (currentPrice <= sl) {
                    slHits.push({
                        tradeId: trade.id,
                        symbol,
                        entryPrice: trade.entryPrice,
                        stopLoss: sl,
                        currentPrice
                    });
                }
            }
            priceChecks.push({
                symbol,
                currentPrice,
                openTradesChecked: symbolTrades.length,
                tpHits,
                slHits
            });
        }
        // Update trade statuses in DB for hits
        const allHits = priceChecks.flatMap((p)=>[
                ...p.tpHits.map((h)=>({
                        tradeId: h.tradeId,
                        type: "TP",
                        ...h
                    })),
                ...p.slHits.map((h)=>({
                        tradeId: h.tradeId,
                        type: "SL",
                        ...h
                    }))
            ]);
        for (const hit of allHits){
            try {
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].trade.updateMany({
                    where: {
                        id: hit.tradeId,
                        status: "OPEN"
                    },
                    data: {
                        status: hit.type === "TP" ? "CLOSED_WIN" : "CLOSED_LOSS",
                        exitPrice: hit.currentPrice,
                        exitDate: new Date()
                    }
                });
            } catch (err) {
                console.warn(`[check-tp-sl] Failed to update trade ${hit.tradeId}:`, err);
            }
        }
        const totalTpHits = allHits.filter((h)=>h.type === "TP").length;
        const totalSlHits = allHits.filter((h)=>h.type === "SL").length;
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            checkedAt: new Date().toISOString(),
            openTradesChecked: allOpenTrades.length,
            symbolsChecked: symbolsToCheck.length,
            tpHits: totalTpHits,
            slHits: totalSlHits,
            details: priceChecks,
            latencyMs: Date.now() - startTime,
            schedule: "Should run every 5 minutes during PSX session (09:00-17:00 PKT, Mon-Fri)",
            productionSetup: {
                vercelCron: 'Add to vercel.json: { "crons": [{ "path": "/api/cron/check-tp-sl", "schedule": "*/5 4-12 * * 1-5" }] }',
                githubActions: "Schedule a workflow with curl https://latent.pk/api/cron/check-tp-sl",
                secret: "Set CRON_SECRET env var and pass as Bearer token in Authorization header"
            }
        });
    } catch (err) {
        console.error("[check-tp-sl] error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Cron run failed",
            detail: err instanceof Error ? err.message : "Unknown",
            latencyMs: Date.now() - startTime
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__2c48b50f._.js.map