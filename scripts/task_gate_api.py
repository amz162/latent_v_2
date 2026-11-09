#!/usr/bin/env python3
"""Task: apply guardUser authorization gates to assigned Next.js API route handlers.

Recipe per exported handler (GET/POST/PUT/DELETE):
1. Ensure handler has a request parameter (add `req: Request` if none).
2. Insert guard lines as first statements in the body.
3. Add guardUser import once per file (after last existing import).
Skips files/handlers that already reference guardUser.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project")

# permission -> files
ASSIGNMENTS = {
    "tab.dashboard": [
        "src/app/api/signals/all/route.ts",
    ],
    "feature.signal_data": [
        "src/app/api/ai-model-signals/[symbol]/route.ts",
        "src/app/api/ml/signal/[symbol]/route.ts",
    ],
    "tab.pattern_finder": [
        "src/app/api/price-patterns/route.ts",
        "src/app/api/price-patterns/[symbol]/route.ts",
        "src/app/api/stock-patterns/[symbol]/route.ts",
    ],
    "tab.pattern_finder_financial": [
        "src/app/api/result-patterns/route.ts",
        "src/app/api/result-patterns/[symbol]/route.ts",
    ],
    "tab.ai_model_signals": [
        "src/app/api/backtest/ensembles/route.ts",
        "src/app/api/backtest/model-graph/route.ts",
        "src/app/api/backtest/model-graph/ml/route.ts",
    ],
    "feature.backtest_reports": [
        "src/app/api/backtest/report/route.ts",
        "src/app/api/backtest/task79-results/route.ts",
        "src/app/api/backtest/task81-results/route.ts",
        "src/app/api/backtest/per-stock-walk-forward/route.ts",
        "src/app/api/backtest/walk-forward/route.ts",
        "src/app/api/backtest/walk-forward/portfolio/route.ts",
        "src/app/api/backtest/walk-forward/prospective/route.ts",
        "src/app/api/backtest/walk-forward/robustness/route.ts",
        "src/app/api/backtest/walk-forward/trading/route.ts",
        "src/app/api/backtest/walk-forward/trading-robustness/route.ts",
    ],
    "feature.research_backtest": [
        "src/app/api/backtest/strategy-comparison/route.ts",
    ],
    "tab.llm_signals": [
        "src/app/api/llm-signals/route.ts",
        "src/app/api/llm-signals/[id]/route.ts",
        "src/app/api/ai-analysis/route.ts",
        "src/app/api/ai-analysis/[symbol]/route.ts",
        "src/app/api/task111-overlays/route.ts",
    ],
    "tab.model_report": [
        "src/app/api/model-report/route.ts",
    ],
    "tab.paper_monitor": [
        "src/app/api/paper-trading/monitor/route.ts",
        "src/app/api/paper-trading/monitor/[tradeId]/route.ts",
    ],
}

IMPORT_LINE = 'import { guardUser } from "@/lib/latent/access-control";'
HANDLER_RE = re.compile(r"^(export async function (GET|POST|PUT|DELETE)\s*\()")


def find_signature(lines, start):
    """Given the line index where `export async function NAME(` starts, return
    (open_paren_line, open_paren_col, close_paren_line, close_paren_col,
    body_open_line) using paren balance from the opening paren."""
    joined = ""
    offsets = []  # (line_idx, line_start_in_joined, line_len)
    for i in range(start, len(lines)):
        offsets.append((i, len(joined), len(lines[i])))
        joined += lines[i] + "\n"
    base = offsets[0][1]
    op = joined.find("(", base)
    if op < 0:
        raise ValueError("no opening paren")
    depth = 0
    cl = None  # close paren index in joined
    for j in range(op, len(joined)):
        c = joined[j]
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                cl = j
                break
    if cl is None:
        raise ValueError("unbalanced parens in signature")
    # find body opening '{' after the closing paren
    bo = joined.find("{", cl)
    if bo < 0:
        raise ValueError("no body brace after signature")
    # map positions back to lines
    def to_line(pos):
        for li, ls, ll in offsets:
            if ls <= pos < ls + ll + 1:
                return li, pos - ls
        return offsets[-1][0], 0

    opl, opc = to_line(op)
    cpl, cpc = to_line(cl)
    bol, boc = to_line(bo)
    return opl, opc, cpl, cpc, bol, bo


def param_name_of(params):
    m = re.search(r"\b(req|_req|request)\b", params)
    return m.group(1) if m else None


def process_file(rel, permission, results):
    path = ROOT / rel
    text = path.read_text()
    if "guardUser" in text:
        results.append((rel, "skipped", "already contains guardUser"))
        return
    lines = text.split("\n")
    ops = []  # (line_idx, kind, payload) applied bottom-up
    gated = 0
    for idx, line in enumerate(lines):
        m = HANDLER_RE.match(line)
        if not m:
            continue
        opl, opc, cpl, cpc, bol, bo = find_signature(lines, idx)
        # param text
        joined = "\n".join(lines)
        # recompute param substring from lines
        if opl == cpl:
            params = lines[opl][opc + 1 : cpc]
        else:
            params = lines[opl][opc + 1 :]
            for k in range(opl + 1, cpl):
                params += "\n" + lines[k]
            params += "\n" + lines[cpl][:cpc]
        pname = param_name_of(params)
        if pname is None:
            # add request parameter
            if opl == cpl and params.strip() == "":
                # single-line empty params: GET() -> GET(req: Request)
                lines[opl] = lines[opl][:opc + 1] + "req: Request" + lines[opl][cpc:]
            elif opl == cpl:
                lines[opl] = lines[opl][:opc + 1] + "req: Request, " + lines[opl][opc + 1:]
            else:
                first_param_line = opl + 1
                lines.insert(first_param_line, "  req: Request,")
                # shift subsequent tracked positions by 1
                if cpl >= first_param_line:
                    cpl += 1
                if bol >= first_param_line:
                    bol += 1
            pname = "req"
        guard_lines = [
            f'  const __g = await guardUser({pname}, "{permission}");',
            "  if (__g) return __g;",
        ]
        ops.append((bol, "insert_lines", guard_lines))
        gated += 1
    if gated == 0:
        results.append((rel, "error", "no GET/POST/PUT/DELETE handler found"))
        return
    # import: find last line belonging to an import statement
    last_import = -1
    in_import = False
    for i, line in enumerate(lines):
        if not in_import and re.match(r"^import\b", line):
            in_import = True
        if in_import:
            last_import = i
            if line.rstrip().endswith(";") and not line.rstrip().endswith(","):
                # statement end heuristic: line ends with ';' (and not a comma continuation)
                in_import = False
            elif line.rstrip().endswith(";"):
                in_import = False
    if last_import >= 0:
        ops.append((last_import, "insert_after", [IMPORT_LINE]))
    else:
        ops.insert(0, (0, "insert_lines", [IMPORT_LINE, ""]))
    # apply bottom-up
    ops.sort(key=lambda o: o[0], reverse=True)
    for line_idx, kind, payload in ops:
        if kind == "insert_lines":
            for offset, extra in enumerate(payload):
                lines.insert(line_idx + 1 + offset, extra)
        elif kind == "insert_after":
            lines.insert(line_idx + 1, payload[0])
    path.write_text("\n".join(lines))
    results.append((rel, "ok", f"gated {gated} handler(s), permission={permission}"))


def main():
    results = []
    for permission, files in ASSIGNMENTS.items():
        for rel in files:
            process_file(rel, permission, results)
    for rel, status, note in results:
        print(f"[{status.upper()}] {rel} :: {note}")
    ok = sum(1 for _, s, _ in results if s == "ok")
    skipped = sum(1 for _, s, _ in results if s == "skipped")
    errs = sum(1 for _, s, _ in results if s == "error")
    print(f"\nSummary: {ok} files gated, {skipped} skipped, {errs} errors")


if __name__ == "__main__":
    sys.exit(main())
