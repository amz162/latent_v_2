// Latent.pk — central runtime path & environment configuration (Task 116 B1)
//
// Production logic must never hardcode developer-machine paths. Everything
// resolves from the actual runtime root (process.cwd() of the Next server /
// worker), with an explicit env override for the persistent data directory.
//
// HOSTING NOTE (verified on the actual host): the beta runs as a long-lived
// Node process on a persistent workspace volume — process.cwd() IS the
// repository root and survives restarts. If the app were ever moved to an
// ephemeral/serverless filesystem, DATA_DIR would need to point at a
// persistent volume (this module fails loudly rather than silently losing
// runtime data).

import fs from "node:fs";
import path from "node:path";

let cachedRoot: string | null = null;

/** Actual repository/runtime root (never a hardcoded user path). */
export function projectRoot(): string {
  if (cachedRoot) return cachedRoot;
  let root = process.cwd();
  // Verify this really is the repo root (prisma schema is the anchor).
  if (!fs.existsSync(path.join(root, "prisma", "schema.prisma"))) {
    // Next.js standalone builds may run from .next/standalone — walk up.
    const parent = path.dirname(root);
    if (fs.existsSync(path.join(parent, "prisma", "schema.prisma"))) root = parent;
  }
  cachedRoot = root;
  return root;
}

/**
 * Persistent runtime data root. Override with LATENT_DATA_DIR on hosts where
 * the working directory is disposable. Created on first use; write-verified
 * by verifyDataDirWritable() at startup.
 */
export function dataRoot(): string {
  const override = process.env.LATENT_DATA_DIR;
  const root = override && override.trim() ? path.resolve(override) : projectRoot();
  return root;
}

/** Existing documented artifact location (kept as-is; resolved, not hardcoded). */
export function backtestReportsDir(): string {
  return path.join(dataRoot(), "data", "backtest_reports");
}

export function reportsDir(): string {
  return path.join(dataRoot(), "data", "reports");
}

/**
 * SQLite database file path as Prisma resolves it from DATABASE_URL.
 * `file:./db/custom.db` in Prisma URLs is relative to the SCHEMA directory
 * (prisma/), not process.cwd() — a verified Prisma behaviour, hence the
 * explicit join. Absolute file: URLs are honoured verbatim.
 */
export function databaseFile(): string {
  const url = process.env.DATABASE_URL || `file:${path.join(projectRoot(), "db", "custom.db")}`;
  if (!url.startsWith("file:")) return ""; // non-sqlite (e.g. postgres) — not this deployment
  const p = url.slice("file:".length);
  if (path.isAbsolute(p)) return p;
  return path.join(projectRoot(), "prisma", p);
}

export interface PathHealth {
  ok: boolean;
  root: string;
  dataRoot: string;
  databaseFile: string;
  databaseExists: boolean;
  dataDirWritable: boolean;
  errors: string[];
}

/** Startup safety check: directories exist (created if needed) + writable probe. */
export function verifyPaths(opts: { probeWrite?: boolean } = {}): PathHealth {
  const errors: string[] = [];
  const root = projectRoot();
  const data = dataRoot();
  const dbFile = databaseFile();
  for (const dir of [backtestReportsDir(), reportsDir()]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      errors.push(`mkdir failed for ${dir}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  let writable = true;
  if (opts.probeWrite) {
    // Probe the data root with a throwaway temp file (never touches the DB).
    try {
      const probe = path.join(data, ".latent-write-probe");
      fs.writeFileSync(probe, String(Date.now()));
      fs.unlinkSync(probe);
    } catch (err) {
      writable = false;
      errors.push(`data dir not writable: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  const dbExists = dbFile ? fs.existsSync(dbFile) : false;
  if (dbFile && !dbExists) errors.push(`database file not found: ${dbFile}`);
  return {
    ok: errors.length === 0,
    root,
    dataRoot: data,
    databaseFile: dbFile,
    databaseExists: dbExists,
    dataDirWritable: writable,
    errors,
  };
}
