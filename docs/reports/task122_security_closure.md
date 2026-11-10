# Task 122 — Admin Security Closure, Production Verification & Beta Launch Readiness

**Date:** 2026-11-10 · **Repo:** `amz162/latent_v_2` (public) · **Classification: `COMPLETE_WITH_OPERATOR_ACTIONS`**

Task 121 (`10a51cf6`) was independently audited by inspecting the implementation itself (not the report), every API route was re-verified statically and dynamically, two real defects were found and fixed, one credential risk was closed, and one production hardening change was deployed and verified. Three security-critical actions remain **operator-only** (admin bootstrap, MFA deployment, GitHub PAT rotation), so the beta is **not** marked launch-ready in this task — per the task's own gate rule.

---

## 1. Session events (context for the evidence)

A sandbox recycle occurred before this task's audit began: the workspace had reset to the scaffold commit and the database had been restored from the stale Nov 3 gz snapshot (Beta/RBAC tables missing — the same drift pattern documented in Task 121). Recovery executed first: `git reset --hard origin/main` to `12d7f41c` (which contains `10a51cf6` — verified in remote history via `git merge-base --is-ancestor`), additive `prisma db push` (backup taken first: `db/backups/task122_pre_rebuild_20261110T143736Z.db`), RBAC seed + strategy/model registry sync re-applied, `INTERNAL_API_TOKEN` regenerated (the recycle had reverted `.env`), server and worker restarted. No data of consequence was lost — zero real users/admins existed, and the paper-trade ledger lives in git-tracked state files by design.

## 2. Independent Task 121 security audit — findings

**Verified sound** (implementation inspected line-by-line):

- **Separate planes.** `AdminAccount` (scrypt `16384$8$1$salt$hash`) + `AdminSession` (sha256 token, 12 h absolute TTL, `revokedAt`) vs `BetaProfile` user sessions + server-only `ProfileAccess`. Separate cookies; an expired admin cookie falls through safely and never grants the user plane (`access-control.ts:311-325`).
- **Lockout & hashing.** Durable DB-backed lockout (5 failures → 15 min), uniform `invalid_credentials` shape (no username enumeration), timing-safe password compare, scrypt parameters parsed from the stored format for future upgrades.
- **No public admin registration / no defaults.** Exactly **4** `AdminAccount` mutation sites exist codebase-wide (bootstrap create, bootstrap reset, login failure counter, login success reset) — grep-verified; no HTTP route creates or promotes admins; no default credentials anywhere.
- **No browser-controlled identity.** Zero code paths read role/permission/plan/status from request bodies (grep-verified across `src/app/api`). `/api/me` is the only identity source for the SPA, and it is computed server-side.
- **Deny-by-default + precedence.** Global switch → per-user override → plan grant → registry default. The global switch correctly beats a per-user ALLOW (verified live — this exact case had a resolver bug that Task 121's tests caught; confirmed fixed in the current code at `access-control.ts:230-232`).
- **Immediate revocation.** Guards re-resolve everything per request; grant → 200 then revoke → 403 verified live with no cache layer.
- **Suspended/deleted/expired handling.** `requireUser` denies SUSPENDED (403), non-ACTIVE (403), expired (403); deleted profiles cascade and their sessions die with the row (verified live).
- **IDOR protection.** Legacy identity (`onboarding`/`plan`/`execute`) derived from the session; cross-user `userId` parameters → 403 (verified live).
- **CSRF & rate limiting.** Same-origin enforcement on admin mutations + logout; SameSite=lax cookies; admin login 10/15 min per-username + 20/15 min per-IP; redemption 30/h per-IP + 400/h global.
- **Audit log.** Append-only by construction (zero update/delete/upsert calls — grep-verified); secret-redaction scan of payloads clean; logout/session/permission/settings/invitation actions all recorded.
- **Usage counters.** Atomic conditional `UPDATE … WHERE count < limit`; 6-thread concurrency cannot overshoot; persisted in SQLite.
- **Health endpoints.** Anonymous `/api/health` returns a minimal liveness shape (no commit, paths, scheduler, beta internals — verified live); full detail requires the admin session or internal token.
- **Cookie flags (live probe via a throwaway admin).** `HttpOnly` ✓, `SameSite=lax` ✓, `Path=/` ✓, `Max-Age=43200` ✓. `Secure` activates from `X-Forwarded-Proto: https` (Caddy sets it; absent only on the direct plain-HTTP probe — expected).
- **Session revocation (live).** Logout → immediate 401 on cookie reuse; `--reset-password` revokes all sessions (verified live).

**Defects found and fixed in this task:**

1. **`scripts/task121_admin_bootstrap.ts` argument-parser infinite loop** — `--reset-password --username <name>` hung at 100% CPU forever (the parser decremented `i` when a flag was followed by another flag, then re-incremented). Found while verifying the recovery path. Fixed; `--reset-password` re-verified end-to-end (password update + session revocation + successful login with the reset password).
2. **Direct-origin MFA bypass** — the production server listened on `*:3000`, so anyone who could reach the host could bypass any reverse-proxy MFA layer. Fixed by binding to loopback: `next start -p 3000 -H 127.0.0.1` (package.json + supervisor), verified: `localhost:3000` → 200, `host-IP:3000` → unreachable, health suite 14/14 after restart. Rollback: remove the `-H` flag and restart (no data impact).

## 3. Route-by-route guard verification

`scripts/task122_route_verify.py` (evidence: `data/backtest_reports/task122/route_guard_verification.json`):

- **Static (117 routes, 127 handlers):** every exported HTTP handler parsed; the guard call must exist **and precede any side-effectful statement** (prisma writes, fs writes, exec, outbound fetch); alternate methods without guards are flagged. Result: **zero problems** (the only flag ever raised was the `/api/` root catalog — a static public JSON endpoint index, correctly allow-listed).
- **Dynamic (124 black-box probes):** every route probed over HTTP with **no credentials**; protected routes must return 401/403/400/405/503 — a 200 on any protected route is a failure. Result: **zero unexpected 200s**. The handful of public endpoints (catalog, `/api/me` anonymous shape, `/api/beta/status`, redemption policy GET, minimal `/api/health`, auth endpoints, machine-token fail-closed POSTs) are explicitly listed with their rationale.
- A route appearing in a map is **not** treated as evidence: the static pass reads each handler's body directly and the dynamic pass exercises the real server.

## 4. Admin bootstrap & recovery verification (§3 of the task)

- One-time creation verified (refuses while any admin exists — twice), password never echoed or logged (piped stdin or raw-mode muted prompt; no plaintext anywhere in the DB — only `scrypt$` hashes), policy enforced **before** creation (weak attempt → error, 0 rows), no HTTP bypass (grep + route sweep), failures leave no partial accounts (creation is the last step; DB error → no row).
- Recovery: `--reset-password` verified working (updates hash, revokes all sessions; login with the reset password → 200). It requires host filesystem access — same trust level as bootstrap.
- **The production admin account was NOT created or reset** (no real operator approval; throwaway test accounts were created, probed and deleted — `AdminAccount` count is 0).
- Exact operator command + login verification steps: `data/backtest_reports/task122/operator_actions.md` §1.

## 5. MFA & session security (§4 of the task)

- A production-ready Caddy `forward_auth` (Authelia TOTP) configuration scoped to `/admin/*` **including `/admin/login`** is provided at `scripts/task122_Caddyfile.proposed`, with exact operator steps and verification commands.
- **Direct origin access can no longer bypass the proxy MFA layer** — the app binds `127.0.0.1:3000` only (verified unreachable on the host IP). This is the architectural precondition for the proxy MFA to be un-bypassable, and it is deployed.
- **MFA itself is NOT deployed and NOT claimed as done** — it requires operator infrastructure access (per the task's "do not guess or simulate completion").
- Cookie settings, revocation immediacy, and login rate limits: verified (§2 and the live probe).

## 6. Production verification (§5 of the task) — all read-only or cleanup-verified

| Check | Result |
|---|---|
| `/`, `/login`, `/admin/login` (anonymous) | 200 |
| `/dashboard` (anonymous) | 307 → `/login` |
| `/admin` (anonymous) | 307 → `/admin/login` |
| `/api/health` (anonymous) | 200 minimal (`detail:"restricted"`, no internals) |
| `/api/llm-signals`, `/api/admin/overview`, `/api/signals/all` (anonymous) | 401 |
| User cookie (test invite): `/api/me` 200 BASIC; `/api/llm-signals` 403 (no permission); `/api/admin/overview` 403; `/dashboard` 200; `/admin` → redirect to login | expected |
| Admin cookie (throwaway): `/api/admin/overview` 200; `/admin` 200 | expected |
| Production build & process manager | `.next` build serving via `next start -H 127.0.0.1` under supervisor; health-gated auto-restart |
| Health suite | **14/14** (internal token) |
| Monitoring worker | alive, heartbeat 1 min old (`worker_health.json` fresh) |
| Database | `PRAGMA integrity_check` ok; 33 tables; 1,042,923 OHLCV rows; frontier backfill re-launched 2026-11-10 |
| Migrations | additive-only `db push`; pre-change backups present (`task121_pre_migration_*`, `task122_pre_rebuild_*`) |
| Beta invitations & redemption | dry-run **10/10** (test invites only — no real invitation created, no emails sent) |
| Data loss check | none — zero real users/admins; ledger in git state files; post-recycle rebuild documented |

## 7. Role & permission matrix (evidence-backed)

All ten required scenarios **PASS with live evidence** — full rows (scenario / expected / actual / evidence source) in `data/backtest_reports/task122/authorization_test_matrix.json`. Sources: today's 59-check security suite (`task121_security_tests.py`, **59 passed, 0 failed**), the 124-probe unauthenticated sweep, the three-cookie production matrix, and the live bootstrap/cookie/revocation probes.

## 8. Git & credentials (§1/§9 of the task)

- Branch `main`; after recovery local HEAD = `12d7f41c` = `origin/main` (verified live). `10a51cf6` confirmed in remote history.
- **One classic `ghp_` PAT (40 chars) was found in ACTIVE credential storage** (`.git/credentials`, repo-scoped `credential.helper=store --file=.git/credentials`). It was **removed** from local active storage (store emptied, `0600`), **not used** for any Task 122 push, and its remote validity deliberately not probed. **Revocation on GitHub is an operator action** — only the dashboard can do it.
- No other exposure: `.zcredentials/` = README only; no shell history files exist; no token-like env vars; remote URL clean; `.env` gitignored (only `DATABASE_URL` + regenerated `INTERNAL_API_TOKEN`).
- Replacement credential (fine-grained PAT: owner `amz162`, only `amz162/latent_v_2`, Contents Read+Write) is **not yet configured by the operator** → **no push was performed**; the Task 122 commit is preserved locally and will push once the operator arms the token via `bash scripts/gh_auth.sh`. Rollback instructions for the one production change (loopback binding) are in §2.

## 9. Deliverables

- `docs/reports/task122_security_closure.md` (this file)
- `data/backtest_reports/task122/security_audit.json`
- `data/backtest_reports/task122/authorization_test_matrix.json`
- `data/backtest_reports/task122/production_health.json`
- `data/backtest_reports/task122/operator_actions.md`
- Supporting evidence: `route_guard_verification.json`, `production_health_raw_matrix.json`, `scripts/task122_route_verify.py`, `scripts/task122_production_matrix.py`, `scripts/task122_generate_artifacts.py`, `scripts/task122_Caddyfile.proposed`

No report contains passwords, PATs, session cookies, or invitation tokens.

## 10. Final classification: `COMPLETE_WITH_OPERATOR_ACTIONS`

**Verified evidence:** 59/59 security suite · 14/14 health · 10/10 invitation dry-run · 117 routes / 127 handlers static + 124 dynamic probes with zero problems · bootstrap one-time/policy/no-partial-account verified · cookie flags & immediate revocation verified live · append-only audit · atomic counters under concurrency · classic PAT removed locally · loopback origin binding deployed and verified.

**Unresolved risks (all operator-side):**
1. No admin account exists yet → bootstrap (operator_actions.md §1).
2. MFA not deployed → Caddyfile/Authelia rollout (§2; the draft config cannot be deployed from the sandbox).
3. The classic PAT may still be valid remotely → must be revoked on GitHub; fine-grained replacement configured and armed (§3).
4. In-memory rate-limit windows reset on server restart (documented Task 117 trade-off; acceptable for single-host beta — the durable pieces (lockout, usage counters, audit) are all in SQLite).

**Beta launch gate:** engineering scope is closed and verified; the launch checklist in `operator_actions.md` explicitly gates beta readiness on the three operator actions. **Git:** local commit awaiting push (no push performed — no authorized credential in scope); remote `main` untouched this task.
