#!/usr/bin/env python3
"""Task 98b — build data/askanalyst/sector_overrides.json.

Category sources (in precedence order, enforced server-side in
src/app/api/psx/companies/route.ts):
  1. live sources (pypsx/psxdata sector map)
  2. AskAnalyst snapshot (data/askanalyst/companylist.json)
  3. THIS file — curated categories for instruments none of the above cover:
     - Government debt securities auctioned/traded on PSX (verified online:
       T-bills, PIBs, GoP Ijara Sukuk — see docs/askanalyst-api.md sources)
     - Corporate debt: Term Finance Certificates (TFC), corporate Sukuk /
       subscription certificates (*SC / *TSC — verified: FABLSC "Rated,
       Unsecured, Subordinated Sukuk", PSX press releases)
     - Rights issues (*R / *R1 / *TSC-R suffixes — PSX right-share series)
     - Named companies/funds resolved by per-symbol web search
       (scripts/search_symbol_categories.py results, hand-curated below)
     - Anything still unresolvable → "Others" (rendered by the UI as Others)
"""
import json, re
from pathlib import Path

OUT = Path("data/askanalyst/sector_overrides.json")

# ── hand-curated from per-symbol web search results (2026-10-31) ─────────────
S_INV = "INV. BANKS / INV. COS. / SECURITIES COS."
S_FUND = "CLOSE - END MUTUAL FUND"
S_MOD = "MODARABAS"
CURATED = {
    # confirmed by batch-1 searches (company names resolved in snippets):
    "MCBIM": S_INV,      # "MCB Investment Management Limited — NBFC" (search 1)
    "AHL": S_INV,        # "Arif Habib Limited" (dps.psx quote)
    "FNEL": S_INV,       # "First National Equities Limited" (dps.psx quote)
    "OLPL": S_MOD,       # "OLP Financial Services Pakistan Limited" (dps.psx quote)
    "LSECL": S_INV,      # "LSE Capital Limited — Modaraba Management Company" (dps.psx quote)
    "LSEFSL": S_INV,     # "LSE Financial Services Limited / LSE SPAC-II" (press)
    "CYAN": S_INV,       # Cyan Limited — stockanalysis sector "Financials" (Lakson group investment co)
    "JSIL": S_FUND,      # "JSIL. JS Investments" (PSX closing rates)
    "ENGROH": S_INV,     # "Engro Holdings ... traded under ENGROH" (engro holdings site)
    "DHPL": S_INV,       # "DH Partners Limited (PSX: DHPL) debut" (Business Recorder)
    "786": S_INV,        # "786 Investments Limited — NBFC" (fund snapshot)
    "ARM": S_INV,        # "listed under Investment Banks / Investment Companies / Securities Companies sector"
}
# populated by CURATED.update({...}) blocks appended during curation

# ── instrument-family patterns (verified online, see docstring) ───────────────
FAMILIES = [
    (re.compile(r"^\d+TB\d*$|^\d*TB$"), "Government Securities — Treasury Bills"),
    (re.compile(r"^P\d+GIS\d*$"), "Government Securities — Ijara Sukuk"),
    (re.compile(r"^P\d+PIB\d*$"), "Government Securities — Pakistan Investment Bonds"),
    (re.compile(r"^P\d+(PFL|FRR|VRR|GHS|PFA|FRZ|GVR)\d*$|^C\d+$"), "Government Securities — Fixed Income"),
    (re.compile(r"TFC\d*$"), "Corporate Debt — Term Finance Certificates"),
    (re.compile(r"(SC|TSC)\d*$"), "Corporate Debt — Sukuk / Subscription Certificates"),
    (re.compile(r"^(GCILB|KFGB1)$"), "Corporate Debt — Guaranteed Bonds"),
]

RIGHTS = "Rights Shares (Issue)"


def classify(sym: str, all_symbols: set):
    for pat, cat in FAMILIES:
        if pat.search(sym) and cat:
            return cat
    # rights convention: base symbol + R + series number (e.g. MLCFR1 = MLCF right) —
    # only when the base symbol itself is a listed instrument
    m = re.match(r"^(.+?)R\d*$", sym)
    if m and m.group(1) != sym and m.group(1) in all_symbols:
        return RIGHTS
    return None


def main():
    api = json.load(open("/tmp/companies_api.json"))["companies"]
    all_symbols = {c["value"] for c in api}
    missing = sorted({c["value"] for c in api if not c.get("sector")})
    sectors = {}
    resolved_by = {"pattern": [], "curated": [], "unresolved": []}
    for s in missing:
        cat = CURATED.get(s) or classify(s, all_symbols)
        if cat:
            sectors[s] = cat
            resolved_by["curated" if s in CURATED else "pattern"].append(s)
        else:
            resolved_by["unresolved"].append(s)
    artifact = {
        "generated_at": "2026-10-31",
        "purpose": "sector categories for instruments not covered by live sources or the AskAnalyst snapshot",
        "verification": "families verified via web search (PSX press releases / news); per-symbol searches in /tmp/symbol_search.json",
        "counts": {
            "missing_input": len(missing),
            "resolved_pattern": len(resolved_by["pattern"]),
            "resolved_curated": len(resolved_by["curated"]),
            "unresolved": len(resolved_by["unresolved"]),
        },
        "unresolved_symbols": resolved_by["unresolved"],
        "sectors": sectors,
    }
    OUT.write_text(json.dumps(artifact, indent=1))
    print(f"sectors: {len(sectors)} | unresolved: {len(resolved_by['unresolved'])}")
    print("unresolved:", resolved_by["unresolved"])


if __name__ == "__main__":
    main()
