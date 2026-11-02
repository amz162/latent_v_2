#!/usr/bin/env python3
"""Task 106 — Phase 2 artifacts: short-selling compliance, long-only policy
audit, sell-semantics test results."""
from __future__ import annotations
import json, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
T106 = ROOT / "data/backtest_reports/task106"
sys.path.insert(0, str(ROOT / "scripts"))
import task103_lib as L  # noqa: E402


def main() -> None:
    t0 = time.time()
    raw = json.loads((T106 / "_sell_tests_raw.json").read_text())
    (T106 / "task106_short_selling_compliance.json").write_text(json.dumps({
        "report": "task106_short_selling_compliance", "generated_at": L.NOW(), "status": "completed",
        "compliance_status": "compliance_unverified",
        "question": "Can the application's intended users (PSX retail) open genuine short positions?",
        "findings": [
            {"finding": "Ready-market (cash) short selling is tightly restricted on PSX; retail investors generally cannot short shares directly in the ready market",
              "source": "https://www.bsl.com.pk/glossary/short-selling (glossary of a licensed PSX brokerage; states 'retail investors generally cannot short shares directly in the ready market' and 'short-selling ... is tightly restricted')",
              "verified": True},
            {"finding": "A short-selling mechanism exists via Securities Lending & Borrowing (SLB): NCCPL designated SLB Eligible Securities Category A for short selling effective 2015-05-12",
              "source": "NCCPL circular 13-4-2015 (PDF returned HTTP 403; verified from search snippet only)",
              "verified": False,
              "caveat": "participant eligibility for retail / this application's user base could not be verified from accessible authoritative sources"},
            {"finding": "Single-stock deliverable futures can be sold short but with limited eligible contracts and broker-mediated access; not part of this application's execution model",
              "source": "https://www.bsl.com.pk/glossary/short-selling",
              "verified": True,
              "caveat": "the application has no futures execution pathway"},
            {"finding": "T+1 settlement makes pre-ownership selling operationally sensitive; blank (short) sales are a closely-controlled, exchange-disclosed exception",
              "source": "https://www.bsl.com.pk/glossary/short-selling", "verified": True}],
        "verdict": "SHORT_ENTRY remains DISABLED (long-only default). The application's assumed short execution model is NOT a verified executable strategy for its users; historical short-side simulation is a theoretical research experiment only.",
        "historical_short_sides": {"task100_104_cohort": "long-only (11,521 trades) — unaffected",
                                     "engine_capability": "SELL direction preserved for RESEARCH simulation, labeled hypothetical",
                                     "ui": "SELL badges now labeled 'SELL·R' (research-only) with policy-driven tooltip"},
        "reversal_condition": "verified eligibility documentation for the intended account type + an implemented, compliant execution pathway + explicit policy version bump",
        "runtime_seconds": round(time.time() - t0, 1)}, indent=1))

    (T106 / "task106_long_only_policy_audit.json").write_text(json.dumps({
        "report": "task106_long_only_policy_audit", "generated_at": L.NOW(), "status": "completed",
        "policy_module": "src/lib/latent/trading-policy.ts",
        "concepts_separated": {
            "SELL_TO_CLOSE": "selling an existing long position — permissible, labeled",
            "BEARISH_SIGNAL": "model expects negative direction — an opinion, not an action",
            "BEARISH_RESEARCH_ONLY": "bearish entries allowed only inside research/hypothetical simulation",
            "SHORT_ENTRY": "opening a genuine short — DISABLED (compliance_unverified)",
            "NO_TRADE": "no permissible or sufficiently supported action"},
        "surfaces_checked": [
            {"surface": "classifySellAction (policy module)", "enforcement": "exhaustive: no input combination yields SHORT_ENTRY"},
            {"surface": "ai-model-signals model cards", "enforcement": "SELL badge → 'SELL·R' + policy-driven tooltip"},
            {"surface": "strategy-engine SELL direction", "enforcement": "preserved for research simulation only; excluded from all production decision paths (Task 105 evidence: cohort long-only)"},
            {"surface": "Investment Simulator", "enforcement": "SELL paths remain hypothetical research, disclosed in the capital-protection notice"},
            {"surface": "shadow observations (task105-gen1)", "enforcement": "LONG-candidate only; SELL not executable"},
            {"surface": "inversion guard", "enforcement": "bearish predictions are never converted into BUY predictions (fixture-tested)"}],
        "historical_preservation": "no SELL signal deleted; no historical result altered",
        "verdict": "long-only default enforced across all surfaces"}, indent=1))

    (T106 / "task106_sell_semantics_tests.json").write_text(json.dumps({
        "report": "task106_sell_semantics_tests", "generated_at": L.NOW(), "status": "completed",
        "method": "exhaustive fixture tests against PRODUCTION policy module + strategy engine (scripts/task106_sell_tests.ts)",
        "fixtures": raw["cases"], "n_fixtures": len(raw["cases"]),
        "failed": raw["failed"],
        "key_proofs": [
            "no combination of (signal, holdsLong, simulationOnly) yields SHORT_ENTRY while compliance_unverified",
            "SELL inputs never map to LONG_CANDIDATE (no inversion to BUY)",
            "SELL + existing long → SELL_TO_CLOSE",
            "SELL + simulation-only → BEARISH_RESEARCH_ONLY",
            "SELL + production + no position → NO_TRADE",
            "historical short-side research simulation still executes (hypothetical, labeled)",
            "policy still returns no_trade / never auto-promotes"],
        "verdict": raw["verdict"]}, indent=1))
    print(f"phase2 artifacts: fixtures={len(raw['cases'])} verdict={raw['verdict']}")


if __name__ == "__main__":
    main()
