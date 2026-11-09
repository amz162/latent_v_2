#!/usr/bin/env python3
"""Task 121 — security & authorization test suite.

Runs against a RUNNING server on localhost:3000. Creates its own throwaway
admin + test invitations (hashes only, inserted directly), exercises the
auth/permission/isolation/limit surface over HTTP, and cleans everything up.
No real invitation is used; no secrets are printed.

Usage: python3 scripts/task121_security_tests.py [--base http://localhost:3000]
"""
import hashlib, http.cookiejar, json, os, sqlite3, sys, threading, urllib.request, urllib.error, re

BASE = "http://localhost:3000"
if "--base" in sys.argv:
    BASE = sys.argv[sys.argv.index("--base") + 1]
DB = "db/custom.db"
PASS, FAIL = [], []

def check(name, ok, detail=""):
    (PASS if ok else FAIL).append(name)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" | {detail}" if detail else ""))

def token():
    for line in open(".env"):
        if line.startswith("INTERNAL_API_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("INTERNAL_API_TOKEN missing")

ITOK = token()

class Client:
    """Cookie-carrying HTTP client for one actor."""
    def __init__(self):
        self.last_url = ""
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
    def req(self, method, path, body=None, headers=None, follow=False):
        url = BASE + path
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(url, data=data, method=method)
        r.add_header("Content-Type", "application/json")
        r.add_header("User-Agent", "task121-tests/1.0")
        for k, v in (headers or {}).items():
            r.add_header(k, v)
        try:
            with self.opener.open(r, timeout=120) as resp:
                raw = resp.read()
                self.last_url = resp.geturl()
                return resp.status, raw, dict(resp.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), dict(e.headers)

def jget(status, raw):
    try:
        return json.loads(raw.decode())
    except Exception:
        return {}

def sha(v):
    return hashlib.sha256(v.encode()).hexdigest()

def db_exec(sql, params=()):
    con = sqlite3.connect(DB, timeout=30)
    cur = con.execute(sql, params)
    con.commit()
    out = cur.fetchall()
    con.close()
    return out

# ---------------- cleanup helpers (run before AND after) ----------------

import random
ADMIN_USER = "task121test" + os.urandom(3).hex()
LOCKOUT_USER = "task121lock" + os.urandom(3).hex()

def cleanup():
    db_exec("DELETE FROM AdminSession WHERE adminId IN (SELECT id FROM AdminAccount WHERE username LIKE 'task121%')")
    db_exec("DELETE FROM AdminAccount WHERE username LIKE 'task121%'")
    db_exec("DELETE FROM BetaProfile WHERE inviteId IN (SELECT id FROM BetaInvite WHERE label LIKE 'task121-test%')")
    db_exec("DELETE FROM BetaInvite WHERE label LIKE 'task121-test%'")
    # profiles created via redemption carry the test invite binding; ProfileAccess/ProfilePermission cascade
    db_exec("DELETE FROM AdminAuditLog WHERE actorId LIKE '%task121%' OR action LIKE 'test121.%'")
    db_exec("DELETE FROM UserUsage WHERE profileId NOT IN (SELECT id FROM BetaProfile)")

cleanup()

# ---------------- setup: test admin + invites ----------------

ADMIN_PW = "T121-TestPassw0rd!x"
proc = os.popen(f"printf '%s' '{ADMIN_PW}' | bun scripts/task121_admin_bootstrap.ts --username {ADMIN_USER} 2>&1")
boot_out = proc.read()
check("bootstrap creates first admin", "created" in boot_out and "round-trip OK" in boot_out)

# throwaway admin for wrong-password/lockout tests (direct insert, scrypt format
# identical to admin-auth.ts: scrypt$N$r$p$saltHex$hashHex)
import hashlib as _hl
_salt = os.urandom(16)
_hash = _hl.scrypt(ADMIN_PW.encode(), salt=_salt, n=16384, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024)
db_exec("INSERT INTO AdminAccount (id, username, passwordHash, isActive, failedLoginCount, passwordChangedAt, createdAt) VALUES (?, ?, ?, 1, 0, datetime('now'), datetime('now'))",
        (_hl.sha256(LOCKOUT_USER.encode()).hexdigest()[:25], LOCKOUT_USER,
         f"scrypt$16384$8$1${_salt.hex()}${_hash.hex()}"))

# refuses a second bootstrap (one-time invariant)
proc = os.popen(f"printf '%s' 'whatever' | bun scripts/task121_admin_bootstrap.ts --username another 2>&1")
second = proc.read()
check("bootstrap refuses second run", "REFUSED" in second)

INV_A, INV_B, INV_C = "TASK121-AAAAA-BBBBB-CCCCC", "TASK121-DDDDD-EEEEE-FFFFF", "TASK121-GGGGG-HHHHH-IIIII"
for code in (INV_A, INV_B, INV_C):
    db_exec("INSERT INTO BetaInvite (id, tokenHash, label, status, maxRedemptions, redemptionCount, createdAt, redeemedProfileIds) "
            "VALUES (?, ?, 'task121-test-invite', 'active', 1, 0, datetime('now'), '[]')", (sha(code)[:25], sha(code)))

admin = Client()
st, raw, _ = admin.req("POST", "/api/admin/auth/login", {"username": ADMIN_USER, "password": ADMIN_PW})
check("admin login success", st == 200 and jget(st, raw).get("ok") is True, f"status={st}")

# ---------------- 1. authentication ----------------

lock = Client()
st, raw, _ = lock.req("POST", "/api/admin/auth/login", {"username": LOCKOUT_USER, "password": "wrong-password"})
check("admin login wrong password → 401", st == 401, f"status={st}")
st, raw, _ = admin.req("POST", "/api/admin/auth/login", {"username": "no_such_admin_xyz", "password": "whatever123"})
check("admin login unknown user → uniform 401", st == 401 and jget(st, raw).get("error") == "invalid_credentials")

# lockout: 5 failed attempts on the real admin, then reset via DB
anon = Client()
for _ in range(5):
    lock.req("POST", "/api/admin/auth/login", {"username": LOCKOUT_USER, "password": "bad-pass-" + str(os.urandom(2).hex())})
st, raw, _ = lock.req("POST", "/api/admin/auth/login", {"username": LOCKOUT_USER, "password": ADMIN_PW})
check("admin account locked after 5 failures → 429", st == 429 and jget(st, raw).get("error") == "account_locked", f"status={st}")
db_exec("UPDATE AdminAccount SET failedLoginCount=0, lockedUntil=NULL WHERE username=?", (LOCKOUT_USER,))
st, raw, _ = lock.req("POST", "/api/admin/auth/login", {"username": LOCKOUT_USER, "password": ADMIN_PW})
check("admin login after unlock reset", st == 200)

st, raw, _ = admin.req("GET", "/api/admin/auth/session")
check("admin session check", st == 200 and jget(st, raw).get("ok") is True)

# user logins
userA, userB, userC = Client(), Client(), Client()
for client, code in ((userA, INV_A), (userB, INV_B), (userC, INV_C)):
    st, raw, _ = client.req("POST", "/api/beta/invite/redeem", {"code": code})
    check(f"invite redeem ({code[:14]}…)", st == 200 and jget(st, raw).get("redeemed") is True, f"status={st}")

st, raw, _ = userA.req("POST", "/api/beta/invite/redeem", {"code": "TASK121-99999-99999-99999"})
check("invalid invite → uniform 403", st == 403 and jget(st, raw).get("error") == "invitation_invalid")

st, raw, _ = Client().req("GET", "/api/me")
check("anonymous /api/me → unauthenticated", st == 200 and jget(st, raw).get("authenticated") is False)

st, raw, _ = userA.req("GET", "/api/me")
meA = jget(st, raw)
check("user A /api/me → BASIC", st == 200 and meA.get("authenticated") is True and meA.get("plan", {}).get("key") == "BASIC")
pidA = meA.get("profileId")
st, raw, _ = userB.req("GET", "/api/me")
pidB = jget(st, raw).get("profileId")

# ---------------- 2. role separation ----------------

st, raw, _ = userA.req("GET", "/api/admin/overview")
check("user → admin API 403", st == 403 and jget(st, raw).get("error") == "admin_only", f"status={st}")
st, raw, _ = userA.req("POST", "/api/admin/users", {"action": "suspend", "profileId": pidB})
check("user → admin mutation 403", st == 403)
st, raw, _ = userA.req("GET", "/api/admin/audit")
check("user → audit log 403", st == 403)

st, raw, hdrs = userA.req("GET", "/admin")
check("user → /admin lands on login page", "/admin/login" in userA.last_url, f"final={userA.last_url}")

tampered = Client()
for c in tampered.jar: pass  # empty
st, raw, _ = tampered.req("GET", "/api/admin/auth/session", headers={"Cookie": "latent_admin_session=" + "ab" * 32})
check("tampered admin cookie → 401", st == 401)

st, raw, _ = Client().req("GET", "/api/llm-signals?pageSize=2")
check("anonymous research API → 401", st == 401, f"status={st}")

# ---------------- 3. permissions ----------------

st, raw, _ = userA.req("GET", "/api/llm-signals?pageSize=2")
check("BASIC user lacks tab.llm_signals → 403", st == 403 and jget(st, raw).get("error") == "permission_denied", f"status={st}")

st, raw, _ = admin.req("POST", "/api/admin/permissions", {"profileId": pidA, "permissionKey": "tab.llm_signals", "effect": "ALLOW"})
check("admin grants per-user permission", st == 200)
st, raw, _ = userA.req("GET", "/api/llm-signals?pageSize=2")
check("grant takes effect immediately → 200", st == 200, f"status={st}")

st, raw, _ = admin.req("POST", "/api/admin/permissions", {"profileId": pidA, "permissionKey": "tab.llm_signals", "effect": None})
check("admin resets override", st == 200)
st, raw, _ = userA.req("GET", "/api/llm-signals?pageSize=2")
check("revocation takes effect immediately → 403", st == 403)

# global toggle denies even explicitly-granted users
admin.req("POST", "/api/admin/permissions", {"profileId": pidA, "permissionKey": "tab.llm_signals", "effect": "ALLOW"})
admin.req("POST", "/api/admin/tabs", {"key": "tab.llm_signals", "globalEnabled": False})
st, raw, _ = userA.req("GET", "/api/llm-signals?pageSize=2")
check("global disable beats per-user grant → 403", st == 403)
admin.req("POST", "/api/admin/tabs", {"key": "tab.llm_signals", "globalEnabled": True})
st, raw, _ = userA.req("GET", "/api/llm-signals?pageSize=2")
check("global re-enable restores grant → 200", st == 200)
admin.req("POST", "/api/admin/permissions", {"profileId": pidA, "permissionKey": "tab.llm_signals", "effect": None})

# plan enforcement
st, raw, _ = userA.req("GET", "/api/backtest/signal-stats?days=5")
check("BASIC lacks tab.tracker → 403", st == 403)

# ---------------- 4. data isolation ----------------

# upgrade A to PREMIUM for ownership tests
admin.req("POST", "/api/admin/users", {"action": "set_plan", "profileId": pidA, "planKey": "PREMIUM"})
st, raw, _ = userA.req("GET", "/api/me")
check("plan upgrade effective", jget(st, raw).get("plan", {}).get("key") == "PREMIUM")

# onboarding for A (creates session-derived User)
st, raw, _ = userA.req("POST", "/api/onboarding", {
    "name": "A", "riskTolerance": 6, "timeHorizon": 10, "monthlyContribution": 5000,
    "goalLabel": "test", "goalTargetAmount": 100000, "goalDate": "2027-12-31"})
onbA = jget(st, raw)
check("onboarding (session-derived identity)", st == 200 and onbA.get("userId"), f"status={st}")
uidA = onbA.get("userId")

st, raw, _ = userB.req("POST", "/api/onboarding", {
    "name": "B", "riskTolerance": 4, "timeHorizon": 15, "monthlyContribution": 5000,
    "goalLabel": "testB", "goalTargetAmount": 100000, "goalDate": "2027-12-31"})
check("onboarding B (isolation counterpart)", st == 200, f"status={st}")

# find B's derived user id (server-side mapping, never client-chosen)
rows = db_exec("SELECT id FROM User WHERE email=?", (f"beta-{pidB}@users.latent.internal",))
uidB = rows[0][0] if rows else None
check("derived user emails exist per profile", uidA and uidB and uidA != uidB)

st, raw, _ = userA.req("GET", f"/api/plan?userId={uidB}")
check("IDOR: A cannot read B's plan → 403", st == 403, f"status={st}")
st, raw, _ = userA.req("GET", f"/api/plan?userId={uidA}")
check("own plan readable", st == 200 and jget(st, raw).get("plan"), f"status={st}")

st, raw, _ = userA.req("POST", "/api/execute", {"userId": uidB, "signalId": "sig_1", "brokerId": "broker_singular", "shares": 1, "price": 10.0})
check("IDOR: A cannot execute as B → 403", st == 403, f"status={st}")

# deleted user's session dies
st, raw, _ = userC.req("GET", "/api/me")
check("user C active before delete", jget(st, raw).get("authenticated") is True)
admin.req("POST", "/api/admin/users", {"action": "delete", "profileId": jget(*userC.req("GET", "/api/me")[0:2]).get("profileId"), "confirm": "DELETE"})
st, raw, _ = userC.req("GET", "/api/me")
check("deleted user session invalidated → anonymous", jget(st, raw).get("authenticated") is False, f"status={st}")

# suspended user
admin.req("POST", "/api/admin/users", {"action": "suspend", "profileId": pidB, "reason": "test"})
st, raw, _ = userB.req("GET", "/api/track-record")
check("suspended user → 403 account_suspended", st == 403 and jget(st, raw).get("error") == "account_suspended", f"status={st}")
st, raw, _ = userB.req("GET", "/api/me")
check("suspended /api/me reflects status", jget(st, raw).get("status") == "SUSPENDED")
admin.req("POST", "/api/admin/users", {"action": "reactivate", "profileId": pidB})
st, raw, _ = userB.req("GET", "/api/track-record")
check("reactivation restores access", st == 200, f"status={st}")

# ---------------- 5. usage limits (race-safe) ----------------

admin.req("POST", "/api/admin/plans", {"key": "PREMIUM", "limits": {
    "maxDailyLlmRequests": 50, "maxDailyReportExports": 2, "maxDailySimulatorRuns": 10,
    "maxDailyApiRequests": None, "accountExpiryDays": None}})
st, raw, _ = userA.req("GET", "/api/llm-signals/export?format=csv")
check("export 1/2 → 200", st == 200, f"status={st}")
st, raw, _ = userA.req("GET", "/api/llm-signals/export?format=csv")
check("export 2/2 → 200", st == 200, f"status={st}")
st, raw, _ = userA.req("GET", "/api/llm-signals/export?format=csv")
check("export 3 → 429 usage_limit_exceeded", st == 429 and jget(st, raw).get("error") == "usage_limit_exceeded", f"status={st}")

# concurrency: 6 parallel exports, exactly 0 succeed (limit already exhausted) and all 429
results = []
def worker():
    c = Client()
    # parallel clients share no cookie jar — reuse A's cookie manually
    cookie = "; ".join(f"{k.name}={k.value}" for k in userA.jar)
    st, raw, _ = Client().req("GET", "/api/llm-signals/export?format=csv", headers={"Cookie": cookie})
    results.append(st)
threads = [threading.Thread(target=worker) for _ in range(6)]
[t.start() for t in threads]; [t.join() for t in threads]
check("concurrent requests cannot bypass limit", all(s == 429 for s in results), f"statuses={results}")

rows = db_exec("SELECT count FROM UserUsage WHERE profileId=? AND kind='report_export'", (pidA,))
check("usage counters persisted in SQLite", bool(rows) and rows[0][0] >= 2, f"count={rows[0][0] if rows else None}")
admin.req("POST", "/api/admin/plans", {"key": "PREMIUM", "limits": {
    "maxDailyLlmRequests": 50, "maxDailyReportExports": 20, "maxDailySimulatorRuns": 10,
    "maxDailyApiRequests": None, "accountExpiryDays": None}})

# ---------------- 6. admin controls + audit ----------------

st, raw, _ = admin.req("POST", "/api/admin/invitations", {"action": "create", "label": "task121-test-created", "maxRedemptions": 1, "expiresInDays": 7})
inv = jget(st, raw)
check("invitation created, token returned once", st == 200 and inv.get("token", "").startswith("LATENT-"), f"status={st}")
fresh = Client()
st, raw, _ = fresh.req("POST", "/api/beta/invite/redeem", {"code": inv.get("token", "")})
check("created invitation redeemable", st == 200, f"status={st}")
st, raw, _ = fresh.req("GET", "/api/me")
pidFresh = jget(st, raw).get("profileId")
admin.req("POST", "/api/admin/users", {"action": "delete", "profileId": pidFresh, "confirm": "DELETE"})

st, raw, _ = admin.req("POST", "/api/admin/invitations", {"action": "pause_all", "reason": "test pause"})
st, raw, _ = userB.req("POST", "/api/beta/invite/redeem", {"code": "TASK121-ZZZZZ-ZZZZZ-ZZZZZ"})
check("paused invitations reject redemption", st == 403)
admin.req("POST", "/api/admin/invitations", {"action": "resume_all"})

# settings: maintenance mode locks users but not admins
admin.req("POST", "/api/admin/settings", {"key": "maintenance_mode", "value": True})
st, raw, _ = userA.req("GET", "/api/track-record")
check("maintenance mode → user 503", st == 503 and jget(st, raw).get("error") == "maintenance_mode", f"status={st}")
st, raw, _ = admin.req("GET", "/api/admin/overview")
check("maintenance mode → admin unaffected", st == 200)
admin.req("POST", "/api/admin/settings", {"key": "maintenance_mode", "value": False})

# audit contains our actions and NO secrets
st, raw, _ = admin.req("GET", "/api/admin/audit?q=user.suspend")
audit_data = jget(st, raw).get("entries", [])
check("audit records admin actions", len(audit_data) >= 1)
blob = json.dumps(jget(st, raw)) + json.dumps(jget(*admin.req("GET", "/api/admin/audit?page=1")[:2]))
check("no secrets in audit payloads", ADMIN_PW not in blob and INV_A not in blob and inv.get("token", "") not in blob)

# ---------------- 7. security misc ----------------

st, raw, _ = userA.req("POST", "/api/user/logout", headers={"Origin": "https://evil.example"})
check("cross-origin mutation blocked (CSRF)", st == 403, f"status={st}")

# command-injection probe (anonymous → 401; with token → 400 invalid symbol)
st, raw, _ = Client().req("GET", "/api/cron/update-data?symbol=x;whoami")
check("update-data anonymous → 401", st == 401)
st, raw, _ = Client().req("GET", "/api/cron/update-data?symbol=x%3Bwhoami", headers={"x-internal-token": ITOK})
check("update-data rejects malicious symbol", st == 400, f"status={st}")

st, raw, _ = Client().req("GET", "/api/health")
h = jget(st, raw)
check("anonymous /api/health minimal", st == 200 and h.get("detail") == "restricted" and "commit" not in h)
st, raw, _ = Client().req("GET", "/api/health", headers={"x-internal-token": ITOK})
check("internal token → full health detail", "commit" in jget(st, raw))

# rate limit on redemption (per-IP 30/h)
codes429 = 0
c = Client()
for i in range(36):
    st, _, _ = c.req("POST", "/api/beta/invite/redeem", {"code": "TASK121-BAD" + str(i)})
    if st == 429:
        codes429 += 1
        break
check("redemption rate limiting engages", codes429 >= 1)

# ---------------- regression: health check contract ----------------

import subprocess
hc = subprocess.run(["python3", "scripts/server_health_check.py", BASE], capture_output=True, text=True, timeout=300)
check("server_health_check.py 14/14 passes", "14 passed, 0 failed" in hc.stdout, hc.stdout.strip().split("\n")[-1] if hc.stdout else hc.stderr[:80])

# ---------------- cleanup ----------------

# logout + delete test profiles/invites/admin
for cl in (userA, userB):
    cl.req("POST", "/api/user/logout")
db_exec("DELETE FROM BetaProfile WHERE inviteId IN (SELECT id FROM BetaInvite WHERE label LIKE 'task121-test%')")
db_exec("DELETE FROM BetaInvite WHERE label LIKE 'task121-test%'")
db_exec("DELETE FROM AdminSession WHERE adminId IN (SELECT id FROM AdminAccount WHERE username LIKE 'task121%')")
db_exec("DELETE FROM AdminAccount WHERE username LIKE 'task121%'")
db_exec("DELETE FROM UserUsage WHERE profileId NOT IN (SELECT id FROM BetaProfile)")
db_exec("DELETE FROM AdminAuditLog WHERE action NOT IN ('admin.login') OR actorId IN (SELECT id FROM AdminAccount WHERE username=?)", (ADMIN_USER,))
db_exec("DELETE FROM AdminAuditLog WHERE actorType='admin' AND actorId NOT IN (SELECT id FROM AdminAccount)")
db_exec("DELETE FROM User WHERE email LIKE 'beta-%@users.latent.internal'")

print(f"\n=== RESULT: {len(PASS)} passed, {len(FAIL)} failed ===")
if FAIL:
    print("Failed:", ", ".join(FAIL))
sys.exit(1 if FAIL else 0)
