# GLM Export — Data Dictionary

Generated 2026-11-23T01:13:36.449Z by `scripts/export_glm_paper_performance.ts`.

## Sources
| Field group | Source (exact) |
| --- | --- |
| `signals.*` | `data/backtest_reports/task112/llm_signal_history/{signalId}.json` (verbatim fields) + derived status columns |
| `sources.database.*` | `db/custom.db` tables `PredictionHistory`, `PredictionOutcome`, `ProspectivePaperTrade`, `PaperTradeLeg`, `Trade` (read-only SQL) |
| `sources.forwardOutcomeTracker.*` | `data/backtest_reports/task112/task112_llm_pending_outcomes.json` |
| `sources.glmSignalStore.*` | `data/backtest_reports/task112/history_index.json` + directory listing |

## Field vocabulary (GLM decision records)
| Field | Meaning |
| --- | --- |
| `signalId` | `{SYMBOL}-{decisionTimestamp}-{evidenceHash8}`; primary key of the store; filename stem. |
| `recordType` | `REAL_LLM_DECISION` (real GLM decision) or `MOCK_PIPELINE_CHECK` (pipeline-validation artefact; never counted in metrics). |
| `provider` / `model` | `zai` / `glm-4.6` for real decisions; `mock` for pipeline checks. Attribution basis. |
| `decision` | Final gated label: `BUY` / `HOLD` / `NO_TRADE`. |
| `llmSignal` | Raw LLM output label before gating (`null` when the LLM call failed). |
| `llmState` | `ok` (LLM produced a parsed decision) or `llm_unavailable`. |
| `validationStatus` | `valid` or `rejected` (+ `rejectionReason`, e.g. `validation_error:stale_evidence`). |
| `decisionTimestamp` | ISO-8601 UTC moment the decision was persisted. Preserved verbatim. |
| `dataCutoff` | Evidence snapshot date the decision was based on (`2026-11-03` or `2025-01-03`). |
| `evidenceHash` | 8-hex content hash of the evidence snapshot; identifies duplicates/retries. |
| `evidenceQualityScore` | 0–100 platform score of evidence completeness. |
| `llmConvictionScore` | 0–100 LLM self-reported conviction. |
| `provenance` | `current_record` (surviving decision) / `generation_cache` (earlier generation of same window) / `mock_pipeline_check`. |
| `generationId`, `forwardCohortId` | Generation run identifier (`task111-llm-multisource-gen1`; mocks: `task111-mock-pipeline-check`). |
| `researchStatus` | `research_only` for every record: the cohort never trades. |
| `riskReward` | Planned what-if plan: entryReference, ATR14 stop, TP1-3, planned costs (`costsAtTp2`), netGainAtTP1/2/3, netLossAtStop, `noTrade` + reasons. **Scenarios, not outcomes.** |
| `capitalProtection` | Policy triggers (empty in current data). |
| `promptVersion`, `outputSchemaVersion`, `evidenceSchemaVersion` | Pipeline version pins. |

## Export file schemas

### glm_latest.csv (one row per store record — 71 rows)
All fields above plus derived: `entryPricePlanned`, `entryExecutionAssumption`,
`plannedHorizonSessions` (5,10,21 — forward-outcome horizons), `status`
(`research_only_pending`), `evidenceStatus` (`validationStatus/llmState`),
`plannedNetGainAtTp1/2/3`, `plannedNetLossAtStop`, `plannedRrToTp3`, `noTradeFlag`,
`noTradeReasons`. Realized fields (`entryTimestamp`, `exitTimestamp`, `exitPrice`,
`exitReason`, `grossPnl`, `transactionCosts`, `netPnl`, `netRoi`) are empty for every
row — no GLM trade was ever entered or exited; the exporter never invents values.

### glm_symbol_breakdown.csv (one row per symbol, REAL records only)
`symbol`, `realRecords`, `uniqueDecisions` (distinct dataCutoffs), `buy`/`hold`/`noTrade`,
`dataCutoffs`, `evidenceQualityMean`, `plannedRrTp3Mean`, `maturedOutcomes`/`wins`/`losses`
(all 0 — no matured outcomes exist).

### glm_monthly_breakdown.csv (one row per decision month)
`decisionMonth`, `totalRecords`, `realRecords`, `mockRecords`, `buy`/`hold`/`noTrade`
(real only), `dataCutoff2025_01_03`, `dataCutoff2026_11_03`, `maturedOutcomes`/`wins`/`losses` (0).

### glm_latest.json
Machine-readable superset: `sources`, `glmAttributionRule`, `cohort`, `counts`,
`statusCounts`, `performance` (each unavailable metric = `{value:null, calculable:false,
reason}`), `plannedScenarioEconomics`, `signals[]` (= CSV rows with nested detail),
`symbolBreakdown[]`, `monthlyBreakdown[]`, `extractedAt`, `reportingDate`.

## Null/empty conventions
- `""` in CSV / `null` in JSON = record does not exist (never zero, never fabricated).
- `calculable:false` + `reason` in `performance` = metric cannot exist from current data.
