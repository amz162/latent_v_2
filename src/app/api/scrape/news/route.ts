import { NextResponse } from "next/server";
import { guardUser } from "@/lib/latent/access-control";
import { scrapeInvestifyNews } from "@/lib/latent/scrape/investify";

// Investify.pk news scraper
// Schedule: harvested and persisted into NewsArticle by the 5 PM PKT
// scheduler (scripts/task130_news_persist.ts, stage news_scrape). This
// endpoint remains for manual/on-demand use and delegates parsing to the
// shared library in src/lib/latent/scrape/investify.ts.

export const dynamic = "force-dynamic";
export const revalidate = 300; // cache for 5 min

export async function GET(req: Request) {
  const __g = await guardUser(req, "feature.market_data");
  if (__g) return __g;
  try {
    const news = await scrapeInvestifyNews();
    return NextResponse.json({
      news,
      scrapedAt: new Date().toISOString(),
      source: "https://www.investify.pk/news",
      schedule: "persisted daily 17:00 PKT by the EOD harvest scheduler",
      count: news.length,
    });
  } catch (err) {
    console.error("[/api/scrape/news] error:", err);
    return NextResponse.json(
      { error: "Scraper failed", detail: err instanceof Error ? err.message : "Unknown" },
      { status: 502 }
    );
  }
}
