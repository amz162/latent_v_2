#!/usr/bin/env python3
"""Task 110 — forward validation, PSX Golden Cross (7/30 SMA), volatility
analytics, options/convexity research & production dashboards. Resumable runner.

Phases:
  1  python file audit (psx_simulator.py — absent from environment => spec-based audit)
  2  market data inventory / coverage / adjustment / calendar   (4 artifacts)
  3  MA7/MA30 indicator report + signals                        (2 artifacts)
  4  Golden Cross / Death Cross signals + trade events          (2 artifacts)
  5  cash-constrained portfolio simulation + ledgers            (5 artifacts)
  6  volatility indicators, series, derivatives                 (4 artifacts)
  7  volatility regimes, guidance rules, option availability    (4 artifacts)
  10 forward cross signals + volatility observations + maturity (4 artifacts)
  11 registry + capital protection (research_only enforcement)  (2 artifacts)
  12 original Task 109/110 forward-evidence audit               (5 artifacts)
  15 final summary (49 verified answers)                        (1 artifact)

Usage: python3 scripts/task110_runner.py --phase N | --range A-B | --all
Rules: frozen Task 100-109 artifacts preserved; research_only everywhere; no
real orders; no shorts; no option execution; MTM never realized; raw prices
labeled raw; estimated timestamps never labeled verified.
"""
from __future__ import annotations
import argparse, json, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task110_lib as L  # noqa: E402
import task110_phases_research as R  # noqa: E402

T110 = L.T110
STATE = T110 / "_runner_state.json"
_inds_cache: dict | None = None


def load_state() -> dict:
    return L.jread(STATE) if STATE.exists() else {"phases": {}, "artifacts": {}}


def save_state(st: dict) -> None:
    L.jwrite(STATE, st)


def inds():
    global _inds_cache
    if _inds_cache is None:
        _inds_cache = {s: R.compute_symbol_indicators(s) for s in L.universe()}
    return _inds_cache


def run_phase(n: int, st: dict) -> None:
    t0 = time.time()
    print(f"--- task110 phase {n} start ---", flush=True)
    if n == 2:
        R.p2_data_inventory()
    elif n == 3:
        R.p3_ma_report()
    elif n == 4:
        R.p4_golden_cross(L.universe())
    elif n == 5:
        R.p5_portfolio(inds())
    elif n == 6:
        import task110_phases_vol as V
        V.p6_volatility(inds())
    elif n == 7:
        import task110_phases_vol as V
        V.p7_regimes(inds())
    elif n == 10:
        import task110_phases_forward as F
        F.p10_forward(inds())
    elif n == 11:
        import task110_phases_forward as F
        F.p11_registry()
    elif n == 12:
        import task110_phases_forward as F
        F.p12_original_forward()
    elif n == 1:
        import task110_phase_audit as A
        A.p1_audit()
    elif n in (8, 9, 13, 14):
        print(f"phase {n}: driven by TS components / test suites / docs step — see runner --qa")
        return
    else:
        raise SystemExit(f"unknown phase {n}")
    st["phases"][str(n)] = {"status": "completed", "seconds": round(time.time() - t0, 1)}
    save_state(st)
    print(f"--- task110 phase {n} done in {round(time.time()-t0,1)}s ---", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", type=int)
    ap.add_argument("--range", type=str)
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    st = load_state()
    if a.phase:
        run_phase(a.phase, st)
    elif a.range:
        lo, hi = (int(x) for x in a.range.split("-"))
        for n in range(lo, hi + 1):
            run_phase(n, st)
    elif a.all:
        for n in [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]:
            try:
                run_phase(n, st)
            except Exception as e:  # bounded failure: log, continue, report honestly
                st["phases"][str(n)] = {"status": "failed", "error": repr(e)}
                save_state(st)
                print(f"PHASE {n} FAILED: {e!r}", flush=True)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
