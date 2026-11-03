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

---

## Task 108 reconciliation (2026-11-03)

Task 108 hardened the operational layer around this monitor without changing any design semantics:

- **Polling:** the 15-minute Actions cadence was retired. Primary polling is now the always-on host worker (`scripts/task108_worker.py`, 120 s, session-gated, heartbeat at `ops/worker_health.json`); `intraday-poll.yml` remains as a */5 fallback with artifact-based snapshot-store handoff.
- **Failure semantics:** `python3 scripts/task107_monitor.py || exit 0` was removed. Runs now classify as `success_with_updates` / `success_no_change` / `degraded_provider` / `failed_configuration` / `failed_internal_error` / `failed_data_integrity`; provider outages surface in the Actions job summary and never masquerade as successful refreshes.
- **Concurrency:** daily and intraday writers share one `task107-state-writers` concurrency group; pushes are commit-then-push with no force and no discard.
- **Storage:** Git is no longer the high-frequency runtime store. The snapshot SQLite (WAL, integrity-checked) is shared by worker and website; Git receives one daily consolidated commit.
- **Verified in production:** first successful real Actions run 41678403599 (2026-11-03, HEAD `ffaab3f8`), preceded by real failing runs (41674927733, 41675274557, 41675521990, 41676513527, 41677919816) that exposed and fixed genuine first-run defects (missing runner Python deps, hardcoded ROOT paths, missing bun for the V2 cost engine, dirty-tree rebase). Error-injection suite: 8/8.
- Counts unchanged at reconciliation time: 57 forward observations, 43 matured outcomes (−PKR 102,348.02 realized), 59 pending positions, 22/22 EOD quote==close.
