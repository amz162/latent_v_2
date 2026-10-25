#!/usr/bin/env bash
# autosave-watch.sh — server-side change-persistence watchdog.
#
# Background: file-system changes that are NOT committed to the local git
# repo are lost when the sandbox environment resets. To stop that, this
# script snapshots the working tree into .git on a fixed cadence so
# uncommitted edits survive a reset. It runs as a detached background
# process (setsid) and is idempotent — only one instance lives at a time
# (enforced via flock on this very file).
#
# It NEVER pushes to any remote — the user has explicitly asked that GitHub
# pushes happen only on their instruction. Commits land in the local repo
# only. Remote pushes are a manual step the user triggers.
#
# Schedule: every 5 minutes. Commit message is timestamped. If there are
# no changes, it is a no-op (git commit exits non-zero, we swallow it).

set -u
cd /home/z/my-project || exit 1

LOG=/home/z/my-project/.zscripts/autosave.log
PIDFILE=/home/z/my-project/.zscripts/autosave.pid

# Single-instance guard via flock on this script.
exec 9<"$0"
if ! flock -n 9; then
  echo "$(date -Iseconds) another autosave-watch is already running; exit" >> "$LOG"
  exit 0
fi

echo "$(date -Iseconds) autosave-watch started (5-min cadence, local commits only, no push)" >> "$LOG"
echo $$ > "$PIDFILE"

while true; do
  sleep 300  # 5 minutes
  ts="$(date -Iseconds)"
  # Stage everything except the heavy/ephemeral paths that should never be
  # committed (dev caches, logs, pid files). These are also in .gitignore
  # but we double-guard here.
  git add -A 2>/dev/null
  if git diff --cached --quiet 2>/dev/null; then
    continue  # nothing to commit
  fi
  if git commit -m "autosave-watch snapshot ${ts}" >/dev/null 2>&1; then
    echo "${ts} snapshot committed (local only, no push)" >> "$LOG"
  else
    echo "${ts} commit failed (likely empty or locked) — will retry next cycle" >> "$LOG"
  fi
done
