#!/usr/bin/env python3
"""Task 117 Part C2 — Beta administrator CLI (operator-only, host access).

There is deliberately NO admin HTTP endpoint: this CLI runs on the host against
the SQLite database directly. Access protection = host login (the existing
authentication boundary). Run from /home/z/my-project.

Commands
  create-invite   --label "cohort1-ali" [--max-redemptions 1] [--expires-days 14]
                  Prints the raw invitation token EXACTLY ONCE (sha256 stored).
  revoke-invite   --token LATENT-...   (or --label)   Marks token revoked.
  list-invites    Aggregate view: id, label, status, redemptions, expiry. No tokens.
  set-flag        --disable-beta | --enable-beta | --pause-registrations |
                  --resume-registrations [--reason "note shown to users"]
  show-config     Current runtime beta configuration.
  cleanup-expired [--days 60]  Delete beta profiles not updated in N days
                  (documented retention policy: 60 days).
  export-feedback [--out FILE] [--strip-profile]  CSV export for internal
                  review; profile ids stripped by default (no tokens ever).

Exit codes: 0 ok, 2 usage error, 3 not found.
"""
import argparse
import csv
import datetime as dt
import hashlib
import secrets
import sqlite3
import sys
from pathlib import Path

DB = Path("/home/z/my-project/db/custom.db")

ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O/1/I/L


def sha(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def gen_token() -> str:
    grp = lambda n: "".join(secrets.choice(ALPHABET) for _ in range(n))
    return f"LATENT-{grp(5)}-{grp(5)}-{grp(5)}"


def cuid() -> str:
    # Prisma cuid() defaults are applied client-side; raw SQL inserts must
    # supply their own id in the same shape ("c" + 24 hex-ish chars).
    return "c" + secrets.token_hex(12)


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB, timeout=15)
    con.row_factory = sqlite3.Row
    return con


def get_config(con: sqlite3.Connection) -> sqlite3.Row:
    row = con.execute("SELECT * FROM BetaConfig WHERE id = 1").fetchone()
    if row is None:
        # @updatedAt is applied by the Prisma CLIENT, not by SQLite — supply it
        con.execute("INSERT INTO BetaConfig (id, updatedAt) VALUES (1, datetime('now'))")
        con.commit()
        row = con.execute("SELECT * FROM BetaConfig WHERE id = 1").fetchone()
    return row


def cmd_create(args):
    token = gen_token()
    expires = (dt.datetime.now(dt.UTC) + dt.timedelta(days=args.expires_days)).isoformat() if args.expires_days else None
    with connect() as con:
        con.execute(
            "INSERT INTO BetaInvite (id, tokenHash, label, maxRedemptions, expiresAt) VALUES (?,?,?,?,?)",
            (cuid(), sha(token.strip().upper()), args.label, args.max_redemptions, expires),
        )
    print("=== INVITATION CREATED — copy it now; it is never shown again ===")
    print(f"token        : {token}")
    print(f"label        : {args.label}")
    print(f"max uses     : {args.max_redemptions}")
    print(f"expires at   : {expires or 'never'}")
    print("Revoke anytime: python3 scripts/task117_beta_admin.py revoke-invite --token <token>")


def resolve_invite(con, args):
    if args.token:
        row = con.execute("SELECT * FROM BetaInvite WHERE tokenHash = ?", (sha(args.token.strip().upper()),)).fetchone()
    elif args.label:
        rows = con.execute("SELECT * FROM BetaInvite WHERE label = ? ORDER BY createdAt DESC", (args.label,)).fetchall()
        if len(rows) != 1:
            print(f"error: label matches {len(rows)} invites; use --token or refine the label", file=sys.stderr)
            sys.exit(3)
        row = rows[0]
    else:
        print("error: need --token or --label", file=sys.stderr)
        sys.exit(2)
    if row is None:
        print("error: no such invitation (check the token/label)", file=sys.stderr)
        sys.exit(3)
    return row


def cmd_revoke(args):
    with connect() as con:
        row = resolve_invite(con, args)
        con.execute("UPDATE BetaInvite SET status = 'revoked' WHERE id = ?", (row["id"],))
    print(f"revoked: invite {row['id']} (label={row['label']}, previous redemptions={row['redemptionCount']})")


def cmd_list(args):
    with connect() as con:
        rows = con.execute(
            "SELECT id, label, status, maxRedemptions, redemptionCount, createdAt, expiresAt, redeemedAt FROM BetaInvite ORDER BY createdAt DESC"
        ).fetchall()
    print(f"{'id':<28} {'label':<24} {'status':<9} {'used':>4}/{'max':<3} {'created':<19} {'expires':<19} {'redeemed'}")
    for r in rows:
        # Prisma stores DateTime as integer epoch ms in SQLite — coerce first
        fmt = lambda v: (str(v)[:19] if v is not None else "-")
        print(f"{r['id']:<28} {(r['label'] or '-'):<24} {r['status']:<9} {r['redemptionCount']:>4}/{r['maxRedemptions']:<3} "
              f"{fmt(r['createdAt']):<19} {fmt(r['expiresAt']):<19} {fmt(r['redeemedAt'])}")
    print(f"\ntotal: {len(rows)} (raw tokens are never displayed — only the operator's own copy)")


def cmd_set_flag(args):
    with connect() as con:
        get_config(con)
        if args.disable_beta:
            con.execute("UPDATE BetaConfig SET betaDisabled = 1, reason = ? WHERE id = 1", (args.reason,))
        elif args.enable_beta:
            con.execute("UPDATE BetaConfig SET betaDisabled = 0, registrationsPaused = 0, reason = NULL WHERE id = 1")
        elif args.pause_registrations:
            con.execute("UPDATE BetaConfig SET registrationsPaused = 1, reason = ? WHERE id = 1", (args.reason,))
        elif args.resume_registrations:
            con.execute("UPDATE BetaConfig SET registrationsPaused = 0, reason = NULL WHERE id = 1")
        else:
            print("error: choose one flag action", file=sys.stderr)
            sys.exit(2)
    print("flag updated. Verify at: curl -s http://localhost:3000/api/beta/status")


def cmd_show_config(args):
    with connect() as con:
        r = get_config(con)
        n_profiles = con.execute("SELECT COUNT(*) FROM BetaProfile").fetchone()[0]
        n_invites = con.execute("SELECT COUNT(*) FROM BetaInvite WHERE status='active'").fetchone()[0]
        n_feedback = con.execute("SELECT COUNT(*) FROM BetaFeedback").fetchone()[0]
    print(f"betaDisabled        : {bool(r['betaDisabled'])} (reason: {r['reason'] or '-'})")
    print(f"registrationsPaused : {bool(r['registrationsPaused'])}")
    print(f"env BETA_ONBOARDING_ENABLED=false always wins over this table")
    print(f"profiles: {n_profiles} | active invites: {n_invites} | feedback rows: {n_feedback}")


def cmd_cleanup(args):
    cutoff = (dt.datetime.now(dt.UTC) - dt.timedelta(days=args.days)).isoformat()
    with connect() as con:
        cur = con.execute("DELETE FROM BetaProfile WHERE updatedAt < ? AND profileComplete = 1", (cutoff,))
        deleted_profiles = cur.rowcount
        cur2 = con.execute("DELETE FROM BetaFeedback WHERE createdAt < ?", (cutoff,))
        deleted_feedback = cur2.rowcount
        # invites older than their expiry (or long-exhausted) are metadata, keep
        # them for audit — only profiles/feedback fall under retention cleanup.
    print(f"retention cleanup ({args.days}d): deleted {deleted_profiles} stale complete profile(s), {deleted_feedback} old feedback row(s)")
    print("policy: anonymous profiles are removed 60 days after last update; incomplete profiles are kept until their user returns or the operator cleans manually.")


def cmd_export_feedback(args):
    out = Path(args.out) if args.out else Path("/home/z/my-project/data/backtest_reports/task117/task117_feedback_export.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        rows = con.execute("SELECT id, profileId, category, message, route, status, createdAt FROM BetaFeedback ORDER BY createdAt").fetchall()
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["feedback_id", "category", "message", "page", "status", "created_at"] + (["profile_ref"] if not args.strip_profile else []))
        for r in rows:
            base = [r["id"], r["category"], r["message"].replace("\n", " "), r["route"] or "", r["status"], r["createdAt"]]
            if not args.strip_profile:
                base.append(r["profileId"] or "")
            w.writerow(base)
    print(f"exported {len(rows)} row(s) -> {out} (profile identity {'stripped' if args.strip_profile else 'included as internal ids — NEVER tokens'})")


def main():
    p = argparse.ArgumentParser(description="Latent.pk beta admin CLI (operator only)")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("create-invite")
    c.add_argument("--label", required=True)
    c.add_argument("--max-redemptions", type=int, default=1)
    c.add_argument("--expires-days", type=int, default=14)
    c.set_defaults(fn=cmd_create)

    r = sub.add_parser("revoke-invite")
    r.add_argument("--token")
    r.add_argument("--label")
    r.set_defaults(fn=cmd_revoke)

    sub.add_parser("list-invites").set_defaults(fn=cmd_list)

    f = sub.add_parser("set-flag")
    g = f.add_mutually_exclusive_group(required=True)
    g.add_argument("--disable-beta", action="store_true")
    g.add_argument("--enable-beta", action="store_true")
    g.add_argument("--pause-registrations", action="store_true")
    g.add_argument("--resume-registrations", action="store_true")
    f.add_argument("--reason")
    f.set_defaults(fn=cmd_set_flag)

    sub.add_parser("show-config").set_defaults(fn=cmd_show_config)

    cl = sub.add_parser("cleanup-expired")
    cl.add_argument("--days", type=int, default=60)
    cl.set_defaults(fn=cmd_cleanup)

    e = sub.add_parser("export-feedback")
    e.add_argument("--out")
    e.add_argument("--strip-profile", action="store_true", default=True)
    e.set_defaults(fn=cmd_export_feedback)

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
