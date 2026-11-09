# Task 121 — Complete Admin Panel, User Panel, RBAC & Platform Management

**Date:** 2026-11-09 · **Repo:** `amz162/latent_v_2` (public) · **Base commit:** `eead9a69` (remote `main` verified before work) · **Classification: `ADMIN_USER_SYSTEM_COMPLETE` (with operator actions documented in §15)**

Every claim below was executed and verified in this session: `tsc --noEmit` clean, production build successful, security suite **59/59 PASS**, health check **14/14 PASS**, task107 regression **29/29 PASS**, task118 invitation dry-run **10/10 PASS**. Evidence files in `data/backtest_reports/task121/`.

---

## 1. Existing application audit (Phase 0)

Four parallel read-only audits covered authentication, all API routes, the full frontend, and schema/operations.

**Identity (before Task 121).** The only live identity was the anonymous `BetaProfile` cookie session (`latent_beta_session`, HttpOnly, SameSite=Lax; raw token only in the cookie, DB stores `sha256(token)`), created exclusively by invite redemption (Task 117 mechanics). `next-auth` was installed but wired to nothing. The legacy `User`/`RiskProfile`/`Plan`/`Trade` tables had **no authentication at all** — `/api/onboarding` created users for any client-supplied email and `/api/plan?userId=` was an unauthenticated IDOR. No middleware existed; no roles anywhere; admin operations were host-CLI only (`scripts/task117_beta_admin.py`).

**API surface.** 97 route files; 91 had zero per-user auth. Critical pre-existing vulnerabilities confirmed and fixed in this task: unauthenticated shell **command injection** in `/api/cron/update-data` (`?symbol=` interpolated into `execSync`), unauthenticated DB mass-writes (`/api/cron/refresh-ohlcv`, `/api/psx/ohlcv/[symbol]`), public LLM-spend endpoints (`/api/llm/*`, `/api/pattern-recognition/*`, `/api/portfolio/news-digest`), a hardcoded default machine key (`"latent-pk-nightly"` in `/api/price-patterns/precompute`), fail-open cron auth, and operational-internals exposure (`/api/health`, `/api/cron/scheduler-status`, `/api/backtest/walk-forward/status`).

**Frontend.** Single SPA at `/` (20 client-side views switched by zustand), nav hardcoded in `AppSidebar.tsx` (16 items, no visibility control), beta app at `/beta` with its own cookie session. localStorage persisted identity (`latent-store-v2`).

**Database.** SQLite `db/custom.db` (1,042,923 `OhlcvBar` rows) managed by `prisma db push` (no migrations). **Schema drift was real:** the live DB (restored from the Nov 3 gz backup by the sandbox recycle) was missing all four Beta tables — invite redemption was silently broken until this task's push repaired it.

**Tabs actually discovered** (registry is exhaustive, not assumed): Dashboard, News & Fundamentals, Technical Analysis, Strategy Signals, Strategy Details (sub-view), Simulated Execution (sub-view), AI Models, Calculators & Tools, Price Pattern Finder, Results Pattern Finder (sub-view), Portfolio Simulator, Strategy Planner, Dividends, Accuracy Tracker, Paper Trade Monitor, Golden Cross Scanner, Volatility Analytics, LLM Signals, Model Performance — plus the beta research dashboard. **Models:** 58 canonical entries in `ensemble.ts` (trained/untrained status is code+artifact-derived). **Strategies:** 12 in `STRATEGY_INVENTORY`, including `pairs_kalman_hedge` which stays blocked (short-leg prohibited, long-only policy) — visibility controls cannot alter that.

## 2. Admin authentication architecture

Separate identity plane, zero shared state with users: `AdminAccount` (username unique, scrypt password `scrypt$16384$8$1$salt$hash`, `isActive`, durable `failedLoginCount`/`lockedUntil`) and `AdminSession` (`sha256(token)` unique, 12-hour absolute expiry, revocable). Cookie `latent_admin_session` — HttpOnly, SameSite=Lax, Secure via `x-forwarded-proto`/`COOKIE_SECURE`. Login enforces same-origin, per-username (10/15 min) and per-IP (20/15 min) rate limits, uniform `invalid_credentials` failure shape (no username enumeration), and a hard 5-failure/15-minute lockout persisted in the DB. Every login, logout, lockout and revocation is audited. Roles are never sent by the browser: the server resolves identity purely from the session cookie → `AdminSession` → `AdminAccount.isActive`. No public admin registration exists anywhere; bootstrap is CLI-only and one-time (§9).

## 3. User authentication architecture

The existing passwordless invite mechanism is reused as the credential (per the task's "reuse rather than introduce an unnecessary password system" rule): `/login` (new page) posts to the existing `/api/beta/invite/redeem` — codes validated server-side against sha256 hashes, failures indistinguishable (no enumeration), per-IP 30/h + global 400/h rate limits. Open-access operator mode (`BETA_INVITE_REQUIRED=false`) still works via profile auto-creation. Logout (`/api/user/logout`) **rotates** the profile's session token hash (old cookie unreplayable) and clears the cookie; re-login requires an invitation (documented operator guidance). Account status lives in the server-only `ProfileAccess` row: `SUSPENDED`/`DELETED`/expired deny every user API immediately (guards re-resolve per request — no cache to bypass). Deleted profiles cascade `ProfileAccess` + `ProfilePermission`, and the session dies with the row (verified by test). Password reset is N/A (passwordless). The invite-only beta flow (`/beta/enter` → redeem → `/beta/onboarding` → `/beta`) is untouched and re-verified by the task118 dry-run.

## 4. Role and permission matrix

Resolution order (deny-by-default), implemented in `resolveEffectivePermissions()`:

| Priority | Source | Notes |
|---|---|---|
| 0 | `registry.globalEnabled = false` | admin master switch — denies EVERY user (admins bypass); core permission `feature.profile` cannot be globally disabled |
| 1 | `ProfilePermission` override | explicit user ALLOW/DENY, set by admin, transactional, audited |
| 2 | `PlanPermission` row | plan grant/deny |
| 3 | registry `defaultEffect` | fallback (most tabs DENY by default) |

**Plans:** BASIC (5 perms: dashboard, market data, feedback, profile, beta research), STANDARD (21: adds signals, models, LLM signals view, reports, calculators, patterns, dividends, strategy planner, per-symbol signal data, backtest reports, LLM interact, exports), PREMIUM (28: adds tracker, paper monitor, golden cross, volatility, portfolio simulator, simulated execution, backtest runs). Admin can rename, enable/disable (default plan cannot be disabled), re-grant per plan, and edit all numeric limits.

**Usage limits (server-enforced, race-safe):** PREMIUM defaults — 50 LLM requests/day, 20 report exports/day, 10 simulator runs/day; STANDARD — 20/5/–; all null (unlimited) unless set; account expiry days optional. Counters live in `UserUsage` (unique `[profileId, day, kind]`, Asia/Karachi day) and are consumed by an atomic conditional `UPDATE … WHERE count < limit` inside SQLite — concurrent requests cannot overshoot (verified with a 6-thread test).

## 5. Tab and feature registry

`PermissionRegistry` — 28 entries (19 `tab.*`, 9 `feature.*`), seeded by `scripts/task121_seed_rbac.ts` (idempotent upserts; never overwrites admin-set values). Tabs map 1:1 to SPA views (`src/lib/latent/view-acl.ts`); features cover feedback, profile, market data, per-symbol signal data, LLM interact, research backtest, backtest reports, reports export, beta research. The sidebar renders only from `/api/me`'s server-resolved permission set; a view without permission renders an access notice instead of the feature. **A hidden tab is also blocked at its API** — every backing route carries the same permission key (§7, evidence `task121_api_authorization_map.json`: 117 routes, **unguarded: none**).

## 6. User plans and limits

See §4 table. Plans are configurable (`/admin/plans`): label, enabled, default flag, five limit fields, and an A/D matrix per plan. Limits and plan changes apply immediately (guards read the DB per request). Remaining permitted usage is shown to users via `/api/me` (`usage` block). No billing/payment integration was introduced (none exists).

## 7. API authorization coverage

Central helpers in `src/lib/latent/access-control.ts` (server-only): `requireUser`, `requireAdmin`, `assertSameOrigin` (CSRF), `guardUser`, `guardAdmin`, `guardAdminOrInternal`, `guardUserOrInternal`, `gateUser` (auth + status + permission + maintenance + feature-pause + atomic usage), `consumeDailyAllowance`, `audit`. The internal machine token (`INTERNAL_API_TOKEN`, timing-safe, fail-closed when unset) is a service identity for health/cron/CI and bypasses user-plane checks without consuming usage.

Coverage (full map with per-route guard + permission in `data/backtest_reports/task121/task121_api_authorization_map.json`):

- **User plane** (~85 routes): every `psx/*`, `scrape/*`, signals, backtest, LLM, pattern, tax, fair-value, monitor route gated with a matching `tab.*`/`feature.*` permission; LLM-spend routes additionally consume `llm_request` allowance and honor `llm_requests_enabled` + global pause; exports consume `report_export`; simulators consume `simulator_run`.
- **Legacy identity rework:** `/api/onboarding`, `/api/plan`, `/api/execute` now derive identity from the session (`beta-<profileId>@users.latent.internal` via `user-identity.ts`); client-supplied emails/userIds are ignored or rejected — both IDORs closed (tests).
- **Admin plane** (`/api/admin/*`, 15 routes): `requireAdmin` + same-origin on mutations + audit on every action.
- **Ops:** `/api/health` detail admin/internal-only (anonymous gets a minimal liveness shape), `/api/cron/scheduler-status`, `/api/cron/update-data`, `/api/cron/refresh-ohlcv`, `/api/backtest/walk-forward/status` admin/internal; `/api/cron/check-tp-sl` accepts any ACTIVE user (browser polling) or internal token; `/api/predictions/record` unchanged (machine token, fail-closed); `/api/price-patterns/precompute` hardened (no default key, constant-time compare).
- **Beta plane:** existing session gating plus ACTIVE-status enforcement, `feature.beta_research` on `/api/beta/insight`, `feedback_enabled` setting on feedback, and `invitations_paused` on redemption.

**Security fixes shipped with the sweep:** command injection eliminated (`execFile` argument-array + `^[A-Za-z0-9.\-]{1,15}$` symbol allowlist + auth), GET-is-not-safe routes authed, model registry filters hidden/stripped models (`ModelAccessConfig`), strategy visibility merged from code inventory + `StrategyConfig` (display-only — calculations, validation status and the pairs/Kalman block are untouchable).

## 8. Database schema and migrations

Additive-only `prisma db push` after a full backup (`db/backups/task121_pre_migration_20261109T180546Z.db`, 194 MB). Verified post-push: 33 tables, all 17 new/Beta tables present, `OhlcvBar` 1,042,923 rows unchanged, `PRAGMA integrity_check` ok. New models: `AdminAccount`, `AdminSession`, `PermissionRegistry`, `ProfileAccess`, `ProfilePermission`, `AccessPlan`, `PlanPermission`, `UserUsage`, `AdminAuditLog`, `PlatformSetting`, `StrategyConfig`, `ModelAccessConfig`, `InvitationEvent` (+ `BetaProfile.access` relation). FKs cascade (`ProfileAccess`/`ProfilePermission` → `BetaProfile`; `AdminSession` → `AdminAccount`); unique constraints enforce identity/counter keys. **Rollback:** stop server → `cp db/backups/task121_pre_migration_*.db db/custom.db` → `bun run build` (old commit) → restart. This also repaired the pre-existing drift (Beta tables were missing from the live DB).

## 9. Admin bootstrap instructions

```bash
# one-time, host-only, while the AdminAccount table is empty:
bun scripts/task121_admin_bootstrap.ts --username <operator-name>
#   → password prompted with muted echo (or pipe: printf '%s\n%s\n' "$PW" "$PW" | bun …)
# recovery for an existing admin (never a second bootstrap):
printf '%s' "$NEWPW" | bun scripts/task121_admin_bootstrap.ts --reset-password --username <name>
bun scripts/task121_admin_bootstrap.ts --list
```

No default password, nothing logged, scrypt-hashed, round-trip self-verified at creation; a second bootstrap **refuses** (test-verified). Password policy: ≥12 chars with upper/lower/digit. After setup, sign in at `/admin/login`. **MFA recommendation:** enforce it at the identity/network layer (Caddy forward-auth or Tailscale/SSO in front of `/admin/*`) — native TOTP was deliberately not added to keep the auth surface minimal; this is recorded as an operator action (§15).

## 10. User management documentation

Admin → **Users**: paginated/searchable list (search by profile id, invite id, or raw invite code; filters status/plan), plan reassignment, expiry setting, suspend/reactivate (reason audited), kill-session (token rotation), permanent delete (confirm dialog, hard delete, feedback retained and marked), feedback count, CSV export (`/api/admin/export/users` — metadata only, never tokens/hashes). **Permissions**: per-user override matrix with Allow/Deny/Reset vs plan defaults, effective-permission column, and change history from the audit trail. **Invitations**: create (label, max uses, expiry) with the raw code shown exactly once, revoke, delete (only if unused), pause-all/resume-all (syncs `BetaConfig` so the CLI agrees), dry-run code validation, full event trail. **Feedback**: all-user triage (new→triaged→resolved, audited). **Tabs & Features**: global master toggles. **Plans & Limits**, **Strategies**, **AI Models**, **LLM Control** (pause switches + provider/failure/evidence stats — no credentials), **System Health**, **Audit Logs** (filterable, expandable before/after), **Platform Settings** (maintenance mode, feature pause, LLM switch, feedback switch, invitations pause, default plan).

## 11. Security test results

`scripts/task121_security_tests.py` — **59 passed, 0 failed** (against the production server; full check list in `data/backtest_reports/task121/task121_test_results.json`). Highlights: one-time bootstrap + refusal of second run; login success/wrong-password/unknown-user uniformity; durable 5-failure lockout + DB-unlock recovery; user→admin API 403; `/admin` landing on the login page; tampered cookie 401; per-user grant → immediate effect → revocation → immediate denial; global switch beating a per-user grant (found & fixed a resolver precedence bug during testing); plan enforcement; IDOR 403s on `plan`/`execute` cross-user; deleted-user session death; suspend → 403 → reactivate; export limit 2 → 3rd 429 with 6-thread concurrency bypass attempt failing; counters persisted; invitation create-once-and-redeem; pause-all blocking redemption; maintenance mode 503 for users while admin unaffected; audit recorded with **no secrets** in payloads; cross-origin mutation 403; command-injection probe rejected; health minimal-vs-full split; redemption rate limit engaging.

## 12. Regression results

- `scripts/server_health_check.py`: **14/14** (updated to send the internal token — the RBAC model requires it; no assertion was weakened).
- `scripts/task107_v2_tests.py`: **29/29** (monitoring semantics untouched).
- `scripts/task118_invitation_dryrun.py`: **10/10** (an initial 7-fail run was rate-limit bucket exhaustion from the security suite — in-memory per-IP window, documented; fresh restart → all pass).
- `tsc --noEmit`: clean. `bun run build`: success. Production restarted via `start_server.sh`; worker `task108_worker` running with fresh heartbeat and post-window EOD reconciliation completed.
- Worker/provider behavior: unchanged (worker writes state files directly; browser-facing `check-tp-sl` polling preserved for ACTIVE users).

## 13. Production deployment status

**Deployed.** Production build compiled and serving on `:3000`; health suite green; DB migrated with backup; seed applied (28 registry entries, 3 plans, 6 settings, 12 strategy configs, 58 model configs). First admin **not** auto-created (per non-goals — no known-password bootstrap); the operator creates it via §9 in ~30 seconds. Until then `/admin/login` works but no account exists — users are unaffected.

## 14. Rollback instructions

1. **Code:** `git log --oneline -3` → checkout the pre-Task-121 commit (base `eead9a69`) or `git revert` the Task 121 commit; `bun install && bun run build`; `bash scripts/start_server.sh`.
2. **Database:** stop server → `cp db/backups/task121_pre_migration_20261109T180546Z.db db/custom.db` → restart (restores the exact pre-push state including the then-missing Beta tables).
3. **Runtime toggles (no rollback needed):** maintenance mode ON locks users out instantly; feature pause stops LLM/backtest spend; invitation pause-all stops redemptions — all reversible in `/admin/settings` & `/admin/invitations`.
4. **Sessions:** admin `--reset-password` revokes all admin sessions; per-user kill-session rotates user tokens.

## 15. Remaining operator actions

1. **Create the first admin** (§9) — required before the control center is usable; bootstrap closes permanently after.
2. **MFA for the admin plane** — enforce at the reverse-proxy/identity layer in front of `/admin/*` (recommended in-app notice is shown on the login page).
3. **GitHub push** — blocked in this sandbox: `.zcredentials/` contains only the README (the operator-provided token from the Task 120 session did not survive the sandbox recycles, and the legacy classic PAT is auto-revoked — `push --dry-run` fails with `Invalid username or token`). The Task 121 commit is preserved locally; run `gh_auth.sh` with a fresh fine-grained token (Contents: Read/Write on `amz162/latent_v_2` only) and `git push origin main`.
4. **Review default plan grants** to match your cohort policy (BASIC is intentionally conservative).
5. Optional: retire dead `AppNav.tsx` and the unused `next-auth` dependency in a later cleanup task.

---

### What was implemented (summary)

Two separated login experiences (`/admin/login` + `/admin/*` control center; `/login` + `/dashboard` user panel); 15 admin API routes and 12 admin sections (overview, users, permissions, plans, tabs, strategies, models, LLM, invitations, feedback, monitoring, audit, settings); per-user + plan + global permission resolution with deny-by-default; server-enforced usage limits with atomic counters; append-only audit logging on every administrative and security event; full API authorization sweep of 117 routes with zero unguarded endpoints; secure one-time admin bootstrap; session-derived identity fixing two IDORs and a command-injection RCE; additive DB migration with backup; 59-check security suite plus three regression suites all green.
