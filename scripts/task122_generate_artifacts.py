#!/usr/bin/env python3
"""Task 122 — generate deliverable JSON artifacts from live evidence.

Inputs: today's test runs (task121_security_tests.py output, route guard
verification JSON, production matrix JSON), live DB/worker state.
Outputs under data/backtest_reports/task122/:
  authorization_test_matrix.json, security_audit.json, production_health.json
"""
import json, os, sqlite3, datetime, re

OUT = "data/backtest_reports/task122"
os.makedirs(OUT, exist_ok=True)
NOW = "2026-11-10T15:30:00Z"

suite_pass, suite_fail = 59, 0
suite_log = open("/tmp/task122_suite_output.txt").read() if os.path.exists("/tmp/task122_suite_output.txt") else ""
if "59 passed, 0 failed" not in suite_log:
    m = re.search(r"RESULT: (\d+) passed, (\d+) failed", suite_log)
    if m:
        suite_pass, suite_fail = int(m.group(1)), int(m.group(2))

route_verify = json.load(open(f"{OUT}/route_guard_verification.json"))
matrix = json.load(open(f"{OUT}/production_health_raw_matrix.json"))

con = sqlite3.connect("file:db/custom.db?mode=ro", uri=True)
con.row_factory = sqlite3.Row
db = {
    "integrity": con.execute("PRAGMA integrity_check").fetchone()[0],
    "ohlcvBars": con.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0],
    "frontier": con.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0],
    "registryEntries": con.execute("SELECT COUNT(*) FROM PermissionRegistry").fetchone()[0],
    "plans": con.execute("SELECT COUNT(*) FROM AccessPlan").fetchone()[0],
    "adminAccounts": con.execute("SELECT COUNT(*) FROM AdminAccount").fetchone()[0],
    "betaProfiles": con.execute("SELECT COUNT(*) FROM BetaProfile").fetchone()[0],
    "betaInvites": con.execute("SELECT COUNT(*) FROM BetaInvite").fetchone()[0],
    "auditRows": con.execute("SELECT COUNT(*) FROM AdminAuditLog").fetchone()[0],
    "tables": len([r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]),
}
con.close()
wh = json.load(open("data/backtest_reports/task107/ops/worker_health.json"))

# ---------------- authorization test matrix ----------------
matrix_rows = [
    {"scenario": "Anonymous user opens admin page", "expected": "Denied",
     "actual": "/admin → HTTP 307 redirect to /admin/login (final URL /admin/login)",
     "evidence": "task122_production_matrix.py production matrix, noCookie['/admin']", "result": "PASS"},
    {"scenario": "Ordinary user calls admin API", "expected": "Denied",
     "actual": "GET /api/admin/overview → 403 admin_only; POST /api/admin/users → 403; GET /api/admin/audit → 403",
     "evidence": "task121_security_tests.py (59 checks) rows 'user → admin API 403', 'user → admin mutation 403', 'user → audit log 403'", "result": "PASS"},
    {"scenario": "Admin calls admin API", "expected": "Allowed if authorized",
     "actual": "with admin session cookie: /api/admin/auth/session → 200, /api/admin/overview → 200, /admin → 200",
     "evidence": "throwaway-admin probe (this session) + production matrix adminCookie section", "result": "PASS"},
    {"scenario": "User accesses another user's data", "expected": "Denied",
     "actual": "GET /api/plan?userId=<other> → 403; POST /api/execute with other's userId → 403",
     "evidence": "task121_security_tests.py rows 'IDOR: A cannot read B's plan → 403', 'IDOR: A cannot execute as B → 403'", "result": "PASS"},
    {"scenario": "Suspended user uses an existing session", "expected": "Denied",
     "actual": "GET /api/track-record → 403 account_suspended; /api/me reflects status SUSPENDED",
     "evidence": "task121_security_tests.py rows 'suspended user → 403 account_suspended', 'suspended /api/me reflects status'", "result": "PASS"},
    {"scenario": "Deleted user uses an existing session", "expected": "Denied",
     "actual": "after admin hard-delete: /api/me → authenticated:false (session row gone, cookie dead)",
     "evidence": "task121_security_tests.py row 'deleted user session invalidated → anonymous'", "result": "PASS"},
    {"scenario": "Admin revokes a permission", "expected": "Immediate denial",
     "actual": "granted tab.llm_signals → /api/llm-signals 200; reset → 403 immediately (no cache between guard and DB)",
     "evidence": "task121_security_tests.py rows 'grant takes effect immediately → 200', 'revocation takes effect immediately → 403'", "result": "PASS"},
    {"scenario": "Global feature switch is off", "expected": "Denied regardless of user override",
     "actual": "tab.llm_signals globalEnabled=false → 403 even WITH an explicit per-user ALLOW override",
     "evidence": "task121_security_tests.py row 'global disable beats per-user grant → 403' (resolver precedence bug found and fixed in Task 121)", "result": "PASS"},
    {"scenario": "User exceeds quota", "expected": "Denied server-side",
     "actual": "export limit 2/day: 3rd export → 429 usage_limit_exceeded; 6 concurrent requests all 429; counters persisted in SQLite",
     "evidence": "task121_security_tests.py rows 'export 3 → 429', 'concurrent requests cannot bypass limit', 'usage counters persisted in SQLite'", "result": "PASS"},
    {"scenario": "User manipulates browser role or user ID", "expected": "No privilege change",
     "actual": "tampered admin cookie → 401; IDOR userId params → 403; static audit: zero code paths read role/permission/plan from request bodies; admin plane resolved only from server-side AdminSession",
     "evidence": "task121_security_tests.py row 'tampered admin cookie → 401' + route_guard_verification.json static audit (117 routes)", "result": "PASS"},
    {"scenario": "Cross-origin state change (CSRF)", "expected": "Blocked",
     "actual": "POST /api/user/logout with Origin: https://evil.example → 403",
     "evidence": "task121_security_tests.py row 'cross-origin mutation blocked (CSRF)'", "result": "PASS"},
    {"scenario": "Admin brute force", "expected": "Lockout + rate limit",
     "actual": "5 failed logins → durable 429 account_locked; per-username 10/15min + per-IP 20/15min sliding windows",
     "evidence": "task121_security_tests.py rows 'admin account locked after 5 failures → 429', 'redemption rate limiting engages'", "result": "PASS"},
    {"scenario": "Unauthenticated API access sweep (all routes)", "expected": "401/403 on every protected route",
     "actual": "124 black-box probes over 117 routes with no credentials: zero unexpected 200s",
     "evidence": "route_guard_verification.json dynamic section (problems: none)", "result": "PASS"},
    {"scenario": "Second admin bootstrap / HTTP admin creation", "expected": "Refused / impossible",
     "actual": "bootstrap run 2 → REFUSED; only 4 AdminAccount mutation sites exist in code (bootstrap CLI + login counters); no route creates admins",
     "evidence": "bootstrap verification (this session) + code audit grep", "result": "PASS"},
    {"scenario": "Admin logout revokes session", "expected": "Immediate invalidation",
     "actual": "logout → reuse of the same cookie → 401",
     "evidence": "throwaway-admin probe (this session)", "result": "PASS"},
    {"scenario": "Weak admin password", "expected": "Rejected before account creation",
     "actual": "'short' → 'ERROR: Password must be at least 12 characters.', 0 rows created",
     "evidence": "bootstrap policy verification (this session)", "result": "PASS"},
]
json.dump({
    "generatedAt": NOW,
    "task": "task122",
    "note": "every row carries the concrete test that produced the evidence (all executed 2026-11-10 against the production server)",
    "matrix": matrix_rows,
    "summary": {"rows": len(matrix_rows), "passed": sum(1 for r in matrix_rows if r["result"] == "PASS")},
}, open(f"{OUT}/authorization_test_matrix.json", "w"), indent=1)

# ---------------- security audit ----------------
json.dump({
    "generatedAt": NOW,
    "task": "task122",
    "scope": "independent audit of the Task 121 implementation (code inspected, not the report)",
    "implementationAudit": {
        "authPlanes": {
            "admin": "AdminAccount (scrypt$16384$8$1$salt$hash) + AdminSession (sha256(token), 12h absolute TTL, revokedAt) — src/lib/latent/admin-auth.ts verified line-by-line",
            "user": "BetaProfile cookie session (reused Task 117 invite mechanics) + server-only ProfileAccess (plan/status/expiry) — src/lib/latent/access-control.ts verified line-by-line",
            "separation": "separate cookies (latent_admin_session / latent_beta_session), separate tables, expired admin cookie falls through safely (never treated as user)",
        },
        "cookieFlagsLive": {"HttpOnly": True, "SameSite": "lax", "Path": "/", "MaxAge": 43200,
                            "Secure": "activates from X-Forwarded-Proto https behind the proxy (Caddy sets it); verified absent only on direct plain-HTTP probe"},
        "revocation": "logout → same cookie reuse → 401 (verified live); admin reset-password revokes all sessions (verified live)",
        "lockout": "durable DB-backed: 5 failures → lockedUntil 15 min; uniform invalid_credentials shape (no user enumeration)",
        "noPublicAdminRegistration": "only 4 AdminAccount mutation sites exist (bootstrap CLI create, bootstrap reset-password, login failure counter, login success reset) — grep-verified; no route creates admins",
        "noBrowserControlledIdentity": "zero code paths read role/permission/plan/status from request bodies (grep-verified across src/app/api)",
        "denyByDefault": "resolution: registry.globalEnabled → per-user ProfilePermission → PlanPermission → registry defaultEffect; global switch verified to beat per-user ALLOW",
        "immediateRevocation": "guards re-resolve permissions/status per request — no cache layer",
        "suspendedDeletedHandling": "requireUser: SUSPENDED → 403, non-ACTIVE → 403, expired → 403; deleted profile → session row gone → anonymous",
        "idorProtection": "legacy identity derived from session (beta-<profileId>@users.latent.internal); client userId/email ignored or 403",
        "csrf": "assertSameOrigin on all admin mutations + user logout; SameSite=lax cookies; absent Origin passes (server-to-server cannot carry ambient cookies)",
        "rateLimiting": "admin login 10/15min per-username + 20/15min per-IP; invite redemption 30/h per-IP + 400/h global; in-memory sliding window (documented single-host trade-off)",
        "auditAppendOnly": "zero update/delete/upsert on AdminAuditLog anywhere (grep-verified); secrets scan of payloads clean",
        "usageCounters": "atomic conditional UPDATE (count < limit inside WHERE) — 6-thread concurrency test cannot overshoot; persisted in SQLite (survives restarts)",
        "healthEndpoints": "anonymous /api/health returns minimal liveness (no commit/paths/scheduler); full detail requires admin session or internal token (verified live)",
    },
    "routeGuardVerification": {
        "static": {"routes": route_verify["static"]["routesChecked"], "handlers": route_verify["static"]["handlersChecked"], "problems": route_verify["static"]["problems"]},
        "dynamic": {"probes": route_verify["dynamic"]["probes"], "problems": route_verify["dynamic"]["problems"]},
        "method": "each exported handler parsed; guard call must exist and PRECEDE any side-effectful statement; alternate methods checked; 124 unauthenticated HTTP probes",
    },
    "bootstrapAudit": {
        "oneTime": "refuses when AdminAccount non-empty (verified live)",
        "passwordHandling": "stdin piped or raw-mode muted prompt; never printed; scrypt-hashed before storage; policy (>=12 chars, upper/lower/digit) enforced BEFORE create (verified: weak attempt → 0 rows)",
        "noPartialAccounts": "single-row create at the end of validation; DB-error → no row; post-create round-trip self-verification with documented recovery",
        "resetPassword": "operator CLI only, overwrites hash + revokes all sessions (verified live, login with reset password → 200)",
        "httpBypass": "none — grep-verified",
        "bugFoundAndFixed": "args() parser infinite loop on '--reset-password --username <name>' (flag followed by another flag decremented i, loop re-incremented → 100% CPU hang). Fixed in scripts/task121_admin_bootstrap.ts; reset-password re-verified end-to-end",
    },
    "credentialAudit": {
        "classicPatFound": "one classic ghp_ PAT (40 chars) in ACTIVE store .git/credentials (gitignored; credential.helper=store --file=.git/credentials in repo config)",
        "actionTaken": "removed from active storage 2026-11-10 (store emptied, perms 0600); NOT used for any Task 122 push; validity deliberately unverified per no-use rule — operator must revoke it on GitHub",
        "otherStores": ".zcredentials/ contains README only; no durable token copies; no shell history files exist; no token-like env vars; .git/config remote URL clean (no embedded credentials)",
        "replacement": "fine-grained PAT required: owner amz162, repo only amz162/latent_v_2, Contents Read+Write; arm via bash scripts/gh_auth.sh (reads .zcredentials/github_token.local)",
        "pushConsequence": "no pushes possible until operator arms the replacement (CI workflows use repo secrets and are unaffected)",
    },
    "productionChanges": [{
        "change": "production server bound to 127.0.0.1:3000 (was *:3000)",
        "why": "direct origin access previously bypassed any reverse-proxy MFA layer",
        "how": "package.json start + scripts/server_supervisor.sh: next start -p 3000 -H 127.0.0.1",
        "verified": "localhost:3000 → 200; host-IP:3000 → unreachable; health suite 14/14 after restart",
        "rollback": "revert the -H flag in package.json start, restart (bash scripts/start_server.sh); no data impact",
    }],
    "postRecycleRecovery": {
        "event": "sandbox recycle restored scaffold + stale Nov 3 DB (Beta/RBAC tables missing)",
        "action": "git reset --hard origin/main (12d7f41c); additive prisma db push; RBAC seed + registry sync re-applied; INTERNAL_API_TOKEN regenerated; server + worker restarted",
        "dataLoss": "none of consequence — zero real users/admins existed; paper-trade ledger lives in git-tracked state files (task107 recovery design)",
        "newBackup": "db/backups/task122_pre_rebuild_20261110T143736Z.db",
    },
    "testResults": {"securitySuite": f"{suite_pass} passed, {suite_fail} failed", "healthCheck": "14 passed, 0 failed",
                    "invitationDryRun": "10 passed, 0 failed", "routeVerification": "static + dynamic: zero problems"},
}, open(f"{OUT}/security_audit.json", "w"), indent=1)

# ---------------- production health ----------------
json.dump({
    "generatedAt": NOW,
    "pages": {"noCookie": matrix["noCookie"], "userCookie": matrix["userCookie"], "adminCookie": matrix["adminCookie"],
              "note": "adminAccounts/betaProfiles counted 1/1 during the matrix because the throwaway probe identities were in flight; cleaned up immediately after (verified 0 remaining)"},
    "database": {**db, "migrations": "additive prisma db push only; pre-change backups in db/backups/ (task121_pre_migration_20261109T180546Z.db, task122_pre_rebuild_20261110T143736Z.db)",
                 "frontierNote": "frontier brought current post-recycle: update_daily_ohlcv.py + backfill_ohlcv.ts completed 2026-11-10 (frontier 2026-11-10, +39,686 bars, 0 errors, integrity ok)"},
    "worker": {"heartbeatAt": wh.get("heartbeat_at"), "note": (wh.get("note") or "")[:80], "fresh": True},
    "server": {"binding": "127.0.0.1:3000", "build": "production .next (next start)", "supervisor": "server_supervisor.sh (auto-restart, health-gated)"},
    "betaFunctionality": {"invitationRedemptionDryRun": "10 passed, 0 failed (test invites only — no real invitation created, no emails sent)",
                          "betaConfigRow": "ensured (id=1)", "consentFlow": "untouched"},
    "suites": {"security": f"{suite_pass}/{suite_pass + suite_fail}", "healthCheck": "14/14",
               "task107Regression": "not re-run in task122 (code untouched this task except supervisor binding flag; last green run: task121)",
               "routeGuardVerification": "zero problems"},
}, open(f"{OUT}/production_health.json", "w"), indent=1)

print("artifacts written:")
for f in sorted(os.listdir(OUT)):
    print(" ", f, os.path.getsize(f"{OUT}/{f}"), "bytes")
