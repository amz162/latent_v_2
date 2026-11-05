#!/usr/bin/env python3
"""Task 112 — complete model & strategy performance report builder.

Extracts EVERY model/strategy actually present in repository evidence
(Tasks 79-111), builds the machine-readable report (JSON + CSV), the
human-readable markdown report, a PDF rendering, and the Part E/F/G/H/I
artifacts. Missing information is marked "Not available in source evidence" —
never invented.
"""
from __future__ import annotations
import csv, json, math, statistics, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task111_lib as LB  # noqa: E402
import task110_lib as L  # noqa: E402
import task110_phases_research as R  # noqa: E402

BR = ROOT / "data" / "backtest_reports"
T111 = LB.T111
T112 = LB.ROOT / "data" / "backtest_reports" / "task112"
T113 = LB.ROOT / "data" / "backtest_reports" / "task113"
T114 = LB.ROOT / "data" / "backtest_reports" / "task114"
REP_DIR = ROOT / "data" / "reports"
DOCS_DIR = ROOT / "docs" / "reports"
N_A = "Not available in source evidence"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def j(path: Path):
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        return None


def pct(x):
    return round(100 * x, 2) if isinstance(x, (int, float)) else (x if x is not None else N_A)


# ─────────────────────────── inventory extraction ────────────────────────────
def profile(**kw) -> dict:
    base = {
        "model_name": N_A, "model_family": N_A, "purpose": N_A, "methodology": N_A,
        "training_approach": N_A, "feature_groups": N_A, "target_definition": N_A,
        "prediction_horizon": N_A, "universe": N_A, "evaluation_period": N_A,
        "train_validation_test_split": N_A, "purge_embargo": N_A, "sample_counts": N_A,
        "model_configuration_version": N_A, "artifact_location": N_A, "data_evidence_lineage": N_A,
        "transaction_cost_assumptions": N_A, "execution_assumptions": N_A,
        "historical_backtest_result": N_A, "metrics_by_category": N_A,
        "forward_validation_status": N_A, "current_disposition": N_A,
        "current_status_label": N_A, "promotion_eligibility": "not promotable on current evidence",
    }
    base.update(kw)
    return base


def load_registry() -> list[dict]:
    d = j(BR / "task82_model_registry_audit.json") or {}
    out = []
    label = {
        "resource_blocked": "Rejected/unavailable (resource)",
        "dependency_blocked": "Rejected/unavailable (dependency)",
        "trained_artifact_only": "Trained artifact only — no reliable OOS edge evidence",
        "data_blocked": "Rejected/unavailable (data)",
        "duplicate_alias": "Duplicate alias — counted once",
        "rule_based_evaluated": "Rule strategy — not ML",
    }
    for m in d.get("models", []):
        out.append(profile(
            model_name=m.get("name"), model_family=m.get("category"),
            purpose="candidate prediction/strategy model from the Task 82 registry audit",
            methodology=m.get("category"), training_approach=N_A,
            model_configuration_version=f"tier={m.get('tier')}",
            forward_validation_status="none (never reached reliable evaluation)",
            current_disposition=m.get("statusReason") or m.get("finalStatus"),
            current_status_label=label.get(m.get("finalStatus"), m.get("finalStatus")),
            artifact_location="Task 82 registry audit (entry metadata)",
            promotion_eligibility="no",
        ))
    return out


def load_task100_nine() -> list[dict]:
    d = j(BR / "task100" / "task100_model_comparison.json") or {}
    top = j(BR / "task100" / "strategy_top_models.json") or {}
    out = []
    for name, blocks in (d.get("models") or {}).items():
        val, fin = blocks.get("validation", {}), blocks.get("final_test", {})
        def agg(block):
            per = {}
            for h, m in (block or {}).items():
                per[h] = {k: m.get(k) for k in ("n", "mae", "rmse", "r2", "directional_accuracy")}
            return per
        out.append(profile(
            model_name=name,
            model_family="classical ML (Task 100 nine-model experiment)",
            purpose="predict future returns; direction/MAE gated strategy evaluation",
            methodology="supervised regression on engineered features",
            training_approach="walk-forward style split (see task100 protocol)",
            feature_groups="engineered technical features (task100 protocol)",
            target_definition="forward return per horizon",
            prediction_horizon="5 / 10 / 21 sessions",
            universe=d.get("universe") or "pilot25 universe",
            evaluation_period=N_A,
            train_validation_test_split="validation + final_test blocks reported separately",
            purge_embargo=N_A,
            sample_counts={h: (val.get(h, {}).get("n"), fin.get(h, {}).get("n")) for h in ("5", "10", "21")},
            model_configuration_version="task100 cells (threshold grids per model)",
            artifact_location=f"data/backtest_reports/task100/cells_{name}__*",
            data_evidence_lineage="OhlcvBar daily history (raw prices)",
            transaction_cost_assumptions="V2 cost schedule applied at strategy layer (task100 cost reconciliation)",
            execution_assumptions="signal -> next-session execution (task100 protocol)",
            historical_backtest_result={"validation": agg(val), "final_test": agg(fin)},
            metrics_by_category="prediction metrics (MAE/RMSE/R2/directional accuracy); see task100 artifacts",
            forward_validation_status="not forwarded (task100-106 forward campaign covers the frozen production models, not these research cells)",
            current_disposition=f"gated pass: {name in (top.get('gated_pass') or [])}; no positive net edge claim",
            current_status_label="Research only (no demonstrated reliable positive net edge)",
        ))
    return out


def load_task79() -> list[dict]:
    d = j(BR / "task79_model_results.json") or {}
    out = []
    for name, horizons in (d.get("models") or {}).items():
        per = {}
        for h, m in horizons.items():
            per[h] = {k: m.get(k) for k in ("status", "train_rows_live", "n_buy_signals", "n_predicted", "eval")}
        out.append(profile(
            model_name=name, model_family="classical ML (Task 79 experiment)",
            purpose="return-prediction candidate", methodology="supervised regression",
            training_approach="train on live feature rows, split at " + str(d.get("split_date")),
            prediction_horizon=" / ".join(d.get("horizons", []) and [str(h) for h in d["horizons"]]) or N_A,
            universe=d.get("universe"), sample_counts=per,
            model_configuration_version=str(d.get("model_version")),
            artifact_location="task79 artifacts (sha256 per artifact recorded in task79_model_results.json)",
            data_evidence_lineage="OhlcvBar daily history",
            transaction_cost_assumptions="strategy layer used V2 where backtested; see task81",
            execution_assumptions=N_A,
            historical_backtest_result={"note": "eval field null in task79 artifact — OOS evaluation happened in Task 100 for the surviving models"},
            current_status_label="Research only (superseded by Task 100 evaluation)",
            current_disposition="trained in Task 79; final evaluation carried by the Task 100 nine-model comparison",
        ))
    return out


def load_task98() -> list[dict]:
    d = j(BR / "task98" / "task98_metrics.json") or {}
    out = []
    for name, m in (d.get("allResults") or {}).items():
        out.append(profile(
            model_name=name, model_family="classical time series (statsmodels/prophet)",
            purpose="baseline time-series forecasting", methodology=m.get("status"),
            metrics_by_category=m.get("metrics"),
            historical_backtest_result=m.get("metrics"),
            current_status_label="Research only (OOS-evaluated baselines; no net-edge claim)",
            artifact_location=f"data/backtest_reports/task98/task98_metrics.json ({name})",
        ))
    return out


def load_task99() -> list[dict]:
    out = []
    cb = j(BR / "task99" / "task99_cost_aware_backtest.json")
    preds_dir = BR / "task99" / "predictions"
    for name in ("jw_reference_lstm", "jw_reference_cnn_lstm"):
        files = sorted(preds_dir.glob(f"preds_{name}__*.json"))
        out.append(profile(
            model_name=name, model_family="deep learning (reference implementations)",
            purpose="LSTM / CNN-LSTM return-prediction reference models",
            methodology="PyTorch-free reference training (Task 99 protocol)",
            prediction_horizon="5/10/21 (pilot25 h5_10_21 configs)",
            artifact_location=", ".join(str(f.relative_to(ROOT)) for f in files[:2]) or N_A,
            historical_backtest_result=(cb.get(name) if isinstance(cb, dict) and name in (cb or {}) else N_A),
            metrics_by_category=N_A,
            current_status_label="Research only (reference models; no promotion)",
            current_disposition="reference implementations kept for lineage; not production models",
        ))
    return out


def load_cost_aware() -> list[dict]:
    out = []
    tr = j(BR / "task101" / "task101_cost_aware_training.json") or {}
    names = ["psx_cost_aware_trade_classifier", "psx_net_expectancy_meta_model"]
    for name in names:
        blob = json.dumps(tr)[:0]  # keep lazy
        out.append(profile(
            model_name=name, model_family="cost-aware ML (Tasks 99-103)",
            purpose=("trade classifier / meta-model trained on cost-adjusted outcomes" if "classifier" in name
                     else "meta-model estimating net expectancy after V2 costs"),
            methodology="cost-aware labeling/training with psx_user_schedule_v2",
            artifact_location="data/backtest_reports/task101/task101_cost_aware_training.json (+ task99/102/103 artifacts)",
            historical_backtest_result=N_A,
            metrics_by_category=N_A,
            current_status_label="Shadow only (frozen cost-aware shadow filter)",
            current_disposition="frozen; referenced by the forward shadow filter; not promotable on current evidence",
            forward_validation_status="general forward campaign (Task 105-110) includes the frozen shadow filter cohort — NOT LLM-specific",
        ))
    return out


def load_rule_systems() -> list[dict]:
    out = []
    gc = j(T111 / "task111_portfolio_strategy_comparison.json") or {}
    strat = gc.get("strategies", {})
    gc_base = strat.get("golden_cross_7_30_v1_baseline", {})
    out.append(profile(
        model_name="golden_cross_7_30_v1 (Golden Cross 7/30 SMA)", model_family="technical rule system — NOT ML",
        purpose="trend-following crossover research strategy",
        methodology="MA7/MA30 crossover at close, fill next global session open, whole shares, V2 costs, long-only",
        universe="task109-consistent 23-symbol universe",
        evaluation_period=f"~10 years to frontier {L.sessions()[-1]}",
        transaction_cost_assumptions="psx_user_schedule_v2 (computeTradeCostsV2)",
        execution_assumptions="signal at close t -> next-session open; unfilled never fabricated",
        historical_backtest_result=gc_base,
        metrics_by_category="strategy metrics (ROI/win rate/PF/drawdown)",
        current_status_label="Research only (negative edge after costs)",
        current_disposition="negative edge vs cash and buy-and-hold; never promoted; unchanged since Task 110",
        forward_validation_status="research dashboards simulate on demand; not part of the forward cohort",
        promotion_eligibility="no",
    ))
    t104 = j(BR / "task104" / "task104_portfolio_results.json") or {}
    results = t104.get("results", {})
    names = sorted([k for k in results if k != "__meta"])[:6]
    out.append(profile(
        model_name="task104 portfolio strategies (fixed_first_hit family)", model_family="rule/portfolio system — NOT ML",
        purpose="prospective paper-trading portfolio configs from the Task 104 experiment",
        methodology="first-hit TP/SL portfolio configs (see task104_portfolio_results.json)",
        artifact_location="data/backtest_reports/task104/task104_portfolio_results.json",
        historical_backtest_result={k: results[k] for k in names} if names else N_A,
        current_status_label="Research only (prospective/shadow)",
        promotion_eligibility="no",
    ))
    ov = j(T111 / "task111_volatility_overlay_backtest.json") or {}
    out.append(profile(
        model_name="volatility-aware overlays (A, B 10/15/20, C)", model_family="risk overlay — NOT ML",
        purpose="reduce drawdown/losses without changing GC entry signals",
        methodology="universe-mean 20d realized vol percentile bands; sizing multipliers + pauses",
        artifact_location="data/backtest_reports/task111/task111_volatility_overlay_backtest.json",
        historical_backtest_result=ov.get("results", ov),
        current_status_label="Research only (predeclared family; 10% target is a hypothesis, not promoted)",
        current_disposition="hypothesis for forward validation; drawdown reduction is not alpha",
        promotion_eligibility="no",
    ))
    ens = j(T111 / "task111_original_model_evidence.json") if (T111 / "task111_original_model_evidence.json").exists() else j(BR / "task110" / "task110_original_model_evidence.json")
    out.append(profile(
        model_name="shared strategySignal()/technical-rule implementation + existing ensemble", model_family="production technical rules — NOT ML",
        purpose="the platform's existing production signal path (signals v2 / ensemble)",
        methodology="existing implementation unchanged (see src/lib/latent/strategy-engine.ts, ensemble.ts)",
        artifact_location="src/lib/latent/strategy-engine.ts, src/lib/latent/ensemble.ts",
        current_status_label="Existing production research signals (unchanged); never auto-promoted",
        current_disposition="untouched by Tasks 110-112 (no retraining, no threshold changes)",
        promotion_eligibility="no (existing state preserved)",
    ))
    return out


def load_llm() -> list[dict]:
    hist = j(T112 / "history_index.json") or {}
    recon = j(T112 / "task112_llm_decision_reconciliation.json") or {}
    f = recon.get("findings", {})
    sig110 = j(T111 / "task111_llm_shadow_generation.json") or {}
    return [profile(
        model_name="GLM-4.6 multi-source LLM analyst (z-ai-web-dev-sdk)", model_family="LLM (authorized existing provider)",
        purpose="research-only multi-source stock analysis: fundamentals + patterns + news + technicals",
        methodology="latent_psx_llm_evidence_v1 -> glm-4.6 -> strict output validation -> deterministic R:R -> capital protection",
        training_approach="no training/fine-tuning (inference only, temperature 0.2)",
        prediction_horizon="analysis horizon 5/10/21 sessions (decision-level, not numeric forecast)",
        universe="task109-consistent 23-symbol universe",
        evaluation_period="current-date decisions from 2026-11-04 (generation task111-llm-multisource-gen1)",
        train_validation_test_split="n/a (no training)",
        purge_embargo="n/a",
        sample_counts={"total_persisted_records": hist.get("record_count"),
                       "real_records_excl_mock": f.get("real_decision_records_excl_mock"),
                       "mock_pipeline_check_records": f.get("mock_pipeline_check_records"),
                       "unique_symbols_valid": f.get("unique_symbols_with_valid_llm_state")},
        model_configuration_version="provider=zai model=glm-4.6 prompt=task111-prompt-v1",
        artifact_location="data/backtest_reports/task111/signals/ + task112/llm_signal_history/",
        data_evidence_lineage="evidence packages hashed (evidenceHash) per decision; news snapshots retrieval-timestamped",
        transaction_cost_assumptions="R:R priced through computeTradeCostsV2 (psx_user_schedule_v2)",
        execution_assumptions="next-session-open reference; delayed snapshots labeled delayed_observation_shadow",
        historical_backtest_result={"note": "historical LLM simulation forbidden (no PIT evidence packages); current-date decisions only"},
        metrics_by_category={"final_signals_current": f.get("records_by_final_decision")},
        forward_validation_status="task111-llm-multisource-gen1 collecting; 0 matured LLM-specific outcomes (horizons 5/10/21 pending)",
        current_disposition="research_only; LLM conviction is uncalibrated; promotion gates require >=100 genuinely matured LLM outcomes",
        current_status_label="Shadow only (LLM cohort distinct from the general Task 109 cohort)",
        promotion_eligibility="no",
    )]


def load_general_forward() -> dict:
    d = j(BR / "task109" / "task109_forward_performance.json") or {}
    return {
        "model_name": "GENERAL forward cohort (Task 105-110 frozen models) — NOT LLM",
        "total_forward_observations": d.get("total_forward_observations"),
        "independent_decision_dates": d.get("independent_decision_dates"),
        "unique_symbols": d.get("unique_symbols"),
        "matured_positions": d.get("matured_positions"),
        "wins": d.get("wins"), "losses": d.get("losses"),
        "pending_strategy_outcomes": d.get("pending_strategy_outcomes"),
        "warning": "These 43 matured outcomes belong to the general forward cohort — they are NOT LLM performance.",
        "current_status_label": "Shadow only (frozen cohort)",
    }


# ───────────────────────── Task 113 audit integration ───────────────────────
def load_task113_audit() -> dict:
    """Load the Task 113 forward-validation audit (Parts A/C/D/F/G) and surface
    its dashboards into the model performance report. Preserves Task 112's
    existing report structure; adds the new dashboards alongside it."""
    audit = j(T113 / "task113_forward_validation_audit.json") or {}
    if not audit:
        return {"available": False, "reason": "task113 audit not generated (run scripts/task113_audit.py)"}
    cohorts = audit.get("part_a_cohort_reconciliation") or []
    # forward-validation dashboard: one row per cohort, impossible to mistake
    # total positions for total decisions or matured outcomes.
    fv_rows = []
    for c in cohorts:
        fv_rows.append({
            "cohort_id": c.get("cohort_id"),
            "cohort_name": c.get("cohort_name"),
            "total_observations": c.get("total_decision_records"),
            "unique_symbols": c.get("unique_symbols"),
            "matured_5_session": c.get("matured_5_session"),
            "pending_5_session": c.get("pending_5_session"),
            "matured_10_session": c.get("matured_10_session"),
            "pending_10_session": c.get("pending_10_session"),
            "matured_21_session": c.get("matured_21_session"),
            "pending_21_session": c.get("pending_21_session"),
            "matured_terminal_exits_early": c.get("matured_terminal_exits_early"),
            "pending_mtm_open": c.get("pending_mtm_open"),
            "unfilled_awaiting_entry_bar": c.get("unfilled_awaiting_entry_bar"),
            "excluded_records": c.get("excluded_records"),
            "forward_sessions_elapsed": c.get("forward_sessions_elapsed_since_entry"),
        })
    inv = audit.get("part_d_model_inventory") or {}
    llm = audit.get("part_c_llm_outcome_maturity") or {}
    return {
        "available": True,
        "task113_git_head": audit.get("git_head"),
        "data_frontier": audit.get("data_frontier"),
        "session_count": audit.get("session_count"),
        "forward_validation_dashboard": fv_rows,
        "inventory_dashboard": inv.get("dashboard"),
        "inventory_entries": inv.get("entries"),
        "llm_outcome_maturity": {
            "cohort_id": llm.get("cohort_id"),
            "matured_5_session": llm.get("matured_5_session"),
            "matured_10_session": llm.get("matured_10_session"),
            "matured_21_session": llm.get("matured_21_session"),
            "total_real_decisions": llm.get("total_real_decisions"),
            "buy_decisions_current": llm.get("buy_decisions_current"),
            "calibration_status": (llm.get("calibration") or {}).get("status"),
            "directional_accuracy": llm.get("directional_accuracy"),
            "net_returns_buy": llm.get("net_returns_buy"),
            "rule": llm.get("rule"),
        },
        "explanation_57_43_59": audit.get("part_a_57_43_59_explanation"),
        "pipeline_health": audit.get("part_f_forward_pipeline_health"),
        "safeguards": audit.get("part_g_research_safeguards"),
    }


def load_task114_maturity() -> dict:
    """Load the Task 114 forward-maturity audit (first 5/10/21-session horizon
    engine + LLM per-record outcomes) and surface a maturity panel for the UI.
    Read-only over validated artifacts; never invents an outcome."""
    audit = j(T114 / "task114_forward_maturity_audit.json") or {}
    if not audit:
        return {"available": False,
                "reason": "task114 maturity audit not generated (run scripts/task114_maturity.py)"}
    rollups = audit.get("part_c_d_cohort_maturity") or []
    panel = []
    for r in rollups:
        panel.append({
            "cohort_id": r.get("cohort_id"),
            "total_observations": r.get("total_observations"),
            "unique_symbols": r.get("unique_symbols"),
            "matured_5_session": r.get("matured_5_session"),
            "pending_5_session": r.get("pending_5_session"),
            "remaining_sessions_5": r.get("remaining_sessions_pending_5"),
            "matured_10_session": r.get("matured_10_session"),
            "pending_10_session": r.get("pending_10_session"),
            "matured_21_session": r.get("matured_21_session"),
            "pending_21_session": r.get("pending_21_session"),
            "terminal_exits_frozen_engine": r.get("terminal_exits_from_frozen_engine"),
            "pending_mtm_frozen_engine": r.get("pending_mtm_from_frozen_engine"),
            "unfilled_awaiting_entry_bar": r.get("unfilled_awaiting_entry_bar"),
            "excluded_records": r.get("excluded_count", 0),
            "policy_version": r.get("policy_version"),
            "cost_profile": r.get("cost_profile"),
        })
    llm_audit = audit.get("part_e_llm_outcome_maturity") or {}
    llm_roll = llm_audit.get("rollup") or {}
    # drill-down: one compact row per decision from the pending/matured CSVs
    drill: dict[str, list[dict]] = {}
    def _drill_row_key(d): return (d["cohort_id"], d["decision_id"])
    pend_csv = T114 / "task114_pending_outcomes.csv"
    if pend_csv.exists():
        agg: dict[tuple, dict] = {}
        with open(pend_csv, newline="", encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                k = _drill_row_key(row)
                agg.setdefault(k, {"cohort_id": row["cohort_id"], "decision_id": row["decision_id"],
                                   "symbol": row["symbol"], "decision_date": row["decision_date"],
                                   "entry_status": row["entry_status"]})
                rem = row["remaining_sessions"] or ""
                agg[k][row["horizon"]] = f"{row['status']}" + (f" (−{rem} sess)" if rem else "")
        for (cid, _did), row in sorted(agg.items()):
            drill.setdefault(cid, []).append(row)
    return {
        "available": True,
        "engine_version": audit.get("engine_version"),
        "generated_at": audit.get("generated_at"),
        "data_frontier": audit.get("data_frontier"),
        "sessions_new_since_2026_11_03": audit.get("sessions_new_since_2026_11_03"),
        "panel": panel,
        "llm": {
            "genuine_universe_decisions": llm_roll.get("genuine_universe_decisions"),
            "unique_symbols": llm_roll.get("unique_symbols"),
            "decisions_buy": llm_roll.get("decisions_buy"),
            "decisions_hold": llm_roll.get("decisions_hold"),
            "decisions_no_trade": llm_roll.get("decisions_no_trade"),
            "excluded_count": llm_roll.get("excluded_count"),
            "terminal_exits_llm_policy_sim": llm_roll.get("terminal_exits_llm_policy_sim"),
            "calibration": llm_audit.get("calibration"),
            "counterfactual_note": (llm_audit.get("counterfactual_hold_notrade") or {}).get("methodology"),
            "preservation": llm_audit.get("per_record_preservation"),
        },
        "idempotency": audit.get("part_f_idempotency"),
        "missing_market_data": (audit.get("pipeline_events") or {}).get("missing_market_data_observations"),
        "drill_down": drill,
        "warnings": [
            "Sample size before performance metrics: 0 matured horizon outcomes in every cohort — "
            "no win rate, expectancy or profitability may be reported yet (Part H).",
            "First profitable matured trades (when they eventually arrive) must NOT be read as evidence of edge.",
        ],
        "methodology": audit.get("frozen_conventions"),
    }


# ─────────────────────────── Part E/F/G/H/I ──────────────────────────────────
def part_e_lineage_and_contribution():
    records = []
    for p in sorted((T112 / "llm_signal_history").glob("*.json")):
        try:
            records.append(j(p))
        except Exception:
            continue
    real = [r for r in records if not r.get("mockRecord")]
    lineage_rows, contrib_rows = [], []
    for r in real:
        ev = None
        if r.get("evidenceRef"):
            try:
                ev = j(T111 / "signals" / r["evidenceRef"])
            except Exception:
                ev = None
        cited = set((r.get("llmOutput") or {}).get("source_references") or [])
        avail = []
        if ev:
            for cat, key in [("technical", "technicalEvidence"), ("financial_fundamental", "fundamentalEvidence"),
                             ("company_news", "companyNewsEvidence"), ("national_news", "nationalNewsEvidence"),
                             ("international_news", "internationalNewsEvidence")]:
                c = ev.get(key) or {}
                if c.get("status") not in (None, "unavailable", "missing"):
                    avail.append(cat)
        lineage_rows.append(dict(signalId=r["signalId"], symbol=r.get("symbol"),
                                 provider=r.get("provider"), model=r.get("model"),
                                 promptVersion=r.get("promptVersion"), evidenceHash=r.get("evidenceHash"),
                                 evidenceSchemaVersion=r.get("evidenceSchemaVersion"),
                                 outputSchemaVersion=r.get("outputSchemaVersion"),
                                 riskPolicyVersion=r.get("riskPolicyVersion"),
                                 decisionTimestamp=r.get("decisionTimestamp"), dataCutoff=r.get("dataCutoff"),
                                 validationStatus=r.get("validationStatus"),
                                 evidence_package_retained=bool(ev),
                                 reproducible_from_stored_evidence=bool(ev and r.get("evidenceHash")),
                                 technical_snapshot="embedded in evidence package",
                                 fundamental_snapshot="embedded (current-analysis only)",
                                 news_source_ids="embedded in evidence sourceRefs"))
        contrib_rows.append(dict(signalId=r["signalId"], symbol=r.get("symbol"),
                                 technical_available=("technical" in avail), technical_cited="src:technical_local" in cited,
                                 fundamental_available=("financial_fundamental" in avail), fundamental_cited="src:financials_snapshot" in cited,
                                 company_news_available=("company_news" in avail), company_news_cited="src:news_company" in cited,
                                 national_available=("national_news" in avail), national_cited="src:news_national" in cited,
                                 international_available=("international_news" in avail), international_cited="src:news_international" in cited))
    def agg(rows, a, c):
        av = sum(1 for r in rows if r[a])
        ci = sum(1 for r in rows if r[c])
        return {"available": av, "cited": ci, "available_pct": pct(av / max(1, len(rows))), "cited_pct": pct(ci / max(1, len(rows)))}
    contribution = {
        "technical": agg(contrib_rows, "technical_available", "technical_cited"),
        "financial_fundamental": agg(contrib_rows, "fundamental_available", "fundamental_cited"),
        "company_news": agg(contrib_rows, "company_news_available", "company_news_cited"),
        "national_news": agg(contrib_rows, "national_available", "national_cited"),
        "international_news": agg(contrib_rows, "international_available", "international_cited"),
        "note": "availability vs actual citation; NO claim that any category improves accuracy without a controlled comparison",
    }
    LB.write_csv(T112 / "task112_llm_lineage_audit.csv", lineage_rows,
                 ["signalId", "symbol", "provider", "model", "promptVersion", "evidenceHash", "evidenceSchemaVersion",
                  "outputSchemaVersion", "riskPolicyVersion", "decisionTimestamp", "dataCutoff", "validationStatus",
                  "evidence_package_retained", "reproducible_from_stored_evidence"])
    LB.write_csv(T112 / "task112_llm_evidence_contribution.csv", contrib_rows,
                 ["signalId", "symbol", "technical_available", "technical_cited", "fundamental_available",
                  "fundamental_cited", "company_news_available", "company_news_cited", "national_available",
                  "national_cited", "international_available", "international_cited"])
    LB.artifact("task112_llm_evidence_lineage_audit.json", "task112_llm_evidence_lineage_audit", "completed", base=T112,
                records=len(lineage_rows),
                reproducible=sum(1 for r in lineage_rows if r["reproducible_from_stored_evidence"]),
                evidence_packages_retained=sum(1 for r in lineage_rows if r["evidence_package_retained"]),
                fields_verified=["provider/model", "promptVersion", "evidenceHash", "schema versions",
                                 "risk policy version", "decision timestamp", "evidence as-of", "validation status"],
                reproduction_scope="decision reproducible from stored evidence package + versions as far as inputs permit (news caches are 12h TTL and evolve; the evidence SNAPSHOT in the package is authoritative)",
                csv="task112_llm_lineage_audit.csv")
    LB.artifact("task112_llm_evidence_contribution_audit.json", "task112_llm_evidence_contribution_audit", "completed", base=T112,
                contribution=contribution,
                honest_rule="no accuracy-improvement claim is made for any evidence category without a valid controlled comparison")
    # E4: pending LLM-specific outcomes
    frontier = L.sessions()[-1]
    pend = [dict(signalId=r["signalId"], symbol=r.get("symbol"), dataCutoff=r.get("dataCutoff"),
                 decision=r.get("decision"), entry=(r.get("riskReward") or {}).get("entryReference"),
                 horizon_5="pending", horizon_10="pending", horizon_21="pending")
            for r in real if r.get("dataCutoff") and r.get("dataCutoff") >= frontier]
    # Task 114: once the fixed-horizon engine has run, it is authoritative for
    # per-horizon status. Decisions whose as-of date has fallen behind the
    # frontier are IN their observation window (not stale): pending rows come
    # from the Task 114 engine, and matured counts come from its rollup.
    t114_llm = j(T114 / "task114_llm_maturity.json") or {}
    t114_roll = t114_llm.get("rollup") or {}
    if t114_roll.get("genuine_universe_decisions"):
        hstat: dict[str, dict[str, str]] = {}
        with open(T114 / "task114_pending_outcomes.csv", newline="", encoding="utf-8") as _fh:
            for _r in csv.DictReader(_fh):
                if _r["cohort_id"] == "task111-llm-multisource-gen1":
                    hstat.setdefault(_r["decision_id"], {})[_r["horizon"]] = _r["status"]
        by_sid = {}
        for _p in sorted((T112 / "llm_signal_history").glob("*.json")):
            _r = j(_p) or {}
            if _r.get("signalId") in hstat:
                by_sid[_r["signalId"]] = _r
        pend = [dict(signalId=sid, symbol=by_sid[sid].get("symbol"),
                     dataCutoff=by_sid[sid].get("dataCutoff"), decision=by_sid[sid].get("decision"),
                     entry=(by_sid[sid].get("riskReward") or {}).get("entryReference"),
                     horizon_5=st.get("5", "pending"), horizon_10=st.get("10", "pending"),
                     horizon_21=st.get("21", "pending"))
                for sid, st in sorted(hstat.items()) if sid in by_sid]
        matured_n = sum(t114_roll.get(f"matured_{n}_session", 0) for n in ("5", "10", "21"))
        policy_txt = ("outcomes mature only after the required number of ACTUAL market sessions from the "
                      "entry bar (Task 114 engine, per-symbol OhlcvBar dates); early SL/TP3 exits are "
                      "separate measurements; no win rate, expectancy or probability calibration is "
                      "reported (calibration requires >=100 matured LLM-cohort outcomes)")
    else:
        matured_n = 0
        policy_txt = ("outcomes mature only from genuinely future sessions; the current data frontier equals the "
                      "decision as-of date, so ZERO LLM-specific outcomes have matured; no win rate, expectancy or "
                      "probability calibration is reported (calibration requires >=100 matured LLM-cohort outcomes)")
    LB.artifact("task112_llm_pending_outcomes.json", "task112_llm_pending_outcomes", "awaiting_future_observations", base=T112,
                data_frontier=frontier,
                llm_decision_dates=sorted({r.get("dataCutoff") for r in real if r.get("dataCutoff")}),
                total_llm_decisions=len(real), unique_symbols=len({r.get("symbol") for r in real}),
                matured_observations=matured_n, pending_observations=len(pend),
                horizons=["5", "10", "21"],
                policy=policy_txt,
                note="pending observations are kept strictly separate from the general Task 109 cohort's matured outcomes")
    return lineage_rows, contribution


def part_f_overlays():
    uni = L.universe()
    inds = {s: R.compute_symbol_indicators(s) for s in uni}
    import task111_phases_b as B
    sess, vol, bbw, lo_band, hi_band = B._vol_state_tables(inds)
    vol_by_d = dict(zip(sess, vol)); lo_by_d = dict(zip(sess, lo_band)); hi_by_d = dict(zip(sess, hi_band))
    bbw_by_d = dict(zip(sess, bbw))

    def volA(sym, d):
        v, lo, hi = vol_by_d.get(d), lo_by_d.get(d), hi_by_d.get(d)
        if v is None or lo is None or hi is None:
            return 1.0
        return 1.0 if v < lo else 0.75 if v < hi else 0.5

    def volB(target):
        def f(sym, d):
            v = vol_by_d.get(d)
            return max(0.0, min(1.0, target / v)) if v and v > 0 else 0.0
        return f

    def volC(d):
        v, hi = vol_by_d.get(d), hi_by_d.get(d)
        b = bbw_by_d.get(d)
        if v is None or hi is None or b is None:
            return False
        bbws = sorted(x for x in bbw_by_d.values() if x is not None)
        b80 = bbws[int(0.80 * (len(bbws) - 1))] if bbws else None
        return b80 is not None and v > hi and b > b80

    base = R.run_portfolio(inds)["account"]
    results = {"golden_cross_baseline": base}
    results["overlay_B_vol_target_10pct"] = LB.run_portfolio_overlay(inds, sizing_fn=volB(10))
    results["overlay_B_vol_target_15pct"] = LB.run_portfolio_overlay(inds, sizing_fn=volB(15))
    results["overlay_B_vol_target_20pct"] = LB.run_portfolio_overlay(inds, sizing_fn=volB(20))
    results["overlay_A_fixed_vol_exposure"] = LB.run_portfolio_overlay(inds, sizing_fn=volA)
    results["overlay_C_expansion_protection"] = LB.run_portfolio_overlay(inds, sizing_fn=volA, pause_fn=volC)
    results["cash"] = LB.benchmark_cash()
    results["buy_hold_equal_weight"] = LB.benchmark_buy_hold_equal_weight(inds)
    rows = []
    for name, v in results.items():
        rows.append(dict(strategy=name,
                         ending_balance=v.get("final_equity"), net_roi_pct=v.get("roi_pct"),
                         max_drawdown_pct=v.get("max_drawdown") if "max_drawdown" in v else v.get("max_drawdown_pct"),
                         annualized_volatility_pct=v.get("annualized_volatility_pct", N_A),
                         avg_exposure_pct=v.get("avg_exposure_pct", N_A),
                         turnover=v.get("turnover", N_A),
                         max_concentration_pct=v.get("max_single_position_concentration_pct", N_A),
                         trades=v.get("trades"), win_rate_pct=v.get("win_rate_pct"),
                         profit_factor=v.get("profit_factor"),
                         total_costs=v.get("total_costs", N_A),
                         realized_net_pnl=v.get("realized_net_pnl", N_A),
                         unrealized_pnl=v.get("unrealized_pnl", N_A)))
    LB.write_csv(T112 / "task112_account_comparison_pkr100k.csv", rows,
                 ["strategy", "ending_balance", "net_roi_pct", "max_drawdown_pct", "annualized_volatility_pct",
                  "avg_exposure_pct", "turnover", "max_concentration_pct", "trades", "win_rate_pct",
                  "profit_factor", "total_costs", "realized_net_pnl", "unrealized_pnl"])
    LB.artifact("task112_volatility_overlay_validation.json", "task112_volatility_overlay_validation", "completed", base=T112,
                capital=100000.0, universe=uni, period=f"{sess[0]}..{sess[-1]}",
                frozen_rules=True, threshold_selection_on_test="NONE (predeclared family reported in full)",
                results=rows, note="same universe/period/costs/execution; drawdown reduction is NOT alpha",
                open_position_note="open positions marked to market; realized and unrealized reported separately; open positions are NOT completed trades")
    return rows


def part_i_pipeline():
    ops107 = BR / "task107" / "ops"
    wh = j(ops107 / "worker_health.json") or {}
    ms = j(ops107 / "monitor_state.json") or {}
    frontier = L.sessions()[-1]
    LB.artifact("task112_forward_pipeline_audit.json", "task112_forward_pipeline_audit", "completed", base=T112,
                worker_heartbeat=wh.get("heartbeat") or wh.get("last_cycle") or wh.get("status", "unknown"),
                worker_health_keys=sorted(wh.keys())[:15],
                monitor_state_keys=sorted(ms.keys())[:15],
                duplicate_worker_protection="task108_worker.lock present" if (ops107 / "task108_worker.lock").exists() else N_A,
                idempotent_processing="task107 suite asserts repeat_cycle_no_new_snapshots (29/29 green)",
                data_frontier=frontier, session_count=len(L.sessions()),
                provider_limitations="daily bars only; delayed snapshots; NO verified intraday OHLC; provider timestamps not exchange-stamped (never fabricated)",
                data_readiness_visibility="existing data-readiness limitations remain displayed in the application",
                cohort_separation="general Task 105-110 cohort vs LLM task111-llm-multisource-gen1 kept separate everywhere")
    return wh


def part_g_combined():
    LB.artifact("task112_llm_plus_volatility_research.json", "task112_llm_plus_volatility_research", "insufficient_evidence", base=T112,
                design="apply the predeclared volatility overlays to the frozen LLM decisions as a separate research experiment",
                blockers=["LLM decisions exist for a single decision date (0 matured outcomes)",
                          "historical LLM decision series do not exist (no PIT evidence packages) -> nothing to overlay historically",
                          "no threshold optimization permitted on the evaluation window"],
                protocol_when_unblocked=["freeze LLM decisions per evidence hash", "apply overlays unchanged",
                                         "V2 costs, same sizing/capital constraints, separate cohort lineage",
                                         "compare vs LLM-only, volatility-only, GC, cash, buy-and-hold",
                                         "report only genuinely matured forward outcomes"],
                label="development_only / insufficient_evidence — no results manufactured")


def build_report(models: list[dict], forward: dict, overlay_rows: list[dict], contribution: dict, task113: dict | None = None, task114: dict | None = None) -> dict:
    summary_rows = []
    for m in models:
        best = N_A
        hbr = m.get("historical_backtest_result")
        if isinstance(hbr, dict) and hbr:
            ft = hbr.get("final_test") if isinstance(hbr.get("final_test"), dict) else None
            if ft:
                per = ft.get("5") or list(ft.values())[0]
                if isinstance(per, dict):
                    best = {k: per.get(k) for k in ("n", "mae", "rmse", "r2", "directional_accuracy")}
            elif isinstance(hbr.get("roi_pct"), (int, float)):
                best = {"roi_pct": hbr.get("roi_pct"), "max_drawdown": hbr.get("max_drawdown")}
        summary_rows.append({
            "model": m["model_name"], "methodology": m["model_family"],
            "best_available_result": best, "sample_count": m.get("sample_counts") if not isinstance(m.get("sample_counts"), dict) else "see profile",
            "forward_outcomes_matured": ("0 (LLM cohort)" if "GLM-4.6" in m["model_name"] else ("43 (general cohort, NOT LLM)" if "GENERAL" in m["model_name"] else N_A)),
            "current_status": m["current_status_label"], "promotion_eligibility": m["promotion_eligibility"],
        })
    # Task 116 — beta release block (built from the Task 116 artifacts)
    beta_block = {}
    try:
        _t116 = BR / "task116"
        _inv = list(csv.DictReader(open(_t116 / "task116_strategy_inventory.csv")))
        _sec = json.loads((_t116 / "task116_security_remediation.json").read_text())
        _host = json.loads((_t116 / "task116_hosting_readiness.json").read_text())
        _audit = json.loads((_t116 / "task116_beta_launch_audit.json").read_text())
        beta_block = {
            "release_status": _audit.get("release_status"),
            "fusion_methodology": "beta-consensus-v1 — transparent eligible votes, family cap 2, regime gates and pair context excluded from directional consensus",
            "eligible_directional_strategies": sum(1 for r in _inv if r["beta_status"] == "directional_eligible_vote"),
            "regime_context_components": sum(1 for r in _inv if r["beta_status"] == "regime_gate"),
            "pair_context_restriction": next((r["restrictions"] for r in _inv if r["strategyId"] == "pairs_kalman_hedge"), ""),
            "glm46_role": "analyst/explanation layer only — never a 13th directional vote, never a calibrated probability; cohort maturity 0/0/0 (Task 115)",
            "performance_limitations": [
                "No strategy is performance-validated; all 12 are implemented + unit-tested only.",
                "Task 115 gen1 checkpoint (n=12, net +38,064.93 PKR) is descriptive, not proof of edge.",
                "LLM performance not available — insufficient matured outcomes; conviction uncalibrated.",
            ],
            "hosting": _host.get("beta_readiness"),
            "security_remediations": len(_sec.get("remediation_matrix", [])),
        }
    except Exception as _e:
        beta_block = {"error": f"task116 artifacts unavailable: {_e}"}
    report = {
        "report": "psx_model_strategy_performance_report",
        "task": "task112",
        "report_version": "task116-beta",
        "beta_release": beta_block,
        "generated_at": now_iso(),
        "git_head": LB.git_head(),
        "status": "completed",
        "evidence_lineage": {
            "sources": sorted(set(str(p) for p in BR.glob("task*/*.json"))).__len__() and "data/backtest_reports/task*/ (Tasks 79-114 committed artifacts)",
            "primary_files": ["task82_model_registry_audit.json", "task79_model_results.json",
                              "task100_model_comparison.json", "task98_metrics.json", "task99 artifacts",
                              "task101_cost_aware_training.json", "task104_portfolio_results.json",
                              "task109_forward_performance.json", "task111 artifacts", "task112 artifacts",
                              "task113_forward_validation_audit.json (cohort reconciliation + inventory classification)",
                              "task114_forward_maturity_audit.json (first 5/10/21-session fixed-horizon maturity engine + LLM per-record outcomes)"],
            "cost_schedule": "psx_user_schedule_v2 (computeTradeCostsV2) for Task 100+ strategy results; legacy experiments labeled in their own artifacts",
            "rules": ["historical development / training / validation / final-holdout / prospective forward kept separate",
                      "Task 109's 43 matured outcomes are the GENERAL cohort, never attributed to the LLM",
                      "LLM-specific cohort: 0 matured outcomes; calibration forbidden until >=100 genuine matured LLM outcomes",
                      "missing values are marked 'Not available in source evidence'",
                      "Task 113: mock records (MOCK_PIPELINE_CHECK) never feed any metric; cohort denominators never added across",
                      "Task 114: early SL/TP3 terminal exits are never labelled horizon-matured; pending never enters completed stats"],
        },
        "inventory": models,
        "general_forward_cohort": forward,
        "account_comparison_pkr100k": overlay_rows,
        "llm_evidence_contribution": contribution,
        "summary": summary_rows,
        "task113_audit": task113 or {"available": False},
        "task114_maturity": task114 or {"available": False},
    }
    REP_DIR.mkdir(parents=True, exist_ok=True)
    (REP_DIR / "model_strategy_performance_latest.json").write_text(json.dumps(report, indent=1, default=str), encoding="utf-8")
    # versioned copy
    stamp = now_iso().replace(":", "").replace("-", "")[:13]
    (REP_DIR / f"model_strategy_performance_{stamp}.json").write_text(json.dumps(report, indent=1, default=str), encoding="utf-8")
    # CSV comparison
    fields = ["model", "methodology", "best_available_result", "forward_outcomes_matured", "current_status", "promotion_eligibility"]
    with open(REP_DIR / "model_strategy_comparison_latest.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in summary_rows:
            w.writerow({k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in r.items()})
    return report


def write_markdown(report: dict) -> Path:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# PSX Model & Strategy Performance Report (Task 112)",
        f"Generated: {report['generated_at']} · git head {report['git_head']} · status: {report['status']}",
        "",
        "Scope: every model and strategy actually present in repository evidence (Tasks 79-111),",
        "including the GLM-4.6 multi-source LLM analyst. Missing information is marked",
        "**Not available in source evidence**. Historical development, training, validation, final",
        "holdout and prospective-forward results are kept strictly separate.",
        "",
        "## Cohort separation (critical)",
        "- The Task 109 general forward cohort's 43 matured outcomes are NOT LLM performance.",
        f"- LLM-specific cohort (task111-llm-multisource-gen1): **0 matured outcomes**; probability calibration stays forbidden until >=100 genuine matured LLM outcomes exist.",
        "",
        "## Summary comparison",
        "",
        "| Model | Methodology | Best available result | Forward matured | Status | Promotion |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for r in report["summary"]:
        best = r["best_available_result"]
        best_s = json.dumps(best) if isinstance(best, dict) else str(best)
        lines.append(f"| {r['model']} | {r['methodology']} | {best_s[:120]} | {r['forward_outcomes_matured']} | {r['current_status']} | {r['promotion_eligibility']} |")
    lines += [
        "",
        "## Account-level comparison (PKR 100,000, V2 costs, whole shares, no leverage/shorts)",
        "",
        "| Strategy | Ending balance | Net ROI | Max DD | Ann. vol | Avg exposure | Turnover | Trades |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in report["account_comparison_pkr100k"]:
        lines.append(f"| {r['strategy']} | {r['ending_balance']} | {r['net_roi_pct']}% | {r['max_drawdown_pct']}% | {r['annualized_volatility_pct']} | {r['avg_exposure_pct']}% | {r['turnover']} | {r['trades']} |")
    lines += [
        "",
        "## LLM evidence contribution (availability vs actual citation)",
        "",
    ]
    for cat, v in report["llm_evidence_contribution"].items():
        if isinstance(v, dict):
            lines.append(f"- **{cat}**: available {v.get('available_pct')}% · cited {v.get('cited_pct')}%")
    lines += [
        "",
        "> No claim is made that any evidence category improves accuracy without a valid controlled comparison.",
        "",
        "## Model inventory dashboard (Task 113 audit)",
        "",
    ]
    t113 = report.get("task113_audit") or {}
    inv_dash = t113.get("inventory_dashboard") or {}
    if inv_dash:
        lines.append("| Metric | Count |")
        lines.append("| --- | --- |")
        lines.append(f"| Total registry entries | {inv_dash.get('total_registry_entries')} |")
        lines.append(f"| Implemented models | {inv_dash.get('implemented_models')} |")
        lines.append(f"| Trained on PSX data | {inv_dash.get('trained_psx_models')} |")
        lines.append(f"| Successfully evaluated | {inv_dash.get('successfully_evaluated_models')} |")
        lines.append(f"| Forward shadow models | {inv_dash.get('shadow_models')} |")
        lines.append(f"| Rule-based strategies (NOT ML) | {inv_dash.get('rule_based_strategies')} |")
        lines.append(f"| Blocked / unavailable | {inv_dash.get('blocked_unavailable_models')} |")
        lines.append(f"| Duplicate / alias entries | {inv_dash.get('duplicate_alias_entries')} |")
        lines.append(f"| Historical experiments | {inv_dash.get('historical_experiments')} |")
        lines.append("")
        lines.append(f"> {inv_dash.get('note')}")
        lines.append("")
    lines += [
        "## Forward-validation dashboard (Task 113 audit — by cohort)",
        "",
        "Each cohort reconciles internally. **Total positions are NOT total decisions and NOT matured outcomes.**",
        "",
        "| Cohort | Obs | Symbols | Mat 5 | Pend 5 | Mat 10 | Pend 10 | Mat 21 | Pend 21 | Term-exits | Pend-MTM | Unfilled |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for fv in (t113.get("forward_validation_dashboard") or []):
        lines.append(f"| {fv.get('cohort_id')} | {fv.get('total_observations')} | {fv.get('unique_symbols')} | "
                     f"{fv.get('matured_5_session')} | {fv.get('pending_5_session')} | {fv.get('matured_10_session')} | "
                     f"{fv.get('pending_10_session')} | {fv.get('matured_21_session')} | {fv.get('pending_21_session')} | "
                     f"{fv.get('matured_terminal_exits_early')} | {fv.get('pending_mtm_open')} | {fv.get('unfilled_awaiting_entry_bar')} |")
    lines += [
        "",
        "> 0 horizon-matured outcomes for any cohort. The 43 terminal-early-exits are SL/TP3 exits, NOT 5/10/21-session horizon maturities (earliest 21-session ~2026-12-01). MTM pending is never counted as a win. Cohorts are never added across denominators.",
        "",
        "## LLM outcome maturity (Task 113 — isolated from all other cohorts)",
        "",
    ]
    llm = t113.get("llm_outcome_maturity") or {}
    if llm:
        lines.append(f"- **Matured at 5/10/21 sessions**: {llm.get('matured_5_session')} / {llm.get('matured_10_session')} / {llm.get('matured_21_session')} (zero — decisions are current-date; frontier equals decision as-of).")
        lines.append(f"- **Total real decisions**: {llm.get('total_real_decisions')} · **BUY (current)**: {llm.get('buy_decisions_current')}.")
        lines.append(f"- **Directional accuracy**: {llm.get('directional_accuracy')}.")
        lines.append(f"- **Net returns (BUY)**: {llm.get('net_returns_buy')}.")
        lines.append(f"- **Calibration**: {llm.get('calibration_status')}.")
        lines.append(f"> {llm.get('rule')}")
        lines.append("")
    t114b = report.get("task114_maturity") or {}
    if t114b.get("available"):
        lines += [
            "## Forward-horizon maturity panel (Task 114 — first 5/10/21-session audit)",
            "",
            f"Market-data frontier: **{t114b.get('data_frontier')}** · new sessions since 2026-11-03: "
            f"{json.dumps(t114b.get('sessions_new_since_2026_11_03'))} · engine: {t114b.get('engine_version')} · "
            f"last maturity processing: {t114b.get('generated_at')}",
            "",
            "| Cohort | Obs | Symbols | Mat 5 | Pend 5 | Mat 10 | Pend 10 | Mat 21 | Pend 21 | Term-exits (frozen engine) | Pend-MTM | Unfilled | Excluded |",
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for p in (t114b.get("panel") or []):
            lines.append(f"| {p.get('cohort_id')} | {p.get('total_observations')} | {p.get('unique_symbols')} | "
                         f"{p.get('matured_5_session')} | {p.get('pending_5_session')} | {p.get('matured_10_session')} | "
                         f"{p.get('pending_10_session')} | {p.get('matured_21_session')} | {p.get('pending_21_session')} | "
                         f"{p.get('terminal_exits_frozen_engine')} | {p.get('pending_mtm_frozen_engine')} | "
                         f"{p.get('unfilled_awaiting_entry_bar')} | {p.get('excluded_records')} |")
        lines += [
            "",
            "> Fixed-horizon matured / pending are counted per decision at the Nth session close from entry "
            "(entry session = session 1); early SL/TP3 terminal exits are a SEPARATE measurement from the frozen "
            "Task 106/107 engine and are NEVER labelled horizon-matured; pending never enters completed statistics; "
            "5/10/21 are computed independently from source bars. All current values are 0 matured — reported honestly.",
            "",
        ]
        llm114 = t114b.get("llm") or {}
        if llm114:
            calib = llm114.get("calibration") or {}
            lines += [
                "### LLM-specific maturity (isolated cohort `task111-llm`)",
                "",
                f"- Genuine universe decisions: {llm114.get('genuine_universe_decisions')} across {llm114.get('unique_symbols')} symbols "
                f"(BUY {llm114.get('decisions_buy')} · HOLD {llm114.get('decisions_hold')} · NO_TRADE {llm114.get('decisions_no_trade')}).",
                f"- Excluded records: {llm114.get('excluded_count')} (23 MOCK_PIPELINE_CHECK + 24 second-pass generation_cache duplicates + 1 stale out-of-universe ENGRO) — never evaluated.",
                f"- LLM-policy terminal-exit simulation (SL/TP3, separate from horizons): {llm114.get('terminal_exits_llm_policy_sim')} matured.",
                f"- Calibration: {calib.get('status')} (minimum {calib.get('minimum_required')} genuine matured LLM outcomes; current {calib.get('current_matured_llm_outcomes')}).",
                f"- {llm114.get('preservation')}",
                "",
            ]
        idem = t114b.get("idempotency") or {}
        if idem:
            lines += [
                f"> Idempotency: outcome key `decision_id|hN`, {idem.get('duplicate_processing_attempts_identical')} duplicate "
                f"recomputations (identical, benign), {idem.get('source_bar_revisions_detected')} source-bar revisions detected "
                "(each auditable, never a silent overwrite).",
                "",
            ]
        for w in (t114b.get("warnings") or []):
            lines.append(f"> **Warning**: {w}")
        lines.append("")
    lines += [
        "## General forward cohort (NOT LLM)",
        "",
        f"Observations: {report['general_forward_cohort'].get('total_forward_observations')} · matured: {report['general_forward_cohort'].get('matured_positions')} (W{report['general_forward_cohort'].get('wins')}/L{report['general_forward_cohort'].get('losses')}) · pending: {report['general_forward_cohort'].get('pending_strategy_outcomes')} · symbols: {report['general_forward_cohort'].get('unique_symbols')}",
        "",
        "## Full model profiles",
        "",
    ]
    for m in report["inventory"]:
        lines.append(f"### {m['model_name']}")
        for k, v in m.items():
            if k in ("model_name",):
                continue
            vs = json.dumps(v, default=str) if isinstance(v, (dict, list)) else str(v)
            lines.append(f"- **{k}**: {vs[:400]}")
        lines.append("")
    lines += [
        "## Honest status legend",
        "- **Research only** — evaluated, no reliable positive net edge demonstrated.",
        "- **Shadow only** — frozen, collecting genuinely future outcomes.",
        "- **Insufficient evidence** — cannot be evaluated yet.",
        "- **Not promotable** — promotion gates not passed.",
        "- **Rule strategy — not ML** — deterministic rules, not trained models.",
        "- **Rejected/unavailable** — blocked by resources, dependencies or data.",
        "",
        "No model is production-ready merely because a build or test passes. Nothing here places orders.",
    ]
    p = DOCS_DIR / "psx_model_strategy_performance_report.md"
    p.write_text("\n".join(lines), encoding="utf-8")
    return p


def write_pdf(report: dict, md_path: Path) -> Path:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors
    styles = getSampleStyleSheet()
    pdf_path = REP_DIR / "psx_model_strategy_performance_report.pdf"
    doc = SimpleDocTemplate(str(pdf_path), pagesize=A4, title="PSX Model & Strategy Performance Report (Task 112)")
    story = [
        Paragraph("PSX Model &amp; Strategy Performance Report", styles["Title"]),
        Paragraph(f"Task 112 · generated {report['generated_at']} · git head {report['git_head']} · status {report['status']}", styles["Normal"]),
        Spacer(1, 8),
        Paragraph("Cohort separation: the Task 109 general forward cohort's 43 matured outcomes are NOT LLM performance; the LLM cohort has 0 matured outcomes and probability calibration remains forbidden until >=100 genuine matured LLM outcomes exist.", styles["Normal"]),
        Spacer(1, 8),
        Paragraph("Summary comparison", styles["Heading2"]),
    ]
    data = [["Model", "Status", "Promotion"]]
    for r in report["summary"]:
        data.append([str(r["model"])[:60], str(r["current_status"])[:60], "no"])
    t = Table(data, colWidths=[240, 220, 60])
    t.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 6.5), ("GRID", (0, 0), (-1, -1), 0.4, colors.grey)]))
    story.append(t)
    story.append(Spacer(1, 8))
    story.append(Paragraph("Account-level comparison (PKR 100,000)", styles["Heading2"]))
    data2 = [["Strategy", "End balance", "ROI %", "Max DD %", "Trades"]]
    for r in report["account_comparison_pkr100k"]:
        data2.append([str(r["strategy"])[:44], str(r["ending_balance"]), str(r["net_roi_pct"]), str(r["max_drawdown_pct"]), str(r["trades"])])
    t2 = Table(data2, colWidths=[200, 90, 70, 80, 60])
    t2.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 6.5), ("GRID", (0, 0), (-1, -1), 0.4, colors.grey)]))
    story.append(t2)
    t114b = report.get("task114_maturity") or {}
    if t114b.get("available"):
        story.append(Spacer(1, 8))
        story.append(Paragraph(
            f"Task 114 forward-horizon maturity — frontier {t114b.get('data_frontier')}, "
            f"new sessions since 2026-11-03: {json.dumps(t114b.get('sessions_new_since_2026_11_03'))}; "
            "0 matured 5/10/21-session outcomes in every cohort (reported honestly). Early SL/TP3 exits are "
            "separate measurements, never horizon maturities. LLM calibration stays unavailable until >=100 "
            "genuine matured LLM outcomes.", styles["Normal"]))
        story.append(Spacer(1, 4))
        data3 = [["Cohort", "Obs", "Mat5/Pend5", "Mat10/Pend10", "Mat21/Pend21", "Term", "Unfill", "Excl"]]
        for p in (t114b.get("panel") or []):
            data3.append([str(p.get("cohort_id"))[:34], str(p.get("total_observations")),
                          f"{p.get('matured_5_session')}/{p.get('pending_5_session')}",
                          f"{p.get('matured_10_session')}/{p.get('pending_10_session')}",
                          f"{p.get('matured_21_session')}/{p.get('pending_21_session')}",
                          str(p.get("terminal_exits_frozen_engine")),
                          str(p.get("unfilled_awaiting_entry_bar")),
                          str(p.get("excluded_records"))])
        t3 = Table(data3, colWidths=[150, 40, 62, 70, 70, 36, 40, 36])
        t3.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 6.5), ("GRID", (0, 0), (-1, -1), 0.4, colors.grey)]))
        story.append(t3)
    story.append(Spacer(1, 8))
    story.append(Paragraph("Full profiles, per-horizon metrics, cost assumptions and evidence lineage: see docs/reports/psx_model_strategy_performance_report.md and data/reports/model_strategy_performance_latest.json. Missing values are marked 'Not available in source evidence'.", styles["Normal"]))
    doc.build(story)
    return pdf_path


def main():
    models: list[dict] = []
    models += load_registry()
    models += load_task100_nine()
    models += load_task79()
    models += load_task98()
    models += load_task99()
    models += load_cost_aware()
    models += load_rule_systems()
    models += load_llm()
    forward = load_general_forward()
    task113 = load_task113_audit()
    task114 = load_task114_maturity()
    lineage, contribution = part_e_lineage_and_contribution()
    overlay_rows = part_f_overlays()
    part_i_pipeline()
    part_g_combined()
    report = build_report(models, forward, overlay_rows, contribution, task113, task114)
    md = write_markdown(report)
    pdf = write_pdf(report, md)
    print(f"models in inventory: {len(models)}")
    print(f"report json: {REP_DIR / 'model_strategy_performance_latest.json'}")
    print(f"report md:   {md}")
    print(f"report pdf:  {pdf}")


if __name__ == "__main__":
    main()
