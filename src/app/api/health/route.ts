import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPaths } from "@/lib/latent/paths";
import { getCacheStatus } from "@/lib/latent/cache";

// Task 116 Part J5 — hosting readiness health endpoint.
// Startup/liveness + readiness facts only. Never exposes secrets, env
// values or stack traces. The DB write-capability probe uses a TEMP table
// inside a rolled-back transaction — production data is never modified.

export const dynamic = "force-dynamic";

const APP_VERSION = "task116-beta";
const COMMIT = process.env.LATENT_COMMIT_SHA || "unknown";

export async function GET() {
  const started = Date.now();
  const paths = verifyPaths({ probeWrite: true });

  let dbStatus: "ok" | "degraded" | "down" = "down";
  let dbDetail: Record<string, unknown> = {};
  try {
    // Read probe: count one persistent table (no data modification).
    const bars = await db.ohlcvBar.count();
    // Write-capability probe: temp table in a rolled-back transaction —
    // never persists anything to production storage.
    await db.$executeRawUnsafe("CREATE TEMP TABLE IF NOT EXISTS _latent_health_probe (id INTEGER)");
    await db.$executeRawUnsafe("INSERT INTO _latent_health_probe (id) VALUES (1)");
    await db.$executeRawUnsafe("DROP TABLE _latent_health_probe");
    dbStatus = paths.databaseExists ? "ok" : "degraded";
    dbDetail = { ohlcvBars: bars, writeCapable: true };
  } catch (err) {
    dbStatus = "down";
    dbDetail = { error: err instanceof Error ? err.message : "database unavailable" };
  }

  const cache = getCacheStatus();
  const betaEnabled = process.env.BETA_ONBOARDING_ENABLED !== "false"; // default on, env-gated off

  return NextResponse.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    version: APP_VERSION,
    commit: COMMIT,
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    database: { status: dbStatus, ...dbDetail },
    paths: {
      ok: paths.ok,
      dataRootLabel: "workspace-persistent",
      databaseExists: paths.databaseExists,
      dataDirWritable: paths.dataDirWritable,
      errors: paths.errors,
    },
    cache,
    workers: {
      // Python pipeline supervisor runs out-of-process on the host
      // (scripts/server_supervisor.sh); the web app must never duplicate it.
      model: "host-supervisor (python task107/108 pipeline) — singleton locks + idempotency ledger",
      heartbeatSource: "/api/model-report worker_heartbeat block",
    },
    beta: { enabled: betaEnabled, consentVersion: "beta-consent-v1" },
  });
}
