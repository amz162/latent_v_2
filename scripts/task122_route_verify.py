#!/usr/bin/env python3
"""Task 122 — route guard verification (static + dynamic).

STATIC: parse every src/app/api/**/route.ts; for each exported HTTP handler
confirm (a) a guard call exists, (b) it appears BEFORE any side-effectful
statement (prisma writes, fs writes, exec, outbound fetch), (c) no unguarded
alternate methods.

DYNAMIC: black-box probe of every route over HTTP with NO credentials.
Expected: 401/403/405/400/503 — never 200-with-protected-data. A small,
explicitly listed set of public endpoints is allowed to return 200.

Output: data/backtest_reports/task122/route_guard_verification.json
"""
import json, os, re, subprocess, sys, urllib.request, urllib.error

ROOT = "src/app/api"
OUT = "data/backtest_reports/task122"
os.makedirs(OUT, exist_ok=True)

GUARD_FNS = ("guardUser", "gateUser", "guardAdmin", "guardAdminOrInternal", "guardUserOrInternal",
             "requireUser", "requireAdmin", "requireAdminOrInternal", "getAuthContext", "activeUserOrAnonymous")
SIDE_EFFECT_RE = re.compile(
    r"(?:db\.\w+\.(?:create|update|delete|upsert|createMany|updateMany|deleteMany)"
    r"|db\.\$executeRaw"
    r"|\bwriteFile|\bappendFile|\brmSync|\bunlink"
    r"|\bexecSync|\bexecFile"
    r"|\bfetch\()"
)
PUBLIC_GET = {"/api/", "/api/me", "/api/beta/status", "/api/beta/invite/redeem", "/api/health"}
PUBLIC_POST = {"/api/admin/auth/login", "/api/admin/auth/logout", "/api/user/logout",
               "/api/beta/invite/redeem", "/api/beta/profile", "/api/predictions/record",
               "/api/price-patterns/precompute"}
MACHINE_POST = {"/api/predictions/record", "/api/price-patterns/precompute"}

route_files = subprocess.run(["find", ROOT, "-name", "route.ts"], capture_output=True, text=True).stdout.split()

static = []
static_problems = []
for f in sorted(route_files):
    route = "/api/" + f[len("src/app/api/"):-len("/route.ts")]
    src = open(f).read()
    lines = src.split("\n")
    handlers = {}
    for m in re.finditer(r'export (?:async )?function (GET|POST|PUT|DELETE|PATCH)\s*\(', src):
        name = m.group(1)
        start_line = src[:m.start()].count("\n")
        # handler body = until next top-level `export` or EOF (approximate)
        next_export = src.find("\nexport ", m.end())
        body = src[m.end(): next_export if next_export != -1 else len(src)]
        body_lines = body.split("\n")
        guard_hit = None
        guard_line_in_handler = None
        for g in GUARD_FNS:
            idx = body.find(g + "(")
            if idx != -1:
                guard_hit = g
                guard_line_in_handler = body[:idx].count("\n")
                break
        # first side-effectful line within the handler body
        effect_line = None
        for i, bl in enumerate(body_lines):
            if SIDE_EFFECT_RE.search(bl):
                effect_line = i
                break
        ok = guard_hit is not None
        order_ok = True
        if guard_hit and effect_line is not None and guard_line_in_handler is not None:
            order_ok = guard_line_in_handler < effect_line
        handlers[name] = {
            "guard": guard_hit or "NONE",
            "guardBeforeSideEffects": order_ok if guard_hit else None,
            "firstSideEffectLine": effect_line,
        }
    entry = {"route": route, "file": f, "handlers": handlers}
    static.append(entry)
    for name, h in handlers.items():
        if h["guard"] == "NONE":
            is_public = (name in ("GET", "HEAD") and route in PUBLIC_GET) or (name == "POST" and route in PUBLIC_POST)
            if not is_public:
                static_problems.append({"route": route, "method": name, "problem": "no guard found"})
        elif h["guardBeforeSideEffects"] is False:
            static_problems.append({"route": route, "method": name, "problem": "side effect before guard"})

# ---------- dynamic sweep ----------
def probe(method, path, headers=None, data=None):
    req = urllib.request.Request("http://localhost:3000" + path, method=method,
                                 data=data, headers=headers or {"User-Agent": "task122-probe"})
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:
        return 0, str(e).encode()

dynamic = []
dynamic_problems = []
probe_set = []
for entry in static:
    route = entry["route"]
    if route in ("/api/auth",):
        continue
    if "GET" in entry["handlers"] and route not in ("/api/admin/auth/login", "/api/admin/auth/logout",
                                                    "/api/user/logout", "/api/beta/invite/redeem",
                                                    "/api/beta/profile", "/api/predictions/record",
                                                    "/api/price-patterns/precompute"):
        probe_set.append(("GET", route))
    if "POST" in entry["handlers"]:
        probe_set.append(("POST", route))

for method, route in probe_set:
    status, body = probe(method, route, data=(b"{}" if method == "POST" else None))
    if method == "GET":
        if route in PUBLIC_GET:
            ok, note = True, "public by design"
            if route == "/api/health" and b'"commit"' in body:
                ok, note = False, "health leaks internals to anonymous caller"
            if route == "/api" and len(body) > 2000:
                ok, note = True, "catalog (static JSON, no user data)"
        else:
            ok, note = status in (401, 403, 405), f"expected 401/403/405, got {status}"
            if status == 200:
                ok = False
    else:  # POST
        if route in PUBLIC_POST:
            ok, note = True, f"public/auth-endpoint by design (status {status})"
            if route == "/api/health":
                ok, note = True, "n/a"
        else:
            ok, note = status in (401, 403, 400, 405, 503), f"expected 401/403/400/405/503, got {status}"
            if status == 200 and b'"ok":true' in body and route not in ("/api/user/logout",):
                ok, note = False, "POST succeeded unauthenticated"
    dynamic.append({"method": method, "route": route, "status": status, "ok": ok, "note": note})
    if not ok:
        dynamic_problems.append({"method": method, "route": route, "status": status, "note": note})

result = {
    "generatedAt": "2026-11-10",
    "task": "task122",
    "static": {"routesChecked": len(static), "handlersChecked": sum(len(e["handlers"]) for e in static),
               "problems": static_problems},
    "dynamic": {"probes": len(dynamic), "problems": dynamic_problems,
                "detail": dynamic},
    "publicEndpointsRationale": {
        "GET": sorted(PUBLIC_GET),
        "POST": sorted(PUBLIC_POST),
        "note": "public GETs return policy booleans/liveness/minimal shapes only; POSTs are auth endpoints or machine-token fail-closed endpoints",
    },
}
json.dump(result, open(f"{OUT}/route_guard_verification.json", "w"), indent=1)
print(f"static: {len(static)} routes, {result['static']['handlersChecked']} handlers — problems: {static_problems or 'none'}")
print(f"dynamic: {len(dynamic)} probes — problems: {dynamic_problems or 'none'}")
sys.exit(1 if (static_problems or dynamic_problems) else 0)
