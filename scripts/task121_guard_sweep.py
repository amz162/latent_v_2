#!/usr/bin/env python3
"""Task 121 — apply authorization insertions to special API routes.

For each configured file:
  1. add the access-control import after the last existing import line,
  2. normalize handlers that take no request to take one,
  3. insert a guard/gate block as the first statements of the handler.

Idempotent: skips files that already carry the inserted marker.
"""
import json, re, sys

MARKER = "__task121_gate"

def imp(name):
    return f'import {{ {name} }} from "@/lib/latent/access-control";'

KIND_BLOCKS = {
    "admin_or_internal": ("guardAdminOrInternal",
        "  const __task121_gate = await guardAdminOrInternal(req as NextRequest | Request);\n"
        "  if (__task121_gate) return __task121_gate;\n"),
    "user_or_internal": ("guardUserOrInternal",
        "  const __task121_gate = await guardUserOrInternal(req as NextRequest | Request);\n"
        "  if (__task121_gate) return __task121_gate;\n"),
}

def gate_block(opts: dict) -> str:
    return ("  const __task121_gate = await gateUser(req as NextRequest | Request, "
            + json.dumps(opts) + ");\n"
            "  if (__task121_gate instanceof Response) return __task121_gate;\n")

FILES = [
    ("src/app/api/cron/scheduler-status/route.ts", "admin_or_internal", ["GET"]),
    ("src/app/api/backtest/walk-forward/status/route.ts", "admin_or_internal", ["GET"]),
    ("src/app/api/cron/refresh-ohlcv/route.ts", "admin_or_internal", ["GET"]),
    ("src/app/api/cron/check-tp-sl/route.ts", "user_or_internal", ["GET"]),
    ("src/app/api/track-record/route.ts",
     {"permission": "tab.dashboard"}, ["GET"]),
    ("src/app/api/simulate/route.ts",
     {"permission": "feature.research_backtest", "usage": "simulator_run", "respectFeaturePause": True}, ["GET"]),
    ("src/app/api/backtest/run/route.ts",
     {"permission": "feature.research_backtest", "usage": "simulator_run", "respectFeaturePause": True}, ["POST"]),
    ("src/app/api/backtest/investment-simulator/route.ts",
     {"permission": "feature.research_backtest", "usage": "simulator_run", "respectFeaturePause": True}, ["GET"]),
    ("src/app/api/backtest/signal-stats/route.ts",
     {"permission": "tab.tracker"}, ["GET"]),
    ("src/app/api/llm/interpret-news/route.ts",
     {"permission": "feature.llm_interact", "usage": "llm_request",
      "requireSetting": "llm_requests_enabled", "respectFeaturePause": True}, ["POST"]),
    ("src/app/api/llm/explain-signal/[symbol]/route.ts",
     {"permission": "feature.llm_interact", "usage": "llm_request",
      "requireSetting": "llm_requests_enabled", "respectFeaturePause": True}, ["GET"]),
    ("src/app/api/pattern-recognition/[symbol]/route.ts",
     {"permission": "feature.llm_interact", "usage": "llm_request",
      "requireSetting": "llm_requests_enabled", "respectFeaturePause": True}, ["GET"]),
    ("src/app/api/portfolio/news-digest/route.ts",
     {"permission": "feature.llm_interact", "usage": "llm_request",
      "requireSetting": "llm_requests_enabled", "respectFeaturePause": True}, ["GET"]),
    ("src/app/api/llm-signals/export/route.ts",
     {"permission": "feature.reports_export", "usage": "report_export"}, ["GET"]),
    ("src/app/api/model-report/download/route.ts",
     {"permission": "feature.reports_export", "usage": "report_export"}, ["GET"]),
]

def find_handler(lines, h):
    """Return (start_idx, end_idx_of_opening) for `export async function H(...) {`.
    end_idx is the line containing the `{` that opens the body (inclusive)."""
    for i, l in enumerate(lines):
        if l.startswith(f"export async function {h}(") or l.startswith(f"export async function {h} ("):
            depth = 0
            has_req = False
            for j in range(i, min(i + 12, len(lines))):
                seg = lines[j]
                depth += seg.count("(") - seg.count(")")
                if "req" in seg.split(":")[0]:
                    has_req = True
                if "{" in seg and j > i or (j == i and "{" in seg.split(")", 1)[-1]):
                    pass
                if depth <= 0 and "{" in seg:
                    return i, j, has_req
            # fallback: body opens on the same line as `) {`
            return i, None, has_req
    return None, None, None

def main():
    changed = skipped = 0
    for path, kind, handlers in FILES:
        src = open(path).read()
        if MARKER in src:
            skipped += 1
            continue
        lines = src.split("\n")

        if isinstance(kind, str):
            fn_name, block = KIND_BLOCKS[kind]
        else:
            fn_name, block = "gateUser", gate_block(kind)

        # 1) import after last import line (before shifting)
        last_import = max(i for i, l in enumerate(lines) if l.startswith("import "))
        lines.insert(last_import + 1, imp(fn_name))

        # 2+3) handler normalization + guard insertion
        for h in handlers:
            found = find_handler(lines, h)
            if not found or found[0] is None:
                print(f"HANDLER NOT FOUND: {h} in {path}"); sys.exit(1)
            start, end, has_req = found
            if end is None:
                print(f"UNRESOLVED BODY: {h} in {path}"); sys.exit(1)
            if not has_req:
                if start == end:
                    # one-line signature: `export async function GET() {`
                    lines[start] = lines[start].replace(
                        f"export async function {h}()", f"export async function {h}(req: Request)")
                else:
                    # multi-line signature — add a req param line right after the opening line
                    lines.insert(start + 1, "  req: Request,")
                    end += 1
            # insert guard block after the body-opening line
            lines.insert(end + 1, block.rstrip("\n"))
        open(path, "w").write("\n".join(lines))
        changed += 1
        print(f"OK {path}")
    print(f"\nchanged: {changed}, skipped(already): {skipped}")

if __name__ == "__main__":
    main()
