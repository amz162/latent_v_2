#!/bin/bash
# dev-watch.sh — the dev-server supervisor with self-healing durability.
#
# USER RULE (standing): "never push code on my GitHub repo until I tell you to."
# This script respects that rule: it NEVER pushes to GitHub. It only:
#   1. Restores the working tree from origin/main on startup (read-only fetch
#      + reset --hard). This makes the running app self-healing after sandbox
#      resets — the latest pushed code is always what boots.
#   2. Restores the DB (db/custom.db) from the committed .gz backup on
#      startup if the DB file is empty/missing (env resets wipe it to a 60KB
#      schema-only file; the simulations need the full 197MB dataset).
#   3. Starts a 60-second LOCAL autosave-commit loop (commit only, NO push).
#      This snapshots uncommitted local edits into local .git so they survive
#      within a session. (Local commits are lost on env reset — only GitHub
#      survives a reset. Pushing requires the user's explicit instruction.)
#   4. Runs `next dev` in the foreground, restarting it on crash (keeps the
#      preview available under the 4GB memory limit).
#
# To make a dev-watch change itself survive env resets, the change must be
# pushed to GitHub (so `git reset --hard origin/main` restores it). This file
# was pushed per the user's explicit instruction "make solution of this".

exec 2>&1
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:-}"
LOG=/home/z/my-project/dev.log
echo "[watchdog] supervisor started $(date)" > "$LOG"

# ── 1. Restore the latest code from GitHub (read-only, NO push) ──
# Self-heal after a sandbox reset: fetch origin + reset --hard origin/main.
# This brings back the latest pushed code (including this dev-watch.sh
# itself, so any future edits to this file that are pushed survive resets).
bash /home/z/my-project/.zscripts/restore-from-github.sh >> "$LOG" 2>&1 || \
  echo "[watchdog] restore-from-github failed (non-fatal) — continuing with local HEAD" >> "$LOG"

# ── 2. Restore the DB from the committed .gz backup if it's empty ──
# Env resets wipe db/custom.db to a 60KB schema-only file (0 OHLCV rows).
# The investment + portfolio simulations read OhlcvBar and return 503
# "no OHLCV history in the DB" when the table is empty. This step gunzips
# the committed db/custom.db.gz (197MB, 1M+ bars) so simulations work
# right after a reset — without it, every /api/backtest/* fails.
restore_db_if_needed() {
  local db=/home/z/my-project/db/custom.db
  local gz=/home/z/my-project/db/custom.db.gz
  local need_restore=0
  if [ ! -f "$db" ]; then
    need_restore=1
  else
    local sz; sz=$(stat -c%s "$db" 2>/dev/null || echo 0)
    # < 5MB → schema-only, no rows. The full DB is ~197MB; the schema-only
    # file (after prisma migrate with no data) is ~60KB.
    if [ "$sz" -lt 5000000 ]; then need_restore=1; fi
  fi
  if [ "$need_restore" = "1" ]; then
    if [ -f "$gz" ]; then
      echo "[watchdog] db/custom.db empty/missing ($(stat -c%s "$db" 2>/dev/null || echo 0) bytes) — restoring from .gz backup" >> "$LOG"
      gunzip -kf "$gz" 2>>"$LOG"
      bun run db:push >/dev/null 2>&1 || true
      echo "[watchdog] db restored → $(stat -c%s "$db" 2>/dev/null) bytes" >> "$LOG"
    else
      echo "[watchdog] WARN: db/custom.db empty AND no .gz backup — simulations will fail" >> "$LOG"
    fi
  else
    echo "[watchdog] db/custom.db OK ($(stat -c%s "$db") bytes)" >> "$LOG"
  fi
}
restore_db_if_needed

# ── 3. 60-second LOCAL autosave-commit loop (commit ONLY, NO push) ──
# Snapshots uncommitted edits into local .git so they survive within a
# session. Per the user's standing rule, this does NOT push to GitHub —
# pushing requires the user's explicit instruction. (Local commits are
# wiped on env reset; only GitHub survives a reset.)
autosave_loop() {
  exec 9<"$0"
  flock -n 9 || return  # only one autosave per dev-watch
  local ALOG=/home/z/my-project/.zscripts/autosave.log
  echo "$(date -Iseconds) autosave started (60s, LOCAL commit only — NO GitHub push)" >> "$ALOG"
  while true; do
    sleep 60
    local ts; ts="$(date -Iseconds)"
    cd /home/z/my-project || exit 1
    git add -A 2>/dev/null
    if git diff --cached --quiet 2>/dev/null; then continue; fi
    if git commit -m "autosave ${ts}" >/dev/null 2>&1; then
      echo "${ts} committed locally (NOT pushed — user rule)" >> "$ALOG"
    fi
  done
}
autosave_loop & disown
echo "[watchdog] autosave loop started (60s LOCAL commit, NO GitHub push)" >> "$LOG"

# ── 4. Run `next dev`, restart on crash ──
while true; do
  node /home/z/my-project/node_modules/.bin/next dev -p 3000 >> "$LOG" 2>&1
  EC=$?
  echo "[watchdog] next dev exited (code=$EC) at $(date) — restarting in 2s" >> "$LOG"
  sleep 2
done
