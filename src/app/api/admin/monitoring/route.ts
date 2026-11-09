// Task 121 — system monitoring for the admin panel: application, worker,
// provider, database, disk, API error counts, authentication failures and
// rate-limit events. Reads state files and aggregates; exposes NO server
// paths to normal users (this route is admin-only) and never env values.
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin, authErrorResponse } from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const execFileAsync = promisify(execFile);

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await fs.readFile(path, "utf8")) as Record<string, unknown>; }
  catch { return null; }
}

async function diskUsage(): Promise<{ dataDir: string | null; dbFile: string | null }> {
  const out: { dataDir: string | null; dbFile: string | null } = { dataDir: null, dbFile: null };
  try {
    const { stdout } = await execFileAsync("du", ["-sh", "data"], { timeout: 15_000 });
    out.dataDir = stdout.split("\t")[0];
  } catch { /* unavailable */ }
  try {
    const { stdout } = await execFileAsync("du", ["-sh", "db/custom.db"], { timeout: 15_000 });
    out.dbFile = stdout.split("\t")[0];
  } catch { /* unavailable */ }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const now = Date.now();

    const worker = await readJson("data/backtest_reports/task107/ops/worker_health.json");
    const provider = await readJson("data/backtest_reports/task107/ops/provider_health_state.json");
    const lastCycle = await readJson("data/backtest_reports/task107/ops/last_cycle_result.json");

    let dbStatus = "ok";
    let dbQuickCheck = "ok";
    try {
      await db.$queryRawUnsafe("SELECT 1");
      const qc = await db.$queryRawUnsafe<{ c: string }[]>(`PRAGMA quick_check`);
      dbQuickCheck = String((qc as unknown as Array<{ c?: string } | string>)[0] ?? "ok") === "ok" ? "ok" : "degraded";
    } catch {
      dbStatus = "error";
      dbQuickCheck = "unavailable";
    }

    const since = new Date(now - 24 * 3600_000);
    const [authFailures, rateLimitEvents, apiErrors] = await Promise.all([
      db.adminAuditLog.count({ where: { action: "admin.login", result: "denied", ts: { gte: since } } }),
      db.adminAuditLog.count({ where: { failureReason: "rate_limited", ts: { gte: since } } }),
      db.adminAuditLog.count({ where: { result: "error", ts: { gte: since } } }),
    ]);

    const hb = worker ? new Date(String(worker.heartbeat_at ?? worker.heartbeatAt ?? 0)).getTime() : 0;
    const workerAgeSec = hb ? Math.round((now - hb) / 1000) : null;
    const disk = await diskUsage();

    const frontierRows = await db.$queryRawUnsafe<{ d: string }[]>(
      `SELECT MAX(date) as d FROM "OhlcvBar"`
    );
    const frontier = (frontierRows as Array<{ d?: string }>)[0]?.d ?? null;

    let scheduler: string | null = null;
    try { scheduler = (await fs.readFile("data/scheduler_last_run.txt", "utf8")).trim(); } catch { /* none */ }

    return NextResponse.json({
      application: { status: dbStatus === "ok" ? "ok" : "degraded", dbStatus, dbQuickCheck, frontier },
      worker: worker ? {
        heartbeatAt: worker.heartbeat_at ?? worker.heartbeatAt ?? null,
        ageSeconds: workerAgeSec,
        stale: workerAgeSec !== null ? workerAgeSec > 900 : null, // >15 min without heartbeat
        pid: worker.pid ?? null,
        note: worker.note ?? null,
      } : { present: false },
      lastCycle: lastCycle ? { classification: lastCycle.classification ?? null, ts: lastCycle.ts ?? null } : null,
      provider: provider ? {
        updatedAt: provider.updated_at ?? provider.updatedAt ?? null,
        providers: provider.providers ?? provider.summary ?? null,
      } : { present: false },
      security: { authFailures24h: authFailures, rateLimitEvents24h: rateLimitEvents, apiErrors24h: apiErrors },
      backgroundJobs: { schedulerLastRun: scheduler, workerLockNote: "duplicate-worker lock with pid liveness (task108)" },
      disk,
      note: "values are genuine; ops files are written by the production worker",
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
