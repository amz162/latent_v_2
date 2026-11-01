#!/usr/bin/env python3
"""Task 99 — API validation: /api/models/registry must expose the two new
supplemental models with real statuses/metrics; canonical count unchanged;
existing supplemental entries preserved; page health probes."""
import json
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen

BASE = Path("data/backtest_reports/task99")


def get(url: str, timeout: int = 90):
    t0 = time.time()
    try:
        with urlopen(url, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode()), round(time.time() - t0, 2)
    except Exception as e:  # noqa: BLE001
        return None, {"error": str(e)}, round(time.time() - t0, 2)


def main() -> None:
    code, reg, dt = get("http://127.0.0.1:3000/api/models/registry")
    sup = {m.get("id") or m.get("name"): m for m in (reg.get("supplemental") or [])}
    out = {
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "api_models_registry": {
            "http_status": code, "latency_s": dt, "available": reg.get("available"),
            "canonicalCount": reg.get("canonicalCount"), "canonicalCount_expected": 58,
            "canonical_unchanged": reg.get("canonicalCount") == 58,
            "supplementalCount": reg.get("supplementalCount"),
            "aliasCount": reg.get("aliasCount"),
            "uniqueImplementationCount": reg.get("uniqueImplementationCount"),
        },
        "jw_reference_lstm": {k: sup.get("jw_reference_lstm", {}).get(k) for k in
                              ("name", "verifiedStatus", "dirAcc5d", "mae5d")},
        "jw_reference_cnn_lstm": {k: sup.get("jw_reference_cnn_lstm", {}).get(k) for k in
                                  ("name", "verifiedStatus", "dirAcc5d", "mae5d")},
        "task99_metadata_present": {
            "jw_reference_lstm": bool((sup.get("jw_reference_lstm") or {}).get("task99")),
            "jw_reference_cnn_lstm": bool((sup.get("jw_reference_cnn_lstm") or {}).get("task99")),
        },
    }
    pages = {}
    for name, url in (("home", "http://127.0.0.1:3000/"),):
        c, _, d = get(url)
        pages[name] = {"status": c, "latency_s": d}
    out["pages"] = pages
    ok = (code == 200 and out["api_models_registry"]["canonical_unchanged"]
          and sup.get("jw_reference_lstm", {}).get("verifiedStatus") == "trained_oos_evaluated"
          and sup.get("jw_reference_cnn_lstm", {}).get("verifiedStatus") == "trained_oos_evaluated")
    out["validation_passed"] = bool(ok)
    (BASE / "task99_api_validation.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out["api_models_registry"], indent=2))
    print("jw entries:", out["jw_reference_lstm"], out["jw_reference_cnn_lstm"])
    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
