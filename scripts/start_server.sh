#!/usr/bin/env bash
# One-command (re)start of the PSX app after a sandbox recycle:
#   bash scripts/start_server.sh
# Idempotent: safe to run repeatedly. Cleans stale processes, launches
# the detached self-healing supervisor, waits for readiness, then runs
# the full health check.
set -u
APP_DIR="/home/z/my-project"
cd "$APP_DIR" || exit 1

echo "[1/3] clearing stale processes..."
pkill -9 -f "next de[v]" 2>/dev/null
pkill -9 -f "bun run de[v]" 2>/dev/null
pkill -9 -f "next-serve[r]" 2>/dev/null
pkill -f "server_supervisor.s[h]" 2>/dev/null
lsof -t -i tcp:3000 -s TCP:LISTEN 2>/dev/null | xargs -r kill -9 2>/dev/null
sleep 1

echo "[2/3] launching detached supervisor (survives terminal close)..."
setsid nohup bash "$APP_DIR/scripts/server_supervisor.sh" >/dev/null 2>&1 &
disown 2>/dev/null || true

echo "[3/3] waiting for http://localhost:3000 ..."
code="000"
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 3 http://localhost:3000 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "  server ready (HTTP 200) after ~$((i * 2))s"
    break
  fi
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "  FAILED: server did not come up; check:"
  echo "    - $APP_DIR/server-supervisor.log"
  echo "    - $APP_DIR/dev-server.log"
  exit 1
fi

echo ""
echo "running health check..."
python3 "$APP_DIR/scripts/server_health_check.py"
