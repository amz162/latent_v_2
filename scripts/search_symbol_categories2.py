#!/usr/bin/env python3
"""Task 98b batch 2 — exact-quoted searches for symbols that batch 1 missed.
Query targets the 'SYM - Stock quote for X Limited - PSX Data Portal' pattern."""
import json, subprocess, time, re

# symbols still unresolved after batch 1 (excluded rights that resolve via base symbol)
SYMBOLS = [
    "PIAA", "PIAB", "PIAHCLA", "PIAHCLB", "PSX", "QUSW", "SALT", "SIBL", "TRIBL",
    "TSBL", "ASCR1", "HSMPSR", "AYTM", "AWWAL", "SJTM", "ITSL", "IMS", "ILTM",
    "MCBAH", "MODAM", "ESBL", "EFGH", "FUDLM", "DATM", "DCM", "DLL", "PASL",
    "FCIBL", "FDIBL", "IGIBL", "ICIBL", "FDPL", "BIPLS", "PDGH", "MOIL", "META",
    "NEXT", "INL", "HMM", "GTECH", "GCILB", "FCEL", "DEL", "DAWH", "BRR", "CASH",
    "COST", "ARMG", "BPBL", "AKZO", "AMSL", "AMBL", "JOVC", "KFGB1", "LSEPL",
    "LSEVL", "EXTR", "PRIB", "786", "CYAN", "EWICR1",
]

OUT = "/tmp/symbol_search2.json"
try:
    done = json.load(open(OUT))
except Exception:
    done = {}

for i, sym in enumerate(SYMBOLS, 1):
    if sym in done:
        continue
    q = f'"{sym}" PSX "Stock quote for" OR "Limited" company listed'
    try:
        r = subprocess.run(
            ["z-ai", "function", "-n", "web_search", "-a", json.dumps({"query": q, "num": 4})],
            capture_output=True, text=True, timeout=40)
        m = re.search(r"\[.*\]", r.stdout, re.S)
        results = []
        if m:
            for item in json.loads(m.group(0))[:4]:
                results.append({"name": (item.get("name") or "")[:140],
                                "snippet": (item.get("snippet") or "")[:260]})
        done[sym] = results
        first = results[0]["name"][:90] if results else "NO RESULTS"
        print(f"[{i}/{len(SYMBOLS)}] {sym}: {first}", flush=True)
    except Exception as e:
        done[sym] = [{"name": "ERROR", "snippet": str(e)[:100]}]
        print(f"[{i}/{len(SYMBOLS)}] {sym}: ERROR", flush=True)
    json.dump(done, open(OUT, "w"), indent=1)
    time.sleep(0.25)
print("saved", OUT)
