// Task 130: news + announcements harvest → DB (stage: news_scrape).
// Runs at 17:00 PKT inside scripts/task129_eod_scheduler.py after market-data
// persistence. Sources:
//   1. investify.pk news + announcements  (the app's own scraper, shared lib)
//   2. askanalyst news/{sym} + filings/{sym} for the pilot25 shadow universe
// Upserts are idempotent by URL (NewsArticle.url / CompanyAnnouncement.url).
// Honest behavior: a source that fails is recorded in the summary, never
// fabricated; per-symbol askanalyst failures are skipped and counted.

import { PrismaClient } from "@prisma/client";
import {
  scrapeInvestifyNews,
  scrapeInvestifyAnnouncements,
} from "../src/lib/latent/scrape/investify";

const PILOT25 = [
  "ANL", "BOP", "BYCO", "CNERGY", "ENGRO", "FCCL", "HASCOL", "HUBC", "HUMNL", "KEL",
  "LOTCHEM", "LUCK", "MEBL", "MLCF", "OGDC", "PAEL", "PIBTL", "PPL", "PRL", "PSO",
  "SYS", "TELE", "TRG", "UNITY", "WTL",
];

const ASKAANALYST = "https://api.askanalyst.com.pk/api";
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) latent-research-sandbox" };
const RATE_DELAY_MS = 350;

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

async function fetchJson(url: string): Promise<{ ok: boolean; data?: unknown; status?: number }> {
  try {
    const res = await fetch(url, { headers: UA, cache: "no-store" });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  }
}

async function main() {
  const db = new PrismaClient();
  const runKey = process.env.HARVEST_RUN_KEY ?? "eod_harvest:manual";
  const started = new Date();
  const summary: Record<string, unknown> = { runKey, startedAt: started.toISOString() };

  try {
    // ── 1. investify.pk news (market-wide) ──────────────────────────────
    let investifyNews = 0;
    try {
      const items = await scrapeInvestifyNews();
      for (const n of items) {
        await db.newsArticle.upsert({
          where: { url: n.link },
          create: {
            symbol: null,
            source: "investify",
            category: n.category,
            title: n.title.slice(0, 500),
            url: n.link,
            summary: n.summary || null,
            publishedAt: parseDate(n.publishedAt),
            publishedRaw: n.publishedAt || null,
            runKey,
          },
          update: { summary: n.summary || null, fetchedAt: new Date(), runKey },
        });
        investifyNews++;
      }
      summary.investify_news = investifyNews;
    } catch (e) {
      summary.investify_news_error = e instanceof Error ? e.message : String(e);
    }

    // ── 2. investify.pk announcements (results/dividends/AGM filings) ───
    let investifyAnn = 0;
    try {
      const items = await scrapeInvestifyAnnouncements();
      for (const a of items) {
        await db.companyAnnouncement.upsert({
          where: { url: a.link },
          create: {
            symbol: a.symbol || null,
            company: a.company || null,
            source: "investify",
            kind: a.type,
            title: a.title.slice(0, 500),
            url: a.link,
            pdfUrl: a.pdfLink,
            publishedAt: parseDate(a.publishedAt),
            publishedRaw: a.publishedAt || null,
            runKey,
          },
          update: { summary: a.summary || null, fetchedAt: new Date(), runKey },
        });
        investifyAnn++;
      }
      summary.investify_announcements = investifyAnn;
    } catch (e) {
      summary.investify_announcements_error = e instanceof Error ? e.message : String(e);
    }

    // ── 3. askanalyst per-symbol news + filings (pilot25) ───────────────
    // API wraps payloads as {data: [...]}; news items have no URL → synthetic
    // key askanalyst:news:{sym}:{id}; filings carry description + pdf link.
    let aaNews = 0, aaNewsFail = 0, aaFilings = 0, aaFilingsFail = 0;
    for (const sym of PILOT25) {
      const news = await fetchJson(`${ASKAANALYST}/news/${sym}`);
      const newsArr = Array.isArray(news.data) ? news.data
        : Array.isArray((news.data as Record<string, unknown>)?.data)
          ? (news.data as Record<string, unknown>).data as Record<string, unknown>[]
          : null;
      if (newsArr) {
        for (const item of newsArr) {
          const title = String(item.title ?? "").trim();
          if (!title) continue;
          const link = String(item.url ?? item.link ?? "").trim()
            || `askanalyst:news:${sym}:${item.id ?? title.slice(0, 80)}`;
          const pub = item.date ?? item.publishedAt ?? item.publish_date ?? null;
          await db.newsArticle.upsert({
            where: { url: link },
            create: {
              symbol: sym,
              source: "askanalyst",
              category: "company",
              title: title.slice(0, 500),
              url: link,
              summary: String(item.description ?? item.summary ?? "").slice(0, 500) || null,
              publishedAt: parseDate(pub ? String(pub) : null),
              publishedRaw: pub ? String(pub) : null,
              runKey,
            },
            update: { fetchedAt: new Date(), runKey },
          });
          aaNews++;
        }
      } else aaNewsFail++;
      await new Promise((r) => setTimeout(r, RATE_DELAY_MS));

      const filings = await fetchJson(`${ASKAANALYST}/filings/${sym}`);
      const filArr = Array.isArray(filings.data) ? filings.data
        : Array.isArray((filings.data as Record<string, unknown>)?.data)
          ? (filings.data as Record<string, unknown>).data as Record<string, unknown>[]
          : null;
      if (filArr) {
        for (const f of filArr) {
          const desc = String(f.description ?? f.title ?? f.subject ?? "").trim();
          if (!desc) continue;
          const title = desc.split("|")[0].trim().slice(0, 500) || desc.slice(0, 500);
          const pdf = String(f.pdf ?? f.url ?? f.link ?? "").trim();
          const urlKey = pdf || `askanalyst:filings:${sym}:${f.date ?? ""}:${aaFilings}`;
          const pub = f.date ?? f.publish_date ?? null;
          await db.companyAnnouncement.upsert({
            where: { url: urlKey },
            create: {
              symbol: String(f.company_symbol ?? sym),
              company: String(f.company_name ?? sym),
              source: "askanalyst",
              kind: /result|quarter|annual|eps/i.test(title) ? "result" : "other",
              title,
              url: urlKey,
              pdfUrl: pdf.startsWith("http") ? pdf : null,
              publishedAt: parseDate(pub ? String(pub) : null),
              publishedRaw: pub ? String(pub) : null,
              runKey,
            },
            update: { fetchedAt: new Date(), runKey },
          });
          aaFilings++;
        }
      } else aaFilingsFail++;
      await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
    }
    summary.askanalyst_news = aaNews;
    summary.askanalyst_news_symbol_failures = aaNewsFail;
    summary.askanalyst_filings = aaFilings;
    summary.askanalyst_filings_symbol_failures = aaFilingsFail;

    summary.finishedAt = new Date().toISOString();
    summary.ok = true;
    console.log(JSON.stringify(summary));
    await db.$disconnect();
    process.exit(0);
  } catch (e) {
    summary.ok = false;
    summary.error = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify(summary));
    await db.$disconnect();
    process.exit(1);
  }
}

main();
