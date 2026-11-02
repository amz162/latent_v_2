#!/usr/bin/env python3
"""Task 102 — phase runner (150s limit; resumable).
Usage: python3 scripts/task102_runner.py --phase <name> [--resume]
       python3 scripts/task102_runner.py --phase all --resume
"""
from __future__ import annotations
import argparse, json, sys, time
from pathlib import Path

sys.path.insert(0, "/home/z/my-project/scripts")
import task102_lib as L  # noqa: E402

PHASE_ORDER = ["baseline", "market_audit", "kse100", "pit_fundamentals", "corporate_actions",
                "intraday", "feature_store", "regime_sector", "labels102", "feature_value",
                "validation", "evaluation", "strategy_cmp", "registry_promotion",
                "paper_audit", "shadow_monitoring", "qa", "finalize"]

EXTERNAL = {"market_audit": ("python3", "scripts/task102_market_data_audit.py"),
             "kse100": ("python3", "scripts/task102_kse100_fetch.py"),
             "pit_fundamentals": ("python3", "scripts/task102_pit_fundamentals.py")}
ALIAS = {"shadow_monitoring": "paper_audit"}  # paper_audit writes both artifacts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--phase", required=True)
    ap.add_argument("--resume", action="store_true")
    args = ap.parse_args()
    phases = PHASE_ORDER if args.phase == "all" else [args.phase]
    prog = {}
    if L.PROGRESS_FILE.exists():
        try:
            prog = json.loads(L.PROGRESS_FILE.read_text()).get("phases", {})
        except Exception:
            prog = {}
    import subprocess
    for ph in phases:
        if args.resume and prog.get(ph, {}).get("status") == "done":
            print(f"skip {ph} (done)"); continue
        t0 = time.time()
        ph_fn = ALIAS.get(ph, ph)
        if ph in EXTERNAL:
            r = subprocess.run(EXTERNAL[ph], cwd=L.ROOT, timeout=140)
            if r.returncode != 0:
                print(f"PHASE {ph} FAILED rc={r.returncode}"); sys.exit(1)
            L.update_progress(ph, "done", f"external script rc=0 ({time.time()-t0:.0f}s)")
        else:
            import task102_phases as P
            getattr(P, f"phase_{ph}")(args)
        print(f"== {ph} ok ({time.time()-t0:.0f}s)")


if __name__ == "__main__":
    main()
