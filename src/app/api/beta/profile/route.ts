import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  BETA_COOKIE,
  CONSENT_VERSION,
  clearSessionCookie,
  createSession,
  getSession,
  inviteRequired,
  isBetaActive,
  sameOrigin,
  setSessionCookie,
  sha256,
} from "@/lib/latent/beta-access";
import { errorResponse } from "@/lib/latent/error-codes";
import { rateLimit, clientKey } from "@/lib/latent/rate-limit";
import { getAuthContext } from "@/lib/latent/access-control";

// Task 121: suspended/expired accounts must not use profile APIs. Returns the
// auth context when the caller is an ACTIVE user; null when anonymous (the
// POST open-access creation path still works for anonymous callers).
async function activeUserOrAnonymous(req: NextRequest) {
  const ctx = await getAuthContext(req);
  if (!ctx || ctx.kind !== "user") return null;
  if (ctx.status !== "ACTIVE") {
    return Response.json(
      { ok: false, error: ctx.status === "SUSPENDED" ? "account_suspended" : "account_inactive" },
      { status: 403 }
    );
  }
  return ctx;
}


// Task 116 Part G3 + Task 117 Parts C/D — anonymous beta session profile.
//
// Task 117 changes:
//   - Server stores sha256(cookie token) only; the raw token lives solely in
//     the HttpOnly cookie (DB leak cannot be replayed).
//   - Cookie Secure flag follows the real request flow (x-forwarded-proto via
//     Caddy, or COOKIE_SECURE env override) — not NODE_ENV, because this host
//     serves through a reverse proxy in front of the app server.
//   - Creating a profile without an existing session requires either a valid
//     redeemed invitation (default) or BETA_INVITE_REQUIRED=false.
//   - "reset" action: destroys the old row AND old cookie, then issues a fresh
//     identity — the previous cookie can no longer resolve to anything.
//   - Writes are same-origin checked and rate limited.
//   - Sensitive values are never logged (no token/cookie values in console).

export const dynamic = "force-dynamic";

const COOKIE = BETA_COOKIE; // kept for reference

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function profilePayload(p: {
  consentVersion: string;
  consentAcceptedAt: Date | null;
  experienceLevel: string | null;
  objective: string | null;
  timeHorizon: string | null;
  lossReaction: string | null;
  capitalNeedSoon: boolean | null;
  volatilityComfort: string | null;
  canTolerateLoss: boolean | null;
  preferredSectors: string | null;
  watchlistSymbols: string | null;
  showDividends: boolean | null;
  shariahScreen: boolean | null;
  atlTaxAssumption: boolean | null;
  capitalRange: string | null;
  profileComplete: boolean;
  updatedAt: Date;
}) {
  // Willingness vs capacity stay SEPARATE fields; if they conflict or are
  // incomplete the UI shows "Profile incomplete" — no falsely precise
  // composite risk score is ever generated.
  const willingnessKnown = !!p.lossReaction && !!p.volatilityComfort;
  const capacityKnown = p.canTolerateLoss !== null && p.capitalNeedSoon !== null;
  const conflicts =
    willingnessKnown &&
    capacityKnown &&
    p.canTolerateLoss === false &&
    (p.volatilityComfort === "high" || p.lossReaction === "hold");
  return {
    consentVersion: p.consentVersion,
    consentAcceptedAt: p.consentAcceptedAt,
    experienceLevel: p.experienceLevel,
    objective: p.objective,
    timeHorizon: p.timeHorizon,
    lossReaction: p.lossReaction,
    volatilityComfort: p.volatilityComfort,
    canTolerateLoss: p.canTolerateLoss,
    capitalNeedSoon: p.capitalNeedSoon,
    riskUnderstanding: {
      willingnessKnown,
      capacityKnown,
      conflicts,
      status: conflicts || !willingnessKnown || !capacityKnown ? "PROFILE INCOMPLETE" : "consistent",
      note: "Willingness to take risk and financial capacity to take risk are tracked separately. No composite risk score is generated.",
    },
    preferredSectors: parseJsonArray(p.preferredSectors),
    watchlistSymbols: parseJsonArray(p.watchlistSymbols),
    showDividends: p.showDividends,
    shariahScreen: p.shariahScreen,
    atlTaxAssumption: p.atlTaxAssumption,
    capitalRange: p.capitalRange,
    profileComplete: p.profileComplete,
    updatedAt: p.updatedAt,
    // Part D disclosure: cookie-only anonymous profile — no account sync.
    identityDisclosure: "Anonymous profile saved for this browser session only (cookie on this device). It is not a verified personal account and is not synced across devices.",
  };
}

export async function GET(req: NextRequest) {
  const __ctx = await activeUserOrAnonymous(req);
  if (__ctx instanceof Response) return __ctx;

  try {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ profile: null });
    const p = await db.betaProfile.findUnique({ where: { id: session.profileId } });
    if (!p) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile: profilePayload(p) });
  } catch (err) {
    console.error("[beta/profile GET] database error (no detail emitted to client)");
    return errorResponse("database_unavailable");
  }
}

export async function POST(req: NextRequest) {
  const __ctx = await activeUserOrAnonymous(req);
  if (__ctx instanceof Response) return __ctx;

  if (!sameOrigin(req)) return errorResponse("profile_validation_error");
  const gate = await isBetaActive();
  if (!gate.active) return errorResponse("profile_validation_error", { betaDisabled: true });

  const rl = rateLimit("profile_write", clientKey(req), 60, 60 * 60 * 1000);
  if (!rl.allowed) return errorResponse("rate_limited", { retryAfterSec: rl.retryAfterSec });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("profile_validation_error");
  }

  // --- reset: new identity, old one fully invalidated ---
  if (body.action === "reset") {
    const session = await getSession(req);
    if (session) {
      // keep the access grant: the new identity inherits the invite binding
      await db.betaProfile.deleteMany({ where: { id: session.profileId } });
    }
    const res = NextResponse.json({ reset: true });
    await createSession(res, req, {
      accessVia: session?.accessVia ?? (inviteRequired() ? "invite" : "open_flag"),
      inviteId: session?.inviteId ?? null,
    });
    return res;
  }

  try {
    let session = await getSession(req);

    // first write creates the profile — access gate applies
    if (!session) {
      if (inviteRequired()) {
        return errorResponse("invitation_invalid");
      }
      const res = NextResponse.json({ created: true });
      const created = await createSession(res, req, { accessVia: "open_flag", inviteId: null });
      session = {
        profileId: created.profileId,
        sessionTokenHash: sha256(created.token),
        accessVia: "open_flag",
        inviteId: null,
        profileComplete: false,
        consentVersion: "pending-invite-redeem",
        consentAcceptedAt: null,
      };
    }

    const str = (k: string, max = 64): string | null => {
      const v = body[k];
      return typeof v === "string" && v.length <= max ? v : null;
    };
    const bool = (k: string): boolean | null => (typeof body[k] === "boolean" ? (body[k] as boolean) : null);
    const arr = (k: string): string | null => {
      const v = body[k];
      if (!Array.isArray(v)) return null;
      const clean = v.filter((x) => typeof x === "string" && x.length <= 16).slice(0, 30);
      return JSON.stringify(clean);
    };

    // server-side enum validation (Part J: profile_validation_error)
    const ENUMS: Record<string, string[]> = {
      experienceLevel: ["new_to_psx", "some_experience", "experienced"],
      objective: ["learn", "growth_research", "income_research", "swing_research", "monitoring"],
      timeHorizon: ["short", "medium", "long"],
      lossReaction: ["hold", "trim", "sell", "unsure"],
      volatilityComfort: ["low", "medium", "high"],
      capitalRange: ["", "under_50k", "50k_250k", "250k_1m", "over_1m", "prefer_not_say"],
    };
    for (const [k, allowed] of Object.entries(ENUMS)) {
      const v = str(k, 32);
      if (v !== null && !allowed.includes(v)) return errorResponse("profile_validation_error", { field: k });
    }

    const data = {
      experienceLevel: str("experienceLevel"),
      objective: str("objective"),
      timeHorizon: str("timeHorizon"),
      lossReaction: str("lossReaction"),
      volatilityComfort: str("volatilityComfort"),
      canTolerateLoss: bool("canTolerateLoss"),
      capitalNeedSoon: bool("capitalNeedSoon"),
      preferredSectors: arr("preferredSectors"),
      watchlistSymbols: arr("watchlistSymbols"),
      showDividends: bool("showDividends"),
      shariahScreen: bool("shariahScreen"),
      atlTaxAssumption: bool("atlTaxAssumption"),
      capitalRange: str("capitalRange", 32),
      profileComplete: body.profileComplete === true,
    };

    // consent: version recorded only with an explicit acceptance
    const consentVersion = str("consentVersion", 32);
    const consentAccepted = body.consentAccepted === true;
    const update = {
      ...data,
      ...(consentAccepted && consentVersion ? { consentVersion, consentAcceptedAt: new Date() } : {}),
    };

    const p = await db.betaProfile.update({ where: { id: session.profileId }, data: update });
    return NextResponse.json({ profile: profilePayload(p), savedOnDevice: true });
  } catch (err) {
    console.error("[beta/profile POST] database error (no detail emitted to client)");
    return errorResponse("database_unavailable");
  }
}

export async function DELETE(req: NextRequest) {
  const __ctx = await activeUserOrAnonymous(req);
  if (__ctx instanceof Response) return __ctx;

  if (!sameOrigin(req)) return errorResponse("profile_validation_error");
  const rl = rateLimit("profile_delete", clientKey(req), 10, 60 * 60 * 1000);
  if (!rl.allowed) return errorResponse("rate_limited", { retryAfterSec: rl.retryAfterSec });
  try {
    const token = req.cookies.get(COOKIE)?.value;
    if (token) await db.betaProfile.deleteMany({ where: { sessionTokenHash: sha256(token) } });
    const res = NextResponse.json({ deleted: true });
    clearSessionCookie(res, req);
    return res;
  } catch (err) {
    console.error("[beta/profile DELETE] database error (no detail emitted to client)");
    return errorResponse("database_unavailable");
  }
}
