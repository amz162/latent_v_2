// Task 130: shared investify.pk scraping library.
// Extracted from src/app/api/scrape/{news,announcements}/route.ts so the
// 5 PM PKT harvest scheduler (scripts/task130_news_persist.ts) and the HTTP
// routes parse identically. Pure functions — no DB writes here.

export interface ScrapedNewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  category: "national" | "international" | "market" | "company";
  image?: string;
}

export interface ScrapedAnnouncement {
  company: string;
  symbol: string;
  title: string;
  type: "news" | "result" | "dividend" | "agm" | "other";
  pdfLink: string | null;
  link: string;
  publishedAt: string | null;
  summary: string;
}

const UA =
  "Mozilla/5.0 (compatible; LatentBot/1.0; +https://latent.pk)";

function classifyNews(title: string, summary: string): ScrapedNewsItem["category"] {
  const text = (title + " " + summary).toLowerCase();
  if (/pakistan|karachi|lahore|islamabad|imran|shehbaz|pml|pti|ppp|sbp|secp|imd|imf/.test(text)) {
    return "national";
  }
  if (/us |america|europe|china|india|oil|brent|crude|fed|ecb|fed rate|global|international|foreign/.test(text)) {
    return "international";
  }
  if (/eps|dividend|quarter|result|profit|revenue|earning|agm|bonus|right|stock split/.test(text)) {
    return "company";
  }
  return "market";
}

function extractCompany(title: string): string {
  const match = title.match(/^([A-Z][A-Z&\s]+?)(?:\s+(?:announced|posted|declared|reported|filed|notified)|[:\-\s])/);
  if (match) return match[1].trim();
  return title.split(" ").slice(0, 3).join(" ");
}

function extractSymbol(title: string): string {
  const m = title.match(/\b([A-Z]{2,5})\b/);
  return m ? m[1] : "";
}

function classifyAnnouncement(title: string): ScrapedAnnouncement["type"] {
  const t = title.toLowerCase();
  if (/result|quarter|q1|q2|q3|q4|half year|annual report|eps|earning|profit|loss|income statement|balance sheet/.test(t)) {
    return "result";
  }
  if (/dividend|interim|final dividend|cash dividend|bonus|right issue/.test(t)) {
    return "dividend";
  }
  if (/agm|annual general|extraordinary general|egm|book closure/.test(t)) {
    return "agm";
  }
  return "news";
}

/** Scrape https://www.investify.pk/news — returns up to 30 deduped items. */
export async function scrapeInvestifyNews(): Promise<ScrapedNewsItem[]> {
  const res = await fetch("https://www.investify.pk/news", {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`investify.pk/news HTTP ${res.status}`);
  const html = await res.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  const news: ScrapedNewsItem[] = [];
  $("article, .news-card, .news-item, .post-card, [data-news-item]").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h2, h3, h4, .title, .news-title").first().text().trim();
    const link = $el.find("a").first().attr("href") || "";
    const summary = $el.find("p, .summary, .excerpt, .description").first().text().trim();
    const img = $el.find("img").first().attr("src") || undefined;
    const time = $el.find("time, .date, .published, .timestamp").first().text().trim();
    if (title && link) {
      news.push({
        title,
        link: link.startsWith("http") ? link : `https://www.investify.pk${link}`,
        source: "investify",
        publishedAt: time || null,
        summary: summary.slice(0, 280),
        category: classifyNews(title, summary),
        image: img,
      });
    }
  });

  if (news.length === 0) {
    $("a").each((_, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      const link = $a.attr("href") || "";
      if (title.length > 30 && title.length < 200 && link.includes("/news/")) {
        news.push({
          title,
          link: link.startsWith("http") ? link : `https://www.investify.pk${link}`,
          source: "investify",
          publishedAt: null,
          summary: "",
          category: classifyNews(title, ""),
        });
      }
    });
  }

  const seen = new Set<string>();
  return news.filter((n) => {
    if (seen.has(n.link)) return false;
    seen.add(n.link);
    return true;
  }).slice(0, 30);
}

/** Scrape https://www.investify.pk/announcements — returns up to 50 deduped items. */
export async function scrapeInvestifyAnnouncements(): Promise<ScrapedAnnouncement[]> {
  const res = await fetch("https://www.investify.pk/announcements", {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`investify.pk/announcements HTTP ${res.status}`);
  const html = await res.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  const announcements: ScrapedAnnouncement[] = [];
  $("article, .announcement, .announcement-card, .news-card, tr").each((_, el) => {
    const $el = $(el);
    const title = $el.find("h2, h3, h4, .title, .announcement-title, td.title").first().text().trim();
    const link = $el.find("a").first().attr("href") || "";
    const pdfLink = $el.find('a[href$=".pdf"]').attr("href") || null;
    const time = $el.find("time, .date, .published, .timestamp").first().text().trim();
    const summary = $el.find("p, .summary, .excerpt").first().text().trim();
    if (!title) return;
    const company = extractCompany(title);
    const symbol = extractSymbol(title) || company;
    announcements.push({
      company,
      symbol,
      title,
      type: classifyAnnouncement(title),
      pdfLink: pdfLink ? (pdfLink.startsWith("http") ? pdfLink : `https://www.investify.pk${pdfLink}`) : null,
      link: link.startsWith("http") ? link : `https://www.investify.pk${link}`,
      publishedAt: time || null,
      summary: summary.slice(0, 280),
    });
  });

  if (announcements.length === 0) {
    $("a").each((_, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      const link = $a.attr("href") || "";
      if (title.length > 20 && title.length < 300 && (link.includes("/announcement") || link.includes("/result") || link.includes("/news"))) {
        announcements.push({
          company: extractCompany(title),
          symbol: extractSymbol(title) || extractCompany(title),
          title,
          type: classifyAnnouncement(title),
          pdfLink: null,
          link: link.startsWith("http") ? link : `https://www.investify.pk${link}`,
          publishedAt: null,
          summary: "",
        });
      }
    });
  }

  const seen = new Set<string>();
  return announcements.filter((a) => {
    const k = a.link + "|" + a.title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 50);
}
