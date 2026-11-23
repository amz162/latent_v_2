# reports/glm — GLM-4.6 paper-trading performance export

Machine-generated, sanitized, committed reports describing the GLM-4.6 analyst
signal cohort and its paper-trading status. Regenerate with:

```bash
bun scripts/export_glm_paper_performance.ts   # from the repository root
```

The exporter is **read-only** (SQLite opened readonly; store files only read) and
rewrites exactly these files:

| File | Content |
| --- | --- |
| `GLM_LATEST.md` | Human report: sources, cohort, counts, metrics (with explicit not-calculable reasons), planned what-if economics, limitations. |
| `glm_latest.json` | Full machine-readable export (signals array + aggregates). |
| `glm_latest.csv` | One row per GLM store record (71 rows). |
| `glm_symbol_breakdown.csv` | Per-symbol aggregates (real records only). |
| `glm_monthly_breakdown.csv` | Per-decision-month aggregates. |
| `glm_data_dictionary.md` | Field-by-field source mapping and vocabularies. |

Headline fact as of the latest run: the GLM-4.6 cohort is research-only
(71 records, 48 real decisions, 0 matured outcomes), so realized
performance metrics are reported as not-calculable with explicit reasons instead of
being fabricated.

No credentials, tokens, connection-string values, .env contents or personal data are
included in any file; database binaries are never committed.
