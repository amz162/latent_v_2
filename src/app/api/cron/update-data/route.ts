// Task 121 security fix — this route previously interpolated ?symbol= into an
// execSync shell command (unauthenticated command injection) and had NO auth.
// Now: admin-session OR internal-token authorization, shell-free execFile with
// a strict symbol allowlist, and unchanged response shape.
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdminOrInternal, audit } from "@/lib/latent/access-control";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const execFileAsync = promisify(execFile);

// PSX tickers: letters, digits, dots/hyphens only — never passed to a shell.
const SYMBOL_RE = /^[A-Za-z0-9.\-]{1,15}$/;

export async function GET(req: Request) {
  if (!(await requireAdminOrInternal(req as never))) {
    await audit({
      actorType: "system", actorId: "anonymous", action: "ops.access_denied",
      result: "denied", failureReason: "cron.update-data", route: "/api/cron/update-data",
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "daily";
  const symbolRaw = url.searchParams.get("symbol") || "";

  if (mode === "live") {
    if (!SYMBOL_RE.test(symbolRaw)) {
      return NextResponse.json({ error: "Symbol required for live mode" }, { status: 400 });
    }
    try {
      const price = await fetchLivePrice(symbolRaw);
      return NextResponse.json({ symbol: symbolRaw, ...price, mode: "live", timestamp: new Date().toISOString() });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "upstream error" }, { status: 502 });
    }
  }

  // Daily mode: run the update script — shell-free, argument-array exec.
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "update_daily_ohlcv.py");
    const args = symbolRaw ? ["--symbol", symbolRaw] : [];
    if (symbolRaw && !SYMBOL_RE.test(symbolRaw)) {
      return NextResponse.json({ mode: "daily", status: "error", error: "invalid symbol" }, { status: 400 });
    }
    const { stdout } = await execFileAsync("python3", [scriptPath, ...args], {
      timeout: 240_000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf-8",
      shell: false,
    });
    const ohlcvDir = path.join(process.cwd(), "data", "ohlcv_all");
    let totalStocks = 0;
    try { const files = await fs.readdir(ohlcvDir); totalStocks = files.filter((f) => f.endsWith(".csv")).length; } catch {}
    return NextResponse.json({ mode: "daily", status: "success", timestamp: new Date().toISOString(), totalStocks, output: stdout.slice(-500) });
  } catch (e: unknown) {
    return NextResponse.json({ mode: "daily", status: "error", error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

async function fetchLivePrice(symbol: string) {
  const url = `https://api.askanalyst.com.pk/api/technicalchart/day/0/${Date.now()}/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: { "User-Agent": "LatentBot/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("No data");
  const lastLine = lines[lines.length - 1].split(",");
  const header = lines[0].split(",");
  const gi = (n: string) => header.findIndex((h) => h.trim() === n);
  const gv = (n: string) => { const i = gi(n); return i >= 0 ? parseFloat(lastLine[i]) || 0 : 0; };
  const close = gv("close"), open = gv("open"), high = gv("high"), low = gv("low"), volume = gv("volume");
  const dateMs = gi("date") >= 0 ? parseInt(lastLine[gi("date")]) : 0;
  return { close, open, high, low, volume, date: dateMs, dateStr: dateMs ? new Date(dateMs).toISOString().split("T")[0] : "", change: close && open ? ((close - open) / open * 100).toFixed(2) : "0", changePct: close && open ? (close - open) / open * 100 : 0 };
}
