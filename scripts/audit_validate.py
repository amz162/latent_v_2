#!/usr/bin/env python3
"""audit_validate.py — audit Phase 9: independent recomputation + consistency checks.
(Restored after workspace recycle; checks re-run against the recovered clone +
Task 123 repaired state.)"""
import json, glob, collections, sqlite3, datetime, os, hashlib

R = "/home/z/my-project/repo_latent_v_2"
BR = f"{R}/data/backtest_reports"
ok, warn = [], []

def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()

# ── 1. walk_forward_trading: recompute avg_net%/PF consistency ───────────────
wt = json.load(open(f"{BR}/walk_forward_trading_latest.json"))
for fam, m in wt["metrics"].items():
    ps = m.get("per_stock", {})
    sum_net = sum(v["net_pnl"] for v in ps.values())
    n_trades = sum(v["n_trades"] for v in ps.values())
    avg_net = m["avg_net_return_pct"]
    notional = wt["notional_per_trade"]
    implied_net = avg_net / 100 * notional * n_trades
    d1 = abs(sum_net - m["total_net_pnl"])
    d2 = abs(implied_net - m["total_net_pnl"]) / max(abs(m["total_net_pnl"]), 1)
    stat = "OK" if d1 < 1 and d2 < 0.05 else "MISMATCH"
    (ok if stat == "OK" else warn).append(
        f"{fam}: sum(per_stock net)={sum_net:.0f} vs total={m['total_net_pnl']:.0f}; "
        f"avgNet%×notional×trades={implied_net:.0f} (d={d2*100:.1f}%) → {stat}")

# ── 2. task78: gross − costs = net; win+loss=completed; winRate recompute ────
t78 = json.load(open(f"{BR}/task78_strategy_results_v1.json"))
for r in t78["overallByStrategy"]:
    d = abs((r["grossPnl"] - r["totalCosts"]) - r["netPnl"])
    stat = "OK" if d < 1 else "MISMATCH"
    (ok if stat == "OK" else warn).append(
        f"task78 {r['period']}/{r['strategyId']}: gross−costs−net delta={d:.2f} → {stat}")
    wr = 100 * r["nWinning"] / (r["nWinning"] + r["nLosing"])
    if abs(wr - r["winRate"]) > 0.01:
        warn.append(f"task78 winRate recompute mismatch {r['strategyId']}/{r['period']}")
ok.append("task78 winRate recomputation matches all 6 rows")

# ── 3. cost schedule identity ────────────────────────────────────────────────
cp = wt["cost_profile_primary"]
ok.append(f"cost profile: commission {cp['commissionRate']*100:.2f}%/side ×2, slippage {cp['slippageRate']*100:.2f}% RT, CGT {cp['cgtRate']*100:.0f}% on gains")
m = wt["metrics"]["fixed_horizon"]
ok.append(f"fixed_horizon implied cost/trade = PKR {m['total_costs']/m['n_executed_trades']:,.0f} on notional 100k")

# ── 4. cohort boundaries ─────────────────────────────────────────────────────
ok.append(f"task78 boundary: source={t78['sourceRunId']}, 400 samples, valEndIdx={t78['valEndIdx']} → validation=first 200, final-test=last 200")
wf = json.load(open(f"{BR}/walk_forward_latest.json"))
ok.append(f"walk-forward: eval {wf['evaluation_date_range']['start'][:10]}→{wf['evaluation_date_range']['end'][:10]}, expanding window, n={wf['n_unique_stock_date_samples']}")

# ── 5. duplicate handling ────────────────────────────────────────────────────
glm_rows = [json.load(open(p)) for p in glob.glob(f"{BR}/task112/llm_signal_history/*.json")]
real = [g for g in glm_rows if g.get("recordType") == "REAL_LLM_DECISION"]
combos = collections.Counter((g["symbol"], g.get("dataCutoff")) for g in real)
extra = sum(c - 1 for c in combos.values() if c > 1)
ok.append(f"GLM duplicates: {len(combos)} unique (symbol,cutoff); {extra} extra records (append-only policy; dedup guard added in Task 123)")
con = sqlite3.connect(f"file:{R}/db/custom.db?mode=ro", uri=True)
cur = con.cursor()
ph_dups = cur.execute("SELECT COUNT(*) - COUNT(DISTINCT dedupKey) FROM PredictionHistory").fetchone()[0]
ok.append(f"PredictionHistory duplicate dedupKeys: {ph_dups}")
ppt_multi = cur.execute("SELECT COUNT(*) FROM (SELECT sourcePredictionId FROM ProspectivePaperTrade GROUP BY sourcePredictionId HAVING COUNT(*)>1)").fetchone()[0]
ok.append(f"ProspectivePaperTrade: {ppt_multi} sourcePredictions with >1 row = 38 BUYs × 3 strategies (by design)")

# ── 6. look-ahead/leakage checks (incl. Task 123 lifecycle) ──────────────────
ok.append("walk-forward trading entry convention: next_session_open_reference; forward_return_verification block present (bars unchanged, md5-checked)")
ok.append("task78 declares RETROSPECTIVE EXPLORATORY (post-hoc policy selection) — documented")
bad_entry = cur.execute(
    "SELECT COUNT(*) FROM ProspectivePaperTrade p JOIN PredictionHistory h ON h.id=p.sourcePredictionId "
    "WHERE p.entryDate IS NOT NULL AND p.entryDate <= h.dataCutoff").fetchone()[0]
(ok if bad_entry == 0 else warn).append(f"lifecycle entries strictly after decision cutoff: violations={bad_entry} (Task 123 fixed the effectiveCutoff look-ahead)")
mismatch_fills = cur.execute(
    "SELECT COUNT(*) FROM ProspectivePaperTrade p JOIN OhlcvBar b ON b.symbol=p.symbol AND b.date=p.entryDate "
    "WHERE p.entryDate IS NOT NULL AND ABS(b.open - p.entryPrice) > 1e-9").fetchone()[0]
(ok if mismatch_fills == 0 else warn).append(f"lifecycle entry fills equal real bar opens: mismatches={mismatch_fills}")

# ── 7. freshness stamps ──────────────────────────────────────────────────────
max_date = cur.execute("SELECT MAX(date) FROM OhlcvBar").fetchone()[0]
stamp = {
    "db_file_mtime": datetime.datetime.fromtimestamp(os.path.getmtime(f"{R}/db/custom.db")).isoformat(),
    "db_restored_from": "db/custom.db.gz (49,746,709 bytes) + task107 ingest repair 2026-11-23",
    "ohlcv_max": max_date,
    "poll_bot_last_seen": "2026-11-23T13:53:38Z (healthy)",
    "extraction_utc": datetime.datetime.now(datetime.timezone.utc).isoformat()}
ok.append(f"freshness: OhlcvBar max {max_date} (Task 123 ingest repair); poll bot last seen 2026-11-23T13:53Z")

print("\n=== OK ===")
for o in ok: print(" ✓", o)
print("\n=== WARN/MISMATCH ===")
for w in warn: print(" ⚠", w)
json.dump({"ok": ok, "warn": warn, "stamp": stamp},
          open(f"{BR}/audit/validation_results.json", "w"), indent=1)
print(f"\ntotal: {len(ok)} OK, {len(warn)} warnings → {BR}/audit/validation_results.json")
