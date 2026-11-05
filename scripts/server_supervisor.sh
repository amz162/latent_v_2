#!/usr/bin/env bash
# Self-healing supervisor for the Latent.pk app server.
#
# Task 118 Part C — PRODUCTION RUNTIME CUTOVER:
#   default runtime is now the PRODUCTION build (next start) instead of the
#   development server (next dev). Dev mode caused the observed
#   "compiling continuously" loop: per-request webpack compiles + heavy HMR
#   made the port unresponsive under the supervisor's 20s poll, triggering
#   34 crash-restarts. Production mode precompiles once and serves statically.
#
# Runtime selection:
#   LATENT_RUNTIME=prod  (default) -> serves the prebuilt .next via next start
#   LATENT_RUNTIME=dev             -> old development behaviour (rollback path)
#
# The supervisor rebuilds on start in prod mode if .next/BUILD_ID is missing,
# rotates oversized logs, and keeps the graceful-restart/crash-recovery loop.
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
RUNTIME="${LATENT_RUNTIME:-prod}"
LOG="$APP_DIR/server-supervisor.log"
SERVER_LOG="$APP_DIR/dev-server.log"
LOG_MAX_BYTES=$((50 * 1024 * 1024)) # 50 MB -> rotate to .1
PIDFILE="$APP_DIR/.server-supervisor.pid"

cd "$APP_DIR" || exit 1

# resolve bun even when started from a minimal environment
if ! command -v bun >/dev/null 2>&1; then
  export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:$PATH"
fi

if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE" 2>/dev/null)" ; then
  echo "supervisor already running (pid $(cat "$PIDFILE"))" >&2
  exit 0
fi
echo $$ > "$PIDFILE"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

rotate_log() {
  if [ -f "$SERVER_LOG" ] && [ "$(stat -c %s "$SERVER_LOG" 2>/dev/null || echo 0)" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$SERVER_LOG" "$SERVER_LOG.1"
    log "rotated $SERVER_LOG (>50MB) -> .1"
  fi
}

port_up() { curl -s -o /dev/null -m 5 "http://localhost:$PORT/"; }

kill_stale() {
  pkill -9 -f "next de[v]" 2>/dev/null
  pkill -9 -f "bun run de[v]" 2>/dev/null
  pkill -9 -f "next star[t]" 2>/dev/null
  pkill -9 -f "bun run star[t]" 2>/dev/null
  pkill -9 -f "next-serve[r]" 2>/dev/null
  lsof -t -i tcp:"$PORT" -s TCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null
}

start_server() {
  rotate_log
  if [ "$RUNTIME" = "prod" ]; then
    if [ ! -f "$APP_DIR/.next/BUILD_ID" ]; then
      log "prod runtime: .next/BUILD_ID missing — building"
      if ! bun run build >> "$SERVER_LOG" 2>&1; then
        log "production build FAILED — not starting (rollback: LATENT_RUNTIME=dev)"
        return 1
      fi
    fi
    log "starting PRODUCTION server (next start -p $PORT)"
    # bun run start resolves to the fixed package.json script: next start
    nohup bun run start >> "$SERVER_LOG" 2>&1 &
  else
    log "starting DEV server (rollback runtime)"
    nohup bun run dev >> "$SERVER_LOG" 2>&1 &
  fi
  local waited=0
  while ! port_up; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 120 ]; then
      log "server failed to become ready in 120s"
      return 1
    fi
  done
  log "server ready after ${waited}s (runtime=$RUNTIME)"
  # startup health probe — log the true health verdict, not just port liveness
  sleep 2
  local health
  health=$(curl -s -m 10 "http://localhost:$PORT/api/health" | head -c 200 || echo "fetch failed")
  log "startup health probe: $health"
}

log "=== supervisor started (pid $$, runtime=$RUNTIME) ==="
kill_stale
start_server
while true; do
  if ! port_up; then
    log "port $PORT not responding - recovering"
    kill_stale
    start_server
  fi
  sleep "$CHECK_INTERVAL"
done
