#!/usr/bin/env python3
"""Task 107 v2 cost quote helper — authoritative estimated-exit-cost path.
Reads a JSON file [{key, buyQuantity, buyPrice, exitLegs:[{quantity, exitPrice}], grossPnl}]
and writes computeTradeCostsV2 results (PSX_USER_SCHEDULE_V2, ATL_15) per key.
Usage: bun scripts/task107_cost_quote.ts <in.json> <out.json>"""
import json, subprocess, sys
from pathlib import Path

TS = r'''
import { readFileSync, writeFileSync } from "fs";
import { computeTradeCostsV2, PSX_USER_SCHEDULE_V2 } from "../src/lib/latent/trading-costs";

interface Item { key: string; buyQuantity: number; buyPrice: number; exitLegs: { quantity: number; exitPrice: number }[]; grossPnl: number; }
const [inPath, outPath] = process.argv.slice(2);
const items: Item[] = JSON.parse(readFileSync(inPath, "utf8"));
const out: Record<string, unknown> = {};
for (const it of items) {
  const c = computeTradeCostsV2(it.buyQuantity, it.buyPrice, it.exitLegs, it.grossPnl, PSX_USER_SCHEDULE_V2, "ATL_15");
  out[it.key] = {
    // exit-side costs only (buy costs already sunk at entry)
    exitSideCosts: Math.round((c.totalBrokerage + c.totalPSX + c.totalNCCPL + c.totalCDC + c.totalSlippage - c.buy.brokerage - c.buy.psxFee - c.buy.nccplFee - c.buy.cdcFee - c.buy.slippage) * 100) / 100,
    cgt: c.cgt, totalCost: Math.round(c.totalCost * 100) / 100, netPnl: Math.round(c.netPnl * 100) / 100,
  };
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ n: Object.keys(out).length }));
'''

def main() -> None:
    inp, outp = sys.argv[1], sys.argv[2]
    Path("/tmp/t107_cost_quote.ts").write_text(TS)
    r = subprocess.run(["bun", "/tmp/t107_cost_quote.ts", inp, outp], capture_output=True, text=True, cwd="/home/z/my-project", timeout=120)
    print((r.stdout or r.stderr).strip().splitlines()[-1] if (r.stdout or r.stderr).strip() else f"rc={r.returncode}")
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
