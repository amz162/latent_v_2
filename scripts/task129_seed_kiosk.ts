/**
 * Task 129 — idempotent kiosk (open-access) profile seed.
 *
 * Open-access mode (OPEN_ACCESS_MODE=true) serves anonymous requests through
 * a shared kiosk identity (beta-access.ts KIOSK_PROFILE_TOKEN). The kiosk
 * BetaProfile + ProfileAccess rows are runtime state, not committed data, so
 * this seed creates them on any freshly restored database. Safe to re-run.
 *
 * Run: DATABASE_URL=file:$PWD/db/custom.db bun scripts/task129_seed_kiosk.ts
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const KIOSK_TOKEN = "latent-open-access-kiosk-v1"; // must match beta-access.ts
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

async function main() {
  const db = new PrismaClient();
  const hash = sha256(KIOSK_TOKEN);
  const kiosk = await db.betaProfile.upsert({
    where: { sessionTokenHash: hash },
    create: {
      sessionTokenHash: hash,
      consentVersion: "open-access-v1",
      consentAcceptedAt: new Date(),
      accessVia: "open_access",
      profileComplete: true,
    },
    update: { profileComplete: true },
  });
  await db.profileAccess.upsert({
    where: { profileId: kiosk.id },
    create: { profileId: kiosk.id, planKey: "STANDARD" },
    update: { planKey: "STANDARD", status: "ACTIVE" },
  });
  console.log(JSON.stringify({ status: "ok", kioskProfileId: kiosk.id, plan: "STANDARD" }));
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
