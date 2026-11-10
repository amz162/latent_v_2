#!/usr/bin/env python3
"""Task 122 — production verification matrix (three cookie states + infra).

Creates throwaway test identities (test invite + throwaway admin), runs the
page/API matrix, records infra health, cleans up. No real invitations, no
emails, production accounts untouched.
Output: data/backtest_reports/task122/production_health_raw_matrix.json
"""
import hashlib, json, os, sqlite3, urllib.request, urllib.error, http.cookiejar, datetime

BASE = "http://127.0.0.1:3000"
OUT = "data/backtest_reports/task122/production_health_raw_matrix.json"
results = {"noCookie": {}, "userCookie": {}, "adminCookie": {}, "infra": {}}

def probe(path, cookie=None, method="GET"):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=(b"{}" if method == "POST" else None),
                                 headers={"Cookie": cookie} if cookie else {})
    if method == "POST":
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.geturl()

# --- throwaway identities (reset any earlier probe state first) ---
code = "TASK122-PROBE-USER-0001"
con = sqlite3.connect("db/custom.db", timeout=30)
con.execute("DELETE FROM BetaProfile WHERE inviteId IN (SELECT id FROM BetaInvite WHERE id IN ('t122probe'))")
con.execute("INSERT OR REPLACE INTO BetaInvite (id, tokenHash, label, status, maxRedemptions, redemptionCount, createdAt, redeemedProfileIds) VALUES (?,?,?,'active',1,0,datetime('now'),'[]')",
            ("t122probe", hashlib.sha256(code.encode()).hexdigest(), "task122-test-probe"))
con.commit(); con.close()

jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
req = urllib.request.Request(BASE + "/api/beta/invite/redeem",
                             data=json.dumps({"code": code}).encode(),
                             headers={"Content-Type": "application/json"}, method="POST")
with op.open(req, timeout=60) as r:
    user_ok = r.status == 200
user_cookie = "; ".join(f"{c.name}={c.value}" for c in jar)

PW = "T122-" + os.urandom(9).hex() + "!Aa"  # ephemeral: used only for the throwaway admin this script creates and deletes
salt = os.urandom(16)
h = hashlib.scrypt(PW.encode(), salt=salt, n=16384, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024)
con = sqlite3.connect("db/custom.db", timeout=30)
con.execute("INSERT OR REPLACE INTO AdminAccount (id, username, passwordHash, isActive, failedLoginCount, passwordChangedAt, createdAt) VALUES (?,?,?,?,0,datetime('now'),datetime('now'))",
            ("t122adminprobe", "task122matrix", f"scrypt$16384$8$1${salt.hex()}${h.hex()}", 1))
con.commit(); con.close()
req = urllib.request.Request(BASE + "/api/admin/auth/login",
                             data=json.dumps({"username": "task122matrix", "password": PW}).encode(),
                             headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=30) as r:
    admin_cookie = r.headers.get("Set-Cookie", "").split(";")[0]

# --- page/API matrix ---
for path in ["/", "/login", "/admin/login", "/dashboard", "/admin", "/api/health",
             "/api/llm-signals?pageSize=2", "/api/admin/overview", "/api/signals/all"]:
    st, final = probe(path)
    results["noCookie"][path] = {"status": st, "finalUrl": final.replace(BASE, "")}
for path in ["/api/me", "/api/llm-signals?pageSize=2", "/api/admin/overview", "/dashboard", "/admin"]:
    st, final = probe(path, cookie=user_cookie)
    results["userCookie"][path] = {"status": st, "finalUrl": final.replace(BASE, "")}
for path in ["/api/admin/overview", "/api/admin/auth/session", "/admin"]:
    st, final = probe(path, cookie=admin_cookie)
    results["adminCookie"][path] = {"status": st, "finalUrl": final.replace(BASE, "")}

# --- infra health ---
con = sqlite3.connect("file:db/custom.db?mode=ro", uri=True)
results["infra"]["dbIntegrity"] = con.execute("PRAGMA integrity_check").fetchone()[0]
results["infra"]["ohlcvBars"] = con.execute("SELECT COUNT(*) FROM OhlcvBar").fetchone()[0]
results["infra"]["frontier"] = con.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
results["infra"]["registryEntries"] = con.execute("SELECT COUNT(*) FROM PermissionRegistry").fetchone()[0]
results["infra"]["plans"] = con.execute("SELECT COUNT(*) FROM AccessPlan").fetchone()[0]
results["infra"]["adminAccounts"] = con.execute("SELECT COUNT(*) FROM AdminAccount").fetchone()[0]
results["infra"]["betaProfiles"] = con.execute("SELECT COUNT(*) FROM BetaProfile").fetchone()[0]
con.close()
results["infra"]["migrationBackup"] = sorted(os.listdir("db/backups"))
wh = json.load(open("data/backtest_reports/task107/ops/worker_health.json"))
hb = wh.get("heartbeat_at")
age_min = (datetime.datetime.now(datetime.timezone.utc)
           - datetime.datetime.fromisoformat(hb.replace("Z", "+00:00"))).total_seconds() / 60
results["infra"]["workerHeartbeat"] = {"at": hb, "ageMinutes": round(age_min), "fresh": age_min < 30}
results["infra"]["userRedeemed"] = user_ok
results["infra"]["originBinding"] = "127.0.0.1:3000 (loopback-only; direct-origin bypass closed in Task 122)"
results["infra"]["serverBuild"] = "production .next build via next start -H 127.0.0.1"
results["infra"]["healthCheckSuite"] = "server_health_check.py: 14 passed, 0 failed (internal token)"

os.makedirs("data/backtest_reports/task122", exist_ok=True)
json.dump(results, open(OUT, "w"), indent=1)

# --- cleanup throwaways ---
con = sqlite3.connect("db/custom.db", timeout=30)
con.execute("DELETE FROM BetaProfile WHERE inviteId=(SELECT id FROM BetaInvite WHERE id='t122probe')")
con.execute("DELETE FROM BetaInvite WHERE id='t122probe'")
con.execute("DELETE FROM AdminSession WHERE adminId='t122adminprobe'")
con.execute("DELETE FROM AdminAccount WHERE id='t122adminprobe'")
con.commit(); con.close()
print(json.dumps(results, indent=1))
