#!/usr/bin/env python3
"""Fetch & persist AskAnalyst API data into data/askanalyst/ so the sandbox has a
durable local snapshot (see docs/askanalyst-api.md for the full endpoint map).

Default pull (idempotent, re-run anytime to refresh):
  - filings/{SYM}.json      for pilot25 universe   (announcements engine)
  - ratios/{SYM}.json       for pilot25 universe   (fundamental engine)
  - index/kse100.json       market-level series    (macro engine proxy)
  - samples/{ep}_{SYM}.json one reference fixture per endpoint (ENGRO)
  - manifest.json           every pull logged with URL, counts, fetched_at

Usage:
  python scripts/fetch_askanalyst.py                 # standard refresh (pilot25)
  python scripts/fetch_askanalyst.py --all           # filings+ratios for ALL listed stocks
  python scripts/fetch_askanalyst.py --symbols PSO,LUCK
  python scripts/fetch_askanalyst.py --endpoints filings,ratios --skip-samples
"""
import json, time, sys, argparse, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone

BASE = "https://api.askanalyst.com.pk/api"
OUT = Path("data/askanalyst")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) latent-research-sandbox"}

PILOT25 = [
    "ANL", "BOP", "BYCO", "CNERGY", "ENGRO", "FCCL", "HASCOL", "HUBC", "HUMNL", "KEL",
    "LOTCHEM", "LUCK", "MEBL", "MLCF", "OGDC", "PAEL", "PIBTL", "PPL", "PRL", "PSO",
    "SYS", "TELE", "TRG", "UNITY", "WTL",
]
SAMPLE_SYM = "ENGRO"
# endpoint slug -> (url template, output subdir, notes)
ENDPOINTS = {
    "filings":   ("filings/{sym}", "filings", "PSX filings / announcements per symbol"),
    "ratios":    ("rationew/{sym}", "ratios", "financial ratios (P/E, ROE, BVPS, D/E...)"),
    "income":    ("incomestatement/{sym}", "income", "annual + quarterly income statement"),
    "financial": ("financialstatement/{sym}", "financials_full", "full BS / P&L / CF statement"),
    "news":      ("news/{sym}", "news", "company news feed"),
    "valuation": ("generatevaluation2/{sym}", "valuation", "AskAnalyst valuation report"),
    "reports":   ("publishreports/{sym}", "reports", "published research reports"),
    "bss":       ("bss/{sym}", "bss", "borrowing & short-selling data"),
    "iss":       ("iss/{sym}", "iss", "insider / substantial shareholding"),
    "settlement": ("settlementchartnew/{sym}", "settlement", "settlement / badla (T+2) rates"),
}


def get(url, retries=2, timeout=30):
    last = None
    for _ in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa: BLE001 - log & retry, raise on final
            last = e
            time.sleep(1.0)
    raise last


def save_json(p: Path, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=1, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="filings+ratios for every listed symbol")
    ap.add_argument("--symbols", default="", help="comma-separated symbol list override")
    ap.add_argument("--endpoints", default="filings,ratios", help="comma-separated endpoint keys")
    ap.add_argument("--skip-samples", action="store_true")
    ap.add_argument("--skip-index", action="store_true")
    args = ap.parse_args()

    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"pulls": []}
    companies = get(f"{BASE}/companylistwithsymbols")
    save_json(OUT / "companylist.json", companies)
    all_syms = [c.get("value", "").strip() for c in companies if c.get("value")]
    universe = PILOT25
    if args.symbols:
        universe = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    elif args.all:
        universe = all_syms
    eps = [e.strip() for e in args.endpoints.split(",") if e.strip()]
    now = datetime.now(timezone.utc).isoformat()

    def log(kind, target, url, n, status, note=""):
        manifest["pulls"].append({"fetched_at": now, "kind": kind, "target": target,
                                  "url": url, "records": n, "status": status, "note": note})
        print(f"  {status:>6} {target} n={n} {note}", flush=True)

    # 1. per-symbol endpoints
    for ep in eps:
        slug, sub, _ = ENDPOINTS[ep]
        ok = fail = 0
        for i, sym in enumerate(universe, 1):
            url = f"{BASE}/{slug.format(sym=sym)}"
            try:
                d = get(url)
                if isinstance(d, dict):
                    d.setdefault("symbol", sym)
                    d["fetched_at"] = now
                elif isinstance(d, list):
                    d = {"symbol": sym, "fetched_at": now, "data": d}
                save_json(OUT / sub / f"{sym}.json", d)
                n = len(d.get("data", [])) if isinstance(d, dict) else len(d)
                ok += 1
                log("symbol", f"{sub}/{sym}", url, n, "ok")
            except Exception as e:  # noqa: BLE001
                fail += 1
                log("symbol", f"{sub}/{sym}", url, 0, "error", str(e)[:80])
            time.sleep(0.35)
        print(f"[{ep}] {ok} ok, {fail} failed, {len(universe)} total", flush=True)

    # 2. KSE-100 index series (macro/market-regime proxy) — probe candidate symbols
    if not args.skip_index:
        idx_path = OUT / "index" / "kse100.json"
        if not args.symbols and not idx_path.exists():
            for cand in ("KSE100", "KSE-100", "100", "KSE"):
                try:
                    d = get(f"{BASE}/ksechartnew/{cand}")
                    blob = json.dumps(d)[:200]
                    if d and len(json.dumps(d)) > 500:
                        d["fetched_at"] = now
                        d["probe_symbol"] = cand
                        save_json(idx_path, d)
                        log("index", "index/kse100.json", f"{BASE}/ksechartnew/{cand}",
                            len(json.dumps(d)), "ok", f"probe={cand}")
                        break
                    log("index", "index/kse100.json", f"{BASE}/ksechartnew/{cand}", 0, "empty", blob[:80])
                except Exception as e:  # noqa: BLE001
                    log("index", "index/kse100.json", f"{BASE}/ksechartnew/{cand}", 0, "error", str(e)[:80])

    # 3. one reference fixture per endpoint (schema documentation)
    if not args.skip_samples:
        for ep, (slug, sub, _) in ENDPOINTS.items():
            url = f"{BASE}/{slug.format(sym=SAMPLE_SYM)}"
            try:
                d = get(url)
                save_json(OUT / "samples" / f"{ep}_{SAMPLE_SYM}.json", d)
                n = len(d.get("data", [])) if isinstance(d, dict) else len(d)
                log("sample", f"samples/{ep}_{SAMPLE_SYM}.json", url, n, "ok")
                time.sleep(0.35)
            except Exception as e:  # noqa: BLE001
                log("sample", f"samples/{ep}_{SAMPLE_SYM}.json", url, 0, "error", str(e)[:80])

    manifest["company_count"] = len(all_syms)
    manifest["last_run"] = now
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    save_json(manifest_path, manifest)
    print(f"manifest: {manifest_path} ({len(manifest['pulls'])} pulls logged)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
