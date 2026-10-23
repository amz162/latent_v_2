#!/bin/bash
# Restore the SQLite DB from the compressed backup.
# The raw db/custom.db (152MB) exceeds GitHub's 100MB file limit,
# so it's stored compressed as db/custom.db.gz (40MB).
# Run this script after cloning to restore the DB:
cd "$(dirname "$0")/.." && gunzip -kf db/custom.db.gz && echo "DB restored to db/custom.db" && bun run db:push 2>/dev/null
