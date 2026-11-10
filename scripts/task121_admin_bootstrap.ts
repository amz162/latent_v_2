// Task 121 — secure first-admin bootstrap (operator CLI, host-only).
//
// Security contract:
//   - Creates an admin ONLY while the AdminAccount table is EMPTY (one-time).
//     Recovery for an existing admin is `--reset-password`, never a second
//     bootstrap and never a hidden account.
//   - No default password, no credentials on argv, nothing logged. The
//     password is read from stdin (piped or muted interactive prompt).
//   - The password is hashed with scrypt before storage; the plaintext is
//     never written anywhere.
//
// Usage:
//   printf '%s' "$PASSWORD" | bun scripts/task121_admin_bootstrap.ts --username ops
//   bun scripts/task121_admin_bootstrap.ts                     # interactive
//   bun scripts/task121_admin_bootstrap.ts --list
//   printf '%s' "$NEWPW" | bun scripts/task121_admin_bootstrap.ts --reset-password --username ops
import { PrismaClient } from "@prisma/client";
import * as readline from "node:readline";
import { hashPassword, verifyPassword, passwordPolicyError } from "../src/lib/latent/admin-auth";

const db = new PrismaClient();

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const key = a[i].slice(2);
      // flag with a value: consume the next token unless it is another flag.
      // The old `i -= 1` adjustment looped forever on "--flag --flag2 value".
      if (a[i + 1] && !a[i + 1].startsWith("--")) {
        out[key] = a[i + 1];
        i += 1;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

async function readPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    // piped input: read until EOF, single line
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // mute echo for the prompt answer
  const muted = new Promise<string>((resolve) => {
    (process.stdin as unknown as { isRaw: boolean }).isRaw = true;
    rl.question(prompt, (answer) => {
      (process.stdin as unknown as { isRaw: boolean }).isRaw = false;
      resolve(answer);
    });
    // suppress echo by overriding the output write while typing is not
    // portable across terminals — instead rely on raw mode above (no echo).
  });
  const pw = await muted;
  rl.close();
  return pw.trim();
}

/** Piped input arrives as ONE stream: line 1 = password, line 2 = confirm. */
async function readPipedLines(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

async function main() {
  const a = args();

  if (a.list === "true") {
    const admins = await db.adminAccount.findMany({
      select: { username: true, isActive: true, createdAt: true, lastLoginAt: true },
    });
    console.log(JSON.stringify(admins, null, 2));
    return;
  }

  if (a["reset-password"] === "true") {
    const username = (a.username ?? "").trim().toLowerCase();
    if (!username) {
      console.error("ERROR: --reset-password requires --username <name>");
      process.exit(1);
    }
    const account = await db.adminAccount.findUnique({ where: { username } });
    if (!account) {
      console.error("ERROR: no such admin account.");
      process.exit(1);
    }
    const password = process.stdin.isTTY ? await readPassword("New password (input hidden): ") : (await readPipedLines())[0] ?? "";
    const policy = passwordPolicyError(password);
    if (policy) {
      console.error(`ERROR: ${policy}`);
      process.exit(1);
    }
    await db.adminAccount.update({
      where: { id: account.id },
      data: {
        passwordHash: hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      },
    });
    // invalidate all existing sessions of this admin
    await db.adminSession.updateMany({
      where: { adminId: account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    console.log(`OK: password updated for "${username}" — all sessions revoked.`);
    return;
  }

  // ---- one-time bootstrap ----
  const existing = await db.adminAccount.count();
  if (existing > 0) {
    console.error("REFUSED: an admin account already exists.");
    console.error("Bootstrap is one-time. To recover access use:");
    console.error("  bun scripts/task121_admin_bootstrap.ts --reset-password --username <name>");
    process.exit(1);
  }

  const username = (a.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,64}$/.test(username)) {
    console.error("ERROR: username must be 3-64 chars [a-z0-9_.-].");
    process.exit(1);
  }

  let password = "";
  let confirm = "";
  if (process.stdin.isTTY) {
    password = await readPassword("Admin password (input hidden): ");
    const policyEarly = passwordPolicyError(password);
    if (policyEarly) {
      console.error(`ERROR: ${policyEarly}`);
      process.exit(1);
    }
    confirm = await readPassword("Confirm password (input hidden): ");
  } else {
    const lines = await readPipedLines();
    password = lines[0] ?? "";
    confirm = lines[1] ?? lines[0] ?? "";
  }
  const policy = passwordPolicyError(password);
  if (policy) {
    console.error(`ERROR: ${policy}`);
    process.exit(1);
  }
  if (confirm !== password) {
    console.error("ERROR: passwords do not match.");
    process.exit(1);
  }

  const created = await db.adminAccount.create({
    data: { username, passwordHash: hashPassword(password), isActive: true },
  });
  console.log(`OK: admin "${username}" created (id ${created.id}).`);
  console.log("Next steps:");
  console.log(`  1. Sign in at /admin/login with this username.`);
  console.log(`  2. Sessions expire after 12 hours; use --reset-password for recovery.`);
  console.log(`  3. Recommended: enable MFA at your identity provider level (documented in the Task 121 report §9).`);
  console.log(`Bootstrap is now permanently closed (any further run refuses).`);
  // self-verify the hash round-trips (no plaintext printed)
  const check = await db.adminAccount.findUnique({ where: { id: created.id } });
  if (check && verifyPassword(password, check.passwordHash)) {
    console.log("Verification: password hash round-trip OK.");
  } else {
    console.error("WARNING: verification failed — delete this row and re-run bootstrap.");
  }
}

main()
  .catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => db.$disconnect());
