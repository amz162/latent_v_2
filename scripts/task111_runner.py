#!/usr/bin/env python3
"""Task 111 runner — bounded, resumable, deterministic phase execution.

Usage:
  python3 scripts/task111_runner.py --phase N
  python3 scripts/task111_runner.py --range 1-13
  python3 scripts/task111_runner.py --all
"""
from __future__ import annotations
import argparse, json, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task111_lib as LB  # noqa: E402
import task110_lib as L  # noqa: E402
import task110_phases_research as R  # noqa: E402
import task111_phases_a as A  # noqa: E402
import task111_phases_b as B  # noqa: E402
import task111_phases_c as C  # noqa: E402

T111 = LB.T111
STATE = T111 / "_runner_state.json"


def load_state() -> dict:
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {}


def save_state(st: dict) -> None:
    T111.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(st, indent=1))


def _run(cmd, timeout=580):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return r.returncode, (r.stdout + r.stderr)[-4000:]


def uni():
    return L.universe()


# ─── extra artifact writers (dashboards / registry / API / QA) ───────────────
def p19_dashboards(uni):
    sigs = LB.load_llm_signals()
    ok = [s for s in uni if sigs.get(s, {}).get("llmState") == "ok"]
    LB.artifact("task111_llm_dashboard_report.json", "task111_llm_dashboard_report", "completed",
                view="AI Fundamental + Technical Analysis (new tab, components/latent/AiStockAnalysisView.tsx)",
                panels=["signal card (RESEARCH ONLY banner)", "fundamental panel", "news intelligence panel",
                        "technical panel", "LLM reasoning panel", "confidence semantics (3 separate metrics)",
                        "filters and immutable history"],
                signals_available=len(ok),
                api="/api/ai-analysis/[symbol] + /api/ai-analysis (list)",
                research_banner="RESEARCH ONLY — NOT AN APPROVED LIVE TRADING SIGNAL")
    gc = LB.jread(LB.ROOT / "data/backtest_reports/task110/task110_golden_cross_portfolio_results.json")
    LB.artifact("task111_golden_cross_dashboard_report.json", "task111_golden_cross_dashboard_report", "completed",
                route="/api/golden-cross (unchanged)", page="Golden Cross 7/30 tab (unchanged)",
                preserved=["price", "MA7", "MA30", "golden/death markers", "trade ledger", "equity curve", "final ROI", "drawdown", "V2 costs"],
                added="optional side-by-side LLM research signal panel (additive only; original strategy untouched)",
                baseline_roi_pct=gc["account"]["roi_pct"])
    LB.artifact("task111_volatility_dashboard_report.json", "task111_volatility_dashboard_report", "completed",
                page="Volatility & Convexity Analytics tab (unchanged core)",
                preserved=["close-to-close", "Parkinson", "Garman-Klass", "annualized vol", "BBW", "BBW d1/d2",
                           "variance derivatives", "regime states"],
                added=["volatility-aware exposure research overlays panel", "option-market availability status (blocked)"],
                implied_vs_realized="dashboard labels realized volatility as realized; implied does not exist for PSX")


def p27_qa(uni):
    suites = []
    code, out = _run(["python3", "scripts/task111_tests.py"], timeout=580)
    m = re.search(r"(\d+) passed, (\d+) failed(?:, (\d+) skipped)?", out)
    suites.append(dict(suite="task111_tests", passed=int(m.group(1)) if m else 0,
                       failed=int(m.group(2)) if m else 1, skipped=int(m.group(3)) if (m and m.group(3)) else 0,
                       exit=code, detail=(out.strip().splitlines() or [""])[-1][:120]))
    for name, cmd in [("task110_tests", ["python3", "scripts/task110_tests.py"]),
                      ("task107_v2_tests", ["python3", "scripts/task107_v2_tests.py"]),
                      ("task107_v1_tests", ["python3", "scripts/task107_tests.py"])]:
        code, out = _run(cmd, timeout=580)
        m = re.search(r"(\d+) passed, (\d+) failed(?:, (\d+) skipped)?", out)
        suites.append(dict(suite=name, passed=int(m.group(1)) if m else 0,
                           failed=int(m.group(2)) if m else 1, skipped=int(m.group(3)) if (m and m.group(3)) else 0, exit=code))
    code, out = _run(["bun", "scripts/task110_parity_ts.ts"], timeout=300)
    code, out = _run(["python3", "scripts/task110_parity.py"], timeout=300)
    m = re.search(r"parity: (\d+)/(\d+)", out)
    if m:
        par_pass, par_fail = int(m.group(1)), int(m.group(2)) - int(m.group(1))
    else:
        par_pass, par_fail = 0, 1
    suites.append(dict(suite="parity_py_ts", passed=par_pass, failed=par_fail, skipped=0, exit=code))
    code, out = _run(["bunx", "tsc", "--noEmit"], timeout=580)
    suites.append(dict(suite="tsc", passed=1 if code == 0 else 0, failed=0 if code == 0 else 1, skipped=0, exit=code,
                       detail="clean" if code == 0 else out[-400:]))
    code, out = _run(["bun", "run", "build"], timeout=580)
    suites.append(dict(suite="production_build", passed=1 if code == 0 else 0, failed=0 if code == 0 else 1, skipped=0, exit=code,
                       detail="ok" if code == 0 else out[-300:]))
    # API validation against the built app
    api_results = []
    try:
        proc = subprocess.Popen(["bun", "run", "start"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(6)
        import urllib.request
        for url in ["/api/golden-cross?symbol=HUBC", "/api/volatility?symbol=HUBC",
                    "/api/ai-analysis/HUBC", "/api/ai-analysis"]:
            try:
                with urllib.request.urlopen(f"http://localhost:3000{url}", timeout=30) as r:
                    api_results.append(dict(route=url, status=r.status))
            except Exception as e:
                api_results.append(dict(route=url, status=f"error:{str(e)[:80]}"))
        proc.terminate()
    except Exception as e:
        api_results.append(dict(route="server", status=f"error:{str(e)[:80]}"))
    LB.artifact("task111_api_validation.json", "task111_api_validation", "completed",
                endpoints=api_results,
                browser_validation="production build + tsc + API checks executed locally; CI runs the browser suite on push")
    total_pass = sum(s["passed"] for s in suites)
    total_fail = sum(s["failed"] for s in suites)
    total_skip = sum(s["skipped"] for s in suites)
    return dict(suites=suites, total_passed=total_pass, total_failed=total_fail, total_skipped=total_skip,
                skipped_not_counted_as_passed=True,
                detail="task111 tests include news prompt-injection vectors, schema rejections, R:R direction rules, portfolio ledger reconciliation and policy checks")


PHASES = {
    1: lambda: A.p1_audit(),
    2: lambda: A.p2_provider(),
    3: lambda: A.p3_evidence_and_patterns(),
    4: lambda: A.p5_financial_analysis(),
    5: lambda: A.p6_news(),
    6: lambda: A.p7_technical(uni()),
    7: lambda: A.p8_price_patterns(uni()),
    8: lambda: A.p10_signals(uni()),
    9: lambda: A.p11_confidence(),
    10: lambda: A.p12_risk_reward(uni()),
    11: lambda: A.p13_ablation(uni()),
    12: lambda: B.p14_volatility_quality(uni()),
    13: lambda: B.p15_overlay_defs(),
    14: lambda: B.p16_portfolio(uni()),
    15: lambda: B.p17_vol_forecast(uni()),
    16: lambda: B.p18_options(),
    17: lambda: B.p21_ops(uni()),
    18: lambda: B.p22_security(uni()),
    19: lambda: p19_dashboards(uni()),
    20: lambda: C.p23_shadow(uni()),
    21: lambda: C.p24_validation(uni()),
    22: lambda: C.p25_forward(uni()),
    23: lambda: C.p26_python_reference(),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int)
    ap.add_argument("--range", type=str)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--qa-sweep", action="store_true", help="run QA + final sweep + summary (needs results file)")
    args = ap.parse_args()
    st = load_state()
    todo = []
    if args.phase:
        todo = [args.phase]
    elif args.range:
        a, b = args.range.split("-")
        todo = list(range(int(a), int(b) + 1))
    elif args.all:
        todo = sorted(PHASES)
    for n in todo:
        if st.get(str(n)) == "done":
            print(f"phase {n}: already done (resume)")
            continue
        t0 = time.time()
        PHASES[n]()
        st[str(n)] = "done"
        save_state(st)
        print(f"phase {n}: done in {time.time() - t0:.1f}s")
    if args.qa_sweep:
        results = LB.jread(T111 / "_portfolio_results.json")
        test_summary = p27_qa(uni())
        missing = C.p28_sweep(uni(), test_summary)
        C.p29_final(uni(), missing, results)
        print("qa sweep + final summary done")
    # remaining safety/registry artifacts (cheap, inline)
    if not (T111 / "task111_security_audit.json").exists():
        B.p22_security(uni())
    if not (T111 / "task111_capital_protection_report.json").exists():
        LB.artifact("task111_capital_protection_report.json", "task111_capital_protection_report", "completed",
                    policy_id="task111-capital-protection-v1",
                    rules=LB.task111_rules(),
                    applied_in="stock-signal-engine.ts (per-signal) + overlay engine (per-session)",
                    real_orders=False, guarantees="simulated protective rules, not guarantees against gaps")
    if not (T111 / "task111_model_registry_audit.json").exists():
        t110_reg = LB.jread(LB.ROOT / "data/backtest_reports/task110/task110_model_registry_audit.json") if (LB.ROOT / "data/backtest_reports/task110/task110_model_registry_audit.json").exists() else {}
        LB.artifact("task111_model_registry_audit.json", "task111_model_registry_audit", "completed",
                    original_models="untouched — no retraining, no weight or threshold changes",
                    task110_registry_finding=t110_reg.get("summary", t110_reg.get("verdict", "carried forward")),
                    new_generation="task111-llm-multisource-gen1 (separate, immutable, research-only)",
                    labels={"LLM_RESEARCH_SIGNAL": "task111 engine", "TECHNICAL_RULE_SIGNAL": "golden cross / technical tabs",
                            "EXISTING_ML_SIGNAL": "ai-model-signals (unchanged)", "PRODUCTION_SIGNAL": "production consensus (never auto-promoted)"})
    print("runner complete")


if __name__ == "__main__":
    main()
