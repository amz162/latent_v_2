import { NextResponse } from "next/server";

// Task 116 Part G1 — beta feature flag (server-side, independently switchable).
// BETA_ONBOARDING_ENABLED=false disables the experience; onboarding data is
// retained (disabling must not delete profiles).

export const dynamic = "force-dynamic";

export const BETA_CONSENT_VERSION = "beta-consent-v1";

export async function GET() {
  const enabled = process.env.BETA_ONBOARDING_ENABLED !== "false";
  return NextResponse.json({
    betaEnabled: enabled,
    consentVersion: BETA_CONSENT_VERSION,
    consentText: {
      version: BETA_CONSENT_VERSION,
      points: [
        "Latent.pk analyzes publicly available PSX market information using technical strategies and an AI analyst (GLM-4.6).",
        "Research results are still being validated. No model or strategy has passed independent promotion requirements.",
        "This beta does NOT place broker orders. It is an investment-intelligence research experience only.",
        "Outputs are educational/research information — not guaranteed returns and not personalized regulated investment advice.",
      ],
    },
    persistence: "Profile is stored server-side against an anonymous session cookie (HttpOnly). It is NOT public and NOT synced across devices — 'Saved on this device/browser session.'",
  });
}
