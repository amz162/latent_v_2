# Task 102 — Point-in-Time Fundamentals Engine

## The problem

Accounting-period end dates are **not** publication dates. A quarterly statement for the period
ending 30 September is typically published weeks later; using it as a feature before its actual
announcement is look-ahead leakage. The AskAnalyst dataset (Task 90 ingest) carries statements
and ratios indexed by **year / quarter-period labels only, with no publication timestamps** —
so those records are **not point-in-time usable** and must never be treated as available at
period end.

## What exists that IS genuine

3,319 **PSX announcement records** for 24 symbols (AskAnalyst ingest of the PSX Data Portal),
each with a genuine announcement **date** (day granularity), description, company and DPS
document link. 24 of these are identifiable financial-result announcements (description regex
on quarterly/annual accounts language) — see `task102_fundamental_coverage.json`.

## The engine (`src/lib/fundamentals/point-in-time.ts`)

- **Schema**: `PitFundamentalRecord` with symbol, period start/end, `publicationDatetime`,
  publication source + document id, retrieval datetime, filing type, amendment fields,
  currency/unit, data-quality status, values, provenance.
- **Conservative availability rule**: when only a publication **date** is known (PSX
  announcements carry no time), the record becomes available at **17:00 PKT on that date** —
  i.e. it can influence decisions from the **next trading session** onward. Publication at
  market open is never assumed.
- **`getFundamentalsAsOf(symbol, cutoff)`**: returns only records whose publication instant is
  ≤ the cutoff; the latest available version wins; an amendment never leaks before its own
  amendment timestamp (the prior version is served until then); records with unknown
  publication timestamps are **never** returned or backfilled.
- **Version history**: amendments are retained as separate records; nothing is silently
  overwritten.

## Tests (`scripts/task102_pit_tests.ts` → `task102_pit_leakage_tests.json`, 12/12 pass)

Required leakage cases, all covered with synthetic fixtures:
1. statement announced **after** the decision date → excluded (even an amended one),
2. statement announced **before** the decision date → included,
3. **later amended** statement → prior version before the amendment date, amended after,
4. **missing publication timestamp** → unavailable, never guessed,
5. two filings with different publication times → latest available wins,
6. filing announced **after market close** → not available in that session's market hours;
   available the next session,
7. genuine-KSE-100 as-of discipline: while the index source is blocked, `getKse100AsOf`
   returns `null` — the internal proxy is never substituted,
8. exact day-boundary behavior of the as-of query.

## Feature consequences

`technical_pit_fundamental_v1` is **disabled** in the feature store. The Python build path
(`scripts/task102_pit_fundamentals.py`) produces the PIT records and coverage report; the
`getFundamentalsAsOf` production interface is ready and tested for the day genuine
publication timestamps exist (issuer/exchange announcement archive or a permitted vendor).

## Task 103 status (2026-11-02)

Task 103 rebuilt the PIT records (3,319) from the genuine Task 90 announcement ingest and added a timestamp audit (`task103_filing_timestamp_report.json`): 0 filings carry a real publication *datetime* (day-precision only) and 0 statement/ratio rows carry any publication timestamp. The conservative availability rule is unchanged: an announcement known only to day precision becomes available 17:00 PKT that date, i.e. usable from the NEXT session; unknown publication time stays unknown/unavailable. `technical_pit_fundamental_v1` remains disabled. The onboarding importer (`scripts/task103_import_data.py --type fundamentals`) honours a genuine `publication_datetime` column the moment a source provides one; leakage tests pass 12/12 in `data/backtest_reports/task103/task103_pit_leakage_report.json`.
