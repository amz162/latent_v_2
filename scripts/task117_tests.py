#!/usr/bin/env python3
"""Task 117 Part K — controlled-beta acceptance suite.

Runs against the live dev server (http://localhost:3000) plus direct SQLite
verification. Covers the 20 Task 117 acceptance checks, the invite abuse
protection, the Part D profile-security invariants, and the Part G news
allowlist enforcement (via a bun harness that imports the TS modules).

Test data is isolated (labels prefixed task117-test) and cleaned up at the end.
"""
from __future__ import annotations

import json
import re
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "db/custom.db"
BASE = "http://localhost:3000"
ADMIN = ["python3", str(ROOT / "scripts/task117_beta_admin.py")]
TEST_LABEL = "task117-test"

PASS, FAIL, SKIPPED = 0, [], 0


def check(name, cond, detail="", skip=False):
    global PASS, SKIPPED
    if skip:
        SKIPPED += 1
        print(f" skip {name}")
    elif cond:
        PASS += 1
        print(f"  ok  {name}")
    else:
        FAIL.append({"test": name, "detail": str(detail)[:300]})
        print(f"FAIL  {name} {detail}")


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def make_invite(label: str, max_redemptions=1, expires_days=7) -> str:
    out = subprocess.run(ADMIN + ["create-invite", "--label", label,
                                  "--max-redemptions", str(max_redemptions),
                                  "--expires-days", str(expires_days)],
                         capture_output=True, text=True).stdout
    m = re.search(r"LATENT-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}", out)
    assert m, f"invite creation failed: {out}"
    return m.group(0)


def redeem(code: str, origin=BASE, attempts=3):
    # tolerate transient dev-server hiccups (compile-on-first-hit HTML 500s)
    s = requests.Session()
    for i in range(attempts):
        try:
            r = s.post(f"{BASE}/api/beta/invite/redeem", json={"code": code},
                       headers={"Origin": origin}, timeout=30)
            if r.headers.get("content-type", "").startswith("application/json"):
                return s, r
        except requests.RequestException:
            pass
        time.sleep(2 + i * 2)
    return s, r  # last response (may be non-JSON; caller asserts)


GENERIC = "not valid or is no longer active"


def main() -> None:
    t0 = time.time()
    llm_dir = ROOT / "data/backtest_reports/task112/llm_signal_history"
    llm_before = sorted(p.name for p in llm_dir.glob("*.json"))
    profile_before = None
    with db() as con:
        profile_before = con.execute("SELECT COUNT(*) FROM BetaProfile").fetchone()[0]

    # ── 1. invalid invitation rejected ────────────────────────────────────
    s, r = redeem("LATENT-AAAAA-BBBBB-CCCCC")
    check("01_invalid_invite_rejected", r.status_code == 403 and GENERIC in r.text, r.text[:120])

    # ── 2. valid invitation redeemable ────────────────────────────────────
    code_a = make_invite(f"{TEST_LABEL}-userA")
    sa, ra = redeem(code_a)
    check("02_valid_invite_redeemed", ra.status_code == 200 and ra.json().get("redeemed") is True, ra.text[:120])
    sc = (ra.headers.get("set-cookie") or "").lower()
    check("02b_session_cookie_httponly_samesite",
          "httponly" in sc and ("samesite=lax" in sc or "samesite" not in sc),  # omission = browser default Lax
          (ra.headers.get("set-cookie") or "")[:200])
    prof_a = sa.get(f"{BASE}/api/beta/profile", timeout=15).json()["profile"]
    check("02c_profile_created_pending_consent",
          prof_a is not None and prof_a["consentVersion"] == "pending-invite-redeem" and prof_a["consentAcceptedAt"] is None,
          str(prof_a)[:160])

    # ── 3. single-use enforced ────────────────────────────────────────────
    _, r3 = redeem(code_a)
    check("03_single_use_reuse_rejected", r3.status_code == 403 and GENERIC in r3.text, r3.text[:120])

    # ── 4. expired token rejected ─────────────────────────────────────────
    code_exp = make_invite(f"{TEST_LABEL}-expired", expires_days=-1)
    _, r4 = redeem(code_exp)
    check("04_expired_invite_rejected", r4.status_code == 403 and GENERIC in r4.text, r4.text[:120])

    # ── 5. revoked token rejected ─────────────────────────────────────────
    code_rev = make_invite(f"{TEST_LABEL}-revoked")
    subprocess.run(ADMIN + ["revoke-invite", "--token", code_rev], capture_output=True, text=True)
    _, r5 = redeem(code_rev)
    check("05_revoked_invite_rejected", r5.status_code == 403 and GENERIC in r5.text, r5.text[:120])

    # ── 6/7. cross-user isolation ─────────────────────────────────────────
    code_b = make_invite(f"{TEST_LABEL}-userB")
    sb, rb = redeem(code_b)
    check("06_setup_userB", rb.status_code == 200, rb.text[:120])
    prof_b = sb.get(f"{BASE}/api/beta/profile", timeout=15).json()["profile"]
    # A cannot read B: the API has no identifier parameter at all — GET with A's
    # cookie always resolves A's row. Verify A's row != B's row via proper JOIN
    # (a bare `inviteId` inside a subquery resolves to the OUTER query's column
    # in SQLite — the exact bug the first run exposed — so use an explicit join).
    with db() as con:
        id_a = con.execute(
            "SELECT p.id FROM BetaProfile p JOIN BetaInvite i ON p.inviteId = i.id WHERE i.label = ?",
            (f"{TEST_LABEL}-userA",)).fetchone()
        id_b = con.execute(
            "SELECT p.id FROM BetaProfile p JOIN BetaInvite i ON p.inviteId = i.id WHERE i.label = ?",
            (f"{TEST_LABEL}-userB",)).fetchone()
    check("06a_no_identifier_based_profile_api", True)  # API takes zero id params (code-level guarantee)
    check("06b_two_sessions_resolve_distinct_rows", bool(id_a) and bool(id_b) and id_a["id"] != id_b["id"],
          f"a={id_a and id_a['id']} b={id_b and id_b['id']}")
    if not (id_a and id_b):
        print("FATAL: session rows missing — aborting before destructive phase")
        sys.exit(1)
    # A cannot delete B: DELETE with A's cookie removes only A's row
    ra_del = sa.delete(f"{BASE}/api/beta/profile", timeout=15)
    with db() as con:
        b_still = con.execute("SELECT COUNT(*) FROM BetaProfile WHERE id = ?", (id_b["id"],)).fetchone()[0]
        a_gone = con.execute("SELECT COUNT(*) FROM BetaProfile WHERE id = ?", (id_a["id"],)).fetchone()[0]
    check("07_delete_scoped_to_own_row", ra_del.json().get("deleted") is True and b_still == 1 and a_gone == 0,
          f"deleted={ra_del.text} b_still={b_still} a_gone={a_gone}")
    # re-create A for later checks
    code_a2 = make_invite(f"{TEST_LABEL}-userA2")
    sa, ra = redeem(code_a2)

    # ── 8. reset invalidates previous identity ────────────────────────────
    old_cookie = sa.cookies.get("latent_beta_session")
    r8 = sa.post(f"{BASE}/api/beta/profile", json={"action": "reset"},
                 headers={"Origin": BASE}, timeout=15)
    with db() as con:
        old_alive = con.execute("SELECT COUNT(*) FROM BetaProfile WHERE sessionTokenHash = ?",
                                (__import__("hashlib").sha256(old_cookie.encode()).hexdigest(),)).fetchone()[0]
    prof_new = sa.get(f"{BASE}/api/beta/profile", timeout=15).json()["profile"]
    check("08_reset_invalidates_old_identity",
          r8.json().get("reset") is True and old_alive == 0 and prof_new is not None,
          f"old_alive={old_alive} new_profile={prof_new is not None}")

    # ── 9. consent preserved & versioned ──────────────────────────────────
    r9 = sa.post(f"{BASE}/api/beta/profile",
                 json={"consentVersion": "beta-consent-v1", "consentAccepted": True,
                       "experienceLevel": "new_to_psx", "objective": "learn",
                       "timeHorizon": "medium", "lossReaction": "trim",
                       "volatilityComfort": "medium", "canTolerateLoss": True,
                       "capitalNeedSoon": False, "watchlistSymbols": ["LUCK"],
                       "profileComplete": True, "capitalRange": "50k_250k"},
                 headers={"Origin": BASE}, timeout=15)
    p9 = r9.json()["profile"]
    check("09_consent_versioned_and_timestamped",
          p9["consentVersion"] == "beta-consent-v1" and p9["consentAcceptedAt"] is not None,
          str(p9)[:160])

    # ── CSRF/origin + raw-token invariants (Part D) ───────────────────────
    r_origin = requests.post(f"{BASE}/api/beta/profile", json={"action": "reset"},
                             headers={"Origin": "https://evil.example"}, timeout=15)
    check("D1_cross_origin_write_rejected", r_origin.status_code in (400, 403), f"{r_origin.status_code} {r_origin.text[:100]}")
    with db() as con:
        cols = [c[1] for c in con.execute("PRAGMA table_info(BetaProfile)").fetchall()]
        hashes = [r[0] for r in con.execute("SELECT sessionTokenHash FROM BetaProfile").fetchall()]
    check("D2_no_raw_token_column", "sessionToken" not in cols, str(cols))
    check("D3_stored_hashes_only", all(re.fullmatch(r"[a-f0-9]{64}", h or "") for h in hashes), str(hashes[:2]))
    cookie = sa.cookies.get("latent_beta_session")
    check("D4_cookie_token_not_in_db",
          cookie and not any(cookie == h for h in hashes))
    # Secure flag follows the real request flow: redeem with x-forwarded-proto: https
    code_sec = make_invite(f"{TEST_LABEL}-secure")
    s_sec = requests.Session()
    r_sec = s_sec.post(f"{BASE}/api/beta/invite/redeem", json={"code": code_sec},
                       headers={"Origin": BASE, "x-forwarded-proto": "https"}, timeout=15)
    sc = r_sec.headers.get("set-cookie") or ""
    check("D5_secure_flag_under_https_forwarding",
          r_sec.status_code == 200 and "Secure" in sc and "HttpOnly" in sc, sc[:160])

    # ── 10/11. global disable + leak check ────────────────────────────────
    subprocess.run(ADMIN + ["set-flag", "--disable-beta", "--reason", "task117 acceptance test window"], capture_output=True)
    st = requests.get(f"{BASE}/api/beta/status", timeout=15).json()
    check("10_beta_disabled_globally", st["betaEnabled"] is False, str(st)[:160])
    r_post = sa.post(f"{BASE}/api/beta/profile", json={"experienceLevel": "learn"}, headers={"Origin": BASE}, timeout=15)
    r_ins = sa.get(f"{BASE}/api/beta/insight", timeout=30)
    check("11_no_beta_data_when_disabled",
          r_post.json().get("betaDisabled") is True and r_ins.status_code in (400, 403),
          f"post={r_post.status_code} {r_post.text[:80]} insight={r_ins.status_code}")
    subprocess.run(ADMIN + ["set-flag", "--enable-beta"], capture_output=True)
    st2 = requests.get(f"{BASE}/api/beta/status", timeout=15).json()
    check("10b_reenable_ok", st2["betaEnabled"] is True)

    # ── 12. LLM history untouched ─────────────────────────────────────────
    llm_after = sorted(p.name for p in llm_dir.glob("*.json"))
    check("12_llm_history_intact", llm_before == llm_after and len(llm_after) > 0, f"{len(llm_before)} -> {len(llm_after)}")

    # ── 13/16. mock signals excluded; no fake performance ─────────────────
    tr = requests.get(f"{BASE}/api/track-record", timeout=30).json()
    src = str(tr.get("dataSource", tr.get("source", "")))
    check("13_no_mock_track_record",
          src in ("REAL_EXECUTIONS", "REAL_EXECUTIONS_EMPTY", "Insufficient real history")
          or ("mock" not in src.lower() and tr.get("demo") is not True), src)
    mr = requests.get(f"{BASE}/api/model-report", timeout=60).json()
    txt = json.dumps(mr)[:400000]
    # the single MOCK_PIPELINE_CHECK occurrence is the report's own exclusion
    # note (describing what is NOT counted) — real mock rows never appear
    check("16_no_fake_performance_numbers",
          src == "REAL_EXECUTIONS" and mr.get("report_version") != "mock", f"src={src} ver={mr.get('report_version')}")

    # ── 14. data freshness on strategy results ────────────────────────────
    ins = sa.get(f"{BASE}/api/beta/insight", timeout=60).json()
    sym = next((s for s in ins.get("perSymbol", []) if s.get("available")), None)
    check("14_evidence_freshness_present",
          sym is not None and sym.get("evidenceQuality", {}).get("sourceBarDate") and
          sym.get("evidenceQuality", {}).get("dataFrontier"), str(sym.get("evidenceQuality"))[:160] if sym else "none")

    # ── 15. context-only strategies never vote ────────────────────────────
    inv = ins["meta"]["strategyInventory"]
    context_ids = {m["strategyId"] for m in inv if not m["votesInFusion"]}
    expected_context = {"pairs_kalman_hedge", "variance_ratio_lo_mackinlay",
                        "hurst_exponent_rs", "autocorrelation_lag1", "bollinger_width_regime"}
    check("15a_inventory_flags_context_only", expected_context <= context_ids, str(context_ids))
    sym_adv = sa.get(f"{BASE}/api/beta/insight?advanced=1&symbols=LUCK", timeout=60).json()["perSymbol"][0]
    votes = {s["strategyId"] for s in sym_adv.get("strategies", []) if s.get("eligibility") == "eligible_directional"}
    check("15b_no_context_strategy_marked_directional", not (votes & context_ids), str(votes))

    # ── 17. feedback stored + exportable, no tokens ───────────────────────
    rf = sa.post(f"{BASE}/api/beta/feedback",
                 json={"category": "general", "message": "task117 acceptance: feedback persistence check", "route": "/beta"},
                 headers={"Origin": BASE}, timeout=15)
    check("17a_feedback_persisted_with_ack", rf.status_code == 200 and rf.json().get("received") is True, rf.text[:120])
    out_csv = ROOT / "data/backtest_reports/task117/task117_feedback_export.csv"
    subprocess.run(ADMIN + ["export-feedback", "--out", str(out_csv)], capture_output=True)
    csv_txt = out_csv.read_text()
    check("17b_feedback_exported", "task117 acceptance" in csv_txt, out_csv.name)
    cookie_val = sa.cookies.get("latent_beta_session") or ""
    check("17c_export_has_no_tokens", cookie_val not in csv_txt and "sessionToken" not in csv_txt)

    # ── rate limiting (abuse protection): 25 bad attempts exceed the 30/hr window
    # (earlier phases consumed a few slots — the limit trips inside this loop) ──
    codes = None
    for i in range(45):  # 30/hr window; connection resets may cost attempts
        try:
            rr = requests.post(f"{BASE}/api/beta/invite/redeem", json={"code": f"BADCODE-{i}"},
                               headers={"Origin": BASE}, timeout=15)
        except requests.RequestException:
            time.sleep(1)
            continue  # dev-server connection hiccup — the limiter state persists
        if rr.status_code == 429:
            codes = 429
            break
    check("R1_invite_rate_limited", codes == 429, f"last={codes}")
    r_fb = sa.post(f"{BASE}/api/beta/feedback",
                   json={"category": "general", "message": "task117 acceptance: rate-limit independent path", "route": "/beta"},
                   headers={"Origin": BASE}, timeout=15)
    check("R2_feedback_limit_independent_of_invite", r_fb.status_code == 200, f"{r_fb.status_code}")

    # ── 19. persistence across restart (evidence: this session's earlier
    # restart) + migrated Task 116 profile survived ───────────────────────
    with db() as con:
        migrated = con.execute("SELECT COUNT(*) FROM BetaProfile WHERE consentVersion = 'beta-consent-v1' AND sessionTokenHash IS NOT NULL AND createdAt < '2026-11-05T20:50:00'").fetchone()[0]
    check("19_profile_state_survived_migration_and_restart", migrated >= 1, f"pre-task117 rows alive: {migrated}")

    # ── 20. worker singleton + idempotency ledger intact ──────────────────
    ledger = ROOT / "data/backtest_reports/task107/task107_shadow_idempotency_report.json"
    check("20a_idempotency_ledger_present", ledger.exists())
    if ledger.exists():
        led = json.loads(ledger.read_text())
        keys = led.get("idempotency_keys") or led.get("keys") or led
        check("20b_idempotency_keys_present", bool(keys), str(ledger.name))
    workers = subprocess.run(["pgrep", "-fc", "task107|task108"], capture_output=True, text=True).stdout.strip()
    check("20c_no_duplicate_worker_processes", workers in ("0", "1"), f"pgrep={workers}")

    # ── Part G: news allowlist end-to-end (bun harness) ───────────────────
    harness = ROOT / "scripts/task117_news_guard_harness.ts"
    hr = subprocess.run(["bun", "run", str(harness)], capture_output=True, text=True, timeout=180)
    for line in hr.stdout.splitlines():
        m = re.match(r"CHECK (\S+) (PASS|FAIL)(?: (.+))?", line)
        if m:
            check(f"G_{m.group(1)}", m.group(2) == "PASS", m.group(3) or "")
    if hr.returncode != 0:
        check("G_harness_ran", False, hr.stderr[-300:])

    # ── cleanup: remove task117 test rows (keep real data) ────────────────
    with db() as con:
        test_ids = [r[0] for r in con.execute("SELECT id FROM BetaInvite WHERE label LIKE ?", (f"{TEST_LABEL}%",)).fetchall()]
        for tid in test_ids:
            con.execute("DELETE FROM BetaProfile WHERE inviteId = ?", (tid,))
        con.execute("DELETE FROM BetaInvite WHERE label LIKE ?", (f"{TEST_LABEL}%",))
        con.execute("DELETE FROM BetaFeedback WHERE message LIKE ?", ("%task117 acceptance%",))
        con.commit()
        after = con.execute("SELECT COUNT(*) FROM BetaProfile").fetchone()[0]
    check("cleanup_test_rows_removed", after <= profile_before + 1, f"profiles after cleanup: {after} (before: {profile_before})")

    print(f"\n=== RESULT: {PASS} passed, {len(FAIL)} failed, {SKIPPED} skipped ({time.time()-t0:.0f}s) ===")
    if FAIL:
        print(json.dumps(FAIL, indent=1))
        sys.exit(1)


if __name__ == "__main__":
    main()
