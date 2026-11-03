# .zcredentials

Machine credentials for agent access, committed **only while this repository is private**.

## github_token

A GitHub personal access token (classic, `ghp_…`) with `repo` scope for
`amz162/latent_v_2`. It is what the coding agent uses to `git fetch` / `git pull` /
`git push` from sandbox sessions, and to call the GitHub API (it has admin rights
on this repository).

## How the agent uses it (future sessions)

1. If the workspace survived, `.git/credentials` (untracked, inside `.git/`) already
   has the token and git operations just work.
2. Fresh session, workspace intact but git not armed:

   ```bash
   bash scripts/gh_auth.sh
   ```

   which reads `.zcredentials/github_token` and re-arms the local credential store.

3. After a sandbox recycle the workspace may be reset to a bare scaffold; the
   pre-recycle workspace is preserved at `/tmp/my-project` (untracked files
   included, `.git/` excluded). Recover with:

   ```bash
   rsync -a /tmp/my-project/ /home/z/my-project/
   bash scripts/gh_auth.sh   # token comes from .zcredentials/github_token
   ```

4. If no local copy exists anywhere, clone the private repo using the token from
   whichever source above still exists, then run `scripts/gh_auth.sh` inside the
   clone — the repo copy of this file is the durable backup.
5. Last resort: ask the owner for a fresh token.

## Lifecycle and safety contract

- The token was pasted in chat by the owner, who consented to this storage and to
  keeping the repository private for as long as the file exists.
- Deleting this file in a new commit does NOT remove it from git history — the
  history entry remains readable to anyone with repo access.
- When rotating or retiring the token: revoke it at
  <https://github.com/settings/tokens>, then update BOTH copies (this file and the
  workspace copy) in the same session. Revocation is the real kill switch.
- Push/fetch one-liner without arming the store (token never on the command line):

  ```bash
  git -c credential.helper='!f(){ echo username=oauth2; echo password=$(cat /home/z/my-project/.zcredentials/github_token); }; f' push origin main
  ```
