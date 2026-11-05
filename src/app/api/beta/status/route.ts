import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { betaConfig, inviteRequired, isBetaActive, CONSENT_VERSION } from "@/lib/latent/beta-access";

// Task 116 G1 + Task 117 C — beta gate status for the UI.
// The client uses this to decide between: enter the beta, show the invitation
// gate, or show the closed/paused message. It exposes only policy booleans —
// never internal reasons beyond the plain operator note.

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await isBetaActive();
  const cfg = await betaConfig();
  return NextResponse.json({
    betaEnabled: gate.active,
    betaDisabledReason: gate.active ? null : gate.reason,
    operatorNote: gate.active ? null : cfg.reason, // plain-language note only
    registrationsPaused: cfg.registrationsPaused,
    invitationRequired: inviteRequired(),
    consentVersion: CONSENT_VERSION,
    consentText: {
      version: CONSENT_VERSION,
      points: [
        "This is a BETA research platform. Features may be incomplete and data may be stale or missing.",
        "The twelve strategy components are research prototypes — NONE has been performance-validated and no model has passed independent promotion requirements.",
        "GLM-4.6 AI analyst conviction is UNCALIBRATED — it is not a probability of success.",
        "LLM forward outcomes are insufficient for any profitability conclusion (zero matured LLM-cohort outcomes at 5/10/21 sessions as of Task 115).",
        "Past research results do NOT guarantee future returns.",
        "Displayed levels (entry/stop/take-profit) are HYPOTHETICAL research references from a frozen policy — not trade instructions.",
        "This beta does NOT place broker orders and never will during the beta. No automated trading.",
        "Data may be stale or incomplete; every research view shows its own data date.",
        "You remain fully responsible for your own investment decisions. This is educational/research information, not personalized regulated investment advice, and Latent.pk is not a licensed broker or investment adviser.",
      ],
    },
    persistence:
      "Profile is stored server-side against an anonymous session cookie (HttpOnly). It is NOT public and NOT synced across devices — 'Saved on this device/browser session.'",
  });
}
