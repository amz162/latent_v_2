#!/usr/bin/env bash
# restore-from-github.sh — SAFE GitHub synchronization for automated use.
#
# WHY THIS EXISTS
# The sandbox environment can reset and wipe local .git; the only store that
# survives is the GitHub remote. After such a reset this script re-establishes
# the origin remote (token preserved in branch.main.remote config), fetches
# the latest, and brings the local tree up to date — WITHOUT ever discarding
# local work.
#
# SAFETY CONTRACT (Task 97, mandatory)
#   1. Never run `git reset --hard` or `git clean` here. Task 96 lost unpushed
#      work when this script force-reset a tree that had local autosave
#      commits; that class of automation is permanently banned.
#   2. If the working tree is dirty (modified tracked files, staged changes,
#      or untracked files): STOP and preserve everything. Log it and exit 0.
#   3. If clean: synchronize with `git merge --ff-only origin/main` only.
#      A diverged history is never rebased or rewritten — log and skip.
#   4. Never force-push, never rewrite local history.
#
# scripts/git_safety_audit.py fails CI if destructive git commands reappear
# in any project automation script.
#
# Safe to run manually any time: `bash .zscripts/restore-from-github.sh`
# Reflog recovery instructions: scripts/GIT_RECOVERY.md

set -uo pipefail
cd /home/z/my-project || exit 1

LOG=/home/z/my-project/.zscripts/restore.log
ts() { date -Iseconds; }

# 1. Re-establish the origin remote if it was wiped (the token survives in
#    branch.main.remote config even when the `origin` remote ref is gone).
if ! git remote get-url origin >/dev/null 2>&1; then
  URL="$(git config --local branch.main.remote 2>/dev/null || true)"
  if [ -n "$URL" ]; then
    git remote add origin "$URL" 2>/dev/null || git remote set-url origin "$URL"
    echo "$(ts) re-added origin remote" >> "$LOG"
  else
    echo "$(ts) ERROR: no origin URL in branch.main.remote config — cannot sync" >> "$LOG"
    exit 1
  fi
fi

# 2. Fetch the latest from GitHub (fetch is always safe — it never touches
#    the working tree).
if git fetch origin --prune 2>>"$LOG"; then
  echo "$(ts) fetched origin" >> "$LOG"
else
  echo "$(ts) WARN: fetch failed (offline?) — continuing with local HEAD" >> "$LOG"
  exit 0
fi

# 3. Protect uncommitted work: if the tree is dirty, DO NOT synchronize.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "$(ts) SKIP: working tree dirty — changes preserved, no sync performed" >> "$LOG"
  exit 0
fi

# 4. Fast-forward-only synchronization when safe; never discard or rewrite.
if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
  echo "$(ts) WARN: origin/main not found after fetch — leaving local as-is" >> "$LOG"
  exit 0
fi
BEFORE="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
LOCAL="$(git rev-parse main 2>/dev/null || git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "$(ts) up to date at ${BEFORE}" >> "$LOG"
  exit 0
fi
if git merge-base --is-ancestor "$LOCAL" "$REMOTE" 2>/dev/null; then
  if git merge --ff-only origin/main >>"$LOG" 2>&1; then
    AFTER="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
    echo "$(ts) fast-forwarded ${BEFORE} → ${AFTER} (origin/main)" >> "$LOG"
  else
    echo "$(ts) WARN: fast-forward merge failed — leaving local as-is" >> "$LOG"
  fi
else
  echo "$(ts) SKIP: local main has unpushed commits (diverged from origin/main) — nothing discarded" >> "$LOG"
fi
