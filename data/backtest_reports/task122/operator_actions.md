# Task 122 — Operator Actions Required

All engineering-side security work is complete and verified. The following actions require **operator** access (GitHub dashboard, infrastructure credentials) and cannot be executed from the sandbox. Until items 1–3 are done, the beta must **not** be launched.

---

## 1. First admin bootstrap (required before the control center is usable)

No admin account exists and none may be auto-created (no default credentials, per policy). Run on the production host, inside the repository:

```bash
bun scripts/task121_admin_bootstrap.ts --username <operator-username>
# interactive: password prompted with echo suppressed; type it twice to confirm
# or non-interactive (both lines = the same password):
#   printf '%s\n%s\n' "$PW" "$PW" | bun scripts/task121_admin_bootstrap.ts --username <operator-username>
```

- Password policy: ≥ 12 characters with upper-case, lower-case and digits.
- Bootstrap is **one-time**: it refuses while any admin account exists. Recovery for a lost password is `--reset-password` (verified working; revokes all existing sessions).
- Weak passwords are rejected **before** any account row is created (verified: 0 rows left behind).

**Verify successful login:**
1. Open `https://latent.pk/admin/login` (through the proxy).
2. Sign in with the username/password → you land on `/admin` (Overview).
3. `GET /api/admin/auth/session` with the session cookie → `{"ok":true,"username":"<operator-username>"}`.
4. The audit log (`/admin/audit`) shows `admin.login` with result `ok`.
5. After 12 hours the session expires — sign in again (sessions are also revoked server-side on logout/password reset).

---

## 2. MFA enforcement on `/admin/*` (required before beta launch)

**Status: designed and provided, NOT deployed** — deploying needs Caddy/Authelia operator access, so it is not claimed as done.

The application now listens on **127.0.0.1:3000 only** (changed in Task 122, verified: the host-IP origin is unreachable). The only public entry is the Caddy proxy, so a proxy-level MFA gate cannot be bypassed by direct origin access. A complete, production-ready configuration is provided at `scripts/task122_Caddyfile.proposed` (Caddy `forward_auth` → Authelia TOTP, scoped to `/admin/*` **including `/admin/login`**).

Operator steps:
1. Deploy Authelia (or any OIDC provider with TOTP) reachable from Caddy; enroll the operator with TOTP.
2. Adapt `scripts/task122_Caddyfile.proposed`: real domains, Authelia session secret (`openssl rand -hex 32`), then `caddy validate --config Caddyfile && systemctl reload caddy`.
3. Verify:
   - `curl -I https://latent.pk/admin` → 302 to the Authelia portal (MFA **before** the app login page);
   - after TOTP sign-in, the Latent.pk admin login still requires the app username/password (defense in depth — proxy MFA plus application auth);
   - direct access to `http://<server-ip>:3000/` must fail from outside (firewall if needed — with the loopback binding it already fails);
   - `curl -I https://latent.pk/` still works without MFA for normal users.

---

## 3. GitHub credential rotation (required before the next push)

**Status: classic PAT removed from local active storage (done in Task 122); revocation on GitHub + replacement still required.**

What was found and done:
- One **classic `ghp_` PAT (40 chars)** sat in the active credential store `.git/credentials` (gitignored, `credential.helper=store --file=.git/credentials`). It was **removed** on 2026-11-10 (store emptied, `0600`). It was **not used** for any Task 122 push and its remote validity was deliberately not probed.
- No other local token material exists: `.zcredentials/` holds only the README; there are no shell history files; no token-like environment variables; the git remote URL carries no embedded credentials.

Operator steps:
1. **Revoke the classic PAT**: GitHub → Settings → Developer settings → Personal access tokens (classic) → delete every token for this repo (the one removed locally may still be valid remotely — revocation is only possible from the dashboard).
2. **Create the replacement — fine-grained PAT only**:
   - Repository access: **Only select repositories → `amz162/latent_v_2`**
   - Permissions: **Contents → Read and write**; everything else → No access
   - No organization/scope beyond that repository; short expiry (≤ 90 days) recommended.
3. **Arm it locally** (never commit it):
   ```bash
   # write the token into the gitignored durable file, then:
   bash scripts/gh_auth.sh          # copies it into .git/credentials (armed store)
   git push origin main             # Task 122 commit is waiting locally
   ```
4. Verify: `git ls-remote origin refs/heads/main` shows the new pushed HEAD.

Until step 3, pushes from this workspace are impossible by design (GitHub Actions workflows use repo secrets and remain unaffected).

---

## 4. Routine production checks after the above

- `python3 scripts/server_health_check.py` → expect **14 passed, 0 failed** (uses `INTERNAL_API_TOKEN` from `.env`).
- `/admin` pages reachable only behind the MFA portal; `/dashboard` requires an invitation code.
- Worker heartbeat fresh: `data/backtest_reports/task107/ops/worker_health.json` (`heartbeat_at` within ~15 minutes during market windows).
- DB integrity: `PRAGMA integrity_check` = `ok` (verified 2026-11-10).
- Backups present: `db/backups/task121_pre_migration_20261109T180546Z.db`, `db/backups/task122_pre_rebuild_20261110T143736Z.db`.

## Beta launch gate (summary)

| Gate | Status |
|---|---|
| Engineering security closure (auth planes, route sweep, isolation, limits, audit) | **DONE — verified** |
| First admin bootstrap | **OPERATOR** (§1) |
| MFA on `/admin/*` | **OPERATOR** (§2) |
| Classic PAT revoked on GitHub | **OPERATOR** (§3.1) |
| Fine-grained PAT configured and armed | **OPERATOR** (§3.2–3.3) |

**Beta launch readiness: NOT READY until items 1–3 are complete.** Classification for the engineering scope: `COMPLETE_WITH_OPERATOR_ACTIONS`.
