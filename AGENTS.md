# Latent.pk — agent ops notes

## Git authentication (GitHub)
- The repo `amz162/latent_v_2` is **PUBLIC**. A token that is committed to the
  repo is world-readable and GitHub secret scanning **auto-revokes it within
  minutes** (this killed both historically stored tokens).
- Tokens live ONLY in untracked, gitignored files: `.git/credentials` (armed
  store) and optionally `.zcredentials/github_token.local` (durable backup).
- NEVER print, echo, or log the token; NEVER commit any token file.
- To arm git credentials in any session: write the fresh token to
  `.zcredentials/github_token.local`, then `bash scripts/gh_auth.sh` (then plain
  `git push origin main` / `git fetch` work).
- Full recovery chain and rules: `.zcredentials/README.md`.

## After a sandbox recycle
- The workspace may be reset to a bare scaffold. The pre-recycle workspace
  (untracked files, no `.git/`) is preserved at `/tmp/my-project` — restore with
  `rsync -a /tmp/my-project/ /home/z/my-project/`, then `bash scripts/gh_auth.sh`.
- If `.git/` is missing but files are present: `git init -b main`,
  `git remote add origin https://github.com/amz162/latent_v_2.git`,
  arm credentials, `git fetch origin main`, `git reset --soft origin/main`,
  review `git diff --cached --stat`, then commit (single restoration commit) and push.

## Runtime
- DB: `gunzip -kf db/custom.db.gz` (raw 152 MB is gitignored; gz copy is the committed one).
- Install: `bun install`. Verify: `bun run build`. Dev: `bun run dev` (port 3000).
- Task 107 QA suites: `python3 scripts/task107_v2_tests.py`, `python3 scripts/task107_v1_tests.py`.
