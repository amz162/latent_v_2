# Task 129 Final Report — Model M + Full Data Pipeline Repair + Automated Post-Market Scheduler

Date: 2026-11-23 (UTC) · Repository: `amz162/latent_v_2` · Runtime: Bun + Next.js 16 + Prisma/SQLite (`db/custom.db`)

## 1. Exactly how many of the claimed 52 models are actually trained?

The claim "52 trained models" is an artifact of the model registry:
`src/lib/latent/ensemble.ts` (`ALL_MODELS`) contains **58 canonical entries,
52 of which carry `trained: true`**. Reconciled against implementations,
artifacts and evaluation records:

| Category | Count |
|---|---|
| Registry entries | 58 |
| Flagged `trained:true` (the "52") | 52 |
| **Genuinely trained-ML entries** | **35** (31 unique after removing 4 duplicate "(CL)" aliases) |
| Deterministic rule engines mis-flagged as trained | 17 (GM 4-pillar, X 10-strategy, GIAN 3 S/R) |
| Foundation models requiring external weights | 4 (Chronos, Lag-Llama, Moirai, Time-LLM) |
| Untrained placeholders | 2 (TabNet — status conflict, FinGPT) |
| Runtime model keys (incl. 10 un-suffixed X duplicates) | 65 |
| Ensemble aggregators | 13 |
| **Models with verified positive out-of-sample skill** | **0** |

So: of the claimed 52, **35 are genuinely trained ML entries**; 17 are rule
engines; the remaining 6 registry entries were never trained at all.

## 2. Which models have verified training artifacts?

- **Serialized ML artifacts**: `models/xgboost_signal.json` (real XGBoost
  binary, trained_at 2026-10-02, 19 features, 2,696 rows, ROC AUC 0.402);
  15 task79 joblibs (ExtraTrees/HistGBM/ElasticNet/Huber/SVR × 3 horizons —
  beyond the registry); 3 task99 PyTorch reference checkpoints (LSTM/CNN-LSTM);
  CL-2/PI calibrators.
- **Per-stock parameter store**: `data/ml_predictions_multi.json` (trained_at
  2026-10-23) holds parameters/predictions for 65 model keys across ~908
  stocks — this is the training evidence for the 35 registry ML entries
  (34 of 35 present; `LSTM (CL)` alias absent, consistent with its duplicate
  status).
- Critical runtime fact: at request time **every** key is served by the
  deterministic indicator-strategy engine (`fallback-predictions.ts`, 12
  families) — trained weights are used offline, not for live inference.

## 3. Which models have verified out-of-sample performance?

- `task84_metrics.json`: 21 entries `trained_oos_evaluated`, 13
  `rule_based_optimized_oos_evaluated`, 4 alias-reused, 4 data-blocked,
  5 dependency-blocked, 2 failed-after-attempts, 9 status unknown in task84
  but present in the per-stock store (core TIER_3).
- Walk-forward (400 samples, 2023-04-17→2026-07-23): RF h5 dir-acc **0.595 CI
  [0.546, 0.642]** (only CI excluding 50%), CatBoost 0.580, XGBoost 0.568;
  **all R² < 0** at every horizon.
- task128 final ranking: **no classical model beats the zero-return
  baseline**; the RF "+99,800 PKR / PF 2.142" cell is declared EXPLORATORY
  post-hoc best-cell, not a research candidate. GLM-4.6 excluded (0 matured
  outcomes).

## 4. What operational issues were found?

Twelve documented with root causes (full detail in
`data_pipeline_audit.md` §3): prisma-client CI gap (F1), 21 missing schema
tables in the live DB (F2), no automatic lifecycle executor (F3), stale
absolute paths in supervisor/start/integrity scripts (F4), provider-side data
gaps ENGRO/SYS/BYCO re-verified live (F5), 887 symbols frozen at 2026-10-29
(F6), unvalidated ingest route with silent error swallowing (F7), lifecycle
running the legacy cost profile instead of the canonical V2 schedule (F8),
triple overlapping post-market schedulers (F9), no run ledger (F10), GitHub
Actions scheduler delays/drops (F11), and conflict/overwrite handling needing
quarantine semantics (F12).

## 5. Which issues were fixed?

All twelve: prisma generate verified in workflow (F1, production green run
still pending); **schema synced 15 → 36 tables** + RBAC seeded (F2); lifecycle
stage added to the CI runner + host pipeline wrapper (F3); three stale paths
fixed by script-relative resolution (F4); provider gaps recorded honestly as
`missing_symbols` (F5); **ABL live-repaired (+16 real provider bars through
2026-11-23)** and full-universe repair enabled (F6); ingest route hardened
with bar validation + error recording (F7); new books on
`psx_user_schedule_v2`, historical books preserved (F8); one authoritative
17:30 PKT cron entry + `SchedulerRun` idempotency ledger (F9, F10); retry
daemon + documented delay evidence (F11); revision quarantine (F12).

## 6. Which issues remain unresolved?

`known_issues.md` tracks them: K1 CI green run pending (GitHub dropped the
2026-11-23 window), K2 host crontab not installed in this sandbox, K3
in-process scheduler host firing unverified; K4 (full-universe backfill) is
now RESOLVED — 520 symbols updated with 9,964 real provider rows; provider
gaps for ENGRO/BYCO/SYS and ~406 delisted symbols are unfixable in-repo;
financial publication timestamps remain not-PIT-verified (disclosed on every
package); the 0-OOS-skill platform fact is a research reality, not an
operations defect.

## 7. Is the daily post-market scheduler implemented? YES.

`scripts/task129_eod_scheduler.py` (+ `config/eod_scheduler.json`,
`scripts/task129_eod_pipeline.sh`, `SchedulerRun` table, crontab template,
CI wiring) — implemented, unit-tested (39/39) and proven end-to-end against
the real provider and database (COMPLETED run with all 8 downstream stages).

## 8. What exact time does it run in PKT?

**17:30 PKT (Asia/Karachi, UTC+5) Mon–Fri** — configurable in
`config/eod_scheduler.json` without code changes. Cron expression: `30 12 * * 1-5` UTC.
CI fallback: 16:30 PKT (`30 11 * * 1-5` UTC). In-process fallback: 17:00–17:04 PKT (insert-only refresh).

## 9. What data provider does it use?

The existing approved provider only: `https://psxdata-api.fastapicloud.dev`
("psxdata"), via `task107_lib.fetch_history` with retry/backoff, Retry-After
honoring, single-flight dedup and provider-health tracking. No new source.

## 10. How many symbols were updated in the latest verified run?

The final full-universe run (`eod_pipeline:2026-11-23`, trigger e2e, 722 s):
**909 symbols attempted, 520 updated, 9,964 real provider rows inserted,
0 symbol failures, 1,163 candidate bars rejected by the canonical validator,
31 provider-missing recorded** — all 8 downstream stages rc=0, status
COMPLETED. Earlier the same day: single-symbol verification run (COLG, +16
rows, all stages rc=0) and recovery run (ABL, +16 rows). `universe: "all"` is
now the committed default config (full-universe daily updates per Phase 2.2).

## 11. What is the latest successful market-data date?

**2026-11-23** — global `OhlcvBar` frontier. After the full-universe run,
**492 of 909 symbols carry the 2026-11-23 session** (up from 22), 11 more are
within 3 days, and the remaining ~406 are provider-absent (delisted/renamed —
the provider has no newer bars for them; nothing was fabricated).

## 12. Were the prices actually saved and verified in the database?

YES — real provider rows verified in SQLite after the runs:
COLG 2026-11-23 = O 1229.00 / H 1229.00 / L 1200.03 / C 1210.69 / V 3,649
(source `psxdata`); ABL 2026-11-23 close 169.61, vol 364,999. Post-run
integrity: 0 duplicate (symbol,date) pairs, `PRAGMA quick_check` ok, run
ledger rows COMPLETED.

## 13. Does the complete downstream pipeline run automatically?

YES, in the required order, gated on successful persistence and integrity:
indicators → price patterns → company-results patterns (only when financials
changed) → maturity → paper-trading lifecycle → Model M evidence cache →
(optional host-only GLM) → monitoring (task112 report + task127 alerts +
task123 health). All stages returned rc=0 in the E2E run. A failed ingestion
or integrity check blocks dependent analysis (unit-tested).

## 14. Does Model M receive all available evidence correctly?

YES — evidence packages compose the Task 111 PIT-safe bundle (OHLCV, golden
cross, ATR risk levels, volatility, price patterns, quarterly financials,
company/national/international news, market context) PLUS Model M additions
(technical indicator section, monthly price patterns, PSX filings/announcements,
data-quality flags). Every package carries source timestamps, content-only
sha256, and honest unavailability (e.g. LUCK: "missing sources: company news";
ENGRO packages carry STALE flags). 25 packages persisted in the live DB with
files under `data/backtest_reports/task129/model_m_evidence/`.

## 15. Which evidence categories remain unavailable or partial?

- **PSX announcements**: present only for symbols with askanalyst filings
  snapshots; others reported UNAVAILABLE (never fabricated).
- **Company news**: missing for several symbols (disclosed per-symbol).
- **National / international news**: available via the cached market-news
  intelligence layer; per-fetch `retrievedAt` recorded.
- **Point-in-time financial publication timestamps**: NOT verified anywhere
  (`financial_publication_timestamps_not_pit_verified` flag on every package).
- **Intraday data**: unavailable by design (provider offers delayed snapshots
  only) — unchanged from Task 107.

## 16. What are the actual test results?

| Suite | Result |
|---|---|
| `scripts/task129_scheduler_tests.py` (MOCK-labelled unit, temp DB) | **39/39 PASS** |
| `scripts/task129_model_m_tests.ts` (fixtures + real-DB read-only) | **33/33 PASS** |
| `bunx tsc --noEmit` | **0 errors** |
| E2E-A recovery (real provider, ABL/ENGRO/SYS/BYCO) | COMPLETED; ABL +16 bars; SYS honestly missing |
| E2E-B full pipeline (real provider, COLG) | COMPLETED; 8/8 stages rc=0; 16 rows; frontier 2026-11-23 |
| E2E-C **full-universe run** (real provider, 909 symbols) | **COMPLETED; 520 symbols updated, 9,964 rows, 0 failures, 8/8 stages rc=0**; 492 symbols at frontier |
| Real GLM-4.6 Model M decisions | MEBL BUY (quality 85/100), LUCK BUY (82/100, missing news disclosed), ENGRO blocked (STALE) |
| Lifecycle regression | 39 books intact, no duplicates, historical costs preserved |
| Production build + live server smoke | see §17 |

## 17. Production build, live server and app verification

Executed after implementation (evidence: build log, HTTP probes):
- `bun run build` → **exit 0**, BUILD_ID `H7ouJKBufNrmUUJgz7eH6` (production bundle).
- Server started via the fixed `scripts/start_server.sh` (production runtime,
  port 3000; supervisor APP_DIR repair verified — it now runs the right tree).
- Open-access posture mirrored from production (`OPEN_ACCESS_MODE=true` +
  idempotent kiosk seed `scripts/task129_seed_kiosk.ts`, STANDARD plan).
- HTTP smoke (all **200**): `/`, `/api/health`, `/api/data-readiness`,
  `/api/stocks`, `/api/me`, `/api/model-m`, `/api/model-m/MEBL`,
  `/api/model-m/ENGRO`, `/api/model-report`, `/api/llm-signals`.
- `/api/me` → authenticated via kiosk identity, plan STANDARD,
  **`tab.model_m` granted** (RBAC seed + plan wiring verified end-to-end).
- `/api/model-m/MEBL` → status VERIFIED (latest 2026-11-23 = frontier),
  latest decision BUY, evidence package linked.
- `POST /api/model-m/ENGRO` → **409 blocked**: "fresh analysis refused: price
  data is 689 calendar day(s) behind the frontier" — the stale gate works
  over HTTP exactly as in the engine tests.
- `/api/model-m?limit=…` → 909 symbols with per-symbol freshness (STALE for
  the frozen universe honestly surfaced to the UI).

## 18. What is still not verified in production?

1. A **green CI run** of the daily workflow (with prisma generate + lifecycle
   stage) — no scheduled run has fired since the fixes; GitHub dropped the
   2026-11-23 window.
2. **Host cron installation** of the authoritative 17:30 PKT entry (template
   ready: `crontab scripts/crontab.txt`).
3. **In-process scheduler firing** on a restarted production host.
4. ~~Full-universe backfill across the 887 frozen symbols~~ **RESOLVED** —
   the full-universe run executed 2026-11-23: 520 symbols updated with 9,964
   real provider rows, 0 failures (known_issues.md K4 closed).
5. **First scheduled Model M cache + decision cycle on the host** (z-ai SDK
   credentials are host-side).

## 19. Changed files (summary)

- **Schema**: `prisma/schema.prisma` (+3 models: SchedulerRun,
  ModelMEvidencePackage, ModelMAnalysis; DB synced 15→36 tables).
- **Scheduler**: `scripts/task129_eod_scheduler.py`, `config/eod_scheduler.json`,
  `scripts/task129_eod_pipeline.sh`, `scripts/crontab.txt` (rewritten),
  `scripts/task129_warm_result_patterns.ts`, `scripts/task129_model_m_cache.ts`.
- **Model M**: `src/lib/latent/model-m/{engine,technical,patterns}.ts`,
  `src/app/api/model-m/route.ts`, `src/app/api/model-m/[symbol]/route.ts`,
  `src/components/latent/ModelMView.tsx`,
  + 6 wiring files (store, view-acl, AppSidebar, AppShell, i18n, RBAC seed).
- **Repairs**: `src/lib/latent/prospective-lifecycle.ts` (V2 cost transition),
  `src/app/api/cron/refresh-ohlcv/route.ts` (validation),
  `scripts/task107_runner.py` (lifecycle stage),
  `scripts/server_supervisor.sh`, `scripts/start_server.sh`,
  `scripts/task118_db_integrity.py` (stale paths).
- **Tests**: `scripts/task129_scheduler_tests.py`, `scripts/task129_model_m_tests.ts`,
  `scripts/task129_e2e_analysis.ts`, `scripts/task129_build_inventory.py`.
- **Reports**: `reports/model_m/` — model_inventory.{json,md},
  data_pipeline_audit.md, scheduler_architecture.md, scheduler_validation.md,
  model_m_validation.md, known_issues.md, final_report.md,
  scheduler/{scheduler_architecture.md, scheduler_validation.md,
  scheduler_status_latest.json}.

## 20. Commands to operate

```
# daily EOD (authoritative, host):   crontab scripts/crontab.txt
# manual run / recovery / backfill / status / dry-run:
python3 scripts/task129_eod_scheduler.py run [--force] [--dry-run] [--symbols ...]
python3 scripts/task129_eod_scheduler.py recover --symbols ABL,SYS --session 2026-11-23
python3 scripts/task129_eod_scheduler.py backfill --start 2026-10-30 --end 2026-11-23
python3 scripts/task129_eod_scheduler.py status
# tests:
python3 -I scripts/task129_scheduler_tests.py
DATABASE_URL=file:$PWD/db/custom.db bun scripts/task129_model_m_tests.ts
```

## 21. Final verdict

**Task 129: COMPLETED WITH DOCUMENTED LIMITS.** The model inventory is
reconciled (35 genuinely trained ML entries of the claimed 52; 0 with OOS
skill — honestly stated); the identified operational defects are fixed and
verified; the post-market scheduler is implemented, tested and proven
end-to-end on real data (frontier 2026-11-23); Model M produces reproducible,
evidence-backed, research-only GLM-4.6 decisions with honest disclosure of
missing/stale data; 72/72 automated tests pass; tsc clean; production build
and live server verified. What remains is deployment verification on a
production host (K1–K4), which is outside what this sandbox can claim.
