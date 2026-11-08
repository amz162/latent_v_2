#!/usr/bin/env python3
"""Task 120 Phase 5 — fresh outcome-ledger reconciliation rerun.

Identical method to scripts/task119_reconcile.py (production engine re-invoked
on frozen shadow ledgers, independent partition + point-in-time reproduction),
but ALL artifact outputs are redirected to data/backtest_reports/task120/ so
the committed Task 119 artifacts remain byte-identical (historical reports are
never rewritten)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import task119_reconcile as R  # noqa: E402

T120 = ROOT / "data/backtest_reports/task120"
T120.mkdir(parents=True, exist_ok=True)
R.T119 = T120  # redirect every artifact write (engine output, ledger dump, CSV, JSON)

if __name__ == "__main__":
    sys.exit(R.main())
