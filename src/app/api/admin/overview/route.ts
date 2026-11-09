// Task 121 — admin overview: platform counts + system health snapshot.
// Genuine data comes from the database and ops state files; mock/test data
// is always labeled by the UI (source field).
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { requireAdmin, authErrorResponse, audit } from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const OPS_DIR = "data/backtest_reports/task107/ops";

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    return authErrorResponse(e);
  }
  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000);

  const [profilesTotal, active, suspended, expired, invitesActive, invitesRevoked, invitesExpired, new7d, feedbackNew] =
    await Promise.all([
      db.betaProfile.count(),
      db.profileAccess.count({ where: { status: "ACTIVE" } }),
      db.profileAccess.count({ where: { status: "SUSPENDED" } }),
      db.profileAccess.count({ where: { status: "ACTIVE", accessExpiresAt: { not: null, lt: new Date(now) } } }),
      db.betaInvite.count({ where: { status: "active" } }),
      db.betaInvite.count({ where: { status: "revoked" } }),
      db.betaInvite.count({ where: { status: "active", expiresAt: { not: null, lt: new Date(now) } } }),
      db.profileAccess.count({ where: { createdAt: { gte: d7 } } }),
      db.betaFeedback.count({ where: { status: "new" } }),
  ]);

  const lastActivity = await db.profileAccess.aggregate({ _max: { lastSeenAt: true } });
  const [strategiesVisible, strategiesTotal, modelsVisible, modelsTotal, historyFiles] = await Promise.all([
    db.strategyConfig.count({ where: { userVisible: true } }),
    db.strategyConfig.count(),
    db.modelAccessConfig.count({ where: { userVisible: true } }),
    db.modelAccessConfig.count(),
    fs.readdir("data/backtest_reports/task112/llm_signal_history").then((f) => f.filter((x) => x.endsWith(".json")).length).catch(() => 0),
  ]);

  const worker = await readJsonFile(`${OPS_DIR}/worker_health.json`);
  const provider = await readJsonFile(`${OPS_DIR}/provider_health_state.json`);
  let dbOk = true;
  try { await db.$queryRawUnsafe("SELECT 1"); } catch { dbOk = false; }

  const [recentAudit, securityEvents] = await Promise.all([
    db.adminAuditLog.findMany({ orderBy: { ts: "desc" }, take: 8 }),
    db.adminAuditLog.findMany({ where: { result: { in: ["denied", "error"] } }, orderBy: { ts: "desc" }, take: 8 }),
  ]);

  await audit({
    actorType: "admin", actorId: admin.adminId, action: "admin.overview.viewed",
    route: "/api/admin/overview", correlationId: admin.correlationId,
  });

  return NextResponse.json({
    users: { total: profilesTotal, active, suspended, expired, newLast7d: new7d, lastActivityAt: lastActivity._max.lastSeenAt },
    invitations: { active: invitesActive, revoked: invitesRevoked, expired: invitesExpired, feedbackNew },
    system: {
      db: dbOk ? "ok" : "error",
      worker: worker ? { heartbeatAt: worker.heartbeat_at ?? worker.heartbeatAt ?? null, note: worker.note ?? null, pid: worker.pid ?? null, stale: worker.stale ?? null } : null,
      provider: provider ? { updatedAt: provider.updated_at ?? provider.updatedAt ?? null, providers: provider.providers ?? provider.summary ?? null } : null,
      strategies: { visible: strategiesVisible, total: strategiesTotal },
      models: { visible: modelsVisible, total: modelsTotal },
      llmSignalHistory: historyFiles,
    },
    recentAudit: recentAudit.map((r) => ({ ts: r.ts, actorType: r.actorType, action: r.action, targetId: r.targetId, result: r.result })),
    securityEvents: securityEvents.map((r) => ({ ts: r.ts, action: r.action, failureReason: r.failureReason, result: r.result })),
    sources: { users: "database", system: "ops state files + database", note: "counts are genuine DB aggregates; ops panels read live state files" },
  });
}
