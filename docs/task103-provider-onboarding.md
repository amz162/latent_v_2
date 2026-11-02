# Task 103 — Provider Onboarding Guide

How to supply external PSX data to Latent.pk **without editing application code**.

## 1. The one-minute version

```bash
# 1. drop your file (CSV) into the matching folder
data/external_imports/kse100/my_official_export.csv

# 2. dry-run (always first — nothing is written)
python scripts/task103_import_data.py --type kse100 --file data/external_imports/kse100/my_official_export.csv --dry-run

# 3. strict validation
python scripts/task103_import_data.py --type kse100 --file ... --validate

# 4. import into the STAGING database (never production)
python scripts/task103_import_data.py --type kse100 --file ... --import
```

Every import writes an immutable manifest to `data/backtest_reports/task103/import_manifests/<import_id>.json` recording filename, SHA-256, source, provider, retrieval date, date coverage, record counts, validation result and import result. Re-importing the same file is a no-op (`already_imported`).

## 2. Import types and required columns

| Type | Required | Optional | Notes |
| --- | --- | --- | --- |
| `psx_eod` | symbol, date, open, high, low, close, volume | turnover, provider, source_id, retrieved_at | Raw UNADJUSTED prices; declare `provider_adjusted=true` if the vendor adjusted them |
| `kse100` | date, close | open, high, low, volume, turnover, provider, source_id, retrieved_at | Genuine index values only — never a pilot-stock average or proxy |
| `fundamentals` | symbol, period_end, metric, value | period_start, statement_type, publication_datetime, announcement_date, source, filing_id, version, amendment_of, currency, unit, source_checksum, retrieved_at | Supply `publication_datetime` only if the source truly publishes it; otherwise the record stays `unknown` and is PIT-unusable |
| `filings` | symbol, date, description | category, pdf_url, source, retrieved_at | `date` = genuine exchange announcement date |
| `corporate_actions` | symbol, event_type, ex_date | announcement_date(time), record_date, payment_date, ratio, amount_per_share, source, filing_id, retrieved_at | `event_type` ∈ {split, bonus, rights, cash_dividend, other}; unverifiable events stay `unverified_suspect` |
| `intraday` | symbol, date, bar_start, bar_end, open, high, low, close, volume | turnover, interval, provider, source_id, quality | `interval` ∈ {1min, 5min, 15min, 30min, 60min} |

Templates and per-type data dictionaries: `data/external_imports/<type>/template.csv` + `data_dictionary.json`.

## 3. Validation rules (enforced, fail visibly)

- Required columns present; dates `YYYY-MM-DD`; timestamps ISO-like; numerics parse and are non-negative.
- OHLC envelope: `high ≥ low`, `high ≥ max(open, close)`, `low ≤ min(open, close)`.
- In-file duplicates rejected (counted, never silently dropped); rows already in staging are deduplicated.
- Rows with `quality=synthetic_fixture` are **quarantined** — they can never enter production data.
- A file where every row is rejected fails the import; nothing partial is committed.

## 4. Staging → production promotion

Imports land in `data/backtest_reports/task103/external_imports_staging.db` (`imported_rows`, `imports`, `fixture_quarantine`). Promotion into `db/custom.db` is a deliberate operator step: reconcile staging counts against the manifest, back up `db/custom.db` (`bash db/restore-db.sh` conventions), then insert with the documented `(symbol, date)` dedup keys. Licensed/sourced data must **not** be committed to the public repository.

## 5. Where each source type comes from (verified 2026-11-02)

- **Official PSX EOD / KSE-100** — the PSX Data Portal (`dps.psx.com.pk/historical`) advertises historical EOD and KSE-100 downloads, but the host is unreachable from the Task 103 sandbox (HTTP 000; same in Task 102). Download from an unrestricted host, then import with `--type psx_eod` / `--type kse100`.
- **Licensed vendors** (Refinitiv/LSEG, Bloomberg, TradingEconomics paid tier) — export CSVs and import; keep redistribution restrictions in mind.
- **Fundamentals with publication timestamps** — issuer/exchange announcement archives that publish filing datetimes; map each statement to its filing ID via the `fundamentals` schema.

Full provider table: `data/backtest_reports/task103/data_source_registry.json`; honest availability matrix: `data_access_matrix.csv`.
