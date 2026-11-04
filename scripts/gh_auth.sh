#!/bin/bash
# Re-arm git authentication for amz162/latent_v_2.
# Run from anywhere inside the repository:  bash scripts/gh_auth.sh
#
# SECURITY CONTRACT (the repo is PUBLIC):
#   A token that is committed to the repo becomes world-readable and GitHub
#   secret scanning auto-revokes it within minutes. Tokens therefore live ONLY
#   in untracked, gitignored files:
#     1. .git/credentials           (the armed credential store; never committed)
#     2. .zcredentials/github_token.local  (optional durable backup, gitignored)
#   The historical .zcredentials/github_token copy was removed from the tree in
#   the "security: untrack credentials" commit; both tokens that were committed
#   there are dead (auto-revoked by GitHub).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
TOKEN=""
for TOKEN_FILE in .zcredentials/github_token.local .zcredentials/github_token; do
  if [ -f "$TOKEN_FILE" ]; then
    chmod 600 "$TOKEN_FILE"
    TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
    break
  fi
done
if [ -z "$TOKEN" ]; then
  echo "ERROR: no token found." >&2
  echo "  Expected .zcredentials/github_token.local (gitignored) — ask the owner for a fresh token," >&2
  echo "  write it to that file (never commit it), then re-run this script." >&2
  exit 1
fi
# absolute path: the helper subprocess may run from a different cwd
STORE="$(git rev-parse --git-dir)/credentials"
git config credential.helper "store --file=$STORE"
printf 'https://amz162:%s@github.com\n' "$TOKEN" > "$STORE"
chmod 600 "$STORE"
echo "credential store armed: $STORE"
