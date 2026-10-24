(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/latent/i18n.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getDirection",
    ()=>getDirection,
    "useI18n",
    ()=>useI18n
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
"use client";
;
;
const dict = {
    // Nav
    "nav.fundamental_news": {
        en: "Fundamental News",
        roman_urdu: "Bunyadi Khabrein",
        urdu: "بنیادی خبریں"
    },
    "nav.technical_analysis": {
        en: "Technical Analysis",
        roman_urdu: "Technical Tajzea",
        urdu: "تکنیکی تجزیہ"
    },
    "nav.signals": {
        en: "Signals",
        roman_urdu: "Signals",
        urdu: "اشارات"
    },
    "nav.portfolio": {
        en: "Portfolio",
        roman_urdu: "Portfolio",
        urdu: "پورٹفولیو"
    },
    "nav.strategy": {
        en: "Strategy",
        roman_urdu: "Strategy",
        urdu: "حکمتِ عمل"
    },
    "nav.dividends": {
        en: "Dividends",
        roman_urdu: "Dividends",
        urdu: "ڈیویڈنڈ"
    },
    "nav.tracker": {
        en: "Tracker",
        roman_urdu: "Tracker",
        urdu: "ٹریکر"
    },
    "nav.ai_model_signals": {
        en: "AI Models",
        roman_urdu: "AI Models",
        urdu: "اے آئی ماڈلز"
    },
    "nav.calculators": {
        en: "Calculators",
        roman_urdu: "Calculators",
        urdu: "کیلکولیٹرز"
    },
    "nav.pattern_finder": {
        en: "Pattern Finder",
        roman_urdu: "Pattern Finder",
        urdu: "پیٹرن فائنڈر"
    },
    "nav.dashboard": {
        en: "Dashboard",
        roman_urdu: "Dashboard",
        urdu: "ڈیش بورڈ"
    },
    // Common
    "common.loading": {
        en: "Loading...",
        roman_urdu: "Lodaing ho raha hai...",
        urdu: "لوڈ ہو رہا ہے..."
    },
    "common.error": {
        en: "Something went wrong",
        roman_urdu: "Kuch masla ho gaya",
        urdu: "کوئی مسئلہ ہو گیا"
    },
    "common.view_detail": {
        en: "View detail",
        roman_urdu: "Tafseel dekhein",
        urdu: "تفصیل دیکھیں"
    },
    "common.execute": {
        en: "Execute",
        roman_urdu: "Execute",
        urdu: "ایکزیکیوٹ"
    },
    "common.back": {
        en: "Back",
        roman_urdu: "Wapas",
        urdu: "واپس"
    },
    "common.refresh": {
        en: "Refresh",
        roman_urdu: "Refresh",
        urdu: "ریفریش"
    },
    "common.all": {
        en: "All",
        roman_urdu: "Sab",
        urdu: "سب"
    },
    "common.search": {
        en: "Search",
        roman_urdu: "Search",
        urdu: "تلاش"
    },
    // Signal
    "signal.buy": {
        en: "BUY",
        roman_urdu: "KHAREEDAIN",
        urdu: "خریدیں"
    },
    "signal.sell": {
        en: "SELL",
        roman_urdu: "BECHEIN",
        urdu: "بیچیں"
    },
    "signal.hold": {
        en: "HOLD",
        roman_urdu: "HOLD",
        urdu: "ہولڈ"
    },
    "signal.accumulate": {
        en: "ACCUMULATE",
        roman_urdu: "JAMA KAREin",
        urdu: "جمع کریں"
    },
    "signal.confidence": {
        en: "Confidence",
        roman_urdu: "Confidence",
        urdu: "اعتماد"
    },
    // News
    "news.international_national": {
        en: "International & National",
        roman_urdu: "International aur National",
        urdu: "بین الاقوامی و قومی"
    },
    "news.company_news": {
        en: "Company News",
        roman_urdu: "Company Khabrein",
        urdu: "کمپنی خبریں"
    },
    "news.company_results": {
        en: "Company Results",
        roman_urdu: "Company Natijay",
        urdu: "کمپنی نتائج"
    },
    "news.remarks": {
        en: "Remarks",
        roman_urdu: "Tabsara",
        urdu: "تبصرہ"
    },
    "news.impact": {
        en: "Impact",
        roman_urdu: "Asar",
        urdu: "اثر"
    },
    "news.affected_stocks": {
        en: "Affected stocks",
        roman_urdu: "Mutruisht stocks",
        urdu: "متاثرہ اسٹاکس"
    },
    "news.open_signal": {
        en: "Open signal",
        roman_urdu: "Signal kholain",
        urdu: "اشارہ کھولیں"
    },
    "news.view_pdf": {
        en: "View PDF",
        roman_urdu: "PDF dekhein",
        urdu: "پی ڈی ایف دیکھیں"
    },
    "news.interpret_link": {
        en: "Interpret a news link",
        roman_urdu: "News link interpret karein",
        urdu: "نیوز لنک کی تشریح کریں"
    },
    "news.paste_link": {
        en: "Paste any news article URL to get an AI interpretation",
        roman_urdu: "AI interpretation ke luye koi bhi news article URL paste karein",
        urdu: "اے آئی تشریح کے لیے کوئی بھی نیوز آرٹیکل یو آر ایل پیسٹ کریں"
    },
    // Portfolio
    "portfolio.add_stock": {
        en: "Add stock",
        roman_urdu: "Stock add karein",
        urdu: "اسٹاک شامل کریں"
    },
    "portfolio.empty": {
        en: "No stocks in your portfolio yet",
        roman_urdu: "Aap ke portfolio mein abhi koi stock nahi",
        urdu: "آپ کے پورٹفولیو میں ابھی کوئی اسٹاک نہیں"
    },
    "portfolio.hold": {
        en: "Hold",
        roman_urdu: "Hold",
        urdu: "ہولڈ"
    },
    "portfolio.sell": {
        en: "Sell",
        roman_urdu: "Sell",
        urdu: "بیچیں"
    },
    "portfolio.buy_more": {
        en: "Buy more to average",
        roman_urdu: "Average ke luye aur khareedain",
        urdu: "اوسط کے لیے مزید خریدیں"
    },
    "portfolio.profit": {
        en: "Profit",
        roman_urdu: "Profit",
        urdu: "منافع"
    },
    "portfolio.loss": {
        en: "Loss",
        roman_urdu: "Loss",
        urdu: "نقصان"
    },
    // Strategy
    "strategy.goal_question": {
        en: "What's your investment goal?",
        roman_urdu: "Aap ki investment maqsad kya hai?",
        urdu: "آپ کی انویسٹمنٹ مقصد کیا ہے؟"
    },
    // Tracker
    "tracker.signal_tracker": {
        en: "Signal Tracker",
        roman_urdu: "Signal Tracker",
        urdu: "سگنل ٹریکر"
    },
    "tracker.portfolio_tracker": {
        en: "Portfolio Tracker",
        roman_urdu: "Portfolio Tracker",
        urdu: "پورٹفولیو ٹریکر"
    },
    "tracker.win_rate": {
        en: "Win rate",
        roman_urdu: "Win rate",
        urdu: "کامیابی کی شرح"
    },
    "tracker.roi": {
        en: "ROI %",
        roman_urdu: "ROI %",
        urdu: "آر او آئی %"
    },
    // Landing
    "landing.cta.build_plan": {
        en: "Build my plan",
        roman_urdu: "Apna plan banayein",
        urdu: "اپنا پلان بنائیں"
    },
    "landing.cta.explore": {
        en: "Explore the platform",
        roman_urdu: "Platform explore karein",
        urdu: "پلیٹ فارم ایکسپلور کریں"
    }
};
const useI18n = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        lang: "en",
        setLang: (l)=>set({
                lang: l
            }),
        t: (key)=>{
            const entry = dict[key];
            if (!entry) return key;
            const lang = get().lang;
            return entry[lang] || entry.en;
        }
    }), {
    name: "latent-i18n"
}));
function getDirection(lang) {
    return lang === "urdu" ? "rtl" : "ltr";
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/latent/LanguageDirSync.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LanguageDirSync",
    ()=>LanguageDirSync
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$i18n$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/latent/i18n.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function LanguageDirSync() {
    _s();
    const lang = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$i18n$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useI18n"])({
        "LanguageDirSync.useI18n[lang]": (s)=>s.lang
    }["LanguageDirSync.useI18n[lang]"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LanguageDirSync.useEffect": ()=>{
            if (typeof document === "undefined") return;
            const html = document.documentElement;
            const body = document.body;
            if (lang === "urdu") {
                html.setAttribute("dir", "rtl");
                html.setAttribute("lang", "ur");
                body.classList.add("font-urdu");
                body.style.fontFamily = "var(--font-urdu), var(--font-inter-sans), sans-serif";
            } else if (lang === "roman_urdu") {
                html.setAttribute("dir", "ltr");
                html.setAttribute("lang", "ur-Latn");
                body.classList.remove("font-urdu");
                body.style.fontFamily = "";
            } else {
                html.setAttribute("dir", "ltr");
                html.setAttribute("lang", "en");
                body.classList.remove("font-urdu");
                body.style.fontFamily = "";
            }
        }
    }["LanguageDirSync.useEffect"], [
        lang
    ]);
    return null;
}
_s(LanguageDirSync, "tZDuYSxLvcUxj4wS2nYBR1ItylM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$latent$2f$i18n$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useI18n"]
    ];
});
_c = LanguageDirSync;
var _c;
__turbopack_context__.k.register(_c, "LanguageDirSync");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/zustand/esm/vanilla.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createStore",
    ()=>createStore
]);
const createStoreImpl = (createState)=>{
    let state;
    const listeners = /* @__PURE__ */ new Set();
    const setState = (partial, replace)=>{
        const nextState = typeof partial === "function" ? partial(state) : partial;
        if (!Object.is(nextState, state)) {
            const previousState = state;
            state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
            listeners.forEach((listener)=>listener(state, previousState));
        }
    };
    const getState = ()=>state;
    const getInitialState = ()=>initialState;
    const subscribe = (listener)=>{
        listeners.add(listener);
        return ()=>listeners.delete(listener);
    };
    const api = {
        setState,
        getState,
        getInitialState,
        subscribe
    };
    const initialState = state = createState(setState, getState, api);
    return api;
};
const createStore = (createState)=>createState ? createStoreImpl(createState) : createStoreImpl;
;
}),
"[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "create",
    ()=>create,
    "useStore",
    ()=>useStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/vanilla.mjs [app-client] (ecmascript)");
;
;
const identity = (arg)=>arg;
function useStore(api, selector = identity) {
    const slice = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useSyncExternalStore(api.subscribe, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useCallback({
        "useStore.useSyncExternalStore[slice]": ()=>selector(api.getState())
    }["useStore.useSyncExternalStore[slice]"], [
        api,
        selector
    ]), __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useCallback({
        "useStore.useSyncExternalStore[slice]": ()=>selector(api.getInitialState())
    }["useStore.useSyncExternalStore[slice]"], [
        api,
        selector
    ]));
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useDebugValue(slice);
    return slice;
}
const createImpl = (createState)=>{
    const api = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createStore"])(createState);
    const useBoundStore = (selector)=>useStore(api, selector);
    Object.assign(useBoundStore, api);
    return useBoundStore;
};
const create = (createState)=>createState ? createImpl(createState) : createImpl;
;
}),
"[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "combine",
    ()=>combine,
    "createJSONStorage",
    ()=>createJSONStorage,
    "devtools",
    ()=>devtools,
    "persist",
    ()=>persist,
    "redux",
    ()=>redux,
    "subscribeWithSelector",
    ()=>subscribeWithSelector,
    "unstable_ssrSafe",
    ()=>ssrSafe
]);
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("node_modules/zustand/esm/middleware.mjs")}`;
    }
};
const reduxImpl = (reducer, initial)=>(set, _get, api)=>{
        api.dispatch = (action)=>{
            set((state)=>reducer(state, action), false, action);
            return action;
        };
        api.dispatchFromDevtools = true;
        return {
            dispatch: (...args)=>api.dispatch(...args),
            ...initial
        };
    };
const redux = reduxImpl;
const trackedConnections = /* @__PURE__ */ new Map();
const getTrackedConnectionState = (name)=>{
    const api = trackedConnections.get(name);
    if (!api) return {};
    return Object.fromEntries(Object.entries(api.stores).map(([key, api2])=>[
            key,
            api2.getState()
        ]));
};
const extractConnectionInformation = (store, extensionConnector, options)=>{
    if (store === void 0) {
        return {
            type: "untracked",
            connection: extensionConnector.connect(options)
        };
    }
    const existingConnection = trackedConnections.get(options.name);
    if (existingConnection) {
        return {
            type: "tracked",
            store,
            ...existingConnection
        };
    }
    const newConnection = {
        connection: extensionConnector.connect(options),
        stores: {}
    };
    trackedConnections.set(options.name, newConnection);
    return {
        type: "tracked",
        store,
        ...newConnection
    };
};
const removeStoreFromTrackedConnections = (name, store)=>{
    if (store === void 0) return;
    const connectionInfo = trackedConnections.get(name);
    if (!connectionInfo) return;
    delete connectionInfo.stores[store];
    if (Object.keys(connectionInfo.stores).length === 0) {
        trackedConnections.delete(name);
    }
};
const findCallerName = (stack)=>{
    var _a, _b;
    if (!stack) return void 0;
    const traceLines = stack.split("\n");
    const apiSetStateLineIndex = traceLines.findIndex((traceLine)=>traceLine.includes("api.setState"));
    if (apiSetStateLineIndex < 0) return void 0;
    const callerLine = ((_a = traceLines[apiSetStateLineIndex + 1]) == null ? void 0 : _a.trim()) || "";
    return (_b = /.+ (.+) .+/.exec(callerLine)) == null ? void 0 : _b[1];
};
const devtoolsImpl = (fn, devtoolsOptions = {})=>(set, get, api)=>{
        const { enabled, anonymousActionType, store, ...options } = devtoolsOptions;
        let extensionConnector;
        try {
            extensionConnector = (enabled != null ? enabled : (__TURBOPACK__import$2e$meta__.env ? __TURBOPACK__import$2e$meta__.env.MODE : void 0) !== "production") && window.__REDUX_DEVTOOLS_EXTENSION__;
        } catch (e) {}
        if (!extensionConnector) {
            return fn(set, get, api);
        }
        const { connection, ...connectionInformation } = extractConnectionInformation(store, extensionConnector, options);
        let isRecording = true;
        api.setState = (state, replace, nameOrAction)=>{
            const r = set(state, replace);
            if (!isRecording) return r;
            const action = nameOrAction === void 0 ? {
                type: anonymousActionType || findCallerName(new Error().stack) || "anonymous"
            } : typeof nameOrAction === "string" ? {
                type: nameOrAction
            } : nameOrAction;
            if (store === void 0) {
                connection == null ? void 0 : connection.send(action, get());
                return r;
            }
            connection == null ? void 0 : connection.send({
                ...action,
                type: `${store}/${action.type}`
            }, {
                ...getTrackedConnectionState(options.name),
                [store]: api.getState()
            });
            return r;
        };
        api.devtools = {
            cleanup: ()=>{
                if (connection && typeof connection.unsubscribe === "function") {
                    connection.unsubscribe();
                }
                removeStoreFromTrackedConnections(options.name, store);
            }
        };
        const setStateFromDevtools = (...a)=>{
            const originalIsRecording = isRecording;
            isRecording = false;
            set(...a);
            isRecording = originalIsRecording;
        };
        const initialState = fn(api.setState, get, api);
        if (connectionInformation.type === "untracked") {
            connection == null ? void 0 : connection.init(initialState);
        } else {
            connectionInformation.stores[connectionInformation.store] = api;
            connection == null ? void 0 : connection.init(Object.fromEntries(Object.entries(connectionInformation.stores).map(([key, store2])=>[
                    key,
                    key === connectionInformation.store ? initialState : store2.getState()
                ])));
        }
        if (api.dispatchFromDevtools && typeof api.dispatch === "function") {
            let didWarnAboutReservedActionType = false;
            const originalDispatch = api.dispatch;
            api.dispatch = (...args)=>{
                if ((__TURBOPACK__import$2e$meta__.env ? __TURBOPACK__import$2e$meta__.env.MODE : void 0) !== "production" && args[0].type === "__setState" && !didWarnAboutReservedActionType) {
                    console.warn('[zustand devtools middleware] "__setState" action type is reserved to set state from the devtools. Avoid using it.');
                    didWarnAboutReservedActionType = true;
                }
                originalDispatch(...args);
            };
        }
        connection.subscribe((message)=>{
            var _a;
            switch(message.type){
                case "ACTION":
                    if (typeof message.payload !== "string") {
                        console.error("[zustand devtools middleware] Unsupported action format");
                        return;
                    }
                    return parseJsonThen(message.payload, (action)=>{
                        if (action.type === "__setState") {
                            if (store === void 0) {
                                setStateFromDevtools(action.state);
                                return;
                            }
                            if (Object.keys(action.state).length !== 1) {
                                console.error(`
                    [zustand devtools middleware] Unsupported __setState action format.
                    When using 'store' option in devtools(), the 'state' should have only one key, which is a value of 'store' that was passed in devtools(),
                    and value of this only key should be a state object. Example: { "type": "__setState", "state": { "abc123Store": { "foo": "bar" } } }
                    `);
                            }
                            const stateFromDevtools = action.state[store];
                            if (stateFromDevtools === void 0 || stateFromDevtools === null) {
                                return;
                            }
                            if (JSON.stringify(api.getState()) !== JSON.stringify(stateFromDevtools)) {
                                setStateFromDevtools(stateFromDevtools);
                            }
                            return;
                        }
                        if (!api.dispatchFromDevtools) return;
                        if (typeof api.dispatch !== "function") return;
                        api.dispatch(action);
                    });
                case "DISPATCH":
                    switch(message.payload.type){
                        case "RESET":
                            setStateFromDevtools(initialState);
                            if (store === void 0) {
                                return connection == null ? void 0 : connection.init(api.getState());
                            }
                            return connection == null ? void 0 : connection.init(getTrackedConnectionState(options.name));
                        case "COMMIT":
                            if (store === void 0) {
                                connection == null ? void 0 : connection.init(api.getState());
                                return;
                            }
                            return connection == null ? void 0 : connection.init(getTrackedConnectionState(options.name));
                        case "ROLLBACK":
                            return parseJsonThen(message.state, (state)=>{
                                if (store === void 0) {
                                    setStateFromDevtools(state);
                                    connection == null ? void 0 : connection.init(api.getState());
                                    return;
                                }
                                setStateFromDevtools(state[store]);
                                connection == null ? void 0 : connection.init(getTrackedConnectionState(options.name));
                            });
                        case "JUMP_TO_STATE":
                        case "JUMP_TO_ACTION":
                            return parseJsonThen(message.state, (state)=>{
                                if (store === void 0) {
                                    setStateFromDevtools(state);
                                    return;
                                }
                                if (JSON.stringify(api.getState()) !== JSON.stringify(state[store])) {
                                    setStateFromDevtools(state[store]);
                                }
                            });
                        case "IMPORT_STATE":
                            {
                                const { nextLiftedState } = message.payload;
                                const lastComputedState = (_a = nextLiftedState.computedStates.slice(-1)[0]) == null ? void 0 : _a.state;
                                if (!lastComputedState) return;
                                if (store === void 0) {
                                    setStateFromDevtools(lastComputedState);
                                } else {
                                    setStateFromDevtools(lastComputedState[store]);
                                }
                                connection == null ? void 0 : connection.send(null, // FIXME no-any
                                nextLiftedState);
                                return;
                            }
                        case "PAUSE_RECORDING":
                            return isRecording = !isRecording;
                    }
                    return;
            }
        });
        return initialState;
    };
const devtools = devtoolsImpl;
const parseJsonThen = (stringified, fn)=>{
    let parsed;
    try {
        parsed = JSON.parse(stringified);
    } catch (e) {
        console.error("[zustand devtools middleware] Could not parse the received json", e);
    }
    if (parsed !== void 0) fn(parsed);
};
const subscribeWithSelectorImpl = (fn)=>(set, get, api)=>{
        const origSubscribe = api.subscribe;
        api.subscribe = (selector, optListener, options)=>{
            let listener = selector;
            if (optListener) {
                const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
                let currentSlice = selector(api.getState());
                listener = (state)=>{
                    const nextSlice = selector(state);
                    if (!equalityFn(currentSlice, nextSlice)) {
                        const previousSlice = currentSlice;
                        optListener(currentSlice = nextSlice, previousSlice);
                    }
                };
                if (options == null ? void 0 : options.fireImmediately) {
                    optListener(currentSlice, currentSlice);
                }
            }
            return origSubscribe(listener);
        };
        const initialState = fn(set, get, api);
        return initialState;
    };
const subscribeWithSelector = subscribeWithSelectorImpl;
function combine(initialState, create) {
    return (...args)=>Object.assign({}, initialState, create(...args));
}
function createJSONStorage(getStorage, options) {
    let storage;
    try {
        storage = getStorage();
    } catch (e) {
        return;
    }
    const persistStorage = {
        getItem: (name)=>{
            var _a;
            const parse = (str2)=>{
                if (str2 === null) {
                    return null;
                }
                return JSON.parse(str2, options == null ? void 0 : options.reviver);
            };
            const str = (_a = storage.getItem(name)) != null ? _a : null;
            if (str instanceof Promise) {
                return str.then(parse);
            }
            return parse(str);
        },
        setItem: (name, newValue)=>storage.setItem(name, JSON.stringify(newValue, options == null ? void 0 : options.replacer)),
        removeItem: (name)=>storage.removeItem(name)
    };
    return persistStorage;
}
const toThenable = (fn)=>(input)=>{
        try {
            const result = fn(input);
            if (result instanceof Promise) {
                return result;
            }
            return {
                then (onFulfilled) {
                    return toThenable(onFulfilled)(result);
                },
                catch (_onRejected) {
                    return this;
                }
            };
        } catch (e) {
            return {
                then (_onFulfilled) {
                    return this;
                },
                catch (onRejected) {
                    return toThenable(onRejected)(e);
                }
            };
        }
    };
const persistImpl = (config, baseOptions)=>(set, get, api)=>{
        let options = {
            storage: createJSONStorage(()=>localStorage),
            partialize: (state)=>state,
            version: 0,
            merge: (persistedState, currentState)=>({
                    ...currentState,
                    ...persistedState
                }),
            ...baseOptions
        };
        let hasHydrated = false;
        let hydrationVersion = 0;
        const hydrationListeners = /* @__PURE__ */ new Set();
        const finishHydrationListeners = /* @__PURE__ */ new Set();
        let storage = options.storage;
        if (!storage) {
            return config((...args)=>{
                console.warn(`[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`);
                set(...args);
            }, get, api);
        }
        const setItem = ()=>{
            const state = options.partialize({
                ...get()
            });
            return storage.setItem(options.name, {
                state,
                version: options.version
            });
        };
        const savedSetState = api.setState;
        api.setState = (state, replace)=>{
            savedSetState(state, replace);
            return setItem();
        };
        const configResult = config((...args)=>{
            set(...args);
            return setItem();
        }, get, api);
        api.getInitialState = ()=>configResult;
        let stateFromStorage;
        const hydrate = ()=>{
            var _a, _b;
            if (!storage) return;
            const currentVersion = ++hydrationVersion;
            hasHydrated = false;
            hydrationListeners.forEach((cb)=>{
                var _a2;
                return cb((_a2 = get()) != null ? _a2 : configResult);
            });
            const postRehydrationCallback = ((_b = options.onRehydrateStorage) == null ? void 0 : _b.call(options, (_a = get()) != null ? _a : configResult)) || void 0;
            return toThenable(storage.getItem.bind(storage))(options.name).then((deserializedStorageValue)=>{
                if (deserializedStorageValue) {
                    if (typeof deserializedStorageValue.version === "number" && deserializedStorageValue.version !== options.version) {
                        if (options.migrate) {
                            const migration = options.migrate(deserializedStorageValue.state, deserializedStorageValue.version);
                            if (migration instanceof Promise) {
                                return migration.then((result)=>[
                                        true,
                                        result
                                    ]);
                            }
                            return [
                                true,
                                migration
                            ];
                        }
                        console.error(`State loaded from storage couldn't be migrated since no migrate function was provided`);
                    } else {
                        return [
                            false,
                            deserializedStorageValue.state
                        ];
                    }
                }
                return [
                    false,
                    void 0
                ];
            }).then((migrationResult)=>{
                var _a2;
                if (currentVersion !== hydrationVersion) {
                    return;
                }
                const [migrated, migratedState] = migrationResult;
                stateFromStorage = options.merge(migratedState, (_a2 = get()) != null ? _a2 : configResult);
                set(stateFromStorage, true);
                if (migrated) {
                    return setItem();
                }
            }).then(()=>{
                if (currentVersion !== hydrationVersion) {
                    return;
                }
                postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, void 0);
                stateFromStorage = get();
                hasHydrated = true;
                finishHydrationListeners.forEach((cb)=>cb(stateFromStorage));
            }).catch((e)=>{
                if (currentVersion !== hydrationVersion) {
                    return;
                }
                postRehydrationCallback == null ? void 0 : postRehydrationCallback(void 0, e);
            });
        };
        api.persist = {
            setOptions: (newOptions)=>{
                options = {
                    ...options,
                    ...newOptions
                };
                if (newOptions.storage) {
                    storage = newOptions.storage;
                }
            },
            clearStorage: ()=>{
                storage == null ? void 0 : storage.removeItem(options.name);
            },
            getOptions: ()=>options,
            rehydrate: ()=>hydrate(),
            hasHydrated: ()=>hasHydrated,
            onHydrate: (cb)=>{
                hydrationListeners.add(cb);
                return ()=>{
                    hydrationListeners.delete(cb);
                };
            },
            onFinishHydration: (cb)=>{
                finishHydrationListeners.add(cb);
                return ()=>{
                    finishHydrationListeners.delete(cb);
                };
            }
        };
        if (!options.skipHydration) {
            hydrate();
        }
        return stateFromStorage || configResult;
    };
const persist = persistImpl;
function ssrSafe(config, isSSR = typeof window === "undefined") {
    return (set, get, api)=>{
        if (!isSSR) {
            return config(set, get, api);
        }
        const ssrSet = ()=>{
            throw new Error("Cannot set state of Zustand store in SSR");
        };
        api.setState = ssrSet;
        return config(ssrSet, get, api);
    };
}
;
}),
]);

//# sourceMappingURL=_20f2869d._.js.map