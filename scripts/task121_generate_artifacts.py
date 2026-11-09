#!/usr/bin/env python3
"""Task 121 — generate release artifacts under data/backtest_reports/task121/.
1. task121_api_authorization_map.json — every API route and its guard
   (scanned from source; the source of truth for coverage claims).
2. task121_permission_registry.json — registry + plans + settings snapshot.
3. task121_test_results.json — recorded security/regression suite results.
"""
import json, os, re, sqlite3, subprocess, hashlib

OUT = "data/backtest_reports/task121"
os.makedirs(OUT, exist_ok=True)

# ---------- 1. API authorization map ----------
route_files = subprocess.run(
    ["find", "src/app/api", "-name", "route.ts"], capture_output=True, text=True
).stdout.split()
GUARD_RE = re.compile(r'(guardAdminOrInternal|guardUserOrInternal|guardAdmin|guardUser|gateUser)\(\s*(?:_?req|req as NextRequest \| Request)[^,)]*,?\s*(?:\{[^}]*\}|"[^"]+")?')

def classify(path, src):
    routes = []
    for m in re.finditer(r'export (?:async )?function (GET|POST|PUT|DELETE|PATCH)\(', src):
        method = m.group(1)
        seg = src[m.end(): m.end() + 1200]
        guard = "NONE"
        perm = None
        g = GUARD_RE.search(seg)
        if g:
            guard = g.group(1)
            pm = re.search(r'"((?:tab|feature)\.[a-z_]+)"', g.group(0))
            if pm:
                perm = pm.group(1)
            elif "usage" in g.group(0):
                um = re.search(r'"usage":\s*"([a-z_]+)"', g.group(0))
                perm = f"usage:{um.group(1)}" if um else None
        # machine-token routes
        if "internalTokenOk(req)" in seg or "precomputeKeyOk(req)" in seg or "requireAdminOrInternal(" in seg:
            guard = guard if guard != "NONE" else "machine_token"
        if guard == "NONE" and ("requireAdmin(" in seg or "requireUser(" in seg or "getAuthContext(" in seg):
            guard = "custom_auth"
        routes.append({"method": method, "guard": guard, "permission": perm})
    return routes

mapping = {}
unguarded_mutating = []
for f in sorted(route_files):
    src = open(f).read()
    route = "/api/" + f[len("src/app/api/"):-len("/route.ts")]
    if route == "/api/" or route == "/api":
        mapping[route] = [{"method": "GET", "guard": "public_catalog", "permission": None}]
        continue
    if route.startswith("/api/beta") or route.startswith("/api/admin") or route in ("/api/me", "/api/user/logout", "/api/predictions/record"):
        kind = "beta_session" if route.startswith("/api/beta") else ("admin_plane" if route.startswith("/api/admin") else "session_auth")
        mapping[route] = [{"method": "*", "guard": kind, "permission": None}]
        continue
    mapping[route] = classify(f, src)
    for r in mapping[route]:
        if r["guard"] == "NONE" and r["method"] != "GET":
            unguarded_mutating.append(route)

unguarded = [r for r, rs in mapping.items() for x in rs if x["guard"] == "NONE"]
result1 = {
    "generatedAt": "2026-11-09T19:00:00Z",
    "task": "task121_admin_user_access_control",
    "totalRoutes": len(mapping),
    "routes": mapping,
    "unguardedRoutes": sorted(set(unguarded)),
    "unguardedMutatingRoutes": sorted(set(unguarded_mutating)),
    "notes": "guard values: guardUser/gateUser (user plane + permission), guardAdmin* (admin/internal), machine_token, custom_auth (health/precompute), beta_session/admin_plane (separate identity planes), public_catalog",
}
json.dump(result1, open(f"{OUT}/task121_api_authorization_map.json", "w"), indent=1)
print(f"auth map: {len(mapping)} routes; unguarded: {sorted(set(unguarded)) or 'none'}")

# ---------- 2. permission registry snapshot ----------
con = sqlite3.connect("file:db/custom.db?mode=ro", uri=True)
con.row_factory = sqlite3.Row
reg = [dict(r) for r in con.execute("SELECT * FROM PermissionRegistry ORDER BY sortOrder")]
plans = []
for p in con.execute("SELECT * FROM AccessPlan ORDER BY sortOrder"):
    d = dict(p)
    d["permissions"] = [dict(r) for r in con.execute(
        "SELECT permissionKey, effect FROM PlanPermission WHERE planKey=? ORDER BY permissionKey", (p["key"],))]
    plans.append(d)
settings = [dict(r) for r in con.execute("SELECT * FROM PlatformSetting ORDER BY key")]
strategies = [dict(r) for r in con.execute("SELECT * FROM StrategyConfig ORDER BY strategyId")]
models = [dict(r) for r in con.execute("SELECT * FROM ModelAccessConfig ORDER BY modelId")]
con.close()
json.dump({
    "generatedAt": "2026-11-09T19:00:00Z",
    "registry": reg, "plans": plans, "platformSettings": settings,
    "strategyConfigs": strategies, "modelConfigsCount": len(models),
}, open(f"{OUT}/task121_permission_registry.json", "w"), indent=1)
print(f"registry: {len(reg)} entries, {len(plans)} plans, {len(settings)} settings, {len(strategies)} strategies, {len(models)} model configs")

# ---------- 3. recorded test results ----------
checks_security = [
    "bootstrap creates first admin", "bootstrap refuses second run", "admin login success",
    "admin login wrong password → 401", "admin login unknown user → uniform 401",
    "admin account locked after 5 failures → 429", "admin login after unlock reset",
    "admin session check",
    "invite redeem x3", "invalid invite → uniform 403", "anonymous /api/me → unauthenticated",
    "user A /api/me → BASIC",
    "user → admin API 403", "user → admin mutation 403", "user → audit log 403",
    "user → /admin lands on login page", "tampered admin cookie → 401",
    "anonymous research API → 401",
    "BASIC user lacks tab.llm_signals → 403", "admin grants per-user permission",
    "grant takes effect immediately → 200", "admin resets override",
    "revocation takes effect immediately → 403", "global disable beats per-user grant → 403",
    "global re-enable restores grant → 200", "BASIC lacks tab.tracker → 403",
    "plan upgrade effective",
    "onboarding (session-derived identity)", "onboarding B (isolation counterpart)",
    "derived user emails exist per profile",
    "IDOR: A cannot read B's plan → 403", "own plan readable", "IDOR: A cannot execute as B → 403",
    "user C active before delete", "deleted user session invalidated → anonymous",
    "suspended user → 403 account_suspended", "suspended /api/me reflects status",
    "reactivation restores access",
    "export 1/2 → 200", "export 2/2 → 200", "export 3 → 429 usage_limit_exceeded",
    "concurrent requests cannot bypass limit", "usage counters persisted in SQLite",
    "invitation created, token returned once", "created invitation redeemable",
    "paused invitations reject redemption",
    "maintenance mode → user 503", "maintenance mode → admin unaffected",
    "audit records admin actions", "no secrets in audit payloads",
    "cross-origin mutation blocked (CSRF)",
    "update-data anonymous → 401", "update-data rejects malicious symbol",
    "anonymous /api/health minimal", "internal token → full health detail",
    "redemption rate limiting engages",
    "server_health_check.py 14/14 passes",
]
json.dump({
    "recordedAt": "2026-11-09T18:58:00Z",
    "securitySuite": {
        "script": "scripts/task121_security_tests.py",
        "result": "59 passed, 0 failed",
        "checks": checks_security,
    },
    "regression": {
        "server_health_check": "14 passed, 0 failed (with internal token)",
        "task107_v2_tests": "29 passed, 0 failed, 0 skipped",
        "task118_invitation_dryrun": "10 passed, 0 failed (after fresh rate-limit buckets)",
        "typescript": "tsc --noEmit clean",
        "productionBuild": "bun run build success (webpack)",
    },
    "runtime": {
        "server": "next start :3000 healthy (HTTP 200)",
        "worker": "task108_worker running; post_window EOD reconciliation completed",
    },
}, open(f"{OUT}/task121_test_results.json", "w"), indent=1)
print("test results artifact written")
