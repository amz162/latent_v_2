import { NextResponse } from "next/server";
import { guardUser } from "@/lib/latent/access-control";
import { scrapeInvestifyAnnouncements } from "@/lib/latent/scrape/investify";

// Investify.pk announcements scraper (company news + company results).
// Harvested and persisted into CompanyAnnouncement by the 5 PM PKT scheduler
// (scripts/task130_news_persist.ts, stage news_scrape). This endpoint remains
// for manual/on-demand use and delegates parsing to the shared library in
// src/lib/latent/scrape/investify.ts.

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(req: Request) {
  const __g = await guardUser(req, "feature.market_data");
  if (__g) return __g;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("type"); // "news" | "result" | null = all
  try {
    const announcements = await scrapeInvestifyAnnouncements();
    const filtered = filter ? announcements.filter((a) => a.type === filter) : announcements;
    return NextResponse.json({
      announcements: filtered,
      scrapedAt: new Date().toISOString(),
      source: "https://www.investify.pk/announcements",
      schedule: "persisted daily 17:00 PKT by the EOD harvest scheduler",
      total: filtered.length,
    });
  } catch (err) {
    console.error("[/api/scrape/announcements] error:", err);
    return NextResponse.json(
      { error: "Scraper failed", detail: err instanceof Error ? err.message : "Unknown" },
      { status: 502 }
    );
  }
}
