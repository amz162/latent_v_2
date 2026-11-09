import { NextResponse } from "next/server";
import { getSignalById } from "@/lib/latent/mock-signals";
import { guardUser } from "@/lib/latent/access-control";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const __g = await guardUser(_req, "tab.signals_v2");
  if (__g) return __g;
  const { id } = await params;
  const signal = getSignalById(id);
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }
  return NextResponse.json({ signal });
}
