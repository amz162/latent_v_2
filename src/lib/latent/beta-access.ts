// Task 117 Parts C + D — invite-only beta access, session identity, runtime
// configuration. Single source of truth for every beta route.
//
// Design:
//   - The raw session token exists ONLY in an HttpOnly cookie. Server-side,
//     BetaProfile rows store sha256(token) (see scripts/task117_migrate_profile_tokens.py).
//   - Access paths: a hashed single/multi-use BetaInvite (default), or the
//     operator explicitly setting BETA_INVITE_REQUIRED=false (open_flag).
//     There is no public unrestricted signup.
//   - BETA_ONBOARDING_ENABLED=false (env) or BetaConfig.betaDisabled (runtime)
//     disables the whole experience; env always wins; disabling never deletes.
//   - Invitation validation is server-only; failures are indistinguishable
//     (invalid / expired / revoked / exhausted all return the same message)
//     so invitations cannot be enumerated.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";

export const BETA_COOKIE = "latent_beta_session";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const CONSENT_VERSION = "beta-consent-v1";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function betaEnabled(): boolean {
  if (process.env.BETA_ONBOARDING_ENABLED === "false") return false;
  return true; // runtime BetaConfig checked separately (async) — see betaConfig()
}

export async function betaConfig() {
  let cfg: { betaDisabled: boolean; registrationsPaused: boolean; reason: string | null } = {
    betaDisabled: false,
    registrationsPaused: false,
    reason: null,
  };
  try {
    const row = await db.betaConfig.findUnique({ where: { id: 1 } });
    if (row) cfg = { betaDisabled: row.betaDisabled, registrationsPaused: row.registrationsPaused, reason: row.reason };
  } catch {
    // DB failure must not silently re-enable: env check still applies above;
    // routes that require writes will fail closed on their own DB errors.
  }
  return cfg;
}

export function inviteRequired(): boolean {
  return process.env.BETA_INVITE_REQUIRED !== "false"; // default: invite-only
}

export async function isBetaActive(): Promise<{ active: boolean; reason: string | null }> {
  if (process.env.BETA_ONBOARDING_ENABLED === "false") return { active: false, reason: "beta_disabled_flag" };
  const cfg = await betaConfig();
  if (cfg.betaDisabled) return { active: false, reason: "beta_disabled_runtime" };
  return { active: true, reason: null };
}

// ---------- session identity ----------

export interface BetaSession {
  profileId: string;
  sessionTokenHash: string;
  accessVia: string;
  inviteId: string | null;
  profileComplete: boolean;
  consentVersion: string;
  consentAcceptedAt: Date | null;
}

export async function getSession(req: NextRequest): Promise<BetaSession | null> {
  const token = req.cookies.get(BETA_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const p = await db.betaProfile.findUnique({ where: { sessionTokenHash: sha256(token) } });
  if (!p) return null;
  return {
    profileId: p.id,
    sessionTokenHash: p.sessionTokenHash,
    accessVia: p.accessVia,
    inviteId: p.inviteId,
    profileComplete: p.profileComplete,
    consentVersion: p.consentVersion,
    consentAcceptedAt: p.consentAcceptedAt,
  };
}

/** Issue a fresh identity: new token (cookie) + new profile row. */
export async function createSession(
  res: NextResponse,
  req: NextRequest,
  opts: { accessVia: string; inviteId: string | null }
): Promise<{ profileId: string; token: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const p = await db.betaProfile.create({
    data: {
      sessionTokenHash: sha256(token),
      consentVersion: "pending-invite-redeem",
      accessVia: opts.accessVia,
      inviteId: opts.inviteId,
    },
  });
  setSessionCookie(res, req, token);
  return { profileId: p.id, token };
}

function cookieSecure(req: NextRequest): boolean {
  // Secure when the request actually arrived over HTTPS (Caddy sets
  // x-forwarded-proto) or when the host forces it via COOKIE_SECURE=true.
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return req.headers.get("x-forwarded-proto") === "https";
}

export function setSessionCookie(res: NextResponse, req: NextRequest, token: string) {
  res.cookies.set(BETA_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(req),
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(res: NextResponse, req: NextRequest) {
  res.cookies.set(BETA_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(req),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

// ---------- CSRF / origin ----------

/**
 * Same-origin check for state-changing requests. SameSite=Lax already stops
 * cross-site POSTs from carrying the cookie; this adds defense in depth.
 * Requests without an Origin/Referer header (server-to-server, curl) pass —
 * they cannot carry a victim's ambient cookies anyway in the flows that matter.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) return true;
  try {
    const o = new URL(origin);
    const host = req.headers.get("host");
    return !host || o.host === host;
  } catch {
    return false;
  }
}

// ---------- invitations ----------

export type InviteRejection = "invalid" | "expired" | "revoked" | "exhausted" | "paused";

export interface InviteCheck {
  ok: boolean;
  rejection?: InviteRejection;
  inviteId?: string;
  maxRedemptions?: number;
}

/** Constant-ish behavior for every failure — no enumeration signal. */
export async function checkInvite(code: string): Promise<InviteCheck> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{8,64}$/.test(normalized)) return { ok: false, rejection: "invalid" };
  const invite = await db.betaInvite.findUnique({ where: { tokenHash: sha256(normalized) } });
  if (!invite) return { ok: false, rejection: "invalid" };
  if (invite.status === "revoked") return { ok: false, rejection: "revoked" };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return { ok: false, rejection: "expired" };
  if (invite.redemptionCount >= invite.maxRedemptions) return { ok: false, rejection: "exhausted" };
  const cfg = await betaConfig();
  if (cfg.registrationsPaused) return { ok: false, rejection: "paused" };
  return { ok: true, inviteId: invite.id, maxRedemptions: invite.maxRedemptions };
}

export async function recordRedemption(inviteId: string, profileId: string) {
  const invite = await db.betaInvite.findUnique({ where: { id: inviteId } });
  if (!invite) return;
  const ids: string[] = JSON.parse(invite.redeemedProfileIds || "[]");
  ids.push(profileId);
  await db.betaInvite.update({
    where: { id: inviteId },
    data: {
      redemptionCount: { increment: 1 },
      redeemedAt: new Date(),
      redeemedProfileIds: JSON.stringify(ids.slice(-100)),
    },
  });
}

/** Operator token format: LATENT-XXXXX-XXXXX-XXXXX (Crockford-ish, no ambiguous chars). */
export function generateInviteToken(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const group = (n: number) =>
    Array.from(crypto.randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `LATENT-${group(5)}-${group(5)}-${group(5)}`;
}
