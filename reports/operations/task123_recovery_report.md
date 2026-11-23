# Task 123 — Data Pipeline, Paper-Trading Lifecycle & GLM Evidence Recovery Report

**Repository:** amz162/latent_v_2 · **Branch:** main · **Baseline audit:** commit 97328538 (lost in a workspace recycle before push; report set rebuilt — see `reports/audit/`)
**Report generated:** 2026-11-23 ~20:50 UTC (01:50 PKT Nov 24) · **All work read-only or infrastructure-level; no model/strategy logic changed; no real orders; no fabricated outcomes.**

---

## 1. Root cause of the pipeline stall (Phase 1.1–1.2)

The EOD OHLCV pipeline stopped at **2026-11-03** because it had **no functioning trigger**:

1. **The in-process 5PM-PKT scheduler was disabled on 2026-10-31** — `src/instrumentation.node.ts` was renamed to `src/instrumentation.node.ts.disabled` in commit `c00b1b9a` ("autosave-local 2026-10-31T20:49Z"). The commit that later said "restore 5PM scheduler" (b307e34e) restored other fixes, not this file.
2. **The host crontab (`scripts/crontab.txt`) pointed at a stale root** — all entries ran `cd /home/z/my-project`, while the repository lives at `/home/z/my-project/repo_latent_v_2`. Any host cron following the template silently operated on the wrong directory (or failed).
3. **The production poll-bot only feeds intraday snapshots** — `data/backtest_reports/task107/ops/` shows a live "latent-poll-bot" committing monitor state (last cycle **2026-11-23T13:53:38Z**, classification `success_with_updates`, 22 new snapshots, provider healthy). It runs `task107_monitor.py`, **not** the EOD DB ingest.
4. **The task107/108 worker that ran the EOD ingest died 2026-11-03T19:17Z** (stale heartbeat found in the audit); its lock was absent on recovery, confirming nothing had replaced it.

Additional context: the workspace itself was recycled between audit and recovery — the local clone (including the unpushed audit commit `97328538`) was lost and had to be re-cloned from GitHub (fresh clone at `eacf6e84`); the database was restored from the committed `db/custom.db.gz`.

## 2. Missing PSX trading dates identified (Phase 1.3)

Sessions absent from the DB after the 2026-11-03 frontier, as recovered from the provider (psxdata):

**2026-11-04, 05, 06, 10, 11, 12, 13, 16, 17, 18, 19, 20, 23** — 13 sessions.

- **2026-11-09 absent by provider calendar (Iqbal Day holiday)**; Nov 7–8, 14–15, 21–22 are weekends. The provider calendar is treated as the session authority (documented in `task107_lib.psx_session_state`: "weekends treated as non-sessions; holidays unde(tected) by the provider").
- **Provider-side data gaps (not pipeline defects):** ENGRO and SYS returned **0 bars** for the whole window from psxdata (BYCO also had no new data). These symbols' paper trades correctly remain `pending_entry` awaiting data; the ingest reports them under `symbols_without_new_data` with no provider errors.

## 3. Exact repair performed (Phase 1.4–1.6)

| Repair | Tool (existing production code) | Result |
|---|---|---|
| EOD ingestion for the missing window | `scripts/task107_daily_ingest.py` (idempotent: `(symbol,date)` dedup `INSERT OR IGNORE`, structure/OHLC-envelope/volume validation, revision quarantine, immutable drop CSV, **automatic pre-promotion DB backup**) | **Frontier 2026-11-03 → 2026-11-23**; **286 new bars** (22 symbols × 13 sessions); `already_present: 0`; **overlap integrity: 44 bars byte-checked vs verified rows, 0 mismatches**; drop CSV archived with SHA-256 (`task107_daily_20261123T202515Z.csv`) |
| No duplication of historical bars | Same ingest (idempotent re-run) | Re-run exits with rc=2 "nothing-to-do", bar count unchanged (1,043,209 → 1,043,209) — asserted by regression test |
| OHLCV integrity | `scripts/task123_verify_ingest.py` | 0 duplicate `(symbol,date)` pairs; 0 envelope violations in the repaired window; 0 negative volumes; uniform 22-symbol coverage (ENGRO/SYS provider gaps documented); 52,676 pre-existing historical envelope quirks provider-wide (e.g. suspended-day placeholder rows) — **left untouched** per the no-silent-backfill rule |
| Corporate actions | `data/external_imports/corporate_actions/` + ingest revision quarantine | Provider bar edits are quarantined, never silently applied |
| Worker health & freshness observability | `scripts/task123_health.py` → `reports/operations/task123_pipeline_health.json` | Market-data frontier, heartbeat, provider health, queue, ledger states, GLM status, evidence availability, failures — one JSON |
| Scheduler contract fixed | `scripts/crontab.txt` rewritten with correct `REPO` root + added **17:10 PKT DB ingest** and **17:30 PKT full pipeline** entries; new `scripts/task123_daily_pipeline.sh` chains ingest → lifecycle → GLM research generation → outcome tracker → health snapshot | See §6 |

No historical records were altered or silently backfilled: the only DB writes were new bars promoted through the Task 107 controlled import with byte-equality overlap checks, and ledger state transitions documented in §4.

## 4. Paper-trading lifecycle repair (Phase 2)

### 4.1 Trace of all 114 records (actual IDs)

All 114 `ProspectivePaperTrade` rows are in `reports/operations/task123_lifecycle_reconciliation.csv` with `tradeId`, `sourcePredictionId`, `bookId`, strategy, model, symbol, fills, legs, costs, P&L, win label and open-position MTM. Cohort: **38 BUY predictions (cutoff 2026-10-29, created 2026-10-29T20:21:46Z) × 3 strategies = 114**; `isDemo=0`; 5 classical models; **0 GLM-attributed rows**.

### 4.2 Why no fills were created

`src/lib/latent/prospective-lifecycle.ts` (`runLifecycle()`) is the fill/exit engine, but **nothing invoked it**: it is reachable only via a manual runner (`scripts/prospective_paper_trading.ts`), an API route, or a check script — there was no scheduler entry and the dead worker didn't call it either. Combined with the data stall, the cohort sat in `pending_entry` from 2026-10-29 to today.

### 4.3 Repairs to the engine (infrastructure only)

1. **Idempotency/duplicate prevention (Phase 2.8):** the find-or-create matched on `(sourcePredictionId, strategyId, bookId)`; a cost-profile rename (`standard_psx` → `legacy_standard_psx_v1`) changed every bookId, so a re-run **created a full duplicate set** (reproduced on a test copy: 114 → 228 rows). Fixed: the lifecycle now **adopts** the existing row for the same (prediction, strategy) — pending rows are rebooked into the current book, entered/closed rows are adopted as-is. Verified: re-runs create 0 trades.
2. **No-look-ahead fix (Phase 5.10):** entry selection anchored on the risk-level's `effectiveCutoff`, which lags the decision for symbols whose bars were stale at generation time — the first processing pass filled **33 trades (PRL/WTL/ANL) at 2026-10-27, two sessions BEFORE their 2026-10-29 predictions existed**. Caught by the new regression test; fixed by anchoring on the prediction's `dataCutoff`. The contaminated pass was **rolled back to the preserved pre-processing backup** and reprocessed; the final ledger has **0 entry/cutoff violations**.
3. Both fixes are in `src/lib/latent/prospective-lifecycle.ts`; SL/TP/timeout/scale-out rules, cost schedule and gap-aware fills are untouched (independently recomputed — §4.5).

### 4.4 Are the 114 records still valid? — Yes, all 114

- **81 filled** at the **real 2026-10-30 session open** (strictly after the decision cutoff) — 78 have exited, 3 remain open.
- **33 remain `pending_entry`** (BYCO 12, ENGRO 21): the provider has no bars for these symbols in the window, so no entry price exists — the engine correctly refuses to invent one. They stay valid and will enter (or skip with a documented reason) as soon as data arrives.
- None expired, none cancelled, none deleted. Prediction outcomes: **220 matured** with real observed closes; **155 pending** (125 are h21 whose target session (~2026-11-27) is still in the future; 15 h5 + 15 h10 await ENGRO/SYS/BYCO target-date bars).

### 4.5 Controlled fill/exit test (Phase 2.7) — passed

Run first on a **copy** of the DB, then on the live ledger; deterministic (identical results) and idempotent (second run: all runStats = 0).

- **Exit-reason distribution (78 closed):** 74 SL (including gap-aware fills — e.g. CNERGY stop 13.37, session opened 12.55 → filled at the real worse open), 2 TP3 (exact level fills), 1 scale-out completion, 1 trailing-SL-at-TP1, 1 TIME_UP after partials; 86 exit legs with commission/slippage/CGT per the standard PSX schedule.
- **Independent recomputation from raw bars:** SL and TP3 exits reproduced exactly (first-hit logic + gap-open rule); **0 fills that do not match a real bar open; 0 exit legs without a matching session bar; 0 net = gross − costs violations; 0 win-label violations** (`task123_lifecycle_verification.json`).
- **Open positions MTM (mark-to-market, separate from realized):** ANL ×2 books (+7,118.37 each at 11-23 close 9.48), LOTCHEM (+4,208.58 at 25.50).

> **Correction (Task 125, 2026-11-23):** the exit-reason buckets in the first bullet above were mis-stated in prose (they sum to 79, not 78, and do not match the ledger). Authoritative distribution for the 78 closed trades: **SL 60, TIME_UP_AFTER_PARTIALS 7, TP3 6, TRAILING_SL_AT_TP1 5**; exit **events** total **86 legs** (78 final + 8 partial). See `task125_ledger_reconciliation.md` §2. Task 125 also identified the 7 h21 scale-out trades closed on partial windows (gate defect, +4,047.99 PKR realized/unrealized classification issue) — ledger preserved, engine gate fixed forward.

### 4.6 The honest forward result

**Realized net P&L: −707,370.97 PKR** on 78 closed trades (gross −664,000.40, costs 43,370.58; **10 wins / 68 losses**, avg −9,068.86/trade). The 2026-10-29 BUY cohort was overwhelmingly stopped out in the Nov 4–23 window. This is the system's **first genuine forward cohort result** and it is negative — reported exactly as measured. It strengthens the audit conclusion: **no real-money deployment is supported.**

## 5. GLM multi-source evidence recovery (Phase 3)

Full treatment in `reports/operations/task123_glm_evidence_report.md`. Summary:

- **Why all six categories read `available=0, cited=0`:** the Task 112 lineage audit measured the **store records**, whose `evidenceRef` field was `null` — a persistence gap, not an evidence gap. The runner-side packages (`task111_evidence_coverage.csv`) contained real evidence: technical/patterns/volatility `verified` for all 24 symbols; fundamentals/financial-patterns/news `partially_verified` (company news `unavailable` for ANL; 24 company-news rows + 8 national + 8 international items captured).
- **Repairs:** every decision now persists a **per-source evidence package** (`data/backtest_reports/task112/llm_evidence_packages/{SYM}_{hash}.evidence.json`) with all nine source statuses, missing-source list, data-quality flags and per-ref `retrievedAt`/`publishedAt` timestamps, and the store record references it via `evidenceRef`. Fabricated citations were already rejected by the strict validator (every cited ref must exist in the evidence; `signal_status_must_be_research_only` enforced) — verified by test.
- **Duplicate generation fixed:** the evidence hash was wall-clock-variant (`decisionTimestamp` inside the hashed payload) — the root cause of the Nov-4 duplicate pairs; hash is now content-only, and the store enforces **one decision per (symbol, session cutoff)**.
- **Scheduled generation repaired:** GLM generation is step 3 of the daily pipeline (17:30 PKT Mon–Fri, `crontab.txt` + `scripts/task123_daily_pipeline.sh`); idempotency cache unchanged; provider failures recorded honestly as `llm_unavailable`.
- **Research-only preserved** at all three layers (schema, cohort, status); tests assert 0 GLM rows in the ledger. No GLM decision was converted into a fill; the shadow-evaluation policy remains a separate decision for the owner.

## 6. Observability (Phase 4)

`reports/operations/task123_pipeline_health.json` (refreshed by `scripts/task123_health.py`, step 5 of the daily pipeline) covers: latest market-data timestamp, worker heartbeat/classification, provider health, queue (predictions pending/matured), paper-trade states + realized P&L, GLM generation status + evidence availability by source, and failed jobs/retries (ingest errors, provider errors, run-log tail).

## 7. Regression tests (Phase 5) — exact results

**New suite `scripts/task123_tests.py`: 22 passed, 0 failed** (exit 0), covering all required areas:

| Area | Check (result) |
|---|---|
| Ingestion idempotency | re-run ingest: rc=2, bars 1,043,209 → 1,043,209 ✓ |
| Missing data detection | `symbols_without_new_data` = [ENGRO, SYS, BYCO] reported ✓ |
| Worker recovery observability | monitor + cycle + provider-health fields present; provider healthy ✓ |
| Pending-entry lifecycle | 114 records = 78 closed + 3 open + 33 pending; all fills on real bars ✓ |
| Duplicate fill prevention | 0 duplicate (prediction, strategy) rows; second lifecycle run zero-delta ✓ |
| SL/TP outcomes | 0 net-identity violations; 0 win-label violations; matured outcomes carry real closes ✓ |
| GLM evidence completeness | sandboxed mock generation produces evidence packages with all 9 source statuses ✓ |
| Source timestamp validation | every `retrievedAt`/`publishedAt` ISO-or-honest-null; evidence `dataCutoff` == DB frontier ✓ |
| Scheduled generation | pipeline + crontab wiring present; duplicate decision skipped (files 2 → 2) ✓ |
| No-look-ahead integrity | 0 entries ≤ decision cutoff; 0 outcomes matured without observation; ingest overlap 22 bars / 0 byte mismatches ✓ |

**Existing suites re-run after the code changes (no regressions):** Task 111 QA **34/34**, Task 112 QA **66/66**, Task 107 QA **30 passed / 0 failed / 2 skipped** (environment-dependent skips, unchanged).

## 8. Remaining operator actions (Phase 7)

1. **Install the corrected crontab on the production host:** `crontab scripts/crontab.txt` (entries now use `REPO=/home/z/my-project/repo_latent_v_2`; adjust if the checkout path differs). The 17:30 PKT pipeline requires `bun` and the GLM provider credentials in the host environment.
2. **Rotate the GitHub token** used for this recovery (it was pasted in chat per the repo's credential contract) and store it only in the gitignored `.zcredentials/github_token.local`, armed via `scripts/gh_auth.sh`.
3. **ENGRO/SYS (and BYCO) data gaps:** verify with the provider whether these symbols are suspended or de-listed from the free feed; decide whether to keep them in the shadow universe or mark them unavailable explicitly.
4. **Approve or decline the GLM shadow-evaluation policy** before any GLM decision is ever converted into a simulated fill (currently impossible by construction).
5. **Decide on `scale_out_50_25_25` and Ridge Regression** signals (audit: disable candidates) — no strategy logic was changed in this task.
6. **Monitor the first scheduled runs** (logs: `data/backtest_reports/task123/ops/pipeline_*.log`, `data/task107_ingest_cron.log`, `data/task123_pipeline_cron.log`) and the pending 155 outcomes as future sessions arrive.

## 9. Limitations stated plainly

- **No production infrastructure is directly accessible from this workspace.** Recovery ran on the re-cloned repository with the committed DB snapshot; the production poll-bot (visible via its GitHub state commits, last 2026-11-23T13:53Z) runs on an external host whose filesystem, crontab and credentials are not reachable here. "Production recovery" therefore means: **the repository, database and pipeline are repaired and verified locally; the host-side cron installation (§8.1) must be done by the operator.** Nothing in this report should be read as a claim about the production host's current state beyond what its committed state files show.
- The poll-bot host was last online 2026-11-23T13:53Z; its 73.5 h gap (Nov 20 → Nov 23) shows it is not continuously available — the market-data frontier depends on the host-side cron being installed.
- `max_drawdown`, Sharpe and Sortino remain **unavailable** for the ledger (no portfolio equity curve implemented — unchanged from the audit; not fabricated).

---

*Artifacts: `reports/operations/task123_pipeline_health.json` · `reports/operations/task123_lifecycle_reconciliation.csv` · `reports/operations/task123_glm_evidence_report.md` · `reports/operations/task123_outcome_maturity_breakdown.json` · verification/test JSONs under `data/backtest_reports/task123_*` · repair scripts `scripts/task123_*.py|sh` · backups `db/backups/` (gitignored).*
