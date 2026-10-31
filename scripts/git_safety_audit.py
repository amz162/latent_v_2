#!/usr/bin/env python3
"""Task 97 — Git safety audit: reject destructive git commands in project automation.

Scans .zscripts/, .github/workflows/ and scripts/ for destructive patterns.
Comment-only mentions and this file's own documentation are ignored.
Exit code 1 on violation so CI can fail the build.
"""
import argparse
import json
import re
import sys
from pathlib import Path

BASE = Path("/home/z/my-project")

DESTRUCTIVE = [
    (r"git\s+reset\s+--hard", "hard reset discards committed and uncommitted work"),
    (r"git\s+clean\s+.*-[a-zA-Z]*[fd]", "git clean -f/-d deletes untracked files"),
    (r"git\s+checkout\s+(--\s|-\-|\.)", "git checkout -- discards working-tree changes"),
    (r"git\s+restore\s+(--worktree|--source|-W|\.|-S)", "git restore can discard working-tree changes"),
    (r"git\s+rebase", "automatic rebase rewrites local history"),
    (r"git\s+push\s+(.*--force|--force.*)", "force-push overwrites remote history"),
    (r"git\s+branch\s+-D", "hard branch delete"),
]

SCAN_DIRS = [".zscripts", ".github/workflows", "scripts"]

# Documented incident references — text quoting the banned commands in
# reports/docs, never executed. (file, pattern) pairs.
ALLOWLIST = [
    ("scripts/task96_jobs/phase12.py", r"git\s+reset\s+--hard"),
    ("scripts/GIT_RECOVERY.md", r"reset --hard"),
    ("worklog.md", r"reset --hard"),
]
SELF = Path(__file__).name


def is_comment(line: str) -> bool:
    s = line.strip()
    return s.startswith(("#", "//", "*")) or s.startswith("<!--") or s.endswith("-->")


def scan():
    violations, checked = [], 0
    for d in SCAN_DIRS:
        root = BASE / d
        if not root.exists():
            continue
        for f in root.rglob("*"):
            if not f.is_file() or f.suffix not in {".sh", ".py", ".ts", ".yml", ".yaml", ".js", ".mjs"}:
                continue
            if f.name == SELF:
                continue
            text = f.read_text(errors="replace")
            for i, line in enumerate(text.splitlines(), 1):
                if is_comment(line):
                    continue
                for pat, why in DESTRUCTIVE:
                    if re.search(pat, line):
                        violations.append({
                            "file": str(f.relative_to(BASE)), "line": i,
                            "pattern": pat, "reason": why, "text": line.strip()[:160],
                        })
                checked += 1
    return checked, violations


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fail-on-violation", action="store_true")
    args = ap.parse_args()
    out = BASE / "data/backtest_reports/task97/task97_git_safety_audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    checked, violations = scan()
    doc = {
        "task": "Task 97 Section 8 — permanent git-safety enforcement",
        "policy": "project automation must never run git reset --hard / clean -fd / checkout -- / "
                  "rebase / push --force; dirty working trees are preserved; sync is fast-forward-only",
        "incident": "Task 96: dev-watch startup reset --hard wiped unpushed autosave commits "
                    "(recovered via reflog; see scripts/GIT_RECOVERY.md)",
        "scanned_lines": checked,
        "scan_dirs": SCAN_DIRS,
        "violations": violations,
        "verdict": "CLEAN" if not violations else f"{len(violations)} VIOLATIONS",
        "fixed_in_task97": [
            ".zscripts/restore-from-github.sh rewritten: dirty-tree protection + fast-forward-only merge",
            ".zscripts/dev-watch.sh header updated to document safe sync",
            "scripts/GIT_RECOVERY.md preserves reflog recovery instructions",
            "this audit wired into .github/workflows/production-build.yml",
        ],
    }
    out.write_text(json.dumps(doc, indent=1))
    print(f"git-safety audit: {checked} lines scanned, {len(violations)} violations")
    for v in violations:
        print(f"  {v['file']}:{v['line']} — {v['pattern']} ({v['reason']})")
    if args.fail_on_violation and violations:
        sys.exit(1)


if __name__ == "__main__":
    main()
