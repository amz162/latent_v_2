# Task 106 — Data Refresh Runbook

## 1. Supply verified PSX EOD data

Two accepted paths:

- **Automatic (active):** the app's approved free provider `psxdata-api.fastapicloud.dev` (`/stocks/{sym}/historical?start=YYYY-MM-DD&end=YYYY-MM-DD`, no API key). This is the same `psxdata` source already stored in `OhlcvBar` — no new trust decision required.
- **Manual drop:** put a CSV in `data/external_imports/psx_eod/` with columns `symbol,date,open,high,low,close,volume` (optional: `turnover,provider,source_id,retrieved_at`). Never commit licensed/redistribution-restricted data.

## 2. Validate and import safely

```
python3 scripts/task103_import_data.py --type psx_eod --file <csv> --mode validate
python3 scripts/task103_import_data.py --type psx_eod --file <csv> --mode import   # → STAGING only
```

The Task 103 importer validates columns, dates, numerics and the OHLC envelope (note: it strictly rejects bars where `low == min(open,close)` — see `task106_new_session_reconciliation.json` for the documented equality case), rejects duplicate rows and quarantines fixtures. Idempotent by SHA-256.

## 3. Check the data frontier

```
sqlite3 db/custom.db "SELECT MAX(date), COUNT(*) FROM OhlcvBar"
curl -s localhost:3000/api/data-readiness | jq .marketData
```

After any import, refresh the readiness fields (date_range/n_bars/n_symbols in `task103_market_data_audit.json`) as done in Task 106.

## 4. Promote to production

Reconcile staging counts vs the manifest → back up (`cp db/custom.db db/backups/custom_pre_<task>.db`) → insert with `(symbol, date)` dedup (`INSERT OR IGNORE`) → verify `MAX(date)`, per-date counts and zero duplicate pairs. Never edit historical bars.

## 5. Run the shadow pipeline

```
bun scripts/task105_phase8_levels.ts <new_frontier_date> data/backtest_reports/task106/_frontier_levels.json
python3 scripts/task106_phase5_6.py     # gen observations + maturation + gates (idempotent)
```

## 6. Mature observations

`scripts/task106_mature.ts` runs automatically inside phase 5/6. Rules: entry = first session AFTER the decision date; terminal SL/TP3 within available bars → matured (full net, `psx_user_schedule_v2`); TIME_UP only at 21 full sessions; otherwise pending MTM (never a win).

## 7. Review confidence reliability

Recompute `task105_calibration_diagnostics.json`-style diagnostics on forward outcomes once ≥100 matured trades exist; a score may be called a probability only with a valid calibration method AND separate evaluation evidence (`src/lib/latent/confidence-semantics.ts`).

## 8. Interpret NO-TRADE states

Every NO-TRADE carries a machine reason from the 10-reason registry (`trading-policy.ts`). Current default: `expected_net_value_not_positive`. `awaiting_data` = frontier recorded, outcomes need future sessions. Nothing is hidden — research surfaces stay browsable.

## 9. When can a model become eligible for production assessment?

Only after ALL nine gates in `task106_evidence_gate_report.json` are met on genuinely new forward observations (≥100 matured trades, ≥2 quarters, ≥15 symbols, >1 regime, positive net expectancy after actual costs with quantified uncertainty, stable drawdown, no leakage, calibration stability) — and even then, promotion is an explicit human, versioned policy decision.

## Blocked sources (unchanged)

KSE-100 index history (provider exposes constituents only; dps.psx.com.pk unreachable), corporate actions, filings with publication timestamps, point-in-time fundamentals, intraday bars, licensed vendors (no credentials configured).
