#!/usr/bin/env python3
"""Apply guardUser authorization guards to assigned Next.js API route handlers."""
import re
import sys

ROOT = "/home/z/my-project/"

PERMS = {
    "feature.market_data": [
        "src/app/api/psx/bss/[symbol]/route.ts",
        "src/app/api/psx/filings/[symbol]/route.ts",
        "src/app/api/psx/financial-results/[symbol]/route.ts",
        "src/app/api/psx/financials/[symbol]/route.ts",
        "src/app/api/psx/incomestatement/[symbol]/route.ts",
        "src/app/api/psx/iss/[symbol]/route.ts",
        "src/app/api/psx/ksechart/[symbol]/route.ts",
        "src/app/api/psx/news/[symbol]/route.ts",
        "src/app/api/psx/ohlcv/[symbol]/route.ts",
        "src/app/api/psx/ratio/[symbol]/route.ts",
        "src/app/api/psx/reports/[symbol]/route.ts",
        "src/app/api/psx/settlement/[symbol]/route.ts",
        "src/app/api/psx/valuation/[symbol]/route.ts",
        "src/app/api/psx/companies/route.ts",
        "src/app/api/psx/intraday/route.ts",
        "src/app/api/psx/live/route.ts",
        "src/app/api/psx/live/batch/route.ts",
        "src/app/api/psx/indices/route.ts",
        "src/app/api/psx/indices/[name]/route.ts",
        "src/app/api/psx/index-return/route.ts",
        "src/app/api/psx/screener/route.ts",
        "src/app/api/psx/sectors/route.ts",
        "src/app/api/psx/sectors/[name]/stocks/route.ts",
        "src/app/api/psx/symbol-sectors/route.ts",
        "src/app/api/psx/technical/[symbol]/route.ts",
        "src/app/api/scrape/news/route.ts",
        "src/app/api/scrape/announcements/route.ts",
        "src/app/api/stocks/route.ts",
    ],
    "tab.dividends": ["src/app/api/dividends/all/route.ts"],
    "tab.signals_v2": [
        "src/app/api/signals/route.ts",
        "src/app/api/signals/[id]/route.ts",
    ],
    "tab.calculators": [
        "src/app/api/fair-value/route.ts",
        "src/app/api/fair-value/[symbol]/route.ts",
        "src/app/api/tax/cgt/route.ts",
        "src/app/api/tax/dividend/route.ts",
    ],
    "tab.golden_cross": ["src/app/api/golden-cross/route.ts"],
    "tab.volatility_analytics": ["src/app/api/volatility/route.ts"],
    "feature.backtest_reports": ["src/app/api/data-readiness/route.ts"],
}

HANDLER_RE = re.compile(
    r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\("
)
IMPORT_START_RE = re.compile(r"^import\b")
IMPORT_NAME_RE = re.compile(r"^([A-Za-z_$][A-Za-z0-9_$]*)\s*:")
IMPORT_LINE = 'import { guardUser } from "@/lib/latent/access-control";\n'


def balance(text: str) -> int:
    """Net bracket balance (should not change from our edits)."""
    counts = {"{": 0, "}": 0, "(": 0, ")": 0}
    for ch in text:
        if ch in counts:
            counts[ch] += 1
    return (counts["{"] - counts["}"]) + (counts["("] - counts[")"])


def match_paren(text: str, open_idx: int):
    """Return index of the ')' matching the '(' at open_idx."""
    depth = 0
    for i in range(open_idx, len(text)):
        c = text[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
    raise ValueError("unmatched paren")


def first_param_span(param_text: str):
    """Span (0, idx) of the first top-level comma in param_text, or whole."""
    depth = 0
    for i, c in enumerate(param_text):
        if c in "(<[":
            depth += 1
        elif c in ")>]":
            depth -= 1
        elif c == "," and depth == 0:
            return (0, i)
    return (0, len(param_text))


def last_import_end(text: str):
    """Char offset just after the end of the last import statement (its newline)."""
    lines = text.split("\n")
    last_end_line = -1
    i = 0
    while i < len(lines):
        if IMPORT_START_RE.match(lines[i]):
            j = i
            while j < len(lines) and not lines[j].rstrip().endswith(";"):
                j += 1
            if j < len(lines):
                last_end_line = j
            i = j + 1
        else:
            i += 1
    if last_end_line < 0:
        return 0, 0  # insert at very top
    # offset of end of that line (just past the newline)
    off = sum(len(l) + 1 for l in lines[: last_end_line + 1])
    return off, 0


changed_files = []
errors = []
skipped = []
total_handlers = 0

for perm, files in PERMS.items():
    for rel in files:
        path = ROOT + rel
        try:
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
        except Exception as e:
            errors.append(f"{rel}: cannot read ({e})")
            continue

        if "guardUser" in text:
            skipped.append(f"{rel}: already contains guardUser")
            continue

        before_balance = balance(text)
        edits = []  # (start, end, replacement)
        gated = 0

        for m in HANDLER_RE.finditer(text):
            handler = m.group(1)
            open_paren = m.end() - 1
            close_paren = match_paren(text, open_paren)
            param_text = text[open_paren + 1 : close_paren]
            # body opening brace: first non-whitespace after close paren
            k = close_paren + 1
            while k < len(text) and text[k] in " \t\r\n":
                k += 1
            if k >= len(text) or text[k] != "{":
                errors.append(
                    f"{rel}: {handler} body brace not found after signature"
                )
                continue

            if param_text.strip() == "":
                # no request parameter -> add one
                edits.append((open_paren, close_paren + 1, "(req: Request)"))
                reqname = "req"
            else:
                s, e = first_param_span(param_text)
                first = param_text[s:e].strip()
                nm = IMPORT_NAME_RE.match(first)
                if nm:
                    reqname = nm.group(1)
                elif re.match(r"^[A-Za-z_$][A-Za-z0-9_$]*$", first):
                    reqname = first
                else:
                    errors.append(
                        f"{rel}: {handler} unrecognized first param: {first[:60]!r}"
                    )
                    continue

            guard_block = (
                '\n  const __g = await guardUser(%s, "%s");\n'
                "  if (__g) return __g;"
            ) % (reqname, perm)
            edits.append((k, k + 1, "{" + guard_block))
            gated += 1

        if not edits:
            if not any(rel in e for e in errors):
                errors.append(f"{rel}: no exported HTTP handler matched")
            continue

        # import insertion offset computed on original text
        imp_off, _ = last_import_end(text)
        edits.append((imp_off, imp_off, IMPORT_LINE))

        # apply edits in reverse positional order
        new_text = text
        for start, end, repl in sorted(edits, key=lambda t: -t[0]):
            new_text = new_text[:start] + repl + new_text[end:]

        after_balance = balance(new_text)
        if after_balance != before_balance:
            errors.append(
                f"{rel}: bracket balance changed {before_balance}->{after_balance}; aborted"
            )
            continue

        with open(path, "w", encoding="utf-8") as f:
            f.write(new_text)
        changed_files.append((rel, gated))
        total_handlers += gated

print("=== CHANGED (%d files, %d handlers gated) ===" % (len(changed_files), total_handlers))
for rel, n in changed_files:
    print(f"  {n} handler(s): {rel}")
print("=== SKIPPED ===")
for s in skipped:
    print("  " + s)
print("=== ERRORS ===")
if errors:
    for e in errors:
        print("  " + e)
else:
    print("  none")
sys.exit(1 if errors else 0)
