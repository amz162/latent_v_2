#!/usr/bin/env bash
# apply.sh — install the allowedDevOrigins fix onto the running project.
#
# What it does:
#   1. Copies next.config.patched.ts -> /home/z/my-project/next.config.ts
#      (only this one root file changes — everything else stays untouched).
#   2. Sends SIGTERM to the running `next dev` process so dev-watch.sh's
#      supervisor loop restarts it (dev-watch auto-restarts on exit, picking
#      up the new next.config.ts). It does NOT touch dev-watch.sh itself.
#
# Non-destructive: next.config.orig.ts (a copy of the pre-fix config) lives
# next to this script, so `bash revert.sh` (or copying it back) restores the
# exact original state.
#
# SURVIVAL CAVEAT (read this):
#   - Within a session: the dev-watch 60s autosave commits this locally
#     (LOCAL commit only — NEVER pushed, per the user's standing rule).
#     So it survives a `next dev` crash / dev-watch inner-loop restart.
#   - On a full dev-watch restart (e.g. after a sandbox env reset), this
#     script's folder survives (tracked) BUT next.config.ts at root is
#     restored to origin/main by restore-from-github.sh — i.e. the fix is
#     un-applied. To make it permanent across resets it must be pushed to
#     GitHub, which is NOT done here (user rule: never push without explicit
#     instruction). Re-run `bash .zscripts/dev-fixes/apply.sh` to re-apply.
set -uo pipefail
cd /home/z/my-project || exit 1

ROOT_CFG=/home/z/my-project/next.config.ts
FIX_DIR=/home/z/my-project/.zscripts/dev-fixes
PATCHED="$FIX_DIR/next.config.patched.ts"

if [ ! -f "$PATCHED" ]; then
  echo "ERROR: patched config not found at $PATCHED" >&2
  exit 1
fi

# 1. Install the patched config (only root next.config.ts is touched).
cp "$PATCHED" "$ROOT_CFG"
echo "[dev-fix] installed $PATCHED -> $ROOT_CFG"

# 2. Restart `next dev` so the new config takes effect.
#    dev-watch.sh runs `node ... next dev` in a while-true loop; killing the
#    `node next dev` parent makes the loop catch the exit and respawn it
#    within ~2s, now reading the updated next.config.ts.
NEXT_PID=$(pgrep -f "node /home/z/my-project/node_modules/.bin/next dev -p 3000" | head -n1 || true)
if [ -n "$NEXT_PID" ]; then
  echo "[dev-fix] signalling next dev (PID $NEXT_PID) to restart..."
  kill -TERM "$NEXT_PID" 2>/dev/null || true
  # dev-watch will respawn it within ~2s.
else
  echo "[dev-fix] no running next dev found — dev-watch should spawn it shortly"
fi

echo "[dev-fix] done. Verify with:"
echo "  curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/"
echo "  tail -40 /home/z/my-project/dev.log   # look for the cross-origin warning to stop"
