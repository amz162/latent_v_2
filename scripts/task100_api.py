#!/usr/bin/env python3
"""Task 100 — API validation: model registry, walk-forward report (untouched
original + metrics), simulator docs availability, page health."""
import json, time
from pathlib import Path
from urllib.request import urlopen

BASE = Path("data/backtest_reports/task100")

def get(url, timeout=60):
    t0 = time.time()
    try:
        with urlopen(url, timeout=timeout) as r:
            body = r.read().decode()
            return r.status, body, round(time.time() - t0, 2)
    except Exception as e:
        return None, str(e), round(time.time() - t0, 2)

def main():
    out = {"checked_at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime()), "checks": {}}
    c, b, dt = get("http://127.0.0.1:3000/api/models/registry")
    try:
        reg = json.loads(b)
        out["checks"]["api_models_registry"] = {
            "http": c, "latency_s": dt, "canonicalCount": reg.get("canonicalCount"),
            "canonical_58": reg.get("canonicalCount") == 58,
            "supplementalCount": reg.get("supplementalCount"),
            "uniqueImplementationCount": reg.get("uniqueImplementationCount"),
        }
    except Exception:
        out["checks"]["api_models_registry"] = {"http": c, "error": b[:200]}
    c, b, dt = get("http://127.0.0.1:3000/api/backtest/walk-forward")
    try:
        wfj = json.loads(b)
        out["checks"]["api_walk_forward"] = {
            "http": c, "latency_s": dt,
            "n_unique_stock_date_samples": wfj.get("n_unique_stock_date_samples"),
            "original_400_preserved": wfj.get("n_unique_stock_date_samples") == 400,
            "sampling_interval_sessions": wfj.get("sampling_interval_sessions"),
            "n_model_fits": wfj.get("n_model_fits"),
            "models": [m.get("name") for m in wfj.get("models", [])][:8],
        }
    except Exception:
        out["checks"]["api_walk_forward"] = {"http": c, "error": b[:200]}
    for name, path in (("page_home", "/"), ("ai_models", "/?tab=models"),
                       ("portfolio", "/?tab=portfolio")):
        c, b, dt = get(f"http://127.0.0.1:3000{path}", timeout=90)
        out["checks"][name] = {"http": c, "latency_s": dt, "ok": c == 200,
                                "bytes": len(b) if c == 200 else None}
    out["simulator_docs"] = {
        "docs_investment_simulator_metrics_md": (Path("docs/investment-simulator-metrics.md").exists()),
        "data_dictionary_json": (BASE / "task100_simulator_data_dictionary.json").exists(),
    }
    (BASE / "task100_api_validation.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out["checks"], indent=1)[:900])

if __name__ == "__main__":
    main()
