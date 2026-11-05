#!/usr/bin/env python3
"""Task 118 Part G1 — invitation dry run against the PRODUCTION runtime.

Eight isolated cases with short-expiry test invitations; every row is cleaned
up afterwards. Output: task118_invitation_dry_run.csv (no tokens in output —
only outcomes). Generic-message indistinguishability is asserted per case."""
import csv
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
BASE = "http://localhost:3000"
ADMIN = ["python3", str(ROOT / "scripts/task117_beta_admin.py")]
LABEL = "task118-dryrun"
GENERIC = "not valid or is no longer active"

results = []


def check(case, cond, note):
    results.append({"case": case, "result": "PASS" if cond else "FAIL", "note": note})
    print(f"  {'ok ' if cond else 'FAIL'} {case} {note}")


def make(label, max_r=1, days=1):
    out = subprocess.run(ADMIN + ["create-invite", "--label", label,
                                  "--max-redemptions", str(max_r),
                                  "--expires-days", str(days)],
                         capture_output=True, text=True).stdout
    return re.search(r"LATENT-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}", out).group(0)


def redeem(code, **hdr):
    return requests.post(f"{BASE}/api/beta/invite/redeem", json={"code": code},
                         headers={"Origin": BASE, **hdr}, timeout=30)


def main():
    # 1 valid
    c1 = make(f"{LABEL}-valid")
    r1 = redeem(c1)
    check("1_valid_invitation", r1.status_code == 200 and r1.json().get("redeemed") is True, f"HTTP {r1.status_code}")
    # 2 reuse (single-use)
    r2 = redeem(c1)
    check("2_reuse_rejected", r2.status_code == 403 and GENERIC in r2.text, "uniform 403")
    # 3 expired
    c3 = make(f"{LABEL}-expired", days=-1)
    r3 = redeem(c3)
    check("3_expired_rejected", r3.status_code == 403 and GENERIC in r3.text, "uniform 403")
    # 4 revoked
    c4 = make(f"{LABEL}-revoked")
    subprocess.run(ADMIN + ["revoke-invite", "--token", c4], capture_output=True)
    r4 = redeem(c4)
    check("4_revoked_rejected", r4.status_code == 403 and GENERIC in r4.text, "uniform 403")
    # 5 redemption cap: max=2, both uses consumed, 3rd rejected
    c5 = make(f"{LABEL}-cap", max_r=2)
    ra = redeem(c5)
    rb = redeem(c5)
    r5 = redeem(c5)
    check("5_cap_reached_rejected",
          ra.status_code == 200 and rb.status_code == 200 and r5.status_code == 403 and GENERIC in r5.text,
          "2 redemptions ok, 3rd uniform 403")
    # 6 invalid random token
    r6 = redeem("LATENT-00000-00000-00000")
    check("6_invalid_random_rejected", r6.status_code == 403 and GENERIC in r6.text, "uniform 403")
    # 7 global pause (registrationsPaused) — even a FRESH valid code is refused
    c7 = make(f"{LABEL}-paused")
    subprocess.run(ADMIN + ["set-flag", "--pause-registrations", "--reason", "task118 dry run"], capture_output=True)
    r7 = redeem(c7)
    st7 = requests.get(f"{BASE}/api/beta/status", timeout=15).json()
    check("7_global_pause_blocks_redemption",
          r7.status_code == 403 and st7["registrationsPaused"] is True, f"HTTP {r7.status_code}")
    subprocess.run(ADMIN + ["set-flag", "--resume-registrations"], capture_output=True)
    # 8 beta flag disabled (runtime BetaConfig) — status false, profile writes blocked
    c8 = make(f"{LABEL}-disabled")
    subprocess.run(ADMIN + ["set-flag", "--disable-beta", "--reason", "task118 dry run"], capture_output=True)
    st8 = requests.get(f"{BASE}/api/beta/status", timeout=15).json()
    # redeem while disabled -> closed
    r8 = redeem(c8)
    check("8a_beta_disabled_status", st8["betaEnabled"] is False, "status betaEnabled=false")
    check("8b_redeem_while_disabled_refused", r8.status_code == 403 and "closed" in r8.text.lower(), f"HTTP {r8.status_code}")
    subprocess.run(ADMIN + ["set-flag", "--enable-beta"], capture_output=True)
    st9 = requests.get(f"{BASE}/api/beta/status", timeout=15).json()
    check("8c_reenabled", st9["betaEnabled"] is True and st9["registrationsPaused"] is False, "flags restored")

    # cleanup: delete dry-run invites + their profiles
    con = sqlite3.connect(ROOT / "db/custom.db")
    ids = [r[0] for r in con.execute("SELECT id FROM BetaInvite WHERE label LIKE ?", (f"{LABEL}%",)).fetchall()]
    for i in ids:
        con.execute("DELETE FROM BetaProfile WHERE inviteId = ?", (i,))
    con.execute("DELETE FROM BetaInvite WHERE label LIKE ?", (f"{LABEL}%",))
    con.commit()
    remaining = con.execute("SELECT COUNT(*) FROM BetaInvite WHERE label LIKE ?", (f"{LABEL}%",)).fetchone()[0]
    con.close()

    out = ROOT / "data/backtest_reports/task118/task118_invitation_dry_run.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["case", "result", "note"])
        w.writeheader()
        w.writerows(results)
    fails = [r for r in results if r["result"] == "FAIL"]
    print(f"\n=== DRY RUN: {len(results) - len(fails)} passed, {len(fails)} failed (cleanup: {remaining} test invites left) ===")
    sys.exit(1 if fails or remaining else 0)


if __name__ == "__main__":
    main()
