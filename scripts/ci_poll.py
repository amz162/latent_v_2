#!/usr/bin/env python3
"""Poll GitHub Actions runs for a commit until all complete.

Usage: python3 scripts/ci_poll.py <sha> [max_polls] [interval_sec]
Token is read from .zcredentials/github_token.local (gitignored, never printed).
Exit codes: 0 = all green, 2 = some check failed, 3 = timeout/incomplete.
"""
import json
import pathlib
import sys
import time
import urllib.request

REPO = "amz162/latent_v_2"
ROOT = pathlib.Path(__file__).resolve().parents[1]
TOKEN = (ROOT / ".zcredentials/github_token.local").read_text().strip()


def runs_for(sha):
    url = f"https://api.github.com/repos/{REPO}/actions/runs?head_sha={sha}&per_page=20"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "User-Agent": "latent",
        "Accept": "application/vnd.github+json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("workflow_runs", [])


def main():
    sha = sys.argv[1]
    max_polls = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    interval = int(sys.argv[3]) if len(sys.argv) > 3 else 55
    for i in range(1, max_polls + 1):
        try:
            runs = runs_for(sha)
        except Exception as e:  # transient network/API hiccup — keep polling
            print(f"(poll {i}/{max_polls}) API error: {e}; retrying...")
            time.sleep(interval)
            continue
        if not runs:
            print(f"(poll {i}/{max_polls}) no runs registered yet for {sha[:7]}; sleeping {interval}s")
        else:
            pending = 0
            print(f"(poll {i}/{max_polls}) runs for {sha[:7]}:")
            for r in runs:
                st, cc = r["status"], r.get("conclusion")
                print(f'  - {r["name"]}: {st}' + (f" -> {cc}" if cc else ""))
                if st != "completed":
                    pending += 1
            if pending == 0:
                bad = [r["name"] for r in runs if r.get("conclusion") not in ("success", "skipped", "neutral")]
                if bad:
                    print(f"FAILED CHECKS: {bad}")
                    return 2
                print("ALL CHECKS GREEN")
                return 0
        time.sleep(interval)
    print("TIMEOUT: checks still incomplete")
    return 3


if __name__ == "__main__":
    sys.exit(main())
