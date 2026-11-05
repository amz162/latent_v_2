# Task 117 — Latent.pk Controlled Beta Launch & Operational Hardening

**Date:** 2026-11-05 · **Baseline HEAD:** `e5e4975f` (Task 116) · **Final HEAD:** see commit (Part N) · **Release state: `INVITE_ONLY_BETA_READY`**

## 1. Scope and outcome

Task 117 converted the Task 116 "beta-ready" build into a **controlled, invite-only beta** with hardened profile security, verified compliance information, curated outbound-fetch policy, an honest monitoring surface and a 45-check acceptance suite. No redesign, no retraining, no model promotion, no trading paths were introduced. All Task 112–116 artifacts, ledgers and reports are preserved; the only data migration destroyed raw session-token values (replaced by sha256 hashes — the profiles themselves, including the Task 116 test profile, survive).

## 2. Part A — repository and deployment baseline (verified, unchanged)

- Start HEAD `e5e4975f` = `origin/main`, working tree clean; Task 116 artifacts present under `data/backtest_reports/task116/`.
- Production config on this host: Caddy (`:81` → `localhost:3000`), Next.js dev server under the self-healing `scripts/server_supervisor.sh`, Bun 1.3, Python 3.12 worker pipeline under host supervisor, persistent SQLite volume (1,042,969 verified bars, frontier 2026-11-05).
- Beta flag: `BETA_ONBOARDING_ENABLED` env + runtime `BetaConfig` table; health endpoint returns `task117-beta` after this task.
- Rollback path: `scripts/start_server.sh` (full app restore after host recycle); `db/backups/pre-task117-*.db` snapshot taken before the schema migration.

## 3. Part B — GitHub PAT remediation

Evidence-based classification (no values printed anywhere):

| Item | Finding |
| --- | --- |
| Transcript-exposed token (`upload/github_token.txt`) | **Fingerprint-identical** (sha256) to the token committed at `273eab31` as `.zcredentials/github_token` — the historically stored credential that GitHub secret scanning auto-revoked (repo is public). Presumed dead; operator should visually confirm at github.com/settings/tokens. |
| Armed credential (`.git/credentials`) | **Different token** (fingerprint mismatch); never printed, never committed; used for the Task 116 push. Valid at check time. |
| Least privilege | **FAIL** — scopes include `admin:enterprise`, `admin:org`, `admin:org_hook`, `delete:packages`, etc. Needed: fine-grained token, Contents RW on `amz162/latent_v_2` only. |
| Account hygiene | 2FA is **disabled** on the owning account (`amz162`). |
| Containment | Source tree clean; `upload/github_token.txt` untracked; all 164 history commits scanned for full-length token patterns — exactly one real value ever committed (the dead one above); workflows use only `secrets.GITHUB_TOKEN`; remote URL carries no token. |
| Credential replacement | **`OPERATOR_ACTION_REQUIRED`** — rotate to a least-privilege token, enable 2FA, install via `.zcredentials/github_token.local` + `bash scripts/gh_auth.sh`. No replacement was generated, requested in chat, or used. No history rewrite (unauthorized and unnecessary while the token is dead). |

Full record: `data/backtest_reports/task117/task117_security_status.json`.

## 4. Part C — invite-only beta access

- **Access policy:** beta disabled globally when `BETA_ONBOARDING_ENABLED=false` **or** the runtime `BetaConfig.betaDisabled` flag is set (env always wins; disabling never deletes data). When enabled, profile creation requires a redeemed invitation (`BETA_INVITE_REQUIRED=true` default) — there is no public signup. The operator may set `BETA_INVITE_REQUIRED=false` to open access deliberately.
- **Invitations:** operator CLI (`scripts/task117_beta_admin.py`) creates tokens shown **exactly once**; only sha256 hashes are stored. Status (`active|revoked`), creation, expiry, per-invite redemption cap and redemption audit (profile ids, no tokens) are recorded. No personal information is collected — no name, email, phone, CNIC or IP (rate-limit keys are hashes).
- **Validation:** server-only (`POST /api/beta/invite/redeem`); invalid/expired/revoked/exhausted/paused all return one identical generic message and status — no enumeration. Abuse protection: 30/hour per IP-hash + 400/hour global sliding windows.
- **Admin controls:** CLI only — `create-invite`, `revoke-invite`, `list-invites`, `set-flag` (disable beta / pause registrations with a user-visible reason), `show-config`, `cleanup-expired` (documented 60-day retention), `export-feedback`. **No admin HTTP endpoint exists**; access protection is host login, the existing authentication boundary.
- **Graceful fallback:** failed redemption shows one clear bilingual message; closed/paused beta shows the operator's plain-language note; no database errors, stack traces or environment details reach the client (Task 117 error taxonomy, below).

## 5. Part D — beta profile security and privacy (audited + hardened)

| Requirement | Status |
| --- | --- |
| Cryptographically secure token | `crypto.randomBytes(32)` per session — unchanged from Task 116. |
| Raw tokens server-side | **Fixed:** raw `sessionToken` column **dropped**; `sha256(token)` stored. Existing row migrated (hash recomputed — cookie kept working); DB leak can no longer be replayed. Test: `D2/D3/D4`. |
| Cookie flags | HttpOnly always; **Secure follows the real request flow** (`x-forwarded-proto` via Caddy or `COOKIE_SECURE` override — `NODE_ENV` was wrong here because the host serves through a proxy); SameSite=Lax (explicit in code; Next's serializer omits the default value — browsers treat absence as Lax). Test: `02b/D5`. |
| Cross-profile isolation | Every query filters by the exact session hash; the API exposes **no identifier parameters at all**. Tests `06a/06b/07` (A cannot read or delete B; focused repro confirmed correct row-level scoping). |
| CSRF/origin | SameSite=Lax + `sameOrigin()` check on all writes (POST/DELETE). Test: `D1`. |
| Sensitive values in logs | **Fixed:** Prisma query logging (which embeds parameter values) disabled by default in `src/lib/db.ts`; routes log errors without payload detail. |
| Deletion / reset | DELETE hard-deletes the row and clears the cookie; `action:"reset"` issues a **new identity**, old cookie stops resolving (test `08`), invite binding preserved. |
| Retention | Documented 60-day cleanup of stale complete profiles via CLI. |
| Identity honesty | "Saved on this device" disclosure retained and surfaced in the privacy panel: anonymous cookie profile, not a verified account, not synced. |
| Forbidden data | None collected (no CNIC, broker credentials, passwords, bank details, account numbers) — enforced by fixed answer enums and disclosure text. |

## 6. Part E — consent and disclosure

`GET /api/beta/status` now returns a **9-point consent text** (version `beta-consent-v1`) covering: beta research platform; twelve unvalidated strategy components; uncalibrated GLM-4.6 conviction; insufficient LLM forward outcomes; no past-results guarantee; hypothetical reference levels; no broker orders; possible stale data; user responsibility + not-a-licensed-adviser statement. Onboarding step 1 renders the full list and requires an explicit checkbox before "Next" unlocks; acceptance stores the version **and** timestamp (`consentAcceptedAt` set only on acceptance). The dashboard carries the permanent **"SHADOW / BETA RESEARCH — NOT AN ORDER"** banner with bilingual sub-text (en / roman-Urdu / Urdu strings). No exaggerated claims or guaranteed-return language exist anywhere in the beta surfaces; the platform is never described as a licensed broker or adviser.

## 7. Part F — Redis decision: **do not provision** (documented degraded mode)

Evidence (recorded in `task117_hosting_operations.json`): the VM has 2 CPUs and 4 GB RAM with only ~170–760 MB available while app + worker + Caddy run; a Redis process (plus fork overhead for persistence) risks OOM-killing the app or data pipeline — precisely the "jeopardize the existing host" case. Durable guarantees do **not** depend on Redis: worker singleton locks and idempotency ledgers are host/SQLite based; prediction history, profiles, invites, feedback and configuration are all durable SQLite state. Cache consumers are read-through (miss ⇒ recompute from verified data). The Task 117 rate limiter is in-process and documented as abuse-protection-only; multi-instance deployment is not supported by design. Revisit triggers: RAM upgrade, real multi-instance need, or cross-process limiting requirements.

## 8. Part G — news domain allowlist

`src/lib/latent/news/allowlist.json` (`news-allowlist-v1`, reviewed 2026-11-05): five domains with hostname, purpose, actual application usage, HTTPS requirement, redirect policy, content-type restriction and review status — `api.askanalyst.com.pk` (VERIFIED, provider news API), `www.dawn.com`, `tribune.com.pk`, `www.brecorder.com`, `www.psx.com.pk` (REVIEWED; live re-check each review cycle). Enforcement lives inside `fetchArticleSecure` **before any network activity**: exact-host match, default **reject** (`domain_not_allowed`), `NEWS_ALLOWLIST_MODE=monitor` available for one review cycle. All prior Task 116 transport guarantees remain (https-only, per-hop DNS/IP revalidation, 3-hop cap, 2 MB cap, HTML/text/JSON content types — PDFs and unexpected types rejected). The end-to-end harness (`scripts/task117_news_guard_harness.ts`, run through the complete fetch flow) passes: http rejected, private/metadata IPs rejected, public non-allowlisted host rejected, malformed rejected, subdomains not wildcarded, live allowlisted fetch verified. No domain was added because it appeared in an LLM response.

## 9. Part H — tax and Shariah verification

Schedule upgraded to **`pk-tax-v2026-11-r2`** (verified 2026-11-05 against PwC Worldwide Tax Summaries, Pakistan — individual income determination, last reviewed 24 Aug 2026, i.e. current post-Finance-Act-2026 law):

| Rule | Rate | Status |
| --- | --- | --- |
| CGT, listed securities acquired ≥ 2024-07-01, seller on ATL at acquisition AND disposal | 15% flat | **VERIFIED** |
| CGT, same vintage, seller not on ATL | personal slab rates, statutory **floor 15%** (not the commonly cited flat 30%) | **VERIFIED (rule)** — calculator applies the 15% floor and labels the output **PROVISIONAL** (slabs need total income) |
| CGT graded table, acquisitions 2022-07-01…2024-06-30 | 15 / 12.5 / 10 / 7.5 / 5 / 2.5 / 0% by holding period | **VERIFIED** (reference table) |
| Acquisitions ≤ 2022-06-30 / before 2013-07-01 | 12.5% / 0% | **VERIFIED** (reference) |
| Dividend WHT — filer | 15% final | **VERIFIED** |
| Dividend WHT — resident inactive taxpayer | **30%** (100% uplift) | **VERIFIED** (resolves Task 116's UNVERIFIED flag) |
| Securities capital losses | carry-forward up to 3 tax years | **VERIFIED** |

Every rate carries effective date, taxpayer category, source URL and verification date in `task117_tax_verification.json`. The standing disclaimer ("illustrative estimate only — not professional tax advice") is shown by the calculators. **Shariah:** remains an optional profile preference; exposure is limited to provider-listed Islamic indices (e.g. KMI30) with the provider's methodology/as-of date; the system never infers religion and makes no universal compliance claim — no authoritative per-security compliance list is claimed.

## 10. Parts I & J — beta UX, monitoring, resource controls

- **First-run experience:** welcome panel (saved preferences, current data frontier/bars, risk facts) + "How Latent works" page: plain-language overview, all **12 components** with what-it-measures / role / votes-direction vs context-only badge / why-unavailable / key limitation, the GLM-4.6 explainer (decision, evidence cutoff, written reason, conviction explicitly uncalibrated, availability honesty), and a "what you will never see" list. Regime/pair gates are never labelled as trade recommendations.
- **LLM honesty:** per-symbol panels show decision + uncalibrated conviction + evidence cutoff + model; agreement **and conflict** are displayed (a CONFLICT panel was observed live during browser QA); unavailable symbols say so.
- **Feedback:** six fixed categories, 3–2000 char validated message, per-session (5/day) and per-IP (10/day) limits, spam heuristics, acknowledgment returned **only after the row persists**; CLI export strips identity (CSV has no tokens).
- **Monitoring:** `/api/health` now includes the operational block — data frontier + age, last ingestion (time/provider/result), worker heartbeat + staleness flag, scheduler status, LLM status, release state, runtime beta configuration (paused/disabled/reason). Ordinary users never see internals; errors map to a 10-class taxonomy (`src/lib/latent/error-codes.ts`) with user-safe bilingual-friendly messages; stack traces stay in server logs.
- **Resource controls:** per-route rate limits (insight 60/h/session + 120/h/IP; profile writes; deletes; feedback; invite redemption global+per-IP); insight remains capped at 12 symbols/request with a bounded 400-bar window; no expensive model computation runs synchronously in normal UI requests (insight reads stored LLM records only).

## 11. Part K — controlled beta acceptance results

`scripts/task117_tests.py`: **45 passed, 0 failed** — covering all 20 required checks: invalid/valid/single-use/expired/revoked invitations; cross-user read and delete isolation; reset invalidation; versioned consent; global disable with no data leakage; LLM history untouched; mock signals excluded from performance; evidence freshness; context-only strategies excluded from directional consensus; no fake performance; feedback persistence + token-free export; desktop/mobile browser flows; profile/database persistence across migration and restart; worker singleton + idempotency ledger intact. Plus: cookie-flag, origin-check, hash-storage and rate-limit checks.

Regression: task107 v1 **30/0**, v2 **29/0**, task110 **62/0**, task111 **34/0**, task112 **66/0**, task113 **65/0**, task114 **30/0**, task115 **22/0**, task116 **35/0 (py)** and **20/0 (bun test)** — the four Task 116 assertions that referenced the old code layout were updated to the equivalent (stronger) Task 117 invariants, documented in `task117_regression_results.json`. `tsc --noEmit` clean; `bun run build` exit 0 (17/17 pages). Browser: desktop 1440×900 full flow PASS (including a UI feedback submission that persisted with acknowledgment); iPhone-16 emulation 393 px PASS with no horizontal overflow.

## 12. Part L — release state

**`INVITE_ONLY_BETA_READY`.** Critical invitation, profile-privacy, database, secret-containment and application-health checks pass. This is **not** a public-launch claim: invitations are operator-issued, unverified tax estimates stay explicitly labelled, all twelve strategies remain research-only, GLM-4.6 remains shadow/research-only, there is no broker order path and no automatic model promotion. `BETA_PAUSED` / disable remain one CLI command away (`set-flag --disable-beta`).

## 13. Remaining operator actions

1. **Rotate the GitHub PAT** to least-privilege and enable 2FA (Part B record); re-arm via `scripts/gh_auth.sh`.
2. Confirm the old token shows as revoked at github.com/settings/tokens.
3. Switch the serving process from `next dev` to the verified production build (`next start`) behind Caddy before inviting users.
4. Run the data pipeline once to refresh the stale worker heartbeat (>48 h at task time), then issue the first real cohort invitations via the CLI.
5. Optional: schedule the 90-day allowlist/tax re-verification review.
