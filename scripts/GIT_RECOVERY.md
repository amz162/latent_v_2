# Git Recovery Instructions (preserve — Task 97 safety contract)

## What happened in Task 96 (the incident that motivated this policy)

On 2026-10-31, `dev-watch.sh` ran `restore-from-github.sh`, which executed
`git reset --hard origin/main` + `git clean -fdq` on startup. The working
tree contained unpushed autosave commits (the 60-second local autosave loop
commits every minute); the reset discarded every locally committed file that
was not yet on GitHub. Work was recovered 100% from the reflog.

## Permanent rule

Project automation must never run `git reset --hard`, `git clean -fd`,
`git checkout --`, `git rebase`, or `git push --force`.
`scripts/git_safety_audit.py` enforces this in CI (production-build.yml).

## How to recover lost commits via the reflog (no history rewrite)

```bash
# 1. Find the commit just before the destructive operation
git reflog --date=iso | head -20

# 2. Inspect it before moving anything
git show --stat <commit>

# 3. Restore the files WITHOUT discarding git history:
#    - If your branch is BEHIND the lost commit (reset moved it back):
git merge --ff-only <commit>          # fast-forward, no rewrite
#    - If the histories diverged:
git cherry-pick <commit>              # replay, keeps history intact

# 4. Push immediately so a future reset can never lose it again
git push origin main
```

`reset --hard <commit>` also works for pure recovery (branch pointer moves
forward to an existing reflog commit; nothing is rewritten), but the two
commands above are preferred because they cannot abandon anything.

## Safe supervisor behavior (as of Task 97)

- `.zscripts/dev-watch-local.sh`: DB restore + local autosave commits + dev
  server restart. No git synchronization. (This is the boot supervisor.)
- `.zscripts/dev-watch.sh`: calls `restore-from-github.sh`, which fetches,
  refuses to sync a dirty tree, and fast-forward-merges only when clean.
