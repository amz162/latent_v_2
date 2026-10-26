#!/bin/bash
# dev-watch.sh — the dev-server supervisor with self-healing durability.
#
# On EVERY startup this script:
#   1. Restores the working tree from origin/main (restore-from-github.sh).
#      This makes the running app self-healing after sandbox resets — the
#      latest committed+pushed code is always what boots.
#   2. Starts a 60-second autosave-commit+push loop in the background. This
#      snapshots any uncommitted local edits to GitHub so they survive the
#      next reset (the local .git gets wiped on reset; only GitHub survives).
#   3. Runs `next dev` in the foreground, restarting it on crash (the
#      original watchdog behavior — keeps the preview available under the
#      4GB memory limit).
#
# The user's standing instruction: "add in server that never delete data or
# changes even after reset." The restore-on-startup + 60s autosave-push is
# that guarantee: changes are pushed to GitHub within a minute of being made,
# and the running code is always synced from GitHub on startup.

exec 2>&1
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:-}"
LOG=/home/z/my-project/dev.log
echo "[watchdog] supervisor started $(date)" > "$LOG"

# ── 1. Restore the latest code from GitHub (self-heal after reset) ──
bash /home/z/my-project/.zscripts/restore-from-github.sh >> "$LOG" 2>&1 || \
  echo "[watchdog] restore-from-github failed (non-fatal) — continuing with local HEAD" >> "$LOG"

# ── 2. 60-second autosave-commit+push loop (background) ──
autosave_loop() {
  exec 9<"$0"
  flock -n 9 || return  # only one autosave per dev-watch
  local ALOG=/home/z/my-project/.zscripts/autosave.log
  echo "$(date -Iseconds) autosave started (60s cadence, commit+push)" >> "$ALOG"
  while true; do
    sleep 60
    local ts; ts="$(date -Iseconds)"
    cd /home/z/my-project || exit 1
    git add -A 2>/dev/null
    if git diff --cached --quiet 2>/dev/null; then continue; fi
    if git commit -m "autosave ${ts}" >/dev/null 2>&1; then
      if git push origin main >/dev/null 2>&1; then
        echo "${ts} committed+pushed" >> "$ALOG"
      else
        echo "${ts} committed, push failed" >> "$ALOG"
      fi
    fi
  done
}
autosave_loop & disown
echo "[watchdog] autosave loop started (60s commit+push)" >> "$LOG"

# ── 3. Run `next dev`, restart on crash ──
while true; do
  node /home/z/my-project/node_modules/.bin/next dev -p 3000 >> "$LOG" 2>&1
  EC=$?
  echo "[watchdog] next dev exited (code=$EC) at $(date) — restarting in 2s" >> "$LOG"
  sleep 2
done
