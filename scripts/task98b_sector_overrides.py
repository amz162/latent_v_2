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
S_RIGHTS = "Rights Shares (Issue)"
S_MISC = "MISCELLANEOUS"
S_GDS = "Government Securities — Fixed Income"
CURATED = {
    # batch-1 confirmations (company names resolved in search snippets)
    "MCBIM": S_INV,      # "MCB Investment Management Limited — NBFC"
    "AHL": S_INV,        # "Arif Habib Limited" (dps.psx quote)
    "FNEL": S_INV,       # "First National Equities Limited" (dps.psx quote)
    "OLPL": S_MOD,       # "OLP Financial Services Pakistan Limited" (dps.psx quote)
    "LSECL": S_INV,      # "LSE Capital Limited — Modaraba Management Company"
    "LSEFSL": S_INV,     # "LSE Financial Services Limited / LSE SPAC-II"
    "CYAN": S_INV,       # Cyan Limited (stockanalysis sector "Financials")
    "JSIL": S_FUND,      # "JSIL. JS Investments" (PSX closing rates)
    "ENGROH": S_INV,     # "Engro Holdings ... under the symbol ENGROH"
    "DHPL": S_INV,       # "DH Partners Limited (PSX: DHPL)"
    "786": S_INV,        # "786 Investments Limited — NBFC"
    "ARM": S_MOD,        # "ARM - Allied Rental Modaraba Stock Summary"
    # batch-3 confirmations (PSX Data Portal quotes / StockSummary / eligible scrips)
    "PIAA": "TRANSPORT",          # "Pakistan International Airlines Corp"
    "PIAB": "TRANSPORT",          # "Pakistan International Airlines Corporat (PIAB)" (Technicals360)
    "PIAHCLA": S_INV,             # "PIA Holding Company Limited (Class A)" — holding
    "PIAHCLB": S_INV,             # "PIA Holding Company Limited Class B" — "Investment Banks / Investment Companies"
    "PSX": S_MISC,                # Pakistan Stock Exchange Limited (financial market operator)
    "QUSW": "ENGINEERING",        # "Quality Steel Works Limited"
    "SALT": "TEXTILE SPINNING",   # "Salfi Textile Mills Ltd ... a Textile Spinning company"
    "SIBL": S_INV,                # "Security Investment Bank Ltd."
    "TRIBL": S_INV,               # "Trust Investment Bank Limited"
    "TSBL": S_INV,                # "Trust Securities & Brokerage Limited"
    "ASCR1": S_RIGHTS,            # "AL-Shaheer (R)" (dps.psx quote)
    "HSMPSR": S_RIGHTS,           # "Husein Sugar(R)" (dps.psx quote)
    "AYTM": "TEXTILE SPINNING",   # "Ayesha Textile Mills Limited"
    "AWWAL": S_MOD,               # Awwal Modaraba family (name-derived; AWWA = Awwal Modaraba Ltd)
    "SJTM": "TEXTILE SPINNING",   # "Sajjad Textile Mills Limited"
    "ITSL": S_INV,                # "Investec Securities Limited"
    "IMS": S_INV,                 # "Intermarket Securities Limited"
    "ILTM": "TEXTILE COMPOSITE",  # "Island Textile Mills Limited" (GICS "Textiles & Leather Goods")
    "MCBAH": S_INV,               # "MCB-Arif Habib Savings and Investments"
    "MODAM": S_MOD,               # "Modaraba Al-Mali ... Modarabas sector"
    "ESBL": S_INV,                # "Escorts Investment Bank Limited"
    "EFGH": S_INV,                # "EFG Hermes Pakistan Limited"
    "FUDLM": S_MOD,               # "First UDL Modaraba"
    "DATM": "TEXTILE SPINNING",   # "Data Textiles Limited"
    "DLL": "POWER GENERATION & DISTRIBUTION",  # Dawood Lawrencepur Ltd (renewable energy investor now)
    "PASL": S_INV,                # "Pervez Ahmed Consultancy Services Ltd."
    "FCIBL": S_INV,               # "First Credit & Investment Bank Limited"
    "FDIBL": S_INV,               # "First Dawood Investment Bank Limited"
    "IGIBL": S_INV,               # "IGI Investment Bank Limited"
    "ICIBL": S_INV,               # "Invest Capital Investment Bank Limited"
    "FDPL": S_INV,                # "First Dawood Properties (Formerly FDIBL). INV. BANKS / INV. COS"
    "PDGH": S_INV,                # "Prudential Discount & Guarantee House Ltd."
    "NEXT": S_INV,                # "Next Capital Limited (PSX:NEXT)"
    "INL": S_INV,                 # "INL ... Investment Banks / Investment Companies / Securities Companies"
    "HMM": S_MOD,                 # "Habib Metro Mod" (Habib Metro Modaraba)
    "GTECH": "TECHNOLOGY & COMMUNICATION",  # "G3 Technologies Limited"
    "GCILB": "CHEMICAL",          # "Ghani Chemical Industries Limited (B)" — class B shares
    "FCEL": S_INV,                # "First Capital Equities Limited"
    "DEL": S_INV,                 # "Dawood Equities Limited ... INV. BANKS / INV. COS. / SECURITIES COS."
    "DAWH": S_MISC,               # "Dawood Hercules Corporation Limited" (diversified holding)
    "BPBL": "PAPER, BOARD & PACKAGING",  # "Balochistan Particle Board Limited"
    "AKZO": S_MISC,               # "Akzo Nobel Pakistan Limited ... MISCELLANEOUS sector"
    "AMSL": S_INV,                # "AMSL AL-Mal Sec." (PSX listed-companies index)
    "AMBL": "COMMERCIAL BANKS",   # "Apna Microfinance Bank Ltd."
    "KFGB1": "Corporate Debt — Guaranteed Bonds",  # "Kashf Foundation Gender Bond" (PSX eligible scrips)
    "LSEPL": "PROPERTY",          # "LSE Proptech Limited"
    "LSEVL": S_INV,               # "LSE Ventures Limited" (LSE successor investment co)
    "PRIB": S_INV,                # "Prudential Investment Bank Ltd.(Defaulter)"
    "EXTR": "OIL & GAS EXPLORATION COMPANIES",  # "EXTR Extraction" (PSX listed-companies index; name-derived)
    "EWICR1": S_RIGHTS,           # "East West (R)" (dps.psx quote)
}
# populated by CURATED.update({...}) blocks appended during curation

# ── instrument-family patterns (verified online, see docstring) ───────────────
FAMILIES = [
    (re.compile(r"^\d+TB\d*$|^\d*TB$"), "Government Securities — Treasury Bills"),
    (re.compile(r"^P\d+GIS\d*$"), "Government Securities — Ijara Sukuk"),
    (re.compile(r"^P\d+PIB\d*$"), "Government Securities — Pakistan Investment Bonds"),
    (re.compile(r"^P\d+(PFL|FRR|VRR|GHS|PFA|FRZ|GVR)\d*$|^C\d+$"), S_GDS),
    (re.compile(r"TFC\d*$"), "Corporate Debt — Term Finance Certificates"),
    (re.compile(r"(SC|TSC)\d*$"), "Corporate Debt — Sukuk / Subscription Certificates"),
]

RIGHTS = S_RIGHTS


def classify(sym: str, all_symbols: set):
    for pat, cat in FAMILIES:
        if pat.search(sym) and cat:
            return cat
    # rights convention: base symbol + R + series digits (e.g. MLCFR1 = MLCF right;
    # verified via dps.psx "(R)" quotes) — base must exist or prefix-match a listing
    m = re.match(r"^(.+?)R\d+$", sym)
    if m:
        base = m.group(1)
        if base in all_symbols or any(s.startswith(base) for s in all_symbols):
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
