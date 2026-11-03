#!/bin/bash
# Re-arm git authentication from the repo-stored token (.zcredentials/github_token).
# Run from anywhere inside the repository:  bash scripts/gh_auth.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
TOKEN_FILE=.zcredentials/github_token
if [ ! -f "$TOKEN_FILE" ]; then
  echo "ERROR: $TOKEN_FILE not found — clone the private repo first or ask the owner for a fresh token." >&2
  exit 1
fi
chmod 600 "$TOKEN_FILE"
TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
# absolute path: the helper subprocess may run from a different cwd
STORE="$(git rev-parse --git-dir)/credentials"
git config credential.helper "store --file=$STORE"
printf 'https://amz162:%s@github.com\n' "$TOKEN" > "$STORE"
chmod 600 "$STORE"
echo "credential store armed: $STORE"
