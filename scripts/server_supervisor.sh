#!/usr/bin/env bash
# Self-healing supervisor for the PSX app dev server.
# Keeps http://localhost:3000 alive for the lifetime of the sandbox:
# polls the port every CHECK_INTERVAL seconds and restarts the dev
# server whenever it stops responding.
#
# Start it detached (survives terminal close / session sign-off):
#   setsid nohup bash scripts/server_supervisor.sh >/dev/null 2>&1 &
#
# NOTE: this protects against crashes and terminal close. It CANNOT
# survive a sandbox recycle (the platform kills every process), but
# scripts/start_server.sh restores everything with one command.
set -u
APP_DIR="/home/z/my-project"
PORT=3000
CHECK_INTERVAL=20
LOG="$APP_DIR/server-supervisor.log"
DEV_LOG="$APP_DIR/dev-server.log"
PIDFILE="$APP_DIR/.server-supervisor.pid"

cd "$APP_DIR" || exit 1

# resolve bun even when started from a minimal environment
if ! command -v bun >/dev/null 2>&1; then
  export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:$PATH"
fi

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
  echo "supervisor already running (pid $(cat "$PIDFILE"))" >&2
  exit 0
fi
echo $$ > "$PIDFILE"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

port_up() { curl -s -o /dev/null -m 5 "http://localhost:$PORT/"; }

start_server() {
  log "starting dev server"
  nohup bun run dev >> "$DEV_LOG" 2>&1 &
  local waited=0
  while ! port_up; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 120 ]; then
      log "server failed to become ready in 120s"
      return 1
    fi
  done
  log "server ready after ${waited}s"
}

log "=== supervisor started (pid $$) ==="
while true; do
  if ! port_up; then
    log "port $PORT not responding - recovering"
    pkill -9 -f "next de[v]" 2>/dev/null
    pkill -9 -f "bun run de[v]" 2>/dev/null
    pkill -9 -f "next-serve[r]" 2>/dev/null
    lsof -t -i tcp:"$PORT" -s TCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null
    start_server
  fi
  sleep "$CHECK_INTERVAL"
done
