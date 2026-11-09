// Task 121 — centralized server-side authorization. SERVER-ONLY module:
// never import from a client component. Every protected API and page resolves
// identity, status, plan and effective permissions HERE — the browser never
// sends a role, permission, plan or status value that this module trusts.
//
// Deny-by-default resolution order (first explicit match wins):
//   1. per-user ProfilePermission override (DENY beats ALLOW within scope)
//   2. plan-level PlanPermission row
//   3. registry default (defaultEffect) — but ONLY if registry.globalEnabled;
//      a globally disabled permission denies every user (admins bypass)
//
// Session planes:
//   - user:  BetaProfile cookie session (reused Task 117 invite mechanics)
//            + ProfileAccess row (plan/status/expiry — server-only fields)
//   - admin: separate AdminSession cookie, scrypt-backed AdminAccount,
//            short absolute TTL, revocable
//   - internal: INTERNAL_API_TOKEN machine token for health/cron consumers
//            (timing-safe, fail-closed when unset)

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { BETA_COOKIE, sha256 } from "./beta-access";

export const ADMIN_COOKIE = "latent_admin_session";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h absolute
export const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;
export const ADMIN_MAX_FAILED_LOGINS = 5;

export type UsageKind = "llm_request" | "report_export" | "simulator_run" | "api_request";

/**
 * Read a cookie from either a NextRequest (cookies API) or a plain Request
 * (Cookie header parsing) — route handlers in this codebase use both types.
 */
export function readCookie(req: NextRequest | Request, name: string): string | undefined {
  const c = (req as NextRequest).cookies;
  if (c && typeof c.get === "function") {
    const v = c.get(name)?.value;
    if (v) return v;
  }
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const kv of header.split(";")) {
    const [k, ...rest] = kv.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export interface PlanLimits {
  maxDailyLlmRequests: number | null;
  maxDailyReportExports: number | null;
  maxDailySimulatorRuns: number | null;
  maxDailyApiRequests: number | null;
  accountExpiryDays: number | null;
}

const DEFAULT_LIMITS: PlanLimits = {
  maxDailyLlmRequests: null,
  maxDailyReportExports: null,
  maxDailySimulatorRuns: null,
  maxDailyApiRequests: null,
  accountExpiryDays: null,
};

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json(
      { ok: false, error: err.code, message: err.message, correlationId: undefined },
      { status: err.status }
    );
  }
  console.error("[access-control] unexpected error:", err);
  return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
}

/** YYYY-MM-DD in Pakistan Standard Time — usage counters reset at local midnight. */
export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

// ---------------- platform settings ----------------

export interface PlatformSettings {
  maintenance_mode: boolean;
  feature_pause: boolean;
  llm_requests_enabled: boolean;
  feedback_enabled: boolean;
  invitations_paused: boolean;
  registration_default_plan: string;
}

const SETTING_DEFAULTS: PlatformSettings = {
  maintenance_mode: false,
  feature_pause: false,
  llm_requests_enabled: true,
  feedback_enabled: true,
  invitations_paused: false,
  registration_default_plan: "BASIC",
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const out: PlatformSettings = { ...SETTING_DEFAULTS };
  try {
    const rows = await db.platformSetting.findMany();
    for (const row of rows) {
      try {
        const v = JSON.parse(row.valueJson);
        if (row.key in out && typeof v === typeof (out as unknown as Record<string, unknown>)[row.key]) {
          (out as unknown as Record<string, unknown>)[row.key] = v;
        }
      } catch {
        // malformed stored value → keep default (fail-safe)
      }
    }
  } catch {
    // DB failure → defaults (fail-safe, same policy as betaConfig)
  }
  return out;
}

// ---------------- internal machine token ----------------

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // compare against self to burn equivalent time, then fail
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Machine-to-machine authorization (health checks, cron scripts, CI).
 * Requires INTERNAL_API_TOKEN in the environment; fails closed when unset.
 */
export function internalTokenOk(req: { headers: Headers }): boolean {
  const expected = process.env.INTERNAL_API_TOKEN ?? "";
  if (!expected) return false;
  const provided =
    req.headers.get("x-internal-token") ??
    (req.headers.get("authorization")?.startsWith("Bearer ")
      ? req.headers.get("authorization")!.slice(7)
      : null) ??
    "";
  if (!provided) return false;
  return timingSafeEqualStr(provided, expected);
}

/** Admin session OR internal token (for routes polled by host-side scripts). */
export async function requireAdminOrInternal(req: NextRequest): Promise<boolean> {
  if (internalTokenOk(req)) return true;
  try {
    await requireAdmin(req);
    return true;
  } catch {
    return false;
  }
}

// ---------------- effective permission resolution ----------------

function parseLimits(limitsJson: string | null | undefined): PlanLimits {
  if (!limitsJson) return { ...DEFAULT_LIMITS };
  try {
    const raw = JSON.parse(limitsJson) as Partial<PlanLimits>;
    return {
      maxDailyLlmRequests: typeof raw.maxDailyLlmRequests === "number" ? raw.maxDailyLlmRequests : null,
      maxDailyReportExports: typeof raw.maxDailyReportExports === "number" ? raw.maxDailyReportExports : null,
      maxDailySimulatorRuns: typeof raw.maxDailySimulatorRuns === "number" ? raw.maxDailySimulatorRuns : null,
      maxDailyApiRequests: typeof raw.maxDailyApiRequests === "number" ? raw.maxDailyApiRequests : null,
      accountExpiryDays: typeof raw.accountExpiryDays === "number" ? raw.accountExpiryDays : null,
    };
  } catch {
    return { ...DEFAULT_LIMITS };
  }
}

export interface UserContext {
  kind: "user";
  req: NextRequest | Request;
  profileId: string;
  status: string;
  planKey: string;
  planLabel: string;
  accessExpiresAt: Date | null;
  permissions: Set<string>;
  limits: PlanLimits;
  correlationId: string;
}

export interface AdminContext {
  kind: "admin";
  req: NextRequest | Request;
  adminId: string;
  username: string;
  correlationId: string;
}

export type AuthContext = UserContext | AdminContext;

/** Resolve the effective ALLOW set for a profile: user override > plan > registry default. */
export async function resolveEffectivePermissions(profileId: string, planKey: string): Promise<Set<string>> {
  const [registry, planPerms, userPerms] = await Promise.all([
    db.permissionRegistry.findMany(),
    db.planPermission.findMany({ where: { planKey } }),
    db.profilePermission.findMany({ where: { profileId } }),
  ]);
  const planMap = new Map(planPerms.map((p) => [p.permissionKey, p.effect]));
  const userMap = new Map(userPerms.map((p) => [p.permissionKey, p.effect]));
  const allowed = new Set<string>();
  for (const entry of registry) {
    // admin master switch: a globally disabled permission denies EVERY user
    // (admins bypass at a different layer) regardless of plan or overrides
    if (!entry.globalEnabled) continue;
    const userEffect = userMap.get(entry.key);
    if (userEffect) {
      if (userEffect === "ALLOW") allowed.add(entry.key);
      continue; // explicit user DENY (or deny-because-not-ALLOW) is final
    }
    const planEffect = planMap.get(entry.key);
    if (planEffect) {
      if (planEffect === "ALLOW") allowed.add(entry.key);
      continue;
    }
    if (entry.globalEnabled && (entry.isCore || entry.defaultEffect === "ALLOW")) allowed.add(entry.key);
  }
  return allowed;
}

/** Ensure a ProfileAccess row exists for a profile (lazy, default plan). */
export async function ensureProfileAccess(profileId: string): Promise<{
  status: string;
  planKey: string;
  planLabel: string;
  accessExpiresAt: Date | null;
  limits: PlanLimits;
  lastSeenAt: Date;
}> {
  let access = await db.profileAccess.findUnique({ where: { profileId } });
  if (!access) {
    const settings = await getPlatformSettings();
    const plan =
      (await db.accessPlan.findFirst({ where: { key: settings.registration_default_plan, isEnabled: true } })) ??
      (await db.accessPlan.findUnique({ where: { key: "BASIC" } })) ??
      null;
    const planKey = plan?.key ?? "BASIC";
    const limits = parseLimits(plan?.limitsJson);
    const expiry = limits.accountExpiryDays
      ? new Date(Date.now() + limits.accountExpiryDays * 86_400_000)
      : null;
    access = await db.profileAccess.create({
      data: { profileId, planKey, accessExpiresAt: expiry },
    });
  }
  const plan = await db.accessPlan.findUnique({ where: { key: access.planKey } });
  const fallback = plan?.key ? plan : { key: access.planKey, label: access.planKey, limitsJson: "{}" };
  return {
    status: access.status,
    planKey: fallback.key,
    planLabel: fallback.label,
    accessExpiresAt: access.accessExpiresAt,
    limits: parseLimits(fallback.limitsJson),
    lastSeenAt: access.lastSeenAt,
  };
}

async function buildUserContext(req: NextRequest | Request, correlationId: string): Promise<UserContext | null> {
  const token = readCookie(req, BETA_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const profile = await db.betaProfile.findUnique({ where: { sessionTokenHash: sha256(token) } });
  if (!profile) return null; // deleted profile / stale cookie → anonymous (old sessions die with the row)
  const access = await ensureProfileAccess(profile.id);
  const permissions = await resolveEffectivePermissions(profile.id, access.planKey);
  return {
    kind: "user",
    req,
    profileId: profile.id,
    status: access.status,
    planKey: access.planKey,
    planLabel: access.planLabel,
    accessExpiresAt: access.accessExpiresAt,
    permissions,
    limits: access.limits,
    correlationId,
  };
}

/**
 * Full auth context resolution for a request. Returns null for anonymous
 * callers. Throws AuthError only via requireUser/requireAdmin wrappers —
 * this function never throws for "not logged in".
 */
export async function getAuthContext(req: NextRequest | Request): Promise<AuthContext | null> {
  const correlationId = newCorrelationId();
  const adminToken = readCookie(req, ADMIN_COOKIE);
  if (adminToken && /^[a-f0-9]{64}$/.test(adminToken)) {
    const session = await db.adminSession.findUnique({
      where: { tokenHash: sha256(adminToken) },
      include: { admin: true },
    });
    if (session && !session.revokedAt && session.expiresAt.getTime() > Date.now() && session.admin.isActive) {
      return { kind: "admin", req, adminId: session.adminId, username: session.admin.username, correlationId };
    }
    // fall through: an expired admin cookie must not be treated as a user
  }
  return buildUserContext(req, correlationId);
}

// ---------------- guards ----------------

export async function requireUser(
  req: NextRequest | Request,
  permission?: string
): Promise<UserContext> {
  const ctx = await getAuthContext(req);
  if (!ctx || ctx.kind !== "user") {
    throw new AuthError(401, "authentication_required", "Sign in required.");
  }
  if (ctx.status === "SUSPENDED") {
    throw new AuthError(403, "account_suspended", "This account is suspended.");
  }
  if (ctx.status !== "ACTIVE") {
    throw new AuthError(403, "account_inactive", "This account is not active.");
  }
  if (ctx.accessExpiresAt && ctx.accessExpiresAt.getTime() < Date.now()) {
    throw new AuthError(403, "account_expired", "This account has expired.");
  }
  const settings = await getPlatformSettings();
  if (settings.maintenance_mode) {
    throw new AuthError(503, "maintenance_mode", "Platform is under maintenance.");
  }
  if (permission && !ctx.permissions.has(permission)) {
    throw new AuthError(403, "permission_denied", `Permission required: ${permission}`);
  }
  // activity tracking — throttled write (never blocks the request)
  void db.profileAccess
    .updateMany({
      where: { profileId: ctx.profileId, lastSeenAt: { lt: new Date(Date.now() - 60_000) } },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);
  return ctx;
}

export async function requireAdmin(req: NextRequest | Request): Promise<AdminContext> {
  const ctx = await getAuthContext(req);
  if (!ctx) {
    throw new AuthError(401, "authentication_required", "Admin sign-in required.");
  }
  if (ctx.kind !== "admin") {
    throw new AuthError(403, "admin_only", "Administrator access required.");
  }
  return ctx;
}

/**
 * CSRF defense for state-changing requests (defense in depth on top of
 * SameSite=Lax cookies): an Origin/Referer header from another host is fatal.
 * Absent headers (server-to-server, curl without Origin) pass — those requests
 * cannot carry a victim's ambient cookies.
 */
export function assertSameOrigin(req: NextRequest | Request): void {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return;
  try {
    const o = new URL(origin);
    const host = req.headers.get("host");
    if (host && o.host !== host) {
      throw new AuthError(403, "cross_origin_blocked", "Cross-origin request rejected.");
    }
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw new AuthError(403, "cross_origin_blocked", "Malformed origin header.");
  }
}

// ---------------- usage limits (race-safe) ----------------

export interface UsageSnapshot {
  llm_request: number;
  report_export: number;
  simulator_run: number;
  api_request: number;
}

export async function getUsageToday(profileId: string): Promise<UsageSnapshot> {
  const day = todayKey();
  const rows = await db.userUsage.findMany({ where: { profileId, day } });
  const snap: UsageSnapshot = { llm_request: 0, report_export: 0, simulator_run: 0, api_request: 0 };
  for (const r of rows) {
    if (r.kind in snap) snap[r.kind as keyof UsageSnapshot] = r.count;
  }
  return snap;
}

function limitFor(limits: PlanLimits, kind: UsageKind): number | null {
  switch (kind) {
    case "llm_request": return limits.maxDailyLlmRequests;
    case "report_export": return limits.maxDailyReportExports;
    case "simulator_run": return limits.maxDailySimulatorRuns;
    case "api_request": return limits.maxDailyApiRequests;
  }
}

/**
 * Atomically consume one unit of a daily allowance. The increment happens in
 * a single conditional UPDATE (`count < limit` inside the WHERE clause), so
 * concurrent requests can never overshoot the limit. Returns the resulting
 * usage snapshot when allowed; throws 429 when exhausted.
 */
export async function consumeDailyAllowance(
  profileId: string,
  limits: PlanLimits,
  kind: UsageKind
): Promise<UsageSnapshot> {
  const limit = limitFor(limits, kind);
  const day = todayKey();
  if (limit !== null) {
    await db.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "UserUsage" ("id","profileId","day","kind","count") VALUES (?,?,?,?,0)`,
      crypto.randomUUID(), profileId, day, kind
    );
    const updated = await db.$executeRawUnsafe(
      `UPDATE "UserUsage" SET "count" = "count" + 1
       WHERE "profileId" = ? AND "day" = ? AND "kind" = ? AND "count" < ?`,
      profileId, day, kind, limit
    );
    if (updated === 0) {
      throw new AuthError(429, "usage_limit_exceeded", `Daily ${kind} limit (${limit}) reached.`);
    }
  }
  return getUsageToday(profileId);
}

// ---------------- audit (append-only) ----------------

export interface AuditEntry {
  actorType: "admin" | "user" | "system";
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  result?: "ok" | "denied" | "error";
  failureReason?: string;
  correlationId?: string;
  route?: string;
}

/**
 * Append an audit row. Best-effort: a failed audit write is logged loudly but
 * never breaks the caller's response. Callers must pass only safe values in
 * before/after — never tokens, cookies, passwords or secrets.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await db.adminAuditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        beforeJson: entry.before === undefined ? null : JSON.stringify(entry.before),
        afterJson: entry.after === undefined ? null : JSON.stringify(entry.after),
        result: entry.result ?? "ok",
        failureReason: entry.failureReason ?? null,
        correlationId: entry.correlationId ?? null,
        route: entry.route ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] FAILED to append audit row:", entry.action, e);
  }
}

/** Audit a denied/failed security event on the user plane. */
export async function auditSecurityEvent(
  req: NextRequest | Request,
  action: string,
  detail: Record<string, unknown>,
  actorType: "user" | "system" = "user",
  actorId = "anonymous"
): Promise<void> {
  await audit({
    actorType,
    actorId,
    action,
    result: "denied",
    failureReason: detail.code as string | undefined,
    route: new URL(req.url).pathname,
    correlationId: newCorrelationId(),
    after: detail,
  });
}

// ---------------- non-throwing gate helpers (for route insertion) ----------------

/**
 * Full user-plane gate for normal data endpoints. Returns a Response to
 * reject, or null to proceed. Checks: session, ACTIVE status, expiry,
 * maintenance mode, permission.
 */
export async function guardUser(req: NextRequest | Request, permission?: string): Promise<Response | null> {
  // Host-side automation (health checks, CI probes) authenticates with the
  // internal machine token and bypasses user-plane checks.
  if (internalTokenOk(req)) return null;
  try {
    await requireUser(req, permission);
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ ok: false, error: e.code, message: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** Admin-only gate (admin session required). */
export async function guardAdmin(req: NextRequest | Request): Promise<Response | null> {
  try {
    await requireAdmin(req);
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ ok: false, error: e.code, message: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** Admin session OR internal machine token. */
export async function guardAdminOrInternal(req: NextRequest | Request): Promise<Response | null> {
  if (internalTokenOk(req)) return null;
  return guardAdmin(req);
}

/** Any ACTIVE user session OR internal machine token (browser-polling routes). */
export async function guardUserOrInternal(req: NextRequest | Request, permission?: string): Promise<Response | null> {
  if (internalTokenOk(req)) return null;
  return guardUser(req, permission);
}

export interface GateOptions {
  permission?: string;
  /** daily usage kind to consume (429 when exhausted) */
  usage?: UsageKind;
  /** PlatformSetting that must be true to proceed (503 otherwise) */
  requireSetting?: keyof PlatformSettings;
  /** reject with 503 when the global feature pause is on */
  respectFeaturePause?: boolean;
}

/**
 * Expensive-endpoint gate: auth + status + permission + maintenance +
 * platform toggles + optional race-safe daily allowance consumption.
 */
export async function gateUser(
  req: NextRequest | Request,
  opts: GateOptions
): Promise<{ user: UserContext; usage: UsageSnapshot | null } | Response> {
  // internal machine token: service identity, no usage counters consumed
  if (internalTokenOk(req)) {
    return {
      user: {
        kind: "user", req, profileId: "internal-service", status: "ACTIVE",
        planKey: "SERVICE", planLabel: "service", accessExpiresAt: null,
        permissions: new Set(), limits: { maxDailyLlmRequests: null, maxDailyReportExports: null, maxDailySimulatorRuns: null, maxDailyApiRequests: null, accountExpiryDays: null },
        correlationId: newCorrelationId(),
      },
      usage: null,
    };
  }
  try {
    const user = await requireUser(req, opts.permission);
    const settings = await getPlatformSettings();
    if (opts.respectFeaturePause && settings.feature_pause) {
      return Response.json({ ok: false, error: "feature_paused", message: "This compute feature is temporarily paused by the administrator." }, { status: 503 });
    }
    if (opts.requireSetting && settings[opts.requireSetting] !== true) {
      return Response.json({ ok: false, error: "feature_disabled", message: "This feature is disabled by the administrator." }, { status: 503 });
    }
    let usage: UsageSnapshot | null = null;
    if (opts.usage) {
      usage = await consumeDailyAllowance(user.profileId, user.limits, opts.usage);
    }
    return { user, usage };
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ ok: false, error: e.code, message: e.message }, { status: e.status });
    }
    throw e;
  }
}

// ---------------- page (server component) guards ----------------

// Server components cannot construct a NextRequest; these guards use the
// cookies() store directly and REDIRECT instead of returning JSON errors.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireUserPageRedirect(): Promise<UserContext> {
  const store = await cookies();
  const token = store.get(BETA_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/login");
  const profile = await db.betaProfile.findUnique({ where: { sessionTokenHash: sha256(token) } });
  if (!profile) redirect("/login?error=session_expired");
  const access = await ensureProfileAccess(profile.id);
  if (access.status === "SUSPENDED") redirect("/login?error=account_suspended");
  if (access.accessExpiresAt && access.accessExpiresAt.getTime() < Date.now()) {
    redirect("/login?error=account_expired");
  }
  const permissions = await resolveEffectivePermissions(profile.id, access.planKey);
  const plan = await db.accessPlan.findUnique({ where: { key: access.planKey } });
  return {
    kind: "user",
    req: null as unknown as NextRequest,
    profileId: profile.id,
    status: access.status,
    planKey: access.planKey,
    planLabel: plan?.label ?? access.planKey,
    accessExpiresAt: access.accessExpiresAt,
    permissions,
    limits: access.limits,
    correlationId: newCorrelationId(),
  };
}

export async function requireAdminPageRedirect(): Promise<{ adminId: string; username: string }> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect("/admin/login");
  const session = await db.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { admin: true },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now() || !session.admin.isActive) {
    redirect("/admin/login?error=session_expired");
  }
  return { adminId: session.adminId, username: session.admin.username };
}
