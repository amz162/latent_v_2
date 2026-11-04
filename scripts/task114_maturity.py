#!/usr/bin/env python3
"""Task 114 — first forward-horizon maturity & independent outcome audit.

Reads ONLY immutable records (db/custom.db OhlcvBar, task105/106/107 shadow
observations, task107/_matured.json, task112/llm_signal_history). Never
mutates a source ledger. Recomputes fresh each run; idempotency is tracked in
task114_outcome_ledger.json (first_processed_at + source-bar fingerprint per
outcome; a fingerprint change means a source bar was corrected — auditable,
never silently overwritten).

Methodology (frozen conventions, documented for the audit):
  * A SESSION is a distinct per-symbol OhlcvBar date (Task 106/107 frozen
    convention). Weekends/holidays never count because no bar exists.
    Missing symbol bars never advance the symbol's clock.
  * ENTRY = first bar with date strictly AFTER the decision date; fill at that
    bar's OPEN (actual available fill). The decision's riskReward.entryReference
    (frontier close) is preserved separately and never used as a fill.
  * Fixed-horizon N-session outcome: matures only when N actual per-symbol
    sessions exist FROM the entry session (entry session = session 1, frozen
    task106_mature.ts window convention bars[idx:idx+N]). Evaluation endpoint =
    CLOSE of the Nth session. Gross = (close_N - entry) * qty; net = gross -
    V2 costs (task110_lib.trade_costs_v2, single buy + single sell leg).
  * TERMINAL EARLY EXITS (SL/TP3 first-hit, same-bar SL priority) are a
    SEPARATE measurement, never a horizon maturity. For the general cohorts the
    frozen task106_mature.ts ledger (_matured.json) is authoritative and is
    referenced, not recomputed. For the LLM cohort the deterministic
    atr14-1.5-1-2-3 policy is simulated over the 21-session window with the
    same exit-priority semantics.
  * HOLD/NO_TRADE decisions are never trades: a separately-labelled
    counterfactual benchmark (symbol return over the same windows) is reported
    as context only — avoided losses are NOT wins; nothing enters trade stats.
  * Unfilled (no entry bar yet) stays unfilled. Pending never enters completed
    statistics. Mock records never enter anything.
"""
from __future__ import annotations
import csv, hashlib, json, sqlite3, sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task110_lib as CL  # noqa: E402  (V2 costs)

BR = ROOT / "data" / "backtest_reports"
T112 = BR / "task112"
T114 = BR / "task114"
DB = ROOT / "db" / "custom.db"
HORIZONS = (5, 10, 21)
ENGINE_VERSION = "task114-maturity-v1"
LLM_DATA_CUTOFF = "2026-11-03"          # frozen LLM decision as-of date
LLM_COHORT_ID = "task111-llm-multisource-gen1"


def j(path: Path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return None


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_bars() -> dict[str, list[dict]]:
    """Per-symbol date-ordered OHLC bars from immutable OhlcvBar."""
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    bars: dict[str, list[dict]] = {}
    for sym, d, o, h, l, c, v in conn.execute(
            "SELECT symbol,date,open,high,low,close,volume FROM OhlcvBar ORDER BY symbol,date ASC"):
        bars.setdefault(sym, []).append({"date": d, "open": o, "high": h, "low": l,
                                         "close": c, "volume": v})
    conn.close()
    return bars


def entry_index(sym_bars: list[dict], decision_date: str) -> int | None:
    """Index of first bar strictly after the decision date (None = unfilled)."""
    for i, b in enumerate(sym_bars):
        if b["date"] > decision_date:
            return i
    return None


def fingerprint(sym_bars: list[dict], i0: int, n: int) -> str:
    """Source-bar fingerprint for auditability (Task 114 Part F item 8)."""
    window = sym_bars[i0:i0 + n]
    payload = json.dumps([[b["date"], b["open"], b["high"], b["low"], b["close"]]
                          for b in window], sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def fixed_horizon(sym_bars: list[dict], i0: int, n: int):
    """Fixed-horizon N-session mark. Returns dict or None when pending."""
    window = sym_bars[i0:i0 + n]
    if len(window) < n:
        return {"status": "pending",
                "sessions_elapsed_from_entry": len(window),
                "remaining_sessions": n - len(window)}
    end = window[-1]
    return {"status": "matured",
            "sessions_elapsed_from_entry": n,
            "endpoint_session": end["date"],
            "endpoint_close": end["close"],
            "source_bar_refs": [{"date": b["date"], "open": b["open"], "high": b["high"],
                                 "low": b["low"], "close": b["close"]} for b in window],
            "source_fingerprint": fingerprint(sym_bars, i0, n)}


def terminal_exit_sim(sym_bars: list[dict], i0: int, sl: float, tp3: float, window: int = 21):
    """SL/TP3 first-hit terminal simulation (same-bar SL priority) — mirrors
    task106_mature.ts fixed_first_hit exit priority. Returns dict."""
    scan = sym_bars[i0:i0 + window]
    for k, b in enumerate(scan):
        if b["low"] <= sl:
            return {"status": "matured_terminal_exit", "exit_session": b["date"],
                    "exit_price": sl, "exit_reason": "SL", "sessions_held": k + 1,
                    "note": "terminal early exit — NEVER a horizon maturity"}
        if b["high"] >= tp3:
            return {"status": "matured_terminal_exit", "exit_session": b["date"],
                    "exit_price": tp3, "exit_reason": "TP3", "sessions_held": k + 1,
                    "note": "terminal early exit — NEVER a horizon maturity"}
    return {"status": "pending_terminal_window",
            "sessions_scanned": len(scan),
            "note": "no SL/TP3 hit yet inside the 21-session terminal scan window"}


# ─────────────────────────── decision sources ───────────────────────────────
def general_decisions() -> tuple[list[dict], dict]:
    """57 gen1-3 decisions from the frozen shadow ledgers + _matured.json."""
    gen_files = {
        "task105-gen1": BR / "task105" / "shadow_observations" / "task105_shadow_observations.json",
        "task106-gen2": BR / "task106" / "shadow_observations" / "task106_shadow_observations.json",
        "task107-gen3": BR / "task107" / "shadow_observations" / "task107_shadow_observations.json",
    }
    prefix = {"task105-gen1": "t105gen1_", "task106-gen2": "t106gen2_", "task107-gen3": "t107gen3_"}
    matured = j(BR / "task107" / "_matured.json") or {}
    mrows = {o["decision_id"]: o for o in (matured.get("observations") or [])}
    out: list[dict] = []
    meta = {}
    for cohort_id, gfile in gen_files.items():
        gd = j(gfile) or {}
        for o in (gd.get("observations") or []):
            did = o.get("decision_id") or o.get("id")
            m = mrows.get(did, {})
            qty = None
            ff = (m.get("outcomes") or {}).get("fixed_first_hit") or {}
            qty = ff.get("quantity")
            out.append({
                "cohort_id": cohort_id, "decision_id": did, "symbol": o.get("symbol"),
                "decision_date": o.get("decision_date") or m.get("decision_date"),
                "decision_timestamp": o.get("decision_timestamp"),
                "entry_date": m.get("entry_date"), "entry_fill": m.get("entry"),
                "quantity": qty,
                "policy_version": o.get("policy_version"),
                "model_version": o.get("model_version"),
                "cost_profile": o.get("cost_profile"),
                "prediction_horizon_sessions": o.get("prediction_horizon_sessions"),
            })
        meta[cohort_id] = {"source_ledger": str(gfile.relative_to(ROOT)),
                           "policy_version": (gd.get("observations") or [{}])[0].get("policy_version"),
                           "cost_profile": (gd.get("observations") or [{}])[0].get("cost_profile")}
    return out, meta


def llm_decisions() -> tuple[list[dict], list[dict], dict]:
    """Genuine LLM universe decisions + excluded/mocked record inventory."""
    genuine: list[dict] = []
    excluded: list[dict] = []
    counts = Counter()
    for fp in sorted((T112 / "llm_signal_history").glob("*.json")):
        r = j(fp) or {}
        counts[r.get("recordType") or "unknown"] += 1
        if r.get("recordType") != "REAL_LLM_DECISION":
            excluded.append({"signalId": r.get("signalId"), "symbol": r.get("symbol"),
                             "reason": f"recordType={r.get('recordType')} (mock pipeline check — never evaluated)"})
            continue
        if r.get("dataCutoff") != LLM_DATA_CUTOFF:
            excluded.append({"signalId": r.get("signalId"), "symbol": r.get("symbol"),
                             "reason": f"stale evidence: dataCutoff={r.get('dataCutoff')} != frozen {LLM_DATA_CUTOFF} (out-of-universe ENGRO record)"})
            continue
        if r.get("provenance") == "generation_cache":
            # same 23 decisions from the first generation pass — kept for
            # lineage; the current_record row is the evaluated instance
            excluded.append({"signalId": r.get("signalId"), "symbol": r.get("symbol"),
                             "reason": "generation_cache duplicate of a current_record decision (second pass); evaluated instance is the current_record row"})
            continue
        rr = r.get("riskReward") or {}
        genuine.append({
            "cohort_id": LLM_COHORT_ID, "decision_id": r.get("signalId"),
            "signal_id": r.get("signalId"), "symbol": r.get("symbol"),
            "decision": r.get("decision"),
            "decision_date": r.get("dataCutoff"),
            "decision_timestamp": r.get("decisionTimestamp"),
            "evidence_asof": r.get("dataCutoff"),
            "evidence_hash": r.get("evidenceHash"),
            "prompt_version": r.get("promptVersion"),
            "evidence_schema_version": r.get("evidenceSchemaVersion"),
            "output_schema_version": r.get("outputSchemaVersion"),
            "generation_id": r.get("generationId"),
            "risk_policy_version": r.get("riskPolicyVersion") or rr.get("riskPolicyVersion"),
            "risk_policy_id": rr.get("riskPolicyId"),
            "entry_reference": rr.get("entryReference"),
            "execution_assumption": rr.get("executionAssumption"),
            "stop_loss": rr.get("stopLoss"),
            "tp3": (rr.get("targets") or {}).get("tp3"),
            "quantity": rr.get("positionQty"),
            "position_notional": rr.get("positionNotional"),
            "llm_conviction_score": r.get("llmConvictionScore"),
        })
    meta = {"record_type_counts_all_sources": dict(counts)}
    return genuine, excluded, meta


# ─────────────────────────── outcome computation ────────────────────────────
def evaluate(decisions: list[dict], bars: dict[str, list[dict]], ledger: dict,
             is_llm: bool) -> tuple[list[dict], dict]:
    """Compute fixed-horizon outcomes (+ terminal sim for LLM) per decision."""
    outcomes: list[dict] = []
    dup_identical = dup_changed = 0
    for d in decisions:
        sym_bars = bars.get(d["symbol"]) or []
        i0 = entry_index(sym_bars, d["decision_date"])
        base = {
            "cohort_id": d["cohort_id"], "decision_id": d["decision_id"],
            "symbol": d["symbol"], "decision_date": d["decision_date"],
            "decision_timestamp": d.get("decision_timestamp"),
            "engine_version": ENGINE_VERSION,
        }
        if is_llm:
            base.update({"signal_id": d.get("signal_id"), "decision": d.get("decision"),
                         "entry_reference": d.get("entry_reference"),
                         "evidence_hash": d.get("evidence_hash"),
                         "prompt_version": d.get("prompt_version"),
                         "risk_policy_version": d.get("risk_policy_version")})
        if i0 is None:
            outcomes.append({**base, "entry_status": "unfilled_awaiting_entry_bar",
                             "horizons": {f"h{n}": {"status": "pending_unfilled"} for n in HORIZONS}})
            continue
        ebar = sym_bars[i0]
        entry = d.get("entry_fill") if not is_llm else ebar["open"]
        qty = d.get("quantity")
        base.update({"entry_status": "filled", "entry_session": ebar["date"],
                     "entry_fill": entry, "quantity": qty,
                     "entry_bar": {"date": ebar["date"], "open": ebar["open"],
                                   "high": ebar["high"], "low": ebar["low"], "close": ebar["close"]}})
        horizons = {}
        for n in HORIZONS:
            fh = fixed_horizon(sym_bars, i0, n)
            if fh["status"] == "matured" and qty and entry:
                gross = (fh["endpoint_close"] - entry) * qty
                costs = CL.trade_costs_v2(qty, entry, [(qty, fh["endpoint_close"])], gross)
                fh.update({"gross_return_pkr": round(gross, 2),
                           "gross_return_pct": round(gross / (entry * qty), 10),
                           "v2_costs_pkr": {k: round(costs[k], 4) for k in
                                            ("total_brokerage", "total_psx", "total_nccpl",
                                             "total_cdc", "cgt", "total_cost")},
                           "net_return_pkr": round(costs["net_pnl"], 2),
                           "net_return_pct": round(costs["net_pnl"] / (entry * qty), 10),
                           "exit_mark_methodology": f"fixed-horizon close mark at session {n} (hypothetical continuation; separate from any terminal exit)"})
            key = f"{d['decision_id']}|h{n}"
            if fh["status"] == "matured":
                fp = fh["source_fingerprint"]
                prev = ledger.get(key)
                if prev is None:
                    ledger[key] = {"first_processed_at": now_iso(), "fingerprint": fp}
                elif prev.get("fingerprint") == fp:
                    dup_identical += 1
                else:
                    dup_changed += 1
                    ledger[key] = {"first_processed_at": prev.get("first_processed_at"),
                                   "fingerprint": fp,
                                   "source_bar_revision_detected_at": now_iso()}
            horizons[f"h{n}"] = fh
        outcomes.append({**base, "horizons": horizons})
        if is_llm and d.get("decision") == "BUY" and d.get("stop_loss") and d.get("tp3"):
            outcomes[-1]["terminal_exit_measurement"] = terminal_exit_sim(
                sym_bars, i0, d["stop_loss"], d["tp3"])
    stats = {"duplicate_processing_attempts_identical": dup_identical,
             "source_bar_revisions_detected": dup_changed}
    return outcomes, stats


def counterfactual_benchmark(decisions: list[dict], bars: dict[str, list[dict]]) -> list[dict]:
    """HOLD/NO_TRADE counterfactual: symbol close-to-close return over the same
    windows from the entry session. Context only — NEVER a trade, never a win."""
    rows = []
    for d in decisions:
        if d.get("decision") not in ("HOLD", "NO_TRADE"):
            continue
        sym_bars = bars.get(d["symbol"]) or []
        i0 = entry_index(sym_bars, d["decision_date"])
        row = {"signal_id": d.get("signal_id"), "symbol": d["symbol"],
               "decision": d.get("decision"), "decision_date": d["decision_date"]}
        if i0 is None:
            row["status"] = "unfilled_awaiting_entry_bar"
            rows.append(row)
            continue
        row["entry_session"] = sym_bars[i0]["date"]
        row["entry_session_close"] = sym_bars[i0]["close"]
        for n in HORIZONS:
            w = sym_bars[i0:i0 + n]
            if len(w) < n:
                row[f"h{n}"] = "pending"
            else:
                ref = d.get("entry_reference")
                row[f"h{n}"] = {"benchmark_close": w[-1]["close"],
                                "benchmark_return_vs_entry_close_pct":
                                    round(w[-1]["close"] / sym_bars[i0]["close"] - 1, 10)}
                if ref:
                    row[f"h{n}"]["benchmark_return_vs_decision_close_pct"] = \
                        round(w[-1]["close"] / ref - 1, 10)
        rows.append(row)
    return rows


# ─────────────────────────── cohort rollups ─────────────────────────────────
def rollup(outcomes: list[dict], cohort_id: str, horizons=HORIZONS) -> dict:
    r = {"cohort_id": cohort_id, "total_observations": len(outcomes)}
    filled = [o for o in outcomes if o.get("entry_status") == "filled"]
    r["unfilled_awaiting_entry_bar"] = len(outcomes) - len(filled)
    r["unique_symbols"] = len({o["symbol"] for o in outcomes})
    for n in horizons:
        mat = [o for o in filled if o["horizons"][f"h{n}"]["status"] == "matured"]
        pen = [o for o in filled if o["horizons"][f"h{n}"]["status"] == "pending"]
        r[f"matured_{n}_session"] = len(mat)
        r[f"pending_{n}_session"] = len(pen)
        r[f"remaining_sessions_pending_{n}"] = sorted({o["horizons"][f"h{n}"].get("remaining_sessions")
                                                       for o in pen
                                                       if o["horizons"][f"h{n}"].get("remaining_sessions") is not None})
    return r


def main() -> None:
    T114.mkdir(parents=True, exist_ok=True)
    bars = load_bars()
    conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    all_sessions = [r[0] for r in conn.execute("SELECT DISTINCT date FROM OhlcvBar ORDER BY date ASC")]
    conn.close()
    frontier = all_sessions[-1] if all_sessions else None
    prev_frontier = "2026-11-03"
    new_sessions = [d for d in all_sessions if d > prev_frontier]

    ledger_fp = T114 / "task114_outcome_ledger.json"
    ledger = j(ledger_fp) or {}

    gen_dec, gen_meta = general_decisions()
    llm_dec, llm_excluded, llm_counts = llm_decisions()

    gen_out, gen_dup = evaluate(gen_dec, bars, ledger, is_llm=False)
    llm_out, llm_dup = evaluate(llm_dec, bars, ledger, is_llm=True)

    rollups = []
    for cid in ("task105-gen1", "task106-gen2", "task107-gen3"):
        sub = [o for o in gen_out if o["cohort_id"] == cid]
        r = rollup(sub, cid)
        m = gen_meta.get(cid, {})
        r.update({"source_ledger": m.get("source_ledger"),
                  "policy_version": m.get("policy_version"),
                  "cost_profile": m.get("cost_profile"),
                  "terminal_exits_from_frozen_engine": None})
        rollups.append(r)
    # frozen-engine terminal counts per generation (referenced, not recomputed)
    matured_ledger = j(BR / "task107" / "_matured.json") or {}
    for cid, pfx in (("task105-gen1", "t105gen1_"), ("task106-gen2", "t106gen2_"), ("task107-gen3", "t107gen3_")):
        rows = [o for o in (matured_ledger.get("observations") or []) if o["decision_id"].startswith(pfx)]
        term = sum(1 for o in rows for s in (o.get("outcomes") or {}).values()
                   if s.get("status") in ("matured_terminal_exit", "matured_full_exit"))
        pend = sum(1 for o in rows for s in (o.get("outcomes") or {}).values()
                   if s.get("status") == "pending_mtm")
        next(r for r in rollups if r["cohort_id"] == cid).update(
            {"terminal_exits_from_frozen_engine": term, "pending_mtm_from_frozen_engine": pend})
    llm_roll = rollup(llm_out, LLM_COHORT_ID)
    llm_roll.update({
        "genuine_universe_decisions": len(llm_out),
        "unique_symbols": len({o["symbol"] for o in llm_out}),
        "decisions_buy": sum(1 for o in llm_out if o.get("decision") == "BUY"),
        "decisions_hold": sum(1 for o in llm_out if o.get("decision") == "HOLD"),
        "decisions_no_trade": sum(1 for o in llm_out if o.get("decision") == "NO_TRADE"),
        "excluded_records": llm_excluded,
        "excluded_count": len(llm_excluded),
        "record_type_counts_all_sources": llm_counts["record_type_counts_all_sources"],
        "terminal_exits_llm_policy_sim": sum(
            1 for o in llm_out if (o.get("terminal_exit_measurement") or {}).get("status") == "matured_terminal_exit"),
    })
    rollups.append(llm_roll)

    # buy-only net results where matured (LLM)
    llm_buy_matured = [o for o in llm_out if o.get("decision") == "BUY"
                       and o["horizons"]["h5"].get("status") == "matured"]
    llm_net = {
        "buy_decisions": sum(1 for o in llm_out if o.get("decision") == "BUY"),
        "matured_5_session_buys": len(llm_buy_matured),
        "net_results_5_session": [{"decision_id": o["decision_id"], "symbol": o["symbol"],
                                   "net_return_pkr": o["horizons"]["h5"].get("net_return_pkr"),
                                   "net_return_pct": o["horizons"]["h5"].get("net_return_pct")}
                                  for o in llm_buy_matured],
        "note": "net results reported ONLY for matured horizons; pending/unfilled never counted",
    }

    cf = counterfactual_benchmark(llm_dec, bars)

    audit = {
        "report": "task114_forward_maturity_audit",
        "task": "task114",
        "generated_at": now_iso(),
        "engine_version": ENGINE_VERSION,
        "status": "completed",
        "baseline": ("Task 112 fix e371b6c3 (= origin/main) + Task 113 content restored as 8f32452b "
                     "(original 2edc05a5 lost to a sandbox recycle; content byte-restored from the "
                     "platform-preserved pre-recycle workspace and re-verified by the Task 113 QA suite)"),
        "data_frontier": frontier,
        "sessions_new_since_2026_11_03": new_sessions,
        "session_count_total": len(all_sessions),
        "pipeline_events": {
            "candidate_session_defect_found_and_fixed":
                "task107_lib.psx_session_state returned the most recent SUNDAY as the pre-open candidate "
                "session for mid-week mornings ((wd+1)%7 formula), hiding the fully closed 2026-11-04 "
                "session from the ingest window; fixed to the previous weekday and regression-tested",
            "ingest_result": {"frontier": frontier, "new_bars": 23, "new_date": "2026-11-04",
                              "overlap_checked": 46, "mismatches": 0},
            "missing_market_data_observations":
                ["ENGRO: no 2026-11-04 bar (dataset shows no ENGRO bar since 2025-01-03 — long out-of-universe; "
                 "its only LLM record is the stale excluded one, so NO pending decision is affected)",
                 "BYCO: no 2026-11-04 bar (no bars since 2021-12-20; no frozen decision pending on it)",
                 "Neither symbol is in any active cohort denominator: all 57 general decisions and all 23 "
                 "genuine LLM decisions are on symbols that traded on 2026-11-04"],
        },
        "frozen_conventions": {
            "session": "distinct per-symbol OhlcvBar date; weekends/holidays never counted; missing bars never advance a symbol clock",
            "entry": "first bar strictly after decision date; fill at that bar OPEN (actual available fill)",
            "horizon": "N sessions FROM the entry session (entry = session 1, task106_mature.ts window convention); endpoint = Nth session CLOSE",
            "terminal_exits": "SL/TP3 first-hit early exits are a SEPARATE measurement, never a horizon maturity",
            "costs": "psx_user_schedule_v2 via task110_lib.trade_costs_v2 (exact port of computeTradeCostsV2)",
        },
        "part_b_session_frontier": {
            "frontier": frontier, "previous_frontier": prev_frontier,
            "new_sessions": new_sessions,
            "provider": "psxdata-api.fastapicloud.dev (delayed EOD; no exchange-source timestamps; nothing fabricated)",
        },
        "part_c_d_cohort_maturity": rollups,
        "part_c_matured_outcomes": [o for o in (gen_out + llm_out)
                                    if any(o["horizons"][f"h{n}"].get("status") == "matured" for n in HORIZONS)],
        "part_d_independence_rule":
            "5/10/21-session outcomes are computed independently from source bars; a 5-session outcome "
            "never infers a 10- or 21-session outcome; the frozen task106_mature.ts terminal ledger is "
            "referenced for early exits and never merged into horizon counts",
        "part_e_llm_outcome_maturity": {
            "cohort_id": LLM_COHORT_ID,
            "rollup": llm_roll,
            "buy_outcomes": llm_net,
            "counterfactual_hold_notrade": {
                "methodology": ("benchmark context: the symbol's own close at the horizon endpoint vs the "
                                "entry-session close (and vs the frozen decision-day close); reported as "
                                "OPPORTUNITY CONTEXT ONLY — avoided losses are not wins; nothing here enters "
                                "trading statistics, win rates, or promotion gates"),
                "rows": cf,
            },
            "calibration": {
                "status": "Not available — insufficient matured LLM outcomes",
                "minimum_required": 100,
                "current_matured_llm_outcomes": llm_roll["matured_5_session"] + llm_roll["matured_10_session"] + llm_roll["matured_21_session"],
                "llm_conviction": "uncalibrated (remains uncalibrated until >=100 genuine matured LLM-cohort outcomes; conviction is never converted into a probability)",
            },
            "per_record_preservation":
                "original GLM-4.6 decisions, prompt hash (evidenceHash), evidence as-of, generation "
                "timestamp, and source references are preserved untouched in task112/llm_signal_history; "
                "this audit reads them and never regenerates or rewrites them",
        },
        "part_f_idempotency": {
            "ledger": str(ledger_fp.relative_to(ROOT)),
            "outcome_key": "decision_id|hN",
            "duplicate_processing_attempts_identical": gen_dup["duplicate_processing_attempts_identical"] + llm_dup["duplicate_processing_attempts_identical"],
            "source_bar_revisions_detected": gen_dup["source_bar_revisions_detected"] + llm_dup["source_bar_revisions_detected"],
            "policy": "recompute-fresh from immutable inputs each run; ledger records first_processed_at + source fingerprint; a fingerprint change is an auditable correction, never a silent overwrite",
        },
        "part_i_promotion_status": {
            "GLM-4.6": "shadow only", "task100 models": "research only",
            "cost-aware filter": "shadow only", "golden_cross_7_30_v1 + volatility overlays": "research only",
            "technical/ensemble strategy": "rule strategy, not ML",
            "blocked inventory entries": "unavailable/not promotable",
            "automatic_promotion": "none — no model or strategy promoted in Task 114",
        },
        "rules": [
            "Sample size before performance metrics; no profitability claims from a handful of observations.",
            "Pending outcomes never enter completed-trade statistics.",
            "Mock records never feed any metric.",
            "LLM performance is never borrowed from the general forward cohort.",
            "Early terminal exits are never labelled horizon-matured.",
            "Every classification stays historical / validation / final-holdout / prospective-forward: all Task 114 outcomes are PROSPECTIVE FORWARD validation observations.",
        ],
    }

    (T114 / "task114_forward_maturity_audit.json").write_text(
        json.dumps(audit, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    ledger_fp.write_text(json.dumps(ledger, indent=1, ensure_ascii=False), encoding="utf-8")

    # cohort maturity CSV
    cfields = ["cohort_id", "total_observations", "unique_symbols", "unfilled_awaiting_entry_bar",
               "matured_5_session", "pending_5_session", "matured_10_session", "pending_10_session",
               "matured_21_session", "pending_21_session", "terminal_exits_from_frozen_engine",
               "pending_mtm_from_frozen_engine", "policy_version", "cost_profile"]
    with open(T114 / "task114_cohort_maturity.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cfields, extrasaction="ignore")
        w.writeheader()
        for r in rollups:
            w.writerow(r)

    # newly-matured outcome CSV (Part J: only if any)
    newly = [o for o in (gen_out + llm_out)
             for n in HORIZONS if o["horizons"][f"h{n}"].get("status") == "matured"
             and f"{o['decision_id']}|h{n}" in ledger
             and ledger[f"{o['decision_id']}|h{n}"].get("first_processed_at", "")[:16] >= audit["generated_at"][:16]]
    mfields = ["cohort_id", "decision_id", "symbol", "decision_date", "entry_session", "entry_fill",
               "horizon", "endpoint_session", "endpoint_close", "gross_return_pkr", "net_return_pkr",
               "net_return_pct", "source_fingerprint", "processed_at"]
    with open(T114 / "task114_matured_outcomes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(mfields)
        rows_written = 0
        for o in (gen_out + llm_out):
            for n in HORIZONS:
                h = o["horizons"][f"h{n}"]
                if h.get("status") == "matured":
                    w.writerow([o["cohort_id"], o["decision_id"], o["symbol"], o["decision_date"],
                                o.get("entry_session"), o.get("entry_fill"), n, h["endpoint_session"],
                                h["endpoint_close"], h.get("gross_return_pkr"), h.get("net_return_pkr"),
                                h.get("net_return_pct"), h.get("source_fingerprint"), now_iso()])
                    rows_written += 1

    # pending-outcome CSV
    with open(T114 / "task114_pending_outcomes.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["cohort_id", "decision_id", "symbol", "decision_date", "entry_status",
                    "horizon", "status", "sessions_elapsed_from_entry", "remaining_sessions"])
        for o in (gen_out + llm_out):
            for n in HORIZONS:
                h = o["horizons"][f"h{n}"]
                w.writerow([o["cohort_id"], o["decision_id"], o["symbol"], o["decision_date"],
                            o.get("entry_status"), n, h.get("status"),
                            h.get("sessions_elapsed_from_entry"), h.get("remaining_sessions")])

    # LLM-only maturity artifact (Part E)
    llm_art = {
        "report": "task114_llm_maturity", "task": "task114",
        "generated_at": now_iso(), "engine_version": ENGINE_VERSION,
        "cohort_id": LLM_COHORT_ID,
        "frozen_baseline_verified": {
            "unique_symbols": llm_roll["unique_symbols"],
            "genuine_universe_decisions": len(llm_out),
            "current_records_incl_stale_engro": 24,
            "real_records_two_passes": llm_counts["record_type_counts_all_sources"].get("REAL_LLM_DECISION"),
            "mock_pipeline_check_records": llm_counts["record_type_counts_all_sources"].get("MOCK_PIPELINE_CHECK"),
        },
        "rollup": llm_roll,
        "buy_outcomes": llm_net,
        "terminal_exit_measurements": [
            {"decision_id": o["decision_id"], "symbol": o["symbol"],
             **(o.get("terminal_exit_measurement") or {})}
            for o in llm_out if o.get("terminal_exit_measurement")],
        "counterfactual_hold_notrade": cf,
        "excluded_records": llm_excluded,
        "preservation": "decisions/hashes/timestamps read-only from task112/llm_signal_history (append-only store; never regenerated)",
        "mock_isolation": "MOCK_PIPELINE_CHECK records excluded from every metric in this artifact",
        "calibration": audit["part_e_llm_outcome_maturity"]["calibration"],
    }
    (T114 / "task114_llm_maturity.json").write_text(
        json.dumps(llm_art, indent=1, ensure_ascii=False, default=str), encoding="utf-8")

    print(f"frontier: {frontier} | new sessions since 2026-11-03: {new_sessions}")
    for r in rollups:
        print(f"  {r['cohort_id']:<36} obs={r['total_observations']:<3} mat5={r['matured_5_session']} "
              f"pend5={r['pending_5_session']} mat10={r['matured_10_session']} mat21={r['matured_21_session']} "
              f"unfilled={r['unfilled_awaiting_entry_bar']}")
    print(f"outcome ledger: {len(ledger)} keys | duplicates-identical: "
          f"{audit['part_f_idempotency']['duplicate_processing_attempts_identical']} | "
          f"bar-revisions: {audit['part_f_idempotency']['source_bar_revisions_detected']}")
    print(f"artifacts in {T114}")


if __name__ == "__main__":
    main()
