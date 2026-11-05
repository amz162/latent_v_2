# Task 118 — Production Cutover, Data Recovery & First-Invite Readiness Audit

**Date:** 2026-11-05 · **Baseline HEAD:** `d2823192` (Task 117, unpushed) · **Final HEAD:** see Part O · **Final release state: `INVITE_ONLY_BETA_READY_WITH_OPERATOR_ACTIONS`**

## 1. Part A — baseline (verified, nothing reset)

HEAD `d2823192` on `main`, parent `e5e4975f`, exactly **1 commit ahead of `origin/main`**, working tree clean at start. Task 117 commit, all 7 artifacts and the T112–116 report sets intact. Runtime at start: `next dev` (`task117-beta`, heartbeat stale 3018 min). Deployment snapshot saved (no secrets): `task118_deployment_snapshot.txt`. `git fetch` confirmed `origin/main` had not moved (Actions had committed nothing since Task 116) — the push will fast-forward.

## 2. Part B — credential security (status only)

- Historical PAT: presumed **revoked by GitHub secret scanning** (fingerprint-matched in Task 117 to the token committed at `273eab31`); agent-side proof is impossible without using the token (forbidden) — operator visual confirmation at github.com/settings/tokens remains.
- Replacement: **`OPERATOR_ACTION_REQUIRED`** — `.zcredentials/github_token.local` still absent; armed classic token verified live (read-only `/user`) to still carry `admin:enterprise`, `admin:org`, `delete:packages`, etc. Required scope: fine-grained, single repository, Contents Read/Write only.
- **2FA: observed DISABLED** on `amz162` → `OPERATOR_ACTION_REQUIRED`.
- Secret scans (tracked files, Task 117 commit, `.next`/public bundles, runtime logs, credential paths, workflows): **all clean**.

## 3. The website bug — "rendering and compiling continuously": FIXED

**Root cause (evidence):** the host ran the **development server**; every first hit compiled on demand (webpack, dev HMR) under a 4 GB host, port-3000 timeouts tripped the supervisor's 20 s poll, producing **34 crash-restarts** ("port 3000 not responding - recovering") each recompiling the app. The (now stopped) `pattern-precompute` mini-service had also been driving per-symbol LLM calls into upstream 429s. Additionally `package.json` `"start"` was literally `next dev -p 3000` — production start was impossible by construction.

**Fix:** production cutover (Part C): supervisor defaults to `LATENT_RUNTIME=prod` → `next start -p 3000` (builds if `.next/BUILD_ID` missing), 50 MB log rotation, startup health probe; `start` script corrected; `start_server.sh` gained an explicit `LATENT_RUNTIME=dev` rollback. Post-cutover verification: zero dev-bundle markers in served HTML, zero compile lines after start, supervisor restart loop ended, all routes 200.

## 4. Part C — production cutover (VERIFIED)

Sequence: pre-task118 DB backup → dev server stopped → `tsc` clean → fresh `bun run build` (**exit 0, 17/17 pages**) → production supervisor started (**ready in 2 s**) → verification: `/api/health` 200 with `task117-beta`, critical journeys (`/`, `/beta/enter`, `/beta/onboarding`, `/beta/how-it-works`, `/api/beta/status`, `/api/track-record`, `/api/model-report`) all 200, API health script **14/14**, Caddy `:81` proxy 200 with forwarded `X-Forwarded-Proto` (Secure-cookie path), only the app proxy exposed (`:3000` loopback, no worker/db ports public). Rollback path: `LATENT_RUNTIME=dev bash scripts/start_server.sh`; pre-cutover build/backup retained.

## 5. Part D — data pipeline restored

- **Diagnosis of the stale heartbeat:** the always-on `task108_worker.py` daemon died at `2026-11-03T19:48Z` (process never restarted after workspace restore; `worker_health.json` frozen at the dead pid). One-shot/scheduled monitor runs had continued, masking the dead daemon. Not a lock or provider failure: the dead-pid lock was stolen by the worker's own guard on restart.
- **Fix:** started via the normal path `scripts/task108_runner.py worker` — after fixing a real bug found en route: the runner crashed because `logs/` (wiped by sandbox recycles) was not recreated; the runner now `mkdir`s it. Worker is **alive** (fresh heartbeat `2026-11-05T21:40Z`, correct pre-window idling at 02:40 PKT; window 09:45–15:45 PKT).
- **Fresh data:** `task107_daily_ingest.py` returned `no_new_data` with **69 overlap bars revalidated, 0 mismatches** — provider live; **frontier 2026-11-05 is genuinely the latest finalized session** (2026-11-06 pre-market had not traded; no date invented; delayed quotes never substituted for finalized OHLC).
- **Maturity continuity:** deterministic recount on the preserved session-clock engine: **114 matured fixed-horizon outcomes, 57 pending, realized 251,057.33 PKR, open MTM 115,928.22 PKR, 3 horizon cohorts**; historical signals unchanged; no retraining, no threshold tuning, no fabricated P&L.
- **LLM pipeline:** frozen Task 111/112 records consumed read-only — **48/48 REAL_LLM_DECISION records carry evidenceHash + quality score**, history untouched (71 files), mock records excluded. Provider classified **DEGRADED (upstream z-ai 429 rate-limit)** — a probe returned 502 wrapping the upstream 429; no new LLM calls were triggered, no duplicate decisions, conviction remains uncalibrated.

## 6. Part E — database (VERIFIED)

`PRAGMA integrity_check`/`quick_check` **ok**; read/write probe ok (temp-table rollback probe); online-API backup taken (`db/backups/task118-verified-*.db`); **restore test in an isolated temp directory: integrity ok, row reconciliation MATCH across 15 tables**; disk 5.2/10.5 GB used (53%); backup retention: multiple generations present. OHLCV (1,042,969), BetaProfile, BetaInvite, signal history, LLM evidence, forward outcomes and idempotency artifacts all intact. Bar delta vs Task 117 = **0, explained**: 2026-11-05 remains the last completed session (see Part D).

## 7. Parts F & G — cache safety and invitation dry run

Redis remains **deliberately unprovisioned** (Task 117 decision preserved): durable guarantees (worker locks, idempotency, invites, profiles, feedback) are SQLite; HTTP rate limiting is documented as process-local abuse protection — **no distributed rate-limiting is claimed**; degraded mode is visible in `/api/health`. A real incident validated the design: the acceptance suite's abuse loop tripped the 30/h invite limiter during E2E; a supervisor restart cleared it (documented in `task118_runtime_health.json`).

**Invitation dry run on PRODUCTION — 10/10 PASS** (`task118_invitation_dry_run.csv`): valid redeem, single-use reuse rejected, expired rejected, revoked rejected, **redemption cap (2/2 → 3rd rejected)**, invalid random rejected (all uniform 403s — indistinguishable), **global pause blocks redemption**, **runtime disable** flips status and refuses redemption, re-enable clean. Test identities fully cleaned (0 test invites left). No genuine invitations created.

**Operator CLI (exact, verified syntax):**
```bash
cd /home/z/my-project
python3 scripts/task117_beta_admin.py create-invite --label "cohort1-user1" --max-redemptions 1 --expires-days 14
```
The token prints **once** — copy it immediately and deliver via a private channel (e.g. direct message/email, never public chat or the repo). Revoke anytime: `python3 scripts/task117_beta_admin.py revoke-invite --token <token>`; audit: `... list-invites`.

## 8. Part H — tax consistency (RESOLVED)

The Task 117 phrase "no rate remains unverified" meant *no unknown rates* — it did **not** mean the calculator is fully verified. Made precise: verification states are now `VERIFIED_STATUTORY_RATE` (filer CGT 15%; dividends 15%/30%) and `VERIFIED_RULE_PROVISIONAL_IMPLEMENTATION` (non-filer CGT: slab rates with verified 15% floor; calculator implements the floor only — output stays PROVISIONAL, label **not** removed). A **stale UI label** was found and fixed: `CgtCalculator` still displayed Task 116's "the 30% figure shown is a commonly cited estimate" — now states the floor applied and the slab dependence. FBR's index confirms the governing instrument (Finance Act 2026 → Tax Year 2027 card); the TY2027 card PDF is not fetchable from this sandbox — recorded honestly, with PwC (reviewed 24 Aug 2026) as the transcribed source and the operator download path documented. `task118_tax_consistency.json` carries the full matrix.

## 9. Parts I & J — source guard and honest status

News allowlist re-verified (8 deterministic checks PASS; live-fetch SKIP is a sandbox-egress limitation of the test, not the app); LLM source quality: every real decision references its evidence hash/quality score; lineage audits present. User-facing honesty: dashboard keeps the **SHADOW / BETA RESEARCH — NOT AN ORDER** banner and separate fusion / LLM / evidence-quality / risk / freshness panels; LLM unavailability is stated per symbol; Model Performance view shows honest-descriptive language and **no fake 62% win-rate**; worker/cache internals stay operator-only (`/api/health`).

## 10. Part K — end-to-end on PRODUCTION (PASS)

Desktop 1440×900: gate → redeem → consent → onboarding → dashboard (banner/welcome/fusion/frontier/feedback/privacy all verified true) → advanced strategy detail → main-app **LLM Signals** and **Model Performance** views → feedback submitted via UI (persisted, acknowledgment shown) → profile **deleted** → old identity invalidated (redirected to gate; DB row count confirmed). Restart mid-E2E (rate-limiter clear): state intact. Mobile iPhone-16 393 px: gate + how-it-works (12 components) render, no horizontal overflow. **0 console errors on both viewports.** All identities isolated and cleaned afterwards.

## 11. Parts L/M — gates

| Gate | Status |
| --- | --- |
| Historical PAT revoked | Presumed revoked by platform — operator visual confirmation pending |
| Replacement fine-grained PAT | **OPERATOR_ACTION_REQUIRED** |
| GitHub 2FA | **OPERATOR_ACTION_REQUIRED** (observed disabled) |
| Production runtime / Caddy | **VERIFIED** |
| Database integrity / backup restore | **VERIFIED** (MATCH) |
| Worker heartbeat / fresh frontier / scheduler | **FRESH / VERIFIED / HEALTHY** |
| LLM provider | **DEGRADED** (upstream 429; pipeline operational) |
| News guard / tax schedule | **VERIFIED / correctly classified** |
| Invitation dry run / profile isolation / feedback | **PASS** |
| Mobile + desktop browser | **PASS** (0 console errors) |
| Rollback procedure | **VERIFIED** |

**Final release state: `INVITE_ONLY_BETA_READY_WITH_OPERATOR_ACTIONS`** — everything code-side and ops-side is green on the production runtime; the two credential gates (PAT rotation, 2FA) are operator-only and block the *first genuine invitation*, not the release readiness of the software.

## 12. Remaining operator actions before the first real invitation

1. Rotate the GitHub PAT (fine-grained, single repo, Contents RW), enable 2FA, arm via `.zcredentials/github_token.local` + `bash scripts/gh_auth.sh`.
2. Confirm the historical token shows revoked in the GitHub UI.
3. Create the first invitation with the verified CLI command above and deliver it privately.

Artifacts: `docs/reports/task118_production_cutover_audit.md` (this file) + `task118_release_readiness.json`, `task118_runtime_health.json`, `task118_data_frontier_audit.json`, `task118_database_integrity.json`, `task118_security_status.json`, `task118_tax_consistency.json`, `task118_invitation_dry_run.csv`, `task118_regression_results.json`, `task118_deployment_snapshot.txt`. Task 112–117 artifacts preserved untouched.
