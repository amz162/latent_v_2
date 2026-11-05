import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { verifyPaths, backtestReportsDir, dataRoot } from "@/lib/latent/paths";
import { getCacheStatus } from "@/lib/latent/cache";
import { betaConfig, inviteRequired } from "@/lib/latent/beta-access";

// Task 116 J5 + Task 117 Part J — operator-facing health snapshot.
// Adds: data frontier, provider status, last ingestion, worker heartbeat age,
// scheduler status, LLM provider status, runtime beta configuration.
// Exposes operational facts only — never secrets, env values or stack traces.

export const dynamic = "force-dynamic";

const APP_VERSION = "task117-beta";
const COMMIT = process.env.LATENT_COMMIT_SHA || "unknown";

function readJsonSafe(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const started = Date.now();
  const paths = verifyPaths({ probeWrite: true });

  let dbStatus: "ok" | "degraded" | "down" = "down";
  let dbDetail: Record<string, unknown> = {};
  try {
    const bars = await db.ohlcvBar.count();
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
  const cfg = await betaConfig();
  const betaEnabled =
    process.env.BETA_ONBOARDING_ENABLED !== "false" && !cfg.betaDisabled;

  // ---- Task 117 operational block ----
  const reports = backtestReportsDir();
  let frontier: string | null = null;
  try {
    const agg = await db.ohlcvBar.aggregate({ _max: { date: true } });
    frontier = agg._max.date;
  } catch { /* dbStatus already reflects the failure */ }

  const ingestion = readJsonSafe(path.join(reports, "task107", "task107_daily_ingestion_report.json"));
  const lastIngestion = ingestion
    ? {
        generatedAt: (ingestion.generated_at ?? ingestion.generatedAt) ?? null,
        providerAvailable: Boolean(ingestion.provider && (ingestion.provider as Record<string, unknown>).available),
        insertedBars: ingestion.inserted_bars ?? ingestion.insertedBars ?? null,
      }
    : null;

  // worker heartbeat: newest heartbeat row in the task109 history CSV
  let workerHeartbeat: { lastSeenAt: string | null; ageMinutes: number | null } = { lastSeenAt: null, ageMinutes: null };
  try {
    const hbPath = path.join(reports, "task109", "task109_worker_heartbeat_history.csv");
    if (fs.existsSync(hbPath)) {
      const lines = fs.readFileSync(hbPath, "utf8").trim().split("\n");
      const last = lines[lines.length - 1];
      const ts = last?.split(",")[1]?.trim();
      if (ts) {
        const age = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
        workerHeartbeat = { lastSeenAt: ts, ageMinutes: Number.isFinite(age) ? age : null };
      }
    }
  } catch { /* heartbeat stays null */ }

  const scheduler = readJsonSafe(path.join(dataRoot(), "scheduler_status.json"));

  // LLM provider: latest stored decision timestamp from the frozen Task 112 history
  let llmStatus: Record<string, unknown> = { available: false, model: "GLM-4.6 (frozen Task 111 pipeline)" };
  try {
    const dir = path.join(reports, "task112", "llm_signal_history");
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse();
      llmStatus = { available: files.length > 0, storedDecisions: files.length, mode: "shadow/research-only, read-only" };
    }
  } catch { /* stays unavailable */ }

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
      model: "host-supervisor (python task107/108 pipeline) — singleton locks + idempotency ledger",
      heartbeatSource: "/api/model-report worker_heartbeat block",
      heartbeat: workerHeartbeat,
      heartbeatStale: workerHeartbeat.ageMinutes === null || workerHeartbeat.ageMinutes > 60,
    },
    operational: {
      dataFrontier: frontier,
      frontierAgeDays: frontier ? Math.floor((Date.now() - new Date(frontier + "T00:00:00Z").getTime()) / 86_400_000) : null,
      lastIngestion,
      scheduler: scheduler ? { status: scheduler.status ?? "unknown", detailKeys: Object.keys(scheduler).slice(0, 8) } : { status: "host-cron/github-actions (no local status file)" },
      llm: llmStatus,
      releaseState: process.env.LATENT_RELEASE_STATE || "INVITE_ONLY_BETA_READY",
    },
    beta: {
      enabled: betaEnabled,
      consentVersion: "beta-consent-v1",
      registrationsPaused: cfg.registrationsPaused,
      invitationRequired: inviteRequired(),
      runtimeDisabledReason: cfg.betaDisabled ? cfg.reason || "operator disabled" : null,
    },
  });
}
