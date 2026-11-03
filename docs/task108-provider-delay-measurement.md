# Task 108 — Provider Delay Measurement

## What we know and how we know it

| Quantity | Value | Class |
|---|---|---|
| Provider delay | 15 minutes | **user-observed** (never provider-verified) |
| Source market timestamp | **not supplied** by the provider | verified structurally (task107_delay_verification.json) |
| `retrieved_at` | actual fetch time | direct |
| `estimated_source_timestamp` | retrieved_at − 15 min | **estimated**, labeled on every record |
| Publication cadence | not yet measurable in-session | pending next session's captures |

The measurement log (`task108_in_session_observations.csv`) is regenerated from the
durable snapshot store on every probe run, so the always-on worker automatically extends
it from the next trading session onward: first observation of the morning, repeated
unchanged prices (publication cadence), final closing observation, and per-cycle
application latency (`cycle_latency`) are all captured without extra tooling.

Tonight's post-session probe (21:5x PKT): 25 symbols probed, 22/22 quotes equal the
verified 2026-11-03 daily close, avg fetch latency 409 ms — evidence of correct final
capture, **not** of the intraday delay.

## Rules enforced in code

- Delayed snapshots are **never** represented as live prices.
- The 15-minute estimate is **never** promoted to a verified fact.
- `timestamp_quality` distinguishes direct values from estimates on every observation.

## How the distribution will be measured

Across upcoming sessions the worker records, per symbol: consecutive observation prices,
retrieval timestamps, and unchanged-repeat spans. The delay distribution is derived from
first-observation-of-window timing plus quote-change boundaries against the verified
daily close — while keeping the source-timestamp estimate explicitly labeled.
