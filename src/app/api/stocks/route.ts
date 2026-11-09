import { NextResponse } from "next/server";
import { MOCK_STOCKS, MOCK_BROKERS } from "@/lib/latent/mock-stocks";
import { guardUser } from "@/lib/latent/access-control";

export async function GET(req: Request) {
  const __g = await guardUser(req, "feature.market_data");
  if (__g) return __g;
  return NextResponse.json({ stocks: MOCK_STOCKS, brokers: MOCK_BROKERS });
}
