#!/usr/bin/env python3
"""Task 98b — resolve categories for PSX symbols missing sectors (batch web search).
Queries each symbol with PSX context, saves top results for manual curation."""
import json, subprocess, time, sys, re

SYMBOLS = [
    # rights-suffix verification set
    "MLCFR1", "POWERR1", "SEARLR1",
    # fund-family verification
    "MCBIM", "KASBM", "IML", "UBLGSFO", "PAKMI", "DOMF", "GEMUNSL",
    # named oddballs
    "786", "AEL", "AHL", "AKZO", "AMBL", "AMSL", "ARM", "ARMG", "BIPLS", "BPBL",
    "BRR", "CASH", "COST", "CYAN", "DAWH", "DEL", "DHPL", "EFOODS", "ENGROH",
    "EXTR", "FCEL", "FNEL", "GCILB", "GTECH", "GTECHBR", "HMM", "INL", "JOVC",
    "JPGL", "JSCL", "JSGCL", "JSIL", "IFSL", "KFGB1", "LSECL", "LSEFSL", "LSEPL",
    "LSEVL", "META", "MOIL", "NEXT", "OLPL", "PDGH", "PIAA", "PIAB", "PIAHCLA",
    "PRIB", "PSX", "QUSW", "SALT", "SIBL", "TRIBL", "TSBL", "ASCR1", "HSMPSR",
    "AYTM", "AWWAL", "SJTM", "ITSL", "IMS", "ILTM", "MCBAH", "MODAM", "ESBL",
    "EFGH", "FUDLM", "DATM", "DCM", "DLL", "PASL", "FCIBL", "FDIBL", "IGIBL",
    "ICIBL", "FDPL", "EWICR1", "FFLR1", "GAILR1", "GGGLR1", "GGLR1", "IMAGER1",
    "JSBLR1", "JSCLR1", "MUGHALR1", "PRLR1", "TCORPR1", "UNITYR1", "WAVESR1",
    "LSECLR", "LSEFSLR", "LSEVLR", "786R", "GCILR1",
]

OUT = "/tmp/symbol_search.json"
try:
    done = json.load(open(OUT))
except Exception:
    done = {}

for i, sym in enumerate(SYMBOLS, 1):
    if sym in done:
        continue
    q = f"PSX Pakistan Stock Exchange {sym} symbol company sector"
    try:
        r = subprocess.run(
            ["z-ai", "function", "-n", "web_search", "-a", json.dumps({"query": q, "num": 3})],
            capture_output=True, text=True, timeout=40)
        m = re.search(r"\[.*\]", r.stdout, re.S)
        results = []
        if m:
            for item in json.loads(m.group(0))[:3]:
                results.append({"name": (item.get("name") or "")[:110],
                                "snippet": (item.get("snippet") or "")[:230]})
        done[sym] = results
        first = results[0]["name"] if results else "NO RESULTS"
        print(f"[{i}/{len(SYMBOLS)}] {sym}: {first}", flush=True)
    except Exception as e:
        done[sym] = [{"name": "ERROR", "snippet": str(e)[:100]}]
        print(f"[{i}/{len(SYMBOLS)}] {sym}: ERROR {str(e)[:60]}", flush=True)
    json.dump(done, open(OUT, "w"), indent=1)
    time.sleep(0.25)
print("saved", OUT)
