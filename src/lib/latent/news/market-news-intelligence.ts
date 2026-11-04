// ============================================================================
// Task 111 / Phase 6 — Market news intelligence (company / national /
// international). Evidence-only pipeline: news text is UNTRUSTED INPUT and is
// never treated as instructions. Deterministic classification first; LLM is
// optional and may only annotate.
//
// Sources: only legitimate, already-integrated endpoints
//   - api.askanalyst.com.pk /api/news/{symbol}   (company news, existing integration)
//   - z-ai-web-dev-sdk functions.web_search      (national/international snapshot, retrieval-only)
// No paywall bypass, no scraping of restricted sites, no fabricated articles.
// Everything is cached to disk (rate-limit respect + resumability).
// ============================================================================
import { promises as fs } from "fs";
import path from "path";

export interface NewsSourceRecord {
  sourceId: string;
  publisher: string;
  domain: string;
  country: string;
  category: "company" | "national" | "international";
  reliability: "primary_regulatory" | "established_media" | "aggregator" | "unverified";
  retrievalMethod: string;
  licensing: string;
  lastSuccessfulRetrieval: string | null;
}

export interface NewsItem {
  recordId: string;
  sourceId: string;
  headline: string;
  publisher: string;
  url: string | null;
  publishedAt: string | null; // null => publication time not verified
  retrievedAt: string;
  eventDatetime: string | null;
  language: string;
  country: string;
  companies: string[];
  symbols: string[];
  sectors: string[];
  eventCategory: string;
  summary: string; // truncated sanitized excerpt ONLY
  sentiment: "bullish" | "bearish" | "neutral" | "mixed" | "uncertain";
  materiality: "high" | "medium" | "low";
  horizon: "short_term" | "long_term" | "unknown";
  reliability: NewsSourceRecord["reliability"];
  corroboratingSources: string[]; // distinct publishers only
  conflictingCoverage: string[];
  dataQualityState: "verified" | "partially_verified" | "unverified";
  injectionFlagged: boolean;
}

export const NEWS_SOURCE_REGISTRY: NewsSourceRecord[] = [
  {
    sourceId: "askanalyst_company_news",
    publisher: "AskAnalyst",
    domain: "api.askanalyst.com.pk",
    country: "PK",
    category: "company",
    reliability: "aggregator",
    retrievalMethod: "GET /api/news/{symbol} (existing integration, cached 12h)",
    licensing: "public API already integrated by the platform; research use",
    lastSuccessfulRetrieval: null,
  },
  {
    sourceId: "zai_web_search_national",
    publisher: "web search (via authorized z-ai SDK)",
    domain: "various",
    country: "PK",
    category: "national",
    reliability: "unverified",
    retrievalMethod: "functions.web_search query snapshot (cached 12h)",
    licensing: "search-result snippets for research reference only; no paywall bypass",
    lastSuccessfulRetrieval: null,
  },
  {
    sourceId: "zai_web_search_international",
    publisher: "web search (via authorized z-ai SDK)",
    domain: "various",
    country: "INT",
    category: "international",
    reliability: "unverified",
    retrievalMethod: "functions.web_search query snapshot (cached 12h)",
    licensing: "search-result snippets for research reference only; no paywall bypass",
    lastSuccessfulRetrieval: null,
  },
];

const CACHE_DIR = path.join(process.cwd(), "data", "cache", "task111", "news");
const CACHE_TTL_MS = 12 * 3600 * 1000;

async function readCache(key: string): Promise<{ at: string; data: unknown } | null> {
  try {
    const p = path.join(CACHE_DIR, key + ".json");
    const raw = JSON.parse(await fs.readFile(p, "utf8"));
    if (Date.parse(raw.at) + CACHE_TTL_MS < Date.now()) return null;
    return raw;
  } catch {
    return null;
  }
}

async function writeCache(key: string, data: unknown): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, key + ".json"), JSON.stringify({ at: new Date().toISOString(), data }), "utf8");
  } catch {
    /* cache is best-effort */
  }
}

/** Sanitize untrusted article text: strip HTML/tags/control chars, cap length. */
export function sanitizeNewsText(input: string, maxLen = 600): string {
  return String(input ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Prompt-injection detector: flags instruction-like payloads in UNTRUSTED text. */
const INJECTION_PATTERNS = [
  /ignore (all|any|previous) instructions/i,
  /disregard (your|the) (rules|system)/i,
  /you are now/i,
  /(reveal|print|show) (your )?(system|hidden) (prompt|instructions)/i,
  /(send|give|expose).{0,30}(api ?key|token|credential|password)/i,
  /execute (this|the following) (command|code)/i,
  /<\/script/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

// Deterministic lexicon (conservative, research-grade; never a return forecast)
const BULL_LEX = ["profit", "surge", "record", "growth", "approval", "contract win", "dividend", "bonus", "expansion", "recovery", "upgrade", "beats", "signs mo", "acquisition", "partnership", "rally"];
const BEAR_LEX = ["loss", "decline", "default", "fraud", "probe", "downgrade", "sued", "litigation", "circular debt", "delay", "suspension", "resign", "crash", "plunge", "layoff", "penalty", "strike"];
const HIGH_MATERIAL = ["merger", "acquisition", "default", "fraud", "rights issue", "bonus issue", "dividend", "financial result", "earnings", "contract", "tender", "regulatory", "state bank", "policy rate", "imf", "budget"];

function classifyDeterministic(text: string): { sentiment: NewsItem["sentiment"]; materiality: NewsItem["materiality"]; horizon: NewsItem["horizon"] } {
  const t = text.toLowerCase();
  const bull = BULL_LEX.filter((w) => t.includes(w)).length;
  const bear = BEAR_LEX.filter((w) => t.includes(w)).length;
  const sentiment: NewsItem["sentiment"] = bull > 0 && bear > 0 ? "mixed" : bull > 0 ? "bullish" : bear > 0 ? "bearish" : "neutral";
  const materiality: NewsItem["materiality"] = HIGH_MATERIAL.some((w) => t.includes(w)) ? "high" : "medium";
  const horizon: NewsItem["horizon"] = HIGH_MATERIAL.some((w) => t.includes(w)) ? "short_term" : "unknown";
  return { sentiment, materiality, horizon };
}

export interface NewsFetchResult {
  items: NewsItem[];
  sourceStatus: Record<string, { status: "ok" | "failed" | "cached"; error?: string; lastSuccessfulRetrieval: string | null }>;
}

/** Company news for one symbol via the existing askanalyst integration. */
export async function fetchCompanyNews(symbol: string): Promise<{ items: NewsItem[]; status: NewsFetchResult["sourceStatus"][string] }> {
  const key = `company_${symbol}`;
  const cached = await readCache(key);
  if (cached) {
    return { items: cached.data as NewsItem[], status: { status: "cached", lastSuccessfulRetrieval: cached.at } };
  }
  const retrievedAt = new Date().toISOString();
  try {
    const res = await fetch(`https://api.askanalyst.com.pk/api/news/${encodeURIComponent(symbol)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const rows = Array.isArray(body.data) ? body.data.slice(0, 8) : [];
    const items: NewsItem[] = rows.map((r, i) => {
      const title = sanitizeNewsText(String(r.title ?? ""), 240);
      const desc = sanitizeNewsText(String(r.description ?? ""), 500);
      const inj = detectInjection(title + " " + desc);
      const cls = classifyDeterministic(title + " " + desc);
      return {
        recordId: `askanalyst:${symbol}:${r.id ?? i}`,
        sourceId: "askanalyst_company_news",
        headline: title,
        publisher: "AskAnalyst",
        url: null,
        publishedAt: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null,
        retrievedAt,
        eventDatetime: null,
        language: "en",
        country: "PK",
        companies: [symbol],
        symbols: [symbol],
        sectors: [sanitizeNewsText(String(r.sector ?? ""), 60)],
        eventCategory: sanitizeNewsText(String(r.classification ?? "News"), 40),
        summary: desc,
        sentiment: cls.sentiment,
        materiality: cls.materiality,
        horizon: cls.horizon,
        reliability: "aggregator",
        corroboratingSources: [],
        conflictingCoverage: [],
        dataQualityState: inj ? "unverified" : "partially_verified",
        injectionFlagged: inj,
      };
    });
    await writeCache(key, items);
    return { items, status: { status: "ok", lastSuccessfulRetrieval: retrievedAt } };
  } catch (e) {
    return { items: [], status: { status: "failed", error: String((e as Error).message ?? e), lastSuccessfulRetrieval: null } };
  }
}

/** Market-wide national/international snapshot via the authorized web search. */
export async function fetchMarketNews(category: "national" | "international"): Promise<{ items: NewsItem[]; status: NewsFetchResult["sourceStatus"][string] }> {
  const key = `market_${category}`;
  const cached = await readCache(key);
  if (cached) {
    return { items: cached.data as NewsItem[], status: { status: "cached", lastSuccessfulRetrieval: cached.at } };
  }
  const retrievedAt = new Date().toISOString();
  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const query =
      category === "national"
        ? "Pakistan State Bank policy rate inflation IMF PSX stock market news this week"
        : "global oil prices Federal Reserve interest rates emerging markets currency news this week Pakistan impact";
    const result = (await zai.functions.invoke("web_search", { query, num: 8 })) as Array<{ name?: string; url?: string; snippet?: string; host_name?: string; date?: string }>;
    const rows = Array.isArray(result) ? result.slice(0, 8) : [];
    const items: NewsItem[] = rows.map((r, i) => {
      const title = sanitizeNewsText(String(r.name ?? ""), 240);
      const snip = sanitizeNewsText(String(r.snippet ?? ""), 500);
      const inj = detectInjection(title + " " + snip);
      const cls = classifyDeterministic(title + " " + snip);
      return {
        recordId: `websearch:${category}:${i}:${r.url ?? ""}`.slice(0, 120),
        sourceId: category === "national" ? "zai_web_search_national" : "zai_web_search_international",
        headline: title,
        publisher: sanitizeNewsText(String(r.host_name ?? "unknown"), 80),
        url: typeof r.url === "string" ? r.url : null,
        publishedAt: typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.date) ? r.date.slice(0, 10) : null,
        retrievedAt,
        eventDatetime: null,
        language: "en",
        country: category === "national" ? "PK" : "INT",
        companies: [],
        symbols: [],
        sectors: [],
        eventCategory: category === "national" ? "national_macro" : "international_macro",
        summary: snip,
        sentiment: cls.sentiment,
        materiality: cls.materiality,
        horizon: cls.horizon,
        reliability: "unverified",
        corroboratingSources: [],
        conflictingCoverage: [],
        dataQualityState: inj ? "unverified" : "partially_verified",
        injectionFlagged: inj,
      };
    });
    await writeCache(key, items);
    return { items, status: { status: "ok", lastSuccessfulRetrieval: retrievedAt } };
  } catch (e) {
    return { items: [], status: { status: "failed", error: String((e as Error).message ?? e), lastSuccessfulRetrieval: null } };
  }
}

/** Aggregate market news view for the evidence package (deterministic). */
export function newsMarketView(items: NewsItem[], category: "national" | "international"): { status: "verified" | "partially_verified" | "unavailable"; view: "bullish" | "bearish" | "neutral" | "mixed" | "unavailable"; highMateriality: number; flagged: number } {
  if (!items.length) return { status: "unavailable", view: "unavailable", highMateriality: 0, flagged: 0 };
  const bull = items.filter((i) => i.sentiment === "bullish").length;
  const bear = items.filter((i) => i.sentiment === "bearish").length;
  const view = bull > 0 && bear > 0 ? "mixed" : bull > bear ? "bullish" : bear > bull ? "bearish" : "neutral";
  return {
    status: "partially_verified",
    view,
    highMateriality: items.filter((i) => i.materiality === "high").length,
    flagged: items.filter((i) => i.injectionFlagged).length,
  };
}
