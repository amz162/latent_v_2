// Task 121 — admin authentication primitives. Passwords use scrypt
// (N=16384, r=8, p=1, 16-byte salt) and are stored in the format
// "scrypt$N$r$p$saltHex$hashHex". Session tokens exist ONLY in the HttpOnly
// admin cookie; the database stores sha256(token). Login failures are tracked
// durably per account with a hard lockout — no in-memory state to bypass.

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256, sameOrigin } from "./beta-access";
import { rateLimit, clientKey } from "./rate-limit";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_MS,
  ADMIN_LOCKOUT_MS,
  ADMIN_MAX_FAILED_LOGINS,
  AuthError,
  audit,
  newCorrelationId,
} from "./access-control";

// ---------------- password hashing ----------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length, {
      N: parseInt(nStr, 10),
      r: parseInt(rStr, 10),
      p: parseInt(pStr, 10),
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 256) return "Password must be at most 256 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain upper-case, lower-case and digit characters.";
  }
  return null;
}

// ---------------- sessions ----------------

export function adminCookieSecure(req: NextRequest): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return req.headers.get("x-forwarded-proto") === "https";
}

export function setAdminSessionCookie(res: NextResponse, req: NextRequest, token: string): void {
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: adminCookieSecure(req),
    sameSite: "lax",
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    path: "/",
  });
}

export function clearAdminSessionCookie(res: NextResponse, req: NextRequest): void {
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: adminCookieSecure(req),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function createAdminSession(adminId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  await db.adminSession.create({ data: { adminId, tokenHash: sha256(token), expiresAt } });
  return { token, expiresAt };
}

export async function revokeAdminSessions(adminId: string, correlationId?: string): Promise<number> {
  const now = new Date();
  const open = await db.adminSession.findMany({
    where: { adminId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  for (const s of open) {
    await db.adminSession.update({ where: { id: s.id }, data: { revokedAt: now } });
  }
  await audit({
    actorType: "admin",
    actorId: adminId,
    action: "admin.sessions_revoked",
    targetType: "session",
    targetId: adminId,
    after: { count: open.length },
    correlationId,
  });
  return open.length;
}

// ---------------- login / logout ----------------

export interface AdminLoginResult {
  ok: boolean;
  status: number;
  code: string;
  message?: string;
  adminId?: string;
  username?: string;
  token?: string;
}

export async function adminLogin(
  req: NextRequest,
  username: string,
  password: string
): Promise<AdminLoginResult> {
  const correlationId = newCorrelationId();
  if (!sameOrigin(req)) {
    await audit({
      actorType: "system", actorId: "anonymous", action: "admin.login",
      result: "denied", failureReason: "cross_origin", correlationId,
      route: "/api/admin/auth/login",
    });
    throw new AuthError(403, "cross_origin_blocked", "Cross-origin login rejected.");
  }
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,64}$/.test(name)) {
    return { ok: false, status: 400, code: "invalid_username" };
  }
  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    return { ok: false, status: 400, code: "invalid_password" };
  }

  // rate limits: per-username and per-client, sliding window
  const ipKey = clientKey(req);
  const rlName = rateLimit("admin_login_user", name, 10, 15 * 60_000);
  const rlIp = rateLimit("admin_login_ip", ipKey, 20, 15 * 60_000);
  if (!rlName.allowed || !rlIp.allowed) {
    await audit({
      actorType: "system", actorId: name, action: "admin.login",
      result: "denied", failureReason: "rate_limited", correlationId,
      route: "/api/admin/auth/login",
    });
    return { ok: false, status: 429, code: "rate_limited", message: `Too many attempts. Retry after ${Math.max(rlName.retryAfterSec, rlIp.retryAfterSec)}s.` };
  }

  const account = await db.adminAccount.findUnique({ where: { username: name } });
  // uniform failure shape: no signal whether the username exists
  const denied = (): AdminLoginResult => ({
    ok: false, status: 401, code: "invalid_credentials",
    message: "Invalid username or password.",
  });
  if (!account || !account.isActive) {
    await audit({
      actorType: "system", actorId: name, action: "admin.login",
      result: "denied", failureReason: account ? "account_inactive" : "invalid_credentials",
      correlationId, route: "/api/admin/auth/login",
    });
    return denied();
  }
  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((account.lockedUntil.getTime() - Date.now()) / 60_000);
    await audit({
      actorType: "system", actorId: account.id, action: "admin.login",
      result: "denied", failureReason: "account_locked", correlationId,
      route: "/api/admin/auth/login",
    });
    return { ok: false, status: 429, code: "account_locked", message: `Account locked for ~${mins} more minute(s).` };
  }

  if (!verifyPassword(password, account.passwordHash)) {
    const failed = account.failedLoginCount + 1;
    const lock = failed >= ADMIN_MAX_FAILED_LOGINS ? new Date(Date.now() + ADMIN_LOCKOUT_MS) : null;
    await db.adminAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: failed, lockedUntil: lock },
    });
    await audit({
      actorType: "system", actorId: account.id, action: "admin.login",
      result: "denied", failureReason: "invalid_password",
      after: { failedLoginCount: failed, locked: lock !== null },
      correlationId, route: "/api/admin/auth/login",
    });
    if (lock) {
      return { ok: false, status: 429, code: "account_locked", message: `Too many failed attempts — locked for 15 minutes.` };
    }
    return denied();
  }

  // success: reset failure counters, mint session, stamp last login
  const { token } = await createAdminSession(account.id);
  await db.adminAccount.update({
    where: { id: account.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await audit({
    actorType: "admin", actorId: account.id, action: "admin.login",
    targetType: "session", targetId: "new",
    correlationId, route: "/api/admin/auth/login",
  });
  return { ok: true, status: 200, code: "ok", adminId: account.id, username: account.username, token };
}

export async function adminLogout(req: NextRequest): Promise<{ ok: boolean; adminId?: string }> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return { ok: false };
  const session = await db.adminSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.revokedAt) return { ok: false };
  await db.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await audit({
    actorType: "admin", actorId: session.adminId, action: "admin.logout",
    targetType: "session", targetId: session.id,
    route: "/api/admin/auth/logout",
  });
  return { ok: true, adminId: session.adminId };
}
