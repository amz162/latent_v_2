# .zcredentials

Machine credential handling for agent access to `amz162/latent_v_2`.

## SECURITY CONTRACT — READ FIRST

**This repository is PUBLIC.** A token that is committed anywhere in this tree
becomes world-readable instantly, and GitHub secret scanning **auto-revokes**
exposed classic PATs (`ghp_…`) within minutes. This exact mechanism killed both
tokens that were historically stored here:

- Both can be found dead in git history (`git log -- .zcredentials/github_token`).
- They are revoked and useless; nothing needs to be done about them beyond
  remembering why this file says what it says.

## Where tokens live now

1. `.git/credentials` — the armed credential store (untracked, inside `.git/`,
   never committed). Written by `scripts/gh_auth.sh`. This is the only place a
   working token should exist during a session.
2. `.zcredentials/github_token.local` — optional durable backup (gitignored).
   If the owner supplies a fresh token, save it here (never commit it), then run
   `bash scripts/gh_auth.sh` to arm the store.

Both paths are in `.gitignore`. The historical `github_token` file was removed
from the tree in the "security: untrack credentials" commit; deleting it did not
scrub history (see above), it only stops future exposure.

## How the agent uses it (future sessions)

1. Workspace survived and git is armed → push/fetch just work.
2. Workspace intact, git not armed → `bash scripts/gh_auth.sh` (reads
   `.zcredentials/github_token.local`, arms `.git/credentials`).
3. Fresh token needed → ask the owner in chat, write it to
   `.zcredentials/github_token.local`, arm, push. A token pasted in **chat** is
   fine; a token pushed to **this repo** is dead on arrival.

## Lifecycle and safety contract

- The owner consents to tokens living in chat transcripts and in untracked local
  files, but NOT in this repository (it is public).
- When rotating: revoke the old token at <https://github.com/settings/tokens>,
  write the new one to the gitignored `.local` file, re-arm. Revocation remains
  the real kill switch.
- History scrubbing (BFG / `git filter-repo` + GitHub support) is optional
  cleanup: the two exposed tokens are already revoked, so there is nothing left
  to leak from history.
