#!/bin/bash

set -euo pipefail

# 获取脚本所在目录（.zscripts）
# 使用 $0 获取脚本路径（与 build.sh 保持一致）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log_step_start() {
        local step_name="$1"
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting: $step_name"
        echo "=========================================="
        export STEP_START_TIME
        STEP_START_TIME=$(date +%s)
}

log_step_end() {
        local step_name="${1:-Unknown step}"
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - STEP_START_TIME))
        echo "=========================================="
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Completed: $step_name"
        echo "[LOG] Step: $step_name | Duration: ${duration}s"
        echo "=========================================="
        echo ""
}

start_mini_services() {
        local mini_services_dir="$PROJECT_DIR/mini-services"
        local started_count=0

        log_step_start "Starting mini-services"
        if [ ! -d "$mini_services_dir" ]; then
                echo "Mini-services directory not found, skipping..."
                log_step_end "Starting mini-services"
                return 0
        fi

        echo "Found mini-services directory, scanning for sub-services..."

        for service_dir in "$mini_services_dir"/*; do
                if [ ! -d "$service_dir" ]; then
                        continue
                fi

                local service_name
                service_name=$(basename "$service_dir")
                echo "Checking service: $service_name"

                if [ ! -f "$service_dir/package.json" ]; then
                        echo "[$service_name] No package.json found, skipping..."
                        continue
                fi

                if ! grep -q '"dev"' "$service_dir/package.json"; then
                        echo "[$service_name] No dev script found, skipping..."
                        continue
                fi

                echo "Starting $service_name in background..."
                (
                        cd "$service_dir"
                        echo "[$service_name] Installing dependencies..."
                        bun install
                        echo "[$service_name] Running bun run dev..."
                        exec bun run dev
                ) >"$PROJECT_DIR/.zscripts/mini-service-${service_name}.log" 2>&1 &

                local service_pid=$!
                echo "[$service_name] Started in background (PID: $service_pid)"
                echo "[$service_name] Log: $PROJECT_DIR/.zscripts/mini-service-${service_name}.log"
                disown "$service_pid" 2>/dev/null || true
                started_count=$((started_count + 1))
        done

        echo "Mini-services startup completed. Started $started_count service(s)."
        log_step_end "Starting mini-services"
}

wait_for_service() {
        local host="$1"
        local port="$2"
        local service_name="$3"
        local max_attempts="${4:-60}"
        local attempt=1

        echo "Waiting for $service_name to be ready on $host:$port..."

        while [ "$attempt" -le "$max_attempts" ]; do
                if curl -s --connect-timeout 2 --max-time 5 "http://$host:$port" >/dev/null 2>&1; then
                        echo "$service_name is ready!"
                        return 0
                fi

                echo "Attempt $attempt/$max_attempts: $service_name not ready yet, waiting..."
                sleep 1
                attempt=$((attempt + 1))
        done

        echo "ERROR: $service_name failed to start within $max_attempts seconds"
        return 1
}

cleanup() {
        if [ -n "${DEV_PID:-}" ] && kill -0 "$DEV_PID" >/dev/null 2>&1; then
                echo "Stopping Next.js dev server (PID: $DEV_PID)..."
                kill "$DEV_PID" >/dev/null 2>&1 || true
        fi
}

trap cleanup EXIT INT TERM

cd "$PROJECT_DIR"

if ! command -v bun >/dev/null 2>&1; then
        echo "ERROR: bun is not installed or not in PATH"
        exit 1
fi

log_step_start "bun install"
echo "[BUN] Installing dependencies..."
bun install
log_step_end "bun install"

log_step_start "bun run db:push"
echo "[BUN] Setting up database..."
# Issue 38: NEVER wipe the DB on restart. `bun run db:push` runs
# `prisma db push --accept-data-loss` which RECREATES the schema and deletes
# all data if the schema has any changes OR if the DB doesn't have all the
# expected tables. This was causing the recurring "empty DB → 0 ensembles /
# no model signals" bug.
#
# New logic:
# 1. If db/custom.db has 0 rows in OhlcvBar (empty/corrupt) → restore from
#    db/custom.db.gz backup (908 stocks, 1M+ bars). Then run db:push ONLY
#    IF the schema is missing tables (idempotent — won't delete data if
#    tables already exist with the expected columns).
# 2. If db/custom.db has data (any row count > 0) → SKIP db:push entirely.
#    The schema is already in place; running db:push would risk data loss.
# 3. Always: verify DB has data after the step. If still empty, restore from .gz.
DB_FILE="$PROJECT_DIR/db/custom.db"
GZ_FILE="$PROJECT_DIR/db/custom.db.gz"
restore_db_from_gz() {
        if [ -f "$GZ_FILE" ]; then
                echo "[DB] Restoring from $GZ_FILE..."
                gunzip -kf "$GZ_FILE"
                echo "[DB] Restored: $(stat -c%s "$DB_FILE" 2>/dev/null || echo '?') bytes"
        else
                echo "[DB] WARNING: $GZ_FILE not found — cannot restore. DB will be empty."
        fi
}
db_has_data() {
        if [ ! -f "$DB_FILE" ]; then
                return 1  # file doesn't exist → no data
        fi
        # Use sqlite3 if available, else python3
        if command -v sqlite3 >/dev/null 2>&1; then
                local count
                count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM OhlcvBar;" 2>/dev/null || echo "0")
                [ "$count" -gt 0 ]
        else
                python3 -c "import sqlite3; c=sqlite3.connect('$DB_FILE').cursor(); c.execute('SELECT COUNT(*) FROM OhlcvBar'); print(c.fetchone()[0])" 2>/dev/null | grep -qv "^0$"
        fi
}
if db_has_data; then
        echo "[DB] db/custom.db already has data — SKIPPING db:push (preserves data)."
else
        echo "[DB] db/custom.db is empty/missing — restoring from .gz backup..."
        restore_db_from_gz
        if db_has_data; then
                echo "[DB] Restore successful — SKIPPING db:push (schema already in place)."
        else
                echo "[DB] Restore failed or .gz missing — running db:push to create empty schema..."
                bun run db:push
        fi
fi
# Final safety check: ensure DB has data before proceeding.
if ! db_has_data; then
        echo "[DB] WARNING: DB still empty after setup. Restoring from .gz as last resort..."
        restore_db_from_gz
fi
log_step_end "bun run db:push"

log_step_start "Starting Next.js dev server"
echo "[BUN] Starting development server..."
bun run dev &
DEV_PID=$!
log_step_end "Starting Next.js dev server"

log_step_start "Waiting for Next.js dev server"
wait_for_service "localhost" "3000" "Next.js dev server"
log_step_end "Waiting for Next.js dev server"

log_step_start "Health check"
echo "[BUN] Performing health check..."
curl -fsS localhost:3000 >/dev/null
echo "[BUN] Health check passed"
log_step_end "Health check"

start_mini_services

echo "Next.js dev server is running in background (PID: $DEV_PID)."
echo "Use 'kill $DEV_PID' to stop it."
disown "$DEV_PID" 2>/dev/null || true
unset DEV_PID
