#!/usr/bin/env python3
"""Task 102 — genuine KSE-100 index integration (spec Phase 2).
Attempts every known permitted provider; on success validates + stores genuine
observations (never proxy). On failure records exact blockers and emits the
coverage/status artifacts; internal proxy stays separately labeled."""
from __future__ import annotations
import json, subprocess, sys, time
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent))
import task102_lib as L  # noqa: E402

OUT_JSON = L.BASE / "kse100_index_data.json"

PROVIDERS = [
    ("yahoo_finance_chart_v8",
     "https://query1.finance.yahoo.com/v8/finance/chart/%5EKSE100?interval=1d&range=20y"),
    ("stooq_csv", "https://stooq.com/q/d/l/?s=kse100&i=d"),
    ("psx_data_portal", "https://dps.psx.com.pk/api/historic"),
]

def attempt(provider: str, url: str) -> dict:
    try:
        r = subprocess.run(["curl", "-sS", "--max-time", "25", "-H",
                             "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                             url, "-o", f"/tmp/kse_{provider}.out", "-w", "%{http_code} %{size_download}"],
                            capture_output=True, text=True, timeout=40)
        code, _, size = r.stdout.partition(" ")
        p = Path(f"/tmp/kse_{provider}.out")
        ok = code == "200" and int(size or 0) > 1000
        return {"provider": provider, "http": code, "bytes": int(size or 0), "success": ok,
                 "head": (p.read_text()[:200] if p.exists() and p.stat().st_size else "")}
    except Exception as e:
        return {"provider": provider, "success": False, "error": str(e)[:150]}

def parse_yahoo(path: str) -> pd.DataFrame | None:
    try:
        d = json.loads(Path(path).read_text())
        res = d["chart"]["result"][0]
        ts = res["timestamp"]
        q = res["indicators"]["quote"][0]
        df = pd.DataFrame({"ts": ts, "open": q["open"], "high": q["high"],
                            "low": q["low"], "close": q["close"], "volume": q["volume"]}).dropna()
        return df
    except Exception:
        return None

def main() -> None:
    t0 = time.time()
    attempts = [L.KSE100_PROVIDERS_ATTEMPTED[0], L.KSE100_PROVIDERS_ATTEMPTED[2],
                 L.KSE100_PROVIDERS_ATTEMPTED[3], L.KSE100_PROVIDERS_ATTEMPTED[4],
                 L.KSE100_PROVIDERS_ATTEMPTED[5]]
    live = []
    for provider, url in PROVIDERS:
        a = attempt(provider, url)
        live.append(a)
        if a.get("success") and provider == "yahoo_finance_chart_v8":
            df = parse_yahoo(f"/tmp/kse_{provider}.out")
            if df is not None and len(df) > 100:
                recs = [{"date": pd.to_datetime(t, unit="s", utc=True).strftime("%Y-%m-%d"),
                          "open": round(float(r.open), 2), "high": round(float(r.high), 2),
                          "low": round(float(r.low), 2), "close": round(float(r.close), 2),
                          "volume": None if pd.isna(r.volume) else float(r.volume),
                          "provider": provider, "retrieved_at": time.strftime(
                              "%Y-%m-%dT%H:%M:%S+0000", time.gmtime()),
                          "quality": L.PARTIALLY_VERIFIED,
                          "verification": "single-source; no independent second source reachable "
                                           "for spot-check in this sandbox"}
                        for t, r in zip(df["ts"], df.itertuples())]
                OUT_JSON.write_text(json.dumps(recs, indent=1))
                print(f"KSE100 GENUINE: {len(recs)} rows {recs[0]['date']}..{recs[-1]['date']} "
                      f"-> {OUT_JSON}")
                L.write_artifact("task102_kse100_coverage.json", {
                    "status": L.PARTIALLY_VERIFIED, "source": provider,
                    "rows": len(recs), "range": [recs[0]["date"], recs[-1]["date"]],
                    "stored_at": str(OUT_JSON), "attempts": attempts + live})
                return
        if a.get("success") and provider == "psx_data_portal":
            print("psx portal reachable but response schema unknown; recorded for manual follow-up")
    # No provider succeeded -> blocked path (spec-compliant fallback)
    L.write_artifact("task102_kse100_coverage.json", {
        "status": L.BLOCKED_EXTERNAL_DATA,
        "genuine_index_data_available": False,
        "conclusion": "Genuine historical KSE-100 index data could NOT be obtained from any "
                       "permitted source reachable in this sandbox. No index observations were "
                       "created, downloaded or fabricated. The internal market proxy "
                       "(pilot25 equal-weight breadth, market_internal_proxy) remains available "
                       "and SEPARATELY LABELED; it is never presented as the KSE-100 index.",
        "attempts": attempts + live,
        "requirements_to_unblock": [
            "manual download of PSX KSE-100 EOD history (CSV) placed at "
            "data/backtest_reports/task102/raw_external_data/kse100_official_eod.csv "
            "(source: PSX Data Portal / owner account)",
            "or any permitted vendor API key in .env (e.g. KSE_DATA_PROVIDER_KEY)",
            "the adapter src/lib/market-data/kse100-provider.ts auto-detects either and "
            "switches status to verified/partially_verified without code changes"],
        "adapter": "src/lib/market-data/kse100-provider.ts",
        "regime_features": "computed from the internal proxy only, feature group "
                            "technical_market_regime_v1 carries an explicit proxy label",
        "at": time.strftime("%Y-%m-%dT%H:%M:%S+0000", time.gmtime())})
    print(f"kse100: BLOCKED ({time.time()-t0:.0f}s); status artifact written")

if __name__ == "__main__":
    main()
