import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { db } from "@/lib/db";

// Task 116 Part G3 — anonymous beta session profile.
// Identity = opaque random session token in an HttpOnly, SameSite=Lax cookie
// (Secure in production). No email, no sensitive personal data. Every query
// filters by the exact session token, so cross-user access is impossible by
// construction. DELETE hard-deletes the profile (reset behavior).

export const dynamic = "force-dynamic";

const COOKIE = "latent_beta_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

async function ensureSessionToken(): Promise<string> {
  const store = await cookies();
  let token = store.get(COOKIE)?.value;
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    store.set(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return token;
}

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
  consentAcceptedAt: Date;
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
  // G2 Step 4: willingness vs capacity are kept as SEPARATE fields; if they
  // conflict or are incomplete the UI shows "Profile incomplete" — no
  // falsely precise composite risk score is ever generated.
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
  };
}

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ profile: null });
  const p = await db.betaProfile.findUnique({ where: { sessionToken: token } });
  if (!p) return NextResponse.json({ profile: null });
  return NextResponse.json({ profile: profilePayload(p) });
}

export async function POST(req: NextRequest) {
  const token = await ensureSessionToken();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
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

  const consentVersion = str("consentVersion", 32) ?? "beta-consent-v1";
  const p = await db.betaProfile.upsert({
    where: { sessionToken: token },
    create: { sessionToken: token, consentVersion, ...data },
    update: { consentVersion, ...data },
  });
  return NextResponse.json({ profile: profilePayload(p), savedOnDevice: true });
}

export async function DELETE() {
  const token = await getSessionToken();
  if (token) await db.betaProfile.deleteMany({ where: { sessionToken: token } });
  const store = await cookies();
  store.delete(COOKIE);
  return NextResponse.json({ deleted: true });
}
