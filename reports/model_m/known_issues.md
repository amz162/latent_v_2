# Known Issues — Task 129

Honest register of everything that is broken, blocked, or unverified at task
completion. Items fixed during this task are NOT listed here (see
`data_pipeline_audit.md` §3 for the fixed list and §5 for remaining risks).

## 1. Production verification gaps (the task's own boundary)

| # | Issue | Evidence | Unblocks by |
|---|---|---|---|
| K1 | CI green run of `daily-psx-pipeline.yml` (incl. prisma generate + new lifecycle stage) still pending — no scheduled run fired since the fixes were pushed; the Mon 2026-11-23 11:30 UTC window was dropped by GitHub's scheduler | workflow run list: latest run #13 (2026-11-20, failure, pre-fix head); workflow state `active` | next scheduled/dispatch CI run, or manual `workflow_dispatch` |
| K2 | Host crontab not installed in this sandbox (template only) — the 17:30 PKT authoritative entry exists in code but is not installed anywhere here | `crontab -l` empty in sandbox | `crontab scripts/crontab.txt` on the production host |
| K3 | In-process scheduler (17:00 PKT) host firing never observed (no marker files); code path restored in b307e34e but unverified | Task 124 D7 | one production server restart + marker check |
| K4 | ~~Full-universe backfill (887 frozen symbols) supported but not executed~~ **RESOLVED 2026-11-23**: full-universe run executed — 909 symbols attempted, **520 updated, 9,964 real provider rows inserted**, 0 symbol failures, 1,163 candidate bars rejected by the canonical task107 validator (count in run ledger), 492 symbols at frontier 2026-11-23, integrity clean (0 dups, quick_check ok). The remaining 417 non-frontier symbols are provider-absent (delisted/renamed — probe of 786R, AAL, AASM, ABSON, ADOS, ADTM returns no newer bars; plus 31 explicit `missing_symbols` incl. AHCLXD/APLXD/ATRLXD ex-dividend markers). Nothing was fabricated for them. | run row `eod_pipeline:2026-11-23` (trigger e2e, 722 s) | closed |

## 2. Provider-side data gaps (cannot be fixed in-repo)

| Symbol | Provider newest bar (live probe 2026-11-23) | Status |
|---|---|---|
| ENGRO | 2025-01-03 | `provider_missing` — recorded, never fabricated; Model M blocks fresh analysis (STALE, 689 days) |
| BYCO | 2021-12-20 | `provider_missing` |
| SYS | no 2026 data at all | `provider_missing` |

The secondary provider (`api.askanalyst.com.pk`) remains broken for ENGRO
(348+ days) per Task 102/103 audits — unchanged.

## 3. Model platform facts (pre-existing, re-confirmed by the Phase 0 audit)

- 0 models with verified positive out-of-sample skill; all R² < 0; nothing
  promotable (task128). The "52 trained models" claim = registry flag, not
  evidence (see `model_inventory.md`).
- 4 foundation models (Chronos, Lag-Llama, Moirai, Time-LLM) remain
  dependency-blocked; FinGPT untrained; TabNet status conflict unresolved.
- GLM-4.6 has 0 matured outcome rows — its research cohort is still pending;
  Model M decisions are therefore research-only by construction.
- Quarterly financials have fetch timestamps but NO verified publication
  timestamps → `financial_publication_timestamps_not_pit_verified` disclosed
  on every Model M evidence package.

## 4. Design limitations of the new scheduler

- Holiday calendar is manual (`config/eod_scheduler.json`); undeclared
  holidays are detected by provider absence at the cost of retry cycles.
- Evidence dedup is by (symbol, dataCutoff): a same-day data CORRECTION
  re-uses the morning package rather than re-packaging (documented tradeoff;
  hash still verifies the persisted content byte-exactly).
- `ModelMEvidencePackage` reuse means the UI can show an older evidence hash
  for a same-cutoff later analysis — intentional (append-only analyses
  reference their own hash).
- Paper-trading V2 cost transition: only NEW books use
  `psx_user_schedule_v2`; the historical cohort remains on
  `legacy_standard_psx_v1` (deliberate, per the no-silent-rewrite rule).
- Task 130 harvest: askanalyst news/filings limited to the pilot25 universe
  (rate limits + payload size); 108 of 361 listed symbols have no provider
  financials (fetch fail or empty statement — skipped, never fabricated);
  investify.pk selectors can break on a site redesign (counts honestly zero);
  ratios/valuation endpoints not persisted (no tables).
- Zero-volume sessions: the canonical task107 bar validator rejects
  volume=0 bars, so legitimate no-trade sessions for illiquid symbols are
  not persisted by the scheduler (1,163 rejections in the 2026-11-23
  full-universe run). The scheduler defers to the platform's canonical
  validator on purpose; relaxing zero-volume handling is a platform-policy
  decision for a future task, applied consistently to BOTH ingest paths.

## 5. Pre-existing issues left untouched (out of Task 129 scope)

- `mock-signals.ts` / `mock-stocks.ts` demo data still used as fallback in the
  ai-model-signals route (clearly marked demo; untouched).
- `fair-value.ts` DCF `sharesOutstanding` placeholder (unchanged).
- GitHub credential rotation recommendation from task128 (operator action).
- `intraday-poll.yml` observed cadence (1/day) vs `*/5` configured — GitHub
  scheduler behaviour, same class as K1.
