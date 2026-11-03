# Task 108 — Forward Validation & Trade Maturity Operations

## Frozen campaign state (preserved, never rewritten)

- 57 forward observations (task105-gen1..gen3, all `no_trade`)
- 43 matured strategy outcomes — realized net **−PKR 102,348.02** (13 winners / 30 losers)
- 59 pending MTM positions (open / target_touched / pending_data)
- All models remain **`not_promotable`**; no real orders; shorts disabled.

## What Task 108 recalculated (from the live durable store)

`task107_maturity.py` (frozen engine, idempotent) re-ran post-session on 2026-11-03:
43 matured / 59 pending / realized −102,348.02 — identical to the published baseline,
confirming immutability. Unrealized MTM (engine daily marks) now reads −53,867.98 while
the monitor's snapshot-time estimate reads −35,151.75 at its capture moment: both are
point-in-time estimates and are never summed with realized P&L.

## Daily operating loop

```bash
python3 scripts/task107_runner.py pipeline          # ingest → shadow → maturity → reports (idempotent)
python3 scripts/task108_worker.py --once            # one gated delayed-observation cycle
python3 scripts/task108_runner.py status            # phase checkpoints
```

Maturity is computed from **real PSX sessions** (distinct daily-bar dates) and each
position's real entry date. The ≈2026-12-01 first full 21-session maturity remains an
**estimate** from Task 106/107 — no maturity date is claimed in advance.

## Rules

- New evidence is append-only; matured outcomes and shadow generations are immutable.
- MTM is never counted as realized; a target touch is an observed crossing, not a
  guaranteed profitable outcome.
- No promotion decisions are made from the forward sample.
