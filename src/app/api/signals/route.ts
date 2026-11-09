import { NextResponse } from "next/server";
import { MOCK_SIGNALS, getSignalById } from "@/lib/latent/mock-signals";
import { guardUser } from "@/lib/latent/access-control";

export async function GET(req: Request) {
  const __g = await guardUser(req, "tab.signals_v2");
  if (__g) return __g;
  return NextResponse.json({ signals: MOCK_SIGNALS });
}
