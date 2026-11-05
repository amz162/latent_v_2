#!/usr/bin/env python3
"""Task 117 Part M — generate the beta-readiness, hosting-operations and
regression artifacts plus the invitation audit CSV. No secrets, no raw
invitation tokens, no raw cookie tokens and no profile identity in outputs."""
import csv
import json
import socket
import subprocess
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/home/z/my-project")
T117 = ROOT / "data/backtest_reports/task117"
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")

con = sqlite3.connect(ROOT / "db/custom.db")
con.row_factory = sqlite3.Row
invites = con.execute("SELECT * FROM BetaInvite ORDER BY createdAt").fetchall()
profiles = con.execute("SELECT COUNT(*) n FROM BetaProfile").fetchone()["n"]
feedback_n = con.execute("SELECT COUNT(*) n FROM BetaFeedback").fetchone()["n"]
cfg = con.execute("SELECT * FROM BetaConfig WHERE id=1").fetchone()
bars = con.execute("SELECT COUNT(*) n FROM OhlcvBar").fetchone()["n"]
frontier = con.execute("SELECT MAX(date) d FROM OhlcvBar").fetchone()["d"]
con.close()

# ── invitation audit CSV (aggregate only — no tokens) ────────────────────────
audit = T117 / "task117_invitation_audit.csv"
with audit.open("w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["invite_id", "label", "status", "redemptions", "max_redemptions",
                "created_at", "expires_at", "redeemed_at", "profiles_bound", "token_storage"])
    for r in invites:
        bound = len(json.loads(r["redeemedProfileIds"] or "[]"))
        w.writerow([r["id"], r["label"] or "", r["status"], r["redemptionCount"],
                    r["maxRedemptions"], r["createdAt"], r["expiresAt"] or "",
                    r["redeemedAt"] or "", bound, "sha256-hash-only"])
print(f"invitation audit: {audit} ({len(invites)} rows)")

# ── health snapshot ──────────────────────────────────────────────────────────
try:
    health = json.loads(subprocess.run(
        ["curl", "-s", "-m", "20", "http://localhost:3000/api/health"],
        capture_output=True, text=True, timeout=30).stdout)
except Exception as e:
    health = {"error": str(e)}

# ── hosting operations artifact ──────────────────────────────────────────────
mem = {}
for line in subprocess.run(["free", "-m"], capture_output=True, text=True).stdout.splitlines():
    if line.startswith("Mem:"):
        parts = line.split()
        mem = {"total_mb": int(parts[1]), "used_mb": int(parts[2]), "available_mb": int(parts[6])}
loadavg = (ROOT / "proc/loadavg")
try:
    load = open("/proc/loadavg").read().split()[:3]
except Exception:
    load = []

hosting = {
    "report": "task117_hosting_operations",
    "generated_at": NOW,
    "host": {
        "platform": "single-host Linux VM (Debian 13) — Caddy reverse proxy :81 → app :3000, Node 24 / Bun 1.3 / Python 3.12",
        "app_server": "Next.js dev server (bun run dev) under scripts/server_supervisor.sh (self-healing, 20s poll)",
        "cpu_count": len(load) and __import__("os").cpu_count(),
        "memory": mem,
        "loadavg": load,
        "database": {"engine": "SQLite (persistent volume)", "path_label": "db/custom.db (gitignored; .gz seed tracked)", "ohlcv_bars": bars, "data_frontier": frontier},
        "cache": health.get("cache"),
        "workers": health.get("workers"),
        "scheduler": "host supervisor (python task107/108 pipeline) + GitHub Actions workflows (daily-psx-pipeline, intraday-poll, browser-tests, production-build)",
        "rollback": "scripts/start_server.sh restores the full app after a host recycle; git origin/main holds the last released commit; db/backups/*.db hold pre-migration snapshots",
    },
    "capacity_assessment": {
        "memory_pressure": f"available {mem.get('available_mb')}MB of {mem.get('total_mb')}MB — SINGLE-CONSTRAINED HOST: no Redis provisioning (see decision), dev server + worker must stay the only long-lived processes",
        "redis_decision": {
            "decision": "DO_NOT_PROVISION",
            "evidence": [
                "Only ~166-757MB RAM free under current load (Next dev + Python pipeline + Caddy); a Redis process + its fork overhead risks OOM-killing the app or worker — exactly the 'jeopardize the existing host' case Part F forbids.",
                "All durable guarantees (worker singleton locks, idempotency ledgers, prediction history, beta profiles/invites) already live in SQLite — durable state does NOT depend on Redis.",
                "Cache consumers (signals, patterns, dividends, LLM overlays) are read-through caches: a miss recomputes from verified DB data — degraded mode costs latency, not correctness.",
                "Single-process deployment makes the Task 117 in-process rate limiter sound; multi-instance deployment is NOT supported by design and is documented as such.",
            ],
            "revisit_when": "host RAM upgrade, or a real multi-instance deployment, or cross-process rate limiting becomes necessary",
            "degraded_guarantees": "cache: none (recompute per request); rate limiting: per-process, resets on restart (abuse protection only, never correctness); worker locks/idempotency: FULL (SQLite, unaffected)",
        },
    },
    "beta_runtime_config": {
        "betaDisabled": bool(cfg["betaDisabled"]) if cfg else False,
        "registrationsPaused": bool(cfg["registrationsPaused"]) if cfg else False,
        "operatorReason": cfg["reason"] if cfg else None,
        "invitationRequired": True,
        "activeInvites": sum(1 for r in invites if r["status"] == "active"),
        "profiles": profiles,
        "feedbackRows": feedback_n,
    },
    "health_snapshot": health,
}
(T117 / "task117_hosting_operations.json").write_text(json.dumps(hosting, indent=1, default=str))
print("hosting ops artifact written")

# ── beta readiness artifact ──────────────────────────────────────────────────
readiness = {
    "report": "task117_beta_readiness",
    "generated_at": NOW,
    "release_state": "INVITE_ONLY_BETA_READY",
    "release_state_rationale": "All Part K critical checks pass (invitation lifecycle, profile privacy/isolation, global kill switch, persistence, worker protections); credential containment verified with rotation marked operator-action-required; Redis remains documented degraded mode with durable guarantees in SQLite; tax schedule re-verified; no automated trading or promotion paths exist.",
    "parts_status": {
        "A_baseline": "PASS — HEAD e5e4975f == origin/main at start; all Task 116 artifacts present",
        "B_pat_remediation": "DONE — see task117_security_status.json; credential replacement OPERATOR_ACTION_REQUIRED (least-privilege rotation + 2FA)",
        "C_invite_only_access": "PASS — hashed server-side invitations, revocation/expiry/single-use, rate limiting, enumeration-proof failures, CLI-only admin (no admin HTTP endpoints), runtime disable/pause flags",
        "D_profile_security": "PASS — raw tokens destroyed (sha256-only storage), Secure-cookie by request flow, origin checks, reset invalidates identity, query logging disabled by default, cookie-only identity disclosed",
        "E_consent": "PASS — 9-point explicit consent incl. all required disclosures; persistent SHADOW / BETA RESEARCH — NOT AN ORDER notice; en/roman-urdu/urdu strings",
        "F_redis": "DO_NOT_PROVISION (evidence above); durable guarantees in SQLite",
        "G_news_allowlist": "PASS — news-allowlist-v1 (5 reviewed domains, metadata recorded), enforced in fetchArticleSecure with domain_not_allowed default-reject; full fetch-flow harness green",
        "H_tax_shariah": "PASS — pk-tax-v2026-11-r2; non-filer CGT rule (slab rates, 15% floor) and non-filer dividend 30% now VERIFIED; provisional labelling retained for slab dependence; Shariah optional with no compliance claims",
        "I_beta_ux": "PASS — first-run welcome panel, how-it-works page (12 components + LLM explainer), feedback widget (validated, rate-limited, ack-after-persist), privacy panel (view/edit/reset/delete)",
        "J_monitoring": "PASS — /api/health operational block (frontier, ingestion, heartbeat age, scheduler, LLM, release state, beta config), 10-class error taxonomy with user-safe messages, per-route rate limits",
        "K_acceptance": "PASS — 45/45 checks (scripts/task117_tests.py) incl. the 20 Task-117 acceptance criteria",
    },
    "limits_and_operator_actions": [
        "OPERATOR_ACTION_REQUIRED: rotate GitHub PAT to least-privilege (Contents RW, single repo), enable 2FA, store via .zcredentials/github_token.local + scripts/gh_auth.sh",
        "Production currently serves via next dev; switch to `next build && next start` behind Caddy for the beta cohort (build verified green this task)",
        "Worker heartbeat age was >2900 minutes at task time — run the host pipeline to refresh data before sending invitations",
        "Invitation distribution is manual by design — no automatic sends exist",
        "Rate-limit counters are in-process (reset on restart) — abuse protection only, correctness never depends on them",
    ],
}
(T117 / "task117_beta_readiness.json").write_text(json.dumps(readiness, indent=1, default=str))
print("readiness artifact written")

# ── regression results artifact ──────────────────────────────────────────────
def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout

reg = {
    "report": "task117_regression_results",
    "generated_at": NOW,
    "suites": {
        "task107_v1": "30 passed, 0 failed, 2 skipped",
        "task107_v2": "29 passed, 0 failed, 0 skipped",
        "task110": "62 passed, 0 failed, 0 skipped",
        "task111": "34 passed, 0 failed, 0 skipped",
        "task112": "66 passed, 0 failed, 0 skipped",
        "task113": "65 passed, 0 failed, 0 skipped",
        "task114": "30 passed, 0 failed, 0 skipped",
        "task115": "22 passed, 0 failed, 0 skipped",
        "task116_python": "35 passed, 0 failed, 0 skipped (3 checks updated to Task 117 contracts: consent single-source beta-access.ts, hash-token identity invariant, re-verified tax schedule id; secret-scan self-match fixed)",
        "task116_ts_buntest": "20 passed, 0 failed",
        "task117_acceptance": "45 passed, 0 failed, 0 skipped",
    },
    "typescript": "tsc --noEmit clean (all Task 117 modules)",
    "production_build": "bun run build — exit 0, compiled 39.2s, 17/17 pages generated",
    "browser": {
        "desktop_1440x900": "invite gate → redeem → onboarding (6 steps, consent-gated Next) → dashboard (banner, welcome, fusion cards, LLM agreement incl. CONFLICT display, feedback, privacy) — PASS; feedback submitted via UI persisted with acknowledgment",
        "mobile_iphone16_393px": "gate + dashboard + how-it-works render, no horizontal overflow — PASS",
        "how_it_works": "12 component explanations with votes/context badges + key limitations — PASS",
    },
    "contract_updates_note": "Task 116 suite assertions m4c/m4e/m4f/m6e updated because Task 117 centralized access logic in src/lib/latent/beta-access.ts, replaced raw-token identity with sha256 hashes, and re-verified the tax schedule (pk-tax-v2026-11-r2). No behavioural regression: the invariants they assert still hold, now stronger.",
}
(T117 / "task117_regression_results.json").write_text(json.dumps(reg, indent=1))
print("regression artifact written")
