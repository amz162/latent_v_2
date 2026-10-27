#!/bin/bash
# dev-watch-local.sh — dev-server supervisor WITHOUT the GitHub-restore step.
#
# Why this exists: dev-watch.sh runs restore-from-github.sh on every startup,
# which resets the tree to origin/main. That is correct for pushed code, but
# it WIPES any local fixes that are not yet pushed (user rule: never push
# without explicit authorization). Until the pending fixes are pushed, use
# THIS supervisor so local fixes survive restarts.
#
# It keeps the two protective parts of dev-watch.sh:
#   1. DB restore from .gz backup if the DB file is empty/missing
#   2. `next dev` restart-on-crash loop
# and adds a 60-second LOCAL autosave commit loop (commit only, NO push) so
# in-session edits survive accidental kills.

exec 2>&1
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
LOG=/home/z/my-project/dev.log
echo "[watchdog-local] supervisor started (NO github restore) $(date)" >> "$LOG"

restore_db_if_needed() {
  local db=/home/z/my-project/db/custom.db
  local gz=/home/z/my-project/db/custom.db.gz
  local need_restore=0
  if [ ! -f "$db" ]; then
    need_restore=1
  else
    local sz; sz=$(stat -c%s "$db" 2>/dev/null || echo 0)
    if [ "$sz" -lt 5000000 ]; then need_restore=1; fi
  fi
  if [ "$need_restore" = "1" ]; then
    if [ -f "$gz" ]; then
      echo "[watchdog-local] db/custom.db empty/missing — restoring from .gz backup" >> "$LOG"
      gunzip -kf "$gz" 2>>"$LOG"
      bun run db:push >/dev/null 2>&1 || true
      echo "[watchdog-local] db restored → $(stat -c%s "$db" 2>/dev/null) bytes" >> "$LOG"
    else
      echo "[watchdog-local] WARN: db empty AND no .gz backup" >> "$LOG"
    fi
  else
    echo "[watchdog-local] db/custom.db OK ($(stat -c%s "$db") bytes)" >> "$LOG"
  fi
}
restore_db_if_needed

autosave_loop() {
  exec 9<"$0"
  flock -n 9 || return
  local ALOG=/home/z/my-project/.zscripts/autosave.log
  while true; do
    sleep 60
    local ts; ts="$(date -Iseconds)"
    cd /home/z/my-project || exit 1
    git add -A 2>/dev/null
    if git diff --cached --quiet 2>/dev/null; then continue; fi
    if git commit -m "autosave-local ${ts}" >/dev/null 2>&1; then
      echo "${ts} committed locally (NOT pushed — user rule)" >> "$ALOG"
    fi
  done
}
autosave_loop & disown
echo "[watchdog-local] autosave loop started (60s LOCAL commit, NO GitHub push)" >> "$LOG"

while true; do
  node /home/z/my-project/node_modules/.bin/next dev -p 3000 >> "$LOG" 2>&1
  EC=$?
  echo "[watchdog-local] next dev exited (code=$EC) at $(date) — restarting in 2s" >> "$LOG"
  sleep 2
done
