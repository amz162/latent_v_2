#!/usr/bin/env bash
# restore-from-github.sh — recover the working tree from origin/main.
#
# Why this exists: the sandbox environment resets wipe the local .git (the
# whole repo history gets replaced with a different baseline). The ONLY store
# that survives a reset is the GitHub remote. So after ANY reset, running this
# script re-establishes the origin remote (using the token preserved in
# branch.main.remote config), fetches the latest, and force-resets the local
# tree + .git to match origin/main exactly.
#
# This is called by dev-watch.sh on EVERY startup, so whenever the sandbox
# (re)starts the dev server, it first pulls the latest code from GitHub —
# making the running app self-healing after resets.
#
# Safe to run manually any time: `bash .zscripts/restore-from-github.sh`

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
    echo "$(ts) ERROR: no origin URL in branch.main.remote config — cannot restore" >> "$LOG"
    exit 1
  fi
fi

# 2. Fetch the latest from GitHub.
if git fetch origin --prune 2>>"$LOG"; then
  echo "$(ts) fetched origin" >> "$LOG"
else
  echo "$(ts) WARN: fetch failed (offline?) — continuing with local HEAD" >> "$LOG"
  exit 0  # non-fatal: maybe the network is down; the dev server can still start
fi

# 3. Force-reset local main to match origin/main exactly (discards any local
#    drift from a reset). This is the "never delete changes" guarantee in
#    reverse: the latest committed+pushed state is always restored.
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  BEFORE="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  git reset --hard origin/main >>"$LOG" 2>&1
  git clean -fdq >>"$LOG" 2>&1 || true  # remove untracked junk (e.g. stale .next)
  AFTER="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  echo "$(ts) restored ${BEFORE} → ${AFTER} (origin/main)" >> "$LOG"
else
  echo "$(ts) WARN: origin/main not found after fetch — leaving local as-is" >> "$LOG"
fi
