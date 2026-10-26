# dev-fixes — isolated, reversible dev-server fixes

This folder holds **isolated fix artifacts**. The project's own source files
are NOT edited in place — instead the patched version + a backup of the
original live here, and a small `apply.sh` copies the patched version into
the single root file it affects. Everything else in the project stays
untouched.

## Current fix: `allowedDevOrigins` for the Preview Panel

### Symptom
The Preview Panel showed a **"server starts after some sec"** placeholder
and never rendered the app, even though `curl http://127.0.0.1:3000/`
returned `HTTP 200` with a 61KB HTML body in ~55ms.

### Root cause
`dev.log` contained this Next.js 16 warning:

```
Cross origin request detected from 127.0.0.1 to /_next/* resource.
In a future major version of Next.js, you will need to explicitly
configure "allowedDevOrigins" in next.config to allow this.
```

The Preview Panel loads the app through the **Caddy gateway on `:81`**,
which reverse-proxies to the Next.js dev server on `127.0.0.1:3000`. The
iframe origin therefore differs from the dev server's host, so Next.js
flags every `/_next/*` (HMR client + JS chunks) request as cross-origin.
The page HTML loads (`GET / 200`) but the dev JS assets are flagged (and
in a future Next.js version will be blocked outright), so the page never
boots in the iframe → the panel keeps showing its "server starts" placeholder.

### Fix
Add `allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0"]` to
`next.config.ts`. This is the single documented Next.js 16 remedy for that
exact warning.

### Files in this folder
| File | Purpose |
|---|---|
| `next.config.orig.ts`    | Byte-for-byte backup of the pre-fix `next.config.ts` (taken 2026-10-26). |
| `next.config.patched.ts` | The fixed config. Only diff vs `.orig` is the `allowedDevOrigins` block. |
| `apply.sh`               | Copies `next.config.patched.ts` → `/home/z/my-project/next.config.ts` and signals `next dev` to restart so the new config takes effect. Touches NO other file. |
| `revert.sh`              | Copies `next.config.orig.ts` back to root + restarts `next dev`. (Created on demand — for now `cp next.config.orig.ts ../next.config.ts` + restart works.) |
| `README.md`             | This file. |

### Apply
```bash
bash /home/z/my-project/.zscripts/dev-fixes/apply.sh
```

### Verify
```bash
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:3000/
tail -40 /home/z/my-project/dev.log   # the cross-origin warning should stop
```
Then refresh the Preview Panel — the app should render instead of showing
the "server starts after some sec" placeholder.

### Survival / persistence (IMPORTANT)
- **Within a session** the fix survives: dev-watch's 60s autosave commits
  it locally (LOCAL commit only — never pushed, per the user's standing
  rule "never push to my GitHub repo until I tell you to"). A `next dev`
  crash + dev-watch inner-loop restart will keep the fix because the file
  on disk is unchanged.
- **On a full dev-watch restart** (e.g. after a sandbox env reset),
  `restore-from-github.sh` runs `git reset --hard origin/main`, which
  reverts root `next.config.ts` back to the un-patched origin/main version.
  This folder (tracked after autosave) survives, so the fix can be
  re-applied with `bash .zscripts/dev-fixes/apply.sh`.
- **To make it permanent across resets** the patched `next.config.ts`
  would need to be pushed to `origin/main`. That is **NOT** done here —
  pushing requires the user's explicit instruction (standing rule).
