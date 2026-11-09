// Task 121 — LLM control: provider status, usage and error counts, rejected
// outputs, evidence availability, and the master availability switches.
// Reads only aggregate counters — never API keys or credentials (the SDK's
// credentials stay in the platform env and are never exposed here).
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import {
  requireAdmin, assertSameOrigin, audit, authErrorResponse, getPlatformSettings,
} from "@/lib/latent/access-control";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ProviderCall {
  ts?: string; provider?: string; model?: string; ok?: boolean;
  error?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const settings = await getPlatformSettings();

    // provider call ledger (task111 ops) — parse the tail only
    let calls: ProviderCall[] = [];
    try {
      const raw = await fs.readFile("data/backtest_reports/task111/ops/provider_calls.jsonl", "utf8");
      const lines = raw.trim().split("\n").filter(Boolean);
      calls = lines.slice(-500).map((l) => { try { return JSON.parse(l) as ProviderCall; } catch { return {}; } });
    } catch { /* no ledger yet */ }

    const okCalls = calls.filter((c) => c.ok === true);
    const failCalls = calls.filter((c) => c.ok === false);
    const tokens = calls.reduce(
      (n, c) => n + (c.usage?.total_tokens ?? 0), 0
    );
    const failuresByReason = new Map<string, number>();
    for (const c of failCalls) {
      const k = String(c.error ?? "unknown").slice(0, 60);
      failuresByReason.set(k, (failuresByReason.get(k) ?? 0) + 1);
    }

    const [historyFiles, cacheFiles, auditRows] = await Promise.all([
      fs.readdir("data/backtest_reports/task112/llm_signal_history").then((f) => f.filter((x) => x.endsWith(".json")).length).catch(() => 0),
      fs.readdir("data/backtest_reports/task111/llm_cache").then((f) => f.filter((x) => x.endsWith(".json")).length).catch(() => 0),
      db.adminAuditLog.findMany({ where: { action: { contains: "llm" } }, orderBy: { ts: "desc" }, take: 10 }),
    ]);

    return NextResponse.json({
      settings: {
        llm_requests_enabled: settings.llm_requests_enabled,
        feature_pause: settings.feature_pause,
      },
      shadowOnly: true,
      provider: {
        name: "z-ai (GLM), mock fallback for tests", // name only — never keys
        observedModel: calls.findLast?.((c) => c.model) ?? calls[calls.length - 1]?.model ?? null,
        recentCalls: calls.length,
        okCalls: okCalls.length,
        failedCalls: failCalls.length,
        totalTokensRecent: tokens,
        failuresByReason: Object.fromEntries(failuresByReason),
      },
      artifacts: {
        signalHistoryRecords: historyFiles,
        evidenceCacheFiles: cacheFiles,
      },
      recentAudit: auditRows.map((r) => ({ ts: r.ts, action: r.action, result: r.result })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    assertSameOrigin(req);
    const body = (await req.json()) as Record<string, unknown>;
    const updates: Array<{ key: string; value: boolean; description: string }> = [];
    if (typeof body.llm_requests_enabled === "boolean") {
      updates.push({ key: "llm_requests_enabled", value: body.llm_requests_enabled, description: "Master switch for on-demand LLM analysis endpoints." });
    }
    if (typeof body.feature_pause === "boolean") {
      updates.push({ key: "feature_pause", value: body.feature_pause, description: "When true, expensive on-demand compute (LLM, backtests) is paused." });
    }
    if (!updates.length) return NextResponse.json({ ok: false, error: "invalid_value" }, { status: 400 });
    for (const u of updates) {
      const before = await db.platformSetting.findUnique({ where: { key: u.key } });
      await db.platformSetting.upsert({
        where: { key: u.key },
        create: { key: u.key, valueJson: JSON.stringify(u.value), description: u.description, updatedBy: admin.adminId },
        update: { valueJson: JSON.stringify(u.value), updatedBy: admin.adminId },
      });
      await audit({
        actorType: "admin", actorId: admin.adminId, action: "setting.changed",
        targetType: "setting", targetId: u.key,
        before: before ? { value: JSON.parse(before.valueJson) } : null,
        after: { value: u.value },
        correlationId: admin.correlationId, route: "/api/admin/llm",
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
