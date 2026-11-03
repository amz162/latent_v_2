# Task 107 — Paper Trade Monitor

**Where:** app sidebar → "Paper Trade Monitor" (`paper_monitor` view; `src/components/latent/PaperTradeMonitor.tsx`).
**Data:** live `GET /api/paper-trading/monitor` (+ `/[tradeId]` detail) — no hardcoded demo values.

## What it shows

- **Permanent delay banner** with the live feed window status (09:45–15:45 PKT), provider delay (≈15 min, user-observed), source data type, poll interval, last poll time, and stored-snapshot count.
- **Summary cards**: open paper trades, symbols, target-touched, partial exits, stop-loss events, ambiguous, pending-data. Signals vs open positions vs legacy Task-76 prospective trades are kept separate.
- **Active trade table**: symbol, status, strategy + exact model version, signal time, entry (time/price/qty), latest delayed price with **Market time (est.)** and **Received** timestamps + delay, SL, TP1-3, best target reached, realized vs unrealized vs estimated-net P&L (PKR), sessions left.
- **Level ladder** `SL ← ENTRY → TP1 → TP2 → TP3` with the current delayed price marker.
- **Detail view**: where the trade came from (origin/model/horizon/entry reason) and where it is going (levels, distances, est. net if exited now), detection events, ambiguity flags, resolution caveats.
- **Filters**: status (open/target/partial/SL/ambiguous/pending/stale), symbol, strategy.

## Semantics baked into the UI

Open positions are neither wins nor losses; MTM is not realized P&L; targets are research levels, not guarantees; every price is a delayed snapshot (`observation_resolution_limited`), never "live".
