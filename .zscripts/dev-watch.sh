#!/bin/bash
# Restarts the Next.js dev server if it exits (e.g. OOM-killed under the
# 4GB memory limit during a heavy Turbopack compile). Keeps the preview
# available for the user.
exec 2>&1
cd /home/z/my-project
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:-}"
LOG=/home/z/my-project/dev.log
echo "[watchdog] supervisor started $(date)" > "$LOG"
while true; do
  node /home/z/my-project/node_modules/.bin/next dev -p 3000 >> "$LOG" 2>&1
  EC=$?
  echo "[watchdog] next dev exited (code=$EC) at $(date) — restarting in 2s" >> "$LOG"
  sleep 2
done
