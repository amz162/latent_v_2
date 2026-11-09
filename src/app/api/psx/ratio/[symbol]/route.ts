import { NextResponse } from "next/server";
import { guardUser } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const __g = await guardUser(_req, "feature.market_data");
  if (__g) return __g;
  const { symbol } = await params;
  try {
    const res = await fetch(`https://api.askanalyst.com.pk/api/rationew/${encodeURIComponent(symbol)}`, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: `Upstream error: ${res.status}` }, { status: res.status });
    const data = await res.json();
    return NextResponse.json({ ratios: data });
  } catch (err) {
    console.error(`[/api/psx/ratio/${symbol}] error:`, err);
    return NextResponse.json({ error: "Failed to fetch ratios" }, { status: 502 });
  }
}
