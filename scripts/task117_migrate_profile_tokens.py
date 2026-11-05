#!/usr/bin/env python3
"""Task 117 Part D — BetaProfile session-token hardening migration.

Migrates the BetaProfile table from storing the RAW session token to storing
only sha256(token):

  1. Backup db/custom.db -> db/backups/pre-task117-<ts>.db
  2. ALTER TABLE BetaProfile ADD COLUMN sessionTokenHash TEXT
  3. For every row: sessionTokenHash = sha256(raw sessionToken)
  4. DROP COLUMN sessionToken (raw values destroyed by design)
  5. CREATE UNIQUE INDEX on sessionTokenHash

Profile answers, consent version and timestamps are fully preserved. Existing
browser cookies keep working (cookie holds the raw token; its hash matches).

Run BEFORE `prisma db push` (which expects the new schema shape).
Idempotent: re-running detects the finished state and does nothing.
"""
import hashlib
import shutil
import sqlite3
import sys
import time
from pathlib import Path

DB = Path("/home/z/my-project/db/custom.db")
BACKUP_DIR = DB.parent / "backups"


def main() -> int:
    if not DB.exists():
        print(f"FATAL: {DB} missing")
        return 1
    BACKUP_DIR.mkdir(exist_ok=True)
    backup = BACKUP_DIR / f"pre-task117-{time.strftime('%Y%m%d-%H%M%S')}.db"
    shutil.copy2(DB, backup)
    print(f"[1/5] backup -> {backup} ({backup.stat().st_size} bytes)")

    con = sqlite3.connect(DB)
    cur = con.cursor()
    cols = [r[1] for r in cur.execute("PRAGMA table_info(BetaProfile)").fetchall()]

    if "sessionTokenHash" in cols and "sessionToken" not in cols:
        print("[2/5] already migrated (sessionTokenHash present, sessionToken gone) — nothing to do")
        con.close()
        return 0

    if "sessionTokenHash" not in cols:
        cur.execute("ALTER TABLE BetaProfile ADD COLUMN sessionTokenHash TEXT")
        print("[2/5] added column sessionTokenHash")

    if "sessionToken" in cols:
        rows = cur.execute("SELECT id, sessionToken FROM BetaProfile WHERE sessionToken IS NOT NULL").fetchall()
        for pid, raw in rows:
            h = hashlib.sha256(raw.encode("utf-8")).hexdigest()
            cur.execute("UPDATE BetaProfile SET sessionTokenHash = ? WHERE id = ?", (h, pid))
        print(f"[3/5] hashed {len(rows)} raw session token(s) -> sha256 (raw values never printed)")

    try:
        cur.execute("DROP INDEX IF EXISTS BetaProfile_sessionToken_key")
        cur.execute("ALTER TABLE BetaProfile DROP COLUMN sessionToken")
        print("[4/5] dropped raw sessionToken column")
    except sqlite3.OperationalError as e:
        print(f"[4/5] DROP COLUMN failed ({e}) — SQLite >=3.35 required")
        con.close()
        return 1

    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS BetaProfile_sessionTokenHash_key ON BetaProfile(sessionTokenHash)")
    con.commit()
    n = cur.execute("SELECT COUNT(*) FROM BetaProfile").fetchone()[0]
    ok = cur.execute("SELECT COUNT(*) FROM BetaProfile WHERE sessionTokenHash IS NULL").fetchone()[0]
    idx = cur.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='BetaProfile'").fetchall()
    print(f"[5/5] BetaProfile rows={n}, null-hashes={ok}, indexes={[i[0] for i in idx]}")
    con.close()
    if ok != 0:
        print("FATAL: some rows have NULL hash")
        return 1
    print("MIGRATION OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
