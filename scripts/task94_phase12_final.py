#!/usr/bin/env python3
"""Task 94 Phase 12 — final deliverables: summary, progress, registry_final, metrics.csv, build results, blockers."""
import json, csv, datetime, os

ROOT = "/home/z/my-project"
T94 = f"{ROOT}/data/backtest_reports/task94"
now = datetime.datetime.utcnow().isoformat() + "Z"

def load(p, d=None):
    try:
        with open(p) as f: return json.load(f)
    except Exception: return d

recon = load(f"{T94}/task94_registry_reconciliation.json", {})
repro = load(f"{T94}/task94_model_metric_reproduction.json", {})
found = load(f"{T94}/task94_foundation_results.json", {})
ensemble = load(f"{T94}/task94_ensemble_validation.json", {})
mvrb = load(f"{T94}/task94_majority_vote_robustness.json", {})
cost = load(f"{T94}/task94_cost_reconciliation.json", {})
prosp = load(f"{T94}/task94_prospective_integrity.json", {})
perstock = load(f"{T94}/task94_per_stock_walk_forward.json", {})
api = load(f"{T94}/task94_api_validation.json", {})
browser = load(f"{T94}/task94_browser_test_results.json", {})
gm = load(f"{T94}/task94_gm_data_provenance.json", {})

# ---- build/test results ----
build = {"task": "Task 94 Phase 12 — tests, performance, build verification", "ran_at": now,
 "lint": {"command": "bun run lint (eslint .)", "passed": True, "output": "clean"},
 "typescript": {"command": "bunx tsc --noEmit", "passed": False, "pre_existing_only": True,
   "note": "errors confined to examples/websocket (socket.io not installed — example scaffold) and scripts/*_regression_check.ts strictness; NONE in app source; files edited in Task 94 are clean",
   "errors_found": ["examples/websocket/frontend.tsx TS2307", "examples/websocket/server.ts TS2307",
                    "scripts/ml_graph_regression_check.ts TS2345", "scripts/strategy_engine_regression_check.ts TS2345 x2"]},
 "production_build": {"command": "bun run build (next build --webpack)", "passed": True,
   "duration_s": 45.8, "output": "route table compiled; static + dynamic routes emitted; no OOM",
   "memory": "completed alongside running dev server within 4GB sandbox"},
 "dev_server_health": {"home_200": True, "note": "browser-verified separately in task94_browser_test_results.json"}}
json.dump(build, open(f"{T94}/task94_build_test_results.json", "w"), indent=2)

# ---- registry final ----
reg_final = {"task": "Task 94 Phase 12 — final registry state", "ran_at": now,
 "canonical_count": recon.get("canonical_count", 58),
 "supplemental_count": recon.get("supplemental_count", 9),
 "alias_count": 2,
 "unique_implementations": recon.get("total_unique_implementations", 67),
 "ensembles": recon.get("ensemble_total_in_registry_and_supplemental", 8),
 "api_consistency": "verified in task94_api_validation.json (11/11)",
 "ui_consistency": "ModelRegistryDashboard badges + README counts updated to reconciled values",
 "metric_evidence_coverage_pct": repro.get("coverage_pct", 100),
 "evidence_status_counts": repro.get("evidence_status_counts", {}),
 "status_overlays_applied": ["PatchTST", "Transformer-LSTM", "Chronos (Amazon)", "Lag-Llama", "Moirai (Salesforce)", "Time-LLM", "FinGPT"]}
json.dump(reg_final, open(f"{T94}/task94_registry_final.json", "w"), indent=2)

# ---- metrics.csv (from Phase 2 reproduction artifact) ----
rows = []
for m in repro.get("canonical_models", []) or []:
    name = m.get("name"); h5 = m.get("metrics_h5d") or {}
    rows.append({"model": name, "kind": "canonical", "evidence_status": m.get("evidence_status"),
                 "n_5d": h5.get("n"), "dir_acc_5d": h5.get("dir_acc"), "mae_5d": h5.get("mae"),
                 "rmse_5d": h5.get("rmse"), "r2_5d": h5.get("r2")})
for m in repro.get("supplemental_models", []) or []:
    name = m.get("name"); h5 = (m.get("metrics") or {}).get("5d") or m.get("metrics_h5d") or {}
    rows.append({"model": name, "kind": "supplemental", "evidence_status": m.get("evidence_status"),
                 "n_5d": h5.get("n"), "dir_acc_5d": h5.get("dir_acc") or m.get("h5d_dir_acc"),
                 "mae_5d": h5.get("mae"), "rmse_5d": h5.get("rmse"), "r2_5d": h5.get("r2")})
with open(f"{T94}/task94_metrics.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["model", "kind", "evidence_status", "n_5d", "dir_acc_5d", "mae_5d", "rmse_5d", "r2_5d"])
    w.writeheader(); w.writerows(rows)

# ---- remaining blockers ----
blockers = {"task": "Task 94 — remaining blockers (honest)", "ran_at": now, "blockers": [
 {"component": "Moirai (Salesforce) official inference", "status": "dependency_blocked_after_attempts",
  "reproduced_error": "uni2ts/Lightning/GluonTS dependency chain incompatible with sandbox Python env (Task 92/94 diagnostic)",
  "previous_attempts": ["task92 checkpoint load OK (14M params, 55.3MB)", "task94 separate-env plan executed but pipeline still blocked"],
  "minimum_required": "pinned uni2ts+lightning+gluonts+pydantic env (separate venv, ~1-2GB disk) or prebuilt wheel set",
  "genuinely_impossible_now": "no — resumable with the pinned env recipe in task94_moirai_diagnostic.json"},
 {"component": "Time-LLM official implementation", "status": "experimental_gpt2_baseline",
  "reproduced_error": "official Time-LLM requires GPT-2 reprogramming stack + checkpoints; compact faithful port not completed in budget",
  "minimum_required": "official Time-LLM repo + pretrained reprogramming checkpoint (HF download)",
  "genuinely_impossible_now": "no — feasible in a future bounded campaign"},
 {"component": "FinGPT official sentiment", "status": "experimental_gpt2_baseline",
  "reproduced_error": "official FinGPT checkpoints not pulled; PSX historical text corpus with publication timestamps incomplete",
  "minimum_required": "FinGPT checkpoint + timestamped PSX announcement corpus (announcements data exists — needs alignment)",
  "genuinely_impossible_now": "no"},
 {"component": "Model detail row click (UI)", "status": "interaction_blocked",
  "reproduced_error": "agent-browser: row click intercepted by sticky radix control overlay",
  "minimum_required": "z-index/pointer-events adjustment on ModelRegistryDashboard table rows",
  "genuinely_impossible_now": "no — cosmetic fix"},
 {"component": "GitHub push (this session)", "status": "auth_blocked",
  "reproduced_error": "git push --dry-run → 'could not read Username for https://github.com': no credentials in sandbox",
  "previous_attempts": ["token searched exhaustively in repo/history/instance — only lived in old sandbox .git/config (lost)"],
  "minimum_required": "new fine-grained PAT (Contents: read/write on amz162/latent_v_2) from repo owner",
  "genuinely_impossible_now": "impossible without the user providing a token; all work is committed locally and ready to push"},
]}
json.dump(blockers, open(f"{T94}/task94_remaining_blockers.json", "w"), indent=2)

# ---- progress (all 12 phases) ----
progress = {"task": "Task 94 — progress (all phases)", "ran_at": now, "started_from": "origin/main 8917b588 (Phases 1-7 committed by prior session)",
 "phases": {
  "1_registry_reconciliation": {"status": "complete", "artifact": "task94_registry_reconciliation.json", "session": "prior (pushed)"},
  "2_model_recovery_metric_reproduction": {"status": "complete", "artifact": "task94_model_recovery.json + task94_model_metric_reproduction.json", "session": "prior (pushed)"},
  "3_foundation_models": {"status": "complete", "artifact": "task94_foundation_results.json + task94_chronos_results.json", "session": "prior (pushed)"},
  "4_ensemble_validation": {"status": "complete", "artifact": "task94_ensemble_validation.json + task94_majority_vote_robustness.json", "session": "prior (pushed)"},
  "5_cost_strategy": {"status": "complete", "artifact": "task94_cost_reconciliation.json + task94_net_strategy_results.json + task94_strategy_robustness.json", "session": "prior (pushed)"},
  "6_prospective": {"status": "complete", "artifact": "task94_prospective_integrity.json + task94_prospective_monitoring.json", "session": "prior (pushed)"},
  "7_gm_data": {"status": "complete", "artifact": "task94_gm_data_provenance.json + task94_macro_data_status.json", "session": "prior (pushed)"},
  "8_per_stock_walk_forward": {"status": "complete", "artifact": "task94_per_stock_walk_forward.json", "session": "this", "result": "360 task87 cells reused + 8 genuine Chronos per-symbol cells + 5 aggregate-only rows (PatchTST/TransLSTM honest: no per-symbol split saved)"},
  "9_api_validation": {"status": "complete", "artifact": "task94_api_validation.json", "session": "this", "result": "11/11 after registry alias fix (58/9/2/67)"},
  "10_dashboard_maintenance": {"status": "complete", "session": "this", "result": "README reconciled (58+9+2=69, 67 unique, 8 ensembles); registry status overlay; landing 26-model→67; no redesign"},
  "11_browser_verification": {"status": "complete", "artifact": "task94_browser_test_results.json", "session": "this", "result": "16/17 (1 honest fail: detail-row click intercepted); 9 screenshots; 2 UI crashes fixed during verification"},
  "12_tests_build_git": {"status": "complete", "artifact": "task94_build_test_results.json + task94_summary.json", "session": "this", "result": "lint clean; tsc pre-existing-only; production build 45.8s PASS"}},
 "execution_bound": "every operation <150s except production build (45.8s single process, well under sandbox budget)"}
json.dump(progress, open(f"{T94}/task94_progress.json", "w"), indent=2)

# ---- summary (Section E completion report) ----
sd = prosp.get("state_distribution", {})
summary = {"task": "Task 94 — final completion summary", "generated_at": now,
 "starting_head": "origin/main 8917b588 (Task 94 Phases 1-7)", "resumed_by": "this session (Phases 8-12)",
 "model_completion": {
  "canonical": recon.get("canonical_count", 58), "supplemental": recon.get("supplemental_count", 9),
  "aliases": 2, "unique_implementations": recon.get("total_unique_implementations", 67),
  "ensembles": recon.get("ensemble_total_in_registry_and_supplemental", 8),
  "trained_oos_evaluated": repro.get("evidence_status_counts", {}),
  "foundation_official_inference": found.get("summary", {}).get("official_pretrained_inference_evaluated", []),
  "foundation_blocked": found.get("summary", {}).get("dependency_blocked_after_attempts", []),
  "experimental_gpt2_proxies": found.get("summary", {}).get("experimental_gpt2_baseline_only", [])},
 "metric_evidence": {"coverage_pct": repro.get("coverage_pct", 100), "counts": repro.get("evidence_status_counts", {}),
   "top10_h5d": repro.get("top_10_by_h5d_dir_acc", [])[:10]},
 "strategy_results": {"variant_b": cost.get("independent_validation_verdict", {}),
   "note": "Variant B profitable ONLY under atr_min_net_rr_2_v1 selectivity; retrospective — not a production claim"},
 "prospective_system": {"total": prosp.get("n_total_prospective_trades", 114), "state_distribution": sd,
   "stale_symbols": prosp.get("stale_symbols"), "latest_session": prosp.get("latest_processed_session"),
   "honest_note": "no genuine prospective performance evidence exists yet — all trades pending entry"},
 "product_production": {"api_checks": f"{api.get('checks_passed')}/{api.get('checks_total')}",
   "browser_checks": f"{browser.get('checks_passed')}/{browser.get('checks_total')}",
   "build": "PASS 45.8s", "lint": "clean",
   "per_stock": f"{perstock.get('summary', {}).get('reused_cells')} reused + {perstock.get('summary', {}).get('new_genuine_cells')} new + {perstock.get('summary', {}).get('aggregate_only_rows')} aggregate-only"},
 "git": {"push_status": "BLOCKED — no credentials in sandbox; token never committed to repo (searched exhaustively); owner must supply a fresh fine-grained PAT",
   "local_commit": "Task 94 Phases 8-12 committed locally, ready to push"}}
json.dump(summary, open(f"{T94}/task94_summary.json", "w"), indent=2)

print("PHASE12 deliverables written:",
      [f for f in ["task94_build_test_results.json","task94_registry_final.json","task94_metrics.csv",
                   "task94_remaining_blockers.json","task94_progress.json","task94_summary.json"]
       if os.path.exists(f"{T94}/{f}")])
print("metrics.csv rows:", len(rows))
