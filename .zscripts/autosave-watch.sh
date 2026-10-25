#!/usr/bin/env bash
# autosave-watch.sh — durability watchdog. Commits working-tree changes to
# LOCAL git every 5 min AND pushes to origin/main. Why push: the sandbox
# environment resets wipe the local .git too (proven — Tasks 29-32 local
# commits were gone after a reset, only the GitHub push survived). So local-
# only commits are NOT enough; GitHub is the only durable store. Push is
# the user's explicit instruction ("update my github repo ... so it will
# not delete the progress or data").
set -u
cd /home/z/my-project || exit 1
LOG=/home/z/my-project/.zscripts/autosave.log
exec 9<"$0"; flock -n 9 || { echo "$(date -Iseconds) dup autosave; exit 0"; }
echo "$(date -Iseconds) autosave-watch started (5-min cadence, commit+push)" >> "$LOG"
echo $$ > /home/z/my-project/.zscripts/autosave.pid
while true; do
  sleep 300
  ts="$(date -Iseconds)"
  git add -A 2>/dev/null
  if git diff --cached --quiet 2>/dev/null; then continue; fi
  if git commit -m "autosave ${ts}" >/dev/null 2>&1; then
    git push origin main >/dev/null 2>&1 && echo "${ts} committed+pushed" >> "$LOG" || echo "${ts} committed, push failed" >> "$LOG"
  fi
done
