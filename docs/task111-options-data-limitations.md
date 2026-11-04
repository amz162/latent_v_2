# Task 111 — Options and Convexity Data Limitations

Status: **`blocked_options_data`** (rechecked this task).

## Finding

PSX listed single-stock options data is not available from any authorized platform source. Task 110's audit is carried
forward and re-verified: the platform database has no options tables, no provider feed delivers contracts, and no
member of the required field set is observable:

contract, underlying, expiry, strike, call/put, bid/ask, last price, implied volatility, open interest, volume,
contract multiplier, settlement, margin, trading permissions.

## Consequences enforced in the engine

- `long_vol_watch`, `vol_compression_watch`, `mean_reversion_watch` remain **research-only watches** — there is no
  executable instruction of any kind behind them.
- Realized volatility (close-to-close / Parkinson / Garman-Klass) is **never** presented as implied volatility.
- No premiums are fabricated; no synthetic option chains exist; short-option selling is structurally unsupported by the
  execution policy (long-only, no leverage).
- The LLM evidence package labels the options category `unavailable`; missing data is never converted into neutral or
  bullish evidence.

## What would change this

A licensed PSX derivatives feed (e.g., NCCPL/PSX derivatives market data) with the field set above, plus explicit owner
approval and account-permission verification. No paid subscription was added in this task (rule 12). Requirements are
listed in `task111_option_data_requirements.json`; the disposition of the convexity research line is in
`task111_convexity_research_disposition.json`.
